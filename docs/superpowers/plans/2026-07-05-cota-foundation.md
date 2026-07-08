# Cota · Fundación — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levantar el repo Next.js + Supabase del módulo Cota con esquema real (9 tablas), auth de equipo, capa de datos tipada, seed desde el prototipo, y una ruta `/proyectos` que lee los A3 desde Supabase.

**Architecture:** App Next.js 16 (App Router) + TypeScript. Supabase (Postgres + Auth) gestionado con la CLI y stack local (Docker) para desarrollo/test; proyecto Supabase alojado como destino de despliegue. Lecturas en Server Components vía una capa `lib/data/*` tipada; escrituras con Server Actions. Auth email+contraseña (solo invitación) con refresco de sesión en `middleware.ts`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS **v4** (tokens vía `@theme` en `globals.css`, sin `tailwind.config.ts`), `@supabase/ssr` + `@supabase/supabase-js`, Supabase CLI, Vitest, `tsx`.

**Spec de referencia:** `docs/superpowers/specs/2026-07-05-cota-foundation-design.md`

**Desviaciones respecto al spec (decididas al planear):**
- El **seed** se implementa como script TypeScript (`scripts/seed.ts`) en vez de `seed.sql` puro, porque crear usuarios de `auth.users` se hace de forma robusta con la Admin API de Supabase (service role), no con SQL crudo.
- Se usa **Supabase local (Docker)** para desarrollo y verificación; el proyecto alojado se conecta al final (paso del usuario).

---

## Progreso

- ✅ **Tasks 1, 3 HECHAS** (2026-07-05, `a647f5a`): scaffold `create-next-app` → **Next.js 16.2.10 + React 19.2.4 + Tailwind v4**, tokens de Cota y fuentes (Space Grotesk / Hanken) aplicados. `npm run build` verde. Nota: con Tailwind v4 los tokens quedaron en `app/globals.css` (`@theme`), no en `tailwind.config.ts`; ignora ese archivo del plan.
- ✅ **Task 2 HECHA** (2026-07-08, `8c8048d` + `735c6ad`): deps + vitest.config + scripts. Adición aprobada: **CLI `supabase` como devDependency** (no hay instalación global; usar `npx supabase`). *(El handoff del 07-05 la daba por hecha por error.)*
- ✅ **Task 4 HECHA** (2026-07-08, `99504ff`): `supabase init` + stack local corriendo. Adaptación aprobada: **puertos remapeados 543xx → 553xx** (el stack local de loro ocupa los default); `enable_signup = false` aplicado antes del primer `start`.
- ✅ **Task 5 HECHA** (2026-07-08, `3171691`): `0001_schema.sql` byte-idéntico al plan, aplicado y verificado (9 tablas, trigger, 5 índices). Verificaciones psql vía `docker exec supabase_db_cota` (no hay psql en el host).
- ⬜ **Tasks 6–14 PENDIENTES**. ⚠️ Nota para T6: además de RLS+policies, `0002_rls.sql` debe añadir **GRANTs de Data API** (`grant usage on schema public` + grants a `authenticated`/`service_role` + default privileges) — la CLI actual ya no expone tablas de `public` automáticamente; sin esto el seed (T8) y las queries (T10+) fallan.

---

## Mapa de archivos (qué crea/toca cada tarea)

```
cota/
  app/
    globals.css                     # T3  tokens Tailwind + fuentes
    layout.tsx                      # T3  fuentes next/font, <html lang="es">
    (auth)/login/page.tsx           # T12 formulario login
    (auth)/login/actions.ts         # T12 server action signInWithPassword
    (app)/proyectos/page.tsx        # T13 prueba de vida (lista A3)
  lib/
    supabase/server.ts              # T9  cliente servidor SSR
    supabase/client.ts              # T9  cliente navegador
    supabase/middleware.ts          # T9  refresco de sesión
    database.types.ts               # T7  tipos generados
    data/projects.ts                # T10 getProjects / getProjectByCode
    data/clients.ts                 # T10 getClients
  middleware.ts                     # T11 protege rutas
  supabase/
    config.toml                     # T4  supabase init
    migrations/0001_schema.sql      # T5  9 tablas + trigger
    migrations/0002_rls.sql         # T6  RLS + policies
  scripts/seed.ts                   # T8  seed desde el prototipo
  tests/data/projects.test.ts       # T10 test integración capa de datos
  vitest.config.ts                  # T2  config test
  tailwind.config.ts                # T3  tokens
  .env.local                        # T9  (no se commitea) URL + keys
  .env.local.example                # T9  plantilla
  README.md                         # T14 cómo correr
```

