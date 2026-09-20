'use client'
import { useState } from 'react'
import Link from 'next/link'
import { signOut } from '../actions'

export function AccountMenu({ nombre, iniciales, rol }: { nombre: string; iniciales: string; rol: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-56 rounded-lg border border-borde bg-white p-1 text-tinta shadow-lg">
          <Link href="/cuenta/contrasena" onClick={() => setOpen(false)}
            className="block rounded-md px-3 py-2 text-sm hover:bg-panel">Cuenta</Link>
          {rol === 'admin' && (
            <Link href="/admin" onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm hover:bg-panel">Administración</Link>
          )}
          <form action={signOut}>
            <button className="block w-full rounded-md px-3 py-2 text-left text-sm text-estado-mal hover:bg-panel">
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
      <button onClick={() => setOpen(v => !v)} className="flex w-full items-center gap-2.5 rounded-md p-1 text-left hover:bg-white/5">
        <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-white/10 font-display text-[11px] font-bold text-marca">{iniciales}</span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold text-white">{nombre}</span>
          <span className="block text-[10.5px] capitalize text-white/45">{rol}</span>
        </span>
      </button>
    </div>
  )
}
