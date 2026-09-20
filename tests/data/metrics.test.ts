import { describe, it, expect } from 'vitest'
import { deltaFavorable, deltaSerie, esVencida, esVencidaEn, relativeDate } from '@/lib/data/metrics'

describe('deltaSerie', () => {
  it('delta = último - primero', () => {
    expect(deltaSerie([11, 9, 8.2])).toBeCloseTo(-2.8)
    expect(deltaSerie([84, 91.4])).toBeCloseTo(7.4)
  })
  it('serie plana o corta → 0', () => {
    expect(deltaSerie([5, 5])).toBe(0)
    expect(deltaSerie([5])).toBe(0)
    expect(deltaSerie([])).toBe(0)
  })
})

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
  it('NO vencida si vence hoy (el plazo es todo el día)', () => {
    expect(esVencida('2026-06-20', 'doing', hoy)).toBe(false)
    expect(esVencida('2026-06-20', 'doing', new Date('2026-06-20T00:00:01Z'))).toBe(false)
  })
  // 02:00Z = 21:00 del día 19 en Bogotá: el día hábil sigue siendo el 19.
  describe('la madrugada UTC todavía es el día anterior en Bogotá', () => {
    const madrugada = new Date('2026-06-20T02:00:00Z')
    it('lo que vence mañana (20) no está vencido', () => {
      expect(esVencida('2026-06-20', 'doing', madrugada)).toBe(false)
    })
    it('lo que vence hoy (19) no está vencido', () => {
      expect(esVencida('2026-06-19', 'doing', madrugada)).toBe(false)
    })
    it('lo que venció ayer (18) sí está vencido', () => {
      expect(esVencida('2026-06-18', 'doing', madrugada)).toBe(true)
    })
  })
})

// Variante para bucles: recibe el día del negocio ya calculado, porque resolverlo en cada acción
// cuesta ~12× más que la comparación misma.
describe('esVencidaEn', () => {
  it('compara contra el día de calendario que recibe', () => {
    expect(esVencidaEn('2026-06-18', 'doing', '2026-06-20')).toBe(true)
    expect(esVencidaEn('2026-06-20', 'doing', '2026-06-20')).toBe(false)
    expect(esVencidaEn('2026-06-25', 'todo', '2026-06-20')).toBe(false)
    expect(esVencidaEn('2026-05-01', 'done', '2026-06-20')).toBe(false)
    expect(esVencidaEn(null, 'todo', '2026-06-20')).toBe(false)
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
  it('cuenta días de calendario, no bloques de 24 h', () => {
    // 03:00Z = 22:00 de ayer en Bogotá: fue ayer, aunque hayan pasado 9 horas.
    expect(relativeDate('2026-06-20T03:00:00Z', hoy)).toBe('ayer')
  })
  it('la fecha corta se rinde en la zona del negocio, no en la del servidor', () => {
    // 05:30Z = 00:30 del 20 en Bogotá (y 23:30 del 19 en zonas más al oeste).
    expect(relativeDate('2026-05-20T05:30:00Z', hoy)).toBe('20 may')
  })
})
