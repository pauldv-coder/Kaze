# Cota · Fundación (backend Supabase + app Next.js) — Diseño

- **Fecha:** 2026-07-05
- **Estado:** Aprobado (diseño) — pendiente de plan de implementación
- **Sub-proyecto:** 1 de 7 (Fundación)
- **Repo:** `C:\Users\pauld\dev\cota`

---

## 1. Contexto

"Cota" es una consultoría lean/six-sigma que gestiona proyectos de mejora (A3) para varias
empresas-cliente. El punto de partida es un **prototipo navegable** de 8 páginas exportadas de una
herramienta de diseño (formato `.dc.html` + runtime `support.js`, React por CDN, lógica en clases
`DCLogic`), con todos los datos *hardcoded* y compartidos entre pantallas solo vía `localStorage`.
El prototipo vive en `reference/prototype/` como especificación visual.

**Objetivo del proyecto:** convertir ese prototipo en una app real con backend Supabase que
persiste datos entre recargas y dispositivos, multi-cliente y multi-usuario, sobre el stack
Next.js + Supabase (dirección "Vento CMS").

**Decisiones ya tomadas (brainstorming):**
- Backend real con **Supabase** (no localStorage, no solo demo).
- **Portar a Next.js + Supabase** (no mantener el runtime `.dc.html`). El prototipo es la especificación de diseño.
- Auth: **equipo interno ahora, clientes después** — el esquema y RLS se preparan para abrir acceso por-cliente sin re-migrar.
- App para **una sola firma (Cota)** con varias empresas-cliente. No multi-firma todavía.
- Contenido profundo del A3 como **documento `jsonb`**; lo relacional se reserva para lo que se comparte entre pantallas.

## 2. Descomposición del proyecto (contexto)

Cada sub-proyecto tendrá su propio ciclo spec → plan → implementación.

1. **Fundación** *(este documento)* — repo, Supabase, auth, esquema, capa de datos, seed.
2. **Lista de Proyectos** — portada; CRUD de proyectos/A3 + clientes.
3. **Editor A3** — pantalla central; contenido de los 7 pasos por proyecto (`a3_content`).
4. **Casos de Negocio** — inversión/ROI/gastos, ligado al A3.
5. **Indicadores** — KPIs + mediciones (el enlace que ya funciona vía `cota.med.*`).
6. **Acciones · Kanban** — acciones PDCA por proyecto.
7. **Vista de Cliente** — informe derivado de todo lo anterior.

**Orden:** la Fundación desbloquea todo; luego cada pantalla se apoya en los datos de la anterior
(Proyectos → A3 → Casos/Indicadores → Acciones → informe de Cliente).

---

## 3. Alcance de la Fundación

### Objetivos (in scope)
- Repo Next.js nuevo, tipado, que levanta con `npm run dev`.
- Proyecto Supabase conectado; migraciones del esquema aplicadas.
- Auth del equipo (email + contraseña, solo invitación) con rutas protegidas.
- Capa de acceso a datos tipada (`lib/data/*`).
- `seed.sql` que carga los datos actuales del prototipo.
- **Prueba de vida:** ruta protegida `/proyectos` que lista los A3 leídos desde Supabase (sin diseño final).

### No-objetivos (out of scope — van en sub-proyectos 2–7)
- El diseño/port final de cada pantalla.
- Login/rol de cliente y RLS por-cliente (solo se deja el esquema listo).
- Edición del contenido A3, del Kanban, de casos, etc.
- Exportación de informes/PDF.

---

## 4. Stack

- **Next.js 15 (App Router) + React 19 + TypeScript.**
- **Supabase**: Postgres + Auth. `@supabase/ssr` (sesión por cookies, cliente servidor/navegador/middleware) + `@supabase/supabase-js`. Tipos generados con `supabase gen types typescript`.
- **Tailwind CSS** con tokens del prototipo:
  - Marca/interacción: `#F94202` (naranja). Base: `#111111`, blancos y grises (`#ECEEF1`, `#DADEE2`, `#6B7177`…).
  - Estado del dato: verde `#0F7A45`, ámbar, rojo. (Naranja **nunca** para estado.)
  - Fuentes vía `next/font`: **Space Grotesk** (display/números), **Hanken Grotesk** (texto).
- **Radix UI** primitives para dropdowns, modales y drawer (accesibilidad); estilizados con Tailwind.
- **Charts**: los SVG dibujados a mano del prototipo (sparklines, tendencia, recuperación de caja) se portan como componentes React de SVG. Sin librería de charts.
- **Lecturas** en Server Components (cliente Supabase de servidor); **escrituras** con Server Actions.
- Gestor de paquetes: `npm`. Lint/format: ESLint + Prettier.

---

## 5. Modelo de datos (9 tablas)

`projects` (el A3) es el hub. Todo cuelga de un `project_id` (directo o transitivo), lo que permite
RLS por-cliente más adelante. Todas las tablas: `id uuid pk default gen_random_uuid()`,
`created_at timestamptz default now()` salvo donde se indique.

