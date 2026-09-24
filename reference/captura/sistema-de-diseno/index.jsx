/* Kaze — componentes del sistema de diseño.
   Recreados a mano desde las clases de Tailwind del código de Kaze (app/(app)/…) y
   componentes nuevos del módulo de captura de procesos. Leen window.React. */
const React = window.React;
const { Fragment, useState, useRef, useEffect, useLayoutEffect } = React;

const cx = (...a) => a.filter(Boolean).join(' ');

/* ───────────── Base ───────────── */

export function Boton({ variante = 'secundario', tamano = 'md', className, children, ...rest }) {
  return (
    <button {...rest} className={cx('kz-btn', 'kz-btn--' + variante, tamano === 'sm' && 'kz-btn--sm', className)}>
      {children}
    </button>
  );
}

export function CampoTexto({ etiqueta, ayuda, error, como = 'input', opciones, id, className, ...rest }) {
  const fid = id || (etiqueta ? 'kz-' + String(etiqueta).toLowerCase().replace(/[^a-z0-9]+/g, '-') : undefined);
  const control = como === 'select'
    ? <select id={fid} className="kz-input" aria-invalid={error ? true : undefined} {...rest}>
        {(opciones || []).map(o => <option key={o.valor ?? o} value={o.valor ?? o}>{o.etiqueta ?? o}</option>)}
      </select>
    : como === 'textarea'
      ? <textarea id={fid} className="kz-input kz-input--area" aria-invalid={error ? true : undefined} {...rest} />
      : <input id={fid} className="kz-input" aria-invalid={error ? true : undefined} {...rest} />;
  return (
    <div className={cx('kz-field', className)}>
      {etiqueta && <label className="kz-field__label" htmlFor={fid}>{etiqueta}</label>}
      {control}
      {error ? <p className="kz-field__error">{error}</p> : ayuda ? <p className="kz-field__help">{ayuda}</p> : null}
    </div>
  );
}

/* ───────────── Estado ───────────── */

const ESTADOS_PROYECTO = {
  progreso: { label: 'En progreso', cls: 'kz-chip--bien' },
  riesgo: { label: 'En riesgo', cls: 'kz-chip--mal' },
  cerrado: { label: 'Cerrado', cls: 'kz-chip--neutro', dot: 'apagado' },
  nuevo: { label: 'Por iniciar', cls: 'kz-chip--neutro', dot: 'borde' },
};

export function EstadoChip({ estado }) {
  const e = ESTADOS_PROYECTO[estado ?? ''] ?? ESTADOS_PROYECTO.nuevo;
  return (
    <span className={cx('kz-chip', e.cls)}>
      <span className={cx('kz-chip__dot', e.dot && 'kz-chip__dot--' + e.dot)} />
      {e.label}
    </span>
  );
}

const CONFIRMACION = {
  confirmado: { glifo: '✓', label: 'Confirmado' },
  sugerencia: { glifo: 'IA', label: 'Sugerencia' },
  pregunta: { glifo: '?', label: 'Pregunta abierta' },
  revisar: { glifo: '!', label: 'Revisar' },
};

export function EstadoConfirmacion({ estado = 'confirmado', compacto = false, fuente }) {
  const e = CONFIRMACION[estado] ?? CONFIRMACION.confirmado;
  return (
    <span className={cx('kz-conf', 'kz-conf--' + estado, compacto && 'kz-conf--compacto')}
      title={fuente ? e.label + ' · ' + fuente : e.label}>
      <span className="kz-conf__glifo" aria-hidden="true">{e.glifo}</span>
      {compacto ? <span className="kz-sr">{e.label}</span> : e.label}
    </span>
  );
}

const ESTADOS_PROCESO = {
  borrador: { label: 'Borrador', cls: 'kz-chip--neutro', dot: 'borde' },
  revision: { label: 'En revisión', cls: 'kz-chip--alerta' },
  aprobado: { label: 'Aprobado', cls: 'kz-chip--bien' },
  cambios: { label: 'Cambios solicitados', cls: 'kz-chip--mal' },
};

export function EstadoProceso({ estado = 'borrador', destacado }) {
  const e = ESTADOS_PROCESO[estado] ?? ESTADOS_PROCESO.borrador;
  const chip = (
    <span className={cx('kz-chip', e.cls, destacado && 'kz-chip--estado')}>
      <span className={cx('kz-chip__dot', e.dot && 'kz-chip__dot--' + e.dot)} />
      {e.label}
    </span>
  );
  if (!destacado) return chip;
  // En la cabecera: con rótulo y en forma de píldora, para que no se confunda con un botón.
  return <span className="kz-estado"><span className="kz-estado__rot">Estado</span>{chip}</span>;
}

export function EtiquetaVersion({ tipo = 'asis', version }) {
  const tobe = tipo === 'tobe';
  return (
    <span className={cx('kz-version', tobe ? 'kz-version--tobe' : 'kz-version--asis')}>
      {tobe ? 'Propuesto · To-Be' : 'Actual · As-Is'}
      {version != null && <span className="kz-version__n">v{version}</span>}
    </span>
  );
}

export function ValorCampo({ valor, unidad, estado }) {
  // estado explícito gana; si no, se deduce: undefined/null = vacío, 'desconocido', 'na'.
  const s = estado ?? (valor === 'desconocido' ? 'desconocido' : valor === 'na' ? 'na' : valor == null || valor === '' ? 'vacio' : 'valor');
  if (s === 'desconocido') return <span className="kz-valor kz-valor--desconocido" title="Desconocido: aún no se sabe">?<span className="kz-sr"> Desconocido</span></span>;
  if (s === 'na') return <span className="kz-valor kz-valor--na" title="No aplica">N/A</span>;
  if (s === 'vacio') return <span className="kz-valor kz-valor--vacio" title="Sin respuesta">—</span>;
  const n = typeof valor === 'number' ? valor.toLocaleString('es-CO') : valor;
  return (
    <span className="kz-valor kz-valor--num">
      {n}{unidad && <span className="kz-valor__u">{unidad}</span>}
    </span>
  );
}

const GUARDADO = {
  guardado: { cls: 'ok', txt: (d) => 'Guardado' + (d ? ' · ' + d : '') },
  guardando: { cls: 'busy', txt: () => 'Guardando…' },
  cola: { cls: 'cola', txt: (d, n) => 'Sin conexión · ' + (n ?? 0) + (n === 1 ? ' cambio' : ' cambios') + ' en cola' },
  error: { cls: 'error', txt: () => 'No se pudo guardar · reintentando' },
};

export function IndicadorGuardado({ estado = 'guardado', hace, pendientes, onDeshacer, onHistorial }) {
  const e = GUARDADO[estado] ?? GUARDADO.guardado;
  return (
    <div className="kz-save" role="status" aria-live="polite">
      <span className={cx('kz-save__dot', 'kz-save__dot--' + e.cls)} />
      <span className="kz-save__txt">{e.txt(hace, pendientes)}</span>
      {onDeshacer && <button type="button" className="kz-link" onClick={onDeshacer}>Deshacer</button>}
      {onHistorial && <button type="button" className="kz-link" onClick={onHistorial}>Historial</button>}
    </div>
  );
}

/* ───────────── Datos (desde app/(app)/proyectos/_components) ───────────── */

export function A3Progress({ done, total = 7 }) {
  return (
    <div className="kz-a3">
      <div className="kz-a3__head">
        <span className="kz-a3__n">{done}<span className="kz-a3__t">/{total}</span></span>
        <span className="kz-a3__lbl">pasos</span>
      </div>
      <div className="kz-a3__bar">
        {Array.from({ length: total }, (_, i) => <span key={i} className={cx('kz-a3__seg', i < done && 'kz-a3__seg--on')} />)}
      </div>
    </div>
  );
}

export function Sparkline({ serie }) {
  const w = 88, h = 26, p = 4;
  if (!serie || serie.length < 2) return null;
  const min = Math.min(...serie), max = Math.max(...serie), rng = (max - min) || 1;
  const last = serie.length - 1;
  const xAt = (i) => p + (i / last) * (w - 2 * p);
  const yAt = (v) => p + (1 - (v - min) / rng) * (h - 2 * p);
  const pts = serie.map((v, i) => xAt(i).toFixed(1) + ',' + yAt(v).toFixed(1)).join(' ');
  return (
    <svg viewBox={'0 0 ' + w + ' ' + h} className="kz-spark" aria-hidden="true">
      <polyline points={pts} fill="none" stroke="var(--color-marca)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={xAt(last).toFixed(1)} cy={yAt(serie[last]).toFixed(1)} r="2.6" fill="var(--color-marca)" />
    </svg>
  );
}

export function TeamAvatars({ iniciales }) {
  return (
    <div className="kz-team">
      {(iniciales || []).map((ini, i) => <span key={i} className="kz-team__a" style={{ marginLeft: i === 0 ? 0 : -7 }}>{ini}</span>)}
    </div>
  );
}

