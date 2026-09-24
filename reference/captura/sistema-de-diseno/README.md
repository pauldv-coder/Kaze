Kaze es la plataforma de mejoramiento de procesos lean de Cota: proyectos A3, indicadores, acciones y, ahora, la **captura de procesos** — entrevistas con el personal que terminan en diagramas BPMN 2.0 editables, documentados y exportables. Este sistema reúne los tokens y componentes que ya viven en el código de Kaze y añade los patrones del módulo de captura, marcados como **adición** donde el código aún no los tiene.

El principio que gobierna todo: **el dato manda la jerarquía; el color comunica estado, nunca decora.**

## Contenido y voz

- Escribe en español, en tono de colega consultor: frases cortas, directas, en segunda persona de confianza («Define tu contraseña para entrar», «Reintenta; si persiste, avisa al equipo»).
- Mayúscula solo al inicio: «Nuevo diagrama», «Cerrar sesión», «Acciones vencidas». Nunca Title Case.
- Nombra las actividades con verbo + objeto en infinitivo: «Validar solicitud», «Descargar extracto», «Investigar diferencia». Una actividad sin verbo es una pregunta abierta, no una actividad.
- Los errores dicen qué pasó y qué hacer, sin culpar ni mostrar texto técnico: «No pudimos cargar esta pantalla. Hubo un problema al leer los datos.» Nunca muestres el mensaje de la base de datos.
- Cifras en formato colombiano/español: coma decimal y tabulares (`8,2 días`, `91,4 %`). Fechas cortas en minúscula: `29 abr`, `hace 5 s`.
- Sin emoji. Los únicos símbolos son glifos tipográficos con significado fijo (ver Iconografía).
- Los términos BPMN se quedan en su forma estándar cuando el analista los necesita (pool, carril, compuerta, evento), pero la entrevista nunca obliga a usarlos: se pregunta «¿qué pasa si falta información?», no «¿qué compuerta es?».
- **El procedimiento se cuenta en tercera persona y en presente**, como un relato para quien lo cumple: «El auxiliar contable descarga el extracto bancario». La interfaz le habla al analista (segunda persona); el documento habla del proceso.

## Fundamentos visuales

### Color

- Fondo de la app en `color-panel`; todo contenido va en superficies `color-blanco` con borde de 1px `color-borde`. Separa con bordes, no con sombras.
- Texto principal en `color-tinta`; secundario, metadatos y rótulos en `color-apagado`, **solo sobre `color-blanco`** (sobre panel no llega a 4,5:1). Por eso los chips neutros van sobre blanco.
- `color-marca` es exclusivo de marca e interacción: el anillo del logo, el ítem activo de la barra lateral, la línea de las sparklines, la selección en el lienzo y el foco. **Nunca** lo uses para comunicar estado ni como fondo de tarjetas.
- `color-marca-cta` (adición) es el mismo naranja un poco más oscuro, solo para el fondo del botón `acento`: la acción principal de una pantalla, como «Exportar documento». Texto blanco a 4,61:1; hover y presionado en `color-marca-cta-hover` (6,04:1). Uno por pantalla.
- Verde (`color-estado-bien`), ámbar (`color-estado-alerta`) y rojo (`color-estado-mal`) son **solo estado del dato**. Siempre van con icono o palabra además del color: «▼ Mejora», «● En riesgo».
- `color-estado-alerta` es para puntos, barras y bordes; el texto ámbar va en `color-estado-alerta-texto` sobre blanco.
- La flecha dice hacia dónde se movió el indicador; el color dice si eso es bueno. En «Lead time», bajar es mejorar: ▼ se pinta en verde.
- La barra lateral es `color-tinta` con texto `color-lateral-texto`, rótulos `color-lateral-tenue` e ítem activo `color-lateral-activo` más una barrita de 4px en `color-marca`.
- Kaze tiene un solo tema, claro. No hay modo oscuro en el código.

### Tipografía

