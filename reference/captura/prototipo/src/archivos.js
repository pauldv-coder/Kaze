/* Formatos adjuntos: los archivos se guardan en IndexedDB de este navegador; el proceso
   solo guarda { id, nombre, tipo, tamano }. Sin IndexedDB quedan en memoria (se pierden al recargar). */
import { uid, ahora } from './model.js';

const BASE = 'kaze-captura';
const TABLA = 'archivos';
let promesa = null;
const memoria = new Map();
let persistente = true;

function abrir() {
  if (promesa) return promesa;
  promesa = new Promise(res => {
    try {
      if (!window.indexedDB) { persistente = false; res(null); return; }
      const r = window.indexedDB.open(BASE, 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(TABLA)) r.result.createObjectStore(TABLA, { keyPath: 'id' }); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => { persistente = false; res(null); };
      r.onblocked = () => { persistente = false; res(null); };
    } catch (e) { persistente = false; res(null); }
  });
  return promesa;
}
const tx = (db, modo, fn) => new Promise((res, rej) => {
  const t = db.transaction(TABLA, modo);
  const st = t.objectStore(TABLA);
  let valor;
  Promise.resolve(fn(st, v => { valor = v; })).catch(rej);
  t.oncomplete = () => res(valor);
  t.onerror = () => rej(t.error);
  t.onabort = () => rej(t.error);
});

export const archivosPersistentes = () => persistente;
export const MAX_ARCHIVO = 25 * 1024 * 1024;

export async function guardarArchivo(file) {
  const meta = { id: uid('arch'), nombre: file.name || 'archivo', tipo: file.type || '', tamano: file.size || 0 };
  const rec = Object.assign({ blob: file, creado: ahora() }, meta);
  const db = await abrir();
  if (!db) { memoria.set(meta.id, rec); return meta; }
  try { await tx(db, 'readwrite', st => { st.put(rec); }); }
  catch (e) { persistente = false; memoria.set(meta.id, rec); }
  return meta;
}

export async function leerArchivo(id) {
  if (memoria.has(id)) return memoria.get(id);
  const db = await abrir();
  if (!db) return null;
  try {
    return await tx(db, 'readonly', (st, fin) => { const r = st.get(id); r.onsuccess = () => fin(r.result || null); });
  } catch (e) { return null; }
}

/* Al abrir la app: borra archivos que ya ningún proceso guardado menciona. */
export async function limpiarArchivos(idsUsados) {
  const usados = new Set(idsUsados);
  const db = await abrir();
  if (!db) return 0;
  let n = 0;
  try {
    await tx(db, 'readwrite', st => new Promise(res => {
      const c = st.openCursor();
      c.onsuccess = () => {
        const cur = c.result;
        if (!cur) { res(); return; }
        if (!usados.has(cur.key)) { cur.delete(); n += 1; }
        cur.continue();
      };
      c.onerror = () => res();
    }));
  } catch (e) { /* sin limpieza */ }
  return n;
}

export function idsDeArchivos(procesos) {
  const ids = [];
  (procesos || []).forEach(p => ['asis', 'tobe'].forEach(v => {
    const m = p && p.versiones && p.versiones[v];
    if (!m) return;
    Object.values(m.actividades || {}).forEach(a => (a.formatos || []).forEach(f => { if (f.archivo && f.archivo.id) ids.push(f.archivo.id); }));
  }));
  return ids;
}

export function tamanoLegible(b) {
  if (!(b > 0)) return '0 KB';
  if (b < 1024 * 1024) return Math.max(1, Math.round(b / 1024)) + ' KB';
  return (b / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB';
}
