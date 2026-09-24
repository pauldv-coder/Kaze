/* Kaze · Captura de procesos — prototipo. */
import { nuevoProceso, clonar, ahora, uid, crearTobe, bloqueada, secuencia, avisos, porPreguntar, relativo, fechaCorta, estadoAprobacion, normalizarProceso } from './model.js';
import { limpiarArchivos, idsDeArchivos } from './archivos.js';
import { usar, almacenLocal } from './util.js';
import { proceso as EJEMPLO } from '../seed.mjs';
import { Kz, cx, Pestanas, Aviso, Campo, Confirmar } from './ui.jsx';
import { TabResumen, TabDiagrama, ModalPegar, ModalNotasIA, ModalDecisionesIA } from './tabs.jsx';
import { TabAprobacion } from './aprobar.jsx';
import { TabActividades, TabFases } from './actividades.jsx';
import { ModalDocumento } from './exportar.jsx';
import { generarBPMN } from './bpmn.js';
import { revisarDiagrama } from './validar.js';

const React = window.React;
const { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, Fragment } = React;
const SESION = uid('s');

function App() {
  const K = Kz();
  const [db, setDb] = useState(undefined);        // undefined = conectando, null = sin servidor
  const [procesos, setProcesos] = useState({});
  const [vista, setVista] = useState({ nombre: 'lista' });
  const [local, setLocal] = useState(null);       // proceso abierto (copia de trabajo)
  const [pila, setPila] = useState([]);           // deshacer
  const [rehacer, setRehacer] = useState([]);
  const [extRev, setExtRev] = useState(0);
  const [guardado, setGuardado] = useState({ estado: 'guardado', en: null, pendientes: 0 });
  const [yo, setYo] = useState(null);
  const [perfiles, setPerfiles] = useState({});
  const [ia, setIa] = useState(false);
  const [modal, setModal] = useState(null);
  const [seleccion, setSeleccion] = useState(null);
  const [historial, setHistorial] = useState(false);
  const [aviso, setAviso] = useState('');
  const [, tic] = useState(0);
  const localRef = useRef(null); localRef.current = local;
  const pendiente = useRef(null);
  const temporizador = useRef(null);
  const memoria = useRef({});

  // Capacidades
  useEffect(() => {
    let vivo = true;
    setDb(almacenLocal(Object.assign({}, EJEMPLO, { ejemplo: true })));
    usar('sample').then(s => { if (vivo) setIa(!!s); });
    usar('user').then(async u => {
      if (!u || !vivo) return;
      const me = await u.me();
      if (vivo) setYo(me);
    });
    const t = setInterval(() => tic(x => x + 1), 5000);
    return () => { vivo = false; clearInterval(t); };
  }, []);

  // Lista de procesos en vivo
  useEffect(() => {
    if (!db) return undefined;
    let primera = true;
    const off = db.collection('procesos').onSnapshot(snap => {
      const out = {};
      snap.docs.forEach(d => { if (d.exists) out[d.id] = normalizarProceso(d.data()); });
      setProcesos(out);
      // Al abrir: borrar adjuntos que ya ningún proceso menciona.
      if (primera) { primera = false; limpiarArchivos(idsDeArchivos(Object.values(out))); }
      // Un cambio de otra sesión sobre el proceso abierto, sin cambios locales pendientes.
      const l = localRef.current;
      if (l && out[l.id] && !pendiente.current) {
        const r = out[l.id];
        if (r.sesion !== SESION && (r.rev || 0) > (l.rev || 0)) { setLocal(normalizarProceso(clonar(r))); setExtRev(x => x + 1); setAviso('Alguien más actualizó este proceso: ves la versión más reciente.'); }
      }
    }, () => setDb(null));
    return off;
  }, [db]);

  const escribir = useCallback(async p => {
    if (!db) { memoria.current[p.id] = p; setGuardado(g => ({ estado: 'cola', en: g.en, pendientes: (g.pendientes || 0) + 1 })); return; }
    setGuardado(g => ({ estado: 'guardando', en: g.en, pendientes: 0 }));
    try { await db.collection('procesos').doc(p.id).set(p); pendiente.current = null; setGuardado({ estado: 'guardado', en: ahora(), pendientes: 0 }); }
    catch (e) {
      if (e && e.code === 'unavailable') { setTimeout(() => escribir(p), 800 + Math.random() * 800); return; }
      setGuardado(g => ({ estado: 'error', en: g.en, pendientes: 1 }));
    }
  }, [db]);

  const programar = useCallback(p => {
    pendiente.current = p;
    clearTimeout(temporizador.current);
    setGuardado(g => (db ? { estado: 'guardando', en: g.en, pendientes: 0 } : g));
    temporizador.current = setTimeout(() => escribir(pendiente.current), 700);
  }, [db, escribir]);

  const version = vista.version || 'asis';

  /* Toda edición pasa por aquí: copia, cambia, apila para deshacer y guarda. */
  const cambiar = useCallback((etiqueta, fn, op) => {
    op = op || {};
    const antes = localRef.current;
    if (!antes) return;
    const v = op.version || version;
    const m0 = antes.versiones[v];
    if (!op.ficha && !op.forzar && m0 && bloqueada(m0)) { setAviso('Esta versión está ' + (m0.estado === 'aprobado' ? 'aprobada' : 'en revisión') + ': crea una versión nueva para editarla.'); return; }
    const p = clonar(antes);
    fn(p, p.versiones[v]);
    p.actualizado = ahora(); p.rev = (antes.rev || 0) + 1; p.sesion = SESION; p.actualizadoPor = yo && yo.id || null;
    setPila(s => s.concat([{ etiqueta, estado: antes, en: ahora() }]).slice(-60));
    setRehacer([]);
    setLocal(p);
    if (!op.tablero) setExtRev(x => x + 1);
    programar(p);
  }, [version, programar, yo]);

  const deshacer = useCallback(() => {
    setPila(s => {
      if (!s.length) return s;
      const ult = s[s.length - 1];
      const actual = localRef.current;
      setRehacer(r => r.concat([{ etiqueta: ult.etiqueta, estado: actual, en: ahora() }]));
      const p = Object.assign(clonar(ult.estado), { rev: (actual.rev || 0) + 1, sesion: SESION, actualizado: ahora() });
      setLocal(p); setExtRev(x => x + 1); programar(p);
      setAviso('Deshecho: ' + ult.etiqueta + '.');
      return s.slice(0, -1);
    });
  }, [programar]);
  const rehacerUno = useCallback(() => {
    setRehacer(r => {
      if (!r.length) return r;
      const ult = r[r.length - 1];
      const actual = localRef.current;
      setPila(s => s.concat([{ etiqueta: ult.etiqueta, estado: actual, en: ahora() }]));
      const p = Object.assign(clonar(ult.estado), { rev: (actual.rev || 0) + 1, sesion: SESION, actualizado: ahora() });
      setLocal(p); setExtRev(x => x + 1); programar(p);
      return r.slice(0, -1);
    });
  }, [programar]);
  const volverA = i => {
    const e = pila[i];
    if (!e) return;
    const actual = localRef.current;
    const p = Object.assign(clonar(e.estado), { rev: (actual.rev || 0) + 1, sesion: SESION, actualizado: ahora() });
    setPila(s => s.slice(0, i).concat([{ etiqueta: 'Volvió a antes de «' + e.etiqueta + '»', estado: actual, en: ahora() }]));
    setRehacer([]);
    setLocal(p); setExtRev(x => x + 1); programar(p); setHistorial(false);
  };

  useEffect(() => {
    const k = e => {
      const t = e.target;
      const enCampo = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (enCampo || e.defaultPrevented || !(e.ctrlKey || e.metaKey) || !local) return;
      if (t && t.closest && t.closest('.lienzo')) return;   // el lienzo tiene sus propios atajos
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); deshacer(); }
      else if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) { e.preventDefault(); rehacerUno(); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [local, deshacer, rehacerUno]);

  // Al ocultar o cerrar la pestaña, guardar ya lo pendiente.
  useEffect(() => {
    const vaciar = () => { if (pendiente.current) { clearTimeout(temporizador.current); escribir(pendiente.current); } };
    const vis = () => { if (document.visibilityState === 'hidden') vaciar(); };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('pagehide', vaciar);
    return () => { document.removeEventListener('visibilitychange', vis); window.removeEventListener('pagehide', vaciar); };
  }, [escribir]);

  useEffect(() => { if (!aviso) return undefined; const t = setTimeout(() => setAviso(''), 4200); return () => clearTimeout(t); }, [aviso]);

  const abrir = (id, tab) => {
    const p = procesos[id] || memoria.current[id];
    if (!p) return;
    setLocal(normalizarProceso(clonar(p))); setPila([]); setRehacer([]); setSeleccion(null); setExtRev(x => x + 1);
    setGuardado({ estado: 'guardado', en: p.actualizado, pendientes: 0 });
    setVista({ nombre: 'proceso', id, tab: tab || 'resumen', version: 'asis' });
  };
  const crear = datos => {
    const p = nuevoProceso(datos);
    if (db) db.collection('procesos').doc(p.id).set(p).catch(() => setAviso('No se pudo crear el proceso. Vuelve a intentarlo.'));
    else memoria.current[p.id] = p;
    setProcesos(x => Object.assign({}, x, { [p.id]: p }));
    setLocal(clonar(p)); setPila([]); setRehacer([]); setSeleccion(null);
    setGuardado({ estado: db ? 'guardado' : 'cola', en: p.actualizado, pendientes: db ? 0 : 1 });
    setVista({ nombre: 'proceso', id: p.id, tab: 'resumen', version: 'asis' });
  };
  const volverLista = () => {
    if (pendiente.current) { clearTimeout(temporizador.current); escribir(pendiente.current); }
    setLocal(null); setVista({ nombre: 'lista' });
  };

  const lista = Object.values(db ? procesos : Object.assign({}, procesos, memoria.current)).sort((a, b) => (b.actualizado || '').localeCompare(a.actualizado || ''));

  return (
    <div className="app">
      <K.Sidebar activo="Captura de procesos"
        items={[{ label: 'Proyectos', deshabilitado: true }, { label: 'Captura de procesos', href: '#' }, { label: 'Mapas de valor · VSM', deshabilitado: true }, { label: 'Acciones', deshabilitado: true }, { label: 'Indicadores', deshabilitado: true }, { label: 'Casos de negocio', deshabilitado: true }, { label: 'Plantillas A3', deshabilitado: true }]}
        usuario={yo && yo.name ? { nombre: yo.name, iniciales: yo.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase(), rol: yo.isOwner ? 'dueño' : 'consultor' } : undefined} />
      <main className="principal">
        {vista.nombre === 'lista'
          ? <Lista procesos={lista} db={db} onAbrir={abrir} onCrear={crear} onEliminar={id => { db && db.collection('procesos').doc(id).delete(); setAviso('Proceso eliminado.'); }} onEjemplo={() => db && db.restablecerEjemplo && db.restablecerEjemplo()} />
          : local && <VistaProceso proc={local} vista={vista} setVista={setVista} cambiar={cambiar} guardado={guardado} extRev={extRev}
              onVolver={volverLista} onDeshacer={pila.length ? deshacer : null} deshacer={deshacer} rehacer={rehacerUno} onHistorial={() => setHistorial(!historial)} historial={historial && <PanelHistorial pila={pila} onVolverA={volverA} onCerrar={() => setHistorial(false)} />}
              seleccion={seleccion} setSeleccion={setSeleccion} abrirModal={setModal} ia={ia} yo={yo} perfiles={perfiles} db={db} avisar={setAviso} />}
      </main>
      {modal && local && modal.tipo === 'pegar' && <ModalPegar modelo={local.versiones[version]} destinoInicial={modal.destino} cambiar={cambiar} onCerrar={() => setModal(null)} />}
      {modal && local && modal.tipo === 'notas' && <ModalNotasIA proc={local} modelo={local.versiones[version]} sesionId={modal.sesion} cambiar={cambiar} onCerrar={() => setModal(null)} />}
      {modal && local && modal.tipo === 'decisionesIA' && <ModalDecisionesIA proc={local} modelo={local.versiones[version]} sesionId={modal.sesion} cambiar={cambiar} onCerrar={() => setModal(null)} />}
      <div className="brindis" role="status" aria-live="polite">{aviso && <span>{aviso}</span>}</div>
    </div>
  );
}

