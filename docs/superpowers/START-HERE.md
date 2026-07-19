# START HERE — Kaze · Mejoramiento de procesos

> Léeme primero al retomar. Última actualización: **2026-07-18**.
> Guía permanente del repo (comandos, peculiaridades del entorno): `AGENTS.md` en la raíz
> (Claude Code la carga sola vía `CLAUDE.md`). Este archivo es el **estado vivo**.

## 🎉 Estado: FUNDACIÓN COMPLETA · TODO EN PRODUCCIÓN (BD + FRONTEND)

**App viva:** `https://kaze-pauldvcoders-projects.vercel.app` — verificada e2e en producción
(login carmen@cota.test → /proyectos lista los 3 A3 vía RLS). CI/CD activo: push a `main`
en GitHub `pauldv-coder/Kaze` = deploy automático. Vercel Deployment Protection desactivada
para este proyecto (si no, el SSO de Vercel bloqueaba el dominio `*.vercel.app`).

- **Fundación (sub-proyecto 1)** terminada y verificada en `bdc8bb7` (Tasks 1–14 + hardening).
  Definition of Done completa; e2e con navegador real: login → 8 A3 desde Supabase local.
  Cada tarea pasó revisión de spec + calidad (`superpowers:subagent-driven-development`).
  Review final del rango: **SHIP**.
- **Base de datos EN PRODUCCIÓN**: el proyecto alojado **Cota** (producto: Kaze) (`kvjpxnswvlxzxdzgycbh`,
  región ca-central-1) tiene las 3 migraciones aplicadas (`db push`) y un **seed selectivo de
  3 casos representativos** (A3-014 progreso · A3-012 cerrado · A3-030 nuevo) + sus 3 clientes,
  5 consultores, 4 KPIs, 24 mediciones, 1 caso de negocio, 5 gastos, 4 acciones. Verificado
  e2e contra el alojado (login + lectura vía RLS). Commit del seed selectivo: `598ef45`.
- **Frontend DESPLEGADO en Vercel** (2026-07-18): proyecto `kaze` (scope `pauldvcoders-projects`,
  id `prj_ueWZL9OxmcAQirdIWcYDnv5wKHk9`), env vars públicas seteadas (Production+Preview),
  GitHub conectado para CI/CD, deployment protection OFF. Guía: **`docs/DEPLOY.md`**.

## Prompt para retomar (copiar y pegar en la siguiente sesión)

```
Retoma el proyecto Kaze en C:\Users\pauld\dev\cota. Lee docs/superpowers/START-HERE.md y
verifica git log (+ git status y que origin apunte a github.com/pauldv-coder/Kaze). Estado:
Fundación COMPLETA, BD en producción (kvjpxnswvlxzxdzgycbh, 3 casos seed) y frontend
DESPLEGADO en https://kaze-pauldvcoders-projects.vercel.app con CI/CD (push a main =
deploy automático).

Sigue el SUB-PROYECTO 2: pantalla real de Lista de Proyectos según
reference/prototype/"Cota - Lista de Proyectos.dc.html" (+ screenshots en
reference/screenshots/). Antes de diseñar, brainstorming + plan con superpowers (spec
nuevo, como se hizo con la Fundación). Ejecuta con subagent-driven-development, tarea por
tarea con commits frecuentes, y arranca por la higiene pendiente:
- layout del route group (app) con la navegación del prototipo,
- redirigir usuarios ya autenticados fuera de /login,
- test de capa de datos como usuario authenticated (no service_role) para cubrir RLS/grants.

Desarrollo contra el stack LOCAL (Docker corriendo; npx supabase start, puertos 553xx);
producción solo se toca con push a main (frontend) o npx supabase db push (migraciones).
```

## Coordenadas

| Qué | Dónde |
|---|---|
| Repo (el bueno) | `C:\Users\pauld\dev\cota` — rama `main` · remoto `github.com/pauldv-coder/Kaze` |
| **App en producción** | `https://kaze-pauldvcoders-projects.vercel.app` (Vercel `kaze`, CI/CD desde GitHub) |
| Guía permanente del repo | `AGENTS.md` (raíz; incluida por `CLAUDE.md`) |
| Guía de despliegue | `docs/DEPLOY.md` |
| Spec Fundación (histórico) | `docs/superpowers/specs/2026-07-05-cota-foundation-design.md` |
| Plan Fundación (completado) | `docs/superpowers/plans/2026-07-05-cota-foundation.md` |
| Prototipo (especificación visual) | `reference/prototype/` (+ `reference/screenshots/`) |
| Memoria del proyecto | auto-memory `project_cota.md` |
| **Supabase PRODUCCIÓN** | proyecto `kvjpxnswvlxzxdzgycbh` · `https://kvjpxnswvlxzxdzgycbh.supabase.co` · dashboard supabase.com |
| Supabase local | API `http://127.0.0.1:55321` · Studio `55323` · keys: `npx supabase status` |
| Login local (demo) | `carmen@cota.test` / `cota-demo-2026` |
| Login producción | `carmen@cota.test` / la contraseña sembrada con `SEED_PASSWORD` (compartida en chat — **rótala**) |

## Qué es esto

Port del módulo de mejoramiento de procesos de **Cota** (consultoría lean): 8 páginas
`.dc.html` de prototipo → app real **Next.js 16 + Supabase**. Multi-cliente, auth de
equipo ahora y clientes después. 7 sub-proyectos; el **1 (Fundación) está hecho**; sigue
el **2 (pantalla Lista de Proyectos)** y luego Editor A3 → Casos → Indicadores → Kanban →
Vista de Cliente.

## Producción (proyecto alojado)

