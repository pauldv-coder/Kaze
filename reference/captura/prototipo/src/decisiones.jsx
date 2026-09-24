/* Decisiones: viven al final de la ficha de su actividad de origen. Las que perdieron su
   origen (se borró la actividad o nunca se dijo) se ubican desde «Decisiones por ubicar». */
import { secuencia, faseDe, nuevaDecision, clonar, tieneValor } from './model.js';
import { Kz, Entrada, Campo, Aviso, Confirmar } from './ui.jsx';

const React = window.React;
const { useState, Fragment } = React;

const TIPOS = [['exclusiva', 'Solo uno de los caminos'], ['inclusiva', 'Uno o varios, según el caso'], ['paralela', 'Todos a la vez']];
const CLASES = [['', 'Normal'], ['retrabajo', 'Retrabajo'], ['rechazo', 'Rechazo'], ['cancelacion', 'Cancelación'], ['excepcion', 'Excepción']];

export function EditorDecision({ inicial, seq, onGuardar, onCancelar, foco, idp = 'ed' }) {
  const { Boton } = Kz();
  const [d, setD] = useState(() => clonar(inicial));
  const [error, setError] = useState('');
  const upd = fn => setD(x => { const y = clonar(x); fn(y); return y; });
  const opcionesAct = seq.map(s => <option key={s.clave} value={s.clave}>{(s.codigo || 'Sin fase') + ' · ' + s.nombre}</option>);
  const id = x => idp + '-' + x;
  const guardar = e => {
    e.preventDefault();
    if (!String(d.pregunta || '').trim()) { setError('Escribe la pregunta que se decide.'); return; }
    if (!d.salidas.length) { setError('Agrega al menos una salida.'); return; }
    onGuardar(d);
  };
  return (
    <form className="editor-dec" onSubmit={guardar} aria-label="Editar decisión">
      <Campo id={id('preg')} etiqueta="¿Qué se decide?" modo="texto" tri={false} valor={d.pregunta || null} onCommit={v => upd(x => { x.pregunta = v || ''; })} ayuda="En palabras del entrevistado: «¿La solicitud está completa?»" />
      <div className="rejilla-2">
        <div className="campo"><label className="campo__rot" htmlFor={id('orig')}>¿Después de qué actividad?</label>
          <select id={id('orig')} className="kz-input" autoFocus={foco === 'origen'} value={d.origen || ''} onChange={e => upd(x => { x.origen = e.target.value || null; })}><option value="">Aún no se sabe</option>{opcionesAct}</select></div>
        <Campo id={id('dec')} etiqueta="¿Quién o qué sistema decide?" valor={d.decide} onCommit={v => upd(x => { x.decide = v; })} />
      </div>
      <fieldset className="campo tipo-dec"><legend className="campo__rot">¿Qué puede pasar?</legend>
        {TIPOS.map(t => <label key={t[0]} className="check"><input type="radio" name={id('tipo')} checked={d.tipo === t[0]} onChange={() => upd(x => { x.tipo = t[0]; })} /> {t[1]}</label>)}
      </fieldset>
      <div className="campo">
        <span className="campo__rot">Salidas</span>
        <div className="tabla-scroll"><table className="lista-simple salidas">
          <thead><tr><th>Si…</th><th>entonces sigue</th><th>Tipo</th>{d.tipo !== 'paralela' && <th>Por defecto</th>}<th><span className="kz-sr">Quitar</span></th></tr></thead>
          <tbody>{d.salidas.map((s, i) => (
            <tr key={i}>
              <td><Entrada id={id('c' + i)} aria-label="Condición" className="kz-input" valor={s.condicion || null} autoFocus={foco === 'salida' + i} onCommit={v => upd(x => { x.salidas[i].condicion = v || ''; })} placeholder="Está completa" /></td>
              <td><select id={id('d' + i)} aria-label="Siguiente actividad" className="kz-input" value={s.destino || ''} onChange={e => upd(x => { x.salidas[i].destino = e.target.value || null; })}>
                <option value="">Aún no se sabe</option>{opcionesAct}<option value="__fin">Termina el proceso</option></select></td>
              <td><select id={id('k' + i)} aria-label="Tipo de salida" className="kz-input" value={s.clase || ''} onChange={e => upd(x => { x.salidas[i].clase = e.target.value || null; })}>{CLASES.map(c => <option key={c[0]} value={c[0]}>{c[1]}</option>)}</select></td>
              {d.tipo !== 'paralela' && <td className="centro"><input type="radio" name={id('def')} aria-label="Salida por defecto" checked={!!s.porDefecto} onChange={() => upd(x => { x.salidas.forEach((y, j) => { y.porDefecto = j === i; }); })} /></td>}
              <td><button type="button" className="kz-link" onClick={() => upd(x => { x.salidas.splice(i, 1); })}>Quitar</button></td>
            </tr>
          ))}</tbody>
        </table></div>
        <div><Boton tamano="sm" type="button" onClick={() => upd(x => { x.salidas.push({ condicion: '', destino: null, porDefecto: false, clase: null }); })}>+ Salida</Boton></div>
      </div>
      <div className="segmento" role="group" aria-label="Estado de confirmación">
        <button type="button" aria-pressed={d.estado !== 'pregunta'} onClick={() => upd(x => { x.estado = 'confirmado'; })}>Confirmada</button>
        <button type="button" aria-pressed={d.estado === 'pregunta'} onClick={() => upd(x => { x.estado = 'pregunta'; })}>Pregunta abierta</button>
      </div>
      {error && <p className="kz-field__error">{error}</p>}
      <div className="kz-row"><Boton variante="primario" type="submit">Guardar decisión</Boton><Boton type="button" onClick={onCancelar}>Cancelar</Boton></div>
    </form>
  );
}

