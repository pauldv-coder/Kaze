/* Saneador del SVG del diagrama (Task 1.7, spec §6.5): defensa en profundidad.

   De dónde viene: al enviar un proceso a aprobación, el navegador del analista manda lo que
   devuelve `modeler.saveSVG()` de bpmn-js 17 (`svgDelDiagrama` en
   reference/captura/prototipo/src/lienzo.js). Es entrada NO confiable: cualquier miembro
   autenticado controla el cuerpo de la petición.
   Dónde se muestra: solo en `/aprobar/[token]`, y solo como `<img src="data:image/svg+xml;…">`,
   donde el navegador no ejecuta scripts ni carga recursos externos. El saneo existe por si algún
   día alguien lo muestra de otra forma (inline, <object>, abierto en su pestaña…): las cookies de
   sesión cubren el apex y no son httpOnly.

   Cómo: NO se "quita lo malo" con regex (la versión anterior se evadía anidando etiquetas, con
   prefijos de namespace o escapes CSS, y tenía ReDoS). El SVG se RECONSTRUYE desde cero con un
   escáner lineal escrito a mano:
   1. tope de 2 MB contado en bytes UTF-8 (entrada y salida);
   2. el prólogo (`<?xml …?>`, comentarios, un `<!DOCTYPE …>` SIN subconjunto interno) se valida
      y se descarta; el elemento raíz tiene que ser `<svg>`;
   3. solo sobreviven los elementos y atributos de las listas blancas de abajo (sacadas del SVG
      real); un elemento fuera de la lista se descarta CON TODO SU SUBÁRBOL, texto incluido;
   4. los valores de atributo se decodifican (entidades) y se validan ya decodificados; `style` se
      revisa declaración por declaración;
   5. el texto se re-escapa y la salida se serializa desde los tokens, así que ninguna sintaxis
      rara del original (comillas, espacios, entidades, CDATA, comentarios) llega a la salida;
   6. todo lo mal formado LANZA (se falla cerrado): etiquetas sin cerrar, cierres cruzados, `<?` o
      `<!` dentro del raíz, contenido después de `</svg>`, más de MAX_PROFUNDIDAD niveles.
   Complejidad O(n): un índice que solo avanza; cada `indexOf` arranca donde quedó el índice y, si
   no encuentra, se lanza. Ningún regex corre sobre la entrada.

   No toca `window`/`document`, no importa `server-only`: corre en Node (server action) y en los
   tests de Vitest (entorno `node`). */

/** Tope del SVG, en bytes UTF-8 (de la entrada y de la salida). */
export const MAX_SVG = 2 * 1024 * 1024
/** Niveles de anidamiento admitidos, contando el `<svg>` raíz (el real de bpmn.io anda por 10). */
export const MAX_PROFUNDIDAD = 200

const SVG_NS = 'http://www.w3.org/2000/svg'
const XLINK_NS = 'http://www.w3.org/1999/xlink'

/* ---------- Listas blancas ----------
   Inventario de dónde salen (septiembre 2026, bpmn-js 17.11.1):
   (a) el SVG real de la semilla en reference/captura/ejemplos/fotografia-aprobacion.html (copiado,
       con el prólogo exacto de saveSVG, en tests/captura/fixtures/diagrama-bpmnio.svg):
       elementos svg, g, defs, marker, path, rect, circle, polygon, text, tspan; atributos
       xmlns, xmlns:xlink, version, width, height, viewBox, class, style, transform, data-element-id,
       data-marker, data-corner-radius, lineHeight, x, y, rx, ry, d, cx, cy, r, points, id, refX,
       refY, markerWidth, markerHeight, orient, fill, stroke, stroke-width, stroke-linecap,
       stroke-linejoin; propiedades CSS display, fill, fill-opacity, stroke, stroke-width,
       stroke-linecap, stroke-linejoin, stroke-opacity, stroke-dasharray, font-family, font-size,
       font-weight, pointer-events, marker-start, marker-end, transform, transform-box,
       transform-origin (las tres últimas, en el contorno girado de las compuertas).
   (b) los íconos propios de Kaze (`icono` en lienzo.js, geometría de lib/captura/iconos.ts):
       g+transform+class con circle/path/rect y atributos cx, cy, r, d, x, y, width, height, rx,
       fill, stroke, stroke-width, stroke-linecap, stroke-linejoin. `componerSvg` (documento.js)
       arma el PNG del Word en el navegador y no llega al servidor, pero se revisó: añade line
       (x1, y1, x2, y2, stroke-dasharray), text-anchor, font-family, font-size, overflow — y `<use>`,
       que NO se admite (bpmn.io no lo emite y abre la puerta a los `<use>` encadenados).
   (c) el renderer: los `svgCreate('…')` de bpmn-js/lib y diagram-js/lib son exactamente svg, g,
       defs, marker, path, rect, circle, polygon, text, tspan. Los estilos pasan por tiny-svg, que
       manda a `style` las propiedades CSS de presentación (fill, stroke*, marker*, font*, …).
   Nombres SIN prefijo de namespace y con mayúsculas/minúsculas exactas (XML distingue). Fuera
   siempre: script, style, foreignObject, a, use, image, animate*, set, iframe, object, embed,
   feImage/filtros, pattern, mask, clipPath y cualquier nombre con `:`. */

