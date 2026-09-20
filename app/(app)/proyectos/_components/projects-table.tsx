import type { ProjectListRow } from '@/lib/data/projects'
import { EstadoChip } from './estado-chip'
import { A3Progress } from './a3-progress'
import { Sparkline } from './sparkline'
import { TeamAvatars } from './team-avatars'

const COLS = 'grid-cols-[minmax(200px,2.4fr)_120px_minmax(120px,150px)_minmax(170px,1.4fr)_84px_92px]'

// Ancho mínimo REAL de la rejilla, no uno redondeado a ojo: si min-w se queda corto las
// filas dibujan fuera de su propia tarjeta blanca (la última columna quedaba sobre el
// fondo gris de la página). Mínimos de pista 200+120+120+170+84+92 = 786, más 5 gap-4
// (5x16 = 80), más px-4 a cada lado (2x16 = 32) y el borde de 1px de la fila (2) = 900.
// Se sube el min-w en vez de apretar gap/padding: con gap-3 + px-3 aún harían falta 872,
// así que no cabe en 860 sin romper el ritmo visual del prototipo.
const MIN_W = 'min-w-[900px]'

export function ProjectsTable({ rows }: { rows: ProjectListRow[] }) {
  if (rows.length === 0) {
    return <div className="py-16 text-center text-sm text-apagado">Ningún proyecto todavía.</div>
  }
  return (
    <div className="overflow-x-auto">
      <div className={MIN_W}>
        <div className={`grid ${COLS} items-center gap-4 px-4 pb-3`}>
          {['Proyecto', 'Estado', 'A3 · completitud', 'Indicador principal', 'Equipo', 'Actualizado'].map(h => (
            <div key={h} className="text-[10.5px] font-semibold uppercase tracking-wider text-apagado">{h}</div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {rows.map(p => (
            <div key={p.id} className={`grid ${COLS} items-center gap-4 rounded-lg border border-borde bg-white px-4 py-3.5`}>
              <div className="min-w-0">
                <div className="truncate font-display text-sm font-semibold">{p.titulo}</div>
                <div className="mt-0.5 flex items-center gap-1.5 truncate text-[11.5px] text-apagado">
                  <span className="tabular-nums">{p.code}</span><span>·</span>
                  <span className="truncate">{p.cliente ?? '—'}</span>
                </div>
              </div>
              <div><EstadoChip estado={p.estado} /></div>
              <A3Progress done={p.avancePasos} />
              <div className="flex min-w-0 items-center gap-3">
                {p.kpiPrincipal ? (
                  <>
                    <Sparkline serie={p.kpiPrincipal.serie} />
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-display text-base font-bold tabular-nums leading-none">
                          {p.kpiPrincipal.valor.toLocaleString('es')}
                        </span>
                        <span className="text-[11px] font-semibold text-apagado">{p.kpiPrincipal.unidad}</span>
                        <span className={`text-[11px] font-bold ${p.kpiPrincipal.delta === 0 ? 'text-apagado' : p.kpiPrincipal.deltaBueno ? 'text-estado-bien' : 'text-estado-mal'}`}>
                          {p.kpiPrincipal.delta === 0
                            ? '—'
                            : `${p.kpiPrincipal.delta < 0 ? '▼' : '▲'} ${Math.abs(p.kpiPrincipal.delta).toLocaleString('es', { maximumFractionDigits: 1 })}`}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-[10.5px] text-apagado">{p.kpiPrincipal.nombre}</div>
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-apagado">Sin tendencia aún</span>
                )}
              </div>
              <TeamAvatars iniciales={p.equipo} />
              <div>
                <div className="text-xs font-medium text-tinta">{p.updated}</div>
                {p.accionesVencidas > 0 && (
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] font-semibold text-estado-mal">
                    <span className="h-[5px] w-[5px] rounded-full bg-estado-mal" />
                    {p.accionesVencidas} {p.accionesVencidas === 1 ? 'acción vencida' : 'acciones vencidas'}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
