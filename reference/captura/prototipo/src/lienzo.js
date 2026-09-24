/* El lienzo BPMN (bpmn-js Modeler) con las herramientas de bpmn.io y las reglas de Kaze:
   - paleta, menú contextual, cambio de tipo (llave inglesa), conectar, copiar y pegar, alinear
     y atajos de teclado, en español;
   - lo que se dibuja llega a la ficha (sincronizar.js): una tarea es una actividad; una decisión
     o un evento quedan en la actividad anterior; solo se ofrece lo que la captura puede guardar;
   - íconos arriba a la derecha de cada tarea: persona, engranaje (sistema), robot (IA o
     automatización) y una hoja si tiene formatos — misma geometría que el sistema de diseño;
   - solo lectura para versiones en revisión o aprobadas. */
import { firmaForma } from './bpmn.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const TAREAS = /^bpmn:(Task|UserTask|ServiceTask|ScriptTask|ManualTask|SendTask|ReceiveTask|BusinessRuleTask)$/;
const EJECUTOR_POR_TIPO = { 'bpmn:UserTask': 'persona', 'bpmn:ServiceTask': 'sistema', 'bpmn:BusinessRuleTask': 'sistema', 'bpmn:ScriptTask': 'automatizacion' };
export const EDITABLES = ['actividad', 'decision', 'salida', 'evento', 'inicio', 'carril', 'fase', 'entregable', 'nota', 'proceso'];
/* Lo que la captura sabe guardar. */
const CREABLES = /^bpmn:(Task|UserTask|ServiceTask|ScriptTask|ManualTask|SendTask|ReceiveTask|BusinessRuleTask|ExclusiveGateway|InclusiveGateway|ParallelGateway|IntermediateCatchEvent|IntermediateThrowEvent|BoundaryEvent|EndEvent|DataObjectReference|TextAnnotation|SequenceFlow|Association|DataInputAssociation|DataOutputAssociation)$/;

function icono(parent, nombre, x, y, lado, color) {
  const prims = (window.Kaze && window.Kaze.ICONOS_BPMN || {})[nombre];
  if (!prims) return;
  const g = document.createElementNS(SVGNS, 'g');
  g.setAttribute('transform', 'translate(' + x + ' ' + y + ') scale(' + (lado / 16) + ')');
  g.setAttribute('class', 'kz-lienzo-icono kz-lienzo-icono--' + nombre);
  prims.forEach(p => {
    const el = document.createElementNS(SVGNS, p.t);
    Object.keys(p.a).forEach(k => el.setAttribute(k, p.a[k]));
    el.setAttribute('fill', p.relleno ? color : 'none');
    el.setAttribute('stroke', p.claro ? '#ffffff' : color);
    el.setAttribute('stroke-width', '1.4');
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
    g.appendChild(el);
  });
  parent.appendChild(g);
}

export function ejecutorDe(el) {
  const bo = el.businessObject || {};
  const at = bo.$attrs || {};
  return at['kaze:ejecucion'] || EJECUTOR_POR_TIPO[el.type] || null;
}

function Iconos(eventBus, bpmnRenderer) {
  eventBus.on('render.shape', 1500, (evt, ctx) => {
    const el = ctx.element;
    if (!TAREAS.test(el.type)) return undefined;
    // La tarea base (rectángulo, nombre y marcas de ciclo) sin el ícono estándar arriba a la izquierda.
    const forma = bpmnRenderer.handlers['bpmn:Task'](ctx.gfx, el, ctx.attrs || {});
    const bo = el.businessObject || {};
    const color = '#111111';
    const ejec = ejecutorDe(el);
    const nf = parseInt((bo.$attrs || {})['kaze:formatos'] || '0', 10);
    if (ejec) icono(ctx.gfx, ejec, el.width - 21, 5, 15, color);
    if (nf > 0) icono(ctx.gfx, 'hoja', el.width - (ejec ? 39 : 21), 5, 15, color);
    return forma;
  });
}
Iconos.$inject = ['eventBus', 'bpmnRenderer'];

