-- 0004_admin_roles.sql — un usuario NO puede cambiar su propio rol.
-- La policy profiles_update_own (0002/0003) gatea POR FILA; estos grants gatean POR COLUMNA.
-- rol queda modificable solo vía service_role (server actions del módulo admin).
revoke update on public.profiles from authenticated;
grant update (nombre, iniciales) on public.profiles to authenticated;
