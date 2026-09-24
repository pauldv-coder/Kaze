# TarjetaActividad

Una actividad como tarjeta arrastrable dentro del tablero de fases.

Adición del módulo. Número de actividad (`codigo`, p. ej. «ACT-04»; «—» si es `null`, con «Sin número» para lectores de pantalla) en `meta`, nombre en `titulo-tarjeta`, responsable debajo y entregable con «↳». Las sugeridas llevan borde discontinuo azul; las que tienen preguntas abiertas, borde punteado ámbar. Al arrastrar se levanta con `shadow-lg` y un giro de 1,5°.

Dentro de `TableroFases` es arrastrable: muestra el asa de seis puntos, se atenúa en su sitio mientras se arrastra y su número se recalcula al soltarla (la posición en el tablero es la secuencia). Suelta, fuera del tablero, es solo una ficha: el consumidor pasa `codigo`, `nombre`, `responsable`, `entregable` y `estado`; `seleccionada` la enmarca en `color-marca`.

**Compacta** (`compacto`): solo número, nombre y estado —el chip aparece solo si es sugerencia o pregunta abierta; confirmada es lo normal y no se marca—, para listar muchas actividades antes de caracterizarlas. Con `onAbrir` muestra el botón «Ficha» al pasar el puntero o al recibir el foco (siempre visible en pantallas táctiles). Con `renombrable`, el nombre se corrige en su sitio (`renombrando`, `onRenombrar(nombre)`, `onCancelarRenombrar`): Enter guarda, Esc cancela.
