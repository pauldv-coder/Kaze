import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { esVencida } from '@/lib/data/metrics'
import { selectAllRows } from '@/lib/data/query'

type DB = SupabaseClient<Database>

export type ProjectsSummary = {
  total: number
  activos: number
  enRiesgo: number
  accionesVencidas: number
  cerrados: number
  ahorroAnual: number
  inversion: number
  nCasos: number
}

export type SidebarCliente = { id: string; nombre: string; nProyectos: number }

export async function getProjectsSummary(db: DB, hoy: Date = new Date()): Promise<ProjectsSummary> {
  const projects = await selectAllRows('projects', db.from('projects').select('estado', { count: 'exact' }))
  const actions = await selectAllRows('actions', db.from('actions').select('vence, estado', { count: 'exact' }))
  const cases = await selectAllRows('business_cases', db.from('business_cases').select('ahorro_bruto_anual, capex', { count: 'exact' }))

  const count = (e: string) => projects.filter(p => p.estado === e).length
  return {
    total: projects.length,
    activos: count('progreso') + count('riesgo'),
    enRiesgo: count('riesgo'),
    accionesVencidas: actions.filter(a => esVencida(a.vence, a.estado, hoy)).length,
    cerrados: count('cerrado'),
    ahorroAnual: cases.reduce((s, c) => s + Number(c.ahorro_bruto_anual ?? 0), 0),
    inversion: cases.reduce((s, c) => s + Number(c.capex ?? 0), 0),
    nCasos: cases.length,
  }
}

export async function getSidebarClientes(db: DB): Promise<SidebarCliente[]> {
  const projects = await selectAllRows('projects', db.from('projects').select('client_id', { count: 'exact' }))
  // `nombre` no es único: sin el desempate por `id`, dos clientes homónimos se alternan entre recargas.
  const clients = await selectAllRows('clients', db.from('clients').select('id, nombre', { count: 'exact' }).order('nombre').order('id'))
  const countBy = new Map<string, number>()
  for (const p of projects) if (p.client_id) countBy.set(p.client_id, (countBy.get(p.client_id) ?? 0) + 1)
  return clients
    .map(c => ({ id: c.id, nombre: c.nombre, nProyectos: countBy.get(c.id) ?? 0 }))
    .filter(c => c.nProyectos > 0)
}