const TONO_TEXTO = { tinta: 'kz-t-tinta', bien: 'kz-t-bien', mal: 'kz-t-mal', apagado: 'kz-t-apagado', alerta: 'kz-t-alerta' };

export function SummaryStrip({ celdas }) {
  return (
    <div className="kz-summary" style={{ gridTemplateColumns: 'repeat(' + (celdas || []).length + ', minmax(0, 1fr))' }}>
      {(celdas || []).map((c, i) => (
        <div key={i} className="kz-summary__cell">
          <div className={cx('kz-summary__val', TONO_TEXTO[c.tono || 'tinta'])}>{c.valor}</div>
          <div className="kz-summary__sub">{c.etiqueta}</div>
        </div>
      ))}
    </div>
  );
}

/* ───────────── Estructura ───────────── */

export function MarcaKaze({ tamano = 26 }) {
  const ring = Math.round(tamano * 0.42);
  return (
    <span className="kz-mark" style={{ width: tamano, height: tamano }}>
      <span className="kz-mark__ring" style={{ width: ring, height: ring, borderWidth: tamano >= 30 ? 3 : 2.5 }} />
    </span>
  );
}

export function Sidebar({ items, activo, clientes, usuario }) {
  return (
    <aside className="kz-side">
      <div className="kz-side__brand"><MarcaKaze /><span className="kz-side__name">Kaze</span></div>
      <div className="kz-side__sec">Espacio de trabajo</div>
      <nav className="kz-side__nav">
        {(items || []).map(it => {
          const on = it.label === activo;
          if (it.deshabilitado) return <span key={it.label} className="kz-side__item kz-side__item--off" title="Próximamente"><span className="kz-side__bar" />{it.label}</span>;
          return <a key={it.label} href={it.href || '#'} className={cx('kz-side__item', on && 'kz-side__item--on')} aria-current={on ? 'page' : undefined}><span className="kz-side__bar" />{it.label}</a>;
        })}
      </nav>
      {clientes && clientes.length > 0 && (
        <Fragment>
          <div className="kz-side__sec kz-side__sec--gap">Clientes</div>
          <div className="kz-side__clients">
            {clientes.map(c => <span key={c.nombre} className="kz-side__client"><span className="kz-trunc">{c.nombre}</span><span className="kz-side__count">{c.n}</span></span>)}
          </div>
        </Fragment>
      )}
      {usuario && (
        <div className="kz-side__foot">
          <span className="kz-side__avatar">{usuario.iniciales}</span>
          <span className="kz-side__who"><span className="kz-side__uname">{usuario.nombre}</span><span className="kz-side__role">{usuario.rol}</span></span>
        </div>
      )}
    </aside>
  );
}

export function CabeceraPagina({ titulo, subtitulo, migas, estado, acciones, children }) {
  return (
    <header className="kz-head">
      {(migas || estado) && (
        <div className="kz-head__top">
          <div className="kz-head__crumbs">{migas}</div>
          {estado && <div className="kz-head__estado">{estado}</div>}
        </div>
      )}
      <div className="kz-head__row">
        <div className="kz-head__txt">
          <h1 className="kz-head__title">{titulo}</h1>
          {subtitulo && <p className="kz-head__sub">{subtitulo}</p>}
        </div>
        {acciones && <div className="kz-head__actions">{acciones}</div>}
      </div>
      {children}
    </header>
  );
}

/* Botón de solo ícono: la palabra aparece al pasar el mouse o al llegar con el teclado. */
export function BotonIcono({ icono, etiqueta, atajo, className, ...rest }) {
  const texto = etiqueta + (atajo ? ' · ' + atajo : '');
  return (
    <button type="button" {...rest} className={cx('kz-ibtn', className)} aria-label={etiqueta + (atajo ? ' (' + atajo + ')' : '')} data-tip={texto}>
      <IconoBPMN nombre={icono} tamano={18} />
    </button>
  );
}

/* Lista desplegable de versiones: As-Is y To-Be con su estado, y la acción de crear el To-Be. */
export function SelectorVersion({ versiones, actual, onCambiar, onCrear, crearEtiqueta = '+ Crear To-Be desde el As-Is' }) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef(null);
  const boton = useRef(null);
  const lista = useRef(null);
  const act = versiones.find(v => v.id === actual) || versiones[0];
  const ops = versiones.map(v => v.id).concat(onCrear ? ['__crear'] : []);
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = e => { if (raiz.current && !raiz.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('pointerdown', fuera);
    const i = Math.max(0, ops.indexOf(actual));
    const el = lista.current && lista.current.querySelectorAll('[role="option"]')[i];
    if (el) el.focus();
    return () => document.removeEventListener('pointerdown', fuera);
  }, [abierto]);
  const cerrar = foco => { setAbierto(false); if (foco && boton.current) boton.current.focus(); };
  const elegir = id => { cerrar(true); if (id === '__crear') onCrear && onCrear(); else if (id !== actual) onCambiar && onCambiar(id); };
  const tecla = (e, id) => {
    const els = Array.from(lista.current.querySelectorAll('[role="option"]'));
    const i = els.indexOf(e.currentTarget);
    if (e.key === 'ArrowDown') { e.preventDefault(); (els[i + 1] || els[0]).focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (els[i - 1] || els[els.length - 1]).focus(); }
    else if (e.key === 'Home') { e.preventDefault(); els[0].focus(); }
    else if (e.key === 'End') { e.preventDefault(); els[els.length - 1].focus(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(id); }
    else if (e.key === 'Escape') { e.preventDefault(); cerrar(true); }
    else if (e.key === 'Tab') cerrar(false);
  };
  return (
    <div className="kz-versel" ref={raiz}>
      <button type="button" ref={boton} className="kz-versel__btn" aria-haspopup="listbox" aria-expanded={abierto} aria-label={'Versión: ' + (act.tipo === 'tobe' ? 'Propuesto · To-Be' : 'Actual · As-Is') + ' v' + act.version}
        onClick={() => setAbierto(!abierto)} onKeyDown={e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setAbierto(true); } }}>
        <EtiquetaVersion tipo={act.tipo} version={act.version} />
        <IconoBPMN nombre="abajo" tamano={14} className="kz-versel__chev" />
      </button>
      {abierto && (
        <ul className="kz-versel__menu" role="listbox" aria-label="Versión del proceso" ref={lista}>
          {versiones.map(v => (
            <li key={v.id} role="option" aria-selected={v.id === actual} tabIndex={-1} className="kz-versel__op" onClick={() => elegir(v.id)} onKeyDown={e => tecla(e, v.id)}>
              <EtiquetaVersion tipo={v.tipo} version={v.version} />
              {v.estado && <EstadoProceso estado={v.estado} />}
              <span className="kz-versel__ok" aria-hidden="true">{v.id === actual ? '✓' : ''}</span>
            </li>
          ))}
          {onCrear && <li role="option" aria-selected="false" tabIndex={-1} className="kz-versel__op kz-versel__op--crear" onClick={() => elegir('__crear')} onKeyDown={e => tecla(e, '__crear')}>{crearEtiqueta}</li>}
        </ul>
      )}
    </div>
  );
}

export function PanelDetalle({ titulo, codigo, estado, onCerrar, secciones, pie }) {
  return (
    <aside className="kz-panel" aria-label={titulo}>
      <div className="kz-panel__head">
        <div className="kz-panel__meta">
          {codigo && <span className="kz-panel__code">{codigo}</span>}
          {estado && <EstadoConfirmacion estado={estado} />}
        </div>
        <div className="kz-panel__titlerow">
          <h2 className="kz-panel__title">{titulo}</h2>
          {onCerrar && <button type="button" className="kz-icon-btn" aria-label="Cerrar panel" onClick={onCerrar}>×</button>}
        </div>
      </div>
      <div className="kz-panel__body">
        {(secciones || []).map(s => (
          <section key={s.titulo} className="kz-panel__sec">
            <h3 className="kz-label">{s.titulo}</h3>
            <dl className="kz-dl">
              {s.campos.map(f => (
                <Fragment key={f.etiqueta}>
                  <dt>{f.etiqueta}</dt>
                  <dd>{f.contenido !== undefined ? f.contenido : <ValorCampo valor={f.valor} unidad={f.unidad} />}</dd>
                </Fragment>
              ))}
            </dl>
          </section>
        ))}
      </div>
      {pie && <div className="kz-panel__foot">{pie}</div>}
    </aside>
  );
}

/* ───────────── Captura ───────────── */

/* Secuencia: las fases se leen de izquierda a derecha y, dentro de cada fase, las
   actividades de arriba abajo. El número visible sale de esa posición; la clave interna
   (clave) no cambia nunca y es a la que apuntan decisiones, comentarios y el diagrama. */
