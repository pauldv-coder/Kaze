/* La «fotografía» del proceso: un archivo HTML autocontenido que recibe quien aprueba.
   Muestra la versión tal como se envió (en pocas palabras, SIPOC, diagrama y el paso a paso),
   pide el código de la persona, y arma su respuesta (visto bueno, aprobación o cambios) para
   devolverla por correo con un código KZR1.… que Kaze registra. Funciona sin red. */
import { tieneValor, fechaCorta } from './model.js';
import { narrarProceso } from './narrador.js';
import { anexosDe } from './documento.js';
import { generarBPMN } from './bpmn.js';
import { svgDelDiagrama } from './lienzo.js';
import { hash53, normalizarCodigo, nombreFotografia, ETAPAS } from './aprobacion.js';

// El cierre de <script> se arma en tiempo de ejecución: el prototipo va dentro de otro <script>.
const FIN = ['<', 'script>'].join('/');
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const runs = rs => (rs || []).map(r => {
  const t = esc(r.t);
  if (r.tono === 'falta') return '<span class="falta">' + t + '</span>';
  if (r.tono === 'ia') return '<span class="ia">' + t + '</span>';
  if (r.tono === 'suave') return '<span class="suave">' + t + '</span>';
  if (r.ref) return '<a href="#' + esc(r.ref.ancla) + '"><b>' + t + '</b></a>';
  return r.b ? '<b>' + t + '</b>' : t;
}).join('');

function pasoHTML(p) {
  const out = ['<article class="paso" id="' + esc(p.ancla) + '"><h4><span class="paso__n">' + p.numero + '.</span> ' + esc(p.nombre) + ' <span class="paso__cod">' + esc(p.codigo) + '</span></h4>'];
  let ramas = [];
  const cerrarRamas = () => { if (ramas.length) { out.push('<ul class="ramas">' + ramas.join('') + '</ul>'); ramas = []; } };
  p.parrafos.forEach(q => {
    if (q.tipo === 'rama') { ramas.push('<li>' + runs(q.runs) + '</li>'); return; }
    cerrarRamas();
    if (q.tipo === 'importante') out.push('<p class="aviso aviso--imp"><b>Importante:</b> ' + runs(q.runs) + '</p>');
    else if (q.tipo === 'atencion') out.push('<p class="aviso aviso--aten"><b>Atención:</b> ' + runs(q.runs) + '</p>');
    else if (q.tipo === 'falta') out.push('<p class="nota">' + runs(q.runs) + '</p>');
    else out.push('<p>' + runs(q.runs) + '</p>');
  });
  cerrarRamas();
  out.push('</article>');
  return out.join('');
}

function sipocHTML(sp) {
  const cols = [['S', 'Proveedores', sp.proveedores], ['I', 'Entradas', sp.entradas], ['P', 'Proceso', sp.proceso], ['O', 'Salidas', sp.salidas], ['C', 'Clientes', sp.clientes]];
  return '<div class="sipoc">' + cols.map(([l, n, xs]) => '<div class="sipoc__c"><div class="sipoc__cab"><span class="sipoc__l">' + l + '</span>' + n + '</div>'
    + (xs.length ? '<ul>' + xs.map((x, i) => '<li>' + (l === 'P' ? '<b>' + (i + 1) + '. ' + esc(x.t) + '</b>' + (x.pasos ? '<br><span class="suave">' + esc(x.pasos) + '</span>' : '') : esc(x.t) + (x.externo ? ' <span class="suave">(externo)</span>' : '')) + '</li>').join('') + '</ul>'
      : '<p class="falta">Por definir</p>') + '</div>').join('') + '</div>';
}

