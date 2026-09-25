import { describe, it, expect, beforeAll } from 'vitest'
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getUsers, setRoleCore, deactivateUserCore, reactivateUserCore } from '@/lib/data/users'

// Cliente de servicio: el mismo poder que tiene /admin vía lib/supabase/admin.ts.
const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: 'kaze' }, auth: { persistSession: false } }
)

// `ajeno@cota.test` es una cuenta del proyecto COMPARTIDO (el equivalente a alguien del CMS o
// del HUB) sin fila en `kaze.profiles`. La siembra scripts/seed.ts y la comparte
// tests/data/rls-no-miembro.test.ts, que queda en rojo en TODAS las corridas siguientes si un
// test le deja membresía: cualquier cambio sobre ajeno se deshace en un `finally`.
const AJENO = 'ajeno@cota.test'
let ajenoId: string

async function banDe(id: string) {
  const { data, error } = await admin.auth.admin.getUserById(id)
  if (error) throw error
  const u = data.user as typeof data.user & { banned_until?: string | null }
  return u?.banned_until ?? null
}

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error
  const u = data.users.find(x => x.email === AJENO)
  if (!u) throw new Error(`falta ${AJENO} en auth.users — corre \`npm run seed\``)
  ajenoId = u.id
  // Precondición: si ajeno llegó con perfil, la base quedó sucia de una corrida anterior y este
  // archivo no estaría probando nada. Mejor gritar que pasar en verde por el motivo equivocado.
  const { data: perfil, error: pErr } = await admin.from('profiles').select('id').eq('id', ajenoId).maybeSingle()
  if (pErr) throw pErr
  if (perfil) throw new Error(`${AJENO} quedó con perfil de Kaze de una corrida previa — corre \`npm run db:reset && npm run seed\``)
})

describe('getUsers solo lista a los miembros de Kaze', () => {
  it('no devuelve a quien existe en auth.users pero no en kaze.profiles', async () => {
    const users = await getUsers(admin)
    // El correo de un usuario del CMS o del HUB no es de la incumbencia de un admin de Kaze.
    expect(users.map(u => u.email)).not.toContain(AJENO)
    expect(users.map(u => u.id)).not.toContain(ajenoId)
  })

  it('devuelve exactamente el padrón de kaze.profiles, enriquecido con auth', async () => {
    const users = await getUsers(admin)
    const { count, error } = await admin.from('profiles').select('id', { count: 'exact', head: true })
    if (error) throw error
    expect(users.length).toBe(count)

    const carmen = users.find(u => u.email === 'carmen@cota.test')!
    expect(carmen).toBeDefined()
    expect(carmen.rol).toBe('admin')          // el rol real, no un 'consultor' inventado
    expect(carmen.nombre).toBe('Carmen Vidal')
    expect(carmen.iniciales).toBe('CV')
    expect(carmen.activo).toBe(true)          // dato que solo está en auth.users
  })

  it('mantiene el orden alfabético por nombre', async () => {
    const users = await getUsers(admin)
    const ordenados = [...users].sort((a, b) => a.nombre.localeCompare(b.nombre))
    expect(users.map(u => u.nombre)).toEqual(ordenados.map(u => u.nombre))
  })
})

describe('las acciones de /admin exigen membresía de Kaze', () => {
  it('setRoleCore falla en vez de ser un no-op silencioso', async () => {
    // El `update ... where id = ajeno` afectaba 0 filas, no daba error y la UI repintaba igual.
    await expect(setRoleCore(admin, ajenoId, 'admin')).rejects.toThrow(/no es miembro/i)
    const { data } = await admin.from('profiles').select('id').eq('id', ajenoId).maybeSingle()
    expect(data).toBeNull()   // y tampoco le crea la membresía de paso
  })

  it('deactivateUserCore falla con un mensaje claro, no con un PGRST116 críptico', async () => {
    await expect(deactivateUserCore(admin, ajenoId)).rejects.toThrow(/no es miembro/i)
    expect(await banDe(ajenoId)).toBeNull()   // no banea la cuenta compartida de un ajeno
  })

  it('reactivateUserCore no levanta un ban que Kaze no puso', async () => {
    // Ban puesto FUERA de Kaze: el HUB o el CMS desactivaron la cuenta compartida.
    const { error } = await admin.auth.admin.updateUserById(ajenoId, { ban_duration: '876000h' })
    if (error) throw error
    try {
      await expect(reactivateUserCore(admin, ajenoId)).rejects.toThrow(/no es miembro/i)
      expect(await banDe(ajenoId)).toBeTruthy()   // el bloqueo ajeno sigue en pie
    } finally {
      await admin.auth.admin.updateUserById(ajenoId, { ban_duration: 'none' })
    }
  })
})
