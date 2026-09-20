import type { ProjectsSummary } from '@/lib/data/summary'

function miles(n: number) {
  return '$' + Math.round(n / 1000) + 'k'
}

export function SummaryStrip({ s }: { s: ProjectsSummary }) {
  const cells = [
    { val: String(s.total), sub: 'Proyectos totales', color: 'text-tinta' },
    { val: String(s.activos), sub: 'Activos', color: 'text-estado-bien' },
    { val: String(s.enRiesgo), sub: 'Requiere atención', color: 'text-estado-mal' },
    { val: String(s.accionesVencidas), sub: 'Acciones vencidas', color: 'text-tinta' },
    { val: String(s.cerrados), sub: 'Cerrados', color: 'text-apagado' },
    { val: `${miles(s.ahorroAnual)}/año`, sub: `${miles(s.inversion)} inv · ${s.nCasos} casos`, color: 'text-estado-bien' },
  ]
  return (
    <div className="mb-5 grid grid-cols-2 overflow-hidden rounded-lg border border-borde sm:grid-cols-3 lg:grid-cols-6">
      {cells.map((c, i) => (
        <div key={i} className="border-b border-borde px-4 py-3 sm:border-r sm:[&:nth-child(3n)]:border-r-0 lg:border-b-0 lg:[&:nth-child(3n)]:border-r lg:[&:last-child]:border-r-0">
          <div className={`font-display text-2xl font-bold tabular-nums ${c.color}`}>{c.val}</div>
          <div className="mt-0.5 text-[11.5px] text-apagado">{c.sub}</div>
        </div>
      ))}
    </div>
  )
}
