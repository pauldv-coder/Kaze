import { describe, it, expect, afterAll } from 'vitest'
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getUsers, inviteUserCore, setRoleCore, deactivateUserCore, reactivateUserCore } from '@/lib/data/users'

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: 'kaze' }, auth: { persistSession: false } }
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

  // Duplicar el CORREO ya no es un error (auth.users es compartida); duplicar la MEMBRESÍA sí.
  it('inviteUserCore rechaza a quien ya es miembro con mensaje claro', async () => {
    await expect(inviteUserCore(admin, { email: EMAIL, nombre: 'Otro', rol: 'consultor' }))
      .rejects.toThrow(/ya es miembro/i)
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

describe('inviteUserCore con auth.users compartida', () => {
  it('crea la fila de profiles al invitar a alguien nuevo', async () => {
    const email = `nuevo-${Date.now()}@cota.test`
    const { userId } = await inviteUserCore(admin, { email, nombre: 'Nueva Persona', rol: 'consultor' })
    cleanupIds.push(userId)
    const { data } = await admin.from('profiles').select('nombre, rol').eq('id', userId).single()
    expect(data?.nombre).toBe('Nueva Persona')
    expect(data?.rol).toBe('consultor')
  })

  it('da acceso a un usuario que ya existe en auth.users sin crear otro', async () => {
    const { data: antes } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const ajeno = antes.users.find(u => u.email === 'ajeno@cota.test')!
    const { userId } = await inviteUserCore(admin, {
      email: 'ajeno@cota.test', nombre: 'Ajeno Sin Acceso', rol: 'consultor',
    })
    try {
      expect(userId).toBe(ajeno.id)
      const { data } = await admin.from('profiles').select('id').eq('id', ajeno.id).single()
      expect(data).not.toBeNull()
    } finally {
      // Devolver a ajeno a su estado de no-miembro. Va en `finally` a propósito: si una aserción
      // falla, la limpieza igual corre. Fuera del `finally` (como estaba), un fallo aquí dejaba a
      // ajeno con membresía y rompía tests/data/rls-no-miembro.test.ts en TODAS las corridas
      // siguientes hasta un `npm run db:reset`.
      await admin.from('profiles').delete().eq('id', ajeno.id)
    }
  })
})
