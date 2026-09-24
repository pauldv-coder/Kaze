import { normalizarProceso, nuevoVerif, clonar } from './modelo'
import type { ProcesoDoc } from './tipos'

/** Un proceso en formato del prototipo (ejemplos/, prototipo/seed.mjs) → documento de §4.3.
 *  `verifs` fija el verif de contactos concretos (el seed los fija para que los tests conozcan los códigos). */
export function documentoDesdePrototipo(p: Record<string, unknown>, verifs: Record<string, string>): ProcesoDoc {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const x = normalizarProceso(clonar(p)) as Record<string, any>   // única excepción de `any`: entrada sin tipar
  for (const k of ['id', 'creado', 'actualizado', 'rev', 'sesion', 'remitente']) delete x[k]
  for (const v of ['asis', 'tobe'] as const) {
    const m = x.versiones[v]
    if (m) for (const k of ['numero', 'estado', 'aprobacion', 'historial']) delete m[k]
  }
  for (const c of x.participantes) c.verif = verifs[c.id] ?? c.verif ?? nuevoVerif()
  x.numSiguiente = x.participantes.reduce((mx: number, c: { num: number }) => Math.max(mx, c.num), 0) + 1
  return x as ProcesoDoc
}
