# Kaze · Migración al proyecto del HUB/CMS (esquema `kaze`) + SSO — Design Doc

Fecha: 2026-09-20 · Estado: **aprobado por el usuario** (brainstorming en sesión)

## 1. Contexto y alcance

El proyecto Supabase de Kaze (`kvjpxnswvlxzxdzgycbh`) está **pausado** desde ~julio 2026 y la app
en Vercel carga pero no puede loguear. La causa no es un fallo: el plan Free de Supabase permite
2 proyectos activos por organización y ya están ocupados por vento-cms y Casa de Fe.

En vez de restaurarlo, **Kaze se consolida dentro del proyecto compartido `nrysdnavawyhaqgruunl`**,
donde ya conviven el CMS (esquema `public`) y el Vento HUB (esquema `hub`). Kaze entra como
esquema **`kaze`**, siguiendo el patrón que el HUB ya probó en producción. Así producción revive
sin pagar Pro, y Kaze deja de ser una isla dentro del ecosistema Vento.

### Decisiones cerradas (respuestas del usuario)

1. **Alcance: mudanza + ciudadano del HUB**, en un solo spec — esquema, dominio propio, SSO con
   HUB y CMS, y tile en el lanzador.
2. **La pertenencia a Kaze la define `kaze.profiles`**, no `hub.staff`. Estar en `auth.users` no
   da acceso. `hub.staff` sigue respondiendo solo "¿puede entrar a la intranet de Vento?".
3. **Los datos se recrean** con migraciones + seed selectivo. El proyecto pausado no se restaura
   ni se lee.
4. **Dominio: `kaze.ventosolutions.ca`**, con `kazevento.ventosolutions.ca` como alterno si
   Hostinger rechaza el nombre corto (ya pasó con `hub`).
5. **Alta solo por invitación explícita**: se elimina el trigger automático de Kaze; la fila en
   `kaze.profiles` la crea únicamente el módulo `/admin`.

### Por qué esto no es solo una mudanza de tablas

`auth.users` pasa a ser compartida. Hoy el RLS de Kaze es `using (true)` para cualquier
`authenticated`: **si se mudara tal cual, cualquier usuario del CMS podría leer la cartera A3
completa de todos los clientes de Cota.** Cerrar eso es el trabajo central de este spec, no un
detalle de implementación.

### Fuera de alcance

- RLS por-cliente y la Vista de Cliente (sub-proyecto propio; este spec deja el terreno listo).
- Unificar `kaze.clients` con el Clients Core (`core`) de la Fase 2 del HUB. Se anota la deuda:
  son conceptualmente el mismo maestro de clientes y habrá que reconciliarlos.
- Tajadas 2b (búsqueda/filtros) y 2c (creación) de la Lista de Proyectos.
- Cualquier cambio funcional de Kaze. Esta es una migración: la app debe hacer lo mismo que hoy.

## 2. Enfoque

Mudanza por esquema, no por proyecto: PostgREST expone `kaze` igual que expone `hub`, y el
cliente de Supabase se construye una sola vez apuntando a ese esquema. La capa de datos —la parte
con más tests y más revisada— **no cambia ni una query**.

La seguridad se mueve de "confiar en que solo los nuestros tienen cuenta" a "comprobar membresía
en cada policy". Es el cambio conceptual del spec.

## 3. Arquitectura

### 3.1 Esquema `kaze`

Las 9 tablas se mudan sin cambios de forma: `clients`, `profiles`, `projects`, `kpis`,
`measurements`, `business_cases`, `expenses`, `actions`, `action_notes`.

Requisito de PostgREST: añadir `kaze` a **Settings → API → Exposed schemas** (igual que `hub`).
Sin eso la Data API no ve el esquema, con grants o sin ellos.

### 3.2 Cambios de código

- `lib/supabase/server.ts`, `client.ts` y `admin.ts`: `createClient(url, key, { db: { schema: 'kaze' } })`.
- `lib/database.types.ts`: regenerar con `--schema kaze`.
- `lib/data/*.ts`: **sin cambios de query**. Solo se ajustan los tipos si la generación anida por
  esquema.
- `scripts/seed.ts` y `scripts/create-admin.ts`: apuntar al esquema nuevo **y crear las filas de
  `kaze.profiles` explícitamente**. Hoy no lo hacen: se apoyan en el trigger `handle_new_user`,
  que esta migración elimina (§4.4). Si se mudan sin tocar eso, el seed crea usuarios en
  `auth.users` sin perfil, y **ninguno podrá leer nada** porque `es_miembro()` será falso para
  todos. Es el fallo más probable de la fase 1.
- Tests: solo la construcción del cliente; las aserciones se quedan igual.

### 3.3 Migraciones

Se reescriben `0001`–`0004` contra `kaze` en un juego nuevo, no se parchean las viejas: el
proyecto destino nunca tuvo las originales, y un historial limpio vale más que la fidelidad al
anterior. Las migraciones viejas se conservan en el repo marcadas como históricas.

