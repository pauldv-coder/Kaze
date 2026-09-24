/* Actividades, de lo general a lo particular:
   1 · Listar y agrupar — todas las actividades por fase, sin detalle (tablero compacto).
   2 · Caracterizar     — una a la vez: lista con lo que falta a la izquierda, ficha completa a la derecha.
   Tabla                — todas con sus datos clave, para revisar en bloque. */
import {
  secuencia, fasesTablero, aplicarTablero, ponerEnFase, moverEnSecuencia, eliminarActividad, agregarActividades, nuevaFase, eliminarFase,
  faseDe, roles, tieneValor, DESCONOCIDO, NA, cambioFrenteAsis, eliminadasFrenteAsis, fechaCorta,
  completitud, SECCIONES_FICHA, CAMPOS_FICHA, EJECUCION, TIPOS_EVENTO, nuevoEvento, fraseEvento, CICLOS, fraseCiclo,
  nuevoFormato, formatosDelModelo, normalizarTexto, destinoDecision,
} from './model.js';
import { Kz, cx, Entrada, Campo, Aviso, Confirmar } from './ui.jsx';
import { DecisionesDeActividad, PanelDecisionSuelta } from './decisiones.jsx';
import { guardarArchivo, leerArchivo, MAX_ARCHIVO, tamanoLegible, archivosPersistentes } from './archivos.js';
import { descargar } from './util.js';
import { narrarActividad } from './narrador.js';
import { anexosDe } from './documento.js';

const React = window.React;
const { useState, useEffect, useRef, useMemo, Fragment } = React;

const UNIDADES = [['min', 'min'], ['h', 'h'], ['días', 'días']];

/* «Así se lee en el procedimiento»: el paso contado en tercera persona, tal como sale en el Word. */
function Fragmentos({ runs }) {
  return runs.map((r, i) => {
    const cls = cx(r.tono === 'falta' && 'relato__falta', r.tono === 'ia' && 'relato__ia', r.tono === 'suave' && 'relato__suave');
    const t = r.b || r.ref ? <b>{r.t}</b> : r.t;
    return cls ? <span key={i} className={cls}>{t}</span> : <Fragment key={i}>{t}</Fragment>;
  });
}
export function Relato({ paso }) {
  const bloques = [];
  paso.parrafos.forEach((q, i) => {
    if (q.tipo === 'rama') {
      const ult = bloques[bloques.length - 1];
      if (ult && ult.tipo === 'ramas') ult.items.push(q); else bloques.push({ tipo: 'ramas', items: [q], k: i });
    } else bloques.push(Object.assign({ k: i }, q));
  });
  return (
    <div className="relato">
      <p className="relato__t">{paso.numero}. {paso.nombre} <span className="relato__cod">{paso.codigo}</span></p>
      {bloques.map(b => {
        if (b.tipo === 'ramas') return <ul key={b.k} className="relato__ramas">{b.items.map((q, j) => <li key={j}><Fragmentos runs={q.runs} /></li>)}</ul>;
        if (b.tipo === 'importante') return <p key={b.k} className="relato__aviso relato__aviso--imp"><b>Importante:</b> <Fragmentos runs={b.runs} /></p>;
        if (b.tipo === 'atencion') return <p key={b.k} className="relato__aviso relato__aviso--aten"><b>Atención:</b> <Fragmentos runs={b.runs} /></p>;
        return <p key={b.k} className={cx(b.tipo === 'falta' && 'relato__nota')}><Fragmentos runs={b.runs} /></p>;
      })}
    </div>
  );
}
function VistaRelato({ proc, modelo, clave, bloq, cambiar, etq }) {
  const { Boton } = Kz();
  const paso = useMemo(() => narrarActividad(proc, modelo, clave, { anexos: anexosDe(modelo) }), [proc, modelo, clave]);
  const a = modelo.actividades[clave];
  const propio = tieneValor(a.relato);
  const poner = (v, et) => cambiar(et + ' de ' + etq, (p, m) => { if (m.actividades[clave]) m.actividades[clave].relato = v; });
  return (
    <section className="ficha__sec ficha__sec--ancha relato-prev" aria-label="Así se lee en el procedimiento">
      <h3 className="ficha__st">Así se lee en el procedimiento{propio && <span className="ficha__sn">texto propio</span>}</h3>
      {paso ? <Fragment>
        {propio ? (
          <Fragment>
            <Campo id={'fa-relato'} etiqueta="Tu texto para este paso" como="textarea" rows={5} modo="texto" tri={false} disabled={bloq} valor={a.relato}
              onCommit={v => poner(v || null, 'Editó el texto del procedimiento')}
              ayuda="Reemplaza el párrafo automático, tal cual lo escribes. Cómo se llega a este paso, las reglas, los problemas y la decisión se siguen agregando solos." />
            {!bloq && <button type="button" className="kz-link relato__volver" onClick={() => poner(null, 'Volvió al texto automático')}>Volver al texto automático</button>}
          </Fragment>
        ) : <p className="campo__ayuda">El documento Word cuenta cada paso así, en tercera persona, con los datos de esta ficha. Lo que falta confirmar sale en color.</p>}
        <Relato paso={paso} />
        {!propio && !bloq && <div className="kz-row relato__acc"><Boton tamano="sm" onClick={() => poner(paso.automatico || a.nombre, 'Escribió su propio texto del procedimiento')}>Escribir mi propio texto</Boton>
          <span className="nota">Parte del texto automático; lo que escribas reemplaza el párrafo de este paso.</span></div>}
      </Fragment> : <p className="vacio">Cuando la ubiques en una fase, aquí verás cómo se cuenta en el procedimiento.</p>}
    </section>
  );
}
const plural = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);
const usosDe = (m, clave) => m.decisiones.filter(d => d.origen === clave || d.salidas.some(x => x.destino === clave)).length;
const porcentaje = (a, b) => (b ? Math.round((100 * a) / b) : 0);

export function TabActividades(props) {
  const { modelo, sub, ir } = props;
  const vista = sub === 'caracterizar' || sub === 'tabla' ? sub : 'listar';
  const acts = Object.values(modelo.actividades);
  const datos = acts.reduce((t, a) => { const c = completitud(a); t.resp += c.resp; t.total += c.total; return t; }, { resp: 0, total: 0 });
  const a = v => ir('actividades', v);
  return (
    <div className="actividades">
      <div className="pasos-barra">
        <div className="pasos" role="group" aria-label="Pasos para capturar las actividades">
          <button type="button" className="paso" aria-pressed={vista === 'listar'} onClick={() => a('listar')}>
            <span className="paso__n">1</span><span className="paso__t">Listar y agrupar</span>
            <span className="paso__m">{plural(acts.length, 'actividad', 'actividades')}</span>
          </button>
          <span className="pasos__flecha" aria-hidden="true">›</span>
          <button type="button" className="paso" aria-pressed={vista === 'caracterizar'} onClick={() => a('caracterizar')}>
            <span className="paso__n">2</span><span className="paso__t">Caracterizar</span>
            <span className="paso__m">{acts.length ? porcentaje(datos.resp, datos.total) + ' % de los datos' : 'una por una'}</span>
          </button>
        </div>
        <button type="button" className="ver-tabla" aria-pressed={vista === 'tabla'} onClick={() => a(vista === 'tabla' ? 'listar' : 'tabla')}>Tabla</button>
      </div>
      {vista === 'listar' && <VistaListar {...props} />}
      {vista === 'caracterizar' && <VistaCaracterizar {...props} />}
      {vista === 'tabla' && <VistaTabla {...props} />}
    </div>
  );
}

/* ---------- 1 · Listar y agrupar ---------- */

