'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function updatePassword(formData: FormData) {
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')
  if (password.length < 8) redirect(`/cuenta/contrasena?error=${encodeURIComponent('Mínimo 8 caracteres')}`)
  if (password !== confirm) redirect(`/cuenta/contrasena?error=${encodeURIComponent('Las contraseñas no coinciden')}`)

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) redirect(`/cuenta/contrasena?error=${encodeURIComponent(error.message)}`)
  redirect('/proyectos')
}
