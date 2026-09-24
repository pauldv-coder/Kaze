/* Modelo de datos del prototipo de captura de procesos.
   Un proceso = ficha + versiones (As-Is y To-Be). Cada versión guarda fases (con el
   orden de claves de actividad), la columna «Sin fase», las actividades por clave y
   las decisiones. El número visible de una actividad nunca se guarda: se calcula.

   Portado de `reference/captura/prototipo/src/model.js` (Task 1.3 del plan de captura).
   Cambios frente al prototipo, y solo estos (§4.3 del spec: el documento se guarda como
   jsonb; `numero`/`estado` de cada versión viven en columnas o se derivan de las tablas de
   aprobación; `aprobacion`/`historial` salen de tablas; `id`, `creado`, `actualizado`,
   `rev`, `sesion` y `remitente` viven en columnas o en la sesión):
   · `K().secuenciaActividades` / `K().revisarDecision` → imports de `./secuencia`.
   · `uid` con `crypto.getRandomValues`.
   · `nuevoModelo` devuelve un `Version`; `nuevoProceso(datos)` → `nuevoDocumento(nombre)`.
   · `crearTobe` no fija numero/estado/aprobacion/historial (los quita si venían).
   · `estadoAprobacion` pasa a `aprobacion.ts`; `bloqueada` recibe el estado.
   · `normalizarProceso` ya no migra la aprobación vieja, no calcula `num` ni agrega
     `remitente`; asegura `verif` y `numSiguiente`.
   · Nuevos: `nuevoVerif`, `nuevoContacto`, `conInfoDeVersiones`, `sinInfoDeVersiones`.
   · `relativo` y `fechaCorta` calculan el día en `America/Bogota`. */

import { TZ } from '@/lib/data/metrics'
import { secuenciaActividades, revisarDecision } from './secuencia'
import type { ActividadEnFase, ActividadSecuenciada, FaseEnTablero, MotivoRevision } from './secuencia'
import type {
  Actividad, Ciclo, Contacto, Decision, Diagrama, EstadoVersion, Evento, Fase, Formato,
  ProcesoDoc, ProcesoVista, Referencia, Texto, TipoEvento, Version, VersionId, VersionVista,
} from './tipos'

export const uid = (p = 'k'): string => {
  // Misma forma que el prototipo: prefijo + '_' + 7 caracteres base 36 + 3 del reloj.
  const b = new Uint8Array(7)
  crypto.getRandomValues(b)
  return p + '_' + Array.from(b, x => (x % 36).toString(36)).join('') + Date.now().toString(36).slice(-3)
}

export const ahora = (): string => new Date().toISOString()

export const DESCONOCIDO = 'desconocido'
export const NA = 'na'
export const esEspecial = (v: unknown): v is typeof DESCONOCIDO | typeof NA => v === DESCONOCIDO || v === NA
export const tieneValor = (v: unknown): boolean => v != null && v !== '' && !esEspecial(v)

/* Texto que se escribe en una celda → valor guardado. «?» = desconocido,
   «n/a» = no aplica, vacío = sin respuesta, «0» = cero. */
export function leerTexto(t: unknown): string | null {
  const s = String(t ?? '').trim()
  if (s === '') return null
  if (s === '?') return DESCONOCIDO
  if (/^n\s*\/?\s*a$/i.test(s)) return NA
  return s
}
export function leerNumero(t: unknown): number | string | null {
  const v = leerTexto(t)
  if (v == null || esEspecial(v)) return v
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : v
}
export function mostrarTexto(v: unknown): string {
  if (v == null) return ''
  if (v === DESCONOCIDO) return '?'
  if (v === NA) return 'N/A'
  if (typeof v === 'number') return v.toLocaleString('es-CO')
  return String(v)
}

/* Quién ejecuta la actividad: da el tipo de tarea BPMN y el ícono del diagrama. */
export const EJECUCION: [Actividad['ejecucion'], string][] = [['persona', 'Persona'], ['sistema', 'Sistema'], ['automatizacion', 'IA o automatización']]

export function nuevaActividad(nombre?: string | null, extra?: Partial<Actividad> | null): Actividad {
  const base: Actividad = {
    clave: uid('a'), nombre: nombre || 'Nueva actividad', descripcion: null,
    responsable: null, departamento: null, apoyo: null, ejecucion: 'persona',
    entradas: null, entregable: null, receptor: null, receptorExterno: false, criterio: null,
    tProceso: null, tEspera: null, unidad: 'h', frecuencia: null,
    herramientas: null, documentos: null, reglas: null, problemas: null,
    formatos: [], eventos: [], ciclo: null, relato: null,
    fuente: null, evidencia: null, estado: 'confirmado', origenClave: null,
  }
  return Object.assign(base, extra || {})
}

/* ---------- eventos de una actividad ----------
   Esperas antes o después (temporizador, fecha, mensaje, condición), avisos que salen al
   terminar, y eventos de borde mientras se ejecuta (límite de tiempo, error). */
