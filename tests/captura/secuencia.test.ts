import { describe, it, expect } from 'vitest'
import { numerarActividades, codigoActividad, secuenciaActividades, revisarDecision, DESTINO_FIN } from '@/lib/captura/secuencia'

const fases = [
  { id: 'f1', actividades: [{ clave: 'a' }, { clave: 'b' }] },
  { id: 'f2', actividades: [{ clave: 'c' }] },
  { id: '__sin', sinFase: true, actividades: [{ clave: 'z' }] },
]
describe('secuencia', () => {
  it('numera en orden de fases y deja sin número lo que está sin fase', () => {
    const m = numerarActividades(fases)
    expect([m.a, m.b, m.c]).toEqual([1, 2, 3])
    expect(m.z).toBeUndefined()
  })
  it('código con dos dígitos', () => { expect(codigoActividad(6)).toBe('ACT-06') })
  it('secuencia incluye lo sin fase al final, con código nulo', () => {
    // El prototipo (index.jsx:369-377) NO filtra las actividades sin fase: las agrega
    // igual, con numero/codigo null, y el sort por numero (Infinity si es null) las deja
    // al final. El plan asumía que secuenciaActividades "lista solo las numeradas"; el
    // comportamiento real incluye la columna "Sin fase" también.
    const seq = secuenciaActividades(fases)
    expect(seq.map(s => s.clave)).toEqual(['a', 'b', 'c', 'z'])
    expect(seq.map(s => s.codigo)).toEqual(['ACT-01', 'ACT-02', 'ACT-03', null])
    expect(seq[3].numero).toBeNull()
    expect(seq[3].fase).toBeNull()
  })
  it('revisarDecision marca una salida hacia atrás sin aceptar', () => {
    const seq = secuenciaActividades(fases)
    const motivos = revisarDecision({ origen: 'c', salidas: [{ destino: 'a' }, { destino: DESTINO_FIN }], contexto: {}, aceptados: [] }, seq)
    expect(motivos.length).toBeGreaterThan(0)
  })
})
