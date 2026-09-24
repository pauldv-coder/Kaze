/* Revisión del diagrama. Errores: impiden exportar (Word, .bpmn, SVG, XML) porque el proceso
   quedaría mal dibujado o incompleto. Avisos: conviene mirarlos, pero no bloquean.
   Se calcula de la captura y del diagrama generado: la ficha y el dibujo dicen lo mismo.

   Portado de `reference/captura/prototipo/src/validar.js` (Task 1.6 del plan de captura).
   Cambios frente al prototipo, y solo estos:
   · Tipos. `revisarDiagrama` recibe los campos del proceso que usa (`ProcesoValidar`) y el
     resultado de `generarBPMN`; `Ir` y `ProblemaDiagrama` nombran la forma (antes implícita) de
     cada error/aviso.
   · `esDiagramaCompleto` es nuevo: un guarda de tipo para lo que el original comprueba con
     `gen && gen.geo && gen.xml` (`ResultadoBPMN` no distingue sus dos formas por una propiedad
     literal, así que TypeScript no la estrecha con la comprobación directa).
   · `(m.actividades[k] || {}).nombre` → `m.actividades[k]?.nombre`; las invariantes que el
     original daba por hechas (una actividad de `enFase` siempre tiene `codigo`) se expresan
     con `!`. */
import { secuencia, tieneValor, TIPOS_EVENTO } from '../modelo'
import { cruces } from './rutas'
import type { ConectorGeo, EntradaMapa, ResultadoBPMN, ResultadoBPMNCompleto } from './generar'
import type { ProcesoDoc, Version } from '../tipos'

const limpio = (s: unknown): string => String(s).replace(/[^A-Za-z0-9_]/g, '_')
const plural = (n: number, uno: string, varios: string): string => n + ' ' + (n === 1 ? uno : varios)

/** Lo que la revisión lee del proceso (sirve igual un `ProcesoDoc` que un `ProcesoVista`). */
export type ProcesoValidar = Pick<ProcesoDoc, 'disparador'>

/** A qué pestaña (y sub-paso o ficha) lleva un error o aviso del diagrama. */
export type Ir =
  | { tab: 'actividades'; sub: 'listar' }
  | { tab: 'actividades'; sub: 'caracterizar'; clave: string }
  | { tab: 'resumen' }
  | { tab: 'diagrama' }

export interface ProblemaDiagrama { texto: string; ir: Ir; ids: string[] }
export interface ResultadoRevision { errores: ProblemaDiagrama[]; avisos: ProblemaDiagrama[]; resumen?: string }

/** `gen.xml`/`gen.geo` solo existen juntos cuando el diagrama sí se generó. */
const esDiagramaCompleto = (gen: ResultadoBPMN): gen is ResultadoBPMNCompleto => gen.xml != null && gen.geo != null

