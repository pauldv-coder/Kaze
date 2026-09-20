import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { esVencida } from '@/lib/data/metrics'

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
  const { data: projects, error } = await db.from('projects').select('estado')
  if (error) throw error
  const { data: actions, error: aErr } = await db.from('actions').select('vence, estado')
  if (aErr) throw aErr
  const { data: cases, error: cErr } = await db.from('business_cases').select('ahorro_bruto_anual, capex')
  if (cErr) throw cErr

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
  const { data: projects, error } = await db.from('projects').select('client_id')
  if (error) throw error
  const { data: clients, error: cErr } = await db.from('clients').select('id, nombre').order('nombre')
  if (cErr) throw cErr
  const countBy = new Map<string, number>()
  for (const p of projects) if (p.client_id) countBy.set(p.client_id, (countBy.get(p.client_id) ?? 0) + 1)
  return clients
    .map(c => ({ id: c.id, nombre: c.nombre, nProyectos: countBy.get(c.id) ?? 0 }))
    .filter(c => c.nProyectos > 0)
}
