/* Aprobación por correo, sin servidor.
   · Cada contacto tiene un código: prefijo del proceso + su número + 4 caracteres de verificación
     (CBM-03-K7QX). Con él se identifica al responder; el número solo no basta para hacerse pasar
     por otra persona.
   · La solicitud tiene etapas: visto bueno de las áreas (opcional) y aprobación final.
   · La persona recibe la «fotografía» del proceso (un archivo HTML), escribe su código, aprueba o
     pide cambios, y su respuesta vuelve por correo con un código KZR1.… que aquí se registra. */
import { uid, ahora, tieneValor, estadoAprobacion } from './model.js';

export const PAPELES = [['', 'Sin papel'], ['elabora', 'Elabora (R)'], ['vobo', 'Da visto bueno (C)'], ['aprueba', 'Aprueba (A)'], ['informado', 'Informado (I)']];
export const NOMBRE_PAPEL = { elabora: 'Elabora', vobo: 'Da visto bueno', aprueba: 'Aprueba', informado: 'Informado' };
export const ETAPAS = { vobo: { titulo: 'Visto bueno de las áreas', corto: 'Visto bueno', verbo: 'da su visto bueno', si: 'vobo' }, final: { titulo: 'Aprobación final', corto: 'Aprobación', verbo: 'aprueba', si: 'aprobado' } };

