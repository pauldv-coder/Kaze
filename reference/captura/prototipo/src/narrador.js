/* Narrador: cuenta el proceso como un relato para quien lo ejecuta, en tercera persona.
   Devuelve una representación neutra (párrafos de fragmentos) que el documento Word y la
   vista previa de la ficha dibujan cada uno a su manera.
     fragmento: { t, b?, i?, tono?: 'falta' | 'suave' | 'ia', ref?: { ancla }, anexo?: n }
     párrafo:   { tipo: 'texto' | 'importante' | 'atencion' | 'decision' | 'rama' | 'falta', runs: [fragmentos] }
   La ficha técnica de cada actividad no se pierde: va como anexo del documento. */
import { secuencia, tieneValor, DESCONOCIDO, normalizarTexto } from './model.js';
import { accionDe, aTercera, conArticulo, conPrep, sujeto as sujetoDe, lista, elementos, esClausula, minus1, mayus1, sinPunto, oracion, cita,
  duracion, unoTrasOtro, numeroDe, generoNumero, tercera } from './lengua.js';

const limpio = s => String(s).replace(/[^A-Za-z0-9_]/g, '_');
export const anclaPaso = k => 'kz_paso_' + limpio(k);
export const anclaFicha = k => 'kz_ficha_' + limpio(k);

const R = (t, o) => Object.assign({ t: String(t) }, o || {});
const falta = t => R(t, { tono: 'falta' });
const texto = v => (tieneValor(v) ? String(v).trim() : '');

/* ---------- el flujo, leído de la captura (igual que lo dibuja el diagrama) ---------- */
export function flujoDelModelo(m) {
  const seq = secuencia(m);
  const enFase = seq.filter(s => s.numero != null);
  const info = {}; enFase.forEach(s => { info[s.clave] = s; });
  const porNum = {}; enFase.forEach(s => { porNum[s.numero] = s.clave; });
  const N = enFase.length;
  const decDe = {};
  m.decisiones.forEach(d => { if (d.estado !== 'sugerencia' && d.origen && info[d.origen] && !decDe[d.origen]) decDe[d.origen] = d; });
  // Ramas en paralelo o inclusivas: se unen antes del paso que sigue a la última rama.
  const joins = []; const finDeRama = {};
  Object.values(decDe).forEach(d => {
    if (d.tipo === 'exclusiva') return;
    const ts = d.salidas.map(s => s.destino).filter(k => k && info[k]).map(k => info[k].numero).sort((a, b) => a - b);
    if (ts.length < 2) return;
    const jNum = ts[ts.length - 1] + 1;
    const j = { decision: d.clave, tipo: d.tipo, antesDe: porNum[jNum] || null, finales: [] };
    ts.forEach((t, i) => {
      const fin = i < ts.length - 1 ? ts[i + 1] - 1 : jNum - 1;
      const k = porNum[Math.max(t, fin)];
      if (k && !decDe[k] && !finDeRama[k]) { finDeRama[k] = j; j.finales.push(k); }
    });
    joins.push(j);
  });
  const siguientes = {}, entradas = {};
  const entra = (k, e) => { (entradas[k] = entradas[k] || []).push(e); };
  enFase.forEach(s => {
    const k = s.clave, n = s.numero, d = decDe[k];
    if (n === 1) entra(k, { via: 'inicio' });
    if (d) {
      siguientes[k] = { decision: d.clave };
      (d.salidas || []).forEach((sa, i) => { if (sa.destino && info[sa.destino]) entra(sa.destino, { via: 'salida', desde: k, decision: d, salida: sa, indice: i }); });
    } else if (finDeRama[k]) {
      const j = finDeRama[k];
      siguientes[k] = { union: true, destino: j.antesDe };
      if (j.antesDe) entra(j.antesDe, { via: 'union', desde: k, join: j });
    } else if (porNum[n + 1]) {
      siguientes[k] = { destino: porNum[n + 1] };
      entra(porNum[n + 1], { via: 'secuencia', desde: k });
    } else siguientes[k] = { fin: true };
    const a = m.actividades[k];
    (a.eventos || []).forEach(e => { if ((e.tipo === 'limite' || e.tipo === 'error') && e.destino && info[e.destino]) entra(e.destino, { via: 'evento', desde: k, evento: e }); });
  });
  return { seq, enFase, info, porNum, decDe, joins, siguientes, entradas };
}

/* ---------- piezas de frases ---------- */
function rolTexto(rol) { return conArticulo(String(rol).trim(), 'rol'); }
function listaNominal(v, modo) { return elementos(v).map(x => conArticulo(x, modo)); }

