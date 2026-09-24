const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const DS = '<SANDBOX>/ds/out/project/components/lib/';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 800 } });
  await ctx.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(DS + (r.request().url().includes('react-dom') ? 'react-dom.production.min.js' : 'react.production.min.js'), 'utf8') }));
  await ctx.route('https://cdn.jsdelivr.net/**', r => { const u = r.request().url(); const f = u.includes('docx') ? require('child_process').execSync('npm root -g').toString().trim() + '/docx/dist/index.iife.js' : path.join(__dirname, 'package/dist/bpmn-modeler.production.min.js'); r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(f, 'utf8') }); });
  await ctx.route(u => u.hostname.startsWith('fonts.'), r => r.fulfill({ contentType: 'text/css', body: '' }));
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  const ok = (c, msg) => console.log((c ? 'OK   ' : 'FALLA') + ' ' + msg);
  await p.goto('file://' + path.join(__dirname, 'out/test.html')); await p.waitForSelector('.tabla-procesos tbody tr');
  await p.click('button:has-text("Nuevo proceso")'); await p.fill('#np-nombre', 'Radicación de facturas'); await p.click('button:has-text("Crear y empezar la captura")');
  await p.click('button[role=tab]:has-text("Actividades")'); await p.waitForTimeout(150);
  await p.screenshot({ path: 'out/n1-vacio.png' });
  ok(await p.locator('.aviso').filter({ hasText: 'Nueva fase' }).count() === 1, 'vacío: explica cómo empezar');
  // Crear tres fases seguidas con Enter
  await p.click('button.kz-phase-nueva');
  for (const f of ['Recepción', 'Validación', 'Pago']) { await p.keyboard.type(f); await p.keyboard.press('Enter'); await p.waitForTimeout(60); }
  await p.keyboard.press('Escape');
  const t = await p.$$eval('.kz-phase__title', ts => ts.map(x => x.textContent.replace(/\d+ actividad(es)?$/, '')));
  ok(t.join('|') === '1Recepción|2Validación|3Pago|Sin fase', 'tres fases seguidas con Enter: ' + t.join(' / '));
  // Listar actividades fase por fase sin tocar el ratón entre una y otra
  const escribir = async (fase, nombres) => { await p.getByRole('textbox', { name: 'Agregar actividad en ' + fase, exact: true }).click(); for (const n of nombres) { await p.keyboard.type(n); await p.keyboard.press('Enter'); await p.waitForTimeout(50); } };
  await escribir('Recepción', ['Recibir factura', 'Registrar radicado']);
  await escribir('Validación', ['Validar requisitos', 'Aprobar pago']);
  await escribir('Pago', ['Programar pago', 'Notificar al proveedor']);
  const codigos = await p.$$eval('[data-clave] .kz-card__id', e => e.map(x => x.textContent));
  ok(codigos.join(',') === 'ACT-01,ACT-02,ACT-03,ACT-04,ACT-05,ACT-06', 'seis actividades numeradas en orden: ' + codigos.join(','));
  await p.screenshot({ path: 'out/n2-listado.png' });
  await p.click('.paso:has-text("Caracterizar")'); await p.waitForTimeout(150);
  ok((await p.textContent('.ficha__t')) === 'Recibir factura', 'Caracterizar empieza por ACT-01');
  await p.fill('#fa-resp', 'Auxiliar de cuentas por pagar'); await p.press('#fa-resp', 'Tab');
  await p.fill('#fa-entr', 'Factura radicada'); await p.press('#fa-entr', 'Tab'); await p.waitForTimeout(100);
  await p.click('.ficha-pie__b--sig'); await p.waitForTimeout(120);
  const sug = await p.$$eval('.ficha .sug', s => s.map(x => x.textContent));
  ok(sug.some(x => x.includes('Factura radicada') && x.includes('entregable de ACT-01')), 'ACT-02 sugiere como entrada el entregable de ACT-01');
  await p.screenshot({ path: 'out/n3-ficha.png' });
  console.log('ERRORES:', errs.length ? errs : 'ninguno');
  await b.close();
})().catch(e => { console.error('FALLO', e.stack); process.exit(1); });
