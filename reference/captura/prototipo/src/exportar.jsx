/* Exportar el documento Word del proceso (compendio). */
import { revisarDocumento, exportarDocumento, PAPELES } from './documento.js';
import { descargar } from './util.js';
import { Kz, Modal, Pensando } from './ui.jsx';
import { RevisionDiagrama } from './tabs.jsx';

const React = window.React;
const { useState, useMemo, useRef, useEffect, Fragment } = React;

export function ModalDocumento({ proc, modelo, version, revision, onCerrar, onVerDiagrama }) {
  const { Boton } = Kz();
  const rev = useMemo(() => revisarDocumento(proc, modelo), [proc, modelo]);
  const [papel, setPapel] = useState('carta');
  const [porFase, setPorFase] = useState(rev.diagramaChico);
  const [estado, setEstado] = useState({ fase: 'listo' });
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);
  const poner = e => { if (vivo.current) setEstado(e); };
  const etiqueta = (version === 'tobe' ? 'To-Be' : 'As-Is') + ' v' + modelo.numero;
  const ocupado = estado.fase === 'armando';

  const exportar = async conAnexos => {
    poner({ fase: 'armando', texto: 'Preparando…' });
    try {
      const r = await exportarDocumento(proc, modelo, version, { papel, porFase, conAnexos, avance: t => poner({ fase: 'armando', texto: t }) });
      poner({ fase: 'armando', texto: 'Confirma la descarga para guardar el archivo.' });
      const d = await descargar(r.nombre, r.datos);
      if (d.ok) {
        const extra = r.perdidos ? ' ' + r.perdidos + (r.perdidos === 1 ? ' archivo adjunto ya no está en este navegador y no va en el .zip.' : ' archivos adjuntos ya no están en este navegador y no van en el .zip.') : '';
        poner({ fase: 'hecho', texto: 'Archivo entregado: ' + d.nombre + '.' + extra });
      } else poner(d.msg ? { fase: 'error', texto: d.msg } : { fase: 'listo' });
    } catch (e) {
      poner({ fase: 'error', texto: e && e.message === 'red' ? 'No se pudo cargar el generador de Word. Revisa tu conexión y vuelve a intentarlo.' : 'No se pudo armar el documento. Vuelve a intentarlo.' });
    }
  };

  const sin = !rev.actividades;
  const errores = (revision && revision.errores) || [];
  const bloqueado = sin || errores.length > 0;
  return (
    <Modal titulo="Exportar documento del proceso" onCerrar={onCerrar} ancho={640}
      pie={<Fragment>
        <Boton variante="primario" disabled={ocupado || bloqueado} onClick={() => exportar(false)}>Descargar Word</Boton>
        {rev.conArchivo > 0 && <Boton disabled={ocupado || bloqueado} onClick={() => exportar(true)}>Word con anexos (.zip)</Boton>}
        <Boton onClick={onCerrar}>Cerrar</Boton>
      </Fragment>}>
      <p className="texto">Un documento Word de <b>{etiqueta}</b> que cuenta el proceso como un relato para quien lo ejecuta: objetivo, alcance, el SIPOC, el diagrama en una hoja horizontal y el paso a paso por fases, en tercera persona. Al final van los anexos: los formatos y la ficha técnica de cada actividad.</p>
      <p className="doc-cuenta">{rev.actividades} {rev.actividades === 1 ? 'actividad' : 'actividades'} en {rev.fases} {rev.fases === 1 ? 'fase' : 'fases'} · {rev.anexos} {rev.anexos === 1 ? 'formato' : 'formatos'}{rev.conArchivo ? ' (' + rev.conArchivo + ' con archivo)' : ''} · {rev.referencias} {rev.referencias === 1 ? 'referencia' : 'referencias'}</p>
      <div className="doc-op">
        <span className="doc-op__rot" id="doc-papel">Tamaño de página</span>
        <div className="segmento" role="group" aria-labelledby="doc-papel">
          {Object.values(PAPELES).map(p => <button key={p.id} type="button" aria-pressed={papel === p.id} onClick={() => setPapel(p.id)} disabled={ocupado}>{p.nombre}</button>)}
        </div>
      </div>
      {rev.fases > 1 && (
        <label className="check doc-check"><input type="checkbox" checked={porFase} disabled={ocupado} onChange={e => setPorFase(e.target.checked)} /> <span>Agregar una hoja por fase con el diagrama ampliado
          <span className="campo__ayuda">{rev.diagramaChico ? 'Recomendado: el proceso completo se reduce tanto para caber en una hoja que impreso no se lee.' : 'El diagrama completo cabe legible en una hoja; esto es opcional.'}</span></span></label>
      )}
      {sin && <p className="kz-field__error">Ubica al menos una actividad en una fase: el documento describe las actividades en su secuencia.</p>}
      {!sin && errores.length > 0 && (
        <div className="doc-bloqueo" role="alert">
          <p className="doc-bloqueo__tit"><b>No se puede exportar: el diagrama tiene {errores.length === 1 ? 'un error' : errores.length + ' errores'}.</b> Un documento con el flujo mal dibujado o incompleto no sirve para cumplirlo. Corrígelos y vuelve a exportar.</p>
          <RevisionDiagrama rev={revision} compacta onIr={() => onVerDiagrama && onVerDiagrama()} />
          {onVerDiagrama && <Boton onClick={onVerDiagrama}>Ver en el diagrama</Boton>}
        </div>
      )}
      {!bloqueado && rev.notas.length > 0 && (
        <div className="doc-notas"><h3 className="kz-label">Antes de exportar</h3><ul className="lista-avisos">{rev.notas.map((n, i) => <li key={i}>{n}</li>)}</ul></div>
      )}
      <p className="nota">Si al abrirlo Word pregunta si actualiza los campos, acepta: así el contenido muestra los números de página.</p>
      {ocupado && <Pensando texto={estado.texto} />}
      {estado.fase === 'hecho' && <p className="nota doc-ok" role="status">{estado.texto}</p>}
      {estado.fase === 'error' && <p className="kz-field__error" role="alert">{estado.texto}</p>}
    </Modal>
  );
}
