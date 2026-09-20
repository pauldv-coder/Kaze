import { describe, it, expect } from 'vitest'
import { PostgrestError } from '@supabase/supabase-js'
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

  it('sin count no inventa truncamiento', async () => {
    await expect(selectAllRows('clients', respuesta([1], null))).resolves.toEqual([1])
  })
})