export function revisarDiagrama(proc: ProcesoValidar, m: Version, gen?: ResultadoBPMN | null): ResultadoRevision {
  const errores: ProblemaDiagrama[] = [], avisos: ProblemaDiagrama[] = []
  const seq = secuencia(m)
  const enFase = seq.filter(s => s.numero != null)
  const info: Record<string, typeof enFase[number]> = {}; enFase.forEach(s => { info[s.clave] = s })
  const cod = (k: string): string => (info[k] ? info[k].codigo! : '«' + (m.actividades[k]?.nombre || 'actividad') + '»')
  const err = (texto: string, ir: Ir, ids?: string[]): number => errores.push({ texto, ir, ids: ids || [] })
  const av = (texto: string, ir: Ir, ids?: string[]): number => avisos.push({ texto, ir, ids: ids || [] })
  const irA = (k: string): Ir => ({ tab: 'actividades', sub: 'caracterizar', clave: k })
  const idTarea = (k: string): string => 'Act_' + limpio(k)
  if (!enFase.length) {
    err('Aún no hay actividades ubicadas en fases: no hay diagrama que exportar.', { tab: 'actividades', sub: 'listar' })
    return { errores, avisos }
  }

  /* ---------- actividades y sus eventos ---------- */
  enFase.forEach(s => {
    const a = m.actividades[s.clave]
    const id = idTarea(s.clave)
    const nombre = String(a.nombre || '').trim()
    if (!nombre) err(s.codigo + ' no tiene nombre.', irA(s.clave), [id])
    else if (/^nueva actividad$/i.test(nombre)) av(s.codigo + ' se llama «Nueva actividad»: ponle un nombre con verbo y objeto.', irA(s.clave), [id])
    if (!tieneValor(a.responsable)) av(s.codigo + ' no tiene responsable: va en el carril «Sin responsable».', irA(s.clave), [id])
    if (a.estado === 'sugerencia') av(s.codigo + ' es una sugerencia de la IA sin validar.', irA(s.clave), [id])
    ;(a.eventos || []).forEach(e => {
      const eid = 'Ev_' + limpio(e.id)
      if (e.tipo === 'limite' || e.tipo === 'error') {
        const que = e.tipo === 'limite' ? 'si se vence el límite de tiempo' : 'si ocurre el error'
        if (!e.destino) err(s.codigo + ': falta decir a dónde sigue el proceso ' + que + '.', irA(s.clave), [eid, id])
        else if (e.destino !== '__fin' && !info[e.destino]) err(s.codigo + ': ' + que + ', el proceso pasa a una actividad eliminada o sin fase.', irA(s.clave), [eid, id])
      }
      if ((e.tipo === 'tiempo' || e.tipo === 'limite') && !(typeof e.n === 'number' && e.n > 0)) av(s.codigo + ': ' + (e.tipo === 'limite' ? 'el límite de tiempo' : 'la espera') + ' no dice cuánto dura.', irA(s.clave), [eid])
      if (e.tipo === 'mensaje' && !tieneValor(e.quien) && !tieneValor(e.texto)) av(s.codigo + ': el mensaje que espera no dice qué es ni de quién.', irA(s.clave), [eid])
      if (e.tipo === 'hito' && !tieneValor(e.texto)) av(s.codigo + ': el hito no tiene nombre.', irA(s.clave), [eid])
      if (!TIPOS_EVENTO[e.tipo]) err(s.codigo + ': tiene un evento de un tipo que Kaze no reconoce.', irA(s.clave), [eid])
    })
  })
  if (!tieneValor(proc.disparador)) av('El evento de inicio no tiene nombre: di qué pone en marcha el proceso (Resumen).', { tab: 'resumen' }, ['Inicio'])

  /* ---------- decisiones ---------- */
  const porOrigen: Record<string, number> = {}
  m.decisiones.forEach(d => {
    const did = 'Dec_' + limpio(d.clave)
    const q = d.pregunta && d.pregunta.trim() ? '«' + d.pregunta.trim() + '»' : 'sin pregunta'
    if (d.estado === 'sugerencia') { av('La decisión ' + q + ' es una sugerencia de la IA: no se dibuja hasta que la aceptes.', d.origen && info[d.origen] ? irA(d.origen) : irA('dec:' + d.clave)); return }
    if (!d.origen || !info[d.origen]) { err('La decisión ' + q + ' no tiene actividad de origen en la secuencia: ubícala.', irA('dec:' + d.clave)); return }
    porOrigen[d.origen] = (porOrigen[d.origen] || 0) + 1
    const c = cod(d.origen), ir = irA(d.origen)
    if (porOrigen[d.origen] === 2) err(c + ' tiene más de una decisión y el diagrama solo dibuja una: junta sus salidas en una sola.', ir, [idTarea(d.origen)])
    if (porOrigen[d.origen] > 1) return
    const ref = q === 'sin pregunta' ? 'La decisión de ' + c : q + ' (' + c + ')'
    if (!d.pregunta || !d.pregunta.trim()) err('La decisión de ' + c + ' no tiene pregunta.', ir, [did])
    const sal = d.salidas || []
    if (sal.length < 2) err(ref + ' tiene ' + (sal.length ? 'una sola salida' : 'ninguna salida') + ': una decisión necesita al menos dos caminos.', ir, [did])
    let def = 0
    sal.forEach((s, i) => {
      const r = s.condicion && s.condicion.trim() ? '«' + s.condicion.trim() + '»' : (i + 1) + ''
      if (!s.destino) err(ref + ': la salida ' + r + ' no dice a dónde va.', ir, [did])
      else if (s.destino !== '__fin' && !info[s.destino]) err(ref + ': la salida ' + r + ' lleva a una actividad eliminada o sin fase.', ir, [did])
      if (d.tipo !== 'paralela' && !s.porDefecto && !(s.condicion && s.condicion.trim())) err(ref + ': la salida ' + r + ' no dice cuándo se toma.', ir, [did])
      if (s.porDefecto && d.tipo !== 'paralela') def += 1
    })
    if (def > 1) err(ref + ' tiene más de un camino por defecto.', ir, [did])
    const dests = sal.map(s => s.destino).filter(Boolean)
    if (new Set(dests).size < dests.length) av(ref + ' tiene dos salidas que llevan al mismo sitio.', ir, [did])
  })

  /* ---------- el flujo dibujado ---------- */
  if (gen && esDiagramaCompleto(gen)) {
    const con = gen.geo.conectores || {}
    const flujos: ({ id: string } & ConectorGeo)[] = Object.keys(con).map(id => Object.assign({ id }, con[id]))
    const secu = flujos.filter(f => !f.mensaje)
    const entra: Record<string, typeof flujos> = {}
    secu.forEach(f => { (entra[f.tgt] = entra[f.tgt] || []).push(f) })
    // Actividades a las que nada lleva.
    enFase.forEach(s => {
      const c = gen.cadena && gen.cadena[s.clave]
      const e = c ? c.entrada : idTarea(s.clave)
      if (!entra[e] || !entra[e].length) err(s.codigo + ' no tiene entrada: ninguna actividad ni decisión lleva a ella.', irA(s.clave), [idTarea(s.clave)])
    })
    // Desde cada actividad se debe poder llegar a un fin (si no, hay un ciclo sin salida).
    const llega = new Set(Object.keys(gen.mapa || {}).filter(id => gen.mapa[id].tipo === 'fin'))
    let hubo = true
    while (hubo) { hubo = false; secu.forEach(f => { if (llega.has(f.tgt) && !llega.has(f.src)) { llega.add(f.src); hubo = true } }) }
    const atrapadas = enFase.filter(s => { const c = gen.cadena && gen.cadena[s.clave]; return c && !llega.has(c.salida) })
    if (atrapadas.length) err('Desde ' + atrapadas.map(s => s.codigo).join(', ') + ' el proceso nunca llega a un fin: revisa las salidas de las decisiones.', irA(atrapadas[0].clave), atrapadas.map(s => idTarea(s.clave)))
    // Diagrama limpio: ningún conector pasa por encima de una forma.
    const formas = Object.keys(gen.geo.final).map(id => Object.assign({ id }, gen.geo.final[id]))
    const adj = gen.geo.adjuntos || {}
    const nombreDe = (id: string): string => {
      const r: EntradaMapa | undefined = (gen.mapa || {})[id]
      if (r && r.tipo === 'actividad' && info[r.clave]) return info[r.clave].codigo!
      if (r && r.tipo === 'decision') { const d = m.decisiones.find(x => x.clave === r.clave); return d && d.pregunta ? '«' + d.pregunta + '»' : 'una decisión' }
      if (r && r.tipo === 'evento') return 'un evento de ' + cod(r.actividad)
      if (r && r.tipo === 'entregable') return 'el entregable de ' + cod(r.clave)
      if (r && r.tipo === 'fin') return 'un fin'
      if (id === 'Inicio') return 'el inicio'
      return 'una forma'
    }
    flujos.forEach(f => {
      const ign = [f.src, f.tgt]
      if (adj[f.src]) ign.push(adj[f.src])
      if (adj[f.tgt]) ign.push(adj[f.tgt])
      const pisa = Array.from(new Set(cruces(f.puntos || [], formas, ign)))
      if (!pisa.length) return
      const r = (gen.mapa || {})[f.id]
      const ir: Ir = r && r.tipo === 'salida' ? (() => { const d = m.decisiones.find(x => x.clave === r.decision); return d && d.origen ? irA(d.origen) : { tab: 'diagrama' } })() : { tab: 'diagrama' }
      err('El conector de ' + nombreDe(f.src) + ' a ' + nombreDe(f.tgt) + ' pasa por encima de ' + pisa.map(nombreDe).join(' y ') + ': mueve una forma o restablece esa ruta.', ir, [f.id])
    })
  }
  return { errores, avisos, resumen: errores.length ? plural(errores.length, 'error', 'errores') : 'sin errores' }
}
