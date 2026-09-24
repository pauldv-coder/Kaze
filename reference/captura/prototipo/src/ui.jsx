/* Piezas de interfaz del prototipo que no están en el sistema de diseño. */
import { mostrarTexto, leerTexto, leerNumero, DESCONOCIDO, NA } from './model.js';

const React = window.React;
const { useState, useEffect, useRef } = React;
export const Kz = () => window.Kaze;
export const cx = (...a) => a.filter(Boolean).join(' ');

/* Campo de texto con borrador local: se guarda al salir o con Enter, Esc deshace.
   modo: 'texto' (vacío = null), 'especial' («?» y «n/a» se entienden), 'numero'. */
export function Entrada({ valor, onCommit, modo = 'texto', como = 'input', className, onTecla, disabled, ...rest }) {
  const texto = modo === 'texto' ? (valor == null ? '' : String(valor)) : mostrarTexto(valor);
  const [draft, setDraft] = useState(texto);
  const [foco, setFoco] = useState(false);
  useEffect(() => { if (!foco) setDraft(texto); }, [texto, foco]);
  const leer = t => modo === 'numero' ? leerNumero(t) : modo === 'especial' ? leerTexto(t) : (String(t).trim() === '' ? null : String(t));
  const commit = () => { const v = leer(draft); if (JSON.stringify(v) !== JSON.stringify(valor == null ? null : valor)) onCommit(v); };
  const props = {
    ...rest, disabled, value: draft,
    className: cx(className, modo !== 'texto' && draft.trim() === '?' && 'es-desc', modo !== 'texto' && /^n\s*\/?\s*a$/i.test(draft.trim()) && 'es-na'),
    onChange: e => setDraft(e.target.value),
    onFocus: e => { setFoco(true); if (rest.onFocus) rest.onFocus(e); },
    onBlur: () => { setFoco(false); commit(); },
    onKeyDown: e => {
      if (e.key === 'Escape') { setDraft(texto); e.currentTarget.blur(); return; }
      if (e.key === 'Enter' && como === 'input') { commit(); }
      if (onTecla) onTecla(e, commit);
    },
  };
  return como === 'textarea' ? <textarea {...props} /> : <input {...props} />;
}

/* Campo de la ficha: rótulo, entrada y los botones «?» (desconocido) y «N/A». */
export function Campo({ etiqueta, valor, onCommit, modo = 'especial', como = 'input', ayuda, disabled, sufijo, id, rows, list, tri = true, extra }) {
  const set = v => onCommit(valor === v ? null : v);
  return (
    <div className="campo">
      <label className="campo__rot" htmlFor={id}>{etiqueta}</label>
      <div className="campo__ctl">
        <Entrada id={id} valor={valor} onCommit={onCommit} modo={modo} como={como} rows={rows} list={list}
          className={cx('kz-input', como === 'textarea' && 'kz-input--area')} disabled={disabled}
          placeholder={valor === DESCONOCIDO ? '' : ''} />
        {sufijo}
        {tri && modo !== 'texto' && (
          <span className="tri" role="group" aria-label={'Estado de ' + etiqueta}>
            <button type="button" className="tri__b" aria-pressed={valor === DESCONOCIDO} disabled={disabled} title="Desconocido: aún no se sabe" onClick={() => set(DESCONOCIDO)}>?</button>
            <button type="button" className="tri__b" aria-pressed={valor === NA} disabled={disabled} title="No aplica" onClick={() => set(NA)}>N/A</button>
          </span>
        )}
      </div>
      {ayuda && <p className="campo__ayuda">{ayuda}</p>}
      {extra}
    </div>
  );
}

export function Modal({ titulo, onCerrar, children, pie, ancho = 720 }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const el = ref.current && ref.current.querySelector('textarea, input, select, button');
    if (el) el.focus();
    const k = e => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', k);
    return () => { window.removeEventListener('keydown', k); if (prev && prev.focus) prev.focus(); };
  }, []);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={titulo} onMouseDown={e => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="modal__caja" style={{ maxWidth: ancho }} ref={ref}>
        <header className="modal__cab"><h2 className="modal__t">{titulo}</h2><button type="button" className="kz-icon-btn" aria-label="Cerrar" onClick={onCerrar}>×</button></header>
        <div className="modal__cuerpo">{children}</div>
        {pie && <footer className="modal__pie">{pie}</footer>}
      </div>
    </div>
  );
}

export function Pestanas({ items, activa, onCambiar }) {
  return (
    <nav className="tabs" role="tablist" aria-label="Vistas del proceso">
      {items.map(it => (
        <button key={it.id} type="button" role="tab" aria-selected={it.id === activa} className="tab" onClick={() => onCambiar(it.id)}>
          {it.label}{it.n != null && <span className="tab__n">{it.n}</span>}{it.alerta && <span className="tab__alerta" title="Hay algo por revisar">!</span>}
        </button>
      ))}
    </nav>
  );
}

export function Aviso({ tono = 'info', children, acciones }) {
  return (
    <div className={cx('aviso', 'aviso--' + tono)} role="status">
      <div className="aviso__txt">{children}</div>
      {acciones && <div className="kz-row">{acciones}</div>}
    </div>
  );
}

export function Pensando({ texto = 'Pensando…', onParar }) {
  return (
    <div className="pensando" role="status">
      <span className="pensando__punto" aria-hidden="true" />{texto}
      {onParar && <button type="button" className="kz-link" onClick={onParar}>Detener</button>}
    </div>
  );
}

/* Confirmación en la propia página (el visor no muestra confirm()). */
export function Confirmar({ texto, accion = 'Eliminar', onSi, onNo }) {
  return (
    <div className="confirmar" role="alertdialog" aria-label={texto}>
      <span>{texto}</span>
      <div className="kz-row"><button type="button" className="kz-btn kz-btn--sm kz-btn--destructivo" onClick={onSi}>{accion}</button><button type="button" className="kz-btn kz-btn--sm" onClick={onNo}>Cancelar</button></div>
    </div>
  );
}