const FIJOS = /^bpmn:(Participant|Lane|Group)$/;
const esFijo = e => e && (FIJOS.test(e.type) || e.type === 'bpmn:StartEvent' || (e.type === 'label' && e.labelTarget && FIJOS.test(e.labelTarget.type)));

function Reglas(eventBus, config) {
  const lectura = () => !!(config.kaze && config.kaze.soloLectura && config.kaze.soloLectura());
  const regla = (acciones, fn) => acciones.forEach(a => eventBus.on('commandStack.' + a + '.canExecute', 3000, ev => {
    const r = fn(ev.context || {});
    return r === undefined ? undefined : r;
  }));
  const creable = e => !!e && (e.type === 'label' || CREABLES.test(e.type));
  regla(['shape.create'], c => (lectura() || !creable(c.shape) ? false : undefined));
  regla(['elements.create'], c => (lectura() || !(c.elements || []).every(creable) ? false : undefined));
  // Borrar: nunca el inicio, los carriles, el pool ni las fases (se borra lo demás de la selección).
  regla(['elements.delete'], c => {
    if (lectura()) return false;
    const els = c.elements || [];
    const ok = els.filter(e => !esFijo(e));
    return ok.length === els.length ? undefined : ok;
  });
  regla(['connection.create'], c => {
    if (lectura()) return false;
    if ((c.source && FIJOS.test(c.source.type)) || (c.target && FIJOS.test(c.target.type))) return false;
    return undefined;
  });
  regla(['connection.reconnect', 'connection.reconnectStart', 'connection.reconnectEnd'], c => {
    if (lectura()) return false;
    const conn = c.connection || {};
    if (conn.type === 'bpmn:MessageFlow') return false;
    const s = c.source || c.newSource, t = c.target || c.newTarget;
    if ((s && FIJOS.test(s.type)) || (t && FIJOS.test(t.type))) return false;
    return undefined;
  });
  regla(['shape.replace'], c => (lectura() ? false : undefined));
  regla(['shape.toggleCollapse', 'lane.add', 'lane.split'], () => false);
  regla(['shape.resize'], c => (!lectura() && !!c.shape && (TAREAS.test(c.shape.type) || c.shape.type === 'bpmn:TextAnnotation') ? undefined : false));
  regla(['elements.move'], c => {
    if (lectura()) return false;
    if ((c.shapes || []).some(s => FIJOS.test(s.type))) return false;
    if (c.target && (c.target.type === 'bpmn:Participant' && c.target.businessObject && !c.target.businessObject.processRef)) return false;
    return undefined;
  });
  regla(['shape.attach'], c => (lectura() ? false : undefined));
  regla(['elements.paste', 'element.paste'], c => (lectura() ? false : undefined));
  regla(['connection.updateWaypoints', 'connection.segmentMove', 'bendpoint.move', 'connection.layout'], c => (lectura() ? false : undefined));
  regla(['element.updateLabel'], c => (lectura() ? false : undefined));
  // Doble clic renombra lo que la captura sabe guardar, y todo lo recién dibujado.
  eventBus.on('element.dblclick', 3000, ev => {
    const el = ev.element;
    if (lectura()) return false;
    if (!el) return undefined;
    const mapa = config.kaze && config.kaze.mapa ? config.kaze.mapa() : {};
    const id = el.type === 'label' ? el.labelTarget && el.labelTarget.id : el.id;
    const m = id && mapa[id];
    if (el.type === 'bpmn:TextAnnotation') return undefined;
    if (!m) return CREABLES.test((el.type === 'label' && el.labelTarget ? el.labelTarget.type : el.type)) ? undefined : false;
    if (EDITABLES.indexOf(m.tipo) < 0) return false;
    return undefined;
  });
}
Reglas.$inject = ['eventBus', 'config'];

