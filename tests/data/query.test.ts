import { describe, it, expect } from 'vitest'
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient, PostgrestError } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { selectAllRows } from '@/lib/data/query'

// Imita la respuesta de PostgREST: `data` ya truncada a max_rows, `count` con el total real.
const respuesta = <T>(data: T[] | null, count: number | null, error: PostgrestError | null = null) =>
  Promise.resolve({ data, error, count })

describe('selectAllRows', () => {
  it('devuelve las filas cuando la consulta vino completa', async () => {
    await expect(selectAllRows('kpis', respuesta([1, 2, 3], 3))).resolves.toEqual([1, 2, 3])
  })

  it('falla ruidosamente si PostgREST truncó, nombrando la tabla y ambos números', async () => {
    const p = selectAllRows('measurements', respuesta([1, 2], 1000))
    await expect(p).rejects.toThrow(/measurements/)
    await expect(p).rejects.toThrow(/\b2\b[\s\S]*\b1000\b/)
  })

  it('propaga el error de PostgREST', async () => {
    const error = new PostgrestError({ message: 'boom', details: '', hint: '', code: '42P01' })
    await expect(selectAllRows('projects', respuesta(null, null, error))).rejects.toThrow(/boom/)
  })

  // Sin conteo la guardia no puede garantizar nada, y quedarse callada es exactamente el fallo
  // silencioso que existe para evitar. El tipo no lo puede atrapar (count es `number | null`
  // incluso en la respuesta exitosa), así que falla cerrado en tiempo de ejecución.
  it('exige { count: exact }: sin conteo, falla cerrado', async () => {
    const p = selectAllRows('clients', respuesta([1], null))
    await expect(p).rejects.toThrow(/clients/)
    await expect(p).rejects.toThrow(/count: 'exact'/)
  })

  it('un resultado vacío legítimo trae count 0, no null', async () => {
    await expect(selectAllRows('actions', respuesta([], 0))).resolves.toEqual([])
  })
})

describe('selectAllRows contra PostgREST de verdad', () => {
  const db = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  // PostgREST implementa max_rows como un LIMIT, así que .range() produce la misma respuesta que
  // un truncamiento real (206, count con el total, menos filas de las que dice el total).
  it('detecta el truncamiento en una respuesta real', async () => {
    const p = selectAllRows('actions', db.from('actions').select('id', { count: 'exact' }).range(0, 1))
    await expect(p).rejects.toThrow(/actions: PostgREST truncó/)
    await expect(p).rejects.toThrow(/2 filas de 12/)
  })
})
