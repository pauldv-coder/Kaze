# ColumnaFase

Una fase del tablero: cabecera con objetivo, criterios de entrada, entregables y criterios de salida, y sus tarjetas debajo.

Adición del módulo. Una columna por fase, 264px (224px compacta), más una columna `sinFase` (cabecera discontinua) para lo que aún no se ha ubicado.

- Los criterios que faltan se muestran como `ValorCampo` desconocido: el tablero hace visible qué falta preguntar.
- Los entregables de una fase alimentan las sugerencias de conexión entre actividades, que llegan como sugerencias de IA y exigen validación.
- El orden de las tarjetas **es** la secuencia: de arriba abajo dentro de la fase, y las fases de izquierda a derecha. No es un carril ni un departamento.
- `compacta` oculta objetivo y criterios: es la columna del paso «listar y agrupar». Con `onEditar` muestra el enlace «Objetivo y criterios · faltan N» (o «✓» si están los cuatro) bajo el nombre; sin `compacta`, «Editar criterios» bajo los criterios. Con `onPedirRenombrar` el nombre se corrige con un clic.
- `pie` va debajo de las tarjetas: `TableroFases` pone ahí el campo «+ Agregar actividad».
- Para arrastrar y renumerar, úsala a través de `TableroFases`; suelta, pinta las `actividades` que le pases (con su `codigo`). Sin actividades muestra «Suelta actividades aquí».
