import { describe, it, expect } from 'vitest'
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getProjectsSummary, getSidebarClientes } from '@/lib/data/summary'

const db = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)
const HOY = new Date('2026-06-20T12:00:00Z')

describe('getProjectsSummary', () => {
  it('métricas del seed', async () => {
    const s = await getProjectsSummary(db, HOY)
    expect(s.total).toBe(8)
    expect(s.activos).toBe(5)      // progreso 4 + riesgo 1
    expect(s.enRiesgo).toBe(1)
    expect(s.cerrados).toBe(2)
    expect(s.accionesVencidas).toBe(2)   // AC-41 (A3-014) + AC-52 (A3-021) al 2026-06-20
    expect(s.ahorroAnual).toBe(53500)    // 32000 + 21500
    expect(s.inversion).toBe(25500)      // 18000 + 7500
    expect(s.nCasos).toBe(2)
  })
})

describe('getSidebarClientes', () => {
  it('clientes con conteo de proyectos, ordenados por nombre', async () => {
    const cs = await getSidebarClientes(db)
    expect(cs).toHaveLength(5)
    expect(cs[0].nombre).toBe('Clínica Norte')
    expect(cs.find(c => c.nombre === 'Despacho Andrade & Vega')!.nProyectos).toBe(2)
    expect(cs.find(c => c.nombre === 'Clínica Norte')!.nProyectos).toBe(1)
  })
})
