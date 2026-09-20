import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { deltaFavorable, deltaSerie, diaDelNegocio, esVencidaEn, relativeDate } from '@/lib/data/metrics'
import { selectAllRows } from '@/lib/data/query'
import { iniciales as inicialesDeNombre } from '@/lib/data/users'

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
  const projects = await selectAllRows('projects', db
    .from('projects')
    .select('id, code, titulo, estado, avance_pasos, updated_at, consultor_id, lider_id, miembros, client:clients(nombre)', { count: 'exact' })
    .order('code'))

  const profiles = await selectAllRows('profiles', db.from('profiles').select('id, nombre, iniciales', { count: 'exact' }))
  // `iniciales` viene vacía en todo perfil recién creado (default del trigger handle_new_user):
  // se derivan del nombre antes que dejar a la persona fuera del equipo.
  const iniById = new Map(profiles.map(p => [p.id, p.iniciales?.trim() || inicialesDeNombre(p.nombre) || '?']))

  // El desempate por `id` no es cosmético: un insert de varias filas les da el mismo `created_at` y
  // Postgres devuelve los empates en orden indefinido — sin él, cuál es el KPI principal (y cuál el
  // último valor de la serie) cambia entre recargas sin que cambien los datos.
  const kpis = await selectAllRows('kpis', db
    .from('kpis').select('id, project_id, nombre, unidad, mejor_baja, created_at', { count: 'exact' })
    .order('created_at').order('id'))
  const meas = await selectAllRows('measurements', db
    .from('measurements').select('kpi_id, valor, fecha', { count: 'exact' })
    .order('fecha').order('created_at').order('id'))
  const serieByKpi = new Map<string, number[]>()
  for (const m of meas) {
    const arr = serieByKpi.get(m.kpi_id) ?? []
    arr.push(Number(m.valor))
    serieByKpi.set(m.kpi_id, arr)
  }

  const actions = await selectAllRows('actions', db.from('actions').select('project_id, vence, estado', { count: 'exact' }))
  // Agrupadas por proyecto: filtrar el array entero dentro del map era O(proyectos × acciones).
  const actionsByProject = new Map<string, typeof actions>()
  for (const a of actions) {
    if (!a.project_id) continue
    const arr = actionsByProject.get(a.project_id) ?? []
    arr.push(a)
    actionsByProject.set(a.project_id, arr)
  }
  // El día del negocio se resuelve UNA vez: cada `diaDelNegocio` cuesta ~12× la comparación.
  const hoyDia = diaDelNegocio(hoy)

  return projects.map(p => {
    const equipo = [p.consultor_id, p.lider_id, ...(p.miembros ?? [])]
      .filter((id): id is string => !!id)
      .filter((id, i, a) => a.indexOf(id) === i)
      // '?' y no descartar: un perfil ilegible o sin datos igual ocupa un lugar en el equipo.
      .map(id => iniById.get(id) ?? '?')

    let kpiPrincipal: ProjectListRow['kpiPrincipal'] = null
    for (const k of kpis.filter(k => k.project_id === p.id)) {
      const serie = serieByKpi.get(k.id) ?? []
      if (serie.length >= 2) {
        kpiPrincipal = {
          nombre: k.nombre,
          unidad: k.unidad,
          valor: serie[serie.length - 1],
          delta: deltaSerie(serie),
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
      accionesVencidas: (actionsByProject.get(p.id) ?? []).filter(a => esVencidaEn(a.vence, a.estado, hoyDia)).length,
      updated: relativeDate(p.updated_at, hoy),
    }
  })
}