export function numerarActividades(fases) {
  const mapa = {};
  let n = 0;
  (fases || []).forEach(f => {
    if (f.sinFase) return;
    (f.actividades || []).forEach(a => { n += 1; mapa[a.clave] = n; });
  });
  return mapa;
}

export function codigoActividad(numero, prefijo = 'ACT-') {
  return numero == null ? null : prefijo + String(numero).padStart(2, '0');
}

export function secuenciaActividades(fases, prefijo = 'ACT-') {
  const m = numerarActividades(fases);
  const out = [];
  (fases || []).forEach(f => (f.actividades || []).forEach(a => out.push({
    clave: a.clave, nombre: a.nombre, numero: m[a.clave] ?? null,
    codigo: codigoActividad(m[a.clave], prefijo), fase: f.sinFase ? null : String(f.id), faseNombre: f.sinFase ? null : f.nombre,
  })));
  return out.sort((a, b) => (a.numero ?? Infinity) - (b.numero ?? Infinity));
}

export function TablaActividades({ filas, seleccionada, onSeleccionar }) {
  const cols = ['N.º', 'Actividad', 'Fase', 'Responsable', 'Entregable', 'Proceso', 'Espera', 'Estado'];
  return (
    <div className="kz-grid-wrap">
      <table className="kz-grid">
        <thead><tr>{cols.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
        <tbody>
          {(filas || []).map(f => {
            const k = f.clave ?? f.id;
            const cod = f.codigo !== undefined ? f.codigo : f.id;
            return (
              <tr key={k}
                className={cx(f.estado === 'sugerencia' && 'kz-grid__row--ia', k === seleccionada && 'kz-grid__row--sel')}
                onClick={onSeleccionar ? () => onSeleccionar(k) : undefined}
                aria-selected={k === seleccionada || undefined}>
                <td className="kz-grid__id">{cod == null ? '—' : cod}</td>
                <td className="kz-grid__name">{f.nombre}</td>
                <td>{f.fase ? f.fase : <span className="kz-grid__none">Sin fase</span>}</td>
                <td>{f.responsable ? f.responsable : <ValorCampo valor="desconocido" />}</td>
                <td>{f.entregable ? f.entregable : <ValorCampo valor={f.entregableEstado || 'desconocido'} />}</td>
                <td className="kz-grid__num"><ValorCampo valor={f.proceso} unidad={f.unidad} /></td>
                <td className="kz-grid__num"><ValorCampo valor={f.espera} unidad={f.unidad} /></td>
                <td><EstadoConfirmacion estado={f.estado} compacto /></td>
              </tr>
            );
          })}
          <tr className="kz-grid__new"><td className="kz-grid__id">+</td><td colSpan={7}>Escribe una actividad, pega una lista o convierte notas de la entrevista…</td></tr>
        </tbody>
      </table>
    </div>
  );
}

/* Nombre editable en su sitio: Enter guarda, Esc cancela, salir del campo guarda. */
function NombreEnLinea({ valor, onGuardar, onCancelar, className, etiqueta }) {
  const [t, setT] = useState(valor || '');
  const cancelado = useRef(false);
  const guardar = () => {
    if (cancelado.current) return;
    const v = t.trim();
    if (v && v !== valor) onGuardar(v); else onCancelar();
  };
  return (
    <input className={className} value={t} autoFocus aria-label={etiqueta}
      onFocus={e => e.target.select()} onChange={e => setT(e.target.value)} onBlur={guardar}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); guardar(); }
        else if (e.key === 'Escape') { e.preventDefault(); cancelado.current = true; onCancelar(); }
      }} />
  );
}

export function TarjetaActividad({ codigo, id, clave, nombre, responsable, entregable, estado = 'confirmado',
  arrastrando, origen, renumerada, arrastrable, seleccionada, compacto, renombrable, renombrando, onRenombrar, onCancelarRenombrar, onAbrir,
  className, ...rest }) {
  const cod = codigo !== undefined ? codigo : id;
  return (
    <div {...rest} className={cx('kz-card', compacto && 'kz-card--compacto', estado === 'sugerencia' && 'kz-card--ia', estado === 'pregunta' && 'kz-card--q',
      arrastrando && 'kz-card--drag', origen && 'kz-card--origen', arrastrable && 'kz-card--arrastrable',
      seleccionada && 'kz-card--sel', className)}>
      <div className="kz-card__top">
        {arrastrable && <span className="kz-grip" aria-hidden="true" title="Arrastrar" />}
        <span className={cx('kz-card__id', renumerada && 'kz-card__id--nuevo', cod == null && 'kz-card__id--sin')} title={cod == null ? 'Sin número: ubícala en una fase' : undefined}>
          {cod == null ? <Fragment><span aria-hidden="true">—</span><span className="kz-sr">Sin número</span></Fragment> : cod}
        </span>
        {onAbrir && <button type="button" className="kz-card__abrir" onClick={onAbrir} aria-label={'Abrir la ficha de «' + nombre + '»'}>Ficha</button>}
        {!(compacto && estado === 'confirmado') && <EstadoConfirmacion estado={estado} compacto />}
      </div>
      {renombrando
        ? <NombreEnLinea className="kz-card__input" valor={nombre} etiqueta="Nombre de la actividad" onGuardar={v => onRenombrar && onRenombrar(v)} onCancelar={() => onCancelarRenombrar && onCancelarRenombrar()} />
        : <div className={cx('kz-card__name', renombrable && 'kz-card__name--editable')} data-kz-nombre={renombrable ? '' : undefined} title={renombrable ? 'Clic para corregir el nombre' : undefined}>{nombre}</div>}
      {!compacto && <div className="kz-card__meta">{responsable ? responsable : <ValorCampo valor="desconocido" />}</div>}
      {!compacto && entregable && <div className="kz-card__out">↳ {entregable}</div>}
    </div>
  );
}

const faltaCriterio = v => v == null || v === '' || v === 'desconocido';
const criterio = v => (faltaCriterio(v) ? <ValorCampo valor="desconocido" /> : v === 'na' ? <ValorCampo valor="na" /> : v);

export function ColumnaFase({ nombre, numero, objetivo, entrada, entregables, salida, actividades, sinFase, destino, compacta,
  renombrando, onPedirRenombrar, onRenombrar, onCancelarRenombrar, onEditar, pie, children, className, ...rest }) {
  const n = (actividades || []).length;
  const hayEntregables = !!(entregables && entregables.length);
  const faltan = [objetivo, entrada, salida].filter(faltaCriterio).length + (hayEntregables ? 0 : 1);
  return (
    <section {...rest} className={cx('kz-phase', sinFase && 'kz-phase--none', compacta && 'kz-phase--compacta', destino && 'kz-phase--destino', className)} aria-label={sinFase ? 'Actividades sin fase' : 'Fase ' + (numero != null ? numero + ': ' : '') + nombre}>
      <header className="kz-phase__head">
        <div className="kz-phase__title">
          {numero != null && <span className="kz-phase__n">{numero}</span>}
          {renombrando
            ? <NombreEnLinea className="kz-phase__input" valor={nombre} etiqueta="Nombre de la fase" onGuardar={v => onRenombrar && onRenombrar(v)} onCancelar={() => onCancelarRenombrar && onCancelarRenombrar()} />
            : onPedirRenombrar && !sinFase
              ? <button type="button" className="kz-phase__nom" onClick={onPedirRenombrar} title="Clic para cambiar el nombre">{nombre}</button>
              : <span>{nombre}</span>}
          <span className="kz-phase__count" title={n === 1 ? '1 actividad' : n + ' actividades'}>{n}<span className="kz-sr">{n === 1 ? ' actividad' : ' actividades'}</span></span>
        </div>
        {!compacta && !faltaCriterio(objetivo) && objetivo !== 'na' && <p className="kz-phase__obj">{objetivo}</p>}
        {sinFase && <p className="kz-phase__obj">Sin número hasta ubicarlas en una fase.</p>}
        {!sinFase && !compacta && (
          <dl className="kz-phase__crit">
            <dt>Entrada</dt><dd>{criterio(entrada)}</dd>
            <dt>Entregables</dt><dd>{hayEntregables ? entregables.join(', ') : <ValorCampo valor="desconocido" />}</dd>
            <dt>Salida</dt><dd>{criterio(salida)}</dd>
          </dl>
        )}
        {onEditar && !sinFase && (
          <button type="button" className="kz-link kz-phase__edit" onClick={onEditar}>
            {compacta ? 'Objetivo y criterios' : 'Editar criterios'}
            {compacta && <span className="kz-phase__faltan">{faltan ? ' · faltan ' + faltan : ' ✓'}</span>}
          </button>
        )}
      </header>
      <div className="kz-phase__cards" role={n ? 'list' : undefined} aria-label={n ? 'Actividades de ' + nombre : undefined}>
        {children || (actividades || []).map(a => <TarjetaActividad key={a.clave ?? a.id} role="listitem" compacto={compacta} codigo={a.codigo} id={a.id} nombre={a.nombre} responsable={a.responsable} entregable={a.entregable} estado={a.estado} />)}
        {n === 0 && <div className="kz-phase__empty">{pie ? 'Arrastra aquí o escribe abajo' : 'Suelta actividades aquí'}</div>}
      </div>
      {pie}
    </section>
  );
}

