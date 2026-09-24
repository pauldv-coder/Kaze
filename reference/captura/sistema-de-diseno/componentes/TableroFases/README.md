# TableroFases

El tablero de fases de la entrevista: lista las actividades por fase, y al arrastrarlas dentro de una fase o entre fases su posición define la secuencia y el número de cada una.

Adición del módulo. Pinta una `ColumnaFase` por fase, en orden, y una columna «Sin fase» al final si la pasas con `sinFase: true`.

**Regla de secuencia.** Las fases se leen de izquierda a derecha y las actividades de arriba abajo. El número visible (`ACT-01`, `ACT-02`…) se recalcula con cada movimiento a partir de esa posición; los que cambian parpadean con un anillo `color-marca`. Las de «Sin fase» no tienen número («—»).

**Clave estable.** Cada actividad trae una `clave` que no cambia nunca. Guarda con ella las referencias (salidas de decisiones, entregables, comentarios, elementos del diagrama) y muestra siempre el número actual con `codigoActividad`.

**Listar y agrupar** (`compacto`). Es el primer paso de la captura: ver todas las actividades antes de entrar al detalle. Las tarjetas muestran solo número, nombre y estado, y el tablero se edita en su sitio con los callbacks que pases:

- `onAgregar(faseId, nombres)` — campo «+ Agregar actividad» al pie de cada columna. Enter agrega y deja el cursor para la siguiente; pegar varias líneas crea una actividad por línea (quita viñetas y numeración).
- `onNuevaFase(nombre)` — columna discontinua «+ Nueva fase» antes de «Sin fase»; Enter la crea y deja lista la siguiente.
- `onRenombrar(clave, nombre)` — un clic en el nombre (o F2) lo corrige ahí mismo. `onRenombrarFase(id, nombre)` hace lo mismo con el nombre de la fase.
- `onEliminar(clave)` — Suprimir sobre una tarjeta con foco. Ofrece Deshacer en tu interfaz.
- `onEditarFase(id)` — enlace «Objetivo y criterios · faltan N» en la cabecera, para editar objetivo, entrada, entregables y salida en otra vista.
- `onSeleccionar(clave)` — clic fuera del nombre, Enter o el botón «Ficha»: abre la ficha de esa actividad.

**Cómo se mueve una tarjeta:**

- Ratón o lápiz: arrastra la tarjeta entera. Una línea `color-marca` marca dónde caerá y la cabecera de la fase destino se enmarca en `color-marca`. Esc cancela. Cerca del borde, el tablero se desplaza solo.
- Táctil: arrastra desde el asa de seis puntos; el resto de la tarjeta deja desplazar la página.
- Teclado: Tab hasta la tarjeta; Alt+↑/↓ la sube o baja, Alt+←/→ la pasa a la fase vecina. El movimiento se anuncia a lectores de pantalla.
- `soloLectura` (versión en revisión o aprobada): sin arrastre ni edición; un clic abre la ficha.

**Lo que pasa el consumidor:** `fases` (cada una con `id`, `nombre`, criterios y `actividades` en orden, cada actividad con `clave`), `prefijo` (por defecto `ACT-`), `seleccionada` y `onSeleccionar`. `onCambio(fases, secuencia)` llega tras cada movimiento con el tablero nuevo y la secuencia numerada: guárdalo (autoguardado) y apílalo para Deshacer. Si `fases` cambia desde fuera (un alta, un renombre, deshacer), el tablero lo adopta y anuncia las altas; durante un arrastre espera a que se suelte.

**Utilidades del mismo paquete:** `numerarActividades(fases)` → `{clave: número}`; `codigoActividad(n, prefijo)` → `"ACT-04"` o `null`; `secuenciaActividades(fases, prefijo)` → la lista ordenada que usan la tabla y la generación del diagrama.

Mover a otra fase no inventa conexiones: la actividad pasa a ir detrás de la anterior en la secuencia, salvo donde una `TarjetaDecision` defina otras salidas.
