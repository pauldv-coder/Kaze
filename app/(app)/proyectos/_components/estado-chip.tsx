const MAP: Record<string, { label: string; cls: string; dot: string }> = {
  progreso: { label: 'En progreso', cls: 'text-estado-bien bg-estado-bien/10 border-estado-bien/25', dot: 'bg-estado-bien' },
  riesgo:   { label: 'En riesgo',   cls: 'text-estado-mal bg-estado-mal/10 border-estado-mal/25',   dot: 'bg-estado-mal' },
  cerrado:  { label: 'Cerrado',     cls: 'text-apagado bg-panel border-borde',                       dot: 'bg-apagado' },
  nuevo:    { label: 'Por iniciar', cls: 'text-apagado bg-panel border-borde',                       dot: 'bg-borde' },
}

export function EstadoChip({ estado }: { estado: string | null }) {
  const e = MAP[estado ?? ''] ?? MAP.nuevo
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold ${e.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${e.dot}`} />
      {e.label}
    </span>
  )
}
