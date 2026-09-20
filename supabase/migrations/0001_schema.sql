-- 0001_schema.sql — esquema kaze (mudanza desde public del proyecto kvjpxnswvlxzxdzgycbh)
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
