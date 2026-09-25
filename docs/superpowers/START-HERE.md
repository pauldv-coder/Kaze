# START HERE — Kaze · Mejoramiento de procesos

> Léeme primero al retomar. Última actualización: **2026-09-24**.
> Guía permanente del repo (comandos, peculiaridades del entorno): `AGENTS.md` en la raíz
> (Claude Code la carga sola vía `CLAUDE.md`). Este archivo es el **estado vivo**.

## Plan en ejecución: Captura de procesos (BPMN)

**Spec:** `docs/superpowers/specs/2026-09-24-kaze-captura-procesos-design.md` (aprobado).
**Plan:** `docs/superpowers/plans/2026-09-24-kaze-captura-procesos.md`.
**Metodología:** `superpowers:subagent-driven-development` — subagentes **siempre en primer plano**
(nunca `run_in_background`).

**Decisiones del usuario (2026-09-24, §0 del plan):**
- Este módulo va **antes** que las T11–T14 del plan de SSO.
- §1.3 confirmado tal cual: sin SMTP, sin IA, documento `jsonb`, Word/.zip/SVG en el navegador.
- En `/aprobar` el código hace falta **también para leer**: tras un código válido, el servidor pone
  una cookie `httpOnly` firmada (HMAC) por solicitud y persona.
- Se agrega `@playwright/test`: los escenarios de `ESCENARIOS.md` se automatizan en `e2e/`.

**Estado de las fases (§3 del plan):**

| Fase | Tareas | Estado |
|---|---|---|
| F0 Preparación | 0.1–0.3 | ✅ `f334328` + `7770156` + esta tarea |
| F1 Lógica pura | 1.1–1.11 | ⬜ |
| F2 Datos y seguridad | 2.1–2.7 | ⬜ |
| F3 Lista | 3.1–3.2 | ⬜ |
| F4 Editor | 4.1–4.13 | ⬜ |
| F5 Diagrama | 5.1–5.3 | ⬜ |
| F6 Documento y Storage | 6.1–6.3 | ⬜ |
| F7 Aprobación | 7.1–7.8 | ⬜ |
| F8 Cierre y despliegue | 8.1–8.4 | ⬜ |

`npm run e2e` (Playwright) necesita el stack local levantado y seedeado (`npx supabase status`), y
`.env.local` con `KAZE_URL` y `KAZE_APROBAR_SECRETO`.

## ✅ Estado a 2026-09-25: SSO FUNCIONANDO en las TRES apps

**Una sesión iniciada en Kaze abre el HUB y el CMS sin volver a autenticarse.** Verificado sin
navegador, presentando la misma cookie a las tres:

| Prueba (una sola sesión, emitida por Kaze) | Resultado |
|---|---|
| `kaze.ventosolutions.ca/proyectos` | `200` ✅ |
| `hubvento.ventosolutions.ca/` | `200` ✅ |
| `vento-cms.ventosolutions.ca/studio` | `200` ✅ |
| `vento-cms.../login` **con** sesión | `307 -> /studio` ✅ (el proxy reconoce al usuario) |
| los tres sin sesión (control) | `307 -> /login` ✅ |

La cookie es una sola: `sb-nrysdnavawyhaqgruunl-auth-token`, `Domain=.ventosolutions.ca`, `Path=/`,
`Secure`, `SameSite=lax`.

⚠️ **Al probar el CMS, gatea `/studio`, no `/`.** Su `proxy.ts` solo protege `/studio`; la raíz
redirige por su cuenta y da un `307` que parece un fallo de SSO sin serlo. La señal más limpia es
`/login` **con** sesión: si el SSO funciona, responde `307 -> /studio`.

Cómo reproducir la prueba en cualquier momento, sin contraseñas: generar un token de `recovery`
(ver "Recuperar el acceso del admin"), canjearlo con `curl -c jar` contra
`kaze.ventosolutions.ca/auth/confirm`, y presentar ese `jar` a las dos apps con `curl -b jar`.

### La T10 (contexto anterior, 2026-09-22)

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

### Por qué el SSO llevaba 69 días sin encenderse (no era el código)

El commit del SSO del HUB (`a5668af`) estaba en `origin/main` **desde el 15-jul-2026** y aun así no
funcionaba nada. Tres causas encadenadas, ninguna en el código:

1. **El HUB nunca llegó a desplegar ese commit.** Sus deploys se quedaban en `Queued` para siempre
   (el CLI los muestra como `UNKNOWN` pasado un tiempo). En plan **Hobby solo se construye un build
   a la vez**, y basta un deploy colgado para que todos los siguientes esperen tras él. Producción
   siguió sirviendo el build del 14-jul, un día anterior al commit. **Síntoma a reconocer:
   deployments en `Queued` sin avanzar y "Another build is in progress" en el dashboard. Se arregla
   cancelándolos todos y lanzando UNO.**