/* Paleta de bpmn.io, sin lo que la captura no guarda (inicio extra, almacén, subproceso, pool, grupo), más anotación. */
const PALETA_FUERA = ['create.start-event', 'create.data-store', 'create.subprocess-expanded', 'create.participant-expanded', 'create.group'];
function Paleta(palette, create, elementFactory, config) {
  const lectura = () => !!(config.kaze && config.kaze.soloLectura && config.kaze.soloLectura());
  const crearNota = ev => create.start(ev, elementFactory.createShape({ type: 'bpmn:TextAnnotation' }));
  palette.registerProvider(200, {
    getPaletteEntries: () => entries => {
      if (lectura()) return {};
      const out = Object.assign({}, entries);
      PALETA_FUERA.forEach(k => { delete out[k]; });
      out['kaze-nota'] = { group: 'artifact', className: 'bpmn-icon-text-annotation', title: 'Anotación', action: { dragstart: crearNota, click: crearNota } };
      return out;
    },
  });
}
Paleta.$inject = ['palette', 'create', 'elementFactory', 'config'];

const PAD_FUERA = ['lane-insert-above', 'lane-insert-below', 'lane-divide-two', 'lane-divide-three', 'append.compensation-activity', 'append.receive-task', 'append.signal-intermediate-event'];
function Contexto(contextPad, config, popupMenu, canvas, translate) {
  // La llave abre el menú de reemplazo bajo el menú contextual (bpmn-js usa una API en desuso).
  const abrirReemplazo = (event, element) => {
    const pad = canvas.getContainer().querySelector('.djs-context-pad');
    const r = pad ? pad.getBoundingClientRect() : null;
    const pos = r ? { x: r.left, y: r.bottom + 5 } : { x: event.clientX || 0, y: event.clientY || 0 };
    pos.cursor = { x: event.clientX || pos.x, y: event.clientY || pos.y };
    popupMenu.open(element, 'bpmn-replace', pos, { title: translate('Change element'), width: 300, search: true });
  };
  const lectura = () => !!(config.kaze && config.kaze.soloLectura && config.kaze.soloLectura());
  contextPad.registerProvider(100, {
    getContextPadEntries: el => entries => {
      const mapa = config.kaze && config.kaze.mapa ? config.kaze.mapa() : {};
      const ref = mapa[el.id];
      const ficha = ref && config.kaze.abrirFicha && (ref.tipo === 'actividad' || ref.tipo === 'evento' || ref.tipo === 'decision')
        ? { 'kaze-ficha': { group: 'edit', html: '<div class="entry kz-cp-ficha">Ficha</div>', title: 'Abrir la ficha de la actividad', action: { click: () => config.kaze.abrirFicha(ref) } } } : {};
      if (lectura()) return ficha;
      if (FIJOS.test(el.type) || el.type === 'label') return {};
      const out = Object.assign({}, entries);
      PAD_FUERA.forEach(k => { delete out[k]; });
      if (el.type === 'bpmn:StartEvent') delete out.delete;
      if (el.type === 'bpmn:EndEvent') delete out.replace;
      if (out.replace) out.replace = Object.assign({}, out.replace, { action: { click: abrirReemplazo } });
      return Object.assign(out, ficha);
    },
  });
}
Contexto.$inject = ['contextPad', 'config', 'popupMenu', 'canvas', 'translate'];

