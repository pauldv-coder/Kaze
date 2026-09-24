/* Genera BPMN 2.0 (XML + DI) a partir del modelo capturado.
   Reglas: la secuencia del tablero conecta cada actividad con la siguiente, salvo donde una
   decisión define sus salidas; carriles = roles responsables; fases = artefactos Group (sin
   semántica de flujo); receptores externos = pools colapsados unidos por flujos de mensaje;
   eventos de la ficha = eventos intermedios antes/después de la tarea o sobre su borde.
   El trazado es automático (columnas por secuencia, conectores ortogonales que no pisan formas)
   y respeta los ajustes guardados del diagrama (m.diagrama). Nada se inventa: lo que falta
   queda como aviso. */
import { secuencia, tieneValor, mostrarTexto, nombreEvento, duracionISO, fraseEvento, fraseCiclo, normalizarTexto } from './model.js';
import { crearRuteador, simplificar } from './rutas.js';

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const limpio = s => String(s).replace(/[^A-Za-z0-9_]/g, '_');
const slug = s => (normalizarTexto(s).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'x').slice(0, 40);

export const G = { x0: 40, y0: 40, etqPool: 30, pad: 30, gap: 46, sup: 42, banda: 100, infNada: 30, infBorde: 46, infDatos: 96, extH: 64, extGap: 60 };
const TAM = { tarea: [120, 80], compuerta: [50, 50], evento: [36, 36], dato: [36, 50] };
const ETQ = { evento: [100, 30], compuerta: [128, 42], dato: [92, 30] };
const MARGEN = 12;
const GW_TIPO = { exclusiva: 'exclusiveGateway', inclusiva: 'inclusiveGateway', paralela: 'parallelGateway' };
const TIPO_TAREA = { persona: 'userTask', sistema: 'serviceTask', automatizacion: 'scriptTask' };
const ESPERAS = ['tiempo', 'fecha', 'mensaje', 'condicion'];
const ESPECIALES = { 'bpmn:ManualTask': 'manualTask', 'bpmn:SendTask': 'sendTask', 'bpmn:ReceiveTask': 'receiveTask', 'bpmn:BusinessRuleTask': 'businessRuleTask' };
/* El tipo de tarea: el de quién la ejecuta, salvo que en el diagrama se haya elegido uno especial (manual, envío…). */
const tipoTarea = a => ESPECIALES[a.tareaBpmn] || TIPO_TAREA[a.ejecucion] || 'userTask';
const DEF_BPMN = { timer: 'bpmn:TimerEventDefinition', message: 'bpmn:MessageEventDefinition', conditional: 'bpmn:ConditionalEventDefinition', error: 'bpmn:ErrorEventDefinition' };
const tipoBpmn = t => 'bpmn:' + t.charAt(0).toUpperCase() + t.slice(1);
const esCompuerta = t => /Gateway$/.test(t);
const esEvento = t => /Event$/.test(t);
const firma = r => r ? Math.round(r.x) + ',' + Math.round(r.y) + ',' + Math.round(r.w) + ',' + Math.round(r.h) : '';

function definicion(e) {
  switch (e.tipo) {
    case 'tiempo': return { def: 'timer', clase: 'timeDuration', valor: duracionISO(e) || (typeof e.n === 'number' ? e.n + ' ' + e.unidad : '') };
    case 'fecha': return { def: 'timer', clase: 'timeDate', valor: tieneValor(e.texto) ? e.texto : '' };
    case 'mensaje': case 'aviso': return { def: 'message' };
    case 'condicion': return { def: 'conditional', valor: tieneValor(e.texto) ? e.texto : '' };
    case 'limite': return { def: 'timer', clase: 'timeDuration', valor: duracionISO(e) || '' };
    case 'error': return { def: 'error' };
    default: return null;
  }
}

