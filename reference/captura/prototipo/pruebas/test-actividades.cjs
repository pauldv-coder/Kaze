const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const DS = '<SANDBOX>/ds/out/project/components/lib/';
const FAKE = `window.claude = { use: async n => n === 'downloads' ? { save: async r => ({ status: 'saved' }) } : null };`;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(DS + (r.request().url().includes('react-dom') ? 'react-dom.production.min.js' : 'react.production.min.js'), 'utf8') }));
  await ctx.route('https://cdn.jsdelivr.net/**', r => { const u = r.request().url(); const f = u.includes('docx') ? require('child_process').execSync('npm root -g').toString().trim() + '/docx/dist/index.iife.js' : path.join(__dirname, 'package/dist/bpmn-modeler.production.min.js'); r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(f, 'utf8') }); });
  await ctx.route(u => u.hostname.startsWith('fonts.'), r => r.fulfill({ contentType: 'text/css', body: '' }));
  await ctx.addInitScript(FAKE);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  const ok = (c, msg) => console.log((c ? 'OK   ' : 'FALLA') + ' ' + msg);
  const estado = () => p.evaluate(() => Array.from(document.querySelectorAll('[data-fase]')).map(c => (c.querySelector('.kz-phase__title') || {}).textContent + ': ' +
    Array.from(c.querySelectorAll('[data-clave]')).map(el => el.querySelector('.kz-card__id').textContent.replace('Sin número', '') + ' ' + ((el.querySelector('.kz-card__name') || {}).textContent || '[editando]')).join(' | ')).join('\n'));
  const brindis = () => p.evaluate(() => (document.querySelector('.brindis') || {}).textContent || '');
  await p.goto('file://' + path.join(__dirname, 'out/test.html')); await p.waitForSelector('.tabla-procesos tbody tr');
  await p.click('.enlace-fila'); await p.waitForSelector('.tabs');
  await p.click('button[role=tab]:has-text("Actividades")');
  await p.waitForSelector('.kz-board--compacto');
  ok(await p.locator('.paso[aria-pressed="true"]').textContent().then(t => t.includes('Listar y agrupar')), 'abre en «1 · Listar y agrupar»');
  console.log(await estado());
  await p.screenshot({ path: 'out/a1-listar.png' });

  // Alta en Cuadre
  await p.locator('[data-fase="f_cuadre"] .kz-alta').click();
  await p.keyboard.type('Clasificar diferencias'); await p.keyboard.press('Enter'); await p.waitForTimeout(120);
  const e1 = await estado();
  ok(/ACT-06 Clasificar diferencias/.test(e1) && /ACT-07 Revisar y aprobar/.test(e1), 'alta en Cuadre al final: ACT-06, lo de Cierre se renumera');
  ok(await p.evaluate(() => document.activeElement.classList.contains('kz-alta')), 'el cursor queda en «+ Agregar actividad»');
  // Pegar varias en Sin fase
  await p.locator('[data-fase="__sin"] .kz-alta').click();
  await p.evaluate(() => { const dt = new DataTransfer(); dt.setData('text/plain', '- Pedir soporte al cliente\n2. Notificar a tesorería'); document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
  await p.waitForTimeout(120);
  const e2 = await estado();
  ok(/Pedir soporte al cliente/.test(e2) && /Notificar a tesorería/.test(e2), 'pegar dos líneas en «Sin fase» crea dos actividades');
  // Renombrar con clic en el nombre
  const cardNombre = p.locator('[data-fase="f_prep"] [data-clave="a_cargar"] .kz-card__name');
  await cardNombre.click(); await p.keyboard.press('Control+A'); await p.keyboard.type('Cargar extracto en Siigo'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  ok((await p.locator('[data-clave="a_cargar"] .kz-card__name').textContent()) === 'Cargar extracto en Siigo', 'clic en el nombre lo corrige en su sitio');
  // Nueva fase
  await p.click('button.kz-phase-nueva'); await p.keyboard.type('Seguimiento'); await p.keyboard.press('Enter'); await p.waitForTimeout(120); await p.keyboard.press('Escape');
  const titulos = await p.$$eval('.kz-phase__title', ts => ts.map(t => t.textContent));
  ok(titulos.some(t => /^4Seguimiento/.test(t)), '«+ Nueva fase» crea la fase 4 antes de «Sin fase» → ' + titulos.join(' / '));
  // Arrastrar «Pedir soporte al cliente» (Sin fase) a Seguimiento
  const box = async s => { const r = await p.locator(s).boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, r }; };
  const claveDe = async nombre => p.evaluate(n => { const el = Array.from(document.querySelectorAll('[data-clave]')).find(x => (x.querySelector('.kz-card__name') || {}).textContent === n); return el && el.getAttribute('data-clave'); }, nombre);
  const kSoporte = await claveDe('Pedir soporte al cliente');
  const faseSeg = await p.evaluate(() => Array.from(document.querySelectorAll('[data-fase]')).find(c => /Seguimiento/.test(c.textContent)).getAttribute('data-fase'));
  await p.evaluate(() => { const b = document.querySelector('.kz-board'); b.scrollLeft = b.scrollWidth; });
  const o = await box('[data-clave="' + kSoporte + '"]'); const dst = await box('[data-fase="' + faseSeg + '"] .kz-phase__cards');
  await p.mouse.move(o.x, o.y + 4); await p.mouse.down(); await p.mouse.move(o.x - 15, o.y, { steps: 3 }); await p.mouse.move(dst.x, dst.r.y + 10, { steps: 15 }); await p.mouse.up(); await p.waitForTimeout(150);
  const e3 = await estado();
  ok(/Seguimiento\d+ actividad(es)?: ACT-\d+ Pedir soporte al cliente/.test(e3), 'arrastrar de «Sin fase» a Seguimiento le da número');
  console.log(e3);
  await p.screenshot({ path: 'out/a2-listar-editado.png' });
  // Supr elimina, Ctrl+Z la recupera
  const kNot = await claveDe('Notificar a tesorería');
  await p.locator('[data-clave="' + kNot + '"]').focus(); await p.keyboard.press('Delete'); await p.waitForTimeout(150);
  ok(!(await estado()).includes('Notificar a tesorería'), 'Suprimir la elimina · aviso: ' + await brindis());
  await p.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
  await p.keyboard.press('Control+z'); await p.waitForTimeout(150);
  ok((await estado()).includes('Notificar a tesorería'), 'Ctrl+Z la recupera');
  // Criterios de una fase desde el tablero
  await p.locator('[data-fase="f_cuadre"] .kz-phase__edit').click(); await p.waitForTimeout(200);
  ok(await p.locator('button[role=tab][aria-selected="true"]').textContent().then(t => t.startsWith('Fases')), '«Criterios» abre la pestaña Fases');
  ok(await p.evaluate(() => document.activeElement && document.activeElement.id === 'fo-f_cuadre'), 'y pone el foco en el objetivo de Cuadre');
  const sugs = await p.$$eval('[data-fase-ed="f_cuadre"] .sug', s => s.map(x => x.textContent));
  console.log('     sugerencias en Cuadre:', sugs);
  await p.screenshot({ path: 'out/a3-fases.png', fullPage: false });
  const sugEnt = p.locator('[data-fase-ed="f_cuadre"] .sug').filter({ hasText: 'Agregar' });
  if (await sugEnt.count()) { await sugEnt.click(); await p.waitForTimeout(100); ok((await p.inputValue('#fg-f_cuadre')).includes('Reporte de partidas sin cruce'), 'agregar entregables de sus actividades'); }
  // Volver: la subvista se recuerda
  await p.click('button[role=tab]:has-text("Actividades")'); await p.waitForTimeout(100);
  ok(await p.locator('.kz-board--compacto').count() === 1, 'al volver a Actividades sigue en Listar');
  // Clic en la tarjeta (fuera del nombre) abre la ficha
  const kClas = await claveDe('Clasificar diferencias');
  const top = await box('[data-clave="' + kClas + '"] .kz-card__top'); await p.mouse.click(top.r.x + 70, top.y); await p.waitForTimeout(200);
  ok(await p.locator('.paso[aria-pressed="true"]').textContent().then(t => t.includes('Caracterizar')), 'clic en la tarjeta abre «2 · Caracterizar»');
  ok((await p.textContent('.ficha__t')) === 'Clasificar diferencias', 'con esa actividad en la ficha');
  ok((await p.textContent('.lf__i[aria-current="true"] .lf__nom')) === 'Clasificar diferencias', 'y marcada en la lista de la izquierda');
  console.log('     cabecera:', await p.textContent('.ficha__meta'), '|', await p.textContent('.ficha__prog'));
  const sugF = await p.$$eval('.ficha .sug', s => s.map(x => x.textContent));
  console.log('     sugerencias:', sugF);
  await p.screenshot({ path: 'out/a4-caracterizar.png' });
  const antes = await p.textContent('.ficha__prog');
  const su = p.locator('.ficha .sug').filter({ hasText: 'entregable de' });
  if (await su.count()) { await su.click(); await p.waitForTimeout(100); ok((await p.inputValue('#fa-ent')).length > 0, 'la sugerencia llena «Entradas»: ' + await p.inputValue('#fa-ent')); }
  await p.fill('#fa-resp', 'Analista contable'); await p.press('#fa-resp', 'Tab'); await p.waitForTimeout(100);
  ok(antes !== await p.textContent('.ficha__prog'), 'el avance cambia: ' + antes + ' → ' + await p.textContent('.ficha__prog'));
  // Siguiente: foco se queda en el botón
  const sigBtn = p.locator('.ficha-pie__b--sig');
  const nomSig = await sigBtn.locator('.ficha-pie__n').textContent();
  await sigBtn.click(); await p.waitForTimeout(150);
  ok(nomSig.endsWith(await p.textContent('.ficha__t')), 'Siguiente → ' + nomSig);
  ok(await p.evaluate(() => document.activeElement && document.activeElement.classList.contains('ficha-pie__b--sig')), 'el foco sigue en «Siguiente»');
  await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  console.log('     con Enter otra vez:', await p.textContent('.ficha__t'));
  // Tabla
  await p.click('.ver-tabla'); await p.waitForSelector('.grid-edit');
  ok(await p.locator('.grid-edit th').allTextContents().then(t => t.includes('Datos')), 'Tabla con columna «Datos»');
  await p.locator('.grid-edit tbody tr').first().locator('.celda-id').click(); await p.waitForTimeout(150);
  ok(await p.locator('.ficha').count() === 1, 'el número en la tabla abre la ficha');
  // Resumen → avisos
  await p.click('button[role=tab]:has-text("Resumen")');
  const av = await p.$$eval('.avisos__t', b => b.map(x => x.textContent));
  console.log('     avisos:', av);
  await p.locator('.avisos__t').filter({ hasText: 'sin responsable' }).click(); await p.waitForTimeout(150);
  ok(await p.locator('.ficha').count() === 1, '«sin responsable» abre la ficha de la primera sin responsable: ' + await p.textContent('.ficha__t'));
  await p.click('button[role=tab]:has-text("Resumen")');
  await p.locator('.avisos__t').filter({ hasText: 'sin fase' }).click(); await p.waitForTimeout(150);
  ok(await p.locator('.kz-board--compacto').count() === 1, '«sin fase» abre Listar y agrupar');
  // Persistencia
  await p.waitForTimeout(900); await p.reload(); await p.waitForSelector('.tabla-procesos tbody tr'); await p.click('.enlace-fila'); await p.click('button[role=tab]:has-text("Actividades")'); await p.waitForTimeout(150);
  const e4 = await estado();
  ok(e4.includes('Seguimiento') && e4.includes('Cargar extracto en Siigo') && e4.includes('Clasificar diferencias'), 'todo persiste tras recargar');
  // Teléfono
  await p.setViewportSize({ width: 400, height: 860 }); await p.waitForTimeout(150);
  const anchoL = await p.evaluate(() => document.documentElement.scrollWidth);
  await p.screenshot({ path: 'out/a5-movil-listar.png' });
  await p.click('.paso:has-text("Caracterizar")'); await p.waitForTimeout(150);
  const anchoC = await p.evaluate(() => document.documentElement.scrollWidth);
  ok(await p.locator('#ficha-ir').isVisible() && !(await p.locator('.lf').isVisible()), 'en teléfono: selector en vez de lista');
  ok(anchoL <= 400 && anchoC <= 400, 'sin desborde horizontal a 400 px (' + anchoL + ', ' + anchoC + ')');
  await p.screenshot({ path: 'out/a6-movil-ficha.png', fullPage: true });
  console.log('ERRORES:', errs.length ? errs : 'ninguno');
  await b.close();
})().catch(e => { console.error('FALLO', e.stack); process.exit(1); });
