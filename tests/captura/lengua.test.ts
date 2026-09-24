// Portado literalmente de `reference/captura/prototipo/pruebas/test-lengua.mjs` (109 líneas):
// mismos casos, mismo orden, convertidos de `eq(a, b, m)` a `it(m, () => expect(a).toBe(b))`.
import { describe, it, expect } from 'vitest'
import * as L from '@/lib/captura/lengua'

// ---------- verbos ----------
const V: Record<string, string> = {
  descargar: 'descarga', aprobar: 'aprueba', enviar: 'envía', incluir: 'incluye', seguir: 'sigue', pedir: 'pide', elegir: 'elige', corregir: 'corrige',
  cerrar: 'cierra', empezar: 'empieza', recomendar: 'recomienda', atender: 'atiende', pretender: 'pretende', entender: 'entiende', comprobar: 'comprueba',
  encontrar: 'encuentra', recordar: 'recuerda', devolver: 'devuelve', resolver: 'resuelve', promover: 'promueve', preferir: 'prefiere', advertir: 'advierte',
  convertir: 'convierte', requerir: 'requiere', adquirir: 'adquiere', obtener: 'obtiene', mantener: 'mantiene', proponer: 'propone', prevenir: 'previene',
  rehacer: 'rehace', satisfacer: 'satisface', predecir: 'predice', extraer: 'extrae', conseguir: 'consigue', evaluar: 'evalúa', continuar: 'continúa',
  averiguar: 'averigua', adecuar: 'adecua', ampliar: 'amplía', cambiar: 'cambia', copiar: 'copia', conciliar: 'concilia', reunir: 'reúne', prohibir: 'prohíbe',
  distribuir: 'distribuye', construir: 'construye', distinguir: 'distingue', ir: 'va', dar: 'da', ver: 've', prever: 'prevé', ser: 'es', estar: 'está',
  hacer: 'hace', tener: 'tiene', jugar: 'juega', avergonzar: 'avergüenza', mostrar: 'muestra', demostrar: 'demuestra', presentar: 'presenta', representar: 'representa',
  sentar: 'sienta', medir: 'mide', repetir: 'repite', servir: 'sirve', negociar: 'negocia', radicar: 'radica', diligenciar: 'diligencia', validar: 'valida',
  confirmar: 'confirma', archivar: 'archiva', investigar: 'investiga', registrar: 'registra', ejecutar: 'ejecuta', cargar: 'carga', revisar: 'revisa',
  contar: 'cuenta', descontar: 'descuenta', costar: 'cuesta', renovar: 'renueva', innovar: 'innova', interrogar: 'interroga', negar: 'niega', denegar: 'deniega',
  desplegar: 'despliega', guiar: 'guía', leer: 'lee', oír: 'oye', reír: 'ríe', errar: 'yerra', oler: 'huele', dormir: 'duerme', sugerir: 'sugiere',
  transferir: 'transfiere', diferir: 'difiere', invertir: 'invierte', montar: 'monta', forzar: 'fuerza', reforzar: 'refuerza', comenzar: 'comienza',
  defender: 'defiende', encender: 'enciende', perder: 'pierde', querer: 'quiere', poder: 'puede', volver: 'vuelve', mover: 'mueve', huir: 'huye',
  actualizar: 'actualiza', garantizar: 'garantiza', parametrizar: 'parametriza', facturar: 'factura', liquidar: 'liquida', auditar: 'audita',
}
describe('tercera persona', () => {
  for (const [inf, esp] of Object.entries(V)) it(inf, () => expect(L.tercera(inf)).toBe(esp))
  it('plural revisar', () => expect(L.tercera('revisar', true)).toBe('revisan'))
  it('plural ser', () => expect(L.tercera('ser', true)).toBe('son'))
  it('plural enviar', () => expect(L.tercera('enviar', true)).toBe('envían'))
})