- Dos familias, ambas incluidas como archivos: **Space Grotesk** (`display`) para títulos y números; **Hanken Grotesk** (`sans`) para interfaz, etiquetas y cuerpo.
- Todo número que se compara va en `display` con `font-variant-numeric: tabular-nums`: `kpi-grande` en el resumen, `kpi-fila` dentro de tablas.
- Título de página en `titulo-pagina` con `subtitulo` en `color-apagado` debajo. Nombres de filas y tarjetas en `titulo-tarjeta`, con `meta` debajo.
- Cabeceras de columna y rótulos de campo en `etiqueta-columna`, en MAYÚSCULAS y `color-apagado`.

### Espaciado, radios y densidad

- Escala de 4px: `spacing-1` a `spacing-7`. Página con `spacing-7` a los lados y `spacing-5` arriba y abajo; filas-tarjeta con `spacing-4` × 14px y `spacing-2` entre ellas.
- Radios: `radius-md` para controles y chips, `radius-lg` para tarjetas y paneles, `radius-sm` para piezas pequeñas, `radius-full` para avatares y puntos.
- La vista del consultor sigue la dirección **Instrumento** del prototipo: densa, técnica, rejilla a la vista, máxima información por pantalla. La tabla de actividades usa `celda` (13px) y filas de 36px.
- Sombras solo en lo que flota: `shadow-lg` para menús, popovers y el panel de detalle; `shadow-sm` para una tarjeta que se arrastra.

### Estados de interacción

- Hover de filas y menús: fondo `color-panel`. En la barra lateral: `color-lateral-hover`.
- Foco de teclado (adición): anillo sólido de 2px en `color-foco` con 2px de separación. Llega a 3:1 sobre blanco, panel y tinta.
- Deshabilitado / «Próximamente»: texto atenuado, sin hover, `cursor: default`, con `title` que lo explica.
- `color-borde` es decorativo (1,35:1): un campo se reconoce por su forma y su rótulo, no solo por el borde. No lo uses como único indicio de un control.

## Patrones del módulo de captura de procesos

Todo lo de esta sección es **adición** al código actual de Kaze.

### Confirmado, sugerencia de IA y pregunta abierta

Cada actividad, conexión, decisión y campo lleva un estado de confirmación, y los tres se distinguen por palabra, icono **y** estilo de línea, no solo por color:

| Estado | Chip | Línea | Color |
|---|---|---|---|
| Confirmado | «✓ Confirmado» | continua | `color-tinta` |
| Sugerencia IA | «IA Sugerencia» | discontinua | `color-sugerencia-ia` sobre `color-sugerencia-ia-fondo` |
| Pregunta abierta | «? Pregunta abierta» | punteada | `color-estado-alerta-texto` sobre blanco |

- Lo sugerido por la IA nunca se mezcla con lo confirmado: vive con fondo `color-sugerencia-ia-fondo`, borde discontinuo y las acciones «Aceptar» / «Descartar». Solo el analista lo convierte en confirmado.
- La IA no inventa dueños, reglas, duraciones ni conexiones. Si falta el dato, el campo queda **Desconocido** y se genera una pregunta abierta.
- En el diagrama, una conexión sugerida se dibuja discontinua en `color-bpmn-sugerido` hasta que se valida.

### Desconocido, no aplica y cero

Son tres valores distintos y la interfaz nunca los confunde (`ValorCampo`):

- **Desconocido** — «?» en `color-estado-alerta-texto` con subrayado punteado: aún no se sabe; cuenta como pregunta abierta.
- **No aplica** — «N/A» en `color-apagado`: se preguntó y el campo no corresponde.
- **Cero** — `0` en `tinta`, tabular, con su unidad: se midió y es cero (p. ej., espera de 0 h).
- Vacío sin tocar se muestra como «—» en `color-apagado` y no cuenta como respuesta.

### De lo general a lo particular

La captura de actividades va en dos pasos, y la interfaz no mezcla uno con otro:

