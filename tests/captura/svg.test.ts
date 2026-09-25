import { describe, it, expect } from 'vitest'
import { sanearSvg, MAX_SVG } from '@/lib/captura/svg'

describe('sanearSvg', () => {
  it('quita script, foreignObject, on* y href externos; conserva #refs', () => {
    const sucio = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" onload="alert(1)">
      <script>alert(1)</script><script src="x.js"/>
      <foreignObject><div>hola</div></foreignObject>
      <a href="https://mal.co"><rect ONCLICK='x()' width="1"/></a>
      <use xlink:href="#marca"/><use href="javascript:alert(1)"/>
      <rect style="fill:url(https://mal.co/x.svg#a)"/><image href="data:image/png;base64,AAA"/>
    </svg>`
    const s = sanearSvg(sucio)
    expect(s).not.toMatch(/<script/i)
    expect(s).not.toMatch(/foreignObject/i)
    expect(s).not.toMatch(/\son[a-z]+\s*=/i)
    expect(s).not.toMatch(/https?:\/\/mal\.co/)
    expect(s).not.toMatch(/javascript:/i)
    expect(s).not.toMatch(/data:image/)
    expect(s).toContain('xlink:href="#marca"')
    expect(s.startsWith('<svg')).toBe(true)
  })

  it('rechaza lo que no es SVG y lo que pasa de 2 MB', () => {
    expect(() => sanearSvg('<html></html>')).toThrow()
    expect(() => sanearSvg('<svg>' + 'a'.repeat(MAX_SVG) + '</svg>')).toThrow()
  })

  it('quita DOCTYPE y entidades', () => {
    expect(sanearSvg('<!DOCTYPE svg [<!ENTITY x "y">]><svg>&x;</svg>')).not.toMatch(/DOCTYPE|ENTITY/)
  })

  // --- Casos de ataque adicionales (más allá de los que trae el plan) ---

  it('quita on* sin comillas, en mayúsculas y con espacios raros alrededor del =', () => {
    const svg = `<svg><rect OnLoad =alert(1) width="1"/></svg>`
    const s = sanearSvg(svg)
    expect(s).not.toMatch(/on[a-z]+\s*=/i)
    expect(s).not.toMatch(/alert/i)
  })

  it('resiste <script> partido por anidamiento (<scr<script></script>ipt>)', () => {
    // Truco clásico: un regex que empareja apertura+cierre en un solo match dispara sobre
    // <script></script> (el par interno), reconstruyendo un <script> "sano" con los
    // fragmentos que quedan a los lados ("<scr" + "ipt>"). Por eso el saneador NO usa un
    // regex que abarque el contenido: quita apertura y cierre por separado y repite hasta
    // punto fijo, así el <script> reconstruido cae en la siguiente vuelta.
    const svg = `<svg><scr<script></script>ipt></svg>`
    const s = sanearSvg(svg)
    expect(s).not.toMatch(/<script/i)
  })

  it('quita <ScRiPt> en mayúsculas y minúsculas mezcladas', () => {
    // La etiqueta desaparece (apertura y cierre); el texto que quedaba adentro puede
    // sobrevivir como texto suelto -- ya no es un <script> ejecutable, es inerte.
    const svg = `<svg><ScRiPt>alert(1)</ScRiPt></svg>`
    const s = sanearSvg(svg)
    expect(s).not.toMatch(/<script/i)
  })

  it('quita <foreignobject> en minúsculas', () => {
    const svg = `<svg><foreignobject><div>hola</div></foreignobject></svg>`
    const s = sanearSvg(svg)
    expect(s).not.toMatch(/foreignobject/i)
  })

  it('quita href con espacios alrededor del = y javascript: en mayúsculas', () => {
    const svg = `<svg><a href = "   JAVASCRIPT:alert(1)  "><rect width="1"/></a></svg>`
    const s = sanearSvg(svg)
    expect(s).not.toMatch(/javascript:/i)
    expect(s).not.toMatch(/\shref\s*=/i)
  })

  it('quita style con url(...) externo', () => {
    const svg = `<svg><rect style="background:url('http://x')"/></svg>`
    const s = sanearSvg(svg)
    expect(s).not.toMatch(/http:\/\/x/)
    expect(s).toContain('background:none')
  })

  // Decisión: xlink:href=" #a" (espacio ANTES del #) NO se trata como referencia interna
  // segura. Ni la spec de XML ni el comportamiento de los navegadores garantizan que ese
  // espacio se recorte al resolver la referencia, así que ante la duda se trata como
  // "no es un #id propio" y se quita el atributo entero, igual que un href externo.
  it('xlink:href con espacio antes del # se quita entero (no se trata como #ref interno)', () => {
    const svg = `<svg><use xlink:href=" #a"/></svg>`
    const s = sanearSvg(svg)
    expect(s).not.toMatch(/xlink:href/)
    expect(s).not.toContain('#a')
  })

  it('conserva un SVG real de bpmn.io con <defs>/<marker> y marker-end="url(#m)"', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="m" markerWidth="10" markerHeight="10" orient="auto">
          <path d="M0,0 L10,5 L0,10 z"/>
        </marker>
      </defs>
      <path marker-end="url(#m)" d="M0,0 L100,100" stroke="black"/>
    </svg>`
    const s = sanearSvg(svg)
    expect(s).toContain('url(#m)')
    expect(s).toMatch(/<marker\b/)
    expect(s).toMatch(/<\/marker>/)
  })
})