---

## Task 0: Prerequisitos (acciones del usuario — no código)

Estos pasos los ejecuta la persona una sola vez. No hay código; son checkboxes de setup. El resto del plan asume que están hechos.

- [ ] **Herramientas instaladas:** Node ≥ 20, `npm`, Docker Desktop (para Supabase local), y la Supabase CLI (`npm i -g supabase` o `scoop install supabase`). Verificar: `node -v`, `docker --version`, `supabase --version`.
- [ ] **(Diferible) Proyecto Supabase alojado:** crear un proyecto en https://supabase.com para el despliegue. Anotar `Project URL`, `anon key` y `service_role key` (Settings → API). Se puede hacer al final (Task 14); el desarrollo usa el stack local.
- [ ] Confirmar que Docker Desktop está **corriendo** antes de las tareas de esquema (T4+).

> **Nota:** Si no hay Docker, se puede trabajar contra el proyecto alojado directamente poniendo sus credenciales en `.env.local` (T9) y aplicando migraciones con `supabase db push`. El plan asume local por defecto.

---

## Task 1: Scaffold Next.js dentro del repo existente

El repo ya contiene `.git/`, `reference/`, `docs/`, `.gitignore`. `create-next-app` exige un directorio limpio, así que scaffolding en temporal y luego fusionar.

**Files:**
- Create: toda la estructura base de Next.js en la raíz del repo.

- [ ] **Step 1: Generar el scaffold en un temporal**

```bash
cd /c/Users/pauld/dev
npx create-next-app@latest cota-init \
  --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --no-turbopack
```
Aceptar los defaults restantes.

- [ ] **Step 2: Fusionar el scaffold en el repo (preservando .git/reference/docs)**

```bash
cd /c/Users/pauld/dev/cota-init
# copiar todo excepto .git y el .gitignore (ya existe uno en el repo)
cp -r app components* lib* public next.config.* tsconfig.json package.json package-lock.json \
      postcss.config.* tailwind.config.* eslint.config.* next-env.d.ts \
      /c/Users/pauld/dev/cota/ 2>/dev/null || true
# fusionar .gitignore del scaffold con el existente (append lo que falte)
cat .gitignore >> /c/Users/pauld/dev/cota/.gitignore
cd /c/Users/pauld/dev && rm -rf cota-init
```

- [ ] **Step 3: Instalar y verificar que levanta**

Run:
```bash
cd /c/Users/pauld/dev/cota && npm install && npm run build
```
Expected: build de Next.js exitoso (página default). Si `npm run dev` en `http://localhost:3000` muestra la landing de Next, correcto.

- [ ] **Step 4: Limpiar `.gitignore` duplicado**

