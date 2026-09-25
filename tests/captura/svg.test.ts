import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { sanearSvg, MAX_SVG, MAX_PROFUNDIDAD } from '@/lib/captura/svg'

const NS = 'xmlns="http://www.w3.org/2000/svg"'
const envolver = (cuerpo: string): string => `<svg ${NS}>${cuerpo}</svg>`
const contar = (s: string, re: RegExp): number => (s.match(re) ?? []).length
const textos = (s: string): string[] => Array.from(s.matchAll(/<(?:tspan|text)\b[^>]*>([^<]*)</g), (m) => m[1])

/** saveSVG() real de bpmn-js 17 sobre la semilla (sacado de
 *  reference/captura/ejemplos/fotografia-aprobacion.html) con el prólogo exacto de
 *  node_modules/bpmn-js/lib/BaseViewer.js. autocrlf puede traerlo con CRLF: se normaliza. */
const FIXTURE = readFileSync(path.resolve(__dirname, 'fixtures/diagrama-bpmnio.svg'), 'utf8').replace(/\r\n/g, '\n')
const CUERPO = FIXTURE.slice(FIXTURE.indexOf('<svg'))

describe('sanearSvg: casos del plan', () => {
  it('quita script, foreignObject, on* y href externos; conserva #refs', () => {
    const sucio = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" onload="alert(1)">
      <script>alert(1)</script><script src="x.js"/>
      <foreignObject><div>hola</div></foreignObject>
      <a href="https://mal.co"><rect ONCLICK='x()' width="1"/></a>
      <use xlink:href="#marca"/><use href="javascript:alert(1)"/>
      <rect style="fill:url(https://mal.co/x.svg#a)"/><image href="data:image/png;base64,AAA"/>
      <path d="M0 0L9 9" marker-end="url(#m)" style="marker-start: url('#m')"/>
    </svg>`
    const s = sanearSvg(sucio)
    expect(s).not.toMatch(/<script/i)
    expect(s).not.toMatch(/foreignObject/i)
    expect(s).not.toMatch(/\son[a-z]+\s*=/i)
    expect(s).not.toMatch(/https?:\/\/mal\.co/)
    expect(s).not.toMatch(/javascript:/i)
    expect(s).not.toMatch(/data:image/)
    expect(s).not.toContain('hola')
    // `<use>` ya no se admite (bpmn.io no lo emite y abre la puerta a los <use> encadenados): lo
    // que se conserva de las referencias internas son los url(#id) de los marcadores.
    expect(s).not.toMatch(/<use/)
    expect(s).toContain('marker-end="url(#m)"')
    expect(s).toContain(`style="marker-start: url('#m');"`)
    expect(s.startsWith('<svg')).toBe(true)
  })

  it('rechaza lo que no es SVG y lo que pasa de 2 MB', () => {
    expect(() => sanearSvg('<html></html>')).toThrow()
    expect(() => sanearSvg('<svg>' + 'a'.repeat(MAX_SVG) + '</svg>')).toThrow()
  })

  it('quita DOCTYPE y entidades', () => {
    // Con subconjunto interno (donde se declaran las entidades) lanza: se falla cerrado.
    expect(() => sanearSvg('<!DOCTYPE svg [<!ENTITY x "y">]><svg>&x;</svg>')).toThrow(/subconjunto/)
    // Sin subconjunto (el de saveSVG) se descarta, y la referencia a una entidad no estándar
    // queda como texto escapado.
    const s = sanearSvg('<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg>&x;</svg>')
    expect(s).not.toMatch(/DOCTYPE|ENTITY/)
    expect(s).toBe('<svg>&amp;x;</svg>')
  })
})

describe('sanearSvg: SVG real de bpmn.io', () => {
  it('acepta el prólogo exacto de saveSVG (C1) y devuelve el cuerpo byte a byte', () => {
    expect(FIXTURE.startsWith('<?xml version="1.0" encoding="utf-8"?>\n<!-- created with bpmn-js / http://bpmn.io -->\n<!DOCTYPE svg PUBLIC')).toBe(true)
    const s = sanearSvg(FIXTURE)
    expect(s.startsWith('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"')).toBe(true)
    expect(s).toBe(CUERPO)
  })

  it("conserva todos los marcadores y sus url('#…')", () => {
    const s = sanearSvg(FIXTURE)
    const urls = FIXTURE.match(/url\('#[^']+'\)/g) ?? []
    expect(urls.length).toBeGreaterThan(20)
    expect(s.match(/url\('#[^']+'\)/g)).toEqual(urls)
    expect(contar(s, /<marker\b/g)).toBe(contar(FIXTURE, /<marker\b/g))
    for (const u of new Set(urls)) expect(s).toContain(`id="${u.slice(6, -2)}"`)
  })

  it('conserva todos los <text>/<tspan> con sus tildes', () => {
    const s = sanearSvg(FIXTURE)
    const antes = textos(FIXTURE)
    expect(antes.length).toBeGreaterThan(50)
    expect(textos(s)).toEqual(antes)
    expect(textos(s).join(' ')).toMatch(/[áéíóúñ¿]/)
  })

  it('conserva el mismo número de cada forma', () => {
    const s = sanearSvg(FIXTURE)
    for (const el of ['path', 'rect', 'circle', 'polygon', 'g', 'text', 'tspan', 'defs', 'marker']) {
      const re = new RegExp(`<${el}\\b`, 'g')
      expect(contar(s, re), el).toBe(contar(FIXTURE, re))
      expect(contar(FIXTURE, re), el).toBeGreaterThan(0)
    }
  })

  it('es idempotente', () => {
    const una = sanearSvg(FIXTURE)
    expect(sanearSvg(una)).toBe(una)
  })
})

describe('sanearSvg: vectores de la revisión', () => {
  it('C1: acepta <?xml?>, el comentario de bpmn-js y el DOCTYPE, y los descarta', () => {
    const prologo = '<?xml version="1.0" encoding="utf-8"?>\n<!-- created with bpmn-js / http://bpmn.io -->\n' +
      '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n'
    expect(sanearSvg(prologo + envolver('<rect width="1"/>'))).toBe(envolver('<rect width="1"/>'))
  })

  it.each([
    ['vacío', ''],
    ['solo prólogo', '<?xml version="1.0"?>\n<!-- nada -->'],
    ['texto antes del raíz', 'hola<svg></svg>'],
    ['raíz que no es svg', '<html></html>'],
    ['raíz con prefijo', '<s:svg xmlns:s="http://www.w3.org/2000/svg"></s:svg>'],
    ['raíz en mayúsculas', '<SVG></SVG>'],
    ['<?xml-stylesheet?>', '<?xml-stylesheet href="https://mal.co/x.css"?><svg></svg>'],
    ['dos declaraciones xml', '<?xml version="1.0"?><?xml version="1.0"?><svg></svg>'],
    ['dos DOCTYPE', '<!DOCTYPE svg><!DOCTYPE svg><svg></svg>'],
    ['DOCTYPE con subconjunto interno', '<!DOCTYPE svg [<!ENTITY a "b">]><svg></svg>'],
    ['DOCTYPE con [ entre comillas y fuera', '<!DOCTYPE svg "[" [<!ENTITY a "b">]><svg></svg>'],
    ['<!ENTITY suelta', '<!ENTITY a "b"><svg></svg>'],
    ['<!doctype html> (solo HTML)', '<!doctype html><svg></svg>'],
    ['comentario sin cerrar', '<!-- <svg></svg>'],
  ])('prólogo: lanza con %s', (_, svg) => {
    expect(() => sanearSvg(svg)).toThrow()
  })

  it('I2: <script> partido con 1, 6 y 10 capas de anidamiento lanza (etiqueta mal formada)', () => {
    for (const capas of [1, 6, 10]) {
      const svg = envolver('<scr'.repeat(capas) + '<script>alert(1)</script>' + 'ipt>'.repeat(capas))
      expect(() => sanearSvg(svg), `${capas} capas`).toThrow()
    }
  })

  it('I2: elementos prohibidos anidados se van con todo su subárbol, texto incluido', () => {
    const svg = envolver('<g><foreignObject><script>alert(1)</script><div xmlns="http://www.w3.org/1999/xhtml">' +
      '<script>alert(2)</script>hola</div></foreignObject><rect width="1"/></g><ScRiPt>alert(3)</ScRiPt>' +
      '<foreignobject><div>chao</div></foreignobject>')
    expect(sanearSvg(svg)).toBe(envolver('<g><rect width="1"/></g>'))
  })

  it('I3: prefijos de namespace (<h:script>, <s:foreignObject>, <s:script>, x:href) no pasan', () => {
    const svg = `<svg ${NS} xmlns:h="http://www.w3.org/1999/xhtml" xmlns:s="http://www.w3.org/2000/svg" ` +
      'xmlns:x="http://www.w3.org/1999/xlink">' +
      '<h:script>alert(1)</h:script>' +
      '<s:foreignObject><h:iframe src="https://mal.co"/></s:foreignObject>' +
      '<s:script>alert(2)</s:script>' +
      '<rect x:href="javascript:alert(3)" width="1"/>' +
      '</svg>'
    expect(sanearSvg(svg)).toBe(envolver('<rect width="1"/>'))
  })

  it('xmlns y xmlns:xlink solo con los URIs de SVG y XLink (no se puede cambiar de namespace)', () => {
    const svg = '<svg xmlns="http://www.w3.org/1999/xhtml"><g xmlns="http://www.w3.org/2000/svg" ' +
      'xmlns:xlink="https://mal.co"><text xmlns="http://www.w3.org/1999/xhtml">a</text></g></svg>'
    expect(sanearSvg(svg)).toBe('<svg><g xmlns="http://www.w3.org/2000/svg"><text>a</text></g></svg>')
  })

  it('SMIL: animate, set, animateTransform y animateMotion no pasan', () => {
    const svg = envolver('<rect width="1"><animate attributeName="href" values="javascript:alert(1)"/>' +
      '<set attributeName="onclick" to="alert(1)"/><animateTransform attributeName="transform"/>' +
      '<animateMotion path="M0 0"/></rect><a><set attributeName="href" to="javascript:alert(2)"/><rect/></a>')
    expect(sanearSvg(svg)).toBe(envolver('<rect width="1"></rect>'))
  })

  it('contenido después de </svg> lanza; espacio y comentarios se descartan', () => {
    expect(() => sanearSvg('<svg></svg><script>alert(1)</script>')).toThrow()
    expect(() => sanearSvg('<svg></svg>hola')).toThrow()
    expect(() => sanearSvg('<svg></svg><svg></svg>')).toThrow()
    expect(() => sanearSvg('<svg></svg><?php echo 1 ?>')).toThrow()
    expect(sanearSvg('<svg></svg>\n<!-- fin -->\n')).toBe('<svg></svg>')
    expect(sanearSvg('<svg/>')).toBe('<svg/>')
  })

  it('dentro del raíz: comentarios y CDATA se descartan; los demás <! y <? lanzan', () => {
    expect(sanearSvg(envolver('<!-- <script>alert(1)</script> --><![CDATA[<script>alert(1)</script>]]><rect/>')))
      .toBe(envolver('<rect/>'))
    for (const cuerpo of ['<!ENTITY x "y">', '<!DOCTYPE svg>', '<?xml-stylesheet href="x.css"?>', '<!-- sin cerrar', '<![CDATA[ sin cerrar']) {
      expect(() => sanearSvg(envolver(cuerpo)), cuerpo).toThrow()
    }
  })

  it('sintaxis solo-HTML: valores sin comillas se normalizan, atributos sin valor y on* se quitan', () => {
    expect(sanearSvg(envolver(`<rect width=10 height='5' hidden OnLoad =alert(1) onclick=alert(2)/>`)))
      .toBe(envolver('<rect width="10" height="5"/>'))
  })

  it('etiquetas mal formadas lanzan', () => {
    const malas = ['<rect>', '<g></rect>', '</g>', '<rect x="1"y="2"/>', '<rect / >', '<rect x=>', '<rect x="1>',
      '< rect/>', '<rect <g>/>', '<rect x=a/b/>', '<a href=`x`/>']
    for (const cuerpo of malas) expect(() => sanearSvg(envolver(cuerpo)), cuerpo).toThrow()
  })

  it.each([
    ['u\\rl( (escape CSS)', 'fill: u\\rl(https://mal.co/a)'],
    ['\\75 rl( (escape hexadecimal)', 'fill: \\75 rl(https://mal.co/a)'],
    ['u&#114;l( (entidad decimal)', 'fill: u&#114;l(https://mal.co/a)'],
    ['&#x75;rl( (entidad hexadecimal)', 'fill: &#x75;rl(https://mal.co/a)'],
    ['URL( en mayúsculas', 'fill: URL(https://mal.co/a)'],
    ['url( con espacios y comillas', 'fill: url(  "https://mal.co/a"  )'],
    ['url(#id) seguido de otro url(', 'marker-end: url(#m) url(https://mal.co/a)'],
    ['url(#id sin cerrar', 'marker-end: url(#m'],
    ['image-set(', 'fill: image-set("https://mal.co/a" 1x)'],
    ['image(', 'fill: image("https://mal.co/a")'],
    ['@\\69mport', '@\\69mport url(https://mal.co/a.css)'],
    ['@import', '@import "https://mal.co/a.css"'],
    ['comentario dentro de la palabra', 'fill: u/**/rl(https://mal.co/a)'],
    ['expression(', 'fill: expression(alert(1))'],
    ['javascript: partido con tab', 'fill: url(java&#9;script:alert(1))'],
    ['var(', 'fill: var(--x)'],
    ['( sin nombre de función', 'fill: (red)'],
    ['propiedad fuera de la lista', 'behavior: url(#m)'],
    ['-moz-binding', '-moz-binding: url(https://mal.co/a.xml#x)'],
    ['cadena sin cerrar', 'font-family: "Arial'],
    ['llaves', 'fill: red} * {fill: blue'],
  ])('CSS: %s no pasa', (_, decl) => {
    const s = sanearSvg(envolver(`<rect style='${decl}; fill: rgb(1, 2, 3);' width="1"/>`))
    expect(s).toBe(envolver('<rect style="fill: rgb(1, 2, 3);" width="1"/>'))
  })

  it('atributos de presentación con url( externo, entidades, javascript: o @ se quitan', () => {
    const s = sanearSvg(envolver('<rect fill="url(https://mal.co/a)" stroke="u&#x72;l(//mal.co)" ' +
      'class="&#106;avascript:x" id="a@b" font-family="x&y" opacity="data:,1" marker-end="url(#m)" x="1"/>'))
    expect(s).toBe(envolver('<rect marker-end="url(#m)" x="1"/>'))
  })

  it(`conserva url(#id), url('#id') y url("#id") en atributos y en style`, () => {
    const s = sanearSvg(envolver(`<path d="M0 0" marker-end="url(#m)" marker-start="url('#m')" ` +
      `fill='url("#m")' style="marker-end: url('#m'); stroke: url( #g.1:x-y );"/>`))
    expect(s).toContain('marker-end="url(#m)"')
    expect(s).toContain(`marker-start="url('#m')"`)
    expect(s).toContain('fill="url(&quot;#m&quot;)"')
    expect(s).toContain(`style="marker-end: url('#m'); stroke: url( #g.1:x-y );"`)
  })

  it('marcadores: marker-mid no pasa y dentro de un <marker> no se usan otros marcadores', () => {
    // Un marcador cuyo contenido usa marcadores es un <use> encadenado con otro nombre.
    const svg = envolver('<defs><marker id="a"><path d="M0 0" marker-end="url(#b)" ' +
      `style="marker-start: url('#b'); fill: red;"/><g><path marker-start="url(#b)"/></g></marker>` +
      '<marker id="b"><path d="M1 1"/></marker></defs>' +
      '<path d="M0 0" marker-end="url(#a)" marker-mid="url(#a)" style="marker-mid: url(#a); marker-start: url(#b);"/>')
    expect(sanearSvg(svg)).toBe(envolver('<defs><marker id="a"><path d="M0 0" style="fill: red;"/><g><path/></g></marker>' +
      '<marker id="b"><path d="M1 1"/></marker></defs>' +
      '<path d="M0 0" marker-end="url(#a)" style="marker-start: url(#b);"/>'))
  })

  it('xml:base, href, xlink:href, src y formaction se quitan; xml:space se conserva', () => {
    const s = sanearSvg(`<svg ${NS} xml:base="https://mal.co/" xml:space="preserve"><text href="https://mal.co" ` +
      'xlink:href="#a" src="x" formaction="y" x="1">hola</text></svg>')
    expect(s).toBe(`<svg ${NS} xml:space="preserve"><text x="1">hola</text></svg>`)
  })

  it('href con espacios alrededor del = y JAVASCRIPT: en mayúsculas: el <a> se va entero', () => {
    expect(sanearSvg(envolver('<a href = "   JAVASCRIPT:alert(1)  "><rect width="1"/></a>'))).toBe(envolver(''))
  })

  it('el texto se conserva intacto aunque parezca CSS o un atributo (falso positivo de antes)', () => {
    const svg = envolver('<text>la url(del portal) onda = 3</text>')
    expect(sanearSvg(svg)).toBe(svg)
  })

  it('el texto se re-escapa: & suelto, > y entidades no estándar; tildes intactas', () => {
    expect(sanearSvg(envolver('<text>Tom &amp; Jerry & Cía &lt;b&gt; 5 > 3 &#233; &#xE9; &nope; &#0; ¿Aprobación? ñandú</text>')))
      .toBe(envolver('<text>Tom &amp; Jerry &amp; Cía &lt;b&gt; 5 &gt; 3 &#233; &#xE9; &amp;nope; &amp;#0; ¿Aprobación? ñandú</text>'))
  })

  it('no quedan restos del contenido de style/script/foreignObject', () => {
    const svg = envolver('<style>rect{fill:url(https://mal.co)}</style><script>alert(1)</script>' +
      '<foreignObject><p>hola</p></foreignObject><rect/>')
    expect(sanearSvg(svg)).toBe(envolver('<rect/>'))
  })

  it('<use> (y sus cadenas estilo billion laughs) no pasa', () => {
    const capas = ['<g id="a0"><rect width="1"/></g>']
    for (let k = 1; k < 10; k++) capas.push(`<g id="a${k}">` + `<use href="#a${k - 1}"/>`.repeat(10) + '</g>')
    const s = sanearSvg(envolver('<defs>' + capas.join('') + '</defs><use xlink:href="#a9"/>'))
    expect(s).not.toMatch(/<use/)
    expect(contar(s, /<g /g)).toBe(10)
  })

  it(`anidamiento: ${MAX_PROFUNDIDAD} niveles pasan, uno más lanza (también dentro de lo descartado)`, () => {
    const n = MAX_PROFUNDIDAD - 1 // + el <svg> raíz
    expect(() => sanearSvg('<svg>' + '<g>'.repeat(n) + '</g>'.repeat(n) + '</svg>')).not.toThrow()
    expect(() => sanearSvg('<svg>' + '<g>'.repeat(n + 1) + '</g>'.repeat(n + 1) + '</svg>')).toThrow(/niveles/)
    expect(() => sanearSvg('<svg><script>' + '<b>'.repeat(n) + '</b>'.repeat(n) + '</script></svg>')).toThrow(/niveles/)
  })

  it('el tope se cuenta en bytes UTF-8, no en caracteres', () => {
    const svg = '<svg><text>' + 'é'.repeat(MAX_SVG / 2) + '</text></svg>' // 2 MB de é = 1 M caracteres
    expect(svg.length).toBeLessThan(MAX_SVG)
    expect(() => sanearSvg(svg)).toThrow(/2 MB/)
    const cabe = '<svg><text>' + 'é'.repeat(MAX_SVG / 2 - 20) + '</text></svg>'
    expect(sanearSvg(cabe)).toBe(cabe)
  })

  it('lanza si el SVG saneado pasa de 2 MB (cada & suelto crece a &amp;)', () => {
    expect(() => sanearSvg('<svg><text>' + '&'.repeat(MAX_SVG / 2) + '</text></svg>')).toThrow(/2 MB/)
  })
})

describe('sanearSvg: rendimiento lineal a ~2 MB', () => {
  const PRESUPUESTO_MS = 500
  const N = MAX_SVG - 64
  const PATH = `<path d="M 10 20 L 30 40 L 50 60" style="fill: none; stroke: rgb(17, 17, 17); stroke-width: 1.5px; marker-end: url('#m');"/>`
  const svgGrande = (): string =>
    `<svg ${NS}><defs><marker id="m"><path d="M0 0"/></marker></defs>` +
    PATH.repeat(Math.floor((1.9 * 1024 * 1024) / PATH.length)) + '</svg>'

  const casos: Array<[string, () => string, 'pasa' | 'lanza']> = [
    ['2 MB de espacios dentro de <svg>', () => '<svg>' + ' '.repeat(N) + '</svg>', 'pasa'],
    ["'<svg>' + '<g '×n", () => '<svg>' + '<g '.repeat(Math.floor(N / 3)), 'lanza'],
    ["'<svg>' + 'url('×n", () => '<svg>' + 'url('.repeat(Math.floor(N / 4)), 'lanza'],
    ["'<!DOCTYPE' + '['×n", () => '<!DOCTYPE' + '['.repeat(N), 'lanza'],
    ["'<!DOCTYPE svg ' + '\"a\" '×n (sin >)", () => '<!DOCTYPE svg ' + '"a" '.repeat(Math.floor(N / 4)), 'lanza'],
    ["'<?xml'×n", () => '<?xml'.repeat(Math.floor(N / 5)), 'lanza'],
    ['SVG válido de ~1,9 MB con muchos <path>', svgGrande, 'pasa'],
    ['<g> anidados sin cerrar', () => '<svg>' + '<g>'.repeat(Math.floor(N / 3)), 'lanza'],
    ['2 MB de <g/>', () => '<svg>' + '<g/>'.repeat(Math.floor(N / 4)) + '</svg>', 'pasa'],
    ['2 MB de comentarios', () => '<svg>' + '<!---->'.repeat(Math.floor(N / 7)) + '</svg>', 'pasa'],
    ["'<svg>' + '<!--'×n", () => '<svg>' + '<!--'.repeat(Math.floor(N / 4)), 'lanza'],
    ['style con url(×n', () => '<svg><rect style="fill: ' + 'url('.repeat(Math.floor(N / 4)) + '"/></svg>', 'pasa'],
    ['atributo con un identificador de 2 MB', () => '<svg><rect fill="' + 'a'.repeat(N) + '"/></svg>', 'pasa'],
    ['2 MB de atributos', () => '<svg><rect' + ' a="b"'.repeat(Math.floor(N / 6)) + '/></svg>', 'pasa'],
    ['style con 2 MB de ;', () => '<svg><rect style="' + ';'.repeat(N) + '"/></svg>', 'pasa'],
    ['valor entre comillas sin cerrar', () => '<svg a="' + 'x'.repeat(N), 'lanza'],
    ["2 MB de '&#' en el texto", () => '<svg><text>' + '&#'.repeat(Math.floor(N / 2)) + '</text></svg>', 'lanza'],
  ]

  it.each(casos)('%s', (_, crear, esperado) => {
    const svg = crear()
    expect(svg.length).toBeGreaterThan(MAX_SVG * 0.9)
    expect(new TextEncoder().encode(svg).byteLength).toBeLessThanOrEqual(MAX_SVG)
    const t0 = performance.now()
    let error: unknown = null
    try {
      sanearSvg(svg)
    } catch (e) {
      error = e
    }
    const ms = performance.now() - t0
    if (esperado === 'lanza') expect(error).toBeInstanceOf(Error)
    else expect(error).toBeNull()
    expect(ms).toBeLessThan(PRESUPUESTO_MS)
  })

  it('el SVG válido de ~1,9 MB sale igual que entró', () => {
    const svg = svgGrande()
    expect(sanearSvg(svg)).toBe(svg)
  })
})
