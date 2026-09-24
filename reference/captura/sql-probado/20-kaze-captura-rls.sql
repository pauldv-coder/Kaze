-- RLS, grants por columna y una función de ejemplo (§4.2 del spec).
alter table kaze.procesos               enable row level security;
alter table kaze.aprobacion_solicitudes enable row level security;
alter table kaze.aprobacion_personas    enable row level security;
alter table kaze.aprobacion_intentos    enable row level security;

-- procesos: los miembros leen, crean, editan y borran (el editor usa el cliente de sesión)...
create policy "miembros_select" on kaze.procesos for select to authenticated using (kaze.es_miembro());
create policy "miembros_insert" on kaze.procesos for insert to authenticated with check (kaze.es_miembro());
create policy "miembros_update" on kaze.procesos for update to authenticated using (kaze.es_miembro()) with check (kaze.es_miembro());
create policy "miembros_delete" on kaze.procesos for delete to authenticated using (kaze.es_miembro());
-- ...pero NO tocan los números de versión: solo funciones del servidor.
revoke insert, update on kaze.procesos from authenticated;
grant insert (id, client_id, project_id, prefijo, documento, rev, ultimo_guardado, created_by, updated_by) on kaze.procesos to authenticated;
grant update (client_id, project_id, prefijo, documento, rev, ultimo_guardado, updated_by) on kaze.procesos to authenticated;

-- Evidencia de aprobación: los miembros solo leen.
create policy "miembros_select" on kaze.aprobacion_solicitudes for select to authenticated using (kaze.es_miembro());
create policy "miembros_select" on kaze.aprobacion_personas    for select to authenticated using (kaze.es_miembro());
revoke insert, update, delete on kaze.aprobacion_solicitudes, kaze.aprobacion_personas from authenticated;
revoke all on kaze.aprobacion_intentos from authenticated;

-- Función de ejemplo: el patrón de todas las de §4.2 (bloqueo + validación bajo el bloqueo).
create function kaze.aprobacion_retirar(p_solicitud uuid) returns text
  language plpgsql security invoker set search_path = kaze, pg_temp
as $$
declare v_estado text;
begin
  select estado into v_estado from kaze.aprobacion_solicitudes where id = p_solicitud for update;
  if v_estado is null then return 'no_existe'; end if;
  if v_estado <> 'revision' then return 'no_abierta'; end if;
  update kaze.aprobacion_solicitudes set estado = 'retirada', cerrada_at = now() where id = p_solicitud;
  return 'ok';
end $$;
-- Los alter default privileges de 20260920000002 le dieron EXECUTE a authenticated: se quita.
revoke execute on function kaze.aprobacion_retirar(uuid) from public, authenticated;
grant execute on function kaze.aprobacion_retirar(uuid) to service_role;
