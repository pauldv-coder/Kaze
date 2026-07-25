# Kaze · Sub-proyecto 2 (tajada 1): App shell + Lista de Proyectos — Design Doc

Fecha: 2026-07-25 · Estado: **aprobado por el usuario** (brainstorming en sesión)
Prototipo de referencia: `reference/prototype/Cota - Lista de Proyectos.dc.html` (+ screenshots).

## 1. Contexto y alcance

La app tiene `/proyectos` como una lista mínima (código + título + cliente) sin navegación
ni chrome. El sub-proyecto 2 porta la pantalla real de Lista de Proyectos del prototipo.
Es demasiado para un spec, así que se rebana. **Esta tajada (1) = app shell + tabla rica +
summary strip, SOLO LECTURA.**

**Decisiones cerradas (respuestas del usuario):**
1. Alcance tajada 1: shell + tabla + strip, solo lectura.
2. Ítems del nav sin pantalla → **placeholders deshabilitados** (se dibujan en gris/no
   navegables; conservan el look y el mapa del producto).
3. Summary strip → **las 6 métricas, calculadas del dato real** (nada inventado).
4. Clic en fila → **no navegable aún** (el enlace al Editor A3 se activa cuando exista).

**Fuera de alcance (tajadas siguientes, cada una con su spec):**
- 2b: búsqueda + filtros facetados + orden (interactividad de cliente).
- 2c: modal "Nuevo proyecto" / creación (primera escritura de negocio).
- Toggle Consultor/Cliente y Vista de Cliente (sub-proyecto propio; requiere RLS por-cliente).
- Densidad cómoda/compacta (prop del prototipo) — YAGNI por ahora.

**Higiene incluida en esta tajada** (del handoff de la Fundación):
- El app shell / layout con navegación (hace descubribles `/admin` y `/cuenta`).
- Redirigir usuarios ya autenticados fuera de `/login`.
- Test de capa de datos como usuario `authenticated` (no service_role) → cubre RLS/grants.

## 2. Enfoque

Server-first, siguiendo el patrón existente: layout y páginas de `(app)` son server
components que leen vía la capa de datos con el cliente anon+cookies (`lib/supabase/server.ts`,
RLS por sesión). Solo las piezas interactivas son islas cliente pequeñas (menú de cuenta,
resaltado del nav activo). No se reintroduce el cliente browser ni se rompe el SSR.

## 3. Arquitectura y archivos

### App shell
- **`app/(app)/layout.tsx`** (NUEVO, server component): obtiene el usuario actual
  (`supabase.auth.getUser()`) y su perfil (`profiles`: nombre, iniciales, rol) + los datos
  del sidebar (clientes con conteo). Renderiza `<Sidebar>` + `<div class="main">{children}</div>`.
  Todas las páginas de `(app)` (proyectos, admin, cuenta) heredan el shell. Si por carrera no
  hay user, el proxy ya habría redirigido; defensivo: si `!user`, `redirect('/login')`.
- **`app/(app)/_components/sidebar.tsx`** (server): logo Kaze (marca), sección "Espacio de
  trabajo" con `<SidebarNav>`, sección "Clientes" (nombres + conteo, solo display, sin click),
  y `<AccountMenu>` en el pie con las iniciales/nombre/rol del usuario.
- **`app/(app)/_components/sidebar-nav.tsx`** (`'use client'`): lista de ítems del nav;
  resalta el activo con `usePathname()`. Ítems:
  - `Proyectos` → `/proyectos` (activo/navegable).
  - `Mapas de valor · VSM`, `Acciones`, `Indicadores`, `Casos de negocio`, `Plantillas A3`
    → **deshabilitados** (gris, `cursor:default`, sin href, `title="Próximamente"`).
  No se portan los hijos por fase (son filtros → tajada 2b).
- **`app/(app)/_components/account-menu.tsx`** (`'use client'`): botón con avatar (iniciales)
  + nombre + rol; al abrir muestra menú con: **Cuenta** (`Link` → `/cuenta/contrasena`),
  **Administración** (`Link` → `/admin`, renderizado SOLO si `rol==='admin'`), y **Cerrar
  sesión** (un `<form action={signOut}>`). Cierra al hacer click fuera (overlay). Recibe
  `{ nombre, iniciales, rol }` por props desde el layout (server).
