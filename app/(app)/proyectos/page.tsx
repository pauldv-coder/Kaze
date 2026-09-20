import { createClient } from '@/lib/supabase/server'
import { getProjectsList } from '@/lib/data/projects'
import { getProjectsSummary } from '@/lib/data/summary'
import { SummaryStrip } from './_components/summary-strip'
import { ProjectsTable } from './_components/projects-table'

export default async function ProyectosPage() {
  const supabase = await createClient()
  const [rows, summary] = await Promise.all([getProjectsList(supabase), getProjectsSummary(supabase)])

  return (
    // h-full, NO h-screen: en móvil la sidebar se colapsa a un header superior que ya consume
    // parte del viewport, así que pedir 100vh aquí desbordaba <main> y dejaba dos scrolls.
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-borde bg-white px-7 pt-5">
        <div className="mb-4">
          <h1 className="font-display text-[22px] font-bold tracking-tight">Proyectos</h1>
          <p className="mt-0.5 text-[12.5px] text-apagado">Cartera de mejoras lean en curso</p>
        </div>
      </header>
      <div className="flex-1 overflow-auto px-7 py-5">
        <SummaryStrip s={summary} />
        <ProjectsTable rows={rows} />
      </div>
    </div>
  )
}
