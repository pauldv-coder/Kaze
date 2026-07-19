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