export interface TipoEventoInfo { nombre: string; corto: string; momentos: Evento['momento'][] }
export const TIPOS_EVENTO: Record<TipoEvento, TipoEventoInfo> = {
  tiempo: { nombre: 'Espera un tiempo', corto: 'Espera', momentos: ['antes', 'despues'] },
  fecha: { nombre: 'Espera una fecha u hora', corto: 'Hasta', momentos: ['antes', 'despues'] },
  mensaje: { nombre: 'Espera un mensaje o respuesta', corto: 'Mensaje', momentos: ['antes', 'despues'] },
  condicion: { nombre: 'Espera a que se cumpla una condición', corto: 'Condición', momentos: ['antes', 'despues'] },
  aviso: { nombre: 'Envía un aviso al terminar', corto: 'Aviso', momentos: ['despues'] },
  hito: { nombre: 'Marca un hito al terminar', corto: 'Hito', momentos: ['despues'] },
  limite: { nombre: 'Límite de tiempo mientras se hace', corto: 'Límite', momentos: ['durante'] },
  error: { nombre: 'Si ocurre un error o excepción', corto: 'Error', momentos: ['durante'] },
}
export function nuevoEvento(tipo: TipoEvento, momento?: Evento['momento'] | null): Evento {
  return { id: uid('e'), tipo, momento: momento || TIPOS_EVENTO[tipo].momentos[0], texto: null, n: null, unidad: tipo === 'limite' ? 'días' : 'h',
    quien: null, externo: false, destino: null, interrumpe: true }
}
const durTxt = (e: Evento): string => (typeof e.n === 'number' ? String(e.n).replace('.', ',') + ' ' + (e.unidad || 'h') : '? ' + (e.unidad || 'h'))
/* Nombre corto para el diagrama. */
export function nombreEvento(e: Evento): string {
  if (tieneValor(e.texto)) return String(e.texto)
  switch (e.tipo) {
    case 'tiempo': return 'Esperar ' + durTxt(e)
    case 'fecha': return 'Fecha programada'
    case 'mensaje': return tieneValor(e.quien) ? 'Respuesta de ' + e.quien : 'Mensaje recibido'
    case 'condicion': return 'Condición cumplida'
    case 'aviso': return tieneValor(e.quien) ? 'Aviso a ' + e.quien : 'Aviso enviado'
    case 'hito': return 'Hito'
    case 'limite': return durTxt(e)
    case 'error': return 'Error'
    default: return ''
  }
}
/* Frase completa para la ficha y el documento. */
export function fraseEvento(e: Evento, rotuloDestino?: ((destino: string) => string) | null): string {
  const dest = e.destino ? (rotuloDestino ? rotuloDestino(e.destino) : e.destino) : 'sin definir'
  switch (e.tipo) {
    case 'tiempo': return (e.momento === 'antes' ? 'Antes de empezar espera ' : 'Al terminar espera ') + durTxt(e) + (tieneValor(e.texto) ? ' (' + e.texto + ')' : '') + '.'
    case 'fecha': return (e.momento === 'antes' ? 'Antes de empezar espera hasta ' : 'Al terminar espera hasta ') + (tieneValor(e.texto) ? e.texto : 'una fecha por definir') + '.'
    case 'mensaje': return (e.momento === 'antes' ? 'Antes de empezar espera ' : 'Al terminar espera ') + (tieneValor(e.texto) ? '«' + e.texto + '»' : 'un mensaje') + (tieneValor(e.quien) ? ' de ' + e.quien : '') + '.'
    case 'condicion': return (e.momento === 'antes' ? 'Antes de empezar espera a que ' : 'Al terminar espera a que ') + (tieneValor(e.texto) ? e.texto : 'se cumpla una condición por definir') + '.'
    case 'aviso': return 'Al terminar avisa' + (tieneValor(e.quien) ? ' a ' + e.quien : '') + (tieneValor(e.texto) ? ': «' + e.texto + '»' : '') + '.'
    case 'hito': return 'Al terminar se cumple el hito ' + (tieneValor(e.texto) ? '«' + e.texto + '»' : 'por nombrar') + '.'
    case 'limite': return 'Si en ' + durTxt(e) + ' no ha terminado' + (e.interrumpe ? ', se detiene' : ', sigue en paralelo') + ' y pasa a ' + dest + '.'
    case 'error': return 'Si ' + (tieneValor(e.texto) ? e.texto : 'ocurre un error') + ', se detiene y pasa a ' + dest + '.'
    default: return ''
  }
}
/* Duración ISO 8601 para el XML (PT24H, P3D, PT30M). */
export function duracionISO(e: Evento): string | null {
  if (typeof e.n !== 'number' || !(e.n > 0)) return null
  if (e.unidad === 'min') return 'PT' + e.n + 'M'
  if (e.unidad === 'días') return 'P' + e.n + 'D'
  return 'PT' + e.n + 'H'
}
export const CICLOS: [Ciclo['tipo'], string][] = [['', 'Se hace una vez'], ['repite', 'Se repite hasta cumplir una condición'], ['porCada', 'Se hace por cada elemento']]
export function fraseCiclo(c: Ciclo | null | undefined): string | null {
  if (!c || !c.tipo) return null
  if (c.tipo === 'repite') return 'Se repite' + (tieneValor(c.condicion) ? ' ' + c.condicion : ' hasta cumplir una condición por definir') + '.'
  return 'Se hace por cada ' + (tieneValor(c.condicion) ? c.condicion : 'elemento') + (c.paralelo ? ', todos a la vez' : ', uno tras otro') + '.'
}

