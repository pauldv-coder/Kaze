import { describe, it, expect } from 'vitest'
import { deltaFavorable, esVencida, relativeDate } from '@/lib/data/metrics'

describe('deltaFavorable', () => {
  it('mejor_baja: bajar es favorable', () => {
    expect(deltaFavorable([11, 8.2], true)).toBe(true)
    expect(deltaFavorable([8.2, 9.4], true)).toBe(false)
  })
  it('mejor_sube: subir es favorable', () => {
    expect(deltaFavorable([84, 91.4], false)).toBe(true)
    expect(deltaFavorable([91.4, 84], false)).toBe(false)
  })
  it('serie plana o corta no es favorable', () => {
    expect(deltaFavorable([5, 5], true)).toBe(false)
    expect(deltaFavorable([5], true)).toBe(false)
    expect(deltaFavorable([], false)).toBe(false)
  })
})

describe('esVencida', () => {
  const hoy = new Date('2026-06-20T12:00:00Z')
  it('vencida si vence < hoy y no está done', () => {
    expect(esVencida('2026-06-18', 'doing', hoy)).toBe(true)
  })
  it('no vencida si está done', () => {
    expect(esVencida('2026-05-01', 'done', hoy)).toBe(false)
  })
  it('no vencida si vence en el futuro o sin fecha', () => {
    expect(esVencida('2026-06-25', 'todo', hoy)).toBe(false)
    expect(esVencida(null, 'todo', hoy)).toBe(false)
  })
})

describe('relativeDate', () => {
  const hoy = new Date('2026-06-20T12:00:00Z')
  it('mismo día → Hoy', () => {
    expect(relativeDate('2026-06-20T09:00:00Z', hoy)).toBe('Hoy')
  })
  it('ayer y hace N días', () => {
    expect(relativeDate('2026-06-19T09:00:00Z', hoy)).toBe('ayer')
    expect(relativeDate('2026-06-17T09:00:00Z', hoy)).toBe('hace 3 d')
  })
  it('más de una semana → fecha corta', () => {
    expect(relativeDate('2026-05-20T09:00:00Z', hoy)).toMatch(/may/)
  })
})
