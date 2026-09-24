/** Secuencia de actividades: numeración, código ACT-NN y revisión de decisiones tras
 *  cambios en la secuencia. Portado de `reference/captura/sistema-de-diseno/index.jsx`
 *  líneas 355-378 (`numerarActividades`, `codigoActividad`, `secuenciaActividades`) y
 *  837-880 (`DESTINO_FIN`, `revisarDecision`). */

/** Actividad tal como aparece dentro de una fase del "tablero" de secuencia (ver
 *  `model.js` `fasesTablero`): solo `clave` es indispensable para estas funciones. */
export interface ActividadEnFase {
  clave: string
  nombre?: string
  [key: string]: unknown
}

/** Fase (o la columna "Sin fase", con `sinFase: true`) en la forma que usa el tablero. */
export interface FaseEnTablero {
  id: string
  nombre?: string
  sinFase?: boolean
  actividades?: ActividadEnFase[]
}

/** Mapa clave de actividad → número visible (1-based). Las actividades sin fase no aparecen. */
export type MapaNumeracion = Record<string, number>

export function numerarActividades(fases: FaseEnTablero[] | null | undefined): MapaNumeracion {
  const mapa: MapaNumeracion = {}
  let n = 0
  ;(fases || []).forEach(f => {
    if (f.sinFase) return
    ;(f.actividades || []).forEach(a => { n += 1; mapa[a.clave] = n })
  })
  return mapa
}

export function codigoActividad(numero: number | null | undefined, prefijo = 'ACT-'): string | null {
  return numero == null ? null : prefijo + String(numero).padStart(2, '0')
}

/** Una fila de la secuencia completa: incluye también lo que está sin fase (numero/codigo null). */
export interface ActividadSecuenciada {
  clave: string
  nombre?: string
  numero: number | null
  codigo: string | null
  fase: string | null
  faseNombre?: string | null
}

export function secuenciaActividades(fases: FaseEnTablero[] | null | undefined, prefijo = 'ACT-'): ActividadSecuenciada[] {
  const m = numerarActividades(fases)
  const out: ActividadSecuenciada[] = []
  ;(fases || []).forEach(f => (f.actividades || []).forEach(a => out.push({
    clave: a.clave, nombre: a.nombre, numero: m[a.clave] ?? null,
    codigo: codigoActividad(m[a.clave], prefijo), fase: f.sinFase ? null : String(f.id), faseNombre: f.sinFase ? null : f.nombre,
  })))
  return out.sort((a, b) => (a.numero ?? Infinity) - (b.numero ?? Infinity))
}

export const DESTINO_FIN = '__fin'

/** Salida de una decisión, tal como la necesita `revisarDecision` (subconjunto de `Salida` de tipos.ts). */
export interface SalidaRevisar {
  destino: string | null
  condicion?: string | null
  clase?: string | null
}

/** Decisión, tal como la necesita `revisarDecision` (subconjunto de `Decision` de tipos.ts). */
export interface DecisionRevisar {
  origen?: string | null
  salidas?: SalidaRevisar[]
  contexto?: { faseOrigen?: string | null } | null
  aceptados?: string[]
}

export type TipoMotivo = 'origen-eliminado' | 'origen-sin-fase' | 'origen-cambio-fase'
  | 'destino-eliminado' | 'destino-sin-fase' | 'hacia-atras'

/** Motivo por el que una decisión necesita revisión (ver comentario de `revisarDecision`). */
export interface MotivoRevision {
  id: string
  tipo: TipoMotivo
  mantenible: boolean
  texto: string
  salida?: number
}

/* Revisa una decisión contra la secuencia actual. Devuelve los motivos por los que
   necesita revisión; cada motivo tiene un id que depende del contexto, así que
   «Mantener así» solo silencia ese contexto: si la actividad se vuelve a mover, se
   vuelve a avisar. La decisión nunca se borra sola. */
export function revisarDecision(decision: DecisionRevisar | null | undefined, secuencia: ActividadSecuenciada[] | null | undefined): MotivoRevision[] {
  const d = decision || {}
  const idx: Record<string, ActividadSecuenciada> = {}
  ;(secuencia || []).forEach(a => { idx[a.clave] = a })
  const motivos: MotivoRevision[] = []
  const o = d.origen ? idx[d.origen] : null
  const nom = (a: ActividadSecuenciada) => '«' + a.nombre + '»'
  if (d.origen && !o) {
    motivos.push({ id: 'origen-eliminado', tipo: 'origen-eliminado', mantenible: false,
      texto: 'La actividad de la que sale esta decisión ya no existe.' })
  } else if (o && o.numero == null) {
    motivos.push({ id: 'origen-sin-fase:' + o.clave, tipo: 'origen-sin-fase', mantenible: true,
      texto: 'Su actividad de origen ' + nom(o) + ' está sin fase: no tiene lugar en la secuencia.' })
  } else if (o && d.contexto && d.contexto.faseOrigen != null && d.contexto.faseOrigen !== o.fase) {
    motivos.push({ id: 'origen-cambio-fase:' + o.fase, tipo: 'origen-cambio-fase', mantenible: true,
      texto: 'Su actividad de origen ' + nom(o) + ' se movió a la fase ' + (o.faseNombre || 'otra fase') + '.' })
  }
  ;(d.salidas || []).forEach((s, i) => {
    if (!s.destino || s.destino === DESTINO_FIN) return
    const t = idx[s.destino]
    const cond = '«' + (s.condicion || 'Salida ' + (i + 1)) + '»'
    if (!t) {
      motivos.push({ id: 'destino-eliminado:' + i, tipo: 'destino-eliminado', salida: i, mantenible: false,
        texto: 'La salida ' + cond + ' iba a una actividad que ya no existe.' })
    } else if (t.numero == null) {
      motivos.push({ id: 'destino-sin-fase:' + i + ':' + t.clave, tipo: 'destino-sin-fase', salida: i, mantenible: true,
        texto: 'La salida ' + cond + ' va a ' + nom(t) + ', que está sin fase.' })
    } else if (o && o.numero != null && t.numero <= o.numero && s.clase !== 'retrabajo') {
      motivos.push({ id: 'atras:' + i + ':' + o.numero + '>' + t.numero, tipo: 'hacia-atras', salida: i, mantenible: true,
        texto: 'La salida ' + cond + ' ahora vuelve hacia atrás, de ' + o.codigo + ' a ' + t.codigo + '. Si es un retrabajo, márcalo; si no, cambia el destino.' })
    }
  })
  const aceptados = d.aceptados || []
  return motivos.filter(m => !(m.mantenible && aceptados.indexOf(m.id) >= 0))
}
