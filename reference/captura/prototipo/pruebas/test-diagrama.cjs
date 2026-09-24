const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const DS = '<SANDBOX>/ds/out/project/components/lib/';
const FAKE = `window.claude = { use: async n => n === 'downloads' ? { save: async r => { window.__d = (window.__d || []).concat([r.filename]); return { status: 'saved' }; } } : null };`;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 } });
  await ctx.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(DS + (r.request().url().includes('react-dom') ? 'react-dom.production.min.js' : 'react.production.min.js'), 'utf8') }));
  await ctx.route('https://cdn.jsdelivr.net/**', r => { const u = r.request().url(); const f = u.includes('docx') ? require('child_process').execSync('npm root -g').toString().trim() + '/docx/dist/index.iife.js' : path.join(__dirname, 'package/dist/bpmn-modeler.production.min.js'); r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(f, 'utf8') }); });
  await ctx.route(u => u.hostname.startsWith('fonts.'), r => r.fulfill({ contentType: 'text/css', body: '' }));
  await ctx.addInitScript(FAKE);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  const ok = (c, msg) => console.log((c ? 'OK   ' : 'FALLA') + ' ' + msg);
  await p.goto('file://' + path.join(__dirname, 'out/test.html')); await p.waitForSelector('.tabla-procesos tbody tr');
  await p.click('.enlace-fila'); await p.waitForSelector('.tabs');
  await p.click('button[role=tab]:has-text("Diagrama")'); await p.waitForSelector('.djs-element', { timeout: 10000 }); await p.waitForTimeout(400);
  await p.screenshot({ path: 'out/c1-diagrama.png' });
  // Íconos arriba a la derecha
  const iconos = await p.$$eval('.kz-lienzo-icono', e => e.map(x => x.getAttribute('class').replace('kz-lienzo-icono kz-lienzo-icono--', '')));
  const cuenta = {}; iconos.forEach(i => { cuenta[i] = (cuenta[i] || 0) + 1; });
  ok(cuenta.persona >= 6 && cuenta.sistema === 1 && cuenta.hoja === 2, 'íconos en tareas: ' + JSON.stringify(cuenta));
  // Paleta reducida
  console.log('paleta:', await p.$$eval('.djs-palette .entry', e => e.map(x => x.getAttribute('title'))));
  // Ningún conector pasa por dentro de una forma (según el lienzo)
  const cruces = () => p.evaluate(() => {
    const reg = window.__kzModeler && window.__kzModeler.get('elementRegistry');
    return null;
  });
  // Mover una tarea 60px a la derecha
  const box = async sel => { const r = await p.locator(sel).first().boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, r }; };
  const t = await box('[data-element-id="Act_a_cargar"]');
  await p.mouse.move(t.x, t.y + 20); await p.mouse.down(); await p.mouse.move(t.x + 30, t.y + 20, { steps: 5 }); await p.mouse.move(t.x + 60, t.y + 20, { steps: 5 }); await p.mouse.up();
  await p.waitForTimeout(1600);
  const guardado = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('kaze-captura:procesos:v1')); return d.p_conciliacion.versiones.asis.diagrama; });
  ok(guardado && guardado.formas && guardado.formas.Act_a_cargar && guardado.formas.Act_a_cargar.dx > 20, 'mover una tarea guarda su ajuste: ' + JSON.stringify(guardado && guardado.formas));
  await p.screenshot({ path: 'out/c2-movida.png' });
  // Renombrar con doble clic
  const t2 = await box('[data-element-id="Act_a_archivar"]');
  await p.mouse.dblclick(t2.x, t2.y); await p.waitForTimeout(200);
  const editando = await p.$('.djs-direct-editing-parent');
  ok(!!editando, 'doble clic abre la edición del nombre');
  if (editando) {
    await p.keyboard.press('Control+A'); await p.keyboard.type('Archivar conciliación firmada');
    await p.mouse.click(20, 900); await p.waitForTimeout(1600);
    const nombre = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('kaze-captura:procesos:v1')); return d.p_conciliacion.versiones.asis.actividades.a_archivar.nombre; });
    ok(nombre === 'Archivar conciliación firmada', 'el nombre llega a la captura: ' + nombre);
  }
  // Pasar una tarea a otro carril cambia su responsable
  const t3 = await box('[data-element-id="Act_a_registrar"]');
  const lane = await box('[data-element-id="Carril_jefe_de_contabilidad"]');
  await p.mouse.move(t3.x, t3.y + 20); await p.mouse.down(); await p.mouse.move(t3.x, t3.y + 60, { steps: 5 }); await p.mouse.move(t3.x, lane.r.y + 90, { steps: 8 }); await p.mouse.up();
  await p.waitForTimeout(1600);
  const resp = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('kaze-captura:procesos:v1')); return d.p_conciliacion.versiones.asis.actividades.a_registrar.responsable; });
  ok(resp === 'Jefe de contabilidad', 'cambiar de carril cambia el responsable: ' + resp + ' · aviso: ' + await p.evaluate(() => (document.querySelector('.brindis') || {}).textContent));
  await p.screenshot({ path: 'out/c3-carril.png' });
  // Deshacer con Ctrl+Z (fuera de campos)
  await p.mouse.click(20, 900); await p.keyboard.press('Control+z'); await p.waitForTimeout(700);
  const resp2 = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('kaze-captura:procesos:v1')); return d.p_conciliacion.versiones.asis.actividades.a_registrar.responsable; });
  ok(resp2 === 'Analista contable', 'Ctrl+Z lo devuelve: ' + resp2);
  // Restablecer diseño
  await p.click('button:has-text("Restablecer diseño")'); await p.waitForTimeout(700);
  const aj = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('kaze-captura:procesos:v1')); return d.p_conciliacion.versiones.asis.diagrama; });
  ok(!aj.formas || !Object.keys(aj.formas).length, 'restablecer borra los ajustes');
  console.log('ERRORES:', errs.length ? errs : 'ninguno');
  await b.close();
})().catch(e => { console.error('FALLO', e.stack); process.exit(1); });
