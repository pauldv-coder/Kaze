# Kaze · Migración a esquema `kaze` + SSO — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover Kaze al proyecto Supabase compartido `nrysdnavawyhaqgruunl` como esquema `kaze`, con RLS gateado por membresía, dominio propio y sesión compartida con el HUB y el CMS.

**Architecture:** Mudanza por esquema, no por proyecto: PostgREST expone `kaze` igual que ya expone `hub`, y el cliente de Supabase se construye una sola vez apuntando a ese esquema, de modo que la capa de datos no cambia ni una query. La seguridad pasa de "confiar en que solo los nuestros tienen cuenta" a comprobar membresía en cada policy, porque `auth.users` pasa a compartirse con el CMS.

**Tech Stack:** Supabase (Postgres 17, PostgREST, GoTrue), Next.js 16 (App Router), @supabase/ssr, TypeScript, Vitest, Vercel, Hostinger DNS.

**Spec:** `docs/superpowers/specs/2026-09-20-kaze-migracion-esquema-sso-design.md` (aprobado 2026-09-20).

**Contexto operativo:** repo `C:\Users\pauld\dev\cota`, rama `main`, remoto `pauldv-coder/Kaze` (**push = auto-deploy a Vercel**). Stack local con `npx supabase start` (Docker Desktop encendido, puertos 553xx, contenedores `*_cota`; **nunca tocar `*_loro`**). No hay `psql` en el host: `docker exec supabase_db_cota psql -U postgres -d postgres -c "..."`. Convención Next 16: `proxy.ts`, **NO** `middleware.ts`. Escribir archivos UTF-8 sin BOM. **Correr TODO en primer plano, nunca en background.**

**Fases y puntos de reversión:** T1–T8 son locales (nada en producción). T9 toca el proyecto compartido pero Kaze sigue apuntando al viejo. **T10 es el hito: producción queda arreglada.** T11–T12 son el flip de SSO en tres repos. T13–T14 cierran.

**Pasos del usuario:** T9 paso 1, T10 pasos 1–2 y T13 requieren acciones en dashboards (Supabase, Vercel, Hostinger). Están marcados **[USUARIO]** y el agente debe parar y pedirlos, no intentarlos.

---

### Task 1: Migración de esquema `kaze` (sin trigger)

**Files:**
- Create: `supabase/migrations/20260920000001_kaze_schema.sql`
- Modify: `supabase/config.toml`

Las migraciones viejas de `supabase/migrations/*.sql` quedan como históricas: el proyecto destino nunca las tuvo. Se mueven con `git mv` a `supabase/migrations-historicas/`, y el juego nuevo vive en `supabase/migrations/` al nivel superior con nombres timestamped (convención real del CLI).

- [ ] **Step 1: Crear `supabase/migrations/20260920000001_kaze_schema.sql`** — EXACTAMENTE:

```sql
-- 20260920000001_kaze_schema.sql — esquema kaze (mudanza desde public del proyecto kvjpxnswvlxzxdzgycbh)
-- OJO: este archivo NO crea ningún trigger sobre auth.users. Ver 4.4 del spec:
-- el CMS ya tiene un trigger `on_auth_user_created` en ese proyecto y es suyo.
create extension if not exists pgcrypto;

create schema if not exists kaze;

create table kaze.clients (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  sector text,
  iniciales text,
  estado text not null default 'activo',
  created_at timestamptz not null default now()
);

-- profiles: la membresía a Kaze. Sin fila aquí no se entra (ver 0002).
-- NO hay trigger que la cree: la crea /admin al invitar, o el seed.
create table kaze.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  iniciales text,
  rol text not null default 'consultor' check (rol in ('admin','consultor','cliente')),
  created_at timestamptz not null default now()
);

create table kaze.projects (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  titulo text not null,
  client_id uuid references kaze.clients(id) on delete set null,
  estado text check (estado in ('nuevo','progreso','riesgo','cerrado')),
  fase text check (fase in ('definicion','ejecucion','cerrado')),
  consultor_id uuid references kaze.profiles(id) on delete set null,
  lider_id uuid references kaze.profiles(id) on delete set null,
  miembros uuid[] not null default '{}',
  fecha_inicio date,
  fecha_fin date,
  ahorro_anual numeric,
  avance_pasos int not null default 0 check (avance_pasos between 0 and 7),
  a3_content jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table kaze.kpis (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references kaze.projects(id) on delete cascade,
  nombre text not null,
  descripcion text,
  unidad text,
  base numeric,
  meta numeric,
  mejor_baja boolean not null default true,
  created_at timestamptz not null default now()
);

create table kaze.measurements (
  id uuid primary key default gen_random_uuid(),
  kpi_id uuid not null references kaze.kpis(id) on delete cascade,
  fecha date not null,
  valor numeric not null,
  ahorro numeric,
  created_at timestamptz not null default now()
);

create table kaze.business_cases (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  project_id uuid references kaze.projects(id) on delete cascade,
  titulo text,
  capex numeric,
  opex_anual numeric,
  ahorro_bruto_anual numeric,
  tasa numeric,
  inicio date,
  fecha_limite date,
  created_at timestamptz not null default now()
);

create table kaze.expenses (
  id uuid primary key default gen_random_uuid(),
  business_case_id uuid not null references kaze.business_cases(id) on delete cascade,
  fecha date not null,
  concepto text,
  monto numeric not null,
  tipo text check (tipo in ('inicial','recurrente','nuevo')),
  created_at timestamptz not null default now()
);

create table kaze.actions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  project_id uuid not null references kaze.projects(id) on delete cascade,
  titulo text not null,
  descripcion text,
  estado text check (estado in ('todo','doing','check','done')),
  prioridad text check (prioridad in ('alta','media','baja')),
  owner_id uuid references kaze.profiles(id) on delete set null,
  vence date,
  inversion boolean not null default false,
  created_at timestamptz not null default now()
);

create table kaze.action_notes (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references kaze.actions(id) on delete cascade,
  fecha timestamptz not null default now(),
  autor_id uuid references kaze.profiles(id) on delete set null,
  texto text not null
);

-- Índices de FK (venían de 0003_hardening en el esquema viejo).
create index on kaze.projects (client_id);
create index on kaze.projects (consultor_id);
create index on kaze.projects (lider_id);
create index on kaze.kpis (project_id);
create index on kaze.measurements (kpi_id);
create index on kaze.actions (project_id);
create index on kaze.actions (owner_id);
create index on kaze.expenses (business_case_id);
create index on kaze.business_cases (project_id);
create index on kaze.action_notes (action_id);

-- updated_at automático en projects (venía de 0003_hardening).
create or replace function kaze.touch_updated_at()
returns trigger language plpgsql set search_path = kaze, pg_temp as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_projects_updated
  before update on kaze.projects
  for each row execute function kaze.touch_updated_at();
```