const ELEMENTOS: ReadonlySet<string> = new Set([
  // Los que emite bpmn.io (a, b, c).
  'svg', 'g', 'defs', 'marker', 'path', 'rect', 'circle', 'polygon', 'text', 'tspan',
  // Geometría y texto inertes que hoy no se emiten (line sí, en componerSvg): sin href ni
  // contenido activo posible, se admiten para no romper un diagrama futuro.
  'line', 'polyline', 'ellipse', 'title', 'desc',
])

const ATRIBUTOS: ReadonlySet<string> = new Set([
  // Documento. Los únicos con `:`; los valores de xmlns/xmlns:xlink/xml:space se fijan abajo.
  'xmlns', 'xmlns:xlink', 'xml:space', 'version', 'id', 'class', 'style',
  // Marcas que bpmn-js / diagram-js dejan en el SVG.
  'data-element-id', 'data-marker', 'data-corner-radius', 'lineHeight',
  // Geometría.
  'x', 'y', 'width', 'height', 'viewBox', 'transform', 'overflow',
  'd', 'points', 'rx', 'ry', 'cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2', 'dx', 'dy',
  // Marcadores (puntas de flecha).
  // marker-mid NO: no está en el inventario y repite el marcador en cada vértice del trazo.
  'refX', 'refY', 'markerWidth', 'markerHeight', 'markerUnits', 'orient', 'marker-start', 'marker-end',
  // Pintura (atributos de presentación: mismas propiedades que admite `style`).
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-dasharray',
  'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity',
  'opacity', 'visibility', 'display', 'pointer-events',
  // Texto.
  'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline',
])
// Fuera siempre (no están arriba): on*, href, xlink:href, src, xml:base, formaction, y cualquier
// otro nombre con `:` (x:href con xmlns:x=xlink, etc.).

const PROPIEDADES_CSS: ReadonlySet<string> = new Set([
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-dasharray',
  'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity',
  'opacity', 'marker-start', 'marker-end',
  'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline',
  'white-space', 'display', 'visibility', 'pointer-events',
  'transform', 'transform-box', 'transform-origin',
])

/** Funciones admitidas dentro de un valor (en minúsculas). `url(` va aparte: solo `url(#id)`. */
const FUNCIONES_CSS: ReadonlySet<string> = new Set([
  'rgb', 'rgba', 'hsl', 'hsla', 'matrix', 'translate', 'scale', 'rotate', 'skewx', 'skewy',
])

/** Se buscan en el valor decodificado, en minúsculas y sin ningún espacio ni control (así
 *  `java&#9;script:` o `data :` tampoco pasan). `/*` corta los comentarios CSS con los que se
 *  parte una palabra (`u/**\/rl(`). */
const PROHIBIDOS: readonly string[] = ['javascript:', 'vbscript:', 'data:', 'expression(', '/*']

const ENTIDADES: ReadonlyMap<string, string> = new Map([
  ['amp', '&'], ['lt', '<'], ['gt', '>'], ['quot', '"'], ['apos', "'"],
])

/* ---------- Caracteres ---------- */