Abrir `.gitignore`, quitar líneas repetidas (quedaron dos bloques al fusionar). Dejar un solo bloque coherente.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/pauld/dev/cota
git add -A && git commit -m "chore: scaffold Next.js 15 + TS + Tailwind"
```

---

## Task 2: Dependencias Supabase + Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Instalar dependencias**

```bash
cd /c/Users/pauld/dev/cota
npm install @supabase/supabase-js @supabase/ssr
npm install -D vitest tsx dotenv
```

- [ ] **Step 2: Crear `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: { ...process.env },
    testTimeout: 20000,
  },
})
```

- [ ] **Step 3: Añadir scripts a `package.json`**

En `"scripts"` agregar:
```json
"test": "vitest run",
"test:watch": "vitest",
"db:reset": "supabase db reset",
"db:types": "supabase gen types typescript --local > lib/database.types.ts",
"seed": "tsx scripts/seed.ts"
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: add supabase + vitest deps and scripts"
```

---

## Task 3: Tokens de diseño (Tailwind) + fuentes

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Tokens en `tailwind.config.ts`**

Reemplazar `theme.extend` con:
```ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        marca: '#F94202',       // naranja: solo marca/interacción
        tinta: '#111111',
        panel: '#ECEEF1',
        borde: '#DADEE2',
        apagado: '#6B7177',
        estado: {
          bien: '#0F7A45',      // verde
          alerta: '#B8860B',    // ámbar
          mal: '#C0392B',       // rojo
        },
      },
      fontFamily: {
        display: ['var(--font-space-grotesk)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-hanken)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 2: Fuentes en `app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Space_Grotesk, Hanken_Grotesk } from 'next/font/google'
import './globals.css'

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' })
const hanken = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-hanken' })

export const metadata: Metadata = {
  title: 'Cota · Mejoramiento de procesos',
  description: 'Sistema de gestión de proyectos de mejora lean',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${spaceGrotesk.variable} ${hanken.variable}`}>
      <body className="bg-panel text-tinta font-sans antialiased">{children}</body>
    </html>
  )
}
```

- [ ] **Step 3: `app/globals.css`** — dejar solo las directivas de Tailwind:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Verificar build**

Run: `npm run build`
Expected: build exitoso, sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: cota design tokens + fonts"
```

---

## Task 4: Inicializar Supabase local

**Files:**
- Create: `supabase/config.toml` (lo genera `supabase init`)

- [ ] **Step 1: Init**

```bash
cd /c/Users/pauld/dev/cota
supabase init
```
Aceptar defaults. No sobreescribir si pregunta por VS Code settings.

- [ ] **Step 2: Levantar el stack local**

Run: `supabase start`
Expected: imprime `API URL: http://127.0.0.1:54321`, `anon key`, `service_role key`, `DB URL`. **Anotar el anon key y service_role key locales** — se usan en `.env.local` (T9).

- [ ] **Step 3: Desactivar signup público (solo invitación)**

En `supabase/config.toml`, bajo `[auth]`, poner:
```toml
enable_signup = false
```
Esto cumple el requisito "solo por invitación" del spec (§6). Los usuarios se crean vía Admin API (el seed) o alta de admin. Aplicar con `supabase stop && supabase start` (o `supabase db reset`).

> **En el proyecto alojado** (Task 14): el equivalente es Dashboard → Authentication → Sign In / Providers → desactivar "Allow new users to sign up".

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: supabase init (local stack, signup off)"
```

---

## Task 5: Migración del esquema (9 tablas + trigger)

**Files:**
- Create: `supabase/migrations/0001_schema.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- 0001_schema.sql — esquema base del módulo Cota
create extension if not exists pgcrypto;

-- clients
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  sector text,
  iniciales text,
  estado text not null default 'activo',
  created_at timestamptz not null default now()
);

-- profiles (1-1 con auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  iniciales text,
  rol text not null default 'consultor' check (rol in ('admin','consultor','cliente')),
  created_at timestamptz not null default now()
);

-- trigger: crear profile al alta de usuario
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nombre, iniciales)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', new.email), coalesce(new.raw_user_meta_data->>'iniciales', ''));
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- projects (el A3, hub)
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  titulo text not null,
  client_id uuid references public.clients(id) on delete set null,
  estado text check (estado in ('nuevo','progreso','riesgo','cerrado')),
  fase text check (fase in ('definicion','ejecucion','cerrado')),
  consultor_id uuid references public.profiles(id) on delete set null,
  lider_id uuid references public.profiles(id) on delete set null,
  miembros uuid[] not null default '{}',
  fecha_inicio date,
  fecha_fin date,
  ahorro_anual numeric,
  avance_pasos int not null default 0,
  a3_content jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- kpis
create table public.kpis (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  nombre text not null,
  descripcion text,
  unidad text,
  base numeric,
  meta numeric,
  mejor_baja boolean not null default true,
  created_at timestamptz not null default now()
);

-- measurements
create table public.measurements (
  id uuid primary key default gen_random_uuid(),
  kpi_id uuid not null references public.kpis(id) on delete cascade,
  fecha date not null,
  valor numeric not null,
  ahorro numeric,
  created_at timestamptz not null default now()
);

-- business_cases
create table public.business_cases (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  project_id uuid references public.projects(id) on delete cascade,
  titulo text,
  capex numeric,
  opex_anual numeric,
  ahorro_bruto_anual numeric,
  tasa numeric,
  inicio date,
  fecha_limite date,
  created_at timestamptz not null default now()
);

-- expenses
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_case_id uuid not null references public.business_cases(id) on delete cascade,
  fecha date not null,
  concepto text,
  monto numeric not null,
  tipo text check (tipo in ('inicial','recurrente','nuevo')),
  created_at timestamptz not null default now()
);

