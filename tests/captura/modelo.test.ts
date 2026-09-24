import { describe, it, expect } from 'vitest'
import * as M from '@/lib/captura/modelo'
import { mismoJson } from '@/lib/captura/json'
import { documentoDesdePrototipo } from '@/lib/captura/importar'
import { semillaPrototipo } from './_fixtures'

describe('valores especiales', () => {
  it('«?», N/A, vacío y 0 son distintos', () => {
    expect(M.leerTexto('?')).toBe('desconocido')
    expect(M.leerTexto('n/a')).toBe('na')
    expect(M.leerTexto('  ')).toBeNull()
    expect(M.leerNumero('0')).toBe(0)
    expect(M.leerNumero('1,5')).toBe(1.5)
  })
})

describe('secuencia de la semilla', () => {
  it('8 actividades numeradas y 1 sin fase', () => {
    const p = semillaPrototipo()
    const m = p.versiones.asis
    // `secuencia(m)` = `secuenciaActividades(fasesTablero(m))`, que incluye también la
    // columna «Sin fase» (con numero/codigo null, al final): 8 numeradas + 1 sin fase = 9.
    const seq = M.secuencia(m)
    expect(seq).toHaveLength(9)
    expect(seq.filter(s => s.numero != null)).toHaveLength(8)
    expect(seq[8]).toMatchObject({ clave: 'a_tesoreria', numero: null, codigo: null })
    expect(m.sinFase).toHaveLength(1)
  })
})

describe('crearTobe', () => {
  it('claves nuevas con origenClave y decisiones remapeadas', () => {
    const asis = semillaPrototipo().versiones.asis
    const tobe = M.crearTobe(asis)
    const claves = Object.keys(tobe.actividades)
    expect(claves.some(k => k in asis.actividades)).toBe(false)
    expect(Object.values(tobe.actividades).every(a => a.origenClave && a.origenClave in asis.actividades)).toBe(true)
    for (const d of tobe.decisiones) if (d.origen) expect(d.origen in tobe.actividades).toBe(true)
    expect('numero' in tobe || 'estado' in tobe || 'aprobacion' in tobe).toBe(false)
  })
})

describe('bloqueada', () => {
  it('revision y aprobado bloquean', () => {
    expect(M.bloqueada('revision')).toBe(true)
    expect(M.bloqueada('aprobado')).toBe(true)
    expect(M.bloqueada('cambios')).toBe(false)
    expect(M.bloqueada('borrador')).toBe(false)
  })
})

describe('fechas en America/Bogota', () => {
  it('fechaCorta de un instante tarde en la noche de Bogotá no salta de día', () => {
    expect(M.fechaCorta('2026-09-25T03:30:00Z')).toBe('24 sept 2026')   // 22:30 del 24 en Bogotá
    expect(M.fechaCorta('2026-09-24')).toBe('24 sept 2026')
  })
})

describe('contactos', () => {
  it('nuevoContacto usa numSiguiente, que solo crece, y un verif aleatorio', () => {
    const doc = M.nuevoDocumento('Radicación de facturas')
    const c1 = M.nuevoContacto(doc); doc.participantes.push(c1); doc.numSiguiente++
    const c2 = M.nuevoContacto(doc); doc.participantes.push(c2); doc.numSiguiente++
    doc.participantes.pop()
    const c3 = M.nuevoContacto(doc)
    expect([c1.num, c2.num, c3.num]).toEqual([1, 2, 3])
    expect(c1.verif).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/)
    expect(c1.verif).not.toBe(c2.verif)   // probabilidad de choque 1/32^4
  })
})

describe('documentoDesdePrototipo', () => {
  it('quita lo que vive en columnas y lo derivado, y agrega verif y numSiguiente', () => {
    const d = documentoDesdePrototipo(semillaPrototipo(), { u_marta: 'P3GM' })
    for (const k of ['id', 'creado', 'actualizado', 'rev', 'sesion', 'remitente']) expect(k in d).toBe(false)
    for (const k of ['numero', 'estado', 'aprobacion', 'historial']) expect(k in d.versiones.asis).toBe(false)
    expect(d.participantes.find(c => c.id === 'u_marta')!.verif).toBe('P3GM')
    expect(d.participantes.every(c => /^[A-Z2-9]{4}$/.test(c.verif))).toBe(true)
    expect(d.numSiguiente).toBe(6)
  })
})

describe('vista ↔ guardado', () => {
  it('conInfoDeVersiones y sinInfoDeVersiones son inversas', () => {
    const d = documentoDesdePrototipo(semillaPrototipo(), {})
    const v = M.conInfoDeVersiones(d, { asis: { numero: 2, estado: 'cambios' }, tobe: null })
    expect(v.versiones.asis.numero).toBe(2)
    expect(mismoJson(M.sinInfoDeVersiones(v), d)).toBe(true)
  })
})

describe('mismoJson', () => {
  it('no depende del orden de las claves', () => {
    expect(mismoJson({ a: 1, b: { c: [1, 2], d: null } }, { b: { d: null, c: [1, 2] }, a: 1 })).toBe(true)
    expect(mismoJson({ a: [1, 2] }, { a: [2, 1] })).toBe(false)
  })
})