const TAB = 0x09, LF = 0x0a, CR = 0x0d, ESPACIO = 0x20
const COMILLA = 0x22, NUMERAL = 0x23, AMP = 0x26, APOSTROFO = 0x27, PAR_A = 0x28, PAR_C = 0x29
const BARRA = 0x2f, PUNTO_Y_COMA = 0x3b, MENOR = 0x3c, IGUAL = 0x3d, MAYOR = 0x3e
const ARROBA = 0x40, CORCHETE_A = 0x5b, BARRA_INV = 0x5c, ACENTO_GRAVE = 0x60, LLAVE_A = 0x7b, LLAVE_C = 0x7d
const EXCLAMACION = 0x21, INTERROGACION = 0x3f, BOM = 0xfeff

const esEspacio = (c: number): boolean => c === ESPACIO || c === TAB || c === LF || c === CR
const esLetra = (c: number): boolean => (c >= 0x61 && c <= 0x7a) || (c >= 0x41 && c <= 0x5a)
const esDigito = (c: number): boolean => c >= 0x30 && c <= 0x39

/** Caracteres de nombre XML (aproximación estricta: ASCII de nombre y todo lo no-ASCII). Un
 *  nombre raro solo sirve para emparejar apertura y cierre: nunca está en la lista blanca. */
const esCharNombre = (c: number): boolean =>
  esLetra(c) || esDigito(c) || c === 0x5f || c === 0x3a || c === 0x2e || c === 0x2d || c >= 0x80

/** Valor de atributo sin comillas (sintaxis HTML): se acepta y se normaliza. */
const esCharSinComillas = (c: number): boolean =>
  c > ESPACIO && c !== COMILLA && c !== APOSTROFO && c !== MENOR && c !== MAYOR && c !== IGUAL &&
  c !== ACENTO_GRAVE && c !== BARRA

/** Identificador CSS (sin escapes: `\` ya se rechazó). */
const esCharIdent = (c: number): boolean => esLetra(c) || esDigito(c) || c === 0x2d || c === 0x5f || c >= 0x80

/** Id válido dentro de `url(#id)`: [A-Za-z0-9_.:-]. */
const esCharId = (c: number): boolean =>
  esLetra(c) || esDigito(c) || c === 0x5f || c === 0x2e || c === 0x3a || c === 0x2d

/** Punto de código admitido por XML 1.0 (Char). */
const esCodigoXml = (cp: number): boolean =>
  cp === TAB || cp === LF || cp === CR || (cp >= 0x20 && cp <= 0xd7ff) ||
  (cp >= 0xe000 && cp <= 0xfffd) || (cp >= 0x10000 && cp <= 0x10ffff)

function falla(motivo: string): never {
  throw new Error('SVG rechazado: ' + motivo)
}

function bytesUtf8(s: string): number {
  return new TextEncoder().encode(s).byteLength
}

/* ---------- Entidades ---------- */

function valorDigito(c: number, base: number): number {
  if (esDigito(c)) return c - 0x30
  if (base === 16 && c >= 0x61 && c <= 0x66) return c - 0x57
  if (base === 16 && c >= 0x41 && c <= 0x46) return c - 0x37
  return -1
}

/** Lee la referencia que empieza en s[i] === '&' sin pasar de `fin`. Devuelve [largo, texto] si es
 *  una entidad estándar (&amp; &lt; &gt; &quot; &apos; &#N; &#xH;) de un carácter XML válido, o
 *  null. Lee a lo sumo 11 caracteres: O(1). */
function leerEntidad(s: string, i: number, fin: number): [number, string] | null {
  let j = i + 1
  if (j < fin && s.charCodeAt(j) === NUMERAL) {
    j++
    let base = 10
    if (j < fin && s.charCodeAt(j) === 0x78) { base = 16; j++ }
    const ini = j
    let cp = 0
    while (j < fin && j - ini < 8) {
      const d = valorDigito(s.charCodeAt(j), base)
      if (d < 0) break
      cp = cp * base + d
      j++
    }
    if (j === ini || j >= fin || s.charCodeAt(j) !== PUNTO_Y_COMA || !esCodigoXml(cp)) return null
    return [j + 1 - i, String.fromCodePoint(cp)]
  }
  const ini = j
  while (j < fin && j - ini < 4 && esLetra(s.charCodeAt(j))) j++
  if (j >= fin || s.charCodeAt(j) !== PUNTO_Y_COMA) return null
  const t = ENTIDADES.get(s.slice(ini, j))
  return t === undefined ? null : [j + 1 - i, t]
}

