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
- **Data API nueva:** las tablas de `public` NO se exponen a la API sin `GRANT`s explícitos;
  van en las migraciones (ver `supabase/migrations/0002_rls.sql`).
- **El seed es TypeScript** (`scripts/seed.ts`, Admin API). NO existe `supabase/seed.sql`;
  el `WARN: no files matched pattern: supabase/seed.sql` de `db reset` es normal.
- **Signup público desactivado** (`enable_signup = false`); los usuarios los crea el seed.
  Login local de demo: `carmen@cota.test` / `cota-demo-2026`.
- **Tailwind v4:** tokens en `app/globals.css` vía `@theme`. **NO existe `tailwind.config.ts`** — no lo crees.
- **Windows:** escribe archivos como UTF-8 sin BOM (herramienta Write, no redirección de PowerShell).
  El contenedor `supabase_vector_cota` crash-loopea — limitación conocida de Docker en Windows,
  inofensiva (analytics sigue sano; loro tiene el mismo patrón).

## Convenciones

- Rama `master`, sin remoto (no push). Commits frecuentes, estilo conventional (`feat:`/`chore:`/`docs:`).
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
aplicados. El frontend (Next.js) aún NO está desplegado — ver `docs/DEPLOY.md`.
El frontend solo usa `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
NUNCA poner `SUPABASE_SERVICE_ROLE_KEY` en el host del frontend.