export function generarBPMN(proc, m, op) {
  op = Object.assign({ fases: true, entregables: true, numeros: true }, op || {});
  const aj = op.ajustes !== undefined ? (op.ajustes || {}) : (m.diagrama || {});
  // Las etiquetas guardadas antes de la versión 2 medían mal (se corrían en cada guardado): se descartan.
  const ajFormas = aj.formas || {}, ajEtq = aj.v === 2 ? (aj.etiquetas || {}) : {}, ajRutas = aj.rutas || {}, ajNotas = aj.notas || [];
  const avisos = [];
  const seq = secuencia(m).filter(s => s.numero != null);
  if (!seq.length) return { xml: null, avisos: [{ texto: 'Ubica al menos una actividad en una fase para generar el diagrama.' }], marcas: {}, mapa: {}, geo: null };

  const act = k => m.actividades[k];
  const info = {}; seq.forEach(s => { info[s.clave] = s; });
  const porNum = {}; seq.forEach(s => { porNum[s.numero] = s.clave; });
  const N = seq.length;
  const mapa = {};

  // ---------- decisiones ----------
  const decDe = {};
  const sugeridas = m.decisiones.filter(d => d.estado === 'sugerencia').length;
  if (sugeridas) avisos.push({ texto: sugeridas + (sugeridas === 1 ? ' decisión sugerida por la IA no se dibuja' : ' decisiones sugeridas por la IA no se dibujan') + ' hasta que la aceptes.' });
  m.decisiones.filter(d => d.estado !== 'sugerencia').forEach(d => {
    const nombre = '«' + (d.pregunta || 'Decisión sin pregunta') + '»';
    if (!d.origen || !info[d.origen]) { avisos.push({ texto: 'La decisión ' + nombre + ' no se dibuja: su actividad de origen no está en la secuencia.' }); return; }
    if (decDe[d.origen]) { avisos.push({ texto: 'La decisión ' + nombre + ' no se dibuja: ' + info[d.origen].codigo + ' ya tiene otra decisión.' }); return; }
    decDe[d.origen] = d;
  });
  // Uniones para decisiones paralelas o inclusivas.
  const joins = []; const finDeRama = {};
  Object.values(decDe).forEach(d => {
    if (d.tipo === 'exclusiva') return;
    const ts = d.salidas.map(s => s.destino).filter(k => k && info[k]).map(k => info[k].numero).sort((a, b) => a - b);
    if (ts.length < 2) return;
    const jNum = ts[ts.length - 1] + 1;
    const j = { id: 'Union_' + limpio(d.clave), tipo: d.tipo, antesDe: porNum[jNum] || null, finales: [] };
    ts.forEach((t, i) => {
      const fin = i < ts.length - 1 ? ts[i + 1] - 1 : jNum - 1;
      const k = porNum[Math.max(t, fin)];
      if (k && !decDe[k] && !finDeRama[k]) { finDeRama[k] = j.id; j.finales.push(k); }
    });
    joins.push(j);
  });

  // ---------- carriles ----------
  const carriles = [];
  const nombreCarril = k => { const a = act(k); return a && tieneValor(a.responsable) ? String(a.responsable) : 'Sin responsable'; };
  seq.forEach(s => { const c = nombreCarril(s.clave); if (!carriles.some(x => x.nombre === c)) carriles.push({ nombre: c }); });
  const usadosIds = {};
  carriles.forEach(c => { let id = 'Carril_' + slug(c.nombre); while (usadosIds[id]) id += '_'; usadosIds[id] = true; c.id = id; mapa[id] = { tipo: 'carril', rol: c.nombre }; });
  const iCarril = k => carriles.findIndex(c => c.nombre === nombreCarril(k));

  // ---------- nodos ----------
  const nodos = {}; const orden = []; const flujos = []; const idsFlujo = {};
  const addNodo = n => { nodos[n.id] = n; orden.push(n); return n; };
  const flujo = (src, tgt, extra) => {
    let id = 'Flujo_' + limpio(src) + '__' + limpio(tgt);
    while (idsFlujo[id]) id += '_b';
    idsFlujo[id] = true;
    const f = Object.assign({ id, src, tgt }, extra || {}); flujos.push(f); return f;
  };
  const idTarea = k => 'Act_' + limpio(k);
  const tipoInicio = (proc.inicio && proc.inicio.tipo) || 'ninguno';
  const k1 = porNum[1];
  addNodo({ id: 'Inicio', tipo: 'startEvent', nombre: tieneValor(proc.disparador) ? proc.disparador : '', carril: iCarril(k1),
    def: tipoInicio === 'tiempo' ? { def: 'timer', clase: 'timeCycle', valor: (proc.inicio && proc.inicio.detalle) || '' } : tipoInicio === 'mensaje' ? { def: 'message' } : tipoInicio === 'condicion' ? { def: 'conditional', valor: (proc.inicio && proc.inicio.detalle) || '' } : null });
  mapa.Inicio = { tipo: 'inicio' };
  mapa.Participante = { tipo: 'proceso' };

  const cadena = {};
  const externos = []; const mensajes = [];
  const fines = [];
  const nuevoFin = (carril, nombre, base, local) => { const e = addNodo({ id: 'Fin_' + limpio(base), tipo: 'endEvent', nombre: nombre || '', carril, fin: true, local: !!local }); fines.push(e); return e; };
  const finLocal = {};
  const externo = nombre => { let e = externos.find(x => normalizarTexto(x.nombre) === normalizarTexto(nombre)); if (!e) { e = { id: 'Externo_' + slug(nombre), nombre }; while (externos.some(x => x.id === e.id)) e.id += '_'; externos.push(e); } return e; };
  for (let n = 1; n <= N; n++) {
    const k = porNum[n], a = act(k), c = iCarril(k);
    joins.filter(j => j.antesDe === k).forEach(j => addNodo({ id: j.id, tipo: GW_TIPO[j.tipo], nombre: '', carril: c, union: true }));
    const evs = a.eventos || [];
    const ids = [];
    evs.filter(e => e.momento === 'antes' && ESPERAS.indexOf(e.tipo) >= 0).forEach(e => {
      const id = 'Ev_' + limpio(e.id);
      addNodo({ id, tipo: 'intermediateCatchEvent', nombre: nombreEvento(e), carril: c, def: definicion(e), evento: e, clave: k });
      mapa[id] = { tipo: 'evento', actividad: k, evento: e.id };
      ids.push(id);
    });
    const tid = idTarea(k);
    addNodo({ id: tid, tipo: tipoTarea(a), clave: k, nombre: (op.numeros ? n + '. ' : '') + a.nombre, carril: c, tarea: true });
    mapa[tid] = { tipo: 'actividad', clave: k };
    ids.push(tid);
    evs.filter(e => e.momento === 'durante' && (e.tipo === 'limite' || e.tipo === 'error')).forEach(e => {
      const id = 'Ev_' + limpio(e.id);
      addNodo({ id, tipo: 'boundaryEvent', nombre: nombreEvento(e), carril: c, def: definicion(e), evento: e, clave: k, adjunto: tid, interrumpe: e.tipo === 'error' ? true : e.interrumpe !== false });
      mapa[id] = { tipo: 'evento', actividad: k, evento: e.id };
    });
    evs.filter(e => e.momento === 'despues').forEach(e => {
      const id = 'Ev_' + limpio(e.id);
      const lanza = e.tipo === 'aviso' || e.tipo === 'hito';
      if (!lanza && ESPERAS.indexOf(e.tipo) < 0) return;
      addNodo({ id, tipo: lanza ? 'intermediateThrowEvent' : 'intermediateCatchEvent', nombre: nombreEvento(e), carril: c, def: definicion(e), evento: e, clave: k });
      mapa[id] = { tipo: 'evento', actividad: k, evento: e.id };
      ids.push(id);
    });
    for (let i = 1; i < ids.length; i++) flujo(ids[i - 1], ids[i]);
    // Mensajes con otras organizaciones.
    evs.forEach(e => {
      if ((e.tipo === 'mensaje' || e.tipo === 'aviso') && e.externo && tieneValor(e.quien) && e.momento !== 'durante') {
        const ex = externo(e.quien); const id = 'Ev_' + limpio(e.id);
        if (e.tipo === 'aviso') mensajes.push({ id: 'Mensaje_' + limpio(id) + '__' + ex.id, desde: id, hacia: ex.id, ext: ex, nombre: tieneValor(e.texto) ? e.texto : '', sale: true });
        else mensajes.push({ id: 'Mensaje_' + ex.id + '__' + limpio(id), desde: ex.id, hacia: id, ext: ex, nombre: tieneValor(e.texto) ? e.texto : '', sale: false });
      }
    });
    if (a.receptorExterno && tieneValor(a.receptor)) { const ex = externo(a.receptor); mensajes.push({ id: 'Mensaje_' + tid + '__' + ex.id, desde: tid, hacia: ex.id, ext: ex, nombre: tieneValor(a.entregable) ? a.entregable : '', sale: true }); }
    cadena[k] = { entrada: ids[0], salida: ids[ids.length - 1], tarea: tid };
    const d = decDe[k];
    if (d) {
      const gid = 'Dec_' + limpio(d.clave);
      addNodo({ id: gid, tipo: GW_TIPO[d.tipo] || 'exclusiveGateway', nombre: d.pregunta || '', carril: c, decision: d });
      mapa[gid] = { tipo: 'decision', clave: d.clave };
      cadena[k].gw = gid;
      // Un camino que termina el proceso lleva su fin justo al lado, no al extremo del diagrama.
      d.salidas.forEach((s, i) => { if (s.destino === '__fin') finLocal[d.clave + '_' + i] = nuevoFin(c, s.condicion || 'Fin', d.clave + '_' + i, true); });
    }
    evs.filter(e => e.momento === 'durante' && (e.tipo === 'limite' || e.tipo === 'error') && e.destino === '__fin').forEach(e => {
      finLocal[e.id] = nuevoFin(c, tieneValor(e.texto) ? e.texto : (e.tipo === 'error' ? 'Termina por error' : 'Termina por plazo'), e.id, true);
    });
  }
  joins.filter(j => !j.antesDe).forEach(j => { const c0 = j.finales[0]; addNodo({ id: j.id, tipo: GW_TIPO[j.tipo], nombre: '', carril: iCarril(c0 || porNum[N]), union: true }); });

  // ---------- flujos entre actividades ----------
  // «siguientes»: qué pasa al terminar cada actividad, para leerlo en el documento igual que en el dibujo.
  const entrada = k => cadena[k] && cadena[k].entrada;
  const siguientes = {};
  flujo('Inicio', entrada(k1));
  for (let n = 1; n <= N; n++) {
    const k = porNum[n], c = cadena[k];
    const d = decDe[k];
    siguientes[k] = d ? { decision: d.clave } : finDeRama[k] ? { union: true, destino: (joins.find(j => j.id === finDeRama[k]) || {}).antesDe || null } : porNum[n + 1] ? { destino: porNum[n + 1] } : { fin: true };
    if (d) {
      const gw = c.gw;
      flujo(c.salida, gw);
      d.salidas.forEach((s, i) => {
        const cond = s.condicion || '';
        const extra = { nombre: cond, condicion: d.tipo !== 'paralela' && !s.porDefecto && cond ? cond : null, salida: { decision: d.clave, indice: i } };
        let f = null;
        if (s.destino === '__fin') f = flujo(gw, finLocal[d.clave + '_' + i].id, extra);
        else if (s.destino && info[s.destino]) f = flujo(gw, entrada(s.destino), extra);
        else if (s.destino) avisos.push({ texto: 'La salida «' + (cond || 'sin condición') + '» de «' + (d.pregunta || 'la decisión') + '» apunta a una actividad eliminada o sin fase: no se dibuja.' });
        else avisos.push({ texto: 'La salida «' + (cond || 'sin condición') + '» de «' + (d.pregunta || 'la decisión') + '» aún no tiene destino: no se dibuja.' });
        if (f) mapa[f.id] = { tipo: 'salida', decision: d.clave, indice: i };
        if (f && s.porDefecto && d.tipo !== 'paralela') nodos[gw].porDefecto = f.id;
      });
      continue;
    }
    if (finDeRama[k]) { flujo(c.salida, finDeRama[k]); continue; }
    const sig = porNum[n + 1];
    if (sig) flujo(c.salida, entrada(sig));
    else flujo(c.salida, nuevoFin(nodos[c.salida].carril, '', 'normal').id);
  }
  joins.forEach(j => { if (j.antesDe) flujo(j.id, entrada(j.antesDe)); else flujo(j.id, nuevoFin(nodos[j.id].carril, '', j.id).id); });
  // Eventos de borde: su salida.
  orden.filter(n => n.tipo === 'boundaryEvent').forEach(n => {
    const e = n.evento, ref = info[n.clave] ? info[n.clave].codigo : '';
    if (e.destino === '__fin') flujo(n.id, finLocal[e.id].id);
    else if (e.destino && info[e.destino]) flujo(n.id, entrada(e.destino));
    else if (e.destino) avisos.push({ texto: ref + ': el evento «' + n.nombre + '» lleva a una actividad eliminada o sin fase.' });
    else avisos.push({ texto: ref + ': falta decir qué pasa después del evento «' + n.nombre + '».' });
  });
  const resultados = (proc.resultados || []).filter(Boolean);
  const sinNombre = fines.filter(e => !e.nombre);
  if (sinNombre.length === 1 && resultados.length) sinNombre[0].nombre = resultados[0];
  sinNombre.forEach(e => { if (!e.nombre) e.nombre = 'Fin'; });
  fines.forEach(e => { mapa[e.id] = { tipo: 'fin' }; });

  // Actividades sin entrada.
  const entradasN = {}; flujos.forEach(f => { entradasN[f.tgt] = (entradasN[f.tgt] || 0) + 1; });
  const marcas = { sugerencia: [], pregunta: [], huerfana: [] };
  seq.forEach(s => {
    const id = idTarea(s.clave), a = act(s.clave), e = entrada(s.clave);
    if (!entradasN[e]) { avisos.push({ texto: s.codigo + ' «' + a.nombre + '» no tiene entrada: ninguna actividad ni decisión lleva a ella.' }); marcas.huerfana.push(id); }
    if (a.estado === 'sugerencia') marcas.sugerencia.push(id);
    if (a.estado === 'pregunta') marcas.pregunta.push(id);
  });
  if (carriles.some(c => c.nombre === 'Sin responsable')) avisos.push({ texto: 'Hay actividades sin responsable confirmado: van al carril «Sin responsable».' });

  // ---------- geometría: carriles ----------
  const datos = [];
  if (op.entregables) seq.forEach(s => {
    const a = act(s.clave);
    if (!tieneValor(a.entregable)) return;
    const id = 'Entregable_' + limpio(s.clave);
    datos.push({ id, obj: 'Dato_' + limpio(s.clave), asoc: 'Asoc_' + limpio(s.clave), tarea: idTarea(s.clave), nombre: String(a.entregable), carril: iCarril(s.clave) });
    mapa[id] = { tipo: 'entregable', clave: s.clave };
  });
  const infDe = i => datos.some(d => d.carril === i) ? G.infDatos : orden.some(n => n.tipo === 'boundaryEvent' && n.carril === i) ? G.infBorde : G.infNada;
  let yAc = G.y0;
  carriles.forEach((c, i) => { c.y = yAc; c.h = G.sup + G.banda + infDe(i); yAc += c.h; });
  const poolY = G.y0, poolH = yAc - G.y0;
  const xContenido = G.x0 + G.etqPool;

  // ---------- geometría: columnas ----------
  const principales = orden.filter(n => n.tipo !== 'boundaryEvent' && (!n.fin || n.local));
  const anchoEtq = n => (esEvento(n.tipo) ? ETQ.evento[0] : esCompuerta(n.tipo) && n.nombre ? ETQ.compuerta[0] : 0);
  const tam = n => (n.tarea ? TAM.tarea : esCompuerta(n.tipo) ? TAM.compuerta : TAM.evento);
  const columnas = [];
  principales.forEach(n => { columnas.push([n]); n.col = columnas.length - 1; });
  const colFin = columnas.length;
  const finesPorCarril = {};
  fines.filter(e => !e.local).forEach(e => { const l = finesPorCarril[e.carril] = finesPorCarril[e.carril] || []; e.col = colFin + l.length; l.push(e); if (!columnas[e.col]) columnas[e.col] = []; columnas[e.col].push(e); });
  let xAc = xContenido + G.pad;
  const colX = [];
  columnas.forEach((ns, c) => {
    const span = Math.max.apply(null, ns.map(n => Math.max(tam(n)[0], anchoEtq(n))));
    colX[c] = { x: xAc, w: span };
    xAc += span + G.gap;
  });
  const cyCarril = i => carriles[i].y + G.sup + G.banda / 2;
  const auto = {};
  orden.forEach(n => {
    if (n.tipo === 'boundaryEvent') return;
    const [w, h] = tam(n);
    const col = colX[n.col];
    n.w = w; n.h = h; n.x = col.x + col.w / 2 - w / 2; n.y = cyCarril(n.carril) - h / 2;
    auto[n.id] = { x: n.x, y: n.y, w: n.w, h: n.h };
  });

  // ---------- ajustes guardados: formas ----------
  const dentroDeCarril = (n) => {
    const c = carriles[n.carril];
    n.y = Math.max(c.y + 4, Math.min(n.y, c.y + c.h - n.h - 4));
    n.x = Math.max(xContenido + 4, n.x);
  };
  orden.forEach(n => {
    const a = ajFormas[n.id];
    if (!a || n.tipo === 'boundaryEvent') return;
    n.x += a.dx || 0; n.y += a.dy || 0;
    if (n.tarea) { n.w = Math.max(80, n.w + (a.dw || 0)); n.h = Math.max(50, n.h + (a.dh || 0)); }
    dentroDeCarril(n);
  });
  // Eventos de borde: sobre el borde inferior de su tarea, a la derecha.
  const porTarea = {};
  orden.filter(n => n.tipo === 'boundaryEvent').forEach(n => {
    const t = nodos[n.adjunto]; const i = porTarea[t.id] = (porTarea[t.id] || 0) + 1;
    n.w = n.h = TAM.evento[0];
    n.x = t.x + t.w - 22 - n.w / 2 - (i - 1) * 42; n.y = t.y + t.h - n.h / 2;
    auto[n.id] = { x: n.x, y: n.y, w: n.w, h: n.h };
    const a = ajFormas[n.id];
    if (a) { n.x = Math.max(t.x - n.w / 2, Math.min(t.x + t.w - n.w / 2, n.x + (a.dx || 0))); }
  });
  datos.forEach(d => {
    const t = nodos[d.tarea];
    d.w = TAM.dato[0]; d.h = TAM.dato[1]; d.x = t.x + 6; d.y = t.y + t.h + 22;
    auto[d.id] = { x: d.x, y: d.y, w: d.w, h: d.h };
    const a = ajFormas[d.id];
    if (a) { d.x += a.dx || 0; d.y += a.dy || 0; const c = carriles[d.carril]; d.y = Math.max(c.y + 4, Math.min(d.y, c.y + c.h - d.h - 4)); }
  });

  // ---------- etiquetas externas ----------
  const etqAuto = {};
  const etiqueta = (id, r) => { etqAuto[id] = r; const a = ajEtq[id]; return a ? { x: r.x + (a.dx || 0), y: r.y + (a.dy || 0), w: r.w, h: r.h } : r; };
  orden.forEach(n => {
    if (!n.nombre || n.tarea) return;
    // Intermedios: etiqueta arriba (abajo salen los flujos de mensaje); inicio y fin: abajo.
    if (esEvento(n.tipo)) n.etq = etiqueta(n.id, n.tipo === 'boundaryEvent'
      ? { x: n.x + n.w + 2, y: n.y + n.h - 6, w: ETQ.evento[0], h: ETQ.evento[1] }
      : /^intermediate/.test(n.tipo)
        ? { x: n.x + n.w / 2 - ETQ.evento[0] / 2, y: n.y - ETQ.evento[1] - 4, w: ETQ.evento[0], h: ETQ.evento[1] }
        : { x: n.x + n.w / 2 - ETQ.evento[0] / 2, y: n.y + n.h + 4, w: ETQ.evento[0], h: ETQ.evento[1] });
    else if (esCompuerta(n.tipo)) n.etq = etiqueta(n.id, { x: n.x + n.w / 2 - ETQ.compuerta[0] / 2, y: n.y - ETQ.compuerta[1] - 4, w: ETQ.compuerta[0], h: ETQ.compuerta[1] });
  });
  datos.forEach(d => { d.etq = etiqueta(d.id, { x: d.x + d.w + 6, y: d.y + 10, w: ETQ.dato[0], h: ETQ.dato[1] }); });

  // ---------- anotaciones del diagrama ----------
  const notas = ajNotas.map(nt => {
    const ancla = nt.ancla && (nodos[nt.ancla] || datos.find(d => d.id === nt.ancla));
    const w = nt.w || 150, h = nt.h || 46;
    const x = ancla ? ancla.x + (nt.rx || 0) : (nt.x || xContenido + 20);
    const y = ancla ? ancla.y + (nt.ry || 0) : (nt.y || poolY + 10);
    mapa[nt.id] = { tipo: 'nota', id: nt.id };
    return { id: nt.id, texto: nt.texto || '', x, y, w, h, ancla: ancla ? nt.ancla : null, asoc: 'AsocNota_' + limpio(nt.id).replace(/^Nota_/, '') };
  });

  // ---------- ancho del pool ----------
  let maxX = xContenido + 200;
  orden.forEach(n => { maxX = Math.max(maxX, n.x + n.w, n.etq ? n.etq.x + n.etq.w : 0); });
  datos.forEach(d => { maxX = Math.max(maxX, d.etq.x + d.etq.w); });
  notas.forEach(nt => { maxX = Math.max(maxX, nt.x + nt.w); });
  const poolW = maxX + G.pad - G.x0;
  // Pools externos: debajo de lo que conectan, tan anchos como hace falta; si dos se traslapan,
  // el segundo baja una fila. Así ningún flujo de mensaje atraviesa otro pool.
  const filas = [];
  externos.forEach(e => {
    const xs = [];
    mensajes.filter(mf => mf.ext === e).forEach(mf => { const n = nodos[mf.sale ? mf.desde : mf.hacia]; if (n) xs.push(n.x + n.w / 2); });
    const x1 = Math.max(G.x0, Math.min.apply(null, xs.length ? xs : [G.x0 + 150]) - 130);
    const x2 = Math.min(G.x0 + poolW, Math.max.apply(null, xs.length ? xs : [G.x0 + 400]) + 130);
    e.w = Math.max(260, x2 - x1); e.x = Math.min(x1, G.x0 + poolW - e.w); e.h = G.extH;
    let f = 0;
    while (filas[f] && filas[f].some(o => e.x < o.x + o.w + 24 && e.x + e.w + 24 > o.x)) f++;
    (filas[f] = filas[f] || []).push(e);
    e.y = poolY + poolH + G.extGap + f * (G.extH + 40);
  });

  // ---------- fases → grupos ----------
  const grupos = [];
  if (op.fases) {
    m.fases.forEach(f => {
      const ks = f.actividades.filter(k => info[k]);
      if (!ks.length) return;
      const ns = orden.filter(n => n.clave && ks.indexOf(n.clave) >= 0 && !n.fin);
      ks.forEach(k => { if (cadena[k].gw) ns.push(nodos[cadena[k].gw]); });
      joins.forEach(j => { if (j.antesDe && ks.indexOf(j.antesDe) >= 0) ns.push(nodos[j.id]); });
      const x1 = Math.min.apply(null, ns.map(n => n.x)) - 16;
      const x2 = Math.max.apply(null, ns.map(n => n.x + n.w)) + 16;
      const id = 'Fase_' + limpio(f.id);
      grupos.push({ id, cv: 'ValorFase_' + limpio(f.id), nombre: f.nombre, x: x1, y: poolY + 6, w: x2 - x1, h: poolH - 12 });
      mapa[id] = { tipo: 'fase', id: f.id };
    });
  }

  // ---------- conectores ----------
  const infl = (r, mg) => ({ x: r.x - mg, y: r.y - mg, w: r.w + 2 * mg, h: r.h + 2 * mg });
  const obstaculos = [];
  orden.forEach(n => {
    obstaculos.push(Object.assign(infl(n, MARGEN), { id: n.id }));
    if (n.etq) obstaculos.push(Object.assign(infl(n.etq, 3), { id: n.id + '_etq' }));
  });
  datos.forEach(d => {
    obstaculos.push(Object.assign(infl(d, 8), { id: d.id }));
    obstaculos.push(Object.assign(infl(d.etq, 3), { id: d.id + '_etq' }));
    const t = nodos[d.tarea], ax = Math.max(t.x + 6, Math.min(t.x + t.w - 6, d.x + d.w / 2));
    obstaculos.push({ x: ax - 7, y: t.y + t.h, w: 14, h: Math.max(0, d.y - t.y - t.h), id: d.asoc });
  });
  notas.forEach(nt => obstaculos.push(Object.assign(infl(nt, 6), { id: nt.id })));
  const canales = { xs: [], ys: [] };
  colX.forEach((c, i) => { if (i) canales.xs.push(c.x - G.gap / 2); });
  carriles.forEach(c => { canales.ys.push(c.y + 14, c.y + c.h - 12); });
  const area = { x1: xContenido + 4, y1: poolY + 4, x2: G.x0 + poolW - 4, y2: poolY + poolH - 4 };
  const ruteador = crearRuteador({ obstaculos, canales, area, margen: MARGEN });
  const rectDe = id => nodos[id];
  const orientacion = f => {
    const a = nodos[f.src], b = nodos[f.tgt];
    if (a.tipo === 'boundaryEvent') return { d: ['S'], h: ['O', 'N', 'S'] };
    if (b.x + b.w / 2 < a.x + a.w / 2) return { d: ['N', 'S', 'E'], h: ['N', 'S', 'O'] };
    return { d: ['E', 'S', 'N'], h: ['O', 'N', 'S'] };
  };
  const puntosDe = {};
  const orden2 = flujos.slice().sort((f1, f2) => {
    const l = f => Math.abs((nodos[f.tgt].col != null ? nodos[f.tgt].col : 99) - (nodos[f.src].col != null ? nodos[f.src].col : 0)) + (nodos[f.tgt].carril !== nodos[f.src].carril ? 0.5 : 0);
    return l(f1) - l(f2);
  });
  const sinRuta = [];
  const ladosUsados = {}, llegadasUsadas = {};
  const ladoDe = (r, p) => (Math.abs(p.x - (r.x + r.w)) < 1 ? 'E' : Math.abs(p.x - r.x) < 1 ? 'O' : Math.abs(p.y - r.y) < 1 ? 'N' : 'S');
  orden2.forEach(f => {
    const a = rectDe(f.src), b = rectDe(f.tgt);
    const guardada = ajRutas[f.id];
    if (guardada && guardada.firma === firma(a) + '|' + firma(b) && Array.isArray(guardada.puntos) && guardada.puntos.length >= 2) {
      puntosDe[f.id] = guardada.puntos.map(p => ({ x: p[0], y: p[1] }));
      ruteador.marcarUsada(puntosDe[f.id]);
      return;
    }
    const o = orientacion(f);
    let lados = o.d, llegadas = o.h;
    if (esCompuerta(a.tipo) && ladosUsados[a.id]) { const libres = o.d.filter(l => ladosUsados[a.id].indexOf(l) < 0); if (libres.length) lados = libres; }
    // Dos flujos que llegan a la misma forma entran por lados distintos cuando se puede.
    if (llegadasUsadas[b.id]) { const libres = o.h.filter(l => llegadasUsadas[b.id].indexOf(l) < 0); if (libres.length) llegadas = libres; }
    const pts = ruteador.ruta({ rect: a, id: a.id, lados }, { rect: b, id: b.id, lados: llegadas });
    if (pts && esCompuerta(a.tipo)) (ladosUsados[a.id] = ladosUsados[a.id] || []).push(ladoDe(a, pts[0]));
    if (pts) (llegadasUsadas[b.id] = llegadasUsadas[b.id] || []).push(ladoDe(b, pts[pts.length - 1]));
    if (pts) puntosDe[f.id] = pts;
    else { sinRuta.push(f.id); puntosDe[f.id] = simplificar([{ x: a.x + a.w, y: a.y + a.h / 2 }, { x: a.x + a.w + 10, y: a.y + a.h / 2 }, { x: a.x + a.w + 10, y: b.y + b.h / 2 }, { x: b.x, y: b.y + b.h / 2 }]); }
  });
  // Flujos de mensaje: bajan hasta el pool externo sin cruzar formas.
  const areaMsj = { x1: G.x0, y1: area.y1, x2: G.x0 + poolW, y2: externos.length ? Math.max.apply(null, externos.map(e => e.y)) : area.y2 };
  mensajes.forEach(mf => {
    const nodoId = mf.sale ? mf.desde : mf.hacia;
    const n = nodos[nodoId];
    const guardada = ajRutas[mf.id];
    if (guardada && guardada.firma === firma(n) + '|' + firma(mf.ext) && Array.isArray(guardada.puntos)) { mf.puntos = guardada.puntos.map(p => ({ x: p[0], y: p[1] })); return; }
    const ruteadorMsj = crearRuteador({ obstaculos: obstaculos.concat(externos.filter(e => e !== mf.ext).map(e => ({ x: e.x - 8, y: e.y - 8, w: e.w + 16, h: e.h + 16, id: e.id }))), canales, area: Object.assign({}, areaMsj, { x1: mf.ext.x + 6, x2: mf.ext.x + mf.ext.w - 6, y2: mf.ext.y }), margen: MARGEN });
    const pts = ruteadorMsj.ruta({ rect: n, id: n.id, lados: n.tarea ? ['S', 'E'] : ['S'] }, { linea: mf.ext.y });
    mf.puntos = pts || [{ x: n.x + n.w / 2, y: n.y + n.h }, { x: n.x + n.w / 2, y: mf.ext.y }];
    if (!mf.sale) mf.puntos = mf.puntos.slice().reverse();
  });
  if (sinRuta.length) avisos.push({ texto: sinRuta.length + (sinRuta.length === 1 ? ' conector no encontró un camino limpio' : ' conectores no encontraron un camino limpio') + ': mueve alguna forma para darle espacio.' });

  // Etiquetas de las salidas de una decisión: junto al primer tramo, sin pisar formas.
  const ocupadas = [];
  orden.forEach(n => { ocupadas.push(n); if (n.etq) ocupadas.push(n.etq); });
  datos.forEach(d => { ocupadas.push(d); ocupadas.push(d.etq); });
  notas.forEach(nt => ocupadas.push(nt));
  const libre = r => !ocupadas.some(o => r.x < o.x + o.w && r.x + r.w > o.x && r.y < o.y + o.h && r.y + r.h > o.y);
  flujos.forEach(f => {
    if (!f.nombre) return;
    const pts = puntosDe[f.id];
    if (!pts || pts.length < 2) return;
    const w = Math.min(130, Math.max(34, Math.round(f.nombre.length * 6.4) + 8)), h = f.nombre.length * 6.4 > 130 ? 30 : 16;
    const a = pts[0], b = pts[1];
    let cand;
    if (a.y === b.y) { const dir = b.x > a.x ? 1 : -1; const x = dir > 0 ? a.x + 6 : a.x - 6 - w; cand = [{ x, y: a.y - h - 3 }, { x, y: a.y + 3 }, { x: dir > 0 ? a.x + 24 : a.x - 24 - w, y: a.y - h - 3 }]; }
    else { const dir = b.y > a.y ? 1 : -1; const y = dir > 0 ? a.y + 8 : a.y - 8 - h; cand = [{ x: a.x + 5, y }, { x: a.x - 5 - w, y }, { x: a.x + 5, y: dir > 0 ? y + 20 : y - 20 }]; }
    let r = null;
    for (const c of cand) { const x = { x: c.x, y: c.y, w, h }; if (libre(x)) { r = x; break; } }
    if (!r) r = { x: cand[0].x, y: cand[0].y, w, h };
    f.etqAuto = r; etqAuto[f.id] = r;
    const aj2 = ajEtq[f.id];
    f.etq = aj2 ? { x: r.x + (aj2.dx || 0), y: r.y + (aj2.dy || 0), w, h } : r;
    ocupadas.push(f.etq);
  });

  // ---------- XML ----------
  const doc = [];
  const P = s => doc.push(s);
  const defXML = (def, id) => {
    if (!def) return '';
    if (def.def === 'timer') return '<bpmn:timerEventDefinition id="' + id + '_def">' + (def.valor ? '<bpmn:' + def.clase + ' xsi:type="bpmn:tFormalExpression">' + esc(def.valor) + '</bpmn:' + def.clase + '>' : '') + '</bpmn:timerEventDefinition>';
    if (def.def === 'message') return '<bpmn:messageEventDefinition id="' + id + '_def"/>';
    if (def.def === 'conditional') return '<bpmn:conditionalEventDefinition id="' + id + '_def"><bpmn:condition xsi:type="bpmn:tFormalExpression">' + esc(def.valor || '') + '</bpmn:condition></bpmn:conditionalEventDefinition>';
    if (def.def === 'error') return '<bpmn:errorEventDefinition id="' + id + '_def"/>';
    return '';
  };
  P('<?xml version="1.0" encoding="UTF-8"?>');
  P('<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:kaze="https://kaze.cota/bpmn/ext" id="Definiciones" targetNamespace="https://kaze.cota/bpmn" exporter="Kaze · Captura de procesos" exporterVersion="0.2">');
  if (grupos.length) { P('  <bpmn:category id="Categoria_fases" name="Fases">'); grupos.forEach(g => P('    <bpmn:categoryValue id="' + g.cv + '" value="' + esc(g.nombre) + '"/>')); P('  </bpmn:category>'); }
  P('  <bpmn:collaboration id="Colaboracion">');
  P('    <bpmn:participant id="Participante" name="' + esc(proc.nombre) + '" processRef="Proceso"/>');
  externos.forEach(e => P('    <bpmn:participant id="' + e.id + '" name="' + esc(e.nombre) + '"/>'));
  mensajes.forEach(mf => P('    <bpmn:messageFlow id="' + mf.id + '" name="' + esc(mf.nombre) + '" sourceRef="' + mf.desde + '" targetRef="' + mf.hacia + '"/>'));
  P('  </bpmn:collaboration>');
  P('  <bpmn:process id="Proceso" name="' + esc(proc.nombre) + '" isExecutable="false">');
  if (tieneValor(proc.objetivo)) P('    <bpmn:documentation>' + esc(proc.objetivo) + '</bpmn:documentation>');
  P('    <bpmn:laneSet id="Carriles">');
  carriles.forEach((c, i) => {
    P('      <bpmn:lane id="' + c.id + '" name="' + esc(c.nombre) + '">');
    orden.filter(n => n.carril === i).forEach(n => P('        <bpmn:flowNodeRef>' + n.id + '</bpmn:flowNodeRef>'));
    P('      </bpmn:lane>');
  });
  P('    </bpmn:laneSet>');
  const salidasDe = id => flujos.filter(f => f.src === id).map(f => f.id);
  const entradasDe = id => flujos.filter(f => f.tgt === id).map(f => f.id);
  const refs = id => entradasDe(id).map(f => '      <bpmn:incoming>' + f + '</bpmn:incoming>').concat(salidasDe(id).map(f => '      <bpmn:outgoing>' + f + '</bpmn:outgoing>'));
  const rotuloDestino = k => k === '__fin' ? 'terminar el proceso' : info[k] ? info[k].codigo + ' ' + act(k).nombre : 'una actividad eliminada';
  orden.forEach(n => {
    let attrs = ' id="' + n.id + '" name="' + esc(n.nombre) + '"' + (n.porDefecto ? ' default="' + n.porDefecto + '"' : '');
    const inner = [];
    if (n.tarea) {
      const a = act(n.clave); const s = info[n.clave];
      attrs += ' kaze:clave="' + esc(n.clave) + '" kaze:ejecucion="' + (a.ejecucion || 'persona') + '"' + ((a.formatos || []).length ? ' kaze:formatos="' + a.formatos.length + '"' : '');
      const docu = [s.codigo];
      if (tieneValor(a.descripcion)) docu.push(a.descripcion);
      const par = (r, v, u) => { if (v != null && v !== '') docu.push(r + ': ' + mostrarTexto(v) + (u && typeof v === 'number' ? ' ' + u : '')); };
      par('Responsable', a.responsable); par('Entradas', a.entradas); par('Entregable', a.entregable); par('Recibe', a.receptor);
      par('Criterio de aceptación', a.criterio); par('Tiempo de proceso', a.tProceso, a.unidad); par('Tiempo de espera', a.tEspera, a.unidad);
      par('Frecuencia', a.frecuencia); par('Herramientas', a.herramientas); par('Documentos', a.documentos); par('Reglas', a.reglas); par('Problemas', a.problemas);
      (a.formatos || []).forEach(f => docu.push('Formato: ' + (f.codigo ? f.codigo + ' ' : '') + f.nombre + (f.version ? ' v' + f.version : '')));
      (a.eventos || []).forEach(e => docu.push('Evento: ' + fraseEvento(e, rotuloDestino)));
      if (a.ciclo && a.ciclo.tipo) docu.push('Ciclo: ' + fraseCiclo(a.ciclo));
      par('Estado', a.estado === 'confirmado' ? 'Confirmado' : a.estado === 'sugerencia' ? 'Sugerencia de IA sin validar' : 'Pregunta abierta');
      inner.push('      <bpmn:documentation>' + esc(docu.join('\n')) + '</bpmn:documentation>');
      refs(n.id).forEach(x => inner.push(x));
      const dt = datos.find(x => x.tarea === n.id);
      if (dt) inner.push('      <bpmn:dataOutputAssociation id="' + dt.asoc + '"><bpmn:targetRef>' + dt.id + '</bpmn:targetRef></bpmn:dataOutputAssociation>');
      if (a.ciclo && a.ciclo.tipo === 'repite') inner.push('      <bpmn:standardLoopCharacteristics id="' + n.id + '_ciclo">' + (tieneValor(a.ciclo.condicion) ? '<bpmn:loopCondition xsi:type="bpmn:tFormalExpression">' + esc(a.ciclo.condicion) + '</bpmn:loopCondition>' : '') + '</bpmn:standardLoopCharacteristics>');
      if (a.ciclo && a.ciclo.tipo === 'porCada') inner.push('      <bpmn:multiInstanceLoopCharacteristics id="' + n.id + '_ciclo" isSequential="' + (a.ciclo.paralelo ? 'false' : 'true') + '">' + (tieneValor(a.ciclo.condicion) ? '<bpmn:documentation>' + esc('Por cada ' + a.ciclo.condicion) + '</bpmn:documentation>' : '') + '</bpmn:multiInstanceLoopCharacteristics>');
    } else {
      if (n.decision && tieneValor(n.decision.decide)) inner.push('      <bpmn:documentation>' + esc('Decide: ' + n.decision.decide) + '</bpmn:documentation>');
      if (n.evento) inner.push('      <bpmn:documentation>' + esc(fraseEvento(n.evento, rotuloDestino)) + '</bpmn:documentation>');
      refs(n.id).forEach(x => inner.push(x));
      if (n.def) inner.push('      ' + defXML(n.def, n.id));
    }
    if (n.tipo === 'boundaryEvent') attrs += ' attachedToRef="' + n.adjunto + '" cancelActivity="' + (n.interrumpe ? 'true' : 'false') + '"';
    P('    <bpmn:' + n.tipo + attrs + (inner.length ? '>' : '/>'));
    if (inner.length) { inner.forEach(P); P('    </bpmn:' + n.tipo + '>'); }
  });
  flujos.forEach(f => {
    const nm = f.nombre ? ' name="' + esc(f.nombre) + '"' : '';
    if (f.condicion) {
      P('    <bpmn:sequenceFlow id="' + f.id + '"' + nm + ' sourceRef="' + f.src + '" targetRef="' + f.tgt + '">');
      P('      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">' + esc(f.condicion) + '</bpmn:conditionExpression>');
      P('    </bpmn:sequenceFlow>');
    } else P('    <bpmn:sequenceFlow id="' + f.id + '"' + nm + ' sourceRef="' + f.src + '" targetRef="' + f.tgt + '"/>');
  });
  datos.forEach(d => { P('    <bpmn:dataObject id="' + d.obj + '"/>'); P('    <bpmn:dataObjectReference id="' + d.id + '" name="' + esc(d.nombre) + '" dataObjectRef="' + d.obj + '"/>'); });
  grupos.forEach(g => P('    <bpmn:group id="' + g.id + '" categoryValueRef="' + g.cv + '"/>'));
  notas.forEach(nt => {
    P('    <bpmn:textAnnotation id="' + nt.id + '"><bpmn:text>' + esc(nt.texto) + '</bpmn:text></bpmn:textAnnotation>');
    if (nt.ancla) P('    <bpmn:association id="' + nt.asoc + '" associationDirection="None" sourceRef="' + nt.id + '" targetRef="' + nt.ancla + '"/>');
  });
  P('  </bpmn:process>');

  // ---------- DI ----------
  const B = r => '<dc:Bounds x="' + Math.round(r.x) + '" y="' + Math.round(r.y) + '" width="' + Math.round(r.w) + '" height="' + Math.round(r.h) + '"/>';
  const lbl = r => '<bpmndi:BPMNLabel>' + B(r) + '</bpmndi:BPMNLabel>';
  const wps = ps => ps.map(p => '<di:waypoint x="' + Math.round(p.x) + '" y="' + Math.round(p.y) + '"/>').join('');
  P('  <bpmndi:BPMNDiagram id="Diagrama">');
  P('    <bpmndi:BPMNPlane id="Plano" bpmnElement="Colaboracion">');
  P('      <bpmndi:BPMNShape id="Participante_di" bpmnElement="Participante" isHorizontal="true">' + B({ x: G.x0, y: poolY, w: poolW, h: poolH }) + '</bpmndi:BPMNShape>');
  carriles.forEach(c => P('      <bpmndi:BPMNShape id="' + c.id + '_di" bpmnElement="' + c.id + '" isHorizontal="true">' + B({ x: xContenido, y: c.y, w: poolW - G.etqPool, h: c.h }) + '</bpmndi:BPMNShape>'));
  grupos.forEach(g => P('      <bpmndi:BPMNShape id="' + g.id + '_di" bpmnElement="' + g.id + '">' + B(g) + lbl({ x: g.x + 8, y: g.y + 4, w: Math.min(g.w - 16, 200), h: 18 }) + '</bpmndi:BPMNShape>'));
  orden.forEach(n => {
    const label = n.etq ? lbl(n.etq) : '';
    P('      <bpmndi:BPMNShape id="' + n.id + '_di" bpmnElement="' + n.id + '"' + (n.tipo === 'exclusiveGateway' ? ' isMarkerVisible="true"' : '') + '>' + B(n) + label + '</bpmndi:BPMNShape>');
  });
  datos.forEach(d => P('      <bpmndi:BPMNShape id="' + d.id + '_di" bpmnElement="' + d.id + '">' + B(d) + lbl(d.etq) + '</bpmndi:BPMNShape>'));
  notas.forEach(nt => P('      <bpmndi:BPMNShape id="' + nt.id + '_di" bpmnElement="' + nt.id + '">' + B(nt) + '</bpmndi:BPMNShape>'));
  externos.forEach(e => P('      <bpmndi:BPMNShape id="' + e.id + '_di" bpmnElement="' + e.id + '" isHorizontal="true">' + B(e) + '</bpmndi:BPMNShape>'));
  flujos.forEach(f => P('      <bpmndi:BPMNEdge id="' + f.id + '_di" bpmnElement="' + f.id + '">' + wps(puntosDe[f.id]) + (f.etq ? lbl(f.etq) : '') + '</bpmndi:BPMNEdge>'));
  mensajes.forEach(mf => {
    const last = mf.puntos[mf.puntos.length - 1], first = mf.puntos[0];
    const ref = mf.sale ? first : last;
    P('      <bpmndi:BPMNEdge id="' + mf.id + '_di" bpmnElement="' + mf.id + '">' + wps(mf.puntos) + (mf.nombre ? lbl({ x: ref.x + 6, y: (mf.sale ? last.y : first.y) - 34, w: 96, h: 28 }) : '') + '</bpmndi:BPMNEdge>');
  });
  datos.forEach(d => {
    const t = nodos[d.tarea];
    const x = Math.max(t.x + 6, Math.min(t.x + t.w - 6, d.x + d.w / 2));
    P('      <bpmndi:BPMNEdge id="' + d.asoc + '_di" bpmnElement="' + d.asoc + '">' + wps([{ x, y: t.y + t.h }, { x, y: d.y }]) + '</bpmndi:BPMNEdge>');
  });
  notas.forEach(nt => {
    if (!nt.ancla) return;
    const a = nodos[nt.ancla] || datos.find(d => d.id === nt.ancla);
    const p1 = { x: nt.x, y: nt.y + nt.h / 2 };
    const p2 = { x: Math.max(a.x, Math.min(a.x + a.w, p1.x)), y: Math.max(a.y, Math.min(a.y + a.h, p1.y)) };
    P('      <bpmndi:BPMNEdge id="' + nt.asoc + '_di" bpmnElement="' + nt.asoc + '">' + wps([p1, p2]) + '</bpmndi:BPMNEdge>');
  });
  P('    </bpmndi:BPMNPlane>');
  P('  </bpmndi:BPMNDiagram>');
  P('</bpmn:definitions>');

  // Geometría para ajustes y pruebas.
  const final = {};
  orden.forEach(n => { final[n.id] = { x: n.x, y: n.y, w: n.w, h: n.h }; });
  datos.forEach(d => { final[d.id] = { x: d.x, y: d.y, w: d.w, h: d.h }; });
  const etqFinal = {};
  orden.forEach(n => { if (n.etq) etqFinal[n.id] = n.etq; });
  datos.forEach(d => { etqFinal[d.id] = d.etq; });
  flujos.forEach(f => { if (f.etq) etqFinal[f.id] = f.etq; });
  const conectores = {};
  flujos.forEach(f => { conectores[f.id] = { puntos: puntosDe[f.id], src: f.src, tgt: f.tgt }; });
  mensajes.forEach(mf => { conectores[mf.id] = { puntos: mf.puntos, src: mf.desde, tgt: mf.hacia, mensaje: true }; });
  const geo = { auto, final, etqAuto, etqFinal, conectores, carriles: carriles.map(c => ({ id: c.id, nombre: c.nombre, y: c.y, h: c.h })), pool: { x: G.x0, y: poolY, w: poolW, h: poolH }, externos: externos.map(e => ({ id: e.id, x: e.x, y: e.y, w: e.w, h: e.h })),
    fases: grupos.map(g => ({ id: g.id, faseId: mapa[g.id] && mapa[g.id].id, nombre: g.nombre, x: g.x, w: g.w })), etqCarril: G.etqPool * 2,
    adjuntos: orden.filter(n => n.tipo === 'boundaryEvent').reduce((o, n) => { o[n.id] = n.adjunto; return o; }, {}),
    tipos: orden.reduce((o, n) => { o[n.id] = tipoBpmn(n.tipo); return o; }, datos.reduce((o, d) => { o[d.id] = 'bpmn:DataObjectReference'; return o; }, {})),
    definiciones: orden.reduce((o, n) => { if (n.def && DEF_BPMN[n.def.def]) o[n.id] = DEF_BPMN[n.def.def]; return o; }, {}),
    porDefecto: orden.reduce((o, n) => { if (n.porDefecto) o[n.id] = n.porDefecto; return o; }, {}) };

  return {
    xml: doc.join('\n'), avisos, marcas, mapa, geo, siguientes, cadena, info: Object.keys(info),
    resumen: { tareas: N, compuertas: Object.keys(decDe).length + joins.length, carriles: carriles.length, fases: grupos.length, externos: externos.length, eventos: orden.filter(n => n.evento).length },
  };
}

export { firma as firmaForma };
