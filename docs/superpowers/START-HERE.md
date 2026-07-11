# START HERE — Cota · Mejoramiento de procesos

> Léeme primero al retomar. Última actualización: **2026-07-11**.
> Guía permanente del repo (comandos, peculiaridades del entorno): `AGENTS.md` en la raíz
> (Claude Code la carga sola vía `CLAUDE.md`). Este archivo es el **estado vivo**.

## 🎉 Estado: FUNDACIÓN COMPLETA

El plan `docs/superpowers/plans/2026-07-05-cota-foundation.md` (Tasks 1–14 + 2 micro-tareas
de hardening) está **terminado y verificado** en `bdc8bb7` (2026-07-11). Definition of Done
completa: migraciones aplican limpio, seed carga 5 clientes / 8 A3 / 5 consultores / 7 KPIs /
42 mediciones / 2 casos / 8 gastos / 12 acciones, 2 tests de integración pasan, `tsc` y
`build` limpios (sin warnings), `/proyectos` protegida, y e2e con navegador real:
login carmen@cota.test → lista de los 8 A3 leídos de Supabase, sesión persistente.

Cada tarea pasó revisión de spec + revisión de calidad (metodología
`superpowers:subagent-driven-development`). Review final del rango completo: **SHIP**.

## Prompt para retomar (copiar y pegar en la siguiente sesión)

```
Retoma el proyecto Cota en C:\Users\pauld\dev\cota. Lee docs/superpowers/START-HERE.md y
verifica git log. La Fundación (sub-proyecto 1) está COMPLETA en bdc8bb7. Sigue el
sub-proyecto 2: la pantalla real de Lista de Proyectos según reference/prototype/"Cota -
Lista de Proyectos.dc.html" (+ screenshots). Antes de diseñar, haz brainstorming + plan con
superpowers (spec nuevo), y arranca por la higiene pendiente: app/page.tsx →
redirect('/proyectos'), layout del route group (app) con la navegación del prototipo,
redirigir usuarios ya autenticados fuera de /login, y un test de capa de datos como usuario
authenticated (no service_role) para cubrir RLS/grants. Docker corriendo; stack con
npx supabase start.
```

## Coordenadas

| Qué | Dónde |
|---|---|
| Repo (el bueno) | `C:\Users\pauld\dev\cota` — rama `master`, sin remoto |
| Guía permanente del repo | `AGENTS.md` (raíz; incluida por `CLAUDE.md`) |
| Spec Fundación (histórico) | `docs/superpowers/specs/2026-07-05-cota-foundation-design.md` |
| Plan Fundación (completado) | `docs/superpowers/plans/2026-07-05-cota-foundation.md` |
| Prototipo (especificación visual) | `reference/prototype/` (+ `reference/screenshots/`) |
| Memoria del proyecto | auto-memory `project_cota.md` |
| Supabase local | API `http://127.0.0.1:55321` · Studio `55323` · keys: `npx supabase status` |
| Login local | `carmen@cota.test` / `cota-demo-2026` (README) |

## Qué es esto

Port del módulo de mejoramiento de procesos de **Cota** (consultoría lean): 8 páginas
`.dc.html` de prototipo → app real **Next.js 16 + Supabase**. Multi-cliente, auth de
equipo ahora y clientes después. 7 sub-proyectos; el **1 (Fundación) está hecho**; sigue
el **2 (pantalla Lista de Proyectos)** y luego Editor A3 → Casos → Indicadores → Kanban →
Vista de Cliente.

## Qué quedó construido (verificable con `git log --oneline 31b85e5..bdc8bb7`)

- **Stack local**: `supabase init` con puertos **553xx** (los 543xx los usa loro), signup off.
- **Base**: `0001_schema.sql` (9 tablas + trigger `handle_new_user` + índices),
  `0002_rls.sql` (RLS + policies de equipo + **GRANTs de Data API**, obligatorios con esta CLI),
  `0003_hardening.sql` (índices FK restantes, revokes de `anon`, trigger `updated_at`, higiene RPC).
- **Tipos**: `lib/database.types.ts` generado (`npm run db:types`).
- **Seed**: `scripts/seed.ts` — datos transcritos 1:1 del prototipo (auditado valor por valor),
  vía Admin API + service_role. `npm run db:reset && npm run seed`.
- **Clientes**: `lib/supabase/server.ts` (anon + cookies), `client.ts` (browser, aún sin uso),
  `.env.local` (ignorado) + `.env.local.example`.
- **Capa de datos**: `lib/data/projects.ts` (`getProjects`, `getProjectByCode`),
  `lib/data/clients.ts` (`getClients`, para pantallas futuras) + tests de integración (Vitest).
- **Auth**: `proxy.ts` (⚠️ **convención Next 16 — NO recrear `middleware.ts`**, fue renombrado
  en `2a37c0c`; el helper sigue en `lib/supabase/middleware.ts`), login con server action.
- **Prueba de vida**: `app/(app)/proyectos/page.tsx` — 8 A3 con cliente desde Supabase.
- **README** con quickstart local y pasos de despliegue al alojado.

## Notas técnicas que NO hay que redescubrir

1. **`proxy.ts`, no `middleware.ts`**: el spec y el plan (históricos) dicen `middleware.ts`;
   Next 16 lo deprecó y ya está migrado. Un agente que "repare" esto rompería el build.
2. **GRANTs obligatorios**: la CLI actual no expone tablas de `public` a la Data API sin
   grants explícitos; ya están en `0002` + default privileges para migraciones futuras.
3. **Puertos 553xx** para convivir con el stack de loro (543xx). No tocar `*_loro`.
4. **psql** no está en el host → `docker exec supabase_db_cota psql -U postgres -d postgres -c "..."`.
5. **seed.sql no existe** (seed = TS); el WARN de `db reset` es normal.
6. **`supabase_vector_cota` crash-loopea** — limitación Windows conocida, inofensiva.
7. **Embeds de profiles necesitan hint** (2 FKs): `profiles!projects_consultor_id_fkey` /
   `!projects_lider_id_fkey` (comentario en `lib/data/projects.ts`).
8. **`site_url`** sigue en default `127.0.0.1:3000`; solo importa si se usan emails de reset.

## Pendientes conocidos (arranque del sub-proyecto 2)

1. `app/page.tsx` es un placeholder alcanzable autenticado → debería ser `redirect('/proyectos')`.
2. Falta layout del route group `(app)` con la navegación del prototipo.
3. `/login` no redirige a usuarios ya autenticados.
4. Tests de datos corren como service_role (saltan RLS) → añadir helper que firme como
   `carmen@cota.test` y pruebe con el cliente anon (cubre RLS/grants ante regresiones).
5. (Opcional) renombrar `lib/supabase/middleware.ts` → `session.ts` para coherencia con `proxy.ts`.
6. (Usuario) crear el proyecto Supabase alojado cuando toque desplegar: `npx supabase link`
   + `db push` (documentado en README).

## Decisiones ya tomadas (no re-litigar)

- Portar a Next.js (NO mantener el runtime `.dc.html`); el prototipo es solo referencia visual.
- Supabase con RLS "equipo interno total ahora, por-cliente después" (esquema ya preparado).
- A3 profundo como `jsonb` (`projects.a3_content`); lo compartido entre pantallas, relacional.
- Seed = datos del prototipo transcritos, nunca inventados.
- Orden de pantallas: Proyectos → Editor A3 → Casos → Indicadores → Kanban → Vista de Cliente.
- Metodología: `superpowers:subagent-driven-development` con commits frecuentes en `master`.
