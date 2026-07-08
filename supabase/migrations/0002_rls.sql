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

-- GRANTs de la Data API: las tablas creadas por migraciones son propiedad de postgres,
-- y los default ACLs de Supabase no les otorgan CRUD a los roles de la API.
-- Sin esto, incluso service_role recibe "permission denied" (RLS es un gate aparte).
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

-- Y para tablas de migraciones futuras (los default privileges aplican al rol postgres,
-- que es quien ejecuta las migraciones):
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;