function PanelHistorial({ pila, onVolverA, onCerrar }) {
  return (
    <div className="historial" role="dialog" aria-label="Historial de cambios">
      <div className="historial__cab"><b>Cambios de esta sesión</b><button type="button" className="kz-icon-btn" aria-label="Cerrar historial" onClick={onCerrar}>×</button></div>
      {pila.length === 0 ? <p className="vacio">Aún no hay cambios.</p> : (
        <ol className="historial__l">{pila.map((e, i) => i).reverse().slice(0, 30).map(i => (
          <li key={i}><span>{pila[i].etiqueta}</span><span className="historial__t">{relativo(pila[i].en)}</span><button type="button" className="kz-link" onClick={() => onVolverA(i)}>Volver a antes</button></li>
        ))}</ol>
      )}
      <p className="nota">Ctrl+Z deshace y Ctrl+Y rehace fuera de los campos de texto.</p>
    </div>
  );
}

function Lista({ procesos, db, onAbrir, onCrear, onEliminar, onEjemplo }) {
  const K = Kz();
  const [nuevo, setNuevo] = useState(null);
  const [borrar, setBorrar] = useState(null);
  const persiste = db && db.persistente ? db.persistente() : false;
  const nPreg = procesos.reduce((s, p) => s + (p.preguntas || []).filter(q => !q.resuelta).length + porPreguntar(p.versiones.asis).length, 0);
  const nSug = procesos.reduce((s, p) => s + ['asis', 'tobe'].reduce((t, v) => { const m = p.versiones[v]; return t + (m ? Object.values(m.actividades).filter(a => a.estado === 'sugerencia').length + m.decisiones.filter(d => d.estado === 'sugerencia').length : 0); }, 0), 0);
  const estados = procesos.map(p => p.versiones.asis.estado);
  return (
    <div className="pagina">
      <K.CabeceraPagina titulo="Captura de procesos" subtitulo="Entrevistas convertidas en procesos BPMN documentados"
        acciones={<K.Boton variante="primario" onClick={() => setNuevo({ nombre: '', objetivo: '', dueno: '' })}>Nuevo proceso</K.Boton>} />
      <div className="contenido">
        {db && !persiste && <Aviso tono="alerta">Tu navegador no deja guardar datos en esta página: lo que captures se pierde al recargar.</Aviso>}
        {db && persiste && <p className="nota">Prototipo: todo se guarda solo en este navegador. Cada persona que lo abra ve sus propios procesos.</p>}
        <K.SummaryStrip celdas={[
          { valor: String(procesos.length), etiqueta: 'Procesos' },
          { valor: String(estados.filter(e => e === 'revision').length), etiqueta: 'En revisión', tono: 'alerta' },
          { valor: String(estados.filter(e => e === 'aprobado').length), etiqueta: 'Aprobados', tono: 'bien' },
          { valor: String(nPreg), etiqueta: 'Preguntas y datos por preguntar' },
          { valor: String(nSug), etiqueta: 'Sugerencias de la IA por validar' },
        ]} />
        {nuevo && (
          <form className="tarjeta nuevo-proc" onSubmit={e => { e.preventDefault(); if (nuevo.nombre.trim()) onCrear({ nombre: nuevo.nombre.trim(), objetivo: nuevo.objetivo.trim(), dueno: nuevo.dueno.trim() }); }}>
            <h2 className="tarjeta__t">Nuevo proceso</h2>
            <div className="rejilla-3">
              <K.CampoTexto id="np-nombre" etiqueta="Nombre" value={nuevo.nombre} onChange={e => setNuevo(Object.assign({}, nuevo, { nombre: e.target.value }))} placeholder="Radicación de facturas" autoFocus />
              <K.CampoTexto id="np-obj" etiqueta="Objetivo" value={nuevo.objetivo} onChange={e => setNuevo(Object.assign({}, nuevo, { objetivo: e.target.value }))} placeholder="Para qué existe" />
              <K.CampoTexto id="np-dueno" etiqueta="Dueño del proceso" value={nuevo.dueno} onChange={e => setNuevo(Object.assign({}, nuevo, { dueno: e.target.value }))} placeholder="Puedes dejarlo para después" />
            </div>
            <div className="kz-row"><K.Boton variante="primario" type="submit" disabled={!nuevo.nombre.trim()}>Crear y empezar la captura</K.Boton><K.Boton type="button" onClick={() => setNuevo(null)}>Cancelar</K.Boton></div>
          </form>
        )}
        {procesos.length === 0 && db !== undefined && !nuevo && <Aviso tono="info" acciones={[<K.Boton key="e" tamano="sm" onClick={onEjemplo}>Cargar el proceso de ejemplo</K.Boton>]}>Aún no hay procesos. Crea el primero o carga el ejemplo de conciliación bancaria.</Aviso>}
        {borrar && <Confirmar texto={'¿Eliminar «' + (procesos.find(p => p.id === borrar) || {}).nombre + '» de este navegador? No se puede deshacer.'} onSi={() => { onEliminar(borrar); setBorrar(null); }} onNo={() => setBorrar(null)} />}
        {procesos.length > 0 && (
          <div className="kz-grid-wrap"><table className="kz-grid tabla-procesos">
            <thead><tr><th>Proceso</th><th>Dueño</th><th>Versiones</th><th>Estado</th><th>Actividades</th><th>Actualizado</th><th><span className="kz-sr">Acciones</span></th></tr></thead>
            <tbody>{procesos.map(p => {
              const a = p.versiones.asis, t = p.versiones.tobe;
              return (
                <tr key={p.id} className="fila-link" onClick={() => onAbrir(p.id)}>
                  <td><button type="button" className="enlace-fila" onClick={e => { e.stopPropagation(); onAbrir(p.id); }}><span className="proc-nom">{p.nombre}{p.ejemplo && <span className="kz-tag etiqueta-ej">Ejemplo</span>}</span><span className="proc-obj">{p.objetivo || 'Sin objetivo aún'}</span></button></td>
                  <td>{p.dueno || <K.ValorCampo valor={null} />}</td>
                  <td><div className="kz-row"><K.EtiquetaVersion tipo="asis" version={a.numero} />{t && <K.EtiquetaVersion tipo="tobe" version={t.numero} />}</div></td>
                  <td><div className="kz-row"><K.EstadoProceso estado={a.estado} />{t && <K.EstadoProceso estado={t.estado} />}</div></td>
                  <td className="kz-grid__num">{Object.keys(a.actividades).length}</td>
                  <td>{relativo(p.actualizado)}</td>
                  <td><button type="button" className="kz-link" onClick={e => { e.stopPropagation(); setBorrar(p.id); }}>Eliminar</button></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}

function VistaProceso({ proc, vista, setVista, cambiar, guardado, extRev, onVolver, onDeshacer, deshacer, rehacer, onHistorial, historial, seleccion, setSeleccion, abrirModal, ia, yo, perfiles, db, avisar }) {
  const K = Kz();
  const version = vista.version || 'asis';
  const modelo = proc.versiones[version] || proc.versiones.asis;
  const bloq = bloqueada(modelo);
  const tab = vista.tab;
  /* ir('actividades', 'caracterizar', { clave }) · ir('fases', null, { fase }). La subvista se recuerda al cambiar de pestaña. */
  const ir = (t, sub, op) => {
    op = op || {};
    if (op.clave) setSeleccion(op.clave);
    setVista(Object.assign({}, vista, { tab: t, fase: op.fase || null }, sub ? { sub } : {}));
  };
  const seq = secuencia(modelo);
  const nRev = modelo.decisiones.filter(d => K.revisarDecision(d, seq).length || !d.origen || !modelo.actividades[d.origen]).length;
  const etiqueta = (version === 'tobe' ? 'To-Be' : 'As-Is') + ' v' + modelo.numero;
  const [confTobe, setConfTobe] = useState(false);
  const [doc, setDoc] = useState(false);
  const desbloquear = () => cambiar('Creó ' + (version === 'tobe' ? 'To-Be' : 'As-Is') + ' v' + (modelo.numero + 1) + ' para editar', (p, m) => {
    m.numero += 1; m.estado = 'borrador'; m.aprobacion = null;
  }, { forzar: true });
  // La revisión del diagrama (con las opciones por defecto): bloquea las exportaciones si hay errores.
  const revision = useMemo(() => revisarDiagrama(proc, modelo, generarBPMN(proc, modelo)), [proc, modelo]);
  const comun = { proc, modelo, version, bloq, cambiar, seleccion, setSeleccion, abrirModal, iaDisponible: ia, ir, extRev, sub: vista.sub, focoFase: vista.fase, avisar, revision, deshacer, rehacer };
  // Alto de la cabecera fija: los paneles pegajosos (lista de actividades, revisión) se ubican debajo.
  useLayoutEffect(() => {
    const cab = document.querySelector('.principal .kz-head');
    if (!cab) return undefined;
    const medir = () => document.documentElement.style.setProperty('--alto-cab', Math.round(cab.getBoundingClientRect().height) + 'px');
    medir();
    if (!window.ResizeObserver) return undefined;
    const ro = new ResizeObserver(medir);
    ro.observe(cab);
    return () => ro.disconnect();
  }, []);
  const guardadoProps = {
    estado: guardado.estado, hace: guardado.estado === 'guardado' && guardado.en ? relativo(guardado.en) : undefined, pendientes: guardado.pendientes,
  };
  const versiones = [{ id: 'asis', tipo: 'asis', version: proc.versiones.asis.numero, estado: proc.versiones.asis.estado }]
    .concat(proc.versiones.tobe ? [{ id: 'tobe', tipo: 'tobe', version: proc.versiones.tobe.numero, estado: proc.versiones.tobe.estado }] : []);
  return (
    <div className="pagina">
      <K.CabeceraPagina
        migas={<Fragment><button type="button" className="miga" onClick={onVolver}>Captura de procesos</button><span>/</span><b className="miga-act">{proc.nombre}</b></Fragment>}
        estado={<K.EstadoProceso estado={modelo.estado} destacado />}
        titulo={proc.nombre} subtitulo={proc.objetivo || 'Sin objetivo aún: complétalo en el Resumen.'}
        acciones={<Fragment>
          <div className="cab-herr">
            <K.IndicadorGuardado {...guardadoProps} />
            <K.BotonIcono icono="deshacer" etiqueta="Deshacer" atajo="Ctrl+Z" disabled={!onDeshacer} onClick={onDeshacer || undefined} />
            <div className="guardado-wrap"><K.BotonIcono icono="historial" etiqueta="Historial" aria-expanded={!!historial} onClick={onHistorial} />{historial}</div>
          </div>
          <K.SelectorVersion versiones={versiones} actual={version}
            onCambiar={v => { setSeleccion(null); setVista(Object.assign({}, vista, { version: v })); }}
            onCrear={proc.versiones.tobe ? undefined : () => setConfTobe(true)} />
          <K.Boton variante="acento" className="cab-cta" onClick={() => setDoc(true)}>Exportar documento</K.Boton>
        </Fragment>}>
        <Pestanas activa={tab} onCambiar={t => ir(t)} items={[
          { id: 'resumen', label: 'Resumen' },
          { id: 'fases', label: 'Fases', n: modelo.fases.length },
          { id: 'actividades', label: 'Actividades', n: Object.keys(modelo.actividades).length, alerta: nRev > 0 },
          { id: 'diagrama', label: 'Diagrama', alerta: revision.errores.length > 0 },
          { id: 'aprobacion', label: 'Aprobación' },
        ]} />
      </K.CabeceraPagina>
      <div className="contenido">
        {confTobe && (
          <Aviso tono="info" acciones={[<K.Boton key="s" tamano="sm" variante="primario" onClick={() => { cambiar('Creó el To-Be a partir del As-Is', p => { p.versiones.tobe = crearTobe(p.versiones.asis); }, { forzar: true }); setConfTobe(false); setVista(Object.assign({}, vista, { version: 'tobe' })); }}>Crear To-Be</K.Boton>, <K.Boton key="n" tamano="sm" onClick={() => setConfTobe(false)}>Cancelar</K.Boton>]}>
            El To-Be empieza como copia del As-Is v{proc.versiones.asis.numero}. Las mejoras se registran ahí; el As-Is no cambia.
          </Aviso>
        )}
        {bloq && tab !== 'aprobacion' && (
          <Aviso tono="alerta" acciones={[<K.Boton key="d" tamano="sm" onClick={desbloquear}>Crear {(version === 'tobe' ? 'To-Be' : 'As-Is') + ' v' + (modelo.numero + 1)} para editar</K.Boton>]}>
            {etiqueta} está {modelo.estado === 'aprobado' ? 'aprobada' : 'en revisión'}: nadie la edita{modelo.estado === 'aprobado' ? '' : ' mientras los aprobadores la leen'}. Una versión nueva deberá aprobarse otra vez.
          </Aviso>
        )}
        {tab === 'resumen' && <TabResumen {...comun} />}
        {tab === 'actividades' && <TabActividades {...comun} />}
        {tab === 'fases' && <TabFases {...comun} />}
        {tab === 'diagrama' && <TabDiagrama {...comun} />}
        {tab === 'aprobacion' && <TabAprobacion key={version} {...comun} />}
      </div>
      {doc && <ModalDocumento proc={proc} modelo={modelo} version={version} revision={revision} onCerrar={() => setDoc(false)} onVerDiagrama={() => { setDoc(false); ir('diagrama'); }} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('app')).render(<App />);