Nota sobre `avance_pasos`: el esquema viejo no tenía CHECK y la revisión de la tajada 1 señaló que un valor fuera de rango renderiza "9/7". Se aprovecha la migración para cerrarlo.

- [ ] **Step 2: Apuntar el CLI al juego nuevo** — ⚠️ **Corregido durante la ejecución.** La idea original
  (`[db.migrations].schema_paths = ["./migrations/kaze/*.sql"]`) **no funciona y es peligrosa**: se probó
  empíricamente con el CLI 2.109.0 y `db reset` ignoró el archivo nuevo y aplicó las **4 migraciones
  viejas de `public`**, recreando el trigger `on_auth_user_created` — exactamente la mina que este
  plan existe para evitar. Dos motivos: `schema_paths` es la entrada del **esquema declarativo para
  `db diff`**, no un puntero al directorio de migraciones; y el CLI **no recursa** en subdirectorios de
  `supabase/migrations/`, así que `migrations/kaze/*.sql` nunca se aplicaría, ni con `db reset` ni con
  `db push` en la T9.

  Lo que se hizo, y que las tareas siguientes deben respetar:
  - Las migraciones nuevas viven en `supabase/migrations/` **al nivel superior**, con nombre
    **timestamped** (`20260920000001_kaze_schema.sql`), que es la convención real del CLI.
  - Las 4 viejas se movieron con `git mv` a `supabase/migrations-historicas/`.
  - `schema_paths` queda en `[]` con un comentario: dejarlo apuntando a un glob inexistente sería
    activamente dañino, porque la T9 corre `db diff --linked --schema kaze`, que **sí** lo consume.

  El nombre timestamped además evita un riesgo real en la T9: si el proyecto compartido ya tuviera una
  versión `0001` en `supabase_migrations.schema_migrations`, `db push` habría saltado la migración **en
  silencio**.

- [ ] **Step 3: Verificar que aplica** — Run: `cd /c/Users/pauld/dev/cota && npx supabase db reset`. Esperado: termina sin error. Luego:

```bash
docker exec supabase_db_cota psql -U postgres -d postgres -c "select table_name from information_schema.tables where table_schema='kaze' order by 1;"
```
Esperado: las 9 tablas. Y confirma que NO se creó trigger en auth.users desde este archivo:
```bash
docker exec supabase_db_cota psql -U postgres -d postgres -c "select tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth' and c.relname='users' and not t.tgisinternal;"
```
Esperado: **cero filas**.

- [ ] **Step 4: Commit** (NO push):

```bash
git add supabase/migrations/20260920000001_kaze_schema.sql supabase/migrations-historicas supabase/config.toml
git commit -m "feat(db): esquema kaze (9 tablas, sin trigger sobre auth.users)"
```
Trailer tras línea vacía: `Co-Authored-By: Claude <modelo> <noreply@anthropic.com>` con el modelo real.

---

### Task 2: RLS por membresía + grants

**Files:**
- Create: `supabase/migrations/20260920000002_kaze_rls.sql`

- [ ] **Step 1: Crear `supabase/migrations/20260920000002_kaze_rls.sql`** — EXACTAMENTE:

```sql
-- 20260920000002_kaze_rls.sql — membresía, RLS y grants de la Data API para kaze.
-- Cambio central respecto al esquema viejo: las policies pasan de `using (true)`
-- a `using (kaze.es_miembro())`. auth.users se comparte con el CMS, así que
-- "estar autenticado" ya NO implica pertenecer a Kaze.

-- Membresía. SECURITY DEFINER es obligatorio: la expresión de una policy se
-- evalúa como el usuario que consulta, y sin definer `authenticated` necesitaría
-- SELECT sobre kaze.profiles, con lo que la policy de profiles se consultaría a
-- sí misma. search_path fijo es requisito de toda función security definer.
-- No hay condición de "activo": desactivar es un ban de GoTrue, que impide
-- emitir el JWT antes de que RLS entre en juego.
create function kaze.es_miembro() returns boolean
  language sql stable security definer set search_path = kaze, pg_temp
as $$ select exists (select 1 from kaze.profiles where id = auth.uid()) $$;

revoke execute on function kaze.es_miembro() from public;
grant execute on function kaze.es_miembro() to authenticated, service_role;

alter table kaze.clients        enable row level security;
alter table kaze.profiles       enable row level security;
alter table kaze.projects       enable row level security;
alter table kaze.kpis           enable row level security;
alter table kaze.measurements   enable row level security;
alter table kaze.business_cases enable row level security;
alter table kaze.expenses       enable row level security;
alter table kaze.actions        enable row level security;
alter table kaze.action_notes   enable row level security;

-- Tablas de negocio: acceso total para MIEMBROS de Kaze.
do $$
declare t text;
begin
  foreach t in array array[
    'clients','projects','kpis','measurements','business_cases','expenses','actions','action_notes'
  ] loop
    execute format($f$
      create policy "miembros_select" on kaze.%1$I for select to authenticated using (kaze.es_miembro());
      create policy "miembros_insert" on kaze.%1$I for insert to authenticated with check (kaze.es_miembro());
      create policy "miembros_update" on kaze.%1$I for update to authenticated using (kaze.es_miembro()) with check (kaze.es_miembro());
      create policy "miembros_delete" on kaze.%1$I for delete to authenticated using (kaze.es_miembro());
    $f$, t);
  end loop;
end $$;

-- profiles: los miembros se ven entre sí; cada quien edita solo su fila.
create policy "profiles_select_miembros" on kaze.profiles
  for select to authenticated using (kaze.es_miembro());
create policy "profiles_update_own" on kaze.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- GRANTs de la Data API: sin esto ni service_role puede leer (RLS es un gate aparte).
grant usage on schema kaze to authenticated, service_role;
grant select, insert, update, delete on all tables in schema kaze to authenticated;
grant all on all tables in schema kaze to service_role;

alter default privileges in schema kaze grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema kaze grant all on tables to service_role;

-- Postgres da EXECUTE a PUBLIC en funciones nuevas por defecto: cerrarlo por adelantado.
alter default privileges in schema kaze revoke execute on functions from public;
alter default privileges in schema kaze grant execute on functions to authenticated, service_role;

-- Nadie cambia su propio rol vía Data API (venía de 0004_admin_roles).
revoke update on kaze.profiles from authenticated;
grant update (nombre, iniciales) on kaze.profiles to authenticated;
```

