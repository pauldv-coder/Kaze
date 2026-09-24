# Kaze · Captura de procesos (BPMN) — Design Doc

Fecha: 2026-09-24 · Estado: **aprobado por el usuario** en lo funcional (decisiones tomadas con él al
construir el prototipo, sesiones de Cowork del 22 al 24 sept). El detalle técnico de §4–§7 es una
propuesta revisada (incluye una revisión de seguridad): se confirma o ajusta al escribir el plan.
**Reemplaza a:** `2026-07-26-kaze-diagramador-bpmn-design.md` (ver §1.2, decisión 2).
**Referencia funcional:** `reference/captura/`. Contiene el prototipo navegable
(`prototipo/kaze-captura.html`, se abre con doble clic), su código (`prototipo/src/`), el sistema de
diseño, ejemplos de entrada y salida, capturas, los escenarios de prueba (`ESCENARIOS.md`) y el SQL
probado (`sql-probado/`).
**El prototipo es la especificación de comportamiento**, igual que `reference/prototype/` lo es de lo
visual. Ante una duda de comportamiento, manda el prototipo; ante una de arquitectura o seguridad,
mandan este documento y `AGENTS.md`.

## 1. Contexto y alcance

El módulo sirve para levantar procesos en entrevistas con el personal de un cliente y convertirlos en
tres entregables que se mantienen sincronizados:

- la **ficha**: actividades, decisiones, eventos, tiempos, formatos y contactos;
- el **procedimiento narrado**: un documento Word;
- el **diagrama BPMN 2.0** editable.

Cada proceso tiene su versión actual (**As-Is**) y la propuesta (**To-Be**), y cada versión se aprueba
en dos etapas antes de darse por buena.

Se construyó como prototipo en el navegador con el usuario, en varias rondas: React 18, unas 7.700
líneas y los datos en `localStorage`. Esta tarea lo lleva a producción dentro de Kaze, con Next.js 16,
Supabase (esquema `kaze`) y el shell existente.

### 1.1 Qué hace (para ubicarse; el detalle está en el prototipo)

- **Lista de procesos** por cliente. «Nuevo proceso» pide el cliente (obligatorio), el proyecto A3
  (opcional) y el nombre.
- **Cabecera del proceso**:
  - migas y el estado de la versión arriba a la derecha;
  - guardado automático;
  - Deshacer (Ctrl+Z; Ctrl+Y o Ctrl+Shift+Z rehacen) e Historial de la sesión, como íconos que muestran
    la palabra al pasar el mouse;
  - una lista desplegable de versión (As-Is / To-Be, con «+ Crear To-Be desde el As-Is»);
  - el CTA «Exportar documento».
- **Resumen**:
  - objetivo, alcance, exclusiones, cómo empieza (disparador y tipo de inicio), resultados, cliente del
    proceso, dueño, áreas, proveedores, referencias y código del documento;
  - sesiones de entrevista con sus notas;
  - **contactos y RACI**: nombre, cargo, área, correo, papel y código de aprobación;
  - preguntas abiertas y datos por preguntar.
- **Fases**: objetivo, criterios de entrada y salida, y entregables de cada fase.
- **Actividades**, en dos pasos:
  - *1 · Listar y agrupar*: un tablero por fases con alta rápida y pegado de varias líneas; se ordena
    con arrastre y con teclado, y la numeración se recalcula sola;
  - *2 · Caracterizar*: la ficha completa de una actividad a la vez, con Anterior/Siguiente;
  - una *Tabla* para revisar todo en bloque.
  - La ficha cierra con la decisión y con «Así se lee en el procedimiento», que incluye el texto propio
    opcional del paso.
- **Diagrama**:
  - bpmn.io con paleta y menú propios; todo lo que se dibuja vuelve a la ficha;
  - los ajustes de posición se guardan;
  - una revisión lista errores y avisos;
  - exporta .bpmn y SVG, o copia el XML. Nada de esto funciona si hay errores.
- **Documento**: Word en Carta o A4, con el diagrama en franjas o en una hoja por fase, y un .zip con
  los anexos. Tampoco se descarga si hay errores.
- **Aprobación**:
  - visto bueno de las áreas (opcional) y aprobación final;
  - un correo por persona, con el enlace y su código, y una página pública para responder;
  - si alguien pide cambios, el flujo vuelve al analista;
  - el analista puede registrar una respuesta a mano o retirar la solicitud;
  - queda un historial de las versiones aprobadas.

### 1.2 Decisiones cerradas (respuestas del usuario)

1. **Pertenencia: cliente + A3 opcional.** Cada proceso pertenece a un cliente de `kaze.clients`
   (obligatorio) y puede vincularse a un proyecto A3 (opcional). Motivo: se levantan muchos procesos de
   un mismo cliente (decenas) sin abrir un A3 por cada uno.
2. **Reemplaza al diagramador BPMN** del spec `2026-07-26`: habrá un solo módulo. El diagrama sale de la
   ficha y se edita con bpmn.io; no hay un diagramador libre aparte. **Importar .bpmn** (Bizagi) queda
   para una versión posterior; exportar .bpmn sí entra en v1.
3. **Aprobación por enlace + código.**
   - El correo lleva un enlace a Kaze y el código de la persona.
   - La persona no necesita cuenta: abre el enlace, lee la «fotografía» de la versión y, con su código,
     aprueba o escribe los cambios que pide. La respuesta queda registrada sola.
   - El código identifica a quien responde; el enlace (secreto, §6.5) es lo que da acceso a leer.
   - Esto reemplaza el mecanismo del prototipo: un archivo HTML adjunto y una respuesta `KZR1.…` que el
     analista pegaba en Kaze. Ese mecanismo existía solo porque el prototipo no tenía servidor.
