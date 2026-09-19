# START HERE — Kaze · Mejoramiento de procesos

> Léeme primero al retomar. Última actualización: **2026-09-19**.
> Guía permanente del repo (comandos, peculiaridades del entorno): `AGENTS.md` en la raíz
> (Claude Code la carga sola vía `CLAUDE.md`). Este archivo es el **estado vivo**.

## ⚠️ Estado a 2026-09-19: PRODUCCIÓN CAÍDA POR SUPABASE PAUSADO · DESARROLLO EN CURSO

### Producción: el proyecto Supabase de Kaze está PAUSADO
`npx supabase projects list` (2026-09-19):

| Proyecto | Ref | Estado |
|---|---|---|
| **Cota** (Kaze) | `kvjpxnswvlxzxdzgycbh` | **INACTIVE** (pausado) |
| vento-cms | `nrysdnavawyhaqgruunl` | ACTIVE_HEALTHY |
| Casa de Fe | `dvazkronlpplrwotisgd` | ACTIVE_HEALTHY |

- Efecto: la app en Vercel (`https://kaze-pauldvcoders-projects.vercel.app`) carga pero **login y
  datos fallan** mientras el proyecto esté pausado. El código y el deploy de Vercel están bien.
- Causa probable de "no me deja activarlo": el plan **Free de Supabase permite solo 2 proyectos
  activos** y ya hay 2 activos (vento-cms + Casa de Fe). Los proyectos Free además se pausan
  solos tras ~1 semana sin actividad.
- **Cómo restaurarlo (paso del usuario, en el dashboard de supabase.com):** pausar uno de los
  otros dos (Project Settings → General → Pause project) **o** subir la organización a Pro; luego
  en el proyecto Cota → **Restore project**. Ojo: pausar vento-cms tumba el CMS (y lo que dependa
  de él); decidir según qué necesita estar vivo.
- ⏳ **Ventana de restauración:** Supabase solo restaura desde el dashboard proyectos Free pausados
  hace menos de ~90 días (el dashboard muestra la fecha límite). Cota se pausó en algún momento
  después del 2026-07-25 → **hacerlo antes de fines de octubre 2026**. Pasado ese plazo solo se
  puede descargar el backup y recrear el proyecto (migraciones + seed selectivo + admin).
- Tras restaurar: las keys y URL no cambian; Vercel no necesita cambios. Verificar login con
  `info@ventosolutions.ca` → `/proyectos` muestra los 3 A3.
- **El desarrollo NO depende de esto**: todo se trabaja contra el stack LOCAL (Docker).

### Desarrollo: sub-proyecto 2 tajada 1 a medio ejecutar
Plan en ejecución: **`docs/superpowers/plans/2026-07-25-kaze-lista-proyectos.md`** (12 tareas;
spec `docs/superpowers/specs/2026-07-25-kaze-lista-proyectos-design.md`). Metodología:
`superpowers:subagent-driven-development` (implementador + revisión por tarea).

| Task | Estado |
|---|---|
| T1 helpers de métricas (`lib/data/metrics.ts`) | ✅ `b54d927` (TDD, 9 tests) |
| T2 `getProjectsList` | ✅ `1bac1d8` (TDD; suite 25/25 verde) |
| T3 `getProjectsSummary` + `getSidebarClientes` | 🟡 **escrita, SIN verificar ni commitear**: `lib/data/summary.ts` y `tests/data/summary.test.ts` están *untracked*. Siguiente paso: correr el test, revisar contra el plan, commitear |
| T4 test authenticated (RLS) | ⬜ |
| T5–T10 UI (componentes tabla, strip, shell, sidebar, layout `(app)`, redirect `/login`, `/proyectos`) | ⬜ |
| T11 e2e navegador | ⬜ |
| T12 docs + push + review final | ⬜ |

- **T1 y T2 NO están pusheadas** (a propósito: el plan pushea recién en T12; push = deploy).
- Pendiente además: revisión combinada de la capa de datos (T1–T4) antes de pasar a UI.

### Siguiente después de la tajada 1: diagramador BPMN (estilo Bizagi)
Spec **aprobado**: `docs/superpowers/specs/2026-07-26-kaze-diagramador-bpmn-design.md` — bpmn-js
(BPMN 2.0, import/export compatible con Bizagi), N diagramas por proyecto A3, rutas `/diagramas`
y `/diagramas/[id]`, migración `0005_diagrams.sql`. **Falta el plan** (`superpowers:writing-plans`);
se planifica e implementa DESPUÉS de cerrar la tajada 1 (necesita la sidebar donde colgarse).

## Prompt para retomar (copiar y pegar en la siguiente sesión)