/* ¿Qué datos de la ficha quedaron «por confirmar»? */
const PREGUNTAS = [['descripcion', 'qué se hace'], ['responsable', 'quién lo hace'], ['entradas', 'con qué empieza'], ['entregable', 'qué entrega'],
  ['receptor', 'quién recibe el resultado'], ['criterio', 'cómo se sabe que quedó bien'], ['tProceso', 'cuánto tarda'], ['tEspera', 'cuánto espera'],
  ['frecuencia', 'con qué frecuencia se hace'], ['herramientas', 'qué herramientas usa'], ['documentos', 'qué documentos consulta'],
  ['reglas', 'qué reglas aplica'], ['problemas', 'qué problemas tiene'], ['apoyo', 'quién apoya'], ['departamento', 'de qué área es']];

/* La frecuencia que más se repite: se dice una vez al inicio y solo se repite en el paso que cambia. */
export function frecuenciaComun(m, enFase) {
  const cuenta = {};
  enFase.forEach(s => { const f = texto(m.actividades[s.clave].frecuencia); if (f) { const k = normalizarTexto(f); cuenta[k] = cuenta[k] || { f, n: 0 }; cuenta[k].n += 1; } });
  const top = Object.values(cuenta).sort((a, b) => b.n - a.n)[0];
  return top && top.n >= 2 && top.n >= enFase.length / 2 ? top.f : null;
}

/* Cómo empieza y cómo termina el proceso (una oración). */
export function limitesProceso(proc) {
  const runs = [];
  const disp = texto(proc.disparador);
  const ini = proc.inicio || {};
  const det = texto(ini.detalle);
  const res = (proc.resultados || []).map(texto).filter(Boolean);
  if (disp) runs.push(R('El proceso empieza ' + (esClausula(disp) ? 'cuando ' + minus1(sinPunto(disp)) : 'con ' + conArticulo(sinPunto(disp)))));
  else if (det) runs.push(R('El proceso empieza ' + minus1(sinPunto(det))));
  else runs.push(R('El proceso empieza '), falta('[falta decir qué lo pone en marcha]'));
  if (disp && det) runs.push(R(' (' + minus1(sinPunto(det)) + ')'));
  if (res.length) runs.push(R(' y termina con ' + lista(res.map(r => conArticulo(sinPunto(r))), 'o') + '.'));
  else runs.push(R('.'));
  return runs;
}

/* A dónde sigue una salida: «sigue en el paso 6 (…)» o «vuelve al paso 4 (…)». */
function destinoFrase(ctx, desde, destino) {
  if (destino === '__fin') return [R('el proceso termina')];
  if (!destino) return [falta('[falta decir a dónde sigue]')];
  if (!ctx.info[destino]) return [falta('[sigue en una actividad que ya no está en la secuencia]')];
  const atras = ctx.info[destino].numero <= ctx.info[desde].numero;
  const s = ctx.info[destino];
  return [R(atras ? 'vuelve al ' : 'sigue en el '), R('paso ' + s.numero, { ref: { ancla: anclaPaso(destino) }, b: true }), R(' (' + sinPunto(ctx.m.actividades[destino].nombre) + ')')];
}
function condicionFrase(sa, tipo) {
  const c = texto(sa.condicion);
  if (tipo === 'paralela') return c ? [R(mayus1(sinPunto(c)) + ': ')] : [];
  if (!c) return sa.porDefecto ? [R('En cualquier otro caso, ')] : [R('Si se cumple '), falta('[una condición por definir]'), R(', ')];
  if (/^si\b/i.test(c)) return [R(mayus1(sinPunto(c)) + ', ')];
  if (/^(en cualquier otro caso|en otro caso|de lo contrario|si no|en los demás casos|por defecto)$/i.test(sinPunto(c))) return [R(mayus1(sinPunto(c)) + ', ')];
  return [R('Si la respuesta es ' + cita(c) + ', ')];
}

