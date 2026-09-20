'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signOut() {
  const supabase = await createClient()

  // scope 'local': cierra SOLO esta sesión/este navegador. El default de supabase-js es
  // 'global', que revoca las sesiones del usuario en TODOS sus dispositivos — no es lo que
  // significa "Cerrar sesión" en el menú de cuenta.
  const { error } = await supabase.auth.signOut({ scope: 'local' })

  // Si falla, la cookie de sesión sigue viva: /login vería sesión y rebotaría a /proyectos,
  // así que el usuario vería "no pasó nada". Se lanza para que lo recoja el boundary de
  // error (el menú de cuenta vive en el layout, así que lo atrapa app/global-error.tsx).
  // Nota: se lanza un mensaje propio y genérico; el de Supabase solo va al log del servidor.
  if (error) {
    console.error('[signOut] no se pudo cerrar la sesión:', error.message)
    throw new Error('No se pudo cerrar la sesión')
  }

  // redirect() lanza por diseño: fuera de cualquier try/catch.
  redirect('/login')
}