-- actions (kanban PDCA)
create table public.actions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  titulo text not null,
  descripcion text,
  estado text check (estado in ('todo','doing','check','done')),
  prioridad text check (prioridad in ('alta','media','baja')),
  owner_id uuid references public.profiles(id) on delete set null,
  vence date,
  inversion boolean not null default false,
  created_at timestamptz not null default now()
);

-- action_notes
create table public.action_notes (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.actions(id) on delete cascade,
  fecha timestamptz not null default now(),
  autor_id uuid references public.profiles(id) on delete set null,
  texto text not null
);

create index on public.projects (client_id);
create index on public.kpis (project_id);
create index on public.measurements (kpi_id);
create index on public.actions (project_id);
create index on public.expenses (business_case_id);
```

- [ ] **Step 2: Aplicar y verificar**

Run: `supabase db reset`
Expected: aplica `0001_schema.sql` sin error.

- [ ] **Step 3: Verificar que las 9 tablas existen**

Run:
```bash
supabase db reset
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" -c "\dt public.*"
```
Expected: lista con `clients, profiles, projects, kpis, measurements, business_cases, expenses, actions, action_notes`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(db): schema migration — 9 tables + handle_new_user trigger"
```

---

## Task 6: Migración RLS + policies

**Files:**
- Create: `supabase/migrations/0002_rls.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- 0002_rls.sql — RLS: equipo interno lee/escribe todo; preparado para clientes
alter table public.clients        enable row level security;
alter table public.profiles       enable row level security;
alter table public.projects       enable row level security;
alter table public.kpis           enable row level security;
alter table public.measurements   enable row level security;
alter table public.business_cases enable row level security;
alter table public.expenses       enable row level security;
alter table public.actions        enable row level security;
alter table public.action_notes   enable row level security;

-- Tablas de negocio: cualquier usuario autenticado (equipo interno) tiene acceso total.
do $$
declare t text;
begin
  foreach t in array array[
    'clients','projects','kpis','measurements','business_cases','expenses','actions','action_notes'
  ] loop
    execute format($f$
      create policy "team_all_select" on public.%1$I for select to authenticated using (true);
      create policy "team_all_insert" on public.%1$I for insert to authenticated with check (true);
      create policy "team_all_update" on public.%1$I for update to authenticated using (true) with check (true);
      create policy "team_all_delete" on public.%1$I for delete to authenticated using (true);
    $f$, t);
  end loop;
end $$;

-- profiles: todos leen; cada quien edita solo su propia fila.
create policy "profiles_select_all" on public.profiles for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
```

- [ ] **Step 2: Aplicar y verificar**

Run: `supabase db reset`
Expected: aplica ambas migraciones sin error.

- [ ] **Step 3: Verificar RLS activo**

Run:
```bash
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" -c "select relname, relrowsecurity from pg_class where relname in ('projects','profiles') and relnamespace='public'::regnamespace;"
```
Expected: `relrowsecurity = t` para ambas.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(db): enable RLS + internal-team policies"
```

---

## Task 7: Generar tipos TypeScript

**Files:**
- Create: `lib/database.types.ts`

- [ ] **Step 1: Generar**

Run: `npm run db:types`
Expected: crea `lib/database.types.ts` con el tipo `Database` y las 9 tablas.

- [ ] **Step 2: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore(db): generate typescript types"
```

---

## Task 8: Seed desde el prototipo

Crea 5 usuarios de equipo (Admin API → el trigger crea sus `profiles`), luego inserta clientes, proyectos, KPIs+mediciones, casos+gastos y acciones. **Los valores canónicos viven en `reference/prototype/`**; abajo va la estructura completa y las filas base; completar las restantes desde las líneas citadas.

**Files:**
- Create: `scripts/seed.ts`

- [ ] **Step 1: Escribir `scripts/seed.ts`**