/* ---------- Salida ---------- */

const DEMASIADO_GRANDE = 'El diagrama pasa de 2 MB'

/** Acumula la salida y corta en cuanto pasa del tope (contado en unidades UTF-16, que nunca son
 *  más que los bytes UTF-8): un SVG que crece al re-escaparse (cada `&` suelto pasa a `&amp;`) no
 *  llega a ocupar más memoria que eso. El tope exacto en bytes se revisa al final. */
class Salida {
  private readonly partes: string[] = []
  private largo = 0
  escribir(t: string): void {
    this.largo += t.length
    if (this.largo > MAX_SVG) throw new Error(DEMASIADO_GRANDE)
    this.partes.push(t)
  }
  texto(): string {
    return this.partes.join('')
  }
}

/* ---------- Texto ---------- */

/** Copia a `out` el texto s[ini, fin) re-escapado: un `&` que no forme entidad estándar sale como
 *  `&amp;`, `>` como `&gt;` (`<` no puede aparecer: abriría una etiqueta), y los caracteres que XML
 *  no admite (controles, surrogates sueltos, U+FFFE/U+FFFF) se quitan. Tildes y demás se conservan. */
function escribirTexto(s: string, ini: number, fin: number, out: Salida): void {
  let desde = ini
  let i = ini
  while (i < fin) {
    const c = s.charCodeAt(i)
    if (c === AMP) {
      const e = leerEntidad(s, i, fin)
      if (e !== null) { i += e[0]; continue }
      out.escribir(s.slice(desde, i) + '&amp;')
      desde = ++i
      continue
    }
    if (c === MAYOR) {
      out.escribir(s.slice(desde, i) + '&gt;')
      desde = ++i
      continue
    }
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < fin) {
      const d = s.charCodeAt(i + 1)
      if (d >= 0xdc00 && d <= 0xdfff) { i += 2; continue }
    }
    if ((c < ESPACIO && c !== TAB && c !== LF && c !== CR) || (c >= 0xd800 && c <= 0xdfff) || c === 0xfffe || c === 0xffff) {
      out.escribir(s.slice(desde, i))
      desde = ++i
      continue
    }
    i++
  }
  out.escribir(s.slice(desde, fin))
}

/* ---------- Valores de atributo ---------- */

/** Decodifica las entidades de un valor de atributo y normaliza tab/LF/CR a espacio (como hace un
 *  parser XML). null si tiene un `&` que no es entidad estándar o un carácter que XML no admite:
 *  el atributo se quita entero. */
function decodificarValor(v: string): string | null {
  const partes: string[] = []
  const n = v.length
  let desde = 0
  let i = 0
  while (i < n) {
    const c = v.charCodeAt(i)
    if (c === AMP) {
      const e = leerEntidad(v, i, n)
      if (e === null) return null
      partes.push(v.slice(desde, i), e[1].charCodeAt(0) < ESPACIO ? ' ' : e[1])
      i += e[0]
      desde = i
      continue
    }
    if (c < ESPACIO) {
      if (c !== TAB && c !== LF && c !== CR) return null
      partes.push(v.slice(desde, i), ' ')
      desde = ++i
      continue
    }
    if (c >= 0xd800 && c <= 0xdfff) {
      const d = i + 1 < n ? v.charCodeAt(i + 1) : 0
      if (c <= 0xdbff && d >= 0xdc00 && d <= 0xdfff) { i += 2; continue }
      return null
    }
    if (c === 0xfffe || c === 0xffff) return null
    i++
  }
  if (desde === 0) return v
  partes.push(v.slice(desde))
  return partes.join('')
}

/** El valor sin espacios ni controles y en minúsculas, para buscar PROHIBIDOS. */
function compactar(v: string): string {
  const partes: string[] = []
  let desde = 0
  for (let i = 0; i < v.length; i++) {
    if (v.charCodeAt(i) <= ESPACIO) {
      if (i > desde) partes.push(v.slice(desde, i))
      desde = i + 1
    }
  }
  partes.push(v.slice(desde))
  return partes.join('').toLowerCase()
}

