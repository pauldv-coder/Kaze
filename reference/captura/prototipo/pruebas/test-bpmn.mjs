import { createRequire } from 'module';
const require = createRequire(import.meta.url);
global.window = { React: require('react') };
require('<SANDBOX>/ds/build/bundle.js');
const { generarBPMN } = await import('./src/bpmn.js');
const { cruces } = await import('./src/rutas.js');
const M = await import('./src/model.js');
const { proceso } = await import('./seed.mjs');
const BM = await import('bpmn-moddle'); const BpmnModdle = BM.default || BM.BpmnModdle;
const moddle = new BpmnModdle();
async function validar(nombre, p, m, op) {
  const g = generarBPMN(p, m, op);
  const r = await moddle.fromXML(g.xml);
  const defs = r.rootElement;
  const proc = defs.rootElements.find(e => e.$type === 'bpmn:Process');
  const tipos = {}; proc.flowElements.forEach(e => { tipos[e.$type] = (tipos[e.$type] || 0) + 1; });
  // Reglas: los flujos de secuencia no cruzan participantes; los de mensaje conectan participantes distintos.
  const col = defs.rootElements.find(e => e.$type === 'bpmn:Collaboration');
  const ids = new Set(proc.flowElements.map(e => e.id));
  const malSec = proc.flowElements.filter(e => e.$type === 'bpmn:SequenceFlow' && (!ids.has(e.sourceRef.id) || !ids.has(e.targetRef.id)));
  const msgs = (col.messageFlows || []).map(f => f.sourceRef.id + ' → ' + f.targetRef.id);
  console.log('==', nombre, '| advertencias moddle:', r.warnings.length, r.warnings.map(w => w.message).slice(0, 5));
  console.log('   elementos:', JSON.stringify(tipos), '| carriles:', proc.laneSets[0].lanes.map(l => l.name).join(', '));
  console.log('   mensajes:', msgs, '| flujos que cruzan pools:', malSec.length, '| grupos:', (proc.artifacts || []).filter(a => a.$type === 'bpmn:Group').length);
  console.log('   avisos:', g.avisos.map(a => a.texto));
  // Limpieza: ningún conector pasa por dentro de una forma ajena; ninguna etiqueta pisa una forma.
  const formas = Object.keys(g.geo.final).map(id => Object.assign({ id }, g.geo.final[id]));
  let malos = [];
  Object.entries(g.geo.conectores).forEach(([id, c]) => {
    const ign = [c.src, c.tgt];
    // El evento de borde está sobre su tarea: el conector que sale de él puede tocarla.
    formas.forEach(f => { if (f.id === c.src || f.id === c.tgt) return; });
    const x = cruces(c.puntos, formas, ign.concat(formas.filter(f => /^Ev_/.test(f.id)).map(f => f.id).filter(bid => bid === c.src)));
    const adj = new Set();
    if (/^Ev_/.test(c.src)) { const t = Object.keys(g.geo.final).find(k => /^Act_/.test(k) && g.xml.indexOf('id="' + c.src + '" name') >= 0 && g.xml.indexOf('attachedToRef="' + k + '"') >= 0); if (t) adj.add(t); }
    x.filter(fid => !adj.has(fid)).forEach(fid => malos.push(id + ' ✕ ' + fid));
  });
  const etqs = Object.entries(g.geo.etqFinal);
  let pisadas = [];
  etqs.forEach(([id, r]) => formas.forEach(f => { if (f.id === id) return; if (r.x < f.x + f.w - 1 && r.x + r.w > f.x + 1 && r.y < f.y + f.h - 1 && r.y + r.h > f.y + 1) pisadas.push(id + ' sobre ' + f.id); }));
  console.log('   conectores sobre formas:', malos.length, malos.slice(0, 6), '| etiquetas sobre formas:', pisadas.length, pisadas.slice(0, 6));
  console.log('   resumen:', JSON.stringify(g.resumen));
  return g;
}
const g1 = await validar('semilla', proceso, proceso.versiones.asis);
// Caso paralelo: una decisión «todos a la vez» desde a_cargar hacia a_cuadre y a_tesoreria (ubicada en Cuadre)
const p2 = JSON.parse(JSON.stringify(proceso)); const m2 = p2.versiones.asis;
m2.sinFase = []; m2.fases[1].actividades = ['a_cuadre', 'a_tesoreria', 'a_investigar', 'a_registrar'];
m2.decisiones.push({ clave: 'd_par', pregunta: 'En paralelo', origen: 'a_cargar', tipo: 'paralela', salidas: [{ condicion: '', destino: 'a_cuadre' }, { condicion: '', destino: 'a_tesoreria' }], estado: 'confirmado', contexto: {}, aceptados: [] });
await validar('paralela', p2, m2);
// Caso: destino eliminado y salida hacia atrás
const p3 = JSON.parse(JSON.stringify(proceso)); const m3 = p3.versiones.asis;
M.eliminarActividad(m3, 'a_investigar');
await validar('actividad eliminada', p3, m3, { fases: false, entregables: false });
import fs from 'fs'; fs.writeFileSync('out/semilla.bpmn', g1.xml);
