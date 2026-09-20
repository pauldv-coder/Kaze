<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Kaze · Mejoramiento de procesos — guía del repo

App **Next.js 16 (App Router) + TypeScript + Tailwind v4 + Supabase** para gestionar
proyectos de mejora lean (A3) de la consultora Cota. El prototipo `.dc.html` en
`reference/prototype/` es la **especificación visual** (solo referencia, no runtime).

## Al retomar una sesión

1. Lee `docs/superpowers/START-HERE.md` — estado actual, siguiente tarea y prompt de arranque.
2. `git log --oneline -5` y compáralo con lo que dice START-HERE (la verdad es el git log).
3. Stack local: `npx supabase status`; si no corre, `npx supabase start` (Docker Desktop debe estar corriendo).

## Comandos

- `npm run dev` / `npm run build` / `npm test`
- `npx supabase start|stop|status` — SIEMPRE con cwd = raíz del repo
- `npm run db:reset` — recrea la base local y aplica `supabase/migrations/`
- `npm run db:types` — regenera `lib/database.types.ts` (el directorio `lib/` debe existir)
- `npm run seed` — puebla la base local (`scripts/seed.ts`, usa `.env.local`)

## Peculiaridades del entorno (leer ANTES de tocar la base)

- **CLI de Supabase = devDependency.** No está instalada global: usa `npx supabase ...`.
- **Puertos 553xx, no los default.** API `http://127.0.0.1:55321`, DB `55322`, Studio `55323`,
  Mailpit `55324`. Motivo: el stack local de **loro** (otro proyecto) ocupa los 543xx.
  **NO tocar los contenedores `*_loro`.** Las keys locales las imprime `npx supabase status`.
- **No hay `psql` en el host.** Para SQL directo:
  `docker exec supabase_db_cota psql -U postgres -d postgres -c "..."`.
- **Las tablas viven en el esquema `kaze`, NO en `public`.** Los clientes de `lib/supabase/*.ts`
  lo fijan con `db: { schema: 'kaze' }`, así que las queries de `lib/data/*.ts` se escriben igual
  (`db.from('projects')`). En SQL directo hay que cualificar: `select * from kaze.projects`.
  En el proyecto compartido `public` es del CMS: **no crear nada ahí**.
  Ojo: los scripts de `scripts/` y los tests construyen su **propio** cliente y necesitan la
  opción por separado — no la heredan de `lib/supabase/`.
- **Migraciones: nombres timestamped, al nivel superior de `supabase/migrations/`.** El CLI **no
  recursa en subdirectorios**: un archivo en `migrations/kaze/` nunca se aplica, ni con `db reset`
  ni con `db push`, y sin aviso. `[db.migrations].schema_paths` NO apunta a las migraciones (es la
  entrada del esquema declarativo de `db diff`). Las del esquema viejo están en
  `supabase/migrations-historicas/`, fuera del alcance del CLI a propósito.
- **Nada de triggers sobre `auth.users`.** El CMS tiene el suyo (`on_auth_user_created`) en el
  proyecto compartido y comparte nombre con el que Kaze tenía: recrearlo se lo roba y lo deja sin
  creación de perfiles. Corolario: **nada crea perfiles solo**. Los crea `/admin` al invitar, el
  seed, o `scripts/create-admin.ts`. Si un usuario entra y no ve **nada**, sospecha de esto antes
  que del RLS.
- **`kaze.es_miembro()` decide quién ve algo.** Sin fila en `kaze.profiles` no se lee ni se escribe
  nada, aunque el JWT sea válido: `auth.users` se comparte con el CMS y el HUB, así que estar
  autenticado ya no implica pertenecer a Kaze. Lo protege `tests/data/rls-no-miembro.test.ts`, que
  además está probado a la inversa (abrir la policy lo pone en rojo).
- **Los helpers `Tables<>`, `TablesInsert<>`, `Enums<>` de `lib/database.types.ts` NO sirven** en su
  forma simple: se generan con `--schema kaze`, el tipo no tiene clave `public` y el `DefaultSchema`
  interno resuelve a `never`. Si hacen falta, explicitar: `Tables<{ schema: 'kaze' }, 'projects'>`.
- **`lib/supabase/middleware.ts` no lleva `db: { schema }` a propósito**: solo llama a
  `auth.getUser()` y nunca a `.from()`. No es un olvido.
- **Data API nueva:** las tablas NO se exponen a la API sin `GRANT`s explícitos, y el esquema debe
  estar en `[api].schemas` de `config.toml` (y en *Exposed schemas* del proyecto alojado).
- **Techo de 1000 filas por query.** `max_rows = 1000` (`supabase/config.toml`, y el alojado trae el
  mismo default): PostgREST **trunca en silencio** y devuelve 200, sin error. Un `select` sin filtrar
  sobre una tabla que crece (`measurements`, `actions`) empieza a mentir sin avisar — y como se ordena
  ascendente, lo que se pierde es lo MÁS RECIENTE. Toda query sin `.limit()` debe llevar guardia de
  truncamiento (`count: 'exact'` + comparar contra `data.length`).
