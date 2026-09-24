export type Texto = string | null                         // 'desconocido' = «?», 'na' = N/A
export type Numero = number | 'desconocido' | 'na' | null
export type VersionId = 'asis' | 'tobe'
export type EstadoVersion = 'borrador' | 'revision' | 'cambios' | 'aprobado'
export type Papel = '' | 'elabora' | 'vobo' | 'aprueba' | 'informado'

export interface Contacto { id: string; num: number; nombre: string; rol: string; departamento: string
  correo: string; papel: Papel; verif: string }
export interface Referencia { id: string; codigo: string | null; nombre: string
  tipo: 'interna' | 'externa' | 'ley' | 'otra'; enlace: string | null }
export interface ArchivoFormato { id: string; path: string; nombre: string; tipo: string; tamano: number }
export interface Formato { id: string; nombre: string; codigo: string | null; version: string | null
  archivo: ArchivoFormato | null; enlace: string | null }
export type TipoEvento = 'tiempo' | 'fecha' | 'mensaje' | 'condicion' | 'aviso' | 'hito' | 'limite' | 'error'
export interface Evento { id: string; tipo: TipoEvento; momento: 'antes' | 'durante' | 'despues'
  texto: string | null; n: number | null; unidad: string; quien: string | null; externo: boolean
  destino: string | null; interrumpe: boolean }
export interface Ciclo { tipo: '' | 'repite' | 'porCada'; condicion: string | null; paralelo?: boolean }
export interface Actividad {
  clave: string; nombre: string; descripcion: Texto; responsable: Texto; departamento: Texto; apoyo: Texto
  ejecucion: 'persona' | 'sistema' | 'automatizacion'; entradas: Texto; entregable: Texto; receptor: Texto
  receptorExterno: boolean; criterio: Texto; tProceso: Numero; tEspera: Numero; unidad: string
  frecuencia: Texto; herramientas: Texto; documentos: Texto; reglas: Texto; problemas: Texto
  formatos: Formato[]; eventos: Evento[]; ciclo: Ciclo | null; relato: string | null
  fuente: string | null; evidencia: string | null; estado: 'confirmado' | 'por_confirmar' | 'sugerido' | string
  origenClave: string | null
}
export interface Salida { condicion: string; destino: string | null; porDefecto: boolean; clase: string | null }
export interface Decision { clave: string; pregunta: string; origen: string | null; decide: string | null
  tipo: 'exclusiva' | 'inclusiva' | 'paralela' | string; salidas: Salida[]; estado: string
  contexto: { faseOrigen: string | null }; aceptados: string[] }
export interface Fase { id: string; nombre: string; objetivo: Texto; entrada: Texto; entregables: string[]
  salida: Texto; actividades: string[] }
export interface Diagrama { v?: number; formas?: Record<string, unknown>; rutas?: Record<string, unknown>
  etiquetas?: Record<string, unknown>; notas?: unknown[] }
/** Versión tal como se GUARDA (§4.3): sin numero, estado, aprobacion ni historial. */
export interface Version { fases: Fase[]; sinFase: string[]; actividades: Record<string, Actividad>
  decisiones: Decision[]; diagrama: Diagrama }
/** Versión como la usa la interfaz y la lógica portada: el servidor inyecta numero y estado. */
export interface VersionVista extends Version { numero: number; estado: EstadoVersion }
export interface Sesion { id: string; fecha: string; participantes: string[]; notas: string }
export interface Pregunta { id: string; texto: string; origen: string; resuelta: boolean; fecha: string }
interface ProcesoBase {
  nombre: string; objetivo: string; alcance: string; exclusiones: string; disparador: string
  inicio: { tipo: 'ninguno' | 'mensaje' | 'tiempo' | 'condicion'; detalle: string | null }
  codigoDoc: string | null; referencias: Referencia[]; resultados: string[]; cliente: string
  clienteExterno: boolean; dueno: string; departamentos: string[]; proveedores: string[]
  participantes: Contacto[]; numSiguiente: number; sesiones: Sesion[]; preguntas: Pregunta[]
}
export interface ProcesoDoc extends ProcesoBase { versiones: { asis: Version; tobe: Version | null } }
export interface ProcesoVista extends ProcesoBase { versiones: { asis: VersionVista; tobe: VersionVista | null } }
