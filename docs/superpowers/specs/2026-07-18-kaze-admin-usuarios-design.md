# Kaze · Módulo de administración de usuarios — Design Doc

Fecha: 2026-07-18 · Estado: **aprobado por el usuario** (brainstorming en sesión)
Prerequisito de: sub-proyecto 2 (Lista de Proyectos) — este módulo va PRIMERO.

## 1. Contexto y problema

Kaze está en producción (BD `kvjpxnswvlxzxdzgycbh` + frontend en Vercel) con 5 usuarios
demo sembrados que comparten una contraseña que ya circuló por chat. No hay forma de dar
acceso a usuarios reales sin tocar código. Se necesita que un administrador pueda
**parametrizar accesos** (invitar, asignar rol, desactivar) desde la propia app.

Decisión de arquitectura de identidad (conversada):
- **Hostinger NO es proveedor de identidad** (no hay OAuth). Su rol: buzones de correo de
  los usuarios + SMTP para envío (v1.1). La identidad vive en el Supabase Auth de Kaze.
- Los usuarios de Kaze pertenecen al **tenant de Cota** (consultores; luego clientes).
  NO se autentican contra el HUB de Vento. El HUB podrá administrarlos a futuro
  ("Clients Core", Fase 2+ del HUB) consumiendo la misma Admin API — fuera de alcance aquí.

## 2. Decisiones cerradas (respuestas del usuario)

1. **Primer admin:** `info@ventosolutions.ca` (correo Vento en Hostinger), creado por
   script de bootstrap con contraseña temporal fuerte.
2. **Usuarios demo en producción:** **BORRARLOS** al hacer el bootstrap. Consecuencia
   aceptada: los FKs de los 3 casos seed (consultor_id, lider_id, owner_id, autor_id)
   quedan `null` y `miembros` conserva UUIDs colgantes; `/proyectos` no los muestra, no
   se rompe nada visible. El stack LOCAL no cambia (mantiene los 5 demo + seed completo).
3. **Alcance v1: solo roles internos** (`admin`, `consultor`). El rol `cliente` queda
   bloqueado en UI y server actions hasta que exista RLS por-cliente (sub-proyecto Vista
   de Cliente). Motivo: con el RLS actual "equipo total", cualquier autenticado ve todo.

## 3. Hallazgo de seguridad que este módulo corrige (migración 0004)

La policy `profiles_update_own` (0002) permite a un usuario editar su propia fila
**incluida la columna `rol`** → un consultor podría auto-promoverse a admin vía Data API.
Hoy inofensivo (nada gatea por rol); con `/admin` sería exploit directo.

**Fix — `supabase/migrations/0004_admin_roles.sql`:** grants a nivel de columna:

```sql
revoke update on public.profiles from authenticated;
grant update (nombre, iniciales) on public.profiles to authenticated;
-- rol solo es modificable vía service_role (server actions del módulo admin).
-- La policy profiles_update_own queda igual (sigue gateando POR FILA); el grant gatea POR COLUMNA.
```

Verificación obligatoria en tests: un `authenticated` puede actualizar su `nombre` pero
recibe `permission denied` al intentar actualizar su `rol`.

## 4. Arquitectura

### Rutas nuevas (App Router)

| Ruta | Tipo | Acceso | Función |
|---|---|---|---|
| `/admin` | page (server) | solo `rol='admin'` | Lista de usuarios + form invitar + acciones |
| `/auth/confirm` | route handler | público (token) | Canjea `token_hash` de invitación/recovery (`verifyOtp`) y redirige a `/cuenta/contrasena` |
| `/cuenta/contrasena` | page (server + action) | autenticado | Establecer/cambiar la propia contraseña (`auth.updateUser`) |

- **Gate de `/admin`:** el proxy ya exige sesión; además `app/(app)/admin/layout.tsx` (o
  la page) lee el profile propio y si `rol !== 'admin'` → `redirect('/proyectos')`. Las
  **server actions re-verifican** el rol server-side (el gate de UI no es seguridad).
- **Cliente admin:** `lib/supabase/admin.ts` — `createClient` con
  `SUPABASE_SERVICE_ROLE_KEY`, **solo importable desde código de servidor** (marcar con
  `import 'server-only'`). En Vercel la key se configura como env var de servidor (sin
  `NEXT_PUBLIC_`). Se actualiza la nota de AGENTS/DEPLOY: la regla pasa de "nunca en
  Vercel" a "**nunca como variable pública ni importada por código de cliente**".

### Capa de datos y acciones

- `lib/data/users.ts` — `getUsers(adminDb)`: lista combinando `auth.admin.listUsers()`
  (email, last_sign_in_at, banned) + `profiles` (nombre, iniciales, rol).
