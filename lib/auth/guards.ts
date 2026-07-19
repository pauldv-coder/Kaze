import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Gate de UI y de server actions: sesión + rol admin. Las server actions DEBEN llamarlo
// (el gate de la página sola no es seguridad).
export async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') redirect('/proyectos')
  return user
}