- [ ] **Step 2: Aplicar y verificar** — Run: `cd /c/Users/pauld/dev/cota && npx supabase db reset`. Luego comprobar que la función existe y que el grant de columnas quedó:

```bash
docker exec supabase_db_cota psql -U postgres -d postgres -c "select proname, prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='kaze';"
```
Esperado: `es_miembro | t` y `touch_updated_at | f`.

```bash
docker exec supabase_db_cota psql -U postgres -d postgres -c "select privilege_type, column_name from information_schema.column_privileges where table_schema='kaze' and table_name='profiles' and grantee='authenticated' and privilege_type='UPDATE' order by 2;"
```
Esperado: solo `nombre` e `iniciales`. **Si aparece `rol`, el revoke no aplicó: reporta, no lo parchees.**

- [ ] **Step 3: Commit** (NO push):

```bash
git add supabase/migrations/20260920000002_kaze_rls.sql
git commit -m "feat(db): RLS de kaze gateado por membresía + grants de Data API"
```
+ trailer.

---

### Task 3: Exponer `kaze` en la API local y apuntar los clientes al esquema

**Files:**
- Modify: `supabase/config.toml`
- Modify: `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/supabase/admin.ts`
- Modify: `package.json`
- Regenerate: `lib/database.types.ts`

- [ ] **Step 1: Exponer el esquema en local** — en `supabase/config.toml`, sección `[api]`, añadir `kaze` a `schemas`. Queda así (respeta lo que ya haya en la línea):

```toml
[api]
schemas = ["public", "graphql_public", "kaze"]
```

- [ ] **Step 2: Regenerar tipos solo de `kaze`** — en `package.json`, cambiar el script `db:types` a:

```json
"db:types": "supabase gen types typescript --local --schema kaze > lib/database.types.ts"
```

Luego: `cd /c/Users/pauld/dev/cota && npx supabase start && npm run db:types`. Abre `lib/database.types.ts` y **confirma que la clave de primer nivel es `kaze` y no `public`**.

- [ ] **Step 3: `lib/supabase/server.ts`** — añadir la opción `db`. El archivo completo queda:

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/database.types'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: 'kaze' },
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch { /* llamado desde un Server Component: ignorar */ }
        },
      },
    }
  )
}
```

- [ ] **Step 4: `lib/supabase/client.ts`** — completo:

```ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: 'kaze' } }
  )
}
```

- [ ] **Step 5: `lib/supabase/admin.ts`** — completo:

```ts
import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

// Cliente con service_role: SOLO importable desde código de servidor.
// La env var NO lleva prefijo NEXT_PUBLIC_ — jamás llega al navegador.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'kaze' }, auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

- [ ] **Step 6: Verificar tipos** — Run: `npx tsc --noEmit`.

Si falla con errores de genéricos en `lib/data/*.ts` (por ejemplo en `type DB = SupabaseClient<Database>`), la causa es que `Database` ya no tiene clave `public`. El arreglo es explicitar el esquema en el alias: `SupabaseClient<Database, 'kaze'>`. Aplícalo **solo donde el compilador lo exija** y reporta en qué archivos hizo falta. **NO cambies ninguna query.**

- [ ] **Step 7: Commit** (NO push):

```bash
git add supabase/config.toml package.json lib/supabase lib/database.types.ts lib/data
git commit -m "feat(db): clientes y tipos apuntando al esquema kaze"
```
+ trailer.

---

### Task 4: El seed crea los perfiles y un usuario ajeno

**Files:**
- Modify: `scripts/seed.ts`
- Modify: `scripts/create-admin.ts`

Sin el trigger, `db.from('profiles').update(...)` no encuentra fila y el seed deja usuarios **sin perfil**, que con el RLS nuevo no pueden leer nada. Este es el fallo más probable de la fase local.

- [ ] **Step 1: Cambiar el update por un insert** — en `scripts/seed.ts`, localiza el bloque de creación de consultores (alrededor de la línea 145, dentro del bucle que llama a `db.auth.admin.createUser`). Sustituye el `update` por un `insert`. El bloque queda:

```ts
    const { data, error } = await db.auth.admin.createUser({
      email: t.email, password: SEED_PASSWORD, email_confirm: true,
      user_metadata: { nombre: t.nombre, iniciales: t.iniciales },
    })
    if (error) throw error
    teamIds[t.iniciales] = data.user!.id
    // Ya no hay trigger que cree el profile: lo crea el seed.
    const { error: uErr } = await db.from('profiles').insert({
      id: data.user!.id,
      nombre: t.nombre, iniciales: t.iniciales,
      rol: t.iniciales === 'CV' ? 'admin' : 'consultor',
    })
    if (uErr) throw uErr
```