/* ---------- un paso ---------- */
function narrarPaso(ctx, k) {
  const { m, info, flujo } = ctx;
  const a = m.actividades[k], s = info[k];
  const parrafos = [];
  const main = [];
  const oracionRuns = (runs) => { if (main.length) main.push(R(' ')); runs.forEach(r => main.push(r)); };

  // Quién lo hace.
  const resp = a.responsable;
  let suj, plural = false, sujetoRuns;
  if (tieneValor(resp)) { suj = rolTexto(resp); plural = numeroDe(suj) === 'p'; sujetoRuns = [R(mayus1(suj))]; }
  else if (a.ejecucion === 'sistema') { suj = 'el sistema'; sujetoRuns = [R('El sistema')]; }
  else if (a.ejecucion === 'automatizacion') { suj = 'la automatización'; sujetoRuns = [R('La automatización')]; }
  else { suj = null; sujetoRuns = [R('El responsable '), falta(resp === DESCONOCIDO ? '[por confirmar]' : '[por definir]')]; }
  const V = inf => tercera(inf, plural);

  // Cómo se llega a este paso (si no es simplemente el paso anterior).
  const ents = (flujo.entradas[k] || []).filter(e => e.via !== 'inicio');
  const previo = s.numero - 1;
  const union = ents.filter(e => e.via === 'union');
  const otras = ents.filter(e => e.via !== 'union' && !(info[e.desde] && info[e.desde].numero === previo));
  const desdePrevio = ents.some(e => e.via !== 'union' && info[e.desde] && info[e.desde].numero === previo);
  if (union.length) {
    const pasos = union.map(e => info[e.desde]).filter(Boolean).sort((x, y) => x.numero - y.numero);
    oracionRuns([R('Empieza cuando terminan ' + (pasos.length > 1 ? 'los pasos ' : 'el paso '))].concat(
      pasos.reduce((acc, p, i) => acc.concat(i ? [R(i === pasos.length - 1 ? ' y ' : ', ')] : [], [R(String(p.numero), { ref: { ancla: anclaPaso(p.clave) }, b: true })]), []), [R('.')]));
  }
  if (otras.length) {
    const runs = [R(desdePrevio || union.length ? 'También se llega a este paso desde ' : 'A este paso se llega desde ')];
    otras.forEach((e, i) => {
      if (i) runs.push(R('; también desde '));
      runs.push(R('el '), R('paso ' + info[e.desde].numero, { ref: { ancla: anclaPaso(e.desde) }, b: true }));
      if (e.via === 'salida' && e.decision.tipo !== 'paralela') {
        const c = texto(e.salida.condicion);
        if (c && /^si\b/i.test(c)) runs.push(R(', ' + minus1(sinPunto(c))));
        else if (c) runs.push(R(', si la respuesta es ' + cita(c)));
        else if (e.salida.porDefecto) runs.push(R(', en cualquier otro caso'));
      }
      if (e.via === 'evento') runs.push(R(e.evento.tipo === 'limite' ? ', si se vence su plazo' : texto(e.evento.texto) ? ', si ' + minus1(sinPunto(e.evento.texto)) : ', si ocurre un error'));
    });
    runs.push(R('.'));
    oracionRuns(runs);
  } else if (!ents.length && s.numero !== 1) {
    oracionRuns([falta('[Ningún paso lleva a este: revisa el diagrama.]')]);
  }

  const finLlegada = main.length;
  // Esperas antes de empezar.
  (a.eventos || []).filter(e => e.momento === 'antes').forEach(e => oracionRuns(fraseEspera(e, 'Antes de empezar', plural)));

  // Con qué empieza + quién + qué hace.
  const accion = accionDe(a.nombre, plural);
  const accionTxt = accion.ok ? accion.texto : (plural ? 'se encargan ' : 'se encarga ') + conPrep('de', conArticulo(sinPunto(a.nombre)));
  const ents0 = tieneValor(a.entradas) ? elementos(a.entradas) : [];
  const entNominal = ents0.length && ents0.every(x => !esClausula(x));
  if (entNominal) {
    oracionRuns([R('Con ' + lista(ents0.map(x => conArticulo(x))) + ', ')].concat(suj ? [R(suj)] : [R('el responsable '), falta(resp === DESCONOCIDO ? '[por confirmar]' : '[por definir]')], [R(' ' + accionTxt + '.')]));
  } else {
    oracionRuns(sujetoRuns.concat([R(' ' + accionTxt + '.')]));
    if (ents0.length) oracionRuns([R('Para empezar necesita esto: ' + lista(ents0.map(x => minus1(x))) + '.')]);
  }
  // Se repite.
  const c = a.ciclo;
  if (c && c.tipo === 'porCada') {
    const que = texto(c.condicion);
    if (que) oracionRuns([R('Lo hace por cada ' + minus1(sinPunto(que)) + ', ' + (c.paralelo ? (generoNumero(que.split(' ')[0]).g === 'f' ? 'todas a la vez' : 'todos a la vez') : unoTrasOtro(que)) + '.')]);
    else oracionRuns([R('Lo hace por cada '), falta('[elemento por definir]'), R(c.paralelo ? ', todos a la vez.' : ', uno tras otro.')]);
  } else if (c && c.tipo === 'repite') {
    const cond = texto(c.condicion);
    if (!cond) oracionRuns([R('Lo repite hasta que se cumpla '), falta('[una condición por definir]'), R('.')]);
    else if (/^(hasta|mientras|cuando|si|siempre)\b/i.test(cond)) oracionRuns([R('Lo repite ' + minus1(sinPunto(cond)) + '.')]);
    else oracionRuns([R('Lo repite hasta que se cumpla esto: ' + minus1(sinPunto(cond)) + '.')]);
  }
  // Descripción, en tercera persona cuando empieza con infinitivo.
  if (tieneValor(a.descripcion)) oracionRuns([R(oracion(aTercera(String(a.descripcion).replace(/\s*\n+\s*/g, ' '), plural)))]);
  // Apoyo, herramientas, formatos, documentos.
  if (tieneValor(a.apoyo)) oracionRuns([R('Cuenta con el apoyo ' + conPrep('de', lista(listaNominal(a.apoyo, 'rol'))) + '.')]);
  const herr = tieneValor(a.herramientas) ? listaNominal(a.herramientas, 'herramienta') : [];
  const vistos = {};
  const formatos = (a.formatos || []).filter(f => { const ll = normalizarTexto(f.codigo || f.nombre); if (!ll || vistos[ll]) return false; vistos[ll] = true; return true; });
  const fRuns = formatos.map(f => {
    const n = ctx.anexoDe ? ctx.anexoDe(f) : null;
    const nombre = [texto(f.codigo), texto(f.nombre) ? cita(f.nombre) : ''].filter(Boolean).join(' ');
    const r = [R(nombre)];
    if (n) r.push(R(' ('), R('anexo ' + n, { ref: { ancla: ctx.anclaAnexos || 'kz_anexos' }, anexo: n, b: true }), R(')'));
    return r;
  });
  if (herr.length || fRuns.length) {
    const partes = herr.map(h => [R(h)]);
    if (fRuns.length) partes.push([R(fRuns.length > 1 ? 'los formatos ' : 'el formato ')].concat(fRuns.reduce((acc, fr, i) => acc.concat(i ? [R(i === fRuns.length - 1 ? ' y ' : ', ')] : [], fr), [])));
    const runs = [R(mayus1(V('usar')) + ' ')];
    partes.forEach((p, i) => { if (i) runs.push(R(i === partes.length - 1 ? ' y ' : ', ')); p.forEach(x => runs.push(x)); });
    runs.push(R('.'));
    oracionRuns(runs);
  }
  if (tieneValor(a.documentos)) oracionRuns([R(mayus1(V('trabajar')) + ' con ' + lista(listaNominal(a.documentos, 'herramienta')) + '.')]);
  // Límite de tiempo y errores mientras se hace.
  (a.eventos || []).filter(e => e.momento === 'durante').forEach(e => {
    if (e.tipo === 'limite') {
      const d = duracion(e.n, e.unidad);
      const runs = [R(mayus1(V('tener')) + ' ')].concat(d ? [R(d)] : [falta('[un plazo por definir]')], [R(' para terminar; si no alcanza, ' + (e.interrumpe === false ? 'sin detenerse, ' : 'deja lo que está haciendo y '))]);
      if (e.destino === '__fin') runs.push(R('el proceso termina.'));
      else if (e.destino && info[e.destino]) runs.push(R('el proceso sigue en el '), R('paso ' + info[e.destino].numero, { ref: { ancla: anclaPaso(e.destino) }, b: true }), R(' (' + sinPunto(m.actividades[e.destino].nombre) + ').'));
      else runs.push(falta('[falta decir a dónde sigue]'), R('.'));
      oracionRuns(runs);
    } else if (e.tipo === 'error') {
      const runs = [R('Si ' + (texto(e.texto) ? minus1(sinPunto(e.texto)) : 'ocurre un error') + ', ' + (plural ? 'dejan' : 'deja') + ' la actividad y ')];
      if (e.destino === '__fin') runs.push(R('el proceso termina.'));
      else if (e.destino && info[e.destino]) runs.push(R('el proceso sigue en el '), R('paso ' + info[e.destino].numero, { ref: { ancla: anclaPaso(e.destino) }, b: true }), R(' (' + sinPunto(m.actividades[e.destino].nombre) + ').'));
      else runs.push(falta('[falta decir a dónde sigue]'), R('.'));
      oracionRuns(runs);
    }
  });
  // Cómo se sabe que quedó bien.
  if (tieneValor(a.criterio)) {
    const cr = sinPunto(a.criterio);
    oracionRuns([R('Antes de seguir, ' + V('comprobar') + (esClausula(cr) ? ' que ' + minus1(cr) : ' esto: ' + minus1(cr)) + '.')]);
  }
  // Qué entrega y a quién.
  if (tieneValor(a.entregable)) {
    const es = elementos(a.entregable).map(x => conArticulo(x));
    const pl = es.length > 1 || numeroDe(es[0] || '') === 'p';
    const runs = [R('El resultado ' + (pl ? 'son ' : 'es ') + lista(es))];
    if (tieneValor(a.receptor)) runs.push(R(', que se entrega ' + conPrep('a', rolTexto(a.receptor)) + (a.receptorExterno ? ', fuera de la organización' : '')));
    runs.push(R('.'));
    oracionRuns(runs);
  }
  // Esperas y avisos al terminar.
  (a.eventos || []).filter(e => e.momento === 'despues').forEach(e => oracionRuns(fraseEspera(e, 'Al terminar', plural)));
  // Tiempos y frecuencia.
  const tp = typeof a.tProceso === 'number' ? duracion(a.tProceso, a.unidad) : null;
  const te = typeof a.tEspera === 'number' ? duracion(a.tEspera, a.unidad) : null;
  if (tp && te) oracionRuns([R('Toma ' + tp + ', más ' + te + ' de espera.')]);
  else if (tp) oracionRuns([R('Toma ' + tp + '.')]);
  else if (te) oracionRuns([R('Puede esperar ' + te + ' antes de empezar.')]);
  const fr = texto(a.frecuencia);
  if (fr && (!ctx.frecuencia || normalizarTexto(fr) !== normalizarTexto(ctx.frecuencia))) oracionRuns([R(fraseFrecuencia(fr, plural))]);
  const finCuerpo = main.length;
  // Qué sigue.
  const sig = flujo.siguientes[k] || {};
  const res = (ctx.proc.resultados || []).map(texto).filter(Boolean);
  if (sig.fin) oracionRuns([R('Con esto termina el proceso' + (res.length ? ', con ' + conArticulo(sinPunto(res[0])) : '') + '.')]);
  else if (sig.union) {
    if (sig.destino && info[sig.destino]) oracionRuns([R('Al terminar, espera a que terminen las demás ramas y el proceso sigue en el '), R('paso ' + info[sig.destino].numero, { ref: { ancla: anclaPaso(sig.destino) }, b: true }), R('.')]);
    else oracionRuns([R('Al terminar, espera a que terminen las demás ramas y el proceso termina.')]);
  }
  // Texto propio: reemplaza lo que se hace en el paso; se conservan cómo se llega y cómo termina.
  const recorta = rs => { const x = rs.slice(); while (x.length && x[0].t === ' ') x.shift(); while (x.length && x[x.length - 1].t === ' ') x.pop(); return x; };
  const llegada = recorta(main.slice(0, finLlegada)), cuerpo = recorta(main.slice(finLlegada, finCuerpo)), cierre = recorta(main.slice(finCuerpo));
  const propio = tieneValor(a.relato) ? String(a.relato).trim() : '';
  let principal = main;
  if (propio) {
    principal = [];
    [llegada, [R(oracion(propio.replace(/\s*\n+\s*/g, ' ')))], cierre].forEach(g => { if (!g.length) return; if (principal.length) principal.push(R(' ')); g.forEach(r => principal.push(r)); });
  }
  parrafos.push({ tipo: 'texto', runs: principal });

  // Reglas y problemas: aparte, para que se vean.
  if (tieneValor(a.reglas)) parrafos.push({ tipo: 'importante', runs: [R(elementos(a.reglas).map(x => oracion(x)).join(' '))] });
  if (tieneValor(a.problemas)) parrafos.push({ tipo: 'atencion', runs: [R(elementos(a.problemas).map(x => oracion(x)).join(' '))] });

  // La decisión al terminar.
  if (sig.decision) {
    const d = m.decisiones.find(x => x.clave === sig.decision);
    const q = texto(d.pregunta);
    const lead = [];
    if (d.tipo === 'paralela') lead.push(R('Luego el trabajo se divide y sigue a la vez por estos caminos:'));
    else {
      lead.push(R('Luego se decide: '));
      if (q) lead.push(R(sinPunto(q) + (/[?]$/.test(q) ? '' : '.'), { b: true })); else lead.push(falta('[falta la pregunta]'));
      if (tieneValor(d.decide) && normalizarTexto(d.decide) !== normalizarTexto(resp || '')) lead.push(R(' Decide ' + rolTexto(d.decide) + '.'));
      if (d.tipo === 'inclusiva') lead.push(R(' Puede seguir por uno o varios de estos caminos:'));
    }
    parrafos.push({ tipo: 'decision', runs: lead });
    (d.salidas || []).forEach(sa => {
      const runs = condicionFrase(sa, d.tipo);
      if (d.tipo === 'paralela') runs.push.apply(runs, destinoFrase(ctx, k, sa.destino).map((r, i) => (i === 0 ? R(mayus1(r.t.replace(/^sigue en /, '').replace(/^vuelve al /, 'el ')), r) : r)));
      else runs.push.apply(runs, destinoFrase(ctx, k, sa.destino));
      runs.push(R('.'));
      parrafos.push({ tipo: 'rama', runs });
    });
    if ((d.salidas || []).length < 2) parrafos.push({ tipo: 'rama', runs: [falta('[Falta al menos otro camino.]')] });
  }

  // Lo que falta confirmar y el estado.
  const faltan = PREGUNTAS.filter(([c]) => a[c] === DESCONOCIDO).map(([, q]) => q);
  const notas = [];
  if (a.estado === 'sugerencia') notas.push(R('Es una sugerencia de la IA: falta validarla con quien lo hace.', { tono: 'ia' }));
  if (a.estado === 'pregunta') notas.push(falta('Hay preguntas abiertas sobre este paso.'));
  if (faltan.length) { if (notas.length) notas.push(R(' ')); notas.push(falta('Por confirmar: ' + lista(faltan) + '.')); }
  if (notas.length) parrafos.push({ tipo: 'falta', runs: notas });

  return { clave: k, numero: s.numero, codigo: s.codigo, nombre: sinPunto(a.nombre), ancla: anclaPaso(k), fichaAncla: anclaFicha(k), estado: a.estado, parrafos,
    propio: !!propio, automatico: cuerpo.map(r => r.t).join('') };
}

