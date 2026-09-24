import { createRequire } from 'module';
const require = createRequire(import.meta.url);
global.window = { React: require('react') };
require('<SANDBOX>/ds/build/bundle.js');
const N = await import('./src/narrador.js');
const { proceso } = await import('./seed.mjs');
const { anexosDe } = await import('./src/documento.js');
const m = proceso.versiones.asis;
const r = N.narrarProceso(proceso, m, { anexos: anexosDe(m) });
const pl = p => (p.tipo === 'importante' ? 'Importante: ' : p.tipo === 'atencion' ? 'Atención: ' : p.tipo === 'rama' ? '   • ' : '') + p.runs.map(x => x.tono === 'falta' ? '⟨' + x.t + '⟩' : x.t).join('');
console.log('== ALCANCE'); r.alcance.forEach(p => console.log(pl(p)));
console.log('\n== EN POCAS PALABRAS'); r.resumen.concat(r.comoLeer).forEach(p => console.log(pl(p)));
console.log('\n== SIPOC'); Object.entries(r.sipoc).forEach(([k, v]) => console.log(k.padEnd(12), v.map(x => x.t + (x.pasos ? ' (' + x.pasos + ')' : '')).join(' | ')));
r.fases.forEach(f => {
  console.log('\n== Fase ' + f.indice + ': ' + f.nombre);
  f.intro.forEach(p => console.log(pl(p)));
  f.pasos.forEach(s => { console.log('\n' + s.numero + '. ' + s.nombre + '  · ' + s.codigo); s.parrafos.forEach(p => console.log(pl(p))); });
});
