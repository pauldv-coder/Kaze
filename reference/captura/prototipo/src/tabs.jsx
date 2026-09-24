/* Las vistas de un proceso: Resumen, Actividades, Fases, Decisiones, Diagrama, Aprobación. */
import {
  secuencia, fasesTablero, aplicarTablero, ponerEnFase, moverEnSecuencia, eliminarActividad, eliminarFase,
  nuevaActividad, nuevaDecision, faseDe, roles, tieneValor, esEspecial, DESCONOCIDO, NA, uid, ahora,
  avisos, porPreguntar, cambioFrenteAsis, eliminadasFrenteAsis, estadoAprobacion, relativo, fechaCorta, clonar,
  TIPOS_INICIO, TIPOS_REFERENCIA,
} from './model.js';
import { generarBPMN } from './bpmn.js';
import { zip, nombreArchivo, usar, textoErrorIA, promptActividades, promptDecisiones, descargar } from './util.js';
import { crearModeler, leerAjustes } from './lienzo.js';
import { fotoLienzo, sincronizar } from './sincronizar.js';
import { Kz, cx, Entrada, Campo, Modal, Aviso, Pensando, Confirmar } from './ui.jsx';
import { PAPELES, codigoContacto, correoValido } from './aprobacion.js';

const React = window.React;
const { useState, useEffect, useRef, useMemo, Fragment } = React;

const NIVEL = { alerta: 'Revisar', info: 'Falta', ia: 'IA' };
const UNIDADES = [['min', 'min'], ['h', 'h'], ['días', 'días']];

/* ======================= RESUMEN ======================= */

