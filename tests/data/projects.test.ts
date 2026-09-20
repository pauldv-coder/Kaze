import { describe, it, expect } from 'vitest'
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getProjects, getProjectByCode } from '@/lib/data/projects'

// service-role client para tests (salta RLS; valida datos, no permisos)
const db = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: 'kaze' }, auth: { persistSession: false } }
)

describe('data/projects', () => {
  it('getProjects devuelve los 8 A3 del seed', async () => {
    const rows = await getProjects(db)
    expect(rows).toHaveLength(8)
    expect(rows.map(r => r.code)).toContain('A3-014')
  })

  it('getProjectByCode trae un A3 con su cliente', async () => {
    const p = await getProjectByCode(db, 'A3-014')
    expect(p?.titulo).toMatch(/conciliaciones/i)
    expect(p?.client?.nombre).toBe('Despacho Andrade & Vega')
  })
})
