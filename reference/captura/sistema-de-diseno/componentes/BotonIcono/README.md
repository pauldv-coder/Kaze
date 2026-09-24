# BotonIcono

Botón de solo ícono para acciones frecuentes que se reconocen por su dibujo: Deshacer, Historial, Copiar, Descargar.

Adición del módulo. 34×34 px, ícono de 18px (`IconoBPMN`), sin borde; hover `color-panel` y foco con el anillo `color-foco`.

- **La palabra aparece** debajo al pasar el mouse (tras 150 ms) o al llegar con el teclado: `etiqueta` y, si hay, `atajo` («Deshacer · Ctrl+Z»). En pantallas táctiles no se muestra.
- `etiqueta` es también su nombre accesible (`aria-label`, con el atajo entre paréntesis). Nunca dejes un ícono sin `etiqueta`.
- Solo para acciones conocidas y repetidas. Una acción nueva o importante va en `Boton` con texto; el CTA siempre lleva palabra.
- `disabled` lo apaga en `color-apagado` (p. ej., Deshacer cuando no hay nada que deshacer).

En la cabecera del proceso van Deshacer (Ctrl+Z) e Historial, a la derecha de `IndicadorGuardado`.