1. **Listar y agrupar.** Primero se ven todas las actividades, sin detalle: `TableroFases` con `compacto`, una columna por fase y «Sin fase» al final. Se escribe cada actividad directamente en su columna («+ Agregar actividad», Enter agrega y deja el cursor listo para la siguiente; pegar varias líneas crea una por línea), se crean fases en la misma vista («+ Nueva fase») y se ordena arrastrando. Las tarjetas muestran solo número, nombre y estado; un clic en el nombre lo corrige ahí mismo.
2. **Caracterizar.** Después, una actividad a la vez: a la izquierda la lista completa con cuánto falta de cada una; a la derecha su ficha con todas las secciones y «Anterior / Siguiente». Lo que falta se ve como vacío o «?», nunca se rellena solo.

Una tabla con todas las actividades y sus datos clave sirve para revisar en bloque, no para empezar.

### La ficha de una actividad

Todo lo de una actividad se captura en su ficha, en este orden: **Básico** (nombre, descripción, responsable, área, apoyo y **¿Quién la ejecuta?**: persona, sistema o IA/automatización), **Entradas y entregable**, **Tiempos y volumen**, **Recursos**, **Formatos y adjuntos**, **Reglas y problemas**, **Fuente y confirmación**, **Eventos y ciclo** y, al final, **Decisión**.

- La decisión va al final porque es lo último que pasa en la actividad: con el mismo contenido de `TarjetaDecision` (pregunta, quién decide, tipo y salidas con su siguiente actividad). Las decisiones que aún no tienen actividad de origen se listan aparte, como «Decisiones por ubicar», hasta que se les asigna una.
- Cierra la ficha **«Así se lee en el procedimiento»**: el paso contado tal como sale en el documento, sobre una hoja blanca. Mientras más completa la ficha, mejor se lee; lo que está «?» sale en color. Es la razón para llenar los campos, no un adorno.
- La lista de la izquierda muestra por actividad el ícono de quién la ejecuta, la hoja si tiene formatos y el avance de la ficha.

### Eventos y ciclo

Los eventos se capturan en la actividad que afectan, no sueltos en el diagrama. Se leen como frases y el diagrama los dibuja solo:

- **Antes de empezar / al terminar**: espera un tiempo, una fecha, un mensaje o respuesta, o que se cumpla una condición → evento intermedio antes o después de la tarea. «Envía un aviso al terminar» → evento que lanza un mensaje.
- **Mientras se hace**: un límite de tiempo o un error → evento sobre el borde de la tarea, con adónde pasa el proceso (otra actividad o «termina el proceso»); el límite puede detener la tarea o seguir en paralelo.
- Un mensaje con otra organización (el cliente, el banco) se dibuja como pool externo unido por un flujo de mensaje.
- **Ciclo**: «se hace una vez», «se repite hasta cumplir una condición» (marca de bucle) o «se hace por cada elemento», a la vez o uno tras otro (marca de instancias múltiples).
- Así se capturan los tiempos de espera por procesamiento y los ciclos de ejecución sin dibujar nada a mano.

### Formatos y adjuntos

- Una actividad puede tener formatos: nombre, código, versión y el archivo o un enlace a la versión vigente. Un formato registrado se reutiliza en otras actividades sin volver a subirlo.
- La tarea lleva una hoja arriba a la derecha (a la izquierda del ícono de quién la ejecuta).
- En el documento del proceso, cada formato es un **anexo** numerado en el orden en que aparece por primera vez; el mismo código es el mismo anexo aunque lo usen varias actividades.

### Fases, secuencia y numeración

- Una **fase** organiza el trabajo; no es un departamento, un dueño ni un carril. En el tablero (`TableroFases`) es una columna (`ColumnaFase`) con objetivo, criterios de entrada, entregables y criterios de salida.
- **El tablero es la secuencia del proceso**: las fases se leen de izquierda a derecha y, dentro de cada fase, las actividades de arriba abajo. Arrastrar una tarjeta —dentro de su fase o a otra— cambia la secuencia.
- **El número de actividad sale de esa posición** (`ACT-01`, `ACT-02`…) y se recalcula con cada movimiento; los números que cambian parpadean un instante con un anillo `color-marca`. La tabla de actividades muestra el mismo número y el mismo orden.
- Cada actividad tiene además una **clave interna** que no cambia nunca. Decisiones, entregables, comentarios, preguntas y el diagrama apuntan a la clave, así que al renumerar se actualizan solos: nada queda apuntando a un número viejo.
- Las actividades de la columna «Sin fase» **no tienen número** hasta que se ubican en una fase.
- Al generar el diagrama, cada actividad se conecta con la siguiente de la secuencia, salvo donde una decisión define otras salidas o marca actividades en paralelo (ver Decisiones).
- En el diagrama, las fases son una superposición opcional dibujada como artefacto **Group** de BPMN (raya y punto, `color-bpmn-grupo`). Nunca insertes una compuerta solo porque cambia la fase.
- Los carriles salen de los roles responsables confirmados; los pools, de los participantes (organizaciones).

