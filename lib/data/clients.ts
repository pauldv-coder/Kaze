import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

export async function getClients(db: SupabaseClient<Database>) {
  const { data, error } = await db.from('clients').select('*').order('nombre')
  if (error) throw error
  return data
}