- [ ] **Step 2: Sembrar el usuario ajeno** — añade, **después** del bucle de consultores y antes de sembrar clientes, este bloque. Es el sujeto del test de seguridad de la Task 6: existe en `auth.users` y NO tiene perfil en Kaze, igual que tendría un usuario del CMS.

```ts
  // Usuario deliberadamente SIN perfil de Kaze: representa a alguien con cuenta
  // en el proyecto compartido (p. ej. del CMS) que no es miembro de Kaze.
  // Lo consume tests/data/rls-no-miembro.test.ts. No borrar.
  {
    const { error } = await db.auth.admin.createUser({
      email: 'ajeno@cota.test', password: SEED_PASSWORD, email_confirm: true,
      user_metadata: { nombre: 'Ajeno Sin Acceso' },
    })
    if (error && !/already|registered|exists/i.test(error.message)) throw error
  }
```

- [ ] **Step 2b: `scripts/create-admin.ts` también crea el perfil** — este script bootstrapea al admin de producción y hoy depende del mismo trigger. Ábrelo y aplica los dos cambios:

1. Si construye su propio cliente con `createClient(...)`, añadir `db: { schema: 'kaze' }` a las opciones.
2. Si hace `.from('profiles').update(...)` tras crear el usuario, cambiarlo por un `upsert`, que cubre tanto "usuario nuevo" como "el usuario ya existía en `auth.users`" (el caso real en el proyecto compartido, donde `info@ventosolutions.ca` ya existe por `hub.staff`):

```ts
const { error: pErr } = await db.from('profiles').upsert({
  id: userId, nombre, iniciales, rol: 'admin',
})
if (pErr) throw pErr
```

Sustituye `userId`, `nombre` e `iniciales` por las variables que el script ya tenga. **Reporta el diff exacto que aplicaste.**

- [ ] **Step 3: Sembrar y verificar** — Run:

```bash
cd /c/Users/pauld/dev/cota && npx supabase db reset && npm run seed
```
Esperado: termina en "Seed OK". Luego:

```bash
docker exec supabase_db_cota psql -U postgres -d postgres -c "select (select count(*) from kaze.profiles) as perfiles, (select count(*) from auth.users) as usuarios, (select count(*) from kaze.projects) as proyectos;"
```
Esperado: `perfiles=5`, `usuarios=6` (los 5 con perfil + ajeno), `proyectos=8`.

- [ ] **Step 4: Commit** (NO push):

```bash
git add scripts/seed.ts
git commit -m "feat(seed): crear perfiles explícitamente y sembrar usuario sin membresía"
```
+ trailer.

---

### Task 5: La suite existente pasa contra `kaze`

**Files:**
- Modify: `tests/data/*.test.ts` (solo la construcción del cliente)

- [ ] **Step 1: Correr la suite tal cual** — Run: `cd /c/Users/pauld/dev/cota && npm test`.

Esperado: **falla**. Los tests construyen su propio cliente con `createClient<Database>(url, key, { auth: {...} })`, sin `db.schema`, así que consultan `public`, donde ya no hay tablas.

- [ ] **Step 2: Añadir el esquema en cada test de integración** — en `tests/data/projects-list.test.ts`, `tests/data/summary.test.ts`, `tests/data/rls-authenticated.test.ts`, `tests/data/users.test.ts`, `tests/data/roles.test.ts` y `tests/data/query.test.ts` (los que creen cliente), añade `db: { schema: 'kaze' }` a las opciones. El patrón queda:

```ts
const db = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: 'kaze' }, auth: { persistSession: false } }
)
```

**No toques ninguna aserción.** Que los números sigan cuadrando es la prueba de que la mudanza no cambió comportamiento.

- [ ] **Step 3: Verificar** — Run: `npm test`. Esperado: **46 tests / 8 archivos verdes**. Y `npx tsc --noEmit` limpio.

Si algún test de `users.test.ts` o `roles.test.ts` falla por perfiles ausentes, la causa es la Task 4: revísala antes de tocar el test.

- [ ] **Step 4: Commit** (NO push):

```bash
git add tests/
git commit -m "test: la suite apunta al esquema kaze"
```
+ trailer.

---

### Task 6: Test de no-miembro (TDD) — el criterio de aceptación de seguridad

**Files:**
- Test: `tests/data/rls-no-miembro.test.ts`

Esta es la regresión que introduce compartir `auth.users`. Hoy no existe ninguna prueba que la detecte.

- [ ] **Step 1: Escribir el test** — `tests/data/rls-no-miembro.test.ts` EXACTAMENTE:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getProjectsList } from '@/lib/data/projects'
import { getProjectsSummary } from '@/lib/data/summary'

// Cliente ANON firmado como un usuario que existe en auth.users pero NO tiene
// fila en kaze.profiles: el equivalente a alguien del CMS. Debe ver CERO.
const db = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { db: { schema: 'kaze' }, auth: { persistSession: false } }
)
const HOY = new Date('2026-06-20T12:00:00Z')

beforeAll(async () => {
  const { error } = await db.auth.signInWithPassword({
    email: 'ajeno@cota.test', password: 'cota-demo-2026',
  })
  if (error) throw error
})