- **`app/(app)/actions.ts`** (`'use server'`): `signOut()` → `createClient()` (server),
  `supabase.auth.signOut()`, `redirect('/login')`.

### Página
- **`app/(app)/proyectos/page.tsx`** (reescrita, server): llama `getProjectsSummary` y
  `getProjectsList`, renderiza el header (título "Proyectos" + subtítulo), `<SummaryStrip>`
  y `<ProjectsTable>`.
- Componentes presentacionales (server, sin interactividad) en `app/(app)/proyectos/_components/`:
  - `summary-strip.tsx` — 6 celdas de métricas.
  - `projects-table.tsx` — encabezado de columnas + filas; **filas NO navegables** (un `<div>`,
    no `<a>`; sin cursor-pointer).
  - `estado-chip.tsx` — chip por estado (mapeo de colores del prototipo → tokens).
  - `a3-progress.tsx` — "N/7 pasos" + 7 barritas (llenas hasta `avance_pasos`).
  - `sparkline.tsx` — SVG server-rendered desde la serie (misma matemática que el prototipo:
    viewBox 88×26, pad 4, normaliza min/max; polyline + círculo en el último punto).
  - `team-avatars.tsx` — avatares circulares solapados con iniciales.

### Login hygiene
- **`app/(auth)/login/page.tsx`** (modificar): al inicio, si ya hay sesión
  (`getUser()` no nulo), `redirect('/proyectos')`.

### Capa de datos
- **`lib/data/projects.ts`** (extender). NUEVO:
  - `type ProjectListRow` y `getProjectsList(db): Promise<ProjectListRow[]>`:
    - Consulta `projects` (id, code, titulo, estado, avance_pasos, updated_at, client_id,
      consultor_id, lider_id, miembros) + embed `client:clients(nombre)`.
    - Carga `profiles (id, iniciales)` UNA vez → Map; resuelve `equipo` = iniciales de
      [consultor_id, lider_id, ...miembros] filtrando nulos y duplicados, en ese orden.
    - Carga `kpis (id, project_id, nombre, unidad, mejor_baja)` + `measurements (kpi_id, valor,
      fecha)` de esos KPIs. **KPI principal** = el KPI del proyecto con menor `created_at` que
      tenga ≥2 mediciones (si ninguno tiene mediciones → `kpiPrincipal = null`, la fila muestra
      "Sin medición aún"). Su `serie` = valores ordenados por `fecha`; `valor` = último;
      `delta` = último − primero; `deltaBueno` = (mejor_baja ? delta<0 : delta>0).
    - `accionesVencidas` = conteo de `actions` del proyecto con `vence < hoy` y `estado != 'done'`.
    - `updatedRel` = `updated_at` formateado relativo ("Hoy", "ayer", "hace N d", o fecha corta).
    - Orden por defecto: por `code` ascendente (determinista; el orden del prototipo es 2b).
  - `type ProjectsSummary` y `getProjectsSummary(db): Promise<ProjectsSummary>` — mapea a las
    6 celdas del prototipo (número real + sub-rótulo del prototipo):
    1. `total` = nº de proyectos. ("Proyectos totales")
    2. `activos` = nº con `estado in ('progreso','riesgo')`. (sub-rótulo "KPIs mejorando" —
       es descriptivo del prototipo; el número es el de proyectos activos, no un conteo de KPIs.)
    3. `enRiesgo` = nº con `estado='riesgo'`. ("Requiere atención")
    4. `accionesVencidas` = nº de `actions` con `vence < hoy` y `estado != 'done'`. ("Acciones vencidas")
    5. `cerrados` = nº con `estado='cerrado'` ("Cerrados"; sin filtro de trimestre para no
       depender de fechas frágiles del seed — decisión explícita).
    6. `ahorroAnual` = suma de `business_cases.ahorro_bruto_anual`; `inversion` = suma de `capex`;
       `nCasos` = nº de casos. ("Ahorro · $Xk inv · N casos")
  - `getSidebarClientes(db)`: `clients (id, nombre)` + conteo de `projects` por `client_id`
    (solo clientes con ≥1 proyecto), orden por nombre.
  - Helper puro exportado y testeable: `deltaFavorable(serie: number[], mejorBaja: boolean)`.

  Nota de implementación: por el volumen (8 proyectos, 7 KPIs, ~42 mediciones, 12 acciones,
  2 casos) se hacen unas pocas consultas simples y se agrega en TS; no hace falta RPC/SQL.

