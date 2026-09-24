# SelectorVersion

Lista desplegable para elegir qué versión del proceso se ve —el actual (As-Is) o el propuesto (To-Be)— y, si aún no existe, crear el To-Be.

Adición del módulo. El botón muestra la `EtiquetaVersion` de la versión que se ve y el ícono `abajo`, que gira al abrir. La lista muestra cada versión con su `EstadoProceso` y un ✓ en la actual.

- Con `onCrear`, la última opción, separada por una línea, crea la versión propuesta («+ Crear To-Be desde el As-Is»). El consumidor confirma antes de crearla.
- Es un `listbox`: se abre con clic, Enter, Espacio o ↓; se recorre con flechas, Inicio y Fin; Enter o Espacio eligen; Esc cierra y devuelve el foco al botón; Tab cierra y sigue.
- Se cierra al tocar fuera. La lista abre alineada a la izquierda del botón, sobre `shadow-lg`.
- Va en la cabecera del proceso, entre Historial y el CTA.

Props: `versiones` (`[{ id, tipo: 'asis' | 'tobe', version, estado }]`), `actual`, `onCambiar(id)`, `onCrear()` y `crearEtiqueta`.
