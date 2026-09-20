// Helpers puros de métricas de proyecto. `hoy` se inyecta para tests deterministas
// (el dato demo está anclado al "hoy" congelado 2026-06-20 del prototipo/seed).

/** Zona horaria del negocio: los días de calendario se cuentan aquí, no en UTC ni en la del servidor. */
export const TZ = 'America/Bogota'

// en-CA rinde el formato ISO 'YYYY-MM-DD', que es exactamente el de una columna `date` de Postgres.
const diaFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Día de calendario ('YYYY-MM-DD') al que pertenece un instante en la zona del negocio. */
export function diaDelNegocio(instante: Date): string {
  // Se arma por partes y no con format() para no depender del patrón que traiga el ICU del runtime:
  // un Node con small-icu no conoce en-CA, cae a en-US y devolvería 'MM/DD/YYYY' sin avisar — lo que
  // rompería en silencio la comparación con las columnas `date`.
  const p = Object.fromEntries(diaFmt.formatToParts(instante).map(({ type, value }) => [type, value]))
  return `${p.year}-${p.month}-${p.day}`
}

/** Días de calendario entre dos días 'YYYY-MM-DD' (exacto: ambos se anclan a medianoche UTC). */
function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000)
}

/** Variación de la serie: último menos primero. Serie plana o de menos de dos puntos → 0. */
export function deltaSerie(serie: number[]): number {
  if (serie.length < 2) return 0
  return serie[serie.length - 1] - serie[0]
}

export function deltaFavorable(serie: number[], mejorBaja: boolean): boolean {
  const delta = deltaSerie(serie)
  if (delta === 0) return false
  return mejorBaja ? delta < 0 : delta > 0
}

// `vence` es una columna `date` ('YYYY-MM-DD'), no un instante: se compara contra el día de
// calendario del negocio. Comparar contra un Date en UTC daba por vencido lo que vence hoy.
export function esVencida(vence: string | null, estado: string | null, hoy: Date): boolean {
  if (!vence || estado === 'done') return false
  return vence < diaDelNegocio(hoy)
}

export function relativeDate(iso: string, hoy: Date): string {
  const dias = diasEntre(diaDelNegocio(new Date(iso)), diaDelNegocio(hoy))
  if (dias <= 0) return 'Hoy'
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} d`
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', timeZone: TZ })
}
