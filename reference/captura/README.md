# Captura de procesos — material de referencia

Material de apoyo para el spec
`docs/superpowers/specs/2026-09-24-kaze-captura-procesos-design.md`.
**Nada de esta carpeta corre en la app.** Es referencia, igual que `reference/prototype/`.

## Qué hay

| Carpeta o archivo | Qué es | Para qué sirve |
|---|---|---|
| `prototipo/kaze-captura.html` | El prototipo compilado en un solo archivo. Se abre con doble clic; guarda en el `localStorage` del navegador y trae el proceso de ejemplo | Ver y probar el comportamiento esperado: manda sobre cualquier duda de interfaz |
| `prototipo/src/` | Código del prototipo: React 18 UMD, JS sin tipos, unas 7.700 líneas | Portar. El mapa archivo por archivo está en §3 del spec |
| `prototipo/seed.mjs` | El proceso de ejemplo en formato del prototipo | Seed (§8 del spec) |
| `prototipo/build.mjs` | El build del prototipo (esbuild → un HTML) | Solo referencia: las rutas `<SANDBOX>` eran del entorno donde se construyó |
| `prototipo/pruebas/` | 6 pruebas de node (`*.mjs`: lengua, narrador, validar, bpmn, códigos, relato propio), 14 suites de Playwright (`*.cjs`) y el script que generó `ejemplos/` | Portar las aserciones a Vitest (§10 del spec). **No corren tal cual**: dependen de rutas del sandbox |
| `ESCENARIOS.md` | Los escenarios de las suites de Playwright, escritos como pasos y resultados | Criterio de aceptación de la interfaz, en escritorio y a 400 px |
| `sistema-de-diseno/index.jsx` | Componentes del sistema de diseño y funciones puras (numeración, revisión de decisiones, íconos) | Portar a `components/kaze/` y `lib/captura/` |
| `sistema-de-diseno/bundle.css` | Hoja de los componentes (clases `kz-`) | Portar a `components/kaze/kaze.css` |
| `sistema-de-diseno/tokens.json` | Tokens con su uso y contraste | Tokens que faltan en `app/globals.css` (§7) |
| `sistema-de-diseno/README.md` | La guía del sistema: voz, color, patrones del módulo, accesibilidad | Reglas de diseño y de copy |
| `sistema-de-diseno/componentes/<Componente>/` | README y vista previa de cada componente | Uso esperado de cada uno |
| `sistema-de-diseno/componentes.d.ts.txt` | Tipos de las props de los componentes | Base de los tipos TSX. Va como `.txt` para que `tsc` no lo tome del repo |
| `ejemplos/semilla.json` | El proceso de ejemplo normalizado: 9 actividades, 3 fases, 2 decisiones y 5 contactos | Fixture de tests |
| `ejemplos/semilla.bpmn` | El XML que genera la semilla (0 errores en la revisión) | Salida de referencia de `generarBPMN` |
| `ejemplos/semilla-relato.txt` | El relato de la semilla en texto plano, 27 párrafos | Salida de referencia de `narrarProceso` |
| `ejemplos/grande.json`, `ejemplos/grande.bpmn` | Un proceso de 35 actividades | Prueba de carga: ruteo, documento y tamaño del guardado |
| `ejemplos/procedimiento-carta.docx` | El Word de la semilla en Carta | Cómo debe quedar el documento |
| `ejemplos/procedimiento-aprobado.docx` | El mismo, aprobado en dos etapas: portada con aprobaciones, «Elaboró» y control de cambios | Ídem, con aprobación |
| `ejemplos/fotografia-aprobacion.html` | La «fotografía» que veía quien aprobaba en el prototipo | Contenido y orden de la página `/aprobar/[token]`. Su mecanismo (archivo adjunto y código de respuesta) **no** se porta |
| `capturas/` | 29 pantallas del prototipo, en escritorio y en móvil | Referencia visual |
| `sql-probado/` | La migración propuesta (§4.1–4.2 del spec): tablas, RLS, grants por columna y una función de ejemplo, con stubs de `auth` y casos (`90-casos.sql`). Se probó en Postgres 16 junto con las migraciones actuales del repo | Punto de partida de la migración real y de sus tests |

## Cómo abrir el prototipo

Abre `prototipo/kaze-captura.html` en Chrome o Edge. Necesita internet: React, bpmn-js y docx se cargan
de un CDN. El proceso «Conciliación bancaria mensual» ya viene cargado.

Recorrido corto:

- Actividades → 1 · Listar y agrupar.
- Caracterizar.
- Diagrama.
- Exportar documento.
- Aprobación: ahí se ve el mecanismo viejo, con fotografía y respuesta pegada, que en producción pasa a
  enlace + código.

Para empezar de cero, borra los datos del sitio en el navegador.

## Qué NO se porta

- La fotografía descargable y el código de respuesta `KZR1`. En producción, quien aprueba responde en
  `/aprobar/[token]` (§6 del spec).
- `almacenLocal` (`localStorage`) y `archivos.js` (IndexedDB): se reemplazan por Supabase y Storage.
- Los flujos de IA (`ModalNotasIA`, `ModalDecisionesIA` y los prompts de `util.js`), que quedan para
  después.
- El acceso a `window.claude` (capacidades del artifact): la descarga pasa a ser con Blob.
