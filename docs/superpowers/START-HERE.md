# START HERE — Kaze · Mejoramiento de procesos

> Léeme primero al retomar. Última actualización: **2026-09-19**.
> Guía permanente del repo (comandos, peculiaridades del entorno): `AGENTS.md` en la raíz
> (Claude Code la carga sola vía `CLAUDE.md`). Este archivo es el **estado vivo**.

## Estado a 2026-09-19: tajada 1 COMPLETA · producción esperando migración

### Desarrollo: sub-proyecto 2 tajada 1 TERMINADA
Plan ejecutado: **`docs/superpowers/plans/2026-07-25-kaze-lista-proyectos.md`** (12 tareas;
spec `docs/superpowers/specs/2026-07-25-kaze-lista-proyectos-design.md`). Metodología:
`superpowers:subagent-driven-development`.

| Task | Estado |
|---|---|
| T1 helpers de métricas | ✅ `b54d927` |
| T2 `getProjectsList` | ✅ `1bac1d8` |
| T3 `getProjectsSummary` + `getSidebarClientes` | ✅ `3a3fbda` |
| T4 test authenticated (RLS) | ✅ `2c87e33` |
| **Revisión combinada de la capa de datos (T1–T4)** | ✅ 2 críticos + 6 importantes → `d3ca19d`, `f395a48` |
| T5 componentes de tabla | ✅ `4a9103b` |
| T6 summary strip + tabla | ✅ `fb452a3` |
| T7 islas cliente + `signOut` | ✅ `0a4b70a` |
| T8 sidebar + layout `(app)` | ✅ `004614f` |
| T9 `/login` redirige con sesión | ✅ `b480f31` |
| T10 `/proyectos` + error boundary | ✅ `69c05df`, arreglos `9cf25e9` + `44411d7` |
| T11 e2e de navegador | ✅ verificado a 375×812 y 928×918 |
| T12 docs + push | ✅ este commit |

Verificado en vivo: 8 filas con chips/barras A3/sparklines/avatares, strip con las 6 métricas,
sidebar con los 5 clientes, nav con **un solo enlace** (los 5 ítems futuros son `<span>`, no
navegan), menú de cuenta con Cuenta + Administración + Cerrar sesión, `/admin` y
`/cuenta/contrasena` heredando el shell, logout y los dos redirects de `/login`.
Suite: **46 tests / 8 archivos** verdes · `npx tsc --noEmit` limpio · `npm run build` verde.

### Producción: pausada A PROPÓSITO, se migra en vez de restaurarse
`npx supabase projects list` (2026-09-19): Cota `kvjpxnswvlxzxdzgycbh` = **INACTIVE**.
El plan Free permite 2 proyectos activos y ya están vento-cms + Casa de Fe. El usuario
**decidió no restaurarlo**: Kaze se consolida dentro del proyecto Supabase del HUB/CMS.
La app en Vercel carga pero no puede loguear hasta que eso ocurra.

## SIGUIENTE: migrar Kaze al proyecto del HUB/CMS (esquema `kaze`)

**Decidido el 2026-09-19. Falta el ciclo brainstorm → spec → plan** (`superpowers:writing-plans`),
y se ejecuta ANTES del diagramador BPMN para que su migración nazca ya en `kaze`.

