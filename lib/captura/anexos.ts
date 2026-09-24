/* Anexos del procedimiento: los formatos de las actividades, numerados.
   Portado de `reference/captura/prototipo/src/documento.js` líneas 59-78 (`anexosDe`), sin
   cambios de comportamiento. Vive aparte para que el narrador lo use sin cargar el documento. */

import { secuencia, tieneValor, normalizarTexto } from './modelo'
import type { ActividadSecuenciada } from './secuencia'
import type { ArchivoFormato, Version } from './tipos'

/** Un formato sin repetir, con los códigos (ACT-NN) de las actividades que lo usan. */
export interface Anexo {
  llave: string
  codigo: string | null
  nombre: string
  version: string | null
  archivo: ArchivoFormato | null
  enlace: string | null
  usos: string[]
  n: number
}

/** Una actividad ubicada en una fase: siempre tiene número y código. */
type EnFase = ActividadSecuenciada & { numero: number; codigo: string }
const enFase = (s: ActividadSecuenciada): s is EnFase => s.numero != null

/* Formatos de las actividades ubicadas en fases, sin repetir (por código o nombre), numerados como anexos. */
export function anexosDe(m: Version): Anexo[] {
  const out: Anexo[] = []
  secuencia(m).filter(enFase).forEach(s => {
    const a = m.actividades[s.clave]
    ;((a && a.formatos) || []).forEach(f => {
      const llave = normalizarTexto(f.codigo || f.nombre)
      if (!llave) return
      let x = out.find(y => y.llave === llave)
      if (!x) { x = { llave, codigo: tieneValor(f.codigo) ? f.codigo : null, nombre: f.nombre || '', version: tieneValor(f.version) ? f.version : null, archivo: f.archivo || null, enlace: tieneValor(f.enlace) ? f.enlace : null, usos: [], n: 0 }; out.push(x) }
      if (!(x.archivo && x.archivo.id) && f.archivo && f.archivo.id) x.archivo = f.archivo
      if (!x.enlace && tieneValor(f.enlace)) x.enlace = f.enlace
      if (!x.nombre && f.nombre) x.nombre = f.nombre
      if (x.usos.indexOf(s.codigo) < 0) x.usos.push(s.codigo)
    })
  })
  out.forEach((x, i) => { x.n = i + 1 })
  return out
}