const limpiarLinea = s => String(s).replace(/^\s*(?:[-*•·]|\d+[.)-])\s*/, '').trim();

/* Alta rápida al pie de una columna: Enter agrega y deja el cursor listo para la
   siguiente; pegar varias líneas crea una actividad por línea. */
function AltaEnColumna({ fase, onAgregar }) {
  const [t, setT] = useState('');
  const ref = useRef(null);
  const agregar = nombres => {
    if (!nombres.length) return;
    onAgregar(fase.id, nombres);
    setT('');
    setTimeout(() => { if (ref.current) ref.current.scrollIntoView({ block: 'nearest' }); }, 40);
  };
  return (
    <input ref={ref} className="kz-alta" value={t} placeholder="+ Agregar actividad"
      aria-label={'Agregar actividad en ' + fase.nombre} onChange={e => setT(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); const v = limpiarLinea(t); if (v) agregar([v]); }
        else if (e.key === 'Escape') { setT(''); e.currentTarget.blur(); }
      }}
      onPaste={e => {
        const x = e.clipboardData.getData('text');
        if (/\r?\n/.test(x.trim())) { e.preventDefault(); agregar(x.split(/\r?\n/).map(limpiarLinea).filter(Boolean)); }
      }} />
  );
}

function NuevaFase({ onCrear }) {
  const [abierta, setAbierta] = useState(false);
  const [t, setT] = useState('');
  if (!abierta) return <button type="button" className="kz-phase-nueva" onClick={() => setAbierta(true)}>+ Nueva fase</button>;
  return (
    <div className="kz-phase-nueva kz-phase-nueva--abierta">
      <input className="kz-input" autoFocus value={t} placeholder="Nombre de la fase" aria-label="Nombre de la nueva fase"
        onChange={e => setT(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); const v = t.trim(); if (v) { onCrear(v); setT(''); } }
          else if (e.key === 'Escape') { setT(''); setAbierta(false); }
        }}
        onBlur={() => { if (!t.trim()) setAbierta(false); }} />
      <p className="kz-phase-nueva__ayuda">Enter la crea y deja lista la siguiente · Esc cierra</p>
    </div>
  );
}

let kzTableros = 0;
const normalizarFases = fs => (fs || []).map(f => ({ ...f, id: String(f.id), actividades: (f.actividades || []).slice() }));