describe('un authenticated que NO es miembro de Kaze', () => {
  it('no lee ningún proyecto', async () => {
    const rows = await getProjectsList(db, HOY)
    expect(rows).toHaveLength(0)
  })

  it('obtiene un resumen en cero, no los datos de los clientes', async () => {
    const s = await getProjectsSummary(db, HOY)
    expect(s.total).toBe(0)
    expect(s.ahorroAnual).toBe(0)
    expect(s.nCasos).toBe(0)
  })

  it('tampoco puede escribir', async () => {
    const { error } = await db.from('clients').insert({ nombre: 'Intruso SA' })
    expect(error).not.toBeNull()
  })
})
```

- [ ] **Step 2: Correr — debe pasar** — Run: `npm test -- tests/data/rls-no-miembro.test.ts`. Esperado: 3 verdes.

**Si alguno falla, NO toques el test: es un agujero real de RLS.** Revisa la Task 2 y reporta.

- [ ] **Step 3: Probar que el test detecta el agujero** — verifica que no es un test decorativo. Abre temporalmente el gate:

```bash
docker exec supabase_db_cota psql -U postgres -d postgres -c "alter policy \"miembros_select\" on kaze.projects using (true);"
npm test -- tests/data/rls-no-miembro.test.ts
```
Esperado: **falla** el primer caso. Luego restaura:
```bash
docker exec supabase_db_cota psql -U postgres -d postgres -c "alter policy \"miembros_select\" on kaze.projects using (kaze.es_miembro());"
npm test -- tests/data/rls-no-miembro.test.ts
```
Esperado: verde de nuevo. **Reporta la salida de ambas corridas.**

- [ ] **Step 4: Suite completa** — Run: `npm test` → **49 tests / 9 archivos**. `npx tsc --noEmit` limpio.

- [ ] **Step 5: Commit** (NO push):

```bash
git add tests/data/rls-no-miembro.test.ts
git commit -m "test(rls): un authenticated sin membresía no lee ni escribe nada"
```
+ trailer.

---

### Task 7: `/admin` crea el perfil al invitar y admite correos ya existentes

**Files:**
- Modify: `lib/data/users.ts`
- Test: `tests/data/users.test.ts`

Dos cambios que el trigger tapaba: ahora el perfil lo crea la invitación, y un correo que ya existe en `auth.users` (alguien del CMS) debe poder ser invitado a Kaze en vez de ser rechazado.

- [ ] **Step 1: Escribir los tests que fallan** — añade al final de `tests/data/users.test.ts`:

```ts
describe('inviteUserCore con auth.users compartida', () => {
  it('crea la fila de profiles al invitar a alguien nuevo', async () => {
    const email = `nuevo-${Date.now()}@cota.test`
    const { userId } = await inviteUserCore(db, { email, nombre: 'Nueva Persona', rol: 'consultor' })
    const { data } = await db.from('profiles').select('nombre, rol').eq('id', userId).single()
    expect(data?.nombre).toBe('Nueva Persona')
    expect(data?.rol).toBe('consultor')
  })

  it('da acceso a un usuario que ya existe en auth.users sin crear otro', async () => {
    const { data: antes } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const ajeno = antes.users.find(u => u.email === 'ajeno@cota.test')!
    const { userId } = await inviteUserCore(db, {
      email: 'ajeno@cota.test', nombre: 'Ajeno Sin Acceso', rol: 'consultor',
    })
    expect(userId).toBe(ajeno.id)
    const { data } = await db.from('profiles').select('id').eq('id', ajeno.id).single()
    expect(data).not.toBeNull()
    // limpieza: devolver a ajeno a su estado de no-miembro para los otros tests
    await db.from('profiles').delete().eq('id', ajeno.id)
  })
})
```

- [ ] **Step 2: Correr — falla** — Run: `npm test -- tests/data/users.test.ts`. Esperado: los dos casos nuevos fallan (no se crea profile; el segundo lanza "ya existe un usuario").

- [ ] **Step 3: Reescribir `inviteUserCore`** — sustituye la función completa en `lib/data/users.ts` por:

```ts
export async function inviteUserCore(db: DB, input: { email: string; nombre: string; rol: RolInterno }) {
  if (!ROLES_INTERNOS.includes(input.rol)) throw new Error(`rol inválido en v1: ${input.rol} (solo admin/consultor)`)

  // auth.users se comparte con el CMS y el HUB: que el correo ya exista NO es un
  // error, solo significa que hay que darle membresía de Kaze sin crear cuenta.
  const { data: existing, error: lErr } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (lErr) throw lErr
  const yaExiste = existing.users.find(u => u.email?.toLowerCase() === input.email.toLowerCase())

  if (yaExiste) {
    const { data: perfil, error: pErr } = await db.from('profiles').select('id').eq('id', yaExiste.id).maybeSingle()
    if (pErr) throw pErr
    if (perfil) throw new Error(`${input.email} ya es miembro de Kaze`)
    const { error: iErr } = await db.from('profiles').insert({
      id: yaExiste.id, nombre: input.nombre, iniciales: iniciales(input.nombre), rol: input.rol,
    })
    if (iErr) throw iErr
    return { userId: yaExiste.id, tokenHash: null }
  }

  const { data, error } = await db.auth.admin.generateLink({
    type: 'invite',
    email: input.email,
    options: { data: { nombre: input.nombre, iniciales: iniciales(input.nombre) } },
  })
  if (error) throw error
  const userId = data.user!.id
  // Ya no hay trigger: el perfil lo crea la invitación.
  const { error: iErr } = await db.from('profiles').insert({
    id: userId, nombre: input.nombre, iniciales: iniciales(input.nombre), rol: input.rol,
  })
  if (iErr) throw iErr
  return { userId, tokenHash: data.properties!.hashed_token }
}
```

- [ ] **Step 4: Ajustar el consumidor del `tokenHash`** — `tokenHash` ahora puede ser `null` (caso "ya tenía cuenta": no hay enlace que copiar, la persona entra con su contraseña actual). Busca quién lo usa:

```bash
cd /c/Users/pauld/dev/cota && grep -rn "tokenHash" app/ lib/ --include=*.ts --include=*.tsx
```

En la página/acción de `/admin` que muestra el enlace, cuando `tokenHash` sea `null` muestra en su lugar el texto: `Ya tenía cuenta en el ecosistema Vento: ya puede entrar con su contraseña actual.` Ajusta los tipos para que `tokenHash: string | null` compile.

- [ ] **Step 5: Verificar** — Run: `npm test` → todo verde (51 tests / 9 archivos). `npx tsc --noEmit` limpio. `npm run build` verde.

- [ ] **Step 6: Commit** (NO push):

```bash
git add lib/data/users.ts tests/data/users.test.ts app/
git commit -m "feat(admin): la invitación crea el perfil y admite cuentas ya existentes"
```
+ trailer.

---

### Task 8: Cierre de la fase local

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Verificación completa desde cero** — Run, en este orden y en primer plano:

```bash
cd /c/Users/pauld/dev/cota && npx supabase db reset && npm run seed && npm test && npx tsc --noEmit && npm run build
```
Esperado: seed OK, 51/51 verdes, tsc sin salida, build verde.

- [ ] **Step 2: Documentar el esquema en `AGENTS.md`** — en "Peculiaridades del entorno", añadir:

```markdown
- **Las tablas viven en el esquema `kaze`, no en `public`.** Los clientes de
  `lib/supabase/*.ts` lo fijan con `db: { schema: 'kaze' }`, así que las queries de
  `lib/data/*.ts` se escriben igual (`db.from('projects')`). En SQL directo hay que
  cualificar: `select * from kaze.projects`. `public` pertenece al CMS en el proyecto
  compartido — no crear nada ahí.