```ts
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!
const db = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })

// --- Consultores (auth users → trigger crea profiles) ---
const TEAM = [
  { iniciales: 'CV', nombre: 'Carmen Vidal',   email: 'carmen@cota.test' },
  { iniciales: 'DL', nombre: 'Diego López',    email: 'diego@cota.test' },
  { iniciales: 'MP', nombre: 'María Paz',       email: 'maria@cota.test' },
  { iniciales: 'JM', nombre: 'Javier Marín',    email: 'javier@cota.test' },
  { iniciales: 'RA', nombre: 'Rodrigo Andrade', email: 'rodrigo@cota.test' },
]

// --- Clientes (reference/prototype/Cota - Vista de Cliente.dc.html:412-427) ---
const CLIENTS = [
  { nombre: 'Despacho Andrade & Vega', sector: 'Servicios contables · Santiago', iniciales: 'AV' },
  { nombre: 'Logística Sur',           sector: 'Transporte y distribución',       iniciales: 'LS' },
  { nombre: 'Manufactura Délano',      sector: 'Manufactura industrial',          iniciales: 'MD' },
  { nombre: 'Clínica Norte',           sector: 'Salud · ambulatorio',             iniciales: 'CN' },
  { nombre: 'Retail Vega',             sector: 'Retail',                          iniciales: 'RV' },
]

// --- Proyectos A3 (reference/prototype/Cota - Lista de Proyectos.dc.html:337-360) ---
const PROJECTS = [
  { code: 'A3-014', titulo: 'Reducir reprocesos en conciliaciones', cliente: 'Despacho Andrade & Vega', estado: 'progreso' },
  { code: 'A3-009', titulo: 'Cierre mensual ágil',                  cliente: 'Despacho Andrade & Vega', estado: 'progreso' },
  { code: 'A3-021', titulo: 'Onboarding de clientes',               cliente: 'Logística Sur',           estado: 'riesgo' },
  { code: 'A3-018', titulo: 'Reducir mermas en bodega',             cliente: 'Logística Sur',           estado: 'progreso' },
  { code: 'A3-025', titulo: 'Setup de línea · SMED',                cliente: 'Manufactura Délano',      estado: 'progreso' },
  { code: 'A3-012', titulo: 'Defectos de empaque',                  cliente: 'Manufactura Délano',      estado: 'cerrado' },
  { code: 'A3-007', titulo: 'Tiempo de espera en admisión',         cliente: 'Clínica Norte',           estado: 'cerrado' },
  { code: 'A3-030', titulo: 'Quiebres de stock en tienda',          cliente: 'Retail Vega',             estado: 'nuevo' },
]

// --- KPIs con serie (reference/prototype/Cota - Indicadores Seguimiento.dc.html:307-360) ---
// serie = lecturas mensuales → filas en measurements (fecha mensual desde 2026-01-01).
const KPIS = [
  { code_a3: 'A3-014', nombre: 'Lead time de cierre',           unidad: 'd', base: 11,  meta: 5,   mejor_baja: true,  serie: [11,10.6,9.8,9.1,8.6,8.2] },
  { code_a3: 'A3-014', nombre: 'Declaraciones sin reproceso',   unidad: '%', base: 84,  meta: 97,  mejor_baja: false, serie: [84,85.6,87.1,88.9,90.2,91.4] },
  { code_a3: 'A3-014', nombre: 'Tiempo de respuesta',           unidad: 'h', base: 8.5, meta: 4,   mejor_baja: true,  serie: [8.5,7.4,6.8,6.5,6.4,6.3] },
  { code_a3: 'A3-021', nombre: 'Tiempo de alta de cliente',     unidad: 'd', base: 8.2, meta: 4,   mejor_baja: true,  serie: [8.2,8.5,8.4,8.8,9,9.4] },
  { code_a3: 'A3-018', nombre: 'Merma sobre inventario',        unidad: '%', base: 3.2, meta: 1.5, mejor_baja: true,  serie: [3.2,3,2.8,2.6,2.4,2.3] },
  // COMPLETAR k6, k7 desde las líneas 351+ del archivo citado (Tiempo de cambio de formato, etc.)
]

// --- Casos de negocio + gastos (reference/prototype/Cota - Casos de Negocio.dc.html:377-393) ---
const CASES = [
  { code: 'BC-07', code_a3: 'A3-014', titulo: 'Automatización del cuadre de bancos', capex: 18000, ahorro_bruto_anual: 32000, tasa: 0.12, inicio: '2026-04-01', fecha_limite: '2026-12-31' },
  { code: 'BC-09', code_a3: 'A3-025', titulo: 'Carro de cambio rápido pre-armado (SMED)', capex: null, ahorro_bruto_anual: null, tasa: null, inicio: null, fecha_limite: null },
  // COMPLETAR campos de BC-09 y gastos de ambos desde el archivo citado.
]

// --- Acciones (reference/prototype/Cota - Acciones Kanban.dc.html:334-347) ---
// Transcribir las 12 filas (code, titulo, cliente, code_a3, estado, prioridad, owner, inversion, desc).
const ACTIONS = [
  { code: 'AC-41', code_a3: 'A3-014', titulo: 'Estandarizar el checklist de conciliación', estado: 'doing', prioridad: 'alta', owner: 'DL', inversion: false },
  { code: 'AC-39', code_a3: 'A3-014', titulo: 'Validación poka-yoke al cargar asientos',   estado: 'doing', prioridad: 'media', owner: 'DL', inversion: true },
  // COMPLETAR AC-44, AC-37, AC-45, AC-52, AC-53, AC-48, AC-49, AC-57, AC-58, AC-33 desde el archivo citado.
]

async function main() {
  // 1) equipo
  const teamIds: Record<string, string> = {}
  for (const t of TEAM) {
    const { data, error } = await db.auth.admin.createUser({
      email: t.email, password: 'cota-demo-2026', email_confirm: true,
      user_metadata: { nombre: t.nombre, iniciales: t.iniciales },
    })
    if (error) throw error
    teamIds[t.iniciales] = data.user!.id
    await db.from('profiles').update({ nombre: t.nombre, iniciales: t.iniciales }).eq('id', data.user!.id)
  }

  // 2) clientes
  const { data: clientRows, error: cErr } = await db.from('clients').insert(CLIENTS).select()
  if (cErr) throw cErr
  const clientId = (nombre: string) => clientRows!.find(c => c.nombre === nombre)!.id

  // 3) proyectos
  const projInput = PROJECTS.map(p => ({
    code: p.code, titulo: p.titulo, estado: p.estado,
    client_id: clientId(p.cliente),
    consultor_id: teamIds['CV'], lider_id: teamIds['RA'], miembros: [teamIds['DL'], teamIds['JM']],
  }))
  const { data: projRows, error: pErr } = await db.from('projects').insert(projInput).select()
  if (pErr) throw pErr
  const projId = (code: string) => projRows!.find(p => p.code === code)!.id

  // 4) kpis + measurements
  for (const k of KPIS) {
    const { data: kpiRow, error: kErr } = await db.from('kpis').insert({
      project_id: projId(k.code_a3), nombre: k.nombre, unidad: k.unidad,
      base: k.base, meta: k.meta, mejor_baja: k.mejor_baja,
    }).select().single()
    if (kErr) throw kErr
    const meas = k.serie.map((valor, i) => ({
      kpi_id: kpiRow.id, valor,
      fecha: `2026-${String(i + 1).padStart(2, '0')}-01`, // 2026-01-01 … (serie mensual)
    }))
    const { error: mErr } = await db.from('measurements').insert(meas)
    if (mErr) throw mErr
  }

  // 5) casos + gastos
  for (const bc of CASES) {
    const { error } = await db.from('business_cases').insert({
      code: bc.code, project_id: projId(bc.code_a3), titulo: bc.titulo,
      capex: bc.capex, ahorro_bruto_anual: bc.ahorro_bruto_anual, tasa: bc.tasa,
      inicio: bc.inicio, fecha_limite: bc.fecha_limite,
    })
    if (error) throw error
  }

  // 6) acciones
  const actInput = ACTIONS.map(a => ({
    code: a.code, project_id: projId(a.code_a3), titulo: a.titulo,
    estado: a.estado, prioridad: a.prioridad, owner_id: teamIds[a.owner], inversion: a.inversion,
  }))
  const { error: aErr } = await db.from('actions').insert(actInput)
  if (aErr) throw aErr

  console.log('Seed OK')
}
main().catch(e => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Completar los datos faltantes**

Transcribir las filas marcadas `COMPLETAR` (k6/k7, campos de BC-09 + gastos, las 10 acciones restantes) desde los archivos citados en `reference/prototype/`. No inventar valores.

- [ ] **Step 3: Ejecutar el seed (requiere `.env.local` de T9)**

> Este paso depende de Task 9 (`.env.local`). Si se ejecuta el plan en orden, hacer T9 antes de correr el seed. El resto de T8 (escribir el script) no depende de T9.

Run: `supabase db reset && npm run seed`
Expected: imprime `Seed OK`.

- [ ] **Step 4: Verificar conteos**

Run:
```bash
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" -c "select (select count(*) from clients) clients, (select count(*) from projects) projects, (select count(*) from profiles) profiles, (select count(*) from actions) actions;"
```
Expected: `clients=5, projects=8, profiles=5, actions=12`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: seed script from prototype data"
```