/** v[p] es lo que sigue a `url(`. Devuelve el índice tras el `)` si es `#id`, `'#id'` o `"#id"`
 *  (con espacios opcionales alrededor), o -1. */
function finDeUrl(v: string, p: number): number {
  const n = v.length
  while (p < n && v.charCodeAt(p) <= ESPACIO) p++
  let comilla = -1
  if (p < n && (v.charCodeAt(p) === COMILLA || v.charCodeAt(p) === APOSTROFO)) comilla = v.charCodeAt(p++)
  if (p >= n || v.charCodeAt(p) !== NUMERAL) return -1
  const ini = ++p
  while (p < n && esCharId(v.charCodeAt(p))) p++
  if (p === ini) return -1
  if (comilla >= 0) {
    if (p >= n || v.charCodeAt(p) !== comilla) return -1
    p++
  }
  while (p < n && v.charCodeAt(p) <= ESPACIO) p++
  if (p >= n || v.charCodeAt(p) !== PAR_C) return -1
  return p + 1
}

/** Regla de valores (atributos y declaraciones de `style`), sobre el valor YA decodificado:
 *  - fuera si tiene `\` (escapes CSS), `<` o `@` (at-rules como @import);
 *  - fuera si, compactado, contiene javascript:, vbscript:, data:, expression( o un comentario CSS;
 *  - cada `nombre(` tiene que ser una función de FUNCIONES_CSS o un `url(#id)` (con o sin comillas);
 *    cualquier otra (image-set, image, src, var, attr, calc…) o un `(` sin nombre, fuera.
 *  Recorrido lineal: `url(` se valida consumiendo sus propios caracteres. */
function valorSeguro(v: string): boolean {
  for (let i = 0; i < v.length; i++) {
    const c = v.charCodeAt(i)
    if (c === BARRA_INV || c === MENOR || c === ARROBA) return false
  }
  const compacto = compactar(v)
  for (const p of PROHIBIDOS) if (compacto.includes(p)) return false
  // Último identificador visto; sigue siendo candidato a nombre de función mientras después de él
  // solo venga espacio (`url (` también cuenta como `url(`).
  let ini = -1
  let fin = -1
  for (let i = 0; i < v.length; i++) {
    const c = v.charCodeAt(i)
    if (esCharIdent(c)) {
      if (fin !== i) ini = i
      fin = i + 1
    } else if (c <= ESPACIO) {
      // el identificador anterior sigue siendo candidato
    } else if (c === PAR_A) {
      const nombre = ini >= 0 ? v.slice(ini, fin).toLowerCase() : ''
      if (nombre === 'url') {
        const k = finDeUrl(v, i + 1)
        if (k < 0) return false
        i = k - 1
      } else if (!FUNCIONES_CSS.has(nombre)) {
        return false
      }
      ini = fin = -1
    } else {
      ini = fin = -1
    }
  }
  return true
}

/** Comillas pares y sin llaves: una declaración con una cadena sin cerrar o un bloque `{…}` no
 *  tiene uso legítimo en el `style` de un diagrama. */
function declaracionBienFormada(v: string): boolean {
  let dobles = 0
  let simples = 0
  for (let i = 0; i < v.length; i++) {
    const c = v.charCodeAt(i)
    if (c === COMILLA) dobles++
    else if (c === APOSTROFO) simples++
    else if (c === LLAVE_A || c === LLAVE_C) return false
  }
  return dobles % 2 === 0 && simples % 2 === 0
}

/** `style`: se parte por `;`, cada `prop: valor` con prop en PROPIEDADES_CSS y valor seguro; lo
 *  demás se descarta. Se re-serializa como `prop: valor; prop: valor;` (el formato de bpmn.io).
 *  null si no queda ninguna declaración. */
