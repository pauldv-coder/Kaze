import { describe, it, expect } from 'vitest'
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getProjectsList } from '@/lib/data/projects'

const db = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)
// "hoy" congelado del seed (scripts/seed.ts:22) → expectativas de vencidas estables.
const HOY = new Date('2026-06-20T12:00:00Z')

describe('getProjectsList', () => {
  it('devuelve las 8 filas ordenadas por code', async () => {
    const rows = await getProjectsList(db, HOY)
    expect(rows).toHaveLength(8)
    expect(rows.map(r => r.code)).toEqual(['A3-007','A3-009','A3-012','A3-014','A3-018','A3-021','A3-025','A3-030'])
  })

  it('A3-014: KPI principal, delta favorable, equipo y vencidas', async () => {
    const r = (await getProjectsList(db, HOY)).find(x => x.code === 'A3-014')!
    expect(r.titulo).toMatch(/conciliaciones/i)
    expect(r.cliente).toBe('Despacho Andrade & Vega')
    expect(r.estado).toBe('progreso')
    expect(r.avancePasos).toBe(4)
    expect(r.equipo).toEqual(['CV', 'DL'])
    expect(r.kpiPrincipal?.nombre).toBe('Lead time de cierre')
    expect(r.kpiPrincipal?.valor).toBeCloseTo(8.2)
    expect(r.kpiPrincipal?.deltaBueno).toBe(true)
    expect(r.kpiPrincipal?.serie.length).toBe(6)
    expect(r.accionesVencidas).toBe(1)
  })

  it('A3-021: KPI que empeora (delta no favorable)', async () => {
    const r = (await getProjectsList(db, HOY)).find(x => x.code === 'A3-021')!
    expect(r.kpiPrincipal?.nombre).toBe('Tiempo de alta de cliente')
    expect(r.kpiPrincipal?.deltaBueno).toBe(false)
    expect(r.accionesVencidas).toBe(1)
  })

  // `iniciales = ''` es el DEFAULT que escribe el trigger handle_new_user (0001_schema.sql:28),
  // así que un miembro sin iniciales no es un caso raro: es el estado de cualquier usuario recién
  // invitado. Nunca debe desaparecer del equipo.
  it('un perfil sin iniciales no borra a la persona del equipo', async () => {
    const { data: dl, error } = await db
      .from('profiles').select('id, nombre, iniciales').eq('nombre', 'Diego López').single()
    if (error) throw error
    try {
      await db.from('profiles').update({ iniciales: '' }).eq('id', dl.id)
      const sinIniciales = (await getProjectsList(db, HOY)).find(x => x.code === 'A3-014')!
      expect(sinIniciales.equipo).toEqual(['CV', 'DL'])  // derivadas del nombre

      await db.from('profiles').update({ nombre: '' }).eq('id', dl.id)
      const sinNombre = (await getProjectsList(db, HOY)).find(x => x.code === 'A3-014')!
      expect(sinNombre.equipo).toEqual(['CV', '?'])      // sin dato usable, pero sigue en el equipo
    } finally {
      await db.from('profiles').update({ nombre: dl.nombre, iniciales: dl.iniciales }).eq('id', dl.id)
    }
  })

  // Las acciones se agrupan por proyecto antes del map: un proyecto sin acciones no debe caer en
  // un undefined ni heredar el conteo de otro.
  it('un proyecto sin acciones cuenta 0 vencidas', async () => {
    const rows = await getProjectsList(db, HOY)
    expect(rows.find(x => x.code === 'A3-007')!.accionesVencidas).toBe(0)
    expect(rows.find(x => x.code === 'A3-030')!.accionesVencidas).toBe(0)
    expect(rows.reduce((s, r) => s + r.accionesVencidas, 0)).toBe(2)
  })

  it('A3-009 y A3-030 no tienen KPI en el seed → kpiPrincipal null', async () => {
    const rows = await getProjectsList(db, HOY)
    expect(rows.find(x => x.code === 'A3-009')!.kpiPrincipal).toBeNull()
    expect(rows.find(x => x.code === 'A3-030')!.kpiPrincipal).toBeNull()
    expect(rows.find(x => x.code === 'A3-030')!.avancePasos).toBe(1)
  })
})
