# Kaze · Módulo de administración de usuarios — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/admin` para invitar (por enlace copiable), asignar rol interno y desactivar usuarios; con fix de seguridad de la columna `rol`, bootstrap del admin real en producción y borrado de los usuarios demo.

**Architecture:** Server actions de Next 16 con cliente service_role **solo de servidor** (`lib/supabase/admin.ts` + `server-only`); lógica testeable en `lib/data/users.ts` (recibe el cliente como parámetro, patrón de `lib/data/projects.ts`); invitación vía `admin.generateLink(type:'invite')` → enlace propio `/auth/confirm?token_hash=...` (sin SMTP); migración `0004` con grants por columna para que nadie se auto-promueva.

**Tech Stack:** Next.js 16 (App Router, server actions), @supabase/supabase-js Admin API, @supabase/ssr, Vitest, stack local Supabase (puertos 553xx).

**Spec:** `docs/superpowers/specs/2026-07-18-kaze-admin-usuarios-design.md` (aprobado 2026-07-18).

**Contexto operativo para el ejecutor:** repo `C:\Users\pauld\dev\cota` (Git Bash: `/c/Users/pauld/dev/cota`), rama `main`, remoto GitHub `pauldv-coder/Kaze` (**push = auto-deploy a Vercel**: no pushear hasta la tarea que lo indica). Stack local corriendo (`npx supabase start`); psql vía `docker exec supabase_db_cota psql -U postgres -d postgres -c "..."`. Producción: Supabase `kvjpxnswvlxzxdzgycbh` + Vercel proyecto `kaze`. Convención Next 16: **`proxy.ts`, NO `middleware.ts`**.

---

### Task 1: Migración 0004 — grants por columna en `profiles`

**Files:**
- Create: `supabase/migrations/0004_admin_roles.sql`

- [ ] **Step 1: Escribir la migración** — EXACTAMENTE:

```sql
-- 0004_admin_roles.sql — un usuario NO puede cambiar su propio rol.
-- La policy profiles_update_own (0002/0003) gatea POR FILA; estos grants gatean POR COLUMNA.
-- rol queda modificable solo vía service_role (server actions del módulo admin).
revoke update on public.profiles from authenticated;
grant update (nombre, iniciales) on public.profiles to authenticated;
```

- [ ] **Step 2: Aplicar** — Run: `npx supabase db reset` (WARN de seed.sql es normal; aplica 0001–0004).

- [ ] **Step 3: Reseed** — Run: `npm run seed` → `Seed OK`.

- [ ] **Step 4: Verificar en vivo** (dos comandos; el primero debe FUNCIONAR, el segundo FALLAR):

```bash
docker exec supabase_db_cota psql -U postgres -d postgres -c "begin; set local role authenticated; select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email='carmen@cota.test'), 'role','authenticated')::text, true); update public.profiles set nombre='X' where id=(select id from auth.users where email='carmen@cota.test'); rollback;"
docker exec supabase_db_cota psql -U postgres -d postgres -c "begin; set local role authenticated; select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email='carmen@cota.test'), 'role','authenticated')::text, true); update public.profiles set rol='admin' where id=(select id from auth.users where email='carmen@cota.test'); rollback;"
```
Expected: 1º `UPDATE 1`; 2º `ERROR: permission denied for table profiles`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0004_admin_roles.sql && git commit -m "feat(db): column-level grants — rol solo via service_role"
```

---

### Task 2: Carmen admin en el seed local

**Files:**
- Modify: `scripts/seed.ts` (el update de profiles dentro del loop de TEAM)

- [ ] **Step 1: Editar el update del loop TEAM.** Localizar (≈ línea 119):

```ts
    const { error: uErr } = await db.from('profiles').update({ nombre: t.nombre, iniciales: t.iniciales }).eq('id', data.user!.id)
```

Reemplazar por (CV = admin local para desarrollo del módulo admin; el resto consultores):

```ts
    const { error: uErr } = await db.from('profiles').update({
      nombre: t.nombre, iniciales: t.iniciales,
      rol: t.iniciales === 'CV' ? 'admin' : 'consultor',
    }).eq('id', data.user!.id)
