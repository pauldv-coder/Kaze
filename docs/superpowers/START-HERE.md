# START HERE — Cota · Mejoramiento de procesos

> Léeme primero al retomar. Última actualización: **2026-07-05**.

## Prompt para retomar (copiar y pegar en la siguiente sesión)

```
Retoma el proyecto Cota en C:\Users\pauld\dev\cota. Lee docs/superpowers/START-HERE.md
y verifica el estado de git. Estamos ejecutando el plan
docs/superpowers/plans/2026-07-05-cota-foundation.md: Tasks 1–3 ya están hechas
(scaffold Next.js 16 + Tailwind v4 + tokens). Continúa con las Tasks 4–14
(Supabase local, esquema de 9 tablas, RLS, tipos, seed desde reference/prototype/,
clientes Supabase, capa de datos con tests, middleware de sesión, login y /proyectos),
usando superpowers:executing-plans o subagent-driven-development, tarea por tarea
con commits frecuentes.

Estado de mis prerequisitos (Task 0):
- Proyecto Supabase alojado creado: [SÍ/NO — si sí: URL + anon key + service_role key]
- Docker Desktop instalado y corriendo: [SÍ/NO]

Si Docker está listo, trabaja contra Supabase local (supabase start). Si solo tengo
el proyecto alojado, aplica migraciones con supabase db push y apunta .env.local al alojado.
```

## Coordenadas

| Qué | Dónde |
|---|---|
| Repo (el bueno) | `C:\Users\pauld\dev\cota` — rama `master`, sin remoto todavía |
| Spec aprobado | `docs/superpowers/specs/2026-07-05-cota-foundation-design.md` |
| Plan de implementación | `docs/superpowers/plans/2026-07-05-cota-foundation.md` (tiene bloque **Progreso**) |
| Prototipo (especificación visual) | `reference/prototype/` (+ `reference/screenshots/`) |
| Prototipo navegable | `cd "C:\Users\pauld\OneDrive\Documentos\Full Stack\Vento improvement" && python -m http.server 4599` → abrir `index.html` |
| Memoria del proyecto | auto-memory `project_cota.md` |

## Qué es esto

Port del módulo de mejoramiento de procesos de **Cota** (consultoría lean): 8 páginas
`.dc.html` de prototipo → app real **Next.js 16 + Supabase**. Multi-cliente, auth de
equipo ahora y clientes después. 7 sub-proyectos; vamos en el **1 (Fundación)**.

## Estado actual (verificable)

- ✅ **Tasks 1–3 hechas:** scaffold Next 16.2.10 + React 19 + **Tailwind v4** (tokens en
  `app/globals.css` vía `@theme`, NO hay `tailwind.config.ts`), fuentes Space
  Grotesk/Hanken, home placeholder. `npm run build` verde.
- ⬜ **Tasks 4–14 pendientes:** Supabase init → esquema (9 tablas) → RLS → tipos →
  seed → env/clientes → capa de datos (TDD) → middleware → login → `/proyectos` → README.
- Verificar al retomar: `git log --oneline` (3–4 commits), `npm install && npm run build`.

## Bloqueadores (acciones del usuario — Task 0 del plan)

1. **Proyecto Supabase** creado en supabase.com (anotar URL, anon key, service_role key),
   o conector Supabase autorizado en sesión interactiva.
2. **Docker Desktop** instalado y corriendo (para `supabase start` local).

Sin Docker se puede trabajar directo contra el proyecto alojado (`supabase db push` +
`.env.local` apuntando al alojado) — el plan lo contempla en la nota de Task 0.

## Decisiones ya tomadas (no re-litigar)

- Portar a Next.js (NO mantener el runtime `.dc.html`); el prototipo es solo referencia visual.
- Supabase con RLS "equipo interno total ahora, por-cliente después" (esquema ya preparado).
- A3 profundo como `jsonb` (`projects.a3_content`); lo compartido entre pantallas, relacional.
- Seed = los datos hardcoded del prototipo (5 clientes, 8 A3, KPIs+series, BC-07/BC-09, 12 acciones).
- Orden de pantallas después de la Fundación: Proyectos → Editor A3 → Casos → Indicadores → Kanban → Vista de Cliente.