Destino: proyecto **`nrysdnavawyhaqgruunl`**, donde ya conviven el CMS en `public` y
[Vento HUB](https://hubvento.ventosolutions.ca) en esquema `hub` (`hub.staff`, `hub.modules`).
Kaze entra como esquema **`kaze`**, mismo patrón. Beneficios: revive producción sin pagar Pro,
y Kaze pasa a ser un tile del lanzador del HUB (su Fase 1 es SSO real con cookies de apex).

Hallazgos del análisis previo — **no re-investigar**:

1. **Kaze NO puede ir a `public`**: CMS y Kaze definen ambos `public.profiles` y
   `public.projects`, con significados distintos (los `projects` del CMS son sitios).
2. **El cambio de código es pequeño**: con `createClient(url, key, { db: { schema: 'kaze' } })`
   todos los `db.from('projects')` de `lib/data/*.ts` quedan idénticos; solo cambia dónde se
   construye el cliente. Regenerar tipos con `--schema kaze`.
3. **Lo crítico es el RLS.** Hoy Kaze es "equipo interno total": cualquier `authenticated` lee
   todo. Con `auth.users` compartida, un usuario del CMS podría leer la cartera A3 completa de
   los clientes. Hay que gatear contra `hub.staff`, que ya existe y ya hace ese gate.
4. **El trigger `handle_new_user` de Kaze** dispararía con los usuarios del CMS (que ya tienen
   su propio `profiles`).
5. **`kaze.clients` es conceptualmente el Clients Core** de la Fase 2 del HUB (esquema `core`):
   decidir si se unifica en el mismo movimiento o se refactoriza después.

Después de la migración: **diagramador BPMN estilo Bizagi** (spec aprobado
`docs/superpowers/specs/2026-07-26-kaze-diagramador-bpmn-design.md`, bpmn-js, rutas `/diagramas`
y `/diagramas/[id]`, migración de diagramas — escribirla ya contra `kaze`).

## Prompt para retomar (copiar y pegar en la siguiente sesión)

```
Retoma el proyecto Kaze en C:\Users\pauld\dev\cota. Lee docs/superpowers/START-HERE.md y
AGENTS.md, y verifica git log + git status (rama main, origin github.com/pauldv-coder/Kaze).

Estado: tajada 1 (app shell + Lista de Proyectos) COMPLETA y pusheada. El Supabase de
producción sigue pausado a propósito: se decidió NO restaurarlo sino consolidar Kaze como
esquema `kaze` dentro del proyecto del HUB/CMS (nrysdnavawyhaqgruunl).

Siguiente: escribir el spec y el plan de esa migración con superpowers:writing-plans y
ejecutarlo con superpowers:subagent-driven-development. START-HERE tiene los 5 hallazgos del
análisis previo; el punto delicado es el RLS (hoy "equipo total" — hay que gatear contra
hub.staff). Después viene el diagramador BPMN, con su migración ya nacida en `kaze`.

Antes de arrancar: Docker Desktop corriendo y `npx supabase start` (puertos 553xx; no tocar
*_loro). A los subagentes indícales correr TODO en primer plano (nunca run_in_background).
```

## Coordenadas

| Qué | Dónde |
|---|---|
| Repo (el bueno) | `C:\Users\pauld\dev\cota` — rama `main` · remoto `github.com/pauldv-coder/Kaze` |
| App en producción | `https://kaze-pauldvcoders-projects.vercel.app` (Vercel `kaze`, CI/CD desde GitHub) |
| Guía permanente del repo | `AGENTS.md` (raíz; incluida por `CLAUDE.md`) |
| Guía de despliegue | `docs/DEPLOY.md` |
| Spec de la tajada 1 | `docs/superpowers/specs/2026-07-25-kaze-lista-proyectos-design.md` |
| Spec BPMN (sin plan aún) | `docs/superpowers/specs/2026-07-26-kaze-diagramador-bpmn-design.md` |
| Prototipo (especificación visual) | `reference/prototype/` (+ `reference/screenshots/`) |
| **Supabase PRODUCCIÓN** | `kvjpxnswvlxzxdzgycbh` · **pausado, se migra a `kaze` en `nrysdnavawyhaqgruunl`** |
| Supabase local | API `http://127.0.0.1:55321` · Studio `55323` · keys: `npx supabase status` |
| Login local (demo, admin) | `carmen@cota.test` / `cota-demo-2026` |
| Login producción (admin real) | `info@ventosolutions.ca` |

## Qué es esto

Port del módulo de mejoramiento de procesos de **Cota** (consultoría lean): 8 páginas
`.dc.html` de prototipo → app real **Next.js 16 + Supabase**, con marca de producto **Kaze**.
Orden de trabajo: Fundación ✅ → módulo admin ✅ → **Lista de Proyectos tajada 1 ✅** →
migración a `kaze` → diagramador BPMN → Editor A3 → Casos → Indicadores → Kanban → Vista de Cliente.

## Qué quedó construido

- **Base**: migraciones `0001`–`0004` (9 tablas + RLS + GRANTs de Data API + hardening + grants
  por columna). **Seed** `scripts/seed.ts`, **bootstrap** `scripts/create-admin.ts`.
- **Auth**: `proxy.ts` (Next 16), login con redirect si ya hay sesión, `/auth/confirm`,
  `/cuenta/contrasena`.
- **Módulo admin**: `/admin` (invitar por enlace, roles, desactivar).
- **Capa de datos**: `lib/data/projects.ts` (`getProjectsList`), `lib/data/summary.ts`
  (`getProjectsSummary`, `getSidebarClientes`), `lib/data/metrics.ts` (helpers puros),
  `lib/data/query.ts` (`selectAllRows`, guardia de truncamiento), `lib/data/clients.ts`, `users.ts`.
- **App shell**: `app/(app)/layout.tsx` + `_components/sidebar.tsx` (server) con `sidebar-nav`
  y `account-menu` (islas cliente), `actions.ts` (`signOut`), `app/(app)/error.tsx`.
- **`/proyectos`**: summary strip de 6 métricas + tabla rica, solo lectura, filas no navegables.

## Notas técnicas que NO hay que redescubrir

1. **`proxy.ts`, no `middleware.ts`** (Next 16). Un agente que "repare" esto rompe el build.
2. **GRANTs obligatorios** para tablas nuevas de `public`.
3. **Techo de 1000 filas de PostgREST**: trunca en silencio con 200. Toda query sin `.limit()`
   lleva `selectAllRows` (falla CERRADO: exige `{ count: 'exact' }`). Ver `AGENTS.md`.
4. **Zona horaria del negocio: `America/Bogota`.** `actions.vence` es `date`, no instante:
   compararlo contra un `Date` en UTC daba por vencida una acción que vence hoy. Usar
   `esVencida`/`esVencidaEn` de `metrics.ts`. En bucles, la variante `…En` (resolver el día
   cuesta ~12× la comparación).
5. **`.order()` siempre con desempate** (`.order('id')`): un insert múltiple da el mismo
   `created_at` y el "KPI principal" cambiaba entre recargas.
6. **`h-dvh`, no `min-h-screen`, en el shell.** El layout necesita altura DEFINIDA para que el
   scroll viva dentro de `<main>`; con `min-h-screen` el contenedor crece y el header deja de
   quedar fijo. Verificado a 375×812 y 928×918.
7. **Puertos 553xx** (loro usa 543xx). Si `supabase start` falla con `bind: ... forbidden by its
   access permissions`, Windows reservó el rango: el fix persistente está en `AGENTS.md`.
8. **psql** no está en el host → `docker exec supabase_db_cota psql -U postgres -d postgres -c "..."`.
9. **`supabase_vector_cota` crash-loopea** — limitación Windows conocida, inofensiva.
10. **KPI principal = primer KPI (por `created_at`) con ≥2 mediciones.** A3-007, A3-009 y A3-030
    no tienen KPI en el seed → la tabla muestra "Sin tendencia aún".
11. **Desviaciones deliberadas del spec de la tajada 1** (el spec conserva la redacción vieja):
    la celda verde dice **"Activos"**, no "KPIs mejorando" (contaba proyectos, y el proyecto en
    riesgo caía a la vez en la celda verde y en la roja); y la copia vacía es **"Sin tendencia
    aún"**, no "Sin medición aún" (mentía con una sola medición).

## Pendientes conocidos

- **(Siguiente bloque)** migración a esquema `kaze` — ver arriba.
- **Accesibilidad del menú de cuenta**: no cierra con `Escape`, sin `aria-haspopup`/`aria-expanded`
  ni `role="menu"`, y no devuelve el foco al disparador. Un usuario de teclado puede abrirlo pero
  no cerrarlo sin ratón. No bloquea, pero es la única vía de logout.
- **`<main>` anidado** en `/admin` y `/cuenta/contrasena`: el layout ya aporta un `<main>` y esas
  páginas traen el suyo. HTML inválido y dos landmarks para un lector de pantalla. Arreglo:
  cambiar el `<main>` propio de esas páginas por un `<div>`.
- **Techo de 1000 usuarios en `/admin`**: `db.auth.admin.listUsers({ perPage: 1000 })` es GoTrue,
  no PostgREST, así que `selectAllRows` no lo cubre. Además la comprobación de email duplicado de
  `inviteUserCore` se apoya en esa lista y se debilitaría en silencio.
- **Acoplamiento del layout**: `getSidebarClientes` se ejecuta para TODAS las páginas de `(app)`,
  así que si su guardia saltara tumbaría también `/admin` y la pantalla de contraseña.
- **Dato demo desfasado**: el seed está fechado en junio 2026 y la app usa la fecha real, así que
  "Acciones vencidas" sale alto (9 al 2026-09-19). Es dato, no bug; se corrige re-sembrando.
- **Módulo admin v1.1**: `resendInviteCore`, TOCTOU de los guards anti-lockout, SMTP de Hostinger.

## Decisiones ya tomadas (no re-litigar)

- Portar a Next.js (NO mantener el runtime `.dc.html`); el prototipo es solo referencia visual.
- RLS "equipo interno total ahora, por-cliente después"; rol `cliente` bloqueado hasta entonces.
- A3 profundo como `jsonb` (`projects.a3_content`); lo compartido entre pantallas, relacional.
- Seed = datos del prototipo transcritos, nunca inventados.
- Lista de Proyectos en tajadas: 1 ✅ · 2b = búsqueda/filtros · 2c = modal "Nuevo proyecto".
  Filas no navegables hasta que exista el Editor A3 — **esto es por diseño, no un bug**.
- **Consolidar Kaze en el proyecto Supabase del HUB/CMS** en vez de restaurar el pausado.
- Metodología: `superpowers:subagent-driven-development`, commits frecuentes en `main`;
  push solo al cerrar cada bloque (push = deploy).