### Decisiones

Se capturan como pregunta en lenguaje natural (`TarjetaDecision`) y el sistema elige la compuerta:

- «Solo uno de los caminos» → compuerta **exclusiva** (rombo con ×).
- «Uno o varios según el caso» → compuerta **inclusiva** (rombo con ○).
- «Todos a la vez» → compuerta **paralela** (rombo con +).
- Cada salida lleva su condición y su siguiente actividad; una puede ser la ruta por defecto. Retrabajo, rechazo y cancelación son salidas explícitas, no notas.
- Una decisión manda sobre el orden del tablero: después de ella, el flujo sigue sus salidas, no la tarjeta de abajo. Lo que ocurre «todos a la vez» se declara con una decisión paralela; el tablero por sí solo es una secuencia lineal.
- El origen y la siguiente actividad de cada salida se guardan por clave y se muestran con su número actual: mover actividades nunca rompe una decisión.
- La decisión se captura al final de la ficha de su actividad de origen (ver La ficha de una actividad).
- **Una decisión nunca se borra sola.** Si un movimiento cambia su contexto —el origen cambió de fase o quedó sin fase, una salida ahora vuelve hacia atrás sin estar marcada como retrabajo, o una actividad de la que depende se eliminó— pasa a **Revisar**: borde punteado ámbar, glifo «!» y los motivos, con «Mantener así», «Es retrabajo», «Cambiar destino», «Reasignar origen» o «Eliminar decisión». Solo el analista la elimina.

### Actual (As-Is) y propuesto (To-Be)

- El proceso actual y el propuesto son versiones separadas del mismo modelo. `EtiquetaVersion` los distingue: «Actual · As-Is» en chip lleno `color-tinta`; «Propuesto · To-Be» en chip blanco con borde discontinuo `color-tinta`.
- Una mejora propuesta nunca edita el As-Is: se registra en el To-Be.
- La versión que se ve se elige en `SelectorVersion`, una lista desplegable en la cabecera: cada opción muestra su `EtiquetaVersion` y su estado, y la última crea el To-Be a partir del As-Is (con confirmación).

### Cabecera del proceso

La cabecera responde, en este orden: dónde estoy, en qué estado está, qué versión veo y qué hago ahora.

- **Estado arriba a la derecha**, a la altura de las migas: `EstadoProceso` con `destacado` (rótulo «Estado» y píldora). No es un botón y no se confunde con uno.
- Debajo del título, de izquierda a derecha: `IndicadorGuardado`, **Deshacer** e **Historial** como `BotonIcono` (la palabra aparece al pasar el mouse o con el foco), `SelectorVersion` y, al final, el CTA.
- **El CTA es uno**: «Exportar documento», botón `acento` (`color-marca-cta`, texto blanco). Las demás acciones de la cabecera son secundarias o íconos.
- En el teléfono las migas se reducen a «‹ Captura de procesos» (el título ya dice dónde estás), el estado sigue arriba a la derecha y el CTA baja a su propia línea.

### Estados del proceso y aprobaciones