/* ---------- formatos adjuntos ---------- */
export function nuevoFormato(extra?: Partial<Formato> | null): Formato {
  const base: Formato = { id: uid('fm'), nombre: '', codigo: null, version: null, archivo: null, enlace: null }
  return Object.assign(base, extra || {})
}
/** Un formato de la versión, sin repetir, con las claves de las actividades que lo usan. */
export interface FormatoDelModelo {
  llave: string; codigo: Formato['codigo']; nombre: string; version: Formato['version']
  archivo: Formato['archivo']; enlace: Formato['enlace']; actividades: string[]
}
/* Todos los formatos de una versión, sin repetir (por código o nombre), con las actividades que los usan. */
export function formatosDelModelo(m: Version): FormatoDelModelo[] {
  const seq = secuencia(m)
  const out: FormatoDelModelo[] = []
  seq.forEach(s => {
    const a = m.actividades[s.clave]
    ;(a && a.formatos || []).forEach(f => {
      const llave = normalizarTexto(f.codigo || f.nombre)
      if (!llave) return
      let x = out.find(y => y.llave === llave)
      if (!x) { x = { llave, codigo: f.codigo, nombre: f.nombre, version: f.version, archivo: f.archivo, enlace: f.enlace, actividades: [] }; out.push(x) }
      if (!x.archivo && f.archivo) x.archivo = f.archivo
      if (!x.enlace && f.enlace) x.enlace = f.enlace
      if (x.actividades.indexOf(s.clave) < 0) x.actividades.push(s.clave)
    })
  })
  return out
}
export const normalizarTexto = (t: unknown): string => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

/* ---------- inicio del proceso y referencias ---------- */
export const TIPOS_INICIO: [ProcesoDoc['inicio']['tipo'], string][] = [['ninguno', 'Alguien lo inicia'], ['mensaje', 'Llega una solicitud o mensaje'], ['tiempo', 'Programado (fecha o periodo)'], ['condicion', 'Se cumple una condición']]
export const TIPOS_REFERENCIA: [Referencia['tipo'], string][] = [['interna', 'Documento interno'], ['externa', 'Norma o documento externo'], ['ley', 'Ley o regulación'], ['otra', 'Otra']]

// Formas laxas de lo que `normalizarProceso` puede recibir (datos guardados antes de estos campos).
interface ContactoLaxo { num?: number; correo?: string; papel?: string; verif?: string }
interface ActividadLaxa { ejecucion?: string; formatos?: unknown; eventos?: unknown; ciclo?: unknown; relato?: unknown }
interface VersionLaxa { diagrama?: unknown; actividades?: Record<string, ActividadLaxa> }
interface ProcesoLaxo {
  versiones?: Partial<Record<VersionId, VersionLaxa | null>>
  referencias?: unknown; proveedores?: unknown; inicio?: unknown; codigoDoc?: unknown
  participantes?: unknown; numSiguiente?: unknown
}

/* Datos guardados antes de estos campos: se completan sin cambiar lo capturado. */
export function normalizarProceso<T>(entrada: T): T {
  const p = entrada as unknown as ProcesoLaxo | null | undefined
  if (!p || !p.versiones) return entrada
  if (!Array.isArray(p.referencias)) p.referencias = []
  if (!Array.isArray(p.proveedores)) p.proveedores = []
  if (!p.inicio || typeof p.inicio !== 'object') p.inicio = { tipo: 'ninguno', detalle: null }
  if (p.codigoDoc === undefined) p.codigoDoc = null
  // El prototipo ponía aquí `remitente = null`; ya no es del documento (§4.3): quien envía es el usuario de la sesión.
  // Contactos: correo, papel en la RACI y un código de verificación fijo (va en su código de aprobación).
  // El número (`num`) ya viene fijo; `numSiguiente` es el que tomará el próximo contacto y solo crece.
  if (!Array.isArray(p.participantes)) p.participantes = []
  const participantes = p.participantes as ContactoLaxo[]
  participantes.forEach(c => {
    if (c.correo === undefined) c.correo = ''
    if (c.papel === undefined) c.papel = ''
    if (!c.verif) c.verif = nuevoVerif()
  })
  if (typeof p.numSiguiente !== 'number') p.numSiguiente = participantes.reduce((mx, c) => Math.max(mx, c.num || 0), 0) + 1
  const versiones = p.versiones
  ;(['asis', 'tobe'] as const).forEach(v => {
    const m = versiones[v]
    if (!m) return
    if (!m.diagrama || typeof m.diagrama !== 'object') m.diagrama = {}
    Object.values(m.actividades || {}).forEach(a => {
      if (!a.ejecucion) a.ejecucion = 'persona'
      if (!Array.isArray(a.formatos)) a.formatos = []
      if (!Array.isArray(a.eventos)) a.eventos = []
      if (a.ciclo === undefined) a.ciclo = null
      if (a.relato === undefined) a.relato = null
    })
  })
  return entrada
}