function guardarDecision(cambiar, d, nueva) {
  cambiar(nueva ? 'Agregó la decisión «' + d.pregunta + '»' : 'Editó la decisión «' + d.pregunta + '»', (p, m) => {
    const f = d.origen ? faseDe(m, d.origen) : null;
    const limpio = Object.assign(clonar(d), { contexto: { faseOrigen: f ? f.id : null }, aceptados: [], estado: d.estado === 'sugerencia' ? 'confirmado' : d.estado });
    const i = m.decisiones.findIndex(x => x.clave === d.clave);
    if (i >= 0) m.decisiones[i] = limpio; else m.decisiones.push(limpio);
  });
}

/* Una decisión con sus acciones: aceptar si la sugirió la IA, revisar, editar, eliminar. */
function ItemDecision({ d, seq, bloq, cambiar, editando, onEditar, onFinEdicion, idp }) {
  const { Boton, TarjetaDecision } = Kz();
  const [borrar, setBorrar] = useState(false);
  const upd = (et, fn) => cambiar(et, (p, m) => { const x = m.decisiones.find(y => y.clave === d.clave); if (x) fn(x, m); });
  if (editando) {
    return <EditorDecision idp={idp} inicial={d} seq={seq} foco={editando.foco}
      onGuardar={x => { guardarDecision(cambiar, x, false); onFinEdicion(); }} onCancelar={onFinEdicion} />;
  }
  return (
    <div className="dec-item">
      {d.estado === 'sugerencia' && (
        <Aviso tono="ia" acciones={!bloq && [<Boton key="a" tamano="sm" variante="primario" onClick={() => upd('Aceptó la decisión sugerida', (x, m) => { x.estado = 'confirmado'; const f = x.origen ? faseDe(m, x.origen) : null; x.contexto = { faseOrigen: f ? f.id : null }; })}>Aceptar</Boton>,
          <Boton key="d" tamano="sm" variante="destructivo" onClick={() => cambiar('Descartó una decisión sugerida', (p, m) => { m.decisiones = m.decisiones.filter(x => x.clave !== d.clave); })}>Descartar</Boton>]}>
          Propuesta por la IA{tieneValor(d.evidencia) ? <Fragment>, a partir de: <q>{d.evidencia}</q></Fragment> : '.'}
        </Aviso>
      )}
      {borrar && <Confirmar texto={'¿Eliminar la decisión «' + d.pregunta + '»?'} onSi={() => { cambiar('Eliminó la decisión «' + d.pregunta + '»', (p, m) => { m.decisiones = m.decisiones.filter(x => x.clave !== d.clave); }); setBorrar(false); }} onNo={() => setBorrar(false)} />}
      <TarjetaDecision {...d} estado={d.estado === 'sugerencia' ? 'sugerencia' : d.estado} secuencia={seq}
        onEditar={bloq ? undefined : () => onEditar({})}
        onMantener={bloq ? undefined : ids => upd('Mantuvo la decisión «' + d.pregunta + '»', x => { x.aceptados = (x.aceptados || []).concat(ids); })}
        onReasignarOrigen={bloq ? undefined : () => onEditar({ foco: 'origen' })}
        onEliminar={bloq ? undefined : () => setBorrar(true)}
        onMarcarRetrabajo={bloq ? undefined : i => upd('Marcó un retrabajo en «' + d.pregunta + '»', x => { x.salidas[i].clase = 'retrabajo'; })}
        onCambiarDestino={bloq ? undefined : i => onEditar({ foco: 'salida' + i })} />
    </div>
  );
}

