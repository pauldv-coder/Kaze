// Sin window.claude (archivo abierto en el navegador): las descargas salen directas, con su extensión.
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const DS = '<SANDBOX>/ds/out/project/components/lib/';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, acceptDownloads: true });
  await ctx.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(DS + (r.request().url().includes('react-dom') ? 'react-dom.production.min.js' : 'react.production.min.js'), 'utf8') }));
  await ctx.route('https://cdn.jsdelivr.net/**', r => { const u = r.request().url(); const f = u.includes('docx') ? require('child_process').execSync('npm root -g').toString().trim() + '/docx/dist/index.iife.js' : path.join(__dirname, 'package/dist/bpmn-modeler.production.min.js'); r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(f, 'utf8') }); });
  await ctx.route(u => u.hostname.startsWith('fonts.'), r => r.fulfill({ contentType: 'text/css', body: '' }));
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (c, m) => console.log((c ? 'OK   ' : 'FALLA') + ' ' + m);
  await p.goto('file://' + path.join(__dirname, 'out/test.html')); await p.waitForSelector('.tabla-procesos tbody tr');
  await p.click('.enlace-fila'); await p.waitForSelector('.tabs');
  await p.click('button[role=tab]:has-text("Diagrama")'); await p.waitForSelector('.djs-element', { timeout: 10000 });
  let [d] = await Promise.all([p.waitForEvent('download', { timeout: 10000 }), p.click('button:has-text("Exportar .bpmn")')]);
  ok(/\.bpmn$/.test(d.suggestedFilename()), '.bpmn directo: ' + d.suggestedFilename());
  const xml = fs.readFileSync(await d.path(), 'utf8');
  ok(/<bpmn:definitions/.test(xml), 'es XML BPMN (' + xml.length + ' bytes)');
  await p.click('.kz-head button:has-text("Exportar documento")'); await p.waitForSelector('.modal');
  [d] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click('.modal__pie button:has-text("Descargar Word")')]);
  console.log('     Word directo, nombre sugerido:', d.suggestedFilename(), '(el Chromium headless de este entorno cambia por «download» los nombres con tildes)');
  const st = fs.statSync(await d.path()); ok(st.size > 20000, 'tamaño ' + st.size);
  await p.waitForSelector('.doc-ok'); console.log('     aviso:', (await p.textContent('.doc-ok')).trim());
  console.log('ERRORES:', errs.length ? errs : 'ninguno');
  await b.close();
})().catch(e => { console.error('FALLO', e.stack); process.exit(1); });