/* Cambiar tipo (llave inglesa): solo lo que la captura sabe guardar. */
const REEMPLAZOS = new Set([
  'replace-with-none-start', 'replace-with-message-start', 'replace-with-timer-start', 'replace-with-conditional-start',
  'replace-with-none-intermediate-throw', 'replace-with-none-intermediate-throwing', 'replace-with-message-intermediate-catch',
  'replace-with-message-intermediate-throw', 'replace-with-timer-intermediate-catch', 'replace-with-conditional-intermediate-catch',
  'replace-with-exclusive-gateway', 'replace-with-parallel-gateway', 'replace-with-inclusive-gateway',
  'replace-with-task', 'replace-with-user-task', 'replace-with-service-task', 'replace-with-send-task', 'replace-with-receive-task',
  'replace-with-manual-task', 'replace-with-rule-task', 'replace-with-script-task',
  'replace-with-timer-boundary', 'replace-with-non-interrupting-timer-boundary', 'replace-with-error-boundary',
  'replace-with-default-flow', 'replace-with-sequence-flow',
]);
const CABECERA = new Set(['toggle-loop', 'toggle-parallel-mi', 'toggle-sequential-mi']);
function familia(el) {
  if (el.waypoints) return /flow$/;
  if (el.type === 'bpmn:StartEvent') return /-start$/;
  if (el.type === 'bpmn:BoundaryEvent') return /boundary$/;
  if (/Intermediate/.test(el.type)) return /intermediate/;
  if (/Gateway$/.test(el.type)) return /gateway$/;
  if (el.type === 'bpmn:EndEvent') return /^$/;
  return /task$/;
}
function Reemplazos(popupMenu) {
  popupMenu.registerProvider('bpmn-replace', 500, {
    getPopupMenuEntries: el => entries => {
      const out = {}, fam = familia(el);
      Object.keys(entries).forEach(k => { if (REEMPLAZOS.has(k) && fam.test(k)) out[k] = entries[k]; });
      return out;
    },
    getPopupMenuHeaderEntries: () => entries => {
      const out = {};
      Object.keys(entries).forEach(k => { if (CABECERA.has(k)) out[k] = entries[k]; });
      return out;
    },
  });
}
Reemplazos.$inject = ['popupMenu'];

/* Textos de bpmn.io en español. */
const ES = {
  'Activate hand tool': 'Mover el lienzo', 'Activate lasso tool': 'Seleccionar varias formas', 'Activate create/remove space tool': 'Abrir o cerrar espacio',
  'Activate global connect tool': 'Conectar dos formas', 'Create start event': 'Inicio', 'Create intermediate/boundary event': 'Evento (intermedio o sobre el borde de una tarea)',
  'Create end event': 'Fin', 'Create gateway': 'Decisión', 'Create task': 'Actividad', 'Create data object reference': 'Entregable (objeto de datos)',
  'Create data store reference': 'Almacén de datos', 'Create expanded sub-process': 'Subproceso', 'Create pool/participant': 'Participante', 'Create group': 'Grupo',
  'Append end event': 'Agregar un fin', 'Append gateway': 'Agregar una decisión después', 'Append task': 'Agregar una actividad después',
  'Append intermediate/boundary event': 'Agregar un evento después', 'Append text annotation': 'Agregar una anotación', 'Add text annotation': 'Agregar una anotación',
  'Append message intermediate catch event': 'Agregar: espera un mensaje', 'Append timer intermediate catch event': 'Agregar: espera un tiempo',
  'Append conditional intermediate catch event': 'Agregar: espera una condición', 'Append signal intermediate catch event': 'Agregar: espera una señal',
  'Append receive task': 'Agregar: tarea de recepción', 'Append compensation activity': 'Agregar: actividad de compensación',
  'Change element': 'Cambiar el tipo', 'Connect to other element': 'Conectar con otra forma', 'Connect using association': 'Conectar con una asociación',
  'Connect using data input association': 'Conectar como entrada', 'Delete': 'Eliminar', 'Search in diagram': 'Buscar en el diagrama',
  'Align elements': 'Alinear', 'Align elements left': 'Alinear a la izquierda', 'Align elements center': 'Centrar en horizontal', 'Align elements right': 'Alinear a la derecha',
  'Align elements top': 'Alinear arriba', 'Align elements middle': 'Centrar en vertical', 'Align elements bottom': 'Alinear abajo',
  'Distribute elements horizontally': 'Repartir en horizontal', 'Distribute elements vertically': 'Repartir en vertical',
  'Loop': 'Se repite', 'Parallel multi-instance': 'Por cada, a la vez', 'Sequential multi-instance': 'Por cada, uno tras otro', 'Ad-hoc': 'Ad hoc', 'Toggle non-interrupting': 'Sin interrumpir',
  'Task': 'Tarea', 'User task': 'Tarea de persona (usuario)', 'Service task': 'Tarea de sistema (servicio)', 'Script task': 'Tarea de IA o automatización (script)',
  'Manual task': 'Tarea manual', 'Send task': 'Tarea de envío', 'Receive task': 'Tarea de recepción', 'Business rule task': 'Tarea de regla de negocio',
  'Exclusive gateway': 'Decisión exclusiva: un solo camino', 'Parallel gateway': 'Decisión paralela: todos a la vez', 'Inclusive gateway': 'Decisión inclusiva: uno o varios',
  'Start event': 'Inicio', 'Message start event': 'Inicio por mensaje o solicitud', 'Timer start event': 'Inicio programado', 'Conditional start event': 'Inicio por condición',
  'Intermediate throw event': 'Hito', 'Message intermediate catch event': 'Espera un mensaje', 'Message intermediate throw event': 'Envía un aviso',
  'Timer intermediate catch event': 'Espera un tiempo', 'Conditional intermediate catch event': 'Espera una condición', 'End event': 'Fin',
  'Timer boundary event': 'Límite de tiempo (detiene la tarea)', 'Timer boundary event (non-interrupting)': 'Límite de tiempo (la tarea sigue)', 'Error boundary event': 'Error o excepción',
  'Default flow': 'Camino por defecto', 'Sequence flow': 'Conector normal', 'Conditional flow': 'Conector con condición',
};
export function traducir(plantilla, reemplazos) {
  const t = ES[plantilla] || plantilla;
  return t.replace(/{([^}]+)}/g, (_, k) => (reemplazos && reemplazos[k] != null ? reemplazos[k] : '{' + k + '}'));
}

