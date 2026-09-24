/* Lengua: lo mínimo para contar un proceso en español, en tercera persona y en presente.
   · tercera('aprobar') → 'aprueba'; accionDe('Revisar y aprobar conciliación') → 'revisa y aprueba la conciliación'
   · conArticulo('Extracto del mes') → 'el extracto del mes'; conPrep('de', 'el área') → 'del área'
   · lista(['a', 'b', 'informes']) → 'a, b e informes'
   No es un analizador del idioma: son reglas y listas pensadas para nombres de actividades,
   entregables, roles y herramientas como los escribe un analista de procesos.
   Portado literalmente de `reference/captura/prototipo/src/lengua.js` (Task 1.2 del plan de
   captura): mismo texto de salida, mismas reglas. No importa nada, igual que el prototipo. */

/** Modo que usan `conArticulo`, `esNombrePropio`, `minus1` y `generoNumero` para decidir
 *  si una palabra en mayúscula es un sustantivo común (rol o herramienta) o un nombre propio. */
export type Modo = 'comun' | 'rol' | 'herramienta'

const quitarTildes = (s: string | null | undefined): string => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
const bajo = (s: string | null | undefined): string => String(s || '').toLowerCase()

/* ---------- verbos ---------- */
// Formas de tercera persona que no salen de una regla.
const IRREG: Record<string, string> = {
  ser: 'es', estar: 'está', ir: 'va', dar: 'da', ver: 've', haber: 'hay', saber: 'sabe', caber: 'cabe', poder: 'puede',
  querer: 'quiere', hacer: 'hace', tener: 'tiene', poner: 'pone', decir: 'dice', venir: 'viene', traer: 'trae', caer: 'cae',
  valer: 'vale', salir: 'sale', oír: 'oye', oir: 'oye', reír: 'ríe', reir: 'ríe', sonreír: 'sonríe', freír: 'fríe', oler: 'huele',
  errar: 'yerra', prever: 'prevé', rever: 'revé', entrever: 'entrevé', proveer: 'provee', leer: 'lee', creer: 'cree', poseer: 'posee',
  adquirir: 'adquiere', inquirir: 'inquiere', jugar: 'juega', satisfacer: 'satisface', argüir: 'arguye', desosar: 'deshuesa',
}
// Familias irregulares que se repiten con prefijos (contener, proponer, prevenir, rehacer…).
const FAMILIAS: Array<[string, string, string[]]> = [
  ['tener', 'tiene', ['con', 'ob', 'man', 'de', 're', 'sos', 'entre', 'abs', 'a']],
  ['venir', 'viene', ['pre', 'con', 'inter', 'pro', 'de', 're', 'sobre', 'a', 'sub', 'contra']],
  ['poner', 'pone', ['com', 'su', 'pro', 're', 'dis', 'ex', 'im', 'de', 'pos', 'contra', 'yuxta', 'ante', 'trans', 'tras', 'sobre', 'inter', 'o', 'pre', 'super', 'sus', 'indis', 'predis', 'recom']],
  ['hacer', 'hace', ['re', 'des', 'contra']],
  ['decir', 'dice', ['pre', 'contra', 'ben', 'mal']],
  ['traer', 'trae', ['a', 'con', 'dis', 'ex', 'sus', 'sub', 're', 'abs']],
  ['caer', 'cae', ['de', 're']],
  ['volver', 'vuelve', ['de', 're', 'en', 'desen']],
  ['mover', 'mueve', ['re', 'pro', 'con']],
  ['seguir', 'sigue', ['con', 'per', 'pro']],
  ['solver', 'suelve', ['re', 'ab', 'di']],
  ['probar', 'prueba', ['a', 'com', 're', 'desa']],
  ['sentir', 'siente', ['con', 'pre', 're', 'a', 'di']],
  ['ferir', 'fiere', ['pre', 're', 'con', 'di', 'in', 'trans', 'pro']],
  ['vertir', 'vierte', ['con', 'in', 're', 'di', 'per', 'sub', 'contro', 'ad']],
  ['querir', 'quiere', ['re']],
  ['pedir', 'pide', ['des', 'ex', 'im']],
  ['tender', 'tiende', ['a', 'en', 'ex', 'con', 'desa', 'sobreen']],
  ['contar', 'cuenta', ['des', 're']],
  ['cordar', 'cuerda', ['re', 'a', 'con', 'dis']],
  ['mostrar', 'muestra', ['de']],
  ['forzar', 'fuerza', ['re', 'es']],
  ['plegar', 'pliega', ['des', 're']],
  ['negar', 'niega', ['re', 'de']],
  ['servir', 'sirve', []],
  ['vestir', 'viste', ['re', 'in', 'tra']],
]
const E_IE = new Set<string>(['cerrar', 'encerrar', 'empezar', 'comenzar', 'recomendar', 'encomendar', 'enmendar', 'gobernar', 'pensar', 'repensar',
  'apretar', 'atravesar', 'confesar', 'manifestar', 'quebrar', 'acertar', 'concertar', 'desconcertar', 'enterrar', 'desterrar', 'despertar',
  'tropezar', 'regar', 'sembrar', 'calentar', 'recalentar', 'sentar', 'asentar', 'tentar', 'alentar', 'desalentar', 'acrecentar', 'reventar',
  'nevar', 'temblar', 'merendar', 'fregar', 'cegar', 'segar', 'sosegar', 'helar', 'entender', 'atender', 'extender', 'perder', 'defender',
  'descender', 'ascender', 'trascender', 'encender', 'verter', 'querer', 'hender', 'cernir', 'discernir', 'concernir', 'mentir', 'desmentir',
  'sugerir', 'digerir', 'ingerir', 'adherir', 'herir', 'hervir', 'arrepentir', 'invernar', 'empedrar', 'escarmentar', 'aventar', 'dentar'])
const O_UE = new Set<string>(['costar', 'recostar', 'acostar', 'rodar', 'soltar', 'sonar', 'resonar', 'soñar', 'tronar', 'volar', 'sobrevolar', 'colgar',
  'descolgar', 'rogar', 'almorzar', 'avergonzar', 'volcar', 'revolcar', 'renovar', 'poblar', 'repoblar', 'despoblar', 'consolar', 'tostar',
  'colar', 'encontrar', 'demoler', 'moler', 'soler', 'doler', 'llover', 'morder', 'torcer', 'retorcer', 'cocer', 'recocer', 'escocer',
  'dormir', 'morir', 'apostar', 'degollar', 'desollar', 'amolar', 'acordar', 'concordar'])
const E_I = new Set<string>(['medir', 'corregir', 'elegir', 'reelegir', 'regir', 'repetir', 'competir', 'rendir', 'derretir', 'concebir', 'gemir', 'colegir',
  'embestir', 'teñir', 'desteñir', 'ceñir', 'reñir', 'constreñir', 'estreñir', 'investir', 'expedir', 'impedir', 'despedir'])
