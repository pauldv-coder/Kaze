// Proceso de ejemplo que se siembra en el almacenamiento del artifact.
const act = (clave, nombre, extra) => Object.assign({
  clave, nombre, descripcion: null, responsable: null, departamento: 'Contabilidad', apoyo: null,
  entradas: null, entregable: null, receptor: null, receptorExterno: false, criterio: null,
  tProceso: null, tEspera: null, unidad: 'h', frecuencia: 'Mensual, por cuenta bancaria',
  herramientas: null, documentos: null, reglas: null, problemas: null,
  fuente: 'Entrevista 15 sept 2026', evidencia: null, estado: 'confirmado', origenClave: null,
  ejecucion: 'persona', formatos: [], eventos: [], ciclo: null,
}, extra);

const actividades = [
  act('a_descargar', 'Descargar extracto bancario', { descripcion: 'Ingresar al portal empresarial con el token de la empresa y descargar el extracto en PDF y en Excel. Guardar ambos archivos en la carpeta del mes.', responsable: 'Auxiliar contable', entradas: 'Acceso al portal del banco', entregable: 'Extracto del mes', tProceso: 0.25, tEspera: 0, herramientas: 'Portal empresarial del banco', criterio: 'El extracto cubre el mes completo y trae saldo final' }),
  act('a_cargar', 'Cargar extracto al sistema contable', { responsable: 'Auxiliar contable', entradas: 'Extracto del mes', entregable: 'Movimientos bancarios cargados', tProceso: 0.5, tEspera: 'desconocido', herramientas: 'Siigo Nube' }),
  act('a_cuadre', 'Ejecutar cuadre automático', { responsable: 'Sistema contable', ejecucion: 'sistema', departamento: 'na', entradas: 'Movimientos bancarios cargados', entregable: 'Reporte de partidas sin cruce', tProceso: 0.1, tEspera: 0, herramientas: 'Siigo Nube', frecuencia: 'Mensual, por cuenta bancaria' }),
  act('a_investigar', 'Investigar diferencias', { descripcion: 'Revisa cada partida del reporte contra los soportes. Si es una consignación sin referencia, llamar al cliente para identificarla; si es una comisión, pedir el soporte al banco.', responsable: 'Analista contable', entradas: 'Reporte de partidas sin cruce', entregable: 'Explicación de cada diferencia', tProceso: 'desconocido', tEspera: 'desconocido', estado: 'pregunta', problemas: 'Las consignaciones sin referencia se demoran porque hay que llamar al cliente.', apoyo: 'Tesorería del cliente',
    ciclo: { tipo: 'porCada', condicion: 'partida sin cruce', paralelo: false },
    eventos: [{ id: 'e_resp', tipo: 'mensaje', momento: 'despues', texto: 'Respuesta del cliente', n: null, unidad: 'h', quien: 'Tesorería del cliente', externo: true, destino: null, interrumpe: true }] }),
  act('a_registrar', 'Registrar partidas conciliatorias', { responsable: 'Analista contable', entradas: 'Explicación de cada diferencia', entregable: 'Partidas conciliatorias', tProceso: 1, tEspera: 0, criterio: 'desconocido', reglas: 'Toda partida mayor a 90 días se ajusta contra gasto con visto bueno de la jefe.',
    formatos: [{ id: 'fm_partidas', nombre: 'Registro de partidas conciliatorias', codigo: 'FT-CON-02', version: '1', archivo: null, enlace: null }] }),
  act('a_revisar', 'Revisar y aprobar la conciliación', { responsable: 'Jefe de contabilidad', entradas: 'Partidas conciliatorias', entregable: 'Conciliación firmada', tProceso: 0.5, tEspera: 24, criterio: 'Diferencia final en cero o totalmente explicada', fuente: 'Entrevista 18 sept 2026',
    formatos: [{ id: 'fm_concil', nombre: 'Formato de conciliación bancaria', codigo: 'FT-CON-01', version: '3', archivo: null, enlace: null }] }),
  act('a_enviar', 'Enviar informe de conciliación al cliente', { responsable: 'Auxiliar contable', entradas: 'Conciliación firmada', entregable: 'Informe de conciliación', receptor: 'Gerencia financiera del cliente', receptorExterno: true, tProceso: 0.25, tEspera: 0, herramientas: 'Correo electrónico' }),
  act('a_archivar', 'Archivar la conciliación', { responsable: 'Auxiliar contable', entradas: 'Conciliación firmada', entregable: 'na', tProceso: 0.1, tEspera: 0, documentos: 'Carpeta del cliente en SharePoint' }),
  act('a_tesoreria', 'Confirmar saldos con tesorería', { responsable: null, departamento: null, frecuencia: null, estado: 'sugerencia', fuente: 'Entrevista 18 sept 2026', evidencia: 'cuando el saldo no cuadra por más de un millón, primero le preguntamos a tesorería del cliente' }),
];

const map = {};
actividades.forEach(a => { map[a.clave] = a; });