function sanearEstilo(v: string, dentroDeMarcador: boolean): string | null {
  const salida: string[] = []
  for (const decl of v.split(';')) {
    const k = decl.indexOf(':')
    if (k < 0) continue
    const prop = decl.slice(0, k).trim().toLowerCase()
    const valor = decl.slice(k + 1).trim()
    if (!PROPIEDADES_CSS.has(prop) || valor === '') continue
    if (dentroDeMarcador && esPropiedadDeMarcador(prop)) continue
    if (!declaracionBienFormada(valor) || !valorSeguro(valor)) continue
    salida.push(prop + ': ' + valor + ';')
  }
  return salida.length > 0 ? salida.join(' ') : null
}

/** marker-start / marker-end. Dentro del contenido de un `<marker>` se quitan: un marcador cuyo
 *  contenido usa marcadores es el `<use>` encadenado de siempre (10 trazos que usan un marcador
 *  con 10 trazos que usan otro… crece exponencial al pintar). bpmn.io nunca los anida. */
const esPropiedadDeMarcador = (nombre: string): boolean => nombre === 'marker-start' || nombre === 'marker-end'

/** Valor saneado de un atributo de la lista blanca, o null para quitarlo. */
function sanearAtributo(nombre: string, crudo: string, dentroDeMarcador: boolean): string | null {
  if (dentroDeMarcador && esPropiedadDeMarcador(nombre)) return null
  const v = decodificarValor(crudo)
  if (v === null) return null
  if (nombre === 'xmlns') return v === SVG_NS ? v : null
  if (nombre === 'xmlns:xlink') return v === XLINK_NS ? v : null
  if (nombre === 'xml:space') return v === 'default' || v === 'preserve' ? v : null
  if (nombre === 'style') return sanearEstilo(v, dentroDeMarcador)
  return valorSeguro(v) ? v : null
}

