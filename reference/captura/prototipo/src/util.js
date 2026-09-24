/* Utilidades: .zip sin compresión (para entregar el .bpmn, que el visor no deja
   descargar suelto), almacenamiento en el servidor del artifact e IA. */

// ---------- zip (método «stored») ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
export function zip(archivos) {
  const enc = new TextEncoder();
  const partes = []; const central = []; let off = 0;
  const d = new Date();
  const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const fecha = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  archivos.forEach(({ nombre, texto, datos }) => {
    const n = enc.encode(nombre), b = datos instanceof Uint8Array ? datos : enc.encode(texto), c = crc32(b);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, hora, true); h.setUint16(12, fecha, true); h.setUint32(14, c, true); h.setUint32(18, b.length, true); h.setUint32(22, b.length, true);
    h.setUint16(26, n.length, true); h.setUint16(28, 0, true);
    partes.push(new Uint8Array(h.buffer), n, b);
    const e = new DataView(new ArrayBuffer(46));
    e.setUint32(0, 0x02014b50, true); e.setUint16(4, 20, true); e.setUint16(6, 20, true); e.setUint16(8, 0x0800, true); e.setUint16(10, 0, true);
    e.setUint16(12, hora, true); e.setUint16(14, fecha, true); e.setUint32(16, c, true); e.setUint32(20, b.length, true); e.setUint32(24, b.length, true);
    e.setUint16(28, n.length, true); e.setUint32(42, off, true);
    central.push(new Uint8Array(e.buffer), n);
    off += 30 + n.length + b.length;
  });
  const tam = central.reduce((s, x) => s + x.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tam, true); fin.setUint32(16, off, true);
  return new Blob(partes.concat(central, [new Uint8Array(fin.buffer)]), { type: 'application/zip' });
}

/* Guarda un archivo con la capacidad de descargas. Extensiones fuera de la lista del visor
   (.doc, .xls, .vsdx…) van dentro de un .zip. */
const PERMITIDAS = ['gif', 'png', 'jpg', 'jpeg', 'webp', 'mp4', 'webm', 'txt', 'json', 'md', 'docx', 'pptx', 'epub', 'csv', 'ttf', 'html', 'svg', 'pdf', 'xlsx', 'zip'];
/* Fuera del artifact (el archivo abierto en el navegador, o la app): descarga normal, con su extensión. */
function bajarDirecto(filename, data) {
  try {
    const blob = data instanceof Blob ? data : new Blob([data instanceof Uint8Array ? data : String(data)]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return { ok: true, nombre: filename };
  } catch (e) {
    return { ok: false, msg: 'No se pudo descargar. Vuelve a intentarlo.' };
  }
}
export async function descargar(filename, data) {
  const dl = await usar('downloads');
  if (!dl) return bajarDirecto(filename, data);
  let nombre = filename, cuerpo = data;
  const ext = (String(filename).split('.').pop() || '').toLowerCase();
  if (PERMITIDAS.indexOf(ext) < 0) {
    const bytes = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
    cuerpo = zip([{ nombre: filename, datos: bytes }]);
    nombre = filename.replace(/\.[^.]*$/, '') + '.zip';
  }
  try { await dl.save({ filename: nombre, data: cuerpo }); return { ok: true, nombre }; }
  catch (e) {
    const c = e && e.code;
    if (c === 'declined') return { ok: false, msg: '' };
    if (c === 'rate_limited') return { ok: false, msg: 'Ya hay una descarga pendiente de confirmar.' };
    if (c === 'too_large') return { ok: false, msg: 'El archivo es demasiado grande para descargarlo aquí. Prueba sin anexos.' };
    if (c === 'extension_not_enabled' || c === 'rejected_extension') return { ok: false, msg: 'Este formato no se puede descargar aquí.' };
    return { ok: false, msg: 'No se pudo descargar. Vuelve a intentarlo.' };
  }
}

export const nombreArchivo = s => (String(s || 'proceso').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'proceso');

/* Copiar al portapapeles; si el navegador no deja (vista incrustada), con una selección. */
export async function copiarTexto(texto) {
  try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(texto); return true; } } catch (e) { /* sigue */ }
  try {
    const t = document.createElement('textarea');
    t.value = texto; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(t); t.select();
    const ok = document.execCommand && document.execCommand('copy');
    t.remove();
    return !!ok;
  } catch (e) { return false; }
}

// ---------- capacidades ----------
export async function usar(nombre) {
  try { return window.claude && window.claude.use ? await window.claude.use(nombre) : null; } catch (e) { return null; }
}

export const TEXTO_ERROR_IA = {
  not_granted: 'No diste permiso para usar Claude en esta página.',
  sampling_disabled: 'Claude no está disponible para tu cuenta aquí.',
  rate_limited: 'Demasiadas consultas seguidas. Espera un momento y vuelve a intentarlo.',
  session_expired: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  refused: 'Claude no quiso procesar este texto. Revisa las notas.',
  prompt_too_large: 'Las notas son demasiado largas. Pega una parte cada vez.',
  invalid_json: 'La respuesta no vino en el formato esperado. Vuelve a intentarlo.',
  empty_completion: 'Claude no devolvió nada. Prueba con notas más concretas.',
  cancelled: '',
};
export const textoErrorIA = e => (e && TEXTO_ERROR_IA[e.code] != null ? TEXTO_ERROR_IA[e.code] : 'No se pudo completar la consulta. Vuelve a intentarlo.');

