import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { selectAllRows } from '@/lib/data/query'

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

// Exportada: la lista de proyectos la reusa para derivar las iniciales de un perfil que no las
// tiene. `kaze.profiles.iniciales` es nullable y SIN default
// (supabase/migrations/20260920000001_kaze_schema.sql:22) y ningún trigger la rellena.
export function iniciales(nombre: string) {
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

/**
 * Exige membresía de Kaze y devuelve el rol. `auth.users` se comparte con el CMS y el HUB, así que
 * un `userId` válido NO implica pertenecer a Kaze: la membresía es la fila en `kaze.profiles`.
 *
 * Sin esta guardia, las acciones de /admin sobre un no-miembro hacían daño o mentían: `setRole` era
 * un no-op silencioso (update sobre 0 filas, sin error, UI repintando igual), `desactivar` reventaba
 * con un `PGRST116` críptico y `reactivar` levantaba en TODO el ecosistema un bloqueo que Kaze no
 * había puesto.
 */
async function assertMiembro(db: DB, userId: string) {
  const { data, error } = await db.from('profiles').select('rol').eq('id', userId).maybeSingle()
  if (error) throw error
  if (!data) throw new Error(`${userId} no es miembro de Kaze (la cuenta existe en el proyecto compartido, pero no tiene perfil aquí)`)
  return data.rol
}

/**
 * El padrón de Kaze es `kaze.profiles`, y de ahí parte esta lista. Al revés — partir de
 * `auth.admin.listUsers()` — /admin enseñaba el correo de CADA usuario del proyecto compartido
 * (CMS y HUB incluidos) como si fuera un miembro con rol.
 *
 * El enriquecimiento va con `getUserById` por miembro y en paralelo, no con `listUsers`: el techo de
 * 1000 filas de `listUsers` es sobre el pool COMPARTIDO, así que el día que el CMS pase de 1000
 * usuarios miembros legítimos de Kaze desaparecerían de la lista sin aviso. Así el coste y la
 * exactitud dependen del tamaño de Kaze, no del de los vecinos.
 */
export async function getUsers(db: DB): Promise<UserRow[]> {
  const profiles = await selectAllRows('profiles', db.from('profiles').select('id, nombre, iniciales, rol', { count: 'exact' }))
  const cuentas = await Promise.all(profiles.map(async p => {
    // La FK `profiles.id -> auth.users(id) on delete cascade` garantiza que la cuenta existe:
    // un error aquí es real (API caída, id corrupto) y se propaga en vez de pintar una fila a medias.
    const { data, error } = await db.auth.admin.getUserById(p.id)
    if (error) throw error
    return data.user
  }))
  return profiles
    .map((p, i) => {
      const u = cuentas[i]
      return {
        id: p.id,
        email: u.email ?? '',
        nombre: p.nombre,
        iniciales: p.iniciales ?? '',
        rol: p.rol,
        activo: isActivo(u),
        ultimoAcceso: u.last_sign_in_at ?? null,
      }
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
}

export async function inviteUserCore(db: DB, input: { email: string; nombre: string; rol: RolInterno }) {
  if (!ROLES_INTERNOS.includes(input.rol)) throw new Error(`rol inválido en v1: ${input.rol} (solo admin/consultor)`)

  // auth.users se comparte con el CMS y el HUB: que el correo ya exista NO es un
  // error, solo significa que hay que darle membresía de Kaze sin crear cuenta.
  const { data: existing, error: lErr } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (lErr) throw lErr
  const yaExiste = existing.users.find(u => u.email?.toLowerCase() === input.email.toLowerCase())

  if (yaExiste) {
    const { data: perfil, error: pErr } = await db.from('profiles').select('id').eq('id', yaExiste.id).maybeSingle()
    if (pErr) throw pErr
    if (perfil) throw new Error(`${input.email} ya es miembro de Kaze`)
    const { error: iErr } = await db.from('profiles').insert({
      id: yaExiste.id, nombre: input.nombre, iniciales: iniciales(input.nombre), rol: input.rol,
    })
    if (iErr) throw iErr
    return { userId: yaExiste.id, tokenHash: null }
  }

  const { data, error } = await db.auth.admin.generateLink({
    type: 'invite',
    email: input.email,
    options: { data: { nombre: input.nombre, iniciales: iniciales(input.nombre) } },
  })
  if (error) throw error
  const userId = data.user!.id
  // Ya no hay trigger: el perfil lo crea la invitación.
  const { error: iErr } = await db.from('profiles').insert({
    id: userId, nombre: input.nombre, iniciales: iniciales(input.nombre), rol: input.rol,
  })
  if (iErr) throw iErr
  return { userId, tokenHash: data.properties!.hashed_token }
}

export async function setRoleCore(db: DB, userId: string, rol: RolInterno) {
  if (!ROLES_INTERNOS.includes(rol)) throw new Error(`rol inválido en v1: ${rol}`)
  const rolActual = await assertMiembro(db, userId)
  if (rol !== 'admin' && rolActual === 'admin' && (await countAdmins(db)) <= 1) {
    throw new Error('no puedes degradar al último admin')
  }
  const { error } = await db.from('profiles').update({ rol }).eq('id', userId)
  if (error) throw error
}

// OJO — alcance deliberado: esto BANEA LA CUENTA COMPARTIDA de `auth.users`, así que expulsa a la
// persona también del Vento HUB y del CMS, no solo de Kaze. Es una decisión tomada, no un descuido.
// La alternativa conceptualmente correcta —revocar únicamente la membresía de Kaze, dejando la
// cuenta viva en el resto del ecosistema— se pospuso a propósito: exige migración (una columna de
// estado en `kaze.profiles` y que `kaze.es_miembro()` la mire). La guardia de membresía de aquí
// abajo es lo que al menos impide banear a alguien que nunca fue de Kaze.
export async function deactivateUserCore(db: DB, userId: string) {
  if ((await assertMiembro(db, userId)) === 'admin' && (await countAdmins(db)) <= 1) {
    throw new Error('no puedes desactivar al último admin')
  }
  const { error } = await db.auth.admin.updateUserById(userId, { ban_duration: '876000h' })
  if (error) throw error
}

// Contrapartida de `deactivateUserCore`: levanta el ban de la cuenta compartida. Sin la guardia,
// un admin de Kaze podía quitarle a un usuario del CMS o del HUB un bloqueo que Kaze nunca puso.
export async function reactivateUserCore(db: DB, userId: string) {
  await assertMiembro(db, userId)
  const { error } = await db.auth.admin.updateUserById(userId, { ban_duration: 'none' })
  if (error) throw error
}
