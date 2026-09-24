/* Del lienzo a la captura. Lo que se dibuja con las herramientas de bpmn.io llega a la ficha:
   - una tarea nueva es una actividad, en la fase y el lugar de la secuencia donde se dejó, con el
     carril como responsable y el tipo de tarea como «quién la ejecuta»;
   - una decisión (compuerta) queda en la actividad anterior, con una salida por cada conector;
   - un evento queda en la actividad anterior («al terminar»); si está en el camino de una
     decisión, en la actividad a la que lleva («antes de empezar»); sobre el borde de una tarea,
     es un límite de tiempo o una excepción de esa tarea;
   - un entregable (objeto de datos) va a la actividad que lo produce o que lo recibe;
   - un conector desde una decisión es una salida; desde una tarea hacia otra que no es la
     siguiente, pide una decisión y se crea en esa actividad;
   - cambiar el tipo (llave inglesa) cambia quién la ejecuta, el tipo de decisión o de evento.
   Lo que la captura no puede guardar se explica en un aviso y no se queda en el dibujo.
   fotoLienzo lee el lienzo sin tocar el modelo; sincronizar aplica los cambios a una copia. */
import {
  nuevaActividad, nuevaDecision, nuevoEvento, ponerEnFase, faseDe, eliminarActividad, secuencia, tieneValor, clonar, uid,
} from './model.js';

const TAREA = /^bpmn:(Task|UserTask|ServiceTask|ScriptTask|ManualTask|SendTask|ReceiveTask|BusinessRuleTask|CallActivity|SubProcess)$/;
const esTarea = t => TAREA.test(t);
const esCompuerta = t => /Gateway$/.test(t || '');
const esIntermedio = t => t === 'bpmn:IntermediateCatchEvent' || t === 'bpmn:IntermediateThrowEvent';
const limpio = s => String(s).replace(/[^A-Za-z0-9_]/g, '_');
export const EJECUCION_DE_TIPO = { 'bpmn:ServiceTask': 'sistema', 'bpmn:BusinessRuleTask': 'sistema', 'bpmn:ScriptTask': 'automatizacion' };
const CANONICA = { persona: 'bpmn:UserTask', sistema: 'bpmn:ServiceTask', automatizacion: 'bpmn:ScriptTask' };
const ESPECIALES = ['bpmn:ManualTask', 'bpmn:SendTask', 'bpmn:ReceiveTask', 'bpmn:BusinessRuleTask'];
const TIPO_DECISION = { 'bpmn:ExclusiveGateway': 'exclusiva', 'bpmn:InclusiveGateway': 'inclusiva', 'bpmn:ParallelGateway': 'paralela' };
const TIPO_INICIO = { 'bpmn:MessageEventDefinition': 'mensaje', 'bpmn:TimerEventDefinition': 'tiempo', 'bpmn:ConditionalEventDefinition': 'condicion' };

/* ---------- lectura del lienzo ---------- */

export function fotoLienzo(modeler, reemplazos) {
  const reg = modeler.get('elementRegistry');
  const rz = reemplazos || {};
  const orig = id => { let x = id, n = 0; while (rz[x] && n++ < 30) x = rz[x]; return x; };
  const caja = e => ({ id: e.id, orig: orig(e.id), x: e.x, y: e.y, w: e.width, h: e.height });
  const lanes = reg.filter(e => e.type === 'bpmn:Lane').map(caja);
  const grupos = reg.filter(e => e.type === 'bpmn:Group').map(caja);
  const formas = reg.filter(e => !e.waypoints && e.type !== 'label' && e.parent && !/^bpmn:(Lane|Participant|Group|Collaboration|Process)$/.test(e.type)).map(e => {
    const bo = e.businessObject || {};
    const lc = bo.loopCharacteristics;
    const def = (bo.eventDefinitions || [])[0];
    return Object.assign(caja(e), {
      tipo: e.type, nombre: String(bo.name || ''), host: e.host ? orig(e.host.id) : null,
      def: def ? def.$type : null, cancel: bo.cancelActivity !== false,
      ciclo: lc ? (lc.$type === 'bpmn:StandardLoopCharacteristics' ? 'repite' : lc.isSequential ? 'porCadaSec' : 'porCada') : null,
      clave: (bo.$attrs || {})['kaze:clave'] || null, porDefecto: bo.default ? bo.default.id : null,
    });
  });
  const conexiones = reg.filter(e => e.waypoints).map(e => ({
    id: e.id, tipo: e.type, src: e.source ? orig(e.source.id) : null, tgt: e.target ? orig(e.target.id) : null,
    nombre: String((e.businessObject && e.businessObject.name) || ''),
  }));
  return { formas, conexiones, lanes, grupos };
}

