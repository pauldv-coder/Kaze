# Kaze · Mejoramiento de procesos

App Next.js + Supabase para gestionar proyectos de mejora lean (A3) de Cota.

## Desarrollo local
1. `npm install`
2. Docker Desktop corriendo → `npx supabase start`
3. Copiar los keys locales a `.env.local` (ver `.env.local.example`; los valores los imprime `npx supabase status` — URL de API incluida, este repo usa puertos 553xx)
4. `npm run db:reset && npm run seed`
5. `npm run dev` → http://localhost:3000 (login: carmen@cota.test / cota-demo-2026)

## Administración de usuarios

- `/admin` — solo accesible con rol `admin`; lista usuarios y permite invitar, cambiar
  rol o desactivar.
- Invitaciones **v1: enlace copiable** (sin envío automático por email) — el admin genera
  el enlace en `/admin` y lo comparte por su canal.
- Roles internos: `admin` y `consultor` (el rol `cliente` queda bloqueado hasta RLS por-cliente).
- Cada usuario establece o cambia su contraseña en `/cuenta/contrasena`.

## Desplegar al proyecto alojado
1. Crear proyecto en supabase.com; poner sus keys en el entorno de producción.
2. `npx supabase link --project-ref <ref>` y `npx supabase db push` (aplica migraciones).
3. Correr el seed contra el alojado (opcional) apuntando `.env.local` a sus keys.

Estructura: `app/` (rutas), `lib/data/` (acceso a datos), `supabase/migrations/` (esquema),
`reference/prototype/` (prototipo .dc.html = especificación visual).
