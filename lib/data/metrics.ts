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

// OJO con qué recibe cada helper: `esVencida` toma un DÍA de calendario ('YYYY-MM-DD', como la
// columna `date` de actions.vence) y `relativeDate` toma un INSTANTE ISO (como updated_at, un
// timestamptz). Pasarle a relativeDate una columna `date` la interpreta como medianoche UTC, que
// en Bogotá es el día anterior: el resultado sale corrido un día.

/** Versión de `esVencida` para bucles: recibe el día del negocio ya resuelto. */
export function esVencidaEn(vence: string | null, estado: string | null, hoyDia: string): boolean {
  if (!vence || estado === 'done') return false
  return vence < hoyDia
}

// `vence` es una columna `date` ('YYYY-MM-DD'), no un instante: se compara contra el día de
// calendario del negocio. Comparar contra un Date en UTC daba por vencido lo que vence hoy.
// Resolver el día cuesta ~12× más que la comparación: en un bucle, usar `esVencidaEn`.
export function esVencida(vence: string | null, estado: string | null, hoy: Date): boolean {
  return esVencidaEn(vence, estado, diaDelNegocio(hoy))
}

// A nivel de módulo para no reconstruirlo en cada fila (y para que la zona no se olvide nunca).
const cortaFmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', timeZone: TZ })

export function relativeDate(iso: string, hoy: Date): string {
  const dias = diasEntre(diaDelNegocio(new Date(iso)), diaDelNegocio(hoy))
  if (dias <= 0) return 'Hoy'
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} d`
  return cortaFmt.format(new Date(iso))
}