export const proceso = {
  id: 'p_conciliacion',
  nombre: 'Conciliación bancaria mensual',
  objetivo: 'Cuadrar cada mes los extractos bancarios con la contabilidad y explicar toda diferencia antes del cierre.',
  alcance: 'Cuentas corrientes y de ahorro en pesos de los clientes del despacho.',
  exclusiones: 'Cuentas en moneda extranjera y tarjetas de crédito.',
  disparador: 'El banco publica el extracto del mes',
  inicio: { tipo: 'tiempo', detalle: 'Cada mes, hacia el tercer día hábil' },
  codigoDoc: 'PR-CON-01',
  referencias: [
    { id: 'r_1', codigo: 'PO-CON-01', nombre: 'Política de conciliaciones bancarias del despacho', tipo: 'interna', enlace: null },
    { id: 'r_2', codigo: 'PR-CON-02', nombre: 'Procedimiento de cierre contable mensual', tipo: 'interna', enlace: null },
  ],
  resultados: ['Conciliación aprobada y archivada'],
  cliente: 'Gerencia financiera del cliente', clienteExterno: true,
  proveedores: ['Banco (portal empresarial)', 'Tesorería del cliente'],
  dueno: 'Rosa Álvarez',
  departamentos: ['Contabilidad', 'Tesorería'],
  participantes: [
    { id: 'u_marta', num: 1, nombre: 'Marta Ríos', rol: 'Analista contable', departamento: 'Contabilidad', correo: 'marta.rios@ejemplo.co', papel: 'vobo' },
    { id: 'u_diego', num: 2, nombre: 'Diego López', rol: 'Auxiliar contable', departamento: 'Contabilidad', correo: 'diego.lopez@ejemplo.co', papel: 'informado' },
    { id: 'u_rosa', num: 3, nombre: 'Rosa Álvarez', rol: 'Jefe de contabilidad', departamento: 'Contabilidad', correo: 'rosa.alvarez@ejemplo.co', papel: 'aprueba' },
    { id: 'u_carlos', num: 4, nombre: 'Carlos Méndez', rol: 'Jefe de tesorería', departamento: 'Tesorería', correo: 'carlos.mendez@ejemplo.co', papel: 'vobo' },
    { id: 'u_laura', num: 5, nombre: 'Laura Gómez', rol: 'Gerente financiera', departamento: 'Gerencia financiera', correo: 'laura.gomez@ejemplo.co', papel: 'aprueba' },
  ],
  remitente: null,
  sesiones: [
    { id: 's_1', fecha: '2026-09-15', participantes: ['u_marta', 'u_diego'], notas: 'Diego descarga el extracto del portal del banco apenas sale, normalmente el tercer día hábil. Lo sube a Siigo y el sistema cruza solo los movimientos. Si todo cruza, pasa directo a revisión de Rosa. Si quedan partidas sin cruce, Marta las investiga: casi siempre son consignaciones sin referencia o comisiones que el banco no avisó. Para las consignaciones hay que llamar al cliente y eso puede tomar días. Marta registra las partidas conciliatorias en Siigo. Las partidas de más de 90 días se ajustan contra gasto, pero solo con visto bueno de Rosa.' },
    { id: 's_2', fecha: '2026-09-18', participantes: ['u_rosa'], notas: 'Rosa revisa todas las conciliaciones antes del cierre; le llegan juntas y a veces tarda un día en verlas. Si encuentra algo raro la devuelve a Marta con observaciones. Cuando la aprueba, Diego le manda el informe a la gerencia financiera del cliente por correo y la archiva en la carpeta del cliente en SharePoint. Cuando el saldo no cuadra por más de un millón, primero le preguntamos a tesorería del cliente.' },
  ],
  preguntas: [
    { id: 'q_1', texto: '¿Qué pasa si el banco no publica el extracto a tiempo para el cierre?', origen: 'ia', resuelta: false, fecha: '2026-09-18T15:00:00.000Z' },
  ],
  creado: '2026-09-15T14:00:00.000Z', actualizado: '2026-09-18T16:30:00.000Z', rev: 1, sesion: 'semilla',
  versiones: {
    asis: {
      numero: 1, estado: 'borrador',
      fases: [
        { id: 'f_prep', nombre: 'Preparación', objetivo: 'Tener los movimientos del banco dentro del sistema.', entrada: 'El banco publica el extracto', entregables: ['Extracto del mes', 'Movimientos bancarios cargados'], salida: 'Movimientos cargados en Siigo', actividades: ['a_descargar', 'a_cargar'] },
        { id: 'f_cuadre', nombre: 'Cuadre', objetivo: 'Explicar cada diferencia entre banco y libros.', entrada: 'Movimientos cargados en Siigo', entregables: ['Partidas conciliatorias'], salida: null, actividades: ['a_cuadre', 'a_investigar', 'a_registrar'] },
        { id: 'f_cierre', nombre: 'Cierre', objetivo: 'Dejar la conciliación aprobada, enviada y archivada.', entrada: 'Diferencias explicadas', entregables: ['Conciliación firmada', 'Informe de conciliación'], salida: 'Conciliación archivada en la carpeta del cliente', actividades: ['a_revisar', 'a_enviar', 'a_archivar'] },
      ],
      sinFase: ['a_tesoreria'],
      actividades: map,
      decisiones: [
        { clave: 'd_cuadra', pregunta: '¿Cruzan todos los movimientos?', origen: 'a_cuadre', decide: 'Sistema contable', tipo: 'exclusiva', estado: 'confirmado',
          salidas: [{ condicion: 'Sí, todo cruza', destino: 'a_revisar', porDefecto: true, clase: null }, { condicion: 'Quedan partidas sin cruce', destino: 'a_investigar', porDefecto: false, clase: null }],
          contexto: { faseOrigen: 'f_cuadre' }, aceptados: [] },
        { clave: 'd_aprueba', pregunta: '¿La jefe aprueba la conciliación?', origen: 'a_revisar', decide: 'Jefe de contabilidad', tipo: 'exclusiva', estado: 'confirmado',
          salidas: [{ condicion: 'Aprobada', destino: 'a_enviar', porDefecto: true, clase: null }, { condicion: 'Con observaciones', destino: 'a_investigar', porDefecto: false, clase: 'retrabajo' }],
          contexto: { faseOrigen: 'f_cierre' }, aceptados: [] },
      ],
      aprobacion: null, historial: [], diagrama: {},
    },
    tobe: null,
  },
};

if (typeof process !== 'undefined' && process.argv && process.argv[2] === 'print') console.log(JSON.stringify(proceso));