export function tipoEvento(f) {
  if (f.tipo === 'bpmn:BoundaryEvent') return f.def === 'bpmn:ErrorEventDefinition' ? 'error' : 'limite';
  if (f.def === 'bpmn:TimerEventDefinition') return 'tiempo';
  if (f.def === 'bpmn:MessageEventDefinition') return f.tipo === 'bpmn:IntermediateThrowEvent' ? 'aviso' : 'mensaje';
  if (f.def === 'bpmn:ConditionalEventDefinition') return 'condicion';
  return 'hito';
}
const cicloDe = a => (!a.ciclo || !a.ciclo.tipo ? null : a.ciclo.tipo === 'repite' ? 'repite' : a.ciclo.paralelo ? 'porCada' : 'porCadaSec');

/* ---------- aplicar al modelo ---------- */

/* p, m: copia del proceso y de la versión (dentro de «cambiar»). gen: el diagrama que se importó.
   Devuelve { hechos, mensajes, enfocar, nuevos } — hechos vacío = nada estructural cambió. */
export function sincronizar(p, m, gen, foto) {
  const mapa = gen.mapa || {};
  const geo = gen.geo || {};
  const final = geo.final || {};
  const con0 = geo.conectores || {};
  const adj0 = geo.adjuntos || {};
  const tipos0 = geo.tipos || {};
  const def0 = geo.porDefecto || {};
  const hechos = [], mensajes = [];
  const nuevos = {};           // id del lienzo → id que tendrá en el diagrama regenerado
  let enfocar = null;
  const F = {}; foto.formas.forEach(f => { F[f.orig] = f; });
  const flujos = foto.conexiones.filter(c => c.tipo === 'bpmn:SequenceFlow');
  const entradas = id => flujos.filter(c => c.tgt === id);
  const salidas = id => flujos.filter(c => c.src === id);
  const centro = f => ({ x: f.x + f.w / 2, y: f.y + f.h / 2 });
  const esNueva = f => !final[f.orig] && !mapa[f.orig];
  const aviso = t => { if (mensajes.indexOf(t) < 0) mensajes.push(t); };

  const seqAhora = () => secuencia(m).filter(s => s.numero != null);
  const codigo = k => { const s = seqAhora().find(x => x.clave === k); return s ? s.codigo : '«' + ((m.actividades[k] || {}).nombre || 'actividad') + '»'; };
  const siguienteDe = k => { const sq = seqAhora(); const i = sq.findIndex(s => s.clave === k); return i >= 0 && i < sq.length - 1 ? sq[i + 1].clave : '__fin'; };
  const anteriorEnSecuencia = k => { const sq = seqAhora(); const i = sq.findIndex(s => s.clave === k); return i > 0 ? sq[i - 1].clave : null; };
  const decisionPorClave = k => m.decisiones.find(d => d.clave === k);
  const eventoPorRef = r => { const a = r && m.actividades[r.actividad]; return a ? (a.eventos || []).find(e => e.id === r.evento) : null; };

  const claveNueva = {};        // tarea nueva del lienzo → clave
  const decisionNueva = {};     // compuerta nueva → decisión
  const eventoNuevo = {};       // evento nuevo → { clave, evento }

  /* Actividad a la que pertenece una forma (generada o nueva). */
  const dueno = id => {
    const r = mapa[id];
    if (r) {
      if (r.tipo === 'actividad') return m.actividades[r.clave] ? r.clave : null;
      if (r.tipo === 'evento') return m.actividades[r.actividad] ? r.actividad : null;
      if (r.tipo === 'decision') { const d = decisionPorClave(r.clave); return d && d.origen && m.actividades[d.origen] ? d.origen : null; }
      if (r.tipo === 'entregable') return r.clave;
      if (r.tipo === 'inicio') return '__inicio';
      if (r.tipo === 'fin') return '__fin';
    }
    if (claveNueva[id]) return claveNueva[id];
    if (eventoNuevo[id]) return eventoNuevo[id].clave;
    if (decisionNueva[id]) return decisionNueva[id].origen || null;
    return null;
  };
  /* A qué actividad lleva un conector que termina en esta forma. */
  const destinoDe = (id, vistos) => {
    const f = F[id];
    if (!f) return null;
    if (f.tipo === 'bpmn:EndEvent') return '__fin';
    if (esTarea(f.tipo)) return claveNueva[id] || (mapa[id] && mapa[id].tipo === 'actividad' ? mapa[id].clave : null);
    if (esIntermedio(f.tipo)) {
      const v = vistos || new Set();
      if (v.has(id)) return null;
      v.add(id);
      const s = salidas(id)[0];
      if (s) return destinoDe(s.tgt, v);
      return dueno(id);
    }
    return null;
  };
  /* La actividad cuyo centro queda justo a la izquierda de x (la «anterior» por posición). */
  const tareasLienzo = () => foto.formas.filter(f => esTarea(f.tipo) && (claveNueva[f.orig] || (mapa[f.orig] && mapa[f.orig].tipo === 'actividad' && m.actividades[mapa[f.orig].clave])));
  const anteriorPorPosicion = (x, excluir) => {
    let mejor = null;
    tareasLienzo().forEach(t => {
      if (t.orig === excluir) return;
      const c = centro(t);
      if (c.x < x && (!mejor || c.x > mejor.x)) mejor = { x: c.x, clave: claveNueva[t.orig] || mapa[t.orig].clave };
    });
    return mejor ? mejor.clave : null;
  };
  const faseEn = c => {
    const g = foto.grupos.find(x => c.x >= x.x && c.x <= x.x + x.w && c.y >= x.y && c.y <= x.y + x.h);
    const r = g && mapa[g.orig];
    return r && r.tipo === 'fase' && m.fases.some(f => f.id === r.id) ? r.id : null;
  };
  const rolEn = c => {
    const l = foto.lanes.find(x => c.y >= x.y && c.y < x.y + x.h);
    const r = l && mapa[l.orig];
    return r && r.tipo === 'carril' ? r.rol : null;
  };
  const numeroDe = k => { const s = seqAhora().find(x => x.clave === k); return s ? s.numero : Infinity; };

  /* ===== 1. Lo que se borró ===== */
  Object.keys(final).forEach(id => {
    if (F[id]) return;
    const r = mapa[id];
    if (!r) return;
    if (r.tipo === 'actividad' && m.actividades[r.clave]) { hechos.push('Eliminó «' + m.actividades[r.clave].nombre + '»'); eliminarActividad(m, r.clave); }
    else if (r.tipo === 'decision') { const i = m.decisiones.findIndex(d => d.clave === r.clave); if (i >= 0) { m.decisiones.splice(i, 1); hechos.push('Eliminó una decisión'); } }
    else if (r.tipo === 'evento') { const a = m.actividades[r.actividad]; if (a && (a.eventos || []).some(e => e.id === r.evento)) { a.eventos = a.eventos.filter(e => e.id !== r.evento); hechos.push('Eliminó un evento de ' + codigo(r.actividad)); } }
    else if (r.tipo === 'entregable') { const a = m.actividades[r.clave]; if (a && a.entregable != null) { a.entregable = null; hechos.push('Quitó el entregable de ' + codigo(r.clave)); } }
    else if (r.tipo === 'inicio') aviso('El inicio del proceso no se borra: cambia su tipo con la llave inglesa.');
  });

  const nuevas = foto.formas.filter(f => esNueva(f) && f.tipo !== 'bpmn:TextAnnotation');

  /* ===== 2a. Actividades nuevas ===== */
  nuevas.filter(f => esTarea(f.tipo)).sort((a, b) => a.x - b.x).forEach(f => {
    const c = centro(f);
    const base = f.clave && m.actividades[f.clave] ? clonar(m.actividades[f.clave]) : null;   // copiada y pegada
    const extra = base ? Object.assign({}, base, {
      clave: undefined, origenClave: null, estado: base.estado === 'sugerencia' ? 'sugerencia' : 'confirmado',
      eventos: (base.eventos || []).map(e => Object.assign({}, e, { id: uid('e') })),
      formatos: (base.formatos || []).map(x => Object.assign({}, x, { id: uid('fm') })),
    }) : {};
    delete extra.clave;
    const nombre = f.nombre.trim() || (base ? base.nombre : 'Nueva actividad');
    const a = nuevaActividad(nombre, extra);
    const rol = rolEn(c);
    a.responsable = rol && rol !== 'Sin responsable' ? rol : base ? base.responsable : null;
    a.ejecucion = EJECUCION_DE_TIPO[f.tipo] || 'persona';
    a.tareaBpmn = ESPECIALES.indexOf(f.tipo) >= 0 && CANONICA[a.ejecucion] !== f.tipo ? f.tipo : null;
    if (f.tipo === 'bpmn:CallActivity' || f.tipo === 'bpmn:SubProcess') { a.tareaBpmn = null; aviso('Los subprocesos se guardan como una actividad: describe el detalle en su ficha.'); }
    if (f.ciclo) a.ciclo = f.ciclo === 'repite' ? { tipo: 'repite', condicion: null, paralelo: false } : { tipo: 'porCada', condicion: null, paralelo: f.ciclo === 'porCada' };
    m.actividades[a.clave] = a;
    claveNueva[f.orig] = a.clave;
    nuevos[f.id] = 'Act_' + limpio(a.clave);
    // Dónde va en la secuencia: después de lo que la conecta, antes de lo que conecta, o por posición.
    const ent = entradas(f.orig).map(x => dueno(x.src)).find(Boolean);
    const sal = salidas(f.orig).map(x => destinoDe(x.tgt)).find(k => k && k !== '__fin' && k !== a.clave);
    let fase = null, indice = null;
    if (ent === '__inicio' && m.fases.length) { fase = m.fases[0].id; indice = 0; }
    else if (ent && m.actividades[ent] && faseDe(m, ent)) { const fz = faseDe(m, ent); fase = fz.id; indice = fz.actividades.indexOf(ent) + 1; }
    else if (sal && faseDe(m, sal)) { const fz = faseDe(m, sal); fase = fz.id; indice = fz.actividades.indexOf(sal); }
    if (fase == null) {
      const prev = anteriorPorPosicion(c.x, f.orig);
      const enGrupo = faseEn(c);
      if (enGrupo) {
        const fz = m.fases.find(x => x.id === enGrupo);
        const i = prev ? fz.actividades.indexOf(prev) : -1;
        fase = enGrupo;
        if (i >= 0) indice = i + 1;
        else if (!prev || !fz.actividades.length || numeroDe(prev) < numeroDe(fz.actividades[0])) indice = 0;
        else indice = fz.actividades.length;
      } else if (prev && faseDe(m, prev)) { const fz = faseDe(m, prev); fase = fz.id; indice = fz.actividades.indexOf(prev) + 1; }
      else if (m.fases.length) { fase = m.fases[0].id; indice = 0; }
    }
    ponerEnFase(m, a.clave, fase || '__sin', indice);
    hechos.push('Agregó «' + a.nombre + '»' + (base ? ' (copia)' : ''));
    enfocar = nuevos[f.id];
  });

  /* ===== 2b. Decisiones nuevas: en la actividad anterior ===== */
  nuevas.filter(f => esCompuerta(f.tipo)).forEach(f => {
    const ent = entradas(f.orig)[0];
    let origen = ent ? dueno(ent.src) : null;
    if (origen === '__inicio' || origen === '__fin') origen = null;
    if (!origen) origen = anteriorPorPosicion(centro(f).x);
    const tipo = TIPO_DECISION[f.tipo] || 'exclusiva';
    if (!TIPO_DECISION[f.tipo]) aviso('Kaze usa decisiones exclusivas, inclusivas y paralelas: esta quedó como exclusiva.');
    const fz = origen ? faseDe(m, origen) : null;
    const d = nuevaDecision({ origen: origen || null, pregunta: f.nombre.trim(), tipo, salidas: [], contexto: { faseOrigen: fz ? fz.id : null } });
    salidas(f.orig).forEach(c => {
      const dst = destinoDe(c.tgt);
      if (!dst) { if (F[c.tgt] && esCompuerta(F[c.tgt].tipo)) aviso('Una salida no puede llevar a otra decisión: llévala a una actividad o a un fin.'); return; }
      if (!d.salidas.some(s => s.destino === dst)) d.salidas.push({ condicion: c.nombre.trim(), destino: dst, porDefecto: f.porDefecto === c.id, clase: null });
    });
    if (!d.salidas.length && origen) d.salidas.push({ condicion: '', destino: siguienteDe(origen), porDefecto: true, clase: null });
    m.decisiones.push(d);
    decisionNueva[f.orig] = d;
    nuevos[f.id] = 'Dec_' + limpio(d.clave);
    hechos.push('Agregó una decisión' + (origen ? ' en ' + codigo(origen) : ''));
    if (!origen) aviso('La decisión quedó sin actividad de origen: conéctala desde una actividad.');
    else if (d.salidas.length < 2) aviso('Decisión agregada en ' + codigo(origen) + ': conéctala con los caminos que puede tomar y escribe la pregunta.');
    enfocar = nuevos[f.id];
  });

  /* ===== 2c. Eventos nuevos: en la actividad anterior ===== */
  nuevas.filter(f => esIntermedio(f.tipo)).forEach(f => {
    const tipo = tipoEvento(f);
    const ent = entradas(f.orig)[0], sal = salidas(f.orig)[0];
    const src = ent ? F[ent.src] : null;
    let clave = null, momento = 'despues';
    if (src && esTarea(src.tipo)) clave = dueno(ent.src);
    else if (src && esIntermedio(src.tipo)) {
      const r = mapa[ent.src];
      if (r && r.tipo === 'evento') { const e = eventoPorRef(r); clave = r.actividad; momento = e ? e.momento : 'despues'; }
      else if (eventoNuevo[ent.src]) { clave = eventoNuevo[ent.src].clave; momento = eventoNuevo[ent.src].evento.momento; }
    } else if (src && esCompuerta(src.tipo)) {
      const t = sal ? destinoDe(sal.tgt) : null;
      if (t && t !== '__fin') { clave = t; momento = 'antes'; }
      else clave = dueno(ent.src);
    } else if (src && src.tipo === 'bpmn:StartEvent') { const sq = seqAhora(); clave = sq.length ? sq[0].clave : null; momento = 'antes'; }
    else if (sal) { const t = destinoDe(sal.tgt); if (t && t !== '__fin') { clave = t; momento = 'antes'; } }
    if (!clave || clave === '__inicio' || clave === '__fin') { clave = anteriorPorPosicion(centro(f).x); momento = 'despues'; }
    if (!clave) { aviso('Ese evento no quedó después de ninguna actividad: se quitó.'); return; }
    if (momento === 'antes' && (tipo === 'aviso' || tipo === 'hito')) { const prev = anteriorEnSecuencia(clave); if (prev) clave = prev; momento = 'despues'; }
    const e = nuevoEvento(tipo, momento);
    e.texto = f.nombre.trim() || null;
    const a = m.actividades[clave];
    a.eventos = (a.eventos || []).concat([e]);
    eventoNuevo[f.orig] = { clave, evento: e };
    nuevos[f.id] = 'Ev_' + limpio(e.id);
    hechos.push('Agregó un evento en ' + codigo(clave));
    if (momento === 'antes') aviso('El evento quedó en ' + codigo(clave) + ', «antes de empezar», porque está en el camino que lleva a ella.');
    if (f.def && ['bpmn:TimerEventDefinition', 'bpmn:MessageEventDefinition', 'bpmn:ConditionalEventDefinition'].indexOf(f.def) < 0) aviso('Ese tipo de evento se guarda como hito.');
    enfocar = nuevos[f.id];
  });

  /* ===== 2d. Eventos sobre el borde: límite de tiempo o excepción de su tarea ===== */
  nuevas.filter(f => f.tipo === 'bpmn:BoundaryEvent').forEach(f => {
    const clave = f.host ? dueno(f.host) : null;
    if (!clave || !m.actividades[clave]) { aviso('Un evento de borde va sobre el borde de una actividad.'); return; }
    const e = nuevoEvento(tipoEvento(f), 'durante');
    e.texto = f.nombre.trim() || null;
    e.interrumpe = e.tipo === 'error' ? true : f.cancel;
    const s = salidas(f.orig)[0];
    if (s) e.destino = destinoDe(s.tgt);
    const a = m.actividades[clave];
    a.eventos = (a.eventos || []).concat([e]);
    eventoNuevo[f.orig] = { clave, evento: e };
    nuevos[f.id] = 'Ev_' + limpio(e.id);
    hechos.push('Agregó un ' + (e.tipo === 'error' ? 'error' : 'límite de tiempo') + ' en ' + codigo(clave));
    if (f.def && f.def !== 'bpmn:TimerEventDefinition' && f.def !== 'bpmn:ErrorEventDefinition') aviso('Sobre el borde de una actividad Kaze guarda límites de tiempo y errores: este quedó como ' + (e.tipo === 'error' ? 'error.' : 'límite de tiempo.'));
    if (!e.destino) aviso('Conecta el evento con la actividad a la que pasa el proceso, o con un fin.');
    enfocar = nuevos[f.id];
  });

  /* ===== 2e. Entregables (objetos de datos) nuevos ===== */
  nuevas.filter(f => f.tipo === 'bpmn:DataObjectReference').forEach(f => {
    const nombre = f.nombre.trim() || 'Entregable';
    const inp = foto.conexiones.find(c => c.tipo === 'bpmn:DataInputAssociation' && c.src === f.orig);
    const out = foto.conexiones.find(c => c.tipo === 'bpmn:DataOutputAssociation' && c.tgt === f.orig);
    const suma = (v, x) => (tieneValor(v) && String(v).indexOf(x) < 0 ? v + ', ' + x : tieneValor(v) ? v : x);
    if (inp) {
      const k = dueno(inp.tgt);
      if (k && m.actividades[k]) { m.actividades[k].entradas = suma(m.actividades[k].entradas, nombre); hechos.push('Agregó «' + nombre + '» a las entradas de ' + codigo(k)); aviso('Las entradas se ven en la ficha; en el diagrama se dibuja el entregable de cada actividad.'); return; }
    }
    const k = out ? dueno(out.src) : anteriorPorPosicion(centro(f).x);
    if (!k || !m.actividades[k]) { aviso('Ese entregable no quedó junto a ninguna actividad: se quitó.'); return; }
    m.actividades[k].entregable = suma(m.actividades[k].entregable, nombre);
    nuevos[f.id] = 'Entregable_' + limpio(k);
    hechos.push('Agregó el entregable «' + nombre + '» a ' + codigo(k));
  });

  /* ===== 2f. Inicios y fines sueltos ===== */
  nuevas.filter(f => f.tipo === 'bpmn:StartEvent').forEach(() => aviso('El proceso tiene un solo inicio.'));
  nuevas.filter(f => f.tipo === 'bpmn:EndEvent' && !entradas(f.orig).length).forEach(() => aviso('Un fin nuevo se conecta desde una decisión o un evento; suelto no se guarda.'));

  /* ===== 3. Conectores ===== */
  const quitar = [];   // salidas a quitar: { d, i }
  Object.keys(con0).forEach(id => {
    const g = con0[id];
    if (g.mensaje) return;
    const c = flujos.find(x => x.id === id);
    if (c && c.src === g.src && c.tgt === g.tgt) return;
    if (!F[g.src] || !F[g.tgt]) return;               // se fue con su forma
    const r = mapa[id];
    if (r && r.tipo === 'salida') { const d = decisionPorClave(r.decision); if (d && d.salidas[r.indice]) quitar.push({ d, i: r.indice }); return; }
    const rs = mapa[g.src];
    if (rs && rs.tipo === 'evento' && adj0[g.src]) { const e = eventoPorRef(rs); if (e && e.destino) { e.destino = null; hechos.push('Desconectó un evento de ' + codigo(rs.actividad)); } return; }
    if (!nuevas.length) aviso('El orden de las actividades se cambia en el tablero o moviendo la tarjeta: esa conexión vuelve a aparecer.');
  });
  // Quitar salidas en orden descendente para no mover índices.
  quitar.sort((a, b) => b.i - a.i).forEach(({ d, i }) => { d.salidas.splice(i, 1); hechos.push('Quitó una salida de la decisión'); });

  flujos.forEach(c => {
    const g = con0[c.id];
    if (g && g.src === c.src && g.tgt === c.tgt) return;
    const S = F[c.src], T = F[c.tgt];
    if (!S || !T) return;
    // Los conectores de lo recién creado ya se leyeron al crearlo.
    if (claveNueva[c.src] || claveNueva[c.tgt] || decisionNueva[c.src] || eventoNuevo[c.src] || eventoNuevo[c.tgt]) {
      if (decisionNueva[c.tgt] && !decisionNueva[c.src]) { /* entrada a una decisión nueva: ya definió su origen */ }
      return;
    }
    if (esCompuerta(S.tipo)) {
      const r = mapa[c.src];
      const d = r && r.tipo === 'decision' ? decisionPorClave(r.clave) : null;
      if (!d) return;
      const dst = destinoDe(c.tgt);
      if (!dst) { if (esCompuerta(T.tipo)) aviso('Una salida no puede llevar a otra decisión: llévala a una actividad o a un fin.'); return; }
      if (!d.salidas.some(s => s.destino === dst)) { d.salidas.push({ condicion: c.nombre.trim(), destino: dst, porDefecto: false, clase: null }); hechos.push('Agregó una salida a la decisión'); }
      return;
    }
    if (S.tipo === 'bpmn:BoundaryEvent') {
      const e = eventoPorRef(mapa[c.src]);
      const dst = destinoDe(c.tgt);
      if (e && dst && e.destino !== dst) { e.destino = dst; hechos.push('Conectó un evento de ' + codigo(mapa[c.src].actividad)); }
      return;
    }
    if (esCompuerta(T.tipo)) {
      const r = mapa[c.tgt];
      const d = r && r.tipo === 'decision' ? decisionPorClave(r.clave) : null;
      const k = dueno(c.src);
      if (d && k && k !== '__inicio' && k !== '__fin' && d.origen !== k) { d.origen = k; const fz = faseDe(m, k); d.contexto = { faseOrigen: fz ? fz.id : null }; hechos.push('La decisión pasó a ' + codigo(k)); }
      return;
    }
    if (S.tipo === 'bpmn:StartEvent') { aviso('El inicio siempre lleva a la primera actividad del tablero.'); return; }
    if (esTarea(S.tipo) || esIntermedio(S.tipo)) {
      const k = dueno(c.src), dst = destinoDe(c.tgt);
      if (!k || k === '__inicio' || k === '__fin' || !dst) return;
      if (esIntermedio(T.tipo) && mapa[c.tgt]) { aviso('Los eventos de una actividad se agregan en su ficha o soltándolos después de ella.'); return; }
      if (dst === siguienteDe(k)) return;
      let d = m.decisiones.find(x => x.origen === k && x.estado !== 'sugerencia');
      if (d) {
        if (!d.salidas.some(s => s.destino === dst)) { d.salidas.push({ condicion: c.nombre.trim(), destino: dst, porDefecto: false, clase: null }); hechos.push('Agregó una salida a la decisión de ' + codigo(k)); }
      } else {
        const fz = faseDe(m, k);
        d = nuevaDecision({ origen: k, pregunta: '', salidas: [
          { condicion: '', destino: siguienteDe(k), porDefecto: true, clase: null },
          { condicion: c.nombre.trim(), destino: dst, porDefecto: false, clase: null },
        ], contexto: { faseOrigen: fz ? fz.id : null } });
        m.decisiones.push(d);
        hechos.push('Creó una decisión en ' + codigo(k));
        aviso('Una actividad con dos caminos necesita una decisión: se creó en ' + codigo(k) + '. Escribe la pregunta y cuándo se toma cada camino.');
        enfocar = 'Dec_' + limpio(d.clave);
      }
    }
  });

  /* ===== 4. Tipos cambiados (llave inglesa), ciclos y camino por defecto ===== */
  foto.formas.forEach(f => {
    const r = mapa[f.orig];
    if (!r) return;
    const t0 = tipos0[f.orig];
    if (r.tipo === 'actividad') {
      const a = m.actividades[r.clave];
      if (!a) return;
      if (t0 && f.tipo !== t0) {
        const ej = EJECUCION_DE_TIPO[f.tipo] || 'persona';
        a.ejecucion = ej;
        a.tareaBpmn = ESPECIALES.indexOf(f.tipo) >= 0 && CANONICA[ej] !== f.tipo ? f.tipo : null;
        hechos.push('Cambió el tipo de ' + codigo(r.clave));
      }
      if (f.ciclo !== cicloDe(a)) {
        const cond = a.ciclo && a.ciclo.condicion ? a.ciclo.condicion : null;
        a.ciclo = !f.ciclo ? null : f.ciclo === 'repite' ? { tipo: 'repite', condicion: cond, paralelo: false } : { tipo: 'porCada', condicion: cond, paralelo: f.ciclo === 'porCada' };
        hechos.push('Cambió el ciclo de ' + codigo(r.clave));
      }
    } else if (r.tipo === 'decision') {
      const d = decisionPorClave(r.clave);
      if (!d) return;
      const t = TIPO_DECISION[f.tipo];
      if (t && d.tipo !== t) { d.tipo = t; hechos.push('Cambió el tipo de una decisión'); }
      if (!t && t0 && f.tipo !== t0) aviso('Kaze usa decisiones exclusivas, inclusivas y paralelas.');
      // Camino por defecto elegido en el lienzo.
      if ((f.porDefecto || null) !== (def0[f.orig] || null) && d.tipo !== 'paralela') {
        const rs = f.porDefecto ? mapa[f.porDefecto] : null;
        if (rs && rs.tipo === 'salida' && rs.decision === d.clave) { d.salidas.forEach((s, i) => { s.porDefecto = i === rs.indice; }); hechos.push('Cambió el camino por defecto'); }
        else if (!f.porDefecto) { d.salidas.forEach(s => { s.porDefecto = false; }); hechos.push('Quitó el camino por defecto'); }
      }
    } else if (r.tipo === 'evento') {
      const e = eventoPorRef(r);
      if (!e) return;
      if (t0 && (f.tipo !== t0 || (f.def || null) !== ((geo.definiciones || {})[f.orig] || null))) {
        let nt = tipoEvento(f);
        if (nt === 'tiempo' && e.tipo === 'fecha') nt = 'fecha';
        if (e.momento === 'antes' && (nt === 'aviso' || nt === 'hito')) { aviso('Antes de empezar solo se espera: un aviso o un hito van al terminar la actividad anterior.'); nt = e.tipo; }
        if (nt !== e.tipo) { e.tipo = nt; hechos.push('Cambió el tipo de un evento de ' + codigo(r.actividad)); }
      }
      if (f.tipo === 'bpmn:BoundaryEvent') {
        if (e.tipo === 'limite' && e.interrumpe !== f.cancel) { e.interrumpe = f.cancel; hechos.push('Cambió el límite de tiempo de ' + codigo(r.actividad)); }
        // Movido al borde de otra actividad.
        const host = f.host ? dueno(f.host) : null;
        if (host && host !== r.actividad && m.actividades[host]) {
          const a0 = m.actividades[r.actividad];
          a0.eventos = a0.eventos.filter(x => x.id !== e.id);
          m.actividades[host].eventos = (m.actividades[host].eventos || []).concat([e]);
          hechos.push('Pasó un evento de ' + codigo(r.actividad) + ' a ' + codigo(host));
        }
      }
    } else if (r.tipo === 'inicio') {
      const t = f.def ? TIPO_INICIO[f.def] : 'ninguno';
      const act = (p.inicio && p.inicio.tipo) || 'ninguno';
      if (t && t !== act) { p.inicio = Object.assign({ detalle: null }, p.inicio || {}, { tipo: t }); hechos.push('Cambió cómo inicia el proceso'); }
      if (!t) aviso('Ese tipo de inicio no se guarda: el proceso inicia por mensaje, programado o por una condición.');
    } else if (r.tipo === 'fin' && f.def) aviso('El tipo del fin no se guarda en la captura.');
  });

  return { hechos, mensajes, enfocar, nuevos };
}