export function TableroFases({ fases: fasesProp, prefijo = 'ACT-', seleccionada, onSeleccionar, onCambio,
  compacto, soloLectura, onAgregar, onRenombrar, onEliminar, onNuevaFase, onRenombrarFase, onEditarFase }) {
  const [fases, setFases] = useState(() => normalizarFases(fasesProp));
  const [drag, setDrag] = useState(null);
  const [cambiadas, setCambiadas] = useState({});
  const [aviso, setAviso] = useState('');
  const [editando, setEditando] = useState(null);
  const [editandoFase, setEditandoFase] = useState(null);
  const raiz = useRef(null);
  const fasesRef = useRef(fases);
  fasesRef.current = fases;
  const fuente = useRef(fasesProp);
  const pendiente = useRef(null);
  const enfocar = useRef(null);
  const tipoPuntero = useRef('mouse');
  const idAyuda = useRef(null);
  if (!idAyuda.current) idAyuda.current = 'kz-tablero-ayuda-' + (++kzTableros);
  const renombra = !!onRenombrar && !soloLectura;

  // Controlado: si el consumidor manda fases nuevas (alta, renombre, deshacer), se adoptan
  // antes de pintar, para que no parpadee el estado anterior.
  useLayoutEffect(() => {
    if (fasesProp === fuente.current) return;
    fuente.current = fasesProp;
    if (pendiente.current && pendiente.current.activo) return;
    const prev = fasesRef.current;
    const sig = normalizarFases(fasesProp);
    const antes = numerarActividades(prev), despues = numerarActividades(sig);
    const habia = {}; prev.forEach(f => f.actividades.forEach(a => { habia[a.clave] = true; }));
    const ch = {}; const nuevas = [];
    sig.forEach(f => f.actividades.forEach(a => {
      if (!habia[a.clave]) nuevas.push({ a, f });
      if (antes[a.clave] !== despues[a.clave]) ch[a.clave] = true;
    }));
    fasesRef.current = sig;
    setFases(sig);
    if (Object.keys(ch).length) setCambiadas(ch);
    if (nuevas.length === 1) {
      const { a, f } = nuevas[0]; const cod = codigoActividad(despues[a.clave], prefijo);
      setAviso('Agregada «' + a.nombre + '» en ' + f.nombre + (cod ? ': es ' + cod + '.' : '.'));
    } else if (nuevas.length > 1) setAviso('Agregadas ' + nuevas.length + ' actividades.');
  }, [fasesProp]);

  const buscar = (clave, fs) => {
    for (const f of fs) {
      const i = f.actividades.findIndex(a => a.clave === clave);
      if (i >= 0) return { fase: f.id, indice: i, act: f.actividades[i] };
    }
    return null;
  };

  // indice: posición en la columna destino SIN contar la tarjeta que se mueve.
  const aplicar = (clave, faseDestino, indice) => {
    const prev = fasesRef.current;
    const o = buscar(clave, prev);
    if (!o) return;
    if (o.fase === faseDestino && o.indice === indice) return;
    const sinElla = prev.map(f => f.id === o.fase ? { ...f, actividades: f.actividades.filter(a => a.clave !== clave) } : f);
    const sig = sinElla.map(f => {
      if (f.id !== faseDestino) return f;
      const arr = f.actividades.slice();
      arr.splice(Math.max(0, Math.min(indice, arr.length)), 0, o.act);
      return { ...f, actividades: arr };
    });
    const antes = numerarActividades(prev), despues = numerarActividades(sig);
    const ch = {};
    Object.keys(Object.assign({}, antes, despues)).forEach(k => { if (antes[k] !== despues[k]) ch[k] = true; });
    fasesRef.current = sig;
    setFases(sig);
    setCambiadas(ch);
    const fd = sig.find(f => f.id === faseDestino);
    const pos = fd.actividades.findIndex(a => a.clave === clave) + 1;
    const cod = codigoActividad(despues[clave], prefijo);
    setAviso('«' + o.act.nombre + '» movida a ' + fd.nombre + ', posición ' + pos + ' de ' + fd.actividades.length + '. ' +
      (cod ? 'Ahora es ' + cod + '.' : 'Queda sin número.'));
    enfocar.current = clave;
    if (onCambio) onCambio(sig, secuenciaActividades(sig, prefijo));
  };

  const destinoEn = (x, y, clave) => {
    if (!raiz.current) return null;
    const cols = Array.from(raiz.current.querySelectorAll('[data-fase]'));
    let mejor = null, dist = Infinity;
    cols.forEach(c => {
      const r = c.getBoundingClientRect();
      const d = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
      if (d < dist) { dist = d; mejor = c; }
    });
    if (!mejor) return null;
    let indice = 0;
    Array.from(mejor.querySelectorAll('[data-clave]')).forEach(el => {
      if (el.getAttribute('data-clave') === clave) return;
      const r = el.getBoundingClientRect();
      if (y > r.top + r.height / 2) indice += 1;
    });
    return { fase: mejor.getAttribute('data-fase'), indice };
  };

  // Clic sin arrastre: sobre el nombre lo corrige; en el resto de la tarjeta abre su ficha.
  const tocar = (clave, enNombre) => {
    if (enNombre && onRenombrar && !soloLectura) setEditando(clave);
    else if (onSeleccionar) onSeleccionar(clave);
  };

  const logica = useRef({});
  const oyentes = useRef(null);
  if (!oyentes.current) {
    oyentes.current = {
      move: e => logica.current.move(e),
      up: e => logica.current.up(e),
      cancel: () => logica.current.cancel(),
      key: e => { if (e.key === 'Escape') logica.current.cancel(); },
    };
  }
  const soltarOyentes = () => {
    pendiente.current = null;
    window.removeEventListener('pointermove', oyentes.current.move);
    window.removeEventListener('pointerup', oyentes.current.up);
    window.removeEventListener('pointercancel', oyentes.current.cancel);
    window.removeEventListener('keydown', oyentes.current.key);
  };
  logica.current.move = e => {
    const p = pendiente.current;
    if (!p) return;
    if (!p.activo) {
      if (Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 4) return;
      p.activo = true;
    }
    e.preventDefault();
    const b = raiz.current;
    if (b) {
      const r = b.getBoundingClientRect();
      if (e.clientX > r.right - 48) b.scrollLeft += 16;
      else if (e.clientX < r.left + 48) b.scrollLeft -= 16;
    }
    setDrag({ clave: p.clave, x: e.clientX - p.dx, y: e.clientY - p.dy, ancho: p.ancho, destino: destinoEn(e.clientX, e.clientY, p.clave) });
  };
  logica.current.up = e => {
    const p = pendiente.current;
    soltarOyentes();
    if (!p) return;
    setDrag(null);
    if (p.activo) {
      const d = destinoEn(e.clientX, e.clientY, p.clave);
      if (d) aplicar(p.clave, d.fase, d.indice);
      // Si el consumidor cambió las fases durante el arrastre, adoptarlas ahora.
      else if (fuente.current !== fasesRef.current) { const sig = normalizarFases(fuente.current); fasesRef.current = sig; setFases(sig); }
    } else if (p.tipo !== 'touch') {
      tocar(p.clave, p.enNombre);
    }
  };
  logica.current.cancel = () => { soltarOyentes(); setDrag(null); };
  useEffect(() => soltarOyentes, []);

  const alPresionar = (e, clave) => {
    tipoPuntero.current = e.pointerType || 'mouse';
    if (soloLectura) return;
    if (e.button != null && e.button !== 0) return;
    if (e.target.closest('input, textarea, select, button, a')) return;
    if (e.pointerType === 'touch' && !e.target.closest('.kz-grip')) return;
    const r = e.currentTarget.getBoundingClientRect();
    pendiente.current = { clave, x0: e.clientX, y0: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, ancho: r.width, activo: false,
      tipo: e.pointerType, enNombre: !!e.target.closest('[data-kz-nombre]') };
    window.addEventListener('pointermove', oyentes.current.move);
    window.addEventListener('pointerup', oyentes.current.up);
    window.addEventListener('pointercancel', oyentes.current.cancel);
    window.addEventListener('keydown', oyentes.current.key);
  };
  // En pantallas táctiles el toque (sin arrastrar desde el asa) llega como clic.
  const alClic = (e, clave) => {
    if (tipoPuntero.current !== 'touch' && !soloLectura) return;
    if (e.target.closest('input, textarea, select, button, a, .kz-grip')) return;
    tocar(clave, !!e.target.closest('[data-kz-nombre]'));
  };

  const vecina = clave => {
    const o = buscar(clave, fasesRef.current);
    if (!o) return null;
    const lista = fasesRef.current.find(f => f.id === o.fase).actividades;
    const v = lista[o.indice + 1] || lista[o.indice - 1];
    return v ? v.clave : null;
  };

  const alTeclado = (e, clave) => {
    if (e.target !== e.currentTarget) return;
    if (!e.altKey || soloLectura) {
      if ((e.key === 'Enter' || e.key === ' ') && onSeleccionar) { e.preventDefault(); onSeleccionar(clave); }
      else if (soloLectura) return;
      else if (e.key === 'F2' && renombra) { e.preventDefault(); setEditando(clave); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && onEliminar) { e.preventDefault(); enfocar.current = vecina(clave); onEliminar(clave); }
      return;
    }
    const fs = fasesRef.current;
    const o = buscar(clave, fs);
    if (!o) return;
    const fi = fs.findIndex(f => f.id === o.fase);
    let d = null;
    if (e.key === 'ArrowUp' && o.indice > 0) d = [o.fase, o.indice - 1];
    else if (e.key === 'ArrowDown' && o.indice < fs[fi].actividades.length - 1) d = [o.fase, o.indice + 1];
    else if (e.key === 'ArrowLeft' && fi > 0) d = [fs[fi - 1].id, Math.min(o.indice, fs[fi - 1].actividades.length)];
    else if (e.key === 'ArrowRight' && fi < fs.length - 1) d = [fs[fi + 1].id, Math.min(o.indice, fs[fi + 1].actividades.length)];
    if (d) { e.preventDefault(); aplicar(clave, d[0], d[1]); }
  };

  useEffect(() => {
    if (!Object.keys(cambiadas).length) return undefined;
    const t = setTimeout(() => setCambiadas({}), 1400);
    return () => clearTimeout(t);
  }, [cambiadas]);

  useEffect(() => {
    if (!enfocar.current || !raiz.current) return;
    const k = enfocar.current;
    const el = Array.from(raiz.current.querySelectorAll('[data-clave]')).find(n => n.getAttribute('data-clave') === k);
    if (el) { enfocar.current = null; el.focus({ preventScroll: false }); }
  });

  const numeros = numerarActividades(fases);
  let nFase = 0;
  const arrastrada = drag ? buscar(drag.clave, fases) : null;
  const iSinFase = fases.findIndex(f => f.sinFase);
  const botonFase = onNuevaFase && !soloLectura ? <NuevaFase key="__kz-nueva-fase" onCrear={onNuevaFase} /> : null;
  const columnas = [];

  fases.forEach((f, fi) => {
    if (fi === iSinFase && botonFase) columnas.push(botonFase);
    if (!f.sinFase) nFase += 1;
    const esDestino = !!(drag && drag.destino && drag.destino.fase === f.id);
    const hijos = [];
    let i = 0;
    f.actividades.forEach(a => {
      const esOrigen = !!(drag && drag.clave === a.clave);
      if (esDestino && !esOrigen && drag.destino.indice === i) hijos.push(<div key="__kz-drop" className="kz-drop" aria-hidden="true" />);
      const cod = f.sinFase ? null : codigoActividad(numeros[a.clave], prefijo);
      hijos.push(
        <TarjetaActividad key={a.clave} nombre={a.nombre} responsable={a.responsable} entregable={a.entregable} estado={a.estado}
          codigo={cod} compacto={compacto}
          data-clave={a.clave} tabIndex={0} role="listitem"
          aria-roledescription={soloLectura ? undefined : 'actividad arrastrable'} aria-describedby={idAyuda.current}
          aria-label={(cod || 'Sin número') + ': ' + a.nombre + ', ' + (f.sinFase ? 'sin fase' : 'fase ' + f.nombre)}
          aria-current={a.clave === seleccionada ? 'true' : undefined}
          arrastrable={!soloLectura} origen={esOrigen} renumerada={!!cambiadas[a.clave]} seleccionada={a.clave === seleccionada}
          renombrable={renombra} renombrando={renombra && editando === a.clave}
          onRenombrar={v => { setEditando(null); enfocar.current = a.clave; onRenombrar(a.clave, v); }}
          onCancelarRenombrar={() => { setEditando(null); enfocar.current = a.clave; }}
          onAbrir={compacto && onSeleccionar ? () => onSeleccionar(a.clave) : undefined}
          onPointerDown={e => alPresionar(e, a.clave)} onClick={e => alClic(e, a.clave)} onKeyDown={e => alTeclado(e, a.clave)} />
      );
      if (!esOrigen) i += 1;
    });
    if (esDestino && drag.destino.indice >= i) hijos.push(<div key="__kz-drop" className="kz-drop" aria-hidden="true" />);
    columnas.push(
      <ColumnaFase key={f.id} data-fase={f.id} nombre={f.nombre} numero={f.sinFase ? undefined : nFase}
        objetivo={f.objetivo} entrada={f.entrada} entregables={f.entregables} salida={f.salida}
        sinFase={f.sinFase} destino={esDestino} actividades={f.actividades} compacta={compacto}
        renombrando={!soloLectura && editandoFase === f.id}
        onPedirRenombrar={onRenombrarFase && !soloLectura ? () => setEditandoFase(f.id) : undefined}
        onRenombrar={v => { setEditandoFase(null); onRenombrarFase(f.id, v); }}
        onCancelarRenombrar={() => setEditandoFase(null)}
        onEditar={onEditarFase ? () => onEditarFase(f.id) : undefined}
        pie={onAgregar && !soloLectura ? <AltaEnColumna fase={f} onAgregar={onAgregar} /> : null}>
        {hijos.length ? hijos : null}
      </ColumnaFase>
    );
  });
  if (iSinFase < 0 && botonFase) columnas.push(botonFase);

  return (
    <div className={cx('kz-board', compacto && 'kz-board--compacto', soloLectura && 'kz-board--lectura', drag && 'kz-board--drag')} ref={raiz}>
      {columnas}
      {drag && arrastrada && (
        <div className="kz-ghost" style={{ left: drag.x, top: drag.y, width: drag.ancho }} aria-hidden="true">
          <TarjetaActividad nombre={arrastrada.act.nombre} responsable={arrastrada.act.responsable} entregable={arrastrada.act.entregable} estado={arrastrada.act.estado} arrastrable arrastrando
            compacto={compacto} codigo={codigoActividad(numeros[drag.clave], prefijo)} />
        </div>
      )}
      <p id={idAyuda.current} className="kz-sr">{soloLectura ? 'Solo lectura. Enter abre la ficha.' : 'Alt y flechas arriba o abajo cambian el orden dentro de la fase; Alt y flechas izquierda o derecha la pasan a la fase vecina. Enter abre la ficha' + (renombra ? '; F2 corrige el nombre' : '') + (onEliminar ? '; Suprimir la elimina' : '') + '.'}</p>
      <div className="kz-sr" role="status" aria-live="polite">{aviso}</div>
    </div>
  );
}