### 5.1 `clients`
| col | tipo | notas |
|---|---|---|
| nombre | text not null | "Despacho Andrade & Vega" |
| sector | text | "Servicios contables · Santiago" |
| iniciales | text | "AV" |
| estado | text | activo/pausa (default 'activo') |

### 5.2 `profiles` (1‑1 con `auth.users`)
| col | tipo | notas |
|---|---|---|
| id | uuid pk references auth.users(id) on delete cascade | |
| nombre | text not null | "Carmen Vidal" |
| iniciales | text | "CV" |
| rol | text not null default 'consultor' | check in ('admin','consultor','cliente') |

Trigger `handle_new_user`: al crear un `auth.users`, insertar fila en `profiles`.

### 5.3 `projects`
| col | tipo | notas |
|---|---|---|
| code | text unique not null | "A3-014" |
| titulo | text not null | |
| client_id | uuid references clients(id) | |
| estado | text | check in ('nuevo','progreso','riesgo','cerrado') |
| fase | text | check in ('definicion','ejecucion','cerrado'); nullable |
| consultor_id | uuid references profiles(id) | consultor responsable |
| lider_id | uuid references profiles(id) | líder del cliente |
| miembros | uuid[] | ids de `profiles` (equipo). *Podría volverse tabla `project_members` si crece.* |
| fecha_inicio | date | |
| fecha_fin | date | |
| ahorro_anual | numeric | ahorro estimado/realizado |
| avance_pasos | int default 0 | pasos A3 completos (0–7) |
| a3_content | jsonb not null default '{}' | contenido de los 7 pasos (§5.10) |
| updated_at | timestamptz default now() | |

### 5.4 `kpis`
| col | tipo | notas |
|---|---|---|
| project_id | uuid references projects(id) on delete cascade | |
| nombre | text not null | "Lead time de cierre" |
| descripcion | text | |
| unidad | text | 'd', '%', 'h' |
| base | numeric | línea base |
| meta | numeric | objetivo |
| mejor_baja | boolean not null default true | true = menor es mejor |

### 5.5 `measurements` (mediciones — el enlace `cota.med.*`)
| col | tipo | notas |
|---|---|---|
| kpi_id | uuid references kpis(id) on delete cascade | |
| fecha | date not null | |
| valor | numeric not null | lectura del KPI |
| ahorro | numeric | ahorro realizado del mes |

### 5.6 `business_cases`
| col | tipo | notas |
|---|---|---|
| code | text unique not null | "BC-07" |
| project_id | uuid references projects(id) on delete cascade | 1‑1 lógico con el A3 |
| titulo | text | |
| capex | numeric | inversión inicial |
| opex_anual | numeric | costo recurrente/año |
| ahorro_bruto_anual | numeric | |
| tasa | numeric | tasa de descuento (VAN/TIR) |
| inicio | date | |
| fecha_limite | date | |

### 5.7 `expenses` (libro de gastos)
| col | tipo | notas |
|---|---|---|
| business_case_id | uuid references business_cases(id) on delete cascade | |
| fecha | date not null | |
| concepto | text | |
| monto | numeric not null | |
| tipo | text | check in ('inicial','recurrente','nuevo') |

### 5.8 `actions` (Kanban PDCA)
| col | tipo | notas |
|---|---|---|
| code | text unique not null | "AC-41" |
| project_id | uuid references projects(id) on delete cascade | |
| titulo | text not null | |
| descripcion | text | |
| estado | text | check in ('todo','doing','check','done') (PDCA) |
| prioridad | text | check in ('alta','media','baja') |
| owner_id | uuid references profiles(id) | |
| vence | date | |
| inversion | boolean default false | requiere caso de negocio |

### 5.9 `action_notes` (hilo de avance)
| col | tipo | notas |
|---|---|---|
| action_id | uuid references actions(id) on delete cascade | |
| fecha | timestamptz default now() | |
| autor_id | uuid references profiles(id) | |
| texto | text not null | |

### 5.10 Forma de `projects.a3_content` (jsonb)

Validado en la capa de app (tipo TS), no en la BD. Estructura de los 7 pasos:

```ts
type A3Content = {
  contexto?:      { descripcion?: string; generales?: {icon:string;label:string;value:string}[] };
  actual?:        { descripcion?: string; dolores?: {label:string;valor:string;unidad:string;dolor:string}[] };
  meta?:          { descripcion?: string; objetivos?: {label:string;valor:string;unidad:string}[] };
  analisis?:      { cincoPorques?: string[]; pareto?: {causa:string;pct:number;acum:number}[];
                    ishikawa?: unknown; vsm?: unknown };
  contramedidas?: { pick?: {id:string;nombre:string;resultado:string;dificultad:string;
                    impacto:string;cm:string;seleccionada:boolean}[] };
  plan?:          { gantt?: {nombre:string;resp:string;inicio:string;fin:string;peso:number}[];
                    controlCambios?: unknown[] };
  seguimiento?:   { kpis?: unknown[]; bitacora?: {fecha:string;autor:string;texto:string}[] };
};
```

