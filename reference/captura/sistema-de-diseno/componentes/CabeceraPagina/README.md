# CabeceraPagina

Cabecera blanca de cada pantalla: migas y estado arriba, título y bajada, y las acciones.

Recreada desde `proyectos/page.tsx` (título `titulo-pagina`, bajada `subtitulo`, borde inferior `color-borde`, padding `spacing-7`).

- `migas` a la izquierda y `estado` a la derecha comparten la fila de arriba. En la captura, `estado` es `EstadoProceso` con `destacado`: el estado de la versión se lee arriba a la derecha, sin parecer un botón.
- `acciones` va junto al título. En la captura, en este orden: `IndicadorGuardado`, `BotonIcono` de Deshacer e Historial, `SelectorVersion` y el CTA (`Boton` `acento`, «Exportar documento»).
- `children` recibe las pestañas de vista (Resumen · Fases · Actividades · Diagrama · Aprobación).
- En pantallas angostas las migas pasan de línea completas; el consumidor puede dejar solo el regreso («‹ Captura de procesos»), porque el título ya dice dónde estás.
