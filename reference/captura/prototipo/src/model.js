/* Modelo de datos del prototipo de captura de procesos.
   Un proceso = ficha + versiones (As-Is y To-Be). Cada versión guarda fases (con el
   orden de claves de actividad), la columna «Sin fase», las actividades por clave y
   las decisiones. El número visible de una actividad nunca se guarda: se calcula. */

export const K = () => window.Kaze;

export const uid = (p = 'k') =>
  p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

export const ahora = () => new Date().toISOString();

export const DESCONOCIDO = 'desconocido';
export const NA = 'na';
export const esEspecial = v => v === DESCONOCIDO || v === NA;
export const tieneValor = v => v != null && v !== '' && !esEspecial(v);

/* Texto que se escribe en una celda → valor guardado. «?» = desconocido,
   «n/a» = no aplica, vacío = sin respuesta, «0» = cero. */
export function leerTexto(t) {
  const s = String(t ?? '').trim();
  if (s === '') return null;
  if (s === '?') return DESCONOCIDO;
  if (/^n\s*\/?\s*a$/i.test(s)) return NA;
  return s;
}
export function leerNumero(t) {
  const v = leerTexto(t);
  if (v == null || esEspecial(v)) return v;
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : v;
}
export function mostrarTexto(v) {
  if (v == null) return '';
  if (v === DESCONOCIDO) return '?';
  if (v === NA) return 'N/A';
  if (typeof v === 'number') return v.toLocaleString('es-CO');
  return String(v);
}

/* Quién ejecuta la actividad: da el tipo de tarea BPMN y el ícono del diagrama. */
export const EJECUCION = [['persona', 'Persona'], ['sistema', 'Sistema'], ['automatizacion', 'IA o automatización']];

export function nuevaActividad(nombre, extra) {
  return Object.assign({
    clave: uid('a'), nombre: nombre || 'Nueva actividad', descripcion: null,
    responsable: null, departamento: null, apoyo: null, ejecucion: 'persona',
    entradas: null, entregable: null, receptor: null, receptorExterno: false, criterio: null,
    tProceso: null, tEspera: null, unidad: 'h', frecuencia: null,
    herramientas: null, documentos: null, reglas: null, problemas: null,
    formatos: [], eventos: [], ciclo: null, relato: null,
    fuente: null, evidencia: null, estado: 'confirmado', origenClave: null,
  }, extra || {});
}

/* ---------- eventos de una actividad ----------
   Esperas antes o después (temporizador, fecha, mensaje, condición), avisos que salen al
   terminar, y eventos de borde mientras se ejecuta (límite de tiempo, error). */
