// Cabecera nueva y flujo de aprobación de punta a punta: contactos, envío, fotografía, respuestas pegadas.
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const DS = '<SANDBOX>/ds/out/project/components/lib/';
const FAKE = `window.__KZ_PRUEBA = true; window.claude = { use: async n => n === 'downloads' ? { save: async r => { window.__d = (window.__d || []).concat([r.filename]); window.__datos = r.data; return { status: 'saved' }; } } : null };`;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  await ctx.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(DS + (r.request().url().includes('react-dom') ? 'react-dom.production.min.js' : 'react.production.min.js'), 'utf8') }));
  await ctx.route('https://cdn.jsdelivr.net/**', r => { const u = r.request().url(); const f = u.includes('docx') ? require('child_process').execSync('npm root -g').toString().trim() + '/docx/dist/index.iife.js' : path.join(__dirname, 'package/dist/bpmn-modeler.production.min.js'); r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(f, 'utf8') }); });
  await ctx.route(u => u.hostname.startsWith('fonts.'), r => r.fulfill({ contentType: 'text/css', body: '' }));
  await ctx.addInitScript(FAKE);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  let fallas = 0;
  const ok = (c, msg) => { if (!c) fallas++; console.log((c ? 'OK   ' : 'FALLA') + ' ' + msg); };
  const est = async () => { await p.waitForTimeout(900); return p.evaluate(() => { const d = JSON.parse(localStorage.getItem('kaze-captura:procesos:v1')); return d.p_conciliacion; }); };
  const bajarTexto = () => p.evaluate(async () => { const d = window.__datos; return d instanceof Blob ? await d.text() : String(d); });

  await p.goto('file://' + path.join(__dirname, 'out/test.html')); await p.waitForSelector('.tabla-procesos tbody tr');
  await p.click('.enlace-fila'); await p.waitForSelector('.tabs');

  /* Cabecera */
  const estado = await p.textContent('.kz-head__estado');
  ok(/Estado\s*Borrador/.test(estado), 'el estado va arriba a la derecha: ' + estado.trim());
  const cajaEstado = await p.locator('.kz-head__estado').boundingBox();
  ok(cajaEstado.x + cajaEstado.width > 1300 && cajaEstado.y < 60, 'posición del estado: x=' + Math.round(cajaEstado.x) + ' y=' + Math.round(cajaEstado.y));
  const iconos = await p.$$eval('.kz-head .kz-ibtn', e => e.map(x => x.getAttribute('aria-label')));
  ok(iconos.join('|') === 'Deshacer (Ctrl+Z)|Historial', 'deshacer e historial son íconos: ' + iconos.join(', '));
  await p.hover('.kz-head .kz-ibtn[aria-label="Historial"]'); await p.waitForTimeout(450);
  const tip = await p.evaluate(() => { const el = document.querySelector('.kz-head .kz-ibtn[aria-label="Historial"]'); const s = getComputedStyle(el, '::after'); return { t: s.content, o: s.opacity }; });
  ok(tip.t === '"Historial"' && +tip.o > 0.9, 'al pasar el mouse se ve la palabra: ' + tip.t + ' opacidad ' + tip.o);
  await p.screenshot({ path: 'out/h1-cabecera.png', clip: { x: 222, y: 0, width: 1218, height: 200 } });
  const cta = await p.evaluate(() => { const b = [...document.querySelectorAll('.kz-head button')].find(x => /Exportar documento/.test(x.textContent)); const s = getComputedStyle(b); return s.backgroundColor + ' / ' + s.color; });
  ok(cta === 'rgb(217, 58, 0) / rgb(255, 255, 255)', 'exportar es un CTA naranja con texto blanco: ' + cta);
  await p.click('.kz-versel__btn'); await p.waitForSelector('.kz-versel__menu');
  const ops = await p.$$eval('.kz-versel__op', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  ok(ops.length === 2 && /As-Is/.test(ops[0]) && /Crear To-Be/.test(ops[1]), 'la versión es una lista desplegable: ' + ops.join(' | '));
  await p.screenshot({ path: 'out/h2-versiones.png', clip: { x: 900, y: 0, width: 540, height: 260 } });
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  ok(!(await p.$('.kz-versel__menu')), 'Esc cierra la lista');

  /* Resumen: contactos con código */
  const cods = await p.$$eval('.contactos__cod code', e => e.map(x => x.textContent));
  ok(cods.length === 5 && cods.every(c => /^CBM-0\d-[A-Z2-9]{4}$/.test(c)), 'contactos con su código: ' + cods.join(' '));
  await p.locator('#t-contactos').scrollIntoViewIfNeeded();
  await p.screenshot({ path: 'out/h3-contactos.png' });

  /* Aprobación: selección prellenada desde la RACI */
  await p.click('button[role=tab]:has-text("Aprobación")'); await p.waitForSelector('.aprob-prep');
  const chips = await p.$$eval('.selper__chip', e => e.map(x => x.textContent));
  ok(chips.length === 4 && /Marta/.test(chips[0]) && /Carlos/.test(chips[1]) && /Rosa/.test(chips[2]) && /Laura/.test(chips[3]), 'prellenado por papel: ' + chips.map(c => c.split('·')[0].trim()).join(', '));
  ok(await p.isDisabled('.aprob-prep button.kz-btn--primario'), 'sin tus datos no se envía');
  await p.fill('#ap-rem-n', 'Paul Díaz'); await p.fill('#ap-rem-c', 'paul@ejemplo.co'); await p.click('.aprob-prep h2'); await p.waitForTimeout(250);
  await p.screenshot({ path: 'out/h4-preparar.png' });
  await p.click('.aprob-prep button.kz-btn--primario'); await p.waitForSelector('.aprob-pasos');
  let s = await est();
  ok(s.versiones.asis.estado === 'revision' && s.versiones.asis.aprobacion.etapas.length === 2, 'en revisión con dos etapas');
  const estado2 = await p.textContent('.kz-head__estado');
  ok(/En revisión/.test(estado2), 'la etiqueta de estado cambia: ' + estado2.trim());

  /* Correo de Marta */
  await p.click('.kz-appr__item:has-text("Marta Ríos") summary'); await p.waitForTimeout(150);
  const mail = await p.getAttribute('.kz-appr__item:has-text("Marta Ríos") .mcorreo__menu a:has-text("Abrir en mi correo")', 'href');
  const cuerpo = decodeURIComponent(mail.split('body=')[1]);
  ok(mail.startsWith('mailto:marta.rios@ejemplo.co?subject=') && /CBM-01-/.test(cuerpo) && /adjunto/.test(cuerpo), 'el correo lleva su código y dice que adjunte la fotografía');
  await p.screenshot({ path: 'out/h5-revision.png' });
  await p.click('.aprob-pasos h2'); await p.waitForTimeout(100);

  /* Fotografía de la etapa 1 */
  await p.click('.aprob-pasos button:has-text("Descargar la fotografía")');
  await p.waitForFunction(() => (window.__d || []).some(n => /\.html$/.test(n)), null, { timeout: 30000 });
  const nombreFoto = await p.evaluate(() => window.__d[window.__d.length - 1]);
  const foto = await bajarTexto();
  fs.writeFileSync(path.join(__dirname, 'out/foto-vobo.html'), foto);
  ok(/visto bueno\.html$/.test(nombreFoto) && foto.length > 50000 && /<svg/.test(foto), 'fotografía: ' + nombreFoto + ' · ' + Math.round(foto.length / 1024) + ' KB, con diagrama');
  const codigos = (await est()).versiones.asis.aprobacion.etapas.reduce((t, e) => t.concat(e.personas.map(x => x.codigo)), []);
  ok(codigos.length === 4 && codigos.every(c => foto.indexOf(c) < 0), 'la fotografía no trae los códigos a la vista');

  const responder = async (archivo, codigo, decision, comentario) => {
    const f = await ctx.newPage();
    const ferr = []; f.on('pageerror', e => ferr.push(e.message));
    await f.goto('file://' + path.join(__dirname, 'out', archivo));
    await f.fill('#codigo', 'CBM-99-XXXX'); await f.click('#identificar');
    const malo = await f.textContent('#error1');
    await f.fill('#codigo', codigo.toLowerCase()); await f.click('#identificar');
    const hola = await f.textContent('#hola');
    await f.check('input[name=dec][value=' + decision + ']');
    if (comentario) await f.fill('#cambios', comentario);
    await f.click('#enviar'); await f.waitForTimeout(300);
    const texto = await f.inputValue('#respuesta');
    const shot = 'out/h6-foto-' + codigo.slice(0, 6) + '.png';
    await f.screenshot({ path: shot, fullPage: false });
    await f.close();
    return { malo, hola, texto, ferr };
  };
  const pers = (await est()).versiones.asis.aprobacion.etapas;
  const cod = (ie, nombre) => pers[ie].personas.find(x => x.nombre === nombre).codigo;
  let r = await responder('foto-vobo.html', cod(0, 'Marta Ríos'), 'aprobado');
  ok(/no corresponde/.test(r.malo), 'la fotografía rechaza un código ajeno');
  ok(/Marta Ríos/.test(r.hola), 'con su código la reconoce: ' + r.hola);
  ok(/KZR1\./.test(r.texto) && /Doy mi visto bueno/.test(r.texto), 'arma la respuesta para el correo');
  ok(!r.ferr.length, 'la fotografía no tiene errores: ' + r.ferr.join(' | '));
  await p.fill('#ap-pegar', r.texto); await p.waitForSelector('.aprob-lectura');
  ok(/Marta Ríos.*da su visto bueno/.test(await p.textContent('.aprob-lectura')), 'Kaze entiende la respuesta pegada');
  await p.screenshot({ path: 'out/h7-pegada.png' });
  await p.click('.aprob-lectura button'); await p.waitForTimeout(300);
  s = await est();
  ok(s.versiones.asis.aprobacion.etapas[0].personas[0].estado === 'aprobado', 'visto bueno de Marta registrado');

  // Carlos lo registra «a mano»
  await p.click('.kz-appr__item:has-text("Carlos Méndez") button:has-text("Registrar a mano")');
  await p.click('.rmanual button:has-text("Registrar")'); await p.waitForTimeout(300);
  s = await est();
  ok(s.versiones.asis.aprobacion.etapas[0].personas[1].estado === 'aprobado' && s.versiones.asis.aprobacion.etapas[0].personas[1].via === 'manual', 'visto bueno de Carlos registrado a mano');
  ok(/Etapa 2: Aprobación final/.test(await p.textContent('.aprob-pasos h2')), 'se abre la aprobación final');

  /* Etapa 2: Rosa aprueba por código, Laura pide cambios → vuelve */
  await p.click('.aprob-pasos button:has-text("Descargar la fotografía")');
  await p.waitForFunction(() => (window.__d || []).filter(n => /\.html$/.test(n)).length >= 2, null, { timeout: 30000 });
  fs.writeFileSync(path.join(__dirname, 'out/foto-final.html'), await bajarTexto());
  r = await responder('foto-final.html', cod(1, 'Rosa Álvarez'), 'aprobado');
  ok(/Apruebo/.test(r.texto), 'Rosa aprueba');
  await p.fill('#ap-pegar', r.texto); await p.waitForSelector('.aprob-lectura'); await p.click('.aprob-lectura button'); await p.waitForTimeout(300);
  r = await responder('foto-final.html', cod(1, 'Laura Gómez'), 'cambios', 'En el paso 6 falta decir quién firma si la jefe está de vacaciones.');
  await p.fill('#ap-pegar', r.texto); await p.waitForSelector('.aprob-lectura');
  ok(/Laura Gómez.*pide cambios/.test(await p.textContent('.aprob-lectura')), 'Laura pide cambios');
  await p.click('.aprob-lectura button'); await p.waitForTimeout(300);
  s = await est();
  ok(s.versiones.asis.estado === 'cambios' && s.preguntas.some(q => /vacaciones/.test(q.texto)), 'el flujo vuelve: cambios solicitados y pregunta en el Resumen');
  ok(/Cambios solicitados/.test(await p.textContent('.kz-head__estado')), 'la etiqueta dice Cambios solicitados');
  await p.screenshot({ path: 'out/h8-cambios.png' });

  /* Reenvío con la misma selección, y aprobación completa (a mano para ir rápido) */
  await p.click('.aprob-prep button:has-text("Enviar de nuevo a revisión")'); await p.waitForSelector('.aprob-pasos');
  s = await est();
  ok(s.versiones.asis.estado === 'revision' && s.versiones.asis.aprobacion.etapas[0].personas.every(x => x.estado === 'pendiente'), 'nuevo envío con las mismas personas');
  // La respuesta vieja de Rosa ya no vale para el nuevo envío
  await p.fill('#ap-pegar', r.texto); await p.waitForSelector('.aprob-pegar .kz-field__error');
  ok(/envío anterior/.test(await p.textContent('.aprob-pegar .kz-field__error')), 'una respuesta del envío anterior se rechaza');
  await p.fill('#ap-pegar', '');
  for (let i = 0; i < 4; i++) { await p.click('.kz-appr__item button:has-text("Registrar a mano") >> nth=0'); await p.click('.rmanual button:has-text("Registrar")'); await p.waitForTimeout(250); }
  s = await est();
  ok(s.versiones.asis.estado === 'aprobado' && s.versiones.asis.historial.length === 1, 'aprobado: ' + JSON.stringify(s.versiones.asis.historial[0]));
  ok(/Aprobado/.test(await p.textContent('.kz-head__estado')), 'la etiqueta dice Aprobado');
  ok(!!(await p.$('summary:has-text("Avisar a los informados")')), 'ofrece avisar a los informados');
  await p.screenshot({ path: 'out/h9-aprobado.png', fullPage: true });

  /* Teléfono */
  await p.setViewportSize({ width: 400, height: 860 }); await p.waitForTimeout(250);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.screenshot({ path: 'out/h10-movil.png' });
  const anchos = [];
  for (const t of ['Resumen', 'Aprobación']) { await p.click('button[role=tab]:has-text("' + t + '")'); await p.waitForTimeout(200); anchos.push(t + ' ' + await p.evaluate(() => document.documentElement.scrollWidth)); }
  ok(anchos.every(a => / 400$/.test(a)), 'sin desborde a 400 px: ' + anchos.join(' · '));
  await p.click('.kz-versel__btn'); await p.waitForSelector('.kz-versel__menu');
  const menu = await p.locator('.kz-versel__menu').boundingBox();
  ok(menu.x >= 0 && menu.x + menu.width <= 400, 'la lista de versiones cabe en el teléfono: ' + Math.round(menu.x) + '–' + Math.round(menu.x + menu.width));
  await p.screenshot({ path: 'out/h11-movil-versiones.png' });

  console.log('ERRORES:', errs.length ? errs.join('\n') : 'ninguno');
  console.log(fallas ? fallas + ' FALLAS' : 'TODO OK');
  await b.close();
})().catch(e => { console.error('FALLO', e.stack); process.exit(1); });