- **Nada de triggers sobre `auth.users`.** El CMS tiene el suyo (`on_auth_user_created`)
  en el proyecto compartido y comparte nombre con el que Kaze tenía. La membresía se crea
  al invitar desde `/admin`, nunca automáticamente.
- **`kaze.es_miembro()`** decide quién ve algo. Sin fila en `kaze.profiles` no se lee nada,
  aunque el JWT sea válido. El test `tests/data/rls-no-miembro.test.ts` lo protege.
- **Los helpers `Tables<>`, `TablesInsert<>`, `Enums<>` de `lib/database.types.ts` NO sirven
  en su forma simple.** Se generan con `--schema kaze`, así que el tipo no tiene clave `public`
  y el `DefaultSchema` interno resuelve a `never`. Hoy nadie los usa; si algún día hacen falta,
  la forma correcta es explicitar el esquema: `Tables<{ schema: 'kaze' }, 'projects'>`.
- **`lib/supabase/middleware.ts` no lleva `db: { schema }` a propósito**: solo llama a
  `auth.getUser()` y nunca a `.from()`, y los endpoints de auth son independientes del esquema.
  No es un olvido.
```

- [ ] **Step 3: Commit** (NO push):

```bash
git add AGENTS.md
git commit -m "docs: esquema kaze, sin triggers en auth.users y regla de membresía"
```
+ trailer.

---

### Task 9: Aplicar en el proyecto compartido

**Files:** ninguno (operación sobre `nrysdnavawyhaqgruunl`).

⚠️ Primera tarea que toca algo fuera de local. Kaze en Vercel **sigue apuntando al proyecto viejo**, así que nadie se ve afectado todavía.

> **Ejecutada el 2026-09-21 — lo que cambió respecto a lo escrito:**
> - **El orden de los pasos 1 y 4 estaba al revés.** El desplegable de *Exposed schemas* (hoy en
>   Integrations → Data API, no en Settings → API) solo lista esquemas que **existen**; `kaze` no
>   aparece hasta que se aplica la migración. Se aplicó primero y se expuso después — que además es
>   más seguro: entre medias las tablas existen pero son inalcanzables desde la API.
> - **En vez del `db diff`** se usaron `migration list` (el remoto no tenía historial: el CMS y el HUB
>   se aplicaron a mano), `db push --dry-run` y un escaneo de patrones peligrosos. Todo limpio.
> - **Sorpresa: no había NINGÚN trigger sobre `auth.users`** en el proyecto compartido tras el push.
>   El `on_auth_user_created` del `schema.sql` del CMS no existe en el proyecto vivo. No lo quitamos
>   nosotros (el escaneo previo descartó cualquier `drop trigger` en nuestras migraciones), pero no se
>   tomó foto de antes del push — debió hacerse. Para Kaze no importa (no depende de ese trigger);
>   para el CMS puede significar que sus usuarios nuevos no reciben perfil.
> - **`anon` verificado bloqueado** (`permission denied for schema kaze`) pese a que el proyecto tiene
>   activado "Automatically expose new tables".
> - **El paso 6 se hizo con un script** que lee las claves del `.env.local` del HUB en tiempo de
>   ejecución (nunca pasaron por el chat) y aborta si el destino no es `nrysdnavawyhaqgruunl`. El HUB
>   nombra la clave `SUPABASE_SECRET_KEY`; los scripts de Kaze leen `SUPABASE_SERVICE_ROLE_KEY`.
> - **Resultado verificado:** 9 tablas, 34 policies, 3 proyectos, 3 clientes, 1 perfil (admin),
>   0 usuarios `@cota.test`, 0 miembros colgados.

- [ ] **Step 1 [USUARIO]: Exponer el esquema** — el agente PARA aquí y pide al usuario: en el dashboard de Supabase del proyecto `nrysdnavawyhaqgruunl` → Settings → API → **Exposed schemas**: añadir `kaze` a la lista (junto a `public` y `hub`). Confirmar antes de seguir.

- [ ] **Step 2: Enlazar el repo al proyecto compartido** — Run:

```bash
cd /c/Users/pauld/dev/cota && npx supabase link --project-ref nrysdnavawyhaqgruunl
```

- [ ] **Step 3: Verificar qué se va a aplicar ANTES de aplicarlo** — Run:

```bash
cd /c/Users/pauld/dev/cota && npx supabase db diff --linked --schema kaze
```
Revisa la salida y **confirma explícitamente que no menciona `public`, `auth`, `hub` ni ningún trigger sobre `auth.users`**. Si aparece cualquiera de esos, **PARA y reporta**: aplicarlo rompería el CMS.

- [ ] **Step 4: Aplicar** — Run: `npx supabase db push`.

- [ ] **Step 5: Verificar que el CMS sigue intacto** — este es el chequeo que justifica toda la §4.4 del spec. En el SQL Editor del dashboard (o con `npx supabase db execute`), correr:

```sql
select tgname, c.relname, n.nspname
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'auth' and c.relname = 'users' and not t.tgisinternal;
```
Esperado: **sigue existiendo `on_auth_user_created`**, el del CMS. Si desapareció, hay que recrearlo desde el schema del CMS **antes de seguir**: reporta de inmediato.

Y que el esquema llegó entero:
```sql
select count(*) from information_schema.tables where table_schema = 'kaze';
```
Esperado: 9.

- [ ] **Step 6 [USUARIO]: Sembrar los 3 casos y el admin** — el agente **no inventa contraseñas**: para antes de este paso y pide al usuario (a) la anon key y la service key del proyecto compartido, y (b) una contraseña fuerte para `SEED_PASSWORD`. Con `.env.local` apuntando temporalmente al proyecto compartido:

```bash
cd /c/Users/pauld/dev/cota && SEED_ONLY="A3-014,A3-012,A3-030" SEED_PASSWORD="$SEED_PASSWORD" npx tsx scripts/seed.ts
```

⚠️ El seed crea usuarios `@cota.test`. En el proyecto compartido **no queremos los 5 demo**. Tras sembrar, borrar los perfiles y usuarios demo y dejar solo el admin real. Comprobar primero qué creó:

```sql
select id, email from auth.users where email like '%@cota.test';
```

Y darle membresía al admin real, que **ya existe** en `auth.users` porque es una de las filas de `hub.staff`:

```sql
insert into kaze.profiles (id, nombre, iniciales, rol)
select id, 'Paul Díaz', 'PD', 'admin' from auth.users where email = 'info@ventosolutions.ca'
on conflict (id) do update set rol = 'admin';
```

- [ ] **Step 7: Verificar los datos** — en el SQL Editor:

```sql
select (select count(*) from kaze.projects) proyectos,
       (select count(*) from kaze.profiles) perfiles,
       (select count(*) from kaze.clients)  clientes;
