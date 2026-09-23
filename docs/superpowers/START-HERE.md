# START HERE — Kaze · Mejoramiento de procesos

> Léeme primero al retomar. Última actualización: **2026-09-22**.
> Guía permanente del repo (comandos, peculiaridades del entorno): `AGENTS.md` en la raíz
> (Claude Code la carga sola vía `CLAUDE.md`). Este archivo es el **estado vivo**.

## ✅ Estado a 2026-09-22: PRODUCCIÓN ARREGLADA — T10 cerrada salvo un paso de dashboard

Producción corre el código nuevo (`50bd33b`) contra el proyecto compartido y lee el esquema `kaze`.
Verificado de punta a punta:

| Comprobación | Resultado |
|---|---|
| Deploy de producción | `50bd33b` · `● Ready` (build 26 s) |
| `https://kaze.ventosolutions.ca/proyectos` sin sesión | `307 -> /login` |
| `https://kaze.ventosolutions.ca/login` | `200`, TLS válido |
| Escaneo del bundle (HTML + 9 chunks JS) | **cero** `sb_secret_` |
| Los 3 A3 en `/proyectos` | confirmado por el usuario con `info@ventosolutions.ca` |

**`/admin` vuelve a ser seguro de usar**: las server actions escriben en `kaze.profiles`, no en el
`public` del CMS. El dominio definitivo es **`kaze.ventosolutions.ca`** (Hostinger sí aceptó el
nombre corto; no hizo falta el alterno `kazevento`). DNS: `CNAME` en la zona de Hostinger apuntando
al destino que da Vercel — **sin** carpeta ni subdominio de hosting, que Hostinger aquí es solo DNS.

### Lo único que falta de la T10

**[USUARIO] Redirect URLs** — Supabase → `nrysdnavawyhaqgruunl` → Authentication → URL Configuration:
añadir `https://kaze.ventosolutions.ca/**` a *Redirect URLs* (**añadir, no sustituir**; el Site URL
sigue apuntando al HUB). El login con contraseña no lo necesita; **las invitaciones de `/admin` sí**.

### Cómo quedaron las variables de Vercel — y la trampa del *tipo*

Estado final (proyecto `kaze`, Production + Preview):