// -iar con tilde en la i (envía, confía); el resto de -iar no la lleva (cambia, copia, negocia).
const IAR_TILDE = new Set<string>(['enviar', 'reenviar', 'confiar', 'desconfiar', 'fiar', 'guiar', 'ampliar', 'variar', 'desviar', 'vaciar', 'criar',
  'malcriar', 'espiar', 'fotografiar', 'esquiar', 'enfriar', 'resfriar', 'desafiar', 'averiar', 'rociar', 'hastiar', 'ataviar', 'contrariar',
  'piar', 'liar', 'desliar', 'porfiar', 'telegrafiar', 'cartografiar', 'radiografiar', 'estriar', 'expiar', 'inventariar', 'chirriar',
  'extraviar', 'ansiar', 'amnistiar', 'aliar', 'vidriar', 'enviciar', 'descarriar', 'arriar', 'vigiar', 'triar', 'jipiar', 'autografiar'])
// Otras con tilde en la raíz: reúne, prohíbe, aísla…
const TILDE_RAIZ: Record<string, string> = {
  reunir: 'reúne', prohibir: 'prohíbe', rehusar: 'rehúsa', aislar: 'aísla', aunar: 'aúna', aullar: 'aúlla', maullar: 'maúlla',
  ahumar: 'ahúma', cohibir: 'cohíbe', enraizar: 'enraíza', homogeneizar: 'homogeneíza', europeizar: 'europeíza', ahijar: 'ahíja',
  rehuir: 'rehúye', embaular: 'embaúla', ahuchar: 'ahúcha',
}
// Palabras que terminan en -ar/-er/-ir pero no son verbos (al inicio de un nombre).
const NO_VERBOS = new Set<string>(['lugar', 'hogar', 'mujer', 'placer', 'ayer', 'par', 'bar', 'mar', 'militar', 'familiar', 'similar', 'popular', 'regular',
  'escolar', 'celular', 'polar', 'solar', 'azar', 'néctar', 'taller', 'alquiler', 'cráter', 'póster', 'máster', 'líder', 'suéter', 'chófer',
  'tráiler', 'cáncer', 'carácter', 'mártir', 'elixir', 'nadir', 'tapir', 'faquir', 'emir', 'visir', 'primer', 'cualquier', 'auxiliar',
  'titular', 'particular', 'pilar', 'collar', 'altar', 'dólar', 'hangar', 'radar', 'billar', 'telar', 'manjar', 'olivar', 'palomar', 'yogur',
  'sur', 'ser', 'deber', 'poder', 'haber', 'saber', 'amanecer', 'atardecer', 'parecer', 'quehacer', 'menester', 'cadáver', 'éter', 'tener',
  'ámbar', 'azúcar', 'lunar', 'nuclear', 'lineal', 'molecular', 'muscular', 'ocular', 'peculiar', 'rectangular', 'circular', 'modular',
  'secular', 'singular', 'plural', 'vulgar', 'estelar', 'ejemplar', 'rector', 'sector', 'mayor', 'menor', 'desayunar'])
// Verbos que sí se usan al inicio aunque estén en la lista anterior (el contexto lo decide).
const VERBO_SI_SIGUE_OBJETO = new Set<string>(['circular', 'regular', 'titular', 'auxiliar', 'ser', 'deber', 'poder', 'haber', 'saber', 'tener', 'parecer', 'desayunar'])

const PREFIJOS_TODOS: Array<{ base: string; forma: string; prefijos: string[] }> = FAMILIAS.map(([base, forma, prefijos]) => ({ base, forma, prefijos }))

function cambiarRaiz(raiz: string, de: string, a: string): string | null {
  const i = raiz.lastIndexOf(de)
  if (i < 0) return null
  let nuevo = a
  if (de === 'o' && i > 0 && raiz[i - 1] === 'g') nuevo = 'üe'   // avergonzar → avergüenza
  if (de === 'e' && a === 'ie' && i === 0) nuevo = 'ye'            // errar → yerra
  return raiz.slice(0, i) + nuevo + raiz.slice(i + de.length)
}

/* Infinitivo → tercera persona del singular, presente de indicativo. null si no parece verbo. */
export function tercera(infinitivo: string | null | undefined, plural?: boolean): string | null {
  const f = terceraSing(infinitivo)
  if (!f || !plural) return f
  return f === 'es' ? 'son' : f === 'hay' ? 'hay' : f + 'n'
}
function terceraSing(infinitivo: string | null | undefined): string | null {
  const v = bajo(infinitivo).trim()
  if (IRREG[v]) return IRREG[v]
  if (!/^[a-záéíóúüñ]+(ar|er|ir|ír)$/.test(v) || v.length < 3) return null
  if (TILDE_RAIZ[v]) return TILDE_RAIZ[v]
  for (const f of PREFIJOS_TODOS) {
    if (v === f.base) return f.forma
    if (v.endsWith(f.base)) {
      const p = v.slice(0, v.length - f.base.length)
      if (f.prefijos.indexOf(p) >= 0) return p + f.forma
    }
  }
  if (v === 'pretender') return 'pretende'
  const fin = v.slice(-2).replace('ír', 'ir')
  const raiz = v.slice(0, -2)
  const voc = fin === 'ar' ? 'a' : 'e'
  if (E_IE.has(v)) { const r = cambiarRaiz(raiz, 'e', 'ie'); if (r) return r + voc }
  if (O_UE.has(v)) { const r = cambiarRaiz(raiz, 'o', 'ue'); if (r) return r + voc }
  if (E_I.has(v)) { const r = cambiarRaiz(raiz, 'e', 'i'); if (r) return r + voc }
  if (fin === 'ar' && /iar$/.test(v) && IAR_TILDE.has(v)) return raiz.slice(0, -1) + 'ía'
  if (fin === 'ar' && /[^cgq]uar$/.test(v)) return raiz.slice(0, -1) + 'úa'                  // evalúa, continúa, actúa
  if (fin === 'ir' && /[^gq]uir$/.test(v)) return raiz + 'ye'                                  // incluye, distribuye
  if (fin === 'ir' && /güir$/.test(v)) return raiz.replace(/ü$/, 'u') + 'ye'
  return raiz + voc
}

