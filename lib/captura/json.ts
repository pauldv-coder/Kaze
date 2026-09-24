/** JSON canónico: claves ordenadas. Para comparar documentos sin depender del orden de las claves. */
export function canonico(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return '[' + v.map(canonico).join(',') + ']'
  const o = v as Record<string, unknown>
  return '{' + Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canonico(o[k])).join(',') + '}'
}
export const mismoJson = (a: unknown, b: unknown) => canonico(a) === canonico(b)
