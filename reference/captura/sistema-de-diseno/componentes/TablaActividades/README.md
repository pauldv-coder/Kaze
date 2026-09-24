# TablaActividades

Tabla de captura con velocidad de hoja de cálculo: una fila por actividad, edición en la celda.

Adición del módulo; es la pantalla de la entrevista. Filas de 36px, `celda` 13px, rejilla visible con `color-borde` (dirección Instrumento).

- Columnas visibles: N.º (el número de la secuencia, igual al del tablero; «—» si no tiene fase), Actividad (verbo + objeto), Fase, Responsable (rol), Entregable, Proceso, Espera, Estado. El resto de campos vive en `PanelDetalle`.
- La última fila siempre es de alta: escribir, pegar una lista (una actividad por línea) o convertir notas de la entrevista en un borrador.
- Filas sugeridas por la IA: fondo `color-sugerencia-ia-fondo` y borde discontinuo. Sin fase: «Sin fase» en cursiva, nunca una fase inventada.
- Seleccionar abre el panel de detalle; la selección se marca con `color-marca`.
- Teclado: flechas para moverse, Enter para editar, Esc para cancelar, Alt+↑/↓ para reordenar (cambia la secuencia y renumera, igual que arrastrar en el tablero), Ctrl+Z para deshacer.

El consumidor pasa `filas` en el orden de `secuenciaActividades` (ver `Actividad` en los tipos: `clave` estable y `codigo` visible), `seleccionada` y `onSeleccionar(clave)`.
