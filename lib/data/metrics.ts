// Helpers puros de métricas de proyecto. `hoy` se inyecta para tests deterministas
// (el dato demo está anclado al "hoy" congelado 2026-06-20 del prototipo/seed).

export function deltaFavorable(serie: number[], mejorBaja: boolean): boolean {
  if (serie.length < 2) return false
  const delta = serie[serie.length - 1] - serie[0]
  if (delta === 0) return false
  return mejorBaja ? delta < 0 : delta > 0
}

export function esVencida(vence: string | null, estado: string | null, hoy: Date): boolean {
  if (!vence || estado === 'done') return false
  return new Date(`${vence}T00:00:00Z`) < hoy
}

export function relativeDate(iso: string, hoy: Date): string {
  const dias = Math.floor((hoy.getTime() - new Date(iso).getTime()) / 86_400_000)
  if (dias <= 0) return 'Hoy'
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} d`
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}