```

- [ ] **Step 2: Reseed y verificar**

Run: `npx supabase db reset && npm run seed`
Luego: `docker exec supabase_db_cota psql -U postgres -d postgres -c "select p.rol, u.email from public.profiles p join auth.users u on u.id=p.id order by u.email;"`
Expected: `carmen@cota.test → admin`, los otros 4 `consultor`.

- [ ] **Step 3: `npm test`** → 2 passing (nada roto).

- [ ] **Step 4: Commit**

```bash
git add scripts/seed.ts && git commit -m "feat(seed): carmen como admin local para el módulo de administración"
```

---

### Task 3: Test de regresión de la 0004 (Data API)

**Files:**
- Create: `tests/data/roles.test.ts`

- [ ] **Step 1: Escribir el test** — EXACTAMENTE:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
// Cliente ANON autenticado como carmen: valida lo que puede hacer un usuario real vía Data API.
const authDb = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
const admin = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

let uid: string

beforeAll(async () => {
  const { data, error } = await authDb.auth.signInWithPassword({ email: 'carmen@cota.test', password: 'cota-demo-2026' })
  if (error) throw error
  uid = data.user!.id
})

describe('0004: grants por columna en profiles', () => {
  it('un usuario SÍ puede actualizar su nombre', async () => {
    const { error } = await authDb.from('profiles').update({ nombre: 'Carmen Vidal' }).eq('id', uid)
    expect(error).toBeNull()
  })

  it('un usuario NO puede cambiar su propio rol (permission denied)', async () => {
    const { error } = await authDb.from('profiles').update({ rol: 'admin' }).eq('id', uid)
    expect(error).not.toBeNull()
    expect(error!.code).toBe('42501')
  })

  it('service_role SÍ puede cambiar roles (y restaura el estado)', async () => {
    const { error } = await admin.from('profiles').update({ rol: 'admin' }).eq('id', uid)
    expect(error).toBeNull()
  })
})
```

- [ ] **Step 2: Correr** — Run: `npm test -- tests/data/roles.test.ts` → 3 passing. (Requiere db reset + seed de Task 2 aplicados.)

- [ ] **Step 3: Commit**

```bash
git add tests/data/roles.test.ts && git commit -m "test(db): regresión de grants por columna (0004)"
```

---

### Task 4: Cliente admin server-only + guard

**Files:**
- Create: `lib/supabase/admin.ts`, `lib/auth/guards.ts`
- Modify: `package.json` (dep `server-only`)

- [ ] **Step 1: Instalar** — Run: `npm install server-only`

- [ ] **Step 2: `lib/supabase/admin.ts`** — EXACTAMENTE:

```ts
import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

// Cliente con service_role: SOLO importable desde código de servidor.
// La env var NO lleva prefijo NEXT_PUBLIC_ — jamás llega al navegador.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

- [ ] **Step 3: `lib/auth/guards.ts`** — EXACTAMENTE:

```ts
import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Gate de UI y de server actions: sesión + rol admin. Las server actions DEBEN llamarlo
// (el gate de la página sola no es seguridad).
export async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') redirect('/proyectos')
  return user
}
```

- [ ] **Step 4: Verificar** — Run: `npx tsc --noEmit` (limpio) y `npm run build` (verde).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json lib/supabase/admin.ts lib/auth/guards.ts
git commit -m "feat(auth): cliente admin server-only + guard requireAdmin"
```

---

### Task 5: TDD — lógica de usuarios en `lib/data/users.ts`

**Files:**
- Test: `tests/data/users.test.ts`
- Create: `lib/data/users.ts`
- Modify: `vitest.config.ts` (serializar archivos de test)

- [ ] **Step 0: Serializar los tests.** Con 3 archivos de test contra la MISMA base local, el paralelismo por defecto de Vitest produce carreras (users.test.ts muta roles que roles.test.ts/users.test.ts asumen del seed). En `vitest.config.ts`, dentro de `test: {...}`, añadir:

```ts
    fileParallelism: false,
```

(Recomendación pendiente del review de la Fundación; ahora es cuando aplica.)

- [ ] **Step 1: Test que falla** — `tests/data/users.test.ts` EXACTAMENTE:

```ts
import { describe, it, expect, afterAll } from 'vitest'
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getUsers, inviteUserCore, setRoleCore, deactivateUserCore, reactivateUserCore } from '@/lib/data/users'

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const EMAIL = 'invitado.test@kaze.test'
const cleanupIds: string[] = []

afterAll(async () => {
  for (const id of cleanupIds) await admin.auth.admin.deleteUser(id)
})

async function uidOf(email: string) {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  return data.users.find(u => u.email === email)?.id
}

describe('data/users', () => {
  it('getUsers combina auth + profiles (5 del seed, carmen admin)', async () => {
    const users = await getUsers(admin)
    expect(users.length).toBeGreaterThanOrEqual(5)
    const carmen = users.find(u => u.email === 'carmen@cota.test')!
    expect(carmen.rol).toBe('admin')
    expect(carmen.nombre).toBe('Carmen Vidal')
  })

  it('inviteUserCore crea usuario+profile con rol y devuelve token_hash', async () => {
    const r = await inviteUserCore(admin, { email: EMAIL, nombre: 'Invitado Test', rol: 'consultor' })
    cleanupIds.push(r.userId)
    expect(r.tokenHash).toBeTruthy()
    const users = await getUsers(admin)
    const inv = users.find(u => u.email === EMAIL)!
    expect(inv.rol).toBe('consultor')
    expect(inv.nombre).toBe('Invitado Test')
  })

  it('inviteUserCore rechaza duplicados con mensaje claro', async () => {
    await expect(inviteUserCore(admin, { email: EMAIL, nombre: 'Otro', rol: 'consultor' }))
      .rejects.toThrow(/ya existe/i)
  })

  it('inviteUserCore bloquea el rol cliente (v1 interno)', async () => {
    await expect(inviteUserCore(admin, { email: 'c@kaze.test', nombre: 'C', rol: 'cliente' as never }))
      .rejects.toThrow(/rol/i)
  })

  it('setRoleCore no degrada al último admin', async () => {
    const carmenId = (await uidOf('carmen@cota.test'))!
    await expect(setRoleCore(admin, carmenId, 'consultor')).rejects.toThrow(/último admin/i)
  })

  it('setRoleCore degrada cuando hay otro admin, y restaura', async () => {
    const carmenId = (await uidOf('carmen@cota.test'))!
    const diegoId = (await uidOf('diego@cota.test'))!
    await setRoleCore(admin, diegoId, 'admin')
    await setRoleCore(admin, carmenId, 'consultor')   // ahora sí se puede
    await setRoleCore(admin, carmenId, 'admin')       // restaurar
    await setRoleCore(admin, diegoId, 'consultor')    // restaurar
    const users = await getUsers(admin)
    expect(users.find(u => u.email === 'carmen@cota.test')!.rol).toBe('admin')
    expect(users.find(u => u.email === 'diego@cota.test')!.rol).toBe('consultor')
  })

  it('deactivateUserCore banea (y no al último admin); reactivateUserCore desbanea', async () => {
    const carmenId = (await uidOf('carmen@cota.test'))!
    const invId = (await uidOf(EMAIL))!
    await expect(deactivateUserCore(admin, carmenId)).rejects.toThrow(/último admin/i)
    await deactivateUserCore(admin, invId)
    let users = await getUsers(admin)
    expect(users.find(u => u.id === invId)!.activo).toBe(false)
    await reactivateUserCore(admin, invId)
    users = await getUsers(admin)
    expect(users.find(u => u.id === invId)!.activo).toBe(true)
  })
})
```

- [ ] **Step 2: Verificar que falla** — Run: `npm test -- tests/data/users.test.ts`
Expected: FALLA con "Cannot find module '.../lib/data/users'".

- [ ] **Step 3: Implementar `lib/data/users.ts`** — EXACTAMENTE:

```ts
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

type DB = SupabaseClient<Database>
export type RolInterno = 'admin' | 'consultor'

export type UserRow = {
  id: string
  email: string
  nombre: string
  iniciales: string
  rol: string
  activo: boolean
  ultimoAcceso: string | null
}

const ROLES_INTERNOS: RolInterno[] = ['admin', 'consultor']

function iniciales(nombre: string) {
  return nombre.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

// banned_until no está tipado en User; GoTrue lo incluye cuando hay ban vigente.
function isActivo(u: User) {
  const banned = (u as User & { banned_until?: string }).banned_until
  return !banned || new Date(banned) <= new Date()
}

async function countAdmins(db: DB) {
  const { count, error } = await db.from('profiles').select('id', { count: 'exact', head: true }).eq('rol', 'admin')
  if (error) throw error
  return count ?? 0
}

async function rolOf(db: DB, userId: string) {
  const { data, error } = await db.from('profiles').select('rol').eq('id', userId).single()
  if (error) throw error
  return data.rol
}

export async function getUsers(db: DB): Promise<UserRow[]> {
  const { data: authData, error: aErr } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (aErr) throw aErr
  const { data: profiles, error: pErr } = await db.from('profiles').select('id, nombre, iniciales, rol')
  if (pErr) throw pErr
  const byId = new Map(profiles.map(p => [p.id, p]))
  return authData.users
    .map(u => {
      const p = byId.get(u.id)
      return {
        id: u.id,
        email: u.email ?? '',
        nombre: p?.nombre ?? u.email ?? '',
        iniciales: p?.iniciales ?? '',
        rol: p?.rol ?? 'consultor',
        activo: isActivo(u),
        ultimoAcceso: u.last_sign_in_at ?? null,
      }
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
}

export async function inviteUserCore(db: DB, input: { email: string; nombre: string; rol: RolInterno }) {
  if (!ROLES_INTERNOS.includes(input.rol)) throw new Error(`rol inválido en v1: ${input.rol} (solo admin/consultor)`)
  const { data, error } = await db.auth.admin.generateLink({
    type: 'invite',
    email: input.email,
    options: { data: { nombre: input.nombre, iniciales: iniciales(input.nombre) } },
  })
  if (error) {
    if (/already|registered|exists/i.test(error.message)) throw new Error(`ya existe un usuario con el correo ${input.email}`)
    throw error
  }
  const userId = data.user!.id
  if (input.rol !== 'consultor') {
    const { error: rErr } = await db.from('profiles').update({ rol: input.rol }).eq('id', userId)
    if (rErr) throw rErr
  }
  return { userId, tokenHash: data.properties!.hashed_token }
}

export async function setRoleCore(db: DB, userId: string, rol: RolInterno) {
  if (!ROLES_INTERNOS.includes(rol)) throw new Error(`rol inválido en v1: ${rol}`)
  if (rol !== 'admin' && (await rolOf(db, userId)) === 'admin' && (await countAdmins(db)) <= 1) {
    throw new Error('no puedes degradar al último admin')
  }
  const { error } = await db.from('profiles').update({ rol }).eq('id', userId)
  if (error) throw error
}

export async function deactivateUserCore(db: DB, userId: string) {
  if ((await rolOf(db, userId)) === 'admin' && (await countAdmins(db)) <= 1) {
    throw new Error('no puedes desactivar al último admin')
  }
  const { error } = await db.auth.admin.updateUserById(userId, { ban_duration: '876000h' })
  if (error) throw error
}

export async function reactivateUserCore(db: DB, userId: string) {
  const { error } = await db.auth.admin.updateUserById(userId, { ban_duration: 'none' })
  if (error) throw error
}
```

- [ ] **Step 4: Verificar que pasa** — Run: `npm test -- tests/data/users.test.ts` → 7 passing. Luego `npm test` (suite completa) → todo verde. `npx tsc --noEmit` limpio.

- [ ] **Step 5: Commit**

```bash
git add tests/data/users.test.ts lib/data/users.ts vitest.config.ts
git commit -m "feat(data): lógica de usuarios (invitar, roles, ban) con tests de integración"
```

---

### Task 6: Permitir `/auth/*` sin sesión (proxy)

**Files:**
- Modify: `lib/supabase/middleware.ts` (condición del redirect)
- Modify: `proxy.ts` (matcher)

- [ ] **Step 1: `lib/supabase/middleware.ts`** — cambiar la condición:

```ts
  if (!user && !path.startsWith('/login') && !path.startsWith('/auth')) {
```

- [ ] **Step 2: `proxy.ts`** — matcher con `auth` excluido:

```ts
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 3: Verificar** — `npm run build` verde. `npm run dev` en background y:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/auth/confirm"        # esperado: 307 A /login?error=... (lo redirige el HANDLER aún inexistente → 404 por ahora: aceptar 404)
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "http://localhost:3000/proyectos"  # esperado: 307 → /login (protección intacta)
```
Nota: hasta la Task 7 no existe el handler; el punto de esta verificación es que `/auth/confirm` **NO** devuelva 307 → `/login` desde el proxy (404 está bien). Matar el dev server al final (puerto 3000 libre).

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/middleware.ts proxy.ts
git commit -m "feat(auth): rutas /auth/* accesibles sin sesión (flujo de invitación)"
```

---

### Task 7: Route handler `/auth/confirm`

**Files:**
- Create: `app/auth/confirm/route.ts`

- [ ] **Step 1: Escribir** — EXACTAMENTE:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) return NextResponse.redirect(new URL('/cuenta/contrasena?bienvenida=1', request.url))
  }
  return NextResponse.redirect(
    new URL(`/login?error=${encodeURIComponent('Enlace inválido o vencido; pide una nueva invitación')}`, request.url)
  )
}
```