/* Sección «Decisión» de la ficha: lo que pasa cuando el camino se divide después de la actividad. */
export function DecisionesDeActividad({ modelo, clave, bloq, cambiar }) {
  const { Boton } = Kz();
  const seq = secuencia(modelo);
  const lista = modelo.decisiones.filter(d => d.origen === clave);
  const [edit, setEdit] = useState(null);
  return (
    <div className="dec-ficha">
      {lista.length === 0 && !edit && (
        <div className="dec-vacia">
          <p className="nota">¿Después de esta actividad el camino se divide? Escríbelo como pregunta: «¿La solicitud está completa?». Kaze elige la compuerta.</p>
          {!bloq && <Boton tamano="sm" onClick={() => setEdit({ clave: '__nueva', d: nuevaDecision({ origen: clave }) })}>+ Agregar decisión</Boton>}
        </div>
      )}
      {edit && edit.clave === '__nueva' && (
        <EditorDecision idp={'dn-' + clave} inicial={edit.d} seq={seq}
          onGuardar={d => { guardarDecision(cambiar, d, true); setEdit(null); }} onCancelar={() => setEdit(null)} />
      )}
      {lista.length > 1 && <Aviso tono="alerta">Esta actividad tiene {lista.length} decisiones y el diagrama solo dibuja la primera: junta sus salidas en una sola.</Aviso>}
      {lista.map(d => (
        <ItemDecision key={d.clave} idp={'de-' + d.clave} d={d} seq={seq} bloq={bloq} cambiar={cambiar}
          editando={edit && edit.clave === d.clave ? edit : null}
          onEditar={op => setEdit(Object.assign({ clave: d.clave }, op))} onFinEdicion={() => setEdit(null)} />
      ))}
    </div>
  );
}

/* Decisiones cuyo origen no existe: se muestran en lugar de la ficha para ubicarlas. */
export function PanelDecisionSuelta({ modelo, claveDecision, bloq, cambiar }) {
  const seq = secuencia(modelo);
  const d = modelo.decisiones.find(x => x.clave === claveDecision);
  const [edit, setEdit] = useState(null);
  if (!d) return <div className="tarjeta"><p className="vacio">Esta decisión ya no existe o ya se ubicó.</p></div>;
  const opciones = seq.map(s => <option key={s.clave} value={s.clave}>{(s.codigo || 'Sin fase') + ' · ' + s.nombre}</option>);
  return (
    <article className="ficha" aria-labelledby="dsu-t">
      <header className="ficha__cab">
        <div className="ficha__meta"><span className="ficha__cod">Decisión por ubicar</span><span>{d.origen ? 'Su actividad de origen se eliminó.' : 'Aún no dice después de qué actividad ocurre.'}</span></div>
        <h2 className="ficha__t" id="dsu-t">{d.pregunta || 'Decisión sin pregunta'}</h2>
      </header>
      <div className="ficha__cuerpo">
        {!bloq && (
          <div className="campo"><label className="campo__rot" htmlFor="dsu-orig">Ubicarla después de</label>
            <select id="dsu-orig" className="kz-input" value="" onChange={e => { const k = e.target.value; if (!k) return; cambiar('Ubicó la decisión «' + (d.pregunta || '') + '»', (p, m) => { const x = m.decisiones.find(y => y.clave === d.clave); if (x) { x.origen = k; const f = faseDe(m, k); x.contexto = { faseOrigen: f ? f.id : null }; x.aceptados = []; } }); }}>
              <option value="">Elige una actividad…</option>{opciones}
            </select></div>
        )}
        <ItemDecision idp="dsu" d={d} seq={seq} bloq={bloq} cambiar={cambiar} editando={edit}
          onEditar={op => setEdit(Object.assign({ clave: d.clave }, op))} onFinEdicion={() => setEdit(null)} />
      </div>
    </article>
  );
}