- El proceso pasa por **Borrador → En revisión → Aprobado**, con «Cambios solicitados» como vuelta atrás (`EstadoProceso`). Borrador es neutro; En revisión, ámbar; Aprobado, verde; Cambios solicitados, rojo.
- La aprobación va en **dos etapas** (`PanelAprobacion` con `etapas`): primero, si el dueño lo pide, el **visto bueno de las áreas que intervienen**; cuando todos lo dan, la **aprobación final** del gerente o los aprobadores. Las personas se eligen de los contactos del proceso (ver Contactos y RACI).
- Cada aprobación queda atada a una versión exacta (p. ej., «As-Is v3»); editar después de aprobar abre una versión nueva y vuelve a pedir aprobación.
- Pedir cambios exige un comentario; aprobar no. Un solo pedido de cambios devuelve la versión a **Cambios solicitados**, el comentario queda como pregunta abierta en el Resumen y, ya corregida, la versión se vuelve a enviar a las mismas personas.
- No se envía a revisión mientras el diagrama tenga errores: una versión aprobada ya no se edita, y con errores no se podría exportar.

### Contactos y RACI

Los contactos del proceso son su matriz RACI: nombre, cargo, área, correo y papel.

- Papeles: **Elabora** (R), **Da visto bueno** (C), **Aprueba** (A) e **Informado** (I). El envío a revisión se prellena con ellos y se ajusta con listas desplegables.
- Cada contacto tiene un **código** para aprobar: prefijo del proceso + su número + cuatro caracteres de verificación, `CBM-03-K7QX`. El prefijo son las iniciales del nombre del proceso («Conciliación bancaria mensual» → CBM). Los cuatro caracteres evitan que alguien apruebe por otro adivinando el número siguiente.
- El código se muestra en monoespaciada, con `color-panel` de fondo. El correo se valida al salir del campo.
- La portada del documento dice quién **elaboró** y lista las **aprobaciones** por etapa.

### Aprobación por correo

Quien aprueba no necesita cuenta ni entrar a Kaze: recibe una **fotografía** del proceso.

1. Kaze descarga la fotografía de la etapa: un archivo HTML que se abre sin conexión, con En pocas palabras, alcance, SIPOC, diagrama, el paso a paso y los formatos de esa versión. Solo lee; no trae los códigos a la vista.
2. «Enviar correo» abre un mensaje por persona —en su programa de correo, Gmail u Outlook, o copiado— con su código; la fotografía se adjunta a mano.
3. La persona abre la fotografía, escribe su código («Tu respuesta»), aprueba o escribe qué hay que cambiar y envía. Se arma su respuesta con un **código de respuesta** (`KZR1.…`) que dice quién es, qué versión y qué decidió.
4. Cuando la respuesta llega, se pega en Kaze: se lee en claro («Marta Ríos da su visto bueno a As-Is v1») antes de registrarla. Se rechaza si es de otro proceso, de otra versión, de un envío anterior o de alguien que ya respondió.
5. Si la respuesta llega por otra vía, «Registrar a mano» la anota y queda marcada como «registrado a mano».

- El estado de cada persona va en su fila (Pendiente · Dio su visto bueno · Aprobó · Pidió cambios); el de cada etapa, a la derecha de su título (En espera · En curso · Completa · Con cambios). Una etapa en espera se ve atenuada.
- Al aprobarse, se ofrece avisar a los informados con el documento Word.

### Guardado

- Todo se guarda solo. `IndicadorGuardado` muestra «Guardado · hace 5 s», «Guardando…» o «Sin conexión · 3 cambios en cola». En la cabecera del proceso, «Deshacer» (Ctrl+Z) e «Historial» van a su lado como `BotonIcono`.
- El historial de cambios permite volver a cualquier punto; nunca se pierde lo capturado en una entrevista.

### Elementos BPMN

- Contornos y flujos de secuencia en `color-bpmn-trazo`, 2px (`bpmn-trazo`); rellenos en `color-bpmn-relleno`; cabecera de pools y carriles en `color-bpmn-carril`.
- El tipo de tarea sale de quién la ejecuta: persona → tarea de usuario, sistema → tarea de servicio, IA o automatización → tarea de script. Arriba a la derecha va su ícono (`IconoBPMN`), y la hoja si tiene formatos; el ícono estándar de bpmn-js arriba a la izquierda no se usa.
- Un camino de una decisión que termina el proceso lleva su evento de fin justo al lado de la compuerta, no al extremo del diagrama.
- **Ningún conector pasa por encima de una tarea, una compuerta o un evento.** Los flujos son ortogonales, cada salida de una compuerta sale por un lado distinto y las etiquetas no pisan formas.
- Flujos de mensaje discontinuos en `color-bpmn-mensaje`, solo entre pools distintos; los flujos de secuencia nunca cruzan el límite de un pool.
- Seleccionado: contorno `color-bpmn-seleccion`. Medidas de bpmn-js: tarea `bpmn-tarea-ancho` × `bpmn-tarea-alto`, evento `bpmn-evento`, compuerta `bpmn-compuerta`.
- El lienzo conserva el logo de bpmn.io (requisito de licencia).

