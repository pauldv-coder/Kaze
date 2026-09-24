# EstadoConfirmacion

Dice de dónde sale un dato capturado: confirmado por el participante, sugerido por la IA o pregunta abierta.

Adición del módulo de captura. Los tres estados se distinguen por glifo, palabra **y** estilo de línea (continua, discontinua, punteada), nunca solo por color:

- **confirmado** — glifo ✓ sobre `color-tinta`. Es el estado por defecto y el más callado.
- **sugerencia** — glifo «IA» sobre `color-sugerencia-ia`, borde discontinuo y fondo `color-sugerencia-ia-fondo`. Siempre acompañado de «Aceptar» / «Descartar» en su contexto.
- **pregunta** — glifo «?» en `color-estado-alerta-texto`, borde punteado ámbar.
- **revisar** — glifo «!» con el mismo estilo que pregunta: el dato estaba bien, pero algo cambió a su alrededor (una actividad se movió o se eliminó). Lo usa `TarjetaDecision` cuando `revisarDecision` encuentra motivos.

`compacto` deja solo el glifo (con el nombre para lectores de pantalla) para celdas y tarjetas. `fuente` («Entrevista 12 sep · M. Ríos») va en el `title`.
