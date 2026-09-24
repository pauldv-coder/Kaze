# CampoTexto

Campo de formulario con rótulo en `etiqueta-columna`, ayuda y error; sirve como `input`, `select` o `textarea`.

Recreado desde los `<input>` de login, admin y contraseña (`border-borde rounded-md px-3 py-2 text-sm`), con rótulo visible añadido: en la captura los campos se leen sin placeholder.

- Pasa `etiqueta` siempre; el placeholder solo sugiere formato («p. ej. Validar solicitud»).
- `error` pinta el borde y el mensaje en `color-estado-mal`; `ayuda` va en `color-apagado`.
- En la captura ningún campo es obligatorio para guardar: no marques asteriscos; lo que falta se muestra como `ValorCampo` desconocido.