/* «Frecuencia o volumen»: «Se hace cada mes…» o «Volumen habitual: 300 facturas al mes». */
export function fraseFrecuencia(fr, plural) {
  const t = sinPunto(fr);
  if (/^(\d|unos|unas|aprox|alrededor|entre|más de|mas de|menos de|hasta|cerca de|promedio|en promedio)/i.test(t)) return 'Volumen habitual: ' + minus1(t) + '.';
  return (plural ? 'Lo hacen ' : 'Se hace ') + minus1(t) + '.';
}

function fraseEspera(e, cuando, plural) {
  const esp = plural ? 'esperan' : 'espera';
  const t = texto(e.texto), quien = texto(e.quien);
  switch (e.tipo) {
    case 'tiempo': { const d = duracion(e.n, e.unidad); return [R(cuando + ', ' + esp + ' ')].concat(d ? [R(d)] : [falta('[un tiempo por definir]')], [R(t ? ' (' + minus1(sinPunto(t)) + ')' : ''), R(cuando === 'Al terminar' ? ' antes de seguir.' : '.')]); }
    case 'fecha': return t ? [R(cuando + ', ' + esp + ' hasta ' + minus1(sinPunto(t)) + '.')] : [R(cuando + ', ' + esp + ' hasta '), falta('[una fecha por definir]'), R('.')];
    case 'mensaje': {
      if (t && quien) return [R(cuando + ', ' + esp + ' ' + conArticulo(sinPunto(t)) + ', que envía ' + rolTexto(quien) + (e.externo ? ' desde fuera de la organización' : '') + '.')];
      if (t) return [R(cuando + ', ' + esp + ' ' + conArticulo(sinPunto(t)) + '.')];
      if (quien) return [R(cuando + ', ' + esp + ' un mensaje ' + conPrep('de', rolTexto(quien)) + '.')];
      return [R(cuando + ', ' + esp + ' un mensaje '), falta('[falta decir cuál y de quién]'), R('.')];
    }
    case 'condicion': return t ? [R(cuando + ', ' + esp + ' hasta que se cumpla esto: ' + minus1(sinPunto(t)) + '.')] : [R(cuando + ', ' + esp + ' hasta que se cumpla '), falta('[una condición por definir]'), R('.')];
    case 'aviso': return [R(cuando + ', ' + (plural ? 'avisan' : 'avisa') + (quien ? ' ' + conPrep('a', rolTexto(quien)) : '') + (t ? ': ' + cita(t) : '') + '.')];
    case 'hito': return t ? [R('Con esto se cumple el hito ' + cita(t) + '.')] : [R('Con esto se cumple un hito '), falta('[por nombrar]'), R('.')];
    default: return [];
  }
}

