import { describe, it, expect } from 'vitest'
import BpmnModdle from 'bpmn-moddle'
import { generarBPMN } from '@/lib/captura/bpmn/generar'
import type { ResultadoBPMNCompleto } from '@/lib/captura/bpmn/generar'
import { cruces } from '@/lib/captura/bpmn/rutas'
import type { ProcesoDoc } from '@/lib/captura/tipos'
import { semillaPrototipo, grandePrototipo, leerEjemplo } from './_fixtures'

function generar(p: ProcesoDoc): ResultadoBPMNCompleto {
  const g = generarBPMN(p, p.versiones.asis, {})
  if (g.xml === null) throw new Error('no se generó el diagrama: ' + g.avisos.map(a => a.texto).join(' / '))
  return g
}

describe('generarBPMN', () => {
  it('la semilla da exactamente el XML del prototipo', () => {
    expect(generar(semillaPrototipo()).xml.replace(/\r\n/g, '\n')).toBe(leerEjemplo('semilla.bpmn'))
  })
  it('el proceso grande da exactamente el XML del prototipo', () => {
    expect(generar(grandePrototipo()).xml.replace(/\r\n/g, '\n')).toBe(leerEjemplo('grande.bpmn'))
  })
  it('sin actividades en fases no hay diagrama, solo el aviso', () => {
    const p = semillaPrototipo()
    const m = p.versiones.asis
    m.sinFase = m.fases.flatMap((f: { actividades: string[] }) => f.actividades).concat(m.sinFase)
    m.fases.forEach((f: { actividades: string[] }) => { f.actividades = [] })
    const g = generarBPMN(p, m, {})
    expect(g.xml).toBeNull()
    expect(g.avisos).toEqual([{ texto: 'Ubica al menos una actividad en una fase para generar el diagrama.' }])
  })
  for (const [nombre, fx] of [['semilla', semillaPrototipo], ['grande', grandePrototipo]] as const) {
    it(`${nombre}: XML válido, sin flujos que crucen pools, sin conectores sobre formas`, async () => {
      const g = generar(fx())
      const { rootElement, warnings } = await new BpmnModdle().fromXML(g.xml)
      expect(warnings).toHaveLength(0)
      const proc = (rootElement.rootElements ?? []).find(e => e.$type === 'bpmn:Process')
      expect(proc).toBeDefined()
      const elementos = proc?.flowElements ?? []
      expect(elementos.length).toBeGreaterThan(0)
      const ids = new Set(elementos.map(e => e.id))
      const malosSec = elementos.filter(e => e.$type === 'bpmn:SequenceFlow' && (!ids.has(e.sourceRef?.id) || !ids.has(e.targetRef?.id)))
      expect(malosSec).toHaveLength(0)

      // Limpieza (prototipo/pruebas/test-bpmn.mjs:26-45): ningún conector pasa por dentro de una
      // forma ajena y ninguna etiqueta pisa una forma.
      const formas = Object.entries(g.geo.final).map(([id, r]) => ({ id, ...r }))
      expect(formas.length).toBeGreaterThan(0)
      expect(Object.keys(g.geo.conectores).length).toBeGreaterThan(0)
      expect(Object.keys(g.geo.etqFinal).length).toBeGreaterThan(0)
      const malos: string[] = []
      Object.entries(g.geo.conectores).forEach(([id, c]) => {
        // El evento de borde está sobre su tarea: el conector que sale de él puede tocarla.
        const adjunta = g.geo.adjuntos[c.src]
        cruces(c.puntos, formas, [c.src, c.tgt]).filter(fid => fid !== adjunta).forEach(fid => malos.push(id + ' cruza ' + fid))
      })
      expect(malos).toEqual([])
      const pisadas: string[] = []
      Object.entries(g.geo.etqFinal).forEach(([id, r]) => formas.forEach(f => {
        if (f.id === id) return
        if (r.x < f.x + f.w - 1 && r.x + r.w > f.x + 1 && r.y < f.y + f.h - 1 && r.y + r.h > f.y + 1) pisadas.push(id + ' sobre ' + f.id)
      }))
      expect(pisadas).toEqual([])
    })
  }
})
