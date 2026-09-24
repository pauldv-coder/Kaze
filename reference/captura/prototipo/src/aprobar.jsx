/* Aprobación: visto bueno de las áreas y aprobación final, por correo y sin servidor.
   1. Se eligen las personas (contactos del Resumen) y se envía a revisión.
   2. Cada persona recibe un correo con su código y la fotografía del proceso adjunta.
   3. Su respuesta vuelve por correo; se pega aquí y el flujo avanza, o vuelve si pide cambios. */
import { avisos, fechaCorta, tieneValor, ahora } from './model.js';
import {
  PAPELES, NOMBRE_PAPEL, ETAPAS, codigoContacto, correoValido, iniciales, nuevaSolicitud, etapaEnCurso, estadoEtapa, registrarRespuesta,
  interpretarRespuesta, correoInvitacion, correoInformados, enlacesCorreo, textoCorreo,
} from './aprobacion.js';
import { armarFotografia } from './fotografia.js';
import { descargar, copiarTexto } from './util.js';
import { lista } from './lengua.js';
import { Kz, cx, Entrada, Aviso, Pensando, Confirmar } from './ui.jsx';

const React = window.React;
const { useState, useMemo, useRef, useEffect, Fragment } = React;

/* Varias personas de una lista desplegable: chips con quitar y «Agregar…». */
function SelectorPersonas({ id, etiqueta, ayuda, contactos, ids, onCambiar, disabled }) {
  const elegidos = ids.map(x => contactos.find(c => c.id === x)).filter(Boolean);
  const libres = contactos.filter(c => ids.indexOf(c.id) < 0);
  return (
    <div className="campo selper">
      <label className="campo__rot" htmlFor={id}>{etiqueta}</label>
      <div className="selper__caja">
        {elegidos.map(c => (
          <span key={c.id} className="selper__chip">
            <span>{c.nombre || 'Sin nombre'}{c.rol ? <span className="selper__cargo"> · {c.rol}</span> : null}</span>
            {!tieneValor(c.correo) && <span className="selper__falta">sin correo</span>}
            {!disabled && <button type="button" className="selper__x" aria-label={'Quitar a ' + (c.nombre || 'esta persona')} onClick={() => onCambiar(ids.filter(x => x !== c.id))}>×</button>}
          </span>
        ))}
        <select id={id} className="kz-input selper__sel" value="" disabled={disabled || !libres.length} onChange={e => { if (e.target.value) onCambiar(ids.concat([e.target.value])); }}>
          <option value="">{libres.length ? '+ Agregar…' : 'No hay más contactos'}</option>
          {libres.map(c => <option key={c.id} value={c.id}>{(c.nombre || 'Sin nombre') + (c.rol ? ' · ' + c.rol : '') + (c.papel && NOMBRE_PAPEL[c.papel] ? ' (' + NOMBRE_PAPEL[c.papel].toLowerCase() + ')' : '')}</option>)}
        </select>
      </div>
      {ayuda && <p className="campo__ayuda">{ayuda}</p>}
    </div>
  );
}

/* «Enviar correo»: el correo del equipo, Gmail u Outlook en la web, o copiarlo. */
function MenuCorreo({ correo, etiqueta, onPreparado, avisar }) {
  const ref = useRef(null);
  const l = enlacesCorreo(correo);
  const cerrar = () => { if (ref.current) ref.current.open = false; };
  const usado = () => { cerrar(); onPreparado && onPreparado(); };
  const copiar = async () => {
    const ok = await copiarTexto(textoCorreo(correo));
    usado();
    avisar && avisar(ok ? 'Correo copiado: pégalo en un mensaje nuevo y adjunta la fotografía.' : 'No se pudo copiar. Abre el correo con una de las otras opciones.');
  };
  useEffect(() => {
    const f = e => { if (ref.current && ref.current.open && !ref.current.contains(e.target)) cerrar(); };
    document.addEventListener('pointerdown', f);
    return () => document.removeEventListener('pointerdown', f);
  }, []);
  const { IconoBPMN } = Kz();
  return (
    <details className="mcorreo" ref={ref}>
      <summary className="kz-btn kz-btn--sm mcorreo__btn">{etiqueta || 'Enviar correo'}<span className="mcorreo__car" aria-hidden="true"><IconoBPMN nombre="abajo" tamano={14} /></span></summary>
      <div className="mcorreo__menu" role="menu">
        <a role="menuitem" href={l.mailto} target="_blank" rel="noopener" onClick={usado}>Abrir en mi correo</a>
        <a role="menuitem" href={l.gmail} target="_blank" rel="noopener" onClick={usado}>Abrir en Gmail</a>
        <a role="menuitem" href={l.outlook} target="_blank" rel="noopener" onClick={usado}>Abrir en Outlook</a>
        <button type="button" role="menuitem" onClick={copiar}>Copiar el correo</button>
      </div>
    </details>
  );
}

