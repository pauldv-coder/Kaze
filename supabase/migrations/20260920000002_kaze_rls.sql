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
