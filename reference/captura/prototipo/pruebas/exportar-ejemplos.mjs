import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
global.window = { React: require('react') };
require('<SANDBOX>/ds/build/bundle.js');
const M = await import('./src/model.js');
const { generarBPMN } = await import('./src/bpmn.js');
const { revisarDiagrama } = await import('./src/validar.js');
const { narrarProceso, plano } = await import('./src/narrador.js');
const { proceso } = await import('./seed.mjs');
const OUT = process.argv[2];
const semilla = M.normalizarProceso(JSON.parse(JSON.stringify(proceso)));
fs.writeFileSync(OUT + '/semilla.json', JSON.stringify(semilla, null, 2));
const g = generarBPMN(semilla, semilla.versiones.asis, {});
fs.writeFileSync(OUT + '/semilla.bpmn', g.xml);
const rev = revisarDiagrama(semilla, semilla.versiones.asis, g);
console.log('semilla: errores', rev.errores.length, 'avisos', rev.avisos.length, 'xml', g.xml.length);
const grande = M.normalizarProceso(JSON.parse(fs.readFileSync('out/grande.json', 'utf8')));
fs.writeFileSync(OUT + '/grande.json', JSON.stringify(grande, null, 2));
const gg = generarBPMN(grande, grande.versiones.asis, {});
fs.writeFileSync(OUT + '/grande.bpmn', gg.xml);
const rg = revisarDiagrama(grande, grande.versiones.asis, gg);
console.log('grande: actividades', Object.keys(grande.versiones.asis.actividades).length, 'errores', rg.errores.length, 'avisos', rg.avisos.length, 'xml', gg.xml.length);
// Relato de la semilla en texto plano: referencia para las pruebas del narrador.
const rel = narrarProceso(semilla, semilla.versiones.asis, {});
const lineas = [];
const txt = x => (typeof x === 'string' ? x : x && x.runs ? plano(x) : '');
(function rec(o, prof) {
  if (!o) return;
  if (Array.isArray(o)) { o.forEach(x => rec(x, prof)); return; }
  if (typeof o !== 'object') return;
  if (o.runs) { lineas.push(plano(o)); return; }
  Object.keys(o).forEach(k => rec(o[k], prof + 1));
})(rel, 0);
fs.writeFileSync(OUT + '/semilla-relato.txt', lineas.join('\n\n') + '\n');
console.log('relato: párrafos', lineas.length);
