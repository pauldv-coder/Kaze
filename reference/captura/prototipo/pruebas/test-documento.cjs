const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const DS = '<SANDBOX>/ds/out/project/components/lib/';
const FAKE = `window.claude = { use: async n => n === 'downloads' ? { save: async r => { window.__d = (window.__d || []).concat([r.filename]); window.__datos = r.data; return { status: 'saved' }; } } : null };`;
const DOCX = require('child_process').execSync('npm root -g').toString().trim() + '/docx/dist/index.iife.js';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  let pedidosDocx = 0;
  await ctx.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(DS + (r.request().url().includes('react-dom') ? 'react-dom.production.min.js' : 'react.production.min.js'), 'utf8') }));
  await ctx.route('https://cdn.jsdelivr.net/**', r => { const u = r.request().url(); if (u.includes('docx')) pedidosDocx += 1; const f = u.includes('docx') ? DOCX : path.join(__dirname, 'package/dist/bpmn-modeler.production.min.js'); r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(f, 'utf8') }); });
  await ctx.route(u => u.hostname.startsWith('fonts.'), r => r.fulfill({ contentType: 'text/css', body: '' }));
  await ctx.addInitScript(FAKE);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  const ok = (c, msg) => console.log((c ? 'OK   ' : 'FALLA') + ' ' + msg);
  const bajar = async destino => {
    const b64 = await p.evaluate(async () => {
      const d = window.__datos; const buf = d instanceof Blob ? await d.arrayBuffer() : d.buffer ? d.buffer : d;
      const u = new Uint8Array(buf); let s = '';
      for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
      return btoa(s);
    });
    fs.writeFileSync(destino, Buffer.from(b64, 'base64'));
    return fs.statSync(destino).size;
  };
  await p.goto('file://' + path.join(__dirname, 'out/test.html')); await p.waitForSelector('.tabla-procesos tbody tr');
  await p.click('.enlace-fila'); await p.waitForSelector('.tabs');
  ok(pedidosDocx === 0, 'docx no se carga al abrir el proceso');

  // Un formato con archivo para probar el .zip
  await p.click('button[role=tab]:has-text("Actividades")');
  await p.click('.paso:has-text("Caracterizar")');
  await p.locator('.lf__i').filter({ hasText: 'Revisar y aprobar' }).click(); await p.waitForTimeout(150);
  await p.click('button:has-text("+ Adjuntar formato")');
  await p.setInputFiles('.fmt-form input[type=file]', { name: 'Lista de chequeo de cierre.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% prueba\n') }); await p.waitForTimeout(300);
  await p.fill('.fmt-form input[id$="-fmc"]', 'FT-CON-04');
  await p.click('.fmt-form button:has-text("Guardar formato")'); await p.waitForTimeout(300);
  console.log('formatos de ACT-06:', await p.$$eval('.fmt__nom', e => e.map(x => x.textContent)));

  // Modal
  await p.click('.kz-head button:has-text("Exportar documento")');
  await p.waitForSelector('.modal');
  await p.screenshot({ path: 'out/e1-modal.png' });
  console.log('cuenta:', await p.$eval('.doc-cuenta', e => e.textContent));
  console.log('notas:', await p.$$eval('.doc-notas li', e => e.map(x => x.textContent)));
  console.log('por fase marcado:', await p.$eval('.doc-check input', e => e.checked).catch(() => 'sin opción'));
  const botones = await p.$$eval('.modal__pie button', e => e.map(x => x.textContent));
  ok(botones.some(t => /anexos/.test(t)), 'botón del .zip visible: ' + botones.join(' | '));

  // Word en Carta
  const t0 = Date.now();
  await p.click('.modal__pie button:has-text("Descargar Word")');
  await p.waitForSelector('.doc-ok', { timeout: 20000 });
  console.log('tiempo Word:', Date.now() - t0, 'ms ·', await p.$eval('.doc-ok', e => e.textContent));
  const tam = await bajar(path.join(__dirname, 'out/doc-carta.docx'));
  ok(tam > 20000, 'docx Carta: ' + tam + ' bytes · ' + (await p.evaluate(() => window.__d)).slice(-1)[0]);

  // A4 con hoja por fase y anexos
  await p.click('.doc-op button:has-text("A4")');
  const chk = await p.$('.doc-check input');
  if (chk && !(await chk.isChecked())) await chk.check();
  await p.click('.modal__pie button:has-text("anexos")');
  await p.waitForFunction(() => (window.__d || []).some(n => /\.zip$/.test(n)), null, { timeout: 20000 });
  await p.waitForSelector('.doc-ok');
  const tz = await bajar(path.join(__dirname, 'out/doc-a4.zip'));
  ok(tz > 20000, 'zip A4: ' + tz + ' bytes · ' + (await p.evaluate(() => window.__d)).slice(-1)[0]);
  ok(pedidosDocx === 1, 'docx se pidió una sola vez: ' + pedidosDocx);

  // Versión aprobada: aprobaciones en la portada y control de cambios
  await p.click('.modal__pie button:has-text("Cerrar")');
  await p.click('button[role=tab]:has-text("Aprobación")'); await p.waitForSelector('.aprob-prep');
  await p.fill('#ap-rem-n', 'Paul Díaz'); await p.fill('#ap-rem-c', 'paul@ejemplo.co'); await p.click('.aprob-prep h2'); await p.waitForTimeout(250);
  await p.click('.aprob-prep button.kz-btn--primario'); await p.waitForSelector('.aprob-pasos');
  for (let i = 0; i < 4; i++) { await p.click('.kz-appr__item button:has-text("Registrar a mano") >> nth=0'); await p.click('.rmanual button:has-text("Registrar")'); await p.waitForTimeout(250); }
  await p.waitForTimeout(900);
  console.log('     estado:', await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('kaze-captura:procesos:v1')); return d.p_conciliacion.versiones.asis.estado; }));
  await p.click('.kz-head button:has-text("Exportar documento")'); await p.waitForSelector('.modal');
  await p.click('.modal__pie button:has-text("Descargar Word")');
  await p.waitForFunction(() => (window.__d || []).filter(n => /\.docx$/.test(n)).length >= 2, null, { timeout: 20000 });
  await p.waitForSelector('.doc-ok');
  await bajar(path.join(__dirname, 'out/doc-aprobado.docx'));
  const xml = require('child_process').execSync('unzip -p out/doc-aprobado.docx word/document.xml', { cwd: __dirname }).toString();
  ok(/Aprobaciones/.test(xml) && /Aprobó/.test(xml) && /Dio su visto bueno/.test(xml) && />Visto bueno</.test(xml) && />Aprobación</.test(xml), 'la portada lista las aprobaciones por etapa');
  ok(/Elaboró/.test(xml) && /Paul Díaz/.test(xml), 'la portada dice quién elaboró');
  ok(/8\. Control de cambios/.test(xml) && /Aprobada por Rosa Álvarez \(Jefe de contabilidad\) y Laura Gómez \(Gerente financiera\), con el visto bueno de Marta Ríos \(Analista contable\) y Carlos Méndez \(Jefe de tesorería\)/.test(xml), 'hay control de cambios con aprobadores y vistos buenos');
  ok(/Aprobado el /.test(xml), 'el estado dice cuándo se aprobó');

  // Móvil
  await p.setViewportSize({ width: 400, height: 860 });
  await p.waitForTimeout(200);
  await p.screenshot({ path: 'out/e2-modal-movil.png' });
  const desborde = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok(!desborde, 'sin desborde horizontal a 400 px');
  await p.click('.modal__pie button:has-text("Cerrar")');
  await p.screenshot({ path: 'out/e3-cabecera-movil.png' });
  console.log('ERRORES:', errs.length ? errs : 'ninguno');
  await b.close();
})().catch(e => { console.error('FALLO', e.stack); process.exit(1); });
