# Escenarios de aceptación — Captura de procesos

Salen de las 14 suites de Playwright del prototipo (`prototipo/pruebas/*.cjs`), que pasaron completas
en escritorio (1280–1440 px) y a 400 px, y se ajustaron a producción donde el spec cambia algo. Lo
marcado **[prod]** es nuevo o distinto respecto del prototipo.

Datos: el seed «Conciliación bancaria mensual» (`ejemplos/semilla.json`), del cliente «Despacho Andrade
& Vega» y vinculado a A3-014. Tiene 9 actividades: 8 en 3 fases (Preparación, Cuadre, Cierre) y 1 sin
fase, sugerida por la IA. Además, 2 decisiones y 5 contactos.

Todo escenario termina sin errores en la consola y sin desborde horizontal a 400 px.

## A. Lista y proceso nuevo

1. **[prod]** `/procesos` lista el proceso del seed con su código, nombre, cliente, A3, estado As-Is
   («Borrador») y fecha de actualización. El ítem «Captura de procesos» está activo en la sidebar.
2. **[prod]** «Nuevo proceso» pide el cliente (obligatorio), el A3 (opcional, solo los del cliente) y el
   nombre, y abre el editor. Tanto el proceso vacío como el eliminado vuelven a la lista.
3. **Proceso vacío.** Explica cómo empezar.
   - Se crean tres fases seguidas con Enter: «1 Recepción», «2 Validación», «3 Pago», y «Sin fase» queda
     al final.
   - Seis actividades quedan numeradas en orden, de ACT-01 a ACT-06.
4. «Caracterizar» empieza por ACT-01. En ACT-02 se sugiere como entrada el entregable de ACT-01, y al
   aceptarla se llena «Entradas».

## B. Cabecera

1. **Migas y estado:** las migas van arriba a la izquierda, y «ESTADO · Borrador» arriba a la derecha.
   A 1440 px de ancho, su borde derecho pasa de 1300 px y su borde superior queda por encima de 60 px.
2. **Íconos:** Deshacer e Historial son íconos con nombre accesible «Deshacer (Ctrl+Z)» e «Historial».
   Al pasar el mouse aparece la palabra, con opacidad > 0,9 tras 450 ms.
3. **CTA:** «Exportar documento» tiene fondo `rgb(217, 58, 0)` y texto blanco.
4. **Selector de versión:** es una lista desplegable con «Actual · As-Is v1 · Borrador ✓» y
   «+ Crear To-Be desde el As-Is». Se maneja con flechas, Enter y Esc (Esc la cierra y devuelve el
   foco). A 400 px la lista cabe en la pantalla.
5. **Deshacer y rehacer:** Ctrl+Z deshace y Ctrl+Y o Ctrl+Shift+Z rehacen, salvo dentro de un campo o del
   lienzo, que tienen sus propios atajos. Historial lista los cambios de la sesión y «Volver a este
   punto» funciona.
6. **Guardado:** el indicador pasa de «Guardando…» a «Guardado · ahora».

## C. Resumen, contactos y RACI

1. **Contactos y RACI:** una tabla con nombre, cargo, área, correo (si no es válido, se marca en rojo al
   salir del campo), papel (Elabora R · Da visto bueno C · Aprueba A · Informado I) y código.
2. **Códigos del seed:** los 5 siguen el formato `CBM-0N-XXXX`, con XXXX en `[A-Z2-9]`.
   **[prod]** Los 4 caracteres son aleatorios y fijos por contacto.
3. **Contacto nuevo:** «+ Contacto» le asigna el número siguiente.
4. **Prefijo [prod]:** el prefijo del código se edita hasta el primer envío; después queda fijo.
5. **Vínculos [prod]:** se puede cambiar el cliente y el A3; el A3 se filtra por cliente.
6. **Pendientes:** «Preguntas para la próxima sesión» junta las preguntas abiertas y los datos «?» de las
   fichas, y agregar una pregunta funciona.

