import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../lib/database.types'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!
const db = createClient<Database>(url, service, { db: { schema: 'kaze' }, auth: { autoRefreshToken: false, persistSession: false } })

// --- Configuración por variables de entorno ---
// SEED_PASSWORD: password de los usuarios creados por el seed. El default 'cota-demo-2026'
// es solo para el stack local de demo (ver AGENTS.md). Las corridas de PRODUCCIÓN DEBEN
// definir SEED_PASSWORD con una clave fuerte.
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'cota-demo-2026'
// SEED_ONLY: códigos A3 separados por coma (ej. "A3-014,A3-012,A3-030") para sembrar solo
// un subconjunto de proyectos (pensado para poblar producción con casos representativos).
// undefined → dataset completo, comportamiento idéntico al de siempre.
const seedOnlyCodes = process.env.SEED_ONLY?.split(',').map(s => s.trim()).filter(Boolean)

// "Hoy" congelado del prototipo (Indicadores Seguimiento:292, Casos de Negocio:367).
// Ancla para convertir fechas relativas (due de acciones) en fechas absolutas.
const HOY = '2026-06-20'
const venceDate = (due: number) => {
  const d = new Date(`${HOY}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + due)
  return d.toISOString().slice(0, 10)
}

// --- Consultores (auth users + profiles creados explícitamente por el seed) ---
// Nombres según CONSULTORES en reference/prototype/Cota - Lista de Proyectos.dc.html:371.
const TEAM = [
  { iniciales: 'CV', nombre: 'Carmen Vidal',   email: 'carmen@cota.test' },
  { iniciales: 'DL', nombre: 'Diego López',    email: 'diego@cota.test' },
  { iniciales: 'MP', nombre: 'María Paz',       email: 'maria@cota.test' },
  { iniciales: 'JM', nombre: 'Javier Marín',    email: 'javier@cota.test' },
  { iniciales: 'RA', nombre: 'Rodrigo Andrade', email: 'rodrigo@cota.test' },
]

// --- Clientes (reference/prototype/Cota - Vista de Cliente.dc.html:412-427) ---
// Retail Vega no aparece en Vista de Cliente: el nombre sale de Lista de Proyectos:359;
// sus iniciales siguen la convención ini() del prototipo (Lista de Proyectos:373).
const CLIENTS = [
  { nombre: 'Despacho Andrade & Vega', sector: 'Servicios contables · Santiago', iniciales: 'AV' },
  { nombre: 'Logística Sur',           sector: 'Transporte y distribución',       iniciales: 'LS' },
  { nombre: 'Manufactura Délano',      sector: 'Manufactura industrial',          iniciales: 'MD' },
  { nombre: 'Clínica Norte',           sector: 'Salud · ambulatorio',             iniciales: 'CN' },
  { nombre: 'Retail Vega',             sector: 'Retail',                          iniciales: 'RV' },
]

// --- Proyectos A3 (reference/prototype/Cota - Lista de Proyectos.dc.html:337-362) ---
// team = arreglo real del prototipo; su convención es team[0]=consultor, team[1]=líder,
// resto=miembros (ver crearProyecto, Lista de Proyectos:379). avance = a3done (pasos A3 hechos).
const PROJECTS = [
  { code: 'A3-014', titulo: 'Reducir reprocesos en conciliaciones', cliente: 'Despacho Andrade & Vega', estado: 'progreso', team: ['CV', 'DL'], avance: 4 },
  { code: 'A3-009', titulo: 'Cierre mensual ágil',                  cliente: 'Despacho Andrade & Vega', estado: 'progreso', team: ['CV', 'MP'], avance: 6 },
  { code: 'A3-021', titulo: 'Onboarding de clientes',               cliente: 'Logística Sur',           estado: 'riesgo',   team: ['JM', 'RA'], avance: 3 },
  { code: 'A3-018', titulo: 'Reducir mermas en bodega',             cliente: 'Logística Sur',           estado: 'progreso', team: ['DL'],       avance: 5 },
  { code: 'A3-025', titulo: 'Setup de línea · SMED',                cliente: 'Manufactura Délano',      estado: 'progreso', team: ['RA', 'MP'], avance: 4 },
  { code: 'A3-012', titulo: 'Defectos de empaque',                  cliente: 'Manufactura Délano',      estado: 'cerrado',  team: ['CV'],       avance: 7 },
  { code: 'A3-007', titulo: 'Tiempo de espera en admisión',         cliente: 'Clínica Norte',           estado: 'cerrado',  team: ['JM', 'DL'], avance: 7 },
  { code: 'A3-030', titulo: 'Quiebres de stock en tienda',          cliente: 'Retail Vega',             estado: 'nuevo',    team: ['CV'],       avance: 1 },
]

// --- KPIs con serie (reference/prototype/Cota - Indicadores Seguimiento.dc.html:306-368) ---
// serie = lecturas quincenales → filas en measurements. Fechas reales del prototipo:
// ['8 abr','22 abr','6 may','20 may','3 jun','10 jun'] del año 2026 (HOY = 2026-06-20),
// compartidas por los 7 KPIs.
const FECHAS = ['2026-04-08', '2026-04-22', '2026-05-06', '2026-05-20', '2026-06-03', '2026-06-10']
const KPIS = [
  { code_a3: 'A3-014', nombre: 'Lead time de cierre',         descripcion: 'Días hábiles entre el corte y el cierre contable firmado',      unidad: 'd',   base: 11,  meta: 5,   mejor_baja: true,  serie: [11, 10.6, 9.8, 9.1, 8.6, 8.2] },
  { code_a3: 'A3-014', nombre: 'Declaraciones sin reproceso', descripcion: '% de declaraciones que no requieren corrección posterior',      unidad: '%',   base: 84,  meta: 97,  mejor_baja: false, serie: [84, 85.6, 87.1, 88.9, 90.2, 91.4] },
  { code_a3: 'A3-014', nombre: 'Tiempo de respuesta',         descripcion: 'Horas promedio para responder consultas del cliente',           unidad: 'h',   base: 8.5, meta: 4,   mejor_baja: true,  serie: [8.5, 7.4, 6.8, 6.5, 6.4, 6.3] },
  { code_a3: 'A3-021', nombre: 'Tiempo de alta de cliente',   descripcion: 'Días desde la solicitud hasta el cliente operativo',            unidad: 'd',   base: 8.2, meta: 4,   mejor_baja: true,  serie: [8.2, 8.5, 8.4, 8.8, 9, 9.4] },
  { code_a3: 'A3-018', nombre: 'Merma sobre inventario',      descripcion: '% de mercadería perdida o vencida sobre el inventario',         unidad: '%',   base: 3.2, meta: 1.5, mejor_baja: true,  serie: [3.2, 3, 2.8, 2.6, 2.4, 2.3] },
  { code_a3: 'A3-025', nombre: 'Tiempo de cambio de formato', descripcion: 'Minutos de parada de línea por cambio (SMED)',                  unidad: 'min', base: 32,  meta: 12,  mejor_baja: true,  serie: [32, 29, 26, 23, 20, 18] },
  { code_a3: 'A3-012', nombre: 'Defectos por mil',            descripcion: 'Unidades defectuosas por cada mil producidas',                  unidad: '‰',   base: 5.3, meta: 1,   mejor_baja: true,  serie: [5.3, 4, 3, 2.1, 1.5, 1.1] },
]

// --- Casos de negocio + gastos (reference/prototype/Cota - Casos de Negocio.dc.html:376-408) ---
// capex = suma de gastos CapEx únicos planificados (fórmula del prototipo, Casos:484);
// opex_anual = OpEx planificado anualizado (Casos:486).
// Mapeo tipo de gasto prototipo → check de expenses ('inicial'|'recurrente'|'nuevo'):
//   plan:true  + rec:'unico'           → 'inicial'    (inversión inicial planificada)
//   plan:true  + rec:'anual'/'mensual' → 'recurrente' (OpEx recurrente)
//   plan:false                         → 'nuevo'      (gasto no planificado; chip "nuevo" en Casos:325,627)
const CASES = [
  { code: 'BC-07', code_a3: 'A3-014', titulo: 'Automatización del cuadre de bancos',      capex: 18000, opex_anual: 4200, ahorro_bruto_anual: 32000, tasa: 0.12, inicio: '2026-04-01', fecha_limite: '2026-12-31',
    gastos: [
      { fecha: '2026-04-01', concepto: 'Licencia software de conciliación',  monto: 9000, tipo: 'inicial' },
      { fecha: '2026-04-01', concepto: 'Implementación e integración TI',    monto: 6500, tipo: 'inicial' },
      { fecha: '2026-04-08', concepto: 'Capacitación del equipo',            monto: 2500, tipo: 'inicial' },
      { fecha: '2026-04-15', concepto: 'Soporte y mantención',               monto: 4200, tipo: 'recurrente' },
      { fecha: '2026-06-05', concepto: 'Ajuste regla matching bancos 3-4',   monto: 1500, tipo: 'nuevo' },
    ] },
  { code: 'BC-09', code_a3: 'A3-025', titulo: 'Carro de cambio rápido pre-armado (SMED)', capex: 7500,  opex_anual: 900,  ahorro_bruto_anual: 21500, tasa: 0.12, inicio: '2026-03-15', fecha_limite: '2026-09-30',
    gastos: [
      { fecha: '2026-03-15', concepto: 'Fabricación del carro y utillaje',   monto: 5200, tipo: 'inicial' },
      { fecha: '2026-03-15', concepto: 'Rediseño de matrices',               monto: 2300, tipo: 'inicial' },
      { fecha: '2026-03-20', concepto: 'Mantención de utillaje',             monto: 900,  tipo: 'recurrente' },
    ] },
]

// --- Acciones (reference/prototype/Cota - Acciones Kanban.dc.html:334-347) ---
// due = días relativos del prototipo → vence = HOY + due (HOY congelado, ver arriba).
const ACTIONS = [
  { code: 'AC-41', code_a3: 'A3-014', titulo: 'Estandarizar el checklist de conciliación',    estado: 'doing', prioridad: 'alta',  owner: 'DL', due: -2,  inversion: false, descripcion: 'Documentar un checklist único de conciliación bancaria para que todo el equipo siga los mismos pasos de cuadre, sin criterios personales.' },
  { code: 'AC-39', code_a3: 'A3-014', titulo: 'Validación poka-yoke al cargar asientos',      estado: 'doing', prioridad: 'media', owner: 'DL', due: 16,  inversion: true,  descripcion: 'Agregar validaciones automáticas en el formulario de asientos para impedir cargas con descuadres o cuentas inválidas.' },
  { code: 'AC-44', code_a3: 'A3-014', titulo: 'Capacitación NIIF para juniors',               estado: 'todo',  prioridad: 'baja',  owner: 'CV', due: 42,  inversion: false, descripcion: 'Programa de 4 sesiones para reducir errores de criterio contable en el equipo junior.' },
  { code: 'AC-37', code_a3: 'A3-009', titulo: 'Calendario de cierre compartido',              estado: 'done',  prioridad: 'media', owner: 'DL', due: -30, inversion: false, descripcion: 'Publicar los hitos del cierre en un calendario común para alinear a todo el equipo y evitar tareas de última hora.' },
  { code: 'AC-45', code_a3: 'A3-009', titulo: 'Plantilla única de papeles de trabajo',        estado: 'check', prioridad: 'media', owner: 'MP', due: 3,   inversion: false, descripcion: 'Unificar el formato de papeles de trabajo para acelerar la revisión y la trazabilidad entre periodos.' },
  { code: 'AC-52', code_a3: 'A3-021', titulo: 'Rediseñar formulario de alta de cliente',      estado: 'doing', prioridad: 'alta',  owner: 'JM', due: -5,  inversion: false, descripcion: 'Simplificar el formulario de alta eliminando campos redundantes y reordenando el flujo de captura.' },
  { code: 'AC-53', code_a3: 'A3-021', titulo: 'Eliminar doble captura en CRM',                estado: 'todo',  prioridad: 'alta',  owner: 'RA', due: 9,   inversion: true,  descripcion: 'Integrar el alta con el CRM para no recapturar los datos del cliente en dos sistemas.' },
  { code: 'AC-48', code_a3: 'A3-018', titulo: 'Conteo cíclico ABC en bodega',                 estado: 'check', prioridad: 'media', owner: 'DL', due: 5,   inversion: false, descripcion: 'Implementar conteos cíclicos priorizando los SKU de mayor valor para detectar mermas antes del inventario anual.' },
  { code: 'AC-49', code_a3: 'A3-018', titulo: 'Etiquetado de ubicaciones FIFO',               estado: 'done',  prioridad: 'baja',  owner: 'DL', due: -12, inversion: false, descripcion: 'Rotular las ubicaciones para forzar la rotación FIFO y reducir el producto vencido.' },
  { code: 'AC-57', code_a3: 'A3-025', titulo: 'Carro de cambio rápido pre-armado',            estado: 'doing', prioridad: 'alta',  owner: 'RA', due: 1,   inversion: true,  descripcion: 'Preparar un carro con todas las herramientas y matrices del cambio para convertir tareas internas en externas (SMED).' },
  { code: 'AC-58', code_a3: 'A3-025', titulo: 'Separar tareas internas y externas (SMED)',    estado: 'todo',  prioridad: 'media', owner: 'MP', due: 14,  inversion: false, descripcion: 'Mapear el cambio de formato y clasificar cada tarea para moverla fuera de la parada de máquina.' },
  { code: 'AC-33', code_a3: 'A3-012', titulo: 'Inspección por atributos en línea 2',          estado: 'done',  prioridad: 'media', owner: 'CV', due: -40, inversion: false, descripcion: 'Estación de inspección por atributos al final de la línea 2 para frenar defectos antes del empaque.' },
]

async function main() {
  // 0) selección SEED_ONLY — se resuelve primero, antes de tocar la base, para fallar rápido
  // y sin dejar filas parciales. Mismo estilo throw-on-error que los lookups de más abajo.
  // Filtra los arreglos de datos (PROJECTS/CLIENTS/KPIS/CASES/ACTIONS) definidos arriba;
  // TEAM nunca se filtra — el equipo se siembra completo siempre (sección 1).
  const selectedProjects = seedOnlyCodes
    ? seedOnlyCodes.map(code => {
        const p = PROJECTS.find(pr => pr.code === code)
        if (!p) throw new Error(`SEED_ONLY: código de proyecto no encontrado en PROJECTS: ${code}`)
        return p
      })
    : PROJECTS
  const selectedCodesA3 = new Set(selectedProjects.map(p => p.code))
  const selectedClientNames = new Set(selectedProjects.map(p => p.cliente))
  const selectedClients = seedOnlyCodes ? CLIENTS.filter(c => selectedClientNames.has(c.nombre)) : CLIENTS
  const selectedKpis = seedOnlyCodes ? KPIS.filter(k => selectedCodesA3.has(k.code_a3)) : KPIS
  const selectedCases = seedOnlyCodes ? CASES.filter(c => selectedCodesA3.has(c.code_a3)) : CASES
  const selectedActions = seedOnlyCodes ? ACTIONS.filter(a => selectedCodesA3.has(a.code_a3)) : ACTIONS
  if (seedOnlyCodes) {
    console.log(`Seed selectivo: ${selectedProjects.length} proyectos (${selectedProjects.map(p => p.code).join(', ')})`)
  }

  // 1) equipo
  const teamIds: Record<string, string> = {}
  for (const t of TEAM) {
    const { data, error } = await db.auth.admin.createUser({
      email: t.email, password: SEED_PASSWORD, email_confirm: true,
      user_metadata: { nombre: t.nombre, iniciales: t.iniciales },
    })
    if (error) throw error
    teamIds[t.iniciales] = data.user!.id
    // Ya no hay trigger que cree el profile: lo crea el seed.
    const { error: uErr } = await db.from('profiles').insert({
      id: data.user!.id,
      nombre: t.nombre, iniciales: t.iniciales,
      rol: t.iniciales === 'CV' ? 'admin' : 'consultor',
    })
    if (uErr) throw uErr
  }
  const teamId = (ini: string) => {
    const id = teamIds[ini]
    if (!id) throw new Error(`unknown team initials: ${ini}`)
    return id
  }

  // Usuario deliberadamente SIN perfil de Kaze: representa a alguien con cuenta
  // en el proyecto compartido (p. ej. del CMS) que no es miembro de Kaze.
  // Lo consume tests/data/rls-no-miembro.test.ts. No borrar.
  {
    const { error } = await db.auth.admin.createUser({
      email: 'ajeno@cota.test', password: SEED_PASSWORD, email_confirm: true,
      user_metadata: { nombre: 'Ajeno Sin Acceso' },
    })
    if (error && !/already|registered|exists/i.test(error.message)) throw error
  }

  // 2) clientes
  const { data: clientRows, error: cErr } = await db.from('clients').insert(selectedClients).select()
  if (cErr) throw cErr
  const clientId = (nombre: string) => {
    const row = clientRows.find(c => c.nombre === nombre)
    if (!row) throw new Error(`unknown cliente: ${nombre}`)
    return row.id
  }

  // 3) proyectos
  const projInput = selectedProjects.map(p => ({
    code: p.code, titulo: p.titulo, estado: p.estado,
    client_id: clientId(p.cliente),
    consultor_id: teamId(p.team[0]),
    lider_id: p.team[1] ? teamId(p.team[1]) : null,
    miembros: p.team.slice(2).map(i => teamId(i)),
    avance_pasos: p.avance,
  }))
  const { data: projRows, error: pErr } = await db.from('projects').insert(projInput).select()
  if (pErr) throw pErr
  const projId = (code: string) => {
    const row = projRows.find(p => p.code === code)
    if (!row) throw new Error(`unknown project code: ${code}`)
    return row.id
  }

  // 4) kpis + measurements
  for (const k of selectedKpis) {
    const { data: kpiRow, error: kErr } = await db.from('kpis').insert({
      project_id: projId(k.code_a3), nombre: k.nombre, descripcion: k.descripcion, unidad: k.unidad,
      base: k.base, meta: k.meta, mejor_baja: k.mejor_baja,
    }).select().single()
    if (kErr) throw kErr
    const meas = k.serie.map((valor, i) => ({
      kpi_id: kpiRow.id, valor, fecha: FECHAS[i],
    }))
    const { error: mErr } = await db.from('measurements').insert(meas)
    if (mErr) throw mErr
  }

  // 5) casos + gastos
  for (const bc of selectedCases) {
    const { data: caseRow, error } = await db.from('business_cases').insert({
      code: bc.code, project_id: projId(bc.code_a3), titulo: bc.titulo,
      capex: bc.capex, opex_anual: bc.opex_anual, ahorro_bruto_anual: bc.ahorro_bruto_anual, tasa: bc.tasa,
      inicio: bc.inicio, fecha_limite: bc.fecha_limite,
    }).select().single()
    if (error) throw error
    const { error: gErr } = await db.from('expenses').insert(
      bc.gastos.map(g => ({ business_case_id: caseRow.id, fecha: g.fecha, concepto: g.concepto, monto: g.monto, tipo: g.tipo })),
    )
    if (gErr) throw gErr
  }

  // 6) acciones
  const actInput = selectedActions.map(a => ({
    code: a.code, project_id: projId(a.code_a3), titulo: a.titulo, descripcion: a.descripcion,
    estado: a.estado, prioridad: a.prioridad, owner_id: teamId(a.owner),
    vence: venceDate(a.due), inversion: a.inversion,
  }))
  const { error: aErr } = await db.from('actions').insert(actInput)
  if (aErr) throw aErr

  console.log('Seed OK')
}
main().catch(e => { console.error(e); process.exit(1) })