export const TIPOS_EVENTO = {
  tiempo: { nombre: 'Espera un tiempo', corto: 'Espera', momentos: ['antes', 'despues'] },
  fecha: { nombre: 'Espera una fecha u hora', corto: 'Hasta', momentos: ['antes', 'despues'] },
  mensaje: { nombre: 'Espera un mensaje o respuesta', corto: 'Mensaje', momentos: ['antes', 'despues'] },
  condicion: { nombre: 'Espera a que se cumpla una condición', corto: 'Condición', momentos: ['antes', 'despues'] },
  aviso: { nombre: 'Envía un aviso al terminar', corto: 'Aviso', momentos: ['despues'] },
  hito: { nombre: 'Marca un hito al terminar', corto: 'Hito', momentos: ['despues'] },
  limite: { nombre: 'Límite de tiempo mientras se hace', corto: 'Límite', momentos: ['durante'] },
  error: { nombre: 'Si ocurre un error o excepción', corto: 'Error', momentos: ['durante'] },
};
export function nuevoEvento(tipo, momento) {
  return { id: uid('e'), tipo, momento: momento || TIPOS_EVENTO[tipo].momentos[0], texto: null, n: null, unidad: tipo === 'limite' ? 'días' : 'h',
    quien: null, externo: false, destino: null, interrumpe: true };
}
const durTxt = e => (typeof e.n === 'number' ? String(e.n).replace('.', ',') + ' ' + (e.unidad || 'h') : '? ' + (e.unidad || 'h'));
/* Nombre corto para el diagrama. */
export function nombreEvento(e) {
  if (tieneValor(e.texto)) return String(e.texto);
  switch (e.tipo) {
    case 'tiempo': return 'Esperar ' + durTxt(e);
    case 'fecha': return 'Fecha programada';
    case 'mensaje': return tieneValor(e.quien) ? 'Respuesta de ' + e.quien : 'Mensaje recibido';
    case 'condicion': return 'Condición cumplida';
    case 'aviso': return tieneValor(e.quien) ? 'Aviso a ' + e.quien : 'Aviso enviado';
    case 'hito': return 'Hito';
    case 'limite': return durTxt(e);
    case 'error': return 'Error';
    default: return '';
  }
}
/* Frase completa para la ficha y el documento. */
export function fraseEvento(e, rotuloDestino) {
  const dest = e.destino ? (rotuloDestino ? rotuloDestino(e.destino) : e.destino) : 'sin definir';
  switch (e.tipo) {
    case 'tiempo': return (e.momento === 'antes' ? 'Antes de empezar espera ' : 'Al terminar espera ') + durTxt(e) + (tieneValor(e.texto) ? ' (' + e.texto + ')' : '') + '.';
    case 'fecha': return (e.momento === 'antes' ? 'Antes de empezar espera hasta ' : 'Al terminar espera hasta ') + (tieneValor(e.texto) ? e.texto : 'una fecha por definir') + '.';
    case 'mensaje': return (e.momento === 'antes' ? 'Antes de empezar espera ' : 'Al terminar espera ') + (tieneValor(e.texto) ? '«' + e.texto + '»' : 'un mensaje') + (tieneValor(e.quien) ? ' de ' + e.quien : '') + '.';
    case 'condicion': return (e.momento === 'antes' ? 'Antes de empezar espera a que ' : 'Al terminar espera a que ') + (tieneValor(e.texto) ? e.texto : 'se cumpla una condición por definir') + '.';
    case 'aviso': return 'Al terminar avisa' + (tieneValor(e.quien) ? ' a ' + e.quien : '') + (tieneValor(e.texto) ? ': «' + e.texto + '»' : '') + '.';
    case 'hito': return 'Al terminar se cumple el hito ' + (tieneValor(e.texto) ? '«' + e.texto + '»' : 'por nombrar') + '.';
    case 'limite': return 'Si en ' + durTxt(e) + ' no ha terminado' + (e.interrumpe ? ', se detiene' : ', sigue en paralelo') + ' y pasa a ' + dest + '.';
    case 'error': return 'Si ' + (tieneValor(e.texto) ? e.texto : 'ocurre un error') + ', se detiene y pasa a ' + dest + '.';
    default: return '';
  }
}
/* Duración ISO 8601 para el XML (PT24H, P3D, PT30M). */
export function duracionISO(e) {
  if (typeof e.n !== 'number' || !(e.n > 0)) return null;
  if (e.unidad === 'min') return 'PT' + e.n + 'M';
  if (e.unidad === 'días') return 'P' + e.n + 'D';
  return 'PT' + e.n + 'H';
}
export const CICLOS = [['', 'Se hace una vez'], ['repite', 'Se repite hasta cumplir una condición'], ['porCada', 'Se hace por cada elemento']];
export function fraseCiclo(c) {
  if (!c || !c.tipo) return null;
  if (c.tipo === 'repite') return 'Se repite' + (tieneValor(c.condicion) ? ' ' + c.condicion : ' hasta cumplir una condición por definir') + '.';
  return 'Se hace por cada ' + (tieneValor(c.condicion) ? c.condicion : 'elemento') + (c.paralelo ? ', todos a la vez' : ', uno tras otro') + '.';
}

/* ---------- formatos adjuntos ---------- */
export function nuevoFormato(extra) {
  return Object.assign({ id: uid('fm'), nombre: '', codigo: null, version: null, archivo: null, enlace: null }, extra || {});
}
/* Todos los formatos de una versión, sin repetir (por código o nombre), con las actividades que los usan. */
export function formatosDelModelo(m) {
  const seq = secuencia(m);
  const out = [];
  seq.forEach(s => {
    const a = m.actividades[s.clave];
    (a && a.formatos || []).forEach(f => {
      const llave = normalizarTexto(f.codigo || f.nombre);
      if (!llave) return;
      let x = out.find(y => y.llave === llave);
      if (!x) { x = { llave, codigo: f.codigo, nombre: f.nombre, version: f.version, archivo: f.archivo, enlace: f.enlace, actividades: [] }; out.push(x); }
      if (!x.archivo && f.archivo) x.archivo = f.archivo;
      if (!x.enlace && f.enlace) x.enlace = f.enlace;
      if (x.actividades.indexOf(s.clave) < 0) x.actividades.push(s.clave);
    });
  });
  return out;
}
export const normalizarTexto = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