export function nuevoModelo(): Version {
  return { fases: [], sinFase: [], actividades: {}, decisiones: [], diagrama: {} }
}

export function nuevoDocumento(nombre: string): ProcesoDoc {
  return {
    nombre: nombre || 'Proceso sin nombre', objetivo: '', alcance: '', exclusiones: '', disparador: '',
    inicio: { tipo: 'ninguno', detalle: null }, codigoDoc: null, referencias: [],
    resultados: [], cliente: '', clienteExterno: true, dueno: '', departamentos: [], proveedores: [],
    participantes: [], numSiguiente: 1, sesiones: [], preguntas: [],
    versiones: { asis: nuevoModelo(), tobe: null },
  }
}

export const clonar = <T>(o: T): T => JSON.parse(JSON.stringify(o))

/* ---------- contactos y vista ---------- */

// 32 símbolos sin 0/O ni 1/I: 256 % 32 = 0, así que `x % 32` no tiene sesgo.
const ALFA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function nuevoVerif(): string {
  const b = new Uint8Array(4); crypto.getRandomValues(b)
  return Array.from(b, x => ALFA[x % 32]).join('')
}
export function nuevoContacto(doc: ProcesoDoc): Contacto {
  return { id: uid('u'), num: doc.numSiguiente, nombre: '', rol: '', departamento: '', correo: '', papel: '', verif: nuevoVerif() }
}
export function conInfoDeVersiones(doc: ProcesoDoc, info: { asis: { numero: number; estado: EstadoVersion }; tobe: { numero: number; estado: EstadoVersion } | null }): ProcesoVista {
  return { ...doc, versiones: {
    asis: { ...doc.versiones.asis, ...info.asis },
    tobe: doc.versiones.tobe && info.tobe ? { ...doc.versiones.tobe, ...info.tobe } : null,
  } }
}
export function sinInfoDeVersiones(v: ProcesoVista): ProcesoDoc {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const quitar = (m: VersionVista): Version => { const { numero: _n, estado: _e, ...resto } = m; return resto }
  return { ...v, versiones: { asis: quitar(v.versiones.asis), tobe: v.versiones.tobe ? quitar(v.versiones.tobe) : null } }
}

/* ---------- secuencia ---------- */

/** Actividad como la ve el tablero de fases (y `secuenciaActividades`). */
export interface ActividadTablero extends ActividadEnFase {
  clave: string; nombre: string; responsable?: Texto; entregable?: Texto; estado?: string
}
/** Fase del tablero; la última es la columna «Sin fase» (`sinFase: true`, id `__sin`). */
export interface FaseTablero extends FaseEnTablero {
  nombre: string; objetivo?: Texto; entrada?: Texto; entregables?: string[]; salida?: Texto
  actividades: ActividadTablero[]
}

export function fasesTablero(m: Version): FaseTablero[] {
  const act = (k: string): ActividadTablero => {
    const a: Partial<Actividad> & { clave: string; nombre: string } = m.actividades[k] || { clave: k, nombre: '(sin nombre)' }
    return { clave: k, nombre: a.nombre, responsable: tieneValor(a.responsable) ? a.responsable : null,
      entregable: tieneValor(a.entregable) ? a.entregable : null, estado: a.estado }
  }
  const out: FaseTablero[] = m.fases.map(f => ({ id: f.id, nombre: f.nombre, objetivo: f.objetivo, entrada: f.entrada,
    entregables: f.entregables || [], salida: f.salida, actividades: f.actividades.map(act) }))
  out.push({ id: '__sin', sinFase: true, nombre: 'Sin fase', actividades: m.sinFase.map(act) })
  return out
}

export const secuencia = (m: Version): ActividadSecuenciada[] => secuenciaActividades(fasesTablero(m))

export function faseDe(m: Version, clave: string): Fase | null {
  for (const f of m.fases) if (f.actividades.indexOf(clave) >= 0) return f
  return null
}

/* Aplica lo que devuelve TableroFases (fases con actividades en orden). */
export function aplicarTablero(m: Version, fases: { id: string; sinFase?: boolean; actividades: { clave: string }[] }[]): void {
  fases.forEach(f => {
    const claves = f.actividades.map(a => a.clave)
    if (f.sinFase) m.sinFase = claves
    else { const mf = m.fases.find(x => x.id === f.id); if (mf) mf.actividades = claves }
  })
}