- [ ] **Step 2: Verificar (token inválido)** — `npm run build` verde; `npm run dev` background y:

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "http://localhost:3000/auth/confirm?token_hash=basura&type=invite"
```
Expected: `307 http://localhost:3000/login?error=...`. Matar dev server.

- [ ] **Step 3: Commit**

```bash
git add app/auth/confirm/route.ts && git commit -m "feat(auth): /auth/confirm canjea token de invitación"
```

---

### Task 8: `/cuenta/contrasena` (establecer/cambiar contraseña)

**Files:**
- Create: `app/(app)/cuenta/contrasena/actions.ts`, `app/(app)/cuenta/contrasena/page.tsx`

- [ ] **Step 1: `actions.ts`** — EXACTAMENTE:

```ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function updatePassword(formData: FormData) {
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')
  if (password.length < 8) redirect(`/cuenta/contrasena?error=${encodeURIComponent('Mínimo 8 caracteres')}`)
  if (password !== confirm) redirect(`/cuenta/contrasena?error=${encodeURIComponent('Las contraseñas no coinciden')}`)

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) redirect(`/cuenta/contrasena?error=${encodeURIComponent(error.message)}`)
  redirect('/proyectos')
}
```

- [ ] **Step 2: `page.tsx`** — EXACTAMENTE (estilo de `/login`):

```tsx
import { updatePassword } from './actions'

export default async function ContrasenaPage({
  searchParams,
}: { searchParams: Promise<{ error?: string; bienvenida?: string }> }) {
  const { error, bienvenida } = await searchParams
  return (
    <main className="min-h-screen grid place-items-center bg-panel">
      <form action={updatePassword} className="w-80 bg-white border border-borde rounded-lg p-8 space-y-4">
        <h1 className="font-display text-xl font-bold">
          {bienvenida ? 'Bienvenido a Kaze' : 'Cambiar contraseña'}
        </h1>
        {bienvenida && <p className="text-xs text-apagado">Define tu contraseña para entrar.</p>}
        <input name="password" type="password" required minLength={8} placeholder="Nueva contraseña"
               className="w-full border border-borde rounded-md px-3 py-2 text-sm" />
        <input name="confirm" type="password" required minLength={8} placeholder="Confirmar contraseña"
               className="w-full border border-borde rounded-md px-3 py-2 text-sm" />
        {error && <p className="text-estado-mal text-xs">{error}</p>}
        <button className="w-full bg-tinta text-white rounded-md py-2 text-sm font-semibold">Guardar</button>
      </form>
    </main>
  )
}
```

- [ ] **Step 3: Verificar** — `npx tsc --noEmit` + `npm run build` verdes (ruta `ƒ /cuenta/contrasena`).

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/cuenta" && git commit -m "feat(auth): página establecer/cambiar contraseña"
```

---

### Task 9: `/admin` — actions, página y form de invitación

**Files:**
- Create: `app/(app)/admin/actions.ts`, `app/(app)/admin/page.tsx`, `app/(app)/admin/invite-form.tsx`

- [ ] **Step 1: `actions.ts`** — EXACTAMENTE:

```ts
'use server'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { inviteUserCore, setRoleCore, deactivateUserCore, reactivateUserCore, type RolInterno } from '@/lib/data/users'

export type InviteState = { ok: boolean; link?: string; email?: string; error?: string }

