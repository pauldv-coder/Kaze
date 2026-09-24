// Edición completa del diagrama con las herramientas de bpmn.io y su paso a la captura.
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const DS = '<SANDBOX>/ds/out/project/components/lib/';
const FAKE = `window.__KZ_PRUEBA = true; window.claude = { use: async n => n === 'downloads' ? { save: async r => { window.__d = (window.__d || []).concat([r.filename]); return { status: 'saved' }; } } : null };`;
const ANCHO = +(process.env.ANCHO || 1500);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: ANCHO, height: 950 } });
  await ctx.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(DS + (r.request().url().includes('react-dom') ? 'react-dom.production.min.js' : 'react.production.min.js'), 'utf8') }));
  await ctx.route('https://cdn.jsdelivr.net/**', r => { const u = r.request().url(); const f = u.includes('docx') ? require('child_process').execSync('npm root -g').toString().trim() + '/docx/dist/index.iife.js' : path.join(__dirname, 'package/dist/bpmn-modeler.production.min.js'); r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(f, 'utf8') }); });
  await ctx.route(u => u.hostname.startsWith('fonts.'), r => r.fulfill({ contentType: 'text/css', body: '' }));
  await ctx.addInitScript(FAKE);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  let fallas = 0;
  const ok = (c, msg) => { if (!c) fallas++; console.log((c ? 'OK   ' : 'FALLA') + ' ' + msg); };
  const est = () => p.evaluate(() => { const d = JSON.parse(localStorage.getItem('kaze-captura:procesos:v1')); return d.p_conciliacion.versiones.asis; });
  const box = async sel => { const r = await p.locator(sel).first().boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, r }; };
  const espera = () => p.waitForTimeout(1500);
  // Un clic sobre algo ya seleccionado lo deselecciona (bpmn-js): tras sincronizar, la app ya selecciona lo nuevo.
  const seleccionar = async id => {
    const t = await box('[data-element-id="' + id + '"]');
    const ya = await p.evaluate(id => { const s = window.__kzModeler.get('selection').get(); return s.length === 1 && s[0].id === id; }, id);
    if (!ya) { await p.mouse.click(t.x, t.y + Math.min(14, t.r.height / 5)); await p.waitForTimeout(250); }
    return t;
  };
  const pad = async accion => { await p.click('.djs-context-pad .entry[data-action="' + accion + '"]'); };
  const deshacerLienzo = async () => { const l = await box('.lienzo'); await p.mouse.click(l.r.x + 8, l.r.y + l.r.height - 8); await p.keyboard.press('Control+z'); await espera(); };

  await p.goto('file://' + path.join(__dirname, 'out/test.html')); await p.waitForSelector('.tabla-procesos tbody tr');
  await p.click('.enlace-fila'); await p.waitForSelector('.tabs');
  await p.click('button[role=tab]:has-text("Diagrama")'); await p.waitForSelector('.djs-element', { timeout: 10000 }); await p.waitForTimeout(500);
  const m0 = await est();
  const nDec0 = m0.decisiones.length;
  ok(!(await p.$('.diagrama__bloqueo')), 'la semilla no tiene errores: se puede exportar');
  ok(!(await p.isDisabled('button:has-text("Exportar .bpmn")')), 'exportar .bpmn habilitado sin errores');

  /* 1. Decisión agregada desde el menú contextual → queda en la actividad anterior. */
  await seleccionar('Act_a_cargar');
  const entradas = await p.$$eval('.djs-context-pad .entry', e => e.map(x => x.getAttribute('data-action')));
  console.log('menú contextual:', entradas.join(', '));
  await pad('append.gateway'); await espera();
  let m = await est();
  const dNueva = m.decisiones.find(d => d.origen === 'a_cargar');
  ok(m.decisiones.length === nDec0 + 1 && !!dNueva, 'la decisión nueva queda en «Cargar extracto»: ' + JSON.stringify(dNueva && { origen: dNueva.origen, salidas: dNueva.salidas.map(s => s.destino + (s.porDefecto ? '*' : '')) }));
  ok(dNueva && dNueva.salidas.length === 1 && dNueva.salidas[0].destino === 'a_cuadre', 'su única salida sigue a la actividad siguiente');
  await p.waitForSelector('.diagrama__bloqueo');
  ok(await p.isDisabled('button:has-text("Exportar .bpmn")'), 'con errores no se exporta el .bpmn');
  ok(await p.isDisabled('button:has-text("Exportar SVG")') && await p.isDisabled('button:has-text("Copiar XML")'), 'ni el SVG ni el XML');
  const errores = await p.$$eval('.revd__i--error', e => e.map(x => x.textContent));
  console.log('errores:', errores);
  ok(errores.some(t => /no tiene pregunta/.test(t)) && errores.some(t => /al menos dos caminos/.test(t)), 'la revisión explica qué falta');
  ok(await p.$('[role=tab]:has-text("Diagrama") .tab__alerta') !== null, 'la pestaña Diagrama avisa');
  const marcados = await p.$$eval('.djs-element.kz-m-error', e => e.map(x => x.getAttribute('data-element-id')));
  ok(marcados.some(id => /^Dec_/.test(id)), 'la decisión se marca en rojo: ' + marcados.join(','));
  await p.screenshot({ path: 'out/s1-decision.png' });

  /* 1a. Con errores, el documento Word tampoco se exporta. */
  await p.click('button:has-text("Exportar documento")'); await p.waitForSelector('.doc-bloqueo');
  ok(await p.isDisabled('button:has-text("Descargar Word")'), 'con errores el Word no se descarga');
  ok((await p.$$('.doc-bloqueo .revd__i--error')).length === errores.length, 'el aviso lista los errores');
  await p.screenshot({ path: 'out/s3-word-bloqueado.png' });
  await p.click('.doc-bloqueo button:has-text("Ver en el diagrama")'); await p.waitForTimeout(600);
  ok(!(await p.$('.doc-bloqueo')) && !!(await p.$('.djs-element')), '«Ver en el diagrama» cierra el aviso y deja el diagrama a la vista');

  /* 1b. Conectar la decisión con otra tarea agrega una salida; nombrarla pone la pregunta y la condición. */
  const gid = marcados.find(id => /^Dec_/.test(id));
  ok(await p.evaluate(g => window.__kzModeler.get('selection').get().map(e => e.id).join() === g, gid), 'tras agregarla, la decisión queda seleccionada para seguir trabajando');
  await seleccionar(gid);
  await pad('connect');
  const dest = await box('[data-element-id="Act_a_revisar"]');
  await p.mouse.move(dest.x, dest.y, { steps: 8 }); await p.mouse.click(dest.x, dest.y); await espera();
  m = await est();
  let d1 = m.decisiones.find(d => d.clave === dNueva.clave);
  ok(d1 && d1.salidas.length === 2 && d1.salidas.some(s => s.destino === 'a_revisar'), 'conectar agrega una salida: ' + JSON.stringify(d1 && d1.salidas.map(s => s.destino)));
  const g2 = await box('[data-element-id="' + gid + '"]');
  await p.mouse.dblclick(g2.x, g2.y); await p.waitForTimeout(250);
  ok(!!(await p.$('.djs-direct-editing-parent')), 'doble clic en la decisión permite escribir la pregunta');
  await p.keyboard.type('¿El extracto viene completo?'); await p.keyboard.press('Enter'); await espera();
  m = await est(); d1 = m.decisiones.find(d => d.clave === dNueva.clave);
  ok(d1 && d1.pregunta === '¿El extracto viene completo?', 'la pregunta llega a la ficha: ' + (d1 && d1.pregunta));
  // Condición de la salida nueva (doble clic en su conector)
  const flujos = await p.evaluate(gid => { const reg = window.__kzModeler ? window.__kzModeler.get('elementRegistry') : null; return reg ? reg.get(gid).outgoing.map(c => ({ id: c.id, tgt: c.target.id, wp: c.waypoints })) : null; }, gid);
  if (flujos) {
    const f = flujos.find(x => x.tgt === 'Act_a_revisar');
    const c = await p.evaluate(() => { const cv = window.__kzModeler.get('canvas'); const vb = cv.viewbox(); const r = document.querySelector('.lienzo').getBoundingClientRect(); return { x: r.x, y: r.y, s: vb.scale, vx: vb.x, vy: vb.y }; });
    const w = f.wp[Math.max(1, Math.floor(f.wp.length / 2)) - 1], w2 = f.wp[Math.max(1, Math.floor(f.wp.length / 2))];
    const px = c.x + ((w.x + w2.x) / 2 - c.vx) * c.s, py = c.y + ((w.y + w2.y) / 2 - c.vy) * c.s;
    await p.mouse.dblclick(px, py); await p.waitForTimeout(250);
    if (await p.$('.djs-direct-editing-parent')) { await p.keyboard.type('Falta información'); await p.keyboard.press('Enter'); await espera(); }
    m = await est(); d1 = m.decisiones.find(d => d.clave === dNueva.clave);
    ok(d1 && d1.salidas.some(s => s.destino === 'a_revisar' && s.condicion === 'Falta información'), 'la condición de la salida llega a la ficha: ' + JSON.stringify(d1 && d1.salidas.map(s => s.condicion)));
  } else ok(false, 'window.__kzModeler no está expuesto para la prueba');
  const erroresDec = await p.$$eval('.revd__i--error', e => e.map(x => x.textContent));
  ok(!erroresDec.length, 'con pregunta, dos salidas y condición ya no hay errores: ' + erroresDec.join(' | '));
  await p.screenshot({ path: 'out/s2-decision-completa.png' });

  /* 2. Deshacer desde el lienzo con Ctrl+Z devuelve la captura (pila de la app). */
  for (let i = 0; i < 6 && (await est()).decisiones.length > nDec0; i++) await deshacerLienzo();
  m = await est();
  ok(m.decisiones.length === nDec0, 'Ctrl+Z en el lienzo quita la decisión agregada');

  /* 3. Evento agregado desde el menú contextual → evento de la actividad anterior. */
  await seleccionar('Act_a_descargar');
  await pad('append.intermediate-event'); await espera();
  m = await est();
  const evs = (m.actividades.a_descargar.eventos || []);
  ok(evs.length === 1 && evs[0].momento === 'despues', 'el evento nuevo queda en «Descargar extracto», después: ' + JSON.stringify(evs));
  await p.screenshot({ path: 'out/s4-evento.png' });
  // Cambiarlo a temporizador con el menú de reemplazo
  const evId = await p.evaluate(() => { const reg = window.__kzModeler.get('elementRegistry'); const e = reg.filter(x => /^bpmn:Intermediate/.test(x.type) && x.type !== 'label'); return e.length ? e[0].id : null; });
  if (evId) {
    await seleccionar(evId); await pad('replace'); await p.waitForSelector('.djs-popup');
    const ops = await p.$$eval('.djs-popup .entry', e => e.map(x => x.getAttribute('data-id')));
    console.log('reemplazos del evento:', ops.join(', '));
    const timer = ops.find(x => /timer/.test(x) && /intermediate/.test(x));
    if (timer) { await p.click('.djs-popup .entry[data-id="' + timer + '"]'); await espera(); }
    m = await est();
    ok((m.actividades.a_descargar.eventos || [])[0] && m.actividades.a_descargar.eventos[0].tipo === 'tiempo', 'reemplazar por temporizador lo vuelve una espera: ' + JSON.stringify(m.actividades.a_descargar.eventos));
  }
  for (let i = 0; i < 4 && ((await est()).actividades.a_descargar.eventos || []).length; i++) await deshacerLienzo();

  /* 4. Cambiar el tipo de tarea con la llave (reemplazo) → tipo de ejecución. */
  await seleccionar('Act_a_descargar'); await pad('replace'); await p.waitForSelector('.djs-popup');
  const opsT = await p.$$eval('.djs-popup .entry', e => e.map(x => x.getAttribute('data-id')));
  console.log('reemplazos de tarea:', opsT.join(', '));
  ok(!opsT.some(x => /subprocess|call-activity|transaction/.test(x)), 'el menú solo ofrece lo que la captura sabe guardar');
  await p.click('.djs-popup .entry[data-id="replace-with-service-task"]'); await espera();
  m = await est();
  ok(m.actividades.a_descargar.ejecucion === 'sistema', 'tarea de servicio → ejecución «sistema»: ' + m.actividades.a_descargar.ejecucion);
  await seleccionar('Act_a_descargar'); await pad('replace'); await p.waitForSelector('.djs-popup');
  await p.click('.djs-popup .entry[data-id="toggle-loop"]'); await espera();
  m = await est();
  ok(!!m.actividades.a_descargar.ciclo, 'marcador de ciclo → la actividad se repite: ' + JSON.stringify(m.actividades.a_descargar.ciclo));
  await p.screenshot({ path: 'out/s5-tipo.png' });

  /* 5. Tarea nueva desde la paleta → actividad en su fase y carril. */
  await p.click('.djs-palette .entry[data-action="create.task"]');
  const env = await box('[data-element-id="Act_a_enviar"]');
  const destX = env.r.x - env.r.width * 0.9, destY = env.y;
  await p.mouse.move(destX - 40, destY, { steps: 4 }); await p.mouse.move(destX, destY, { steps: 4 }); await p.screenshot({ path: 'out/s6a.png' }); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(300);
  console.log('edición directa activa:', !!(await p.$('.djs-direct-editing-parent')), 'destino', destX, destY);
  if (await p.$('.djs-direct-editing-parent')) { await p.keyboard.type('Validar firmas'); await p.keyboard.press('Enter'); }
  await espera();
  m = await est();
  const nueva = Object.entries(m.actividades).find(([k, a]) => a.nombre === 'Validar firmas');
  ok(!!nueva, 'la tarea de la paleta es una actividad nueva: ' + Object.values(m.actividades).map(a => a.nombre).join(' | '));
  if (nueva) {
    const fase = m.fases.find(f => f.actividades.indexOf(nueva[0]) >= 0);
    ok(fase && fase.nombre === 'Cierre', 'queda en la fase donde se soltó: ' + (fase && fase.nombre) + ' · ' + (fase && fase.actividades.join(',')));
    ok(nueva[1].responsable === m.actividades.a_enviar.responsable, 'y con el responsable del carril: ' + nueva[1].responsable);
  }
  await p.screenshot({ path: 'out/s6-tarea-nueva.png' });

  console.log('ERRORES:', errs.length ? errs.join('\n') : 'ninguno');
  console.log(fallas ? fallas + ' FALLAS' : 'TODO OK');
  await b.close();
})();