## D. Fases

1. «Criterios» en el tablero abre la pestaña Fases con el foco en el objetivo de esa fase.
2. «Agregar entregables de sus actividades» completa los entregables de la fase.
3. Al volver a Actividades sigue abierta la subvista que se estaba usando.

## E. Actividades · 1 Listar y agrupar

1. Abre en «1 · Listar y agrupar».
2. **Alta y numeración:** un alta en Cuadre queda al final como ACT-06, y lo de Cierre se renumera. El
   cursor queda en «+ Agregar actividad».
3. **Pegar varias líneas** en «Sin fase» crea una actividad por línea.
4. **Renombrar:** un clic en el nombre lo corrige ahí mismo, y F2 hace lo mismo desde el teclado.
5. **Fase nueva:** «+ Nueva fase» crea la fase 4 antes de «Sin fase».
6. **Arrastre:** arrastrar de «Sin fase» a una fase le da número.
7. **Eliminar:** Suprimir sobre una tarjeta con foco la elimina, y Ctrl+Z la recupera.
8. **Mover con el teclado:** Alt+← pasa «Revisar y aprobar» a Cuadre. La decisión que sale de ella queda
   en **Revisar** dentro de la ficha (no se borra), y la pestaña Actividades avisa con «!».
9. **Abrir la ficha:** un clic en el resto de la tarjeta abre «2 · Caracterizar» con esa actividad
   marcada en la lista.

## F. Actividades · 2 Caracterizar (ficha)

1. **Anterior / Siguiente:** recorren la secuencia y el foco se queda en «Siguiente». El avance de la
   ficha cambia al llenar datos.
2. **Datos especiales:** «?» (desconocido), «N/A» y 0 son respuestas distintas; vacío no cuenta.
3. **Eventos y ciclo:** en «Investigar diferencias» se ve «Por cada partida sin cruce, uno tras otro» y
   la espera de la respuesta del cliente. «+ Límite de tiempo» con 3 días y destino ACT-05 agrega el
   evento de borde.
4. **Formatos:** «+ Adjuntar formato» sube un archivo con código FT-CON-03, y «Descargar» lo baja.
   **[prod]** Va a Storage.
5. **Decisión:** se captura al final de la ficha de su actividad de origen.
6. **Texto del procedimiento:** «Así se lee en el procedimiento» muestra el paso narrado.
   - La ficha conserva el campo Descripción.
   - «Escribir mi propio texto» abre «Tu texto para este paso», que parte del texto automático.
   - Lo escrito reemplaza el párrafo principal en la vista previa y en el Word; lo demás del paso
     (cómo se llega, «Atención», lo que falta) se sigue agregando solo.
   - El título marca «texto propio».
   - «Volver al texto automático» borra el texto propio.
7. **Atajos desde los avisos:** «sin responsable» abre la ficha de la primera actividad sin responsable,
   y «sin fase» abre Listar y agrupar.

## G. Tabla

1. «Tabla» muestra la columna «Datos», y el número de una fila abre su ficha.
2. En el To-Be hay una columna «Cambio» que marca las actividades nuevas y las modificadas frente al
   As-Is.

## H. Diagrama

1. **Dibujo y exportación:** el diagrama se dibuja con más de 10 elementos. La semilla no tiene errores,
   así que se puede exportar .bpmn.
   **[prod]** Se baja directo como `.bpmn`; el prototipo lo envolvía en .zip por una limitación del
   artifact.
2. **Paleta y menú:** la paleta solo ofrece lo que la captura sabe guardar, y el menú de una forma tiene
   agregar, cambiar tipo, conectar, eliminar y «Ficha».
