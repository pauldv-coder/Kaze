import { describe, it, expect } from 'vitest'
import { generarBPMN } from '@/lib/captura/bpmn/generar'
import { revisarDiagrama } from '@/lib/captura/bpmn/validar'
import * as M from '@/lib/captura/modelo'
import type { ProcesoDoc, Version } from '@/lib/captura/tipos'
import { semillaPrototipo, grandePrototipo } from './_fixtures'

const revisar = (p: ProcesoDoc, m: Version) => revisarDiagrama(p, m, generarBPMN(p, m, {}))

describe('revisarDiagrama', () => {
  it('la semilla no tiene errores', () => {
    const p = semillaPrototipo()
    expect(revisar(p, p.versiones.asis).errores).toHaveLength(0)
  })

  it('el modelo roto de la prueba del prototipo da 9 errores', () => {
    const p = semillaPrototipo()
    const m = p.versiones.asis
    m.decisiones[0].salidas.pop()
    m.decisiones[0].pregunta = ''
    m.decisiones.push(M.nuevaDecision({ origen: 'a_registrar', pregunta: '¿Otra?' }))
    m.actividades.a_investigar.eventos.push(Object.assign(M.nuevoEvento('limite'), { n: 2 }))
    m.decisiones[1].salidas = [
      { condicion: 'Aprobada', destino: 'a_enviar', porDefecto: true, clase: null },
      { condicion: '', destino: 'a_revisar', porDefecto: false, clase: null },
    ]
    expect(revisar(p, m).errores).toHaveLength(9)
  })

  // Mismos textos que da `reference/captura/prototipo/src/validar.js` original contra este
  // modelo roto (verificado corriendo el original con `npx tsx`, fuera del repo): si el copy
  // cambia sin querer, esta prueba lo detecta.
  it('el modelo roto da exactamente estos 9 textos de error, en este orden', () => {
    const p = semillaPrototipo()
    const m = p.versiones.asis
    m.decisiones[0].salidas.pop()
    m.decisiones[0].pregunta = ''
    m.decisiones.push(M.nuevaDecision({ origen: 'a_registrar', pregunta: '¿Otra?' }))
    m.actividades.a_investigar.eventos.push(Object.assign(M.nuevoEvento('limite'), { n: 2 }))
    m.decisiones[1].salidas = [
      { condicion: 'Aprobada', destino: 'a_enviar', porDefecto: true, clase: null },
      { condicion: '', destino: 'a_revisar', porDefecto: false, clase: null },
    ]
    expect(revisar(p, m).errores.map(e => e.texto)).toEqual([
      'ACT-04: falta decir a dónde sigue el proceso si se vence el límite de tiempo.',
      'La decisión de ACT-03 no tiene pregunta.',
      'La decisión de ACT-03 tiene una sola salida: una decisión necesita al menos dos caminos.',
      '«¿La jefe aprueba la conciliación?» (ACT-06): la salida 2 no dice cuándo se toma.',
      '«¿Otra?» (ACT-05): la salida 1 no dice a dónde va.',
      '«¿Otra?» (ACT-05): la salida 2 no dice a dónde va.',
      '«¿Otra?» (ACT-05): la salida 2 no dice cuándo se toma.',
      'ACT-04 no tiene entrada: ninguna actividad ni decisión lleva a ella.',
      'Desde ACT-04, ACT-05 el proceso nunca llega a un fin: revisa las salidas de las decisiones.',
    ])
  })

  // El original (`reference/captura/prototipo/src/validar.js`, verificado igual con `npx tsx`)
  // también da 0 errores para este proceso.
  it('el proceso grande no tiene errores', () => {
    const p = grandePrototipo()
    expect(revisar(p, p.versiones.asis).errores).toHaveLength(0)
  })
})
