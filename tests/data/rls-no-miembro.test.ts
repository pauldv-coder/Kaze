import { describe, it, expect, beforeAll } from 'vitest'
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getProjectsList } from '@/lib/data/projects'
import { getProjectsSummary } from '@/lib/data/summary'

// Cliente ANON firmado como un usuario que existe en auth.users pero NO tiene
// fila en kaze.profiles: el equivalente a alguien del CMS. Debe ver CERO.
const db = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { db: { schema: 'kaze' }, auth: { persistSession: false } }
)
const HOY = new Date('2026-06-20T12:00:00Z')

beforeAll(async () => {
  const { error } = await db.auth.signInWithPassword({
    email: 'ajeno@cota.test', password: 'cota-demo-2026',
  })
  if (error) throw error
})

describe('un authenticated que NO es miembro de Kaze', () => {
  it('no lee ningún proyecto', async () => {
    const rows = await getProjectsList(db, HOY)
    expect(rows).toHaveLength(0)
  })

  it('obtiene un resumen en cero, no los datos de los clientes', async () => {
    const s = await getProjectsSummary(db, HOY)
    expect(s.total).toBe(0)
    expect(s.ahorroAnual).toBe(0)
    expect(s.nCasos).toBe(0)
  })

  it('tampoco puede escribir', async () => {
    const { error } = await db.from('clients').insert({ nombre: 'Intruso SA' })
    // 42501 = rechazo de RLS. Sin fijar el código, esta aserción pasaría también
    // por un error trivial (columna mal escrita, NOT NULL) y parecería idéntica.
    expect(error?.code).toBe('42501')
  })
})