const TIPO_DECISION = {
  exclusiva: { label: 'Solo un camino', bpmn: 'Compuerta exclusiva' },
  inclusiva: { label: 'Uno o varios caminos', bpmn: 'Compuerta inclusiva' },
  paralela: { label: 'Todos a la vez', bpmn: 'Compuerta paralela' },
};

export const DESTINO_FIN = '__fin';

const CLASES_SALIDA = { retrabajo: 'Retrabajo', rechazo: 'Rechazo', cancelacion: 'Cancelación', excepcion: 'Excepción' };

/* Revisa una decisión contra la secuencia actual. Devuelve los motivos por los que
   necesita revisión; cada motivo tiene un id que depende del contexto, así que
   «Mantener así» solo silencia ese contexto: si la actividad se vuelve a mover, se
   vuelve a avisar. La decisión nunca se borra sola. */
export function revisarDecision(decision, secuencia) {
  const d = decision || {};
  const idx = {};
  (secuencia || []).forEach(a => { idx[a.clave] = a; });
  const motivos = [];
  const o = d.origen ? idx[d.origen] : null;
  const nom = a => '«' + a.nombre + '»';
  if (d.origen && !o) {
    motivos.push({ id: 'origen-eliminado', tipo: 'origen-eliminado', mantenible: false,
      texto: 'La actividad de la que sale esta decisión ya no existe.' });
  } else if (o && o.numero == null) {
    motivos.push({ id: 'origen-sin-fase:' + o.clave, tipo: 'origen-sin-fase', mantenible: true,
      texto: 'Su actividad de origen ' + nom(o) + ' está sin fase: no tiene lugar en la secuencia.' });
  } else if (o && d.contexto && d.contexto.faseOrigen != null && d.contexto.faseOrigen !== o.fase) {
    motivos.push({ id: 'origen-cambio-fase:' + o.fase, tipo: 'origen-cambio-fase', mantenible: true,
      texto: 'Su actividad de origen ' + nom(o) + ' se movió a la fase ' + (o.faseNombre || 'otra fase') + '.' });
  }
  (d.salidas || []).forEach((s, i) => {
    if (!s.destino || s.destino === DESTINO_FIN) return;
    const t = idx[s.destino];
    const cond = '«' + (s.condicion || 'Salida ' + (i + 1)) + '»';
    if (!t) {
      motivos.push({ id: 'destino-eliminado:' + i, tipo: 'destino-eliminado', salida: i, mantenible: false,
        texto: 'La salida ' + cond + ' iba a una actividad que ya no existe.' });
    } else if (t.numero == null) {
      motivos.push({ id: 'destino-sin-fase:' + i + ':' + t.clave, tipo: 'destino-sin-fase', salida: i, mantenible: true,
        texto: 'La salida ' + cond + ' va a ' + nom(t) + ', que está sin fase.' });
    } else if (o && o.numero != null && t.numero <= o.numero && s.clase !== 'retrabajo') {
      motivos.push({ id: 'atras:' + i + ':' + o.numero + '>' + t.numero, tipo: 'hacia-atras', salida: i, mantenible: true,
        texto: 'La salida ' + cond + ' ahora vuelve hacia atrás, de ' + o.codigo + ' a ' + t.codigo + '. Si es un retrabajo, márcalo; si no, cambia el destino.' });
    }
  });
  const aceptados = d.aceptados || [];
  return motivos.filter(m => !(m.mantenible && aceptados.indexOf(m.id) >= 0));
}

export function TarjetaDecision({ pregunta, punto, decide, tipo = 'exclusiva', salidas, estado = 'confirmado',
  origen, secuencia, motivos: motivosProp, contexto, aceptados,
  onMantener, onReasignarOrigen, onEliminar, onMarcarRetrabajo, onCambiarDestino, onEditar }) {
  const t = TIPO_DECISION[tipo] ?? TIPO_DECISION.exclusiva;
  const idx = {};
  (secuencia || []).forEach(a => { idx[a.clave] = a; });
  const motivos = motivosProp || (secuencia ? revisarDecision({ origen, salidas, contexto, aceptados }, secuencia) : []);
  const revisar = motivos.length > 0;
  const etiqueta = clave => {
    if (clave === DESTINO_FIN) return <span className="kz-dec__fin">Termina el proceso</span>;
    const a = idx[clave];
    if (!a) return <span className="kz-dec__roto">Actividad eliminada</span>;
    return <span><b className="kz-dec__cod">{a.codigo || 'Sin número'}</b> · {a.nombre}</span>;
  };
  const puntoVista = origen !== undefined
    ? (origen ? <span>Después de {etiqueta(origen)}</span> : <ValorCampo valor="desconocido" />)
    : (punto || <ValorCampo valor="desconocido" />);
  const porSalida = {};
  motivos.forEach(m => { if (m.salida != null) (porSalida[m.salida] = porSalida[m.salida] || []).push(m); });
  const todosMantenibles = revisar && motivos.every(m => m.mantenible);
  const sinOrigen = motivos.some(m => m.tipo === 'origen-eliminado' || m.tipo === 'origen-sin-fase' || m.tipo === 'origen-cambio-fase');
  return (
    <article className={cx('kz-dec', estado === 'sugerencia' && !revisar && 'kz-dec--ia', revisar && 'kz-dec--revisar')}>
      {revisar && (
        <div className="kz-dec__rev" role="status">
          <div className="kz-dec__rev-t">Revisar esta decisión</div>
          <ul className="kz-dec__rev-l">{motivos.map(m => <li key={m.id}>{m.texto}</li>)}</ul>
          {(onMantener || onReasignarOrigen || onEliminar) && (
            <div className="kz-row">
              {todosMantenibles && onMantener && <Boton tamano="sm" onClick={() => onMantener(motivos.map(m => m.id))}>Mantener así</Boton>}
              {sinOrigen && onReasignarOrigen && <Boton tamano="sm" onClick={onReasignarOrigen}>Reasignar origen</Boton>}
              {onEliminar && <Boton tamano="sm" variante="destructivo" onClick={onEliminar}>Eliminar decisión</Boton>}
            </div>
          )}
        </div>
      )}
      <header className="kz-dec__head">
        <div className="kz-dec__q">{pregunta}</div>
        <div className="kz-row">
          <EstadoConfirmacion estado={revisar ? 'revisar' : estado} />
          {onEditar && <Boton tamano="sm" onClick={onEditar}>Editar</Boton>}
        </div>
      </header>
      <dl className="kz-dec__meta">
        <dt>Dónde</dt><dd>{puntoVista}</dd>
        <dt>Decide</dt><dd>{decide || <ValorCampo valor="desconocido" />}</dd>
        <dt>Tipo</dt><dd><span className="kz-dec__type"><ElementoBPMN tipo={tipo} tamano={18} />{t.label}</span><span className="kz-dec__bpmn"> · {t.bpmn}</span></dd>
      </dl>
      <ol className="kz-dec__outs">
        {(salidas || []).map((s, i) => {
          const ms = porSalida[i] || [];
          const atras = ms.some(m => m.tipo === 'hacia-atras');
          const roto = ms.some(m => m.tipo === 'destino-eliminado' || m.tipo === 'destino-sin-fase');
          const destinoVista = s.destino !== undefined
            ? (s.destino ? etiqueta(s.destino) : <ValorCampo valor="desconocido" />)
            : (s.siguiente || <ValorCampo valor="desconocido" />);
          return (
            <li key={i} className={cx('kz-dec__out', s.clase && 'kz-dec__out--' + s.clase, ms.length && 'kz-dec__out--revisar')}>
              <span className="kz-dec__cond">{s.condicion}</span>
              <span className="kz-dec__arrow" aria-hidden="true">{atras || s.clase === 'retrabajo' ? '↩' : '→'}</span>
              <span className="kz-dec__next">{destinoVista}</span>
              {s.porDefecto && <span className="kz-tag">Por defecto</span>}
              {s.clase && <span className={cx('kz-tag', 'kz-tag--' + s.clase)}>{CLASES_SALIDA[s.clase]}</span>}
              {atras && onMarcarRetrabajo && <Boton tamano="sm" onClick={() => onMarcarRetrabajo(i)}>Es retrabajo</Boton>}
              {(atras || roto) && onCambiarDestino && <Boton tamano="sm" onClick={() => onCambiarDestino(i)}>Cambiar destino</Boton>}
            </li>
          );
        })}
      </ol>
    </article>
  );
}

