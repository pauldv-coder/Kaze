/* Enrutado ortogonal de conectores: A* sobre una rejilla dispersa de líneas candidatas.
   Ningún tramo pasa por dentro de una forma (tarea, compuerta, evento, dato o etiqueta);
   se castigan los quiebres y los tramos compartidos con conectores ya trazados.

   Portado de `reference/captura/prototipo/src/rutas.js` (Task 1.5 del plan de captura).
   Cambios frente al prototipo, y solo estos:
   · Tipos. El destino de una ruta es una forma (`ExtremoRuta`) o una línea horizontal
     (`MetaLinea`, pool externo); `esLinea` reproduce el `hasta.linea != null` del original.
   · Donde el original pasaba `null` a `Math.min`/`Math.max`/`Math.round`/una resta (la línea
     meta cuando no la hay, caso que no ocurre), se escribe `?? 0`, que es lo que JS hace con
     `null` en esas operaciones. */

export interface Punto { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }
export type Lado = 'E' | 'S' | 'O' | 'N'
/** Forma que los conectores no pueden atravesar, ya con su margen. */
export interface Obstaculo extends Rect { id: string }
/** Líneas preferidas para los tramos. */
export interface Canales { xs?: number[]; ys?: number[] }
export interface Area { x1: number; y1: number; x2: number; y2: number }
/** Forma de la que sale o a la que llega un conector, con los lados permitidos. */
export interface ExtremoRuta { rect: Rect; id?: string; lados?: Lado[] }
/** Llegar a esta línea horizontal (el borde superior de un pool externo). */
export interface MetaLinea { linea: number }
export type DestinoRuta = ExtremoRuta | MetaLinea
export interface OpcionesRuteador {
  obstaculos: Obstaculo[]; canales: Canales; area: Area
  margen?: number; quiebre?: number; compartido?: number
}
export interface Ruteador {
  ruta(desde: ExtremoRuta, hasta: DestinoRuta, op?: Record<string, unknown> | null): Punto[] | null
  dentro(x: number, y: number): boolean
  marcarUsada(pts: Punto[]): void
}

const DIRS: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]] // E, S, O, N
export const PUERTOS: Record<Lado, number> = { E: 0, S: 1, O: 2, N: 3 }

interface Entrada { f: number; g: number; k: number }
class Monticulo {
  a: Entrada[]
  constructor() { this.a = [] }
  push(x: Entrada): void { const a = this.a; a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p } }
  pop(): Entrada {
    const a = this.a; const top = a[0]; const last = a.pop()
    if (a.length && last !== undefined) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l].f < a[m].f) m = l; if (r < a.length && a[r].f < a[m].f) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m } }
    return top
  }
  get size(): number { return this.a.length }
}

const uniq = (arr: number[]): number[] => Array.from(new Set(arr.map(v => Math.round(v)))).sort((a, b) => a - b)

const esLinea = (h: DestinoRuta): h is MetaLinea => (h as Partial<MetaLinea>).linea != null

/* Punto de anclaje de un lado de una forma (rect o rombo/círculo: mismo punto medio del lado). */
export function puntoPuerto(r: Rect, lado: Lado): Punto {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2
  if (lado === 'E') return { x: r.x + r.w, y: cy }
  if (lado === 'O') return { x: r.x, y: cy }
  if (lado === 'N') return { x: cx, y: r.y }
  return { x: cx, y: r.y + r.h }
}

interface Resultado { puntos: Punto[]; costo: number }
interface Camino { camino: Punto[]; costo: number }

/* obstaculos: [{x,y,w,h,id}] ya con su margen. canales: { xs:[], ys:[] } líneas preferidas.
   area: {x1,y1,x2,y2}. */
