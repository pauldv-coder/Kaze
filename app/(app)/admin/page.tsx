import { requireAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUsers } from '@/lib/data/users'
import { InviteForm } from './invite-form'
import { setRole, deactivateUser, reactivateUser } from './actions'

export default async function AdminPage() {
  const me = await requireAdmin()
  const users = await getUsers(createAdminClient())

  return (
    <main className="p-10 space-y-6">
      <h1 className="font-display text-2xl font-bold">Administración de usuarios</h1>
      <InviteForm />
      <ul className="space-y-2">
        {users.map(u => (
          <li key={u.id} className="bg-white border border-borde rounded-lg px-4 py-3 flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs text-marca w-8">{u.iniciales}</span>
            <span className="text-sm">{u.nombre}</span>
            <span className="text-xs text-apagado">{u.email}</span>
            <span className="text-xs border border-borde rounded px-2 py-0.5">{u.rol}</span>
            {!u.activo && <span className="text-xs text-estado-mal">desactivado</span>}
            <span className="ml-auto flex gap-2 items-center">
              {u.id !== me.id && (
                <>
                  <form action={setRole}>
                    <input type="hidden" name="userId" value={u.id} />
                    <input type="hidden" name="rol" value={u.rol === 'admin' ? 'consultor' : 'admin'} />
                    <button className="text-xs border border-borde rounded-md px-2 py-1">
                      hacer {u.rol === 'admin' ? 'consultor' : 'admin'}
                    </button>
                  </form>
                  <form action={u.activo ? deactivateUser : reactivateUser}>
                    <input type="hidden" name="userId" value={u.id} />
                    <button className="text-xs border border-borde rounded-md px-2 py-1">
                      {u.activo ? 'desactivar' : 'reactivar'}
                    </button>
                  </form>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </main>
  )
}