export function quitarDeFases(m: Version, clave: string): void {
  m.fases.forEach(f => { f.actividades = f.actividades.filter(k => k !== clave) })
  m.sinFase = m.sinFase.filter(k => k !== clave)
}

export function ponerEnFase(m: Version, clave: string, faseId?: string | null, indice?: number | null): void {
  quitarDeFases(m, clave)
  const lista = faseId && faseId !== '__sin' ? m.fases.find(f => f.id === faseId)?.actividades : m.sinFase
  const arr = lista || m.sinFase
  const i = indice == null ? arr.length : Math.max(0, Math.min(indice, arr.length))
  arr.splice(i, 0, clave)
}

/* Alt+↑/↓ en la tabla: sube o baja una posición en la secuencia, cruzando de fase
   cuando llega al borde (igual que en el tablero). */
export function moverEnSecuencia(m: Version, clave: string, dir: number): boolean {
  const fi = m.fases.findIndex(f => f.actividades.indexOf(clave) >= 0)
  if (fi < 0) return false
  const f = m.fases[fi]
  const i = f.actividades.indexOf(clave)
  if (dir < 0) {
    if (i > 0) { f.actividades.splice(i, 1); f.actividades.splice(i - 1, 0, clave); return true }
    for (let j = fi - 1; j >= 0; j--) { f.actividades.splice(i, 1); m.fases[j].actividades.push(clave); return true }
  } else {
    if (i < f.actividades.length - 1) { f.actividades.splice(i, 1); f.actividades.splice(i + 1, 0, clave); return true }
    for (let j = fi + 1; j < m.fases.length; j++) { f.actividades.splice(i, 1); m.fases[j].actividades.unshift(clave); return true }
  }
  return false
}

/* Alta rápida (paso «listar y agrupar»): al final de la fase, o en «Sin fase». */
export function agregarActividades(m: Version, faseId: string | null | undefined, nombres: string[], extra?: Partial<Actividad> | null): string[] {
  return nombres.map(n => {
    const a = nuevaActividad(n, extra)
    m.actividades[a.clave] = a
    ponerEnFase(m, a.clave, faseId)
    return a.clave
  })
}

export function nuevaFase(m: Version, nombre?: string | null): Fase {
  const f: Fase = { id: uid('f'), nombre: nombre || 'Fase ' + (m.fases.length + 1), objetivo: null, entrada: null, entregables: [], salida: null, actividades: [] }
  m.fases.push(f)
  return f
}

export function eliminarActividad(m: Version, clave: string): void {
  quitarDeFases(m, clave)
  delete m.actividades[clave]
  // Las decisiones NO se borran: revisarDecision las marcará para revisar.
}

export function eliminarFase(m: Version, faseId: string): void {
  const f = m.fases.find(x => x.id === faseId)
  if (!f) return
  m.sinFase = m.sinFase.concat(f.actividades)
  m.fases = m.fases.filter(x => x.id !== faseId)
}

/* ---------- caracterización ---------- */

/* Los datos de la ficha que cuentan para saber cuánto falta. N/A y 0 son respuestas;
   «?» es un dato por preguntar; vacío es un dato sin tocar. */
export interface SeccionFicha { id: string; titulo: string; campos: (keyof Actividad)[] }
export const SECCIONES_FICHA: SeccionFicha[] = [
  { id: 'basico', titulo: 'Básico', campos: ['descripcion', 'responsable', 'departamento', 'apoyo'] },
  { id: 'entradas', titulo: 'Entradas y entregable', campos: ['entradas', 'entregable', 'receptor', 'criterio'] },
  { id: 'tiempos', titulo: 'Tiempos y volumen', campos: ['tProceso', 'tEspera', 'frecuencia'] },
  { id: 'recursos', titulo: 'Recursos', campos: ['herramientas', 'documentos'] },
  { id: 'reglas', titulo: 'Reglas y problemas', campos: ['reglas', 'problemas'] },
  { id: 'fuente', titulo: 'Fuente y confirmación', campos: ['fuente'] },
]
export const CAMPOS_FICHA: (keyof Actividad)[] = SECCIONES_FICHA.reduce<(keyof Actividad)[]>((t, s) => t.concat(s.campos), [])

export interface Completitud { resp: number; preg: number; total: number; completa: boolean }
export function completitud(a: Partial<Actividad> | null | undefined, campos?: (keyof Actividad)[] | null): Completitud {
  let resp = 0, preg = 0
  const cs = campos || CAMPOS_FICHA
  cs.forEach(c => {
    const v = a ? a[c] : null
    if (v === DESCONOCIDO) preg += 1
    else if (v != null && v !== '') resp += 1
  })
  return { resp, preg, total: cs.length, completa: resp === cs.length }
}

/* ---------- decisiones ---------- */

