# IconoBPMN

Los íconos del módulo de captura: quién ejecuta una actividad, si tiene formatos, qué evento la acompaña y cómo se repite. Adición del módulo.

- Un solo juego, `ICONOS_BPMN`: primitivas SVG en un cuadro de 16×16, trazo 1,4 con puntas redondas. La interfaz (`IconoBPMN`), las tareas del lienzo (arriba a la derecha), `ElementoBPMN` y el documento Word dibujan exactamente la misma geometría.
- **Quién la ejecuta**: `persona` (una persona), `sistema` (engranaje: un sistema lo hace solo), `automatizacion` (robot: IA o automatización). **Formatos**: `hoja`.
- **Eventos**: `tiempo`, `mensaje` (recibido), `aviso` (enviado: sobre relleno), `condicion`, `error`, `hito` (banderín: un evento intermedio sin tipo que marca que algo se cumplió). **Otros**: `decision` (rombo), `repite`, `porCada`, `porCadaSecuencial`.
- **Acciones**: `deshacer`, `historial` (reloj con flecha), `abajo` (abre una lista: `SelectorVersion`, «Enviar correo»), `copiar` y `descargar`. Sin palabra al lado solo van dentro de `BotonIcono`.
- Hereda el color del texto (`currentColor`), así que funciona en tinta, en blanco sobre tinta y en `color-apagado`.
- Siempre con palabra al lado o con `titulo`: sin `titulo` el ícono es decorativo (`aria-hidden`). `titulo={true}` usa su nombre en español («Sistema», «IA o automatización»).
- Tamaños: 14–16px junto a texto de 12–13px; 18–20px como marca de una fila; 15px sobre la tarea del lienzo.
- No reemplazan a los glifos tipográficos de estado (`✓`, `?`, `!`): esos siguen siendo texto.
