-- Migración propuesta (§4.1 del spec).
create table kaze.procesos (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references kaze.clients(id) on delete restrict,
  project_id      uuid references kaze.projects(id) on delete set null,
  prefijo         text not null check (prefijo ~ '^[A-Z0-9]{2,4}$'),   -- va en los códigos (§5.6)
  documento       jsonb not null,                                      -- §4.3 (sin números de versión)
  numero_asis     integer not null default 1 check (numero_asis > 0),  -- solo lo cambian funciones (§4.2)
  numero_tobe     integer check (numero_tobe > 0),                     -- null = no hay To-Be
  rev             integer not null default 0,                          -- concurrencia (§5.3)
  ultimo_guardado uuid,                                                -- id del último guardado (§5.3)
  nombre          text generated always as (documento->>'nombre') stored,
  codigo          text generated always as (documento->>'codigoDoc') stored,
  created_by      uuid references kaze.profiles(id) on delete set null,
  updated_by      uuid references kaze.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table kaze.aprobacion_solicitudes (
  id               uuid primary key default gen_random_uuid(),
  proceso_id       uuid not null references kaze.procesos(id) on delete cascade,
  version          text not null check (version in ('asis','tobe')),
  numero           integer not null check (numero > 0),
  ronda            integer not null check (ronda > 0),
  enlace_token     text not null unique,               -- ≥128 bits aleatorios (§6.5)
  estado           text not null default 'revision'
                   check (estado in ('revision','aprobada','cambios','retirada')),
  con_vobo         boolean not null,
  fotografia       jsonb not null,                     -- §6.4
  diagrama_svg     text,                               -- saneado; se muestra solo como <img> data: (§6.5)
  remitente_nombre text not null,
  remitente_correo text not null,
  enviada_por      uuid references kaze.profiles(id) on delete set null,
  enviada_at       timestamptz not null default now(),
  cerrada_at       timestamptz,
  unique (proceso_id, version, numero, ronda)
);
-- A lo sumo una solicitud abierta por proceso y versión.
create unique index aprobacion_una_abierta
  on kaze.aprobacion_solicitudes (proceso_id, version) where estado = 'revision';

create table kaze.aprobacion_personas (
  id             uuid primary key default gen_random_uuid(),
  solicitud_id   uuid not null references kaze.aprobacion_solicitudes(id) on delete cascade,
  etapa          text not null check (etapa in ('vobo','final')),
  orden          integer not null,
  contacto_num   integer not null,                    -- el NN del código
  nombre         text not null,
  cargo          text,
  area           text,
  correo         text,
  codigo         text not null,                       -- tal como se envió (para rearmar el correo)
  codigo_hash    text not null,                       -- sha256 del código normalizado (para buscar)
  decision       text not null default 'pendiente'
                 check (decision in ('pendiente','aprobado','cambios')),
  comentario     text check (comentario is null or length(comentario) <= 4000),
  respondida_at  timestamptz,
  via            text check (via in ('enlace','manual')),
  registrada_por uuid references kaze.profiles(id) on delete set null,
  unique (solicitud_id, contacto_num),
  check (decision <> 'cambios' or length(trim(coalesce(comentario, ''))) > 0)
);

-- Intentos de código en la página pública (límite por IP y por solicitud, §6.5).
create table kaze.aprobacion_intentos (
  id           bigint generated always as identity primary key,
  solicitud_id uuid not null references kaze.aprobacion_solicitudes(id) on delete cascade,
  ip_hash      text not null,                         -- sha256(ip + sal del servidor); nunca la IP en claro
  ok           boolean not null,
  created_at   timestamptz not null default now()
);

create index on kaze.procesos (client_id);
create index on kaze.procesos (project_id);
create index on kaze.aprobacion_solicitudes (proceso_id);
create index on kaze.aprobacion_personas (solicitud_id);
create index on kaze.aprobacion_intentos (solicitud_id, created_at);

create trigger trg_procesos_updated
  before update on kaze.procesos
  for each row execute function kaze.touch_updated_at();