function VistaListar({ modelo, version, bloq, cambiar, seleccion, setSeleccion, ir, abrirModal, iaDisponible, avisar }) {
  const { Boton, TableroFases } = Kz();
  const fases = useMemo(() => fasesTablero(modelo), [modelo]);
  const seq = secuencia(modelo);
  const n = seq.length;
  const abrir = clave => { setSeleccion(clave); ir('actividades', 'caracterizar'); };
  const primera = seleccion && modelo.actividades[seleccion] ? seleccion : n ? seq[0].clave : null;
  const nombreDe = clave => (modelo.actividades[clave] || {}).nombre || '';
  const nombreFase = id => (id === '__sin' ? 'Sin fase' : (modelo.fases.find(f => f.id === id) || {}).nombre || '');
  return (
    <Fragment>
      <div className="barra">
        <p className="nota nota--barra">Primero todas, sin detalle: escribe cada actividad en su fase y ordénalas arrastrando. El orden —fases de izquierda a derecha, actividades de arriba abajo— es la secuencia y da el número.</p>
        {iaDisponible && <Boton tamano="sm" disabled={bloq} onClick={() => abrirModal({ tipo: 'notas' })}>Desde notas · IA</Boton>}
        <Boton tamano="sm" disabled={bloq} onClick={() => abrirModal({ tipo: 'pegar', destino: '__sin' })}>Pegar lista</Boton>
        <Boton tamano="sm" variante="primario" disabled={!primera} onClick={() => abrir(primera)}>Caracterizar una por una →</Boton>
      </div>
      {n === 0 && !bloq && (
        <Aviso tono="info">
          {modelo.fases.length
            ? 'Escribe en «+ Agregar actividad» de cada fase y pulsa Enter: el cursor queda listo para la siguiente. Si pegas una lista, se crea una actividad por línea.'
            : '¿Ya conoces las etapas del proceso? Créalas con «+ Nueva fase». Si todavía no, escribe todo en «Sin fase» y agrúpalo después.'}
        </Aviso>
      )}
      <div className="tablero">
        <TableroFases key={version} fases={fases} compacto soloLectura={bloq} seleccionada={seleccion}
          onSeleccionar={abrir}
          onCambio={f => cambiar('Movió actividades en el tablero', (p, m) => aplicarTablero(m, f), { tablero: true })}
          onAgregar={(faseId, nombres) => cambiar(nombres.length === 1 ? 'Agregó «' + nombres[0] + '» en ' + nombreFase(faseId) : 'Agregó ' + nombres.length + ' actividades en ' + nombreFase(faseId),
            (p, m) => { agregarActividades(m, faseId, nombres); }, { tablero: true })}
          onRenombrar={(clave, nombre) => cambiar('Renombró «' + nombreDe(clave) + '»', (p, m) => { if (m.actividades[clave]) m.actividades[clave].nombre = nombre; }, { tablero: true })}
          onEliminar={clave => {
            const nombre = nombreDe(clave), usos = usosDe(modelo, clave);
            cambiar('Eliminó «' + nombre + '»', (p, m) => eliminarActividad(m, clave), { tablero: true });
            if (seleccion === clave) setSeleccion(null);
            avisar('Eliminada «' + nombre + '»' + (usos ? '; ' + plural(usos, 'decisión pasa', 'decisiones pasan') + ' a Revisar' : '') + '. Ctrl+Z la recupera.');
          }}
          onNuevaFase={nombre => cambiar('Agregó la fase «' + nombre + '»', (p, m) => { nuevaFase(m, nombre); }, { tablero: true })}
          onRenombrarFase={(id, nombre) => cambiar('Renombró la fase «' + nombreFase(id) + '»', (p, m) => { const f = m.fases.find(x => x.id === id); if (f) f.nombre = nombre; }, { tablero: true })}
          onEditarFase={id => ir('fases', null, { fase: id })} />
      </div>
      {!bloq && n > 0 && <p className="nota">Clic en un nombre para corregirlo · clic en el resto de la tarjeta o «Ficha» para caracterizarla · con el teclado: Enter abre, F2 corrige, Suprimir elimina, Alt+flechas mueve.</p>}
    </Fragment>
  );
}

/* ---------- 2 · Caracterizar ---------- */

function VistaCaracterizar(props) {
  const { modelo, version, seleccion, setSeleccion, ir, bloq, cambiar } = props;
  const { Boton } = Kz();
  const seq = secuencia(modelo);
  const sueltas = modelo.decisiones.filter(d => !d.origen || !modelo.actividades[d.origen]);
  const decSel = seleccion && String(seleccion).indexOf('dec:') === 0 ? seleccion.slice(4) : null;
  const decValida = decSel && sueltas.some(d => d.clave === decSel);
  const actual = decValida ? null : seleccion && modelo.actividades[seleccion] ? seleccion : seq.length ? seq[0].clave : null;
  useEffect(() => { if (!decValida && actual && actual !== seleccion) setSeleccion(actual); }, [actual, seleccion, decValida]);
  if (decValida) {
    return (
      <div className="caracterizar">
        <ListaFicha modelo={modelo} seq={seq} actual={seleccion} onIr={setSeleccion} sueltas={sueltas} />
        <div className="caracterizar__main">
          <PanelDecisionSuelta modelo={modelo} claveDecision={decSel} bloq={bloq} cambiar={cambiar} />
        </div>
      </div>
    );
  }
  if (!actual) {
    return (
      <div className="tarjeta">
        <p className="vacio">Aún no hay actividades para caracterizar. Primero lístalas, cada una en su fase.</p>
        <div className="kz-row"><Boton tamano="sm" variante="primario" onClick={() => ir('actividades', 'listar')}>Ir a «1 · Listar y agrupar»</Boton></div>
      </div>
    );
  }
  const i = seq.findIndex(s => s.clave === actual);
  const ant = seq[i - 1], sig = seq[i + 1];
  const rotulo = s => (s.codigo || 'Sin número') + ' · ' + s.nombre;
  return (
    <div className="caracterizar">
      <ListaFicha modelo={modelo} seq={seq} actual={actual} onIr={setSeleccion} sueltas={sueltas} />
      <div className="caracterizar__main">
        <div className="ficha-nav">
          <Boton tamano="sm" disabled={!ant} onClick={() => setSeleccion(ant.clave)}>← Anterior</Boton>
          <label className="ficha-nav__sel"><span className="kz-sr">Actividad</span>
            <select id="ficha-ir" className="kz-input" value={actual} onChange={e => setSeleccion(e.target.value)}>
              {seq.map(s => <option key={s.clave} value={s.clave}>{rotulo(s)}</option>)}
            </select>
          </label>
          <span className="ficha-nav__pos">{i + 1} de {seq.length}</span>
          <Boton tamano="sm" disabled={!sig} onClick={() => setSeleccion(sig.clave)}>Siguiente →</Boton>
          <span className="kz-sr" role="status" aria-live="polite">{rotulo(seq[i]) + ', ' + (i + 1) + ' de ' + seq.length}</span>
        </div>
        <FichaActividad key={version + ':' + actual} {...props} clave={actual} seq={seq}
          onEliminada={() => setSeleccion(sig ? sig.clave : ant ? ant.clave : null)} />
        <nav className="ficha-pie" aria-label="Actividad anterior y siguiente">
          {ant ? <button type="button" className="ficha-pie__b" onClick={() => setSeleccion(ant.clave)}><span className="ficha-pie__l">← Anterior</span><span className="ficha-pie__n">{rotulo(ant)}</span></button> : <span />}
          {sig
            ? <button type="button" className="ficha-pie__b ficha-pie__b--sig" onClick={() => setSeleccion(sig.clave)}><span className="ficha-pie__l">Siguiente →</span><span className="ficha-pie__n">{rotulo(sig)}</span></button>
            : <button type="button" className="ficha-pie__b ficha-pie__b--sig" onClick={() => ir('diagrama')}><span className="ficha-pie__l">Era la última · Ver el diagrama →</span><span className="ficha-pie__n">El proceso completo en BPMN</span></button>}
        </nav>
      </div>
    </div>
  );
}

