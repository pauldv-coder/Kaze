import { describe, it, expect } from 'vitest'
import { narrarProceso, narrarActividad, plano } from '@/lib/captura/narrador'
import type { PasoNarrado } from '@/lib/captura/narrador'
import { anexosDe } from '@/lib/captura/anexos'
import { semillaPrototipo, leerEjemplo } from './_fixtures'

// Mismo recorrido que prototipo/pruebas/exportar-ejemplos.mjs, que generó semilla-relato.txt.
function relatoPlano(rel: unknown): string {
  const lineas: string[] = []
  const rec = (o: unknown) => {
    if (!o) return
    if (Array.isArray(o)) { o.forEach(rec); return }
    if (typeof o !== 'object') return
    const r = o as Record<string, unknown>
    if (r.runs) { lineas.push(plano(r as never)); return }
    Object.keys(r).forEach(k => rec(r[k]))
  }
  rec(rel)
  return lineas.join('\n\n') + '\n'
}

const texto = (p: { runs: { t: string }[] }) => p.runs.map(r => r.t).join('')
function paso(x: PasoNarrado | null): PasoNarrado {
  if (!x) throw new Error('la actividad no está en la secuencia')
  return x
}

describe('narrador', () => {
  it('el relato de la semilla es idéntico al del prototipo (27 párrafos)', () => {
    const p = semillaPrototipo()
    const txt = relatoPlano(narrarProceso(p, p.versiones.asis, {}))
    expect(txt).toBe(leerEjemplo('semilla-relato.txt'))
    expect(txt.trim().split('\n\n')).toHaveLength(27)
  })

  it('el texto propio reemplaza el párrafo principal y se marca', () => {
    // Como prototipo/pruebas/test-propio.mjs: el propio sustituye solo lo que se hace en el paso;
    // cómo se llega y cómo termina se conservan, y los demás párrafos (decisión, ramas, «lo que
    // falta») no dependen del relato, así que el número de párrafos no cambia.
    const p = semillaPrototipo(); const m = p.versiones.asis
    const auto = paso(narrarActividad(p, m, 'a_revisar'))
    expect(auto.propio).toBe(false)
    expect(auto.automatico).toBe('Con las partidas conciliatorias, el jefe de contabilidad revisa y aprueba la conciliación. '
      + 'Usa el formato FT-CON-01 «Formato de conciliación bancaria». Antes de seguir, comprueba esto: diferencia final '
      + 'en cero o totalmente explicada. El resultado es la conciliación firmada. Toma media hora, más 24 horas de espera.')
    m.actividades.a_revisar.relato = 'La jefe revisa todas las conciliaciones del mes antes del cierre.'
    const propio = paso(narrarActividad(p, m, 'a_revisar'))
    expect(propio.propio).toBe(true)
    expect(propio.parrafos[0].runs.map((r: { t: string }) => r.t).join('')).toContain('La jefe revisa todas')
    expect(texto(propio.parrafos[0])).toBe('También se llega a este paso desde el paso 3, si la respuesta es «Sí, todo cruza». '
      + 'La jefe revisa todas las conciliaciones del mes antes del cierre.')
    expect(propio.parrafos.length).toBe(auto.parrafos.length)
    expect(propio.parrafos.slice(1).map(texto)).toEqual(auto.parrafos.slice(1).map(texto))
    // El automático se sigue calculando aunque haya texto propio.
    expect(propio.automatico).toBe(auto.automatico)
  })

  it('con texto propio se conserva el cierre del proceso', () => {
    const p = semillaPrototipo(); const m = p.versiones.asis
    m.actividades.a_archivar.relato = 'El auxiliar guarda el PDF firmado en la carpeta del cliente.'
    const c = paso(narrarActividad(p, m, 'a_archivar'))
    expect(texto(c.parrafos[0])).toBe('El auxiliar guarda el PDF firmado en la carpeta del cliente. '
      + 'Con esto termina el proceso, con la conciliación aprobada y archivada.')
  })

  it('narrarActividad devuelve null para lo que no está en la secuencia', () => {
    const p = semillaPrototipo()
    expect(narrarActividad(p, p.versiones.asis, 'a_tesoreria')).toBeNull()
  })

  it('anexosDe numera los formatos de la semilla', () => {
    const a = anexosDe(semillaPrototipo().versiones.asis)
    expect(a.length).toBeGreaterThan(0)
    expect(a).toEqual([
      { llave: 'ft-con-02', codigo: 'FT-CON-02', nombre: 'Registro de partidas conciliatorias', version: '1',
        archivo: null, enlace: null, usos: ['ACT-05'], n: 1 },
      { llave: 'ft-con-01', codigo: 'FT-CON-01', nombre: 'Formato de conciliación bancaria', version: '3',
        archivo: null, enlace: null, usos: ['ACT-06'], n: 2 },
    ])
  })

  it('anexosDe no repite un formato y junta sus usos', () => {
    const m = semillaPrototipo().versiones.asis
    m.actividades.a_enviar.formatos = [{ id: 'fm_x', nombre: 'Otro nombre', codigo: 'ft-con-01', version: null,
      archivo: { id: 'ar1', path: 'x/y.pdf', nombre: 'y.pdf', tipo: 'application/pdf', tamano: 10 }, enlace: 'https://ejemplo.test' }]
    const a = anexosDe(m)
    expect(a).toHaveLength(2)
    expect(a[1].usos).toEqual(['ACT-06', 'ACT-07'])
    expect(a[1].archivo?.id).toBe('ar1')
    expect(a[1].enlace).toBe('https://ejemplo.test')
    expect(a[1].nombre).toBe('Formato de conciliación bancaria')
  })

  it('con anexos, el formato remite a su número de anexo', () => {
    const p = semillaPrototipo(); const m = p.versiones.asis
    const rel = narrarProceso(p, m, { anexos: anexosDe(m), anclaAnexos: 'kz_mis_anexos' })
    const registrar = rel.fases[1].pasos[2]
    expect(registrar.clave).toBe('a_registrar')
    expect(texto(registrar.parrafos[0])).toContain('Usa el formato FT-CON-02 «Registro de partidas conciliatorias» (anexo 1).')
    const ref = registrar.parrafos[0].runs.find(r => r.anexo === 1)
    expect(ref).toMatchObject({ t: 'anexo 1', b: true, ref: { ancla: 'kz_mis_anexos' } })
  })
})