---

## Task 9: Clientes Supabase + variables de entorno

**Files:**
- Create: `.env.local`, `.env.local.example`, `lib/supabase/server.ts`, `lib/supabase/client.ts`

- [ ] **Step 1: `.env.local` (local — NO commitear)**

Usar los valores locales que imprimió `supabase start` (T4):
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key local>
SUPABASE_SERVICE_ROLE_KEY=<service_role key local>
```

- [ ] **Step 2: `.env.local.example` (SÍ commitear)**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 3: `lib/supabase/server.ts`**

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

- [ ] **Step 4: `lib/supabase/client.ts`**

```ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 5: Verificar que `.env.local` está ignorado**

Run: `git status --porcelain | grep .env.local` → **no debe** aparecer `.env.local` (solo `.env.local.example`). El `.gitignore` ya ignora `.env*.local`.

- [ ] **Step 6: Commit**

```bash
git add lib/supabase/server.ts lib/supabase/client.ts .env.local.example
git commit -m "feat: supabase server + browser clients"
```

---

## Task 10: Capa de datos + test de integración

TDD: el test corre contra el Supabase local **ya seedeado** (T8). Escribir el test primero.

**Files:**
- Create: `tests/data/projects.test.ts`, `lib/data/projects.ts`, `lib/data/clients.ts`