export async function armarFotografia(proc, m, version, ap, iEtapa) {
  const etapa = ap.etapas[iEtapa];
  const et = ETAPAS[etapa.tipo] || ETAPAS.final;
  const etiqueta = (version === 'tobe' ? 'To-Be' : 'As-Is') + ' v' + m.numero;
  const anexos = anexosDe(m);
  const relato = narrarProceso(proc, m, { anexos, textoFicha: 'Cada paso lleva el número que tiene en el diagrama.' });
  let svg = null;
  try {
    const gen = generarBPMN(proc, m, { fases: true, entregables: true, numeros: true });
    if (gen.xml) svg = await svgDelDiagrama(gen.xml);
  } catch (e) { svg = null; }
  if (svg) svg = svg.replace(/^<\?xml[^>]*>\s*/, '').replace(/<!DOCTYPE[^>]*>\s*/i, '');
  const datos = {
    a: 'kzr1', p: proc.id, pn: proc.nombre || 'Proceso', v: version, n: m.numero, r: ap.id, e: etapa.tipo,
    etiqueta, codigoDoc: tieneValor(proc.codigoDoc) ? proc.codigoDoc : '',
    remitente: ap.remitente || { nombre: '', correo: '' },
    personas: etapa.personas.map(x => ({ h: hash53(normalizarCodigo(x.codigo)), nombre: x.nombre, cargo: x.cargo || '', area: x.area || '' })),
  };
  const titulo = et.corto + ' · ' + (proc.nombre || 'Proceso') + ' · ' + etiqueta;
  const meta = [datos.codigoDoc || null, etiqueta, 'enviado' + (ap.remitente && ap.remitente.nombre ? ' por ' + ap.remitente.nombre : '') + ' el ' + fechaCorta(ap.solicitada)].filter(Boolean).join(' · ');
  const decSi = etapa.tipo === 'vobo' ? 'Estoy de acuerdo: doy mi visto bueno' : 'Estoy de acuerdo: apruebo el proceso';
  const fases = relato.fases.map(f => '<section class="fase"><h3>Fase ' + f.indice + ': ' + esc(f.nombre) + '</h3>' + f.intro.map(p => '<p class="fase__intro">' + runs(p.runs) + '</p>').join('') + f.pasos.map(pasoHTML).join('') + '</section>').join('');
  const formatos = anexos.length ? '<section id="formatos"><h2>Formatos</h2><ul class="formatos">' + anexos.map(x => '<li><b>Anexo ' + x.n + '</b> · ' + esc([x.codigo, x.nombre].filter(Boolean).join(' · ')) + (x.version ? ' (v' + esc(x.version) + ')' : '') + ' <span class="suave">· se usa en ' + esc(x.usos.join(', ')) + '</span></li>').join('') + '</ul><p class="nota">Los archivos de los formatos no van en esta fotografía.</p></section>' : '';
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<style>
:root{--marca:#f94202;--cta:#d93a00;--cta-h:#b83100;--tinta:#111111;--texto:#24292e;--panel:#eceef1;--blanco:#ffffff;--borde:#dadee2;--apagado:#6b7177;--bien:#0f7a45;--mal:#c0392b;--alerta:#9a6b00;--ia:#2458a6;
--sans:"Hanken Grotesk",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;--display:"Space Grotesk",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:16px}
body{margin:0;font-family:var(--sans);font-size:15px;line-height:1.6;color:var(--texto);background:var(--panel);-webkit-font-smoothing:antialiased}
a{color:inherit}
.barra{background:var(--tinta);color:var(--blanco)}
.barra__in{max-width:1180px;margin:0 auto;padding:12px 20px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.marca{display:inline-flex;align-items:center;gap:8px;font-family:var(--display);font-weight:700;font-size:16px}
.barra__t{font-size:13px;color:rgba(255,255,255,.72)}
.marco{max-width:1180px;margin:0 auto;padding:20px;display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:20px;align-items:start}
.hoja{background:var(--blanco);border:1px solid var(--borde);border-radius:8px;padding:28px 32px;min-width:0}
.cab__meta{margin:0;font-size:12.5px;color:var(--apagado)}
h1{margin:4px 0 0;font-family:var(--display);font-size:26px;line-height:1.25;letter-spacing:-.02em;color:var(--tinta)}
.cab__obj{margin:6px 0 0;color:var(--apagado)}
.indice{display:flex;flex-wrap:wrap;gap:6px 14px;margin:18px 0 0;padding:10px 0;border-top:1px solid var(--borde);border-bottom:1px solid var(--borde);font-size:13px}
.indice a{text-decoration:none;font-weight:600}.indice a:hover{text-decoration:underline}
h2{margin:30px 0 10px;font-family:var(--display);font-size:19px;line-height:1.3;color:var(--tinta)}
h3{margin:26px 0 6px;font-size:16px;color:var(--tinta)}
h4{margin:22px 0 6px;font-size:15px;line-height:1.4;color:var(--tinta)}
.paso__cod{font-size:11px;font-weight:600;color:var(--apagado);margin-left:4px}
p{margin:0 0 10px}
.caja{background:#f5f6f8;border-left:3px solid var(--marca);border-radius:6px;padding:14px 18px}
.caja p:last-child{margin-bottom:0}
.suave{color:var(--apagado)}.falta{color:var(--alerta);font-style:italic}.ia{color:var(--ia);font-style:italic}
.nota{font-size:13px;color:var(--apagado)}
.fase__intro{color:var(--apagado)}
.aviso{padding-left:12px;border-left:3px solid var(--marca)}.aviso--imp b{color:var(--cta)}
.aviso--aten{border-left-color:#b8860b}.aviso--aten b{color:var(--alerta)}
.ramas{list-style:none;margin:0 0 10px;padding:0 0 0 24px}.ramas li{position:relative}.ramas li::before{content:"→";position:absolute;left:-22px;color:var(--marca)}
.sipoc{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));border:1px solid var(--borde);border-radius:6px;overflow:hidden;font-size:13px}
.sipoc__c{border-right:1px solid var(--borde);min-width:0}.sipoc__c:last-child{border-right:0}
.sipoc__cab{background:var(--panel);text-align:center;font-weight:700;padding:8px 6px;line-height:1.2}
.sipoc__l{display:block;font-family:var(--display);font-size:22px;color:var(--cta)}
.sipoc ul{margin:0;padding:8px 10px 10px 24px}.sipoc li{margin-bottom:4px}.sipoc p{padding:8px 10px}
.lienzo{border:1px solid var(--borde);border-radius:6px;overflow:auto;background:var(--blanco)}
.lienzo svg{display:block;width:100%;height:auto}
.lienzo.real svg{width:auto;max-width:none}
.btn-l{margin-top:8px;font:inherit;font-size:13px;font-weight:600;border:1px solid var(--borde);background:var(--blanco);border-radius:6px;padding:5px 10px;cursor:pointer}
.formatos{padding-left:20px}
.pie{margin-top:32px;padding-top:12px;border-top:1px solid var(--borde);font-size:12.5px;color:var(--apagado)}
.responder{position:sticky;top:16px;background:var(--blanco);border:1px solid var(--borde);border-radius:8px;padding:18px 18px 20px}
.responder h2{margin:0 0 6px;font-size:17px}
.responder p{font-size:14px}
label{font-size:13px;font-weight:600;display:block;margin-bottom:4px}
input[type=text],textarea{width:100%;font:inherit;font-size:14px;padding:8px 10px;border:1px solid #9aa1a8;border-radius:6px;background:var(--blanco);color:var(--tinta)}
input[type=text]{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.04em;text-transform:uppercase}
input[type=text]::placeholder{text-transform:none;letter-spacing:.02em}
input:focus-visible,textarea:focus-visible,button:focus-visible,a:focus-visible{outline:2px solid var(--marca);outline-offset:2px}
.fila{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.fila input{flex:1 1 150px;width:auto}
.btn{font:inherit;font-size:14px;font-weight:700;border-radius:6px;padding:8px 14px;cursor:pointer;border:1px solid var(--tinta);background:var(--tinta);color:var(--blanco);text-decoration:none;display:inline-block}
.btn--sec{background:var(--blanco);color:var(--tinta);border-color:var(--borde)}
.btn--cta{background:var(--cta);border-color:var(--cta);width:100%;margin-top:12px}.btn--cta:hover{background:var(--cta-h)}
.btn:disabled{opacity:.5;cursor:default}
.error{color:var(--mal);font-size:13px;margin:6px 0 0;min-height:0}
.hola{background:#f5f6f8;border-radius:6px;padding:8px 10px}
.opciones{display:grid;gap:8px;margin:10px 0}
.op{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--borde);border-radius:6px;padding:10px 12px;font-weight:600;font-size:14px;cursor:pointer;margin:0}
.op:has(input:checked){border-color:var(--tinta);box-shadow:inset 0 0 0 1px var(--tinta)}
.op input{margin-top:4px}
.listo textarea{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px}
.listo .fila{margin-top:8px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (max-width:980px){.marco{grid-template-columns:1fr}.responder{position:static;order:-1}}
@media (max-width:640px){.marco{padding:12px}.hoja{padding:18px 16px}h1{font-size:22px}.sipoc{grid-template-columns:1fr}.sipoc__c{border-right:0;border-bottom:1px solid var(--borde)}.sipoc__c:last-child{border-bottom:0}}
@media print{body{background:#fff}.barra,.responder,.indice,.btn-l{display:none}.marco{display:block;padding:0}.hoja{border:0;padding:0}}
</style>
</head>
<body>
<header class="barra"><div class="barra__in"><span class="marca"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="#f94202" stroke-width="4"/></svg>Kaze</span><span class="barra__t">Solicitud de ${esc(etapa.tipo === 'vobo' ? 'visto bueno' : 'aprobación')}</span></div></header>
<div class="marco">
<main class="hoja">
<p class="cab__meta">${esc(meta)}</p>
<h1>${esc(proc.nombre || 'Proceso')}</h1>
${tieneValor(proc.objetivo) ? '<p class="cab__obj">' + esc(proc.objetivo) + '</p>' : ''}
<nav class="indice" aria-label="Contenido"><a href="#resumen">En pocas palabras</a><a href="#sipoc">SIPOC</a><a href="#diagrama">Diagrama</a><a href="#pasos">El proceso paso a paso</a>${formatos ? '<a href="#formatos">Formatos</a>' : ''}</nav>
<section id="resumen"><h2>En pocas palabras</h2><div class="caja">${relato.resumen.map(p => '<p>' + runs(p.runs) + '</p>').join('')}</div>
${relato.alcance.length ? '<h3>Alcance</h3>' + relato.alcance.map(p => '<p>' + runs(p.runs) + '</p>').join('') : ''}</section>
<section id="sipoc"><h2>SIPOC</h2>${sipocHTML(relato.sipoc)}</section>
<section id="diagrama"><h2>Diagrama</h2>${svg ? '<div class="lienzo" id="lienzo">' + svg + '</div><button type="button" class="btn-l" id="zoom">Ver a tamaño real</button>' : '<p class="nota">El diagrama no se pudo incluir en esta fotografía.</p>'}</section>
<section id="pasos"><h2>El proceso paso a paso</h2>${relato.comoLeer.map(p => '<p class="nota">' + runs(p.runs) + '</p>').join('')}${fases}</section>
${formatos}
<p class="pie">Fotografía de ${esc(etiqueta)} tomada el ${esc(fechaCorta(ap.solicitada))} con Kaze · Captura de procesos. Si el proceso cambia, recibirás una nueva.</p>
</main>
<aside class="responder" id="responder" aria-labelledby="t-resp">
<h2 id="t-resp">Tu respuesta</h2>
<div id="paso1">
<p>Escribe el código que llegó en tu correo.</p>
<label for="codigo" class="sr">Tu código</label>
<div class="fila"><input type="text" id="codigo" autocomplete="off" spellcheck="false" placeholder="Ej.: ${esc((ap.etapas[iEtapa].personas[0] || {}).codigo ? ap.etapas[iEtapa].personas[0].codigo.replace(/-[A-Z0-9]{4}$/, '-XXXX') : 'ABC-01-XXXX')}"><button type="button" class="btn" id="identificar">Continuar</button></div>
<p class="error" id="error1" role="alert"></p>
</div>
<div id="paso2" hidden>
<p class="hola" id="hola"></p>
<div class="opciones" role="radiogroup" aria-label="Tu decisión">
<label class="op"><input type="radio" name="dec" value="aprobado"><span>${esc(decSi)}</span></label>
<label class="op"><input type="radio" name="dec" value="cambios"><span>Pido cambios</span></label>
</div>
<div id="cajaCambios" hidden><label for="cambios">¿Qué hay que cambiar?</label><textarea id="cambios" rows="5" placeholder="Ej.: en el paso 4, la revisión la hace tesorería, no contabilidad."></textarea></div>
<button type="button" class="btn btn--cta" id="enviar" disabled>Enviar mi respuesta</button>
<p class="error" id="error2" role="alert"></p>
</div>
<div id="paso3" class="listo" hidden>
<p><b>Tu respuesta está lista.</b> Se abrió tu correo con el mensaje para <span id="para"></span>: revísalo y envíalo.</p>
<p class="nota">¿No se abrió? Cópiala y envíala tú, o ábrela en tu correo web:</p>
<label for="respuesta" class="sr">Tu respuesta</label>
<textarea id="respuesta" rows="9" readonly></textarea>
<div class="fila"><button type="button" class="btn btn--sec" id="copiar">Copiar la respuesta</button><a class="btn btn--sec" id="gmail" target="_blank" rel="noopener">Gmail</a><a class="btn btn--sec" id="outlook" target="_blank" rel="noopener">Outlook</a><a class="btn btn--sec" id="mailto">Mi correo</a></div>
<p class="nota" id="copiado" role="status"></p>
<button type="button" class="btn btn--sec" id="otra">Cambiar mi respuesta</button>
</div>
</aside>
</div>
<script type="application/json" id="kz-datos">${JSON.stringify(datos).replace(/</g, '\\u003c')}${FIN}
<script>
(function () {
  var D = JSON.parse(document.getElementById('kz-datos').textContent);
  function $(id) { return document.getElementById(id); }
  function h53(str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < str.length; i++) { var ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }
  function norm(t) { return String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function b64u(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, ''); }
  var quien = null, codigo = '';
  var zoom = $('zoom');
  if (zoom) zoom.onclick = function () { var l = $('lienzo'); var real = l.classList.toggle('real'); zoom.textContent = real ? 'Ajustar al ancho' : 'Ver a tamaño real'; };
  function identificar() {
    var c = norm($('codigo').value);
    var p = null, hh = h53(c);
    for (var i = 0; i < D.personas.length; i++) if (D.personas[i].h === hh) p = D.personas[i];
    if (!p) { $('error1').textContent = c ? 'Ese código no corresponde a nadie de esta solicitud. Revisa el correo que te llegó.' : 'Escribe tu código.'; return; }
    quien = p; codigo = $('codigo').value.trim().toUpperCase();
    $('error1').textContent = '';
    $('hola').textContent = 'Hola, ' + p.nombre + (p.cargo ? ' (' + p.cargo + ')' : '') + '. ' + (D.e === 'vobo' ? 'Te piden tu visto bueno' : 'Te piden tu aprobación') + ' de ' + D.etiqueta + '.';
    $('paso1').hidden = true; $('paso2').hidden = false;
    var r = document.querySelector('input[name=dec]'); if (r) r.focus();
  }
  $('identificar').onclick = identificar;
  $('codigo').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); identificar(); } };
  function decision() { var r = document.querySelector('input[name=dec]:checked'); return r ? r.value : null; }
  function actualizar() {
    var d = decision();
    $('cajaCambios').hidden = d !== 'cambios';
    $('enviar').disabled = !d || (d === 'cambios' && !$('cambios').value.trim());
  }
  Array.prototype.forEach.call(document.querySelectorAll('input[name=dec]'), function (r) { r.onchange = function () { actualizar(); if (decision() === 'cambios') $('cambios').focus(); }; });
  $('cambios').oninput = actualizar;
  $('enviar').onclick = function () {
    var d = decision();
    if (!d || !quien) return;
    var coment = d === 'cambios' ? $('cambios').value.trim() : '';
    if (d === 'cambios' && !coment) { $('error2').textContent = 'Escribe qué hay que cambiar.'; return; }
    var dat = { a: 'kzr1', p: D.p, pn: D.pn, v: D.v, n: D.n, r: D.r, e: D.e, c: codigo, d: d, m: coment, f: new Date().toISOString(), q: quien.nombre };
    var cuerpo = b64u(JSON.stringify(dat));
    var cod = 'KZR1.' + cuerpo + '.' + h53(cuerpo).toString(36);
    var ref = '«' + D.pn + '» (' + (D.codigoDoc ? D.codigoDoc + ' · ' : '') + D.etiqueta + ')';
    var frase = d === 'cambios' ? 'Pido cambios en ' + ref + '.' : (D.e === 'vobo' ? 'Doy mi visto bueno a ' + ref + '.' : 'Apruebo ' + ref + '.');
    var nom = (D.remitente.nombre || '').split(/\\s+/)[0];
    var texto = ['Hola' + (nom ? ' ' + nom : '') + ':', '', frase].concat(d === 'cambios' ? ['', 'Cambios que pido:', coment] : []).concat(['', 'Para registrar esta respuesta, pega este correo completo en Kaze (pestaña Aprobación):', '--- Código de respuesta (no lo modifiques) ---', cod, '--- Fin del código ---', '', quien.nombre + (quien.cargo ? ' · ' + quien.cargo : '')]).join('\\n');
    var asunto = 'Respuesta: ' + (D.e === 'vobo' ? 'visto bueno' : 'aprobación') + ' de ' + D.pn + ' (' + D.etiqueta + ') · ' + quien.nombre;
    var para = D.remitente.correo || '';
    $('respuesta').value = texto;
    $('para').textContent = para || 'quien te lo envió';
    var q = function (k, v) { return k + '=' + encodeURIComponent(v); };
    var mailto = 'mailto:' + para + '?' + q('subject', asunto) + '&' + q('body', texto.replace(/\\n/g, '\\r\\n'));
    $('mailto').href = mailto;
    $('gmail').href = 'https://mail.google.com/mail/?view=cm&fs=1&' + q('to', para) + '&' + q('su', asunto) + '&' + q('body', texto);
    $('outlook').href = 'https://outlook.office.com/mail/deeplink/compose?' + q('to', para) + '&' + q('subject', asunto) + '&' + q('body', texto);
    $('paso2').hidden = true; $('paso3').hidden = false;
    try { window.location.href = mailto; } catch (e) { /* sin cliente de correo */ }
  };
  $('copiar').onclick = function () {
    var t = $('respuesta');
    var hecho = function () { $('copiado').textContent = 'Copiada. Pégala en un correo para ' + (D.remitente.correo || 'quien te lo envió') + '.'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t.value).then(hecho, function () { t.select(); document.execCommand('copy'); hecho(); });
    else { t.select(); document.execCommand('copy'); hecho(); }
  };
  $('otra').onclick = function () { $('paso3').hidden = true; $('paso2').hidden = false; };
})();
${FIN}
</body>
</html>`;
  return { nombre: nombreFotografia(proc, m, version, etapa.tipo), html };
}
