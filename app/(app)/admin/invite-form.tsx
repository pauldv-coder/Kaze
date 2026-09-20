'use client'
import { useActionState } from 'react'
import { inviteUser, type InviteState } from './actions'

const initial: InviteState = { ok: false }

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteUser, initial)
  return (
    <div className="bg-white border border-borde rounded-lg p-6 space-y-3">
      <h2 className="font-display font-bold">Invitar usuario</h2>
      <form action={action} className="flex flex-wrap gap-2">
        <input name="nombre" required placeholder="Nombre" className="border border-borde rounded-md px-3 py-2 text-sm" />
        <input name="email" type="email" required placeholder="Correo" className="border border-borde rounded-md px-3 py-2 text-sm" />
        <select name="rol" className="border border-borde rounded-md px-2 py-2 text-sm">
          <option value="consultor">consultor</option>
          <option value="admin">admin</option>
        </select>
        <button disabled={pending} className="bg-tinta text-white rounded-md px-4 py-2 text-sm font-semibold">
          {pending ? 'Invitando…' : 'Generar invitación'}
        </button>
      </form>
      {state.error && <p className="text-estado-mal text-xs">{state.error}</p>}
      {state.ok && state.yaTeniaCuenta && (
        <p className="text-xs">
          Acceso concedido a <b>{state.email}</b>. Ya tenía cuenta en el ecosistema Vento: ya puede entrar con su contraseña actual.
        </p>
      )}
      {state.ok && state.link && (
        <div className="text-xs space-y-1">
          <p>Invitación creada para <b>{state.email}</b>. Cópiale este enlace (caduca según la config del proyecto):</p>
          <div className="flex gap-2 items-center">
            <code className="bg-panel border border-borde rounded px-2 py-1 break-all">{state.link}</code>
            <button type="button" onClick={() => navigator.clipboard.writeText(state.link!)}
                    className="border border-borde rounded-md px-2 py-1">Copiar</button>
          </div>
        </div>
      )}
    </div>
  )
}
