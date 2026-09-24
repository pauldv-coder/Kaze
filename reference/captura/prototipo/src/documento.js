/* Documento Word del proceso: el procedimiento contado como un relato para quien lo ejecuta.
   Portada, contenido, objetivo, alcance, SIPOC, el diagrama en una hoja horizontal (y una hoja
   por fase cuando impreso no se leería), el paso a paso por fases en tercera persona y, como
   anexos, los formatos y la ficha técnica de cada actividad; luego referencias y cambios.
   La librería docx se carga solo al exportar. armarDocumento no toca el DOM: recibe
   las imágenes ya hechas, así se puede probar aparte. */
import {
  secuencia, tieneValor, esEspecial, DESCONOCIDO, NA, mostrarTexto, EJECUCION, TIPOS_INICIO, TIPOS_REFERENCIA,
  fraseEvento, fraseCiclo, fechaCorta, normalizarTexto, completitud,
} from './model.js';
import { generarBPMN } from './bpmn.js';
import { svgDelDiagrama, pngDeSvg } from './lienzo.js';
import { leerArchivo } from './archivos.js';
import { zip } from './util.js';
import { narrarProceso, anclaFicha, anclaPaso } from './narrador.js';
import { mayus1, lista } from './lengua.js';

const URL_DOCX = 'https://cdn.jsdelivr.net/npm/docx@9.6.1/dist/index.iife.js';

export const PAPELES = {
  carta: { id: 'carta', nombre: 'Carta', w: 12240, h: 15840 },
  a4: { id: 'a4', nombre: 'A4', w: 11906, h: 16838 },
};
const M_RETRATO = 1440;          // 2,54 cm
const M_HORIZ = 864;             // 1,52 cm: la hoja del diagrama aprovecha el papel
const PX = 96 / 1440;            // DXA → px (docx mide las imágenes en px a 96 ppp)
const RESERVA_H = 124;           // px de la hoja del diagrama para el título y la leyenda
export const UMBRAL_LECTURA = 0.75; // por debajo, el texto del diagrama impreso queda en menos de 6 pt
const OPCIONES_DIAGRAMA = { fases: true, entregables: true, numeros: true };

const C = { tinta: '111111', texto: '24292E', apagado: '6B7177', filete: 'DADEE2', panel: 'ECEEF1', suave: 'F5F6F8', marca: 'F94202', alerta: '9A6B00', ia: '2458A6' };
const ESTADOS = { borrador: 'Borrador', revision: 'En revisión', aprobado: 'Aprobado', cambios: 'Con cambios solicitados' };
const TIPO_DEC = { inclusiva: 'Se toman uno o varios caminos.', paralela: 'Se toman todos los caminos a la vez.' };
const CLASE_SALIDA = { retrabajo: 'retrabajo', rechazo: 'rechazo', cancelacion: 'cancelación', excepcion: 'excepción' };
const EJEC = {}; EJECUCION.forEach(([k, v]) => { EJEC[k] = v; });
const REF = {}; TIPOS_REFERENCIA.forEach(([k, v]) => { REF[k] = v; });
const INICIO = {}; TIPOS_INICIO.forEach(([k, v]) => { INICIO[k] = v; });
const MOMENTOS = ['antes', 'durante', 'despues'];

/* ---------- carga de la librería ---------- */
let cargando = null;
export function cargarDocx() {
  if (window.docx && window.docx.Document) return Promise.resolve(window.docx);
  if (!cargando) {
    cargando = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = URL_DOCX; s.async = true;
      s.onload = () => { if (window.docx && window.docx.Document) res(window.docx); else { cargando = null; rej(new Error('red')); } };
      s.onerror = () => { cargando = null; s.remove(); rej(new Error('red')); };
      document.head.appendChild(s);
    });
  }
  return cargando;
}

/* ---------- datos ---------- */

/* Formatos de las actividades ubicadas en fases, sin repetir (por código o nombre), numerados como anexos. */
export function anexosDe(m) {
  const out = [];
  secuencia(m).filter(s => s.numero != null).forEach(s => {
    const a = m.actividades[s.clave];
    ((a && a.formatos) || []).forEach(f => {
      const llave = normalizarTexto(f.codigo || f.nombre);
      if (!llave) return;
      let x = out.find(y => y.llave === llave);
      if (!x) { x = { llave, codigo: tieneValor(f.codigo) ? f.codigo : null, nombre: f.nombre || '', version: tieneValor(f.version) ? f.version : null, archivo: f.archivo || null, enlace: tieneValor(f.enlace) ? f.enlace : null, usos: [] }; out.push(x); }
      if (!(x.archivo && x.archivo.id) && f.archivo && f.archivo.id) x.archivo = f.archivo;
      if (!x.enlace && tieneValor(f.enlace)) x.enlace = f.enlace;
      if (!x.nombre && f.nombre) x.nombre = f.nombre;
      if (x.usos.indexOf(s.codigo) < 0) x.usos.push(s.codigo);
    });
  });
  out.forEach((x, i) => { x.n = i + 1; });
  return out;
}

/* Tamaño del diagrama (unidades del lienzo) a partir de la geometría del generador. */
export function medidasDiagrama(geo) {
  let x2 = geo.pool.x + geo.pool.w, y2 = geo.pool.y + geo.pool.h;
  (geo.externos || []).forEach(e => { x2 = Math.max(x2, e.x + e.w); y2 = Math.max(y2, e.y + e.h); });
  return { w: x2 - geo.pool.x + 8, h: y2 - geo.pool.y + 8 };
}
/* Área útil (px) de una hoja del diagrama, horizontal o vertical, descontando título y leyenda. */
function areaDiagrama(P, horizontal) {
  const ancho = horizontal === false ? P.w : P.h, alto = horizontal === false ? P.h : P.w;
  return { w: (ancho - 2 * M_HORIZ) * PX, h: (alto - 2 * M_HORIZ) * PX - RESERVA_H };
}
export const escalaEnHoja = (med, P) => { const a = areaDiagrama(P || PAPELES.carta, true); return Math.min(a.w / med.w, a.h / med.h); };

/* Franjas x ocupadas por formas y rótulos: un corte ahí partiría una tarea. */
function ocupados(geo) {
  const iv = [];
  Object.values(geo.final || {}).forEach(r => { if (r) iv.push([r.x - 6, r.x + r.w + 6]); });
  Object.values(geo.etqFinal || {}).forEach(r => { if (r) iv.push([r.x - 2, r.x + r.w + 2]); });
  iv.sort((a, b) => a[0] - b[0]);
  const out = [];
  iv.forEach(([a, b]) => { const u = out[out.length - 1]; if (u && a <= u[1]) u[1] = Math.max(u[1], b); else out.push([a, b]); });
  return out;
}
/* El punto libre más cercano a «ideal» (a menos de «tol»), o null si no hay. */
function corteLimpio(ocup, ideal, tol) {
  if (!ocup.some(([a, b]) => ideal > a && ideal < b)) return ideal;
  let mejor = null;
  for (let i = 0; i < ocup.length - 1; i++) {
    const a = ocup[i][1] + 2, b = ocup[i + 1][0] - 2;
    if (b < a) continue;
    const x = Math.min(Math.max(ideal, a), b);
    if (Math.abs(x - ideal) <= tol && (mejor == null || Math.abs(x - ideal) < Math.abs(mejor - ideal))) mejor = x;
  }
  return mejor;
}

/* Hojas de detalle por fase: cada fase con los rótulos de los carriles a la izquierda. Se elige
   la orientación y el número de tramos: el menor número de hojas en que el texto se lee
   (6 pt o más impreso) y, entre esas, la de texto más grande. Los cortes caen entre formas. */
