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
    // h-dvh (altura DEFINIDA, no min-h-screen): el shell mide exactamente el viewport y el
    // scroll vive dentro. Con min-h-screen el contenedor crecía con el contenido, así que el
    // h-full de la página heredaba esa altura crecida y el header dejaba de quedar fijo.
    // dvh y no vh por la barra de URL móvil.
    <div className="flex h-dvh overflow-hidden bg-panel max-md:flex-col">
      <Sidebar
        nombre={profile?.nombre ?? user.email ?? ''}
        iniciales={profile?.iniciales ?? ''}
        rol={profile?.rol ?? 'consultor'}
        clientes={clientes}
      />
      {/* min-h-0 deja que un hijo con overflow-auto scrollee dentro en vez de desbordar:
          sin esto, la altura mínima automática del ítem flex lo impide. overflow-auto cubre
          las páginas que NO se autolimitan (admin, contraseña), que scrollean aquí. */}
      <main className="min-h-0 min-w-0 flex-1 overflow-auto">{children}</main>
    </div>
  )
}