2. **Las variables de Supabase del HUB en producción eran distintas de las de su `.env.local`**:
   tenían otra clave publicable (`sb_publishable_KYDRu…` en vez de `…Fbza7…`). Ambas son válidas
   contra el proyecto, así que nada fallaba de forma ruidosa. Como estaban de tipo `Secret`, **nadie
   podía leerlas para comparar** — ni el usuario ni el agente. Pasarlas a `Config` fue lo que
   permitió verlas y corregirlas.
3. **Guardar varias variables seguidas en Vercel disparó un redeploy por cada guardado**, y uno de
   esos builds se construyó justo cuando una variable estaba borrada. Al terminar se auto-promovió y
   **tumbó el HUB con 500**. Lo salvó el *fail-closed* de su `proxy.ts`, que devuelve 500 cuando
   faltan `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` en vez de servir una app que no puede hablar con
   Supabase. Se restauró con `npx vercel promote <deployment-anterior>`.

**Reglas que salen de aquí:** edita todas las variables y haz **un solo** redeploy al final; las
`NEXT_PUBLIC_*` se hornean en el build, así que cambiarlas no surte efecto sin reconstruir; y un
`● Ready` no prueba que el alias sirva ese build — hay que mirar `vercel alias ls`.

### Qué significa "Cerrar sesión" ahora (T12 Step 3, verificado)

Con la cookie de apex, **cerrar sesión en cualquiera de las tres apps cierra las tres**. Es el
comportamiento deseado — un "Cerrar sesión" que te dejara dentro del HUB sería peor — y **no se
arregla** cambiando `scope: 'local'` a `'global'`: eso además tumbaría las sesiones del usuario en
sus otros dispositivos.

Verificado ejecutando el mismo `signOut({ scope: 'local' })` que la server action de Kaze:

- Emite **dos** borrados del mismo nombre de cookie: uno con `domain=.ventosolutions.ca` y otro
  **host-only**. El segundo es la limpieza de cookies antiguas que trae `@supabase/ssr` 0.12.0
  (el HUB, con 0.10.3, **no** la hace).
- Además **revoca la sesión en el servidor**: al reenviar después los mismos bytes de cookie, las
  tres apps responden `307 -> /login`. O sea, `scope: 'local'` significa "esta sesión", no "esta app",
  y copiar la cookie a otro sitio no la resucita.

### El CMS llevaba 71 días sin desplegar por el AUTOR de un commit (resuelto)

`vento-cms` no construía nada desde hacía 71 días y sus deploys aparecían como **`● Blocked`** en el
listado, sin alerta ni correo. El motivo lo dio el dashboard:

> *"The deployment was blocked because the commit author did not have contributing access to the
> project on Vercel. The Hobby Plan does not support collaboration for private repositories."*

**En plan Hobby, un repo PRIVADO solo despliega commits cuyo autor Vercel reconoce como dueño del
proyecto.** El commit del SSO (`eb1e0f0`) se había firmado con el correo **global**
`pauldiazveg@gmail.com`, mientras que ese repo usa en su config local el correo `noreply` de GitHub
(`83824766+pauldv-coder@users.noreply.github.com`). GitHub no lo atribuyó a la cuenta → Vercel lo
bloqueó.

Por qué no se notó antes en los otros repos: **`Kaze` es público** (la restricción no aplica) y
`vento-hub` es privado pero su config local ya usaba el correo bueno.

**Arreglo, sin reescribir historia:** a Vercel le basta con que **el commit de cabeza** tenga el autor
correcto. Un commit vacío firmado con la identidad del repo desbloquea el deploy (`a1eeaab`):

```bash
git -c user.email="83824766+pauldv-coder@users.noreply.github.com" commit --allow-empty -m "chore: desbloquear deploy"
```

**Prevención:** en cada repo privado, `git config user.email` debe ser el correo que GitHub atribuye
a la cuenta. Si un repo privado "no despliega", mira el autor del commit de cabeza **antes** de
sospechar del build.

Después de desbloquearlo hizo falta lo mismo que en el HUB: sus tres `NEXT_PUBLIC_*` eran `Secret`
(ilegibles) y tenían la clave publicable vieja. Pasadas a `Config` con los valores buenos y
reconstruido, el SSO del CMS quedó verificado.

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

## Plan de migración a esquema `kaze` + SSO — en pausa en la T11