/* ---------- inicio del proceso y referencias ---------- */
export const TIPOS_INICIO = [['ninguno', 'Alguien lo inicia'], ['mensaje', 'Llega una solicitud o mensaje'], ['tiempo', 'Programado (fecha o periodo)'], ['condicion', 'Se cumple una condición']];
export const TIPOS_REFERENCIA = [['interna', 'Documento interno'], ['externa', 'Norma o documento externo'], ['ley', 'Ley o regulación'], ['otra', 'Otra']];

/* Datos guardados antes de estos campos: se completan sin cambiar lo capturado. */
export function normalizarProceso(p) {
  if (!p || !p.versiones) return p;
  if (!Array.isArray(p.referencias)) p.referencias = [];
  if (!Array.isArray(p.proveedores)) p.proveedores = [];
  if (!p.inicio || typeof p.inicio !== 'object') p.inicio = { tipo: 'ninguno', detalle: null };
  if (p.codigoDoc === undefined) p.codigoDoc = null;
  if (p.remitente === undefined) p.remitente = null;
  // Contactos: correo, papel en la RACI y un número fijo (va en su código de aprobación).
  if (!Array.isArray(p.participantes)) p.participantes = [];
  let maxNum = p.participantes.reduce((mx, c) => Math.max(mx, c.num || 0), 0);
  p.participantes.forEach(c => {
    if (c.correo === undefined) c.correo = '';
    if (c.papel === undefined) c.papel = '';
    if (!c.num) { maxNum += 1; c.num = maxNum; }
  });
  ['asis', 'tobe'].forEach(v => {
    const m = p.versiones[v];
    if (!m) return;
    if (!m.diagrama || typeof m.diagrama !== 'object') m.diagrama = {};
    Object.values(m.actividades || {}).forEach(a => {
      if (!a.ejecucion) a.ejecucion = 'persona';
      if (!Array.isArray(a.formatos)) a.formatos = [];
      if (!Array.isArray(a.eventos)) a.eventos = [];
      if (a.ciclo === undefined) a.ciclo = null;
      if (a.relato === undefined) a.relato = null;
    });
    // Aprobación guardada antes de las etapas: pasa a una sola etapa final.
    const ap = m.aprobacion;
    if (ap && !ap.etapas && Array.isArray(ap.aprobadores)) {
      m.aprobacion = {
        id: ap.id || 'ap_' + String(ap.solicitada || '').replace(/[^0-9]/g, '').slice(0, 14), version: ap.version, solicitada: ap.solicitada, remitente: null,
        etapas: [{ tipo: 'final', titulo: 'Aprobación final', personas: ap.aprobadores.map(a => {
          const r = (ap.respuestas || {})[a.rol];
          return { id: a.rol, nombre: a.nombre, cargo: a.titulo || '', area: '', correo: '', codigo: '', estado: r ? r.decision : 'pendiente', fecha: r ? r.fecha : null, comentario: r ? r.comentario || null : null, via: r ? 'manual' : null, preparado: null };
        }) }],
      };
    }
  });
  return p;
}

export function nuevoModelo() {
  return { numero: 1, estado: 'borrador', fases: [], sinFase: [], actividades: {}, decisiones: [], aprobacion: null, historial: [], diagrama: {} };
}

export function nuevoProceso(datos) {
  const t = ahora();
  return Object.assign({
    id: uid('p'), nombre: 'Proceso sin nombre', objetivo: '', alcance: '', exclusiones: '', disparador: '',
    inicio: { tipo: 'ninguno', detalle: null }, codigoDoc: null, referencias: [],
    resultados: [], cliente: '', clienteExterno: true, dueno: '', departamentos: [], proveedores: [],
    participantes: [], sesiones: [], preguntas: [], remitente: null,
    creado: t, actualizado: t, rev: 0,
    versiones: { asis: nuevoModelo(), tobe: null },
  }, datos || {});
}

export const clonar = o => JSON.parse(JSON.stringify(o));

/* ---------- secuencia ---------- */

