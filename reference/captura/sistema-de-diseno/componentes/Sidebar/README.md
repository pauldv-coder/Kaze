# Sidebar

Barra lateral fija de 222px en `color-tinta`: marca, navegación del espacio de trabajo, clientes y cuenta.

Recreada desde `sidebar.tsx`, `sidebar-nav.tsx` y `account-menu.tsx`. El ítem activo lleva fondo `color-lateral-activo`, texto blanco 600 y una barrita de 4px en `color-marca`; los deshabilitados van en `color-lateral-tenue` con `title="Próximamente"`.

Para el módulo, añade «Captura de procesos» (o «Diagramas de proceso», como dice el spec del diagramador) a los ítems activos; «Mapas de valor · VSM» sigue deshabilitado. Por debajo de 768px se colapsa a una cabecera con el logo y el menú de cuenta.
