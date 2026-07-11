import { createClient } from '@/lib/supabase/server'
import { getProjects } from '@/lib/data/projects'

export default async function ProyectosPage() {
  const supabase = await createClient()
  const projects = await getProjects(supabase)

  return (
    <main className="p-10">
      <h1 className="font-display text-2xl font-bold mb-6">Proyectos A3</h1>
      <ul className="space-y-2">
        {projects.map((p) => (
          <li key={p.id} className="bg-white border border-borde rounded-lg px-4 py-3 flex gap-3">
            <span className="font-mono text-sm text-marca">{p.code}</span>
            <span className="text-sm">{p.titulo}</span>
            <span className="text-xs text-apagado ml-auto">{p.client?.nombre}</span>
          </li>
        ))}
      </ul>
    </main>
  )
}