| Variable | Tipo | Valor |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Config** | `https://nrysdnavawyhaqgruunl.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Config** | `sb_publishable_…` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** | `sb_secret_…` (solo servidor) |

Lo que costó media sesión descubrir: **las tres se habían creado como tipo `Secret`**, y una variable
`Secret` en Vercel es de **solo escritura** — `vercel env pull` devuelve `[SENSITIVE]` en vez del
valor, así que *nadie* (ni el usuario ni el agente) puede verificar qué contiene. Además Vercel ahora
**bloquea** guardar una variable `NEXT_PUBLIC_` de tipo `Secret`, porque Next.js la inyecta en el
bundle del navegador: sale el aviso *"Remove the public framework prefix… or change the variable to
Config"*. **No hay que borrar y recrear**: el propio aviso trae un botón **"Change to Config"** que
lo arregla en un clic (el valor de la `ANON_KEY` sí hay que volver a pegarlo, porque siendo `Secret`
Vercel ya no puede mostrarlo).

Corolario para el futuro: **`NEXT_PUBLIC_*` → `Config`; todo lo demás → `Secret`.** Y el comando de
verificación de abajo solo sirve contra variables `Config`; una `Secret` siempre saldrá
`[SENSITIVE]`, y eso es lo correcto.

Verificación segura sin exponer valores (solo prefijos; borra el archivo al terminar):
```bash
cd /c/Users/pauld/dev/cota && npx vercel env pull /tmp/kaze-env.tmp --environment=production --yes >/dev/null 2>&1 && for v in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY; do printf "%-32s " "$v"; grep "^$v=" /tmp/kaze-env.tmp | cut -d= -f2- | tr -d '"' | cut -c1-15; done; rm -f /tmp/kaze-env.tmp
```

### Recuperar el acceso del admin sin depender del correo

`info@ventosolutions.ca` es **la misma cuenta en Kaze, el HUB y el CMS** (comparten `auth.users`):
una sola contraseña para las tres, y cambiarla en una la cambia en todas.

Si se pierde, no hace falta SMTP ni tocar el Site URL. `app/auth/confirm/route.ts` acepta **cualquier**
`EmailOtpType`, así que se genera un token de `recovery` con la clave de servicio y se arma el enlace
a mano — **esto esquiva por completo la lista de Redirect URLs**:

```js
// node con NODE_PATH=/c/Users/pauld/dev/cota/node_modules; la clave sale del .env.local del HUB
const { data } = await db.auth.admin.generateLink({ type: 'recovery', email: 'info@ventosolutions.ca' })
// -> https://kaze.ventosolutions.ca/auth/confirm?token_hash=<data.properties.hashed_token>&type=recovery
```

El enlace canjea el token en el servidor y deja al usuario en `/cuenta/contrasena`, donde **él**
escribe la contraseña. Es de un solo uso y caduca (1 h por defecto). **El agente no introduce
contraseñas**; solo genera el enlace.

### El incidente de la clave secreta (resuelto, sin exposición)

Al configurar Vercel se pegó por error la `sb_secret_` en `NEXT_PUBLIC_SUPABASE_ANON_KEY`, y el
redeploy corrió con eso. **Verificado que NO se expuso**, por dos vías:
- **Empírica:** se descargó el HTML y los 8 chunks JS que recibe el navegador en `/login` del deploy
  afectado y se buscó el prefijo `sb_secret_`: **cero apariciones**.
- **Estructural:** `lib/supabase/client.ts` (el único cliente de navegador) **no lo importa nadie**
  — es código muerto — y ninguno de los 5 componentes `'use client'` toca Supabase. La variable solo
  vive en código de servidor, que nunca se envía al visitante.

Por eso **no hizo falta rotar la clave** (rotarla habría tumbado también el HUB, que usa la misma).
Pero fue suerte de arquitectura: el día que un componente de navegador use ese cliente, una secreta
en esa variable **sí** se filtraría.

Escaneo reutilizable (solo reporta si aparece; nunca imprime el valor):
```bash
U="https://<deployment>.vercel.app"; T=$(mktemp -d); curl -s "$U/login" -o "$T/p.html"; grep -oE '/_next/static/[^"'"'"' ]+\.js' "$T/p.html" | sort -u | while read -r c; do curl -s "$U$c" | grep -q "sb_secret_" && echo "!! sb_secret_ en $c"; done; grep -q sb_secret_ "$T/p.html" && echo "!! en el HTML"; echo "escaneo terminado"; rm -rf "$T"
```

## Plan en ejecución: migración a esquema `kaze` + SSO

**Plan:** `docs/superpowers/plans/2026-09-20-kaze-migracion-esquema-sso.md` (14 tareas, 5 fases).
**Spec:** `docs/superpowers/specs/2026-09-20-kaze-migracion-esquema-sso-design.md` (aprobado).
**Metodología:** `superpowers:subagent-driven-development`, un subagente por tarea.

Kaze se consolida dentro del proyecto Supabase compartido **`nrysdnavawyhaqgruunl`** (donde ya
viven el CMS en `public` y el HUB en `hub`) como esquema **`kaze`**, en vez de restaurar su proyecto
propio pausado. Motivo: el plan Free permite 2 proyectos activos y están ocupados.

| Tarea | Estado |
|---|---|
| T1 esquema `kaze` sin trigger en `auth.users` | ✅ `22d4f5e` + `b45d536` |
| T2 RLS por membresía (`kaze.es_miembro()`) | ✅ `9ff4ffb` |
| T3 clientes y tipos apuntando a `kaze` | ✅ `2dade33` |
| T4 seed crea perfiles + usuario `ajeno` | ✅ `b8719e6` + `6208bb4` |
| T5 suite existente contra `kaze` | ✅ `90a314b` |
| T6 test de no-miembro (probado en rojo y en verde) | ✅ `4e04175` + `df950f2` |
| T7 invitación crea perfil, admite cuentas del CMS | ✅ `6787988` |
| T8 cierre de la fase local | ✅ `42a0cd2` — **51/51 tests**, tsc, build |
| T9 aplicar en el proyecto compartido | ✅ `f80f730` — ver abajo |
| **T10 Vercel + dominio → producción arreglada** | ✅ **hito cumplido** — falta solo el Step 3 (Redirect URLs, [USUARIO]) |
| T11 flip de cookies apex en los 3 repos (SSO) | 🟡 **siguiente** |
| T12 verificar SSO | ⬜ |
| T13 tile en `hub.modules` | ⬜ |
| T14 docs + revisión final | ⬜ |

**Cómo se ejecutó la T10:** se verificó primero contra la URL de Vercel
(`kaze-pauldvcoders-projects.vercel.app`) para no esperar al DNS, y el dominio se resolvió en
paralelo. Funcionó: el DNS de Hostinger ya había propagado cuando se comprobó. El login con
contraseña no depende de las Redirect URLs de Supabase; las invitaciones de `/admin` sí, así que hay
que añadirlas **antes** de usar `/admin` (es el único paso que queda de la T10).

### Qué quedó en el proyecto compartido (T9, verificado)

9 tablas en `kaze`, 34 policies, `es_miembro` como `security definer`, esquema expuesto en la Data
API junto a `api`, `public`, `hub` y `graphql_public`. Datos: **3 proyectos** (A3-012, A3-014,
A3-030), **3 clientes**, **1 perfil** (`info@ventosolutions.ca`, rol `admin`), **0** usuarios
`@cota.test`, **0** miembros colgados. `anon` recibe `permission denied for schema kaze`.

### Hallazgos de la ejecución que NO hay que redescubrir

1. **El plan tenía tres defectos que habrían mordido en producción**, todos corregidos:
   migraciones en subdirectorio (el CLI no recursa: habría aplicado las viejas y recreado el
   trigger), scripts que construían su propio cliente sin la opción de esquema, y el `upsert` del
   admin dentro del `else` — que en el proyecto compartido, donde esa cuenta ya existe, habría dejado
   al admin entrando sin membresía y sin ver nada.
2. **Exposed schemas vive en Integrations → Data API**, es un desplegable que **solo lista esquemas
   que existen**, y **hay que pulsar Save**. Por eso primero se aplica la migración y después se expone.
3. **No hay NINGÚN trigger sobre `auth.users` en el proyecto compartido.** El `on_auth_user_created`
   del `schema.sql` del CMS no existe en el proyecto vivo. No lo quitamos nosotros (el escaneo previo
   descartó cualquier `drop trigger`), pero **no se tomó foto de antes** — debió hacerse. Para Kaze da
   igual. **Para el CMS puede significar que sus usuarios nuevos no reciben perfil** — avisado al
   usuario, pendiente de que lo revise en el repo del CMS.
4. **El proyecto compartido tiene activado "Automatically expose new tables"**, que la propia Supabase
   recomienda desactivar. Es de todo el proyecto (afecta al CMS y al HUB): no tocar sin revisar.
   Para `kaze` verificado que no concede nada a `anon`.
5. **`/rest/v1/` raíz exige clave secreta**, pero un endpoint de tabla con `Accept-Profile: <esquema>`
   y la clave publicable devuelve `PGRST106` listando los esquemas expuestos. Útil para verificar.
6. **Docker Desktop estaba detenido** al cerrar la sesión. Arrancarlo antes de trabajar en local.
7. **La carpeta temporal de la sesión de Claude no es visible desde la terminal del usuario.** Si se
   le da un script para correr, ponerlo en `~/` y borrarlo después.
8. **En bash, las rutas Windows con `\` se rompen.** Dar siempre `/c/Users/...`.

## Siguiente después de la migración

**Diagramador BPMN estilo Bizagi** — spec aprobado
`docs/superpowers/specs/2026-07-26-kaze-diagramador-bpmn-design.md` (bpmn-js, BPMN 2.0, rutas
`/diagramas` y `/diagramas/[id]`). **Falta el plan.** Su migración debe nacer ya en el esquema
`kaze`, con nombre timestamped al nivel superior de `supabase/migrations/`.

## Prompt para retomar (copiar y pegar en la siguiente sesión)

```
Retoma el proyecto Kaze en C:\Users\pauld\dev\cota. Lee docs/superpowers/START-HERE.md
y AGENTS.md, y verifica git log + git status (rama main, origin github.com/pauldv-coder/Kaze).