/* ---------- el proceso completo ---------- */
export function narrarProceso(proc, m, op) {
  op = op || {};
  const flujo = flujoDelModelo(m);
  const { enFase, info } = flujo;
  const anexos = op.anexos || [];
  const ctx = { proc, m, info, flujo, frecuencia: frecuenciaComun(m, enFase), anclaAnexos: op.anclaAnexos,
    anexoDe: f => { const x = anexos.find(y => y.llave === normalizarTexto(f.codigo || f.nombre)); return x ? x.n : null; } };
  const fases = [];
  let iF = 0;
  m.fases.forEach(f => {
    const ks = f.actividades.filter(k => info[k]);
    if (!ks.length) return;
    iF += 1;
    const intro = [];
    const obj = texto(f.objetivo), ent = texto(f.entrada), sal = texto(f.salida);
    const es = (f.entregables || []).map(texto).filter(Boolean);
    const runs = [];
    if (obj) {
      const a = accionDe(sinPunto(obj));
      runs.push(R('Esta fase busca ' + (a.ok ? minus1(sinPunto(obj)) : conArticulo(sinPunto(obj))) + '.'));
    }
    if (ent || sal) {
      let fr = '';
      if (ent) fr += 'Empieza ' + (esClausula(ent) ? 'cuando ' + minus1(sinPunto(ent)) : 'con ' + conArticulo(sinPunto(ent)));
      if (sal) fr += (ent ? ' y termina ' : 'Termina ') + (esClausula(sal) ? 'cuando ' + minus1(sinPunto(sal)) : 'con ' + conArticulo(sinPunto(sal)));
      runs.push(R((runs.length ? ' ' : '') + fr + '.'));
    }
    if (es.length) runs.push(R((runs.length ? ' ' : '') + 'Entrega ' + lista(es.map(x => conArticulo(sinPunto(x)))) + '.'));
    if (runs.length) intro.push({ tipo: 'texto', runs });
    fases.push({ id: f.id, indice: iF, nombre: f.nombre || 'Sin nombre', intro, pasos: ks.map(k => narrarPaso(ctx, k)) });
  });

  /* En pocas palabras */
  const roles = [];
  enFase.forEach(s => { const r = m.actividades[s.clave].responsable; if (tieneValor(r) && !roles.some(x => normalizarTexto(x) === normalizarTexto(r))) roles.push(String(r).trim()); });
  const resumen = [];
  const r1 = [R('Este procedimiento cuenta cómo se hace el proceso ' + cita(proc.nombre || 'sin nombre') + ': quién hace cada paso, con qué y qué entrega. ')].concat(limitesProceso(proc));
  const nF = fases.length, nP = enFase.length;
  r1.push(R(' Tiene ' + nP + (nP === 1 ? ' paso' : ' pasos') + (nF > 1 ? ' en ' + nF + ' fases: ' + lista(fases.map(f => f.nombre)) : '') + '.'));
  if (roles.length) r1.push(R(' Participan ' + lista(roles.map(rolTexto)) + '.'));
  if (ctx.frecuencia) r1.push(R(' ' + fraseFrecuencia(ctx.frecuencia)));
  resumen.push({ tipo: 'texto', runs: r1 });
  const comoLeer = [{ tipo: 'texto', runs: [R('Cómo leerlo: ', { b: true }), R('cada paso lleva el número que tiene en el diagrama. «Importante» marca una regla que se debe cumplir y «Atención», un problema conocido. Lo que falta confirmar va en color. ' + (op.textoFicha || 'La ficha técnica de cada actividad está en los anexos.'))] }];

  /* Alcance, en prosa */
  const alcance = [];
  const al = texto(proc.alcance), ex = texto(proc.exclusiones);
  const a1 = [];
  if (al) a1.push(R(/^(aplica|cubre|abarca|comprende|incluye|este procedimiento|el procedimiento|se aplica|va desde|empieza)\b/i.test(al) ? oracion(al) : 'Aplica a ' + conArticulo(sinPunto(al)).replace(/^el /, 'el ') + '.'));
  else a1.push(R('Aplica a '), falta('[alcance por definir]'), R('.'));
  if (ex) a1.push(R(' ' + (/^no\b/i.test(ex) ? oracion(ex) : 'No incluye ' + conArticulo(sinPunto(ex)) + '.')));
  alcance.push({ tipo: 'texto', runs: a1.map(r => Object.assign({}, r, { t: r.t.replace(/^Aplica a el /, 'Aplica al ') })) });
  alcance.push({ tipo: 'texto', runs: limitesProceso(proc) });
  const deps = (proc.departamentos || []).map(texto).filter(Boolean);
  const a3 = [];
  if (roles.length) a3.push(R('Participan ' + lista(roles.map(rolTexto)) + (deps.length ? (deps.length > 1 ? ', de las áreas de ' : ', del área de ') + lista(deps) : '') + '.'));
  if (tieneValor(proc.cliente)) a3.push(R((a3.length ? ' ' : '') + 'El resultado lo recibe ' + rolTexto(proc.cliente) + (proc.clienteExterno ? ', fuera de la organización' : '') + '.'));
  if (a3.length) alcance.push({ tipo: 'texto', runs: a3 });

  return { resumen, comoLeer, alcance, fases, sipoc: sipocDe(proc, m, flujo), frecuencia: ctx.frecuencia, flujo };
}

