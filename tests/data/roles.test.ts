import { describe, it, expect, beforeAll } from 'vitest'
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
// Cliente ANON autenticado como carmen: valida lo que puede hacer un usuario real vía Data API.
const authDb = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: 'kaze' }, auth: { persistSession: false } })
const admin = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { db: { schema: 'kaze' }, auth: { persistSession: false } })

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