// ---------- acciones ----------
const A: Record<string, string> = {
  'Descargar extracto bancario': 'descarga el extracto bancario',
  'Cargar extracto al sistema contable': 'carga el extracto al sistema contable',
  'Ejecutar cuadre automático': 'ejecuta el cuadre automático',
  'Investigar diferencias': 'investiga las diferencias',
  'Registrar partidas conciliatorias': 'registra las partidas conciliatorias',
  'Revisar y aprobar la conciliación': 'revisa y aprueba la conciliación',
  'Enviar informe de conciliación al cliente': 'envía el informe de conciliación al cliente',
  'Archivar la conciliación': 'archiva la conciliación',
  'Confirmar saldos con tesorería': 'confirma los saldos con tesorería',
  'Recibir, revisar y firmar el contrato': 'recibe, revisa y firma el contrato',
  'Asegurarse de que el pago salió': 'se asegura de que el pago salió',
  'Enviarlo a firma': 'lo envía a firma',
  'Hacer seguimiento al pedido': 'hace seguimiento al pedido',
  'Dar visto bueno': 'da visto bueno',
  'Radicar factura en ventanilla': 'radica la factura en ventanilla',
  'Solicitar órdenes de compra': 'solicita las órdenes de compra',
  'Actualizar imágenes del catálogo': 'actualiza las imágenes del catálogo',
  'Crear orden de compra en SAP': 'crea la orden de compra en SAP',
  'Descargar PDF del extracto': 'descarga el PDF del extracto',
  'Validar RUT del proveedor': 'valida el RUT del proveedor',
  'Registrar el acta del comité': 'registra el acta del comité',
  'Revisar acta de la reunión': 'revisa el acta de la reunión',
  'Actualizar área responsable': 'actualiza el área responsable',
  'Revisar áreas críticas': 'revisa las áreas críticas',
  'Consultar lista de chequeo': 'consulta la lista de chequeo',
  'Programar entrevista con el candidato': 'programa la entrevista con el candidato',
  'Notificar al cliente': 'notifica al cliente',
  'Verificar que el saldo cuadre': 'verifica que el saldo cuadre',
  'Evaluar y seleccionar proveedores': 'evalúa y selecciona los proveedores',
  'Emitir certificado': 'emite el certificado',
  'Enviar informes e indicadores': 'envía los informes e indicadores',
  'Revisar solicitudes': 'revisa las solicitudes',
  'Aprobar pagos mayores a un millón': 'aprueba los pagos mayores a un millón',
  'Pagar nómina': 'paga la nómina',
  'Cerrar el mes contable': 'cierra el mes contable',
  'Revisar datos del sistema': 'revisa los datos del sistema',
  'Actualizar tablero de indicadores': 'actualiza el tablero de indicadores',
  'Descargar y guardarlo en la carpeta': 'descarga y lo guarda en la carpeta',
}
describe('accionDe', () => {
  for (const [nombre, esp] of Object.entries(A)) it(nombre, () => expect(L.accionDe(nombre).texto).toBe(esp))
  it('nominal', () => expect(L.accionDe('Revisión de la conciliación').ok).toBe(false))
  it('taller no es verbo', () => expect(L.accionDe('Taller de inducción').ok).toBe(false))
  it('plural', () => expect(L.accionDe('Revisar facturas', true).texto).toBe('revisan las facturas'))
})

// ---------- artículos y sujetos ----------
const S: Record<string, string> = {
  'Auxiliar contable': 'el auxiliar contable', 'Analista contable': 'el analista contable', 'Jefe de contabilidad': 'el jefe de contabilidad',
  'Sistema contable': 'el sistema contable', 'Tesorería del cliente': 'la tesorería del cliente', 'Gerencia financiera del cliente': 'la gerencia financiera del cliente',
  'Marta Ríos': 'Marta Ríos', 'Coordinadora de compras': 'la coordinadora de compras', 'Comité de compras': 'el comité de compras', 'CFO': 'el CFO',
  'Jefe de Contabilidad': 'el jefe de Contabilidad', 'Analistas de cartera': 'los analistas de cartera', 'Recepcionista': 'el recepcionista', 'Tesorería': 'la tesorería',
  'Marta': 'Marta', 'Bot de conciliación': 'el bot de conciliación', 'Área de compras': 'el área de compras', 'Dirección financiera': 'la dirección financiera',
}
describe('sujeto', () => {
  for (const [rol, esp] of Object.entries(S)) it('sujeto ' + rol, () => expect(L.sujeto(rol)).toBe(esp))
})

