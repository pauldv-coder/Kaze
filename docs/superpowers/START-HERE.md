# START HERE — Cota · Mejoramiento de procesos

> Léeme primero al retomar. Última actualización: **2026-07-08**.
> Guía permanente del repo (comandos, peculiaridades del entorno): `AGENTS.md` en la raíz
> (Claude Code la carga sola vía `CLAUDE.md`). Este archivo es el **estado vivo**.

## Prompt para retomar (copiar y pegar en la siguiente sesión)

```
Retoma el proyecto Cota en C:\Users\pauld\dev\cota. Lee docs/superpowers/START-HERE.md
y verifica git log. Estamos ejecutando el plan
docs/superpowers/plans/2026-07-05-cota-foundation.md con
superpowers:subagent-driven-development: Tasks 1-5 ya están hechas (scaffold Next.js 16
+ Tailwind v4, deps Supabase/Vitest, supabase local inicializado en puertos 553xx,
esquema de 9 tablas aplicado). Continúa con las Tasks 6-14 (RLS+GRANTs, tipos, seed
desde reference/prototype/, .env.local + clientes Supabase, capa de datos con tests,
middleware de sesión, login y /proyectos, README), tarea por tarea con commits
frecuentes. Docker Desktop debe estar corriendo; el stack se levanta con
npx supabase start desde la raíz del repo.
```

## Coordenadas

| Qué | Dónde |
|---|---|
| Repo (el bueno) | `C:\Users\pauld\dev\cota` — rama `master`, sin remoto |
| Guía permanente del repo | `AGENTS.md` (raíz; incluida por `CLAUDE.md`) |
| Spec aprobado | `docs/superpowers/specs/2026-07-05-cota-foundation-design.md` |
| Plan de implementación | `docs/superpowers/plans/2026-07-05-cota-foundation.md` (bloque **Progreso** al día) |
| Prototipo (especificación visual) | `reference/prototype/` (+ `reference/screenshots/`) |
| Memoria del proyecto | auto-memory `project_cota.md` |
| Supabase local | API `http://127.0.0.1:55321` · Studio `55323` · keys: `npx supabase status` |

## Qué es esto

Port del módulo de mejoramiento de procesos de **Cota** (consultoría lean): 8 páginas
`.dc.html` de prototipo → app real **Next.js 16 + Supabase**. Multi-cliente, auth de
equipo ahora y clientes después. 7 sub-proyectos; vamos en el **1 (Fundación)**.

## Estado actual (verificable con `git log --oneline`)

- ✅ **Tasks 1–5 HECHAS** (2026-07-08), cada una con revisión de spec + calidad:
  - T1+T3 `a647f5a` — scaffold Next 16.2.10 + React 19 + Tailwind v4 (tokens `@theme` en
    `app/globals.css`, NO hay `tailwind.config.ts`), fuentes Space Grotesk/Hanken.
  - T2 `8c8048d`+`735c6ad` — deps `@supabase/*`, Vitest, tsx, dotenv, **CLI supabase como
    devDependency**; `vitest.config.ts`; scripts `test`/`db:reset`/`db:types`/`seed`.
    (Ojo: el handoff anterior decía que T2 estaba hecha — no lo estaba; ya sí.)
  - T4 `99504ff` — `supabase init`; **puertos remapeados a 553xx** (loro ocupa 543xx);
    `enable_signup = false`; stack corriendo y verificado.
  - T5 `3171691` — `supabase/migrations/0001_schema.sql`: 9 tablas + trigger
    `handle_new_user` + 5 índices, aplicado con `db reset` y verificado en la base.
- ⬜ **Tasks 6–14 PENDIENTES**: RLS + policies (**+ GRANTs de Data API — crítico, ver nota**)
  → tipos TS → seed → `.env.local`/clientes → capa de datos (TDD) → middleware → login
  → `/proyectos` → README.

## Notas técnicas que NO hay que redescubrir

1. **GRANTs obligatorios (T6):** esta versión de la CLI ya no expone las tablas de `public`
   a la Data API automáticamente. `0002_rls.sql` debe incluir, además de RLS y policies,
   `grant usage on schema public` y grants de tabla a `authenticated`/`service_role`
   (+ default privileges), o el seed (T8) y las queries de la app fallarán.
2. **Puertos:** todo el stack de Cota vive en 553xx para convivir con el stack de loro
   (543xx). No parar/tocar contenedores `*_loro`.
3. **psql:** no está en el host → `docker exec supabase_db_cota psql -U postgres -d postgres -c "..."`.
4. **seed.sql no existe:** el seed es `scripts/seed.ts` (T8); el WARN de `db reset` es normal.
5. **`site_url`** en `config.toml` quedó en `127.0.0.1:3000` (default) — irrelevante para
   login con contraseña; cambiar a `localhost:3000` si algún día se usan emails de reset.
6. **`supabase_vector_cota` crash-loopea** — limitación conocida de Docker en Windows
   (loro igual); analytics sano; ignorar.

## Bloqueadores

Ninguno para desarrollo local. El proyecto Supabase **alojado** (supabase.com) sigue
pendiente y solo se necesita al final (T14 paso 3: `supabase link` + `db push`).

## Decisiones ya tomadas (no re-litigar)

- Portar a Next.js (NO mantener el runtime `.dc.html`); el prototipo es solo referencia visual.
- Supabase con RLS "equipo interno total ahora, por-cliente después" (esquema ya preparado).
- A3 profundo como `jsonb` (`projects.a3_content`); lo compartido entre pantallas, relacional.
- Seed = los datos hardcoded del prototipo (5 clientes, 8 A3, KPIs+series, BC-07/BC-09, 12 acciones).
- Orden de pantallas después de la Fundación: Proyectos → Editor A3 → Casos → Indicadores → Kanban → Vista de Cliente.
- Metodología: `superpowers:subagent-driven-development` — un subagente implementador por
  tarea + revisión de spec + revisión de calidad, commits frecuentes en `master`.