```
Esperado: 3 proyectos, al menos 1 perfil (el admin real), y los clientes de esos 3 casos.

- [ ] **Step 8: Restaurar `.env.local` al stack local** y confirmar que `npm test` vuelve a dar 51 verdes contra local. **No commitear `.env.local` (está en `.gitignore`).**

---

### Task 10: Vercel y dominio — producción arreglada

**Files:** ninguno (operación sobre Vercel y Hostinger).

🎯 **Hito.** Al cerrar esta tarea, producción vuelve a funcionar.

- [x] **Step 1 [USUARIO]: Cambiar las env vars en Vercel** — proyecto `kaze`, scope `pauldvcoders-projects`, para Production y Preview:
  - `NEXT_PUBLIC_SUPABASE_URL` → `https://nrysdnavawyhaqgruunl.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → la anon key del proyecto compartido
  - `SUPABASE_SERVICE_ROLE_KEY` → la service key del proyecto compartido (**solo servidor, sin `NEXT_PUBLIC_`**)

- [x] **Step 2 [USUARIO]: Dominio** — añadir `kaze.ventosolutions.ca` al proyecto de Vercel y crear el registro DNS en Hostinger que Vercel indique. **Si Hostinger rechaza el nombre corto** (ya pasó con `hub`), usar `kazevento.ventosolutions.ca` y avisar al agente del nombre definitivo, que se usará en T11 y T13.

- [ ] **Step 3 [USUARIO]: Auth del proyecto compartido** — en Supabase → Authentication → URL Configuration: añadir el dominio nuevo a **Redirect URLs**. No cambiar el Site URL si ya apunta al HUB; añadir, no sustituir.

- [x] **Step 4: Desplegar** — Run:

```bash
cd /c/Users/pauld/dev/cota && git push origin main
```
Esto dispara el deploy. Confirmar con `npx vercel ls` que el último deployment queda `● Ready`.

- [x] **Step 5: Verificar producción** — sin sesión:

```bash
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" https://kaze.ventosolutions.ca/proyectos
```
Esperado: `307 -> https://kaze.ventosolutions.ca/login`.

Luego, **[USUARIO]** inicia sesión con `info@ventosolutions.ca` y confirma que `/proyectos` muestra los 3 A3 (A3-014, A3-012, A3-030) con la sidebar y el strip. El agente no introduce contraseñas.

---

### Task 11: Flip de cookies apex en los tres repos

**Files:**
- Modify: `lib/supabase/server.ts`, `lib/supabase/client.ts` (repo `cota`)
- Modify: los equivalentes en `C:\Users\pauld\dev\vento-hub` y en el repo del CMS

⚠️ Las sesiones vivas se cortan **una vez**, en las tres apps. Coordinar el momento con el usuario.

- [x] **Step 1: Leer cómo lo hace el HUB antes de tocar nada** — el HUB y el CMS ya comparten proyecto; revisa cómo construyen su cliente de servidor:

```bash
cat /c/Users/pauld/dev/vento-hub/src/lib/supabase/server.ts 2>/dev/null || find /c/Users/pauld/dev/vento-hub/src -name "*.ts" -path "*supabase*"
```
Reporta qué encontraste **antes** de escribir código: si el HUB ya fija un `cookieOptions.domain`, hay que igualarlo exactamente, no inventar otro.

- [x] **Step 2: Fijar el dominio de cookie en Kaze** — en `lib/supabase/server.ts`, añadir `cookieOptions` junto a `db`:

```ts
      db: { schema: 'kaze' },
      cookieOptions: { domain: '.ventosolutions.ca', sameSite: 'lax', secure: true },
```

Y en `lib/supabase/client.ts`:

```ts
    { db: { schema: 'kaze' }, cookieOptions: { domain: '.ventosolutions.ca', sameSite: 'lax', secure: true } }
```

⚠️ Con `domain: '.ventosolutions.ca'` y `secure: true`, **el login deja de funcionar en `localhost`**. Para no romper el desarrollo local, condiciona el dominio a producción:

```ts
const cookieDomain = process.env.NODE_ENV === 'production' ? '.ventosolutions.ca' : undefined
```
y pasa `cookieOptions: { domain: cookieDomain, sameSite: 'lax', secure: cookieDomain !== undefined }`.