// ---------- prompts ----------
export function promptActividades(proc, notas, existentes) {
  return [
    'Eres analista de procesos. Convierte las notas de una entrevista en un BORRADOR de actividades para revisar.',
    'Reglas estrictas:',
    '- Escribe en español. Cada actividad se nombra con verbo en infinitivo + objeto («Validar solicitud», «Descargar extracto»).',
    '- Incluye solo actividades que las notas describen. No agregues pasos «típicos» que no aparecen.',
    '- Llena un campo solo si las notas lo dicen explícitamente. Si no, pon null. NUNCA inventes responsables, reglas, duraciones, frecuencias ni conexiones.',
    '- Tiempos: número en la unidad que digan las notas (unidad "min", "h" o "días"); si no lo dicen, null.',
    '- "evidencia": la frase literal de las notas que respalda la actividad (máximo 160 caracteres).',
    '- En el orden en que ocurren según las notas.',
    '- "preguntas": lo que falta saber para completar el proceso (responsables, entregables, criterios, tiempos, qué pasa cuando algo falla). Máximo 8, en forma de pregunta.',
    '- No repitas estas actividades ya capturadas: ' + (existentes.length ? existentes.map(n => '«' + n + '»').join(', ') : '(ninguna)') + '.',
    '',
    'Proceso: ' + proc.nombre + (proc.objetivo ? ' — objetivo: ' + proc.objetivo : ''),
    '',
    'Responde SOLO con JSON con esta forma:',
    '{"actividades":[{"nombre":"Validar solicitud","descripcion":null,"responsable":null,"entradas":null,"entregable":null,"receptor":null,"herramientas":null,"tProceso":null,"tEspera":null,"unidad":"h","frecuencia":null,"evidencia":"…"}],"preguntas":["¿Quién valida la solicitud?"]}',
    '',
    'NOTAS:',
    notas.slice(0, 24000),
  ].join('\n');
}

export function promptDecisiones(proc, notas, seq) {
  const lista = seq.filter(s => s.numero != null).map(s => s.clave + ' = ' + s.codigo + ' ' + s.nombre).join('\n');
  return [
    'Eres analista de procesos. Busca en las notas de entrevista las DECISIONES del proceso: puntos donde el camino depende de una condición.',
    'Reglas estrictas:',
    '- Solo decisiones que las notas describen de forma explícita. Si no hay ninguna, devuelve una lista vacía.',
    '- "origen" y cada "destino" deben ser una de las claves de la lista de actividades, "__fin" si ese camino termina el proceso, o null si las notas no lo dicen. NUNCA inventes claves ni actividades.',
    '- "tipo": "exclusiva" (solo un camino), "inclusiva" (uno o varios) o "paralela" (todos a la vez).',
    '- "clase" de cada salida: null, "retrabajo", "rechazo", "cancelacion" o "excepcion".',
    '- "decide": el rol o sistema que decide, solo si las notas lo dicen; si no, null.',
    '- "evidencia": la frase literal que la respalda (máximo 160 caracteres).',
    '',
    'Proceso: ' + proc.nombre,
    'Actividades (clave = número y nombre):',
    lista || '(ninguna)',
    '',
    'Responde SOLO con JSON:',
    '{"decisiones":[{"pregunta":"¿La solicitud está completa?","origen":"a_x","decide":null,"tipo":"exclusiva","salidas":[{"condicion":"Completa","destino":"a_y","clase":null},{"condicion":"Falta información","destino":"a_z","clase":"retrabajo"}],"evidencia":"…"}]}',
    '',
    'NOTAS:',
    notas.slice(0, 24000),
  ].join('\n');
}

// ---------- almacenamiento en este navegador ----------
/* Misma forma que la colección del servidor (onSnapshot / doc().set / delete), pero
   guardada en localStorage de este navegador. Sin localStorage, queda en memoria. */
export function almacenLocal(semilla) {
  const CLAVE = 'kaze-captura:procesos:v1';
  let persistente = true;
  let datos = null;
  try { const raw = window.localStorage.getItem(CLAVE); datos = raw ? JSON.parse(raw) : null; } catch (e) { persistente = false; }
  const subs = [];
  const guardar = () => { try { window.localStorage.setItem(CLAVE, JSON.stringify(datos)); } catch (e) { persistente = false; } };
  if (!datos || typeof datos !== 'object') { datos = {}; if (semilla) datos[semilla.id] = JSON.parse(JSON.stringify(semilla)); guardar(); }
  const snap = () => ({ docs: Object.keys(datos).map(id => ({ id, exists: true, data: () => JSON.parse(JSON.stringify(datos[id])) })) });
  const avisar = () => setTimeout(() => subs.slice().forEach(f => f(snap())), 0);
  try {
    window.addEventListener('storage', e => {
      if (e.key !== CLAVE) return;
      try { datos = JSON.parse(e.newValue) || {}; avisar(); } catch (err) { /* ignorar */ }
    });
  } catch (e) { /* sin eventos */ }
  return {
    persistente: () => persistente,
    restablecerEjemplo: () => { if (semilla) { datos[semilla.id] = JSON.parse(JSON.stringify(semilla)); guardar(); avisar(); } },
    collection: () => ({
      onSnapshot: n => { subs.push(n); setTimeout(() => n(snap()), 0); return () => { const i = subs.indexOf(n); if (i >= 0) subs.splice(i, 1); }; },
      doc: id => ({
        set: async d => { datos[id] = JSON.parse(JSON.stringify(d)); guardar(); avisar(); },
        delete: async () => { delete datos[id]; guardar(); avisar(); },
      }),
    }),
  };
}
