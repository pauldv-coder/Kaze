import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

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
