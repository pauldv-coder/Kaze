# EstadoChip

Estado de un proyecto A3 en la lista de proyectos: en progreso, en riesgo, cerrado o por iniciar.

Copia exacta de `app/(app)/proyectos/_components/estado-chip.tsx`. Los estados neutros van sobre `color-blanco`, no sobre panel: `color-apagado` sobre `color-panel` no llega a 4,5:1.

El consumidor pasa `estado` tal como viene de `projects.estado`; un valor desconocido cae en «Por iniciar».