export const moduloKaze = {
  __init__: ['kazeIconos', 'kazeReglas', 'kazePaleta', 'kazeContexto', 'kazeReemplazos'],
  kazeIconos: ['type', Iconos],
  kazeReglas: ['type', Reglas],
  kazePaleta: ['type', Paleta],
  kazeContexto: ['type', Contexto],
  kazeReemplazos: ['type', Reemplazos],
  translate: ['value', traducir],
};

export function crearModeler(contenedor, kaze, fuente, teclado) {
  const letra = fuente || '"Hanken Grotesk", system-ui, sans-serif';
  const mod = new window.BpmnJS({
    container: contenedor,
    additionalModules: [moduloKaze],
    kaze,
    keyboard: teclado ? { bindTo: teclado } : undefined,
    bpmnRenderer: { defaultFillColor: '#ffffff', defaultStrokeColor: '#111111', defaultLabelColor: '#111111' },
    textRenderer: { defaultStyle: { fontFamily: letra, fontSize: 12, lineHeight: 1.2 }, externalStyle: { fontFamily: letra, fontSize: 11 } },
  });
  // Deshacer y rehacer son los de la captura: el lienzo se vuelve a dibujar tras cada cambio.
  if (kaze && kaze.deshacer) {
    try {
      const ea = mod.get('editorActions');
      ['undo', 'redo'].forEach(a => { try { ea.unregister(a); } catch (e) { /* no estaba */ } });
      ea.register({ undo: () => kaze.deshacer(), redo: () => kaze.rehacer() });
    } catch (e) { /* sin acciones de editor */ }
  }
  return mod;
}

/* SVG del diagrama sin montarlo en pantalla (para el documento Word). */
export async function svgDelDiagrama(xml) {
  if (!window.BpmnJS) throw new Error('sin-visor');
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;left:-10000px;top:0;width:1600px;height:1000px;visibility:hidden';
  document.body.appendChild(div);
  const mod = crearModeler(div, { soloLectura: () => true, mapa: () => ({}) }, 'Arial, Helvetica, sans-serif');
  try {
    await mod.importXML(xml);
    const { svg } = await mod.saveSVG();
    return svg;
  } finally {
    mod.destroy();
    div.remove();
  }
}