const N: Record<string, string> = {
  'Extracto del mes': 'el extracto del mes', 'Movimientos bancarios cargados': 'los movimientos bancarios cargados', 'Reporte de partidas sin cruce': 'el reporte de partidas sin cruce',
  'Explicación de cada diferencia': 'la explicación de cada diferencia', 'Partidas conciliatorias': 'las partidas conciliatorias', 'Conciliación firmada': 'la conciliación firmada',
  'Informe de conciliación': 'el informe de conciliación', 'Acceso al portal del banco': 'el acceso al portal del banco', 'Orden de compra': 'la orden de compra',
  'Análisis de riesgo': 'el análisis de riesgo', 'Crisis de liquidez': 'la crisis de liquidez', 'Problema reportado': 'el problema reportado', 'Mapa de procesos': 'el mapa de procesos',
  'Lista de chequeo': 'la lista de chequeo', 'Base de datos': 'la base de datos', 'Clave del portal': 'la clave del portal', 'Imagen del producto': 'la imagen del producto',
  'Margen bruto': 'el margen bruto', 'Solicitudes aprobadas': 'las solicitudes aprobadas', 'Meses anteriores': 'los meses anteriores', 'Leyes aplicables': 'las leyes aplicables',
  'Dos copias del contrato': 'dos copias del contrato', 'Siigo Nube': 'Siigo Nube', 'Nueva solicitud': 'la nueva solicitud', 'Primer pago': 'el primer pago', 'Agua potable': 'el agua potable',
  'Actas firmadas': 'las actas firmadas', 'Funciones del cargo': 'las funciones del cargo', 'Clientes nuevos': 'los clientes nuevos', 'Fuentes de datos': 'las fuentes de datos',
  'Reportes del mes': 'los reportes del mes', 'Día de pago': 'el día de pago', 'Sistema de nómina': 'el sistema de nómina', 'Programa de capacitación': 'el programa de capacitación',
  'Foto del documento': 'la foto del documento', 'Mano de obra': 'la mano de obra', 'Canales de venta': 'los canales de venta', 'Luces del tablero': 'las luces del tablero',
  'Cuentas corrientes y de ahorro en pesos': 'las cuentas corrientes y de ahorro en pesos', 'Tarifas vigentes': 'las tarifas vigentes', 'Checklist de cierre': 'el checklist de cierre',
}
describe('conArticulo', () => {
  for (const [nom, esp] of Object.entries(N)) it('art ' + nom, () => expect(L.conArticulo(nom)).toBe(esp))
  it('Excel', () => expect(L.conArticulo('Excel', 'herramienta')).toBe('Excel'))
  it('correo', () => expect(L.conArticulo('Correo electrónico', 'herramienta')).toBe('el correo electrónico'))
  it('portal', () => expect(L.conArticulo('Portal empresarial del banco', 'herramienta')).toBe('el portal empresarial del banco'))
  it('SharePoint', () => expect(L.conArticulo('SharePoint', 'herramienta')).toBe('SharePoint'))
  it('Salesforce', () => expect(L.conArticulo('Salesforce', 'herramienta')).toBe('Salesforce'))
  it('hoja', () => expect(L.conArticulo('Hoja de cálculo', 'herramienta')).toBe('la hoja de cálculo'))
})

describe('conPrep', () => {
  it('del', () => expect(L.conPrep('de', L.conArticulo('Sistema contable'))).toBe('del sistema contable'))
  it('al área', () => expect(L.conPrep('a', L.conArticulo('Área de compras'))).toBe('al área de compras'))
})

