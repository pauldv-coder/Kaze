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