- **Zona horaria del negocio: `America/Bogota`.** Las fechas de vencimiento (`actions.vence`) son
  columnas `date`, no instantes: compararlas contra un `Date` en UTC marca como vencida una acción
  que vence hoy. Usar el helper de `lib/data/metrics.ts`, no `new Date(...)` a mano.
- **`.order()` siempre con desempate.** Un `insert` de varias filas les da el mismo `created_at`, y
  Postgres devuelve los empates en orden indefinido: sin un `.order('id')` de respaldo, cosas como
  "cuál es el KPI principal" cambian entre recargas sin que cambien los datos.
- **El seed es TypeScript** (`scripts/seed.ts`, Admin API). NO existe `supabase/seed.sql`;
  el `WARN: no files matched pattern: supabase/seed.sql` de `db reset` es normal.
- **Signup público desactivado** (`enable_signup = false`); los usuarios los crea el seed.
  Login local de demo: `carmen@cota.test` / `cota-demo-2026`.
- **Admin local:** `carmen@cota.test` (rol `admin` en el seed) — da acceso a `/admin`.
- **Tailwind v4:** tokens en `app/globals.css` vía `@theme`. **NO existe `tailwind.config.ts`** — no lo crees.
- **Windows:** escribe archivos como UTF-8 sin BOM (herramienta Write, no redirección de PowerShell).
  El contenedor `supabase_vector_cota` crash-loopea — limitación conocida de Docker en Windows,
  inofensiva (analytics sigue sano; loro tiene el mismo patrón).
- **Si `supabase start` falla con `bind: An attempt was made to access a socket in a way forbidden
  by its access permissions`:** Windows reservó dinámicamente un rango que se traga los 553xx.
  Verificar con `netsh interface ipv4 show excludedportrange protocol=tcp`. Arreglo permanente,
  en PowerShell **como administrador** (una sola vez; sobrevive reinicios):
  `net stop winnat` → `netsh int ipv4 add excludedportrange protocol=tcp startport=55320 numberofports=10 store=persistent` → `net start winnat`.
  Debe quedar listado como `55320 55329 *` (exclusión *administrada*). Síntoma previo típico: Docker
  Desktop reinicia los contenedores pero `docker port supabase_kong_cota` sale vacío.

## Convenciones

- Rama `main`, remoto GitHub `pauldv-coder/Kaze`. Commits frecuentes, estilo conventional (`feat:`/`chore:`/`docs:`); push a `main` al cerrar cada bloque de trabajo (**cada push auto-despliega a Vercel**).
- TDD en la capa de datos: tests de integración (Vitest) contra el stack local ya seedeado.
- Decisiones ya tomadas — **no re-litigar** (lista completa en START-HERE): portar a Next.js
  (no mantener runtime `.dc.html`), RLS "equipo total ahora / por-cliente después",
  A3 profundo como `jsonb` en `projects.a3_content`, seed = datos hardcoded del prototipo.

## Documentos clave

| Qué | Dónde |
|---|---|
| Estado actual + handoff | `docs/superpowers/START-HERE.md` |
| Guía de despliegue (Vercel + Supabase alojado) | `docs/DEPLOY.md` |
| Spec de la Fundación | `docs/superpowers/specs/2026-07-05-cota-foundation-design.md` |
| Plan de implementación (14 tareas, bloque Progreso) | `docs/superpowers/plans/2026-07-05-cota-foundation.md` |
| Especificación visual | `reference/prototype/` + `reference/screenshots/` |

**Producción:** proyecto Supabase alojado **Cota** (producto: Kaze) `kvjpxnswvlxzxdzgycbh`
(`https://kvjpxnswvlxzxdzgycbh.supabase.co`), repo ya enlazado. Esquema + 3 casos seed
aplicados. **Frontend DESPLEGADO en Vercel** (proyecto `kaze`, scope pauldvcoders-projects):
`https://kaze-pauldvcoders-projects.vercel.app` — CI/CD conectado a GitHub `pauldv-coder/Kaze`
(push a `main` = deploy). Ver `docs/DEPLOY.md`.
**Módulo de administración de usuarios EN PRODUCCIÓN**: rutas `/admin` (solo rol admin),
`/auth/confirm` (canje de invitación) y `/cuenta/contrasena` (establecer/cambiar contraseña).
El frontend usa `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` en el cliente;
`SUPABASE_SERVICE_ROLE_KEY` SÍ vive en Vercel, pero solo como variable de **SERVIDOR** (sin
`NEXT_PUBLIC_`) — la consumen exclusivamente las server actions de `/admin` vía
`lib/supabase/admin.ts` (`server-only`). NUNCA como variable pública ni importada desde
código de cliente.