## 4. Mapeo visual (prototipo → tokens)

Ya existen en `app/globals.css`: `--color-marca` #f94202, `--color-tinta` #111,
`--color-panel` #eceef1, `--color-borde` #dadee2, `--color-apagado`, `--color-estado-bien`
#0f7a45, `--color-estado-mal` #c0392b, fuentes `--font-display` (Space Grotesk) / `--font-sans`
(Hanken). Sidebar oscura = `tinta`; acento/marca = `marca`; tarjetas blancas; chips de estado
usan bien/alerta/mal + un gris para "cerrado"/"por iniciar". El estado `nuevo` se rotula
"Por iniciar" (como el prototipo).

## 5. Responsive

Desktop-first: sidebar fija (~222px) a la izquierda en `md+`. En pantallas chicas: la sidebar
se colapsa a un header superior con el logo + el menú de cuenta; el contenido ocupa el ancho y
la tabla hace scroll horizontal (min-width tipo prototipo). Sin drawer animado (YAGNI).
`prefers-reduced-motion` respetado (sin animaciones de entrada obligatorias).

## 6. Testing

Integración (Vitest, contra el stack local seedeado):
- `getProjectsList`: 8 filas; A3-014 tiene KPI principal "Lead time de cierre" con `deltaBueno`
  true y equipo con iniciales de su consultor/líder; A3-030 (nuevo, sin serie) → `kpiPrincipal
  null`; conteo de acciones vencidas coincide con el seed.
- `getProjectsSummary`: `total=8, activos=5 (progreso 4 + riesgo 1), enRiesgo=1, cerrados=2`,
  `accionesVencidas` = conteo del seed, `ahorroAnual`/`inversion`/`nCasos` = suma de los 2 casos.
  (Los valores exactos de acciones vencidas y ahorro se fijan en el plan tras leer el seed real.)
- `deltaFavorable`: casos unitarios (baja-es-buena vs sube-es-buena, serie plana, <2 puntos).
- **Test authenticated (higiene)**: firmar como `carmen@cota.test` con el cliente anon y llamar
  `getProjectsList` → devuelve las 8 filas (prueba que RLS "equipo total" + grants dejan leer
  projects/clients/profiles/kpis/measurements/actions/business_cases bajo el JWT del usuario).

e2e de navegador (local, Claude Preview):
- Login carmen → `/proyectos` renderiza sidebar (Proyectos activo, resto deshabilitado), summary
  strip con las 6 métricas, y la tabla con 8 filas (chips, barras A3, algún sparkline, avatares).
- Ítems deshabilitados del nav no navegan.
- Menú de cuenta: **Administración** visible (carmen es admin) → va a `/admin`; **Cuenta** → va a
  `/cuenta/contrasena`; **Cerrar sesión** → vuelve a `/login` y `/proyectos` ya redirige a login.
- Ir a `/login` ya logueado → redirige a `/proyectos`.
- (Verificar que `/admin` y `/cuenta` también muestran el shell, al heredar el layout.)

## 7. Criterios de aceptación (DoD)

- [ ] `(app)/layout.tsx` envuelve proyectos/admin/cuenta con la sidebar; el menú de cuenta
      expone Cuenta, Administración (solo admin) y Cerrar sesión; logout funciona.
- [ ] `/proyectos` muestra summary strip (6 métricas reales) + tabla rica (estado, barras A3,
      sparkline del KPI principal, avatares de equipo, actualizado, acciones vencidas). Filas
      no navegables.
- [ ] Ítems de nav futuros deshabilitados (no 404).
- [ ] `/login` redirige a `/proyectos` si ya hay sesión.
- [ ] Tests de datos (incl. el authenticated) verdes; `npm test` completo verde; `npx tsc
      --noEmit` limpio; `npm run build` verde.
- [ ] e2e de navegador OK; docs (START-HERE + AGENTS si aplica) al día.
- [ ] Nada de escritura de negocio (sin creación) ni filtros en esta tajada.