/* SVG → PNG (para Word). Devuelve { bytes, ancho, alto } en píxeles. */
export function pngDeSvg(svg, escala) {
  return new Promise((res, rej) => {
    const m = /<svg[^>]*\swidth="([\d.]+)"[^>]*\sheight="([\d.]+)"/.exec(svg) || /<svg[^>]*\sheight="([\d.]+)"[^>]*\swidth="([\d.]+)"/.exec(svg);
    let w = 1200, h = 800;
    const vb = /viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg);
    if (vb) { w = parseFloat(vb[3]); h = parseFloat(vb[4]); } else if (m) { w = parseFloat(m[1]); h = parseFloat(m[2]); }
    const k = escala || Math.min(3, Math.max(1.5, 5200 / Math.max(w, h)));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.round(w * k); c.height = Math.round(h * k);
      const g = c.getContext('2d');
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      if (url) URL.revokeObjectURL(url);
      c.toBlob(b => {
        if (!b) { rej(new Error('png')); return; }
        b.arrayBuffer().then(ab => res({ bytes: new Uint8Array(ab), ancho: c.width, alto: c.height, anchoSvg: w, altoSvg: h }));
      }, 'image/png');
    };
    // Si la página no deja cargar imágenes data:, se intenta con un blob:.
    let url = null;
    img.onerror = () => {
      if (url || !window.URL || !URL.createObjectURL) { if (url) URL.revokeObjectURL(url); rej(new Error('svg')); return; }
      url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      img.src = url;
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

/* Lee del lienzo lo que la persona ajustó, como diferencias contra el trazado automático. */
const R = v => Math.round(v);
const rect = el => ({ x: el.x, y: el.y, w: el.width, h: el.height });
export function leerAjustes(modeler, gen, previos, editadas) {
  const reg0 = modeler.get('elementRegistry');
  // Una forma a la que se le cambió el tipo tiene otro id en el lienzo: se busca por el id que tenía.
  const nuevoDe = {};
  Object.keys((editadas && editadas.reemplazos) || {}).forEach(n => { nuevoDe[editadas.reemplazos[n]] = n; });
  const reg = { get: id => { let x = id, n = 0; while (!reg0.get(x) && nuevoDe[x] && n++ < 30) x = nuevoDe[x]; return reg0.get(x); }, filter: f => reg0.filter(f) };
  const geo = gen.geo;
  const out = { formas: {}, etiquetas: {}, rutas: {}, notas: [], v: 2 };
  const cambiosCarril = [];
  const carrilEn = y => {
    const ls = geo.carriles.map(c => { const el = reg.get(c.id); return el ? { nombre: c.nombre, y: el.y, h: el.height } : null; }).filter(Boolean);
    return (ls.find(l => y >= l.y && y < l.y + l.h) || {}).nombre;
  };
  const carrilAuto = y => (geo.carriles.find(c => y >= c.y && y < c.y + c.h) || {}).nombre;
  Object.keys(geo.auto).forEach(id => {
    const el = reg.get(id);
    if (!el) return;
    let base = geo.auto[id];
    // Eventos de borde y datos siguen a su tarea: su diferencia se mide contra la tarea de ahora.
    const host = el.host || null;
    const tareaDato = /^Entregable_/.test(id) ? reg.get('Act_' + id.slice('Entregable_'.length)) : null;
    const dueno = host || tareaDato;
    if (dueno && geo.final[dueno.id]) {
      const f = geo.final[dueno.id];
      base = { x: base.x - f.x + dueno.x, y: base.y - f.y + dueno.y, w: base.w, h: base.h };
    }
    // Un entregable sigue a su tarea salvo que la persona lo haya movido.
    if (tareaDato && !editadas.movidas.has(id)) { if (previos.formas && previos.formas[id]) out.formas[id] = previos.formas[id]; return; }
    let dx = el.x - base.x, dy = el.y - base.y;
    const dw = el.width - base.w, dh = el.height - base.h;
    const m = gen.mapa[id];
    if (m && m.tipo === 'actividad') {
      const antes = carrilAuto(geo.auto[id].y + geo.auto[id].h / 2);
      const ahora = carrilEn(el.y + el.height / 2);
      if (ahora && antes && ahora !== antes) { cambiosCarril.push({ clave: m.clave, rol: ahora }); dy = 0; }
    }
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(dw) < 1 && Math.abs(dh) < 1) return;
    const a = { dx: R(dx), dy: R(dy) };
    if (Math.abs(dw) >= 1) a.dw = R(dw);
    if (Math.abs(dh) >= 1) a.dh = R(dh);
    out.formas[id] = a;
  });
  // Etiquetas: las de formas, como diferencia contra su lugar automático junto a la forma; las de
  // conectores, solo si la persona las movió (si el conector se retrazó, vuelven a su lugar).
  // bpmn-js ajusta el ancho de cada etiqueta a su texto conservando el centro: se compara el
  // centro horizontal (comparar la x hacía que las etiquetas se corrieran en cada guardado).
  const cx = r => r.x + (r.width != null ? r.width : r.w) / 2;
  Object.keys(geo.etqAuto).forEach(id => {
    const el = reg.get(id);
    if (!el || !el.label) return;
    const L = el.label, auto = geo.etqAuto[id];
    if (el.waypoints) {
      if (editadas.etiquetas.has(id)) out.etiquetas[id] = { dx: R(cx(L) - cx(auto)), dy: R(L.y - auto.y) };
      else if (previos.v === 2 && previos.etiquetas && previos.etiquetas[id] && !editadas.soltadas.has(id)) out.etiquetas[id] = previos.etiquetas[id];
      return;
    }
    const f = geo.final[id];
    if (!f) return;
    const dx = cx(L) - (cx(auto) - f.x + el.x), dy = L.y - (auto.y - f.y + el.y);
    if (Math.abs(dx) >= 1.5 || Math.abs(dy) >= 1.5) out.etiquetas[id] = { dx: R(dx), dy: R(dy) };
  });
  // Rutas: solo las que la persona tocó (las demás las traza Kaze sin cruces).
  Object.keys(geo.conectores).forEach(id => {
    const el = reg.get(id);
    if (!el || !el.waypoints) return;
    if (!editadas.rutas.has(id)) {
      if (previos.rutas && previos.rutas[id] && !editadas.soltadas.has(id)) {
        const s = el.source, t = el.target;
        const fr = firmaForma(rect(s)) + '|' + firmaForma(rect(t));
        if (previos.rutas[id].firma === fr) out.rutas[id] = previos.rutas[id];
      }
      return;
    }
    const s = el.source, t = el.target;
    out.rutas[id] = { puntos: el.waypoints.map(p => [R(p.x), R(p.y)]), firma: firmaForma(rect(s)) + '|' + firmaForma(rect(t)) };
  });
  // Anotaciones.
  reg.filter(e => e.type === 'bpmn:TextAnnotation').forEach(e => {
    const asoc = (e.outgoing || []).concat(e.incoming || []).find(c => c.type === 'bpmn:Association');
    const otro = asoc ? (asoc.source === e ? asoc.target : asoc.source) : null;
    const ancla = otro && !otro.waypoints && otro.type !== 'label' ? otro.id : null;
    const nota = { id: e.id, texto: (e.businessObject && e.businessObject.text) || '', w: R(e.width), h: R(e.height) };
    if (ancla) { nota.ancla = ancla; nota.rx = R(e.x - otro.x); nota.ry = R(e.y - otro.y); } else { nota.x = R(e.x); nota.y = R(e.y); }
    out.notas.push(nota);
  });
  return { ajustes: out, cambiosCarril };
}
