import type { PostgrestError } from '@supabase/supabase-js'

// Respuesta de PostgREST pedida con `{ count: 'exact' }`. Tipo mínimo a propósito: así encaja
// tanto un builder real (PostgrestResponse) como un doble en los tests.
type RespuestaConConteo<T> = {
  data: T[] | null
  error: PostgrestError | null
  count: number | null
}

/**
 * Ejecuta un `select` y garantiza que trajo TODAS las filas.
 *
 * PostgREST corta en `max_rows` (1000 aquí y en el alojado) y responde 200 sin avisar: los datos
 * quedan a medias y los cálculos mienten en silencio. Pedir `{ count: 'exact' }` y comparar el
 * total contra lo recibido convierte esa mentira en una excepción.
 *
 * @example
 * const kpis = await selectAllRows('kpis', db.from('kpis').select('id', { count: 'exact' }))
 */
export async function selectAllRows<T>(tabla: string, query: PromiseLike<RespuestaConConteo<T>>): Promise<T[]> {
  const { data, error, count } = await query
  if (error) throw error
  if (!data) throw new Error(`${tabla}: la consulta no devolvió filas ni error`)
  if (count !== null && data.length < count) {
    throw new Error(
      `${tabla}: PostgREST truncó la consulta — llegaron ${data.length} filas de ${count}. ` +
        'Se alcanzó el techo de max_rows: hay que filtrar o paginar la consulta.'
    )
  }
  return data
}
