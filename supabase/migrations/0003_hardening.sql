-- 0003_hardening.sql — índices FK, revokes de anon, updated_at, higiene de API
-- (recomendaciones de revisión de 0001/0002; tablas aún vacías = momento barato)

-- 1) Índices para los 6 FK que quedaron sin indexar en 0001
create index if not exists action_notes_action_id_idx     on public.action_notes (action_id);
create index if not exists action_notes_autor_id_idx      on public.action_notes (autor_id);
create index if not exists actions_owner_id_idx           on public.actions (owner_id);
create index if not exists business_cases_project_id_idx  on public.business_cases (project_id);
create index if not exists projects_consultor_id_idx      on public.projects (consultor_id);
create index if not exists projects_lider_id_idx          on public.projects (lider_id);

-- 2) anon no debe conservar los privilegios residuales del ACL base
--    (TRUNCATE ignora RLS; MAINTAIN es el privilegio nuevo de PG17)
revoke truncate, references, trigger, maintain on all tables in schema public from anon;
alter default privileges in schema public revoke truncate, references, trigger, maintain on tables from anon;

-- 3) profiles_update_own con (select auth.uid()): InitPlan cacheado por statement;
--    convención recomendada por el Advisor de Supabase
drop policy "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- 4) updated_at automático en projects (el Editor A3 hará updates de a3_content)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- 5) handle_new_user no debe estar expuesto como RPC (EXECUTE implícito a PUBLIC)
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.set_updated_at() from public;