- [ ] **Step 1: Test que falla — `tests/data/projects.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getProjects, getProjectByCode } from '@/lib/data/projects'

// service-role client para tests (salta RLS; valida datos, no permisos)
const db = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

describe('data/projects', () => {
  it('getProjects devuelve los 8 A3 del seed', async () => {
    const rows = await getProjects(db)
    expect(rows).toHaveLength(8)
    expect(rows.map(r => r.code)).toContain('A3-014')
  })

  it('getProjectByCode trae un A3 con su cliente', async () => {
    const p = await getProjectByCode(db, 'A3-014')
    expect(p?.titulo).toMatch(/conciliaciones/i)
    expect(p?.client?.nombre).toBe('Despacho Andrade & Vega')
  })
})
```

- [ ] **Step 2: Correr el test — debe fallar**

Run: `npm test -- tests/data/projects.test.ts`
Expected: FALLA con "Cannot find module '@/lib/data/projects'" o similar.

- [ ] **Step 3: Implementar `lib/data/projects.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

type DB = SupabaseClient<Database>

export async function getProjects(db: DB) {
  const { data, error } = await db
    .from('projects')
    .select('id, code, titulo, estado, ahorro_anual, client:clients(id, nombre, iniciales)')
    .order('code')
  if (error) throw error
  return data
}

export async function getProjectByCode(db: DB, code: string) {
  const { data, error } = await db
    .from('projects')
    .select('*, client:clients(id, nombre, iniciales)')
    .eq('code', code)
    .maybeSingle()
  if (error) throw error
  return data
}
```

- [ ] **Step 4: Implementar `lib/data/clients.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

export async function getClients(db: SupabaseClient<Database>) {
  const { data, error } = await db.from('clients').select('*').order('nombre')
  if (error) throw error
  return data
}
```

- [ ] **Step 5: Correr el test — debe pasar**

Run: `npm test -- tests/data/projects.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(data): projects + clients data layer with integration tests"
```

---

## Task 11: Middleware de sesión (protege rutas)

**Files:**
- Create: `lib/supabase/middleware.ts`, `middleware.ts`

- [ ] **Step 1: `lib/supabase/middleware.ts`**

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  if (!user && !path.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  return response
}
```

- [ ] **Step 2: `middleware.ts` (raíz)**

```ts
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 3: Verificar redirección sin sesión**

Run: `npm run dev`, abrir `http://localhost:3000/proyectos` en incógnito.
Expected: redirige a `/login` (aún sin página → 404 de `/login` es esperado hasta T12; lo importante es que redirige, no que muestre `/proyectos`).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(auth): session middleware protecting routes"
```

---

## Task 12: Página de login + server action

**Files:**
- Create: `app/(auth)/login/page.tsx`, `app/(auth)/login/actions.ts`

- [ ] **Step 1: `app/(auth)/login/actions.ts`**

```ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email')),
    password: String(formData.get('password')),
  })
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`)
  redirect('/proyectos')
}
```

