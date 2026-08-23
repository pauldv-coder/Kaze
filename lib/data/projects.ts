import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { deltaFavorable, esVencida, relativeDate } from '@/lib/data/metrics'

type DB = SupabaseClient<Database>

// Nota: projects tiene DOS FKs a profiles (consultor_id, lider_id). Cualquier embed futuro de
// profiles necesita hint: consultor:profiles!projects_consultor_id_fkey(...), lider:profiles!projects_lider_id_fkey(...)
export async function getProjects(db: DB) {
  const { data, error } = await db
    .from('projects')
    .select('id, code, titulo, estado, ahorro_anual, client:clients(id, nombre, iniciales)')
    .order('code')
  if (error) throw error
  return data
}

export async function getProjectByCode(db: DB, code: string) {
  const { data, error } = await db
    .from('projects')
    .select('*, client:clients(id, nombre, iniciales)')
    .eq('code', code)
    .maybeSingle()
  if (error) throw error
  return data
}

export type ProjectListRow = {
  id: string
  code: string
  titulo: string
  cliente: string | null
  estado: string | null
  avancePasos: number
  equipo: string[]
  kpiPrincipal: {
    nombre: string
    unidad: string | null
    valor: number
    delta: number
    deltaBueno: boolean
    serie: number[]
  } | null
  accionesVencidas: number
  updated: string
}

// Nota: projects tiene DOS FKs a profiles (consultor_id, lider_id) y miembros es uuid[]
// (no embebible). Por eso el equipo se resuelve cargando profiles a un Map, sin embeds.
export async function getProjectsList(db: DB, hoy: Date = new Date()): Promise<ProjectListRow[]> {
  const { data: projects, error } = await db
    .from('projects')
    .select('id, code, titulo, estado, avance_pasos, updated_at, consultor_id, lider_id, miembros, client:clients(nombre)')
    .order('code')
  if (error) throw error

  const { data: profiles, error: pErr } = await db.from('profiles').select('id, iniciales')
  if (pErr) throw pErr
  const iniById = new Map(profiles.map(p => [p.id, p.iniciales ?? '']))

  const { data: kpis, error: kErr } = await db
    .from('kpis').select('id, project_id, nombre, unidad, mejor_baja, created_at').order('created_at')
  if (kErr) throw kErr
  const { data: meas, error: mErr } = await db
    .from('measurements').select('kpi_id, valor, fecha').order('fecha')
  if (mErr) throw mErr
  const serieByKpi = new Map<string, number[]>()
  for (const m of meas) {
    const arr = serieByKpi.get(m.kpi_id) ?? []
    arr.push(Number(m.valor))
    serieByKpi.set(m.kpi_id, arr)
  }

  const { data: actions, error: aErr } = await db.from('actions').select('project_id, vence, estado')
  if (aErr) throw aErr

  return projects.map(p => {
    const equipo = [p.consultor_id, p.lider_id, ...(p.miembros ?? [])]
      .filter((id): id is string => !!id)
      .filter((id, i, a) => a.indexOf(id) === i)
      .map(id => iniById.get(id) ?? '')
      .filter(Boolean)

    let kpiPrincipal: ProjectListRow['kpiPrincipal'] = null
    for (const k of kpis.filter(k => k.project_id === p.id)) {
      const serie = serieByKpi.get(k.id) ?? []
      if (serie.length >= 2) {
        kpiPrincipal = {
          nombre: k.nombre,
          unidad: k.unidad,
          valor: serie[serie.length - 1],
          delta: serie[serie.length - 1] - serie[0],
          deltaBueno: deltaFavorable(serie, k.mejor_baja),
          serie,
        }
        break
      }
    }

    return {
      id: p.id,
      code: p.code,
      titulo: p.titulo,
      cliente: p.client?.nombre ?? null,
      estado: p.estado,
      avancePasos: p.avance_pasos,
      equipo,
      kpiPrincipal,
      accionesVencidas: actions.filter(a => a.project_id === p.id && esVencida(a.vence, a.estado, hoy)).length,
      updated: relativeDate(p.updated_at, hoy),
    }
  })
}
