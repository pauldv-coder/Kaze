# IndicadorGuardado

Estado del guardado automático con acceso a deshacer y al historial.

Adición del módulo: no existe botón «Guardar» en la captura. Va en la cabecera, a la derecha del título.

- **guardado** — punto `color-estado-bien`, «Guardado · hace 5 s».
- **guardando** — punto `color-apagado`, «Guardando…».
- **cola** — punto `color-estado-alerta`, «Sin conexión · 3 cambios en cola»: los cambios se guardan en local y se sincronizan al volver.
- **error** — punto `color-estado-mal`, «No se pudo guardar · reintentando».

El consumidor pasa `onDeshacer` (Ctrl+Z hace lo mismo) y `onHistorial` para recuperar cualquier punto anterior; salen como enlaces de texto. En la cabecera del proceso no se pasan: Deshacer e Historial van a su lado como `BotonIcono`.
