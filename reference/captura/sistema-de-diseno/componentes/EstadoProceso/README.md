# EstadoProceso

Estado de revisión de un proceso capturado: borrador, en revisión, aprobado o cambios solicitados.

Adición del módulo, con la misma forma que `EstadoChip`. Borrador es neutro sobre blanco; En revisión usa `color-estado-alerta-texto` con punto `color-estado-alerta`; Aprobado, `color-estado-bien`; Cambios solicitados, `color-estado-mal`.

- Úsalo en el tablero de procesos, en `SelectorVersion` y en `PanelAprobacion`. El estado pertenece a una versión (As-Is v3), no al proceso en abstracto.
- `destacado` es la forma de la cabecera: rótulo «Estado» en `etiqueta-columna` y el chip como píldora (radio completo, 13px, negrita). Va arriba a la derecha en `CabeceraPagina` (prop `estado`), una sola vez por pantalla. No es un botón: no tiene hover ni cursor de mano. Borrador, destacado, va sobre `color-panel` con texto `color-tinta`.