export function fasesTablero(m) {
  const act = k => {
    const a = m.actividades[k] || { clave: k, nombre: '(sin nombre)' };
    return { clave: k, nombre: a.nombre, responsable: tieneValor(a.responsable) ? a.responsable : null,
      entregable: tieneValor(a.entregable) ? a.entregable : null, estado: a.estado };
  };
  const out = m.fases.map(f => ({ id: f.id, nombre: f.nombre, objetivo: f.objetivo, entrada: f.entrada,
    entregables: f.entregables || [], salida: f.salida, actividades: f.actividades.map(act) }));
  out.push({ id: '__sin', sinFase: true, nombre: 'Sin fase', actividades: m.sinFase.map(act) });
  return out;
}

export const secuencia = m => K().secuenciaActividades(fasesTablero(m));

export function faseDe(m, clave) {
  for (const f of m.fases) if (f.actividades.indexOf(clave) >= 0) return f;
  return null;
}

/* Aplica lo que devuelve TableroFases (fases con actividades en orden). */
export function aplicarTablero(m, fases) {
  fases.forEach(f => {
    const claves = f.actividades.map(a => a.clave);
    if (f.sinFase) m.sinFase = claves;
    else { const mf = m.fases.find(x => x.id === f.id); if (mf) mf.actividades = claves; }
  });
}

export function quitarDeFases(m, clave) {
  m.fases.forEach(f => { f.actividades = f.actividades.filter(k => k !== clave); });
  m.sinFase = m.sinFase.filter(k => k !== clave);
}

export function ponerEnFase(m, clave, faseId, indice) {
  quitarDeFases(m, clave);
  const lista = faseId && faseId !== '__sin' ? (m.fases.find(f => f.id === faseId) || {}).actividades : m.sinFase;
  const arr = lista || m.sinFase;
  const i = indice == null ? arr.length : Math.max(0, Math.min(indice, arr.length));
  arr.splice(i, 0, clave);
}

/* Alt+↑/↓ en la tabla: sube o baja una posición en la secuencia, cruzando de fase
   cuando llega al borde (igual que en el tablero). */
export function moverEnSecuencia(m, clave, dir) {
  const fi = m.fases.findIndex(f => f.actividades.indexOf(clave) >= 0);
  if (fi < 0) return false;
  const f = m.fases[fi];
  const i = f.actividades.indexOf(clave);
  if (dir < 0) {
    if (i > 0) { f.actividades.splice(i, 1); f.actividades.splice(i - 1, 0, clave); return true; }
    for (let j = fi - 1; j >= 0; j--) { f.actividades.splice(i, 1); m.fases[j].actividades.push(clave); return true; }
  } else {
    if (i < f.actividades.length - 1) { f.actividades.splice(i, 1); f.actividades.splice(i + 1, 0, clave); return true; }
    for (let j = fi + 1; j < m.fases.length; j++) { f.actividades.splice(i, 1); m.fases[j].actividades.unshift(clave); return true; }
  }
  return false;
}

/* Alta rápida (paso «listar y agrupar»): al final de la fase, o en «Sin fase». */
export function agregarActividades(m, faseId, nombres, extra) {
  return nombres.map(n => {
    const a = nuevaActividad(n, extra);
    m.actividades[a.clave] = a;
    ponerEnFase(m, a.clave, faseId);
    return a.clave;
  });
}

export function nuevaFase(m, nombre) {
  const f = { id: uid('f'), nombre: nombre || 'Fase ' + (m.fases.length + 1), objetivo: null, entrada: null, entregables: [], salida: null, actividades: [] };
  m.fases.push(f);
  return f;
}

export function eliminarActividad(m, clave) {
  quitarDeFases(m, clave);
  delete m.actividades[clave];
  // Las decisiones NO se borran: revisarDecision las marcará para revisar.
}

export function eliminarFase(m, faseId) {
  const f = m.fases.find(x => x.id === faseId);
  if (!f) return;
  m.sinFase = m.sinFase.concat(f.actividades);
  m.fases = m.fases.filter(x => x.id !== faseId);
}

/* ---------- caracterización ---------- */

/* Los datos de la ficha que cuentan para saber cuánto falta. N/A y 0 son respuestas;
   «?» es un dato por preguntar; vacío es un dato sin tocar. */