/* Registrar una respuesta que llegó sin código (en persona, por teléfono, un correo suelto). */
function RegistroManual({ etapa, persona, onRegistrar, onCancelar }) {
  const { Boton } = Kz();
  const [decision, setDecision] = useState('aprobado');
  const [coment, setComent] = useState('');
  const si = etapa.tipo === 'vobo' ? 'Dio su visto bueno' : 'Aprobó';
  const n = 'rm-' + persona.id;
  return (
    <div className="rmanual">
      <div className="segmento" role="group" aria-label={'Respuesta de ' + persona.nombre}>
        <button type="button" aria-pressed={decision === 'aprobado'} onClick={() => setDecision('aprobado')}>{si}</button>
        <button type="button" aria-pressed={decision === 'cambios'} onClick={() => setDecision('cambios')}>Pidió cambios</button>
      </div>
      <label className="campo__rot" htmlFor={n}>{decision === 'cambios' ? 'Qué pidió cambiar (obligatorio)' : 'Comentario (opcional)'}</label>
      <textarea id={n} className="kz-input kz-input--area" rows={2} value={coment} onChange={e => setComent(e.target.value)} />
      <div className="kz-row">
        <Boton tamano="sm" variante="primario" disabled={decision === 'cambios' && !coment.trim()} onClick={() => onRegistrar(decision, coment)}>Registrar</Boton>
        <Boton tamano="sm" onClick={onCancelar}>Cancelar</Boton>
      </div>
    </div>
  );
}

