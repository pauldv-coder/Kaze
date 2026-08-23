# Kaze · Diagramador de procesos BPMN (estilo Bizagi) — Design Doc

Fecha: 2026-07-26 · Estado: **aprobado por el usuario** (brainstorming en sesión)
Prerequisito: sub-proyecto 2 tajada 1 (app shell + Lista de Proyectos) — el diagramador
se construye DESPUÉS, cuando exista la sidebar donde colgarlo.

## 1. Contexto y decisiones cerradas

El usuario pidió "habilitar el diagramador de procesos lo más parecido a Bizagi".
Decisiones de la sesión:

1. **BPMN y VSM son herramientas distintas** en la práctica de Cota: el VSM se usa sobre
   un problema que ya tiene A3 y queda como módulo FUTURO separado (el placeholder
   "Mapas de valor · VSM" de la sidebar sigue deshabilitado). Esto es el **diagramador
   BPMN** como herramienta propia.
2. **Motor: bpmn-js** (bpmn.io/Camunda) — el modelador BPMN 2.0 open-source de facto.
   Es lo más parecido a Bizagi embebible: paleta, drag & drop, XML BPMN 2.0 estándar
   **importable/exportable con Bizagi en ambos sentidos**. Se acepta: el logo pequeño de
   bpmn.io en el lienzo (requisito de licencia, sin costo) y un look parcialmente
   ajustado a los tokens de Kaze.
3. **Los diagramas viven por proyecto A3** (N diagramas con nombre libre por proyecto,
   p. ej. "Proceso actual" / "Proceso propuesto").
4. **Orden**: primero se ejecuta la tajada 1 (plan `2026-07-25-kaze-lista-proyectos.md`);
   este spec se planifica e implementa después.

## 2. Alcance v1

- Listar los diagramas agrupados por proyecto A3; crear (elegir proyecto + nombre),
  renombrar y eliminar (con confirmación).
- Editor BPMN a pantalla completa con bpmn-js **Modeler** (paleta completa: eventos,
  tareas, compuertas, secuencias, pools/lanes).
- **Guardar explícito** (server action / cliente authenticated) con aviso de cambios sin
  guardar al salir (`beforeunload` + guardia de navegación simple).
- **Exportar** `.bpmn` (XML) y `.svg`. **Importar** archivo `.bpmn` (crea diagrama nuevo
  en el proyecto elegido). Compatibilidad Bizagi: Bizagi exporta/importa BPMN 2.0 XML.
- Diagrama nuevo nace con el XML mínimo válido (proceso vacío + StartEvent), listo para editar.

## 3. Datos — migración `0005_diagrams.sql`

Aplica TODAS las lecciones de 0002/0003/0004 desde el día uno:

```sql
create table public.diagrams (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  nombre text not null,
  xml text not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index diagrams_project_id_idx on public.diagrams (project_id);

alter table public.diagrams enable row level security;
create policy "team_all_select" on public.diagrams for select to authenticated using (true);
create policy "team_all_insert" on public.diagrams for insert to authenticated with check (true);
create policy "team_all_update" on public.diagrams for update to authenticated using (true) with check (true);
create policy "team_all_delete" on public.diagrams for delete to authenticated using (true);

-- Los GRANTs de 0002 usan default privileges del rol postgres → cubren esta tabla nueva
-- automáticamente (verificar en el plan con la prueba de rol). Trigger de updated_at:
create trigger diagrams_set_updated_at
  before update on public.diagrams
  for each row execute function public.set_updated_at();

-- anon no hereda nada (0003 revocó también por default privileges) — verificar.
```

Regenerar tipos (`npm run db:types`). Producción vía `npx supabase db push` en la tarea
de deploy del plan (no olvidarlo: lección del módulo admin).

## 4. Navegación y rutas

- Sidebar: ítem nuevo **"Diagramas de proceso"** ACTIVO (los placeholders deshabilitados
  siguen igual; VSM sigue deshabilitado por ser herramienta futura distinta).
- **`/diagramas`** (server component): lista agrupada por proyecto A3 (código + título +
  diagramas con nombre y updated relativo) + botón "Nuevo diagrama" (modal/form simple:
  select de proyecto + nombre) + "Importar .bpmn". Acciones por fila: abrir, renombrar,
  eliminar (confirm).