ESTADO: la migración al proyecto compartido nrysdnavawyhaqgruunl (esquema `kaze`) está
hecha hasta la T10 inclusive. Producción VIVE y verificada en kaze.ventosolutions.ca con
los 3 A3; /admin ya es seguro de usar. Lo único que falta de la T10 es el Step 3
([USUARIO]): añadir https://kaze.ventosolutions.ca/** a las Redirect URLs de Supabase —
pregúntame si ya lo hice antes de tocar las invitaciones de /admin.

Sigue el plan docs/superpowers/plans/2026-09-20-kaze-migracion-esquema-sso.md desde la
T11 con superpowers:subagent-driven-development: T11-T12 son el SSO (cookie de apex
.ventosolutions.ca en los 3 repos: HUB, CMS, Kaze), T13 el tile del lanzador, T14 docs.
Los pasos de dashboard están marcados [USUARIO]. Ojo con la T11: corta las sesiones vivas
de las tres apps una vez, y los tres pushes se coordinan conmigo.

No introduzcas contraseñas ni pegues claves en servicios externos: eso lo hago yo.

Antes de trabajar en local: Docker Desktop estaba detenido; arráncalo y haz
`npx supabase start` (puertos 553xx; no tocar *_loro). A los subagentes, TODO en primer
plano (nunca run_in_background). En bash usa rutas /c/Users/..., no C:\Users\...
```

## Coordenadas

| Qué | Dónde |
|---|---|
| Repo | `C:\Users\pauld\dev\cota` — rama `main` · remoto `github.com/pauldv-coder/Kaze` |
| **App en producción** | **`https://kaze.ventosolutions.ca`** — alias de Vercel `kaze` (scope `pauldvcoders-projects`); sigue sirviendo también en `kaze-pauldvcoders-projects.vercel.app` |
| DNS del dominio | zona de Hostinger (NS `ns1/ns2.dns-parking.com`), `CNAME` al destino que da Vercel. **Nunca** con la herramienta "Subdominios" del hPanel: eso crea carpeta + `A` al hosting |
| Login producción (admin real) | `info@ventosolutions.ca` — **misma cuenta y contraseña que el HUB y el CMS** |
| **Supabase de producción** | **`nrysdnavawyhaqgruunl`** (compartido con CMS y HUB), esquema `kaze` |
| Repo enlazado a | `nrysdnavawyhaqgruunl` (`supabase/.temp/project-ref`) |
| Proyecto viejo | `kvjpxnswvlxzxdzgycbh` — **pausado**, sin datos únicos, pendiente de borrado deliberado |
| Claves del proyecto compartido | `C:\Users\pauld\dev\vento-hub\.env.local` (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`) |
| Supabase local | API `http://127.0.0.1:55321` · Studio `55323` · keys: `npx supabase status` |
| Login local (demo, admin) | `carmen@cota.test` / `cota-demo-2026` |
| Vento HUB | `C:\Users\pauld\dev\vento-hub` · `hubvento.ventosolutions.ca` · esquema `hub` |
| Vento CMS | `C:\Users\pauld\OneDrive\Documentos\Full Stack\vento-cms` · esquema `public` |

## Qué es esto

Port del módulo de mejoramiento de procesos de **Cota** (consultoría lean): prototipo `.dc.html` →
app real **Next.js 16 + Supabase**, marca de producto **Kaze**. Orden de trabajo: Fundación ✅ →
módulo admin ✅ → Lista de Proyectos tajada 1 ✅ → **migración a `kaze` + SSO (en curso)** →
diagramador BPMN → Editor A3 → Casos → Indicadores → Kanban → Vista de Cliente.

## Notas técnicas que NO hay que redescubrir

Todas las reglas duras están en `AGENTS.md` (esquema `kaze`, migraciones timestamped, nada de
triggers en `auth.users`, `es_miembro()`, techo de 1000 filas, zona horaria `America/Bogota`,
`.order()` con desempate, `h-dvh` en el shell, puertos 553xx, `proxy.ts` y no `middleware.ts`).
Lo específico de esta fase:

- **Nada crea perfiles solo.** Si un usuario entra y no ve **nada**, sospechar de un perfil ausente
  en `kaze.profiles` antes que del RLS. Los crean `/admin` al invitar, el seed y `create-admin.ts`.
- **`scripts/` y los tests construyen su propio cliente**: no heredan `db: { schema: 'kaze' }` de
  `lib/supabase/`. Hay que pasarlo explícitamente.
- **El test de seguridad `tests/data/rls-no-miembro.test.ts`** depende de que `ajeno@cota.test`
  exista en local **sin** perfil. Existe solo en local: en producción se borró a propósito.
- **Invitar desde Kaze a alguien que ya tiene cuenta del CMS** no crea usuario nuevo: solo le añade
  la fila en `kaze.profiles`. `/admin` muestra "Ya tenía cuenta en el ecosistema Vento".

## Pendientes conocidos

- **(Usuario, bloquea `/admin`)** añadir `https://kaze.ventosolutions.ca/**` a las Redirect URLs del
  proyecto compartido — T10 Step 3, ver arriba.
- **(Usuario)** revisar en el repo del CMS por qué no existe su trigger `on_auth_user_created` en el
  proyecto vivo, y si sus usuarios nuevos están recibiendo perfil.
- **(Usuario)** decidir sobre "Automatically expose new tables" en el proyecto compartido.
- **(Usuario, opcional)** añadir `"reference/**"` a `globalIgnores` de `eslint.config.mjs` para que
  `npm run lint` pase — un hook local bloquea que el agente edite ese archivo.
- **`lib/supabase/client.ts` es código muerto.** Borrarlo cierra la puerta a que una clave secreta en
  la variable pública llegue algún día al navegador.
- **Re-invitar a un invitado que nunca aceptó** toma la rama "ya existe": le da membresía pero no le
  genera enlace, y `/admin` le dice que entre con su contraseña — que no tiene. Además la creación
  no es atómica (si falla el insert del perfil queda un usuario huérfano). Relacionado con el
  `resendInviteCore` del backlog admin v1.1.
- **Techo de 1000 usuarios en `/admin`** (`listUsers` de GoTrue, fuera del alcance de `selectAllRows`).
- **Dos comentarios obsoletos** mencionan el trigger eliminado: `lib/data/users.ts:20-21` y
  `lib/data/projects.ts:59`.
- **Contraste AA pendiente** en cabeceras de tabla y sub-rótulos del strip (`text-apagado` sobre
  `bg-panel`, 4.25:1).
- **Deuda de datos:** `kaze.clients` y el Clients Core (`core`) de la Fase 2 del HUB son el mismo
  maestro de clientes; habrá que reconciliarlos.

## Decisiones ya tomadas (no re-litigar)

- Portar a Next.js; el prototipo es solo referencia visual.
- **Consolidar Kaze en el proyecto Supabase del HUB/CMS** como esquema `kaze`, en vez de restaurar el
  pausado. Mudanza + SSO + tile en un solo plan (el usuario lo eligió pese a la advertencia de tamaño).
- **La pertenencia a Kaze la define `kaze.profiles`**, no `hub.staff`: los usuarios reales son
  consultores de Cota, no staff de Vento. `hub.staff` es solo la intranet.
- **Alta solo por invitación explícita**; sin triggers automáticos.
- **Datos de producción recreados** con migraciones + seed selectivo; el proyecto viejo no se restaura.
- **Zona horaria del negocio: `America/Bogota`.** Celda del strip: **"Activos"**, no "KPIs mejorando".
- Filas de la tabla no navegables hasta que exista el Editor A3 — **por diseño, no un bug**.
- Metodología: `superpowers:subagent-driven-development`, commits frecuentes en `main`; push solo al
  cerrar cada bloque (push = deploy).
