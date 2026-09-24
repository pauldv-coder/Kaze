const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const DS = '<SANDBOX>/ds/out/project/components/lib/';
const FAKE = `window.claude = { use: async n => n === 'downloads' ? { save: async r => { window.__d = (window.__d || []).concat([r.filename]); return { status: 'saved' }; } } : null };`;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(DS + (r.request().url().includes('react-dom') ? 'react-dom.production.min.js' : 'react.production.min.js'), 'utf8') }));
  await ctx.route('https://cdn.jsdelivr.net/**', r => { const u = r.request().url(); const f = u.includes('docx') ? require('child_process').execSync('npm root -g').toString().trim() + '/docx/dist/index.iife.js' : path.join(__dirname, 'package/dist/bpmn-modeler.production.min.js'); r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(f, 'utf8') }); });
  await ctx.route(u => u.hostname.startsWith('fonts.'), r => r.fulfill({ contentType: 'text/css', body: '' }));
  await ctx.addInitScript(FAKE);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  const ok = (c, msg) => console.log((c ? 'OK   ' : 'FALLA') + ' ' + msg);
  await p.goto('file://' + path.join(__dirname, 'out/test.html')); await p.waitForSelector('.tabla-procesos tbody tr');
  await p.click('.enlace-fila'); await p.waitForSelector('.tabs');
  await p.click('button[role=tab]:has-text("Actividades")'); await p.waitForSelector('.kz-board--compacto');
  // Mover «Revisar y aprobar» (origen de d_aprueba) al final de Cuadre con el teclado → la decisión pasa a Revisar
  await p.locator('[data-clave="a_revisar"]').focus();
  await p.keyboard.press('Alt+ArrowLeft'); await p.waitForTimeout(120);
  const enCuadre = await p.evaluate(() => !!document.querySelector('[data-fase="f_cuadre"] [data-clave="a_revisar"]'));
  ok(enCuadre, 'Alt+← pasa «Revisar y aprobar» a Cuadre');
  ok(await p.locator('button[role=tab]:has-text("Actividades") .tab__alerta').count() === 1, 'la pestaña Actividades avisa «!»');
  await p.click('.paso:has-text("Caracterizar")'); await p.waitForTimeout(120);
  await p.locator('.lf__i').filter({ hasText: 'Revisar y aprobar' }).click(); await p.waitForTimeout(150);
  ok(await p.locator('.ficha .kz-dec--revisar').count() >= 1, 'la decisión queda en Revisar dentro de la ficha (no se borra)');
  await p.click('.paso:has-text("Listar")'); await p.waitForTimeout(120);
  // Diagrama y exportación
  await p.click('button[role=tab]:has-text("Diagrama")'); await p.waitForSelector('.djs-element', { timeout: 8000 });
  ok(await p.locator('.djs-element').count() > 10, 'el diagrama se dibuja');
  const errDiag = await p.$$eval('.revd__i--error', e => e.map(x => x.textContent));
  console.log('     errores del diagrama:', errDiag);
  ok(errDiag.length > 0 && await p.isDisabled('button:has-text("Exportar .bpmn")'), 'con el flujo roto no se exporta el .bpmn');
  // Deshacer el movimiento: el diagrama queda sin errores y se puede exportar
  await p.click('.kz-head button[aria-label^="Deshacer"]'); await p.waitForTimeout(400);
  ok(!(await p.isDisabled('button:has-text("Exportar .bpmn")')), 'al deshacer el movimiento se puede exportar');
  await p.click('button:has-text("Exportar .bpmn")'); await p.waitForTimeout(200);
  ok((await p.evaluate(() => window.__d || [])).some(f => f.endsWith('.zip')), 'exporta el .bpmn (zip)');
  // Aprobación → bloqueo
  await p.click('button[role=tab]:has-text("Aprobación")'); await p.waitForSelector('.aprob-prep');
  await p.fill('#ap-rem-n', 'Paul Díaz'); await p.fill('#ap-rem-c', 'paul@ejemplo.co'); await p.click('.aprob-prep h2'); await p.waitForTimeout(250);
  await p.click('.aprob-prep button.kz-btn--primario'); await p.waitForSelector('.aprob-pasos');
  await p.click('button[role=tab]:has-text("Actividades")'); await p.waitForTimeout(150);
  ok(await p.locator('.kz-board--lectura').count() === 1, 'en revisión el tablero queda en solo lectura');
  ok(await p.locator('.kz-alta').count() === 0 && await p.locator('.kz-grip').count() === 0, 'sin altas ni asas');
  await p.locator('[data-clave="a_cargar"]').click(); await p.waitForTimeout(150);
  ok(await p.locator('.ficha').count() === 1 && await p.locator('#fa-resp').isDisabled(), 'un clic abre la ficha, que no se puede editar');
  // Aprobar y crear To-Be
  await p.click('button[role=tab]:has-text("Aprobación")'); await p.waitForSelector('.aprob-pasos');
  for (let i = 0; i < 4; i++) { await p.click('.kz-appr__item button:has-text("Registrar a mano") >> nth=0'); await p.click('.rmanual button:has-text("Registrar")'); await p.waitForTimeout(250); }
  ok(/Aprobado/.test(await p.textContent('.kz-head__estado')), 'As-Is aprobado (visto bueno y aprobación final)');
  await p.click('.kz-versel__btn'); await p.click('.kz-versel__op:has-text("Crear To-Be")'); await p.click('.aviso button:has-text("Crear To-Be")'); await p.waitForTimeout(200);
  await p.click('button[role=tab]:has-text("Actividades")'); await p.waitForTimeout(150);
  ok(await p.locator('.paso[aria-pressed="true"]:has-text("Caracterizar")').count() === 1, 'Actividades recuerda la última subvista (Caracterizar)');
  await p.click('.paso:has-text("Listar")'); await p.waitForTimeout(150);
  await p.screenshot({ path: 'out/f-tobe.png' });
  const verTxt = (await p.textContent('.kz-versel__btn')).replace(/\s+/g, ' ').trim(), estTxt = (await p.textContent('.kz-head__estado')).replace(/\s+/g, ' ').trim();
  ok(/To-Be/.test(verTxt) && /Borrador/.test(estTxt), 'la lista muestra el To-Be: ' + verTxt + ' · ' + estTxt);
  ok(await p.locator('.kz-board--compacto:not(.kz-board--lectura)').count() === 1, 'To-Be: el tablero vuelve a ser editable');
  const alta = p.locator('[data-fase] .kz-alta').first();
  await alta.click(); await p.keyboard.type('Validar firmas digitales'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  await p.click('.ver-tabla'); await p.waitForTimeout(150);
  ok(await p.locator('.grid-edit th:has-text("Cambio")').count() === 1 && await p.locator('.cambio--nueva').count() >= 1, 'To-Be: la tabla marca la nueva frente al As-Is');
  // Teléfono: ancho por pestaña y subvista
  await p.setViewportSize({ width: 400, height: 860 }); await p.waitForTimeout(150);
  const anchos = [];
  for (const t of ['Resumen', 'Fases', 'Actividades', 'Diagrama', 'Aprobación']) {
    await p.click('button[role=tab]:has-text("' + t + '")'); await p.waitForTimeout(200);
    anchos.push(t + ' ' + await p.evaluate(() => document.documentElement.scrollWidth));
    if (t === 'Actividades') for (const s of ['Listar', 'Caracterizar', 'Tabla']) {
      await p.click(s === 'Tabla' ? '.ver-tabla' : '.paso:has-text("' + s + '")'); await p.waitForTimeout(200);
      anchos.push('  ' + s + ' ' + await p.evaluate(() => document.documentElement.scrollWidth));
    }
  }
  ok(anchos.every(x => / (400)$/.test(x) || / ([0-3]\d\d)$/.test(x)), 'sin desborde a 400 px: ' + anchos.join(' · '));
  console.log('ERRORES:', errs.length ? errs : 'ninguno');
  await b.close();
})().catch(e => { console.error('FALLO', e.stack); process.exit(1); });
