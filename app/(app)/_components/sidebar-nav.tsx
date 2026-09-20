'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { label: 'Proyectos', href: '/proyectos' },
  { label: 'Mapas de valor · VSM', href: null },
  { label: 'Acciones', href: null },
  { label: 'Indicadores', href: null },
  { label: 'Casos de negocio', href: null },
  { label: 'Plantillas A3', href: null },
] as const

export function SidebarNav() {
  const path = usePathname()
  return (
    <nav className="flex flex-col gap-px px-2">
      {ITEMS.map(it => {
        const active = it.href && path.startsWith(it.href)
        if (!it.href) {
          return (
            <span key={it.label} title="Próximamente"
              className="flex cursor-default items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-white/35">
              <span className="h-3.5 w-1 rounded-sm bg-transparent" />{it.label}
            </span>
          )
        }
        return (
          <Link key={it.label} href={it.href}
            className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] ${active ? 'bg-white/10 font-semibold text-white' : 'text-white/70 hover:bg-white/5'}`}>
            <span className={`h-3.5 w-1 rounded-sm ${active ? 'bg-marca' : 'bg-transparent'}`} />{it.label}
          </Link>
        )
      })}
    </nav>
  )
}
