import { build } from '<SANDBOX>/ds/node_modules/esbuild/lib/main.js';
import fs from 'fs';
const DS = '<SANDBOX>/ds/out/project/';
const r = await build({ entryPoints: ['src/app.jsx'], bundle: true, format: 'iife', minify: true, write: false,
  jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment', target: 'es2019', define: { 'process.env.NODE_ENV': '"production"' } });
const app = r.outputFiles[0].text;
// tokens.css desde tokens.json (sin @font-face: las fuentes vienen de Google Fonts)
const t = JSON.parse(fs.readFileSync(DS + 'tokens.json', 'utf8'));
const v = [];
t.color.tokens.forEach(c => { const m = /^\{(.+)\}$/.exec(c.value); v.push('--' + c.name + ':' + (m ? 'var(--' + m[1] + ')' : c.value) + ';'); });
['spacing', 'radius', 'shadow', 'bpmn'].forEach(f => t[f].tokens.forEach(x => v.push('--' + x.name + ':' + x.value + ';')));
Object.entries(t.type.families).forEach(([k, s]) => v.push('--font-' + k + ':' + s + ';'));
const tokens = ':root{color-scheme:light;' + v.join('') + '}';
const css = [tokens, fs.readFileSync('package/dist/assets/diagram-js.css', 'utf8'), fs.readFileSync('package/dist/assets/bpmn-js.css', 'utf8'),
  fs.readFileSync('package/dist/assets/bpmn-font/css/bpmn-embedded.css', 'utf8'),
  fs.readFileSync(DS + 'components/bundle.css', 'utf8'), fs.readFileSync('src/app.css', 'utf8')].join('\n');
const ds = fs.readFileSync(DS + 'components/bundle.js', 'utf8');
for (const [n, s] of [['app', app], ['ds', ds]]) if (/<\/script|<!--/i.test(s)) throw new Error('inline script contains a forbidden sequence: ' + n);
if (/<\/style/i.test(css)) throw new Error('css contains </style');
const CDN = {
  react: 'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js',
  reactDom: 'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js',
  bpmn: 'https://cdn.jsdelivr.net/npm/bpmn-js@17.11.1/dist/bpmn-modeler.production.min.js',
};
const html = `<title>Kaze Captura</title>
<meta name="description" content="Prototipo del módulo de captura de procesos de Kaze">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Space+Grotesk:wght@500;600;700&display=swap">
<style>
${css}
</style>
<div id="app"></div>
<script src="${CDN.react}"></script>
<script src="${CDN.reactDom}"></script>
<script src="${CDN.bpmn}"></script>
<script>
${ds}
</script>
<script>
${app}
</script>
`;
fs.mkdirSync('out', { recursive: true });
fs.writeFileSync('out/kaze-captura.html', html);
console.log('ok', (html.length / 1024).toFixed(0) + ' KB');
fs.writeFileSync('out/test.html', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' + html + '</body></html>');