- [x] **Step 3: Verificar local** — Run: `npm run build` y `npm test` (51 verdes). Levanta `npm run dev` en primer plano en un solo comando, comprueba que `/login` responde 200 y mátalo. El login local debe seguir funcionando: el dominio de cookie solo se fija en producción.

- [x] **Step 4: Aplicar el mismo cambio en HUB y CMS** — replica exactamente el mismo `cookieOptions` (mismo dominio, mismo `sameSite`, misma condición de `NODE_ENV`) en los otros dos repos, siguiendo el patrón que encontraste en el Step 1. **No los pushees todavía.**

- [x] **Step 5 [USUARIO]: Desplegar los tres juntos** — el agente PARA y coordina con el usuario. Los tres `git push` se hacen seguidos, y se espera a que los tres deployments queden `● Ready` antes de verificar. Una app a medio migrar deja sesiones inconsistentes.

- [x] **Step 6: Commit en cada repo** (el push lo autoriza el usuario en el Step 5):

```bash
git add lib/supabase/server.ts lib/supabase/client.ts
git commit -m "feat(auth): cookie de sesión en el apex ventosolutions.ca (SSO)"
```
+ trailer.

---

### Task 12: Verificar el SSO

**Files:** ninguno (verificación).

- [x] **Step 1 [USUARIO]: Sesión compartida** — con sesión ya iniciada en `hubvento.ventosolutions.ca`, navegar a `kaze.ventosolutions.ca/proyectos` y confirmar que **entra sin volver a autenticarse**. Repetir en sentido inverso y con el CMS.

- [ ] **Step 2 [USUARIO]: El no-miembro no entra** — iniciar sesión con una cuenta que exista en el CMS pero **no** tenga fila en `kaze.profiles`, y navegar a `kaze.ventosolutions.ca/proyectos`. Esperado: la pantalla carga pero **sin ningún proyecto** (el RLS devuelve cero filas). Este es el comportamiento correcto y la razón de ser de la Task 6.

- [x] **Step 3: Logout aislado** — confirmar que cerrar sesión en Kaze no arrastra la sesión del HUB de forma inesperada. Anotar el comportamiento observado: con cookie de apex compartida, es esperable que el logout afecte a las tres apps. **Documentarlo tal como resulte, sin maquillarlo.**

- [x] **Step 4: Reportar** el resultado paso a paso con evidencia. Si el SSO no funciona, diagnostica antes de tocar código: lo más probable es que una de las tres apps no haya desplegado el cambio, o que los `cookieOptions` no coincidan exactamente entre repos.

---

### Task 13: Tile en el lanzador del HUB

**Files:** ninguno (una sentencia SQL en el proyecto compartido).

- [x] **Step 1: Actualizar la fila existente** — la fila `improvement` ya existe en `hub.modules` con `url: null` y `status: 'development'`. En el SQL Editor del proyecto compartido:

```sql
update hub.modules
set url = 'https://kaze.ventosolutions.ca',
    name = 'Kaze',
    description = 'Mejoramiento de procesos · Cota',
    status = 'production'
where slug = 'improvement';
```

Usar el dominio definitivo del Step 2 de la Task 10 si acabó siendo el alterno.

- [x] **Step 2 [USUARIO]: Verificar** — abrir `hubvento.ventosolutions.ca` y confirmar que el tile de Kaze aparece, con su estado, y que lleva a la app.

---

### Task 14: Documentación y cierre

**Files:**
- Modify: `docs/superpowers/START-HERE.md`
- Modify: `docs/DEPLOY.md`

- [x] **Step 1: Actualizar `START-HERE.md`** — estado: migración completa. Registrar:
  - Kaze vive en `nrysdnavawyhaqgruunl`, esquema `kaze`, dominio definitivo.
  - La membresía la define `kaze.profiles`; `hub.staff` es solo la intranet.
  - Ningún trigger de Kaze sobre `auth.users`; el del CMS es intocable.
  - El proyecto viejo `kvjpxnswvlxzxdzgycbh` sigue **pausado** y pendiente de borrado deliberado, ya sin datos únicos.
  - Deuda anotada: `kaze.clients` y el Clients Core (`core`) de la Fase 2 del HUB son el mismo maestro de clientes y habrá que reconciliarlos.
  - Prompt de retomar apuntando al siguiente bloque: **diagramador BPMN**, cuya migración debe nacer ya en `kaze`.

- [x] **Step 2: Actualizar `docs/DEPLOY.md`** — proyecto Supabase nuevo, dominio nuevo, y las env vars de Vercel que ahora apuntan al proyecto compartido.

- [x] **Step 3: Commit y push**:

```bash
git add docs/
git commit -m "docs: Kaze migrado a esquema kaze con SSO del ecosistema Vento"
git push origin main
```
+ trailer.

- [ ] **Step 4:** El controlador despacha la revisión final del rango completo de la migración.

---

## Verificación final (DoD del spec)

- [x] Esquema `kaze` en `nrysdnavawyhaqgruunl`, en Exposed schemas, con las 9 tablas.
- [x] RLS gateado por `kaze.es_miembro()` y grants de Data API aplicados.
- [ ] Ningún trigger nuevo sobre `auth.users`; el `on_auth_user_created` del CMS verificado intacto **después** de aplicar.
- [x] Suite verde contra `kaze` (51 tests / 9 archivos); `npx tsc --noEmit` limpio; `npm run build` verde.
- [x] Test de no-miembro: cero filas y escritura rechazada — **y probado que detecta el agujero** (Task 6 Step 3).
- [x] `/admin` da de alta por invitación, incluido el caso "el correo ya existe en `auth.users`".
- [x] Kaze responde en su dominio definitivo contra el proyecto compartido, con los 3 A3 seed.
- [x] Sesión compartida verificada entre HUB y Kaze.
- [x] Tile `improvement` con URL y `status: 'production'`.
- [x] `AGENTS.md`, `START-HERE.md` y `DEPLOY.md` al día.