export async function inviteUser(_prev: InviteState, formData: FormData): Promise<InviteState> {
  await requireAdmin()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const nombre = String(formData.get('nombre') ?? '').trim()
  const rol = String(formData.get('rol') ?? 'consultor') as RolInterno
  if (!email || !nombre) return { ok: false, error: 'Correo y nombre son obligatorios' }
  try {
    const { tokenHash } = await inviteUserCore(createAdminClient(), { email, nombre, rol })
    const h = await headers()
    const origin = h.get('origin') ?? `https://${h.get('host')}`
    revalidatePath('/admin')
    return { ok: true, email, link: `${origin}/auth/confirm?token_hash=${tokenHash}&type=invite` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al invitar' }
  }
}

export async function setRole(formData: FormData) {
  await requireAdmin()
  await setRoleCore(createAdminClient(), String(formData.get('userId')), String(formData.get('rol')) as RolInterno)
  revalidatePath('/admin')
}

export async function deactivateUser(formData: FormData) {
  const me = await requireAdmin()
  const userId = String(formData.get('userId'))
  if (userId === me.id) throw new Error('no puedes desactivarte a ti mismo')
  await deactivateUserCore(createAdminClient(), userId)
  revalidatePath('/admin')
}

export async function reactivateUser(formData: FormData) {
  await requireAdmin()
  await reactivateUserCore(createAdminClient(), String(formData.get('userId')))
  revalidatePath('/admin')
}
```

- [ ] **Step 2: `invite-form.tsx`** — EXACTAMENTE:

```tsx
'use client'
import { useActionState } from 'react'
import { inviteUser, type InviteState } from './actions'

const initial: InviteState = { ok: false }

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteUser, initial)
  return (
    <div className="bg-white border border-borde rounded-lg p-6 space-y-3">
      <h2 className="font-display font-bold">Invitar usuario</h2>
      <form action={action} className="flex flex-wrap gap-2">
        <input name="nombre" required placeholder="Nombre" className="border border-borde rounded-md px-3 py-2 text-sm" />
        <input name="email" type="email" required placeholder="Correo" className="border border-borde rounded-md px-3 py-2 text-sm" />
        <select name="rol" className="border border-borde rounded-md px-2 py-2 text-sm">
          <option value="consultor">consultor</option>
          <option value="admin">admin</option>
        </select>
        <button disabled={pending} className="bg-tinta text-white rounded-md px-4 py-2 text-sm font-semibold">
          {pending ? 'Invitando…' : 'Generar invitación'}
        </button>
      </form>
      {state.error && <p className="text-estado-mal text-xs">{state.error}</p>}
      {state.ok && state.link && (
        <div className="text-xs space-y-1">
          <p>Invitación creada para <b>{state.email}</b>. Cópiale este enlace (caduca según la config del proyecto):</p>
          <div className="flex gap-2 items-center">
            <code className="bg-panel border border-borde rounded px-2 py-1 break-all">{state.link}</code>
            <button type="button" onClick={() => navigator.clipboard.writeText(state.link!)}
                    className="border border-borde rounded-md px-2 py-1">Copiar</button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: `page.tsx`** — EXACTAMENTE:

```tsx
import { requireAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUsers } from '@/lib/data/users'
import { InviteForm } from './invite-form'
import { setRole, deactivateUser, reactivateUser } from './actions'

export default async function AdminPage() {
  const me = await requireAdmin()
  const users = await getUsers(createAdminClient())

  return (
    <main className="p-10 space-y-6">
      <h1 className="font-display text-2xl font-bold">Administración de usuarios</h1>
      <InviteForm />
      <ul className="space-y-2">
        {users.map(u => (
          <li key={u.id} className="bg-white border border-borde rounded-lg px-4 py-3 flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs text-marca w-8">{u.iniciales}</span>
            <span className="text-sm">{u.nombre}</span>
            <span className="text-xs text-apagado">{u.email}</span>
            <span className="text-xs border border-borde rounded px-2 py-0.5">{u.rol}</span>
            {!u.activo && <span className="text-xs text-estado-mal">desactivado</span>}
            <span className="ml-auto flex gap-2 items-center">
              {u.id !== me.id && (
                <>
                  <form action={setRole}>
                    <input type="hidden" name="userId" value={u.id} />
                    <input type="hidden" name="rol" value={u.rol === 'admin' ? 'consultor' : 'admin'} />
                    <button className="text-xs border border-borde rounded-md px-2 py-1">
                      hacer {u.rol === 'admin' ? 'consultor' : 'admin'}
                    </button>
                  </form>
                  <form action={u.activo ? deactivateUser : reactivateUser}>
                    <input type="hidden" name="userId" value={u.id} />
                    <button className="text-xs border border-borde rounded-md px-2 py-1">
                      {u.activo ? 'desactivar' : 'reactivar'}
                    </button>
                  </form>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </main>
  )
}
```

- [ ] **Step 4: Verificar** — `npx tsc --noEmit` limpio; `npm run build` verde (`ƒ /admin`); `npm test` completo verde.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/admin" && git commit -m "feat(admin): página /admin con invitaciones por enlace, roles y desactivación"
```

---

### Task 10: e2e local con navegador

Sin archivos nuevos — verificación integral (usar el Claude Preview browser en `http://localhost:3000`; el MCP de Playwright NO funciona en este entorno). Precondición: `npx supabase db reset && npm run seed` y `npm run dev` en background.

- [ ] **Step 1:** Login `carmen@cota.test` / `cota-demo-2026` → visitar `/admin` → se ve la lista con 5 usuarios y el form.
- [ ] **Step 2:** Invitar `invitado.e2e@kaze.test` (rol consultor) → aparece el enlace → copiarlo (leerlo del DOM).
- [ ] **Step 3:** Abrir el enlace en el navegador (misma pestaña tras logout, o pestaña nueva) → aterriza en `/cuenta/contrasena?bienvenida=1` → establecer `Invitado-e2e-2026!` → llega a `/proyectos`.
- [ ] **Step 4:** Como invitado, ir a `/admin` → redirect a `/proyectos` (gate de consultor OK).
- [ ] **Step 5:** Re-login carmen → `/admin` → desactivar al invitado → logout → login invitado FALLA (baneado).
- [ ] **Step 6:** Limpieza: reactivar… no — eliminar el usuario e2e para dejar el estado limpio:

```bash
docker exec supabase_db_cota psql -U postgres -d postgres -c "delete from auth.users where email='invitado.e2e@kaze.test';"
```
Matar dev server (puerto 3000 libre). `npm test` → verde.

- [ ] **Step 7: Commit (solo si hubo fixes de código durante el e2e; si no, no hay commit)**

---

### Task 11: Bootstrap de producción — `scripts/create-admin.ts`

**Files:**
- Create: `scripts/create-admin.ts`

- [ ] **Step 1: Escribir el script** — EXACTAMENTE:

```ts
// Bootstrap del admin real + limpieza de usuarios demo. Idempotente.
// USO (producción):
//   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx scripts/create-admin.ts
// Sin env explícitas usa .env.local (stack LOCAL) — ahí NO borra demos salvo DELETE_DEMO=yes.
import { config } from 'dotenv'
config({ path: '.env.local' })
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../lib/database.types'

const ADMIN_EMAIL = 'info@ventosolutions.ca'
const DEMO_DOMAIN = '@cota.test'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const isProd = !url.includes('127.0.0.1') && !url.includes('localhost')
const db = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log(`Target: ${url} (${isProd ? 'PRODUCCIÓN' : 'local'})`)
  const { data: list, error: lErr } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (lErr) throw lErr

  // 1) admin
  const existing = list.users.find(u => u.email === ADMIN_EMAIL)
  if (existing) {
    console.log(`Admin ya existe (${ADMIN_EMAIL}) — no se toca.`)
  } else {
    const password = `Kaze-${randomBytes(6).toString('hex')}!`
    const { data, error } = await db.auth.admin.createUser({
      email: ADMIN_EMAIL, password, email_confirm: true,
      user_metadata: { nombre: 'Vento Solutions', iniciales: 'VS' },
    })
    if (error) throw error
    const { error: rErr } = await db.from('profiles').update({ rol: 'admin' }).eq('id', data.user!.id)
    if (rErr) throw rErr
    console.log(`Admin creado: ${ADMIN_EMAIL}`)
    console.log(`CONTRASEÑA TEMPORAL (cámbiala en /cuenta/contrasena): ${password}`)
  }

  // 2) demos
  const demos = list.users.filter(u => u.email?.endsWith(DEMO_DOMAIN))
  if (!isProd && process.env.DELETE_DEMO !== 'yes') {
    console.log(`Local: se conservan ${demos.length} usuarios demo (usa DELETE_DEMO=yes para borrarlos).`)
  } else {
    for (const u of demos) {
      const { error } = await db.auth.admin.deleteUser(u.id)
      if (error) throw error
      console.log(`Demo eliminado: ${u.email}`)
    }
  }
  console.log('Bootstrap OK')
}
main().catch(e => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: `npx tsc --noEmit`** limpio.

- [ ] **Step 3: Ensayo LOCAL (sin borrar demos)** — Run: `npx tsx scripts/create-admin.ts`
Expected: crea `info@ventosolutions.ca` local + "se conservan 5 usuarios demo" + `Bootstrap OK`. Verificar login local con la contraseña impresa (curl al token endpoint local). Luego limpiar el ensayo:

```bash
docker exec supabase_db_cota psql -U postgres -d postgres -c "delete from auth.users where email='info@ventosolutions.ca';"
```

- [ ] **Step 4: Ejecutar contra PRODUCCIÓN.** Obtener la service key sin imprimirla (patrón del seed selectivo: `npx supabase projects api-keys --project-ref kvjpxnswvlxzxdzgycbh -o json` a variable). Run con las env de producción. Expected: admin creado (ANOTAR la contraseña temporal — se comparte con el usuario UNA vez) y 5 demos eliminados.

- [ ] **Step 5: Verificar producción**

```bash
# login del nuevo admin (200 con access_token); login demo carmen → 400
# conteo de perfiles = 1; /proyectos sigue devolviendo 3 filas vía service
```
Con curl al endpoint `auth/v1/token` (anon key) y a `rest/v1/projects?select=code` (service o admin JWT). Expected: 3 códigos A3.

- [ ] **Step 6: Commit**

```bash
git add scripts/create-admin.ts && git commit -m "feat(scripts): bootstrap admin de producción + limpieza de demos"
```

---

### Task 12: Producción — service key en Vercel + deploy + smoke

Sin archivos nuevos (el controller ejecuta o supervisa esta tarea — toca Vercel).

- [ ] **Step 1:** Añadir `SUPABASE_SERVICE_ROLE_KEY` a Vercel SOLO como env de servidor (sin `NEXT_PUBLIC_`), environments Production y Preview, vía `npx vercel env add` con el valor piped (nunca impreso).
- [ ] **Step 2:** `git push origin main` → auto-deploy; esperar `● Ready` (`npx vercel ls`).
- [ ] **Step 3:** Smoke de producción: `/admin` sin sesión → 307 a `/login`; login `info@ventosolutions.ca` (contraseña temporal de Task 11) → `/admin` renderiza con 1 usuario; `/auth/confirm?token_hash=basura&type=invite` → redirect a `/login?error=...`; `/proyectos` muestra los 3 A3.
- [ ] **Step 4:** (Ideal, browser) invitar un usuario de prueba `qa@ventosolutions.ca`, verificar enlace, y desactivarlo/borrarlo después vía Admin API.

---

### Task 13: Documentación al día

**Files:**
- Modify: `AGENTS.md` (regla service key + rutas nuevas + carmen admin local), `docs/DEPLOY.md` (env de servidor en Vercel), `docs/superpowers/START-HERE.md` (estado, prompt, pendientes), `README.md` (sección admin: invitar por enlace, /cuenta/contrasena)

- [ ] **Step 1:** AGENTS.md — actualizar la línea "NUNCA poner SUPABASE_SERVICE_ROLE_KEY en el host del frontend" a: "…NUNCA como variable pública (`NEXT_PUBLIC_`) ni importada desde código de cliente; en Vercel vive como env de SERVIDOR y solo la usan las server actions de `/admin` vía `lib/supabase/admin.ts` (`server-only`)". Añadir a Comandos/Login local: "admin local: carmen@cota.test".
- [ ] **Step 2:** DEPLOY.md — misma corrección de la regla + mencionar la env nueva en Vercel.
- [ ] **Step 3:** START-HERE.md — estado: módulo admin COMPLETO; producción: admin real `info@ventosolutions.ca`, demos eliminados, contraseña compartida ya inválida; pendiente del usuario: cambiar la contraseña temporal en `/cuenta/contrasena`, configurar SMTP Hostinger para v1.1 (envío automático) y el Site URL si aún falta; prompt de retomar → sub-proyecto 2 (Lista de Proyectos).
- [ ] **Step 4:** README.md — añadir sección "Administración" (3-4 líneas: /admin, invitación por enlace, roles internos).
- [ ] **Step 5: Commit + push**

```bash
git add AGENTS.md docs/DEPLOY.md docs/superpowers/START-HERE.md README.md
git commit -m "docs: módulo admin en producción + reglas de service key actualizadas"
git push origin main
```

---

## Verificación final (DoD del spec)

- [ ] Migración 0004 aplicada local y en producción; tests de columna `rol` en verde.
- [ ] `/admin` funcional (admin real); consultores redirigidos.
- [ ] Invitación por enlace copiable e2e OK en local; smoke en producción.
- [ ] `info@ventosolutions.ca` admin en producción; 0 usuarios `@cota.test`; `/proyectos` OK con 3 A3.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` en Vercel solo como env de servidor; `npm run build` verde.
- [ ] `npm test` completo verde (12+ tests); docs actualizados.