const ESCALA_MINIMA = 0.66;   // 11 px del lienzo → 5,5 pt impresos
export function planHojasFase(geo, caja, P) {
  const gs = ((geo && geo.fases) || []).slice().sort((a, b) => a.x - b.x);
  if (gs.length < 2) return [];
  const pool = geo.pool, rot = geo.etqCarril || 60;
  const cabW = pool.x + rot - caja.x;
  const aH = areaDiagrama(P, true), aV = areaDiagrama(P, false);
  const ocup = ocupados(geo);
  const hojas = [];
  gs.forEach((f, i) => {
    const x1 = i === 0 ? pool.x + rot : f.x - 14;
    const x2 = i === gs.length - 1 ? caja.x + caja.w : f.x + f.w + 14;
    // Alto: el pool, más los pools externos que caen bajo esta fase.
    const bajo = (geo.externos || []).filter(e => e.x < x2 && e.x + e.w > x1).reduce((y, e) => Math.max(y, e.y + e.h + 8), pool.y + pool.h + 6);
    const y1 = caja.y, y2 = Math.min(caja.y + caja.h, bajo);
    const alto = y2 - y1, ancho = Math.max(40, x2 - x1);
    const opciones = [];
    [true, false].forEach(horizontal => {
      const a = horizontal ? aH : aV;
      for (let n = 1; n <= 6; n++) opciones.push({ horizontal, n, k: Math.min(1.25, a.h / alto, a.w / (ancho / n + cabW + 14 + (n > 1 ? 24 : 0))) });
    });
    const buenas = opciones.filter(o => o.k >= ESCALA_MINIMA);
    const kMax = Math.max.apply(null, opciones.map(o => o.k));
    const o = (buenas.length ? buenas : opciones.filter(x => x.k >= kMax - 0.02)).sort((p, q) => p.n - q.n || q.k - p.k)[0];
    const xs = [x1];
    for (let j = 1; j < o.n; j++) {
      const ideal = x1 + (ancho * j) / o.n;
      const c = corteLimpio(ocup, ideal, (ancho / o.n) * 0.3);
      xs.push({ x: c != null ? c : ideal, limpio: c != null });
    }
    xs.push(x2);
    for (let j = 0; j < o.n; j++) {
      const ini = j === 0 ? x1 : xs[j].x - (xs[j].limpio ? 0 : 24);
      const fin = j === o.n - 1 ? x2 : xs[j + 1].x;
      hojas.push({ faseId: f.faseId, nombre: f.nombre, indice: i, parte: j + 1, partes: o.n, x1: ini, x2: fin, y1, y2, horizontal: o.horizontal, pegado: i === 0 && j === 0 });
    }
  });
  return hojas;
}

/* Lo que conviene saber antes de exportar. Nada bloquea: el documento sale con lo que hay. */
export function revisarDocumento(proc, m) {
  const seq = secuencia(m);
  const enFase = seq.filter(s => s.numero != null);
  const claves = {}; enFase.forEach(s => { claves[s.clave] = true; });
  const acts = enFase.map(s => m.actividades[s.clave]).filter(Boolean);
  const notas = [];
  const plural = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);
  if (!tieneValor(proc.objetivo)) notas.push('Falta el objetivo: la sección 1 dirá «Por definir».');
  if (!tieneValor(proc.alcance)) notas.push('Falta el alcance: la sección 2 dirá «alcance por definir».');
  if (!(proc.proveedores || []).filter(x => tieneValor(x)).length) notas.push('Sin proveedores: en el SIPOC salen solo los que se deducen de los mensajes externos. Agrégalos en el Resumen.');
  if (!tieneValor(proc.codigoDoc)) notas.push('Sin código del documento: agrégalo en el Resumen para la portada y el encabezado.');
  const sinFase = seq.length - enFase.length;
  if (sinFase) notas.push(plural(sinFase, 'actividad sin fase no se incluye.', 'actividades sin fase no se incluyen.'));
  const fuera = m.decisiones.filter(d => d.estado === 'sugerencia' || !d.origen || !claves[d.origen]).length;
  if (fuera) notas.push(plural(fuera, 'decisión sugerida o sin actividad de origen no se incluye.', 'decisiones sugeridas o sin actividad de origen no se incluyen.'));
  let preg = 0, vacias = 0;
  acts.forEach(a => { const c = completitud(a); preg += c.preg; if (c.resp + c.preg < c.total) vacias += 1; });
  if (preg) notas.push(plural(preg, 'dato está «por confirmar»: el relato lo dice en color.', 'datos están «por confirmar»: el relato los dice en color.'));
  if (vacias) notas.push(plural(vacias, 'actividad tiene campos vacíos: el relato no los menciona y su ficha técnica no muestra esas filas.', 'actividades tienen campos vacíos: el relato no los menciona y su ficha técnica no muestra esas filas.'));
  const anexos = anexosDe(m);
  const conArchivo = anexos.filter(x => x.archivo && x.archivo.id).length;
  const sinNada = anexos.filter(x => !(x.archivo && x.archivo.id) && !x.enlace).length;
  if (sinNada) notas.push(plural(sinNada, 'formato no tiene archivo ni enlace: el anexo solo lo nombra.', 'formatos no tienen archivo ni enlace: el anexo solo los nombra.'));
  const fases = m.fases.filter(f => f.actividades.some(k => claves[k])).length;
  const gen = enFase.length ? generarBPMN(proc, m, OPCIONES_DIAGRAMA) : null;
  const med = gen && gen.geo ? medidasDiagrama(gen.geo) : null;
  return {
    actividades: enFase.length, fases, anexos: anexos.length, conArchivo, notas, med,
    referencias: (proc.referencias || []).filter(r => tieneValor(r.nombre) || tieneValor(r.codigo)).length,
    diagramaChico: !!(med && fases > 1 && escalaEnHoja(med) < UMBRAL_LECTURA),
  };
}

/* Nombre legible del archivo: «PR-CON-01 Conciliación bancaria mensual - As-Is v1». */
export function nombreDocumento(proc, m, version) {
  const base = [tieneValor(proc.codigoDoc) ? String(proc.codigoDoc) : null, proc.nombre || 'Proceso'].filter(Boolean).join(' ')
    + ' - ' + (version === 'tobe' ? 'To-Be' : 'As-Is') + ' v' + m.numero;
  return base.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);
}
const nombreSeguro = s => String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim();

/* ---------- imágenes ---------- */

const escalaPng = (w, h) => Math.max(0.6, Math.min(3, 6000 / Math.max(w, h), Math.sqrt(16e6 / (w * h))));

/* Un SVG hecho de recortes del diagrama: filas de vistas puestas lado a lado.
   filas = [{ y, h, vistas: [{ x, w, separada }] }]. Cada vista reusa el mismo dibujo (<use>). */
export function componerSvg(svg, filas, op) {
  op = op || {};
  const sepX = op.separacionX || 14, sepY = op.separacionY || 30;
  const m = /<svg\b[^>]*>([\s\S]*)<\/svg>\s*$/.exec(svg);
  let cuerpo = m ? m[1] : '';
  let defs = '';
  const d = /^\s*<defs>([\s\S]*?)<\/defs>/.exec(cuerpo);
  if (d) { defs = d[1]; cuerpo = cuerpo.slice(d[0].length); }
  const partes = [];
  let y = 0, ancho = 0;
  const finesFila = [];
  filas.forEach((f, i) => {
    if (i > 0) y += sepY;
    let x = 0;
    f.vistas.forEach(v => {
      if (v.separada) x += sepX;
      partes.push('<svg x="' + x + '" y="' + y + '" width="' + v.w + '" height="' + f.h + '" viewBox="' + v.x + ' ' + f.y + ' ' + v.w + ' ' + f.h + '" overflow="hidden"><use href="#kzTodo" xlink:href="#kzTodo"/></svg>');
      x += v.w;
    });
    ancho = Math.max(ancho, x);
    y += f.h;
    finesFila.push(y);
  });
  // Entre franjas: una línea y el aviso de que el proceso sigue abajo.
  finesFila.slice(0, -1).forEach(yf => {
    partes.push('<line x1="0" y1="' + (yf + sepY / 2) + '" x2="' + ancho + '" y2="' + (yf + sepY / 2) + '" stroke="#9aa0a6" stroke-width="1" stroke-dasharray="6 4"/>');
    partes.push('<text x="' + (ancho - 4) + '" y="' + (yf + sepY / 2 - 4) + '" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="#6b7177">El proceso continúa en la franja de abajo ↓</text>');
  });
  const w = Math.round(ancho), h = Math.round(y);
  return { w, h, svg: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '"><defs>' + defs + '<g id="kzTodo">' + cuerpo + '</g></defs><rect width="' + w + '" height="' + h + '" fill="#ffffff"/>' + partes.join('') + '</svg>' };
}