const ESCAPE_ATRIBUTO: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
const escaparAtributo = (v: string): string => v.replace(/[&<>"]/g, (c) => ESCAPE_ATRIBUTO[c] ?? c)

/* ---------- Etiquetas ---------- */

interface Etiqueta {
  nombre: string
  /** [nombre, valor crudo tal cual venía entre comillas | null si no traía valor]. */
  atributos: Array<[string, string | null]>
  autocierre: boolean
  /** Índice justo después del `>`. */
  fin: number
}

function finDeNombre(s: string, i: number): number {
  let j = i
  while (j < s.length && esCharNombre(s.charCodeAt(j))) j++
  return j
}

function saltarEspacios(s: string, i: number): number {
  while (i < s.length && esEspacio(s.charCodeAt(i))) i++
  return i
}

/** s[i] === '<' y lo que sigue no es `/`, `!` ni `?`. */
function leerApertura(s: string, i: number): Etiqueta {
  const n = s.length
  let j = finDeNombre(s, i + 1)
  if (j === i + 1) falla('etiqueta sin nombre')
  const nombre = s.slice(i + 1, j)
  const atributos: Array<[string, string | null]> = []
  for (;;) {
    const antes = j
    j = saltarEspacios(s, j)
    if (j >= n) falla('etiqueta <' + recorte(nombre) + '> sin cerrar')
    const c = s.charCodeAt(j)
    if (c === MAYOR) return { nombre, atributos, autocierre: false, fin: j + 1 }
    if (c === BARRA) {
      if (j + 1 < n && s.charCodeAt(j + 1) === MAYOR) return { nombre, atributos, autocierre: true, fin: j + 2 }
      falla('«/» suelto dentro de <' + recorte(nombre) + '>')
    }
    if (j === antes) falla('atributos sin espacio entre ellos en <' + recorte(nombre) + '>')
    const finNombre = finDeNombre(s, j)
    if (finNombre === j) falla('carácter inesperado dentro de <' + recorte(nombre) + '>')
    const atributo = s.slice(j, finNombre)
    j = finNombre
    let k = saltarEspacios(s, j)
    if (k < n && s.charCodeAt(k) === IGUAL) {
      k = saltarEspacios(s, k + 1)
      if (k >= n) falla('etiqueta <' + recorte(nombre) + '> sin cerrar')
      const q = s.charCodeAt(k)
      if (q === COMILLA || q === APOSTROFO) {
        const cierre = s.indexOf(q === COMILLA ? '"' : "'", k + 1)
        if (cierre < 0) falla('valor de atributo sin cerrar')
        atributos.push([atributo, s.slice(k + 1, cierre)])
        j = cierre + 1
      } else {
        const ini = k
        while (k < n && esCharSinComillas(s.charCodeAt(k))) k++
        if (k === ini) falla('atributo con «=» y sin valor')
        atributos.push([atributo, s.slice(ini, k)])
        j = k
      }
    } else {
      atributos.push([atributo, null]) // atributo sin valor (sintaxis HTML): se descarta
    }
  }
}

/** s[i] === '<' y s[i+1] === '/'. */
function leerCierre(s: string, i: number): { nombre: string; fin: number } {
  const j = finDeNombre(s, i + 2)
  if (j === i + 2) falla('cierre sin nombre')
  const k = saltarEspacios(s, j)
  if (k >= s.length || s.charCodeAt(k) !== MAYOR) falla('cierre mal formado')
  return { nombre: s.slice(i + 2, j), fin: k + 1 }
}

/** Índice tras la próxima `marca` a partir de `desde`; lanza si no está. */
function finDe(s: string, marca: string, desde: number, que: string): number {
  const j = s.indexOf(marca, desde)
  if (j < 0) falla(que + ' sin cerrar')
  return j + marca.length
}

/** Nombres en mensajes de error: acotados, que el mensaje no cargue 2 MB. */
const recorte = (t: string): string => (t.length > 40 ? t.slice(0, 40) + '…' : t)

function serializarApertura(e: Etiqueta, dentroDeMarcador: boolean): string {
  const cierre = e.autocierre ? '/>' : '>'
  if (e.atributos.length === 0) return '<' + e.nombre + cierre
  let r = '<' + e.nombre
  const vistos = new Set<string>()
  for (const [nombre, crudo] of e.atributos) {
    if (!ATRIBUTOS.has(nombre) || vistos.has(nombre)) continue
    vistos.add(nombre) // atributo repetido: vale el primero
    if (crudo === null) continue
    const valor = sanearAtributo(nombre, crudo, dentroDeMarcador)
    if (valor !== null) r += ' ' + nombre + '="' + escaparAtributo(valor) + '"'
  }
  return r + cierre
}

/* ---------- Documento ---------- */

/** `<!DOCTYPE` ya leído; j apunta justo detrás. Se admite el de saveSVG (PUBLIC "…" "…") y
 *  cualquiera sin subconjunto interno; con `[` (entidades) lanza. */
function saltarDoctype(s: string, j: number): number {
  const n = s.length
  if (j >= n || !esEspacio(s.charCodeAt(j))) falla('DOCTYPE mal formado')
  while (j < n) {
    const c = s.charCodeAt(j)
    if (c === COMILLA || c === APOSTROFO) {
      const k = s.indexOf(c === COMILLA ? '"' : "'", j + 1)
      if (k < 0) falla('DOCTYPE sin cerrar')
      j = k + 1
      continue
    }
    if (c === CORCHETE_A) falla('DOCTYPE con subconjunto interno (entidades)')
    if (c === MENOR) falla('DOCTYPE mal formado')
    if (c === MAYOR) return j + 1
    j++
  }
  return falla('DOCTYPE sin cerrar')
}

/** Recorre el prólogo (declaración XML, comentarios, DOCTYPE) y devuelve el índice del `<` del
 *  elemento raíz. Todo lo del prólogo se descarta. */
function saltarPrologo(s: string): number {
  const n = s.length
  let i = n > 0 && s.charCodeAt(0) === BOM ? 1 : 0
  let declaracion = false
  let doctype = false
  for (;;) {
    i = saltarEspacios(s, i)
    if (i >= n) falla('no hay elemento raíz')
    if (s.charCodeAt(i) !== MENOR) falla('texto antes del elemento raíz')
    if (s.startsWith('<?', i)) {
      const finNombre = finDeNombre(s, i + 2)
      if (declaracion || s.slice(i + 2, finNombre) !== 'xml') falla('instrucción de procesamiento no permitida')
      i = finDe(s, '?>', finNombre, 'declaración XML')
      declaracion = true
      continue
    }
    if (s.startsWith('<!--', i)) { i = finDe(s, '-->', i + 4, 'comentario'); continue }
    if (s.startsWith('<!DOCTYPE', i)) {
      if (doctype) falla('más de un DOCTYPE')
      i = saltarDoctype(s, i + 9)
      doctype = true
      continue
    }
    return i
  }
}

/** Sanea el SVG que renderizó el navegador con bpmn.io (§6.5) reconstruyéndolo con listas
 *  blancas. Devuelve el SVG sin prólogo, empezando por `<svg`. Lanza si no es un SVG bien formado,
 *  si pasa de MAX_SVG bytes (antes o después de sanear) o si anida más de MAX_PROFUNDIDAD niveles. */
export function sanearSvg(svg: string): string {
  if (typeof svg !== 'string') falla('no es texto')
  if (svg.length > MAX_SVG || bytesUtf8(svg) > MAX_SVG) throw new Error(DEMASIADO_GRANDE)
  const s = svg
  const n = s.length

  let i = saltarPrologo(s)
  const c1 = i + 1 < n ? s.charCodeAt(i + 1) : -1
  if (c1 === BARRA || c1 === EXCLAMACION || c1 === INTERROGACION) falla('declaración no permitida antes del elemento raíz')
  const raiz = leerApertura(s, i)
  if (raiz.nombre !== 'svg') falla('el elemento raíz no es <svg>')
  const out = new Salida()
  out.escribir(serializarApertura(raiz, false))
  i = raiz.fin

  if (!raiz.autocierre) {
    const pila: string[] = ['svg']
    // Profundidad (largo de la pila) a la que empezó el subárbol que se está descartando; -1 si
    // no se descarta nada. Al cerrarse ese elemento la pila vuelve a medir esto.
    let descarteDesde = -1
    // `<marker>` abiertos (emitidos) que contienen la posición actual.
    let marcadores = 0
    while (pila.length > 0) {
      if (i >= n) falla('termina sin cerrar <' + recorte(pila[pila.length - 1]) + '>')
      const c = s.charCodeAt(i)
      if (c !== MENOR) {
        const sig = s.indexOf('<', i)
        const fin = sig < 0 ? n : sig
        if (descarteDesde < 0) escribirTexto(s, i, fin, out)
        i = fin
        continue
      }
      const c2 = i + 1 < n ? s.charCodeAt(i + 1) : -1
      if (c2 === BARRA) {
        const cierre = leerCierre(s, i)
        const abierto = pila.pop()
        if (cierre.nombre !== abierto) falla('</' + recorte(cierre.nombre) + '> no cierra <' + recorte(abierto ?? '') + '>')
        if (descarteDesde < 0) {
          out.escribir('</' + cierre.nombre + '>')
          if (cierre.nombre === 'marker') marcadores--
        } else if (pila.length === descarteDesde) descarteDesde = -1
        i = cierre.fin
        continue
      }
      if (c2 === EXCLAMACION) {
        if (s.startsWith('<!--', i)) { i = finDe(s, '-->', i + 4, 'comentario'); continue }
        if (s.startsWith('<![CDATA[', i)) { i = finDe(s, ']]>', i + 9, 'CDATA'); continue }
        falla('declaración <! dentro del SVG')
      }
      if (c2 === INTERROGACION) falla('instrucción <? dentro del SVG')
      if (pila.length >= MAX_PROFUNDIDAD) falla('más de ' + MAX_PROFUNDIDAD + ' niveles de anidamiento')
      const e = leerApertura(s, i)
      i = e.fin
      if (descarteDesde < 0) {
        if (ELEMENTOS.has(e.nombre)) {
          out.escribir(serializarApertura(e, marcadores > 0))
          if (e.nombre === 'marker' && !e.autocierre) marcadores++
        } else if (!e.autocierre) {
          descarteDesde = pila.length
        }
      }
      if (!e.autocierre) pila.push(e.nombre)
    }
  }

  // Epílogo: solo espacio y comentarios, que se descartan.
  for (;;) {
    i = saltarEspacios(s, i)
    if (i >= n) break
    if (s.startsWith('<!--', i)) { i = finDe(s, '-->', i + 4, 'comentario'); continue }
    falla('contenido después de </svg>')
  }

  const resultado = out.texto()
  if (bytesUtf8(resultado) > MAX_SVG) throw new Error(DEMASIADO_GRANDE)
  return resultado
}
