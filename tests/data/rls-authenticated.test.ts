import { describe, it, expect, beforeAll } from 'vitest'
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getProjectsList } from '@/lib/data/projects'
import { getProjectsSummary } from '@/lib/data/summary'

const db = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { db: { schema: 'kaze' }, auth: { persistSession: false } }
)
const HOY = new Date('2026-06-20T12:00:00Z')

beforeAll(async () => {
  const { error } = await db.auth.signInWithPassword({ email: 'carmen@cota.test', password: 'cota-demo-2026' })
  if (error) throw error
})

describe('lectura como usuario authenticated (RLS + grants)', () => {
  it('getProjectsList devuelve las 8 filas con KPI leído bajo RLS', async () => {
    const rows = await getProjectsList(db, HOY)
    expect(rows).toHaveLength(8)
    // que A3-014 traiga su KPI prueba que kpis+measurements son legibles bajo el JWT del usuario
    expect(rows.find(r => r.code === 'A3-014')!.kpiPrincipal?.nombre).toBe('Lead time de cierre')
  })

  it('getProjectsSummary lee actions y business_cases bajo RLS', async () => {
    const s = await getProjectsSummary(db, HOY)
    expect(s.total).toBe(8)
    expect(s.ahorroAnual).toBe(53500)
  })
})
