# ValorCampo

Muestra el valor de un campo opcional distinguiendo desconocido, no aplica, cero y vacío.

Adición del módulo; es la regla más importante de la captura:

- `valor="desconocido"` → «?» ámbar con subrayado punteado: aún no se sabe, cuenta como pregunta abierta.
- `valor="na"` → «N/A» en `color-apagado`: se preguntó y no corresponde.
- `valor={0}` → «0» en tinta, tabular, con su unidad: se midió y es cero.
- `null` / vacío → «—»: nadie lo ha tocado.

Números con coma decimal (`es-CO`). El consumidor pasa `unidad` («h», «min», «días», «/mes»).