- [ ] **Step 2: `app/(auth)/login/page.tsx`**

```tsx
import { login } from './actions'

export default async function LoginPage({
  searchParams,
}: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  return (
    <main className="min-h-screen grid place-items-center bg-panel">
      <form action={login} className="w-80 bg-white border border-borde rounded-lg p-8 space-y-4">
        <h1 className="font-display text-xl font-bold">Cota</h1>
        <input name="email" type="email" required placeholder="Correo"
               className="w-full border border-borde rounded-md px-3 py-2 text-sm" />
        <input name="password" type="password" required placeholder="Contraseña"
               className="w-full border border-borde rounded-md px-3 py-2 text-sm" />
        {error && <p className="text-estado-mal text-xs">{error}</p>}
        <button className="w-full bg-tinta text-white rounded-md py-2 text-sm font-semibold">
          Entrar
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 3: Verificar login**

Run: `npm run dev`, ir a `/login`, entrar con `carmen@cota.test` / `cota-demo-2026` (creado en el seed).
Expected: redirige a `/proyectos`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(auth): login page + server action"
```

---

## Task 13: Prueba de vida — `/proyectos` desde Supabase

**Files:**
- Create: `app/(app)/proyectos/page.tsx`

- [ ] **Step 1: `app/(app)/proyectos/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { getProjects } from '@/lib/data/projects'

export default async function ProyectosPage() {
  const supabase = await createClient()
  const projects = await getProjects(supabase)

  return (
    <main className="p-10">
      <h1 className="font-display text-2xl font-bold mb-6">Proyectos A3</h1>
      <ul className="space-y-2">
        {projects.map((p) => (
          <li key={p.id} className="bg-white border border-borde rounded-lg px-4 py-3 flex gap-3">
            <span className="font-mono text-sm text-marca">{p.code}</span>
            <span className="text-sm">{p.titulo}</span>
            <span className="text-xs text-apagado ml-auto">{p.client?.nombre}</span>
          </li>
        ))}
      </ul>
    </main>
  )
}
```

- [ ] **Step 2: Verificar de punta a punta**

Run: `npm run dev`, login, llegar a `/proyectos`.
Expected: lista de **8 A3** (A3-014 … A3-030) con su cliente, **leídos desde Supabase**. Refrescar la página mantiene la sesión y los datos.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: /proyectos proof-of-life reading A3 from Supabase"
```

---

## Task 14: README + conexión al proyecto alojado (paso del usuario)

**Files:**
- Create: `README.md`

- [ ] **Step 1: `README.md`**

```markdown
# Cota · Mejoramiento de procesos

App Next.js + Supabase para gestionar proyectos de mejora lean (A3) de Cota.

## Desarrollo local
1. `npm install`
2. Docker Desktop corriendo → `supabase start`
3. Copiar los keys locales a `.env.local` (ver `.env.local.example`)
4. `supabase db reset && npm run seed`
5. `npm run dev` → http://localhost:3000 (login: carmen@cota.test / cota-demo-2026)

## Desplegar al proyecto alojado
1. Crear proyecto en supabase.com; poner sus keys en el entorno de producción.
2. `supabase link --project-ref <ref>` y `supabase db push` (aplica migraciones).
3. Correr el seed contra el alojado (opcional) apuntando `.env.local` a sus keys.

Estructura: `app/` (rutas), `lib/data/` (acceso a datos), `supabase/migrations/` (esquema),
`reference/prototype/` (prototipo .dc.html = especificación visual).
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "docs: README with local + hosted setup"
```

- [ ] **Step 3 (usuario): Conectar el proyecto alojado**

Cuando quiera desplegar: crear el proyecto Supabase, `supabase link`, `supabase db push`. Este paso no puede automatizarse desde una sesión no interactiva.

---

## Verificación final (Definition of Done del spec)

- [ ] `npm run dev` levanta sin errores.
- [ ] `supabase start` + `supabase db reset` aplican esquema + RLS.
- [ ] `npm run seed` carga 5 clientes, 5 consultores, 8 A3, KPIs+mediciones, casos+gastos, 12 acciones.
- [ ] `npm test` pasa (capa de datos).
- [ ] `/login` autentica al equipo; `/proyectos` está protegida.
- [ ] `/proyectos` lista los 8 A3 leídos desde Supabase.
- [ ] `npx tsc --noEmit` sin errores.
