'use server'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { inviteUserCore, setRoleCore, deactivateUserCore, reactivateUserCore, type RolInterno } from '@/lib/data/users'

// `link` solo existe cuando hubo que crear la cuenta. Si la persona ya tenía cuenta
// en el ecosistema Vento (auth.users es compartida), no hay enlace que copiar: entra
// con su contraseña actual y lo único que cambió es que ya es miembro de Kaze.
export type InviteState = { ok: boolean; link?: string; email?: string; error?: string; yaTeniaCuenta?: boolean }

export async function inviteUser(_prev: InviteState, formData: FormData): Promise<InviteState> {
  await requireAdmin()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const nombre = String(formData.get('nombre') ?? '').trim()
  const rol = String(formData.get('rol') ?? 'consultor') as RolInterno
  if (!email || !nombre) return { ok: false, error: 'Correo y nombre son obligatorios' }
  try {
    const { tokenHash }: { tokenHash: string | null } = await inviteUserCore(createAdminClient(), { email, nombre, rol })
    revalidatePath('/admin')
    if (tokenHash === null) return { ok: true, email, yaTeniaCuenta: true }
    const h = await headers()
    const origin = h.get('origin') ?? `https://${h.get('host')}`
    return { ok: true, email, link: `${origin}/auth/confirm?token_hash=${tokenHash}&type=invite` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al invitar' }
  }
}

export async function setRole(formData: FormData) {
  await requireAdmin()
  await setRoleCore(createAdminClient(), String(formData.get('userId')), String(formData.get('rol')) as RolInterno)
  revalidatePath('/admin')
}

export async function deactivateUser(formData: FormData) {
  const me = await requireAdmin()
  const userId = String(formData.get('userId'))
  if (userId === me.id) throw new Error('no puedes desactivarte a ti mismo')
  await deactivateUserCore(createAdminClient(), userId)
  revalidatePath('/admin')
}

export async function reactivateUser(formData: FormData) {
  await requireAdmin()
  await reactivateUserCore(createAdminClient(), String(formData.get('userId')))
  revalidatePath('/admin')
}