export function TabAprobacion({ proc, modelo, version, cambiar, revision, ir, avisar }) {
  const { Boton, PanelAprobacion } = Kz();
  const etiqueta = (version === 'tobe' ? 'To-Be' : 'As-Is') + ' v' + modelo.numero;
  const ap = modelo.aprobacion && modelo.aprobacion.etapas ? modelo.aprobacion : null;
  const contactos = proc.participantes || [];
  const conErrores = !!(revision && revision.errores.length);
  const av = avisos(proc, modelo).filter(a => a.nivel !== 'info');
  const nAct = Object.keys(modelo.actividades).length;
  const resumen = nAct + (nAct === 1 ? ' actividad' : ' actividades') + ' · ' + modelo.decisiones.length + (modelo.decisiones.length === 1 ? ' decisión' : ' decisiones');

  /* ---------- preparar el envío ---------- */
  const inicial = () => {
    // Si ya hubo un envío (pidieron cambios), se repite la misma selección.
    if (ap) {
      const v = ap.etapas.find(e => e.tipo === 'vobo'), f = ap.etapas.find(e => e.tipo === 'final');
      return { conVobo: !!v, vobo: v ? v.personas.map(x => x.id).filter(id => contactos.some(c => c.id === id)) : [], final: f ? f.personas.map(x => x.id).filter(id => contactos.some(c => c.id === id)) : [] };
    }
    const vobo = contactos.filter(c => c.papel === 'vobo').map(c => c.id);
    return { conVobo: vobo.length > 0, vobo, final: contactos.filter(c => c.papel === 'aprueba').map(c => c.id) };
  };
  const [sel, setSel] = useState(inicial);
  const remitente = proc.remitente || { nombre: '', correo: '' };
  const setRem = (c, v) => cambiar('Editó tus datos para las respuestas', p => { p.remitente = Object.assign({ nombre: '', correo: '' }, p.remitente || {}, { [c]: v || '' }); }, { ficha: true });
  const elegidos = sel.final.concat(sel.conVobo ? sel.vobo : []).map(id => contactos.find(c => c.id === id)).filter(Boolean);
  const sinCorreo = elegidos.filter(c => !correoValido(c.correo));
  const repetidos = sel.conVobo ? sel.vobo.filter(id => sel.final.indexOf(id) >= 0) : [];
  const puedeEnviar = nAct && sel.final.length && !conErrores && correoValido(remitente.correo) && tieneValor(remitente.nombre) && (!sel.conVobo || sel.vobo.length) && !repetidos.length;
  const enviar = () => cambiar('Envió ' + etiqueta + ' a revisión', (p, m) => {
    m.aprobacion = nuevaSolicitud(p, m, { conVobo: sel.conVobo, vobo: sel.vobo, final: sel.final, remitente: { nombre: remitente.nombre.trim(), correo: remitente.correo.trim() } });
    m.estado = 'revision';
  }, { forzar: true });

  /* ---------- en revisión ---------- */
  const [pegado, setPegado] = useState('');
  const [manual, setManual] = useState(null);
  const [armando, setArmando] = useState(false);
  const [retirar, setRetirar] = useState(false);
  const lectura = useMemo(() => (pegado.trim() && ap ? interpretarRespuesta(proc, modelo, version, pegado) : null), [pegado, proc, modelo, version, ap]);
  const registrar = (ie, persona, decision, comentario, via, fecha) => {
    let res = null;
    cambiar((decision === 'cambios' ? 'Registró que ' + persona.nombre + ' pide cambios' : 'Registró ' + (ap.etapas[ie].tipo === 'vobo' ? 'el visto bueno' : 'la aprobación') + ' de ' + persona.nombre), (p, m) => {
      res = registrarRespuesta(p, m, { etapa: ie, persona: persona.id, decision, comentario, via, fecha });
    }, { forzar: true });
    const et = ap.etapas[ie];
    if (decision === 'cambios') avisar && avisar(persona.nombre + ' pide cambios: quedó como pregunta en el Resumen. Corrige y vuelve a enviar.');
    else {
      const faltan = et.personas.filter(x => x.id !== persona.id && x.estado !== 'aprobado').length;
      if (faltan) avisar && avisar('Registrado. Faltan ' + faltan + (faltan === 1 ? ' respuesta' : ' respuestas') + ' en «' + et.titulo + '».');
      else if (ie < ap.etapas.length - 1) avisar && avisar('Ya están todos los vistos buenos: envía la aprobación final.');
      else avisar && avisar(etiqueta + ' quedó aprobada.');
    }
    return res;
  };
  const bajarFoto = async ie => {
    setArmando(true);
    try {
      const f = await armarFotografia(proc, modelo, version, ap, ie);
      const r = await descargar(f.nombre, new Blob([f.html], { type: 'text/html' }));
      if (r.ok) avisar && avisar('Fotografía descargada: ' + r.nombre + '. Adjúntala a cada correo.');
      else if (r.msg) avisar && avisar(r.msg);
    } catch (e) { avisar && avisar('No se pudo armar la fotografía. Vuelve a intentarlo.'); }
    setArmando(false);
  };
  const marcarPreparado = (ie, id) => cambiar('Preparó el correo de ' + (ap.etapas[ie].personas.find(x => x.id === id) || {}).nombre, (p, m) => {
    const x = m.aprobacion.etapas[ie].personas.find(y => y.id === id);
    if (x) x.preparado = ahora();
  }, { forzar: true });

  const panel = soloLectura => {
    const actual = etapaEnCurso(ap);
    return {
      titulo: 'Aprobación de ' + etiqueta, version: 'Enviada el ' + fechaCorta(ap.solicitada) + (ap.remitente && ap.remitente.nombre ? ' por ' + ap.remitente.nombre : ''), resumen,
      estado: modelo.estado,
      etapas: ap.etapas.map((et, ie) => {
        const est = estadoEtapa(ap, ie);
        return {
          titulo: et.titulo, estado: est,
          nota: est === 'espera' ? 'Se abre cuando lleguen todos los vistos buenos.' : null,
          aprobadores: et.personas.map(x => {
            const activa = !soloLectura && modelo.estado === 'revision' && ie === actual && x.estado === 'pendiente';
            const correo = correoInvitacion(proc, modelo, version, ap, et, x);
            return {
              clave: x.id, nombre: x.nombre, iniciales: iniciales(x.nombre), rol: [x.cargo, x.area].filter(Boolean).join(' · ') || 'Sin cargo',
              fecha: x.fecha ? fechaCorta(x.fecha) : null, comentario: x.comentario,
              decision: x.estado === 'aprobado' ? (et.tipo === 'vobo' ? 'vobo' : 'aprobado') : x.estado,
              decisionTexto: x.estado === 'pendiente' && x.preparado ? 'Correo preparado' : undefined,
              detalle: <span className="aprob__det">{x.correo || <span className="aprob__falta">sin correo</span>}{x.codigo ? <Fragment> · código <code>{x.codigo}</code></Fragment> : null}{x.via === 'manual' && x.estado !== 'pendiente' ? ' · registrado a mano' : ''}</span>,
              acciones: activa ? (manual && manual.id === x.id
                ? <RegistroManual etapa={et} persona={x} onCancelar={() => setManual(null)} onRegistrar={(d, c) => { registrar(ie, x, d, c, 'manual'); setManual(null); }} />
                : <Fragment>
                  {x.correo ? <MenuCorreo correo={correo} onPreparado={() => marcarPreparado(ie, x.id)} avisar={avisar} /> : <span className="nota">Agrega su correo en el Resumen.</span>}
                  <button type="button" className="kz-link" onClick={() => setManual({ id: x.id })}>Registrar a mano</button>
                </Fragment>) : null,
            };
          }),
        };
      }),
    };
  };

  /* ---------- vistas ---------- */
  const prepararEnvio = (
    <section className="tarjeta aprob-prep" aria-labelledby="t-prep">
      <h2 className="tarjeta__t" id="t-prep">{modelo.estado === 'cambios' ? 'Enviar de nuevo ' + etiqueta + ' a revisión' : 'Enviar ' + etiqueta + ' a revisión'}</h2>
      <p className="texto">Cada persona recibe un correo con su código y la fotografía del proceso adjunta. La abre, escribe su código y aprueba o escribe los cambios que pide; su respuesta te llega por correo y la registras aquí. Mientras está en revisión, nadie edita esta versión.</p>
      {contactos.length === 0 ? (
        <Aviso tono="info" acciones={ir ? [<Boton key="r" tamano="sm" onClick={() => ir('resumen')}>Ir al Resumen</Boton>] : null}>Primero agrega los contactos con su correo en el Resumen (Contactos y RACI).</Aviso>
      ) : (
        <Fragment>
          <label className="check aprob-vobo"><input type="checkbox" checked={sel.conVobo} onChange={e => setSel(Object.assign({}, sel, { conVobo: e.target.checked }))} /> Pedir primero el visto bueno de las áreas que intervienen</label>
          {sel.conVobo && <SelectorPersonas id="ap-vobo" etiqueta="1 · Visto bueno de las áreas" contactos={contactos} ids={sel.vobo} onCambiar={v => setSel(Object.assign({}, sel, { vobo: v }))}
            ayuda="Cada área revisa lo suyo. La aprobación final se abre cuando lleguen todos los vistos buenos." />}
          <SelectorPersonas id="ap-final" etiqueta={(sel.conVobo ? '2 · ' : '') + 'Aprobación final'} contactos={contactos} ids={sel.final} onCambiar={v => setSel(Object.assign({}, sel, { final: v }))}
            ayuda="El dueño del proceso, el gerente o quien firme al final." />
          <div className="rejilla-2 aprob-rem">
            <div className="campo"><label className="campo__rot" htmlFor="ap-rem-n">Tu nombre</label>
              <Entrada id="ap-rem-n" className="kz-input" valor={remitente.nombre || null} onCommit={v => setRem('nombre', v)} placeholder="Firma los correos" /></div>
            <div className="campo"><label className="campo__rot" htmlFor="ap-rem-c">Tu correo</label>
              <Entrada id="ap-rem-c" className={cx('kz-input', tieneValor(remitente.correo) && !correoValido(remitente.correo) && 'kz-input--error')} valor={remitente.correo || null} onCommit={v => setRem('correo', v ? String(v).trim() : '')} placeholder="Aquí te llegan las respuestas" /></div>
          </div>
          {repetidos.length > 0 && <p className="kz-field__error">Una persona no puede estar en las dos etapas: {repetidos.map(id => (contactos.find(c => c.id === id) || {}).nombre).join(', ')}.</p>}
          {sinCorreo.length > 0 && <Aviso tono="alerta">Sin correo válido: {sinCorreo.map(c => c.nombre || 'sin nombre').join(', ')}. Puedes enviar igual y registrar su respuesta a mano, o agregarlo en el Resumen.</Aviso>}
        </Fragment>
      )}
      {av.length > 0 && <Aviso tono="alerta">Antes de enviar, revisa: {av.map(a => a.texto).join(' ')}</Aviso>}
      {conErrores && <Aviso tono="alerta" acciones={ir ? [<Boton key="d" tamano="sm" onClick={() => ir('diagrama')}>Ver en el diagrama</Boton>] : null}>El diagrama tiene {revision.errores.length === 1 ? 'un error' : revision.errores.length + ' errores'}: corrígelos antes de enviarlo. Una versión aprobada no se puede editar, y con errores no se podría exportar.</Aviso>}
      <div className="kz-row">
        <Boton variante="primario" disabled={!puedeEnviar} onClick={enviar}>{modelo.estado === 'cambios' ? 'Enviar de nuevo a revisión' : 'Enviar ' + etiqueta + ' a revisión'}</Boton>
        {contactos.length > 0 && !sel.final.length && <span className="nota">Elige quién aprueba al final.</span>}
        {contactos.length > 0 && sel.final.length > 0 && !(correoValido(remitente.correo) && tieneValor(remitente.nombre)) && <span className="nota">Escribe tu nombre y tu correo: ahí llegan las respuestas.</span>}
      </div>
    </section>
  );

  if (!ap || modelo.estado === 'borrador') return <div className="aprobacion">{prepararEnvio}<Historial modelo={modelo} version={version} /></div>;

  const actual = etapaEnCurso(ap);
  const etActual = actual >= 0 ? ap.etapas[actual] : null;
  if (modelo.estado === 'revision') {
    return (
      <div className="aprobacion">
        <section className="tarjeta aprob-pasos" aria-labelledby="t-pasos">
          <h2 className="tarjeta__t" id="t-pasos">{etActual ? (ap.etapas.length > 1 ? 'Etapa ' + (actual + 1) + ': ' : '') + etActual.titulo : 'En revisión'}</h2>
          <ol className="aprob-pasos__l">
            <li><span>Descarga la fotografía de esta etapa: es el proceso tal como lo envías.</span>
              <Boton tamano="sm" disabled={armando || !etActual} onClick={() => bajarFoto(actual)}>Descargar la fotografía</Boton></li>
            <li><span>Con <b>Enviar correo</b>, prepara el mensaje de cada persona (lleva su código) y adjunta la fotografía.</span></li>
            <li><span>Cuando te respondan, pega la respuesta aquí abajo.</span></li>
          </ol>
          {armando && <Pensando texto="Armando la fotografía…" />}
        </section>
        <PanelAprobacion {...panel(false)} pie={
          <div className="aprob-pegar">
            <label className="campo__rot" htmlFor="ap-pegar">Registrar una respuesta</label>
            <textarea id="ap-pegar" className="kz-input kz-input--area" rows={3} value={pegado} onChange={e => setPegado(e.target.value)} placeholder="Pega aquí el correo de respuesta completo (o solo el código que empieza con KZR1.)" />
            {lectura && lectura.error && <p className="kz-field__error" role="alert">{lectura.error}</p>}
            {lectura && !lectura.error && (
              <div className="aprob-lectura" role="status">
                <p><b>{lectura.persona.nombre}</b>{lectura.persona.cargo ? ' (' + lectura.persona.cargo + ')' : ''} {lectura.decision === 'cambios' ? 'pide cambios en' : ap.etapas[lectura.etapa].tipo === 'vobo' ? 'da su visto bueno a' : 'aprueba'} {etiqueta}{lectura.fecha ? ' · ' + fechaCorta(lectura.fecha) : ''}.</p>
                {lectura.comentario && <blockquote>{lectura.comentario}</blockquote>}
                <Boton variante="primario" tamano="sm" onClick={() => { registrar(lectura.etapa, lectura.persona, lectura.decision, lectura.comentario, 'codigo', lectura.fecha); setPegado(''); }}>Registrar esta respuesta</Boton>
              </div>
            )}
          </div>
        } />
        <div className="kz-row aprob-retirar">
          {retirar
            ? <Confirmar texto={'¿Retirar ' + etiqueta + ' de revisión? Vuelve a borrador; las respuestas que ya llegaron se pierden.'} accion="Retirar de revisión"
                onSi={() => { cambiar('Retiró ' + etiqueta + ' de revisión', (p, m) => { m.aprobacion = null; m.estado = 'borrador'; }, { forzar: true }); setRetirar(false); }} onNo={() => setRetirar(false)} />
            : <button type="button" className="kz-link" onClick={() => setRetirar(true)}>Retirar de revisión</button>}
        </div>
        <Historial modelo={modelo} version={version} />
      </div>
    );
  }
  if (modelo.estado === 'cambios') {
    const pidieron = ap.etapas.reduce((t, e) => t.concat(e.personas.filter(x => x.estado === 'cambios')), []);
    return (
      <div className="aprobacion">
        <Aviso tono="alerta">{pidieron.map(x => x.nombre).join(' y ')} {pidieron.length === 1 ? 'pidió' : 'pidieron'} cambios. Quedaron como preguntas en el Resumen: edita esta versión y vuelve a enviarla.</Aviso>
        <PanelAprobacion {...panel(true)} />
        {prepararEnvio}
        <Historial modelo={modelo} version={version} />
      </div>
    );
  }
  // Aprobada
  const informados = contactos.filter(c => c.papel === 'informado' && correoValido(c.correo));
  const cInf = informados.length ? correoInformados(proc, modelo, version, informados.map(c => c.correo.trim()), ap.remitente) : null;
  return (
    <div className="aprobacion">
      <PanelAprobacion {...panel(true)} pie={cInf ? (
        <div className="kz-row aprob-inf"><span className="texto">Avisa a los informados ({informados.map(c => c.nombre).join(', ')}) y adjunta el documento Word.</span>
          <MenuCorreo correo={cInf} etiqueta="Avisar a los informados" avisar={avisar} /></div>
      ) : null} />
      <Historial modelo={modelo} version={version} />
    </div>
  );
}

function Historial({ modelo, version }) {
  if (!modelo.historial || !modelo.historial.length) return null;
  return (
    <section className="tarjeta"><h2 className="tarjeta__t">Versiones aprobadas</h2>
      <ul className="lista-avisos">{modelo.historial.slice().reverse().map((h, i) => <li key={i}><b>{(version === 'tobe' ? 'To-Be' : 'As-Is') + ' v' + h.numero}</b> · aprobada el {fechaCorta(h.fecha)} por {lista(h.aprobadores || []) || '—'}{h.vobo && h.vobo.length ? ', con el visto bueno de ' + lista(h.vobo) : ''}</li>)}</ul>
    </section>
  );
}