---

## 6. Auth y RLS

- **Supabase Auth**: email + contraseña. **Signup público desactivado**; los consultores entran por invitación (o alta manual de admin).
- **RLS activado en todas las tablas.**
- **Política actual (equipo interno):** cualquier usuario autenticado (`auth.uid() is not null`) puede `select/insert/update/delete` en todas las tablas de negocio.
  - `profiles`: todos leen todos; cada quien actualiza solo su propia fila.
- **Preparado para clientes (futuro, no ahora):** como todo cuelga de `project_id → client_id`, para restringir a un cliente basta añadir una tabla de mapeo `client_members(client_id, profile_id)` y reemplazar las políticas por unas que filtren por membresía. No requiere re-migrar el esquema de datos.

---

## 7. Capa de acceso a datos

- `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/supabase/middleware.ts` (sesión SSR).
- `lib/database.types.ts` — tipos generados de Supabase.
- `lib/data/*.ts` — funciones tipadas por entidad; **único punto** por donde pasan las queries. P.ej.:
  - `projects.ts`: `getProjects()`, `getProjectByCode(code)`, `createProject(input)`.
  - `kpis.ts`: `getKpisForProject(projectId)`, `addMeasurement(kpiId, input)`.
  - `clients.ts`, `businessCases.ts`, `actions.ts`.
- Reglas: los componentes nunca llaman a Supabase directo; siempre vía `lib/data/*`.

---

## 8. Seed / migración del prototipo

`supabase/seed.sql` (o script TS de seed) que carga **los datos actuales del prototipo**, extraídos de `reference/prototype/`:

- **5 clientes:** Despacho Andrade & Vega, Logística Sur, Manufactura Délano, Clínica Norte, Retail Vega.
- **5 consultores** (`profiles` semilla, ligados a usuarios de prueba): CV Carmen Vidal, DL Diego López, MP María Paz, JM Javier Marín, RA Rodrigo Andrade.
- **8 proyectos A3:** A3-014, A3-009, A3-021, A3-018, A3-025, A3-012, A3-007, A3-030 (con su cliente, estado y equipo). `a3_content` completo al menos para **A3-014** (el único con contenido real en el prototipo); el resto con `a3_content` mínimo.
- **KPIs** (k1…k7) con su `base`/`meta`/`unidad`/`mejor_baja`, y su **serie histórica → filas en `measurements`**.
- **Casos de negocio** BC-07, BC-09 (con capex, tasa, fechas) y sus **gastos** en `expenses`.
- **12 acciones** (AC-41…) con estado PDCA, prioridad, owner y vencimiento.

Resultado: la app nueva abre mostrando el mismo contenido que hoy muestra el prototipo.

---

## 9. Estructura del repo

```
cota/
  app/
    (auth)/login/            # login del equipo
    (app)/proyectos/         # prueba de vida (lista A3 desde Supabase)
    layout.tsx  globals.css
  components/                # primitivas UI base (Radix + Tailwind)
  lib/
    supabase/                # server / client / middleware
    data/                    # acceso a datos por entidad
    database.types.ts
  supabase/
    migrations/              # esquema + RLS
    seed.sql                 # datos del prototipo
  reference/
    prototype/               # los .dc.html + support.js (especificación visual)
    screenshots/             # capturas de estados esperados
  docs/superpowers/specs/    # este spec y los siguientes
  middleware.ts              # refresco de sesión SSR
  .env.local.example         # URL + anon key de Supabase
```

---

## 10. Definition of Done (Fundación)

1. `npm run dev` levanta la app sin errores.
2. Proyecto Supabase conectado; migraciones (esquema + RLS) aplicadas.
3. `seed.sql` cargado: 5 clientes, 5 consultores, 8 A3, KPIs+mediciones, 2 casos+gastos, 12 acciones.
4. **Login del equipo funciona**; `/proyectos` está protegida (redirige a `/login` si no hay sesión).
5. `/proyectos` lista los A3 **leídos desde Supabase** vía `lib/data/projects.ts` (diseño mínimo, no final).
6. Tipos de Supabase generados y usados en la capa de datos.

---

## 11. Riesgos / preguntas abiertas

- **Provisión de Supabase:** no se puede crear el proyecto Supabase desde esta sesión no interactiva (el conector no está autenticado). Requiere que el usuario cree el proyecto / autorice el conector, o corra la CLI. El plan debe contemplar este paso como acción del usuario.
- **`estado` vs `fase`:** el prototipo mezcla estados (nuevo/progreso/riesgo/cerrado) y fases (definición/ejecución). Se modelan como dos columnas; a validar contra el uso real en el port de la Lista de Proyectos.
- **`miembros uuid[]` vs tabla `project_members`:** se empieza con array por simplicidad; si el equipo por proyecto crece o necesita metadatos, migrar a tabla.
- **`code` legibles (A3-014, BC-07, AC-41):** se conservan como identificadores de negocio (`unique`), separados del `id uuid` interno.