export const SECCIONES_FICHA = [
  { id: 'basico', titulo: 'Básico', campos: ['descripcion', 'responsable', 'departamento', 'apoyo'] },
  { id: 'entradas', titulo: 'Entradas y entregable', campos: ['entradas', 'entregable', 'receptor', 'criterio'] },
  { id: 'tiempos', titulo: 'Tiempos y volumen', campos: ['tProceso', 'tEspera', 'frecuencia'] },
  { id: 'recursos', titulo: 'Recursos', campos: ['herramientas', 'documentos'] },
  { id: 'reglas', titulo: 'Reglas y problemas', campos: ['reglas', 'problemas'] },
  { id: 'fuente', titulo: 'Fuente y confirmación', campos: ['fuente'] },
];
export const CAMPOS_FICHA = SECCIONES_FICHA.reduce((t, s) => t.concat(s.campos), []);

export function completitud(a, campos) {
  let resp = 0, preg = 0;
  const cs = campos || CAMPOS_FICHA;
  cs.forEach(c => {
    const v = a ? a[c] : null;
    if (v === DESCONOCIDO) preg += 1;
    else if (v != null && v !== '') resp += 1;
  });
  return { resp, preg, total: cs.length, completa: resp === cs.length };
}

/* ---------- decisiones ---------- */

export function nuevaDecision(extra) {
  return Object.assign({ clave: uid('d'), pregunta: '', origen: null, decide: null, tipo: 'exclusiva',
    salidas: [{ condicion: '', destino: null, porDefecto: true, clase: null }, { condicion: '', destino: null, porDefecto: false, clase: null }],
    estado: 'confirmado', contexto: { faseOrigen: null }, aceptados: [] }, extra || {});
}

export function motivosDe(m, d, seq) {
  return K().revisarDecision(d, seq || secuencia(m));
}

/* ---------- As-Is → To-Be ---------- */

export function crearTobe(asis) {
  const m = clonar(asis);
  const mapa = {};
  const acts = {};
  Object.keys(asis.actividades).forEach(k => {
    const n = uid('a');
    mapa[k] = n;
    acts[n] = Object.assign(clonar(asis.actividades[k]), { clave: n, origenClave: k });
  });
  m.actividades = acts;
  m.fases.forEach(f => { f.actividades = f.actividades.map(k => mapa[k]); });
  m.sinFase = m.sinFase.map(k => mapa[k]);
  Object.values(acts).forEach(a => { (a.eventos || []).forEach(e => { if (e.destino && e.destino !== '__fin') e.destino = mapa[e.destino] || null; }); });
  const mapaDec = {};
  m.decisiones = m.decisiones.map(d => { const n = uid('d'); mapaDec[d.clave] = n; return Object.assign(clonar(d), {
    clave: n, origen: d.origen ? mapa[d.origen] || null : null,
    salidas: d.salidas.map(s => Object.assign({}, s, { destino: s.destino && s.destino !== '__fin' ? mapa[s.destino] || null : s.destino })),
  }); });
  m.diagrama = remapearDiagrama(asis.diagrama, Object.assign({}, mapa, mapaDec));
  m.numero = 1; m.estado = 'borrador'; m.aprobacion = null; m.historial = [];
  return m;
}

/* Los ajustes del diagrama se guardan por id de elemento, y los ids llevan la clave: al copiar
   al To-Be se reescriben con las claves nuevas. */
export function remapearDiagrama(d, mapa) {
  if (!d) return {};
  const claves = Object.keys(mapa).sort((a, b) => b.length - a.length);
  const id = s => { let r = s; claves.forEach(k => { if (r.indexOf(k) >= 0) r = r.split(k).join(mapa[k]); }); return r; };
  const out = {};
  Object.keys(d).forEach(grupo => {
    const g = d[grupo];
    if (Array.isArray(g)) out[grupo] = g.map(x => Object.assign(clonar(x), x.ancla ? { ancla: id(x.ancla) } : {}, x.id ? { id: id(x.id) } : {}));
    else if (g && typeof g === 'object') { out[grupo] = {}; Object.keys(g).forEach(k => { out[grupo][id(k)] = clonar(g[k]); }); }
  });
  return out;
}

