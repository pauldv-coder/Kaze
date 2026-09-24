# TarjetaDecision

Una decisión del proceso escrita como pregunta, con sus salidas, condiciones y siguiente actividad; avisa cuando un movimiento en el tablero la deja por revisar.

Adición del módulo. El analista no elige compuertas: responde «¿solo un camino, uno o varios, o todos a la vez?» y la tarjeta muestra la compuerta BPMN resultante junto al tipo.

**Referencias por clave.** La decisión guarda la `clave` de su actividad de origen (`origen`) y la de cada destino (`salidas[].destino`), nunca el número. Pasa `secuencia` (de `secuenciaActividades`) y la tarjeta muestra el número actual: si la actividad se mueve y pasa de ACT-03 a ACT-05, la decisión dice «Después de ACT-05» sola. `DESTINO_FIN` como destino significa «Termina el proceso».

**Estado «Revisar».** `revisarDecision(decision, secuencia)` compara la decisión con la secuencia y devuelve los motivos; si hay alguno, la tarjeta se enmarca con borde punteado ámbar, muestra el estado «! Revisar» y lista los motivos:

- el origen se eliminó → «Reasignar origen» o «Eliminar decisión»;
- el origen quedó sin fase o cambió de fase (frente a `contexto.faseOrigen`, guardado al confirmar) → «Mantener así»;
- una salida vuelve hacia atrás (su destino quedó antes del origen) sin estar marcada como retrabajo → «Es retrabajo» o «Cambiar destino»;
- el destino de una salida se eliminó o quedó sin fase → «Cambiar destino».

La decisión **nunca se borra sola**: solo con «Eliminar decisión». «Mantener así» guarda los ids de los motivos en `aceptados`; si la actividad se vuelve a mover, el contexto cambia y el aviso vuelve.

- Cada salida: condición → siguiente actividad; una puede ser `porDefecto`. `clase` marca retrabajo, rechazo, cancelación o excepción con etiqueta, nunca solo con color.
- Lo que falta (dónde, quién decide, a dónde va) se muestra desconocido y se vuelve pregunta.
- Una decisión sugerida por la IA lleva fondo y borde de sugerencia hasta que se confirma. No se crea una decisión por cambiar de fase.

El consumidor pasa `pregunta`, `origen`, `decide`, `tipo`, `salidas`, `secuencia`, `contexto`, `aceptados` y los callbacks que quiera ofrecer: `onMantener(ids)`, `onReasignarOrigen`, `onEliminar`, `onMarcarRetrabajo(i)`, `onCambiarDestino(i)`, `onEditar`. Sin callbacks, la tarjeta es de solo lectura. `punto` y `salidas[].siguiente` en texto siguen funcionando para maquetas.