function ListaFicha({ modelo, seq, actual, onIr, sueltas }) {
  const { IconoBPMN, revisarDecision } = Kz();
  const ref = useRef(null);
  const decDe = {};
  modelo.decisiones.forEach(d => { if (d.origen && modelo.actividades[d.origen] && !decDe[d.origen]) decDe[d.origen] = d; });
  const cod = {};
  seq.forEach(s => { cod[s.clave] = s.codigo; });
  const grupos = modelo.fases.map((f, i) => ({ id: f.id, n: i + 1, titulo: f.nombre, claves: f.actividades }))
    .concat(modelo.sinFase.length ? [{ id: '__sin', n: null, titulo: 'Sin fase', claves: modelo.sinFase }] : []);
  const todas = Object.values(modelo.actividades).map(a => completitud(a));
  const completas = todas.filter(c => c.completa).length;
  const preg = todas.reduce((t, c) => t + c.preg, 0);
  useEffect(() => {
    const el = ref.current && ref.current.querySelector('[aria-current="true"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [actual]);
  return (
    <nav className="lf" aria-label="Actividades por caracterizar" ref={ref}>
      <p className="lf__res">{plural(completas, 'completa', 'completas')} de {todas.length}{preg ? ' · ' + plural(preg, 'dato por preguntar', 'datos por preguntar') : ''}</p>
      {grupos.map(g => (
        <div key={g.id} className="lf__g">
          <div className={cx('lf__gt', g.n == null && 'lf__gt--sin')}>{g.n != null && <span className="kz-phase__n">{g.n}</span>}<span>{g.titulo}</span></div>
          {g.claves.length === 0 ? <p className="lf__vacio">Sin actividades</p> : (
            <ul className="lf__l">
              {g.claves.map(k => {
                const a = modelo.actividades[k];
                if (!a) return null;
                const c = completitud(a);
                return (
                  <li key={k}>
                    <button type="button" className={cx('lf__i', a.estado === 'sugerencia' && 'lf__i--ia', a.estado === 'pregunta' && 'lf__i--q')} aria-current={k === actual ? 'true' : undefined} onClick={() => onIr(k)}>
                      <span className="lf__cod">{cod[k] || '—'}</span>
                      <span className="lf__nom">{a.nombre}</span>
                      <span className="lf__prog" aria-hidden="true">
                        <span className="lf__barra"><i style={{ width: porcentaje(c.resp, c.total) + '%' }} /></span>
                        <span>{c.resp}/{c.total}</span>
                        {c.preg > 0 && <span className="lf__q">? {c.preg}</span>}
                        {a.estado === 'sugerencia' && <span className="lf__ia">IA</span>}
                        {a.estado === 'pregunta' && <span className="lf__q">Pregunta</span>}
                        {(a.formatos || []).length > 0 && <IconoBPMN nombre="hoja" tamano={13} />}
                        {(a.eventos || []).length > 0 && <IconoBPMN nombre="tiempo" tamano={13} />}
                        {decDe[k] && <IconoBPMN nombre="decision" tamano={13} />}
                        {decDe[k] && revisarDecision(decDe[k], seq).length > 0 && <span className="lf__q">! Revisar</span>}
                      </span>
                      <span className="kz-sr">{', ' + c.resp + ' de ' + c.total + ' datos' + (c.preg ? ', ' + c.preg + ' por preguntar' : '') + (a.estado === 'sugerencia' ? ', sugerencia de la IA' : a.estado === 'pregunta' ? ', pregunta abierta' : '')
                        + ((a.formatos || []).length ? ', con formatos' : '') + ((a.eventos || []).length ? ', con eventos' : '') + (decDe[k] ? ', con decisión' + (revisarDecision(decDe[k], seq).length ? ' por revisar' : '') : '')}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
      {sueltas && sueltas.length > 0 && (
        <div className="lf__g">
          <div className="lf__gt lf__gt--sin"><span>Decisiones por ubicar</span></div>
          <ul className="lf__l">
            {sueltas.map(d => (
              <li key={d.clave}>
                <button type="button" className="lf__i lf__i--dec" aria-current={actual === 'dec:' + d.clave ? 'true' : undefined} onClick={() => onIr('dec:' + d.clave)}>
                  <span className="lf__cod"><IconoBPMN nombre="decision" tamano={14} /></span>
                  <span className="lf__nom">{d.pregunta || 'Decisión sin pregunta'}</span>
                  <span className="lf__prog" aria-hidden="true"><span className="lf__q">! Sin actividad de origen</span></span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}

/* Sugerencia sacada del propio proceso (no de la IA): un clic la usa. */
function Sugerencia({ texto, de, accion = 'Usar', onUsar }) {
  return (
    <button type="button" className="sug" onClick={onUsar}>
      <span aria-hidden="true">↳</span><span>{accion} «{texto}»{de && <span className="sug__de"> · {de}</span>}</span>
    </button>
  );
}

const vacioOPregunta = v => v == null || v === '' || v === DESCONOCIDO;

export function FichaActividad({ proc, modelo, clave, seq, bloq, cambiar, onEliminada }) {
  const { Boton, EstadoConfirmacion, IconoBPMN } = Kz();
  const [borrar, setBorrar] = useState(false);
  const ref = useRef(null);
  // Al pasar a otra actividad desde abajo, subir al comienzo de la ficha.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cab = document.querySelector('.kz-head');
    const tope = cab && getComputedStyle(cab).position === 'sticky' ? cab.getBoundingClientRect().bottom : 0;
    if (el.getBoundingClientRect().top < tope) { el.style.scrollMarginTop = (tope + 56) + 'px'; el.scrollIntoView({ block: 'start' }); }
  }, []);
  const a = modelo.actividades[clave];
  if (!a) return null;
  const i = seq.findIndex(x => x.clave === clave);
  const s = seq[i] || {};
  const f = faseDe(modelo, clave);
  const nf = f ? modelo.fases.indexOf(f) + 1 : null;
  const numerada = s.numero != null;
  const previa = numerada && i > 0 && seq[i - 1].numero != null ? seq[i - 1] : null;
  const siguiente = numerada && seq[i + 1] && seq[i + 1].numero != null ? seq[i + 1] : null;
  const aPrev = previa && modelo.actividades[previa.clave];
  const aSig = siguiente && modelo.actividades[siguiente.clave];
  const c = completitud(a);
  const etq = s.codigo || '«' + a.nombre + '»';
  const set = (campo, et) => v => cambiar('Editó ' + et + ' de ' + etq, (p, m) => { if (m.actividades[clave]) m.actividades[clave][campo] = v; });
  const usos = usosDe(modelo, clave);
  const sesiones = (proc.sesiones || []).filter(x => x.fecha).slice().sort((x, y) => String(y.fecha).localeCompare(String(x.fecha)));
  const fuentes = sesiones.map(x => 'Entrevista ' + fechaCorta(x.fecha));
  const rolesL = roles(modelo);
  const id = x => 'fa-' + x;
  const titulo = sid => {
    const S = SECCIONES_FICHA.find(x => x.id === sid);
    const k = completitud(a, S.campos);
    return (
      <h3 className="ficha__st">{S.titulo}
        <span className={cx('ficha__sn', k.completa && 'ficha__sn--ok')}>{k.completa ? '✓ ' : ''}{k.resp} de {k.total}{k.preg ? ' · ' + k.preg + ' ?' : ''}</span>
      </h3>
    );
  };
  // Igual que la anterior: responsable, departamento y frecuencia suelen repetirse de una actividad a la siguiente.
  const comoAnterior = (campo, et, de) => !bloq && vacioOPregunta(a[campo]) && aPrev && tieneValor(aPrev[campo])
    ? <Sugerencia texto={aPrev[campo]} de={de + ' de ' + previa.codigo} onUsar={() => set(campo, et)(aPrev[campo])} /> : null;
  const sug = {
    responsable: comoAnterior('responsable', 'el responsable', 'responsable'),
    departamento: comoAnterior('departamento', 'el departamento', 'departamento'),
    frecuencia: comoAnterior('frecuencia', 'la frecuencia', 'frecuencia'),
    entradas: !bloq && vacioOPregunta(a.entradas) && aPrev && tieneValor(aPrev.entregable)
      ? <Sugerencia texto={aPrev.entregable} de={'entregable de ' + previa.codigo} onUsar={() => set('entradas', 'las entradas')(aPrev.entregable)} /> : null,
    receptor: !bloq && vacioOPregunta(a.receptor) && aSig && tieneValor(aSig.responsable) && aSig.responsable !== a.responsable
      ? <Sugerencia texto={aSig.responsable} de={'responsable de ' + siguiente.codigo} onUsar={() => set('receptor', 'el receptor')(aSig.responsable)} /> : null,
    fuente: !bloq && vacioOPregunta(a.fuente) && fuentes[0]
      ? <Sugerencia texto={fuentes[0]} de="la última entrevista" onUsar={() => set('fuente', 'la fuente')(fuentes[0])} /> : null,
  };
  return (
    <article className="ficha" ref={ref} aria-labelledby={id('t')}>
      <header className="ficha__cab">
        <div className="ficha__meta">
          <span className="ficha__cod">{s.codigo || 'Sin número'}</span>
          <span>{f ? 'Fase ' + nf + ' · ' + f.nombre : 'Sin fase: ubícala en una fase para darle número'}</span>
          <EstadoConfirmacion estado={a.estado} fuente={tieneValor(a.fuente) ? a.fuente : undefined} />
        </div>
        <h2 className="ficha__t" id={id('t')}>{a.nombre}</h2>
        <div className="ficha__prog">
          <span className="ficha__barra" aria-hidden="true"><i style={{ width: porcentaje(c.resp, c.total) + '%' }} /></span>
          <span>{c.resp} de {c.total} datos{c.preg ? ' · ' + plural(c.preg, 'por preguntar', 'por preguntar') : ''}{c.completa ? ' · completa' : ''}</span>
        </div>
        {a.estado === 'sugerencia' && (
          <Aviso tono="ia" acciones={!bloq && [<Boton key="a" tamano="sm" variante="primario" onClick={() => cambiar('Aceptó la sugerencia «' + a.nombre + '»', (p, m) => { m.actividades[clave].estado = 'confirmado'; })}>Aceptar</Boton>,
            <Boton key="d" tamano="sm" variante="destructivo" onClick={() => { cambiar('Descartó la sugerencia «' + a.nombre + '»', (p, m) => { eliminarActividad(m, clave); }); onEliminada(); }}>Descartar</Boton>]}>
            Propuesta por la IA{tieneValor(a.evidencia) ? <Fragment>, a partir de: <q>{a.evidencia}</q></Fragment> : '.'} Revísala antes de aceptarla.
          </Aviso>
        )}
      </header>
      <div className="ficha__secciones">
        <section className="ficha__sec" aria-label="Básico">
          {titulo('basico')}
          <Campo id={id('nom')} etiqueta="Nombre (verbo + objeto)" modo="texto" tri={false} disabled={bloq} valor={a.nombre} onCommit={v => v && set('nombre', 'el nombre')(v)} />
          <Campo id={id('des')} etiqueta="Descripción" como="textarea" rows={2} disabled={bloq} valor={a.descripcion} onCommit={set('descripcion', 'la descripción')} />
          <div className="campo"><label className="campo__rot" htmlFor={id('fase')}>Fase</label>
            <select id={id('fase')} className="kz-input" disabled={bloq} value={f ? f.id : '__sin'} onChange={e => cambiar('Cambió de fase «' + a.nombre + '»', (p, m) => { ponerEnFase(m, clave, e.target.value); })}>
              {modelo.fases.map((x, k) => <option key={x.id} value={x.id}>{k + 1 + ' · ' + x.nombre + (f && f.id === x.id ? '' : ' (al final)')}</option>)}<option value="__sin">Sin fase</option></select>
            <p className="campo__ayuda">Para ubicarla entre otras, arrástrala en «1 · Listar y agrupar».</p></div>
          <Campo id={id('resp')} etiqueta="Responsable (rol)" list={id('roles')} disabled={bloq} valor={a.responsable} onCommit={set('responsable', 'el responsable')} ayuda="Da el carril del diagrama." extra={sug.responsable} />
          <datalist id={id('roles')}>{rolesL.map(r => <option key={r} value={r} />)}</datalist>
          <div className="campo"><span className="campo__rot" id={id('ejl')}>¿Quién la ejecuta?</span>
            <div className="segmento segmento--iconos" role="group" aria-labelledby={id('ejl')}>
              {EJECUCION.map(([v, t]) => <button key={v} type="button" aria-pressed={(a.ejecucion || 'persona') === v} disabled={bloq} onClick={() => set('ejecucion', 'quién la ejecuta')(v)}><IconoBPMN nombre={v} tamano={15} /> {t}</button>)}
            </div>
            <p className="campo__ayuda">Es el ícono de la tarea en el diagrama.</p></div>
          <Campo id={id('dep')} etiqueta="Departamento" disabled={bloq} valor={a.departamento} onCommit={set('departamento', 'el departamento')} extra={sug.departamento} />
          <Campo id={id('apo')} etiqueta="Participantes de apoyo" disabled={bloq} valor={a.apoyo} onCommit={set('apoyo', 'el apoyo')} />
        </section>
        <section className="ficha__sec" aria-label="Entradas y entregable">
          {titulo('entradas')}
          <Campo id={id('ent')} etiqueta="Entradas requeridas" disabled={bloq} valor={a.entradas} onCommit={set('entradas', 'las entradas')} extra={sug.entradas} />
          <Campo id={id('entr')} etiqueta="Entregable o resultado" disabled={bloq} valor={a.entregable} onCommit={set('entregable', 'el entregable')} />
          <Campo id={id('rec')} etiqueta="Quién lo recibe" disabled={bloq} valor={a.receptor} onCommit={set('receptor', 'el receptor')} extra={sug.receptor} />
          <label className="check"><input id={id('ext')} type="checkbox" disabled={bloq} checked={!!a.receptorExterno} onChange={e => cambiar('Editó el receptor de ' + etq, (p, m) => { m.actividades[clave].receptorExterno = e.target.checked; })} /> El receptor es externo (otra organización)</label>
          <Campo id={id('cri')} etiqueta="Criterio de aceptación" como="textarea" rows={2} disabled={bloq} valor={a.criterio} onCommit={set('criterio', 'el criterio')} ayuda="Cuándo se da por terminada." />
        </section>
        <section className="ficha__sec" aria-label="Tiempos y volumen">
          {titulo('tiempos')}
          <div className="campo"><label className="campo__rot" htmlFor={id('uni')}>Unidad de tiempo</label>
            <select id={id('uni')} className="kz-input" disabled={bloq} value={a.unidad || 'h'} onChange={e => set('unidad', 'la unidad')(e.target.value)}>{UNIDADES.map(u => <option key={u[0]} value={u[0]}>{u[1]}</option>)}</select></div>
          <Campo id={id('tp')} etiqueta={'Tiempo de proceso (' + (a.unidad || 'h') + ')'} modo="numero" disabled={bloq} valor={a.tProceso} onCommit={set('tProceso', 'el tiempo de proceso')} />
          <Campo id={id('te')} etiqueta={'Tiempo de espera (' + (a.unidad || 'h') + ')'} modo="numero" disabled={bloq} valor={a.tEspera} onCommit={set('tEspera', 'el tiempo de espera')} ayuda="Aparte del tiempo de proceso; 0 es cero." />
          <Campo id={id('fr')} etiqueta="Frecuencia o volumen" disabled={bloq} valor={a.frecuencia} onCommit={set('frecuencia', 'la frecuencia')} extra={sug.frecuencia} />
        </section>
        <section className="ficha__sec" aria-label="Recursos">
          {titulo('recursos')}
          <Campo id={id('her')} etiqueta="Software o herramientas" disabled={bloq} valor={a.herramientas} onCommit={set('herramientas', 'las herramientas')} />
          <Campo id={id('doc')} etiqueta="Documentos y sistemas" disabled={bloq} valor={a.documentos} onCommit={set('documentos', 'los documentos')} />
        </section>
        <SeccionFormatos a={a} clave={clave} modelo={modelo} bloq={bloq} cambiar={cambiar} etq={etq} id={id} />
        <section className="ficha__sec" aria-label="Reglas y problemas">
          {titulo('reglas')}
          <Campo id={id('reg')} etiqueta="Reglas de negocio" como="textarea" rows={2} disabled={bloq} valor={a.reglas} onCommit={set('reglas', 'las reglas')} />
          <Campo id={id('pro')} etiqueta="Problemas, excepciones y observaciones" como="textarea" rows={2} disabled={bloq} valor={a.problemas} onCommit={set('problemas', 'los problemas')} />
        </section>
        <section className="ficha__sec" aria-label="Fuente y confirmación">
          {titulo('fuente')}
          <Campo id={id('fue')} etiqueta="Fuente de la información" modo="texto" tri={false} list={id('fuentes')} disabled={bloq} valor={a.fuente} onCommit={set('fuente', 'la fuente')} extra={sug.fuente} />
          <datalist id={id('fuentes')}>{fuentes.map(x => <option key={x} value={x} />)}</datalist>
          {a.estado !== 'sugerencia' && (
            <div className="campo"><span className="campo__rot" id={id('est')}>Estado</span>
              <div className="segmento" role="group" aria-labelledby={id('est')}>
                <button type="button" aria-pressed={a.estado === 'confirmado'} disabled={bloq} onClick={() => set('estado', 'el estado')('confirmado')}>Confirmada</button>
                <button type="button" aria-pressed={a.estado === 'pregunta'} disabled={bloq} onClick={() => set('estado', 'el estado')('pregunta')}>Pregunta abierta</button>
              </div></div>
          )}
        </section>
        <SeccionEventos a={a} clave={clave} seq={seq} bloq={bloq} cambiar={cambiar} etq={etq} id={id} />
        <section className="ficha__sec ficha__sec--ancha" aria-label="Decisión">
          <h3 className="ficha__st">Decisión después de esta actividad
            <span className="ficha__sn">{modelo.decisiones.some(d => d.origen === clave) ? '' : 'ninguna'}</span></h3>
          <DecisionesDeActividad modelo={modelo} clave={clave} bloq={bloq} cambiar={cambiar} />
        </section>
        <VistaRelato proc={proc} modelo={modelo} clave={clave} bloq={bloq} cambiar={cambiar} etq={etq} />
      </div>
      {!bloq && (
        <footer className="ficha__pie">
          {borrar
            ? <Confirmar texto={usos ? 'Se eliminará. ' + plural(usos, 'decisión la usa y pasará', 'decisiones la usan y pasarán') + ' a «Revisar».' : '¿Eliminar esta actividad?'}
                onSi={() => { cambiar('Eliminó «' + a.nombre + '»', (p, m) => { eliminarActividad(m, clave); }); onEliminada(); }} onNo={() => setBorrar(false)} />
            : <Boton tamano="sm" variante="destructivo" onClick={() => setBorrar(true)}>Eliminar actividad</Boton>}
        </footer>
      )}
    </article>
  );
}

/* ---------- Formatos y adjuntos ---------- */

const vacioFormato = () => ({ nombre: '', codigo: '', version: '', enlace: '', archivo: null });

function SeccionFormatos({ a, clave, modelo, bloq, cambiar, etq, id }) {
  const { Boton, IconoBPMN } = Kz();
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState('');
  const [sobre, setSobre] = useState(false);
  const archivoRef = useRef(null);
  const lista = a.formatos || [];
  const otros = formatosDelModelo(modelo).filter(f => !lista.some(x => normalizarTexto(x.codigo || x.nombre) === f.llave));
  const upd = (et, fn) => cambiar(et + ' en ' + etq, (p, m) => { const x = m.actividades[clave]; if (x) { x.formatos = (x.formatos || []).slice(); fn(x); } });
  const subir = async file => {
    if (!file) return;
    if (file.size > MAX_ARCHIVO) { setMsg('«' + file.name + '» pesa ' + tamanoLegible(file.size) + ': el límite es 25 MB.'); return; }
    setMsg('Guardando «' + file.name + '»…');
    const meta = await guardarArchivo(file);
    setMsg(archivosPersistentes() ? '' : 'Este navegador no deja guardar archivos: el adjunto se pierde al recargar.');
    setForm(f => Object.assign(vacioFormato(), f || {}, { archivo: meta, nombre: (f && f.nombre) || file.name.replace(/\.[^.]+$/, '') }));
  };
  const guardar = e => {
    e.preventDefault();
    const f = form;
    if (!f.nombre.trim()) { setMsg('Escribe el nombre del formato.'); return; }
    upd('Adjuntó «' + f.nombre.trim() + '»', x => { x.formatos.push(nuevoFormato({ nombre: f.nombre.trim(), codigo: f.codigo.trim() || null, version: f.version.trim() || null, archivo: f.archivo, enlace: f.enlace.trim() || null })); });
    setForm(null); setMsg('');
  };
  const reusar = llave => {
    const f = otros.find(x => x.llave === llave);
    if (!f) return;
    upd('Usó el formato «' + f.nombre + '»', x => { x.formatos.push(nuevoFormato({ nombre: f.nombre, codigo: f.codigo, version: f.version, archivo: f.archivo, enlace: f.enlace })); });
  };
  const bajar = async f => {
    setMsg('');
    const rec = await leerArchivo(f.archivo.id);
    if (!rec) { setMsg('El archivo de «' + f.nombre + '» no está en este navegador.'); return; }
    const r = await descargar(f.archivo.nombre, rec.blob);
    if (!r.ok && r.msg) setMsg(r.msg);
  };
  const soltar = e => { e.preventDefault(); setSobre(false); if (bloq) return; const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (file) subir(file); };
  return (
    <section className={cx('ficha__sec', sobre && 'ficha__sec--sobre')} aria-label="Formatos y adjuntos"
      onDragOver={e => { if (!bloq && e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') >= 0) { e.preventDefault(); setSobre(true); } }}
      onDragLeave={() => setSobre(false)} onDrop={soltar}>
      <h3 className="ficha__st">Formatos y adjuntos<span className="ficha__sn">{lista.length ? plural(lista.length, 'formato', 'formatos') : 'ninguno'}</span></h3>
      {lista.length === 0 && !form && <p className="nota">Los formatos, plantillas o tablas que se usan en esta actividad. Quedan en el anexo del documento y la tarea lleva una hoja en el diagrama.</p>}
      {lista.length > 0 && (
        <ul className="fmts">
          {lista.map(f => (
            <li key={f.id} className="fmt">
              <IconoBPMN nombre="hoja" tamano={18} />
              <div className="fmt__txt">
                <span className="fmt__nom">{f.codigo && <b className="cod">{f.codigo} </b>}{f.nombre}{f.version ? ' · v' + f.version : ''}</span>
                <span className="fmt__meta">{f.archivo ? f.archivo.nombre + ' · ' + tamanoLegible(f.archivo.tamano) : f.enlace ? 'Enlace' : 'Sin archivo adjunto'}</span>
              </div>
              <div className="kz-row fmt__acc">
                {f.archivo && <button type="button" className="kz-link" onClick={() => bajar(f)}>Descargar</button>}
                {f.enlace && <a className="kz-link" href={f.enlace} target="_blank" rel="noopener noreferrer">Abrir enlace</a>}
                {!bloq && <button type="button" className="kz-link" onClick={() => upd('Quitó «' + f.nombre + '»', x => { x.formatos = x.formatos.filter(y => y.id !== f.id); })}>Quitar</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {!bloq && !form && (
        <div className="kz-row">
          <Boton tamano="sm" onClick={() => { setForm(vacioFormato()); setMsg(''); }}>+ Adjuntar formato</Boton>
          {otros.length > 0 && (
            <select className="kz-input fmt__reusar" aria-label="Usar un formato ya registrado" value="" onChange={e => reusar(e.target.value)}>
              <option value="">Usar uno ya registrado…</option>
              {otros.map(f => <option key={f.llave} value={f.llave}>{(f.codigo ? f.codigo + ' · ' : '') + f.nombre}</option>)}
            </select>
          )}
        </div>
      )}
      {form && (
        <form className="fmt-form" onSubmit={guardar} aria-label="Adjuntar formato">
          <div className="fmt-drop">
            <IconoBPMN nombre="hoja" tamano={20} />
            {form.archivo
              ? <span><b>{form.archivo.nombre}</b> · {tamanoLegible(form.archivo.tamano)} <button type="button" className="kz-link" onClick={() => setForm(Object.assign({}, form, { archivo: null }))}>Cambiar</button></span>
              : <span>Suelta aquí el archivo o <button type="button" className="kz-link" onClick={() => archivoRef.current && archivoRef.current.click()}>elige uno</button> (hasta 25 MB). También puedes dejar solo un enlace.</span>}
            <input ref={archivoRef} type="file" className="kz-sr" tabIndex={-1} aria-hidden="true" onChange={e => { subir(e.target.files && e.target.files[0]); e.target.value = ''; }} />
          </div>
          <div className="rejilla-3">
            <div className="campo"><label className="campo__rot" htmlFor={id('fmn')}>Nombre del formato</label>
              <input id={id('fmn')} className="kz-input" value={form.nombre} onChange={e => setForm(Object.assign({}, form, { nombre: e.target.value }))} placeholder="Formato de conciliación bancaria" /></div>
            <div className="campo"><label className="campo__rot" htmlFor={id('fmc')}>Código</label>
              <input id={id('fmc')} className="kz-input" value={form.codigo} onChange={e => setForm(Object.assign({}, form, { codigo: e.target.value }))} placeholder="FT-CON-01" /></div>
            <div className="campo"><label className="campo__rot" htmlFor={id('fmv')}>Versión</label>
              <input id={id('fmv')} className="kz-input" value={form.version} onChange={e => setForm(Object.assign({}, form, { version: e.target.value }))} placeholder="3" /></div>
          </div>
          <div className="campo"><label className="campo__rot" htmlFor={id('fme')}>Enlace (opcional)</label>
            <input id={id('fme')} className="kz-input" type="url" value={form.enlace} onChange={e => setForm(Object.assign({}, form, { enlace: e.target.value }))} placeholder="https://… donde vive la versión vigente" /></div>
          <div className="kz-row"><Boton tamano="sm" variante="primario" type="submit">Guardar formato</Boton><Boton tamano="sm" type="button" onClick={() => { setForm(null); setMsg(''); }}>Cancelar</Boton></div>
        </form>
      )}
      {msg && <p className="nota" role="status">{msg}</p>}
    </section>
  );
}

/* ---------- Eventos y ciclo ---------- */

const ICONO_EVENTO = { tiempo: 'tiempo', fecha: 'tiempo', mensaje: 'mensaje', condicion: 'condicion', aviso: 'aviso', limite: 'tiempo', error: 'error', hito: 'hito' };
const UNIDADES_EV = [['min', 'minutos'], ['h', 'horas'], ['días', 'días']];

function SeccionEventos({ a, clave, seq, bloq, cambiar, etq, id }) {
  const { Boton, IconoBPMN } = Kz();
  const [abierto, setAbierto] = useState(null);
  const [menu, setMenu] = useState(null);
  const eventos = a.eventos || [];
  const upd = (et, fn) => cambiar(et + ' de ' + etq, (p, m) => { const x = m.actividades[clave]; if (x) { x.eventos = (x.eventos || []).map(e => Object.assign({}, e)); fn(x); } });
  const agregar = (tipo, momento) => { const e = nuevoEvento(tipo, momento); upd('Agregó un evento', x => { x.eventos.push(e); }); setAbierto(e.id); setMenu(null); };
  const setE = (eid, campo) => v => upd('Editó un evento', x => { const e = x.eventos.find(y => y.id === eid); if (e) e[campo] = v; });
  const quitar = eid => { upd('Quitó un evento', x => { x.eventos = x.eventos.filter(y => y.id !== eid); }); if (abierto === eid) setAbierto(null); };
  const rotulo = k => { if (k === '__fin') return 'terminar el proceso'; const s = seq.find(x => x.clave === k); return s ? (s.codigo || 'Sin número') + ' «' + s.nombre + '»' : 'una actividad eliminada'; };
  const ciclo = a.ciclo || {};
  const setCiclo = cambio => upd('Editó el ciclo', x => { x.ciclo = cambio ? Object.assign({ tipo: '', condicion: null, paralelo: false }, x.ciclo || {}, cambio) : null; if (x.ciclo && !x.ciclo.tipo) x.ciclo = null; });
  const menuEspera = momento => menu === momento
    ? (<div className="evs__menu" role="group" aria-label="¿Qué espera?">
        {['tiempo', 'fecha', 'mensaje', 'condicion'].map(t => <button key={t} type="button" className="evs__op" onClick={() => agregar(t, momento)}><IconoBPMN nombre={ICONO_EVENTO[t]} tamano={14} /> {TIPOS_EVENTO[t].nombre}</button>)}
        <button type="button" className="kz-link" onClick={() => setMenu(null)}>Cancelar</button>
      </div>)
    : <Boton tamano="sm" onClick={() => setMenu(momento)}>+ Espera</Boton>;
  const columna = (momento, titulo, ayuda, botones) => {
    const lista = eventos.filter(e => e.momento === momento);
    return (
      <div className="evs__col">
        <h4 className="evs__t">{titulo}</h4>
        {lista.length === 0 && <p className="evs__vacio">{ayuda}</p>}
        {lista.length > 0 && <ul className="evs__l">{lista.map(e => (
          <li key={e.id} className={cx('ev', abierto === e.id && 'ev--abierto')}>
            <div className="ev__cab">
              <span className={cx('ev__ic', e.tipo === 'limite' || e.tipo === 'error' ? 'ev__ic--borde' : '')}><IconoBPMN nombre={ICONO_EVENTO[e.tipo]} tamano={16} /></span>
              <span className="ev__txt">{fraseEvento(e, rotulo)}</span>
              <span className="kz-row ev__acc">
                {!bloq && <button type="button" className="kz-link" aria-expanded={abierto === e.id} onClick={() => setAbierto(abierto === e.id ? null : e.id)}>{abierto === e.id ? 'Listo' : 'Editar'}</button>}
                {!bloq && <button type="button" className="kz-link" onClick={() => quitar(e.id)}>Quitar</button>}
              </span>
            </div>
            {abierto === e.id && !bloq && <EditorEvento e={e} seq={seq} clave={clave} setE={setE} id={x => id('ev-' + e.id + '-' + x)} />}
          </li>
        ))}</ul>}
        {!bloq && botones}
      </div>
    );
  };
  return (
    <section className="ficha__sec ficha__sec--ancha" aria-label="Eventos y ciclo">
      <h3 className="ficha__st">Eventos y ciclo<span className="ficha__sn">{eventos.length ? plural(eventos.length, 'evento', 'eventos') : 'ninguno'}{ciclo.tipo ? ' · se repite' : ''}</span></h3>
      <p className="nota">Lo que hace esperar, interrumpe o repite esta actividad. Cada evento se dibuja en el diagrama, antes, sobre el borde o después de la tarea.</p>
      <div className="evs">
        {columna('antes', 'Antes de empezar', 'Sin esperas: empieza apenas termina lo anterior.', menuEspera('antes'))}
        {columna('durante', 'Mientras se hace', 'Sin límites de tiempo ni excepciones.',
          <div className="kz-row"><Boton tamano="sm" onClick={() => agregar('limite')}>+ Límite de tiempo</Boton><Boton tamano="sm" onClick={() => agregar('error')}>+ Error</Boton></div>)}
        {columna('despues', 'Al terminar', 'Sigue directo con lo siguiente.',
          <div className="kz-row">{menuEspera('despues')}{menu !== 'despues' && <Boton tamano="sm" onClick={() => agregar('aviso')}>+ Aviso</Boton>}{menu !== 'despues' && <Boton tamano="sm" onClick={() => agregar('hito')}>+ Hito</Boton>}</div>)}
      </div>
      <div className="campo ciclo">
        <span className="campo__rot" id={id('cil')}>Ciclo de ejecución</span>
        <div className="segmento" role="group" aria-labelledby={id('cil')}>
          {CICLOS.map(([v, t]) => <button key={v || 'no'} type="button" disabled={bloq} aria-pressed={(ciclo.tipo || '') === v} onClick={() => setCiclo(v ? { tipo: v } : null)}>{v === 'repite' ? <Fragment><IconoBPMN nombre="repite" tamano={14} /> Se repite</Fragment> : v === 'porCada' ? <Fragment><IconoBPMN nombre={ciclo.paralelo ? 'porCada' : 'porCadaSecuencial'} tamano={14} /> Por cada…</Fragment> : 'Una vez'}</button>)}
        </div>
        {ciclo.tipo === 'repite' && <Campo id={id('cic')} etiqueta="¿Hasta cuándo se repite?" modo="texto" tri={false} disabled={bloq} valor={ciclo.condicion || null} onCommit={v => setCiclo({ condicion: v })} ayuda="«hasta que no queden partidas sin cruzar», «cada día hasta el cierre»." />}
        {ciclo.tipo === 'porCada' && (
          <div className="rejilla-2">
            <Campo id={id('cip')} etiqueta="¿Por cada qué?" modo="texto" tri={false} disabled={bloq} valor={ciclo.condicion || null} onCommit={v => setCiclo({ condicion: v })} ayuda="«cuenta bancaria», «factura recibida»." />
            <div className="campo"><span className="campo__rot" id={id('cio')}>¿Cómo se hacen?</span>
              <div className="segmento" role="group" aria-labelledby={id('cio')}>
                <button type="button" disabled={bloq} aria-pressed={!ciclo.paralelo} onClick={() => setCiclo({ paralelo: false })}>Uno tras otro</button>
                <button type="button" disabled={bloq} aria-pressed={!!ciclo.paralelo} onClick={() => setCiclo({ paralelo: true })}>Todos a la vez</button>
              </div></div>
          </div>
        )}
        {ciclo.tipo && <p className="campo__ayuda">{fraseCiclo(ciclo)} En el diagrama la tarea lleva la marca de ciclo.</p>}
      </div>
    </section>
  );
}

function EditorEvento({ e, seq, clave, setE, id }) {
  const destinos = (
    <div className="campo"><label className="campo__rot" htmlFor={id('dst')}>Entonces pasa a</label>
      <select id={id('dst')} className="kz-input" value={e.destino || ''} onChange={x => setE(e.id, 'destino')(x.target.value || null)}>
        <option value="">Aún no se sabe</option>
        {seq.filter(s => s.clave !== clave).map(s => <option key={s.clave} value={s.clave}>{(s.codigo || 'Sin fase') + ' · ' + s.nombre}</option>)}
        <option value="__fin">Termina el proceso</option>
        {e.destino && e.destino !== '__fin' && !seq.some(s => s.clave === e.destino) && <option value={e.destino}>Actividad eliminada: elige otra</option>}
      </select></div>
  );
  const duracion = (
    <div className="ev__dur">
      <Campo id={id('n')} etiqueta="Cuánto" modo="numero" tri={false} valor={e.n} onCommit={setE(e.id, 'n')} />
      <div className="campo"><label className="campo__rot" htmlFor={id('u')}>Unidad</label>
        <select id={id('u')} className="kz-input" value={e.unidad || 'h'} onChange={x => setE(e.id, 'unidad')(x.target.value)}>{UNIDADES_EV.map(u => <option key={u[0]} value={u[0]}>{u[1]}</option>)}</select></div>
    </div>
  );
  const quien = etiqueta => (
    <Fragment>
      <Campo id={id('q')} etiqueta={etiqueta} modo="texto" tri={false} valor={e.quien} onCommit={setE(e.id, 'quien')} />
      <label className="check"><input type="checkbox" checked={!!e.externo} onChange={x => setE(e.id, 'externo')(x.target.checked)} /> Es de otra organización: se dibuja con un flujo de mensaje</label>
    </Fragment>
  );
  const texto = (etiqueta, ayuda) => <Campo id={id('t')} etiqueta={etiqueta} modo="texto" tri={false} valor={e.texto} onCommit={setE(e.id, 'texto')} ayuda={ayuda} />;
  return (
    <div className="ev__ed">
      {e.tipo === 'tiempo' && <Fragment>{duracion}{texto('Motivo (opcional)', 'Es el nombre del evento en el diagrama.')}</Fragment>}
      {e.tipo === 'fecha' && texto('¿Hasta cuándo?', '«El tercer día hábil del mes», «las 5:00 p. m.».')}
      {e.tipo === 'mensaje' && <Fragment>{texto('¿Qué llega?', '«Respuesta del cliente», «Soporte de pago».')}{quien('¿De quién?')}</Fragment>}
      {e.tipo === 'condicion' && texto('¿Qué se debe cumplir?', '«Los fondos están disponibles».')}
      {e.tipo === 'aviso' && <Fragment>{quien('¿A quién se avisa?')}{texto('¿Qué se avisa?', '«Conciliación lista».')}</Fragment>}
      {e.tipo === 'hito' && texto('¿Qué hito se cumple?', '«Movimientos del mes cargados», «Conciliación cerrada».')}
      {e.tipo === 'limite' && (
        <Fragment>
          {duracion}
          <div className="campo"><span className="campo__rot" id={id('il')}>Si se cumple el plazo</span>
            <div className="segmento" role="group" aria-labelledby={id('il')}>
              <button type="button" aria-pressed={e.interrumpe !== false} onClick={() => setE(e.id, 'interrumpe')(true)}>Se detiene</button>
              <button type="button" aria-pressed={e.interrumpe === false} onClick={() => setE(e.id, 'interrumpe')(false)}>Sigue, y además…</button>
            </div></div>
          {destinos}
          {texto('Nombre (opcional)', '«Sin respuesta en 3 días».')}
        </Fragment>
      )}
      {e.tipo === 'error' && <Fragment>{texto('¿Qué error o excepción?', '«El banco rechaza la descarga».')}{destinos}</Fragment>}
    </div>
  );
}

/* ---------- Tabla ---------- */

function VistaTabla({ proc, modelo, version, bloq, cambiar, seleccion, setSeleccion, abrirModal, iaDisponible, ir }) {
  const { Boton, EstadoConfirmacion } = Kz();
  const seq = secuencia(modelo);
  const asis = version === 'tobe' ? proc.versiones.asis : null;
  const [filtro, setFiltro] = useState('todas');
  const [destino, setDestino] = useState('__sin');
  const [nuevo, setNuevo] = useState('');
  const tabla = useRef(null);
  const pendiente = useRef(null);
  const rolesL = roles(modelo);
  const abrir = clave => { setSeleccion(clave); ir('actividades', 'caracterizar'); };
  const filas = seq.filter(s => {
    const a = modelo.actividades[s.clave];
    if (!a) return false;
    if (filtro === 'preguntas') return a.estado === 'pregunta' || CAMPOS_FICHA.some(k => a[k] === DESCONOCIDO);
    if (filtro === 'incompletas') return !completitud(a).completa;
    if (filtro === 'ia') return a.estado === 'sugerencia';
    if (filtro === 'sinfase') return s.numero == null;
    return true;
  });
  useEffect(() => {
    if (!pendiente.current || !tabla.current) return;
    const { clave, c } = pendiente.current; pendiente.current = null;
    const el = tabla.current.querySelector('tr[data-clave="' + clave + '"] [data-c="' + c + '"]');
    if (el) el.focus();
  });
  const enfocar = (i, c) => { const el = tabla.current && tabla.current.querySelector('[data-f="' + i + '"][data-c="' + c + '"]'); if (el) el.focus(); };
  const tecla = (i, c, clave) => (e, commit) => {
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault(); commit();
      pendiente.current = { clave, c };
      cambiar('Movió ' + ((seq.find(s => s.clave === clave) || {}).codigo || 'una actividad'), (p, m) => { moverEnSecuencia(m, clave, e.key === 'ArrowUp' ? -1 : 1); });
      return;
    }
    if (e.key === 'Enter' || (e.key === 'ArrowDown' && !e.altKey)) { e.preventDefault(); commit(); enfocar(i + 1, c); }
    if (e.key === 'ArrowUp' && !e.altKey) { e.preventDefault(); commit(); enfocar(i - 1, c); }
  };
  const set = (clave, campo, et) => v => cambiar('Editó ' + et, (p, m) => { m.actividades[clave][campo] = v; });
  const agregar = nombres => {
    if (!nombres.length) return;
    cambiar(nombres.length === 1 ? 'Agregó «' + nombres[0] + '»' : 'Agregó ' + nombres.length + ' actividades', (p, m) => { agregarActividades(m, destino, nombres); });
  };
  const limpiar = s => s.replace(/^\s*(?:[-*•·]|\d+[.)-])\s*/, '').trim();
  const elim = eliminadasFrenteAsis(asis, modelo);
  return (
    <Fragment>
      <div className="barra">
        <label className="barra__f">Mostrar
          <select id="filtro-act" className="kz-input" value={filtro} onChange={e => setFiltro(e.target.value)}>
            <option value="todas">Todas ({seq.length})</option><option value="incompletas">Por completar</option><option value="preguntas">Con datos por preguntar</option>
            <option value="ia">Sugerencias de la IA</option><option value="sinfase">Sin fase</option>
          </select></label>
        <span className="barra__sep" />
        {iaDisponible && <Boton tamano="sm" disabled={bloq} onClick={() => abrirModal({ tipo: 'notas' })}>Desde notas · IA</Boton>}
        <Boton tamano="sm" disabled={bloq} onClick={() => abrirModal({ tipo: 'pegar', destino })}>Pegar lista</Boton>
      </div>
      <p className="nota">Para revisar en bloque. Escribe «?» si aún no se sabe y «n/a» si no aplica; «0» es cero. Alt+↑/↓ mueve la fila y la renumera. El número abre la ficha completa.</p>
      <div className="kz-grid-wrap" ref={tabla}>
        <table className="kz-grid grid-edit">
          <thead><tr>
            {['N.º', 'Actividad', 'Fase', 'Responsable', 'Entregable', 'Proceso', 'Espera', 'Datos', 'Estado'].concat(asis ? ['Cambio'] : []).map(c => <th key={c} scope="col">{c}</th>)}
          </tr></thead>
          <tbody>
            {filas.map((s, i) => {
              const a = modelo.actividades[s.clave];
              const f = faseDe(modelo, s.clave);
              const cambio = asis ? cambioFrenteAsis(asis, modelo, a) : null;
              const c = completitud(a);
              return (
                <tr key={s.clave} data-clave={s.clave} className={cx(a.estado === 'sugerencia' && 'kz-grid__row--ia', seleccion === s.clave && 'kz-grid__row--sel')}>
                  <td className="kz-grid__id"><button type="button" className="celda-id" onClick={() => abrir(s.clave)} aria-label={'Abrir la ficha de ' + a.nombre}>{s.codigo || '—'}</button></td>
                  <td className="kz-grid__name"><Entrada data-f={i} data-c={1} aria-label="Actividad" className="celda celda--nombre" disabled={bloq} valor={a.nombre} onCommit={v => v && set(s.clave, 'nombre', 'el nombre')(v)} onTecla={tecla(i, 1, s.clave)} /></td>
                  <td><select data-f={i} data-c={2} aria-label="Fase" className="celda" disabled={bloq} value={f ? f.id : '__sin'} onChange={e => cambiar('Cambió de fase «' + a.nombre + '»', (p, m) => { ponerEnFase(m, s.clave, e.target.value); })}>
                    {modelo.fases.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}<option value="__sin">Sin fase</option></select></td>
                  <td><Entrada data-f={i} data-c={3} aria-label="Responsable" list="roles-lista" modo="especial" className="celda" disabled={bloq} valor={a.responsable} onCommit={set(s.clave, 'responsable', 'el responsable')} onTecla={tecla(i, 3, s.clave)} /></td>
                  <td><Entrada data-f={i} data-c={4} aria-label="Entregable" modo="especial" className="celda" disabled={bloq} valor={a.entregable} onCommit={set(s.clave, 'entregable', 'el entregable')} onTecla={tecla(i, 4, s.clave)} /></td>
                  <td className="kz-grid__num"><span className="celda-num"><Entrada data-f={i} data-c={5} aria-label="Tiempo de proceso" modo="numero" className="celda celda--num" disabled={bloq} valor={a.tProceso} onCommit={set(s.clave, 'tProceso', 'el tiempo de proceso')} onTecla={tecla(i, 5, s.clave)} /><span className="celda-u">{a.unidad}</span></span></td>
                  <td className="kz-grid__num"><span className="celda-num"><Entrada data-f={i} data-c={6} aria-label="Tiempo de espera" modo="numero" className="celda celda--num" disabled={bloq} valor={a.tEspera} onCommit={set(s.clave, 'tEspera', 'el tiempo de espera')} onTecla={tecla(i, 6, s.clave)} /><span className="celda-u">{a.unidad}</span></span></td>
                  <td className="kz-grid__num"><span className="celda-datos">{c.resp}/{c.total}{c.preg ? <b className="lf__q"> ?{c.preg}</b> : null}</span></td>
                  <td><button type="button" className="celda-estado" onClick={() => abrir(s.clave)} aria-label="Ver estado y ficha"><EstadoConfirmacion estado={a.estado} compacto /></button></td>
                  {asis && <td>{cambio && <span className={'cambio cambio--' + cambio}>{cambio === 'nueva' ? 'Nueva' : 'Modificada'}</span>}</td>}
                </tr>
              );
            })}
            {!bloq && (
              <tr className="kz-grid__new">
                <td className="kz-grid__id">+</td>
                <td colSpan={asis ? 9 : 8}>
                  <div className="alta">
                    <input id="alta-actividad" className="celda alta__in" value={nuevo} placeholder="Escribe una actividad y pulsa Enter · pega una lista para crear varias"
                      onChange={e => setNuevo(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && nuevo.trim()) { e.preventDefault(); agregar([limpiar(nuevo)]); setNuevo(''); } }}
                      onPaste={e => { const t = e.clipboardData.getData('text'); if (/\r?\n/.test(t.trim())) { e.preventDefault(); agregar(t.split(/\r?\n/).map(limpiar).filter(Boolean)); } }} />
                    <label className="alta__dest">en <select id="alta-destino" className="celda" value={destino} onChange={e => setDestino(e.target.value)}>
                      <option value="__sin">Sin fase</option>{modelo.fases.map(x => <option key={x.id} value={x.id}>{x.nombre} (al final)</option>)}</select></label>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <datalist id="roles-lista">{rolesL.map(r => <option key={r} value={r} />)}</datalist>
      </div>
      {asis && elim.length > 0 && <p className="nota">Quitadas frente al As-Is: {elim.map(a => '«' + a.nombre + '»').join(', ')}.</p>}
    </Fragment>
  );
}

/* ======================= FASES: criterios ======================= */

const normal = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export function TabFases({ proc, modelo, bloq, cambiar, ir, focoFase }) {
  const { Boton } = Kz();
  const [borrar, setBorrar] = useState(null);
  const raiz = useRef(null);
  const seq = secuencia(modelo);
  const cod = {};
  seq.forEach(s => { cod[s.clave] = s.codigo; });
  useEffect(() => {
    if (!focoFase || !raiz.current) return;
    const el = raiz.current.querySelector('[data-fase-ed="' + focoFase + '"]');
    if (!el) return;
    el.style.scrollMarginTop = 'calc(var(--alto-cab, 150px) + 16px)';
    el.scrollIntoView({ block: 'start' });
    const campo = el.querySelector('#fo-' + focoFase) || el.querySelector('input, textarea');
    if (campo) campo.focus({ preventScroll: true });
  }, [focoFase]);
  const setF = (fid, campo, et) => v => cambiar('Editó ' + et + ' de una fase', (p, m) => {
    const f = m.fases.find(x => x.id === fid);
    if (f) f[campo] = campo === 'entregables' ? String(v || '').split(',').map(x => x.trim()).filter(Boolean) : v;
  });
  const mover = (i, d) => cambiar('Reordenó las fases', (p, m) => { const [f] = m.fases.splice(i, 1); m.fases.splice(i + d, 0, f); });
  return (
    <div className="fases-ed" ref={raiz}>
      <div className="barra">
        <Boton tamano="sm" disabled={bloq} onClick={() => cambiar('Agregó una fase', (p, m) => { nuevaFase(m); })}>+ Nueva fase</Boton>
        <span className="nota nota--barra">Qué entra, qué se entrega y cuándo termina cada fase. Las actividades se listan y se ordenan en <button type="button" className="kz-link" onClick={() => ir('actividades', 'listar')}>Actividades · 1 · Listar y agrupar</button>.</span>
      </div>
      {modelo.fases.length === 0 && <p className="vacio tarjeta">Aún no hay fases. Créalas aquí o en el tablero de actividades, con «+ Nueva fase».</p>}
      {modelo.fases.map((f, i) => {
        const acts = f.actividades.map(k => modelo.actividades[k]).filter(Boolean);
        const previa = modelo.fases[i - 1];
        const ultima = acts[acts.length - 1];
        const propios = f.entregables || [];
        const deActs = [];
        acts.forEach(a => { if (tieneValor(a.entregable) && !propios.some(x => normal(x) === normal(a.entregable)) && !deActs.some(x => normal(x) === normal(a.entregable))) deActs.push(a.entregable); });
        let sugEntrada = null;
        if (!bloq && vacioOPregunta(f.entrada)) {
          if (previa && tieneValor(previa.salida)) sugEntrada = <Sugerencia texto={previa.salida} de={'salida de «' + previa.nombre + '»'} onUsar={() => setF(f.id, 'entrada', 'la entrada')(previa.salida)} />;
          else if (i === 0 && tieneValor(proc.disparador)) sugEntrada = <Sugerencia texto={proc.disparador} de="evento que inicia el proceso" onUsar={() => setF(f.id, 'entrada', 'la entrada')(proc.disparador)} />;
        }
        const sugEntregables = !bloq && deActs.length
          ? <Sugerencia accion="Agregar" texto={deActs.join('», «')} de={deActs.length === 1 ? 'entregable de una de sus actividades' : 'entregables de sus actividades'} onUsar={() => setF(f.id, 'entregables', 'los entregables')(propios.concat(deActs).join(', '))} /> : null;
        const sugSalida = !bloq && vacioOPregunta(f.salida) && ultima && tieneValor(ultima.criterio)
          ? <Sugerencia texto={ultima.criterio} de={'criterio de ' + (cod[ultima.clave] || 'su última actividad')} onUsar={() => setF(f.id, 'salida', 'la salida')(ultima.criterio)} /> : null;
        return (
          <section key={f.id} data-fase-ed={f.id} className={cx('editor-fases__f', focoFase === f.id && 'editor-fases__f--foco')} aria-label={'Fase ' + (i + 1) + ': ' + f.nombre}>
            <div className="editor-fases__cab">
              <span className="kz-phase__n">{i + 1}</span>
              <Entrada id={'fn-' + f.id} aria-label="Nombre de la fase" className="kz-input editor-fases__nom" disabled={bloq} valor={f.nombre} onCommit={v => v && setF(f.id, 'nombre', 'el nombre')(v)} />
              <button type="button" className="kz-icon-btn" aria-label="Mover a la izquierda" disabled={bloq || i === 0} onClick={() => mover(i, -1)}>←</button>
              <button type="button" className="kz-icon-btn" aria-label="Mover a la derecha" disabled={bloq || i === modelo.fases.length - 1} onClick={() => mover(i, 1)}>→</button>
              {!bloq && <button type="button" className="kz-link" onClick={() => setBorrar(f.id)}>Eliminar</button>}
            </div>
            {borrar === f.id && <Confirmar texto={acts.length ? 'Sus ' + plural(acts.length, 'actividad pasará', 'actividades pasarán') + ' a «Sin fase».' : '¿Eliminar esta fase?'} onSi={() => { cambiar('Eliminó la fase «' + f.nombre + '»', (p, m) => eliminarFase(m, f.id)); setBorrar(null); }} onNo={() => setBorrar(null)} />}
            {acts.length ? (
              <ol className="editor-fases__acts" aria-label="Sus actividades">
                {acts.map(a => <li key={a.clave}><b>{cod[a.clave]}</b>{a.nombre}</li>)}
              </ol>
            ) : <p className="nota">Sin actividades todavía.</p>}
            <div className="rejilla-2">
              <Campo id={'fo-' + f.id} etiqueta="Objetivo" disabled={bloq} valor={f.objetivo} onCommit={setF(f.id, 'objetivo', 'el objetivo')} />
              <Campo id={'fe-' + f.id} etiqueta="Criterio de entrada" disabled={bloq} valor={f.entrada} onCommit={setF(f.id, 'entrada', 'la entrada')} extra={sugEntrada} />
              <Campo id={'fg-' + f.id} etiqueta="Entregables esperados" modo="texto" tri={false} disabled={bloq} valor={propios.join(', ') || null} onCommit={setF(f.id, 'entregables', 'los entregables')} ayuda="Separados por comas." extra={sugEntregables} />
              <Campo id={'fs-' + f.id} etiqueta="Criterio de salida" disabled={bloq} valor={f.salida} onCommit={setF(f.id, 'salida', 'la salida')} ayuda="Cuándo se da por terminada la fase." extra={sugSalida} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