- `app/(app)/admin/actions.ts` — server actions (todas verifican rol admin primero):
  - `inviteUser(email, nombre, rol)` — rol ∈ {admin, consultor} (validado server-side);
    `admin.generateLink({ type: 'invite', ... })` con `user_metadata: {nombre}`;
    el trigger `handle_new_user` crea el profile; luego update de `rol` si es admin.
    **Devuelve el action_link para COPIAR** (v1 sin SMTP). Manejo de duplicado: error claro.
  - `setRole(userId, rol)` — rol ∈ {admin, consultor}; no permite quitarse el admin a sí
    mismo si es el último admin (regla anti-lockout: contar admins antes de degradar).
  - `deactivateUser(userId)` / `reactivateUser(userId)` — `admin.updateUserById` con
    `ban_duration: '876000h'` (desactivar, ~100 años) / `'none'` (reactivar) — patrón ban
    de Supabase. No permite desactivarse a sí mismo.
- La página `/admin` muestra el resultado de invitar con el **enlace generado y botón
  copiar** + aviso "mándalo tú por correo/WhatsApp; caduca según config del proyecto".

### Flujo de invitación (v1, sin SMTP)

1. Admin llena email+nombre+rol en `/admin` → server action `inviteUser`.
2. `generateLink(type:'invite')` crea el usuario (trigger crea profile) y devuelve link
   `https://<supabase-url>/auth/v1/verify?token=...&type=invite&redirect_to=<SITE_URL>/auth/confirm`.
3. Admin copia el link y lo envía por su canal.
4. Invitado abre el link → Supabase verifica → redirige a `/auth/confirm` → sesión creada
   → `/cuenta/contrasena` para establecer contraseña → entra a `/proyectos`.
5. **v1.1 (posterior, fuera de alcance):** con SMTP de Hostinger configurado en el
   dashboard (paso del usuario; credenciales no pasan por el agente), cambiar a
   `inviteUserByEmail` para envío automático. El resto del flujo es idéntico.

Prerequisito de producción (paso del usuario, ya pendiente de antes): **Site URL /
Redirect URLs** del proyecto alojado apuntando al dominio de Vercel — sin esto el
`redirect_to` de producción no es aceptado. En local funciona con la config del CLI.

### Bootstrap y limpieza (producción) — `scripts/create-admin.ts`

Script local (usa service_role del alojado vía env, mismo patrón que el seed):
1. Crea `info@ventosolutions.ca` (`email_confirm: true`, contraseña temporal fuerte
   generada, `user_metadata.nombre: 'Vento Solutions'`), update `rol='admin'`.
2. **Borra los 5 usuarios demo** (`*@cota.test`) con `admin.deleteUser` (cascade borra
   profiles; FKs de negocio → null por diseño del esquema).
3. Imprime la contraseña temporal UNA vez (el admin la cambia en `/cuenta/contrasena`).
Idempotente: si el admin ya existe, no lo duplica; si los demo ya no están, sigue.

### UI

Sobria y con los tokens existentes (`@theme` de globals.css), sin librerías nuevas:
tabla simple (como `/proyectos`), badges de rol, estados vacíos/errores en texto claro.
No hay prototipo `.dc.html` para admin — no inventar diseño elaborado; consistencia > novedad.

## 5. Fuera de alcance (v1)

- Rol `cliente` y RLS por-cliente (sub-proyecto Vista de Cliente).
- Envío automático de emails (v1.1 tras SMTP), reset de contraseña por email.
- Gestión de clientes-empresa, equipos por proyecto, SSO/HUB, auditoría de accesos.
- Eliminar usuarios desde la UI (solo desactivar; borrar queda para el futuro).

## 6. Testing (integración, stack local seedeado)

1. `inviteUser` como admin → usuario+profile con rol correcto; link no vacío; duplicado da error claro.
2. Gate: server action llamada con sesión de consultor → rechazada.
3. Migración 0004: `authenticated` actualiza su `nombre` OK; su `rol` → `permission denied`.
4. Anti-lockout: degradar al último admin → rechazado; auto-desactivarse → rechazado.
5. e2e local: generar link de invitación, abrirlo, establecer contraseña, ver `/proyectos`;
   verificar que un consultor no ve `/admin` (redirect).

## 7. Criterios de aceptación (DoD)

- [ ] Migración 0004 aplicada local y en producción (`db push`); test de columna `rol` pasa.
- [ ] `/admin` funcional para un admin real; consultores redirigidos.
- [ ] Invitación por enlace copiable funciona e2e en local y en producción.
- [ ] `info@ventosolutions.ca` es admin en producción; los 5 demo eliminados; `/proyectos` sigue OK.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` en Vercel solo como env de servidor; `npm run build` verde.
- [ ] `npm test` completo en verde; docs (AGENTS/DEPLOY/START-HERE) actualizados.