export function TabResumen({ proc, modelo, cambiar, ir, abrirModal, iaDisponible, setSeleccion, revision }) {
  const { Boton } = Kz();
  const set = (campo, etiqueta) => v => cambiar('Editó ' + etiqueta, p => { p[campo] = v; }, { ficha: true });
  const setLista = (campo, etiqueta) => v => cambiar('Editó ' + etiqueta, p => { p[campo] = String(v || '').split(/\r?\n|,/).map(s => s.trim()).filter(Boolean); }, { ficha: true });
  const av = avisos(proc, modelo);
  const faltan = porPreguntar(modelo);
  const [nuevaP, setNuevaP] = useState('');
  const abiertas = (proc.preguntas || []).filter(q => !q.resuelta);
  return (
    <div className="dos-col">
      <div className="col-main">
        <section className="tarjeta">
          <h2 className="tarjeta__t">Ficha del proceso</h2>
          <div className="rejilla-2">
            <Campo id="f-nombre" etiqueta="Nombre" modo="texto" tri={false} valor={proc.nombre} onCommit={set('nombre', 'el nombre')} />
            <Campo id="f-dueno" etiqueta="Dueño del proceso" valor={proc.dueno || null} onCommit={set('dueno', 'el dueño')} ayuda="Aprueba la versión final." />
            <Campo id="f-obj" etiqueta="Objetivo" como="textarea" rows={3} valor={proc.objetivo || null} onCommit={set('objetivo', 'el objetivo')} />
            <Campo id="f-disp" etiqueta="Evento que lo inicia" valor={proc.disparador || null} onCommit={set('disparador', 'el disparador')} ayuda="Será el evento de inicio del diagrama." />
            <div className="campo"><label className="campo__rot" htmlFor="f-ini">Cómo inicia</label>
              <select id="f-ini" className="kz-input" value={(proc.inicio && proc.inicio.tipo) || 'ninguno'} onChange={e => cambiar('Editó cómo inicia el proceso', p => { p.inicio = Object.assign({}, p.inicio || {}, { tipo: e.target.value }); }, { ficha: true })}>
                {TIPOS_INICIO.map(t => <option key={t[0]} value={t[0]}>{t[1]}</option>)}</select>
              <p className="campo__ayuda">Cambia el símbolo del inicio: programado lleva reloj; una solicitud, sobre.</p></div>
            {proc.inicio && proc.inicio.tipo && proc.inicio.tipo !== 'ninguno' && (
              <Campo id="f-inid" etiqueta={proc.inicio.tipo === 'tiempo' ? '¿Cada cuánto o cuándo?' : proc.inicio.tipo === 'mensaje' ? '¿Qué llega y de quién?' : '¿Qué condición?'} modo="texto" tri={false}
                valor={proc.inicio.detalle || null} onCommit={v => cambiar('Editó cómo inicia el proceso', p => { p.inicio = Object.assign({}, p.inicio, { detalle: v }); }, { ficha: true })}
                ayuda={proc.inicio.tipo === 'tiempo' ? '«Cada mes, el tercer día hábil».' : proc.inicio.tipo === 'mensaje' ? '«Solicitud del cliente por correo».' : '«El saldo supera el tope».'} />
            )}
            <Campo id="f-alc" etiqueta="Alcance" como="textarea" rows={2} valor={proc.alcance || null} onCommit={set('alcance', 'el alcance')} />
            <Campo id="f-exc" etiqueta="Exclusiones" como="textarea" rows={2} valor={proc.exclusiones || null} onCommit={set('exclusiones', 'las exclusiones')} />
            <Campo id="f-res" etiqueta="Resultados posibles" como="textarea" rows={2} modo="texto" tri={false} valor={(proc.resultados || []).join('\n') || null} onCommit={setLista('resultados', 'los resultados')} ayuda="Uno por línea: nombran los eventos de fin." />
            <div className="campo">
              <Campo id="f-cli" etiqueta="Cliente o receptor del resultado" valor={proc.cliente || null} onCommit={set('cliente', 'el cliente')} />
              <label className="check"><input id="f-cliext" type="checkbox" checked={!!proc.clienteExterno} onChange={e => cambiar('Editó el cliente', p => { p.clienteExterno = e.target.checked; }, { ficha: true })} /> Es externo (otra organización)</label>
            </div>
            <Campo id="f-prov" etiqueta="Proveedores" modo="texto" tri={false} valor={(proc.proveedores || []).join(', ') || null} onCommit={setLista('proveedores', 'los proveedores')} ayuda="Quién entrega las entradas del proceso, separados por comas. Van en el SIPOC del documento." />
            <Campo id="f-dep" etiqueta="Departamentos" modo="texto" tri={false} valor={(proc.departamentos || []).join(', ') || null} onCommit={setLista('departamentos', 'los departamentos')} ayuda="Separados por comas." />
            <Campo id="f-cod" etiqueta="Código del documento" modo="texto" tri={false} valor={proc.codigoDoc || null} onCommit={set('codigoDoc', 'el código del documento')} ayuda="Va en la portada y el pie del documento Word." />
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__cab"><h2 className="tarjeta__t">Referencias</h2>
            <Boton tamano="sm" onClick={() => cambiar('Agregó una referencia', p => { p.referencias = (p.referencias || []).concat([{ id: uid('r'), codigo: null, nombre: '', tipo: 'interna', enlace: null }]); }, { ficha: true })}>+ Referencia</Boton></div>
          {(proc.referencias || []).length === 0 && <p className="vacio">Normas, políticas, procedimientos relacionados o leyes que aplican. Van en la tabla de referencias del documento.</p>}
          {(proc.referencias || []).length > 0 && (
            <div className="tabla-scroll"><table className="lista-simple refs">
              <thead><tr><th>Código</th><th>Referencia</th><th>Tipo</th><th>Enlace</th><th><span className="kz-sr">Acciones</span></th></tr></thead>
              <tbody>{proc.referencias.map((r, i) => {
                const setR = (c, et) => v => cambiar('Editó ' + et + ' de una referencia', p => { p.referencias[i][c] = v; }, { ficha: true });
                return (
                  <tr key={r.id}>
                    <td className="refs__cod"><Entrada id={'rf-c-' + r.id} aria-label="Código" className="kz-input" valor={r.codigo || null} onCommit={setR('codigo', 'el código')} placeholder="PO-CON-01" /></td>
                    <td><Entrada id={'rf-n-' + r.id} aria-label="Referencia" className="kz-input" valor={r.nombre || null} onCommit={v => setR('nombre', 'el nombre')(v || '')} placeholder="Política de conciliaciones" /></td>
                    <td><select id={'rf-t-' + r.id} aria-label="Tipo" className="kz-input" value={r.tipo || 'interna'} onChange={e => setR('tipo', 'el tipo')(e.target.value)}>{TIPOS_REFERENCIA.map(t => <option key={t[0]} value={t[0]}>{t[1]}</option>)}</select></td>
                    <td><Entrada id={'rf-e-' + r.id} aria-label="Enlace" className="kz-input" valor={r.enlace || null} onCommit={setR('enlace', 'el enlace')} placeholder="https://…" /></td>
                    <td><button type="button" className="kz-link" onClick={() => cambiar('Quitó una referencia', p => { p.referencias.splice(i, 1); }, { ficha: true })}>Quitar</button></td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          )}
        </section>

        <section className="tarjeta" aria-labelledby="t-contactos">
          <div className="tarjeta__cab"><h2 className="tarjeta__t" id="t-contactos">Contactos y RACI</h2>
            <Boton tamano="sm" onClick={() => cambiar('Agregó un contacto', p => { const n = (p.participantes || []).reduce((mx, c) => Math.max(mx, c.num || 0), 0) + 1; p.participantes.push({ id: uid('u'), nombre: '', rol: '', departamento: '', correo: '', papel: '', num: n }); }, { ficha: true })}>+ Contacto</Boton></div>
          <p className="texto contactos__ayuda">Quienes participan en las entrevistas y en la aprobación. El papel arma el flujo: <b>da visto bueno</b> (C) revisa por su área, <b>aprueba</b> (A) firma al final, <b>informado</b> (I) recibe la versión aprobada y <b>elabora</b> (R) documenta el proceso. El código identifica a cada persona cuando responde.</p>
          {(proc.participantes || []).length === 0 && <p className="vacio">Aún no hay contactos. Agrega a quienes entrevistas y a quienes aprueban.</p>}
          {(proc.participantes || []).length > 0 && (
            <div className="tabla-scroll"><table className="lista-simple contactos">
              <thead><tr><th>Nombre</th><th>Cargo</th><th>Área</th><th>Correo</th><th>Papel</th><th>Código</th><th><span className="kz-sr">Acciones</span></th></tr></thead>
              <tbody>{proc.participantes.map((u, i) => {
                const setC = (c, et) => v => cambiar('Editó ' + et + ' de un contacto', p => { p.participantes[i][c] = v || ''; }, { ficha: true });
                const malCorreo = tieneValor(u.correo) && !correoValido(u.correo);
                return (
                  <tr key={u.id}>
                    <td><Entrada id={'pt-' + u.id + '-nombre'} aria-label="Nombre" className="kz-input" valor={u.nombre || null} onCommit={setC('nombre', 'el nombre')} placeholder="Nombre y apellido" /></td>
                    <td><Entrada id={'pt-' + u.id + '-rol'} aria-label="Cargo" className="kz-input" valor={u.rol || null} onCommit={setC('rol', 'el cargo')} placeholder="Jefe de contabilidad" /></td>
                    <td><Entrada id={'pt-' + u.id + '-departamento'} aria-label="Área" className="kz-input" valor={u.departamento || null} onCommit={setC('departamento', 'el área')} placeholder="Contabilidad" /></td>
                    <td><Entrada id={'pt-' + u.id + '-correo'} aria-label="Correo" className={cx('kz-input', malCorreo && 'kz-input--error')} valor={u.correo || null} onCommit={v => setC('correo', 'el correo')(v ? String(v).trim() : '')} placeholder="nombre@empresa.co" />
                      {malCorreo && <span className="contactos__error">Revisa el correo</span>}</td>
                    <td><select id={'pt-' + u.id + '-papel'} aria-label="Papel en la aprobación" className="kz-input" value={u.papel || ''} onChange={e => setC('papel', 'el papel')(e.target.value)}>
                      {PAPELES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></td>
                    <td className="contactos__cod"><code>{codigoContacto(proc, u)}</code></td>
                    <td><button type="button" className="kz-link" onClick={() => cambiar('Quitó un contacto', p => { p.participantes.splice(i, 1); }, { ficha: true })}>Quitar</button></td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          )}
        </section>

        <section className="tarjeta">
          <div className="tarjeta__cab"><h2 className="tarjeta__t">Sesiones de entrevista</h2>
            <Boton tamano="sm" onClick={() => cambiar('Agregó una sesión', p => { p.sesiones.push({ id: uid('s'), fecha: new Date().toISOString().slice(0, 10), participantes: [], notas: '' }); }, { ficha: true })}>+ Sesión</Boton></div>
          {(proc.sesiones || []).length === 0 && <p className="vacio">Registra cada entrevista con su fecha, quién participó y tus notas.</p>}
          {(proc.sesiones || []).map((s, i) => (
            <article key={s.id} className="sesion">
              <div className="sesion__cab">
                <input id={'se-f-' + s.id} type="date" className="kz-input sesion__fecha" aria-label="Fecha de la sesión" value={s.fecha || ''} onChange={e => cambiar('Editó la fecha de una sesión', p => { p.sesiones[i].fecha = e.target.value; }, { ficha: true })} />
                <div className="chips" role="group" aria-label="Participantes de la sesión">
                  {(proc.participantes || []).filter(u => u.nombre).map(u => {
                    const on = (s.participantes || []).indexOf(u.id) >= 0;
                    return <button key={u.id} type="button" className="chip-sel" aria-pressed={on} onClick={() => cambiar('Editó los participantes de una sesión', p => { const l = p.sesiones[i].participantes; const j = l.indexOf(u.id); if (j >= 0) l.splice(j, 1); else l.push(u.id); }, { ficha: true })}>{u.nombre}</button>;
                  })}
                </div>
              </div>
              <Entrada id={'se-n-' + s.id} como="textarea" rows={5} className="kz-input kz-input--area" aria-label="Notas de la sesión" placeholder="Notas de la entrevista: qué se hace, quién, con qué, qué se entrega, qué pasa cuando algo falla…" valor={s.notas || null} onCommit={v => cambiar('Editó las notas de una sesión', p => { p.sesiones[i].notas = v || ''; }, { ficha: true })} />
              <div className="kz-row">
                {iaDisponible && <Boton tamano="sm" disabled={!s.notas} onClick={() => abrirModal({ tipo: 'notas', sesion: s.id })}>Convertir notas en actividades · IA</Boton>}
                {iaDisponible && <Boton tamano="sm" disabled={!s.notas} onClick={() => abrirModal({ tipo: 'decisionesIA', sesion: s.id })}>Buscar decisiones · IA</Boton>}
                <button type="button" className="kz-link" onClick={() => cambiar('Quitó una sesión', p => { p.sesiones.splice(i, 1); }, { ficha: true })}>Quitar sesión</button>
              </div>
            </article>
          ))}
        </section>
      </div>

      <aside className="col-lado">
        <section className="tarjeta">
          <h2 className="tarjeta__t">Revisión</h2>
          {revision && revision.errores.length > 0 && (
            <p className="revd-res"><button type="button" className="avisos__t" onClick={() => ir('diagrama')}><b>El diagrama tiene {revision.errores.length === 1 ? 'un error' : revision.errores.length + ' errores'}:</b> mientras no se corrijan, el proceso no se puede exportar.</button></p>
          )}
          {av.length === 0 && !(revision && revision.errores.length) ? <p className="vacio">Nada pendiente en esta versión.</p> : av.length === 0 ? null : (
            <ul className="avisos">{av.map((a, i) => (
              <li key={i} className={'avisos__i avisos__i--' + a.nivel}><span className="avisos__n">{NIVEL[a.nivel]}</span><button type="button" className="avisos__t" onClick={() => ir(a.tab, a.sub, { clave: a.clave, fase: a.fase })}>{a.texto}</button></li>
            ))}</ul>
          )}
        </section>
        <section className="tarjeta">
          <h2 className="tarjeta__t">Preguntas para la próxima sesión</h2>
          {abiertas.length === 0 && faltan.length === 0 && <p className="vacio">No hay preguntas abiertas.</p>}
          <ul className="preguntas">
            {(proc.preguntas || []).map((q, i) => q.resuelta ? null : (
              <li key={q.id}><label className="check"><input type="checkbox" onChange={() => cambiar('Resolvió una pregunta', p => { p.preguntas[i].resuelta = true; }, { ficha: true })} /> <span>{q.texto}</span></label>{q.origen && <span className="preguntas__o">{q.origen === 'aprobacion' ? 'Aprobación' : q.origen === 'ia' ? 'IA' : ''}</span>}</li>
            ))}
            {faltan.map(f => (
              <li key={f.clave} className="preguntas__dato"><button type="button" className="avisos__t" onClick={() => ir('actividades', 'caracterizar', { clave: f.clave })}><b className="cod">{f.codigo || 'Sin número'}</b> {f.nombre}{f.faltan.length ? ': falta ' + f.faltan.join(', ') : ': marcada como pregunta abierta'}</button></li>
            ))}
          </ul>
          <form className="kz-row" onSubmit={e => { e.preventDefault(); const t = nuevaP.trim(); if (!t) return; cambiar('Agregó una pregunta', p => { p.preguntas.push({ id: uid('q'), texto: t, origen: 'manual', resuelta: false, fecha: ahora() }); }, { ficha: true }); setNuevaP(''); }}>
            <input id="nueva-pregunta" className="kz-input" style={{ flex: 1, minWidth: 0 }} placeholder="Nueva pregunta…" value={nuevaP} onChange={e => setNuevaP(e.target.value)} />
            <Boton tamano="sm" type="submit">Agregar</Boton>
          </form>
        </section>
      </aside>
    </div>
  );
}

/* ======================= DIAGRAMA ======================= */

/* Renombrar en el diagrama cambia la captura: el diagrama nunca dice algo distinto de la ficha. */
function aplicarNombre(p, m, mapa, cambio, op) {
  const ref = mapa[cambio.id];
  if (!ref) return null;
  const t = String(cambio.texto || '').trim();
  if (ref.tipo === 'actividad') { const a = m.actividades[ref.clave]; if (a && t) { a.nombre = op.numeros ? t.replace(/^\d+\.\s*/, '') : t; return 'la actividad'; } }
  if (ref.tipo === 'decision') { const d = m.decisiones.find(x => x.clave === ref.clave); if (d && t) { d.pregunta = t; return 'la decisión'; } }
  if (ref.tipo === 'salida') { const d = m.decisiones.find(x => x.clave === ref.decision); if (d && d.salidas[ref.indice]) { d.salidas[ref.indice].condicion = t; return 'la salida'; } }
  if (ref.tipo === 'evento') { const a = m.actividades[ref.actividad]; const e = a && (a.eventos || []).find(x => x.id === ref.evento); if (e) { e.texto = t || null; return 'el evento'; } }
  if (ref.tipo === 'inicio') { p.disparador = t; return 'el inicio'; }
  if (ref.tipo === 'fase') { const f = m.fases.find(x => x.id === ref.id); if (f && t) { f.nombre = t; return 'la fase'; } }
  if (ref.tipo === 'entregable') { const a = m.actividades[ref.clave]; if (a) { a.entregable = t || null; return 'el entregable'; } }
  if (ref.tipo === 'proceso' && t) { p.nombre = t; return 'el proceso'; }
  if (ref.tipo === 'carril' && t) {
    Object.values(m.actividades).forEach(a => { const r = tieneValor(a.responsable) ? String(a.responsable) : 'Sin responsable'; if (r === ref.rol) a.responsable = t; });
    return 'el carril';
  }
  return null;
}

export function TabDiagrama({ proc, modelo, version, bloq, cambiar, avisar, ir, revision, deshacer, rehacer }) {
  const { Boton, IconoBPMN } = Kz();
  const [op, setOp] = useState({ fases: true, entregables: true, numeros: true });
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [xmlVisible, setXmlVisible] = useState(false);
  const gen = useMemo(() => generarBPMN(proc, modelo, op), [proc, modelo, op]);
  const rev = revision || { errores: [], avisos: [] };
  const genRef = useRef(gen); genRef.current = gen;
  const revRef = useRef(rev); revRef.current = rev;
  const bloqRef = useRef(bloq); bloqRef.current = bloq;
  const procRef = useRef(proc); procRef.current = proc;
  const modeloRef = useRef(modelo); modeloRef.current = modelo;
  const opRef = useRef(op); opRef.current = op;
  const cambiarRef = useRef(cambiar); cambiarRef.current = cambiar;
  const avisarRef = useRef(avisar); avisarRef.current = avisar;
  const deshacerRef = useRef(deshacer); deshacerRef.current = deshacer;
  const rehacerRef = useRef(rehacer); rehacerRef.current = rehacer;
  const irRef = useRef(null); irRef.current = ref => { const k = ref.clave && ref.tipo === 'actividad' ? ref.clave : ref.actividad || (modelo.decisiones.find(d => d.clave === ref.clave) || {}).origen; if (k) ir('actividades', 'caracterizar', { clave: k }); };
  const cont = useRef(null);
  const visor = useRef(null);
  const importando = useRef(false);
  const primera = useRef(true);
  const temporizador = useRef(null);
  const pendienteEdicion = useRef(false);
  const enfocar = useRef(null);
  const nuevasEditadas = () => ({ rutas: new Set(), etiquetas: new Set(), soltadas: new Set(), movidas: new Set(), reemplazos: {} });
  const editadas = useRef(nuevasEditadas());
  const nombres = useRef([]);

  /* Lo que se hizo en el lienzo pasa a la captura: estructura (sincronizar), ajustes del dibujo,
     cambios de carril y nombres. Espera a que se termine de escribir un nombre. */
  const guardarAjustes = () => {
    const mod = visor.current, g = genRef.current;
    if (!mod || !g || !g.geo || bloqRef.current || importando.current) return;
    const de = mod.get('directEditing');
    if (de && de.isActive()) { pendienteEdicion.current = true; return; }
    pendienteEdicion.current = false;
    const m0 = modeloRef.current;
    const ed = editadas.current;
    const foto = fotoLienzo(mod, ed.reemplazos);
    const { ajustes, cambiosCarril } = leerAjustes(mod, g, m0.diagrama || {}, ed);
    const origDe = id => { let x = id, n = 0; while (ed.reemplazos[x] && n++ < 30) x = ed.reemplazos[x]; return x; };
    const ns = nombres.current.splice(0).map(n => ({ id: origDe(n.id), texto: n.texto }));
    // Prueba en seco para saber qué cambió y avisar; el cambio real va dentro de «cambiar» (deshacer).
    const seco = sincronizar(clonar(procRef.current), clonar(m0), g, foto);
    const antes = JSON.stringify(Object.assign({ formas: {}, etiquetas: {}, rutas: {}, notas: [] }, m0.diagrama || {}));
    editadas.current = nuevasEditadas();
    if (seco.mensajes.length) avisarRef.current(seco.mensajes.join(' '));
    if (!seco.hechos.length && JSON.stringify(ajustes) === antes && !cambiosCarril.length && !ns.length) return;
    const etiqueta = seco.hechos.length ? seco.hechos[0] + (seco.hechos.length > 1 ? ' y ' + (seco.hechos.length - 1) + (seco.hechos.length === 2 ? ' cambio más' : ' cambios más') : '') + ' en el diagrama'
      : ns.length ? 'Renombró en el diagrama' : cambiosCarril.length ? 'Cambió de carril en el diagrama' : 'Ajustó el diagrama';
    const que = [];
    cambiarRef.current(etiqueta, (p, m) => {
      const r = sincronizar(p, m, g, foto);
      ajustes.notas.forEach(n => { if (n.ancla && r.nuevos[n.ancla]) n.ancla = r.nuevos[n.ancla]; });
      m.diagrama = ajustes;
      cambiosCarril.forEach(c => { const a = m.actividades[c.clave]; if (a) { a.responsable = c.rol === 'Sin responsable' ? null : c.rol; que.push('«' + a.nombre + '» ahora la hace «' + c.rol + '»'); } });
      ns.forEach(n => aplicarNombre(p, m, g.mapa, n, opRef.current));
      enfocar.current = r.enfocar;
    });
    if (que.length && !seco.mensajes.length) avisarRef.current(que.join('; ') + '.');
  };
  const guardarRef = useRef(guardarAjustes); guardarRef.current = guardarAjustes;

  useEffect(() => {
    if (!window.BpmnJS) { setErr('No se pudo cargar el editor BPMN. Revisa tu conexión y recarga la página.'); return undefined; }
    const mod = crearModeler(cont.current, {
      soloLectura: () => bloqRef.current, mapa: () => (genRef.current && genRef.current.mapa) || {}, abrirFicha: ref => irRef.current(ref),
      deshacer: () => deshacerRef.current && deshacerRef.current(), rehacer: () => rehacerRef.current && rehacerRef.current(),
    }, null, cont.current);
    visor.current = mod;
    if (window.__KZ_PRUEBA) window.__kzModeler = mod;   // solo para las pruebas automáticas
    const eb = mod.get('eventBus');
    const soltar = s => { editadas.current.movidas.add(s.id); (s.incoming || []).concat(s.outgoing || []).forEach(c => editadas.current.soltadas.add(c.id)); (s.attachers || []).forEach(soltar); };
    eb.on('commandStack.connection.updateWaypoints.executed', e => { if (e.context && e.context.connection) editadas.current.rutas.add(e.context.connection.id); });
    eb.on('commandStack.elements.move.executed', e => { ((e.context && e.context.shapes) || []).forEach(s => { if (s.type === 'label' && s.labelTarget) editadas.current.etiquetas.add(s.labelTarget.id); else soltar(s); }); });
    eb.on('commandStack.shape.resize.executed', e => { if (e.context && e.context.shape) soltar(e.context.shape); });
    eb.on('commandStack.shape.replace.postExecuted', e => { const c = e.context || {}; if (c.oldShape && c.newShape) editadas.current.reemplazos[c.newShape.id] = c.oldShape.id; });
    eb.on('commandStack.element.updateLabel.executed', e => {
      const el = e.context && e.context.element;
      if (!el) return;
      const id = el.type === 'label' && el.labelTarget ? el.labelTarget.id : el.id;
      if (el.type !== 'bpmn:TextAnnotation') nombres.current.push({ id, texto: e.context.newLabel });
    });
    eb.on('commandStack.changed', () => {
      if (importando.current) return;
      clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => guardarRef.current(), 260);
    });
    const alTerminarDeEscribir = () => { if (pendienteEdicion.current) { clearTimeout(temporizador.current); temporizador.current = setTimeout(() => guardarRef.current(), 60); } };
    eb.on('directEditing.complete', alTerminarDeEscribir);
    eb.on('directEditing.cancel', alTerminarDeEscribir);
    // Un clic fuera del lienzo también termina de renombrar.
    const fuera = e => {
      const de = visor.current && visor.current.get('directEditing');
      if (de && de.isActive() && cont.current && !cont.current.contains(e.target)) de.complete();
    };
    document.addEventListener('pointerdown', fuera, true);
    return () => { document.removeEventListener('pointerdown', fuera, true); clearTimeout(temporizador.current); mod.destroy(); visor.current = null; };
  }, []);

  useEffect(() => {
    const v = visor.current;
    if (!v || !gen.xml) return undefined;
    let vivo = true;
    const canvas = v.get('canvas');
    const vb = primera.current ? null : canvas.viewbox();
    importando.current = true;
    v.importXML(gen.xml).then(() => {
      if (!vivo) return;
      setErr('');
      if (vb) canvas.viewbox({ x: vb.x, y: vb.y, width: vb.width, height: vb.height });
      else canvas.zoom('fit-viewport', 'auto');
      primera.current = false;
      Object.keys(gen.marcas).forEach(k => gen.marcas[k].forEach(id => { try { canvas.addMarker(id, 'kz-m-' + k); } catch (e) { /* elemento ausente */ } }));
      marcarErrores();
      const foco = enfocar.current;
      enfocar.current = null;
      if (foco) { const el = v.get('elementRegistry').get(foco); if (el) v.get('selection').select(el); }
    }).catch(e => { if (vivo) setErr('El diagrama no se pudo dibujar: ' + (e && e.message ? e.message : 'error desconocido') + '.'); })
      .then(() => { importando.current = false; });
    return () => { vivo = false; };
  }, [gen.xml]);

  /* Las formas con errores se marcan en rojo en el lienzo. */
  const marcados = useRef([]);
  const marcarErrores = () => {
    const v = visor.current;
    if (!v) return;
    const canvas = v.get('canvas'), reg = v.get('elementRegistry');
    marcados.current.forEach(id => { try { canvas.removeMarker(id, 'kz-m-error'); } catch (e) { /* ya no está */ } });
    marcados.current = [];
    revRef.current.errores.forEach(x => (x.ids || []).forEach(id => { if (reg.get(id) && marcados.current.indexOf(id) < 0) { canvas.addMarker(id, 'kz-m-error'); marcados.current.push(id); } }));
  };
  useEffect(() => { if (!importando.current) marcarErrores(); }, [rev]);

  const zoom = f => { const v = visor.current; if (!v) return; const c = v.get('canvas'); if (f === 0) c.zoom('fit-viewport', 'auto'); else c.zoom(c.zoom() * f); };
  const mostrar = ids => {
    const v = visor.current;
    if (!v || !ids || !ids.length) return;
    const reg = v.get('elementRegistry');
    const els = ids.map(id => reg.get(id)).filter(Boolean);
    if (!els.length) return;
    v.get('selection').select(els);
    const c = v.get('canvas'), vb = c.viewbox();
    const b = els.reduce((r, e) => { const x2 = e.waypoints ? Math.max.apply(null, e.waypoints.map(p => p.x)) : e.x + e.width; const x1 = e.waypoints ? Math.min.apply(null, e.waypoints.map(p => p.x)) : e.x;
      const y2 = e.waypoints ? Math.max.apply(null, e.waypoints.map(p => p.y)) : e.y + e.height; const y1 = e.waypoints ? Math.min.apply(null, e.waypoints.map(p => p.y)) : e.y;
      return { x1: Math.min(r.x1, x1), y1: Math.min(r.y1, y1), x2: Math.max(r.x2, x2), y2: Math.max(r.y2, y2) }; }, { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity });
    c.viewbox({ x: (b.x1 + b.x2) / 2 - vb.width / 2, y: (b.y1 + b.y2) / 2 - vb.height / 2, width: vb.width, height: vb.height });
    if (cont.current) cont.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  const irAProblema = x => { if (x.ir && x.ir.tab && x.ir.tab !== 'diagrama') ir(x.ir.tab, x.ir.sub, { clave: x.ir.clave }); else mostrar(x.ids); };
  const base = nombreArchivo(proc.nombre) + '-' + (version === 'tobe' ? 'to-be' : 'as-is') + '-v' + modelo.numero;
  const bloqueado = rev.errores.length > 0;
  const bajar = async (filename, data) => { setMsg(''); const r = await descargar(filename, data); if (r.ok) setMsg('Archivo entregado: ' + r.nombre + '.'); else if (r.msg) setMsg(r.msg); };
  const exportarBpmn = () => gen.xml && !bloqueado && bajar(base + '.bpmn', gen.xml);
  const exportarSvg = async () => { if (!visor.current || bloqueado) return; try { const { svg } = await visor.current.saveSVG(); bajar(base + '.svg', svg); } catch (e) { setMsg('No se pudo generar el SVG.'); } };
  const copiar = () => {
    if (!gen.xml || bloqueado) return;
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(gen.xml).then(() => setMsg('XML copiado. Pégalo en un archivo .bpmn para abrirlo en Bizagi u otra herramienta.'), () => setXmlVisible(true));
    else setXmlVisible(true);
  };
  const ajustado = modelo.diagrama && (Object.keys(modelo.diagrama.formas || {}).length || Object.keys(modelo.diagrama.rutas || {}).length || Object.keys(modelo.diagrama.etiquetas || {}).length);
  const tog = k => <label className="check"><input type="checkbox" checked={op[k]} onChange={e => setOp(Object.assign({}, op, { [k]: e.target.checked }))} /> {{ fases: 'Fases como grupos', entregables: 'Entregables', numeros: 'Números en tareas' }[k]}</label>;
  return (
    <div className="diagrama">
      <div className="barra">
        {tog('fases')}{tog('entregables')}{tog('numeros')}
        <span className="barra__sep" />
        {!bloq && ajustado ? <Boton tamano="sm" onClick={() => cambiar('Restableció el diseño automático', (p, m) => { m.diagrama = { notas: (m.diagrama && m.diagrama.notas) || [] }; })}>Restablecer diseño</Boton> : null}
        <Boton tamano="sm" disabled={!gen.xml || bloqueado} onClick={exportarBpmn}>Exportar .bpmn</Boton>
        <Boton tamano="sm" disabled={!gen.xml || bloqueado} onClick={exportarSvg}>Exportar SVG</Boton>
        <Boton tamano="sm" disabled={!gen.xml || bloqueado} onClick={copiar}>Copiar XML</Boton>
      </div>
      <p className="nota">{bloq ? 'Versión bloqueada: el diagrama se puede ver pero no editar.' : 'Herramientas de bpmn.io: lo que dibujas llega a la ficha. Una decisión o un evento quedan en la actividad anterior; una tarea nueva es una actividad en su fase. Pasar una tarea a otro carril cambia su responsable. Doble clic renombra; Ctrl+Z deshace.'}</p>
      {bloqueado && <p className="kz-field__error diagrama__bloqueo" role="status">{rev.errores.length === 1 ? 'Hay 1 error en el diagrama' : 'Hay ' + rev.errores.length + ' errores en el diagrama'}: corrígelo{rev.errores.length === 1 ? '' : 's'} para exportar el proceso.</p>}
      {msg && <p className="nota" role="status">{msg}</p>}
      {xmlVisible && <textarea className="kz-input kz-input--area xml" readOnly rows={8} value={gen.xml || ''} onFocus={e => e.target.select()} aria-label="XML BPMN" />}
      <div className={cx('lienzo-wrap', bloq && 'lienzo-wrap--lectura')}>
        <div className="lienzo" ref={cont} tabIndex={0} aria-label="Diagrama BPMN del proceso" />
        {!gen.xml && <div className="lienzo__vacio">{gen.avisos[0] && gen.avisos[0].texto}</div>}
        {err && <div className="lienzo__vacio">{err}</div>}
        <div className="lienzo__zoom"><button type="button" className="kz-icon-btn" aria-label="Acercar" onClick={() => zoom(1.25)}>+</button><button type="button" className="kz-icon-btn" aria-label="Alejar" onClick={() => zoom(0.8)}>−</button><button type="button" className="kz-btn kz-btn--sm" onClick={() => zoom(0)}>Ajustar</button></div>
      </div>
      <div className="leyenda">
        <span><IconoBPMN nombre="persona" tamano={14} /> Persona</span><span><IconoBPMN nombre="sistema" tamano={14} /> Sistema</span><span><IconoBPMN nombre="automatizacion" tamano={14} /> IA o automatización</span><span><IconoBPMN nombre="hoja" tamano={14} /> Con formatos</span>
        <span><i className="ley ley--ia" /> Sugerencia IA</span><span><i className="ley ley--q" /> Pregunta abierta</span><span><i className="ley ley--error" /> Con error</span>
        {gen.resumen && <span className="leyenda__r">{gen.resumen.tareas} tareas · {gen.resumen.compuertas} compuertas · {gen.resumen.eventos} eventos · {gen.resumen.carriles} carriles{gen.resumen.fases ? ' · ' + gen.resumen.fases + ' fases' : ''}{gen.resumen.externos ? ' · ' + gen.resumen.externos + ' externos' : ''}</span>}
      </div>
      <RevisionDiagrama rev={rev} onIr={irAProblema} />
    </div>
  );
}

/* La revisión del diagrama: errores (bloquean la exportación) y avisos. */
export function RevisionDiagrama({ rev, onIr, compacta }) {
  const { errores, avisos } = rev || { errores: [], avisos: [] };
  if (!errores.length && !avisos.length) return compacta ? null : <section className="tarjeta revd revd--ok"><h2 className="tarjeta__t">Revisión del diagrama</h2><p className="revd__ok">✓ Sin errores: el proceso se puede exportar.</p></section>;
  const fila = (x, i, tipo) => (
    <li key={tipo + i} className={'revd__i revd__i--' + tipo}>
      <span className="revd__n">{tipo === 'error' ? 'Error' : 'Aviso'}</span>
      {onIr ? <button type="button" className="revd__t" onClick={() => onIr(x)}>{x.texto}</button> : <span className="revd__t">{x.texto}</span>}
    </li>
  );
  return (
    <section className={cx('tarjeta revd', compacta && 'revd--compacta')} aria-label="Revisión del diagrama">
      <h2 className="tarjeta__t">Revisión del diagrama<span className="revd__cuenta">{errores.length ? (errores.length === 1 ? '1 error' : errores.length + ' errores') : 'sin errores'}{avisos.length ? ' · ' + (avisos.length === 1 ? '1 aviso' : avisos.length + ' avisos') : ''}</span></h2>
      {errores.length > 0 && <p className="nota">Mientras haya errores no se puede exportar el proceso (Word, .bpmn, SVG ni XML).</p>}
      <ul className="revd__l">{errores.map((x, i) => fila(x, i, 'error'))}{(compacta ? [] : avisos).map((x, i) => fila(x, i, 'aviso'))}</ul>
    </section>
  );
}

/* ======================= MODALES DE IA Y PEGAR ======================= */

export function ModalPegar({ modelo, destinoInicial, cambiar, onCerrar }) {
  const { Boton } = Kz();
  const [texto, setTexto] = useState('');
  const [destino, setDestino] = useState(destinoInicial || '__sin');
  const lineas = texto.split(/\r?\n/).map(s => s.replace(/^\s*(?:[-*•·]|\d+[.)-])\s*/, '').trim()).filter(Boolean);
  const agregar = () => { cambiar('Agregó ' + lineas.length + ' actividades', (p, m) => { lineas.forEach(n => { const a = nuevaActividad(n); m.actividades[a.clave] = a; ponerEnFase(m, a.clave, destino); }); }); onCerrar(); };
  return (
    <Modal titulo="Pegar una lista de actividades" onCerrar={onCerrar} pie={<Fragment><Boton variante="primario" disabled={!lineas.length} onClick={agregar}>Agregar {lineas.length || ''} actividades</Boton><Boton onClick={onCerrar}>Cancelar</Boton></Fragment>}>
      <p className="texto">Una actividad por línea. Se quitan viñetas y numeración.</p>
      <textarea id="pegar-lista" className="kz-input kz-input--area" rows={10} value={texto} onChange={e => setTexto(e.target.value)} placeholder={'Recibir solicitud\nValidar documentos\nRegistrar en el sistema'} />
      <label className="barra__f">Agregar a <select id="pegar-destino" className="kz-input" value={destino} onChange={e => setDestino(e.target.value)}><option value="__sin">Sin fase</option>{modelo.fases.map(f => <option key={f.id} value={f.id}>{f.nombre} (al final)</option>)}</select></label>
    </Modal>
  );
}

function usarIA() {
  const [estado, setEstado] = useState({ fase: 'listo' });
  const ctl = useRef(null);
  useEffect(() => () => ctl.current && ctl.current.abort(), []);
  const pedir = async prompt => {
    const sample = await usar('sample');
    if (!sample) { setEstado({ fase: 'error', msg: 'La IA no está disponible en esta vista.' }); return null; }
    ctl.current = new AbortController();
    setEstado({ fase: 'pensando' });
    try {
      const r = await sample.json(prompt, { signal: ctl.current.signal, modelTier: 'default' });
      setEstado({ fase: 'listo' });
      return r;
    } catch (e) {
      setEstado(e && e.code === 'cancelled' ? { fase: 'listo' } : { fase: 'error', msg: textoErrorIA(e) });
      return null;
    }
  };
  return { estado, pedir, parar: () => ctl.current && ctl.current.abort() };
}

const nuloSiVacio = v => (v == null || String(v).trim() === '' ? null : v);

export function ModalNotasIA({ proc, modelo, sesionId, cambiar, onCerrar }) {
  const { Boton } = Kz();
  const sesion = (proc.sesiones || []).find(s => s.id === sesionId);
  const [notas, setNotas] = useState(sesion ? sesion.notas || '' : '');
  const [res, setRes] = useState(null);
  const [sel, setSel] = useState({});
  const [selQ, setSelQ] = useState({});
  const ia = usarIA();
  const fuente = sesion ? 'Entrevista ' + fechaCorta(sesion.fecha) : 'Notas';
  const convertir = async () => {
    const existentes = Object.values(modelo.actividades).map(a => a.nombre);
    const r = await ia.pedir(promptActividades(proc, notas, existentes));
    if (!r) return;
    const acts = Array.isArray(r.actividades) ? r.actividades.filter(a => a && a.nombre) : [];
    const qs = Array.isArray(r.preguntas) ? r.preguntas.filter(q => typeof q === 'string') : [];
    setRes({ acts, qs });
    const s = {}; acts.forEach((a, i) => { s[i] = true; }); setSel(s);
    const t = {}; qs.forEach((q, i) => { t[i] = true; }); setSelQ(t);
  };
  const agregar = () => {
    const elegidas = res.acts.filter((a, i) => sel[i]);
    const qs = res.qs.filter((q, i) => selQ[i]);
    cambiar('Agregó ' + elegidas.length + ' sugerencias de la IA', (p, m) => {
      elegidas.forEach(x => {
        const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
        const a = nuevaActividad(String(x.nombre).slice(0, 120), {
          descripcion: nuloSiVacio(x.descripcion), responsable: nuloSiVacio(x.responsable), entradas: nuloSiVacio(x.entradas),
          entregable: nuloSiVacio(x.entregable), receptor: nuloSiVacio(x.receptor), herramientas: nuloSiVacio(x.herramientas),
          tProceso: num(x.tProceso), tEspera: num(x.tEspera), unidad: ['min', 'h', 'días'].indexOf(x.unidad) >= 0 ? x.unidad : 'h',
          frecuencia: nuloSiVacio(x.frecuencia), evidencia: nuloSiVacio(x.evidencia), fuente, estado: 'sugerencia',
        });
        m.actividades[a.clave] = a; m.sinFase.push(a.clave);
      });
      qs.forEach(q => p.preguntas.push({ id: uid('q'), texto: q, origen: 'ia', resuelta: false, fecha: ahora() }));
    });
    onCerrar();
  };
  const n = res ? res.acts.filter((a, i) => sel[i]).length : 0;
  return (
    <Modal titulo="Convertir notas en actividades" onCerrar={onCerrar} ancho={820}
      pie={res ? <Fragment><Boton variante="primario" disabled={!n && !Object.values(selQ).some(Boolean)} onClick={agregar}>Agregar {n} como sugerencia</Boton><Boton onClick={() => setRes(null)}>Volver a las notas</Boton></Fragment>
        : <Fragment><Boton variante="primario" disabled={!notas.trim() || ia.estado.fase === 'pensando'} onClick={convertir}>Convertir</Boton><Boton onClick={onCerrar}>Cancelar</Boton></Fragment>}>
      {!res && (
        <Fragment>
          <p className="texto">Claude propone un borrador a partir de tus notas. Todo entra como <b>sugerencia</b> en «Sin fase»: no inventa responsables, reglas, tiempos ni conexiones; lo que no está en las notas queda vacío.</p>
          <textarea id="ia-notas" className="kz-input kz-input--area" rows={12} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Pega aquí las notas de la entrevista…" />
          {ia.estado.fase === 'pensando' && <Pensando texto="Leyendo las notas… puede tardar hasta un minuto." onParar={ia.parar} />}
          {ia.estado.fase === 'error' && <p className="kz-field__error">{ia.estado.msg}</p>}
        </Fragment>
      )}
      {res && (
        <Fragment>
          {res.acts.length === 0 && <p className="vacio">No encontró actividades nuevas en estas notas.</p>}
          <ul className="res-ia">{res.acts.map((a, i) => (
            <li key={i} className="res-ia__i">
              <label className="check"><input type="checkbox" checked={!!sel[i]} onChange={e => setSel(Object.assign({}, sel, { [i]: e.target.checked }))} /> <b>{a.nombre}</b></label>
              <div className="res-ia__campos">{['responsable', 'entregable', 'receptor', 'herramientas', 'tProceso', 'tEspera', 'frecuencia'].filter(k => a[k] != null && a[k] !== '').map(k => <span key={k} className="kz-tag">{{ responsable: 'Responsable', entregable: 'Entrega', receptor: 'Recibe', herramientas: 'Usa', tProceso: 'Proceso', tEspera: 'Espera', frecuencia: 'Frecuencia' }[k]}: {String(a[k])}{(k === 'tProceso' || k === 'tEspera') ? ' ' + (a.unidad || 'h') : ''}</span>)}</div>
              {a.evidencia && <q className="res-ia__ev">{a.evidencia}</q>}
            </li>
          ))}</ul>
          {res.qs.length > 0 && (
            <Fragment><h3 className="kz-label">Preguntas para la próxima sesión</h3>
              <ul className="res-ia">{res.qs.map((q, i) => <li key={i}><label className="check"><input type="checkbox" checked={!!selQ[i]} onChange={e => setSelQ(Object.assign({}, selQ, { [i]: e.target.checked }))} /> {q}</label></li>)}</ul>
            </Fragment>
          )}
        </Fragment>
      )}
    </Modal>
  );
}

export function ModalDecisionesIA({ proc, modelo, sesionId, cambiar, onCerrar }) {
  const { Boton, TarjetaDecision } = Kz();
  const sesion = (proc.sesiones || []).find(s => s.id === sesionId);
  const todas = (proc.sesiones || []).map(s => s.notas || '').filter(Boolean).join('\n\n---\n\n');
  const [notas, setNotas] = useState(sesion ? sesion.notas || '' : todas);
  const [res, setRes] = useState(null);
  const [sel, setSel] = useState({});
  const ia = usarIA();
  const seq = secuencia(modelo);
  const validas = {}; seq.forEach(s => { validas[s.clave] = true; });
  const buscar = async () => {
    const r = await ia.pedir(promptDecisiones(proc, notas, seq));
    if (!r) return;
    const ds = (Array.isArray(r.decisiones) ? r.decisiones : []).filter(d => d && d.pregunta).map(d => ({
      pregunta: String(d.pregunta), origen: validas[d.origen] ? d.origen : null, decide: nuloSiVacio(d.decide),
      tipo: ['exclusiva', 'inclusiva', 'paralela'].indexOf(d.tipo) >= 0 ? d.tipo : 'exclusiva', evidencia: nuloSiVacio(d.evidencia),
      salidas: (Array.isArray(d.salidas) ? d.salidas : []).map((s, i) => ({ condicion: String((s && s.condicion) || ''), destino: s && (s.destino === '__fin' || validas[s.destino]) ? s.destino : null,
        porDefecto: i === 0, clase: s && ['retrabajo', 'rechazo', 'cancelacion', 'excepcion'].indexOf(s.clase) >= 0 ? s.clase : null })),
    }));
    setRes(ds);
    const s = {}; ds.forEach((d, i) => { s[i] = true; }); setSel(s);
  };
  const agregar = () => {
    const elegidas = res.filter((d, i) => sel[i]);
    cambiar('Agregó ' + elegidas.length + ' decisiones sugeridas', (p, m) => {
      elegidas.forEach(d => { const f = d.origen ? faseDe(m, d.origen) : null; m.decisiones.push(nuevaDecision(Object.assign({}, d, { estado: 'sugerencia', contexto: { faseOrigen: f ? f.id : null } }))); });
    });
    onCerrar();
  };
  return (
    <Modal titulo="Buscar decisiones en las notas" onCerrar={onCerrar} ancho={820}
      pie={res ? <Fragment><Boton variante="primario" disabled={!res.some((d, i) => sel[i])} onClick={agregar}>Agregar como sugerencia</Boton><Boton onClick={() => setRes(null)}>Volver a las notas</Boton></Fragment>
        : <Fragment><Boton variante="primario" disabled={!notas.trim() || !seq.some(s => s.numero != null) || ia.estado.fase === 'pensando'} onClick={buscar}>Buscar</Boton><Boton onClick={onCerrar}>Cancelar</Boton></Fragment>}>
      {!res && (
        <Fragment>
          <p className="texto">Claude busca puntos donde el camino depende de una condición y los asocia solo a actividades que ya existen. Entran como sugerencia; revisa cada una.</p>
          {!seq.some(s => s.numero != null) && <Aviso tono="alerta">Primero ubica actividades en fases: las decisiones se enganchan a la secuencia.</Aviso>}
          <textarea id="ia-notas-d" className="kz-input kz-input--area" rows={12} value={notas} onChange={e => setNotas(e.target.value)} />
          {ia.estado.fase === 'pensando' && <Pensando texto="Buscando decisiones… puede tardar hasta un minuto." onParar={ia.parar} />}
          {ia.estado.fase === 'error' && <p className="kz-field__error">{ia.estado.msg}</p>}
        </Fragment>
      )}
      {res && (
        <Fragment>
          {res.length === 0 && <p className="vacio">No encontró decisiones explícitas en estas notas.</p>}
          {res.map((d, i) => (
            <div key={i} className="res-ia__dec">
              <label className="check"><input type="checkbox" checked={!!sel[i]} onChange={e => setSel(Object.assign({}, sel, { [i]: e.target.checked }))} /> Agregar esta decisión</label>
              <TarjetaDecision {...d} estado="sugerencia" secuencia={seq} />
              {d.evidencia && <q className="res-ia__ev">{d.evidencia}</q>}
            </div>
          ))}
        </Fragment>
      )}
    </Modal>
  );
}