## 4. Seguridad

### 4.1 Por qué Kaze NO copia el modelo del HUB

El HUB no otorga ningún grant a `anon`/`authenticated` y lo lee todo con `service_role`. Funciona
porque lo usan dos personas de Vento y el gate vive en el código de la app.

Kaze no puede hacer eso: su roadmap incluye **usuarios cliente** (alguien de Clínica Norte viendo
solo sus A3), y eso exige que el filtrado viva en RLS con el JWT del usuario, no en el código.
Kaze mantiene por tanto el modelo anon+cookies, y `authenticated` sí recibe grants sobre `kaze`.
La defensa está en las policies.

### 4.2 La función de membresía

```sql
create function kaze.es_miembro() returns boolean
  language sql stable security definer set search_path = kaze, pg_temp
as $$ select exists (
  select 1 from kaze.profiles where id = auth.uid()
) $$;

revoke execute on function kaze.es_miembro() from public;
grant execute on function kaze.es_miembro() to authenticated;
```

**`security definer` no es opcional aquí.** La expresión de una policy se evalúa como el usuario
que consulta; sin `definer`, `authenticated` necesitaría SELECT sobre `kaze.profiles`, y la policy
de `profiles` acabaría consultándose a sí misma. `set search_path` fijo es obligatorio en toda
función `security definer`.

**Basta con que exista la fila; no hay condición de "activo".** `profiles` no tiene esa columna
(sus columnas son `id`, `nombre`, `iniciales`, `rol`, `created_at`): desactivar a alguien en
`/admin` es un **ban de GoTrue** (`ban_duration`, `lib/data/users.ts`), que impide emitir y
refrescar el JWT. El bloqueo ocurre por tanto en la capa de auth, antes de que RLS entre en juego.
No añadir una columna `activo` "por coherencia": duplicaría el estado en dos sitios que se pueden
desincronizar.

Limitación conocida, heredada y no introducida por esta migración: un access token ya emitido
sigue siendo válido hasta que caduca (~1 h), así que un ban no corta la sesión en curso de
inmediato. Si alguna vez hace falta expulsión instantánea, ahí sí habría que añadir la columna y
comprobarla en `es_miembro()`.

### 4.3 Policies

- Tablas de negocio (las 8 que no son `profiles`): las cuatro policies pasan de `using (true)` a
  `using (kaze.es_miembro())`, con `with check (kaze.es_miembro())` en insert/update.
- `profiles`: SELECT para miembros (`kaze.es_miembro()`); UPDATE solo la fila propia
  (`auth.uid() = id`). Se conservan los grants por columna de `0004` para que nadie pueda
  cambiarse su propio `rol` vía Data API.
- Se mantienen los GRANTs de Data API y los `alter default privileges`, ahora sobre `kaze`.

### 4.4 El trigger — mina a desactivar

**CMS y Kaze definen ambos `public.handle_new_user()` y un trigger `on_auth_user_created` sobre
`auth.users`, y las dos migraciones hacen `drop trigger if exists` antes de crearlo.**

Reglas duras para las migraciones nuevas de Kaze:

- **NO** crear ningún trigger sobre `auth.users`.
- **NO** incluir `drop trigger if exists on_auth_user_created on auth.users` — ese nombre es del
  CMS y lo dejaría sin creación de perfiles.
- **NO** crear ni reemplazar `public.handle_new_user()`.

El alta de miembros pasa a `/admin`: al invitar se crea el usuario en `auth.users` **si no existe**
y se inserta la fila en `kaze.profiles`. Si el correo ya tiene cuenta (p. ej. alguien del CMS),
solo se añade la fila. `lib/data/users.ts` debe reflejar esto.

## 5. Dominio y SSO

### 5.1 Dominio

Kaze pasa de `kaze-pauldvcoders-projects.vercel.app` a **`kaze.ventosolutions.ca`** (dominio en el
proyecto de Vercel + registro DNS en Hostinger). Alterno: `kazevento.ventosolutions.ca`.

Compartir sesión entre subdominios **exige** que las tres apps estén bajo `ventosolutions.ca`;
por eso el dominio es requisito del SSO, no cosmética.

### 5.2 El flip de cookies

Las tres apps (HUB, CMS, Kaze) pasan su cookie de sesión a `.ventosolutions.ca` y se despliegan
**juntas**. Una app a medio migrar deja sesiones inconsistentes.

Consecuencias aceptadas a ojos abiertos:

- El **sitio corporativo de Vento**, que vive en el apex, recibirá la cookie en cada request. No la
  usa y no puede leerla si es `httpOnly`, pero amplía la superficie.
- **Las sesiones vivas se cortan una vez.** Todo el mundo vuelve a entrar. Es un corte único y
  esperado, no un fallo.

