import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSidebarClientes } from '@/lib/data/summary'
import { Sidebar } from './_components/sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('nombre, iniciales, rol').eq('id', user.id).single()
  const clientes = await getSidebarClientes(supabase)

  return (
    <div className="flex min-h-screen bg-panel max-md:flex-col">
      <Sidebar
        nombre={profile?.nombre ?? user.email ?? ''}
        iniciales={profile?.iniciales ?? ''}
        rol={profile?.rol ?? 'consultor'}
        clientes={clientes}
      />
      {/* min-h-0 deja que un hijo con overflow-auto scrollee dentro de <main> en vez de
          desbordarlo: sin esto, la altura mínima automática del ítem flex lo impide. */}
      <main className="min-h-0 min-w-0 flex-1">{children}</main>
    </div>
  )
}