/* El proceso completo en la hoja horizontal: si es muy alargado, en dos o más franjas apiladas
   (cada una con los rótulos de los carriles), cortadas entre fases. null = una sola franja. */
export function planFranjas(geo, caja, P) {
  if (!geo || !geo.pool) return null;
  const a = areaDiagrama(P, true);
  const rot = geo.etqCarril || 60;
  const cabW = geo.pool.x + rot - caja.x;
  const inicio = geo.pool.x + rot, fin = caja.x + caja.w, total = fin - inicio;
  const escala = n => Math.min(1.25, a.w / (total / n + cabW), (a.h - (n - 1) * 30) / (n * caja.h));
  let n = 1;
  while (n < 4 && escala(n + 1) > escala(n) * 1.3) n += 1;
  if (n === 1) return null;
  // Cortes: en el borde de una fase si hay uno cerca; si no, entre dos formas.
  const bordes = (geo.fases || []).map(f => f.x - 7).filter(x => x > inicio + 120 && x < fin - 120);
  const ocup = ocupados(geo);
  const cortes = [];
  for (let i = 1; i < n; i++) {
    const ideal = inicio + (total * i) / n;
    const cerca = bordes.filter(b => Math.abs(b - ideal) < (total / n) * 0.3 && cortes.indexOf(b) < 0).sort((p, q) => Math.abs(p - ideal) - Math.abs(q - ideal))[0];
    const limpio = cerca == null ? corteLimpio(ocup, ideal, (total / n) * 0.3) : null;
    cortes.push(cerca != null ? cerca : limpio != null ? limpio : ideal);
  }
  const xs = [inicio].concat(cortes.sort((p, q) => p - q), [fin]);
  return xs.slice(0, -1).map((x, i) => ({ x1: x, x2: xs[i + 1] }));
}

async function imagenesDiagrama(gen, porFase, P) {
  const svg = await svgDelDiagrama(gen.xml);
  const vb = /viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg);
  if (!vb) throw new Error('svg');
  const caja = { x: +vb[1], y: +vb[2], w: +vb[3], h: +vb[4] };
  const cab = { x: caja.x, w: gen.geo.pool.x + (gen.geo.etqCarril || 60) - caja.x };
  const franjas = planFranjas(gen.geo, caja, P);
  let todo;
  if (franjas) {
    const r = componerSvg(svg, franjas.map((f, i) => ({ y: caja.y, h: caja.h, vistas: [cab, { x: f.x1, w: f.x2 - f.x1, separada: i > 0 }] })));
    todo = await pngDeSvg(r.svg, escalaPng(r.w, r.h));
    todo.franjas = franjas.length;
  } else todo = await pngDeSvg(svg, escalaPng(caja.w, caja.h));
  const fases = [];
  if (porFase) {
    for (const h of planHojasFase(gen.geo, caja, P)) {
      const r = componerSvg(svg, [{ y: h.y1, h: h.y2 - h.y1, vistas: [cab, { x: h.x1, w: h.x2 - h.x1, separada: !h.pegado }] }]);
      fases.push(Object.assign({}, h, { png: await pngDeSvg(r.svg, escalaPng(r.w, r.h)) }));
    }
  }
  return { todo, fases };
}