3. **Decisión nueva desde el lienzo:**
   - Queda en la actividad anterior («Cargar extracto») y queda seleccionada; su única salida sigue a la
     actividad siguiente.
   - Mientras está incompleta hay errores: la revisión explica qué falta, la decisión se marca en rojo y
     la pestaña Diagrama avisa. No se exportan ni el .bpmn, ni el SVG, ni el XML.
   - Doble clic permite escribir la pregunta. Con pregunta, dos salidas y condición, ya no hay errores.
   - Ctrl+Z en el lienzo quita la decisión agregada.
4. **Tarea nueva:** una tarea soltada desde la paleta es una actividad nueva de la fase donde cae.
5. **Carriles:** pasar una tarea a otro carril cambia su responsable y se avisa.
6. **Nombres:** doble clic renombra, y el nombre llega a la ficha.
7. **Tipos:** cambiar el tipo de tarea cambia «quién la ejecuta», y en un evento, el tipo de espera.
8. **Ajustes:** «Restablecer diseño» borra los ajustes de posición.
9. **Flujo roto:** con el flujo roto (la ACT-04 sin entrada), no se exporta. Al deshacer, se puede de
   nuevo.

## I. Documento

1. **Carga perezosa:** `docx` no se carga al abrir el proceso.
2. **El modal:** muestra papel (Carta o A4), «una hoja por fase» y la lista «Antes de exportar» (sin fase,
   «por confirmar», campos vacíos, formatos sin archivo). Tiene dos botones: «Descargar Word» y
   «Word con anexos (.zip)».
3. **Tiempos y .zip:** en el prototipo, el Word de la semilla tarda unos 1,6 s. El .zip en A4 lleva el
   documento y la carpeta «Anexos».
4. **Bloqueo:** con errores en el diagrama, el Word no se descarga. El aviso lista los errores, y «Ver en
   el diagrama» cierra el modal y deja el diagrama a la vista.
5. **Sin red:** si no carga el generador, dice «No se pudo cargar el generador de Word. Revisa tu
   conexión…» y se puede reintentar.
   **[prod]** Con `import()` local ya no depende del CDN, pero conserva el manejo de error.
6. **Versión aprobada:** la portada lista las aprobaciones por etapa, dice quién elaboró y cuándo se
   aprobó, y hay «8. Control de cambios» con aprobadores y vistos buenos, con su cargo.
7. **Proceso grande:** `ejemplos/grande.json` (35 actividades) exporta sin errores.

## J. Versiones

1. **En revisión:** el tablero queda en solo lectura, sin altas ni asas, y un clic abre la ficha sin
   poder editarla.
   **[prod]** El servidor también rechaza el guardado (§5.4 del spec).
2. **To-Be:** con el As-Is aprobado, «+ Crear To-Be desde el As-Is» pide confirmación y crea el To-Be
   editable. El selector muestra «Propuesto · To-Be v1 · Borrador».
3. **Versión siguiente:** desde una versión aprobada o en revisión, «Crear As-Is v2 para editar» abre la
   versión siguiente en borrador. Si había una solicitud abierta, queda retirada.
   **[prod]** El número de versión solo lo cambia el servidor.

## K. Aprobación, lado del analista **[prod]**

1. **Preparar:**
   - Las personas vienen prellenadas por papel: visto bueno de Marta Ríos y Carlos Méndez, y
     aprobación final de Rosa Álvarez y Laura Gómez.
   - Si una persona está en las dos etapas, no se envía.
   - Si alguien no tiene correo, avisa pero deja enviar.
   - Si el diagrama tiene errores, no se envía.
2. **Enviar a revisión:** el estado pasa a «En revisión», con dos etapas. La etapa 2 dice «En espera · Se
   abre cuando lleguen todos los vistos buenos».
3. **Enviar correo:** el menú de cada persona abre mailto, Gmail u Outlook con el asunto
   «Visto bueno: Conciliación bancaria mensual (As-Is v1)» y un cuerpo con **el enlace** y **su código**.
   «Copiar el correo» copia todo.