### El diagrama se edita con las herramientas de bpmn.io

La captura es la fuente de la verdad; el lienzo es otra forma de editarla. Todo lo que se dibuja se traduce a la ficha, y el diagrama se vuelve a generar desde ahí (con los ajustes de posición guardados).

- **Paleta**: mover el lienzo, seleccionar varias formas, abrir o cerrar espacio, conectar, evento, fin, decisión, actividad, entregable y anotación. No trae lo que la captura no sabe guardar: otro inicio, almacén de datos, subproceso, pool ni grupo (las fases ya son grupos).
- **Menú de una forma**: agregar a continuación una actividad, una decisión, un evento o un fin; cambiar el tipo (llave); conectar; eliminar; y «Ficha», que abre la de su actividad.
- **Una decisión o un evento nuevos quedan dentro de la actividad anterior**: la decisión aparece al final de su ficha; el evento, en «Eventos y ciclo» (después de la actividad; antes de la siguiente si se dibuja en una rama). Un evento sobre el borde de una tarea es un límite de tiempo o un error «mientras se hace».
- **Una actividad nueva** entra en la fase donde se suelta, en la posición que le toca por su conexión o su lugar; su carril es su responsable. Una forma copiada trae su ficha.
- **Conectar**: de una decisión a una actividad agrega una salida; nombrar el conector escribe su condición. Conectar una actividad con otra que no es la siguiente crea (o amplía) su decisión, y se avisa.
- **Cambiar el tipo**: servicio → la ejecuta un sistema; script → IA o automatización; manual, envío, recepción y regla de negocio se conservan. La marca de ciclo es «se repite»; la de instancias múltiples, «por cada». En eventos, temporizador, mensaje y condición cambian la espera.
- Mover, rutas de conectores y etiquetas son **ajustes**: se guardan y sobreviven a los cambios de la captura; «Restablecer diseño» vuelve al trazado automático. Pasar una tarea a otro carril cambia su responsable, y se avisa.
- Doble clic renombra (el nombre llega a la ficha). Ctrl+Z en el lienzo deshace con el mismo historial de la app.
- Una versión en revisión o aprobada se ve pero no se edita.

### Revisión del diagrama y seguro de exportación

Junto al lienzo, «Revisión del diagrama» lista **errores** y **avisos**. Mientras haya un error, el proceso **no se exporta** —ni Word, ni .bpmn, ni SVG, ni XML— ni se envía a revisión: una versión aprobada ya no se edita y un documento con el flujo roto no sirve para cumplirlo.

- **Errores**: actividad sin nombre; decisión sin pregunta, con menos de dos caminos, con una salida sin destino o sin condición, o con más de un camino por defecto; más de una decisión en la misma actividad; límite o error sin a dónde seguir; actividad a la que nada lleva o desde la que nunca se llega a un fin; un conector que pasa por encima de una forma.
- **Avisos** (no bloquean): «Nueva actividad» sin renombrar, sin responsable, sugerencias de IA sin validar, esperas sin duración, mensajes sin qué ni de quién, hito sin nombre, inicio sin nombre, dos salidas al mismo destino.
- Las formas con error se marcan en rojo en el lienzo; la pestaña Diagrama lleva «!». Cada error lleva a su ficha o centra la forma en el lienzo.
- En «Exportar documento» los errores aparecen en rojo con «Ver en el diagrama», y los botones de descarga quedan deshabilitados.

### El procedimiento se cuenta

El documento Word del proceso es un **procedimiento narrado**: se lee como una historia de quién hace qué, con qué y qué entrega, en el orden en que pasa. La ficha técnica de cada actividad no desaparece: pasa a los anexos.

