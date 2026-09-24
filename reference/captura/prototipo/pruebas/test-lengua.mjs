import * as L from './src/lengua.js';
let f = 0;
const eq = (a, b, m) => { const ok = a === b; if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA') + ' ' + (m || '') + ' → ' + JSON.stringify(a) + (ok ? '' : '  (esperado ' + JSON.stringify(b) + ')')); };
// verbos
const V = { descargar: 'descarga', aprobar: 'aprueba', enviar: 'envía', incluir: 'incluye', seguir: 'sigue', pedir: 'pide', elegir: 'elige', corregir: 'corrige',
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
  actualizar: 'actualiza', garantizar: 'garantiza', parametrizar: 'parametriza', facturar: 'factura', liquidar: 'liquida', auditar: 'audita' };
Object.entries(V).forEach(([a, b]) => eq(L.tercera(a), b, a));
eq(L.tercera('revisar', true), 'revisan', 'plural revisar'); eq(L.tercera('ser', true), 'son', 'plural ser'); eq(L.tercera('enviar', true), 'envían', 'plural enviar');
// acciones
const A = {
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
};
Object.entries(A).forEach(([a, b]) => eq(L.accionDe(a).texto, b, a));
eq(L.accionDe('Revisión de la conciliación').ok, false, 'nominal');
eq(L.accionDe('Taller de inducción').ok, false, 'taller no es verbo');
eq(L.accionDe('Revisar facturas', true).texto, 'revisan las facturas', 'plural');
// artículos y sujetos
const S = { 'Auxiliar contable': 'el auxiliar contable', 'Analista contable': 'el analista contable', 'Jefe de contabilidad': 'el jefe de contabilidad',
  'Sistema contable': 'el sistema contable', 'Tesorería del cliente': 'la tesorería del cliente', 'Gerencia financiera del cliente': 'la gerencia financiera del cliente',
  'Marta Ríos': 'Marta Ríos', 'Coordinadora de compras': 'la coordinadora de compras', 'Comité de compras': 'el comité de compras', 'CFO': 'el CFO',
  'Jefe de Contabilidad': 'el jefe de Contabilidad', 'Analistas de cartera': 'los analistas de cartera', 'Recepcionista': 'el recepcionista', 'Tesorería': 'la tesorería',
  'Marta': 'Marta', 'Bot de conciliación': 'el bot de conciliación', 'Área de compras': 'el área de compras', 'Dirección financiera': 'la dirección financiera' };
Object.entries(S).forEach(([a, b]) => eq(L.sujeto(a), b, 'sujeto ' + a));
const N = { 'Extracto del mes': 'el extracto del mes', 'Movimientos bancarios cargados': 'los movimientos bancarios cargados', 'Reporte de partidas sin cruce': 'el reporte de partidas sin cruce',
  'Explicación de cada diferencia': 'la explicación de cada diferencia', 'Partidas conciliatorias': 'las partidas conciliatorias', 'Conciliación firmada': 'la conciliación firmada',
  'Informe de conciliación': 'el informe de conciliación', 'Acceso al portal del banco': 'el acceso al portal del banco', 'Orden de compra': 'la orden de compra',
  'Análisis de riesgo': 'el análisis de riesgo', 'Crisis de liquidez': 'la crisis de liquidez', 'Problema reportado': 'el problema reportado', 'Mapa de procesos': 'el mapa de procesos',
  'Lista de chequeo': 'la lista de chequeo', 'Base de datos': 'la base de datos', 'Clave del portal': 'la clave del portal', 'Imagen del producto': 'la imagen del producto',
  'Margen bruto': 'el margen bruto', 'Solicitudes aprobadas': 'las solicitudes aprobadas', 'Meses anteriores': 'los meses anteriores', 'Leyes aplicables': 'las leyes aplicables',
  'Dos copias del contrato': 'dos copias del contrato', 'Siigo Nube': 'Siigo Nube', 'Nueva solicitud': 'la nueva solicitud', 'Primer pago': 'el primer pago', 'Agua potable': 'el agua potable',
  'Actas firmadas': 'las actas firmadas', 'Funciones del cargo': 'las funciones del cargo', 'Clientes nuevos': 'los clientes nuevos', 'Fuentes de datos': 'las fuentes de datos',
  'Reportes del mes': 'los reportes del mes', 'Día de pago': 'el día de pago', 'Sistema de nómina': 'el sistema de nómina', 'Programa de capacitación': 'el programa de capacitación',
  'Foto del documento': 'la foto del documento', 'Mano de obra': 'la mano de obra', 'Canales de venta': 'los canales de venta', 'Luces del tablero': 'las luces del tablero',
  'Cuentas corrientes y de ahorro en pesos': 'las cuentas corrientes y de ahorro en pesos', 'Tarifas vigentes': 'las tarifas vigentes', 'Checklist de cierre': 'el checklist de cierre' };
Object.entries(N).forEach(([a, b]) => eq(L.conArticulo(a), b, 'art ' + a));
eq(L.conArticulo('Excel', 'herramienta'), 'Excel', 'Excel'); eq(L.conArticulo('Correo electrónico', 'herramienta'), 'el correo electrónico', 'correo');
eq(L.conArticulo('Portal empresarial del banco', 'herramienta'), 'el portal empresarial del banco', 'portal'); eq(L.conArticulo('SharePoint', 'herramienta'), 'SharePoint', 'SharePoint');
eq(L.conArticulo('Salesforce', 'herramienta'), 'Salesforce', 'Salesforce'); eq(L.conArticulo('Hoja de cálculo', 'herramienta'), 'la hoja de cálculo', 'hoja');
eq(L.conPrep('de', L.conArticulo('Sistema contable')), 'del sistema contable', 'del'); eq(L.conPrep('a', L.conArticulo('Área de compras')), 'al área de compras', 'al área');
eq(L.lista(['contabilidad', 'informática']), 'contabilidad e informática', 'y→e'); eq(L.lista(['siete', 'ocho']), 'siete u ocho'.replace(' u ', ' y '), 'y normal');
eq(L.lista(['uno', 'otro'], 'o'), 'uno u otro', 'o→u'); eq(L.lista(['a', 'b', 'hielo']), 'a, b y hielo', 'hie');
// cláusulas
const C = { 'El banco publica el extracto del mes': true, 'Movimientos cargados en Siigo': false, 'Diferencias explicadas': false, 'Conciliación archivada en la carpeta del cliente': false,
  'El extracto cubre el mes completo y trae saldo final': true, 'Diferencia final en cero o totalmente explicada': false, 'Llega una solicitud del cliente': true,
  'Solicitud del cliente': false, 'El cliente acepta la propuesta': true, 'La conciliación queda archivada': true, 'Cuentas corrientes y de ahorro en pesos de los clientes del despacho': false,
  'Aplica la norma a todas las cuentas': true, 'Reporte de entrega': false, 'La entrega del informe': false, 'Firma del jefe': false, 'Se recibe la factura': true };
Object.entries(C).forEach(([a, b]) => eq(L.esClausula(a), b, 'cláusula ' + a));
// descripciones
eq(L.aTercera('Ingresar al portal del banco con el token. Descargar el PDF y guardarlo en la carpeta del mes.'), 'Ingresa al portal del banco con el token. Descarga el PDF y lo guarda en la carpeta del mes.', 'descr 1');
eq(L.aTercera('Si hay diferencias, llamar al cliente.'), 'Si hay diferencias, llama al cliente.', 'descr 2');
eq(L.aTercera('El sistema cruza los movimientos.'), 'El sistema cruza los movimientos.', 'descr 3 igual');
eq(L.aTercera('- Abrir el archivo\n- Revisar totales'), '- Abre el archivo\n- Revisa los totales', 'descr viñetas');
eq(L.aTercera('Usar la plantilla para descargar y guardar el reporte.'), 'Usa la plantilla para descargar y guardar el reporte.', 'descr para+inf');
// tiempos
eq(L.duracion(0.25, 'h'), 'un cuarto de hora', '0,25 h'); eq(L.duracion(0.5, 'h'), 'media hora', '0,5 h'); eq(L.duracion(0.1, 'h'), 'unos 6 minutos', '0,1 h');
eq(L.duracion(1, 'h'), 'una hora', '1 h'); eq(L.duracion(1.5, 'h'), 'una hora y media', '1,5 h'); eq(L.duracion(24, 'h'), '24 horas', '24 h'); eq(L.duracion(2.5, 'h'), '2 horas y media', '2,5 h');
eq(L.duracion(3, 'días'), '3 días', '3 días'); eq(L.duracion(1, 'días'), 'un día', '1 día'); eq(L.duracion(45, 'min'), 'unos 45 minutos', '45 min'); eq(L.duracion(0.2, 'h'), 'unos 10 minutos', '0,2 h');
eq(L.unoTrasOtro('partida sin cruce'), 'una tras otra', 'una tras otra'); eq(L.unoTrasOtro('cliente'), 'uno tras otro', 'uno tras otro');
console.log(f ? f + ' FALLAS' : 'TODO OK');