```
Retoma el proyecto Kaze en C:\Users\pauld\dev\cota. Lee docs/superpowers/START-HERE.md y
AGENTS.md, y verifica git log + git status (rama main, origin github.com/pauldv-coder/Kaze).

Estado: Fundación y módulo admin COMPLETOS. El proyecto Supabase de producción
(kvjpxnswvlxzxdzgycbh) estaba PAUSADO al 2026-09-19 — confírmalo con
`npx supabase projects list`; si sigue pausado, recuérdame restaurarlo (plan Free = máx 2
activos; ventana de ~90 días) pero NO bloquees el desarrollo: trabajamos contra el stack LOCAL.

Continúa el plan docs/superpowers/plans/2026-07-25-kaze-lista-proyectos.md con
superpowers:subagent-driven-development. T1 (b54d927) y T2 (1bac1d8) están hechas y sin
pushear. T3 quedó escrita pero sin verificar: lib/data/summary.ts y tests/data/summary.test.ts
están untracked — verifícalas contra el plan, corre el test y commitea. Luego T4 y la revisión
combinada de la capa de datos (T1–T4), después T5–T12. Push solo en T12 (push = deploy).

Antes de arrancar: Docker Desktop corriendo y `npx supabase start` (puertos 553xx; no tocar
*_loro). A los subagentes indícales correr TODO en primer plano (nunca run_in_background):
en la sesión anterior uno se quedó colgado esperando comandos en background.

Después de la tajada 1 viene el diagramador BPMN (spec aprobado
docs/superpowers/specs/2026-07-26-kaze-diagramador-bpmn-design.md): escribir su plan con
superpowers:writing-plans y ejecutarlo igual.
```

## Coordenadas

| Qué | Dónde |
|---|---|
| Repo (el bueno) | `C:\Users\pauld\dev\cota` — rama `main` · remoto `github.com/pauldv-coder/Kaze` |
| **App en producción** | `https://kaze-pauldvcoders-projects.vercel.app` (Vercel `kaze`, CI/CD desde GitHub) |
| Guía permanente del repo | `AGENTS.md` (raíz; incluida por `CLAUDE.md`) |
| Guía de despliegue | `docs/DEPLOY.md` |
| Plan EN CURSO | `docs/superpowers/plans/2026-07-25-kaze-lista-proyectos.md` |
| Spec siguiente (sin plan aún) | `docs/superpowers/specs/2026-07-26-kaze-diagramador-bpmn-design.md` |
| Specs/planes históricos | `docs/superpowers/specs/` y `docs/superpowers/plans/` (Fundación, módulo admin) |
| Prototipo (especificación visual) | `reference/prototype/` (+ `reference/screenshots/`) |
| Memoria del proyecto | auto-memory `project_cota.md` |
| **Supabase PRODUCCIÓN** | proyecto `kvjpxnswvlxzxdzgycbh` · `https://kvjpxnswvlxzxdzgycbh.supabase.co` · **pausado al 2026-09-19** |
| Supabase local | API `http://127.0.0.1:55321` · Studio `55323` · keys: `npx supabase status` |
| Login local (demo, admin) | `carmen@cota.test` / `cota-demo-2026` |
| Login producción (admin real) | `info@ventosolutions.ca` (el usuario ya cambió la contraseña temporal) |

## Qué es esto

Port del módulo de mejoramiento de procesos de **Cota** (consultoría lean): 8 páginas
`.dc.html` de prototipo → app real **Next.js 16 + Supabase**, con marca de producto **Kaze**.
Multi-cliente, auth de equipo ahora y clientes después. Orden de trabajo: Fundación ✅ →
módulo admin ✅ → **Lista de Proyectos (en curso)** → diagramador BPMN → Editor A3 → Casos →
Indicadores → Kanban → Vista de Cliente.

## Producción (proyecto alojado)

- Proyecto **Cota** `kvjpxnswvlxzxdzgycbh`. Repo enlazado (`npx supabase link` ya hecho).
  Migraciones 0001–0004 aplicadas. Re-aplicar futuras: `npx supabase db push`.
- Datos: 3 A3 seed (A3-014, A3-012, A3-030) + único usuario el admin real
  `info@ventosolutions.ca` (los 5 demo `@cota.test` se eliminaron de producción).
- Sembrar selectivo (si hubiera que recrear): `SEED_ONLY="A3-014,A3-012,A3-030" SEED_PASSWORD="<fuerte>" npx tsx scripts/seed.ts`
  con env apuntando al alojado; admin real con `scripts/create-admin.ts`.
- ⚠️ **Pendiente en el dashboard (paso del usuario, si sigue pendiente)**: desactivar
  "Allow new users to sign up" (el `config.toml` local NO aplica al alojado) y apuntar
  Site URL / Redirect URLs al dominio de Vercel.

## Qué quedó construido