**En pausa en la T11**: `73cd257` (cookie de apex) está en `main` **sin push**; no hacer push sin
coordinar con el usuario, corta las sesiones de las 3 apps (HUB, CMS, Kaze). Se retoma después del
plan de Captura de procesos (arriba).

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
| T11 flip de cookies apex en los 3 repos (SSO) | ✅ desplegado en los **tres**: Kaze `73cd257`+`5862bdb`, HUB `a5668af`, CMS `eb1e0f0`+`a1eeaab` |
| T12 verificar SSO | ✅ Steps 1 y 3 verificados en las tres apps; **Step 2 pendiente** (necesita una cuenta de prueba, ver Pendientes) |
| T13 tile en `hub.modules` | ✅ fila `improvement` → Kaze, `production`, url `kaze.ventosolutions.ca`; tile verificado renderizado en la portada del HUB |
| T14 docs + revisión final | ✅ `START-HERE.md` y `docs/DEPLOY.md` al día |

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

El diagramador BPMN ya no es lo siguiente: el spec `docs/superpowers/specs/2026-07-26-kaze-diagramador-bpmn-design.md`
queda **reemplazado** por `docs/superpowers/specs/2026-09-24-kaze-captura-procesos-design.md` — el
módulo de Captura de procesos (ficha + procedimiento Word + diagrama BPMN, ver sección de arriba) es
el que se está ejecutando ahora. El SSO (T11–T14 del plan de migración) queda para después de Captura.

## Prompt para retomar (copiar y pegar en la siguiente sesión)

```
Retoma el proyecto Kaze en C:\Users\pauld\dev\cota. Lee docs/superpowers/START-HERE.md
y AGENTS.md, y verifica git log + git status (rama main, origin github.com/pauldv-coder/Kaze).

ESTADO: el plan en ejecución es Captura de procesos (BPMN):
docs/superpowers/plans/2026-09-24-kaze-captura-procesos.md, spec
docs/superpowers/specs/2026-09-24-kaze-captura-procesos-design.md. F0 está cerrada
(commits f334328, 7770156 y el de START-HERE). Sigue el plan desde la primera tarea ⬜
(inicio de F1) con superpowers:subagent-driven-development — subagentes SIEMPRE en
primer plano (nunca run_in_background).

El plan de migración a esquema `kaze` + SSO (docs/superpowers/plans/2026-09-20-kaze-migracion-esquema-sso.md)
ya NO está en pausa: T11 está desplegada y el SSO FUNCIONA entre Kaze y el HUB (verificado
el 2026-09-25 con curl, sin navegador). De ese plan solo quedan los Steps 2-3 de la T12,
la T13 (tile en hub.modules) y la T14 (docs), más tres pasos [USUARIO] de dashboard que
están listados en "Pendientes conocidos" — el que más urge es Settings → Git del proyecto
vento-cms, porque el CMS no despliega y su commit del SSO espera en origin/main.

No introduzcas contraseñas ni pegues claves en servicios externos: eso lo hago yo. Push
a main y `supabase db push` solo coordinados conmigo (push = deploy).

Antes de trabajar en local: arranca Docker Desktop y haz `npx supabase start` (puertos
553xx; no tocar *_loro). En bash usa rutas /c/Users/..., no C:\Users\...
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

## Hallazgos de la revisión final de la migración (2026-09-25)

### ✅ RESUELTO — `/admin` ya se gatea por membresía (`6f8868c`)

Era el hallazgo crítico: `/admin` se había quedado con el modelo mental viejo de `auth.users` y
listaba a **todos** los usuarios del proyecto compartido, así que un admin de Kaze veía el correo de
cada usuario del CMS y del HUB; además *reactivar* levantaba bloqueos que Kaze nunca puso.

Arreglado con TDD (6 tests nuevos, 5 en rojo primero):

- **`getUsers` parte ahora de `kaze.profiles`**, no de `auth.admin.listUsers()`, y enriquece con
  `getUserById` por miembro en paralelo. El motivo de no usar `listUsers` está en el código: su
  techo de 1000 filas es sobre el **pool compartido**, así que el día que el CMS pase de 1000
  usuarios, miembros legítimos de Kaze desaparecerían de la lista sin aviso.
- **`assertMiembro()` guarda las tres acciones** (`setRole`, `desactivar`, `reactivar`) y falla con
  un mensaje que dice qué pasó. Sustituye a `rolOf`, que era quien producía el `PGRST116`. En
  `setRoleCore` la guardia va **antes** del corto-circuito: si no, promover a admin se la saltaba.

**Deuda consciente (decisión del usuario):** `desactivar` **sigue baneando la cuenta compartida**, o
sea expulsa también del HUB y del CMS. La alternativa correcta — revocar solo la membresía de Kaze —
exige migración (columna de estado en `kaze.profiles` y que `es_miembro()` la mire). Está
documentado en el propio `deactivateUserCore` para que nadie lo lea como un descuido.

### 🟠 La cookie del apex es legible por JavaScript en todo `*.ventosolutions.ca`

El spec (`§ riesgos`) aceptó la cookie de apex razonando que el sitio corporativo *"no puede leerla
si es `httpOnly`"*. La implementación hace lo contrario, y con razón: `cookie-options.ts` dice
**"NUNCA httpOnly: el browser client escribe vía document.cookie"**. O sea, la premisa que sostenía
la mitigación es falsa: **un XSS o un script de terceros en cualquier subdominio del apex — incluido
el sitio de marketing — se lleva la sesión de las tres apps**. Queda anotado, no resuelto.

### 🟡 La invariante "archivo byte-idéntico" ya está rota

Los tres `cookie-options.ts` **no** son byte-idénticos (`md5sum` distinto): la copia de Kaze actualizó
la cabecera y la del CMS además está en CRLF. El **objeto exportado sí** es idéntico en los tres, así
que el SSO no corre peligro — pero la invariante, tal como está redactada, ya no detecta nada.

### 🟡 Otros

- **Tercer comentario obsoleto sobre el trigger eliminado**, además de los dos ya anotados:
  `tests/data/projects-list.test.ts:44` (habla de un default que el trigger escribía; ni hay trigger
  ni la columna tiene default, y cita un archivo que ya no existe con ese nombre).
- **`getProjects` (`lib/data/projects.ts:11-18`) sin guardia de truncamiento** — el único hueco; el
  resto de lecturas de lista pasan por `selectAllRows`. Es código muerto en la app (solo lo usan los
  tests) y es **anterior** a esta migración.
- **`scripts/create-admin.ts:55-64` borra en duro** todo correo `@cota.test` de `auth.users`. Antes
  esa tabla era solo de Kaze; ahora la comparten el CMS y el HUB, y el borrado es en cascada.
- **La limpieza de `tests/data/users.test.ts:106` no está en `finally`:** si ese test falla antes,
  deja a `ajeno@cota.test` con perfil y **`rls-no-miembro.test.ts` falla en todas las corridas
  siguientes** hasta un `db:reset` — justo el test que más importa de este bloque.
- **El seed del HUB (`vento-hub/supabase/schema-hub.sql:61`) sigue diciendo** `url: null` /
  `status: 'development'` para `improvement`. El tile se actualizó en el alojado (así lo decidió el
  plan), pero el repo del HUB miente sobre su propio seed.

## Pendientes conocidos

- **(Usuario, bloquea `/admin`)** añadir `https://kaze.ventosolutions.ca/**` a las Redirect URLs del
  proyecto compartido — T10 Step 3, ver arriba.