const CAMPOS_DIFF = ['nombre', 'responsable', 'ejecucion', 'entregable', 'receptor', 'tProceso', 'tEspera', 'reglas', 'herramientas', 'formatos', 'eventos', 'ciclo'];
export function cambioFrenteAsis(asis, tobe, a) {
  if (!asis) return null;
  if (!a.origenClave || !asis.actividades[a.origenClave]) return 'nueva';
  const o = asis.actividades[a.origenClave];
  if (CAMPOS_DIFF.some(c => JSON.stringify(o[c]) !== JSON.stringify(a[c]))) return 'modificada';
  const fo = faseDe(asis, o.clave), fa = faseDe(tobe, a.clave);
  if ((fo && fo.nombre) !== (fa && fa.nombre)) return 'modificada';
  return null;
}
export function eliminadasFrenteAsis(asis, tobe) {
  if (!asis || !tobe) return [];
  const usadas = {};
  Object.values(tobe.actividades).forEach(a => { if (a.origenClave) usadas[a.origenClave] = true; });
  return Object.values(asis.actividades).filter(a => !usadas[a.clave]);
}

/* ---------- aprobaciones ---------- */

/* Aprobación en etapas (visto bueno de las áreas, luego aprobación final). Cualquier pedido de
   cambios devuelve el flujo; aprobada cuando todas las etapas están completas. */
export function estadoAprobacion(ap) {
  if (!ap || !Array.isArray(ap.etapas)) return 'borrador';
  const ps = ap.etapas.reduce((t, e) => t.concat(e.personas || []), []);
  if (ps.some(x => x.estado === 'cambios')) return 'cambios';
  if (ps.length && ap.etapas.every(e => (e.personas || []).length && e.personas.every(x => x.estado === 'aprobado'))) return 'aprobado';
  return 'revision';
}

export const bloqueada = m => m.estado === 'revision' || m.estado === 'aprobado';

/* ---------- revisión (avisos) ---------- */

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export function avisos(proc, m) {
  const out = [];
  const seq = secuencia(m);
  const num = {};
  seq.forEach(s => { num[s.clave] = s; });
  const acts = Object.values(m.actividades);
  const enOrden = seq.map(s => m.actividades[s.clave]).filter(Boolean);
  if (!acts.length) out.push({ nivel: 'info', tab: 'actividades', sub: 'listar', texto: 'Aún no hay actividades. Empieza por listarlas, cada una en su fase.' });
  if (m.sinFase.length) out.push({ nivel: 'alerta', tab: 'actividades', sub: 'listar', texto: m.sinFase.length + (m.sinFase.length === 1 ? ' actividad sin fase: no tiene número ni lugar en el diagrama.' : ' actividades sin fase: no tienen número ni lugar en el diagrama.') });
  const sinResp = enOrden.filter(a => !tieneValor(a.responsable));
  if (sinResp.length) out.push({ nivel: 'alerta', tab: 'actividades', sub: 'caracterizar', clave: sinResp[0].clave, texto: sinResp.length + ' sin responsable confirmado: irán al carril «Sin responsable».' });
  const sugA = enOrden.filter(a => a.estado === 'sugerencia');
  const sugD = m.decisiones.filter(d => d.estado === 'sugerencia');
  if (sugA.length || sugD.length) {
    const n = sugA.length + sugD.length;
    out.push(sugA.length ? { nivel: 'ia', tab: 'actividades', sub: 'caracterizar', clave: sugA[0].clave, texto: n + (n === 1 ? ' sugerencia de la IA por aceptar o descartar.' : ' sugerencias de la IA por aceptar o descartar.') }
      : { nivel: 'ia', tab: 'actividades', sub: 'caracterizar', clave: destinoDecision(m, sugD[0]), texto: n + (n === 1 ? ' decisión sugerida por la IA por aceptar o descartar.' : ' decisiones sugeridas por la IA por aceptar o descartar.') });
  }
  const rev = m.decisiones.filter(d => d.origen && m.actividades[d.origen] && K().revisarDecision(d, seq).length);
  if (rev.length) out.push({ nivel: 'alerta', tab: 'actividades', sub: 'caracterizar', clave: destinoDecision(m, rev[0]), texto: rev.length + (rev.length === 1 ? ' decisión por revisar tras un cambio en la secuencia.' : ' decisiones por revisar tras cambios en la secuencia.') });
  const sueltas = m.decisiones.filter(d => !d.origen || !m.actividades[d.origen]);
  if (sueltas.length) out.push({ nivel: 'alerta', tab: 'actividades', sub: 'caracterizar', clave: 'dec:' + sueltas[0].clave, texto: sueltas.length + (sueltas.length === 1 ? ' decisión sin actividad de origen: ubícala.' : ' decisiones sin actividad de origen: ubícalas.') });
  const porOrigen = {};
  m.decisiones.forEach(d => { if (d.origen) porOrigen[d.origen] = (porOrigen[d.origen] || 0) + 1; });
  Object.keys(porOrigen).forEach(k => { if (porOrigen[k] > 1 && num[k]) out.push({ nivel: 'alerta', tab: 'actividades', sub: 'caracterizar', clave: k, texto: (num[k].codigo || '') + ' tiene ' + porOrigen[k] + ' decisiones: el diagrama solo dibuja la primera.' }); });
  enOrden.forEach(a => (a.eventos || []).forEach(e => {
    if ((e.tipo === 'limite' || e.tipo === 'error') && e.destino && e.destino !== '__fin' && !num[e.destino]) out.push({ nivel: 'alerta', tab: 'actividades', sub: 'caracterizar', clave: a.clave, texto: ((num[a.clave] || {}).codigo || '«' + a.nombre + '»') + ': «' + TIPOS_EVENTO[e.tipo].corto + '» lleva a una actividad eliminada o sin fase.' });
  }));
  // Entregables: si B usa lo que entrega A, A debería ir antes.
  acts.forEach(a => {
    if (!tieneValor(a.entregable) || norm(a.entregable).length < 4) return;
    acts.forEach(b => {
      if (a === b || !tieneValor(b.entradas)) return;
      if (norm(b.entradas).indexOf(norm(a.entregable)) < 0) return;
      const na = num[a.clave], nb = num[b.clave];
      if (na && nb && na.numero != null && nb.numero != null && nb.numero < na.numero) {
        out.push({ nivel: 'alerta', tab: 'actividades', sub: 'listar', texto: nb.codigo + ' «' + b.nombre + '» usa «' + a.entregable + '», que entrega ' + na.codigo + ' más adelante. ¿Va antes?' });
      }
    });
  });
  m.fases.forEach(f => { if (!tieneValor(f.salida) && f.actividades.length) out.push({ nivel: 'info', tab: 'fases', fase: f.id, texto: 'La fase «' + f.nombre + '» no tiene criterio de salida: ¿cuándo termina?' }); });
  if (!tieneValor(proc.disparador)) out.push({ nivel: 'info', tab: 'resumen', texto: 'Falta el evento que inicia el proceso.' });
  if (!tieneValor(proc.dueno)) out.push({ nivel: 'info', tab: 'resumen', texto: 'Falta el dueño del proceso: es quien lo aprueba.' });
  return out;
}