4. **Ya decidido en el prototipo (no re-litigar):**
   - Interfaz en español con el sistema de diseño de Kaze (artifact publicado; copia en
     `reference/captura/sistema-de-diseno/`).
   - **Documento:**
     - El procedimiento se narra en tercera persona y en presente.
     - La ficha técnica de cada actividad va como anexo.
     - El SIPOC va antes del diagrama.
     - Cada paso puede llevar un **texto propio** (campo aparte de la descripción) que reemplaza su
       párrafo automático.
   - **No se exporta ni se envía a revisión** con errores en el diagrama.
   - **Cabecera:**
     - El estado va arriba a la derecha como etiqueta.
     - As-Is/To-Be es una lista desplegable.
     - «Exportar documento» es el CTA naranja (`color-marca-cta` #D93A00 con texto blanco).
   - **Código de contacto:** es `PREFIJO-NN-XXXX` (iniciales del proceso, número del contacto y 4
     caracteres de verificación), para que nadie apruebe por otro adivinando el número siguiente.
   - **Aprobación en dos etapas:** primero el visto bueno de las áreas, si el dueño lo pide, y luego la
     aprobación final. La final se abre cuando llegan todos los vistos buenos.

### 1.3 Decisiones de este spec (propuestas al empaquetar; confirmar al planificar)

- **Sin SMTP en v1**, igual que las invitaciones de `/admin`. «Enviar correo» abre el mensaje ya armado
  en el programa de correo del analista, en Gmail o en Outlook web, o lo copia.
- **Sin IA en v1.** El prototipo trae dos flujos con IA (de las notas de una entrevista a actividades y
  decisiones sugeridas) que se ocultan cuando no hay IA. Aquí no se portan. Los prompts quedan en
  `prototipo/src/util.js` para una tajada posterior (server action con la API de Anthropic).
- **El proceso se guarda como un documento `jsonb`**, como `projects.a3_content`. La aprobación vive en
  tablas propias (§4).
  - El documento **solo lo escribe el editor**.
  - El estado de cada versión se deriva de las tablas de aprobación (§6.2).
  - El número de versión vive en columnas que solo cambian funciones del servidor (§4.2).
- **La evidencia de aprobación solo se escribe desde el servidor**, mediante funciones SQL que ejecuta la
  clave de servicio después de verificar al miembro, o al token y el código. Los miembros la leen, pero
  no la pueden editar por la Data API (§4.2).
- **Leer sin código.** Quien tiene el enlace lee la fotografía sin escribir su código; el código solo
  hace falta para responder. Si el usuario prefiere que también haga falta para leer, se implementa con
  una cookie firmada por la solicitud. **Confirmarlo al planificar.**
- Word, .zip, SVG y PNG del diagrama **se generan en el navegador**, como en el prototipo.

### 1.4 Fuera de alcance (v1)

- Importar .bpmn.
- Edición simultánea. Hay control de versión `rev` para que un guardado no pise a otro (§5.3).
- Envío automático de correos y avisos al analista cuando alguien responde. Lo ve al abrir la pestaña.
- IA.
- Vista de Cliente y RLS por cliente: sigue «equipo total».
- Historial persistente de cambios: Deshacer e Historial son de la sesión, como en el prototipo.
- Llegar a `/procesos` desde el celular: la barra móvil no tiene navegación (§9).

## 2. Enfoque: portar, no rediseñar

El prototipo tiene dos capas:

1. **Lógica pura** (sin DOM ni React). Se porta a TypeScript casi línea por línea en `lib/captura/`, con
   tests unitarios. Debe producir lo mismo que el prototipo; `reference/captura/ejemplos/` trae entradas
   y salidas de referencia.
2. **Interfaz.** Los componentes JSX se portan a componentes cliente TSX. Se conservan la estructura, los
   textos (el copy ya se revisó con el usuario) y el comportamiento de teclado. Cambian solo los
   adaptadores de la tabla de abajo.

Sistema de diseño:

- Sus componentes (`sistema-de-diseno/index.jsx`) se portan a TSX en `components/kaze/`.
- Su hoja de estilos (`bundle.css`, clases `kz-`) pasa a `components/kaze/kaze.css`. Ya está diseñada y
  probada con el prototipo; reescribir unos 36 KB de CSS como utilidades no le aporta nada al usuario y
  agrega riesgo.
- El marco de las páginas nuevas usa utilidades de Tailwind, como `/proyectos`.

| En el prototipo | En producción |
|---|---|
| `window.React` (UMD 18) | `import` de React 19 |
| `window.Kaze` (bundle del DS) | Componentes: `@/components/kaze`. Funciones puras: `@/lib/captura/secuencia.ts` (`numerarActividades`, `secuenciaActividades`, `codigoActividad`, `revisarDecision`, `DESTINO_FIN`) e `@/lib/captura/iconos.ts` (`ICONOS_BPMN`) |
| `window.BpmnJS` (CDN) | `bpmn-js@17.11.1` desde npm: `import('bpmn-js/lib/Modeler')` dentro de un componente cliente sin SSR, más sus 3 hojas de estilo |
| `window.docx` (CDN, carga perezosa) | `docx@9.6.1` desde npm: `await import('docx')` solo al exportar |
| `window.claude.use('downloads')` (`descargar` en `util.js`, que envolvía el .bpmn en un .zip por las extensiones que admite el artifact) | Blob + `<a download>` con la extensión real. El prototipo ya trae ese camino (`bajarDirecto`) para cuando no hay artifact |
| `almacenLocal` (`localStorage` con API de colección) | Server components para leer y server actions para guardar (§5) |
| `archivos.js` (adjuntos en IndexedDB) | Supabase Storage, bucket privado `kaze-captura` (§4.4) |
| `usar('sample')` (IA) | Oculto en v1 |
| `usar('user')` | El usuario de la sesión y su perfil de `kaze.profiles` |
| La fotografía HTML y el código `KZR1` (`fotografia.js`, `leerRespuesta`) | La página pública `/aprobar/[token]` y sus server actions (§6) |
| Fechas en la zona del navegador (`fechaCorta`, `relativo`) | `America/Bogota`, con `TZ` de `lib/data/metrics.ts` |

## 3. Mapa del código (prototipo → producción)

Las rutas de la izquierda son de `reference/captura/prototipo/src/` salvo que se indique otra cosa.

**Lógica pura → `lib/captura/`**

| Archivo | Qué hace | Destino | Cómo |
|---|---|---|---|
| `model.js` | Modelo, secuencia, To-Be y diferencias, avisos, completitud | `lib/captura/modelo.ts` (+ tipos) | Portar. `K().secuenciaActividades` y `K().revisarDecision` pasan a `secuencia.ts`. Fechas en `America/Bogota`. Quitar `estado`, `aprobacion`, `historial` y `numero` de la versión guardada (§4.3) |
| DS `index.jsx`: `numerarActividades`, `codigoActividad`, `secuenciaActividades`, `revisarDecision`, `DESTINO_FIN`, `ICONOS_BPMN` | Numeración, revisión de decisiones, geometría de íconos | `lib/captura/secuencia.ts`, `lib/captura/iconos.ts` | Portar |
| `lengua.js` | Gramática: infinitivo a tercera persona, artículos, listas | `lib/captura/lengua.ts` | Portar tal cual |
| `narrador.js` | Relato del procedimiento, SIPOC, límites del proceso | `lib/captura/narrador.ts` | Portar tal cual. También corre en el servidor para `/aprobar` |
| `anexosDe` (hoy dentro de `documento.js`) | Numeración de los anexos (formatos) | `lib/captura/anexos.ts` | Sacar a lógica pura: el servidor la necesita para el relato de `/aprobar`, igual que `fotografia.js` |
| `bpmn.js` + `rutas.js` | XML BPMN 2.0 con DI y ruteo ortogonal sin cruces | `lib/captura/bpmn/generar.ts`, `lib/captura/bpmn/rutas.ts` | Portar tal cual |
| `validar.js` | Revisión del diagrama (errores y avisos) | `lib/captura/bpmn/validar.ts` | Portar. También corre en el servidor al enviar a revisión |
| `sincronizar.js` | Del lienzo bpmn.io a la ficha | `lib/captura/bpmn/sincronizar.ts` | Portar. Recibe el modeler, así que solo se usa en el cliente |
| `aprobacion.js` | Prefijo, códigos, etapas, correos | `lib/captura/aprobacion.ts` | Portar lo vigente (§6.8). `prefijoProceso` con la corrección de §5.6. Quitar el códec `KZR1`, `hash53` y `nombreFotografia` |
| `documento.js` (sin `anexosDe`) | Word (docx) y .zip de anexos | `lib/captura/documento.ts` (solo cliente) | Portar. `window.docx` pasa a `import('docx')` y las aprobaciones salen de las tablas |
| `util.js` | zip, nombres de archivo, descarga, copiar, prompts de IA | `lib/captura/zip.ts` y utilidades | Portar `zip`, `nombreArchivo` y `copiarTexto`. La descarga es con Blob. Los prompts no entran en v1 |

**Interfaz → `app/(app)/procesos/`**

| Archivo | Qué hace | Destino | Cómo |
|---|---|---|---|
| `lienzo.js` | Modeler bpmn.io: paleta, menú, íconos, traducción, SVG y PNG | `[id]/_components/lienzo.ts` + `diagrama.tsx` | Portar. `window.BpmnJS` pasa a import dinámico |
| `app.jsx` | Estado, `cambiar`, deshacer/rehacer, autoguardado, cabecera, pestañas y lista | `[id]/editor.tsx` (raíz cliente) y `page.tsx` (lista) | Portar. El guardado va con server actions (§5) |
| `tabs.jsx` | Resumen (contactos y RACI), Diagrama, modal de pegar | `tab-resumen.tsx`, `tab-diagrama.tsx` | Portar. Los modales de IA no |
| `actividades.jsx` | Listar, Caracterizar, Tabla, Fases, ficha, relato | `tab-actividades.tsx`, `tab-fases.tsx`, `ficha.tsx`, `relato.tsx` | Portar |
| `decisiones.jsx` | Decisiones dentro de la ficha | `decisiones.tsx` | Portar |
| `exportar.jsx` | Modal del documento | `modal-documento.tsx` | Portar |
| `aprobar.jsx` | Pestaña Aprobación | `tab-aprobacion.tsx` | Adaptar a §6: sin fotografía descargable ni respuesta pegada |
| `fotografia.js` | Lo que ve quien aprueba | `app/aprobar/[token]/page.tsx` | Rehacer como página del servidor, con el mismo contenido y orden |
| `ui.jsx` | `Campo` (borrador local, Enter guarda, Esc deshace), Modal, Aviso, Confirmar, Pestañas | `_components/ui.tsx` | Portar |
| `app.css` | Estilos del módulo | `app/(app)/procesos/captura.css` | Portar anidado bajo `.captura` (§7) |
| `archivos.js` | Adjuntos en IndexedDB | `lib/data/procesos-archivos.ts` (Storage) | Reemplazar (§4.4) |
| `prototipo/seed.mjs` | Proceso de ejemplo | Sección nueva de `scripts/seed.ts` (solo local) | Portar (§8) |

Estructura propuesta:

```
lib/captura/                     lógica pura (sin DOM), con tests en tests/captura/
lib/data/procesos.ts             datos del editor (cliente como parámetro, patrón de lib/data/*)
lib/data/aprobaciones.ts         aprobación del lado del miembro: llama a las funciones SQL (cliente como parámetro)
lib/data/aprobacion-publica.ts   lo que usa /aprobar (cliente como parámetro, SIN 'server-only', para poder testearlo)
lib/auth/guards.ts               + requireMiembro() (sesión + fila en kaze.profiles), como requireAdmin()
components/kaze/                 componentes del DS en TSX + kaze.css
app/(app)/procesos/page.tsx                 lista y «Nuevo proceso»
app/(app)/procesos/actions.ts               server actions del editor y de la aprobación (requireMiembro)
app/(app)/procesos/[id]/page.tsx            carga en el servidor → <Editor/>
app/(app)/procesos/[id]/editor.tsx          raíz cliente
app/(app)/procesos/[id]/_components/…
app/aprobar/[token]/page.tsx                página pública (fuera de (app))
app/aprobar/[token]/actions.ts              'server-only' + createAdminClient(): identificar y responder
```

## 4. Datos

### 4.1 Migración `supabase/migrations/<AAAAMMDDhhmmss>_kaze_captura.sql`

Va al nivel superior de `supabase/migrations/` y con nombre timestamped (el CLI no recursa). No crea
ningún trigger sobre `auth.users`.

```sql
create table kaze.procesos (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references kaze.clients(id) on delete restrict,
  project_id      uuid references kaze.projects(id) on delete set null,
  prefijo         text not null check (prefijo ~ '^[A-Z0-9]{2,4}$'),   -- va en los códigos (§5.6)
  documento       jsonb not null,                                      -- §4.3 (sin números de versión)
  numero_asis     integer not null default 1 check (numero_asis > 0),  -- solo lo cambian funciones (§4.2)
  numero_tobe     integer check (numero_tobe > 0),                     -- null = no hay To-Be
  rev             integer not null default 0,                          -- concurrencia (§5.3)
  ultimo_guardado uuid,                                                -- id del último guardado (§5.3)
  nombre          text generated always as (documento->>'nombre') stored,
  codigo          text generated always as (documento->>'codigoDoc') stored,
  created_by      uuid references kaze.profiles(id) on delete set null,
  updated_by      uuid references kaze.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table kaze.aprobacion_solicitudes (
  id               uuid primary key default gen_random_uuid(),
  proceso_id       uuid not null references kaze.procesos(id) on delete cascade,
  version          text not null check (version in ('asis','tobe')),
  numero           integer not null check (numero > 0),
  ronda            integer not null check (ronda > 0),
  enlace_token     text not null unique,               -- ≥128 bits aleatorios (§6.5)
  estado           text not null default 'revision'
                   check (estado in ('revision','aprobada','cambios','retirada')),
  con_vobo         boolean not null,
  fotografia       jsonb not null,                     -- §6.4
  diagrama_svg     text,                               -- saneado; se muestra solo como <img> data: (§6.5)
  remitente_nombre text not null,
  remitente_correo text not null,
  enviada_por      uuid references kaze.profiles(id) on delete set null,
  enviada_at       timestamptz not null default now(),
  cerrada_at       timestamptz,
  unique (proceso_id, version, numero, ronda)
);
-- A lo sumo una solicitud abierta por proceso y versión.
create unique index aprobacion_una_abierta
  on kaze.aprobacion_solicitudes (proceso_id, version) where estado = 'revision';

create table kaze.aprobacion_personas (
  id             uuid primary key default gen_random_uuid(),
  solicitud_id   uuid not null references kaze.aprobacion_solicitudes(id) on delete cascade,
  etapa          text not null check (etapa in ('vobo','final')),
  orden          integer not null,
  contacto_num   integer not null,                    -- el NN del código
  nombre         text not null,
  cargo          text,
  area           text,
  correo         text,
  codigo         text not null,                       -- tal como se envió (para rearmar el correo)
  codigo_hash    text not null,                       -- sha256 del código normalizado (para buscar)
  decision       text not null default 'pendiente'
                 check (decision in ('pendiente','aprobado','cambios')),
  comentario     text check (comentario is null or length(comentario) <= 4000),
  respondida_at  timestamptz,
  via            text check (via in ('enlace','manual')),
  registrada_por uuid references kaze.profiles(id) on delete set null,
  unique (solicitud_id, contacto_num),
  check (decision <> 'cambios' or length(trim(coalesce(comentario, ''))) > 0)
);

-- Intentos de código en la página pública (límite por IP y por solicitud, §6.5).
create table kaze.aprobacion_intentos (
  id           bigint generated always as identity primary key,
  solicitud_id uuid not null references kaze.aprobacion_solicitudes(id) on delete cascade,
  ip_hash      text not null,                         -- sha256(ip + sal del servidor); nunca la IP en claro
  ok           boolean not null,
  created_at   timestamptz not null default now()
);

create index on kaze.procesos (client_id);
create index on kaze.procesos (project_id);
create index on kaze.aprobacion_solicitudes (proceso_id);
create index on kaze.aprobacion_personas (solicitud_id);
create index on kaze.aprobacion_intentos (solicitud_id, created_at);

create trigger trg_procesos_updated
  before update on kaze.procesos
  for each row execute function kaze.touch_updated_at();
```

### 4.2 RLS, grants y funciones

**Lecturas.** Todas las tablas del módulo tienen RLS con `kaze.es_miembro()`. Los
`alter default privileges` de `20260920000002_kaze_rls.sql` ya dan permisos sobre tablas nuevas de
`kaze`; aquí se **recortan** a propósito:

| Tabla | `authenticated` (miembros, vía RLS) | Escritura |
|---|---|---|
| `procesos` | `select`, `delete`. `insert` solo de `id`, `client_id`, `project_id`, `prefijo`, `documento`, `rev`, `ultimo_guardado`, `created_by` y `updated_by`. `update` de esas mismas, menos `id` y `created_by` | El editor, con el cliente de sesión. `numero_asis` y `numero_tobe` **no** son escribibles por miembros |
| `aprobacion_solicitudes`, `aprobacion_personas` | solo `select` (policy `miembros_select`) | Solo funciones SQL (abajo), con la clave de servicio |
| `aprobacion_intentos` | nada (`revoke all`) | Solo funciones SQL |

Los permisos por columna se hacen igual que `profiles` en la migración de RLS: `revoke update … from
authenticated` y luego `grant update (columnas) …`, y lo mismo con `insert`.

**Escrituras de la aprobación y del número de versión:** funciones `plpgsql` en `kaze` con
`security invoker` y `set search_path = kaze, pg_temp`, que llama la clave de servicio desde server
actions. Cada una toma `select … for update` sobre la fila que protege y valida el estado bajo ese
bloqueo.

- `aprobacion_enviar(proceso, version, rev_esperado, …)`:
  - bloquea el proceso y exige `rev = rev_esperado`;
  - exige que no haya solicitud abierta;
  - inserta la solicitud y las personas;
  - hace `rev = rev + 1`, para que un autoguardado atrasado choque (§6.1).
- `aprobacion_identificar(token, codigo_hash, ip_hash)`: registra el intento y aplica los límites (§6.5).
  Devuelve la persona o el motivo del rechazo.
- `aprobacion_registrar(solicitud, persona, decision, comentario, via, registrada_por)`:
  - bloquea la solicitud;
  - exige que esté `revision`, que la persona esté `pendiente` y que su etapa esté abierta;
  - registra la respuesta y recalcula el estado de la solicitud.
  - La usan la página pública y el registro a mano.
- `aprobacion_retirar(solicitud)`: la solicitud pasa de `revision` a `retirada`.
- `crear_version_siguiente(proceso, version)`:
  - bloquea el proceso;
  - si hay una solicitud abierta de esa versión, la pasa a `retirada` (así lo hace el prototipo desde
    «en revisión»);
  - hace `numero_x = numero_x + 1` y `rev = rev + 1`.
  - Crear el To-Be es una variante que fija `numero_tobe = 1`.

Esas funciones deben quedar **sin `EXECUTE` para `authenticated`**. Los `alter default privileges` de la
migración de RLS (l. 60–61) lo dan automáticamente, y el esquema `kaze` está expuesto en la Data API: sin
el `revoke`, cualquier usuario autenticado del ecosistema (también los del CMS y el HUB) podría
llamarlas como RPC. Hay que hacer `revoke execute on function … from public, authenticated;
grant execute … to service_role;` y cubrirlo con un test.

Qué está probado:

- El SQL de §4.1, los grants de esta sección y una función de ejemplo (`aprobacion_retirar`, con su
  bloqueo y su `revoke`) se probaron en un Postgres 16, con las dos migraciones actuales del repo y stubs
  de `auth`. Está en `reference/captura/sql-probado/`. Lo probado:
  - como miembro: crea y edita; `rev` condicional, `ultimo_guardado` y `touch_updated_at` funcionan;
    **no** puede cambiar `numero_asis`, escribir en `aprobacion_*`, leer `aprobacion_intentos` ni
    ejecutar la función;
  - como `service_role`: índice parcial y checks, respuesta condicional, búsqueda por hash del código,
    retiro con su estado y cambio de número;
  - fuera: no miembro 0 filas, `anon` con `permission denied`, y `restrict`/`set null` en los borrados.
- Las demás funciones se escriben en el plan con el mismo patrón, y con sus tests.

### 4.3 El documento del proceso (`procesos.documento`)

Tiene la forma de `nuevoProceso()` en `prototipo/src/model.js`, con estos cambios:

- Salen `id`, `creado`, `actualizado`, `rev` y `sesion`: viven en columnas (`rev`, `ultimo_guardado`,
  `updated_at`).
- Sale `remitente`: quien envía es el usuario de la sesión.
- En cada versión salen `estado`, `aprobacion` e `historial` (se derivan, §6.2) y **`numero`**, que vive
  en `numero_asis`/`numero_tobe`. Al cargar, el servidor lo inyecta en el modelo del cliente; al guardar,
  lo descarta.
- **Contactos** (`participantes[]`):
  - cada uno gana `verif`: 4 caracteres del alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, aleatorios
    (`crypto.getRandomValues`) y fijados al crear el contacto. En el prototipo se derivaban de un hash;
  - el documento gana `numSiguiente`, que solo crece. El prototipo usaba el máximo + 1, así que al
    borrar el último contacto su número se reusaba.

```ts
type Texto = string | null        // 'desconocido' = «?», 'na' = N/A, null = sin tocar, '' = vacío
type Numero = number | 'desconocido' | 'na' | null   // 0 es una respuesta, no un vacío

interface ProcesoDoc {
  nombre: string; objetivo: string; alcance: string; exclusiones: string; disparador: string
  inicio: { tipo: 'ninguno' | 'mensaje' | 'tiempo' | 'condicion'; detalle: string | null }
  codigoDoc: string | null                                  // «PR-CON-01»
  referencias: { id: string; codigo: string | null; nombre: string; tipo: 'interna' | 'externa' | 'ley' | 'otra'; enlace: string | null }[]
  resultados: string[]; cliente: string; clienteExterno: boolean; dueno: string
  departamentos: string[]; proveedores: string[]
  participantes: Contacto[]; numSiguiente: number
  sesiones: { id: string; fecha: string; participantes: string[]; notas: string }[]
  preguntas: { id: string; texto: string; origen: string; resuelta: boolean; fecha: string }[]
  versiones: { asis: Version; tobe: Version | null }
}
interface Contacto { id: string; num: number; nombre: string; rol: string /* cargo */; departamento: string /* área */
  correo: string; papel: '' | 'elabora' | 'vobo' | 'aprueba' | 'informado'; verif: string }
interface Version { fases: Fase[]; sinFase: string[]; actividades: Record<string, Actividad>; decisiones: Decision[]
  diagrama: { v?: number; formas?: Record<string, unknown>; rutas?: Record<string, unknown>; etiquetas?: Record<string, unknown>; notas?: unknown[] } }
interface Fase { id: string; nombre: string; objetivo: Texto; entrada: Texto; entregables: string[]; salida: Texto; actividades: string[] }
// Actividad, Decision, Evento, Formato: ver nuevaActividad(), nuevaDecision(), nuevoEvento() y nuevoFormato() en model.js.
// Actividad.relato (string | null) es el texto propio del paso; Actividad.origenClave enlaza el To-Be con el As-Is.
// Formato.archivo: en el prototipo { id, nombre, tipo, tamano }; aquí { id, path, nombre, tipo, tamano } (§4.4).
```

`ejemplos/semilla.json` es un documento completo, en el formato del prototipo (con `numero` dentro de la
versión), para usar como fixture.

### 4.4 Adjuntos de los formatos: Storage

- Van en un bucket `kaze-captura` privado, con 25 MB por archivo (el límite del prototipo) y migración
  aparte (`<AAAAMMDDhhmmss>_kaze_captura_storage.sql`).
- El proyecto de Supabase es compartido con el CMS y el HUB, así que el bucket y sus policies llevan el
  prefijo `kaze_captura`.
- Las policies sobre `storage.objects` exigen `bucket_id = 'kaze-captura' and kaze.es_miembro()`.
- **La ruta solo lleva ASCII**, porque Storage rechaza claves con tildes:
  `procesos/<proceso_id>/<uuid>/<nombreArchivo(nombre)>.<ext>`. El nombre original va en el documento.
- **Subida:** una server action (`requireMiembro`) crea una URL de subida firmada y el navegador sube el
  archivo directo a Storage con `fetch`. Así el archivo no pasa por la server action, que tiene límite de
  cuerpo (y Vercel corta en 4,5 MB), y no hace falta un cliente de Supabase en el navegador.
  `lib/supabase/client.ts` es código muerto que se quiere borrar.
- **Documento:** `formatos[].archivo = { id, path, nombre, tipo, tamano }`. Se mantienen `id`, `nombre`,
  `tipo` y `tamano` del prototipo, porque `documento.js` usa `archivo.id`.
- **Descarga:** URLs firmadas con el nombre original (`createSignedUrl(path, s, { download: nombre })`).
  El .zip de anexos baja los archivos con esas URLs.
- Quitar un formato no borra el archivo en el acto: puede estar en otra actividad o volver con Deshacer.
  Limpiar huérfanos es una tarea posterior (el prototipo lo hacía al abrir).

## 5. Editor: carga, guardado y concurrencia

### 5.1 Carga

`/procesos/[id]` es un server component. Lee el proceso (con `numero_asis`/`numero_tobe`), sus
solicitudes de aprobación (con personas), los clientes y proyectos para los vínculos, y el perfil del
usuario, y se lo pasa a `<Editor>`, un componente cliente. El editor maneja su copia de trabajo igual que
`app.jsx`: `local`, `pila`, `rehacer` y `cambiar(etiqueta, fn, op)`. Toda edición pasa por `cambiar`:
copia, cambia, apila para deshacer y programa el guardado.

### 5.2 Guardado automático

- Cada cambio espera unos 800 ms (el prototipo usa 700) y llama a la server action
  `guardarProceso(id, documento, revEsperada, guardadoId)`.
- **Un solo guardado en vuelo.** Mientras uno viaja, los cambios nuevos se acumulan y sale un único
  guardado con la última copia cuando vuelve el anterior. Así el editor no choca consigo mismo.
- Cada guardado lleva un `guardadoId` (uuid del cliente) que se escribe en `ultimo_guardado`.
- También se guarda en `visibilitychange`/`pagehide`, como en el prototipo, y `beforeunload` avisa si
  queda algo sin guardar.
- `IndicadorGuardado` muestra «Guardando…», «Guardado · hace N», «Sin conexión · N cambios en cola»
  (reintenta con espera creciente) o el error.
- Un documento suele pesar menos de 300 KB. El límite por defecto del cuerpo de una server action es
  1 MB, y Vercel corta en 4,5 MB. Revisa en la guía local de Next 16 cómo subirlo (p. ej. a 4 MB) para
  procesos grandes (`ejemplos/grande.json`) y para el envío a revisión, que lleva el SVG.

### 5.3 Concurrencia (`rev`)

- El guardado es `update kaze.procesos set documento = $doc, rev = rev + 1, ultimo_guardado =
  $guardadoId, updated_by = <usuario> where id = $id and rev = $revEsperada returning rev`.
- **Reintento de un guardado propio.** Si no cambia ninguna fila y `ultimo_guardado` ya es igual a
  `$guardadoId`, el guardado sí entró (se había perdido la respuesta): se toma como éxito con el `rev`
  actual.
- **Conflicto real.** Si no, la acción devuelve el documento y el `rev` actuales; el editor reemplaza su
  copia y dice «Alguien más actualizó este proceso: ves la versión más reciente.» (copy del prototipo).
  El último guardado **no** gana.

### 5.4 Versión bloqueada

- Una versión cuyo estado derivado (§6.2) es `revision` o `aprobado` no se puede cambiar. En el prototipo
  es `bloqueada(m)`, y el editor deja todo en solo lectura.
- `guardarProceso` rechaza el guardado si el `versiones[v]` que llega difiere del guardado. Compárese
  como `jsonb` en SQL, que no depende del orden de las claves, o con JSON canónico en TS.
- El número de versión no está en el documento, así que esta guardia no lo toca: solo lo cambia
  `crear_version_siguiente` (§5.7).
- La guardia protege la copia de trabajo. La evidencia de lo aprobado (la fotografía y los números)
  vive en tablas que los miembros no pueden escribir (§4.2), así que no depende de ella.

### 5.5 Vínculos

- El cliente y el proyecto A3 son columnas, no parte del documento. Se editan desde Resumen con su propia
  acción, `cambiarVinculos`.
- El selector de A3 solo lista los proyectos del cliente elegido.

### 5.6 Prefijo del código

- Se fija al crear el proceso con `prefijoProceso(nombre)`: «Conciliación bancaria mensual» → `CBM`, y
  una sola palabra → sus 3 primeras letras.
- **Corrección al portar:** si el resultado tiene menos de 2 caracteres (un nombre de una letra),
  usar `PRC`, igual que para un nombre vacío. Así cumple el `check` de la columna.
- Se puede editar en Resumen **hasta el primer envío**, porque después los códigos ya salieron por
  correo. El servidor también rechaza el cambio si ya hay una solicitud.
- No necesita ser único: cada código se valida dentro de su solicitud.
- El código completo es `prefijo + '-' + NN + '-' + verif`, con NN = `num` del contacto en dos
  dígitos. Se muestra en la tabla de contactos.

### 5.7 Crear To-Be y versión siguiente

Son server actions que llaman a `crear_version_siguiente`:

- **«+ Crear To-Be desde el As-Is»** copia el modelo con `crearTobe()` en el documento (claves nuevas,
  `origenClave`, `remapearDiagrama`) y fija `numero_tobe = 1`.
- **«Crear As-Is v2 para editar»** se ofrece desde `aprobado` o desde `revision`, como en el prototipo.
  Si había una solicitud abierta, queda `retirada`.

## 6. Aprobación por enlace + código

### 6.1 Flujo

1. **Preparar** (pestaña Aprobación, con la versión en `borrador` o `cambios`).
   - «Pedir primero el visto bueno de las áreas».
   - Las personas de cada etapa vienen prellenadas desde la RACI: `vobo` va al visto bueno y `aprueba`
     a la aprobación final.
   - Se aplican las mismas reglas del prototipo. **Bloquean el envío:** que no haya actividades, que no
     haya aprobador final, que se pida visto bueno sin nadie que lo dé, que una persona esté en las dos
     etapas o que el diagrama tenga errores. **Solo avisan:** las personas sin correo válido («Puedes
     enviar igual y registrar su respuesta a mano, o agregarlo en el Resumen»).
   - El remitente es el usuario de la sesión (nombre del perfil y correo de su cuenta). Desaparecen los
     campos «tus datos para las respuestas».
2. **Enviar a revisión** (server action con `requireMiembro`):
   - el cliente primero termina el guardado pendiente y manda el `rev` que tiene;
   - el servidor relee el documento **guardado** (no confía en lo que manda el cliente), vuelve a aplicar
     todas las reglas del paso 1, recalcula `revisarDiagrama` y arma la fotografía (§6.4);
   - sanea el SVG que renderizó el cliente con bpmn.io y calcula los códigos y sus hashes;
   - llama a `aprobacion_enviar`, que crea la solicitud (`ronda` siguiente, `enlace_token =
     crypto.randomBytes(24).toString('base64url')`) y las personas, y hace `rev = rev + 1` en la misma
     transacción;
   - la versión queda `revision`, por derivación.
3. **Enviar correo** a cada persona, desde un menú: mi correo, Gmail, Outlook o copiar. El asunto es
   «Visto bueno: …» o «Aprobación: …»; el cuerpo lleva el enlace y el código (§6.8).
4. **Responder**: la persona lo hace en `/aprobar/[token]` (§6.3).
5. **Seguimiento.** El analista ve el avance en la pestaña, que se recarga al volver a ella o con
   «Actualizar». Además puede:
   - **registrar a mano** la respuesta de una persona pendiente: decisión, comentario si pide cambios, y
     fecha;
   - **retirar de revisión**: la solicitud queda `retirada` y la versión vuelve a borrador.
6. **Cierre:**
   - **Alguien pide cambios.**
     - La solicitud y la versión quedan en `cambios`.
     - El comentario se ve en la pestaña y en Resumen, en «Cambios pedidos en la aprobación» (§6.9).
     - «Enviar de nuevo a revisión» crea la ronda siguiente con las mismas personas prellenadas, y los
       enlaces viejos dejan de servir.
   - **Todos aprueban**, en las dos etapas: la solicitud queda `aprobada` y la versión `aprobado`. Se
     ofrece «Avisar a los informados» (un correo al que se adjunta el Word a mano).
   - **Siguiente versión:** se crea la n+1, como en el prototipo (§5.7).

### 6.2 Estado derivado de una versión

Para cada (proceso, versión) se toma el número actual (`numero_asis` o `numero_tobe`) y, de las
solicitudes de ese número, la de ronda más alta:

| Solicitud | Estado de la versión |
|---|---|
| ninguna | `borrador` |
| `revision` | `revision` |
| `cambios` | `cambios` |
| `aprobada` | `aprobado` |
| `retirada` | `borrador` |

De aquí salen la lista `/procesos`, la cabecera, `bloqueada()`, el Word (portada, tabla de aprobaciones
y control de cambios) y el historial de versiones aprobadas. El contenido aprobado de cada versión
queda en `aprobacion_solicitudes.fotografia`.

### 6.3 Página pública `/aprobar/[token]`

- **Fuera de `(app)`:** va sin shell y sin sesión.
  - Excluye `/aprobar` en `lib/supabase/middleware.ts`, que hoy redirige a `/login` todo lo que no sea
    `/login` ni `/auth`, y también en el `matcher` de `proxy.ts`.
  - **No toques `lib/supabase/cookie-options.ts`**: es un archivo compartido byte a byte con el HUB y el
    CMS.
- **Datos:** `app/aprobar/[token]/page.tsx` y `actions.ts` (`server-only`) crean el cliente con
  `createAdminClient()` y llaman a `lib/data/aprobacion-publica.ts`, que recibe el cliente como
  parámetro. Nada más en la app usa la clave de servicio para esto.
- **Contenido**, en el orden de `fotografia.js`:
  - cabecera «Kaze · Solicitud de aprobación»;
  - «Tu respuesta»: arriba en el celular, fijo al costado en escritorio;
  - datos del proceso: código, versión, quién lo envía y cuándo;
  - índice;
  - En pocas palabras y alcance;
  - SIPOC;
  - diagrama, con zoom;
  - el proceso paso a paso por fases;
  - formatos.
- **Qué recibe el navegador:** solo lo que se pinta. El relato y el SIPOC se calculan en el servidor, y
  el SVG va como data URL. No se mandan filas de la solicitud ni de las personas, contactos, correos,
  códigos ni hashes.
- **Solicitudes cerradas** (retirada, cambios o aprobada): la página muestra solo el mensaje de estado,
  sin el contenido.
- **«Tu respuesta»**, en tres pasos:
  1. La persona escribe su código y ve: «Hola, Marta Ríos (Analista contable). Te piden tu visto bueno
     de As-Is v1.»
  2. Elige «Estoy de acuerdo…» o «Pido cambios». Si pide cambios, «¿Qué hay que cambiar?» es
     obligatorio.
  3. Confirma y pulsa «Enviar mi respuesta» (el CTA).
  - La respuesta queda registrada y es definitiva; la página muestra un resumen de lo enviado.
- **Mensajes de estado:**
  - el enlace no es válido o fue retirado;
  - la ronda se cerró porque alguien pidió cambios («te llegará un enlace nuevo»);
  - el proceso ya quedó aprobado;
  - tu etapa aún no está abierta;
  - ya respondiste (muestra tu respuesta y la fecha);
  - demasiados intentos.

### 6.4 La fotografía

`fotografia` es lo que la página necesita, congelado al enviar:

- los campos del Resumen que salen en el documento: nombre, código, objetivo, alcance, exclusiones,
  inicio, resultados, cliente, dueño, áreas, proveedores y referencias;
- la versión: `asis` o `tobe`, número, fases, `sinFase`, actividades y decisiones;
- los formatos: nombre, código y versión, sin los archivos.

El relato y el SIPOC se calculan en el servidor con `narrarProceso`, `sipocDe` y `anexosDe`, que son
lógica pura. El SVG del diagrama llega del cliente, saneado.

### 6.5 Seguridad de la página pública (obligatoria, con tests)

- **Token del enlace:** ≥128 bits aleatorios. Se guarda en la fila, que solo leen los miembros, para
  poder rearmar los correos.
- **`responder` vuelve a verificar token y código.** Nunca acepta un id de persona que venga del cliente,
  ni confía en lo que devolvió `identificar`. Las server actions públicas son endpoints: validan tipos y
  longitudes de todo lo que reciben.
- **Intentos:** `aprobacion_identificar` registra cada intento en la misma transacción que lo evalúa.
  - Por IP (hash con sal del servidor): 10 fallidos en 15 min bloquean esa IP.
  - Por solicitud: 50 fallidos en 15 min bloquean el código para todos, para frenar ataques
    distribuidos.
  - Las ventanas se deslizan, así que no hay contador que resetear.
  - Mensaje: «Demasiados intentos; vuelve a intentarlo en unos minutos.».
- **Carreras:** `aprobacion_registrar` bloquea la solicitud (`for update`) y bajo ese bloqueo valida
  estado, etapa y `pendiente`, registra y recalcula. Dos aprobadores finales que responden a la vez dejan
  la solicitud `aprobada`, no atascada. El registro a mano y el retiro usan el mismo bloqueo.
- **Una respuesta por persona y por ronda.** El enlace de una ronda vieja no sirve.
- **Orden de etapas:** nadie de la etapa final responde mientras falten vistos buenos.
- **Pedir cambios exige comentario**, validado en la acción y con el `check` de la tabla. Máximo 4.000
  caracteres.
- **SVG del cliente (no confiable):**
  - Al guardar se sanea: se quitan `<script>`, `foreignObject`, atributos `on*`, `href` o
    `xlink:href` que no sean `#…`, y referencias externas.
  - Se muestra **solo como `<img src="data:image/svg+xml;base64,…">`**. Nunca una ruta de Kaze que lo
    sirva como `image/svg+xml` (abierto directo, ejecutaría scripts en el dominio de las cookies de
    sesión, que no son `httpOnly` y cubren `.ventosolutions.ca`) ni `dangerouslySetInnerHTML`.
  - Límite de 2 MB.
- **Cabeceras de `/aprobar`:** `noindex, nofollow`, `Referrer-Policy: no-referrer` (el token no se filtra
  a enlaces externos) y `frame-ancestors 'none'` (no se puede enmarcar).
- **Funciones SQL:** solo `service_role` las ejecuta (§4.2), con un test que prueba que un usuario
  autenticado sin perfil (como los del CMS) no puede llamarlas por RPC.

### 6.6 Registro a mano y retiro

Son server actions con `requireMiembro()` que llaman a `aprobacion_registrar` (con `via = 'manual'` y
`registrada_por`) y a `aprobacion_retirar`, con la clave de servicio. En la fila de la persona se ve
«registrado a mano».

### 6.7 Qué desaparece del prototipo

- el paso «Descargar la fotografía»;
- el área «Registrar una respuesta», donde se pegaba el `KZR1.…`;
- `codificarRespuesta`, `leerRespuesta` e `interpretarRespuesta`;
- `hash53` en el navegador;
- los campos «tus datos para las respuestas».

### 6.8 Correos (sin SMTP)

Texto base, adaptado de `correoInvitacion`:

```
Asunto: Visto bueno: Conciliación bancaria mensual (As-Is v1)

Hola Marta:

Te comparto el proceso «Conciliación bancaria mensual» (PR-CON-01 · As-Is v1) para tu visto bueno.

1. Abre este enlace: https://kaze.ventosolutions.ca/aprobar/<token>
2. Escribe tu código: CBM-01-P3GM
3. Revisa el proceso. Si estás de acuerdo, da tu visto bueno; si no, escribe los cambios que pides y
   envía tu respuesta.

Gracias,
<nombre del remitente>
```

- **Origen del enlace:** se toma de una variable de servidor `KAZE_URL` (configuración, no secreta).
  Tomarlo de las cabeceras como hace `/admin` no alcanza: `origin` solo llega en un POST y, si falta,
  queda `https://host`, que falla en localhost. Como respaldo, `x-forwarded-proto` + `host`.
- **Código:** el correo usa el `codigo` guardado en `aprobacion_personas`, no el del documento actual.
  Así sigue siendo correcto aunque después editen o quiten el contacto.
- `enlacesCorreo` (mailto, Gmail y Outlook) y «Copiar el correo» se portan tal cual.
- Para los informados se usa `correoInformados`: van en CCO y el Word se adjunta a mano.

### 6.9 «Cambios pedidos en la aprobación» (nuevo en producción)

- En el prototipo, el comentario de quien pedía cambios se agregaba a `preguntas` del documento.
- En producción no: la página pública no escribe el documento. El Resumen muestra los comentarios de la
  última solicitud en `cambios` en una sección de solo lectura, con quién pidió y cuándo.
- Un botón «Copiar a preguntas» los pasa a `preguntas` como una edición normal del analista.

## 7. Sistema de diseño y estilos

- **Colores que faltan en `app/globals.css`.** La hoja del DS usa estos y hoy no existen:

  ```css
  --color-estado-alerta-texto: #9a6b00;
  --color-estado-alerta-borde: rgba(184, 134, 11, 0.4);
  --color-estado-bien-fondo: rgba(15, 122, 69, 0.1);
  --color-estado-bien-borde: rgba(15, 122, 69, 0.25);
  --color-estado-mal-fondo: rgba(192, 57, 43, 0.1);
  --color-estado-mal-borde: rgba(192, 57, 43, 0.25);
  --color-sugerencia-ia: #2458a6;
  --color-sugerencia-ia-fondo: rgba(36, 88, 166, 0.08);
  --color-sugerencia-ia-borde: rgba(36, 88, 166, 0.45);
  --color-marca-cta: #d93a00;        /* botón acento: texto blanco a 4,61:1 */
  --color-marca-cta-hover: #b83100;  /* 6,04:1 */
  --color-foco: #f94202;             /* = color-marca */
  --color-lateral-activo: rgba(255, 255, 255, 0.1);
  --color-lateral-hover: rgba(255, 255, 255, 0.05);
  --color-lateral-texto: rgba(255, 255, 255, 0.7);
  --color-lateral-tenue: rgba(255, 255, 255, 0.55);
  ```

  `kaze.css` los lee con `var()`, y también lee colores que ya existen pero que ninguna utilidad usa
  (como `--color-blanco` o `--color-estado-alerta`). Tailwind v4 puede omitir del CSS las variables de
  tema sin uso, así que todo el bloque de colores va en `@theme static`. Confírmalo con la versión de
  Tailwind instalada y verifícalo en el CSS compilado.
- **Tokens que no son colores** (espaciado, radios, sombras): al portar `kaze.css`, **renómbralos con
  prefijo** (`--spacing-3` → `--kz-spacing-3`, `--radius-md` → `--kz-radius-md`, `--shadow-lg` →
  `--kz-shadow-lg`, etc.) y defínelos en un `:root` al inicio de la hoja. `--radius-*` y `--shadow-*`
  son nombres propios de Tailwind v4: redefinirlos en `:root` cambiaría esas utilidades en toda la app,
  y `--shadow-sm` del DS tiene otro valor. Los valores están en `sistema-de-diseno/tokens.json`.
- **Fuentes:** `--font-display` y `--font-sans` ya existen (next/font).
- **Estilos del módulo:** `captura.css` (el `app.css` del prototipo) va **anidado bajo `.captura`**, con
  `className="captura"` en la raíz del editor y de `/aprobar`. Tiene nombres genéricos (`.paso`,
  `.relato`, `.vacio`, `.nota`, `.contenido`, `.miga`) que, una vez cargados, quedarían globales en la
  navegación del lado del cliente.
- **`reference/`:** Tailwind v4 escanea el repo para encontrar clases, así que agrega
  `@source not "../reference";` en `app/globals.css` para que no lea el prototipo (590 KB de HTML y JS).
- **bpmn.io:** el componente cliente del diagrama importa `bpmn-js/dist/assets/diagram-js.css`,
  `bpmn-js/dist/assets/bpmn-js.css` y `bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css`. El lienzo
  conserva el logo de bpmn.io, que es requisito de licencia.
- **Cabecera:** se usa `CabeceraPagina` del DS, que se recreó a partir de la cabecera de `/proyectos`
  (título de 22 px, `px-7 pt-5`).

## 8. Seed

- **Local:** sección nueva en `scripts/seed.ts` con el proceso «Conciliación bancaria mensual»
  (`reference/captura/ejemplos/semilla.json`). Va en el cliente «Despacho Andrade & Vega» y vinculado a
  A3-014 («Reducir reprocesos en conciliaciones»), que trata del mismo tema.
  - Tiene 9 actividades (una sin fase, sugerida por la IA), 3 fases, 2 decisiones y 5 contactos:
    - Marta Ríos, visto bueno;
    - Diego López, informado;
    - Rosa Álvarez, aprueba;
    - Carlos Méndez, visto bueno;
    - Laura Gómez, aprueba.
  - Los correos son `@ejemplo.co` y el `verif` de cada contacto va fijo en el seed para que los tests
    conozcan los códigos.
  - Respeta `SEED_ONLY`: el proceso se siembra solo si A3-014 está en la selección.
- **Producción: nunca correr `scripts/seed.ts` contra el proyecto compartido.** No es idempotente: volvería
  a crear los usuarios `@cota.test` borrados a propósito (incluido un admin con la contraseña de demo si
  falta `SEED_PASSWORD`) y duplicaría clientes.
- Si el usuario pide el proceso de ejemplo en producción, se hace con un script aparte
  (`scripts/seed-captura.ts`) que busca el cliente y el A3 existentes y solo inserta el proceso, si no
  existe.

## 9. Navegación y rutas

- **Sidebar:** ítem «Captura de procesos» → `/procesos`, activo, justo después de «Proyectos».
- **Rutas:**
  - `/procesos`: la lista.
  - `/procesos/[id]`: el editor. Admite enlaces directos opcionales como
    `?v=tobe&tab=actividades&sub=caracterizar`.
  - `/aprobar/[token]`: la página pública.
- **Celular:** la barra superior móvil no tiene navegación (spec lista-proyectos §5). En v1 se acepta:
  el módulo funciona a 400 px una vez abierto, y un menú móvil queda como punto abierto.

## 10. Testing

### 10.1 Unitarios (Vitest, `tests/captura/*.test.ts`, sin el stack)

Son el port de las pruebas de node del prototipo (`reference/captura/prototipo/pruebas/*.mjs`):

- **lengua:** verbos, artículos, listas.
- **narrador:** los párrafos de la semilla coinciden con `ejemplos/semilla-relato.txt`; el texto propio
  reemplaza el párrafo principal; «Por confirmar» en lo que falta.
- **bpmn:** la semilla y el proceso grande dan XML válido para `bpmn-moddle`. Ningún conector pasa por
  encima de una forma, ninguna etiqueta pisa una forma y los flujos de secuencia no cruzan pools.
  Comparación estructural con `ejemplos/semilla.bpmn`: conteo por tipo de elemento e ids.
- **validar:** la semilla da 0 errores y el modelo roto de la prueba da 9.
- **secuencia / revisarDecision:** numeración y motivos de revisión.
- **aprobacion:**
  - `prefijoProceso`: «Conciliación bancaria mensual» → `CBM`; una palabra → 3 letras; una letra o
    vacío → `PRC`;
  - formato del código;
  - etapa en curso;
  - la tabla de estados de §6.2.
- **SVG:** el saneador quita scripts, `on*`, `foreignObject` y `href` externos.

Encaja con la config actual (`include: ['tests/**/*.test.ts']`, `environment: 'node'`), siempre que la
lógica pura no toque `window` ni importe `server-only` (ese paquete falla fuera de un server component).

### 10.2 Integración (stack local seedeado, patrón de `tests/data/`)

Los módulos de `lib/data/` reciben el cliente como parámetro, igual que `lib/data/users.ts`; los tests
construyen el suyo.

- **Procesos:**
  - CRUD de procesos;
  - conflicto de `rev` y reintento del propio guardado (`ultimo_guardado`);
  - vínculos;
  - la guardia de versión bloqueada;
  - un miembro **no** puede escribir `numero_asis` ni `numero_tobe` por la Data API.
- **RLS y grants:**
  - un no miembro (`ajeno@cota.test`) no ve nada en las tablas nuevas (ampliar
    `rls-no-miembro.test.ts`);
  - `anon` recibe `permission denied`;
  - un miembro **no** puede insertar, cambiar ni borrar en `aprobacion_*`;
  - un autenticado (miembro o no) no puede ejecutar las funciones por RPC.
- **Funciones de aprobación (como `service_role`):**
  - **enviar:** rechaza con `rev` viejo, con una solicitud abierta y con una persona en las dos etapas;
    sube el `rev`.
  - **identificar:** rechaza un código equivocado y el de otra solicitud; aplica los límites por IP y
    por solicitud, y se libera al pasar la ventana.
  - **registrar:**
    - la etapa final no responde antes de los vistos buenos;
    - pedir cambios sin comentario falla;
    - no hay doble respuesta;
    - dos respuestas finales en paralelo dejan la solicitud `aprobada`;
    - el enlace de una ronda vieja no sirve después de reenviar.
  - **crear_version_siguiente:** desde `revision`, retira la solicitud abierta.
  - El estado derivado coincide con §6.2.

### 10.3 Navegador

El repo no tiene Playwright. `reference/captura/ESCENARIOS.md` trae los escenarios, sacados de las 14
suites de Playwright del prototipo. Hay dos opciones:

- agregar `@playwright/test` para el flujo de aprobación y lo básico del editor;
- recorrerlos a mano con las herramientas de navegador en las tareas de verificación del plan.

En los dos casos, en escritorio y a 400 px.

## 11. Orden de trabajo (para el plan)

- **F0. Preparación.**
  - Lee `node_modules/next/dist/docs` (lo pide `AGENTS.md`).
  - Agrega las dependencias exactas `bpmn-js@17.11.1` y `docx@9.6.1`, y `bpmn-moddle` en dev.
  - En `globals.css`: los tokens nuevos (`@theme static`) y `@source not "../reference";`.
  - Configura `KAZE_URL` y el límite de cuerpo de las server actions.
  - Pregúntale al usuario si primero se cierran las T11–T14 del plan de SSO.
- **F1.** Lógica pura en `lib/captura/` (con `anexos.ts` y el saneador de SVG) y sus tests unitarios, en
  verde y sin stack.
- **F2.** Migración, grants por columna, RLS y funciones SQL, con tipos (`npm run db:types`),
  `requireMiembro()` y `lib/data/procesos.ts` + `lib/data/aprobaciones.ts`, cada uno con sus tests de
  integración.
- **F3.** Lista `/procesos`, «Nuevo proceso» e ítem en la sidebar.
- **F4.** Editor:
  - cabecera;
  - Resumen, con contactos, RACI y vínculos;
  - Fases;
  - Actividades: listar, caracterizar, tabla y relato;
  - versiones As-Is y To-Be (§5.7);
  - guardado con `rev` y un solo guardado en vuelo;
  - Deshacer e Historial.
- **F5.** Diagrama: bpmn.io, sincronización, revisión y exportar .bpmn y SVG.
- **F6.** Documento Word y .zip, y formatos con Storage (subida con URL firmada).
- **F7.** Aprobación:
  - preparar y enviar;
  - correos;
  - `/aprobar/[token]` con las cabeceras de §6.5;
  - registro a mano y retiro;
  - estado derivado;
  - «Cambios pedidos»;
  - tests de seguridad.
- **F8. Cierre.**
  - Seed local.
  - Docs: START-HERE, la tabla «Documentos clave» de AGENTS y marcar el spec del diagramador como
    reemplazado.
  - Despliegue: `npx supabase db push` al proyecto compartido y push a `main`.
  - Verificación en producción con el admin real.

## 12. Riesgos

- **Next 16 no es el de los datos de entrenamiento** (`AGENTS.md`). Lee las guías locales antes de
  escribir server actions, `proxy.ts`, cabeceras o caché.
- **bpmn-js necesita DOM:** se carga en un componente cliente sin SSR, con su CSS. Los módulos propios
  del prototipo (paleta, menú, render de íconos) dependen de internos de bpmn-js 17, así que la versión
  va fija.
- **Peso de `docx`:** se importa de forma dinámica y solo al exportar. Hay una prueba del prototipo que
  lo verifica («docx no se carga al abrir el proceso»).
- **Proyecto de Supabase compartido:**
  - las tablas nuevas van solo en `kaze`;
  - el bucket y las policies de Storage llevan el prefijo `kaze_captura`;
  - «Automatically expose new tables» está activo en el proyecto: verifica que `anon` no reciba nada
    (no tiene `USAGE` sobre `kaze`);
  - los `alter default privileges` dan `EXECUTE` de las funciones nuevas a `authenticated`: revócalo
    (§4.2).
- **Techo de 1000 filas:** la lista usa `selectAllRows` con `count: 'exact'`, y para no traer los
  documentos enteros lee solo columnas (`nombre`, `codigo`, `numero_*`, vínculos).
- **Zona horaria:** las fechas de solicitudes, respuestas y documentos van en `America/Bogota`. El
  prototipo usaba la hora local.
- **La ruta pública es superficie nueva:** §6.5 es obligatorio y lleva tests.
- **Atajos de teclado:** Ctrl+Z dentro del lienzo es el de bpmn.io. El prototipo excluye `.lienzo` del
  atajo global; mantenerlo.
- **Nombres con tildes al descargar:** el Chromium sin interfaz de las pruebas cambia por «download» el
  nombre de un archivo con tildes (`<a download>`). Verificarlo en Chrome, Edge y Firefox de escritorio.

## 13. Criterios de aceptación (DoD)

- [ ] Migraciones aplicadas en local y en producción, con tipos regenerados. Los grants por tabla y
      columna, las funciones solo para `service_role` y la RLS de las tablas nuevas están probados:
      miembro según §4.2, no miembro nada, `anon` nada.
- [ ] `lib/captura/*` portado, con tests unitarios en verde y salidas iguales a las de `ejemplos/`.
- [ ] `/procesos` lista, crea (cliente + A3 opcional) y abre procesos. El ítem «Captura de procesos»
      está activo.
- [ ] El editor completo (Resumen, Fases, Actividades, Diagrama y Aprobación) cumple `ESCENARIOS.md` en
      escritorio y a 400 px.
- [ ] Guardado automático con `rev`, un guardado en vuelo, conflicto y reintento probados. El servidor
      protege la versión bloqueada y el número de versión.
- [ ] Word, .zip, .bpmn y SVG exportan igual que en el prototipo y se bloquean con errores.
- [ ] Aprobación de punta a punta con enlace + código: dos etapas, cambios que devuelven el flujo,
      registro a mano y retiro. Los tests de seguridad de §6.5 y §10.2 están en verde.
- [ ] `npm test` completo en verde, `tsc` limpio y `npm run build` en verde.
- [ ] Desplegado (db push + push a `main`) y verificado en `kaze.ventosolutions.ca` con el admin real.
      START-HERE y AGENTS al día.