- **(Usuario)** pasar `NEXT_PUBLIC_COOKIE_DOMAIN` del HUB de `Secret` a `Config`. Sigue ilegible: si
  contuviera `ventosolutions.ca` **sin** el punto inicial, el HUB escribiría cookies que Kaze no ve y
  no habría forma de detectarlo mirando. (En el CMS y en Kaze ya es `Config` y está verificada.)
- **(T12 Step 2, único paso del plan sin hacer)** comprobar en producción que una cuenta **sin** fila
  en `kaze.profiles` entra pero ve **cero** proyectos. No se hizo porque la única cuenta candidata del
  proyecto compartido (`a52bd991…`) puede ser de otra persona y entrar como ella no es del agente
  decidirlo. Lo limpio es crear una cuenta desechable, comprobarlo y borrarla. El comportamiento ya
  está cubierto por `tests/data/rls-no-miembro.test.ts`, probado en rojo y en verde; lo que falta es
  la confirmación en producción.
- **Deriva de versiones de `@supabase/ssr` entre repos**: Kaze `0.12.0`, HUB `0.10.3`. Hoy
  interoperan (mismos defaults de cookie, mismo `base64url`, mismo `MAX_CHUNK_SIZE`) y está
  verificado que la 0.10.3 lee lo que escribe la 0.12.0. Pero un archivo de opciones byte-idéntico
  **no garantiza cookies idénticas**: cada versión mezcla contra sus propios defaults. El invariante
  real es alinear también la versión del paquete en los tres repos.
- **El comentario de `cookie-options.ts` dice "las versiones actuales limpian las cookies host-only
  viejas"**, lo cual es cierto en Kaze (0.12.0) y **falso en el HUB** (0.10.3). Al ser archivo
  byte-idéntico, corregirlo exige editarlo a la vez en los tres repos.
- **(Usuario)** revisar en el repo del CMS por qué no existe su trigger `on_auth_user_created` en el
  proyecto vivo, y si sus usuarios nuevos están recibiendo perfil.
- **(Usuario)** decidir sobre "Automatically expose new tables" en el proyecto compartido.
- **(Usuario, opcional)** hoy `npm run lint` da **111 errores y 92 warnings, todos en `reference/`**;
  falta que el usuario agregue `"reference/**"` a `globalIgnores` de `eslint.config.mjs` — un hook
  local bloquea que el agente edite ese archivo.
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