- **Tercera persona, presente, rol como sujeto**: «Con el extracto del mes, el auxiliar contable carga el extracto al sistema contable. Usa Siigo Nube. El resultado son los movimientos bancarios cargados. Toma media hora.»
- **Un paso por actividad**, con el mismo número que tiene en el diagrama y su código en gris (lleva a su ficha técnica). Cada fase abre con lo que busca, cómo empieza y termina, y qué entrega.
- Cada frase sale de un campo: entradas → «Con…»; nombre (verbo + objeto) → la acción; descripción (si empieza en infinitivo, se pasa a tercera persona); apoyo, herramientas, formatos (con su anexo) y documentos; criterio → «Antes de seguir, comprueba…»; entregable y receptor → «El resultado es…, que se entrega a…»; tiempos; esperas y avisos; ciclo → «Lo hace por cada…».
- Las **reglas** salen aparte como «**Importante:**» (borde `color-marca`) y los **problemas conocidos** como «**Atención:**» (borde ámbar).
- La **decisión** cierra el paso: «Luego se decide: **¿…?**» y una flecha por camino: «Si la respuesta es «Aprobada», sigue en el **paso 7**»; «vuelve al **paso 4**» cuando es retrabajo. Cuando a un paso se llega desde otro lugar, se dice al inicio: «También se llega a este paso desde el paso 3, si…».
- Lo que falta se dice en color (`color-estado-alerta-texto`, cursiva): «Por confirmar: cuánto tarda y cómo se sabe que quedó bien». Nunca se inventa un dato.
- Abre con **«En pocas palabras»** (cómo empieza y termina, cuántos pasos y fases, quiénes participan) y «Cómo leerlo».
- **Texto propio de un paso.** En «Así se lee en el procedimiento», «Escribir mi propio texto» abre un campo aparte —no es la descripción— que parte del texto automático. Lo que se escribe reemplaza el párrafo principal de ese paso tal cual; cómo se llega al paso, «Importante», «Atención», lo que falta confirmar y la decisión se siguen agregando solos. El título marca «texto propio» y «Volver al texto automático» lo quita.

### SIPOC

Resume el proceso de un vistazo antes del diagrama, en cinco columnas con su letra en `color-marca`:

- **Proveedores**: los del Resumen, más quien envía un mensaje desde fuera. **Entradas**: las que ninguna actividad produce, y los mensajes que llegan de fuera.
- **Proceso**: las fases, con sus pasos. **Salidas**: los resultados del proceso y los entregables que salen de él. **Clientes**: el cliente del proceso y quienes reciben entregables.
- Una columna vacía dice «Por definir» en color.

### Documento del proceso

Antes de las secciones numeradas van la **portada** (nombre, código, versión, estado con su fecha de aprobación, dueño, cliente, áreas, quién elaboró y las aprobaciones por etapa: etapa, nombre y cargo, decisión y fecha) y el **contenido** (dos niveles; Word pone los números de página al actualizar los campos). Luego:

1. **Objetivo**.
2. **Alcance**, en prosa: a qué aplica y qué no incluye, cómo empieza y termina, quiénes participan y quién recibe el resultado.
3. **SIPOC**.
4. **Diagrama** en una hoja completa horizontal. Si el proceso es muy largo va en franjas apiladas; si impreso no se lee, se agrega una hoja por fase con los carriles a la izquierda.
5. **El proceso paso a paso**: el relato, por fases.
6. **Anexos**: 6.1 formatos (con los pasos que los usan) y 6.2 ficha técnica de cada actividad (responsable, quién la ejecuta, entradas, entregable, tiempos, formatos, eventos, ciclo, la decisión o lo que sigue, y la fuente).
7. **Referencias**: las del Resumen (código, nombre, tipo y enlace).
8. **Control de cambios**, cuando hay versiones aprobadas: quién aprobó y quién dio el visto bueno, con su cargo.

- Un dato «?» sale como «Por confirmar»; un campo vacío no se menciona. Las actividades sin fase no se incluyen, y se avisa antes de exportar.
- Con archivos adjuntos se puede descargar un .zip con el documento y la carpeta «Anexos».
- No se exporta mientras el diagrama tenga errores (ver Revisión del diagrama).