/** Infinitivo detectado (con o sin pronombres pegados), tal como lo devuelve `infinitivo`. */
export interface InfinitivoInfo { inf: string; cliticos: string[] }
/* ¿La palabra es un infinitivo (con o sin pronombres pegados)? Devuelve { inf, cliticos } o null. */
const CLIT = '(me|te|se|nos|os|le|les|lo|la|los|las)'
const RE_CLIT = new RegExp('^([a-záéíóúüñ]+?(?:ar|er|ir|ár|ér|ír))' + CLIT + '?' + CLIT + '?$')
export function infinitivo(palabra: string | null | undefined, siguiente?: string | null): InfinitivoInfo | null {
  const w = bajo(palabra).replace(/[.,;:]+$/, '')
  if (!w || w.length < 2) return null
  if (/^[a-záéíóúüñ]+(ar|er|ir|ír)$/.test(w) && !NO_VERBOS.has(w)) return { inf: w, cliticos: [] }
  if (NO_VERBOS.has(w) && VERBO_SI_SIGUE_OBJETO.has(w) && siguiente && esDeterminante(siguiente)) return { inf: w, cliticos: [] }
  const m = RE_CLIT.exec(w)
  if (m && (m[2] || m[3])) {
    let inf = m[1]
    const cl = [m[2], m[3]].filter(Boolean)
    // Con dos pronombres el infinitivo lleva tilde (enviárselo): se le quita, salvo en reír, oír…
    inf = inf.replace(/ár$/, 'ar').replace(/ér$/, 'er')
    if (/ír$/.test(inf) && !/^(reír|sonreír|freír|oír|desoír)$/.test(inf)) inf = inf.replace(/ír$/, 'ir')
    if (NO_VERBOS.has(inf) || inf.length < 3) return null
    if (!tercera(inf)) return null
    return { inf, cliticos: cl }
  }
  return null
}

/* ---------- sustantivos: género y número ---------- */
const SING_S = new Set<string>(['mes', 'gas', 'bus', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'virus', 'caos', 'cosmos', 'atlas', 'ómnibus',
  'campus', 'corpus', 'estatus', 'status', 'bonus', 'plus', 'lapsus', 'versus', 'tenis', 'dosis', 'crisis', 'tesis', 'análisis', 'síntesis',
  'hipótesis', 'énfasis', 'paréntesis', 'oasis', 'diagnosis', 'prótesis', 'metamorfosis', 'génesis', 'sinopsis', 'diabetes', 'caries',
  'cumpleaños', 'paraguas', 'parabrisas', 'rompecabezas', 'salvavidas', 'cortafuegos', 'iris', 'éxtasis', 'apocalipsis', 'chasis', 'bíceps',
  'tríceps', 'fórceps', 'brindis', 'tos', 'dios', 'adiós', 'anís', 'país', 'interés', 'estrés', 'revés', 'inglés', 'francés', 'compás',
  'autobús', 'ciprés', 'portugués', 'japonés', 'holandés', 'finlandés', 'cortés', 'través', 'kermés', 'alias', 'viacrucis', 'cactus', 'álbumes'])
const MASC_A = new Set<string>(['día', 'mapa', 'planeta', 'cometa', 'sofá', 'tranvía', 'papá', 'mediodía', 'clima', 'idioma', 'problema', 'sistema', 'tema',
  'programa', 'subprograma', 'esquema', 'dilema', 'diagrama', 'poema', 'drama', 'síntoma', 'trauma', 'lema', 'emblema', 'enigma', 'estigma',
  'dogma', 'paradigma', 'plasma', 'prisma', 'carisma', 'cisma', 'fantasma', 'pijama', 'telegrama', 'crucigrama', 'holograma', 'organigrama',
  'cronograma', 'histograma', 'pentagrama', 'anagrama', 'epigrama', 'fonema', 'morfema', 'teorema', 'axioma', 'aroma', 'panorama', 'yoga',
  'karma', 'delta', 'alfa', 'beta', 'gamma', 'sigma', 'omega', 'monograma', 'kilograma', 'miligrama', 'cablegrama', 'ideograma', 'edema',
  'glaucoma', 'hematoma', 'carcinoma', 'melanoma', 'ecosistema', 'subsistema', 'flujograma', 'dendrograma', 'sociograma', 'pictograma',
  'radiograma', 'electrocardiograma', 'diafragma', 'magma', 'plasma', 'quórum', 'guardarropa', 'portafolio', 'software', 'hardware'])
const FEM_O = new Set<string>(['mano', 'foto', 'moto', 'radio', 'libido', 'seo', 'nao', 'dinamo', 'polio', 'metro', 'disco'])  // metro/disco: se corrigen abajo
FEM_O.delete('metro')
FEM_O.delete('disco')
const FEM_E = new Set<string>(['llave', 'clave', 'calle', 'leche', 'noche', 'tarde', 'fuente', 'gente', 'mente', 'muerte', 'nieve', 'suerte', 'parte', 'base',
  'clase', 'frase', 'fase', 'nube', 'carne', 'sangre', 'torre', 'fiebre', 'sede', 'fe', 'catástrofe', 'hélice', 'índole', 'higiene', 'debacle',
  'nave', 'ave', 'hambre', 'corriente', 'vertiente', 'variante', 'constante', 'madre', 'frente', 'lente', 'tilde', 'costumbre', 'cumbre',
  'legumbre', 'certidumbre', 'incertidumbre', 'lumbre', 'muchedumbre', 'servidumbre', 'pesadumbre', 'techumbre', 'mansedumbre', 'herrumbre',
  'serie', 'especie', 'superficie', 'planicie', 'intemperie', 'barbarie', 'efigie', 'calvicie', 'pendiente', 'subclase', 'interfase',
  'trabe', 'plebe', 'urbe', 'tribu', 'ingle', 'hojaldre', 'cicatrice', 'cohorte', 'consorte', 'suerte', 'simiente', 'mugre', 'podre',
  'crispe', 'patente', 'gente', 'gripe', 'peste', 'plebe', 'síncope', 'apócope', 'aféresis', 'elipse', 'hipérbole',
  'parábola', 'jerarquía', 'nieve', 'tijera', 'torre', 'válvula', 'variable', 'constante', 'tarifa', 'fuente', 'labor'])
const FEM_CONSONANTE = new Set<string>(['flor', 'labor', 'mujer', 'coliflor', 'sor', 'piel', 'miel', 'hiel', 'sal', 'cal', 'señal', 'catedral', 'credencial',
  'sucursal', 'cárcel', 'col', 'moral', 'postal', 'vocal', 'diagonal', 'espiral', 'central', 'capital', 'terminal', 'integral', 'red', 'sed',
  'pared', 'merced', 'ley', 'grey', 'imagen', 'virgen', 'orden', 'razón', 'sazón', 'sinrazón', 'luz', 'voz', 'cruz', 'paz', 'vez', 'nuez', 'raíz',
  'nariz', 'matriz', 'cicatriz', 'directriz', 'actriz', 'tez', 'lombriz', 'perdiz', 'codorniz', 'hoz', 'coz', 'faz', 'interfaz', 'lid', 'vid',
  'tos', 'res', 'mies', 'crisis', 'tesis', 'dosis', 'síntesis', 'hipótesis', 'diagnosis', 'sinopsis', 'prótesis', 'metamorfosis', 'génesis',
  'caries', 'diabetes', 'bilis', 'sífilis', 'pelvis', 'dermis', 'epidermis', 'hélix', 'sinusitis', 'apendicitis', 'faringitis',
  'editorial', 'patrulla', 'app', 'web', 'startup', 'imágen'])
