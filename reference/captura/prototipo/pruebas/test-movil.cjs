const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const FAKE = `window.claude = { use: async n => n === 'downloads' ? { save: async r => ({ status: 'saved' }) } : null };`;
const DS = '<SANDBOX>/ds/out/project/components/lib/';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 } });
  await ctx.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(DS + (r.request().url().includes('react-dom') ? 'react-dom.production.min.js' : 'react.production.min.js'), 'utf8') }));
  await ctx.route('https://cdn.jsdelivr.net/**', r => { const u = r.request().url(); const f = u.includes('docx') ? require('child_process').execSync('npm root -g').toString().trim() + '/docx/dist/index.iife.js' : path.join(__dirname, 'package/dist/bpmn-modeler.production.min.js'); r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(f, 'utf8') }); });
  await ctx.route(u => u.hostname.startsWith('fonts.'), r => r.fulfill({ contentType: 'text/css', body: '' }));
  await ctx.addInitScript(FAKE);
  const p = await ctx.newPage();
  await p.goto('file://' + path.join(__dirname, 'out/test.html'));
  await p.waitForSelector('.tabla-procesos tbody tr');
  const anchos = async () => p.evaluate(() => { const W = window.innerWidth; const out = []; document.querySelectorAll('body *').forEach(el => { const r = el.getBoundingClientRect(); if (r.right > W + 1 && r.width > 0) { let a = el, inScroll = false; while (a && a !== document.body) { const cs = getComputedStyle(a); if (a !== el && (cs.overflowX === 'auto' || cs.overflowX === 'hidden' || cs.overflowX === 'scroll')) { inScroll = true; break; } a = a.parentElement; } if (!inScroll) out.push(el.tagName + '.' + el.className + ' ' + Math.round(r.right)); } }); return { doc: document.documentElement.scrollWidth, W, out: out.slice(0, 12) }; });
  console.log('lista', JSON.stringify(await anchos()));
  await p.click('.enlace-fila'); await p.waitForSelector('.tabs');
  for (const t of ['Resumen', 'Fases', 'Actividades', 'Diagrama', 'Aprobación']) { await p.click('button[role=tab]:has-text("' + t + '")'); await p.waitForTimeout(250); console.log(t, await p.evaluate(() => document.documentElement.scrollWidth)); }
  await p.click('button[role=tab]:has-text("Resumen")'); await p.waitForTimeout(200);
  await p.screenshot({ path: 'out/9-movil-resumen.png' });
  await p.click('.kz-head button:has-text("Exportar documento")'); await p.waitForSelector('.modal'); await p.waitForTimeout(200);
  console.log('modal exportar', JSON.stringify(await anchos()));
  await p.screenshot({ path: 'out/9-movil-exportar.png' });
  await b.close();
})();
