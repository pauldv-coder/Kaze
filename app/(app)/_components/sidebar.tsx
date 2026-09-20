import type { SidebarCliente } from '@/lib/data/summary'
import { SidebarNav } from './sidebar-nav'
import { AccountMenu } from './account-menu'

export function Sidebar({ nombre, iniciales, rol, clientes }: {
  nombre: string; iniciales: string; rol: string; clientes: SidebarCliente[]
}) {
  return (
    // md+ = barra lateral fija de 222px. Por debajo se colapsa a un header superior con
    // solo el logo y el menú de cuenta (spec §5): el nav y la lista de clientes se ocultan.
    <aside className="flex shrink-0 bg-tinta text-white/90 max-md:w-full max-md:items-center max-md:justify-between max-md:px-4 max-md:py-2.5 md:w-[222px] md:flex-col md:py-4">
      <div className="flex items-center gap-2.5 md:border-b md:border-white/10 md:px-5 md:pb-5">
        <span className="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-white/5">
          <span className="h-[11px] w-[11px] rounded-full border-[2.5px] border-marca" />
        </span>
        <span className="font-display text-base font-bold tracking-tight text-white">Kaze</span>
      </div>

      <div className="max-md:hidden">
        <div className="px-5 pb-2 pt-4 text-[10px] uppercase tracking-widest text-white/40">Espacio de trabajo</div>
        <SidebarNav />

        <div className="px-5 pb-2 pt-6 text-[10px] uppercase tracking-widest text-white/40">Clientes</div>
        <nav className="flex flex-col gap-px px-2">
          {clientes.map(c => (
            <span key={c.id} className="flex items-center justify-between rounded-md px-3 py-1.5 text-[12.5px] text-white/65">
              <span className="truncate">{c.nombre}</span>
              <span className="tabular-nums text-[11px] text-white/40">{c.nProyectos}</span>
            </span>
          ))}
        </nav>
      </div>

      <div className="md:mt-auto md:border-t md:border-white/10 md:px-3 md:pt-3">
        <AccountMenu nombre={nombre} iniciales={iniciales} rol={rol} />
      </div>
    </aside>
  )
}