/* ---------- códigos ---------- */
const PALABRAS_VACIAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'a', 'al', 'en', 'para', 'por', 'con', 'un', 'una', 'o', 'u']);
export function prefijoProceso(nombre) {
  const ps = String(nombre || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ')
    .split(/\s+/).filter(w => w && !PALABRAS_VACIAS.has(w.toLowerCase()));
  if (!ps.length) return 'PRC';
  if (ps.length === 1) return ps[0].slice(0, 3);
  return ps.slice(0, 4).map(w => w[0]).join('');
}
/* cyrb53: hash de 53 bits. El mismo algoritmo va dentro de la fotografía. */
export function hash53(str, seed) {
  let h1 = 0xdeadbeef ^ (seed || 0), h2 = 0x41c6ce57 ^ (seed || 0);
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
const ALFA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function codigoContacto(proc, c) {
  let h = hash53(proc.id + ':' + c.id + ':kaze');
  let v = '';
  for (let i = 0; i < 4; i++) { v += ALFA[h % 32]; h = Math.floor(h / 32); }
  return prefijoProceso(proc.nombre) + '-' + String(c.num || 0).padStart(2, '0') + '-' + v;
}
export const normalizarCodigo = t => String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const correoValido = c => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(c || '').trim());
export const iniciales = n => String(n || '?').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();

/* ---------- solicitud ---------- */
export function nuevaSolicitud(proc, m, sel) {
  const persona = id => {
    const c = (proc.participantes || []).find(x => x.id === id);
    if (!c) return null;
    return { id: c.id, nombre: tieneValor(c.nombre) ? c.nombre : 'Sin nombre', cargo: c.rol || '', area: c.departamento || '', correo: (c.correo || '').trim(),
      codigo: codigoContacto(proc, c), estado: 'pendiente', fecha: null, comentario: null, via: null, preparado: null };
  };
  const etapas = [];
  if (sel.conVobo && sel.vobo.length) etapas.push({ tipo: 'vobo', titulo: ETAPAS.vobo.titulo, personas: sel.vobo.map(persona).filter(Boolean) });
  etapas.push({ tipo: 'final', titulo: ETAPAS.final.titulo, personas: sel.final.map(persona).filter(Boolean) });
  return { id: uid('ap'), version: m.numero, solicitada: ahora(), remitente: sel.remitente || null, etapas };
}
/* Etapa en curso: la primera que no está completa. */
export function etapaEnCurso(ap) {
  if (!ap || !ap.etapas) return -1;
  const i = ap.etapas.findIndex(e => !(e.personas.length && e.personas.every(x => x.estado === 'aprobado')));
  return i;
}
export function estadoEtapa(ap, i) {
  const e = ap.etapas[i];
  if (e.personas.some(x => x.estado === 'cambios')) return 'cambios';
  if (e.personas.length && e.personas.every(x => x.estado === 'aprobado')) return 'completa';
  const actual = etapaEnCurso(ap);
  return i === actual ? 'activa' : i < actual ? 'completa' : 'espera';
}

/* Registrar una respuesta (por código o a mano). Devuelve lo que cambió de estado. */
export function registrarRespuesta(p, m, r) {
  const ap = m.aprobacion;
  const et = ap.etapas[r.etapa];
  const per = et && et.personas.find(x => x.id === r.persona);
  if (!per) return null;
  per.estado = r.decision;
  per.fecha = r.fecha || ahora();
  per.comentario = r.comentario ? String(r.comentario).trim() : null;
  per.via = r.via || 'manual';
  if (r.decision === 'cambios') {
    p.preguntas = p.preguntas || [];
    p.preguntas.push({ id: uid('q'), texto: per.nombre + (per.cargo ? ' (' + per.cargo + ')' : '') + ' pide: ' + (per.comentario || 'cambios sin detallar'), origen: 'aprobacion', resuelta: false, fecha: ahora() });
  }
  const antes = m.estado;
  m.estado = estadoAprobacion(ap);
  if (m.estado === 'aprobado' && antes !== 'aprobado') {
    const nombres = t => ap.etapas.filter(e => e.tipo === t).reduce((a, e) => a.concat(e.personas.map(x => x.nombre + (x.cargo ? ' (' + x.cargo + ')' : ''))), []);
    m.historial = m.historial || [];
    m.historial.push({ numero: m.numero, fecha: ahora(), aprobadores: nombres('final'), vobo: nombres('vobo') });
  }
  return { estado: m.estado, persona: per };
}

/* ---------- código de respuesta ---------- */
const b64uDec = s => {
  let t = s.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  const bin = atob(t);
  let esc = '';
  for (let i = 0; i < bin.length; i++) esc += '%' + ('0' + bin.charCodeAt(i).toString(16)).slice(-2);
  return decodeURIComponent(esc);
};
export const b64uEnc = s => {
  const utf = unescape(encodeURIComponent(s));
  return btoa(utf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export function codificarRespuesta(d) {
  const cuerpo = b64uEnc(JSON.stringify(d));
  return 'KZR1.' + cuerpo + '.' + hash53(cuerpo).toString(36);
}
/* Busca el código en lo pegado (el correo entero o solo el código). */
export function leerRespuesta(texto) {
  const t = String(texto || '');
  const i = t.indexOf('KZR1.');
  if (i < 0) return { error: 'No encontré un código de respuesta (empieza con KZR1.). Pega el correo completo o solo el código.' };
  let resto = t.slice(i + 5);
  const fin = resto.search(/\n\s*[-—]{3}|\n\s*Fin del c[oó]digo|\n\s*\n/);
  if (fin >= 0) resto = resto.slice(0, fin);
  const limpio = resto.replace(/[^A-Za-z0-9_\-.]/g, '');
  const k = limpio.lastIndexOf('.');
  if (k < 1) return { error: 'El código está incompleto: pídele a la persona que te reenvíe su respuesta.' };
  const cuerpo = limpio.slice(0, k), chk = limpio.slice(k + 1);
  if (hash53(cuerpo).toString(36) !== chk) return { error: 'El código llegó incompleto o con un cambio: pídele a la persona que te reenvíe su respuesta.' };
  try {
    const d = JSON.parse(b64uDec(cuerpo));
    if (!d || d.a !== 'kzr1') return { error: 'No es un código de respuesta de Kaze.' };
    return { datos: d };
  } catch (e) { return { error: 'No pude leer el código: pídele a la persona que te reenvíe su respuesta.' }; }
}
/* Comprueba que la respuesta sea de este proceso, esta versión y esta ronda, y dice de quién es. */
export function interpretarRespuesta(proc, m, version, texto) {
  const r = leerRespuesta(texto);
  if (r.error) return r;
  const d = r.datos;
  const ap = m.aprobacion;
  const etq = (version === 'tobe' ? 'To-Be' : 'As-Is') + ' v' + m.numero;
  if (d.p !== proc.id) return { error: 'Esta respuesta es de otro proceso' + (d.pn ? ': «' + d.pn + '»' : '') + '.' };
  if (d.v !== version || d.n !== m.numero) return { error: 'Esta respuesta es de ' + (d.v === 'tobe' ? 'To-Be' : 'As-Is') + ' v' + d.n + '; la versión en revisión es ' + etq + '.' };
  if (!ap || m.estado !== 'revision') return { error: etq + ' no está en revisión: no hay respuestas por registrar.' };
  if (d.r !== ap.id) return { error: 'Esta respuesta es de un envío anterior de ' + etq + '. Pídele a la persona que responda con la fotografía más reciente.' };
  const ie = ap.etapas.findIndex(e => e.tipo === d.e);
  if (ie < 0) return { error: 'Esta respuesta es de una etapa que este envío no tiene.' };
  const cod = String(d.c || '');
  const per = ap.etapas[ie].personas.find(x => x.codigo && x.codigo.replace(/[^A-Z0-9]/g, '') === cod.replace(/[^A-Z0-9]/g, ''));
  if (!per) return { error: 'El código ' + cod + ' no corresponde a nadie de la etapa «' + ap.etapas[ie].titulo + '».' };
  if (per.estado !== 'pendiente') return { error: per.nombre + ' ya respondió' + (per.fecha ? ' el ' + new Date(per.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : '') + '.' };
  const actual = etapaEnCurso(ap);
  if (ie > actual) return { error: 'La etapa «' + ap.etapas[ie].titulo + '» aún no está abierta: faltan respuestas de la etapa anterior.' };
  const decision = d.d === 'cambios' ? 'cambios' : 'aprobado';
  if (decision === 'cambios' && !String(d.m || '').trim()) return { error: 'La respuesta pide cambios pero no dice cuáles.' };
  return { etapa: ie, persona: per, decision, comentario: d.m || null, fecha: d.f || null };
}

/* ---------- correos ---------- */
const etiquetaV = (version, m) => (version === 'tobe' ? 'To-Be' : 'As-Is') + ' v' + m.numero;
export function nombreFotografia(proc, m, version, tipo) {
  const base = ['Aprobación', tieneValor(proc.codigoDoc) ? proc.codigoDoc : null, proc.nombre || 'Proceso'].filter(Boolean).join(' ') + ' - ' + etiquetaV(version, m) + (tipo === 'vobo' ? ' - visto bueno' : '');
  return base.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140) + '.html';
}
export function correoInvitacion(proc, m, version, ap, etapa, persona) {
  const et = ETAPAS[etapa.tipo] || ETAPAS.final;
  const ref = '«' + (proc.nombre || 'Proceso') + '» (' + [tieneValor(proc.codigoDoc) ? proc.codigoDoc : null, etiquetaV(version, m)].filter(Boolean).join(' · ') + ')';
  const nombre = String(persona.nombre || '').split(/\s+/)[0] || '';
  const firma = ap.remitente && ap.remitente.nombre ? ap.remitente.nombre : '';
  const cuerpo = [
    'Hola' + (nombre ? ' ' + nombre : '') + ':',
    '',
    'Te comparto el proceso ' + ref + ' para tu ' + (etapa.tipo === 'vobo' ? 'visto bueno' : 'aprobación') + '.',
    '',
    '1. Abre en tu navegador el archivo adjunto «' + nombreFotografia(proc, m, version, etapa.tipo) + '».',
    '2. Escribe tu código: ' + persona.codigo,
    '3. Revisa el proceso. Si estás de acuerdo, ' + (etapa.tipo === 'vobo' ? 'da tu visto bueno' : 'apruébalo') + '; si no, escribe los cambios que pides. Luego envía tu respuesta: me llega por correo.',
    '',
    'Gracias' + (firma ? ',\n' + firma : '.'),
  ].join('\n');
  return { para: persona.correo || '', asunto: et.corto + ': ' + (proc.nombre || 'Proceso') + ' (' + etiquetaV(version, m) + ')', cuerpo };
}
export function correoInformados(proc, m, version, correos, remitente) {
  const cuerpo = ['Hola:', '', 'El proceso «' + (proc.nombre || 'Proceso') + '» (' + [tieneValor(proc.codigoDoc) ? proc.codigoDoc : null, etiquetaV(version, m)].filter(Boolean).join(' · ') + ') quedó aprobado. Te adjunto el procedimiento para que lo tengas en cuenta.', '', 'Gracias' + (remitente && remitente.nombre ? ',\n' + remitente.nombre : '.')].join('\n');
  return { para: '', cco: correos.join(','), asunto: 'Proceso aprobado: ' + (proc.nombre || 'Proceso') + ' (' + etiquetaV(version, m) + ')', cuerpo };
}
export function enlacesCorreo(c) {
  const q = (k, v) => (v ? k + '=' + encodeURIComponent(v) : null);
  const mailto = 'mailto:' + encodeURIComponent(c.para || '').replace(/%40/g, '@').replace(/%2C/g, ',') + '?' + [q('subject', c.asunto), q('bcc', c.cco), q('body', c.cuerpo.replace(/\n/g, '\r\n'))].filter(Boolean).join('&');
  const gmail = 'https://mail.google.com/mail/?' + ['view=cm', 'fs=1', q('to', c.para), q('bcc', c.cco), q('su', c.asunto), q('body', c.cuerpo)].filter(Boolean).join('&');
  const outlook = 'https://outlook.office.com/mail/deeplink/compose?' + [q('to', c.para), q('bcc', c.cco), q('subject', c.asunto), q('body', c.cuerpo)].filter(Boolean).join('&');
  return { mailto, gmail, outlook };
}
export const textoCorreo = c => [c.para ? 'Para: ' + c.para : null, c.cco ? 'CCO: ' + c.cco : null, 'Asunto: ' + c.asunto, '', c.cuerpo].filter(x => x !== null).join('\n');