export function crearRuteador({ obstaculos, canales, area, margen = 12, quiebre = 36, compartido = 60 }: OpcionesRuteador): Ruteador {
  const usados = new Map<string, number>()
  const claveTramo = (x1: number, y1: number, x2: number, y2: number): string => (x1 < x2 || (x1 === x2 && y1 < y2)) ? x1 + ',' + y1 + ',' + x2 + ',' + y2 : x2 + ',' + y2 + ',' + x1 + ',' + y1
  // Índice espacial: celdas de 120 px con los obstáculos que las tocan.
  const CEL = 120
  const celda = (cx: number, cy: number): number => (cx + 2048) * 8192 + (cy + 2048)
  const celdas = new Map<number, Obstaculo[]>()
  obstaculos.forEach(o => {
    for (let cx = Math.floor(o.x / CEL); cx <= Math.floor((o.x + o.w) / CEL); cx++) {
      for (let cy = Math.floor(o.y / CEL); cy <= Math.floor((o.y + o.h) / CEL); cy++) {
        const k = celda(cx, cy); let l = celdas.get(k); if (!l) celdas.set(k, l = []); l.push(o)
      }
    }
  })
  const dentro = (x: number, y: number): boolean => {
    const l = celdas.get(celda(Math.floor(x / CEL), Math.floor(y / CEL)))
    if (!l) return false
    for (let i = 0; i < l.length; i++) { const o = l[i]; if (x > o.x + 0.5 && x < o.x + o.w - 0.5 && y > o.y + 0.5 && y < o.y + o.h - 0.5) return true }
    return false
  }

  /* desde/hasta: { rect, id, lados: ['E','S','N'] }. meta opcional: { linea: y } = llegar a esa línea horizontal (pool externo). */
  function ruta(desde: ExtremoRuta, hasta: DestinoRuta, op?: Record<string, unknown> | null): Punto[] | null {
    op = op || {}
    let mejor: Resultado | null = null
    const ladosD: Lado[] = desde.lados || ['E', 'S', 'N']
    const ladosH: Lado[] = esLinea(hasta) ? ['N'] : (hasta.lados || ['O', 'N', 'S'])
    const combos: { ld: Lado; lh: Lado; cota: number }[] = []
    ladosD.forEach(ld => ladosH.forEach(lh => {
      const a = puntoPuerto(desde.rect, ld)
      const b = esLinea(hasta) ? { x: a.x, y: hasta.linea } : puntoPuerto(hasta.rect, lh)
      combos.push({ ld, lh, cota: Math.abs(a.x - b.x) + Math.abs(a.y - b.y) })
    }))
    combos.sort((x, y) => x.cota - y.cota)
    for (const c of combos) {
      if (mejor && c.cota >= mejor.costo) continue
      const r: Resultado | null = intento(desde, c.ld, hasta, c.lh, op, mejor ? mejor.costo : Infinity)
      if (r && (!mejor || r.costo < mejor.costo)) mejor = r
    }
    if (!mejor) return null
    const puntos = mejor.puntos
    puntos.forEach((p, i) => { if (i) { const q = puntos[i - 1]; const k = claveTramo(q.x, q.y, p.x, p.y); usados.set(k, (usados.get(k) || 0) + 1) } })
    return puntos
  }

  function intento(desde: ExtremoRuta, ld: Lado, hasta: DestinoRuta, lh: Lado, op: Record<string, unknown>, tope: number): Resultado | null {
    const p0 = puntoPuerto(desde.rect, ld)
    const d0 = PUERTOS[ld]
    const s = { x: p0.x + DIRS[d0][0] * margen, y: p0.y + DIRS[d0][1] * margen }
    let pF: Punto | undefined, dF: number, t: Punto | null
    if (esLinea(hasta)) { t = null; dF = 1 }
    else {
      pF = puntoPuerto(hasta.rect, lh)
      dF = (PUERTOS[lh] + 2) % 4 // llega moviéndose hacia la forma
      t = { x: pF.x - DIRS[dF][0] * margen, y: pF.y - DIRS[dF][1] * margen }
    }
    if (dentro(s.x, s.y) || (t && dentro(t.x, t.y))) return null
    // Ventana de búsqueda: primero cerca, luego toda el área.
    for (const holgura of [240, 100000]) {
      const r = buscar(s, d0, t, dF, esLinea(hasta) ? hasta.linea : null, holgura, op, tope)
      if (r) {
        const pts = [p0].concat(r.camino)
        if (t && pF) pts.push(pF)
        return { puntos: simplificar(pts), costo: r.costo }
      }
    }
    return null
  }

  function buscar(s: Punto, d0: number, t: Punto | null, dF: number, linea: number | null, holgura: number, op: Record<string, unknown>, tope: number): Camino | null {
    const minX = Math.max(area.x1, Math.min(s.x, t ? t.x : s.x) - holgura), maxX = Math.min(area.x2, Math.max(s.x, t ? t.x : s.x) + holgura)
    const yMeta = linea != null ? linea : null
    const minY = Math.max(area.y1, Math.min(s.y, t ? t.y : yMeta ?? 0) - holgura), maxY = Math.min(yMeta != null ? Math.max(area.y2, yMeta) : area.y2, Math.max(s.y, t ? t.y : yMeta ?? 0) + holgura)
    const enV = (v: number, a: number, b: number): boolean => v >= a - 0.5 && v <= b + 0.5
    let xs = [s.x, minX, maxX], ys = [s.y, minY, maxY]
    if (t) { xs.push(t.x); ys.push(t.y) }
    if (yMeta != null) ys.push(yMeta)
    obstaculos.forEach(o => {
      if (o.x + o.w >= minX - 1 && o.x <= maxX + 1) xs.push(o.x, o.x + o.w)
      if (o.y + o.h >= minY - 1 && o.y <= maxY + 1) ys.push(o.y, o.y + o.h)
    })
    ;(canales.xs || []).forEach(x => xs.push(x))
    ;(canales.ys || []).forEach(y => ys.push(y))
    xs = uniq(xs).filter(x => enV(x, minX, maxX))
    ys = uniq(ys).filter(y => enV(y, minY, maxY))
    const W = xs.length, H = ys.length
    const ix = new Map(xs.map((x, i): [number, number] => [x, i])), iy = new Map(ys.map((y, i): [number, number] => [y, i]))
    const sx = ix.get(Math.round(s.x)), sy = iy.get(Math.round(s.y))
    if (sx == null || sy == null) return null
    const tx = t ? ix.get(Math.round(t.x)) : null, ty = t ? iy.get(Math.round(t.y)) : iy.get(Math.round(yMeta ?? 0))
    if ((t && tx == null) || ty == null) return null
    // Estados perezosos: nodos (0 sin ver, 1 libre, 2 ocupado) y tramos horizontales/verticales.
    const nodoE = new Uint8Array(W * H), horE = new Uint8Array(W * H), verE = new Uint8Array(W * H)
    const libreNodo = (i: number, j: number): boolean => { const k = j * W + i; if (!nodoE[k]) nodoE[k] = dentro(xs[i], ys[j]) ? 2 : 1; return nodoE[k] === 1 }
    const libreH = (i: number, j: number): boolean => { const k = j * W + i; if (!horE[k]) horE[k] = dentro((xs[i] + xs[i + 1]) / 2, ys[j]) ? 2 : 1; return horE[k] === 1 } // tramo (i,j)→(i+1,j)
    const libreV = (i: number, j: number): boolean => { const k = j * W + i; if (!verE[k]) verE[k] = dentro(xs[i], (ys[j] + ys[j + 1]) / 2) ? 2 : 1; return verE[k] === 1 } // tramo (i,j)→(i,j+1)
    // Tramos ya usados por otros conectores, llevados a esta rejilla.
    const usoH = new Uint16Array(W * H), usoV = new Uint16Array(W * H)
    usados.forEach((n, k) => {
      const [x1, y1, x2, y2] = k.split(',').map(Number)
      if (y1 === y2) { const j = iy.get(y1); if (j == null) return; for (let i = 0; i < W - 1; i++) if (xs[i] >= Math.min(x1, x2) && xs[i + 1] <= Math.max(x1, x2)) usoH[j * W + i] += n }
      else if (x1 === x2) { const i = ix.get(x1); if (i == null) return; for (let j = 0; j < H - 1; j++) if (ys[j] >= Math.min(y1, y2) && ys[j + 1] <= Math.max(y1, y2)) usoV[j * W + i] += n }
    })
    const h = (i: number, j: number): number => (t ? Math.abs(xs[i] - t.x) + Math.abs(ys[j] - t.y) : Math.abs(ys[j] - (yMeta ?? 0)))
    const N4 = W * H * 4
    const g = new Float64Array(N4).fill(Infinity)
    const desdeDe = new Int32Array(N4).fill(-1)
    const heap = new Monticulo()
    const k0 = (sy * W + sx) * 4 + d0
    g[k0] = 0
    heap.push({ f: h(sx, sy), g: 0, k: k0 })
    let fin: { k: number; costo: number } | null = null, visitas = 0
    while (heap.size && visitas < 80000) {
      const cur = heap.pop()
      visitas++
      const gc = cur.g
      if (gc > g[cur.k] + 0.001) continue
      const nodo = (cur.k / 4) | 0, dir = cur.k % 4
      const i = nodo % W, j = (nodo / W) | 0
      if (t ? (i === tx && j === ty) : (j === ty)) {
        const extra = dir === dF ? 0 : quiebre * (((dir + 2) % 4) === dF ? 2 : 1)
        if (!fin || gc + extra < fin.costo) fin = { k: cur.k, costo: gc + extra }
        if (!t) break
        continue
      }
      if (fin && gc >= fin.costo) break
      if (gc > tope) break
      for (let nd = 0; nd < 4; nd++) {
        if (nd === (dir + 2) % 4) continue // sin media vuelta
        let ni = i, nj = j, uso = 0
        if (nd === 0) { if (i + 1 >= W || !libreH(i, j)) continue; ni = i + 1; uso = usoH[j * W + i] }
        else if (nd === 2) { if (i < 1 || !libreH(i - 1, j)) continue; ni = i - 1; uso = usoH[j * W + i - 1] }
        else if (nd === 1) { if (j + 1 >= H || !libreV(i, j)) continue; nj = j + 1; uso = usoV[j * W + i] }
        else { if (j < 1 || !libreV(i, j - 1)) continue; nj = j - 1; uso = usoV[(j - 1) * W + i] }
        if (!libreNodo(ni, nj)) continue
        const largo = Math.abs(xs[ni] - xs[i]) + Math.abs(ys[nj] - ys[j])
        const costo = gc + largo + (nd !== dir ? quiebre : 0) + uso * compartido
        const nk = (nj * W + ni) * 4 + nd
        if (costo < g[nk]) {
          g[nk] = costo
          desdeDe[nk] = cur.k
          heap.push({ f: costo + h(ni, nj), g: costo, k: nk })
        }
      }
    }
    if (!fin) return null
    const camino: Punto[] = []
    let k = fin.k
    while (k >= 0) { const nodo = (k / 4) | 0; camino.push({ x: xs[nodo % W], y: ys[(nodo / W) | 0] }); k = desdeDe[k] }
    camino.reverse()
    return { camino, costo: fin.costo }
  }

  return { ruta, dentro, marcarUsada: pts => pts.forEach((p, i) => { if (i) { const q = pts[i - 1]; const k = claveTramo(Math.round(q.x), Math.round(q.y), Math.round(p.x), Math.round(p.y)); usados.set(k, (usados.get(k) || 0) + 1) } }) }
}

/* Quita puntos intermedios alineados y duplicados. */
export function simplificar(pts: Punto[]): Punto[] {
  const r: Punto[] = []
  pts.forEach(p => {
    const q = { x: Math.round(p.x), y: Math.round(p.y) }
    if (r.length && r[r.length - 1].x === q.x && r[r.length - 1].y === q.y) return
    r.push(q)
  })
  for (let i = r.length - 2; i > 0; i--) {
    const a = r[i - 1], b = r[i], c = r[i + 1]
    if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)) r.splice(i, 1)
  }
  return r
}

/* ¿Algún tramo pasa por dentro de alguna forma? (para pruebas y avisos) */
export function cruces(puntos: Punto[], formas: (Rect & { id: string })[], ignorar?: string[] | null): string[] {
  const out: string[] = []
  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1], b = puntos[i]
    formas.forEach(f => {
      if (ignorar && ignorar.indexOf(f.id) >= 0) return
      const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x), y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y)
      if (x2 > f.x + 1 && x1 < f.x + f.w - 1 && y2 > f.y + 1 && y1 < f.y + f.h - 1) out.push(f.id)
    })
  }
  return out
}