/* El relato de una sola actividad (vista previa en la ficha). */
export function narrarActividad(proc, m, clave, op) {
  const flujo = flujoDelModelo(m);
  if (!flujo.info[clave]) return null;
  const anexos = (op && op.anexos) || [];
  const ctx = { proc, m, info: flujo.info, flujo, frecuencia: frecuenciaComun(m, flujo.enFase),
    anexoDe: f => { const x = anexos.find(y => y.llave === normalizarTexto(f.codigo || f.nombre)); return x ? x.n : null; } };
  return narrarPaso(ctx, clave);
}

/* ---------- SIPOC ---------- */
export function sipocDe(proc, m, flujo) {
  flujo = flujo || flujoDelModelo(m);
  const { enFase } = flujo;
  const acts = enFase.map(s => m.actividades[s.clave]);
  const agregar = (xs, t, extra) => { const v = sinPunto(t); if (!v) return; if (!xs.some(x => normalizarTexto(x.t) === normalizarTexto(v))) xs.push(Object.assign({ t: mayus1(v) }, extra || {})); };
  const producidos = new Set();
  acts.forEach(a => { if (tieneValor(a.entregable)) elementos(a.entregable).forEach(x => producidos.add(normalizarTexto(x))); });
  const consumidos = new Set();
  acts.forEach(a => { if (tieneValor(a.entradas)) elementos(a.entradas).forEach(x => consumidos.add(normalizarTexto(x))); });

  const proveedores = [];
  (proc.proveedores || []).forEach(p => agregar(proveedores, p));
  acts.forEach(a => (a.eventos || []).forEach(e => { if (e.tipo === 'mensaje' && e.externo && tieneValor(e.quien)) agregar(proveedores, e.quien, { externo: true }); }));

  const entradas = [];
  acts.forEach(a => { if (tieneValor(a.entradas)) elementos(a.entradas).forEach(x => { if (!producidos.has(normalizarTexto(x))) agregar(entradas, x); }); });
  acts.forEach(a => (a.eventos || []).forEach(e => { if (e.tipo === 'mensaje' && tieneValor(e.texto) && (e.externo || tieneValor(e.quien))) agregar(entradas, e.texto); }));

  const proceso = [];
  m.fases.forEach(f => {
    const ks = f.actividades.filter(k => flujo.info[k]);
    if (!ks.length) return;
    const nums = ks.map(k => flujo.info[k].numero);
    proceso.push({ t: f.nombre || 'Sin nombre', pasos: nums.length > 1 ? 'pasos ' + Math.min.apply(null, nums) + ' a ' + Math.max.apply(null, nums) : 'paso ' + nums[0] });
  });

  const salidas = [];
  (proc.resultados || []).forEach(r => agregar(salidas, r));
  acts.forEach(a => { if (tieneValor(a.entregable)) elementos(a.entregable).forEach(x => { if (tieneValor(a.receptor) || !consumidos.has(normalizarTexto(x))) agregar(salidas, x); }); });

  const clientes = [];
  if (tieneValor(proc.cliente)) agregar(clientes, proc.cliente, { externo: !!proc.clienteExterno });
  acts.forEach(a => { if (tieneValor(a.receptor)) agregar(clientes, a.receptor, { externo: !!a.receptorExterno }); });

  return { proveedores, entradas, proceso, salidas, clientes };
}

/* Texto plano de un párrafo (pruebas y lectores de pantalla). */
export const plano = p => p.runs.map(r => r.t).join('');