describe('lista', () => {
  it('y→e', () => expect(L.lista(['contabilidad', 'informática'])).toBe('contabilidad e informática'))
  it('y normal', () => expect(L.lista(['siete', 'ocho'])).toBe('siete u ocho'.replace(' u ', ' y ')))
  it('o→u', () => expect(L.lista(['uno', 'otro'], 'o')).toBe('uno u otro'))
  it('hie', () => expect(L.lista(['a', 'b', 'hielo'])).toBe('a, b y hielo'))
})

// ---------- cláusulas ----------
const C: Record<string, boolean> = {
  'El banco publica el extracto del mes': true, 'Movimientos cargados en Siigo': false, 'Diferencias explicadas': false, 'Conciliación archivada en la carpeta del cliente': false,
  'El extracto cubre el mes completo y trae saldo final': true, 'Diferencia final en cero o totalmente explicada': false, 'Llega una solicitud del cliente': true,
  'Solicitud del cliente': false, 'El cliente acepta la propuesta': true, 'La conciliación queda archivada': true, 'Cuentas corrientes y de ahorro en pesos de los clientes del despacho': false,
  'Aplica la norma a todas las cuentas': true, 'Reporte de entrega': false, 'La entrega del informe': false, 'Firma del jefe': false, 'Se recibe la factura': true,
}
describe('esClausula', () => {
  for (const [texto, esp] of Object.entries(C)) it('cláusula ' + texto, () => expect(L.esClausula(texto)).toBe(esp))
})

// ---------- descripciones ----------
describe('aTercera', () => {
  it('descr 1', () => expect(L.aTercera('Ingresar al portal del banco con el token. Descargar el PDF y guardarlo en la carpeta del mes.'))
    .toBe('Ingresa al portal del banco con el token. Descarga el PDF y lo guarda en la carpeta del mes.'))
  it('descr 2', () => expect(L.aTercera('Si hay diferencias, llamar al cliente.')).toBe('Si hay diferencias, llama al cliente.'))
  it('descr 3 igual', () => expect(L.aTercera('El sistema cruza los movimientos.')).toBe('El sistema cruza los movimientos.'))
  it('descr viñetas', () => expect(L.aTercera('- Abrir el archivo\n- Revisar totales')).toBe('- Abre el archivo\n- Revisa los totales'))
  it('descr para+inf', () => expect(L.aTercera('Usar la plantilla para descargar y guardar el reporte.')).toBe('Usa la plantilla para descargar y guardar el reporte.'))
})

// ---------- tiempos ----------
describe('duracion', () => {
  it('0,25 h', () => expect(L.duracion(0.25, 'h')).toBe('un cuarto de hora'))
  it('0,5 h', () => expect(L.duracion(0.5, 'h')).toBe('media hora'))
  it('0,1 h', () => expect(L.duracion(0.1, 'h')).toBe('unos 6 minutos'))
  it('1 h', () => expect(L.duracion(1, 'h')).toBe('una hora'))
  it('1,5 h', () => expect(L.duracion(1.5, 'h')).toBe('una hora y media'))
  it('24 h', () => expect(L.duracion(24, 'h')).toBe('24 horas'))
  it('2,5 h', () => expect(L.duracion(2.5, 'h')).toBe('2 horas y media'))
  it('3 días', () => expect(L.duracion(3, 'días')).toBe('3 días'))
  it('1 día', () => expect(L.duracion(1, 'días')).toBe('un día'))
  it('45 min', () => expect(L.duracion(45, 'min')).toBe('unos 45 minutos'))
  it('0,2 h', () => expect(L.duracion(0.2, 'h')).toBe('unos 10 minutos'))
})

describe('unoTrasOtro', () => {
  it('una tras otra', () => expect(L.unoTrasOtro('partida sin cruce')).toBe('una tras otra'))
  it('uno tras otro', () => expect(L.unoTrasOtro('cliente')).toBe('uno tras otro'))
})