## Iconografía

Kaze no usa una librería de iconos: usa glifos tipográficos con significado fijo, siempre acompañados de texto, y un juego pequeño de íconos del módulo BPMN.

- `▼` `▲` `▬` — dirección del cambio de un indicador (bajó, subió, estancado).
- `✓` — confirmado / hecho. `?` — desconocido o pregunta abierta. `!` — revisar: algo cambió alrededor de este dato. `↩` — salida que vuelve atrás (retrabajo). `IA` — sugerencia de IA (texto, no icono). `→` — un camino de una decisión en el procedimiento narrado.
- Asa de seis puntos (dibujada en CSS, `color-apagado`) — la tarjeta se puede arrastrar.
- `●` — punto de estado de 6px dentro de chips. `↳` — relación con un indicador o una actividad previa. `·` — separador de metadatos.
- Los elementos BPMN se dibujan en SVG con las formas estándar de la notación; no se sustituyen por iconos.
- **Íconos del módulo** (`IconoBPMN`, geometría en `ICONOS_BPMN`, 16×16, trazo 1,4): persona, engranaje (sistema), robot (IA o automatización) y hoja (formatos); los marcadores de eventos (tiempo, mensaje, aviso, condición, error, hito), la decisión y los de ciclo. Los mismos trazos en la interfaz, en las tareas del lienzo (arriba a la derecha) y en el documento Word. Siempre con palabra al lado o nombre accesible.
- **Íconos de acción**: deshacer, historial, abajo (abre una lista), copiar y descargar. Un ícono sin palabra al lado solo va en `BotonIcono`, que lleva la palabra como nombre accesible y la muestra al pasar el mouse o con el foco.
- Logo: `assets/Logos/kaze-marca.svg` (cuadro tinta con anillo marca). Sin logotipo en archivo: «Kaze» se compone en Space Grotesk 700.

## Accesibilidad

- Texto de 4,5:1 como mínimo sobre su fondo. Pares del código que no llegan y se mantienen tal cual: `color-apagado` sobre `color-panel` (4,25:1, por eso los chips van sobre blanco), `color-estado-alerta` como texto (3,25:1, usa `color-estado-alerta-texto`), blanco sobre `color-marca` (3,62:1: por eso el botón `acento` usa `color-marca-cta`, 4,61:1) y `color-borde` como límite de control (1,35:1).
- Verde y rojo tienen casi la misma luminosidad: nunca los distingas solo por color. Todo estado lleva palabra o glifo.
- Toda la captura se puede hacer con teclado: la tabla de actividades se navega con flechas, Enter edita, Esc cancela, Ctrl+Z deshace.
- En el tablero, cada tarjeta recibe el foco con Tab; Alt+↑/↓ la sube o baja dentro de su fase y Alt+←/→ la pasa a la fase vecina. Cada movimiento se anuncia («… movida a Cuadre, posición 2 de 5. Ahora es ACT-04.»). Esc cancela un arrastre con el ratón. Enter abre la ficha, F2 corrige el nombre y Suprimir elimina la actividad (con Deshacer).
- En pantallas táctiles la tarjeta se arrastra desde su asa de seis puntos, para que el resto de la tarjeta deje desplazar la página.
- `SelectorVersion` es una lista (`listbox`): se abre con clic, Enter o ↓; se recorre con flechas, Inicio y Fin; Enter o Espacio elige y Esc cierra y devuelve el foco al botón.
- La palabra de un `BotonIcono` también aparece con el foco del teclado; en pantallas táctiles no se muestra, y el nombre accesible la lleva siempre.

## Fuera de este sistema

- La dirección B «Informe» del prototipo (Newsreader, radio 14) no está en el código y no se incluye; queda como referencia para la vista de cliente.
- Los componentes de Kaze se recrearon a mano a partir de sus clases de Tailwind (`app/(app)/_components/`, `app/(app)/proyectos/_components/`, formularios de login y admin): no son el build de la app. Los de captura, aprobación y BPMN son diseño nuevo para el módulo.
