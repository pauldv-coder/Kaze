# ElementoBPMN

Los elementos BPMN 2.0 dibujados con los tokens de Kaze, para leyendas, la guía y previsualizaciones fuera del lienzo.

Adición del módulo. En el editor real dibuja bpmn-js; este componente fija los mismos colores, medidas e íconos fuera de él.

- Tareas y subprocesos: `bpmn-tarea-ancho` × `bpmn-tarea-alto`, radio 10px. Eventos: `bpmn-evento`; el de fin con trazo de 4px. Compuertas: `bpmn-compuerta` con ×, ○ o +.
- Trazo `color-bpmn-trazo` 2px; seleccionado `color-bpmn-seleccion`; sugerido por la IA `color-bpmn-sugerido` discontinuo.
- **Quién la ejecuta** (`ejecutor`), arriba a la derecha de la tarea: `persona` (tarea de usuario), `sistema` con engranaje (tarea de servicio) o `automatizacion` con robot (IA o automatización, tarea de script). Es el mismo dato que «¿Quién la ejecuta?» de la ficha.
- **Formatos** (`adjunto`): una hoja a la izquierda del ícono del ejecutor cuando la actividad tiene formatos o adjuntos.
- **Ciclo** (`ciclo`), abajo al centro: `repite` (bucle hasta una condición), `porCada` (por cada elemento, a la vez) o `porCadaSecuencial` (uno tras otro).
- **Marcador de evento** (`marcador`): `tiempo`, `mensaje` (recibido), `aviso` (enviado, relleno), `condicion` o `error`. Una espera va como evento intermedio antes o después de la tarea; un límite de tiempo o un error, sobre su borde.
- Flujo de mensaje discontinuo en `color-bpmn-mensaje` con círculo de origen y punta hueca; solo entre pools.
- `escala` reduce todo en la misma proporción (0,72 en esta guía); `tamano` encaja un elemento en un cuadro, para usarlo como icono (así lo usa `TarjetaDecision`).
- `grupo` es la superposición de fases (raya y punto); `carril` muestra la cabecera en `color-bpmn-carril`.
- Los íconos salen de `ICONOS_BPMN` (ver `IconoBPMN`): la interfaz, el lienzo y el documento Word usan la misma geometría.