function svgIcono(nombre) {
  const prims = ((window.Kaze && window.Kaze.ICONOS_BPMN) || {})[nombre];
  if (!prims) return null;
  const at = a => Object.keys(a).map(k => k + '="' + String(a[k]).replace(/"/g, '&quot;') + '"').join(' ');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">'
    + prims.map(p => '<' + p.t + ' ' + at(p.a) + ' fill="' + (p.relleno ? '#111111' : 'none') + '" stroke="' + (p.claro ? '#ffffff' : '#111111') + '" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>').join('')
    + '</svg>';
}
async function imagenesIconos() {
  const out = {};
  for (const n of ['persona', 'sistema', 'automatizacion', 'hoja']) {
    const s = svgIcono(n);
    if (!s) continue;
    try { out[n] = await pngDeSvg(s, 6); } catch (e) { /* sin ícono: queda solo el texto */ }
  }
  return out;
}

/* ---------- exportar (navegador) ---------- */

/* Devuelve { nombre, datos } listo para descargar: el .docx, o un .zip con el .docx y la carpeta Anexos. */
export async function exportarDocumento(proc, m, version, op) {
  op = op || {};
  const avance = op.avance || (() => {});
  const P = PAPELES[op.papel] || PAPELES.carta;
  avance('Cargando el generador de Word…');
  const D = await cargarDocx();
  const gen = generarBPMN(proc, m, OPCIONES_DIAGRAMA);
  let diagrama = null;
  if (gen.xml) {
    avance('Dibujando el diagrama…');
    try { diagrama = await imagenesDiagrama(gen, !!op.porFase, P); } catch (e) { diagrama = { error: true }; }
  }
  const iconos = await imagenesIconos();
  const anexos = anexosDe(m);
  const archivos = [];
  let perdidos = 0;
  if (op.conAnexos) {
    avance('Reuniendo los anexos…');
    for (const x of anexos) {
      if (!(x.archivo && x.archivo.id)) continue;
      const r = await leerArchivo(x.archivo.id);
      if (!r || !r.blob) { perdidos += 1; continue; }
      const nombre = 'Anexos/Anexo ' + String(x.n).padStart(2, '0') + ' - ' + nombreSeguro((x.codigo ? x.codigo + ' ' : '') + (x.archivo.nombre || 'archivo'));
      archivos.push({ nombre, datos: new Uint8Array(await r.blob.arrayBuffer()) });
      x.ruta = nombre;
    }
  }
  avance('Armando el documento…');
  const doc = armarDocumento(D, proc, m, version, { papel: P, diagrama, iconos, anexos, gen, conAnexos: !!op.conAnexos && archivos.length > 0 });
  const blob = await D.Packer.toBlob(doc);
  const base = nombreDocumento(proc, m, version);
  if (!op.conAnexos || !archivos.length) return { nombre: base + '.docx', datos: blob, perdidos };
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { nombre: base + '.zip', datos: zip([{ nombre: base + '.docx', datos: bytes }].concat(archivos)), perdidos, anexos: archivos.length };
}

/* ---------- armado ---------- */

const nombreFase = (i, nombre) => (/^fase\b/i.test(String(nombre || '').trim()) ? String(nombre).trim() : 'Fase ' + (i + 1) + ': ' + (nombre || 'Sin nombre'));
const enlaceSeguro = u => (/^(https?:\/\/|mailto:)/i.test(String(u || '').trim()) ? String(u).trim() : null);

export function armarDocumento(D, proc, m, version, op) {
  op = op || {};
  const AUTO = D.LineRuleType.AUTO;   // sin lineRule, LibreOffice toma el interlineado como exacto y recorta las imágenes
  const P = op.papel || PAPELES.carta;
  const W = P.w - 2 * M_RETRATO;       // ancho útil en retrato (DXA)
  const WH = P.h - 2 * M_HORIZ;        // ancho útil en la hoja horizontal
  const WV = P.w - 2 * M_HORIZ;        // ancho útil en una hoja vertical del diagrama
  const hoy = fechaCorta(op.fecha || new Date().toISOString());
  const seq = secuencia(m);
  const enFase = seq.filter(s => s.numero != null);
  const info = {}; enFase.forEach(s => { info[s.clave] = s; });
  const etqVersion = (version === 'tobe' ? 'To-Be' : 'As-Is') + ' v' + m.numero;
  const estado = ESTADOS[m.estado] || 'Borrador';
  const codigo = tieneValor(proc.codigoDoc) ? String(proc.codigoDoc) : null;
  const anexos = op.anexos || anexosDe(m);
  const anexoDe = f => anexos.find(x => x.llave === normalizarTexto(f.codigo || f.nombre));
  const iconos = op.iconos || {};
  const siguientes = (op.gen && op.gen.siguientes) || {};
  const aprobada = (m.historial || []).filter(h => h.numero === m.numero).pop();

  /* piezas */
  const T = (text, o) => new D.TextRun(Object.assign({ text: String(text) }, o || {}));
  const Pa = (children, o) => new D.Paragraph(Object.assign({ children: [].concat(children || []) }, o || {}));
  const CEL = { spacing: { before: 0, after: 40, line: 259, lineRule: AUTO } };
  const t9 = (t, o) => T(t, Object.assign({ size: 18 }, o || {}));
  const gris = (t, o) => T(t, Object.assign({ color: C.apagado }, o || {}));
  const porDefinir = t => T(t || 'Por definir', { italics: true, color: C.apagado });
  const lineas = v => String(v).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const icono = (n, lado) => (iconos[n] ? new D.ImageRun({ type: 'png', data: iconos[n].bytes, transformation: { width: lado || 12, height: lado || 12 }, altText: { name: n, title: EJEC[n] || 'Formato', description: EJEC[n] || 'Formato' } }) : null);
  const conIcono = (n, runs) => { const ic = icono(n, 12); return ic ? [ic, T('  ')].concat(runs) : runs; };
  const runsValor = (v, sufijo) => {
    if (v === DESCONOCIDO) return [T('Por confirmar', { italics: true, color: C.alerta })];
    if (v === NA) return [gris('No aplica')];
    return [T(mostrarTexto(v) + (typeof v === 'number' && sufijo ? sufijo : ''))];
  };
  const parrafosValor = (v, o) => {
    if (v == null || v === '') return null;
    if (esEspecial(v) || typeof v === 'number') return [Pa(runsValor(v), Object.assign({}, CEL, o))];
    return lineas(v).map(l => Pa(T(l), Object.assign({}, CEL, o)));
  };
  const vineta = (children, o) => Pa(children, Object.assign({ numbering: { reference: 'kz-vinetas', level: 0 } }, CEL, o || {}));
  const enlace = (u, texto, o) => { const url = enlaceSeguro(u); return url ? new D.ExternalHyperlink({ link: url, children: [T(texto || url, Object.assign({ style: 'Hyperlink' }, o || {}))] }) : T(texto || u, o); };

  /* títulos con marcador: alimentan el contenido y los vínculos internos */
  const titulos = [];
  const NIVEL = [D.HeadingLevel.HEADING_1, D.HeadingLevel.HEADING_2, D.HeadingLevel.HEADING_3];
  // docx 9.6 numera todos los marcadores con w:id=1: se les da un número propio.
  let nMarcas = 0;
  const marcador = (id, children) => {
    nMarcas += 1;
    const bm = new D.Bookmark({ id, children });
    if (D.BookmarkStart && D.BookmarkEnd) { bm.start = new D.BookmarkStart(id, nMarcas); bm.end = new D.BookmarkEnd(nMarcas); }
    return bm;
  };
  const titulo = (texto, nivel, extra, ancla) => {
    const id = ancla || 'kz_t' + (titulos.length + 1);
    titulos.push({ texto, nivel, ancla: id });
    return new D.Paragraph(Object.assign({ heading: NIVEL[nivel - 1], children: [marcador(id, [T(texto)])] }, extra || {}));
  };
  const ANCLA_ANEXOS = 'kz_anexos';

  /* tablas */
  const borde = { style: D.BorderStyle.SINGLE, size: 4, color: C.filete };
  const nada = { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const MARG = { top: 70, bottom: 70, left: 110, right: 110 };
  const fondo = color => ({ fill: color, type: D.ShadingType.CLEAR, color: 'auto' });
  const celda = (children, ancho, o) => new D.TableCell(Object.assign({ width: { size: ancho, type: D.WidthType.DXA }, margins: MARG, children: [].concat(children) }, o || {}));
  const todos = { top: borde, bottom: borde, left: borde, right: borde, insideHorizontal: borde, insideVertical: borde };
  const tablaFicha = (filas, ancho) => {
    const a1 = 2150, a2 = ancho - a1;
    return new D.Table({
      width: { size: ancho, type: D.WidthType.DXA }, columnWidths: [a1, a2], layout: D.TableLayoutType.FIXED, borders: todos,
      rows: filas.map(f => new D.TableRow({ cantSplit: true, children: [
        celda(Pa(t9(f.rotulo, { bold: true, color: C.texto }), CEL), a1, { shading: fondo(C.suave) }),
        celda(f.parrafos, a2),
      ] })),
    });
  };
  const tablaLista = (cols, filas, ancho) => {
    const fijos = cols.reduce((s, c) => s + (c.w || 0), 0);
    const ws = cols.map(c => c.w || Math.max(1400, ancho - fijos));
    const total = ws.reduce((s, x) => s + x, 0);
    return new D.Table({
      width: { size: total, type: D.WidthType.DXA }, columnWidths: ws, layout: D.TableLayoutType.FIXED, borders: todos,
      rows: [new D.TableRow({ tableHeader: true, cantSplit: true, children: cols.map((c, i) => celda(Pa(t9(c.t, { bold: true, color: C.tinta }), CEL), ws[i], { shading: fondo(C.panel) })) })]
        .concat(filas.map(f => new D.TableRow({ cantSplit: true, children: f.map((v, i) => celda(v, ws[i])) }))),
    });
  };
  const tablaDatos = (filas, ancho) => {
    const a1 = 2500, a2 = ancho - a1, mg = { top: 100, bottom: 100, left: 0, right: 110 };
    return new D.Table({
      width: { size: ancho, type: D.WidthType.DXA }, columnWidths: [a1, a2], layout: D.TableLayoutType.FIXED,
      borders: { top: borde, bottom: borde, left: nada, right: nada, insideHorizontal: borde, insideVertical: nada },
      rows: filas.map(([r, v]) => new D.TableRow({ cantSplit: true, children: [
        celda(Pa(t9(r, { color: C.apagado }), CEL), a1, { margins: mg }),
        celda(Pa(v, CEL), a2, { margins: mg }),
      ] })),
    });
  };

  /* rótulos de actividades y de lo que sigue */
  const rotulo = k => (k === '__fin' ? 'el fin del proceso' : info[k] ? info[k].codigo + ' · ' + m.actividades[k].nombre : 'una actividad que ya no está en la secuencia');
  const Rotulo = k => { const r = rotulo(k); return r.charAt(0).toUpperCase() + r.slice(1); };
  const frase = e => fraseEvento(e, rotulo).replace(/\ba el\b/g, 'al');
  const resultado = (proc.resultados || []).filter(Boolean)[0];
  const siguiente = k => {
    const sg = siguientes[k];
    if (sg && sg.union) return 'Se une con las demás ramas y ' + (sg.destino ? 'sigue con ' + rotulo(sg.destino) : 'termina el proceso') + '.';
    if (sg && sg.fin) return 'Termina el proceso' + (resultado ? ': ' + resultado : '') + '.';
    if (sg && sg.destino) return Rotulo(sg.destino);
    const s2 = enFase.find(x => x.numero === info[k].numero + 1);
    return s2 ? Rotulo(s2.clave) : 'Termina el proceso' + (resultado ? ': ' + resultado : '') + '.';
  };

  /* ===== portada ===== */
  const portada = [];
  portada.push(Pa(T('DOCUMENTO DEL PROCESO', { bold: true, size: 18, color: C.apagado, characterSpacing: 40 }), { spacing: { before: 2200, after: 160 } }));
  portada.push(Pa(T(proc.nombre || 'Proceso sin nombre', { bold: true, size: 52, color: C.tinta }), { spacing: { after: 200, line: 264, lineRule: AUTO } }));
  portada.push(Pa([], { indent: { right: Math.max(0, W - 1000) }, border: { bottom: { style: D.BorderStyle.SINGLE, size: 24, color: C.marca, space: 1 } }, spacing: { before: 0, after: 520, line: 120, lineRule: D.LineRuleType.EXACT } }));
  const deps = (proc.departamentos || []).filter(Boolean);
  const datosPortada = [
    ['Código', codigo ? T(codigo, { bold: true }) : porDefinir('Sin código')],
    ['Versión', T(etqVersion)],
    ['Estado', T(estado + (aprobada ? ' el ' + fechaCorta(aprobada.fecha) : ''))],
    ['Dueño del proceso', tieneValor(proc.dueno) ? T(proc.dueno) : porDefinir()],
  ];
  if (tieneValor(proc.cliente)) datosPortada.push(['Cliente del proceso', [T(proc.cliente), gris(proc.clienteExterno ? ' (externo)' : ' (interno)')]]);
  if (deps.length) datosPortada.push(['Áreas que participan', T(deps.join(', '))]);
  const elaboran = (proc.participantes || []).filter(c => c.papel === 'elabora' && tieneValor(c.nombre)).map(c => c.nombre + (tieneValor(c.rol) ? ' (' + c.rol + ')' : ''));
  if (!elaboran.length && m.aprobacion && m.aprobacion.remitente && tieneValor(m.aprobacion.remitente.nombre)) elaboran.push(m.aprobacion.remitente.nombre);
  if (elaboran.length) datosPortada.push(['Elaboró', T(elaboran.join(', '))]);
  datosPortada.push(['Generado el', T(hoy)]);
  portada.push(tablaDatos(datosPortada, W));
  const ap = m.aprobacion;
  const filasAp = [];
  if (ap && Array.isArray(ap.etapas)) ap.etapas.forEach(e => (e.personas || []).forEach(x => filasAp.push({ e, x })));
  if (filasAp.length) {
    const DEC = { aprobado: 'Aprobó', cambios: 'Pidió cambios', pendiente: 'Pendiente' };
    portada.push(Pa(T('Aprobaciones', { bold: true, size: 20, color: C.tinta }), { spacing: { before: 480, after: 120 }, keepNext: true }));
    portada.push(tablaLista([{ t: 'Etapa', w: 1500 }, { t: 'Nombre', w: null }, { t: 'Decisión', w: 1900 }, { t: 'Fecha', w: 1400 }], filasAp.map(({ e, x }) => {
      const dec = x.estado === 'aprobado' && e.tipo === 'vobo' ? 'Dio su visto bueno' : DEC[x.estado] || 'Pendiente';
      return [[Pa(t9(e.tipo === 'vobo' ? 'Visto bueno' : 'Aprobación'), CEL)], [Pa([t9(x.nombre || '')].concat(tieneValor(x.cargo) ? [t9(' · ' + x.cargo, { color: C.apagado })] : []), CEL)],
        [Pa(t9(dec, x.estado === 'pendiente' ? { color: C.apagado } : {}), CEL)], [Pa(t9(x.fecha ? fechaCorta(x.fecha) : '—'), CEL)]];
    }), W));
  }
  portada.push(Pa(gris('Generado con Kaze · Captura de procesos.', { size: 16 }), { spacing: { before: 900 } }));

  /* ===== el relato ===== */
  const relato = narrarProceso(proc, m, { anexos, anclaAnexos: ANCLA_ANEXOS, textoFicha: 'La ficha técnica de cada actividad está en el anexo 6.2; el código junto a cada paso lleva a ella.' });
  const runsDe = (rs, base) => (rs || []).map(r => {
    const o = Object.assign({}, base || {});
    if (r.b) o.bold = true;
    if (r.i) o.italics = true;
    if (r.tono === 'falta') { o.color = C.alerta; o.italics = true; }
    if (r.tono === 'suave') o.color = C.apagado;
    if (r.tono === 'ia') { o.color = C.ia; o.italics = true; }
    if (r.ref) return new D.InternalHyperlink({ anchor: r.ref.ancla, children: [T(r.t, o)] });
    return T(r.t, o);
  });
  const RELATO = { spacing: { before: 0, after: 110, line: 288, lineRule: AUTO } };
  const aviso = (etiqueta, color, runs) => Pa([T(etiqueta + ': ', { bold: true, color })].concat(runsDe(runs)), {
    indent: { left: 220 }, border: { left: { style: D.BorderStyle.SINGLE, size: 18, color, space: 8 } }, spacing: { before: 40, after: 110, line: 276, lineRule: AUTO } });

  /* ===== 1. Objetivo y 2. Alcance ===== */
  const cuerpo1 = [];
  cuerpo1.push(titulo('1. Objetivo', 1, { pageBreakBefore: true }));
  if (tieneValor(proc.objetivo)) lineas(proc.objetivo).forEach(l => cuerpo1.push(Pa(T(l), RELATO)));
  else cuerpo1.push(Pa(porDefinir('Por definir.')));
  cuerpo1.push(titulo('2. Alcance', 1));
  relato.alcance.forEach(p => cuerpo1.push(Pa(runsDe(p.runs), RELATO)));

  /* ===== 3. SIPOC ===== */
  cuerpo1.push(titulo('3. SIPOC', 1));
  cuerpo1.push(Pa(T('El proceso de un vistazo: quién entrega lo que necesita (proveedores), qué recibe (entradas), sus fases, qué produce (salidas) y quién lo recibe (clientes).'), RELATO));
  const sp = relato.sipoc;
  const colsS = [['S', 'Proveedores', sp.proveedores], ['I', 'Entradas', sp.entradas], ['P', 'Proceso', sp.proceso], ['O', 'Salidas', sp.salidas], ['C', 'Clientes', sp.clientes]];
  const wS = Math.floor(W / 5), wsS = [wS, wS, W - 4 * wS, wS, wS];
  const MS = { top: 100, bottom: 100, left: 100, right: 100 };
  cuerpo1.push(new D.Table({
    width: { size: W, type: D.WidthType.DXA }, columnWidths: wsS, layout: D.TableLayoutType.FIXED, borders: todos,
    rows: [
      new D.TableRow({ tableHeader: true, cantSplit: true, children: colsS.map(([l, n], i) => celda([
        Pa(T(l, { bold: true, size: 32, color: C.marca }), { alignment: D.AlignmentType.CENTER, spacing: { before: 0, after: 0, line: 240, lineRule: AUTO } }),
        Pa(t9(n, { bold: true, color: C.tinta }), { alignment: D.AlignmentType.CENTER, spacing: { before: 0, after: 20, line: 240, lineRule: AUTO } }),
      ], wsS[i], { shading: fondo(C.panel), margins: MS })) }),
      new D.TableRow({ cantSplit: false, children: colsS.map(([l, , xs], i) => {
        if (!xs.length) return celda([Pa(t9('Por definir', { italics: true, color: C.alerta }), CEL)], wsS[i], { margins: MS });
        return celda(xs.map((x, j) => (l === 'P'
          ? Pa([t9((j + 1) + '. ' + x.t, { bold: true })].concat(x.pasos ? [new D.TextRun({ text: mayus1(x.pasos), size: 16, color: C.apagado, break: 1 })] : []), CEL)
          : Pa([t9(x.t)].concat(x.externo ? [t9(' (externo)', { color: C.apagado })] : []), Object.assign({ numbering: { reference: 'kz-vinetas-sipoc', level: 0 } }, CEL)))), wsS[i], { margins: MS });
      }) }),
    ],
  }));

  /* ===== 4. Diagrama: el proceso completo en una hoja horizontal, y el detalle por fase ===== */
  const hojasDiagrama = [];   // [{ horizontal, children }]: cada una es una sección
  const imagen = (png, alt, horizontal) => {
    const area = areaDiagrama(P, horizontal);
    const k = Math.min(area.w / png.anchoSvg, area.h / png.altoSvg, 1.25);
    const w = Math.max(40, Math.floor(png.anchoSvg * k)), h = Math.max(20, Math.floor(png.altoSvg * k));
    return Pa(new D.ImageRun({ type: 'png', data: png.bytes, transformation: { width: w, height: h }, altText: { name: 'Diagrama', title: alt, description: alt } }), { alignment: D.AlignmentType.CENTER, spacing: { before: 0, after: 60, line: 240, lineRule: AUTO } });
  };
  const leyenda = extra => {
    const ch = [];
    [['persona', 'Persona'], ['sistema', 'Sistema'], ['automatizacion', 'IA o automatización'], ['hoja', 'Con formatos']].forEach(([n, t]) => {
      const ic = icono(n, 11);
      if (ic) ch.push(ic);
      ch.push(gris(' ' + t + '      ', { size: 16 }));
    });
    const partes = [Pa(ch, { alignment: D.AlignmentType.CENTER, spacing: { before: 0, after: 0 } })];
    partes.push(Pa(gris(extra || 'El número de cada tarea es el número del paso en la sección 5.', { size: 16 }), { alignment: D.AlignmentType.CENTER, spacing: { before: 20, after: 0 } }));
    return partes;
  };
  const TIT_H = { spacing: { before: 0, after: 100 } };
  const dg = op.diagrama;
  const hoja1 = [titulo('4. Diagrama del proceso', 1, TIT_H)];
  if (dg && dg.todo) {
    hoja1.push(imagen(dg.todo, 'Diagrama BPMN del proceso ' + (proc.nombre || ''), true));
    leyenda(dg.todo.franjas ? 'El proceso va en ' + dg.todo.franjas + ' franjas, de arriba abajo. El número de cada tarea es el número del paso en la sección 5.' : null).forEach(x => hoja1.push(x));
  } else {
    hoja1.push(Pa(porDefinir(dg && dg.error ? 'No se pudo dibujar el diagrama en este navegador. Descárgalo desde la pestaña Diagrama (.bpmn o SVG).' : 'El diagrama aparece cuando haya actividades ubicadas en fases.')));
  }
  hojasDiagrama.push({ horizontal: true, children: hoja1 });
  ((dg && dg.fases) || []).forEach(h => {
    const nom = '4.' + (h.indice + 1) + ' ' + nombreFase(h.indice, h.nombre);
    const ch = [];
    if (h.parte === 1) ch.push(titulo(nom, 2, TIT_H));
    else ch.push(Pa(T(nom + ' (continuación)', { bold: true, size: 24, color: C.tinta }), TIT_H));
    ch.push(imagen(h.png, 'Diagrama de la fase ' + h.nombre + (h.partes > 1 ? ', parte ' + h.parte + ' de ' + h.partes : ''), h.horizontal));
    leyenda('Detalle de la fase' + (h.partes > 1 ? ', parte ' + h.parte + ' de ' + h.partes : '') + '. A la izquierda, los carriles de cada rol; la primera hoja del diagrama muestra el proceso completo.').forEach(x => ch.push(x));
    hojasDiagrama.push({ horizontal: h.horizontal, children: ch });
  });

  /* ===== 5. El proceso paso a paso ===== */
  const cuerpo3 = [];
  cuerpo3.push(titulo('5. El proceso paso a paso', 1));
  const caja = [Pa(T('En pocas palabras', { bold: true, size: 22, color: C.tinta }), { spacing: { before: 0, after: 80 }, keepNext: true })]
    .concat(relato.resumen.map(p => Pa(runsDe(p.runs), RELATO)))
    .concat(relato.comoLeer.map(p => Pa(runsDe(p.runs, { size: 18, color: C.apagado }), { spacing: { before: 60, after: 0, line: 264, lineRule: AUTO } })));
  cuerpo3.push(new D.Table({
    width: { size: W, type: D.WidthType.DXA }, columnWidths: [W], layout: D.TableLayoutType.FIXED,
    borders: { top: nada, bottom: nada, right: nada, insideHorizontal: nada, insideVertical: nada, left: { style: D.BorderStyle.SINGLE, size: 24, color: C.marca } },
    rows: [new D.TableRow({ cantSplit: true, children: [celda(caja, W, { shading: fondo(C.suave), margins: { top: 180, bottom: 180, left: 260, right: 260 } })] })],
  }));
  const pasoDocx = p => {
    const out = [Pa([marcador(p.ancla, [T(p.numero + '. ' + p.nombre, { bold: true, size: 22, color: C.tinta })]), T('    '),
      new D.InternalHyperlink({ anchor: p.fichaAncla, children: [T(p.codigo, { size: 16, color: C.apagado })] })],
    { keepNext: true, keepLines: true, spacing: { before: 280, after: 80, line: 264, lineRule: AUTO } })];
    p.parrafos.forEach((q, i) => {
      const sig = p.parrafos[i + 1];
      if (q.tipo === 'texto') out.push(Pa(runsDe(q.runs), Object.assign({}, RELATO, { keepNext: !!(sig && (sig.tipo === 'decision')) })));
      else if (q.tipo === 'importante') out.push(aviso('Importante', C.marca, q.runs));
      else if (q.tipo === 'atencion') out.push(aviso('Atención', C.alerta, q.runs));
      else if (q.tipo === 'decision') out.push(Pa(runsDe(q.runs), { keepNext: true, spacing: { before: 40, after: 60, line: 288, lineRule: AUTO } }));
      else if (q.tipo === 'rama') out.push(Pa(runsDe(q.runs), { numbering: { reference: 'kz-ramas', level: 0 }, keepNext: !!(sig && sig.tipo === 'rama'), spacing: { before: 0, after: 50, line: 276, lineRule: AUTO } }));
      else if (q.tipo === 'falta') out.push(Pa(runsDe(q.runs, { size: 18 }), { spacing: { before: 20, after: 110, line: 264, lineRule: AUTO } }));
    });
    return out;
  };
  relato.fases.forEach(f => {
    cuerpo3.push(titulo('5.' + f.indice + ' ' + nombreFase(f.indice - 1, f.nombre), 2));
    f.intro.forEach(p => cuerpo3.push(Pa(runsDe(p.runs, { color: C.apagado }), RELATO)));
    f.pasos.forEach(p => pasoDocx(p).forEach(x => cuerpo3.push(x)));
  });

  /* ===== 6. Anexos: formatos y ficha técnica ===== */
  cuerpo3.push(titulo('6. Anexos', 1, { pageBreakBefore: true }));
  cuerpo3.push(titulo('6.1 Formatos', 2, null, ANCLA_ANEXOS));
  if (anexos.length) {
    cuerpo3.push(Pa(T(op.conAnexos ? 'Formatos que se usan en los pasos. Los archivos van en la carpeta «Anexos», junto a este documento.' : 'Formatos que se usan en los pasos. Cada paso dice qué anexo usa.')));
    cuerpo3.push(tablaLista([{ t: 'Anexo', w: 800 }, { t: 'Código', w: 1350 }, { t: 'Formato', w: null }, { t: 'Versión', w: 1000 }, { t: 'Se usa en', w: 1300 }, { t: 'Archivo o enlace', w: 2100 }], anexos.map(x => {
      const arch = [];
      if (x.ruta) arch.push(Pa(t9(x.ruta.replace(/^Anexos\//, '')), CEL));
      else if (x.archivo && x.archivo.nombre) arch.push(Pa(t9(x.archivo.nombre), CEL));
      if (x.enlace) arch.push(Pa(enlace(x.enlace, null, { size: 18 }), CEL));
      if (!arch.length) arch.push(Pa(t9('—', { color: C.apagado }), CEL));
      return [[Pa(t9(String(x.n), { bold: true }), CEL)], [Pa(t9(x.codigo || '—'), CEL)], [Pa(t9(x.nombre || '—'), CEL)], [Pa(t9(x.version || '—'), CEL)], [Pa(t9(x.usos.join(', ')), CEL)], arch];
    }), W));
  } else cuerpo3.push(Pa(porDefinir('Los pasos no usan formatos.')));

  cuerpo3.push(titulo('6.2 Ficha técnica de las actividades', 2));
  cuerpo3.push(Pa(T('Los datos de cada actividad tal como se capturaron. «Por confirmar» marca un dato que aún falta preguntar.')));
  const bloqueActividad = (k, faseNombre) => {
    const a = m.actividades[k], s = info[k];
    const out = [titulo(s.codigo + ' · ' + a.nombre, 3, null, anclaFicha(k))];
    if (a.estado === 'sugerencia') out.push(Pa(t9('Sugerencia de la IA: falta validarla con quien la ejecuta.', { italics: true, color: C.ia }), { keepNext: true, spacing: { after: 80 } }));
    if (a.estado === 'pregunta') out.push(Pa(t9('Tiene preguntas abiertas.', { italics: true, color: C.alerta }), { keepNext: true, spacing: { after: 80 } }));
    const filas = [];
    const add = (r, ps) => { if (ps && ps.length) filas.push({ rotulo: r, parrafos: ps }); };
    add('En el relato', [Pa([new D.InternalHyperlink({ anchor: anclaPaso(k), children: [T('Paso ' + s.numero, { style: 'Hyperlink' })] }), gris(' · ' + faseNombre)], CEL)]);
    if (tieneValor(a.descripcion)) add('Descripción', lineas(a.descripcion).map(l => Pa(T(l), CEL)));
    else if (a.descripcion === DESCONOCIDO) add('Descripción', [Pa(runsValor(DESCONOCIDO), CEL)]);
    const resp = a.responsable == null || a.responsable === '' ? [T('Por definir', { italics: true, color: C.alerta })] : runsValor(a.responsable);
    if (tieneValor(a.departamento)) resp.push(gris(' · ' + a.departamento));
    add('Responsable', [Pa(resp, CEL)]);
    add('Apoyo', parrafosValor(a.apoyo));
    const ej = EJEC[a.ejecucion] ? a.ejecucion : 'persona';
    add('La ejecuta', [Pa(conIcono(ej, [T(EJEC[ej])]), CEL)]);
    add('Entradas', parrafosValor(a.entradas));
    if (a.entregable != null && a.entregable !== '') {
      const r = runsValor(a.entregable);
      if (tieneValor(a.receptor)) r.push(gris('  →  recibe ' + a.receptor + (a.receptorExterno ? ' (externo)' : '')));
      else if (a.receptor === DESCONOCIDO) r.push(T('  →  quién recibe: por confirmar', { italics: true, color: C.alerta }));
      add('Entregable', [Pa(r, CEL)]);
    }
    add('Criterio de aceptación', parrafosValor(a.criterio));
    const u = a.unidad || 'h';
    const tt = [];
    [['tProceso', 'Proceso'], ['tEspera', 'Espera']].forEach(([c, r]) => {
      const v = a[c];
      if (v == null || v === '') return;
      if (tt.length) tt.push(gris('     '));
      tt.push(gris(r + ': '));
      runsValor(v, ' ' + u).forEach(x => tt.push(x));
    });
    if (tt.length) add('Tiempos', [Pa(tt, CEL)]);
    add('Frecuencia', parrafosValor(a.frecuencia));
    add('Herramientas', parrafosValor(a.herramientas));
    add('Documentos y sistemas', parrafosValor(a.documentos));
    const vistos = {};
    const fs = (a.formatos || []).filter(f => { const ll = normalizarTexto(f.codigo || f.nombre); if (!ll || vistos[ll]) return false; vistos[ll] = true; return true; });
    if (fs.length) add('Formatos', fs.map(f => {
      const x = anexoDe(f);
      const txt = [f.codigo, f.nombre].filter(tieneValor).join(' · ') + (tieneValor(f.version) ? ' (v' + f.version + ')' : '');
      return Pa(conIcono('hoja', [T(txt)]).concat(x ? [gris('  —  '), new D.InternalHyperlink({ anchor: ANCLA_ANEXOS, children: [T('Anexo ' + x.n, { bold: true, style: 'Hyperlink' })] })] : []), CEL);
    }));
    add('Reglas', parrafosValor(a.reglas));
    const evs = (a.eventos || []).slice().sort((x, y) => MOMENTOS.indexOf(x.momento) - MOMENTOS.indexOf(y.momento));
    if (evs.length) add('Esperas y eventos', evs.map(e => (evs.length > 1 ? vineta(T(frase(e))) : Pa(T(frase(e)), CEL))));
    const fc = fraseCiclo(a.ciclo);
    if (fc) add('Repetición', [Pa(T(fc), CEL)]);
    const decs = m.decisiones.filter(d => d.origen === k && d.estado !== 'sugerencia');
    decs.forEach(d => {
      const ps = [Pa([T(d.pregunta || 'Decisión sin pregunta', { bold: true })].concat(tieneValor(d.decide) ? [gris('   Decide: ' + d.decide + '.')] : []), CEL)];
      if (TIPO_DEC[d.tipo]) ps.push(Pa(gris(TIPO_DEC[d.tipo]), CEL));
      (d.salidas || []).forEach(sa => ps.push(vineta([T((sa.condicion || 'Sin condición') + '  →  '), sa.destino ? T(Rotulo(sa.destino)) : T('sin destino definido', { italics: true, color: C.alerta })]
        .concat(sa.porDefecto && d.tipo !== 'paralela' ? [gris('  (camino por defecto)')] : [])
        .concat(sa.clase && CLASE_SALIDA[sa.clase] ? [gris('  · ' + CLASE_SALIDA[sa.clase])] : []))));
      add('Decisión', ps);
    });
    if (!decs.length) add('Sigue con', [Pa(T(siguiente(k)), CEL)]);
    add('Problemas conocidos', parrafosValor(a.problemas));
    add('Fuente', parrafosValor(a.fuente));
    out.push(tablaFicha(filas, W));
    return out;
  };
  let iF = 0;
  m.fases.forEach(f => {
    const ks = f.actividades.filter(k => info[k]);
    if (!ks.length) return;
    iF += 1;
    ks.forEach(k => bloqueActividad(k, nombreFase(iF - 1, f.nombre)).forEach(x => cuerpo3.push(x)));
  });

  /* ===== 7. Referencias ===== */
  cuerpo3.push(titulo('7. Referencias', 1));
  const refs = (proc.referencias || []).filter(r => tieneValor(r.nombre) || tieneValor(r.codigo));
  if (refs.length) {
    cuerpo3.push(Pa(T('Normas, políticas, procedimientos y leyes relacionados con este proceso.')));
    cuerpo3.push(tablaLista([{ t: 'Código', w: 1500 }, { t: 'Referencia', w: null }, { t: 'Tipo', w: 2000 }, { t: 'Enlace', w: 2300 }], refs.map(r => [
      [Pa(t9(tieneValor(r.codigo) ? r.codigo : '—'), CEL)], [Pa(t9(r.nombre || '—'), CEL)], [Pa(t9(REF[r.tipo] || 'Otra'), CEL)],
      [Pa(tieneValor(r.enlace) ? enlace(r.enlace, null, { size: 18 }) : t9('—', { color: C.apagado }), CEL)],
    ]), W));
  } else cuerpo3.push(Pa(porDefinir('No hay referencias registradas.')));

  /* ===== 8. Control de cambios (si hay versiones aprobadas) ===== */
  const hist = (m.historial || []).slice().sort((x, y) => x.numero - y.numero);
  if (hist.length) {
    cuerpo3.push(titulo('8. Control de cambios', 1));
    const et = version === 'tobe' ? 'To-Be' : 'As-Is';
    const filasH = hist.map(h => [[Pa(t9(et + ' v' + h.numero), CEL)], [Pa(t9(fechaCorta(h.fecha)), CEL)], [Pa(t9('Aprobada por ' + lista(h.aprobadores || []) + (h.vobo && h.vobo.length ? ', con el visto bueno de ' + lista(h.vobo) : '')), CEL)]]);
    if (!hist.some(h => h.numero === m.numero)) filasH.push([[Pa(t9(etqVersion), CEL)], [Pa(t9(hoy), CEL)], [Pa(t9(estado + ' (esta versión)'), CEL)]]);
    cuerpo3.push(tablaLista([{ t: 'Versión', w: 1500 }, { t: 'Fecha', w: 1800 }, { t: 'Descripción', w: null }], filasH, W));
  }

  /* ===== contenido (con las entradas ya conocidas; Word pone los números al actualizar) ===== */
  const contenido = [
    Pa(T('Contenido', { bold: true, size: 30, color: C.tinta }), { pageBreakBefore: true, spacing: { after: 240 } }),
    new D.TableOfContents('Contenido', {
      hyperlink: true, headingStyleRange: '1-2',
      contentChildren: titulos.filter(t => t.nivel <= 2).map(t => new D.Paragraph({ style: 'TOC' + t.nivel, children: [new D.InternalHyperlink({ anchor: t.ancla, children: [T(t.texto)] })] })),
    }),
  ];

  /* ===== encabezado y pie ===== */
  const cab = ancho => new D.Header({ children: [Pa([T(proc.nombre || ''), new D.TextRun({ children: [new D.Tab(), (codigo ? codigo + ' · ' : '') + etqVersion] })],
    { style: 'Header', tabStops: [{ type: D.TabStopType.RIGHT, position: ancho }], border: { bottom: { style: D.BorderStyle.SINGLE, size: 4, color: C.filete, space: 4 } } })] });
  const pie = ancho => new D.Footer({ children: [Pa([T(estado + ' · generado el ' + hoy), new D.TextRun({ children: [new D.Tab(), 'Página ', D.PageNumber.CURRENT, ' de ', D.PageNumber.TOTAL_PAGES] })],
    { style: 'Footer', tabStops: [{ type: D.TabStopType.RIGHT, position: ancho }] })] });
  const retrato = { size: { width: P.w, height: P.h }, margin: { top: M_RETRATO, right: M_RETRATO, bottom: M_RETRATO, left: M_RETRATO, header: 708, footer: 708 } };
  const horizontal = { size: { width: P.w, height: P.h, orientation: D.PageOrientation.LANDSCAPE }, margin: { top: M_HORIZ, right: M_HORIZ, bottom: M_HORIZ, left: M_HORIZ, header: 400, footer: 400 } };
  const verticalAncha = { size: { width: P.w, height: P.h }, margin: { top: M_HORIZ, right: M_HORIZ, bottom: M_HORIZ, left: M_HORIZ, header: 400, footer: 400 } };

  return new D.Document({
    creator: 'Kaze · Captura de procesos',
    title: (codigo ? codigo + ' ' : '') + (proc.nombre || 'Proceso'),
    description: 'Documento del proceso ' + (proc.nombre || '') + ' · ' + etqVersion,
    styles: {
      default: {
        document: { run: { font: 'Arial', size: 20, color: C.texto, language: { value: 'es-CO' } }, paragraph: { spacing: { after: 120, line: 276, lineRule: AUTO } } },
        heading1: { run: { font: 'Arial', size: 30, bold: true, color: C.tinta }, paragraph: { spacing: { before: 360, after: 160 }, keepNext: true, keepLines: true, outlineLevel: 0 } },
        heading2: { run: { font: 'Arial', size: 24, bold: true, color: C.tinta }, paragraph: { spacing: { before: 320, after: 120 }, keepNext: true, keepLines: true, outlineLevel: 1 } },
        heading3: { run: { font: 'Arial', size: 21, bold: true, color: C.tinta }, paragraph: { spacing: { before: 300, after: 100 }, keepNext: true, keepLines: true, outlineLevel: 2 } },
        hyperlink: { run: { color: '1F5FAD', underline: { type: D.UnderlineType.SINGLE } } },
      },
      paragraphStyles: [
        { id: 'Header', name: 'header', basedOn: 'Normal', run: { size: 16, color: C.apagado }, paragraph: { spacing: { before: 0, after: 0, line: 240, lineRule: AUTO } } },
        { id: 'Footer', name: 'footer', basedOn: 'Normal', run: { size: 16, color: C.apagado }, paragraph: { spacing: { before: 0, after: 0, line: 240, lineRule: AUTO } } },
        { id: 'TOC1', name: 'toc 1', basedOn: 'Normal', next: 'Normal', run: { bold: true, size: 20, color: C.tinta }, paragraph: { spacing: { before: 140, after: 40 } } },
        { id: 'TOC2', name: 'toc 2', basedOn: 'Normal', next: 'Normal', run: { size: 20 }, paragraph: { indent: { left: 300 }, spacing: { before: 0, after: 30 } } },
        { id: 'TOC3', name: 'toc 3', basedOn: 'Normal', next: 'Normal', run: { size: 18 }, paragraph: { indent: { left: 600 }, spacing: { before: 0, after: 20 } } },
      ],
    },
    numbering: { config: [
      { reference: 'kz-vinetas', levels: [{ level: 0, format: D.LevelFormat.BULLET, text: '•', alignment: D.AlignmentType.LEFT, style: { paragraph: { indent: { left: 260, hanging: 200 } } } }] },
      { reference: 'kz-vinetas-sipoc', levels: [{ level: 0, format: D.LevelFormat.BULLET, text: '•', alignment: D.AlignmentType.LEFT, style: { paragraph: { indent: { left: 180, hanging: 160 } } } }] },
      { reference: 'kz-ramas', levels: [{ level: 0, format: D.LevelFormat.BULLET, text: '→', alignment: D.AlignmentType.LEFT, style: { paragraph: { indent: { left: 520, hanging: 280 } }, run: { color: C.marca } } }] },
    ] },
    sections: [
      { properties: { page: retrato, titlePage: true }, headers: { default: cab(W), first: new D.Header({ children: [Pa([])] }) }, footers: { default: pie(W), first: new D.Footer({ children: [Pa([])] }) }, children: portada.concat(contenido, cuerpo1) },
      ...hojasDiagrama.map(h => ({ properties: { type: D.SectionType.NEXT_PAGE, page: h.horizontal ? horizontal : verticalAncha }, headers: { default: cab(h.horizontal ? WH : WV) }, footers: { default: pie(h.horizontal ? WH : WV) }, children: h.children })),
      { properties: { type: D.SectionType.NEXT_PAGE, page: retrato }, headers: { default: cab(W) }, footers: { default: pie(W) }, children: cuerpo3 },
    ],
  });
}
