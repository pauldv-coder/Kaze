# PanelAprobacion

Aprobación de una versión del proceso, en una o dos etapas: el visto bueno de las áreas que intervienen y la aprobación final.

Adición del módulo. Encabezado con la versión exacta y su `EstadoProceso`; una fila por persona con cargo, fecha, su decisión y su comentario.

- **Etapas** (`etapas`): cada una con número, título y estado a la derecha: En espera (número hueco y filas atenuadas), En curso, Completa (verde) o Con cambios (rojo). `nota` explica la etapa («Se abre cuando lleguen todos los vistos buenos»). Sin `etapas`, `aprobadores` es una sola lista, como antes.
- **Decisión** de cada persona: Pendiente · Aprobó · Dio su visto bueno (`vobo`) · Pidió cambios. `decisionTexto` la cambia si hace falta.
- `detalle` va bajo el cargo (correo, código, «registrado a mano»); `acciones`, debajo («Enviar correo», «Registrar a mano»). `pie` cierra el panel («Avisar a los informados»).
- Con `onAprobar` / `onSolicitarCambios` el panel es de quien aprueba: «Aprobar» es `primario` y nombra la versión («Aprobar As-Is v3»); «Solicitar cambios» abre un comentario obligatorio. Sin callbacks es de solo lectura, que es como lo ve quien lleva el proceso.
- Un pedido de cambios deja la versión en Cambios solicitados y el comentario vuelve como pregunta abierta. Editar una versión aprobada crea una versión nueva y reinicia las aprobaciones.
- En pantallas angostas la decisión baja debajo del nombre.

El consumidor pasa `version` (corta: «As-Is v3»), `resumen`, `estado`, `titulo` y `etapas` (o `aprobadores`). Cada persona: `nombre`, `iniciales`, `rol`, `decision`, `fecha`, `comentario`, `detalle`, `acciones`; `clave` si dos personas se llaman igual.