También hay que actualizar **Site URL y Redirect URLs** en Supabase Auth del proyecto compartido
para incluir el dominio nuevo.

### 5.3 Tile en el lanzador

`hub.modules` ya tiene la fila `improvement` con `url: null` y `status: 'development'`. Al cerrar,
un `update` con la URL definitiva y `status: 'production'`.

## 6. Entorno local

Kaze conserva su stack propio en los puertos 553xx, ahora con esquema `kaze`. Como el gate es
`kaze.profiles` y no `hub.staff`, **no hace falta traerse el CMS ni el HUB a local**.

El SSO no se puede probar local de forma significativa (requiere tres apps en subdominios reales);
se verifica en producción tras el flip.

## 7. Orden de ejecución

Cinco fases con puntos de reversión naturales:

| Fase | Qué | Reversión |
|---|---|---|
| 1 | Esquema, migraciones, tipos, RLS, seed y tests **en local** | nada tocado fuera |
| 2 | Aplicar en el proyecto compartido + seed selectivo + admin | Kaze sigue apuntando al viejo; nadie afectado |
| 3 | Env de Vercel al proyecto compartido + dominio nuevo | **producción queda arreglada aquí** |
| 4 | Flip de cookies apex en los 3 repos, desplegados juntos | revertir los 3 despliegues |
| 5 | Tile en `hub.modules` | un `update` |

La fase 3 es el hito que importa: el premio (producción viva sin pagar Pro) se cobra **antes** de
tocar HUB y CMS. Si el flip se complica, la ganancia ya está asegurada.

El proyecto pausado `kvjpxnswvlxzxdzgycbh` se **deja como está** hasta que producción esté
verificada. Pausado no consume cupo. Borrarlo es una decisión posterior y deliberada.

## 8. Testing

- Los **46 tests actuales** deben seguir verdes contra el esquema `kaze` en local. Son la red que
  demuestra que la mudanza no cambió comportamiento.
- **Test nuevo y central: un usuario `authenticated` que NO es miembro lee cero filas.** Firmar con
  el cliente anon como un usuario sin fila en `kaze.profiles` y comprobar que `getProjectsList` y
  `getProjectsSummary` devuelven vacío y que un insert es rechazado. Es exactamente la regresión
  que introduce compartir `auth.users`, y hoy no existe ninguna prueba que la detecte.

  Requisito de montaje: el seed debe crear **un usuario extra sin perfil** que represente al
  "usuario del CMS" — alguien con cuenta válida en `auth.users` y cero pertenencia a Kaze. Sin
  él no hay forma de escribir este test, porque tras §3.2 todos los usuarios sembrados tienen
  perfil. Ese usuario es el sujeto de la prueba, no un descuido del seed: conviene nombrarlo de
  forma que se entienda (p. ej. `ajeno@cota.test`) y documentarlo en el propio seed.
- El test authenticated existente se conserva: un usuario **que sí es miembro** sigue leyendo las 8
  filas.
- Verificación en producción tras la fase 3 (login + `/proyectos` con los 3 A3) y tras la fase 4
  (entrar en HUB y pasar a Kaze sin volver a autenticarse).

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| Hostinger rechaza `kaze` como subdominio | alterno `kazevento` ya decidido; no bloquea |
| La migración pisa el trigger del CMS | reglas duras de §4.4, revisadas explícitamente antes de aplicar |
| El flip de cookies deja sesiones rotas | desplegar los 3 juntos; corte único comunicado |
| RLS mal cerrado expone datos de clientes | el test de no-miembro es criterio de aceptación, no opcional |
| Tipos generados anidan por esquema y rompen compilación | se detecta en fase 1, en local |

## 10. Criterios de aceptación (DoD)

- [ ] Esquema `kaze` creado en `nrysdnavawyhaqgruunl` y añadido a Exposed schemas.
- [ ] Las 9 tablas, con RLS gateado por `kaze.es_miembro()` y los grants de Data API.
- [ ] Ningún trigger nuevo sobre `auth.users`; el `on_auth_user_created` del CMS intacto y
      verificado funcionando después de aplicar.
- [ ] Los 46 tests verdes contra `kaze`; `npx tsc --noEmit` limpio; `npm run build` verde.
- [ ] Test de no-miembro: lee cero filas y no puede escribir.
- [ ] `/admin` da de alta miembros por invitación, incluyendo el caso "el correo ya existe en
      `auth.users`".
- [ ] Kaze responde en `kaze.ventosolutions.ca` contra el proyecto compartido, con los 3 A3 seed.
- [ ] Sesión compartida: entrar en el HUB y pasar a Kaze sin volver a autenticarse.
- [ ] Tile `improvement` con URL y `status: 'production'`.
- [ ] `AGENTS.md` y `START-HERE.md` al día; el proyecto viejo documentado como pausado y a la
      espera de borrado deliberado.