- **Base**: `0001_schema.sql` (9 tablas + trigger `handle_new_user`), `0002_rls.sql` (RLS +
  policies + **GRANTs de Data API**), `0003_hardening.sql` (índices FK, revokes de `anon`,
  trigger `updated_at`), `0004_admin_roles.sql` (grants por columna: nadie cambia su propio `rol`).
- **Seed** `scripts/seed.ts` (datos 1:1 del prototipo; `SEED_ONLY`, `SEED_PASSWORD`; carmen = admin local)
  y **bootstrap** `scripts/create-admin.ts`.
- **Auth**: `proxy.ts` (Next 16), login, `/auth/confirm`, `/cuenta/contrasena`.
- **Módulo admin**: `/admin` (invitar por enlace, roles admin/consultor, desactivar),
  `lib/supabase/admin.ts` (`server-only`), `lib/auth/guards.ts` (`requireAdmin`), `lib/data/users.ts`.
- **Capa de datos**: `lib/data/projects.ts` (`getProjects`, `getProjectByCode`, **`getProjectsList`**),
  `lib/data/metrics.ts` (`deltaFavorable`, `esVencida`, `relativeDate`), `lib/data/clients.ts`;
  `lib/data/summary.ts` (T3, sin verificar).
- **Rutas**: `/` → `/proyectos` (aún la lista mínima; la tabla rica + shell llegan en T5–T10).
- **Tests** Vitest serializados (`fileParallelism: false`) contra el stack local seedeado.

## Notas técnicas que NO hay que redescubrir

1. **`proxy.ts`, no `middleware.ts`** (Next 16). Un agente que "repare" esto rompe el build.
2. **GRANTs obligatorios** para tablas nuevas de `public`; 0002 dejó default privileges para
   migraciones futuras (verificarlo con prueba de rol en cada tabla nueva).
3. **Cliente de navegador solo usa 2 env PÚBLICAS**. `SUPABASE_SERVICE_ROLE_KEY` vive en Vercel
   solo como env de **SERVIDOR** (server actions de `/admin`, `server-only`). Nunca pública.
4. **Puertos 553xx** (loro usa 543xx). No tocar `*_loro`.
5. **psql** no está en el host → `docker exec supabase_db_cota psql -U postgres -d postgres -c "..."`.
6. **seed.sql no existe** (seed = TS); el WARN de `db reset` es normal.
7. **`supabase_vector_cota` crash-loopea** — limitación Windows conocida, inofensiva.
8. **Embeds de profiles necesitan hint** (2 FKs); `getProjectsList` evita el problema resolviendo
   el equipo con un Map de profiles.
9. **Acciones vencidas usan `hoy` real** (inyectable en tests con la fecha congelada del seed,
   `2026-06-20`). Con el dato demo fechado en junio, en vivo el contador sale alto: es dato, no bug.
10. **A3-009, A3-007 y A3-030 no tienen KPI en el seed** → la tabla muestra "Sin medición aún".
11. **Subagentes: todo en primer plano.** Un implementador se colgó lanzando comandos con
    `run_in_background` y terminando el turno "a esperar". Docker Desktop también estaba apagado
    al retomar: arrancarlo primero.

## Pendientes conocidos

- **(Usuario, urgente)** restaurar el proyecto Supabase de producción (ver arriba; ventana ~90 días).
- **(Usuario, dashboard)** signup público off + Site URL/Redirect URLs a Vercel (si aún falta).
- **(Usuario)** SMTP de Hostinger para invitaciones automáticas (v1.1 del módulo admin).
- **Módulo admin v1.1**: `resendInviteCore` (hoy no se puede re-invitar a un no-confirmado;
  workaround: borrar y re-invitar) y cerrar el TOCTOU de los guards anti-lockout.
- **Demo data**: re-sembrar con fechas actuales si el contador de vencidas molesta.

## Decisiones ya tomadas (no re-litigar)

- Portar a Next.js (NO mantener el runtime `.dc.html`); el prototipo es solo referencia visual.
- RLS "equipo interno total ahora, por-cliente después"; rol `cliente` bloqueado hasta entonces.
- A3 profundo como `jsonb` (`projects.a3_content`); lo compartido entre pantallas, relacional.
- Seed = datos del prototipo transcritos, nunca inventados. Producción = solo 3 casos representativos.
- Lista de Proyectos en tajadas: 1 = shell + tabla + strip (solo lectura) · 2b = búsqueda/filtros ·
  2c = modal "Nuevo proyecto". Ítems de nav sin pantalla = placeholders deshabilitados; filas no
  navegables hasta que exista el Editor A3.
- Diagramador: BPMN con bpmn-js (≠ VSM, que es módulo futuro aparte); va después de la tajada 1.
- Metodología: `superpowers:subagent-driven-development` con commits frecuentes en `main`;
  push solo al cerrar cada bloque (push = deploy).