const MASC_CONSONANTE = new Set<string>(['corazón', 'buzón', 'tazón', 'calzón', 'garzón', 'lápiz', 'pez', 'maíz', 'arroz', 'disfraz', 'tapiz', 'barniz',
  'matiz', 'ajedrez', 'haz', 'altavoz', 'capataz', 'antifaz', 'desliz', 'cáliz', 'avestruz', 'regaliz', 'aprendiz', 'juez', 'jerez', 'césped',
  'huésped', 'ardid', 'abad', 'adalid', 'alud', 'ataúd', 'laúd', 'sud', 'talmud', 'análisis', 'énfasis', 'paréntesis', 'oasis', 'éxtasis',
  'apocalipsis', 'chasis', 'iris', 'margen', 'origen', 'examen', 'resumen', 'volumen', 'régimen', 'dictamen', 'certamen', 'germen',
  'crimen', 'abdomen', 'polen', 'espécimen', 'rey', 'buey', 'virrey', 'convoy', 'jersey', 'mar', 'sol'])
// Femeninos con a tónica: «el área», «el acta» (en plural, «las»).
const EL_FEM = new Set<string>(['área', 'acta', 'agua', 'aula', 'alma', 'arma', 'alza', 'ala', 'ancla', 'hambre', 'habla', 'hacha', 'hada', 'ave', 'águila',
  'arca', 'asa', 'aura', 'haba', 'alta', 'aria', 'ánfora', 'ánima', 'álgebra', 'árnica', 'hampa', 'asma'])