/* ───────────── Aprobación ───────────── */

const DECISION_APROBADOR = {
  pendiente: { label: 'Pendiente', cls: 'kz-chip--neutro', dot: 'borde' },
  aprobado: { label: 'Aprobó', cls: 'kz-chip--bien' },
  vobo: { label: 'Dio su visto bueno', cls: 'kz-chip--bien' },
  cambios: { label: 'Pidió cambios', cls: 'kz-chip--mal' },
};
const ESTADO_ETAPA = { espera: 'En espera', activa: 'En curso', completa: 'Completa', cambios: 'Con cambios' };

export function PanelAprobacion({ version, resumen, estado = 'revision', aprobadores, etapas, titulo = 'Aprobación', onAprobar, onSolicitarCambios, pie }) {
  const [comentario, setComentario] = useState('');
  const [modo, setModo] = useState(null);
  const fila = (a, i) => {
    const d = DECISION_APROBADOR[a.decision] ?? DECISION_APROBADOR.pendiente;
    return (
      <li key={(a.clave || a.nombre) + '-' + i} className="kz-appr__item">
        <span className="kz-appr__av">{a.iniciales}</span>
        <div className="kz-appr__who">
          <div className="kz-appr__name">{a.nombre}</div>
          <div className="kz-appr__role">{a.rol}{a.fecha ? ' · ' + a.fecha : ''}</div>
          {a.detalle && <div className="kz-appr__det">{a.detalle}</div>}
          {a.comentario && <blockquote className="kz-appr__comment">{a.comentario}</blockquote>}
          {a.acciones && <div className="kz-appr__acc">{a.acciones}</div>}
        </div>
        <span className={cx('kz-chip', d.cls)}><span className={cx('kz-chip__dot', d.dot && 'kz-chip__dot--' + d.dot)} />{a.decisionTexto || d.label}</span>
      </li>
    );
  };
  return (
    <section className="kz-appr">
      <header className="kz-appr__head">
        <div>
          <h3 className="kz-appr__title">{titulo}</h3>
          <div className="kz-appr__ver">{version}{resumen ? ' · ' + resumen : ''}</div>
        </div>
        <EstadoProceso estado={estado} />
      </header>
      {etapas ? etapas.map((et, n) => (
        <div key={n} className={cx('kz-appr__etapa', 'kz-appr__etapa--' + (et.estado || 'activa'))}>
          <div className="kz-appr__etapa-cab">
            <span className="kz-appr__etapa-n">{n + 1}</span>
            <span className="kz-appr__etapa-t">{et.titulo}</span>
            <span className="kz-appr__etapa-e">{ESTADO_ETAPA[et.estado || 'activa']}</span>
          </div>
          {et.nota && <p className="kz-appr__etapa-nota">{et.nota}</p>}
          <ul className="kz-appr__list">{(et.aprobadores || []).map(fila)}</ul>
        </div>
      )) : <ul className="kz-appr__list">{(aprobadores || []).map(fila)}</ul>}
      {(onAprobar || onSolicitarCambios) && (
        <div className="kz-appr__act">
          {modo === 'cambios' ? (
            <Fragment>
              <CampoTexto como="textarea" etiqueta="Qué hay que cambiar" rows={3} value={comentario} onChange={e => setComentario(e.target.value)} ayuda="Obligatorio. El analista lo recibe como pregunta abierta." />
              <div className="kz-row">
                <Boton variante="primario" disabled={!comentario.trim()} onClick={() => onSolicitarCambios && onSolicitarCambios(comentario)}>Enviar cambios</Boton>
                <Boton onClick={() => setModo(null)}>Cancelar</Boton>
              </div>
            </Fragment>
          ) : (
            <div className="kz-row">
              <Boton variante="primario" onClick={onAprobar}>Aprobar {version}</Boton>
              <Boton onClick={() => setModo('cambios')}>Solicitar cambios</Boton>
            </div>
          )}
        </div>
      )}
      {pie && <div className="kz-appr__pie">{pie}</div>}
    </section>
  );
}

/* ───────────── BPMN ───────────── */

/* Íconos del diagrama en un cuadro de 16×16, trazo 1,4. El lienzo BPMN usa esta misma
   geometría (window.Kaze.ICONOS_BPMN) para que ficha, diagrama y documento digan lo mismo. */
function trazoEngranaje() {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const b = (i * 45 - 90) * Math.PI / 180;
    const p = (r, d) => { const a = b + d * Math.PI / 180; return (8 + r * Math.cos(a)).toFixed(2) + ' ' + (8 + r * Math.sin(a)).toFixed(2); };
    pts.push(p(5.1, -16), p(6.9, -8.5), p(6.9, 8.5), p(5.1, 16));
  }
  return 'M' + pts.join('L') + 'Z';
}
export const ICONOS_BPMN = {
  persona: [{ t: 'circle', a: { cx: 8, cy: 4.9, r: 2.7 } }, { t: 'path', a: { d: 'M2.6 14.4c0-3 2.4-5 5.4-5s5.4 2 5.4 5' } }],
  sistema: [{ t: 'path', a: { d: trazoEngranaje() } }, { t: 'circle', a: { cx: 8, cy: 8, r: 2.1 } }],
  automatizacion: [
    { t: 'rect', a: { x: 2.6, y: 5.2, width: 10.8, height: 8.4, rx: 2 } },
    { t: 'path', a: { d: 'M8 5.2V3M1.2 8.4v2.6M14.8 8.4v2.6M6.1 11.3h3.8' } },
    { t: 'circle', a: { cx: 8, cy: 2.2, r: 0.9 }, relleno: true },
    { t: 'circle', a: { cx: 5.9, cy: 8.6, r: 1.1 }, relleno: true },
    { t: 'circle', a: { cx: 10.1, cy: 8.6, r: 1.1 }, relleno: true },
  ],
  hoja: [{ t: 'path', a: { d: 'M3.8 1.6h5.6l3 3v9.8H3.8z' } }, { t: 'path', a: { d: 'M9.4 1.6v3h3M6 8.1h4.4M6 10.6h4.4' } }],
  tiempo: [{ t: 'circle', a: { cx: 8, cy: 8, r: 5.6 } }, { t: 'path', a: { d: 'M8 4.6V8l2.3 1.5' } }],
  mensaje: [{ t: 'rect', a: { x: 2.4, y: 4.2, width: 11.2, height: 7.6, rx: 0.6 } }, { t: 'path', a: { d: 'M2.6 4.5L8 8.6l5.4-4.1' } }],
  aviso: [{ t: 'rect', a: { x: 2.4, y: 4.2, width: 11.2, height: 7.6, rx: 0.6 }, relleno: true }, { t: 'path', a: { d: 'M2.6 4.5L8 8.6l5.4-4.1' }, claro: true }],
  condicion: [{ t: 'rect', a: { x: 4, y: 2.6, width: 8, height: 10.8 } }, { t: 'path', a: { d: 'M5.6 5.2h4.8M5.6 7.4h4.8M5.6 9.6h4.8M5.6 11.6h4.8' } }],
  error: [{ t: 'path', a: { d: 'M3.4 13.2l2.3-8.1 3 3.4 1.9-5.3 2 8.4-3-3.2z' } }],
  decision: [{ t: 'path', a: { d: 'M8 1.8L14.2 8 8 14.2 1.8 8z' } }],
  repite: [{ t: 'path', a: { d: 'M12 5.4A5 5 0 1 0 13 9.2' } }, { t: 'path', a: { d: 'M12.2 2.2v3.4H8.8' } }],
  porCada: [{ t: 'path', a: { d: 'M5 3.5v9M8 3.5v9M11 3.5v9' } }],
  porCadaSecuencial: [{ t: 'path', a: { d: 'M3.5 5h9M3.5 8h9M3.5 11h9' } }],
  hito: [{ t: 'path', a: { d: 'M4.2 14.6V1.8' } }, { t: 'path', a: { d: 'M4.2 2.6h8.4l-2.1 3 2.1 3H4.2' } }],
  // Acciones de la cabecera y de las filas (mismo trazo que el resto del juego).
  deshacer: [{ t: 'path', a: { d: 'M5.4 3.4 2.3 6.5l3.1 3.1' } }, { t: 'path', a: { d: 'M2.7 6.5h6.8a3.9 3.9 0 0 1 0 7.8H6.6' } }],
  historial: [{ t: 'path', a: { d: 'M2.5 8a5.5 5.5 0 1 0 1.6-3.9' } }, { t: 'path', a: { d: 'M2.3 2.3v2.9h2.9' } }, { t: 'path', a: { d: 'M8 5.1v3.1l2.1 1.4' } }],
  abajo: [{ t: 'path', a: { d: 'M4 6.2 8 10.2l4-4' } }],
  copiar: [{ t: 'rect', a: { x: 5.4, y: 5.4, width: 8.2, height: 8.2, rx: 1.4 } }, { t: 'path', a: { d: 'M10.6 3.6V3.4A1 1 0 0 0 9.6 2.4H3.4a1 1 0 0 0-1 1v6.2a1 1 0 0 0 1 1h.2' } }],
  descargar: [{ t: 'path', a: { d: 'M8 2.4v8' } }, { t: 'path', a: { d: 'M4.6 7.2 8 10.6l3.4-3.4' } }, { t: 'path', a: { d: 'M2.6 13.6h10.8' } }],
};
const NOMBRES_ICONO = { persona: 'Persona', sistema: 'Sistema', automatizacion: 'IA o automatización', hoja: 'Tiene formatos', tiempo: 'Tiempo', mensaje: 'Mensaje', aviso: 'Aviso', condicion: 'Condición', error: 'Error', decision: 'Decisión', repite: 'Se repite', porCada: 'Por cada, a la vez', porCadaSecuencial: 'Por cada, uno tras otro', hito: 'Hito', deshacer: 'Deshacer', historial: 'Historial', abajo: 'Abrir', copiar: 'Copiar', descargar: 'Descargar' };