- **`/diagramas/[id]`** (editor): header compacto (nombre editable, proyecto, botones
  Guardar / Exportar .bpmn / Exportar SVG / Volver) + lienzo bpmn-js a pantalla completa.
- Ambas rutas bajo `(app)` → heredan shell y protección del proxy.

## 5. Integración bpmn-js

- Dependencia: `bpmn-js` (+ sus CSS). Componente `'use client'` con `next/dynamic`
  (`ssr: false`); bpmn-js manipula el DOM directamente.
- Carga: la página server trae `{ id, nombre, xml, project }`; el cliente instancia
  `Modeler`, `importXML(xml)`; Guardar → `saveXML({ format: true })` → server action
  `saveDiagram(id, xml)` (cliente authenticated; RLS válida el acceso).
- Export `.bpmn`: `saveXML` → blob download. Export SVG: `saveSVG`. Import: file input →
  texto → crear diagrama con ese XML (validación: `importXML` en un Modeler oculto o
  try/catch al abrir; si el XML es inválido, error claro y no se crea).
- Tema: CSS mínimo para acercar colores al look Kaze (acento marca en selección) sin
  pelear con el diagrama estándar BPMN. El logo de bpmn.io se conserva.
- i18n: si el módulo `customTranslate` con diccionario es-ES resulta simple, incluirlo;
  si estorba, la paleta queda en inglés en v1 (no bloqueante, decisión del plan).

## 6. Capa de datos

`lib/data/diagrams.ts`:
- `getDiagramsByProject(db)` → agrupado para `/diagramas` (join projects code/titulo).
- `getDiagram(db, id)`, `createDiagram(db, { projectId, nombre, xml })`,
  `renameDiagram(db, id, nombre)`, `saveDiagramXml(db, id, xml)`, `deleteDiagram(db, id)`.
- Todas con el patrón existente (cliente como parámetro, throw on error). Server actions
  delgadas en `app/(app)/diagramas/actions.ts` usando el cliente de sesión (NO service_role).

## 7. Seed

Un diagrama de ejemplo para A3-014: "Conciliación bancaria — proceso actual", XML BPMN
escrito a mano (~6 nodos: inicio → descargar extracto → cuadre automático → compuerta
¿cuadra? → sí: archivar / no: investigar diferencia → fin), con diagrama DI válido para
que se vea bien al abrir. Se añade a `scripts/seed.ts` (sección nueva 7, respetando
`SEED_ONLY` por código A3).

## 8. Testing

- Integración (Vitest): CRUD completo de `lib/data/diagrams.ts` contra el stack local
  (crear/leer/renombrar/guardar XML/eliminar + cascade al borrar proyecto) como
  service_role Y lectura/escritura como `authenticated` (verifica RLS + grants heredados
  de default privileges en la tabla NUEVA — la prueba real de la lección 0002).
- e2e navegador: `/diagramas` lista el seed → abrir editor (lienzo bpmn-js renderiza el
  proceso) → editar (mover/agregar nodo vía API del modeler si el drag del pane no
  compone) → Guardar → recargar → persiste → Exportar `.bpmn` descarga.
- Unit: helper de XML mínimo inicial (que `importXML` lo acepte).

## 9. Fuera de alcance (v1)

- VSM (herramienta distinta, spec futuro propio).
- Colaboración simultánea / bloqueo de edición (last-write-wins en v1, aviso de cambios
  sin guardar como única guarda).
- Historial de versiones, comentarios, validación semántica/simulación BPMN (terreno
  Bizagi enterprise), export PDF/PNG, plantillas de proceso, vista cliente.

## 10. Criterios de aceptación (DoD)

- [ ] Migración 0005 aplicada local y en producción; tipos regenerados; prueba de grants
      en tabla nueva (authenticated CRUD ok, anon denegado) en verde.
- [ ] `/diagramas` lista/crea/renombra/elimina; `/diagramas/[id]` edita y guarda con bpmn-js.
- [ ] Export `.bpmn`/SVG e import `.bpmn` funcionando (round-trip con Bizagi como criterio
      de diseño: XML BPMN 2.0 estándar).
- [ ] Seed con el diagrama de A3-014; ítem "Diagramas de proceso" activo en la sidebar.
- [ ] `npm test` completo verde; `tsc` limpio; `build` verde; e2e navegador OK.
- [ ] Desplegado a producción (push + db push) y verificado con el admin real.
