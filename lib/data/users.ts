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
  // GoTrue solo rechaza generateLink(invite) si el usuario ya está confirmado;
  // para no confirmados regenera el link en silencio. Chequeo explícito de duplicados.
  const { data: existing, error: lErr } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (lErr) throw lErr
  if (existing.users.some(u => u.email?.toLowerCase() === input.email.toLowerCase())) {
    throw new Error(`ya existe un usuario con el correo ${input.email}`)
  }
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