function primitivas(nombre, color, claro) {
  return (ICONOS_BPMN[nombre] || []).map((p, i) => React.createElement(p.t, Object.assign({ key: i }, p.a, {
    fill: p.relleno ? color : 'none', stroke: p.claro ? claro : color, strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round',
  })));
}

/* Un ícono suelto (listas, botones, fichas). Hereda el color del texto. */
export function IconoBPMN({ nombre, tamano = 16, titulo, className }) {
  if (!ICONOS_BPMN[nombre]) return null;
  return (
    <svg className={cx('kz-icono', className)} viewBox="0 0 16 16" width={tamano} height={tamano} focusable="false"
      role={titulo ? 'img' : undefined} aria-hidden={titulo ? undefined : 'true'} aria-label={titulo === true ? NOMBRES_ICONO[nombre] : titulo || undefined}>
      {primitivas(nombre, 'currentColor', 'var(--color-blanco)')}
    </svg>
  );
}

export function ElementoBPMN({ tipo = 'tarea', estado = 'normal', etiqueta, tamano, escala = 1, ejecutor, adjunto, ciclo, marcador }) {
  const sel = estado === 'seleccionado', sug = estado === 'sugerido';
  const stroke = sel ? 'var(--color-bpmn-seleccion)' : sug ? 'var(--color-bpmn-sugerido)' : 'var(--color-bpmn-trazo)';
  const dash = sug ? '6 4' : undefined;
  const fill = 'var(--color-bpmn-relleno)';
  const sw = 2;
  let w = 100, h = 80, body;
  if (tipo === 'tarea' || tipo === 'subproceso') {
    body = (
      <Fragment>
        <rect x="1" y="1" width="98" height="78" rx="10" fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />
        {etiqueta && <text x="50" y={tipo === 'subproceso' ? 38 : 44} textAnchor="middle" className="kz-bpmn__txt">{etiqueta}</text>}
        {tipo === 'subproceso' && <Fragment><rect x="43" y="62" width="14" height="14" fill={fill} stroke={stroke} strokeWidth="1.5" /><path d="M50 65v8M46 69h8" stroke={stroke} strokeWidth="1.5" /></Fragment>}
        {tipo === 'tarea' && ejecutor && ICONOS_BPMN[ejecutor] && <g transform="translate(79 6) scale(0.875)">{primitivas(ejecutor, stroke, fill)}</g>}
        {tipo === 'tarea' && adjunto && <g transform={'translate(' + (ejecutor ? 63 : 79) + ' 6) scale(0.875)'}>{primitivas('hoja', stroke, fill)}</g>}
        {tipo === 'tarea' && ciclo && ICONOS_BPMN[ciclo] && <g transform="translate(43 62) scale(0.875)">{primitivas(ciclo, stroke, fill)}</g>}
      </Fragment>
    );
  } else if (tipo === 'inicio' || tipo === 'fin' || tipo === 'intermedio') {
    w = h = 36;
    body = (
      <Fragment>
        <circle cx="18" cy="18" r={tipo === 'fin' ? 15.5 : 16.5} fill={fill} stroke={stroke} strokeWidth={tipo === 'fin' ? 4 : sw} strokeDasharray={dash} />
        {tipo === 'intermedio' && <circle cx="18" cy="18" r="12.5" fill="none" stroke={stroke} strokeWidth="1.5" />}
        {marcador && ICONOS_BPMN[marcador] && <g transform="translate(9 9) scale(1.125)">{primitivas(marcador, stroke, fill)}</g>}
      </Fragment>
    );
  } else if (tipo === 'exclusiva' || tipo === 'inclusiva' || tipo === 'paralela') {
    w = h = 50;
    const mark = tipo === 'exclusiva'
      ? <path d="M18 18l14 14M32 18L18 32" stroke={stroke} strokeWidth="4" strokeLinecap="round" />
      : tipo === 'paralela'
        ? <path d="M25 14v22M14 25h22" stroke={stroke} strokeWidth="4" strokeLinecap="round" />
        : <circle cx="25" cy="25" r="9" fill="none" stroke={stroke} strokeWidth="3" />;
    body = <Fragment><path d="M25 1L49 25L25 49L1 25Z" fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} strokeLinejoin="round" />{mark}</Fragment>;
  } else if (tipo === 'datos') {
    w = 36; h = 50;
    body = <Fragment><path d="M1 1H25L35 11V49H1Z" fill={fill} stroke="var(--color-bpmn-mensaje)" strokeWidth={sw} strokeLinejoin="round" /><path d="M25 1V11H35" fill="none" stroke="var(--color-bpmn-mensaje)" strokeWidth={sw} /></Fragment>;
  } else if (tipo === 'secuencia' || tipo === 'mensaje' || tipo === 'sugerida') {
    w = 100; h = 20;
    const c = tipo === 'mensaje' ? 'var(--color-bpmn-mensaje)' : tipo === 'sugerida' ? 'var(--color-bpmn-sugerido)' : stroke;
    body = (
      <Fragment>
        {tipo === 'mensaje' && <circle cx="6" cy="10" r="4" fill={fill} stroke={c} strokeWidth="1.5" />}
        <path d={tipo === 'mensaje' ? 'M10 10H88' : 'M2 10H88'} stroke={c} strokeWidth={sw} strokeDasharray={tipo === 'mensaje' ? '8 5' : tipo === 'sugerida' ? '6 4' : undefined} />
        <path d="M86 4L98 10L86 16Z" fill={tipo === 'mensaje' ? fill : c} stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
      </Fragment>
    );
  } else if (tipo === 'grupo') {
    w = 100; h = 60;
    body = <rect x="1.5" y="1.5" width="97" height="57" rx="8" fill="none" stroke="var(--color-bpmn-grupo)" strokeWidth="1.5" strokeDasharray="10 4 2 4" />;
  } else if (tipo === 'carril') {
    w = 140; h = 60;
    body = <Fragment><rect x="1" y="1" width="138" height="58" fill={fill} stroke={stroke} strokeWidth="1.5" /><rect x="1" y="1" width="24" height="58" fill="var(--color-bpmn-carril)" stroke={stroke} strokeWidth="1.5" /></Fragment>;
  }
  const scale = tamano ? tamano / Math.max(w, h) : escala;
  return (
    <svg className="kz-bpmn" viewBox={'0 0 ' + w + ' ' + h} width={w * scale} height={h * scale} role="img"
      aria-label={tipo + (ejecutor ? ', ' + NOMBRES_ICONO[ejecutor] : '') + (adjunto ? ', con formatos' : '') + (marcador ? ', ' + NOMBRES_ICONO[marcador] : '') + (sug ? ' (sugerido)' : sel ? ' (seleccionado)' : '')}>
      {body}
    </svg>
  );
}

window.Kaze = Object.assign(window.Kaze || {}, {
  Boton, CampoTexto,
  EstadoChip, EstadoConfirmacion, EstadoProceso, EtiquetaVersion, ValorCampo, IndicadorGuardado,
  A3Progress, Sparkline, TeamAvatars, SummaryStrip,
  MarcaKaze, Sidebar, CabeceraPagina, PanelDetalle,
  TablaActividades, TarjetaActividad, ColumnaFase, TableroFases, TarjetaDecision,
  numerarActividades, codigoActividad, secuenciaActividades, revisarDecision, DESTINO_FIN,
  PanelAprobacion, ElementoBPMN, IconoBPMN, ICONOS_BPMN, BotonIcono, SelectorVersion,
});