export function nuevaDecision(extra?: Partial<Decision> | null): Decision {
  const base: Decision = { clave: uid('d'), pregunta: '', origen: null, decide: null, tipo: 'exclusiva',
    salidas: [{ condicion: '', destino: null, porDefecto: true, clase: null }, { condicion: '', destino: null, porDefecto: false, clase: null }],
    estado: 'confirmado', contexto: { faseOrigen: null }, aceptados: [] }
  return Object.assign(base, extra || {})
}

export function motivosDe(m: Version, d: Decision, seq?: ActividadSecuenciada[] | null): MotivoRevision[] {
  return revisarDecision(d, seq || secuencia(m))
}

/* ---------- As-Is → To-Be ---------- */

export function crearTobe(asis: Version): Version {
  const m = clonar(asis)
  const mapa: Record<string, string> = {}
  const acts: Record<string, Actividad> = {}
  Object.keys(asis.actividades).forEach(k => {
    const n = uid('a')
    mapa[k] = n
    acts[n] = Object.assign(clonar(asis.actividades[k]), { clave: n, origenClave: k })
  })
  m.actividades = acts
  m.fases.forEach(f => { f.actividades = f.actividades.map(k => mapa[k]) })
  m.sinFase = m.sinFase.map(k => mapa[k])
  Object.values(acts).forEach(a => { (a.eventos || []).forEach(e => { if (e.destino && e.destino !== '__fin') e.destino = mapa[e.destino] || null }) })
  const mapaDec: Record<string, string> = {}
  m.decisiones = m.decisiones.map(d => { const n = uid('d'); mapaDec[d.clave] = n; return Object.assign(clonar(d), {
    clave: n, origen: d.origen ? mapa[d.origen] || null : null,
    salidas: d.salidas.map(s => Object.assign({}, s, { destino: s.destino && s.destino !== '__fin' ? mapa[s.destino] || null : s.destino })),
  }) })
  m.diagrama = remapearDiagrama(asis.diagrama, Object.assign({}, mapa, mapaDec))
  // El prototipo fijaba aquí numero = 1, estado 'borrador', aprobacion null e historial []. En el
  // documento guardado no van (§4.3): se quitan por si `asis` llegó como VersionVista o del prototipo.
  const x = m as unknown as Record<string, unknown>
  for (const k of ['numero', 'estado', 'aprobacion', 'historial']) delete x[k]
  return m
}

/* Los ajustes del diagrama se guardan por id de elemento, y los ids llevan la clave: al copiar
   al To-Be se reescriben con las claves nuevas. */
export function remapearDiagrama(d: Diagrama | null | undefined, mapa: Record<string, string>): Diagrama {
  if (!d) return {}
  const claves = Object.keys(mapa).sort((a, b) => b.length - a.length)
  const id = (s: string): string => { let r = s; claves.forEach(k => { if (r.indexOf(k) >= 0) r = r.split(k).join(mapa[k]) }); return r }
  const grupos = d as unknown as Record<string, unknown>
  const out: Record<string, unknown> = {}
  Object.keys(grupos).forEach(grupo => {
    const g = grupos[grupo]
    if (Array.isArray(g)) out[grupo] = (g as { ancla?: string; id?: string }[]).map(x => Object.assign(clonar(x), x.ancla ? { ancla: id(x.ancla) } : {}, x.id ? { id: id(x.id) } : {}))
    else if (g && typeof g === 'object') {
      const o: Record<string, unknown> = {}
      out[grupo] = o
      Object.keys(g).forEach(k => { o[id(k)] = clonar((g as Record<string, unknown>)[k]) })
    }
  })
  return out as Diagrama
}

const CAMPOS_DIFF: (keyof Actividad)[] = ['nombre', 'responsable', 'ejecucion', 'entregable', 'receptor', 'tProceso', 'tEspera', 'reglas', 'herramientas', 'formatos', 'eventos', 'ciclo']
export function cambioFrenteAsis(asis: Version | null | undefined, tobe: Version, a: Actividad): 'nueva' | 'modificada' | null {
  if (!asis) return null
  if (!a.origenClave || !asis.actividades[a.origenClave]) return 'nueva'
  const o = asis.actividades[a.origenClave]
  if (CAMPOS_DIFF.some(c => JSON.stringify(o[c]) !== JSON.stringify(a[c]))) return 'modificada'
  const fo = faseDe(asis, o.clave), fa = faseDe(tobe, a.clave)
  if ((fo && fo.nombre) !== (fa && fa.nombre)) return 'modificada'
  return null
}
export function eliminadasFrenteAsis(asis: Version | null | undefined, tobe: Version | null | undefined): Actividad[] {
  if (!asis || !tobe) return []
  const usadas: Record<string, boolean> = {}
  Object.values(tobe.actividades).forEach(a => { if (a.origenClave) usadas[a.origenClave] = true })
  return Object.values(asis.actividades).filter(a => !usadas[a.clave])
}