4. **Registrar a mano:** marca a Carlos como «registrado a mano».
5. **Cambios pedidos:** cuando Laura pide cambios, el estado pasa a «Cambios solicitados», y su comentario
   aparece en la pestaña y en la sección «Cambios pedidos en la aprobación» del Resumen (§6.9 del spec).
   En el prototipo entraba a las preguntas.
6. **Reenviar:** «Enviar de nuevo a revisión» usa las mismas personas. El enlace anterior ya no sirve.
7. **Aprobado:** con todos aprobados, el estado es «Aprobado». La pestaña ofrece «Avisar a los
   informados» (Diego López, en CCO) y el historial dice «As-Is v1 · aprobada el … por Rosa Álvarez (Jefe
   de contabilidad) y Laura Gómez (Gerente financiera), con el visto bueno de Marta Ríos (Analista
   contable) y Carlos Méndez (Jefe de tesorería)».
8. **Retirar:** «Retirar de revisión» devuelve la versión a borrador.

## L. Página pública `/aprobar/[token]` **[prod]**

1. **Sin sesión:** abre sin iniciar sesión (no redirige a `/login`), con `noindex`.
2. **Código:** uno ajeno dice «no corresponde». El de Marta, escrito en minúsculas, la reconoce: «Hola,
   Marta Ríos (Analista contable). Te piden tu visto bueno de As-Is v1.»
3. **Contenido:** En pocas palabras, alcance, SIPOC, diagrama con zoom, paso a paso y formatos. Ningún
   código ni contacto a la vista.
4. **Aprobar:** «Estoy de acuerdo…» → confirmar → «Enviar mi respuesta». La respuesta queda registrada,
   se ve en la pestaña del analista y no se puede responder dos veces.
5. **Orden de etapas:** Rosa (etapa final) no puede responder antes de que Carlos dé su visto bueno.
6. **Pedir cambios:** sin texto no se envía. Con texto, cierra la ronda.
7. **Intentos:** con 10 códigos malos desde una IP, esa IP queda bloqueada 15 minutos. Con 50 fallidos en
   la solicitud, se bloquea para todos.
8. **Enlaces viejos o cerrados:** el enlace de una ronda anterior, retirada o cerrada muestra solo el
   mensaje que corresponde, sin el contenido del proceso.
9. **Datos en la página:** en el HTML y en los datos de la página no aparecen correos, códigos, hashes ni
   la lista de contactos. No se puede enmarcar (`frame-ancestors 'none'`) y el SVG va como
   `<img src="data:…">`.
10. **Móvil:** a 400 px, «Tu respuesta» va arriba y cabe sin desborde.

## M. Móvil (400 px)

1. **Actividades:** en Listar y agrupar, el tablero se desplaza de lado dentro de su caja, sin que la
   página se desborde. En Caracterizar hay un selector en lugar de la lista, y la ficha se ve completa.
2. **Cabecera:**
   - las migas se reducen a «‹ Captura de procesos»;
   - el estado sigue arriba a la derecha;
   - «Guardado» queda solo como punto;
   - el CTA baja a su propia línea.
3. **Aprobación:** en el panel, la decisión baja debajo del nombre.
4. **Modal de exportar:** cabe sin desborde.

## N. Guardado y concurrencia **[prod]**

1. **Persistencia:** todo persiste tras recargar.
2. **Dos pestañas:** con dos pestañas en el mismo proceso, la segunda en guardar recibe el conflicto de
   `rev` y ve «Alguien más actualizó este proceso: ves la versión más reciente.». No pisa lo de la
   primera.
3. **Guardados propios:** escribir rápido nunca produce un conflicto consigo mismo (hay un solo guardado
   en vuelo). Si se pierde la respuesta de un guardado y se reintenta, se reconoce como propio
   (`ultimo_guardado`).
4. **Sin conexión:** el indicador dice «Sin conexión · N cambios en cola», reintenta y guarda al
   volver.
5. **Cerrar con cambios pendientes:** cerrar la pestaña con cambios sin guardar pide confirmación.