- Proyecto **Cota** `kvjpxnswvlxzxdzgycbh` (lo creó el usuario en supabase.com). El repo está
  enlazado (`npx supabase link` ya hecho). Re-aplicar migraciones futuras: `npx supabase db push`.
- Sembrar selectivo: `SEED_ONLY="A3-014,A3-012,A3-030" SEED_PASSWORD="<fuerte>" npx tsx scripts/seed.ts`
  con `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` apuntando al alojado
  (service_role se saca con `npx supabase projects api-keys --project-ref kvjpxnswvlxzxdzgycbh`).
- ⚠️ **Pendiente en el dashboard (paso del usuario)**: el alojado tiene `disable_signup:false`
  (el `config.toml` local NO aplica al alojado). Como es solo-por-invitación, desactivar
  "Allow new users to sign up" en Authentication. Y al desplegar el frontend, poner el dominio
  de Vercel como Site URL / Redirect URL.

## Qué quedó construido (verificable con `git log --oneline 31b85e5..HEAD`)

- **Stack local**: `supabase init` con puertos **553xx** (los 543xx los usa loro), signup off.
- **Base**: `0001_schema.sql` (9 tablas + trigger `handle_new_user` + índices),
  `0002_rls.sql` (RLS + policies de equipo + **GRANTs de Data API**, obligatorios con esta CLI),
  `0003_hardening.sql` (índices FK restantes, revokes de `anon`, trigger `updated_at`, higiene RPC).
- **Tipos**: `lib/database.types.ts` generado (`npm run db:types`).
- **Seed**: `scripts/seed.ts` — datos transcritos 1:1 del prototipo (auditado valor por valor),
  vía Admin API + service_role. Soporta `SEED_ONLY` (códigos A3 CSV) y `SEED_PASSWORD`.
  `npm run db:reset && npm run seed` (local, completo).
- **Clientes**: `lib/supabase/server.ts` (anon + cookies), `client.ts` (browser, aún sin uso),
  `.env.local` (ignorado) + `.env.local.example` + `.env.production.example`.
- **Capa de datos**: `lib/data/projects.ts` (`getProjects`, `getProjectByCode`),
  `lib/data/clients.ts` (`getClients`, para pantallas futuras) + tests de integración (Vitest).
- **Auth**: `proxy.ts` (⚠️ **convención Next 16 — NO recrear `middleware.ts`**, fue renombrado
  en `2a37c0c`; el helper sigue en `lib/supabase/middleware.ts`), login con server action.
- **Rutas**: `/` → redirect a `/proyectos`; `app/(app)/proyectos/page.tsx` lista los A3 desde Supabase.
- **README** + **`docs/DEPLOY.md`** (Vercel: caminos GitHub y CLI, env vars, post-deploy).

## Notas técnicas que NO hay que redescubrir

1. **`proxy.ts`, no `middleware.ts`**: el spec y el plan (históricos) dicen `middleware.ts`;
   Next 16 lo deprecó y ya está migrado. Un agente que "repare" esto rompería el build.
2. **GRANTs obligatorios**: la CLI actual no expone tablas de `public` a la Data API sin
   grants explícitos; ya están en `0002` + default privileges para migraciones futuras.
3. **Frontend solo usa 2 env PÚBLICAS** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
   **NUNCA** poner `SUPABASE_SERVICE_ROLE_KEY` en el host del frontend (solo la usa el seed).
4. **Puertos 553xx** para convivir con el stack de loro (543xx). No tocar `*_loro`.
5. **psql** no está en el host → `docker exec supabase_db_cota psql -U postgres -d postgres -c "..."`.
6. **seed.sql no existe** (seed = TS); el WARN de `db reset` es normal.
7. **`supabase_vector_cota` crash-loopea** — limitación Windows conocida, inofensiva.
8. **Embeds de profiles necesitan hint** (2 FKs): `profiles!projects_consultor_id_fkey` /
   `!projects_lider_id_fkey` (comentario en `lib/data/projects.ts`).
9. **`site_url`** local sigue en `127.0.0.1:3000`; en el alojado hay que setear el dominio real.

## Pendientes conocidos

- **(Usuario, dashboard Supabase)** desactivar signup público del alojado (sigue en
  `disable_signup:false`) + setear Site URL/Redirect URLs a
  `https://kaze-pauldvcoders-projects.vercel.app`.
- **(Usuario)** rotar la contraseña de producción sembrada.
- **Sub-proyecto 2 (pantalla Lista de Proyectos)** — higiene de arranque:
  1. Layout del route group `(app)` con la navegación del prototipo.
  2. `/login` debería redirigir a usuarios ya autenticados.
  3. Tests de datos corren como service_role (saltan RLS) → añadir helper que firme como
     `carmen@cota.test` y pruebe con el cliente anon (cubre RLS/grants ante regresiones).
  4. (Opcional) renombrar `lib/supabase/middleware.ts` → `session.ts` por coherencia con `proxy.ts`.

## Decisiones ya tomadas (no re-litigar)

- Portar a Next.js (NO mantener el runtime `.dc.html`); el prototipo es solo referencia visual.
- Supabase con RLS "equipo interno total ahora, por-cliente después" (esquema ya preparado).
- A3 profundo como `jsonb` (`projects.a3_content`); lo compartido entre pantallas, relacional.
- Seed = datos del prototipo transcritos, nunca inventados. Producción = solo 3 casos representativos.
- Orden de pantallas: Proyectos → Editor A3 → Casos → Indicadores → Kanban → Vista de Cliente.
- Metodología: `superpowers:subagent-driven-development` con commits frecuentes en `master`.
