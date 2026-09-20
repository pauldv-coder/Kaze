import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { selectAllRows } from '@/lib/data/query'

export async function getClients(db: SupabaseClient<Database>) {
  // `nombre` no es único: el desempate por `id` evita que dos homónimos se alternen entre recargas.
  return selectAllRows('clients', db.from('clients').select('*', { count: 'exact' }).order('nombre').order('id'))
}
