# Boton

Botón de acción con cuatro variantes; `secundario` es el de siempre y `primario` solo uno por vista.

Recreado a mano desde las clases de los formularios de Kaze (login, admin, `error.tsx`); `acento` viene del prototipo y ahora es el CTA de la pantalla.

- **primario** — fondo `color-tinta`, texto blanco: la acción principal de un formulario («Entrar», «Generar invitación», «Aprobar As-Is v3»).
- **secundario** — blanco con borde `color-borde`, hover `color-panel`: «Reintentar», «Cancelar», «Solicitar cambios».
- **acento** — el CTA: la acción principal de la pantalla, una sola («Exportar documento»). Fondo `color-marca-cta` (el naranja de marca un poco más oscuro) con texto blanco, 4,61:1 en cualquier tamaño; hover y presionado en `color-marca-cta-hover` (6,04:1). No lo uses para las acciones de un formulario: esas son `primario`.
- **destructivo** — texto `color-estado-mal` sin borde: «Cerrar sesión», «Descartar sugerencia».
- `tamano="sm"` — 12px, para acciones dentro de filas («hacer admin», «desactivar», «Copiar»).

El consumidor pone el texto (verbo en infinitivo, mayúscula inicial) y los atributos de `<button>`. Mientras una acción corre, cambia el texto («Invitando…») y usa `disabled`.