/* ---------- aprobaciones ---------- */

/* El estado de la versión lo deriva `aprobacion.ts` de las tablas de aprobación. */
export const bloqueada = (estado: EstadoVersion): boolean => estado === 'revision' || estado === 'aprobado'

/* ---------- revisión (avisos) ---------- */

const norm = (s: unknown): string => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/** Un aviso de la revisión: a qué pestaña (y sub-paso, ficha o fase) lleva, y qué dice. */
export interface Aviso {
  nivel: 'info' | 'alerta' | 'ia'
  tab: 'actividades' | 'fases' | 'resumen'
  sub?: 'listar' | 'caracterizar'
  clave?: string
  fase?: string
  texto: string
}

export function avisos(proc: Pick<ProcesoDoc, 'disparador' | 'dueno'>, m: Version): Aviso[] {
  const out: Aviso[] = []
  const seq = secuencia(m)
  const num: Record<string, ActividadSecuenciada> = {}
  seq.forEach(s => { num[s.clave] = s })
  const acts = Object.values(m.actividades)
  const enOrden = seq.map(s => m.actividades[s.clave]).filter(Boolean)
  if (!acts.length) out.push({ nivel: 'info', tab: 'actividades', sub: 'listar', texto: 'Aún no hay actividades. Empieza por listarlas, cada una en su fase.' })
  if (m.sinFase.length) out.push({ nivel: 'alerta', tab: 'actividades', sub: 'listar', texto: m.sinFase.length + (m.sinFase.length === 1 ? ' actividad sin fase: no tiene número ni lugar en el diagrama.' : ' actividades sin fase: no tienen número ni lugar en el diagrama.') })
  const sinResp = enOrden.filter(a => !tieneValor(a.responsable))
  if (sinResp.length) out.push({ nivel: 'alerta', tab: 'actividades', sub: 'caracterizar', clave: sinResp[0].clave, texto: sinResp.length + ' sin responsable confirmado: irán al carril «Sin responsable».' })
  const sugA = enOrden.filter(a => a.estado === 'sugerencia')
  const sugD = m.decisiones.filter(d => d.estado === 'sugerencia')
  if (sugA.length || sugD.length) {
    const n = sugA.length + sugD.length
    out.push(sugA.length ? { nivel: 'ia', tab: 'actividades', sub: 'caracterizar', clave: sugA[0].clave, texto: n + (n === 1 ? ' sugerencia de la IA por aceptar o descartar.' : ' sugerencias de la IA por aceptar o descartar.') }
      : { nivel: 'ia', tab: 'actividades', sub: 'caracterizar', clave: destinoDecision(m, sugD[0]), texto: n + (n === 1 ? ' decisión sugerida por la IA por aceptar o descartar.' : ' decisiones sugeridas por la IA por aceptar o descartar.') })
  }
  const rev = m.decisiones.filter(d => d.origen && m.actividades[d.origen] && revisarDecision(d, seq).length)
  if (rev.length) out.push({ nivel: 'alerta', tab: 'actividades', sub: 'caracterizar', clave: destinoDecision(m, rev[0]), texto: rev.length + (rev.length === 1 ? ' decisión por revisar tras un cambio en la secuencia.' : ' decisiones por revisar tras cambios en la secuencia.') })
  const sueltas = m.decisiones.filter(d => !d.origen || !m.actividades[d.origen])
  if (sueltas.length) out.push({ nivel: 'alerta', tab: 'actividades', sub: 'caracterizar', clave: 'dec:' + sueltas[0].clave, texto: sueltas.length + (sueltas.length === 1 ? ' decisión sin actividad de origen: ubícala.' : ' decisiones sin actividad de origen: ubícalas.') })
  const porOrigen: Record<string, number> = {}
  m.decisiones.forEach(d => { if (d.origen) porOrigen[d.origen] = (porOrigen[d.origen] || 0) + 1 })
  Object.keys(porOrigen).forEach(k => { if (porOrigen[k] > 1 && num[k]) out.push({ nivel: 'alerta', tab: 'actividades', sub: 'caracterizar', clave: k, texto: (num[k].codigo || '') + ' tiene ' + porOrigen[k] + ' decisiones: el diagrama solo dibuja la primera.' }) })
  enOrden.forEach(a => (a.eventos || []).forEach(e => {
    if ((e.tipo === 'limite' || e.tipo === 'error') && e.destino && e.destino !== '__fin' && !num[e.destino]) out.push({ nivel: 'alerta', tab: 'actividades', sub: 'caracterizar', clave: a.clave, texto: (num[a.clave]?.codigo || '«' + a.nombre + '»') + ': «' + TIPOS_EVENTO[e.tipo].corto + '» lleva a una actividad eliminada o sin fase.' })
  }))
  // Entregables: si B usa lo que entrega A, A debería ir antes.
  acts.forEach(a => {
    if (!tieneValor(a.entregable) || norm(a.entregable).length < 4) return
    acts.forEach(b => {
      if (a === b || !tieneValor(b.entradas)) return
      if (norm(b.entradas).indexOf(norm(a.entregable)) < 0) return
      const na = num[a.clave], nb = num[b.clave]
      if (na && nb && na.numero != null && nb.numero != null && nb.numero < na.numero) {
        out.push({ nivel: 'alerta', tab: 'actividades', sub: 'listar', texto: nb.codigo + ' «' + b.nombre + '» usa «' + a.entregable + '», que entrega ' + na.codigo + ' más adelante. ¿Va antes?' })
      }
    })
  })
  m.fases.forEach(f => { if (!tieneValor(f.salida) && f.actividades.length) out.push({ nivel: 'info', tab: 'fases', fase: f.id, texto: 'La fase «' + f.nombre + '» no tiene criterio de salida: ¿cuándo termina?' }) })
  if (!tieneValor(proc.disparador)) out.push({ nivel: 'info', tab: 'resumen', texto: 'Falta el evento que inicia el proceso.' })
  if (!tieneValor(proc.dueno)) out.push({ nivel: 'info', tab: 'resumen', texto: 'Falta el dueño del proceso: es quien lo aprueba.' })
  return out
}