/* Datos por preguntar: campos marcados como desconocidos. */
const ROTULOS = { responsable: 'responsable', entregable: 'entregable', receptor: 'quién recibe', criterio: 'criterio de aceptación',
  tProceso: 'tiempo de proceso', tEspera: 'tiempo de espera', frecuencia: 'frecuencia', entradas: 'entradas', herramientas: 'herramientas',
  documentos: 'documentos', reglas: 'reglas', apoyo: 'apoyo', departamento: 'departamento', descripcion: 'descripción', problemas: 'problemas' };
/* A qué ficha llevar una decisión: la de su actividad de origen, o la lista de decisiones por ubicar. */
export function destinoDecision(m, d) { return d.origen && m.actividades[d.origen] ? d.origen : 'dec:' + d.clave; }

export function porPreguntar(m) {
  const seq = secuencia(m);
  const out = [];
  seq.forEach(s => {
    const a = m.actividades[s.clave];
    if (!a) return;
    const faltan = Object.keys(ROTULOS).filter(c => a[c] === DESCONOCIDO).map(c => ROTULOS[c]);
    if (faltan.length || a.estado === 'pregunta') out.push({ clave: a.clave, codigo: s.codigo, nombre: a.nombre, faltan });
  });
  return out;
}

export function roles(m) {
  const set = [];
  Object.values(m.actividades).forEach(a => { if (tieneValor(a.responsable) && set.indexOf(a.responsable) < 0) set.push(a.responsable); });
  return set;
}

export function relativo(iso) {
  if (!iso) return '';
  const d = new Date(iso), s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 10) return 'ahora';
  if (s < 60) return 'hace ' + s + ' s';
  if (s < 3600) return 'hace ' + Math.round(s / 60) + ' min';
  if (s < 86400) return 'hace ' + Math.round(s / 3600) + ' h';
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '');
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
export function fechaCorta(iso) {
  if (!iso) return '';
  const d = new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso);
  if (isNaN(d.getTime())) return '';
  return d.getDate() + ' ' + MESES[d.getMonth()] + ' ' + d.getFullYear();
}
