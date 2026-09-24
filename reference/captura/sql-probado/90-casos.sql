-- Casos (correr con psql, sin ON_ERROR_STOP: los errores esperados se imprimen).
insert into auth.users values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
insert into kaze.profiles (id, nombre, rol) values ('00000000-0000-0000-0000-000000000001', 'Carmen Vidal', 'admin');
insert into kaze.clients (id, nombre) values ('10000000-0000-0000-0000-000000000001', 'Despacho Andrade & Vega');
insert into kaze.projects (id, code, titulo, client_id) values ('20000000-0000-0000-0000-000000000001', 'A3-014', 'Reducir reprocesos', '10000000-0000-0000-0000-000000000001');

\echo '== 1. Miembro: crea y edita el proceso'
set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false) is not null as sesion;
insert into kaze.procesos (id, client_id, project_id, prefijo, documento, created_by)
values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'CBM',
  '{"nombre":"Conciliación bancaria mensual","codigoDoc":"PR-CON-01","versiones":{"asis":{"fases":[]},"tobe":null}}', '00000000-0000-0000-0000-000000000001');
select nombre, codigo, numero_asis, numero_tobe, rev from kaze.procesos;
\echo '-- rev condicional: el primero entra, el segundo (rev viejo) no toca filas'
update kaze.procesos set documento = jsonb_set(documento, '{objetivo}', '"A"'), rev = rev + 1, ultimo_guardado = '40000000-0000-0000-0000-000000000001' where id = '30000000-0000-0000-0000-000000000001' and rev = 0 returning rev;
update kaze.procesos set documento = jsonb_set(documento, '{objetivo}', '"B"'), rev = rev + 1 where id = '30000000-0000-0000-0000-000000000001' and rev = 0 returning rev;
select documento->>'objetivo' as objetivo, rev, ultimo_guardado, updated_at > created_at as toco_updated from kaze.procesos;
\echo '-- guardia de versión: jsonb compara sin importar el orden de las claves'
select documento->'versiones'->'asis' = '{"fases":[]}'::jsonb as igual from kaze.procesos;
\echo '-- ESPERADO permission denied: el miembro no cambia el número de versión'
update kaze.procesos set numero_asis = 2 where id = '30000000-0000-0000-0000-000000000001';
\echo '-- ESPERADO permission denied: el miembro no escribe evidencia de aprobación'
insert into kaze.aprobacion_solicitudes (proceso_id, version, numero, ronda, enlace_token, con_vobo, fotografia, remitente_nombre, remitente_correo)
values ('30000000-0000-0000-0000-000000000001', 'asis', 1, 1, 'tokX', true, '{}', 'Carmen', 'carmen@cota.test');
\echo '-- ESPERADO permission denied: el miembro no ejecuta las funciones (RPC)'
select kaze.aprobacion_retirar('00000000-0000-0000-0000-000000000000');
reset role;

\echo '== 2. Servidor (service_role): envía, responde y retira'
set role service_role;
insert into kaze.aprobacion_solicitudes (id, proceso_id, version, numero, ronda, enlace_token, con_vobo, fotografia, remitente_nombre, remitente_correo)
values ('50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'asis', 1, 1, 'tok1', true, '{}', 'Carmen', 'carmen@cota.test');
\echo '-- ESPERADO duplicate key: una sola solicitud abierta por versión'
insert into kaze.aprobacion_solicitudes (proceso_id, version, numero, ronda, enlace_token, con_vobo, fotografia, remitente_nombre, remitente_correo)
values ('30000000-0000-0000-0000-000000000001', 'asis', 1, 2, 'tok2', true, '{}', 'Carmen', 'carmen@cota.test');
insert into kaze.aprobacion_personas (id, solicitud_id, etapa, orden, contacto_num, nombre, codigo, codigo_hash)
values ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'vobo', 1, 1, 'Marta Ríos', 'CBM-01-P3GM', encode(sha256('CBM01P3GM'::bytea), 'hex'));
\echo '-- ESPERADO check: pedir cambios sin comentario'
update kaze.aprobacion_personas set decision = 'cambios' where id = '60000000-0000-0000-0000-000000000001';
\echo '-- respuesta condicional: una sola vez'
update kaze.aprobacion_personas set decision = 'aprobado', respondida_at = now(), via = 'enlace' where id = '60000000-0000-0000-0000-000000000001' and decision = 'pendiente' returning decision;
update kaze.aprobacion_personas set decision = 'cambios', comentario = 'x' where id = '60000000-0000-0000-0000-000000000001' and decision = 'pendiente' returning decision;
\echo '-- búsqueda por hash del código normalizado'
select nombre from kaze.aprobacion_personas where solicitud_id = '50000000-0000-0000-0000-000000000001' and codigo_hash = encode(sha256('CBM01P3GM'::bytea), 'hex');
insert into kaze.aprobacion_intentos (solicitud_id, ip_hash, ok) values ('50000000-0000-0000-0000-000000000001', 'h', false);
select kaze.aprobacion_retirar('50000000-0000-0000-0000-000000000001') as retirar, kaze.aprobacion_retirar('50000000-0000-0000-0000-000000000001') as otra_vez;
update kaze.procesos set numero_asis = numero_asis + 1 where id = '30000000-0000-0000-0000-000000000001' returning numero_asis;
reset role;

\echo '== 3. Miembro: lee la evidencia'
set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false) is not null as sesion;
select estado from kaze.aprobacion_solicitudes;
select count(*) as intentos_visibles from kaze.aprobacion_intentos;
reset role;

\echo '== 4. No miembro (autenticado sin perfil): nada'
set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false) is not null as sesion;
select (select count(*) from kaze.procesos) as procesos, (select count(*) from kaze.aprobacion_solicitudes) as solicitudes, (select count(*) from kaze.aprobacion_personas) as personas;
reset role;

\echo '== 5. anon: ESPERADO permission denied for schema kaze'
set role anon;
select count(*) from kaze.procesos;
reset role;

\echo '== 6. Borrados: restrict en el cliente, set null en el A3'
delete from kaze.clients where id = '10000000-0000-0000-0000-000000000001';
delete from kaze.projects where id = '20000000-0000-0000-0000-000000000001';
select project_id is null as sin_a3 from kaze.procesos;