const sinT = (set: Set<string>): Set<string> => new Set(Array.from(set).map(quitarTildes))
const MASC_A_ST = sinT(MASC_A), MASC_C_ST = sinT(MASC_CONSONANTE), FEM_O_ST = sinT(FEM_O), FEM_E_ST = sinT(FEM_E), FEM_C_ST = sinT(FEM_CONSONANTE)
const en = (set: Set<string>, setSt: Set<string>, w: string): boolean => set.has(w) || setSt.has(quitarTildes(w))
// -ista: roles (el analista) frente a cosas (la lista, la entrevista).
const ISTAS_COSA = new Set<string>(['lista', 'revista', 'vista', 'pista', 'arista', 'conquista', 'entrevista', 'autopista', 'checklist'])
// Siglas que son sustantivos comunes y llevan artículo: «el PDF», «la URL».
export const SIGLAS_COMUNES: Record<string, 'm' | 'f'> = {
  pdf: 'm', nit: 'm', rut: 'm', iva: 'm', csv: 'm', xml: 'm', url: 'f', api: 'f', kpi: 'm', sku: 'm', oc: 'f', op: 'f',
  ot: 'f', pqr: 'f', pqrs: 'f', soat: 'm', cufe: 'm', cdp: 'm', crp: 'm', cv: 'm', id: 'm', qr: 'm', sms: 'm', otp: 'm', pin: 'm', nda: 'm',
  sla: 'm', ans: 'm', rfp: 'f', rfq: 'f', poa: 'm', pdv: 'm', ppt: 'f', faq: 'f', ceco: 'm', cuit: 'm', rfc: 'm', curp: 'f', dni: 'm', ruc: 'm',
}
/** Género y número de una frase nominal, a partir de su primera palabra. */
export interface GeneroNumero { g: 'm' | 'f'; n: 's' | 'p'; a: boolean }
export function generoNumero(palabra: string | null | undefined, modo?: Modo): GeneroNumero {
  const w0 = bajo(palabra).replace(/[.,;:«»"“”()]/g, '')
  let n: 's' | 'p' = 's'
  let w = w0
  if (/x$/.test(w)) n = 's'
  else if (/s$/.test(w) && !SING_S.has(w) && !/[^aeiou]is$/.test(w) && !(/is$/.test(w) && w.length > 4)) n = 'p'
  if (n === 'p') {
    // Singular aproximado para decidir el género.
    if (/ces$/.test(w)) w = w.slice(0, -3) + 'z'
    else if (/(ciones|siones|xiones)$/.test(w)) w = w.slice(0, -2).replace(/on$/, 'ón')
    else if (/[^aeiouáéíóú]es$/.test(w) && !/(ores|ales|eles|iles|oles|ules|ares|eres|ires|anes|enes|ines|ones|unes|des|yes)$/.test(w)) w = w.slice(0, -1)
    else if (/(ores|ales|eles|iles|oles|ules|ares|eres|ires|des|yes)$/.test(w)) w = w.slice(0, -2)
    else if (/(anes|enes|ines|ones|unes)$/.test(w)) w = quitarTildes(w.slice(0, -2))
    else w = w.slice(0, -1)
  }
  if (SIGLAS_COMUNES[w]) return { g: SIGLAS_COMUNES[w], n, a: false }
  let g: 'm' | 'f' = 'm'
  if (en(MASC_A, MASC_A_ST, w) || en(MASC_CONSONANTE, MASC_C_ST, w)) g = 'm'
  else if (en(FEM_O, FEM_O_ST, w) || en(FEM_E, FEM_E_ST, w) || en(FEM_CONSONANTE, FEM_C_ST, w)) g = 'f'
  else if (/ista$/.test(w)) g = ISTAS_COSA.has(w) && modo !== 'rol' ? 'f' : 'm'
  else if (/(ción|sión|xión|cion|sion|xion|dad|tad|tud|umbre|ie|itis|triz|ez|eza|anza|ncia|nza|sis|ía|ia)$/.test(w)) g = 'f'
  else if (/a$|á$/.test(w)) g = 'f'
  else if (/d$/.test(w)) g = 'f'
  return { g, n, a: g === 'f' && n === 's' && EL_FEM.has(w) }
}

/* ---------- determinantes, preposiciones y nombres propios ---------- */
const DET = new Set<string>(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'lo', 'al', 'del', 'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos',
  'esas', 'aquel', 'aquella', 'aquellos', 'aquellas', 'su', 'sus', 'mi', 'mis', 'tu', 'tus', 'nuestro', 'nuestra', 'nuestros', 'nuestras',
  'cada', 'todo', 'toda', 'todos', 'todas', 'otro', 'otra', 'otros', 'otras', 'ningún', 'ninguna', 'ningunos', 'ningunas', 'algún', 'alguna',
  'algunos', 'algunas', 'varios', 'varias', 'ambos', 'ambas', 'dicho', 'dicha', 'dichos', 'dichas', 'cualquier', 'cualquiera', 'cuyo', 'cuya',
  'demás', 'tal', 'tales', 'sendos', 'sendas', 'mucho', 'mucha', 'muchos', 'muchas', 'poco', 'poca', 'pocos', 'pocas', 'tanto', 'tanta',
  'tantos', 'tantas', 'cierto', 'cierta', 'ciertos', 'ciertas', 'uno', 'mismo', 'misma', 'mismos', 'mismas', 'último', 'última', 'últimos', 'últimas'])
const PREP = new Set<string>(['a', 'ante', 'bajo', 'con', 'contra', 'de', 'desde', 'durante', 'en', 'entre', 'hacia', 'hasta', 'mediante', 'para', 'por',
  'según', 'segun', 'sin', 'sobre', 'tras', 'versus', 'vía', 'que', 'si', 'cuando', 'como', 'donde', 'mientras', 'cuanto', 'qué', 'cómo', 'cuándo',
  'dónde', 'cuánto', 'cuál', 'cuáles', 'quién', 'quiénes', 'y', 'e', 'o', 'u', 'ni', 'pero', 'se', 'le', 'les', 'me', 'te', 'nos', 'no', 'sí',
  'ya', 'solo', 'sólo', 'también', 'tampoco', 'más', 'menos', 'muy', 'hoy', 'mañana', 'ayer', 'aquí', 'allí', 'ahí', 'antes', 'después', 'luego'])
const NUMERALES = /^(\d[\d.,]*%?|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|treinta|cuarenta|cincuenta|cien|ciento|doscientos|quinientos|mil|medio|media)$/
// Marcas y programas frecuentes: van sin artículo y con su mayúscula.
const MARCAS = new Set<string>(['excel', 'word', 'powerpoint', 'outlook', 'teams', 'sharepoint', 'onedrive', 'drive', 'gmail', 'whatsapp', 'slack', 'jira',
  'trello', 'asana', 'notion', 'salesforce', 'hubspot', 'zoom', 'tableau', 'oracle', 'odoo', 'alegra', 'siigo', 'helisa', 'contapyme', 'dynamics',
  'quickbooks', 'xero', 'bizagi', 'kaze', 'sap', 'google', 'microsoft', 'dropbox', 'docusign', 'zapier', 'power', 'looker', 'metabase', 'zendesk',
  'freshdesk', 'monday', 'clickup', 'confluence', 'github', 'gitlab', 'canva', 'figma', 'miro', 'meet', 'forms', 'sheets', 'docs', 'calendar',
  'linkedin', 'facebook', 'instagram', 'twitter', 'x', 'telegram', 'skype', 'webex', 'bancolombia', 'davivienda', 'dian', 'rut', 'pila', 'epm'])
const SUST_COMUNES_HERRAMIENTA = new Set<string>(['correo', 'teléfono', 'telefono', 'portal', 'sistema', 'formato', 'plantilla', 'archivo', 'carpeta', 'hoja',
  'computador', 'computadora', 'impresora', 'escáner', 'escaner', 'calculadora', 'agenda', 'libro', 'cuaderno', 'tablero', 'aplicación', 'app',
  'plataforma', 'software', 'programa', 'módulo', 'modulo', 'base', 'red', 'intranet', 'página', 'sitio', 'firma', 'token', 'lector', 'celular',
  'chat', 'videollamada', 'llamada', 'mensajería', 'buzón', 'repositorio', 'servidor', 'herramienta', 'equipo', 'documento', 'lista', 'matriz',
  'reporte', 'informe', 'registro', 'bitácora', 'expediente', 'sello', 'datáfono', 'caja', 'terminal', 'módem', 'vpn', 'erp', 'crm'])
// Roles y áreas: si el texto empieza así, es un sustantivo común aunque vaya en mayúscula.
const ROLES = new Set<string>(['jefe', 'jefa', 'auxiliar', 'analista', 'gerente', 'director', 'directora', 'coordinador', 'coordinadora', 'asistente',
  'supervisor', 'supervisora', 'líder', 'lider', 'responsable', 'encargado', 'encargada', 'especialista', 'técnico', 'técnica', 'ingeniero',
  'ingeniera', 'contador', 'contadora', 'tesorero', 'tesorera', 'secretario', 'secretaria', 'profesional', 'practicante', 'operador', 'operadora',
  'agente', 'ejecutivo', 'ejecutiva', 'representante', 'administrador', 'administradora', 'comité', 'equipo', 'área', 'departamento',
  'dirección', 'gerencia', 'sistema', 'proveedor', 'proveedora', 'cliente', 'usuario', 'usuaria', 'abogado', 'abogada', 'auditor', 'auditora',
  'vicepresidente', 'vicepresidenta', 'presidente', 'presidenta', 'jefatura', 'oficial', 'inspector', 'inspectora', 'recepcionista',
  'mensajero', 'mensajera', 'cajero', 'cajera', 'vendedor', 'vendedora', 'comprador', 'compradora', 'almacenista', 'bodeguero', 'conductor',
  'médico', 'médica', 'enfermero', 'enfermera', 'docente', 'profesor', 'profesora', 'asesor', 'asesora', 'consultor', 'consultora', 'gestor',
  'gestora', 'planeador', 'planificador', 'programador', 'desarrollador', 'diseñador', 'investigador', 'operario', 'operaria', 'colaborador',
  'colaboradora', 'empleado', 'empleada', 'trabajador', 'trabajadora', 'miembro', 'socio', 'socia', 'titular', 'dueño', 'dueña', 'propietario',
  'propietaria', 'solicitante', 'beneficiario', 'beneficiaria', 'interesado', 'interesada', 'bot', 'robot', 'portal', 'plataforma',
  'aplicación', 'servicio', 'unidad', 'oficina', 'sede', 'sucursal', 'grupo', 'mesa', 'junta', 'consejo', 'asamblea', 'célula', 'tesorería',
  'contabilidad', 'contraloría', 'auditoría', 'secretaría', 'coordinación', 'subgerencia', 'vicepresidencia', 'presidencia', 'banco',
  'entidad', 'empresa', 'compañía', 'organización', 'área', 'mesa', 'soporte', 'personal', 'nómina', 'recepción', 'bodega', 'almacén',
  'compras', 'ventas', 'cartera', 'facturación', 'logística', 'calidad', 'mantenimiento', 'producción', 'operaciones', 'finanzas',
  'jurídica', 'legal', 'talento', 'recursos', 'tecnología', 'informática', 'comercial', 'mercadeo', 'marketing', 'servicios', 'atención',
  'automatización', 'motor', 'módulo', 'flujo', 'proceso'])
const ACRONIMO_ROL: Record<string, string> = { ceo: 'el', cfo: 'el', coo: 'el', cto: 'el', cio: 'el', cmo: 'el', ciso: 'el', dpo: 'el', pmo: 'la', rrhh: '', ti: '' }
const CONECTORES_NOMBRE = new Set<string>(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en', 'para', 'por', 'a', 'al', 'con'])

export const esDeterminante = (w: string | null | undefined): boolean => DET.has(bajo(w))
const esAcronimo = (w: string): boolean => /^[A-ZÁÉÍÓÚÑ0-9]{2,}s?$/.test(w) && /[A-ZÁÉÍÓÚÑ]{2}/.test(w)
const mayusInterna = (w: string): boolean => /^.[^A-ZÁÉÍÓÚÑ]*[A-ZÁÉÍÓÚÑ]/.test(w) && !esAcronimo(w) && /[a-záéíóúñ]/.test(w)
const capitalizada = (w: string): boolean => /^[A-ZÁÉÍÓÚÑ]/.test(w)

/* ¿El texto es un nombre propio (una persona, una marca, un sistema con nombre)? */
export function esNombrePropio(texto: string | null | undefined, modo?: Modo): boolean {
  const ps = String(texto || '').trim().split(/\s+/).filter(Boolean)
  if (!ps.length) return false
  const w0 = ps[0].replace(/[.,;:]+$/, '')
  if (esAcronimo(w0) || mayusInterna(w0)) return true
  if (MARCAS.has(bajo(w0))) return true
  const sig = ps.slice(1).filter(w => !CONECTORES_NOMBRE.has(bajo(w)))
  if (sig.length && sig.every(w => capitalizada(w))) return !ROLES.has(bajo(w0)) && !(modo === 'herramienta' && SUST_COMUNES_HERRAMIENTA.has(bajo(w0)))
  if (!sig.length && ps.length === 1 && modo === 'herramienta') return capitalizada(w0) && !SUST_COMUNES_HERRAMIENTA.has(bajo(w0))
  if (!sig.length && ps.length === 1 && modo === 'rol') return capitalizada(w0) && !ROLES.has(bajo(w0)) && !/(ción|sión|dad|ía|ista|nte|or|ora|ero|era|ario|aria|ado|ada)$/i.test(w0)
  return false
}

/* Primera letra en minúscula, salvo siglas, marcas o nombres propios. */
export function minus1(texto: string | null | undefined, modo?: Modo): string {
  const t = String(texto || '').trim()
  if (!t) return t
  if (esNombrePropio(t, modo)) return t
  const w0 = t.split(/\s+/)[0]
  if (esAcronimo(w0) || mayusInterna(w0)) return t
  return t.charAt(0).toLowerCase() + t.slice(1)
}
export const mayus1 = (t: string | null | undefined): string => { const s = String(t || ''); return s.charAt(0).toUpperCase() + s.slice(1) }
export const sinPunto = (t: string | null | undefined): string => String(t || '').trim().replace(/[.;:]+$/, '').trim()
export const oracion = (t: string | null | undefined): string => { const s = sinPunto(t); return s ? mayus1(s) + (/[?!»"”)]$/.test(s) ? '' : '.') : '' }
export const cita = (t: string | null | undefined): string => '«' + sinPunto(t).replace(/^[«"“]+|[»"”]+$/g, '') + '»'

/* Artículo definido para una frase nominal. Si ya trae determinante, preposición, número
   o es un nombre propio, se deja como está. modo: 'comun' | 'rol' | 'herramienta'. */
export function conArticulo(texto: string | null | undefined, modo?: Modo): string {
  const t = String(texto || '').trim().replace(/\s+/g, ' ')
  if (!t) return t
  const ps = t.split(' ')
  const w0 = ps[0].replace(/[.,;:]+$/, '')
  const b0 = bajo(w0)
  if (/^[«"“(¿¡]/.test(t)) return t
  if (DET.has(b0) || PREP.has(b0) || NUMERALES.test(b0)) return minus1(t, modo)
  if (ACRONIMO_ROL[b0] != null) return (ACRONIMO_ROL[b0] ? ACRONIMO_ROL[b0] + ' ' : '') + t
  const sigla = SIGLAS_COMUNES[b0.replace(/s$/, '')] && esAcronimo(w0.replace(/s$/, ''))
  if (sigla) { const g = SIGLAS_COMUNES[b0.replace(/s$/, '')]; const pl = /[a-z]s$/.test(w0); return (pl ? (g === 'f' ? 'las ' : 'los ') : (g === 'f' ? 'la ' : 'el ')) + t }
  if (esNombrePropio(t, modo)) return t
  const { g, n, a } = generoNumero(w0, modo)
  const art = n === 'p' ? (g === 'f' ? 'las' : 'los') : (g === 'f' && !a ? 'la' : 'el')
  return art + ' ' + minus1(t, modo)
}
/* Preposición + frase: contrae «de el» y «a el». */
export function conPrep(prep: string, frase: string | null | undefined): string {
  const f = String(frase || '')
  if (prep === 'de' && /^el\s/.test(f)) return 'del ' + f.slice(3)
  if (prep === 'a' && /^el\s/.test(f)) return 'al ' + f.slice(3)
  return prep + ' ' + f
}

/* Lista con comas y la conjunción correcta: y → e ante «i/hi», o → u ante «o/ho». */
export function lista(items: string[] | null | undefined, conj?: string): string {
  const xs = (items || []).map(x => String(x).trim()).filter(Boolean)
  if (xs.length <= 1) return xs.join('')
  const ult = xs[xs.length - 1]
  let c = conj || 'y'
  const ini = quitarTildes(bajo(ult)).replace(/^[«"“(]/, '')
  if (c === 'y' && /^h?i/.test(ini) && !/^h?i[aeou]/.test(ini)) c = 'e'
  if (c === 'o' && /^h?o/.test(ini)) c = 'u'
  if (c === 'ni') return xs.slice(0, -1).join(', ') + ' ni ' + ult
  return xs.slice(0, -1).join(', ') + ' ' + c + ' ' + ult
}
/* Parte un campo de texto en elementos: por líneas, punto y coma o comas (si no hay más). */
export function elementos(texto: string | null | undefined): string[] {
  const t = String(texto || '').trim()
  if (!t) return []
  let xs = t.split(/\r?\n|;/).map(s => s.replace(/^\s*(?:[-•*·]|\d+[.)]|[a-z][.)])\s*/i, '').trim()).filter(Boolean)
  if (xs.length === 1 && /,/.test(xs[0]) && !/\b(que|si|cuando|porque|pero)\b/i.test(xs[0]) && xs[0].split(',').every(s => s.trim().split(/\s+/).length <= 5)) {
    xs = xs[0].split(/,|\s+y\s+/).map(s => s.trim()).filter(Boolean)
  }
  return xs.map(sinPunto)
}

/* ---------- oraciones con verbo ---------- */
const VERBOS_COMUNES = new Set<string>(['es', 'está', 'están', 'son', 'hay', 'queda', 'quedan', 'llega', 'llegan', 'tiene', 'tienen', 'publica', 'publican',
  'envía', 'envían', 'recibe', 'reciben', 'termina', 'terminan', 'cierra', 'cierran', 'aprueba', 'aprueban', 'firma', 'firman', 'entrega',
  'entregan', 'pide', 'piden', 'solicita', 'solicitan', 'sale', 'salen', 'vence', 'vencen', 'cumple', 'cumplen', 'pasa', 'pasan', 'ocurre',
  'ocurren', 'se', 'confirma', 'confirman', 'acepta', 'aceptan', 'rechaza', 'rechazan', 'registra', 'registran', 'cubre', 'cubren', 'trae',
  'traen', 'coincide', 'coinciden', 'cuadra', 'cuadran', 'supera', 'superan', 'falta', 'faltan', 'existe', 'existen', 'debe', 'deben',
  'puede', 'pueden', 'necesita', 'necesitan', 'requiere', 'requieren', 'incluye', 'incluyen', 'contiene', 'contienen', 'reporta', 'reportan',
  'informa', 'informan', 'avisa', 'avisan', 'responde', 'responden', 'devuelve', 'devuelven', 'autoriza', 'autorizan', 'valida', 'validan',
  'genera', 'generan', 'crea', 'crean', 'abre', 'abren', 'inicia', 'inician', 'empieza', 'empiezan', 'comienza', 'comienzan', 'fue', 'fueron',
  'era', 'eran', 'será', 'serán', 'estaba', 'estaban', 'ha', 'han', 'haya', 'hayan', 'sea', 'sean', 'esté', 'estén', 'quede', 'queden',
  'tenga', 'tengan', 'llegue', 'lleguen', 'dice', 'dicen', 'indica', 'indican', 'muestra', 'muestran', 'explica', 'explican', 'refleja',
  'reflejan', 'tiene', 'da', 'dan', 'va', 'van', 'viene', 'vienen', 'hace', 'hacen', 'pone', 'ponen', 'sigue', 'siguen', 'vuelve', 'vuelven',
  'aplica', 'aplican', 'cubre', 'abarca', 'abarcan', 'comprende', 'comprenden', 'termina', 'publicó', 'llegó', 'aprobó', 'firmó', 'cerró'])
/* ¿Es una oración (con verbo) o una frase nominal? Heurística para enlazar con «cuando» o «con». */
const DET_TRAS_VERBO = new Set<string>(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'su', 'sus', 'este', 'esta', 'estos', 'estas', 'ese', 'esa',
  'cada', 'todo', 'toda', 'todos', 'todas', 'lo'])
export function esClausula(texto: string | null | undefined): boolean {
  const ps = bajo(texto).replace(/[.,;:«»"“”()¿?¡!]/g, ' ').split(/\s+/).filter(Boolean)
  if (!ps.length) return false
  if (/^(se|cuando|si|al|que|hay|llega|llegan|entra|entran|recibe|reciben)$/.test(ps[0])) return true
  // Un verbo conocido cuenta si no va tras preposición o artículo («la entrega», «de firma»);
  // al inicio, solo si le sigue un artículo («Firma el jefe» sí; «Firma del jefe» no).
  if (ps.some((w, i) => VERBOS_COMUNES.has(w) && (i === 0 ? DET_TRAS_VERBO.has(ps[1]) : !PREP.has(ps[i - 1]) && !DET.has(ps[i - 1])))) return true
  for (let i = 0; i < ps.length - 1; i++) {
    if (i === 0 && DET.has(ps[0])) continue
    if (/(a|an|e|en|á|é)$/.test(ps[i]) && DET_TRAS_VERBO.has(ps[i + 1]) && !PREP.has(ps[i]) && !DET.has(ps[i])) return true
  }
  return ps.length >= 3 && DET.has(ps[0]) && /(ó|aron|ieron)$/.test(ps[ps.length - 1])
}

/* ---------- acción de una actividad ---------- */
// Verbo + sustantivo que van sin artículo («hacer seguimiento», «dar respuesta»).
const SIN_ARTICULO: Record<string, string[]> = {
  hacer: ['seguimiento', 'clic', 'click', 'uso', 'caso', 'falta', 'parte', 'efectivo', 'entrega', 'cierre'], dar: ['respuesta', 'aviso', 'clic', 'click', 'trámite', 'curso', 'visto', 'alcance', 'cumplimiento', 'fe', 'traslado', 'lugar'],
  tomar: ['nota', 'decisiones', 'medidas', 'acción', 'acciones', 'posesión'], llevar: ['control', 'registro', 'seguimiento', 'cuenta'], prestar: ['atención', 'servicio', 'apoyo'],
  pedir: ['permiso', 'ayuda', 'apoyo', 'autorización', 'cita'], poner: ['atención', 'fecha'], tener: ['cuenta'], rendir: ['cuentas', 'informe'], hacer_: [],
}

/** Resultado de `accionDe`: el verbo en tercera persona y, si aplica, el objeto con artículo. */
export interface AccionDe {
  ok: boolean
  texto: string
  verbo?: string
  objeto?: string
  infinitivos?: string[]
}

/* Nombre de la actividad → { ok, texto } con el verbo en tercera persona y artículos.
   «Revisar y aprobar conciliación» → «revisa y aprueba la conciliación».
   Si no empieza con un infinitivo (un nombre como «Revisión de la conciliación»), ok = false.
   plural: el sujeto es plural («los analistas revisan…»). */
export function accionDe(nombre: string | null | undefined, plural?: boolean): AccionDe {
  const t = String(nombre || '').trim().replace(/\s+/g, ' ').replace(/[.]+$/, '')
  if (!t) return { ok: false, texto: '' }
  const ps = t.split(' ')
  const verbos: InfinitivoInfo[] = []
  let i = 0
  while (i < ps.length) {
    const inf = infinitivo(ps[i], ps[i + 1])
    if (!inf) break
    verbos.push(inf)
    i += 1
    const sep = bajo(ps[i] || '')
    const otro = ps[i + 1] ? infinitivo(ps[i + 1], ps[i + 2]) : null
    if ((sep === 'y' || sep === 'e' || sep === 'o' || sep === 'u') && otro) { i += 1; continue }
    if (/,$/.test(ps[i - 1]) && ps[i] && infinitivo(ps[i], ps[i + 1])) continue
    break
  }
  if (!verbos.length) return { ok: false, texto: t }
  // v.inf viene siempre de un infinitivo() ya validado (tercera(v.inf) no puede ser null aquí).
  const formas = verbos.map(v => (v.cliticos.length ? v.cliticos.join(' ') + ' ' : '') + tercera(v.inf, plural)!)
  const conj = bajo(ps.slice(0, i).find(w => /^(y|e|o|u)$/i.test(w)) || 'y')
  const verbo = formas.length > 1 ? lista(formas, conj === 'o' || conj === 'u' ? 'o' : 'y') : formas[0]
  let resto = ps.slice(i).join(' ')
  if (resto) {
    const base = verbos[verbos.length - 1].inf
    const w0 = bajo(resto.split(' ')[0])
    const sinArt = (SIN_ARTICULO[base] || []).indexOf(w0) >= 0
    resto = sinArt ? minus1(resto) : conArticulo(resto, 'comun')
    resto = coordinadas(resto, plural)
  }
  return { ok: true, texto: verbo + (resto ? ' ' + resto : ''), verbo, objeto: resto, infinitivos: verbos.map(v => v.inf) }
}

/* Dentro de una oración ya conjugada, «… y guardarlo en la carpeta» → «… y lo guarda en la carpeta».
   No toca un infinitivo que depende de una preposición («para descargar y guardar»). */
const RIGE_INFINITIVO = new Set<string>(['para', 'sin', 'de', 'a', 'al', 'por', 'hasta', 'antes', 'después', 'tras', 'que', 'puede', 'pueden', 'debe', 'deben', 'suele', 'suelen', 'va', 'van'])
function coordinadas(texto: string, plural?: boolean): string {
  const ps = String(texto).split(' ')
  for (let k = 1; k < ps.length - 0; k++) {
    if (!/^(y|e|o|u)$/i.test(ps[k - 1])) continue
    const inf = infinitivo(ps[k], ps[k + 1])
    if (!inf) continue
    // ¿Hay antes, en la misma oración, un infinitivo regido por una preposición?
    let regido = false
    for (let j = k - 2; j >= 0; j--) {
      if (/[.;]$/.test(ps[j])) break
      if (infinitivo(ps[j], ps[j + 1])) { regido = j > 0 && RIGE_INFINITIVO.has(bajo(ps[j - 1])); break }
    }
    if (regido) continue
    const punt = (/[.,;:]+$/.exec(ps[k]) || [''])[0]
    // inf.inf viene de infinitivo(), que ya garantiza tercera(inf.inf) no nulo.
    ps[k] = (inf.cliticos.length ? inf.cliticos.join(' ') + ' ' : '') + tercera(inf.inf, plural)! + punt
  }
  return ps.join(' ')
}

/* Convierte las oraciones de un texto que empiezan con infinitivo («Ingresar al portal…»)
   a tercera persona («Ingresa al portal…»). También «Si …, llamar al cliente». El resto queda igual. */
const MARCAS_INICIO = /^(si|cuando|luego|después|despues|finalmente|primero|por último|al final|antes|en caso|al terminar|al recibir|una vez)\b/i
export function aTercera(texto: string | null | undefined, plural?: boolean): string {
  const lineas = String(texto || '').split(/\r?\n/)
  return lineas.map(linea => {
    // El patrón siempre calza (termina en [\s\S]*$), así que el resultado nunca es null.
    const m = /^(\s*(?:[-•*·]|\d+[.)])?\s*)([\s\S]*)$/.exec(linea)!
    const pre = m[1]
    const oraciones = m[2].match(/[^.!?]+[.!?]*\s*/g) || []
    return pre + oraciones.map(o => {
      const esp = (/\s*$/.exec(o) || [''])[0]
      const cuerpo = o.slice(0, o.length - esp.length)
      const fin = (/[.!?]+$/.exec(cuerpo) || [''])[0]
      const sinFin = cuerpo.slice(0, cuerpo.length - fin.length)
      // Cada parte separada por «;» se trata como una oración.
      return sinFin.split(/;\s*/).map((parte, ip) => {
        const ps = parte.trim().split(' ')
        if (ps.length > 1 && infinitivo(ps[0].replace(/[.,;:]+$/, ''), ps[1])) {
          const a = accionDe(parte.trim(), plural)
          if (a.ok) return ip ? a.texto : mayus1(a.texto)
        }
        // «Si hay diferencias, llamar al cliente» → «…, llama al cliente»
        if (MARCAS_INICIO.test(parte.trim())) {
          const k = parte.indexOf(', ')
          if (k > 0) {
            const resto = parte.slice(k + 2)
            const qs = resto.split(' ')
            if (qs.length && infinitivo(qs[0], qs[1])) {
              const a = accionDe(resto, plural)
              if (a.ok) return parte.slice(0, k + 2) + a.texto
            }
          }
        }
        return parte
      }).join('; ') + fin + esp
    }).join('')
  }).join('\n').trim()
}

/* Sujeto de una oración a partir del rol: «Auxiliar contable» → «el auxiliar contable». */
export function sujeto(rol: string | null | undefined): string {
  return conArticulo(rol, 'rol')
}

/* Concordancia simple: «uno tras otro» / «una tras otra» según la frase. */
export function unoTrasOtro(frase: string | null | undefined): string {
  const w = String(frase || '').trim().split(/\s+/).find(x => !DET.has(bajo(x))) || ''
  return generoNumero(w).g === 'f' ? 'una tras otra' : 'uno tras otro'
}
export function numeroDe(frase: string | null | undefined): 's' | 'p' {
  const ps = String(frase || '').trim().split(/\s+/)
  const w = ps.find(x => !DET.has(bajo(x)) && !NUMERALES.test(bajo(x))) || ps[0] || ''
  const d = bajo(ps[0] || '')
  if (/^(los|las|unos|unas|estos|estas|esos|esas|sus|varios|varias|algunos|algunas|todos|todas)$/.test(d)) return 'p'
  if (/^(el|la|un|una|este|esta|ese|esa|su|cada)$/.test(d)) return 's'
  return generoNumero(w).n
}

/* ---------- tiempos ---------- */
const NUM_TXT: Record<number, string> = { 1: 'una', 2: 'dos', 3: 'tres', 4: 'cuatro', 5: 'cinco', 6: 'seis', 7: 'siete', 8: 'ocho', 9: 'nueve', 10: 'diez' }
const coma = (n: number): string => String(Math.round(n * 10) / 10).replace('.', ',')
/* 0,25 h → «unos 15 minutos»; 0,5 h → «media hora»; 1,5 h → «una hora y media»; 3 días → «3 días». */
export function duracion(n: unknown, unidad?: string): string | null {
  if (typeof n !== 'number' || !(n > 0)) return null
  const u = unidad || 'h'
  if (u === 'min') return n < 60 ? (n === 1 ? 'un minuto' : 'unos ' + Math.round(n) + ' minutos') : duracion(n / 60, 'h')
  if (u === 'días' || u === 'dias' || u === 'd') {
    if (n === 1) return 'un día'
    if (n === 0.5) return 'medio día'
    return coma(n) + ' días'
  }
  const min = Math.round(n * 60)
  if (min < 60) {
    if (min === 30) return 'media hora'
    if (min === 15) return 'un cuarto de hora'
    const r = min >= 10 ? Math.round(min / 5) * 5 : min
    return r === 1 ? 'un minuto' : 'unos ' + r + ' minutos'
  }
  if (n === 1) return 'una hora'
  if (n === 1.5) return 'una hora y media'
  if (Number.isInteger(n)) return n + ' horas'
  if (Math.abs(n - Math.floor(n) - 0.5) < 0.01) return Math.floor(n) + ' horas y media'
  return coma(n) + ' horas'
}
export { NUM_TXT }