/* Datos por preguntar: campos marcados como desconocidos. */
const ROTULOS: Partial<Record<keyof Actividad, string>> = { responsable: 'responsable', entregable: 'entregable', receptor: 'quién recibe', criterio: 'criterio de aceptación',
  tProceso: 'tiempo de proceso', tEspera: 'tiempo de espera', frecuencia: 'frecuencia', entradas: 'entradas', herramientas: 'herramientas',
  documentos: 'documentos', reglas: 'reglas', apoyo: 'apoyo', departamento: 'departamento', descripcion: 'descripción', problemas: 'problemas' }
/* A qué ficha llevar una decisión: la de su actividad de origen, o la lista de decisiones por ubicar. */
export function destinoDecision(m: Version, d: Decision): string { return d.origen && m.actividades[d.origen] ? d.origen : 'dec:' + d.clave }

export interface PorPreguntar { clave: string; codigo: string | null; nombre: string; faltan: string[] }
export function porPreguntar(m: Version): PorPreguntar[] {
  const seq = secuencia(m)
  const out: PorPreguntar[] = []
  seq.forEach(s => {
    const a = m.actividades[s.clave]
    if (!a) return
    const faltan = (Object.keys(ROTULOS) as (keyof Actividad)[]).filter(c => a[c] === DESCONOCIDO).map(c => ROTULOS[c] as string)
    if (faltan.length || a.estado === 'pregunta') out.push({ clave: a.clave, codigo: s.codigo, nombre: a.nombre, faltan })
  })
  return out
}

export function roles(m: Version): string[] {
  const set: string[] = []
  Object.values(m.actividades).forEach(a => { if (tieneValor(a.responsable) && set.indexOf(a.responsable as string) < 0) set.push(a.responsable as string) })
  return set
}

/* ---------- fechas (America/Bogota) ---------- */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']
const FMT_DIA = new Intl.DateTimeFormat('es-CO', { timeZone: TZ, day: 'numeric', month: 'numeric', year: 'numeric' })

/* Instante de un texto ISO. Una fecha «AAAA-MM-DD» se toma a mediodía UTC, que en Bogotá (UTC−5)
   cae en ese mismo día de calendario: así se interpreta como ese día, sin que la hora la mueva. */
const instante = (iso: string): Date => new Date(iso.length <= 10 ? iso + 'T12:00:00Z' : iso)

/* Día, mes (0-11) y año del instante en la zona del negocio. Se arma por partes y no con format()
   para no depender del patrón que traiga el ICU del runtime. */
function diaMesAnio(d: Date): { dia: number; mes: number; anio: number } {
  const p: Record<string, string> = {}
  FMT_DIA.formatToParts(d).forEach(x => { p[x.type] = x.value })
  return { dia: Number(p.day), mes: Number(p.month) - 1, anio: Number(p.year) }
}

export function relativo(iso: string | null | undefined, ahora = new Date()): string {
  if (!iso) return ''
  const d = instante(iso)
  if (isNaN(d.getTime())) return ''   // formatToParts lanza con una fecha inválida
  const s = Math.round((ahora.getTime() - d.getTime()) / 1000)
  if (s < 10) return 'ahora'
  if (s < 60) return 'hace ' + s + ' s'
  if (s < 3600) return 'hace ' + Math.round(s / 60) + ' min'
  if (s < 86400) return 'hace ' + Math.round(s / 3600) + ' h'
  const f = diaMesAnio(d)
  return f.dia + ' ' + MESES[f.mes]
}

export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = instante(iso)
  if (isNaN(d.getTime())) return ''
  const f = diaMesAnio(d)
  return f.dia + ' ' + MESES[f.mes] + ' ' + f.anio
}
