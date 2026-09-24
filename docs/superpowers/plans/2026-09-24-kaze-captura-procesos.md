# Kaze · Captura de procesos (BPMN) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Subagentes SIEMPRE en primer plano** (nunca `run_in_background`).

**Goal:** Llevar a producción, dentro de Kaze, el módulo de Captura de procesos del prototipo
(`reference/captura/prototipo/`): ficha + procedimiento Word + diagrama BPMN, versiones As-Is/To-Be y
aprobación en dos etapas por enlace + código.

**Architecture:** La lógica pura del prototipo se porta casi línea por línea a TypeScript en
`lib/captura/` (tests contra `reference/captura/ejemplos/`). El proceso se guarda como un `jsonb` en
`kaze.procesos` con concurrencia por `rev`; la evidencia de aprobación vive en tablas que solo escriben
funciones SQL ejecutadas con la clave de servicio. La interfaz se porta a componentes cliente bajo
`app/(app)/procesos/`, y quien aprueba responde en la página pública `/aprobar/[token]`.

**Tech Stack:** Next.js 16.2 (App Router, server actions, `proxy.ts`), React 19, TypeScript, Tailwind
v4.3, Supabase (Postgres 17, esquema `kaze`, Storage), Vitest 4, Playwright, `bpmn-js@17.11.1`,
`docx@9.6.1`, `bpmn-moddle@8` (dev).

**Spec:** `docs/superpowers/specs/2026-09-24-kaze-captura-procesos-design.md` (citado como «§n»).
**Referencia de comportamiento:** `reference/captura/` (prototipo, ejemplos, `ESCENARIOS.md`, SQL probado).

---

## 0. Decisiones confirmadas con el usuario (2026-09-24)

| Tema | Decisión |
|---|---|
| Orden | Este módulo **antes** que las T11–T14 del plan de SSO. `73cd257` (cookie de apex) sigue en `main` sin push: **no hacer push sin coordinar** (cortaría sesiones de las 3 apps). |
| §1.3 | Confirmado tal cual: sin SMTP, sin IA, documento `jsonb`, Word/.zip/SVG en el navegador. |
| Leer en `/aprobar` | **El código hace falta también para LEER.** Tras un código válido, el servidor pone una cookie `httpOnly` firmada (HMAC) por solicitud y persona, con `path=/aprobar/<token>`. Sin esa cookie, la página solo muestra el formulario del código (o el mensaje de estado si la solicitud está cerrada). |
| Navegador | Se agrega `@playwright/test`; los escenarios de `ESCENARIOS.md` se automatizan en `e2e/`, en escritorio (1280) y a 400 px. |
| §1.2 | Decisiones del usuario: **no re-litigar**. |

**Consecuencia de «código para leer» sobre §6.5.** `responder` ya no recibe el código otra vez: toma la
identidad **solo** de la cookie firmada por el servidor (nunca un id que mande el cliente en el cuerpo),
verifica la firma, que la cookie pertenece a la solicitud de ese token y que la persona pertenece a esa
solicitud; y `aprobacion_registrar` revalida estado, etapa y `pendiente` bajo bloqueo.

## 1. Reglas que aplican a TODAS las tareas

- **Portar, no rediseñar.** Si una tarea dice «porta `X` líneas a–b», el código fuente ES el prototipo:
  se traduce a TS con tipos, sin cambiar textos, orden ni comportamiento. Los únicos cambios permitidos
  son los que la tarea lista. El copy en español ya está revisado con el usuario.
- **Sin `any` ni `// @ts-nocheck`.** Tipos de `lib/captura/tipos.ts`; para estructuras geométricas
  internas, interfaces locales o `Record<string, unknown>`.
- **La lógica pura no toca `window`/`document` ni importa `server-only`** (Vitest corre en `node`).
- Esquema `kaze`, nunca `public`. Migraciones con timestamp **al nivel superior** de
  `supabase/migrations/`. Sin triggers sobre `auth.users`.
- Toda query sin `.limit()` pasa por `selectAllRows(..., { count: 'exact' })`. Todo `.order()` lleva
  desempate por `id`.
- Fechas visibles en `America/Bogota` (`TZ` de `lib/data/metrics.ts`).
- Tailwind v4: tokens en `app/globals.css`; **no** crear `tailwind.config.ts`.
- `proxy.ts`, no `middleware.ts`. Antes de escribir código de Next, leer la guía local citada en la tarea
  (`node_modules/next/dist/docs/...`). En Next 16, `params` y `searchParams` son **Promises**.
- **No tocar `lib/supabase/cookie-options.ts`.** No correr `scripts/seed.ts` contra producción.
- Archivos UTF-8 sin BOM (herramienta Write). En bash, rutas `/c/Users/...`.
- `.gitattributes` no existe y `core.autocrlf` convierte a CRLF: **todo test que compare contra
  `reference/captura/ejemplos/` normaliza `\r\n` → `\n`** antes de comparar.
- Stack local antes de cualquier test de integración: Docker Desktop encendido y `npx supabase status`
  (si no corre, `npx supabase start`; puertos 553xx; no tocar `*_loro`).
- Commits frecuentes estilo conventional, terminados con
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. **Push y `db push` solo con el usuario**
  (Tarea 8.4).
- Al cerrar cada fase, actualizar `docs/superpowers/START-HERE.md` (tabla de estado de este plan).

## 2. Mapa de archivos

```
lib/captura/                     LÓGICA PURA (tests en tests/captura/, sin stack)
  tipos.ts                       ProcesoDoc, Version, Actividad, Decision, Evento, Formato, Contacto…
  secuencia.ts                   numerarActividades, codigoActividad, secuenciaActividades, revisarDecision, DESTINO_FIN
  iconos.ts                      ICONOS_BPMN
  lengua.ts                      gramática
  modelo.ts                      model.js (sin estado/aprobación/historial en la versión guardada)
  importar.ts                    documentoDesdePrototipo (fixtures y seed)
  json.ts                        mismoJson (comparación canónica)
  anexos.ts                      anexosDe
  narrador.ts                    relato, SIPOC, límites
  bpmn/rutas.ts, bpmn/generar.ts, bpmn/validar.ts, bpmn/sincronizar.ts (esta última solo cliente)
  aprobacion.ts                  prefijo, códigos, estado derivado, etapas, reglas de envío, correos
  fotografia.ts                  armarFotografia (jsonb §6.4) + contenidoPublico
  svg.ts                         sanearSvg
  zip.ts                         zip, nombreArchivo
  guardado.ts                    ColaGuardado (un guardado en vuelo, reintentos)
  documento.ts                   Word (solo cliente; import('docx'))
lib/aprobar/                     crypto de servidor, SIN 'server-only' para poder testearlo
  hash.ts                        hashCodigo, hashIp, nuevoToken
  firma.ts                       firmarAcceso / leerAcceso (cookie HMAC)
lib/data/procesos.ts             lista, carga, crear, guardar (rev), vínculos, prefijo, borrar
lib/data/aprobaciones.ts         lado del miembro: llama a las funciones SQL (cliente admin como parámetro)
lib/data/aprobacion-publica.ts   lo que usa /aprobar (cliente admin como parámetro)
lib/data/procesos-archivos.ts    URLs firmadas de Storage
lib/auth/guards.ts               + requireMiembro()
components/kaze/                 DS en TSX + kaze.css
app/(app)/procesos/page.tsx, nuevo-proceso.tsx, actions.ts, captura.css
app/(app)/procesos/[id]/page.tsx, editor.tsx, _components/*
app/aprobar/[token]/page.tsx, actions.ts, _components/*
supabase/migrations/20260924000001_kaze_captura.sql
supabase/migrations/20260924000002_kaze_captura_funciones.sql
supabase/migrations/20260924000003_kaze_captura_storage.sql
tests/captura/*.test.ts          unitarios
tests/data/_captura.ts           helpers de integración (no es *.test.ts)
tests/data/{rls-captura,procesos,aprobaciones,aprobacion-publica,procesos-archivos}.test.ts
e2e/*.spec.ts, playwright.config.ts
```

## 3. Estado de las fases

| Fase | Tareas | Estado |
|---|---|---|
| F0 Preparación | 0.1–0.3 | ⬜ |
| F1 Lógica pura | 1.1–1.11 | ⬜ |
| F2 Datos y seguridad | 2.1–2.7 | ⬜ |
| F3 Lista | 3.1–3.2 | ⬜ |
| F4 Editor | 4.1–4.13 | ⬜ |
| F5 Diagrama | 5.1–5.3 | ⬜ |
| F6 Documento y Storage | 6.1–6.3 | ⬜ |
| F7 Aprobación | 7.1–7.8 | ⬜ |
| F8 Cierre y despliegue | 8.1–8.4 | ⬜ |

---

# F0 · Preparación

### Task 0.1: Dependencias, config de Next y variables locales

**Files:**
- Modify: `package.json`, `package-lock.json`, `next.config.ts`, `app/globals.css`, `.env.local`, `.gitignore`

- [ ] **Step 1: Leer las guías locales de Next 16**

Leer completas:
`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md`,
`.../01-next-config-js/headers.md`, `.../01-next-config-js/proxyClientMaxBodySize.md`,
`node_modules/next/dist/docs/01-app/02-guides/server-actions.md`,
`node_modules/next/dist/docs/01-app/02-guides/data-security.md`,
`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`,
`node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`.

- [ ] **Step 2: Instalar dependencias con versión exacta**

```bash
cd /c/Users/pauld/dev/cota && npm install --save-exact bpmn-js@17.11.1 docx@9.6.1 && npm install --save-dev --save-exact bpmn-moddle@8.1.0 @playwright/test && npx playwright install chromium
```
Expected: `package.json` con `"bpmn-js": "17.11.1"`, `"docx": "9.6.1"` en dependencies; `bpmn-moddle` y
`@playwright/test` en devDependencies.

- [ ] **Step 3: Límite de cuerpo de las server actions**

`next.config.ts` completo:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Un proceso grande (reference/captura/ejemplos/grande.json) y el envío a revisión, que lleva el
    // SVG del diagrama (≤ 2 MB), pasan del 1 MB por defecto. Vercel corta en 4,5 MB.
    serverActions: { bodySizeLimit: '4mb' },
  },
};

export default nextConfig;
```

- [ ] **Step 4: Tokens y exclusión de `reference/` en `app/globals.css`**

Justo debajo de `@import "tailwindcss";` agregar `@source not "../reference";`. Después del bloque
`@theme { … }` existente agregar:
```css
/* Colores del sistema de diseño de Captura (§7). `static`: kaze.css los lee con var() y ninguna
   utilidad los usa, así que sin `static` Tailwind podría omitirlos del CSS compilado. */
@theme static {
  --color-estado-alerta-texto: #9a6b00;
  --color-estado-alerta-borde: rgba(184, 134, 11, 0.4);
  --color-estado-bien-fondo: rgba(15, 122, 69, 0.1);
  --color-estado-bien-borde: rgba(15, 122, 69, 0.25);
  --color-estado-mal-fondo: rgba(192, 57, 43, 0.1);
  --color-estado-mal-borde: rgba(192, 57, 43, 0.25);
  --color-sugerencia-ia: #2458a6;
  --color-sugerencia-ia-fondo: rgba(36, 88, 166, 0.08);
  --color-sugerencia-ia-borde: rgba(36, 88, 166, 0.45);
  --color-marca-cta: #d93a00;
  --color-marca-cta-hover: #b83100;
  --color-foco: #f94202;
  --color-lateral-activo: rgba(255, 255, 255, 0.1);
  --color-lateral-hover: rgba(255, 255, 255, 0.05);
  --color-lateral-texto: rgba(255, 255, 255, 0.7);
  --color-lateral-tenue: rgba(255, 255, 255, 0.55);
}
```
Y cambiar el `@theme {` existente por `@theme static {` (los colores base `--color-blanco`,
`--color-estado-alerta`… también los lee `kaze.css`).

- [ ] **Step 5: Verificar en el CSS compilado**

```bash
cd /c/Users/pauld/dev/cota && npm run build && grep -oh -- "--color-lateral-tenue[^;]*" .next/static/chunks/*.css | head -1 && grep -oh -- "--color-blanco[^;]*" .next/static/chunks/*.css | head -1
```
Expected: las dos líneas aparecen. Si falta alguna, `@theme static` no se aplicó: revisar sintaxis.

- [ ] **Step 6: Variables locales**

Agregar a `.env.local` (no se versiona):
```
KAZE_URL=http://localhost:3000
KAZE_APROBAR_SECRETO=<salida de: node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))">
```
Agregar a `.gitignore`:
```
# playwright
/playwright-report
/test-results
/e2e/.auth
```

- [ ] **Step 7: Lint**

Run: `npm run lint`. Si falla **solo** por archivos de `reference/`, avisar al usuario: debe agregar
`"reference/**"` a `globalIgnores` de `eslint.config.mjs` (un hook impide que el agente lo edite). Si
falla por otra cosa, arreglarlo.

- [ ] **Step 8: Commit**
```bash
git add package.json package-lock.json next.config.ts app/globals.css .gitignore
git commit -m "chore(captura): dependencias, límite de server actions y tokens del DS"
```

### Task 0.2: Playwright

**Files:**
- Create: `playwright.config.ts`, `e2e/auth.setup.ts`, `e2e/smoke.spec.ts`
- Modify: `package.json` (script `e2e`)

- [ ] **Step 1: Config**

`playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'
config({ path: '.env.local' })

const PUERTO = 3100
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: { baseURL: `http://localhost:${PUERTO}`, trace: 'retain-on-failure' },
  webServer: {
    command: `npx next dev --port ${PUERTO}`,
    url: `http://localhost:${PUERTO}/login`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: { KAZE_URL: `http://localhost:${PUERTO}` },
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'escritorio', dependencies: ['setup'], testIgnore: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 }, storageState: 'e2e/.auth/carmen.json' } },
    { name: 'movil', dependencies: ['setup'], testIgnore: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 400, height: 860 }, storageState: 'e2e/.auth/carmen.json' } },
  ],
})
```

`e2e/auth.setup.ts`:
```ts
import { test as setup, expect } from '@playwright/test'

setup('login de carmen', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('Correo').fill('carmen@cota.test')
  await page.getByPlaceholder('Contraseña').fill('cota-demo-2026')
  await page.locator('button[type=submit]').click()
  await expect(page).toHaveURL(/\/proyectos/)
  await page.context().storageState({ path: 'e2e/.auth/carmen.json' })
})
```

`e2e/smoke.spec.ts`:
```ts
import { test, expect } from '@playwright/test'

test('la app abre /proyectos con sesión', async ({ page }) => {
  await page.goto('/proyectos')
  await expect(page.getByRole('heading', { name: 'Proyectos' })).toBeVisible()
})
```

Script en `package.json`: `"e2e": "playwright test"`.

- [ ] **Step 2: Correr**

Run: `npx supabase status` (debe estar arriba y seedeado) y `npm run e2e -- smoke`.
Expected: `2 passed` (escritorio y móvil) + setup.

- [ ] **Step 3: Comprobar que Vitest no toma `e2e/`**

Run: `npm test`. Expected: la misma suite de antes (51 tests), sin archivos de `e2e/`.

- [ ] **Step 4: Commit**
```bash
git add playwright.config.ts e2e package.json package-lock.json
git commit -m "test(e2e): Playwright con login de demo, escritorio y 400 px"
```

### Task 0.3: START-HERE apunta a este plan

- [ ] **Step 1:** En `docs/superpowers/START-HERE.md`: fecha 2026-09-24; nueva sección «Plan en ejecución:
Captura de procesos» con la tabla de fases de §3 de este plan; la migración/SSO pasa a «en pausa en la
T11 (73cd257 sin push)»; «Siguiente después de la migración» ya no menciona el diagramador
(`2026-07-26` queda reemplazado por el spec de captura).
- [ ] **Step 2:** `git commit -am "docs: START-HERE apunta al plan de captura de procesos"`

---

# F1 · Lógica pura (`lib/captura/`, sin stack)

Convención de los tests unitarios: `tests/captura/<modulo>.test.ts`, con `import { describe, it, expect } from 'vitest'`.
Fixtures:
```ts
// tests/captura/_fixtures.ts  (no termina en .test.ts: Vitest no lo corre)
import { readFileSync } from 'node:fs'
import path from 'node:path'
const EJ = path.resolve(__dirname, '../../reference/captura/ejemplos')
export const leerEjemplo = (n: string) => readFileSync(path.join(EJ, n), 'utf8').replace(/\r\n/g, '\n')
export const semillaPrototipo = () => JSON.parse(leerEjemplo('semilla.json'))
export const grandePrototipo = () => JSON.parse(leerEjemplo('grande.json'))
```
Los ejemplos están **en formato del prototipo** (con `numero`, `estado`, `aprobacion`, `historial` dentro
de cada versión, y `id`, `creado`…). Las funciones portadas de generación (`generarBPMN`, `narrarProceso`,
`revisarDiagrama`) reciben el objeto tal cual; no dependen de esos campos salvo `numero`, que el tipo
`VersionVista` sí tiene.

### Task 1.1: Tipos, secuencia e íconos

**Files:**
- Create: `lib/captura/tipos.ts`, `lib/captura/secuencia.ts`, `lib/captura/iconos.ts`, `tests/captura/_fixtures.ts`
- Test: `tests/captura/secuencia.test.ts`

- [ ] **Step 1: Tipos** — `lib/captura/tipos.ts`:
```ts
export type Texto = string | null                         // 'desconocido' = «?», 'na' = N/A
export type Numero = number | 'desconocido' | 'na' | null
export type VersionId = 'asis' | 'tobe'
export type EstadoVersion = 'borrador' | 'revision' | 'cambios' | 'aprobado'
export type Papel = '' | 'elabora' | 'vobo' | 'aprueba' | 'informado'

export interface Contacto { id: string; num: number; nombre: string; rol: string; departamento: string
  correo: string; papel: Papel; verif: string }
export interface Referencia { id: string; codigo: string | null; nombre: string
  tipo: 'interna' | 'externa' | 'ley' | 'otra'; enlace: string | null }
export interface ArchivoFormato { id: string; path: string; nombre: string; tipo: string; tamano: number }
export interface Formato { id: string; nombre: string; codigo: string | null; version: string | null
  archivo: ArchivoFormato | null; enlace: string | null }
export type TipoEvento = 'tiempo' | 'fecha' | 'mensaje' | 'condicion' | 'aviso' | 'hito' | 'limite' | 'error'
export interface Evento { id: string; tipo: TipoEvento; momento: 'antes' | 'durante' | 'despues'
  texto: string | null; n: number | null; unidad: string; quien: string | null; externo: boolean
  destino: string | null; interrumpe: boolean }
export interface Ciclo { tipo: '' | 'repite' | 'porCada'; condicion: string | null; paralelo?: boolean }
export interface Actividad {
  clave: string; nombre: string; descripcion: Texto; responsable: Texto; departamento: Texto; apoyo: Texto
  ejecucion: 'persona' | 'sistema' | 'automatizacion'; entradas: Texto; entregable: Texto; receptor: Texto
  receptorExterno: boolean; criterio: Texto; tProceso: Numero; tEspera: Numero; unidad: string
  frecuencia: Texto; herramientas: Texto; documentos: Texto; reglas: Texto; problemas: Texto
  formatos: Formato[]; eventos: Evento[]; ciclo: Ciclo | null; relato: string | null
  fuente: string | null; evidencia: string | null; estado: 'confirmado' | 'por_confirmar' | 'sugerido' | string
  origenClave: string | null
}
export interface Salida { condicion: string; destino: string | null; porDefecto: boolean; clase: string | null }
export interface Decision { clave: string; pregunta: string; origen: string | null; decide: string | null
  tipo: 'exclusiva' | 'inclusiva' | 'paralela' | string; salidas: Salida[]; estado: string
  contexto: { faseOrigen: string | null }; aceptados: string[] }
export interface Fase { id: string; nombre: string; objetivo: Texto; entrada: Texto; entregables: string[]
  salida: Texto; actividades: string[] }
export interface Diagrama { v?: number; formas?: Record<string, unknown>; rutas?: Record<string, unknown>
  etiquetas?: Record<string, unknown>; notas?: unknown[] }
/** Versión tal como se GUARDA (§4.3): sin numero, estado, aprobacion ni historial. */
export interface Version { fases: Fase[]; sinFase: string[]; actividades: Record<string, Actividad>
  decisiones: Decision[]; diagrama: Diagrama }
/** Versión como la usa la interfaz y la lógica portada: el servidor inyecta numero y estado. */
export interface VersionVista extends Version { numero: number; estado: EstadoVersion }
export interface Sesion { id: string; fecha: string; participantes: string[]; notas: string }
export interface Pregunta { id: string; texto: string; origen: string; resuelta: boolean; fecha: string }
interface ProcesoBase {
  nombre: string; objetivo: string; alcance: string; exclusiones: string; disparador: string
  inicio: { tipo: 'ninguno' | 'mensaje' | 'tiempo' | 'condicion'; detalle: string | null }
  codigoDoc: string | null; referencias: Referencia[]; resultados: string[]; cliente: string
  clienteExterno: boolean; dueno: string; departamentos: string[]; proveedores: string[]
  participantes: Contacto[]; numSiguiente: number; sesiones: Sesion[]; preguntas: Pregunta[]
}
export interface ProcesoDoc extends ProcesoBase { versiones: { asis: Version; tobe: Version | null } }
export interface ProcesoVista extends ProcesoBase { versiones: { asis: VersionVista; tobe: VersionVista | null } }
```
Si al portar `model.js` aparece un campo que falta aquí, se agrega a estos tipos (no se tipa aparte).

- [ ] **Step 2: Test que falla** — `tests/captura/secuencia.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { numerarActividades, codigoActividad, secuenciaActividades, revisarDecision, DESTINO_FIN } from '@/lib/captura/secuencia'

const fases = [
  { id: 'f1', actividades: [{ clave: 'a' }, { clave: 'b' }] },
  { id: 'f2', actividades: [{ clave: 'c' }] },
  { id: '__sin', sinFase: true, actividades: [{ clave: 'z' }] },
]
describe('secuencia', () => {
  it('numera en orden de fases y deja sin número lo que está sin fase', () => {
    const m = numerarActividades(fases)
    expect([m.a, m.b, m.c]).toEqual([1, 2, 3])
    expect(m.z).toBeUndefined()
  })
  it('código con dos dígitos', () => { expect(codigoActividad(6)).toBe('ACT-06') })
  it('secuencia lista solo las numeradas', () => {
    expect(secuenciaActividades(fases).map(s => s.codigo)).toEqual(['ACT-01', 'ACT-02', 'ACT-03'])
  })
  it('revisarDecision marca una salida hacia atrás sin aceptar', () => {
    const seq = secuenciaActividades(fases)
    const motivos = revisarDecision({ origen: 'c', salidas: [{ destino: 'a' }, { destino: DESTINO_FIN }], contexto: {}, aceptados: [] }, seq)
    expect(motivos.length).toBeGreaterThan(0)
  })
})
```
Antes de escribirlo, leer `reference/captura/sistema-de-diseno/index.jsx:355-378` y `:837-880` y
ajustar **las expectativas** (no la implementación) a lo que esas funciones devuelven de verdad (forma
de la columna sin fase, forma de cada elemento de la secuencia, forma de los motivos). El test debe
describir el comportamiento del prototipo.

- [ ] **Step 3:** Run `npx vitest run tests/captura/secuencia.test.ts` → FAIL (módulo no existe).
- [ ] **Step 4: Portar** `index.jsx:355-378` (`numerarActividades`, `codigoActividad`,
  `secuenciaActividades`) y `:837-880` (`DESTINO_FIN`, `revisarDecision`) a `lib/captura/secuencia.ts`;
  `index.jsx:1039-1068` (`ICONOS_BPMN`) a `lib/captura/iconos.ts`. Sin JSX.
- [ ] **Step 5:** Run el test → PASS. `npx tsc --noEmit` limpio.
- [ ] **Step 6: Commit** `feat(captura): tipos, secuencia e íconos BPMN`

### Task 1.2: Gramática (`lengua.ts`)

**Files:** Create `lib/captura/lengua.ts` · Test `tests/captura/lengua.test.ts`

- [ ] **Step 1: Test que falla.** Portar `reference/captura/prototipo/pruebas/test-lengua.mjs` a Vitest:
copiar **literalmente** los objetos de casos (`V`, `A` y los demás) y convertir cada `eq(x, y, m)` en un
`it(m, () => expect(x).toBe(y))` dentro de `describe`s por bloque. Ejemplo del patrón:
```ts
import { describe, it, expect } from 'vitest'
import * as L from '@/lib/captura/lengua'

const V: Record<string, string> = { descargar: 'descarga', aprobar: 'aprueba', /* …copiar completo… */ }
describe('tercera persona', () => {
  for (const [inf, esp] of Object.entries(V)) it(inf, () => expect(L.tercera(inf)).toBe(esp))
  it('plural revisar', () => expect(L.tercera('revisar', true)).toBe('revisan'))
})
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Portar `prototipo/src/lengua.js` completo a `lib/captura/lengua.ts` (tal cual, con tipos).
- [ ] **Step 4:** Run → PASS (todos los casos del prototipo).
- [ ] **Step 5: Commit** `feat(captura): gramática del procedimiento`

### Task 1.3: Modelo (`modelo.ts`, `json.ts`, `importar.ts`)

**Files:** Create `lib/captura/modelo.ts`, `lib/captura/json.ts`, `lib/captura/importar.ts` · Test `tests/captura/modelo.test.ts`

- [ ] **Step 1: Test que falla** — `tests/captura/modelo.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import * as M from '@/lib/captura/modelo'
import { mismoJson } from '@/lib/captura/json'
import { documentoDesdePrototipo } from '@/lib/captura/importar'
import { semillaPrototipo } from './_fixtures'

describe('valores especiales', () => {
  it('«?», N/A, vacío y 0 son distintos', () => {
    expect(M.leerTexto('?')).toBe('desconocido')
    expect(M.leerTexto('n/a')).toBe('na')
    expect(M.leerTexto('  ')).toBeNull()
    expect(M.leerNumero('0')).toBe(0)
    expect(M.leerNumero('1,5')).toBe(1.5)
  })
})

describe('secuencia de la semilla', () => {
  it('8 actividades numeradas y 1 sin fase', () => {
    const p = semillaPrototipo()
    const m = p.versiones.asis
    expect(M.secuencia(m)).toHaveLength(8)
    expect(m.sinFase).toHaveLength(1)
  })
})

describe('crearTobe', () => {
  it('claves nuevas con origenClave y decisiones remapeadas', () => {
    const asis = semillaPrototipo().versiones.asis
    const tobe = M.crearTobe(asis)
    const claves = Object.keys(tobe.actividades)
    expect(claves.some(k => k in asis.actividades)).toBe(false)
    expect(Object.values(tobe.actividades).every(a => a.origenClave && a.origenClave in asis.actividades)).toBe(true)
    for (const d of tobe.decisiones) if (d.origen) expect(d.origen in tobe.actividades).toBe(true)
    expect('numero' in tobe || 'estado' in tobe || 'aprobacion' in tobe).toBe(false)
  })
})

describe('bloqueada', () => {
  it('revision y aprobado bloquean', () => {
    expect(M.bloqueada('revision')).toBe(true)
    expect(M.bloqueada('aprobado')).toBe(true)
    expect(M.bloqueada('cambios')).toBe(false)
    expect(M.bloqueada('borrador')).toBe(false)
  })
})

describe('fechas en America/Bogota', () => {
  it('fechaCorta de un instante tarde en la noche de Bogotá no salta de día', () => {
    expect(M.fechaCorta('2026-09-25T03:30:00Z')).toBe('24 sept 2026')   // 22:30 del 24 en Bogotá
    expect(M.fechaCorta('2026-09-24')).toBe('24 sept 2026')
  })
})

describe('contactos', () => {
  it('nuevoContacto usa numSiguiente, que solo crece, y un verif aleatorio', () => {
    const doc = M.nuevoDocumento('Radicación de facturas')
    const c1 = M.nuevoContacto(doc); doc.participantes.push(c1); doc.numSiguiente++
    const c2 = M.nuevoContacto(doc); doc.participantes.push(c2); doc.numSiguiente++
    doc.participantes.pop()
    const c3 = M.nuevoContacto(doc)
    expect([c1.num, c2.num, c3.num]).toEqual([1, 2, 3])
    expect(c1.verif).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/)
    expect(c1.verif).not.toBe(c2.verif)   // probabilidad de choque 1/32^4
  })
})

describe('documentoDesdePrototipo', () => {
  it('quita lo que vive en columnas y lo derivado, y agrega verif y numSiguiente', () => {
    const d = documentoDesdePrototipo(semillaPrototipo(), { u_marta: 'P3GM' })
    for (const k of ['id', 'creado', 'actualizado', 'rev', 'sesion', 'remitente']) expect(k in d).toBe(false)
    for (const k of ['numero', 'estado', 'aprobacion', 'historial']) expect(k in d.versiones.asis).toBe(false)
    expect(d.participantes.find(c => c.id === 'u_marta')!.verif).toBe('P3GM')
    expect(d.participantes.every(c => /^[A-Z2-9]{4}$/.test(c.verif))).toBe(true)
    expect(d.numSiguiente).toBe(6)
  })
})

describe('vista ↔ guardado', () => {
  it('conInfoDeVersiones y sinInfoDeVersiones son inversas', () => {
    const d = documentoDesdePrototipo(semillaPrototipo(), {})
    const v = M.conInfoDeVersiones(d, { asis: { numero: 2, estado: 'cambios' }, tobe: null })
    expect(v.versiones.asis.numero).toBe(2)
    expect(mismoJson(M.sinInfoDeVersiones(v), d)).toBe(true)
  })
})

describe('mismoJson', () => {
  it('no depende del orden de las claves', () => {
    expect(mismoJson({ a: 1, b: { c: [1, 2], d: null } }, { b: { d: null, c: [1, 2] }, a: 1 })).toBe(true)
    expect(mismoJson({ a: [1, 2] }, { a: [2, 1] })).toBe(false)
  })
})
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Portar `prototipo/src/model.js` completo a `lib/captura/modelo.ts`**, con estos cambios y
ningún otro:
  - `K().secuenciaActividades` / `K().revisarDecision` → imports de `./secuencia`; borrar `K`.
  - `uid(p)`: mismo formato (`p + '_' + …`), usando `crypto.getRandomValues` para la parte aleatoria.
  - `nuevoModelo()` devuelve un `Version` (sin `numero`, `estado`, `aprobacion`, `historial`).
  - `nuevoProceso(datos)` → **`nuevoDocumento(nombre: string): ProcesoDoc`**: mismos valores por defecto
    del prototipo menos `id`, `creado`, `actualizado`, `rev`, `sesion`, `remitente`; con
    `numSiguiente: 1`.
  - `crearTobe(asis: Version): Version` sin fijar `numero`/`estado`/`aprobacion`/`historial`.
  - `estadoAprobacion` se elimina (pasa a `aprobacion.ts`, Tarea 1.8). `bloqueada(estado: EstadoVersion)`
    recibe el estado, no el modelo.
  - `normalizarProceso` se conserva salvo el bloque de «Aprobación guardada antes de las etapas» y el
    cálculo de `num` (ya viene fijo); asegura `verif` y `numSiguiente` si faltan (verif con
    `nuevoVerif()`).
  - Agregar:
    ```ts
    const ALFA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    export function nuevoVerif(): string {
      const b = new Uint8Array(4); crypto.getRandomValues(b)
      return Array.from(b, x => ALFA[x % 32]).join('')
    }
    export function nuevoContacto(doc: ProcesoDoc): Contacto {
      return { id: uid('u'), num: doc.numSiguiente, nombre: '', rol: '', departamento: '', correo: '', papel: '', verif: nuevoVerif() }
    }
    export function conInfoDeVersiones(doc: ProcesoDoc, info: { asis: { numero: number; estado: EstadoVersion }; tobe: { numero: number; estado: EstadoVersion } | null }): ProcesoVista {
      return { ...doc, versiones: {
        asis: { ...doc.versiones.asis, ...info.asis },
        tobe: doc.versiones.tobe && info.tobe ? { ...doc.versiones.tobe, ...info.tobe } : null,
      } }
    }
    export function sinInfoDeVersiones(v: ProcesoVista): ProcesoDoc {
      const quitar = (m: VersionVista): Version => { const { numero: _n, estado: _e, ...resto } = m; return resto }
      return { ...v, versiones: { asis: quitar(v.versiones.asis), tobe: v.versiones.tobe ? quitar(v.versiones.tobe) : null } }
    }
    ```
    (256 % 32 = 0, así que `x % 32` no tiene sesgo.)
  - `relativo(iso, ahora = new Date())` y `fechaCorta(iso)`: calcular día/mes/año en `TZ` con
    `Intl.DateTimeFormat('es-CO', { timeZone: TZ, day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts`
    y mapear el mes con el arreglo `MESES` del prototipo; una fecha `AAAA-MM-DD` se interpreta como ese
    día de calendario. `TZ` se importa de `@/lib/data/metrics` (es un módulo puro).
- [ ] **Step 4:** `lib/captura/json.ts`:
```ts
/** JSON canónico: claves ordenadas. Para comparar documentos sin depender del orden de las claves. */
export function canonico(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return '[' + v.map(canonico).join(',') + ']'
  const o = v as Record<string, unknown>
  return '{' + Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canonico(o[k])).join(',') + '}'
}
export const mismoJson = (a: unknown, b: unknown) => canonico(a) === canonico(b)
```
- [ ] **Step 5:** `lib/captura/importar.ts`:
```ts
import { normalizarProceso, nuevoVerif, clonar } from './modelo'
import type { ProcesoDoc } from './tipos'

/** Un proceso en formato del prototipo (ejemplos/, prototipo/seed.mjs) → documento de §4.3.
 *  `verifs` fija el verif de contactos concretos (el seed los fija para que los tests conozcan los códigos). */
export function documentoDesdePrototipo(p: Record<string, unknown>, verifs: Record<string, string>): ProcesoDoc {
  const x = normalizarProceso(clonar(p)) as Record<string, any>   // única excepción de `any`: entrada sin tipar
  for (const k of ['id', 'creado', 'actualizado', 'rev', 'sesion', 'remitente']) delete x[k]
  for (const v of ['asis', 'tobe'] as const) {
    const m = x.versiones[v]
    if (m) for (const k of ['numero', 'estado', 'aprobacion', 'historial']) delete m[k]
  }
  for (const c of x.participantes) c.verif = verifs[c.id] ?? c.verif ?? nuevoVerif()
  x.numSiguiente = x.participantes.reduce((mx: number, c: { num: number }) => Math.max(mx, c.num), 0) + 1
  return x as ProcesoDoc
}
```
  (Si el lint marca el `any`, usar `// eslint-disable-next-line @typescript-eslint/no-explicit-any` solo
  en esa línea: es el borde con datos sin tipar.)
- [ ] **Step 6:** Run `npx vitest run tests/captura/modelo.test.ts` → PASS. `npx tsc --noEmit` limpio.
- [ ] **Step 7: Commit** `feat(captura): modelo del proceso portado a TypeScript`

### Task 1.4: Anexos y narrador

**Files:** Create `lib/captura/anexos.ts`, `lib/captura/narrador.ts` · Test `tests/captura/narrador.test.ts`

- [ ] **Step 1: Test que falla:**
```ts
import { describe, it, expect } from 'vitest'
import { narrarProceso, narrarActividad, plano } from '@/lib/captura/narrador'
import { anexosDe } from '@/lib/captura/anexos'
import { semillaPrototipo, leerEjemplo } from './_fixtures'

// Mismo recorrido que prototipo/pruebas/exportar-ejemplos.mjs, que generó semilla-relato.txt.
function relatoPlano(rel: unknown): string {
  const lineas: string[] = []
  const rec = (o: unknown) => {
    if (!o) return
    if (Array.isArray(o)) { o.forEach(rec); return }
    if (typeof o !== 'object') return
    const r = o as Record<string, unknown>
    if (r.runs) { lineas.push(plano(r as never)); return }
    Object.keys(r).forEach(k => rec(r[k]))
  }
  rec(rel)
  return lineas.join('\n\n') + '\n'
}

describe('narrador', () => {
  it('el relato de la semilla es idéntico al del prototipo (27 párrafos)', () => {
    const p = semillaPrototipo()
    const txt = relatoPlano(narrarProceso(p, p.versiones.asis, {}))
    expect(txt).toBe(leerEjemplo('semilla-relato.txt'))
    expect(txt.trim().split('\n\n')).toHaveLength(27)
  })
  it('el texto propio reemplaza el párrafo principal y se marca', () => {
    const p = semillaPrototipo(); const m = p.versiones.asis
    const auto = narrarActividad(p, m, 'a_revisar')
    m.actividades.a_revisar.relato = 'La jefe revisa todas las conciliaciones del mes antes del cierre.'
    const propio = narrarActividad(p, m, 'a_revisar')
    expect(propio.propio).toBe(true)
    expect(propio.parrafos[0].runs.map((r: { t: string }) => r.t).join('')).toContain('La jefe revisa todas')
    expect(propio.parrafos.length).toBe(auto.parrafos.length)
  })
  it('anexosDe numera los formatos de la semilla', () => {
    const a = anexosDe(semillaPrototipo().versiones.asis)
    expect(a.length).toBeGreaterThan(0)
  })
})
```
  Leer `prototipo/pruebas/test-propio.mjs` y ajustar la segunda aserción de longitud a lo que el
  prototipo hace de verdad (si «lo que falta» agrega o no párrafos); el test describe el prototipo.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Portar `documento.js:59-78` (`anexosDe`) a `anexos.ts` y `narrador.js` completo a
  `narrador.ts` (import de `anexosDe` desde `./anexos`, no desde `documento`).
- [ ] **Step 4:** Run → PASS. Si el relato difiere, **el port está mal**: comparar línea a línea contra
  `narrador.js`/`lengua.js`; nunca se actualiza el `.txt`.
- [ ] **Step 5: Commit** `feat(captura): narrador del procedimiento y anexos`

### Task 1.5: BPMN (rutas y generación)

**Files:** Create `lib/captura/bpmn/rutas.ts`, `lib/captura/bpmn/generar.ts` · Test `tests/captura/bpmn.test.ts`

- [ ] **Step 1: Test que falla:**
```ts
import { describe, it, expect } from 'vitest'
import BpmnModdle from 'bpmn-moddle'
import { generarBPMN } from '@/lib/captura/bpmn/generar'
import { cruces } from '@/lib/captura/bpmn/rutas'
import { semillaPrototipo, grandePrototipo, leerEjemplo } from './_fixtures'

describe('generarBPMN', () => {
  it('la semilla da exactamente el XML del prototipo', () => {
    const p = semillaPrototipo()
    expect(generarBPMN(p, p.versiones.asis, {}).xml.replace(/\r\n/g, '\n')).toBe(leerEjemplo('semilla.bpmn'))
  })
  it('el proceso grande da exactamente el XML del prototipo', () => {
    const p = grandePrototipo()
    expect(generarBPMN(p, p.versiones.asis, {}).xml.replace(/\r\n/g, '\n')).toBe(leerEjemplo('grande.bpmn'))
  })
  for (const [nombre, fx] of [['semilla', semillaPrototipo], ['grande', grandePrototipo]] as const) {
    it(`${nombre}: XML válido, sin flujos que crucen pools, sin conectores sobre formas`, async () => {
      const p = fx(); const g = generarBPMN(p, p.versiones.asis, {})
      const { rootElement, warnings } = await new BpmnModdle().fromXML(g.xml)
      expect(warnings).toHaveLength(0)
      const proc = rootElement.rootElements.find((e: { $type: string }) => e.$type === 'bpmn:Process')
      const ids = new Set(proc.flowElements.map((e: { id: string }) => e.id))
      const malos = proc.flowElements.filter((e: { $type: string; sourceRef: { id: string }; targetRef: { id: string } }) =>
        e.$type === 'bpmn:SequenceFlow' && (!ids.has(e.sourceRef.id) || !ids.has(e.targetRef.id)))
      expect(malos).toHaveLength(0)
      const formas = Object.entries(g.geo.final).map(([id, r]) => ({ id, ...(r as object) }))
      // Reproducir la comprobación de conectores y etiquetas de prototipo/pruebas/test-bpmn.mjs:26-45
      // (incluida la excepción de los eventos de borde) y exigir 0 cruces y 0 etiquetas pisadas.
    })
  }
})
```
  Completar el bloque comentado copiando la lógica de `test-bpmn.mjs:26-45` con aserciones
  `expect(malos).toEqual([])` y `expect(pisadas).toEqual([])`. Si `bpmn-moddle` no trae tipos, agregar
  `types/bpmn-moddle.d.ts` con `declare module 'bpmn-moddle'` (y `"types"` en el `include` de tsconfig ya
  lo cubre por `**/*.ts`).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Portar `rutas.js` completo a `bpmn/rutas.ts` y `bpmn.js` completo a `bpmn/generar.ts`
  (incluida la exportación `firmaForma` que usa `lienzo.js`).
- [ ] **Step 4:** Run → PASS. Diferencias de XML = port incorrecto; nunca se regenera el ejemplo.
- [ ] **Step 5: Commit** `feat(captura): generador BPMN 2.0 con ruteo ortogonal`

### Task 1.6: Revisión del diagrama

**Files:** Create `lib/captura/bpmn/validar.ts` · Test `tests/captura/validar.test.ts`

- [ ] **Step 1: Test que falla** (port de `pruebas/test-validar.mjs`):
```ts
import { describe, it, expect } from 'vitest'
import { generarBPMN } from '@/lib/captura/bpmn/generar'
import { revisarDiagrama } from '@/lib/captura/bpmn/validar'
import * as M from '@/lib/captura/modelo'
import { semillaPrototipo } from './_fixtures'

const revisar = (p: any, m: any) => revisarDiagrama(p, m, generarBPMN(p, m, {}))   // eslint-disable-line @typescript-eslint/no-explicit-any

describe('revisarDiagrama', () => {
  it('la semilla no tiene errores', () => {
    const p = semillaPrototipo(); expect(revisar(p, p.versiones.asis).errores).toHaveLength(0)
  })
  it('el modelo roto de la prueba del prototipo da 9 errores', () => {
    const p = semillaPrototipo(); const m = p.versiones.asis
    m.decisiones[0].salidas.pop(); m.decisiones[0].pregunta = ''
    m.decisiones.push(M.nuevaDecision({ origen: 'a_registrar', pregunta: '¿Otra?' }))
    m.actividades.a_investigar.eventos.push(Object.assign(M.nuevoEvento('limite'), { n: 2 }))
    m.decisiones[1].salidas = [{ condicion: 'Aprobada', destino: 'a_enviar', porDefecto: true, clase: null }, { condicion: '', destino: 'a_revisar', porDefecto: false, clase: null }]
    expect(revisar(p, m).errores).toHaveLength(9)
  })
})
```
- [ ] **Step 2:** Run → FAIL. **Step 3:** Portar `validar.js` a `bpmn/validar.ts`. **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(captura): revisión de errores y avisos del diagrama`

### Task 1.7: Saneador de SVG

**Files:** Create `lib/captura/svg.ts` · Test `tests/captura/svg.test.ts`

El SVG solo se muestra como `<img src="data:…">` (donde un navegador no ejecuta scripts ni carga
recursos externos); el saneo es defensa en profundidad (§6.5).

- [ ] **Step 1: Test que falla:**
```ts
import { describe, it, expect } from 'vitest'
import { sanearSvg, MAX_SVG } from '@/lib/captura/svg'

describe('sanearSvg', () => {
  it('quita script, foreignObject, on* y href externos; conserva #refs', () => {
    const sucio = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" onload="alert(1)">
      <script>alert(1)</script><script src="x.js"/>
      <foreignObject><div>hola</div></foreignObject>
      <a href="https://mal.co"><rect ONCLICK='x()' width="1"/></a>
      <use xlink:href="#marca"/><use href="javascript:alert(1)"/>
      <rect style="fill:url(https://mal.co/x.svg#a)"/><image href="data:image/png;base64,AAA"/>
    </svg>`
    const s = sanearSvg(sucio)
    expect(s).not.toMatch(/<script/i)
    expect(s).not.toMatch(/foreignObject/i)
    expect(s).not.toMatch(/\son[a-z]+\s*=/i)
    expect(s).not.toMatch(/https?:\/\/mal\.co/)
    expect(s).not.toMatch(/javascript:/i)
    expect(s).not.toMatch(/data:image/)
    expect(s).toContain('xlink:href="#marca"')
    expect(s.startsWith('<svg')).toBe(true)
  })
  it('rechaza lo que no es SVG y lo que pasa de 2 MB', () => {
    expect(() => sanearSvg('<html></html>')).toThrow()
    expect(() => sanearSvg('<svg>' + 'a'.repeat(MAX_SVG) + '</svg>')).toThrow()
  })
  it('quita DOCTYPE y entidades', () => {
    expect(sanearSvg('<!DOCTYPE svg [<!ENTITY x "y">]><svg>&x;</svg>')).not.toMatch(/DOCTYPE|ENTITY/)
  })
})
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implementar** `lib/captura/svg.ts`:
```ts
export const MAX_SVG = 2 * 1024 * 1024

const REGLAS: [RegExp, string][] = [
  [/<\?xml[\s\S]*?\?>/gi, ''],
  [/<!DOCTYPE[\s\S]*?(\[[\s\S]*?\])?\s*>/gi, ''],
  [/<!ENTITY[\s\S]*?>/gi, ''],
  [/<script[\s\S]*?<\/script\s*>/gi, ''],
  [/<script\b[^>]*\/>/gi, ''],
  [/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, ''],
  [/<foreignObject\b[^>]*\/>/gi, ''],
  [/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, ''],
  // href / xlink:href que no apunten a un id del propio documento
  [/\s+(xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*'|(?!["'#])[^\s>]+)/gi, ''],
  // url(...) que no sea url(#id)
  [/url\(\s*(?!['"]?#)[^)]*\)/gi, 'none'],
  [/@import[^;]*;?/gi, ''],
]

/** Sanea el SVG que renderizó el navegador con bpmn.io (§6.5). Lanza si no es un SVG o pasa de 2 MB. */
export function sanearSvg(svg: string): string {
  if (svg.length > MAX_SVG) throw new Error('El diagrama pasa de 2 MB')
  let s = svg
  for (let i = 0; i < 5; i++) {                 // hasta que no cambie (anidamientos maliciosos)
    const antes = s
    for (const [re, por] of REGLAS) s = s.replace(re, por)
    if (s === antes) break
  }
  s = s.trim()
  if (!/^<svg[\s>]/i.test(s) || !/<\/svg>\s*$/i.test(s)) throw new Error('No es un SVG')
  return s
}
```
- [ ] **Step 4:** Run → PASS. **Step 5: Commit** `feat(captura): saneador del SVG del diagrama`

### Task 1.8: Aprobación (lógica pura)

**Files:** Create `lib/captura/aprobacion.ts` · Test `tests/captura/aprobacion.test.ts`

- [ ] **Step 1: Test que falla:**
```ts
import { describe, it, expect } from 'vitest'
import * as A from '@/lib/captura/aprobacion'
import { documentoDesdePrototipo } from '@/lib/captura/importar'
import { semillaPrototipo } from './_fixtures'

const VERIF = { u_marta: 'P3GM', u_diego: 'D7KX', u_rosa: 'R4TN', u_carlos: 'C8WQ', u_laura: 'L5HZ' }
const doc = () => documentoDesdePrototipo(semillaPrototipo(), VERIF)

describe('prefijo y códigos', () => {
  it('prefijoProceso', () => {
    expect(A.prefijoProceso('Conciliación bancaria mensual')).toBe('CBM')
    expect(A.prefijoProceso('Radicación de facturas')).toBe('RF')
    expect(A.prefijoProceso('Nómina')).toBe('NOM')
    expect(A.prefijoProceso('X')).toBe('PRC')      // corrección §5.6
    expect(A.prefijoProceso('')).toBe('PRC')
    expect(A.prefijoProceso('de la y')).toBe('PRC')
  })
  it('codigoContacto = prefijo-NN-verif', () => {
    const d = doc()
    expect(A.codigoContacto('CBM', d.participantes[0])).toBe('CBM-01-P3GM')
    expect(d.participantes.map(c => A.codigoContacto('CBM', c)).every(c => /^CBM-0\d-[A-Z2-9]{4}$/.test(c))).toBe(true)
  })
  it('normalizarCodigo tolera minúsculas, espacios y guiones', () => {
    expect(A.normalizarCodigo(' cbm-01-p3gm ')).toBe('CBM01P3GM')
  })
})

describe('estado derivado (§6.2)', () => {
  const s = (numero: number, ronda: number, estado: A.EstadoSolicitud) => ({ version: 'asis' as const, numero, ronda, estado })
  it.each([
    [[], 'borrador'],
    [[s(1, 1, 'revision')], 'revision'],
    [[s(1, 1, 'cambios')], 'cambios'],
    [[s(1, 1, 'aprobada')], 'aprobado'],
    [[s(1, 1, 'retirada')], 'borrador'],
    [[s(1, 1, 'cambios'), s(1, 2, 'revision')], 'revision'],
  ])('%j → %s', (sols, esperado) => expect(A.estadoVersion(sols, 'asis', 1)).toBe(esperado))
  it('solo cuentan las solicitudes del número actual', () => {
    expect(A.estadoVersion([s(1, 1, 'aprobada')], 'asis', 2)).toBe('borrador')
  })
})

describe('etapas', () => {
  const p = (etapa: 'vobo' | 'final', decision: A.Decision) => ({ etapa, decision })
  it('la final se abre cuando todos los vistos buenos aprobaron', () => {
    expect(A.etapaAbierta([p('vobo', 'aprobado'), p('vobo', 'pendiente'), p('final', 'pendiente')], 'final')).toBe(false)
    expect(A.etapaAbierta([p('vobo', 'aprobado'), p('vobo', 'aprobado'), p('final', 'pendiente')], 'final')).toBe(true)
    expect(A.etapaAbierta([p('final', 'pendiente')], 'final')).toBe(true)
  })
})

describe('selección y reglas de envío', () => {
  it('prellena por papel de la RACI', () => {
    expect(A.seleccionInicial(doc().participantes, null)).toEqual({ conVobo: true, vobo: ['u_marta', 'u_carlos'], final: ['u_rosa', 'u_laura'] })
  })
  it('bloqueos y avisos', () => {
    const d = doc(); const m = d.versiones.asis
    const sel = A.seleccionInicial(d.participantes, null)
    expect(A.reglasEnvio(d, m, sel, 0).bloqueos).toEqual([])
    expect(A.reglasEnvio(d, m, { ...sel, final: [] }, 0).bloqueos).toContain('sin_final')
    expect(A.reglasEnvio(d, m, { ...sel, vobo: [] }, 0).bloqueos).toContain('vobo_vacio')
    expect(A.reglasEnvio(d, m, { ...sel, vobo: ['u_rosa'] }, 0).bloqueos).toContain('repetidos')
    expect(A.reglasEnvio(d, m, sel, 2).bloqueos).toContain('errores_diagrama')
    expect(A.reglasEnvio(d, { ...m, actividades: {} }, sel, 0).bloqueos).toContain('sin_actividades')
    d.participantes[0].correo = 'malo'
    expect(A.reglasEnvio(d, m, sel, 0).sinCorreo).toEqual(['u_marta'])
  })
  it('personasDeSeleccion arma filas con código, en orden y por etapa', () => {
    const d = doc()
    const filas = A.personasDeSeleccion(d, 'CBM', A.seleccionInicial(d.participantes, null))
    expect(filas.map(f => [f.etapa, f.orden, f.nombre, f.codigo])).toEqual([
      ['vobo', 1, 'Marta Ríos', 'CBM-01-P3GM'], ['vobo', 2, 'Carlos Méndez', 'CBM-04-C8WQ'],
      ['final', 1, 'Rosa Álvarez', 'CBM-03-R4TN'], ['final', 2, 'Laura Gómez', 'CBM-05-L5HZ'],
    ])
  })
})

describe('correos (§6.8)', () => {
  it('invitación con enlace y código', () => {
    const c = A.correoInvitacion({ proceso: 'Conciliación bancaria mensual', codigoDoc: 'PR-CON-01', version: 'asis', numero: 1,
      etapa: 'vobo', persona: { nombre: 'Marta Ríos', correo: 'marta.rios@ejemplo.co', codigo: 'CBM-01-P3GM' },
      enlace: 'https://kaze.ventosolutions.ca/aprobar/TOKEN', remitente: 'Carmen Vega' })
    expect(c.asunto).toBe('Visto bueno: Conciliación bancaria mensual (As-Is v1)')
    expect(c.cuerpo).toContain('Hola Marta:')
    expect(c.cuerpo).toContain('«Conciliación bancaria mensual» (PR-CON-01 · As-Is v1) para tu visto bueno.')
    expect(c.cuerpo).toContain('1. Abre este enlace: https://kaze.ventosolutions.ca/aprobar/TOKEN')
    expect(c.cuerpo).toContain('2. Escribe tu código: CBM-01-P3GM')
    expect(c.cuerpo.endsWith('Gracias,\nCarmen Vega')).toBe(true)
    const l = A.enlacesCorreo(c)
    expect(l.mailto.startsWith('mailto:marta.rios@ejemplo.co?subject=')).toBe(true)
    expect(l.gmail).toContain('to=marta.rios%40ejemplo.co')
  })
  it('aprobación final dice «Aprobación:» y «apruébalo»', () => {
    const c = A.correoInvitacion({ proceso: 'P', codigoDoc: null, version: 'tobe', numero: 2, etapa: 'final',
      persona: { nombre: 'Rosa', correo: '', codigo: 'X-03-AAAA' }, enlace: 'u', remitente: 'C' })
    expect(c.asunto).toBe('Aprobación: P (To-Be v2)')
    expect(c.cuerpo).toContain('apruébalo')
  })
})
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implementar** `lib/captura/aprobacion.ts`. Portar tal cual de `aprobacion.js`: `PAPELES`,
  `NOMBRE_PAPEL`, `ETAPAS`, `prefijoProceso` (con la corrección), `normalizarCodigo`, `correoValido`,
  `iniciales`, `correoInformados`, `enlacesCorreo`, `textoCorreo`. **No** portar `hash53`,
  `codificarRespuesta`, `leerRespuesta`, `interpretarRespuesta`, `nombreFotografia`, `b64u*`,
  `nuevaSolicitud`, `registrarRespuesta`. Nuevo:
```ts
import type { Contacto, EstadoVersion, ProcesoDoc, Version, VersionId } from './tipos'
import { tieneValor } from './modelo'

export type EstadoSolicitud = 'revision' | 'aprobada' | 'cambios' | 'retirada'
export type Decision = 'pendiente' | 'aprobado' | 'cambios'
export type Etapa = 'vobo' | 'final'
export interface Seleccion { conVobo: boolean; vobo: string[]; final: string[] }

// prefijoProceso: el del prototipo, y al final:  return r.length < 2 ? 'PRC' : r
export const codigoContacto = (prefijo: string, c: Pick<Contacto, 'num' | 'verif'>) =>
  prefijo + '-' + String(c.num || 0).padStart(2, '0') + '-' + c.verif

const ESTADO_DE: Record<EstadoSolicitud, EstadoVersion> = { revision: 'revision', cambios: 'cambios', aprobada: 'aprobado', retirada: 'borrador' }
/** §6.2: de las solicitudes del número actual, manda la de ronda más alta. */
export function estadoVersion(sols: { version: VersionId; numero: number; ronda: number; estado: EstadoSolicitud }[], version: VersionId, numero: number): EstadoVersion {
  const ult = sols.filter(s => s.version === version && s.numero === numero).sort((a, b) => b.ronda - a.ronda)[0]
  return ult ? ESTADO_DE[ult.estado] : 'borrador'
}
export function etapaAbierta(personas: { etapa: Etapa; decision: Decision }[], etapa: Etapa): boolean {
  return etapa === 'vobo' || personas.filter(p => p.etapa === 'vobo').every(p => p.decision === 'aprobado')
}
/** Prototipo aprobar.jsx:107-115. `anterior` = personas de la última solicitud (reenvío tras cambios). */
export function seleccionInicial(contactos: Contacto[], anterior: { etapa: Etapa; contacto_num: number }[] | null): Seleccion {
  if (anterior && anterior.length) {
    const ids = (e: Etapa) => anterior.filter(p => p.etapa === e).map(p => contactos.find(c => c.num === p.contacto_num)?.id).filter((x): x is string => !!x)
    const vobo = ids('vobo')
    return { conVobo: vobo.length > 0, vobo, final: ids('final') }
  }
  const vobo = contactos.filter(c => c.papel === 'vobo').map(c => c.id)
  return { conVobo: vobo.length > 0, vobo, final: contactos.filter(c => c.papel === 'aprueba').map(c => c.id) }
}
export type Bloqueo = 'sin_actividades' | 'sin_final' | 'vobo_vacio' | 'repetidos' | 'errores_diagrama'
/** Las reglas de aprobar.jsx:117-121 menos el remitente (ahora es el usuario de la sesión). */
export function reglasEnvio(doc: ProcesoDoc, m: Version, sel: Seleccion, erroresDiagrama: number) {
  const bloqueos: Bloqueo[] = []
  if (!Object.keys(m.actividades).length) bloqueos.push('sin_actividades')
  if (!sel.final.length) bloqueos.push('sin_final')
  if (sel.conVobo && !sel.vobo.length) bloqueos.push('vobo_vacio')
  if (sel.conVobo && sel.vobo.some(id => sel.final.includes(id))) bloqueos.push('repetidos')
  if (erroresDiagrama > 0) bloqueos.push('errores_diagrama')
  const elegidos = sel.final.concat(sel.conVobo ? sel.vobo : [])
  const sinCorreo = elegidos.filter(id => { const c = doc.participantes.find(x => x.id === id); return c && !correoValido(c.correo) })
  return { bloqueos, sinCorreo }
}
export interface PersonaEnvio { etapa: Etapa; orden: number; contacto_num: number; nombre: string; cargo: string
  area: string; correo: string; codigo: string }
export function personasDeSeleccion(doc: ProcesoDoc, prefijo: string, sel: Seleccion): PersonaEnvio[] {
  const fila = (etapa: Etapa) => (id: string, i: number): PersonaEnvio | null => {
    const c = doc.participantes.find(x => x.id === id); if (!c) return null
    return { etapa, orden: i + 1, contacto_num: c.num, nombre: tieneValor(c.nombre) ? c.nombre : 'Sin nombre',
      cargo: c.rol || '', area: c.departamento || '', correo: (c.correo || '').trim(), codigo: codigoContacto(prefijo, c) }
  }
  const vobo = sel.conVobo ? sel.vobo.map(fila('vobo')) : []
  return vobo.concat(sel.final.map(fila('final'))).filter((x): x is PersonaEnvio => !!x)
}
export const etiquetaVersion = (v: VersionId, numero: number) => (v === 'tobe' ? 'To-Be' : 'As-Is') + ' v' + numero
export function correoInvitacion(a: { proceso: string; codigoDoc: string | null; version: VersionId; numero: number; etapa: Etapa
  persona: { nombre: string; correo: string; codigo: string }; enlace: string; remitente: string }) {
  const et = ETAPAS[a.etapa]
  const ev = etiquetaVersion(a.version, a.numero)
  const ref = '«' + (a.proceso || 'Proceso') + '» (' + [tieneValor(a.codigoDoc) ? a.codigoDoc : null, ev].filter(Boolean).join(' · ') + ')'
  const nombre = String(a.persona.nombre || '').split(/\s+/)[0] || ''
  const cuerpo = [
    'Hola' + (nombre ? ' ' + nombre : '') + ':', '',
    'Te comparto el proceso ' + ref + ' para tu ' + (a.etapa === 'vobo' ? 'visto bueno' : 'aprobación') + '.', '',
    '1. Abre este enlace: ' + a.enlace,
    '2. Escribe tu código: ' + a.persona.codigo,
    '3. Revisa el proceso. Si estás de acuerdo, ' + (a.etapa === 'vobo' ? 'da tu visto bueno' : 'apruébalo') + '; si no, escribe los cambios que pides y envía tu respuesta.', '',
    'Gracias' + (a.remitente ? ',\n' + a.remitente : '.'),
  ].join('\n')
  return { para: a.persona.correo || '', asunto: et.corto + ': ' + (a.proceso || 'Proceso') + ' (' + ev + ')', cuerpo }
}
```
  `correoInformados` se adapta a la firma `(proceso, codigoDoc, version, numero, correos, remitente)`
  conservando su texto.
- [ ] **Step 4:** Run → PASS. **Step 5: Commit** `feat(captura): lógica de aprobación por enlace y código`

### Task 1.9: Fotografía (lo que ve quien aprueba)

**Files:** Create `lib/captura/fotografia.ts` · Test `tests/captura/fotografia.test.ts`

- [ ] **Step 1: Test que falla:**
```ts
import { describe, it, expect } from 'vitest'
import { armarFotografia, contenidoPublico } from '@/lib/captura/fotografia'
import { documentoDesdePrototipo } from '@/lib/captura/importar'
import { semillaPrototipo } from './_fixtures'

describe('fotografía §6.4', () => {
  const d = documentoDesdePrototipo(semillaPrototipo(), {})
  const f = armarFotografia(d, 'asis', 1)
  it('lleva el resumen y la versión, sin contactos ni correos', () => {
    expect(f.nombre).toBe('Conciliación bancaria mensual')
    expect(f.version).toEqual(expect.objectContaining({ id: 'asis', numero: 1 }))
    const json = JSON.stringify(f)
    expect(json).not.toMatch(/@ejemplo\.co/)
    expect(json).not.toMatch(/participantes|verif/)
  })
  it('los formatos van sin archivo', () => {
    expect(JSON.stringify(f.formatos)).not.toMatch(/"path"|"archivo"/)
  })
  it('contenidoPublico calcula relato y SIPOC en el orden de fotografia.js', () => {
    const c = contenidoPublico(f)
    expect(Object.keys(c)).toEqual(['cabecera', 'resumen', 'alcance', 'sipoc', 'fases', 'formatos'])
    expect(c.fases).toHaveLength(3)
  })
})
```
  Antes de fijar `Object.keys(c)`, leer `prototipo/src/fotografia.js` completo y
  `ejemplos/fotografia-aprobacion.html`: las claves deben seguir el orden de secciones de la fotografía
  (sin «Tu respuesta», que es de la página). Ajustar el test a ese orden si difiere.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implementar.** `armarFotografia(doc, version, numero)` devuelve un objeto serializable con:
  nombre, codigoDoc, objetivo, alcance, exclusiones, inicio, disparador, resultados, cliente,
  clienteExterno, dueno, departamentos, proveedores, referencias; `version: { id, numero, fases,
  sinFase, actividades (con formatos sin `archivo`), decisiones }`; `formatos` (nombre, código, versión,
  actividades) desde `formatosDelModelo`. `contenidoPublico(f)` reconstruye un `ProcesoVista` mínimo
  (participantes vacíos) y llama a `narrarProceso`/`sipocDe`/`anexosDe`, devolviendo datos (runs), no
  HTML. Es lo que `fotografia.js:13-266` pinta, traducido a datos: la página de F7 lo pinta con JSX.
- [ ] **Step 4:** Run → PASS. **Step 5: Commit** `feat(captura): fotografía congelada para quien aprueba`

### Task 1.10: zip y nombres de archivo

**Files:** Create `lib/captura/zip.ts` · Test `tests/captura/zip.test.ts`

- [ ] **Step 1: Test que falla:**
```ts
import { describe, it, expect } from 'vitest'
import { zip, nombreArchivo } from '@/lib/captura/zip'

describe('zip', () => {
  it('arma un zip con las entradas y el directorio central', async () => {
    const blob = zip([{ nombre: 'a.txt', datos: new TextEncoder().encode('hola') }, { nombre: 'Anexos/b.txt', datos: new Uint8Array([1, 2]) }])
    const b = new Uint8Array(await blob.arrayBuffer())
    expect([...b.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])
    const fin = b.length - 22
    expect([...b.slice(fin, fin + 4)]).toEqual([0x50, 0x4b, 0x05, 0x06])
    expect(b[fin + 10] | (b[fin + 11] << 8)).toBe(2)
    expect(new TextDecoder().decode(b)).toContain('Anexos/b.txt')
  })
  it('nombreArchivo quita tildes y caracteres raros', () => {
    expect(nombreArchivo('Conciliación bancaria / mensual')).toMatch(/^[A-Za-z0-9 _.-]+$/)
  })
})
```
  Ajustar la forma del argumento de `zip` a la de `util.js:7-35` (los tests describen el prototipo).
- [ ] **Step 2:** FAIL. **Step 3:** Portar `util.js:5-35` (`CRC`, `crc32`, `zip`) y `:72` (`nombreArchivo`).
- [ ] **Step 4:** PASS. **Step 5: Commit** `feat(captura): zip y nombres de archivo`

### Task 1.11: Hash de códigos y firma de acceso (`lib/aprobar/`)

**Files:** Create `lib/aprobar/hash.ts`, `lib/aprobar/firma.ts` · Test `tests/captura/firma.test.ts`

- [ ] **Step 1: Test que falla:**
```ts
import { describe, it, expect } from 'vitest'
import { hashCodigo, hashIp, nuevoToken, TOKEN_RE } from '@/lib/aprobar/hash'
import { firmarAcceso, leerAcceso } from '@/lib/aprobar/firma'

const S = 'secreto-de-prueba-de-32-bytes-o-mas!!'
const SOL = '11111111-1111-4111-8111-111111111111', PER = '22222222-2222-4222-8222-222222222222'

describe('hash', () => {
  it('el hash del código no depende de mayúsculas ni guiones', () => {
    expect(hashCodigo('cbm-01-p3gm')).toBe(hashCodigo('CBM01P3GM'))
    expect(hashCodigo('CBM-01-P3GM')).toMatch(/^[0-9a-f]{64}$/)
  })
  it('hashIp depende de la sal', () => { expect(hashIp('1.2.3.4', S)).not.toBe(hashIp('1.2.3.4', S + 'x')) })
  it('token de 192 bits en base64url', () => {
    const t = nuevoToken(); expect(t).toMatch(TOKEN_RE); expect(nuevoToken()).not.toBe(t)
  })
})

describe('firma de acceso', () => {
  it('ida y vuelta', () => {
    const v = firmarAcceso(S, { solicitud: SOL, persona: PER }, 1000)
    expect(leerAcceso(S, v, 1000 + 60_000)).toEqual({ solicitud: SOL, persona: PER })
  })
  it('rechaza alterada, vencida, otra clave y basura', () => {
    const v = firmarAcceso(S, { solicitud: SOL, persona: PER }, 1000)
    expect(leerAcceso(S, v.replace(PER, SOL), 2000)).toBeNull()
    expect(leerAcceso(S, v, 1000 + 8 * 3600_000 + 1)).toBeNull()
    expect(leerAcceso(S + 'x', v, 2000)).toBeNull()
    expect(leerAcceso(S, 'a.b.c', 2000)).toBeNull()
    expect(leerAcceso(S, undefined, 2000)).toBeNull()
  })
})
```
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implementar.** `lib/aprobar/hash.ts`:
```ts
import { createHash, randomBytes } from 'node:crypto'
import { normalizarCodigo } from '@/lib/captura/aprobacion'

export const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/
export const nuevoToken = () => randomBytes(24).toString('base64url')          // 192 bits (§6.5 pide ≥128)
export const hashCodigo = (codigo: string) => createHash('sha256').update(normalizarCodigo(codigo)).digest('hex')
export const hashIp = (ip: string, sal: string) => createHash('sha256').update(ip + '|' + sal).digest('hex')
```
`lib/aprobar/firma.ts`:
```ts
import { createHmac, timingSafeEqual } from 'node:crypto'

export const DURACION_ACCESO_MS = 8 * 3600_000
const UUID = /^[0-9a-f-]{36}$/
const mac = (secreto: string, datos: string) => createHmac('sha256', secreto).update(datos).digest('base64url')

/** Valor de la cookie de acceso a /aprobar/[token]: solicitud.persona.vence.mac */
export function firmarAcceso(secreto: string, a: { solicitud: string; persona: string }, ahora = Date.now()) {
  const datos = `${a.solicitud}.${a.persona}.${ahora + DURACION_ACCESO_MS}`
  return `${datos}.${mac(secreto, datos)}`
}
export function leerAcceso(secreto: string, valor: string | undefined, ahora = Date.now()) {
  if (!valor) return null
  const partes = valor.split('.')
  if (partes.length !== 4) return null
  const [solicitud, persona, vence, firma] = partes
  if (!UUID.test(solicitud) || !UUID.test(persona) || !/^\d+$/.test(vence)) return null
  const esperada = Buffer.from(mac(secreto, `${solicitud}.${persona}.${vence}`))
  const recibida = Buffer.from(firma)
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null
  if (Number(vence) < ahora) return null
  return { solicitud, persona }
}
```
- [ ] **Step 4:** PASS. `npm test` completo en verde.
- [ ] **Step 5: Commit** `feat(aprobar): hash de códigos, token y cookie de acceso firmada`
- [ ] **Step 6:** START-HERE: F1 ✅. `git commit -am "docs: F1 de captura cerrada"`

---

# F2 · Datos, RLS y funciones

### Task 2.1: Migración de tablas, RLS y grants

**Files:**
- Create: `supabase/migrations/20260924000001_kaze_captura.sql`
- Modify: `lib/database.types.ts` (regenerado)
- Create: `tests/data/_captura.ts` · Test: `tests/data/rls-captura.test.ts`

- [ ] **Step 1: Migración.** Contenido = `reference/captura/sql-probado/10-kaze-captura.sql` seguido de
  `reference/captura/sql-probado/20-kaze-captura-rls.sql` **sin** la función de ejemplo
  `aprobacion_retirar` (va en la 2.2), con cabecera:
```sql
-- 20260924000001_kaze_captura.sql — Captura de procesos: tablas, RLS y grants (§4.1–4.2).
-- Probado en Postgres 16 (reference/captura/sql-probado/). Sin triggers sobre auth.users.
```
  y al final (anon no tiene `usage` sobre `kaze`, pero el proyecto compartido expone tablas nuevas
  automáticamente: se cierra también por tabla):
```sql
revoke all on kaze.procesos, kaze.aprobacion_solicitudes, kaze.aprobacion_personas, kaze.aprobacion_intentos from anon;
```
  El `delete` de `procesos` para miembros ya viene del SQL probado (policy `miembros_delete` + el grant
  por defecto, que el `revoke insert, update` no quita).
- [ ] **Step 2: Aplicar y regenerar tipos**
```bash
cd /c/Users/pauld/dev/cota && npm run db:reset && npm run seed && npm run db:types && npx tsc --noEmit
```
Expected: reset sin errores (el `WARN` de `seed.sql` es normal), tipos con `procesos` y `aprobacion_*`.
- [ ] **Step 3: Helpers de integración** — `tests/data/_captura.ts`:
```ts
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { documentoDesdePrototipo } from '@/lib/captura/importar'
import { readFileSync } from 'node:fs'
import path from 'node:path'

export type DB = SupabaseClient<Database>
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const opciones = { db: { schema: 'kaze' as const }, auth: { persistSession: false, autoRefreshToken: false } }
export const adminDb = (): DB => createClient<Database>(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, opciones)
export const anonDb = (): DB => createClient<Database>(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opciones)
export async function sesionDe(email: string): Promise<{ db: DB; userId: string }> {
  const db = anonDb()
  const { data, error } = await db.auth.signInWithPassword({ email, password: 'cota-demo-2026' })
  if (error) throw error
  return { db, userId: data.user.id }
}
export const VERIF = { u_marta: 'P3GM', u_diego: 'D7KX', u_rosa: 'R4TN', u_carlos: 'C8WQ', u_laura: 'L5HZ' }
export function docSemilla() {
  const p = JSON.parse(readFileSync(path.resolve(__dirname, '../../reference/captura/ejemplos/semilla.json'), 'utf8'))
  return documentoDesdePrototipo(p, VERIF)
}
export async function clienteAndrade(db: DB) {
  const { data, error } = await db.from('clients').select('id').eq('nombre', 'Despacho Andrade & Vega').single()
  if (error) throw error
  return data.id
}
const creados: string[] = []
/** Inserta un proceso de prueba con el cliente de servicio. Se borra en limpiarProcesos(). */
export async function crearProcesoPrueba(db = adminDb(), extra: Partial<Database['kaze']['Tables']['procesos']['Insert']> = {}) {
  const doc = docSemilla(); doc.nombre = 'TEST · ' + doc.nombre
  const { data, error } = await db.from('procesos').insert({ client_id: await clienteAndrade(db), prefijo: 'CBM', documento: doc as never, ...extra }).select('*').single()
  if (error) throw error
  creados.push(data.id)
  return data
}
export async function limpiarProcesos(db = adminDb()) {
  if (creados.length) await db.from('procesos').delete().in('id', creados.splice(0))
}
```
- [ ] **Step 4: Test que falla** — `tests/data/rls-captura.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { adminDb, anonDb, sesionDe, crearProcesoPrueba, limpiarProcesos, clienteAndrade, docSemilla, type DB } from './_captura'

let miembro: DB, miembroId: string, ajeno: DB, procesoId: string
beforeAll(async () => {
  ({ db: miembro, userId: miembroId } = await sesionDe('carmen@cota.test'))
  ;({ db: ajeno } = await sesionDe('ajeno@cota.test'))
  procesoId = (await crearProcesoPrueba()).id
})
afterAll(() => limpiarProcesos())

describe('procesos: miembro', () => {
  it('crea, lee, edita y borra', async () => {
    const { data, error } = await miembro.from('procesos').insert({ client_id: await clienteAndrade(miembro), prefijo: 'TST', documento: docSemilla() as never, created_by: miembroId }).select('id, rev, numero_asis').single()
    expect(error).toBeNull(); expect(data!.numero_asis).toBe(1)
    const up = await miembro.from('procesos').update({ rev: 1 }).eq('id', data!.id).eq('rev', 0).select('rev')
    expect(up.data).toEqual([{ rev: 1 }])
    const del = await miembro.from('procesos').delete().eq('id', data!.id).select('id')
    expect(del.data).toHaveLength(1)
  })
  it('NO puede cambiar numero_asis ni numero_tobe', async () => {
    const a = await miembro.from('procesos').update({ numero_asis: 7 } as never).eq('id', procesoId)
    expect(a.error?.code).toBe('42501')
    const b = await miembro.from('procesos').insert({ client_id: await clienteAndrade(miembro), prefijo: 'TST', documento: {} as never, numero_tobe: 3 } as never)
    expect(b.error?.code).toBe('42501')
  })
})

describe('aprobación: miembro solo lee', () => {
  it('no inserta, no cambia, no borra en aprobacion_*', async () => {
    const ins = await miembro.from('aprobacion_solicitudes').insert({ proceso_id: procesoId, version: 'asis', numero: 1, ronda: 1, enlace_token: 'x'.repeat(32), con_vobo: false, fotografia: {}, remitente_nombre: 'x', remitente_correo: 'x@x.co' })
    expect(ins.error?.code).toBe('42501')
    const upd = await miembro.from('aprobacion_personas').update({ decision: 'aprobado' }).eq('solicitud_id', procesoId)
    expect(upd.error?.code).toBe('42501')
    const del = await miembro.from('aprobacion_solicitudes').delete().eq('proceso_id', procesoId)
    expect(del.error?.code).toBe('42501')
  })
  it('no lee aprobacion_intentos', async () => {
    const r = await miembro.from('aprobacion_intentos').select('id')
    expect(r.error?.code).toBe('42501')
  })
})

describe('fuera de Kaze', () => {
  it('un autenticado sin perfil no ve nada', async () => {
    for (const t of ['procesos', 'aprobacion_solicitudes', 'aprobacion_personas'] as const) {
      const { data } = await ajeno.from(t).select('id')
      expect(data ?? []).toHaveLength(0)
    }
    const ins = await ajeno.from('procesos').insert({ client_id: await clienteAndrade(adminDb()), prefijo: 'TST', documento: {} as never })
    expect(ins.error?.code).toBe('42501')
  })
  it('anon recibe permission denied', async () => {
    const r = await anonDb().from('procesos').select('id')
    expect(r.error?.code).toBe('42501')
  })
})
```
- [ ] **Step 5:** Run `npx vitest run tests/data/rls-captura.test.ts` → PASS (la migración ya está
  aplicada; si algo falla es un defecto real de grants/RLS: corregir la migración y repetir
  `npm run db:reset && npm run seed`). **Prueba a la inversa:** comentar temporalmente
  `revoke insert, update on kaze.procesos from authenticated;`, reset, ver el test de `numero_asis` en
  rojo, restaurar, reset, verde.
- [ ] **Step 6:** Ampliar `tests/data/rls-no-miembro.test.ts` con un `it('no lee procesos ni aprobaciones')`
  que haga lo mismo que el bloque «fuera de Kaze» de arriba para `procesos`.
- [ ] **Step 7: Commit**
```bash
git add supabase/migrations/20260924000001_kaze_captura.sql lib/database.types.ts tests/data
git commit -m "feat(db): tablas de captura con RLS por membresía y números de versión protegidos"
```

### Task 2.2: Funciones SQL de aprobación y versión

**Files:**
- Create: `supabase/migrations/20260924000002_kaze_captura_funciones.sql`
- Test: `tests/data/aprobaciones-sql.test.ts`

- [ ] **Step 1: Migración** (completa):
```sql
-- 20260924000002_kaze_captura_funciones.sql — Escrituras de la aprobación y del número de versión (§4.2).
-- Todas: security invoker, search_path fijo, bloqueo (for update) de la fila que protegen y validación
-- BAJO ese bloqueo. Solo service_role las ejecuta; los alter default privileges de 20260920000002 dan
-- EXECUTE a authenticated y el esquema kaze está expuesto: sin el revoke, cualquier autenticado del
-- ecosistema (CMS, HUB) podría llamarlas por RPC.

create function kaze.aprobacion_enviar(
  p_proceso uuid, p_version text, p_rev integer, p_con_vobo boolean, p_token text,
  p_fotografia jsonb, p_svg text, p_remitente_nombre text, p_remitente_correo text,
  p_enviada_por uuid, p_personas jsonb
) returns jsonb
  language plpgsql security invoker set search_path = kaze, pg_temp
as $$
declare v_rev int; v_num int; v_ronda int; v_sol uuid;
begin
  select rev, case p_version when 'asis' then numero_asis when 'tobe' then numero_tobe end
    into v_rev, v_num from kaze.procesos where id = p_proceso for update;
  if not found then return jsonb_build_object('error', 'no_existe'); end if;
  if v_num is null then return jsonb_build_object('error', 'sin_version'); end if;
  if v_rev <> p_rev then return jsonb_build_object('error', 'rev', 'rev', v_rev); end if;
  if exists (select 1 from kaze.aprobacion_solicitudes
             where proceso_id = p_proceso and version = p_version and estado = 'revision') then
    return jsonb_build_object('error', 'abierta');
  end if;
  if not exists (select 1 from jsonb_array_elements(p_personas) x where x->>'etapa' = 'final') then
    return jsonb_build_object('error', 'sin_final');
  end if;
  if p_con_vobo and not exists (select 1 from jsonb_array_elements(p_personas) x where x->>'etapa' = 'vobo') then
    return jsonb_build_object('error', 'vobo_vacio');
  end if;
  if exists (select 1 from jsonb_array_elements(p_personas) x
             group by (x->>'contacto_num') having count(*) > 1) then
    return jsonb_build_object('error', 'repetidos');
  end if;

  select coalesce(max(ronda), 0) + 1 into v_ronda from kaze.aprobacion_solicitudes
    where proceso_id = p_proceso and version = p_version and numero = v_num;

  insert into kaze.aprobacion_solicitudes (proceso_id, version, numero, ronda, enlace_token, con_vobo,
      fotografia, diagrama_svg, remitente_nombre, remitente_correo, enviada_por)
    values (p_proceso, p_version, v_num, v_ronda, p_token, p_con_vobo, p_fotografia, p_svg,
      p_remitente_nombre, p_remitente_correo, p_enviada_por)
    returning id into v_sol;

  insert into kaze.aprobacion_personas (solicitud_id, etapa, orden, contacto_num, nombre, cargo, area, correo, codigo, codigo_hash)
    select v_sol, x.etapa, x.orden, x.contacto_num, x.nombre, x.cargo, x.area, x.correo, x.codigo, x.codigo_hash
    from jsonb_to_recordset(p_personas) as x(etapa text, orden int, contacto_num int, nombre text, cargo text,
      area text, correo text, codigo text, codigo_hash text);

  update kaze.procesos set rev = rev + 1 where id = p_proceso returning rev into v_rev;
  return jsonb_build_object('solicitud', v_sol, 'ronda', v_ronda, 'numero', v_num, 'rev', v_rev);
end $$;

create function kaze.aprobacion_identificar(p_token text, p_codigo_hash text, p_ip_hash text) returns jsonb
  language plpgsql security invoker set search_path = kaze, pg_temp
as $$
declare v_sol uuid; v_estado text; v_ip int; v_total int; v_per kaze.aprobacion_personas;
begin
  select id, estado into v_sol, v_estado from kaze.aprobacion_solicitudes where enlace_token = p_token for update;
  if v_sol is null then return jsonb_build_object('error', 'enlace'); end if;
  if v_estado <> 'revision' then return jsonb_build_object('error', 'cerrada', 'estado', v_estado); end if;

  -- Ventanas deslizantes de 15 min: 10 fallidos por IP, 50 por solicitud (§6.5).
  select count(*) filter (where ip_hash = p_ip_hash), count(*) into v_ip, v_total
    from kaze.aprobacion_intentos
    where solicitud_id = v_sol and not ok and created_at > now() - interval '15 minutes';
  if v_ip >= 10 or v_total >= 50 then return jsonb_build_object('error', 'intentos'); end if;

  select * into v_per from kaze.aprobacion_personas where solicitud_id = v_sol and codigo_hash = p_codigo_hash;
  insert into kaze.aprobacion_intentos (solicitud_id, ip_hash, ok) values (v_sol, p_ip_hash, v_per.id is not null);
  if v_per.id is null then return jsonb_build_object('error', 'codigo'); end if;
  return jsonb_build_object('solicitud', v_sol, 'persona', v_per.id);
end $$;

create function kaze.aprobacion_registrar(
  p_solicitud uuid, p_persona uuid, p_decision text, p_comentario text, p_via text,
  p_registrada_por uuid, p_fecha timestamptz
) returns text
  language plpgsql security invoker set search_path = kaze, pg_temp
as $$
declare v_estado text; v_per kaze.aprobacion_personas; v_nuevo text;
begin
  select estado into v_estado from kaze.aprobacion_solicitudes where id = p_solicitud for update;
  if v_estado is null then return 'no_existe'; end if;
  if v_estado <> 'revision' then return 'cerrada'; end if;
  select * into v_per from kaze.aprobacion_personas where id = p_persona and solicitud_id = p_solicitud;
  if v_per.id is null then return 'persona'; end if;
  if v_per.decision <> 'pendiente' then return 'ya_respondio'; end if;
  if p_decision not in ('aprobado', 'cambios') or p_via not in ('enlace', 'manual') then return 'invalido'; end if;
  if p_decision = 'cambios' and length(trim(coalesce(p_comentario, ''))) = 0 then return 'comentario'; end if;
  if length(coalesce(p_comentario, '')) > 4000 then return 'comentario_largo'; end if;
  if v_per.etapa = 'final' and exists (select 1 from kaze.aprobacion_personas
      where solicitud_id = p_solicitud and etapa = 'vobo' and decision <> 'aprobado') then
    return 'etapa';
  end if;

  update kaze.aprobacion_personas
    set decision = p_decision, comentario = nullif(trim(coalesce(p_comentario, '')), ''),
        respondida_at = coalesce(p_fecha, now()), via = p_via, registrada_por = p_registrada_por
    where id = p_persona;

  if p_decision = 'cambios' then v_nuevo := 'cambios';
  elsif not exists (select 1 from kaze.aprobacion_personas where solicitud_id = p_solicitud and decision <> 'aprobado') then
    v_nuevo := 'aprobada';
  end if;
  if v_nuevo is not null then
    update kaze.aprobacion_solicitudes set estado = v_nuevo, cerrada_at = now() where id = p_solicitud;
  end if;
  return 'ok';
end $$;

create function kaze.aprobacion_retirar(p_solicitud uuid) returns text
  language plpgsql security invoker set search_path = kaze, pg_temp
as $$
declare v_estado text;
begin
  select estado into v_estado from kaze.aprobacion_solicitudes where id = p_solicitud for update;
  if v_estado is null then return 'no_existe'; end if;
  if v_estado <> 'revision' then return 'no_abierta'; end if;
  update kaze.aprobacion_solicitudes set estado = 'retirada', cerrada_at = now() where id = p_solicitud;
  return 'ok';
end $$;

-- p_documento: solo para crear el To-Be (el servidor lo arma con crearTobe sobre el documento guardado).
create function kaze.crear_version_siguiente(p_proceso uuid, p_version text, p_rev integer, p_documento jsonb)
returns jsonb
  language plpgsql security invoker set search_path = kaze, pg_temp
as $$
declare v_rev int; v_asis int; v_tobe int;
begin
  select rev, numero_asis, numero_tobe into v_rev, v_asis, v_tobe from kaze.procesos where id = p_proceso for update;
  if v_rev is null then return jsonb_build_object('error', 'no_existe'); end if;
  if v_rev <> p_rev then return jsonb_build_object('error', 'rev', 'rev', v_rev); end if;
  if p_version = 'tobe' and v_tobe is null then
    if p_documento is null or p_documento->'versiones'->'tobe' is null or jsonb_typeof(p_documento->'versiones'->'tobe') <> 'object' then
      return jsonb_build_object('error', 'documento');
    end if;
    update kaze.procesos set numero_tobe = 1, documento = p_documento, rev = rev + 1 where id = p_proceso returning rev into v_rev;
    return jsonb_build_object('numero', 1, 'rev', v_rev);
  end if;
  if p_version not in ('asis', 'tobe') then return jsonb_build_object('error', 'invalido'); end if;
  update kaze.aprobacion_solicitudes set estado = 'retirada', cerrada_at = now()
    where proceso_id = p_proceso and version = p_version and estado = 'revision';
  if p_version = 'asis' then
    update kaze.procesos set numero_asis = numero_asis + 1, rev = rev + 1 where id = p_proceso returning rev, numero_asis into v_rev, v_asis;
    return jsonb_build_object('numero', v_asis, 'rev', v_rev);
  end if;
  update kaze.procesos set numero_tobe = numero_tobe + 1, rev = rev + 1 where id = p_proceso returning rev, numero_tobe into v_rev, v_tobe;
  return jsonb_build_object('numero', v_tobe, 'rev', v_rev);
end $$;

revoke execute on function
  kaze.aprobacion_enviar(uuid, text, integer, boolean, text, jsonb, text, text, text, uuid, jsonb),
  kaze.aprobacion_identificar(text, text, text),
  kaze.aprobacion_registrar(uuid, uuid, text, text, text, uuid, timestamptz),
  kaze.aprobacion_retirar(uuid),
  kaze.crear_version_siguiente(uuid, text, integer, jsonb)
  from public, anon, authenticated;
grant execute on function
  kaze.aprobacion_enviar(uuid, text, integer, boolean, text, jsonb, text, text, text, uuid, jsonb),
  kaze.aprobacion_identificar(text, text, text),
  kaze.aprobacion_registrar(uuid, uuid, text, text, text, uuid, timestamptz),
  kaze.aprobacion_retirar(uuid),
  kaze.crear_version_siguiente(uuid, text, integer, jsonb)
  to service_role;
```
  Nota sobre `crear_version_siguiente` desde `aprobado`: la solicitud aprobada queda como historial; la
  versión nueva empieza en `borrador` porque no hay solicitudes de ese número (§6.2).

- [ ] **Step 2:** `npm run db:reset && npm run seed && npm run db:types && npx tsc --noEmit`.
- [ ] **Step 3: Tests** — `tests/data/aprobaciones-sql.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { adminDb, sesionDe, crearProcesoPrueba, limpiarProcesos, type DB } from './_captura'
import { hashCodigo, hashIp, nuevoToken } from '@/lib/aprobar/hash'

const db = adminDb()
const P = (etapa: string, orden: number, num: number, codigo: string) =>
  ({ etapa, orden, contacto_num: num, nombre: 'N' + num, cargo: 'C', area: 'A', correo: `n${num}@ejemplo.co`, codigo, codigo_hash: hashCodigo(codigo) })
const PERSONAS = [P('vobo', 1, 1, 'CBM-01-P3GM'), P('vobo', 2, 4, 'CBM-04-C8WQ'), P('final', 1, 3, 'CBM-03-R4TN'), P('final', 2, 5, 'CBM-05-L5HZ')]

async function enviar(procesoId: string, rev: number, personas = PERSONAS, conVobo = true) {
  const token = nuevoToken()
  const { data, error } = await db.rpc('aprobacion_enviar', { p_proceso: procesoId, p_version: 'asis', p_rev: rev, p_con_vobo: conVobo,
    p_token: token, p_fotografia: {}, p_svg: null, p_remitente_nombre: 'Carmen', p_remitente_correo: 'carmen@cota.test',
    p_enviada_por: null, p_personas: personas as never })
  if (error) throw error
  return { r: data as Record<string, unknown>, token }
}
const identificar = (token: string, codigo: string, ip = '1.1.1.1') =>
  db.rpc('aprobacion_identificar', { p_token: token, p_codigo_hash: hashCodigo(codigo), p_ip_hash: hashIp(ip, 'sal') }).then(r => r.data as Record<string, string>)
const registrar = (sol: string, per: string, decision: string, comentario: string | null = null) =>
  db.rpc('aprobacion_registrar', { p_solicitud: sol, p_persona: per, p_decision: decision, p_comentario: comentario, p_via: 'enlace', p_registrada_por: null, p_fecha: null }).then(r => r.data)
const personaPorCodigo = async (sol: string, codigo: string) =>
  (await db.from('aprobacion_personas').select('id').eq('solicitud_id', sol).eq('codigo_hash', hashCodigo(codigo)).single()).data!.id
const estado = async (sol: string) => (await db.from('aprobacion_solicitudes').select('estado').eq('id', sol).single()).data!.estado

afterAll(() => limpiarProcesos())

describe('aprobacion_enviar', () => {
  it('crea solicitud y personas, y sube el rev', async () => {
    const p = await crearProcesoPrueba()
    const { r } = await enviar(p.id, p.rev)
    expect(r).toMatchObject({ ronda: 1, numero: 1, rev: p.rev + 1 })
    const { count } = await db.from('aprobacion_personas').select('id', { count: 'exact', head: true }).eq('solicitud_id', r.solicitud as string)
    expect(count).toBe(4)
  })
  it('rechaza rev viejo, solicitud abierta y persona en dos etapas', async () => {
    const p = await crearProcesoPrueba()
    expect((await enviar(p.id, p.rev + 5)).r.error).toBe('rev')
    await enviar(p.id, p.rev)
    expect((await enviar(p.id, p.rev + 1)).r.error).toBe('abierta')
    const q = await crearProcesoPrueba()
    expect((await enviar(q.id, q.rev, [P('vobo', 1, 1, 'A-01-AAAA'), P('final', 1, 1, 'A-01-AAAA')])).r.error).toBe('repetidos')
    expect((await enviar(q.id, q.rev, [P('vobo', 1, 1, 'A-01-AAAA')])).r.error).toBe('sin_final')
  })
})

describe('aprobacion_identificar', () => {
  it('reconoce el código, rechaza uno ajeno y el de otra solicitud', async () => {
    const p = await crearProcesoPrueba(); const { r, token } = await enviar(p.id, p.rev)
    expect((await identificar(token, 'cbm-01-p3gm')).persona).toBeTruthy()
    expect((await identificar(token, 'CBM-09-ZZZZ')).error).toBe('codigo')
    const q = await crearProcesoPrueba(); const otro = await enviar(q.id, q.rev, [P('final', 1, 7, 'CBM-07-QQQQ')], false)
    expect((await identificar(token, 'CBM-07-QQQQ')).error).toBe('codigo')
    expect((await identificar(otro.token, 'CBM-07-QQQQ')).persona).toBeTruthy()
    expect(r.solicitud).toBeTruthy()
  })
  it('10 fallidos bloquean la IP; otra IP sigue; 50 bloquean la solicitud; la ventana se libera', async () => {
    const p = await crearProcesoPrueba(); const { r, token } = await enviar(p.id, p.rev)
    for (let i = 0; i < 10; i++) await identificar(token, 'MAL-00-0000', '9.9.9.9')
    expect((await identificar(token, 'CBM-01-P3GM', '9.9.9.9')).error).toBe('intentos')
    expect((await identificar(token, 'CBM-01-P3GM', '8.8.8.8')).persona).toBeTruthy()
    for (let i = 0; i < 40; i++) await identificar(token, 'MAL-00-0000', '7.7.7.' + i)
    expect((await identificar(token, 'CBM-01-P3GM', '6.6.6.6')).error).toBe('intentos')
    // Envejecer los intentos: la ventana deslizante se libera sola.
    await db.from('aprobacion_intentos').update({ created_at: new Date(Date.now() - 16 * 60_000).toISOString() }).eq('solicitud_id', r.solicitud as string)
    expect((await identificar(token, 'CBM-01-P3GM', '9.9.9.9')).persona).toBeTruthy()
  })
})

describe('aprobacion_registrar', () => {
  let sol: string, token: string
  beforeEach(async () => { const p = await crearProcesoPrueba(); const e = await enviar(p.id, p.rev); sol = e.r.solicitud as string; token = e.token })

  it('la final no responde antes de los vistos buenos; cambios sin comentario falla; no hay doble respuesta', async () => {
    const rosa = await personaPorCodigo(sol, 'CBM-03-R4TN'), marta = await personaPorCodigo(sol, 'CBM-01-P3GM')
    expect(await registrar(sol, rosa, 'aprobado')).toBe('etapa')
    expect(await registrar(sol, marta, 'cambios', '  ')).toBe('comentario')
    expect(await registrar(sol, marta, 'aprobado')).toBe('ok')
    expect(await registrar(sol, marta, 'aprobado')).toBe('ya_respondio')
  })
  it('dos respuestas finales en paralelo dejan la solicitud aprobada', async () => {
    for (const c of ['CBM-01-P3GM', 'CBM-04-C8WQ']) expect(await registrar(sol, await personaPorCodigo(sol, c), 'aprobado')).toBe('ok')
    const [rosa, laura] = [await personaPorCodigo(sol, 'CBM-03-R4TN'), await personaPorCodigo(sol, 'CBM-05-L5HZ')]
    const r = await Promise.all([registrar(sol, rosa, 'aprobado'), registrar(sol, laura, 'aprobado')])
    expect(r).toEqual(['ok', 'ok'])
    expect(await estado(sol)).toBe('aprobada')
  })
  it('pedir cambios cierra la ronda y el enlace viejo deja de servir tras reenviar', async () => {
    const marta = await personaPorCodigo(sol, 'CBM-01-P3GM')
    expect(await registrar(sol, marta, 'cambios', 'Falta el paso de tesorería')).toBe('ok')
    expect(await estado(sol)).toBe('cambios')
    const proc = (await db.from('aprobacion_solicitudes').select('proceso_id').eq('id', sol).single()).data!.proceso_id
    const rev = (await db.from('procesos').select('rev').eq('id', proc).single()).data!.rev
    const nueva = await enviar(proc, rev)
    expect(nueva.r.ronda).toBe(2)
    expect((await identificar(token, 'CBM-01-P3GM')).error).toBe('cerrada')
  })
})

describe('crear_version_siguiente y retirar', () => {
  it('desde revisión retira la solicitud abierta y sube el número', async () => {
    const p = await crearProcesoPrueba(); const { r } = await enviar(p.id, p.rev)
    const { data } = await db.rpc('crear_version_siguiente', { p_proceso: p.id, p_version: 'asis', p_rev: r.rev as number, p_documento: null })
    expect(data).toMatchObject({ numero: 2 })
    expect(await estado(r.solicitud as string)).toBe('retirada')
  })
  it('retirar solo desde revision', async () => {
    const p = await crearProcesoPrueba(); const { r } = await enviar(p.id, p.rev)
    expect((await db.rpc('aprobacion_retirar', { p_solicitud: r.solicitud as string })).data).toBe('ok')
    expect((await db.rpc('aprobacion_retirar', { p_solicitud: r.solicitud as string })).data).toBe('no_abierta')
  })
})

describe('nadie más que service_role ejecuta las funciones', () => {
  let miembro: DB, ajeno: DB
  beforeAll(async () => { ({ db: miembro } = await sesionDe('carmen@cota.test')); ({ db: ajeno } = await sesionDe('ajeno@cota.test')) })
  it.each(['carmen', 'ajeno'])('%s recibe 42501', async quien => {
    const c = quien === 'carmen' ? miembro : ajeno
    const r = await c.rpc('aprobacion_retirar', { p_solicitud: '00000000-0000-4000-8000-000000000000' })
    expect(r.error?.code).toBe('42501')
    const r2 = await c.rpc('aprobacion_identificar', { p_token: 'x', p_codigo_hash: 'x', p_ip_hash: 'x' })
    expect(r2.error?.code).toBe('42501')
  })
})
```
- [ ] **Step 4:** Run → PASS. **Prueba a la inversa** del último bloque: quitar `authenticated` del
  `revoke`, reset, ver rojo, restaurar, reset, verde. Si algún tipo de `rpc` no compila porque
  `db:types` tipa `p_documento`/`p_svg` como no-nulos, pasar `null as never` en el test y en la capa de
  datos (no cambiar el SQL).
- [ ] **Step 5: Commit** `feat(db): funciones de aprobación y de versión, solo para service_role`

### Task 2.3: `requireMiembro()`

**Files:** Modify `lib/auth/guards.ts`

- [ ] **Step 1:** Agregar:
```ts
// Gate de las server actions de Captura: sesión + fila en kaze.profiles. auth.users se comparte con el
// CMS y el HUB, así que estar autenticado no basta. Devuelve el cliente de sesión para no crear dos.
export async function requireMiembro() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: perfil } = await supabase.from('profiles').select('id, nombre, iniciales, rol').eq('id', user.id).maybeSingle()
  if (!perfil) throw new Error('No eres miembro de Kaze')
  return { user, perfil, supabase }
}
```
- [ ] **Step 2:** `npx tsc --noEmit`. **Step 3: Commit** `feat(auth): requireMiembro para las acciones de captura`

### Task 2.4: `lib/data/procesos.ts`

**Files:** Create `lib/data/procesos.ts` · Test `tests/data/procesos.test.ts`

- [ ] **Step 1: Test que falla:**
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { adminDb, sesionDe, crearProcesoPrueba, limpiarProcesos, clienteAndrade, type DB } from './_captura'
import * as P from '@/lib/data/procesos'
import { randomUUID } from 'node:crypto'
import { hashCodigo, nuevoToken } from '@/lib/aprobar/hash'

let db: DB, userId: string
beforeAll(async () => { ({ db, userId } = await sesionDe('carmen@cota.test')) })
afterAll(() => limpiarProcesos())

describe('crear y listar', () => {
  it('crearProceso fija el prefijo y listarProcesos trae la fila con estados derivados', async () => {
    const id = await P.crearProceso(db, userId, { clientId: await clienteAndrade(db), projectId: null, nombre: 'TEST · Radicación de facturas' })
    const fila = (await P.listarProcesos(db)).find(f => f.id === id)!
    expect(fila).toMatchObject({ nombre: 'TEST · Radicación de facturas', prefijo: 'TRF', estadoAsis: 'borrador', numeroAsis: 1, numeroTobe: null })
    await P.eliminarProceso(db, id)
  })
})

describe('guardarProceso', () => {
  it('guarda con rev, reconoce el reintento propio y devuelve conflicto real', async () => {
    const p = await crearProcesoPrueba()
    const cargado = await P.obtenerProceso(db, p.id)
    const doc = { ...cargado!.documento, objetivo: 'Nuevo objetivo' }
    const g1 = randomUUID()
    expect(await P.guardarProceso(db, userId, { id: p.id, documento: doc, revEsperada: 0, guardadoId: g1 })).toEqual({ ok: true, rev: 1 })
    // reintento del mismo guardado (se perdió la respuesta)
    expect(await P.guardarProceso(db, userId, { id: p.id, documento: doc, revEsperada: 0, guardadoId: g1 })).toEqual({ ok: true, rev: 1 })
    // otra pestaña con rev viejo
    const r = await P.guardarProceso(db, userId, { id: p.id, documento: { ...doc, objetivo: 'otro' }, revEsperada: 0, guardadoId: randomUUID() })
    expect(r).toMatchObject({ ok: false, motivo: 'conflicto', rev: 1 })
    if (!r.ok && r.motivo === 'conflicto') expect(r.documento.objetivo).toBe('Nuevo objetivo')
  })
  it('rechaza cambios a una versión en revisión, pero deja editar el resumen', async () => {
    const p = await crearProcesoPrueba()
    await adminDb().rpc('aprobacion_enviar', { p_proceso: p.id, p_version: 'asis', p_rev: 0, p_con_vobo: false, p_token: nuevoToken(),
      p_fotografia: {}, p_svg: null as never, p_remitente_nombre: 'C', p_remitente_correo: 'c@c.co', p_enviada_por: null as never,
      p_personas: [{ etapa: 'final', orden: 1, contacto_num: 3, nombre: 'R', cargo: '', area: '', correo: '', codigo: 'X', codigo_hash: hashCodigo('X') }] as never })
    const c = (await P.obtenerProceso(db, p.id))!
    expect(c.estados.asis).toBe('revision')
    const tocaVersion = structuredClone(c.documento); tocaVersion.versiones.asis.sinFase = []
    expect(await P.guardarProceso(db, userId, { id: p.id, documento: tocaVersion, revEsperada: c.rev, guardadoId: randomUUID() })).toEqual({ ok: false, motivo: 'bloqueada', version: 'asis' })
    const tocaResumen = { ...c.documento, alcance: 'Otro alcance' }
    expect((await P.guardarProceso(db, userId, { id: p.id, documento: tocaResumen, revEsperada: c.rev, guardadoId: randomUUID() })).ok).toBe(true)
  })
  it('rechaza un documento cuya estructura de versiones no coincide con las columnas', async () => {
    const p = await crearProcesoPrueba(); const c = (await P.obtenerProceso(db, p.id))!
    const conTobe = { ...c.documento, versiones: { ...c.documento.versiones, tobe: c.documento.versiones.asis } }
    expect(await P.guardarProceso(db, userId, { id: p.id, documento: conTobe, revEsperada: c.rev, guardadoId: randomUUID() })).toEqual({ ok: false, motivo: 'estructura' })
  })
})

describe('vínculos y prefijo', () => {
  it('cambiarVinculos exige que el A3 sea del cliente', async () => {
    const p = await crearProcesoPrueba()
    const { data: a3 } = await db.from('projects').select('id, client_id').eq('code', 'A3-014').single()
    await P.cambiarVinculos(db, p.id, { clientId: a3!.client_id!, projectId: a3!.id })
    const { data: otro } = await db.from('projects').select('id, client_id').neq('client_id', a3!.client_id!).limit(1).single()
    await expect(P.cambiarVinculos(db, p.id, { clientId: a3!.client_id!, projectId: otro!.id })).rejects.toThrow(/cliente/)
  })
  it('cambiarPrefijo valida formato y se niega si ya hubo un envío', async () => {
    const p = await crearProcesoPrueba()
    await expect(P.cambiarPrefijo(db, p.id, 'c-b')).rejects.toThrow()
    await P.cambiarPrefijo(db, p.id, 'cbx')
    expect((await P.obtenerProceso(db, p.id))!.prefijo).toBe('CBX')
    await adminDb().from('aprobacion_solicitudes').insert({ proceso_id: p.id, version: 'asis', numero: 1, ronda: 1, enlace_token: nuevoToken(), estado: 'retirada', con_vobo: false, fotografia: {}, remitente_nombre: 'C', remitente_correo: 'c@c.co' })
    await expect(P.cambiarPrefijo(db, p.id, 'ZZZ')).rejects.toThrow(/envío/)
  })
})
```
  (`TRF`: «TEST», «Radicación», «facturas»; «·» se descarta y «de» es palabra vacía.)
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implementar** `lib/data/procesos.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import type { EstadoVersion, ProcesoDoc, VersionId } from '@/lib/captura/tipos'
import { selectAllRows } from '@/lib/data/query'
import { nuevoDocumento, bloqueada } from '@/lib/captura/modelo'
import { prefijoProceso, estadoVersion, type EstadoSolicitud } from '@/lib/captura/aprobacion'
import { mismoJson } from '@/lib/captura/json'

type DB = SupabaseClient<Database>
type SolicitudMin = { proceso_id: string; version: VersionId; numero: number; ronda: number; estado: EstadoSolicitud }

async function solicitudesDe(db: DB, ids: string[] | null): Promise<SolicitudMin[]> {
  let q = db.from('aprobacion_solicitudes').select('proceso_id, version, numero, ronda, estado', { count: 'exact' })
  if (ids) q = q.in('proceso_id', ids)
  return (await selectAllRows('aprobacion_solicitudes', q.order('ronda', { ascending: false }).order('id'))) as SolicitudMin[]
}
function estados(sols: SolicitudMin[], id: string, asis: number, tobe: number | null) {
  const mias = sols.filter(s => s.proceso_id === id)
  return { asis: estadoVersion(mias, 'asis', asis), tobe: tobe === null ? null : estadoVersion(mias, 'tobe', tobe) }
}

export type ProcesoListaRow = { id: string; nombre: string; codigo: string | null; prefijo: string
  cliente: string | null; clientId: string; a3: string | null; projectId: string | null
  numeroAsis: number; numeroTobe: number | null; estadoAsis: EstadoVersion; estadoTobe: EstadoVersion | null; updatedAt: string }

export async function listarProcesos(db: DB): Promise<ProcesoListaRow[]> {
  // Solo columnas: nunca los documentos enteros (§12, techo de filas y peso).
  const filas = await selectAllRows('procesos', db.from('procesos')
    .select('id, nombre, codigo, prefijo, client_id, project_id, numero_asis, numero_tobe, updated_at, clients(nombre), projects(code)', { count: 'exact' })
    .order('updated_at', { ascending: false }).order('id'))
  const sols = await solicitudesDe(db, null)
  return filas.map(f => {
    const e = estados(sols, f.id, f.numero_asis, f.numero_tobe)
    return { id: f.id, nombre: f.nombre ?? '', codigo: f.codigo, prefijo: f.prefijo, cliente: f.clients?.nombre ?? null,
      clientId: f.client_id, a3: f.projects?.code ?? null, projectId: f.project_id, numeroAsis: f.numero_asis,
      numeroTobe: f.numero_tobe, estadoAsis: e.asis, estadoTobe: e.tobe, updatedAt: f.updated_at }
  })
}

export type ProcesoCargado = { id: string; clientId: string; projectId: string | null; prefijo: string; rev: number
  documento: ProcesoDoc; numeros: { asis: number; tobe: number | null }; estados: { asis: EstadoVersion; tobe: EstadoVersion | null }
  haySolicitudes: boolean; updatedAt: string }

export async function obtenerProceso(db: DB, id: string): Promise<ProcesoCargado | null> {
  const { data: f, error } = await db.from('procesos').select('id, client_id, project_id, prefijo, rev, documento, numero_asis, numero_tobe, updated_at').eq('id', id).maybeSingle()
  if (error) throw error
  if (!f) return null
  const sols = await solicitudesDe(db, [id])
  return { id: f.id, clientId: f.client_id, projectId: f.project_id, prefijo: f.prefijo, rev: f.rev,
    documento: f.documento as unknown as ProcesoDoc, numeros: { asis: f.numero_asis, tobe: f.numero_tobe },
    estados: estados(sols, id, f.numero_asis, f.numero_tobe), haySolicitudes: sols.length > 0, updatedAt: f.updated_at }
}

export async function crearProceso(db: DB, userId: string, a: { clientId: string; projectId: string | null; nombre: string }) {
  const nombre = a.nombre.trim()
  if (!nombre || nombre.length > 200) throw new Error('El nombre es obligatorio (máx. 200 caracteres)')
  if (a.projectId) await exigirA3DelCliente(db, a.clientId, a.projectId)
  const documento = nuevoDocumento(nombre)
  const { data, error } = await db.from('procesos').insert({ client_id: a.clientId, project_id: a.projectId, prefijo: prefijoProceso(nombre),
    documento: documento as never, created_by: userId, updated_by: userId }).select('id').single()
  if (error) throw error
  return data.id
}

export type ResultadoGuardado =
  | { ok: true; rev: number }
  | { ok: false; motivo: 'conflicto'; rev: number; documento: ProcesoDoc }
  | { ok: false; motivo: 'bloqueada'; version: VersionId }
  | { ok: false; motivo: 'estructura' }
  | { ok: false; motivo: 'no_existe' }

/** §5.3–5.4. El UPDATE condicional (rev = revEsperada) es la barrera de concurrencia; la comparación de
 *  versiones bloqueadas se hace contra la fila leída con ese mismo rev, así que si otro cambió el rev
 *  entre medias, el UPDATE no toca filas y se responde conflicto. */
export async function guardarProceso(db: DB, userId: string, a: { id: string; documento: ProcesoDoc; revEsperada: number; guardadoId: string }): Promise<ResultadoGuardado> {
  const leer = async () => {
    const { data, error } = await db.from('procesos').select('rev, documento, numero_asis, numero_tobe, ultimo_guardado').eq('id', a.id).maybeSingle()
    if (error) throw error
    return data
  }
  const actual = await leer()
  if (!actual) return { ok: false, motivo: 'no_existe' }
  if (actual.rev === a.revEsperada) {
    if ((actual.numero_tobe === null) !== (a.documento.versiones.tobe === null)) return { ok: false, motivo: 'estructura' }
    const e = estados(await solicitudesDe(db, [a.id]), a.id, actual.numero_asis, actual.numero_tobe)
    const guardado = actual.documento as unknown as ProcesoDoc
    for (const v of ['asis', 'tobe'] as const) {
      const est = e[v]
      if (est && bloqueada(est) && !mismoJson(a.documento.versiones[v], guardado.versiones[v])) return { ok: false, motivo: 'bloqueada', version: v }
    }
    const { data, error } = await db.from('procesos')
      .update({ documento: a.documento as never, rev: a.revEsperada + 1, ultimo_guardado: a.guardadoId, updated_by: userId })
      .eq('id', a.id).eq('rev', a.revEsperada).select('rev')
    if (error) throw error
    if (data.length === 1) return { ok: true, rev: data[0].rev }
  }
  const ahora = await leer()
  if (!ahora) return { ok: false, motivo: 'no_existe' }
  if (ahora.ultimo_guardado === a.guardadoId) return { ok: true, rev: ahora.rev }
  return { ok: false, motivo: 'conflicto', rev: ahora.rev, documento: ahora.documento as unknown as ProcesoDoc }
}

async function exigirA3DelCliente(db: DB, clientId: string, projectId: string) {
  const { data, error } = await db.from('projects').select('client_id').eq('id', projectId).maybeSingle()
  if (error) throw error
  if (!data || data.client_id !== clientId) throw new Error('El proyecto A3 no es de ese cliente')
}
export async function cambiarVinculos(db: DB, id: string, a: { clientId: string; projectId: string | null }) {
  if (a.projectId) await exigirA3DelCliente(db, a.clientId, a.projectId)
  const { error } = await db.from('procesos').update({ client_id: a.clientId, project_id: a.projectId }).eq('id', id)
  if (error) throw error
}
export async function cambiarPrefijo(db: DB, id: string, prefijo: string) {
  const p = prefijo.trim().toUpperCase()
  if (!/^[A-Z0-9]{2,4}$/.test(p)) throw new Error('El prefijo lleva de 2 a 4 letras o números')
  const { count, error: e1 } = await db.from('aprobacion_solicitudes').select('id', { count: 'exact', head: true }).eq('proceso_id', id)
  if (e1) throw e1
  if (count) throw new Error('El prefijo ya no se puede cambiar: los códigos salieron en un envío')
  const { error } = await db.from('procesos').update({ prefijo: p }).eq('id', id)
  if (error) throw error
}
export async function eliminarProceso(db: DB, id: string) {
  const { error } = await db.from('procesos').delete().eq('id', id)
  if (error) throw error
}
```
- [ ] **Step 4:** Run → PASS. **Step 5: Commit** `feat(data): procesos con guardado por rev y guardia de versión bloqueada`

### Task 2.5: `lib/data/aprobaciones.ts` (lado del miembro)

**Files:** Create `lib/data/aprobaciones.ts` · Test `tests/data/aprobaciones.test.ts`

Todas reciben **dos** clientes: `db` (sesión del miembro, para leer con RLS) y `admin` (servicio, para las
funciones). Las server actions de F7 los obtienen de `requireMiembro()` y `createAdminClient()`.

- [ ] **Step 1: Test que falla** (resumen de casos; escribirlos todos):
  1. `enviarARevision(db, admin, { procesoId, version: 'asis', rev, seleccion, svg, remitente })` con la
     semilla → `{ ok: true, rev: rev+1, solicitudId }`; relee el documento **guardado** (el test guarda
     primero un documento sin actividades con el cliente de servicio y comprueba que devuelve
     `{ ok: false, bloqueos: ['sin_actividades'] }` aunque el llamador crea lo contrario).
  2. Con un diagrama roto guardado (misma mutación de la Tarea 1.6) → `bloqueos` contiene
     `errores_diagrama`.
  3. El SVG con `<script>` se guarda saneado (`diagrama_svg` no contiene `<script`).
  4. `leerAprobaciones(db, procesoId)` devuelve solicitudes con personas, **sin** `codigo_hash` y
     ordenadas por ronda desc, id.
  5. `registrarManual(db, admin, { solicitudId, personaId, decision: 'aprobado', fecha: '2026-09-24', userId })`
     → `'ok'` y `via = 'manual'`, `registrada_por = userId`.
  6. `retirar(admin, solicitudId)` → estado `retirada`, y `obtenerProceso` da `estados.asis = 'borrador'`.
  7. `crearTobe(db, admin, { procesoId, rev })` → `numero_tobe = 1`, `documento.versiones.tobe` con
     `origenClave` en todas las actividades; un segundo intento con el rev viejo → `{ error: 'rev' }`.
  8. `crearVersionSiguiente(admin, { procesoId, version: 'asis', rev })` → número 2.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implementar.**
```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import type { ProcesoDoc, VersionId } from '@/lib/captura/tipos'
import { selectAllRows } from '@/lib/data/query'
import { obtenerProceso } from '@/lib/data/procesos'
import { reglasEnvio, personasDeSeleccion, type Seleccion, type Bloqueo } from '@/lib/captura/aprobacion'
import { generarBPMN } from '@/lib/captura/bpmn/generar'
import { revisarDiagrama } from '@/lib/captura/bpmn/validar'
import { conInfoDeVersiones, crearTobe as crearTobeModelo } from '@/lib/captura/modelo'
import { armarFotografia } from '@/lib/captura/fotografia'
import { sanearSvg } from '@/lib/captura/svg'
import { hashCodigo, nuevoToken } from '@/lib/aprobar/hash'

type DB = SupabaseClient<Database>

export async function enviarARevision(db: DB, admin: DB, a: { procesoId: string; version: VersionId; rev: number
  seleccion: Seleccion; svg: string | null; remitente: { id: string; nombre: string; correo: string } }) {
  const p = await obtenerProceso(db, a.procesoId)                 // relee lo GUARDADO (§6.1 paso 2)
  if (!p) return { ok: false as const, error: 'no_existe' }
  if (p.rev !== a.rev) return { ok: false as const, error: 'rev' }
  const numero = a.version === 'asis' ? p.numeros.asis : p.numeros.tobe
  const m = p.documento.versiones[a.version]
  if (!m || numero === null) return { ok: false as const, error: 'sin_version' }
  const vista = conInfoDeVersiones(p.documento, { asis: { numero: p.numeros.asis, estado: p.estados.asis },
    tobe: p.numeros.tobe === null ? null : { numero: p.numeros.tobe, estado: p.estados.tobe! } })
  const mv = vista.versiones[a.version]!
  const errores = revisarDiagrama(vista, mv, generarBPMN(vista, mv, {})).errores.length
  const { bloqueos } = reglasEnvio(p.documento, m, a.seleccion, errores)
  if (bloqueos.length) return { ok: false as const, bloqueos }
  const svg = a.svg ? sanearSvg(a.svg) : null
  const personas = personasDeSeleccion(p.documento, p.prefijo, a.seleccion).map(x => ({ ...x, codigo_hash: hashCodigo(x.codigo) }))
  const { data, error } = await admin.rpc('aprobacion_enviar', { p_proceso: a.procesoId, p_version: a.version, p_rev: a.rev,
    p_con_vobo: a.seleccion.conVobo, p_token: nuevoToken(), p_fotografia: armarFotografia(p.documento, a.version, numero) as never,
    p_svg: svg as never, p_remitente_nombre: a.remitente.nombre, p_remitente_correo: a.remitente.correo,
    p_enviada_por: a.remitente.id, p_personas: personas as never })
  if (error) throw error
  const r = data as { error?: string; solicitud?: string; rev?: number }
  if (r.error) return { ok: false as const, error: r.error }
  return { ok: true as const, solicitudId: r.solicitud!, rev: r.rev! }
}

export type PersonaVista = { id: string; etapa: 'vobo' | 'final'; orden: number; contacto_num: number; nombre: string
  cargo: string | null; area: string | null; correo: string | null; codigo: string; decision: 'pendiente' | 'aprobado' | 'cambios'
  comentario: string | null; respondida_at: string | null; via: 'enlace' | 'manual' | null }
export type SolicitudVista = { id: string; version: VersionId; numero: number; ronda: number; enlace_token: string
  estado: 'revision' | 'aprobada' | 'cambios' | 'retirada'; con_vobo: boolean; remitente_nombre: string
  enviada_at: string; cerrada_at: string | null; personas: PersonaVista[] }

export async function leerAprobaciones(db: DB, procesoId: string): Promise<SolicitudVista[]> {
  const sols = await selectAllRows('aprobacion_solicitudes', db.from('aprobacion_solicitudes')
    .select('id, version, numero, ronda, enlace_token, estado, con_vobo, remitente_nombre, enviada_at, cerrada_at', { count: 'exact' })
    .eq('proceso_id', procesoId).order('ronda', { ascending: false }).order('id'))
  if (!sols.length) return []
  const pers = await selectAllRows('aprobacion_personas', db.from('aprobacion_personas')
    .select('id, solicitud_id, etapa, orden, contacto_num, nombre, cargo, area, correo, codigo, decision, comentario, respondida_at, via', { count: 'exact' })
    .in('solicitud_id', sols.map(s => s.id)).order('etapa', { ascending: false }).order('orden').order('id'))
  return sols.map(s => ({ ...s, personas: pers.filter(x => x.solicitud_id === s.id) })) as unknown as SolicitudVista[]
}

export async function registrarManual(db: DB, admin: DB, a: { solicitudId: string; personaId: string
  decision: 'aprobado' | 'cambios'; comentario?: string | null; fecha: string; userId: string }) {
  const { data: per } = await db.from('aprobacion_personas').select('id').eq('id', a.personaId).eq('solicitud_id', a.solicitudId).maybeSingle()
  if (!per) return 'persona'                                        // el miembro solo registra lo que puede leer
  const { data, error } = await admin.rpc('aprobacion_registrar', { p_solicitud: a.solicitudId, p_persona: a.personaId,
    p_decision: a.decision, p_comentario: (a.comentario ?? null) as never, p_via: 'manual', p_registrada_por: a.userId,
    p_fecha: new Date(a.fecha.length === 10 ? a.fecha + 'T12:00:00-05:00' : a.fecha).toISOString() })
  if (error) throw error
  return data as string
}
export async function retirar(admin: DB, solicitudId: string) {
  const { data, error } = await admin.rpc('aprobacion_retirar', { p_solicitud: solicitudId })
  if (error) throw error
  return data as string
}
export async function crearVersionSiguiente(admin: DB, a: { procesoId: string; version: VersionId; rev: number }) {
  const { data, error } = await admin.rpc('crear_version_siguiente', { p_proceso: a.procesoId, p_version: a.version, p_rev: a.rev, p_documento: null as never })
  if (error) throw error
  return data as { error?: string; numero?: number; rev?: number }
}
export async function crearTobe(db: DB, admin: DB, a: { procesoId: string; rev: number }) {
  const p = await obtenerProceso(db, a.procesoId)
  if (!p) return { error: 'no_existe' }
  if (p.documento.versiones.tobe) return { error: 'ya_existe' }
  const documento: ProcesoDoc = { ...p.documento, versiones: { ...p.documento.versiones, tobe: crearTobeModelo(p.documento.versiones.asis) } }
  const { data, error } = await admin.rpc('crear_version_siguiente', { p_proceso: a.procesoId, p_version: 'tobe', p_rev: a.rev, p_documento: documento as never })
  if (error) throw error
  return { ...(data as { error?: string; numero?: number; rev?: number }), documento }
}
export type { Bloqueo }
```
  Nota del caso 4: `codigo` sí se devuelve (el analista lo necesita para el correo); `codigo_hash` no.
- [ ] **Step 4:** PASS. **Step 5: Commit** `feat(data): aprobación del lado del miembro`

### Task 2.6: `lib/data/aprobacion-publica.ts`

**Files:** Create `lib/data/aprobacion-publica.ts` · Test `tests/data/aprobacion-publica.test.ts`

- [ ] **Step 1: Test que falla** — casos:
  1. `leerSolicitudPublica(admin, 'no-es-token')` → `null` sin tocar la base (token con formato inválido).
  2. `leerSolicitudPublica(admin, token)` → `{ id, estado: 'revision', version: 'asis', numero: 1, conVobo: true }`
     y **nada más** (`Object.keys` exactas).
  3. `identificar(admin, { token, codigo: 'cbm-01-p3gm', ip: '1.1.1.1', sal })` → `{ ok: true, solicitud, persona }`;
     código de más de 40 caracteres → `{ ok: false, error: 'codigo' }` sin llamar a la base.
  4. `personaPublica(admin, solicitud, persona)` → `{ nombre: 'N1', cargo, etapa: 'vobo', decision: 'pendiente',
     comentario: null, respondidaAt: null, etapaAbierta: true }` — sin correo, código ni hash.
  5. `personaPublica` con una persona de **otra** solicitud → `null`.
  6. `responder(admin, { solicitud, persona, decision: 'cambios', comentario: '' })` → `'comentario'`;
     comentario de 4.001 caracteres → `'comentario_largo'` sin llamar a la base; decisión desconocida →
     `'invalido'`.
  7. `contenidoDeSolicitud(admin, solicitud)` → `{ fotografia, svgDataUrl }` con
     `svgDataUrl` que empieza por `data:image/svg+xml;base64,` (o `null` si no hay SVG).
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implementar:**
```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { TOKEN_RE, hashCodigo, hashIp } from '@/lib/aprobar/hash'
import { etapaAbierta } from '@/lib/captura/aprobacion'

type DB = SupabaseClient<Database>
const UUID = /^[0-9a-f-]{36}$/

export async function leerSolicitudPublica(admin: DB, token: string) {
  if (!TOKEN_RE.test(token)) return null
  const { data, error } = await admin.from('aprobacion_solicitudes').select('id, estado, version, numero, con_vobo').eq('enlace_token', token).maybeSingle()
  if (error) throw error
  return data && { id: data.id, estado: data.estado, version: data.version, numero: data.numero, conVobo: data.con_vobo }
}
export async function identificar(admin: DB, a: { token: string; codigo: string; ip: string; sal: string }) {
  if (!TOKEN_RE.test(a.token)) return { ok: false as const, error: 'enlace' }
  if (typeof a.codigo !== 'string' || !a.codigo.trim() || a.codigo.length > 40) return { ok: false as const, error: 'codigo' }
  const { data, error } = await admin.rpc('aprobacion_identificar', { p_token: a.token, p_codigo_hash: hashCodigo(a.codigo), p_ip_hash: hashIp(a.ip, a.sal) })
  if (error) throw error
  const r = data as { error?: string; estado?: string; solicitud?: string; persona?: string }
  if (r.error) return { ok: false as const, error: r.error, estado: r.estado }
  return { ok: true as const, solicitud: r.solicitud!, persona: r.persona! }
}
export async function personaPublica(admin: DB, solicitud: string, persona: string) {
  if (!UUID.test(solicitud) || !UUID.test(persona)) return null
  const { data, error } = await admin.from('aprobacion_personas').select('id, etapa, decision').eq('solicitud_id', solicitud)
  if (error) throw error
  const yo = data.find(p => p.id === persona)
  if (!yo) return null
  const { data: d, error: e2 } = await admin.from('aprobacion_personas').select('nombre, cargo, etapa, decision, comentario, respondida_at').eq('id', persona).single()
  if (e2) throw e2
  return { nombre: d.nombre, cargo: d.cargo, etapa: d.etapa as 'vobo' | 'final', decision: d.decision as 'pendiente' | 'aprobado' | 'cambios',
    comentario: d.comentario, respondidaAt: d.respondida_at, etapaAbierta: etapaAbierta(data as never, yo.etapa as 'vobo' | 'final') }
}
export async function responder(admin: DB, a: { solicitud: string; persona: string; decision: unknown; comentario: unknown }) {
  if (a.decision !== 'aprobado' && a.decision !== 'cambios') return 'invalido'
  const comentario = typeof a.comentario === 'string' ? a.comentario : ''
  if (comentario.length > 4000) return 'comentario_largo'
  if (a.decision === 'cambios' && !comentario.trim()) return 'comentario'
  const { data, error } = await admin.rpc('aprobacion_registrar', { p_solicitud: a.solicitud, p_persona: a.persona, p_decision: a.decision,
    p_comentario: (comentario || null) as never, p_via: 'enlace', p_registrada_por: null as never, p_fecha: null as never })
  if (error) throw error
  return data as string
}
export async function contenidoDeSolicitud(admin: DB, solicitud: string) {
  const { data, error } = await admin.from('aprobacion_solicitudes').select('fotografia, diagrama_svg, remitente_nombre, enviada_at').eq('id', solicitud).single()
  if (error) throw error
  return { fotografia: data.fotografia, remitente: data.remitente_nombre, enviadaAt: data.enviada_at,
    svgDataUrl: data.diagrama_svg ? 'data:image/svg+xml;base64,' + Buffer.from(data.diagrama_svg, 'utf8').toString('base64') : null }
}
```
- [ ] **Step 4:** PASS. **Step 5: Commit** `feat(data): acceso público a la aprobación, sin datos de contacto`

### Task 2.7: Cierre de F2

- [ ] **Step 1:** `npm test` (todo verde), `npx tsc --noEmit`, `npm run build`.
- [ ] **Step 2:** START-HERE: F2 ✅ con el conteo de tests. Commit `docs: F2 de captura cerrada`.

---

# F3 · Lista `/procesos`

### Task 3.1: Ítem de la sidebar

**Files:** Modify `app/(app)/_components/sidebar-nav.tsx`
- [ ] **Step 1:** En `ITEMS`, después de `Proyectos`: `{ label: 'Captura de procesos', href: '/procesos' },`.
- [ ] **Step 2: Commit** `feat(nav): ítem Captura de procesos`

### Task 3.2: Página de lista y «Nuevo proceso»

**Files:**
- Create: `app/(app)/procesos/page.tsx`, `app/(app)/procesos/nuevo-proceso.tsx`, `app/(app)/procesos/actions.ts`, `app/(app)/procesos/procesos-tabla.tsx`
- Test: `e2e/lista.spec.ts`

- [ ] **Step 1: Test e2e que falla** — `e2e/lista.spec.ts` (ESCENARIOS A1–A2):
```ts
import { test, expect } from '@playwright/test'

test('A1 · la lista y el ítem activo', async ({ page }) => {
  await page.goto('/procesos')
  await expect(page.getByRole('link', { name: 'Captura de procesos' })).toHaveClass(/font-semibold/)
  await expect(page.getByRole('heading', { name: 'Captura de procesos' })).toBeVisible()
})

test('A2 · nuevo proceso con cliente obligatorio y A3 filtrado', async ({ page }) => {
  await page.goto('/procesos')
  await page.getByRole('button', { name: 'Nuevo proceso' }).click()
  const dialogo = page.getByRole('dialog')
  await dialogo.getByLabel('Nombre del proceso').fill('E2E · Radicación de facturas')
  await expect(dialogo.getByRole('button', { name: 'Crear proceso' })).toBeDisabled()
  await dialogo.getByLabel('Cliente').selectOption({ label: 'Despacho Andrade & Vega' })
  await expect(dialogo.getByLabel('Proyecto A3 (opcional)').locator('option')).toContainText(['A3-014'])
  await dialogo.getByRole('button', { name: 'Crear proceso' }).click()
  await expect(page).toHaveURL(/\/procesos\/[0-9a-f-]{36}/)
  await page.goto('/procesos')
  await expect(page.getByRole('row', { name: /E2E · Radicación de facturas/ })).toContainText('Borrador')
})
```
  Los textos de etiquetas y botones se ajustan al copy de `app.jsx:226-284` (`Lista`) si difiere: manda
  el prototipo. (El e2e de A1 con el proceso del seed queda para la 8.1.)
- [ ] **Step 2:** `npm run e2e -- lista` → FAIL.
- [ ] **Step 3: Server actions** — `app/(app)/procesos/actions.ts`:
```ts
'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireMiembro } from '@/lib/auth/guards'
import { crearProceso, eliminarProceso } from '@/lib/data/procesos'

const UUID = /^[0-9a-f-]{36}$/
export async function crearProcesoAction(input: { clientId: string; projectId: string | null; nombre: string }) {
  const { user, supabase } = await requireMiembro()
  if (!UUID.test(input.clientId) || (input.projectId !== null && !UUID.test(input.projectId)) || typeof input.nombre !== 'string') throw new Error('Datos inválidos')
  const id = await crearProceso(supabase, user.id, input)
  revalidatePath('/procesos')
  redirect(`/procesos/${id}`)
}
export async function eliminarProcesoAction(id: string) {
  const { supabase } = await requireMiembro()
  if (!UUID.test(id)) throw new Error('Datos inválidos')
  await eliminarProceso(supabase, id)
  revalidatePath('/procesos')
  redirect('/procesos')
}
```
  (Las acciones del editor de F4–F7 se agregan a este mismo archivo.)
- [ ] **Step 4: Página** — `page.tsx` (server component, patrón de `app/(app)/proyectos/page.tsx`): lee
  `listarProcesos`, `getClients` y los proyectos (`code, titulo, client_id`) y pinta la cabecera
  «Captura de procesos» con el botón «Nuevo proceso» y `<ProcesosTabla>`. Columnas y copy del
  prototipo `app.jsx:226-284`: código, nombre (enlace a `/procesos/[id]`), cliente, A3, versión y estado
  (`EtiquetaVersion` + `EstadoProceso` llegan en F4: aquí texto plano «As-Is v1 · Borrador»), actualizado
  (`relativo` de `modelo.ts`). Estado vacío con el texto del prototipo.
- [ ] **Step 5:** `nuevo-proceso.tsx` ('use client'): diálogo (`<dialog>` o `role="dialog"` con foco
  atrapado y Esc) con «Nombre del proceso», «Cliente» (obligatorio), «Proyecto A3 (opcional)» (solo los
  del cliente elegido; se vacía al cambiar de cliente) y «Crear proceso» deshabilitado hasta tener nombre
  y cliente. Llama a `crearProcesoAction`.
- [ ] **Step 6:** `npm run e2e -- lista` → PASS en escritorio y móvil. Captura de pantalla a 400 px sin
  desborde (`expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)`
  al final de A1).
- [ ] **Step 7: Commit** `feat(procesos): lista y nuevo proceso` · START-HERE: F3 ✅.

---

# F4 · Editor

**Reglas de la fase.** Leer antes `app.jsx`, `ui.jsx`, `tabs.jsx`, `actividades.jsx`, `decisiones.jsx`
completos y abrir `reference/captura/prototipo/kaze-captura.html` para comparar. Cada tarea de interfaz
porta un archivo del prototipo a TSX **conservando** estructura, textos, clases (`kz-*` y las de
`app.css`) y teclado. Cambios permitidos en TODA la fase (ninguno más):
- `window.React`/`const { … } = Kz()` → imports de React 19 y de `@/components/kaze`.
- Funciones puras → imports de `@/lib/captura/*`.
- `bloqueada(m)` → `bloqueada(m.estado)`; `m.aprobacion`/`m.historial` → props con las solicitudes
  (`SolicitudVista[]`) que carga la página.
- `ModalNotasIA`, `ModalDecisionesIA` y todo lo que dependa de `ia`: fuera.
- `descargar(...)` → `bajar(nombre, blob)` de `_components/descargar.ts` (Blob + `<a download>`,
  = `bajarDirecto` de `util.js:38-70`).
- Fechas → `fechaCorta`/`relativo` de `modelo.ts` (ya en Bogotá).

### Task 4.1: Estilos del DS y del módulo

**Files:** Create `components/kaze/kaze.css`, `app/(app)/procesos/captura.css`

- [ ] **Step 1:** `kaze.css` = `reference/captura/sistema-de-diseno/bundle.css` con los tokens no-color
  renombrados con prefijo `kz-` (`--spacing-N` → `--kz-spacing-N`, `--radius-*` → `--kz-radius-*`,
  `--shadow-*` → `--kz-shadow-*`) y un bloque `:root { … }` al inicio con sus valores sacados de
  `sistema-de-diseno/tokens.json`. Los `--color-*` y `--font-*` se quedan como están (vienen de
  `globals.css`).
- [ ] **Step 2:** `captura.css` = `prototipo/src/app.css` con **todas** sus reglas anidadas bajo
  `.captura { … }` (CSS nesting nativo; Tailwind v4/Lightning CSS lo compila) y el mismo renombre de
  tokens. `--alto-cab` y `--kz-fase-ancho` se conservan.
- [ ] **Step 3: Verificar que no se escapan:**
```bash
cd /c/Users/pauld/dev/cota && grep -nE "var\(--(spacing|radius|shadow)-" components/kaze/kaze.css "app/(app)/procesos/captura.css"
```
Expected: sin salida.
- [ ] **Step 4: Commit** `feat(captura): hojas de estilo del sistema de diseño y del módulo`

### Task 4.2: Componentes simples del DS

**Files:** Create `components/kaze/{boton,campo-texto,estado,etiqueta-version,valor-campo,indicador-guardado,cabecera-pagina,boton-icono,panel-detalle,icono-bpmn,elemento-bpmn,tarjeta-decision,panel-aprobacion,index}.tsx`

- [ ] **Step 1:** Portar de `sistema-de-diseno/index.jsx` los componentes `Boton` (11), `CampoTexto`
  (19), `EstadoConfirmacion` (63), `EstadoProceso` (81), `EtiquetaVersion` (94), `ValorCampo` (104),
  `IndicadorGuardado` (125), `CabeceraPagina` (233), `BotonIcono` (255), `PanelDetalle` (317),
  `TarjetaDecision` (881), `PanelAprobacion` (964), `IconoBPMN`/`ElementoBPMN` (1076/1086), con las
  props de `sistema-de-diseno/componentes.d.ts.txt` como tipos. `index.tsx` los reexporta e importa
  `./kaze.css` una sola vez. No portar `Sidebar`, `SummaryStrip`, `Sparkline`, `TeamAvatars`,
  `A3Progress`, `EstadoChip`, `MarcaKaze` (la app ya tiene los suyos).
- [ ] **Step 2:** `npx tsc --noEmit` limpio. **Step 3: Commit** `feat(kaze): componentes del sistema de diseño`

### Task 4.3: Componentes complejos del DS

**Files:** Create `components/kaze/{selector-version,tabla-actividades,tarjeta-actividad,columna-fase,tablero-fases}.tsx`

- [ ] **Step 1:** Portar `SelectorVersion` (265-316), `TablaActividades` (379-430), `TarjetaActividad`
  (431-458), `ColumnaFase` (459-548), `TableroFases` (549-836) tal cual: arrastre con puntero, teclado
  (F2, Supr, Alt+flechas), pegado de varias líneas, `soloLectura`. Los `useRef` con tipos DOM concretos.
- [ ] **Step 2:** `npx tsc --noEmit`. **Step 3: Commit** `feat(kaze): tablero de fases, selector de versión y tabla`

### Task 4.4: Cola de guardado (lógica pura)

**Files:** Create `lib/captura/guardado.ts` · Test `tests/captura/guardado.test.ts`

- [ ] **Step 1: Test que falla:**
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ColaGuardado, type EstadoCola } from '@/lib/captura/guardado'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())
const tick = async (ms: number) => { await vi.advanceTimersByTimeAsync(ms) }

function armar(enviar: (d: string, rev: number, id: string) => Promise<unknown>) {
  const estados: EstadoCola[] = []; const conflictos: unknown[] = []
  let n = 0
  const c = new ColaGuardado<string>(0, { enviar: enviar as never, demora: 800, nuevoId: () => 'g' + ++n,
    alCambiarEstado: e => estados.push(e), alConflicto: (d, r) => conflictos.push([d, r]) })
  return { c, estados, conflictos }
}

describe('ColaGuardado', () => {
  it('espera la demora y agrupa cambios seguidos en un solo guardado', async () => {
    const enviar = vi.fn(async (_d: string, rev: number) => ({ ok: true, rev: rev + 1 }))
    const { c, estados } = armar(enviar)
    c.programar('a'); await tick(300); c.programar('b'); await tick(799)
    expect(enviar).not.toHaveBeenCalled()
    await tick(1)
    expect(enviar).toHaveBeenCalledTimes(1); expect(enviar).toHaveBeenCalledWith('b', 0, 'g1')
    expect(estados.at(-1)!.estado).toBe('guardado')
  })
  it('un solo guardado en vuelo: lo que llega mientras viaja sale después con el rev nuevo', async () => {
    let soltar!: () => void
    const enviar = vi.fn((_d: string, rev: number) => new Promise(r => { soltar = () => r({ ok: true, rev: rev + 1 }) }))
    const { c } = armar(enviar)
    c.programar('a'); await tick(800)
    c.programar('b'); await tick(800)
    expect(enviar).toHaveBeenCalledTimes(1)
    soltar(); await tick(0)
    expect(enviar).toHaveBeenCalledTimes(2); expect(enviar).toHaveBeenLastCalledWith('b', 1, 'g2')
  })
  it('sin conexión: cola con N cambios, reintenta con el MISMO id y espera creciente', async () => {
    let falla = 2
    const enviar = vi.fn(async (_d: string, rev: number) => { if (falla-- > 0) throw new TypeError('fetch failed'); return { ok: true, rev: rev + 1 } })
    const { c, estados } = armar(enviar)
    c.programar('a'); c.programar('b'); await tick(800)
    expect(estados.at(-1)).toMatchObject({ estado: 'cola', pendientes: 2 })
    await tick(1000); await tick(2000)
    expect(enviar.mock.calls.map(x => x[2])).toEqual(['g1', 'g1', 'g1'])
    expect(estados.at(-1)!.estado).toBe('guardado')
  })
  it('conflicto: descarta lo pendiente y entrega el documento del servidor', async () => {
    const enviar = vi.fn(async () => ({ ok: false, motivo: 'conflicto', rev: 9, documento: 'servidor' }))
    const { c, conflictos } = armar(enviar)
    c.programar('a'); await tick(800)
    expect(conflictos).toEqual([['servidor', 9]])
    expect(c.hayPendientes()).toBe(false)
  })
  it('bloqueada o estructura: estado de error con el motivo', async () => {
    const { c, estados } = armar(vi.fn(async () => ({ ok: false, motivo: 'bloqueada', version: 'asis' })))
    c.programar('a'); await tick(800)
    expect(estados.at(-1)).toMatchObject({ estado: 'error', motivo: 'bloqueada' })
  })
  it('ahoraMismo no espera la demora y devuelve cuando terminó', async () => {
    const enviar = vi.fn(async (_d: string, rev: number) => ({ ok: true, rev: rev + 1 }))
    const { c } = armar(enviar)
    c.programar('a'); await c.ahoraMismo()
    expect(enviar).toHaveBeenCalledTimes(1); expect(c.rev).toBe(1)
  })
})
```
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implementar:**
```ts
export type ResultadoEnvio<D> =
  | { ok: true; rev: number }
  | { ok: false; motivo: 'conflicto'; rev: number; documento: D }
  | { ok: false; motivo: string; [k: string]: unknown }
export type EstadoCola = { estado: 'guardado' | 'guardando' | 'cola' | 'error'; en: string | null; pendientes: number; motivo?: string }
export interface OpcionesCola<D> {
  enviar(doc: D, rev: number, guardadoId: string): Promise<ResultadoEnvio<D>>
  alCambiarEstado(e: EstadoCola): void
  alConflicto(doc: D, rev: number): void
  demora?: number
  nuevoId?: () => string
  ahora?: () => string
}

/** §5.2: un solo guardado en vuelo; lo que llega mientras tanto sale después, con el rev nuevo.
 *  Un reintento por red usa el MISMO guardadoId, así el servidor lo reconoce como propio (§5.3). */
export class ColaGuardado<D> {
  rev: number
  private pendiente: D | null = null
  private cambios = 0
  private enVuelo: Promise<void> | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private ultimo: string | null = null
  constructor(rev: number, private op: OpcionesCola<D>) { this.rev = rev }
  private emitir(e: Omit<EstadoCola, 'en'> & { en?: string | null }) { this.op.alCambiarEstado({ en: this.ultimo, ...e }) }
  hayPendientes() { return this.pendiente !== null || this.enVuelo !== null }
  fijarRev(rev: number) { this.rev = rev }
  programar(doc: D) {
    this.pendiente = doc; this.cambios++
    if (this.timer) clearTimeout(this.timer)
    this.emitir({ estado: 'guardando', pendientes: 0 })
    this.timer = setTimeout(() => { this.timer = null; void this.disparar() }, this.op.demora ?? 800)
  }
  async ahoraMismo() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
    await this.disparar()
    while (this.enVuelo) await this.enVuelo
  }
  private disparar(): Promise<void> {
    if (this.enVuelo || this.pendiente === null) return this.enVuelo ?? Promise.resolve()
    const doc = this.pendiente; this.pendiente = null
    const id = (this.op.nuevoId ?? (() => crypto.randomUUID()))()
    this.enVuelo = this.intentar(doc, id, 0).finally(() => {
      this.enVuelo = null
      if (this.pendiente !== null && !this.timer) void this.disparar()
    })
    return this.enVuelo
  }
  private async intentar(doc: D, id: string, intento: number): Promise<void> {
    let r: ResultadoEnvio<D>
    try { r = await this.op.enviar(doc, this.rev, id) }
    catch {
      this.emitir({ estado: 'cola', pendientes: this.cambios })
      await new Promise(res => setTimeout(res, Math.min(30_000, 1000 * 2 ** intento)))
      return this.intentar(this.pendiente ?? doc, id, intento + 1)
    }
    if (r.ok) {
      this.rev = r.rev
      if (this.pendiente === null) { this.cambios = 0; this.ultimo = (this.op.ahora ?? (() => new Date().toISOString()))(); this.emitir({ estado: 'guardado', pendientes: 0 }) }
      return
    }
    if (r.motivo === 'conflicto') {
      this.pendiente = null; this.cambios = 0; this.rev = r.rev
      this.op.alConflicto((r as { documento: D }).documento, r.rev)
      this.emitir({ estado: 'guardado', pendientes: 0 })
      return
    }
    this.emitir({ estado: 'error', pendientes: this.cambios, motivo: r.motivo })
  }
}
```
  Ojo con el reintento: si mientras falla la red llegan cambios nuevos, el reintento manda la copia más
  reciente con el mismo `guardadoId` y el mismo `rev` — correcto, porque el intento anterior no entró
  (si hubiera entrado, el servidor respondería `ok` por `ultimo_guardado` y los cambios nuevos
  saldrían en el siguiente guardado). Si el test del caso de red no pasa con esta semántica, ajustar la
  implementación, no el test.
- [ ] **Step 4:** PASS. **Step 5: Commit** `feat(captura): cola de guardado con un envío en vuelo`

### Task 4.5: `ui.tsx` y descarga

**Files:** Create `app/(app)/procesos/[id]/_components/ui.tsx`, `.../_components/descargar.ts`
- [ ] **Step 1:** Portar `ui.jsx` completo (`cx`, `Entrada`, `Campo` con borrador local — Enter guarda,
  Esc deshace —, `Modal`, `Pestanas`, `Aviso`, `Pensando`, `Confirmar`) sin `Kz`.
- [ ] **Step 2:** `descargar.ts` ('use client'): `export function bajar(nombre: string, datos: Blob)` =
  `bajarDirecto` de `util.js:38-70` sin la lista de extensiones del artifact; y
  `copiarTexto` de `util.js` (portado).
- [ ] **Step 3:** `npx tsc --noEmit`. **Step 4: Commit** `feat(captura): primitivas de interfaz del editor`

### Task 4.6: Carga, raíz del editor, guardado, deshacer, cabecera y pestañas

**Files:**
- Create: `app/(app)/procesos/[id]/page.tsx`, `app/(app)/procesos/[id]/editor.tsx`, `.../_components/cabecera.tsx`, `.../_components/historial.tsx`
- Modify: `app/(app)/procesos/actions.ts`
- Test: `e2e/editor-cabecera.spec.ts`, `e2e/_datos.ts`

- [ ] **Step 1: Datos de e2e** — `e2e/_datos.ts`: igual que `tests/data/_captura.ts` pero exportando
  `crearProcesoE2E(nombre)` (inserta la semilla con el cliente de servicio y devuelve el id) y
  `borrarProcesoE2E(id)`. Cada spec de F4–F7 crea el suyo en `beforeAll` y lo borra en `afterAll`.
- [ ] **Step 2: Test e2e que falla** — `e2e/editor-cabecera.spec.ts` (ESCENARIOS B1–B6 y N1–N2, N5):
```ts
import { test, expect } from '@playwright/test'
import { crearProcesoE2E, borrarProcesoE2E } from './_datos'

let id: string
test.beforeAll(async () => { id = await crearProcesoE2E('E2E · Cabecera') })
test.afterAll(async () => { await borrarProcesoE2E(id) })

test('B1–B3 · migas, estado arriba a la derecha y CTA naranja', async ({ page }, info) => {
  test.skip(info.project.name !== 'escritorio')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/procesos/${id}`)
  const estado = page.getByText('ESTADO', { exact: false }).first()
  const caja = (await estado.boundingBox())!
  expect(caja.x + caja.width).toBeGreaterThan(1300); expect(caja.y).toBeLessThan(60)
  const cta = page.getByRole('button', { name: 'Exportar documento' })
  await expect(cta).toHaveCSS('background-color', 'rgb(217, 58, 0)')
  await expect(cta).toHaveCSS('color', 'rgb(255, 255, 255)')
})

test('B2 · íconos con nombre accesible y palabra al pasar el mouse', async ({ page }) => {
  await page.goto(`/procesos/${id}`)
  const deshacer = page.getByRole('button', { name: 'Deshacer (Ctrl+Z)' })
  await expect(deshacer).toBeVisible()
  await expect(page.getByRole('button', { name: 'Historial' })).toBeVisible()
})

test('B4 · selector de versión con teclado', async ({ page }) => {
  await page.goto(`/procesos/${id}`)
  const boton = page.getByRole('button', { name: /As-Is v1/ })
  await boton.click()
  await expect(page.getByRole('option', { name: /Actual · As-Is v1 · Borrador/ })).toBeVisible()
  await expect(page.getByRole('option', { name: '+ Crear To-Be desde el As-Is' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(boton).toBeFocused()
})

test('B5–B6, N1 · editar, guardar, deshacer, rehacer y persistir', async ({ page }) => {
  await page.goto(`/procesos/${id}`)
  const objetivo = page.getByLabel('Objetivo')
  await objetivo.fill('Objetivo E2E'); await objetivo.press('Tab')
  await expect(page.getByText('Guardado · ahora')).toBeVisible({ timeout: 5000 })
  await page.locator('body').press('Control+z')
  await expect(page.getByLabel('Objetivo')).not.toHaveValue('Objetivo E2E')
  await page.locator('body').press('Control+y')
  await expect(page.getByLabel('Objetivo')).toHaveValue('Objetivo E2E')
  await expect(page.getByText('Guardado · ahora')).toBeVisible({ timeout: 5000 })
  await page.reload()
  await expect(page.getByLabel('Objetivo')).toHaveValue('Objetivo E2E')
})

test('N2 · dos pestañas: la segunda recibe el conflicto', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: 'e2e/.auth/carmen.json' })
  const a = await ctx.newPage(), b = await ctx.newPage()
  await a.goto(`/procesos/${id}`); await b.goto(`/procesos/${id}`)
  await a.getByLabel('Alcance').fill('Desde A'); await a.getByLabel('Alcance').press('Tab')
  await expect(a.getByText('Guardado · ahora')).toBeVisible({ timeout: 5000 })
  await b.getByLabel('Alcance').fill('Desde B'); await b.getByLabel('Alcance').press('Tab')
  await expect(b.getByText('Alguien más actualizó este proceso: ves la versión más reciente.')).toBeVisible({ timeout: 5000 })
  await expect(b.getByLabel('Alcance')).toHaveValue('Desde A')
  await ctx.close()
})
```
  (Etiquetas exactas de campos y botones: las del prototipo; ajustar el test si el prototipo dice otra
  cosa.)
- [ ] **Step 3:** FAIL.
- [ ] **Step 4: Acciones del editor** (agregar a `actions.ts`):
```ts
import { guardarProceso, cambiarVinculos, cambiarPrefijo, obtenerProceso } from '@/lib/data/procesos'
import type { ProcesoDoc } from '@/lib/captura/tipos'

export async function guardarProcesoAction(id: string, documento: ProcesoDoc, revEsperada: number, guardadoId: string) {
  const { user, supabase } = await requireMiembro()
  if (!UUID.test(id) || !UUID.test(guardadoId) || !Number.isInteger(revEsperada) || !documento || typeof documento !== 'object' || !documento.versiones?.asis)
    return { ok: false as const, motivo: 'invalido' }
  return guardarProceso(supabase, user.id, { id, documento, revEsperada, guardadoId })
}
export async function recargarProcesoAction(id: string) {
  const { supabase } = await requireMiembro()
  if (!UUID.test(id)) throw new Error('Datos inválidos')
  return obtenerProceso(supabase, id)
}
export async function cambiarVinculosAction(id: string, clientId: string, projectId: string | null) {
  const { supabase } = await requireMiembro()
  if (![id, clientId].every(x => UUID.test(x)) || (projectId !== null && !UUID.test(projectId))) throw new Error('Datos inválidos')
  await cambiarVinculos(supabase, id, { clientId, projectId })
}
export async function cambiarPrefijoAction(id: string, prefijo: string) {
  const { supabase } = await requireMiembro()
  if (!UUID.test(id) || typeof prefijo !== 'string') throw new Error('Datos inválidos')
  await cambiarPrefijo(supabase, id, prefijo)
}
```
- [ ] **Step 5: `page.tsx`** (server component):
```tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { obtenerProceso } from '@/lib/data/procesos'
import { leerAprobaciones } from '@/lib/data/aprobaciones'
import { getClients } from '@/lib/data/clients'
import { selectAllRows } from '@/lib/data/query'
import { Editor } from './editor'
import '../captura.css'

export default async function ProcesoPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ v?: string; tab?: string; sub?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const supabase = await createClient()
  const p = await obtenerProceso(supabase, id)
  if (!p) notFound()
  const [solicitudes, clientes, proyectos, { data: { user } }] = await Promise.all([
    leerAprobaciones(supabase, id), getClients(supabase),
    selectAllRows('projects', supabase.from('projects').select('id, code, titulo, client_id', { count: 'exact' }).order('code').order('id')),
    supabase.auth.getUser(),
  ])
  const { data: perfil } = await supabase.from('profiles').select('nombre').eq('id', user!.id).single()
  return <Editor inicial={p} solicitudes={solicitudes} clientes={clientes} proyectos={proyectos}
    yo={{ id: user!.id, nombre: perfil?.nombre ?? user!.email ?? '', correo: user!.email ?? '' }}
    enlace={{ v: sp.v === 'tobe' ? 'tobe' : 'asis', tab: sp.tab ?? null, sub: sp.sub ?? null }} />
}
```
- [ ] **Step 6: `editor.tsx`** ('use client', raíz con `className="captura"`): portar `App` de
  `app.jsx:18-211` y `VistaProceso` de `app.jsx:285-371` con estos cambios:
  - Estado inicial: `local = conInfoDeVersiones(inicial.documento, { asis: {numero, estado}, tobe: … })`.
    Nada de `almacenLocal`, `onSnapshot`, `usar('sample'|'user')`, `limpiarArchivos`, `EJEMPLO`,
    `SESION`, `p.rev`/`p.sesion`/`p.actualizado` dentro del documento.
  - `programar(p)` → `cola.programar(sinInfoDeVersiones(p))`, con una `ColaGuardado` creada una vez
    (`useRef`) cuyo `enviar` es `guardarProcesoAction(id, doc, rev, guardadoId)`; `alCambiarEstado`
    alimenta `IndicadorGuardado` («Guardando…», «Guardado · hace N», «Sin conexión · N cambios en
    cola», error); `alConflicto(doc, rev)` reemplaza `local` (reinyectando números y estados), vacía
    `pila`/`rehacer` y muestra el aviso «Alguien más actualizó este proceso: ves la versión más
    reciente.». Motivo `bloqueada` → recargar con `recargarProcesoAction` y avisar con el copy del
    prototipo («Esta versión está en revisión: crea una versión nueva para editarla.» /
    «…aprobada…»).
  - `cambiar(etiqueta, fn, op)`: igual que `app.jsx:78-95`, pero la guardia usa `bloqueada(m0.estado)`;
    `op.forzar` ya no existe (lo que lo usaba es ahora una server action).
  - `visibilitychange`(hidden)/`pagehide` → `cola.ahoraMismo()`; `beforeunload` →
    `if (cola.hayPendientes()) { e.preventDefault(); e.returnValue = '' }`.
  - Atajos globales Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z como en el prototipo, excluyendo campos editables y
    `.lienzo`.
  - Pestañas, subvista y versión desde `enlace` y sincronizadas a la URL con
    `router.replace('?v=…&tab=…&sub=…', { scroll: false })`.
  - Cabecera (`_components/cabecera.tsx`): portar la de `VistaProceso` (migas «Captura de procesos ›
    <nombre>», `EstadoProceso` arriba a la derecha, `IndicadorGuardado`, `BotonIcono` Deshacer e
    Historial, `SelectorVersion` y el CTA «Exportar documento», que existe desde ya pero queda deshabilitado
    con `title="Disponible pronto"` hasta la 6.3).
  - `PanelHistorial` (`app.jsx:212-225`) → `historial.tsx`, con «Volver a este punto».
  - Las pestañas se montan con componentes vacíos (`<div>` con el título) que las tareas 4.7–4.11
    reemplazan.
- [ ] **Step 7:** `npm run e2e -- editor-cabecera` → PASS. `npx tsc --noEmit`.
- [ ] **Step 8: Commit** `feat(procesos): editor con autoguardado por rev, deshacer e historial`

### Task 4.7: Resumen, contactos y RACI, vínculos y prefijo

**Files:** Create `.../_components/tab-resumen.tsx` · Test `e2e/resumen.spec.ts`

- [ ] **Step 1: Test e2e que falla** (ESCENARIOS C1–C6):
  - C1: la tabla de contactos tiene las columnas Nombre, Cargo, Área, Correo, Papel, Código; escribir
    `malo` en un correo y salir del campo lo marca inválido (`aria-invalid="true"`).
  - C2: los 5 códigos cumplen `/^CBM-0\d-[A-Z2-9]{4}$/` y el de Marta es `CBM-01-P3GM` (la semilla de e2e
    usa `VERIF`).
  - C3: «+ Contacto» agrega una fila con código `CBM-06-…`.
  - C4: el prefijo se puede cambiar a `CBX` y los códigos pasan a `CBX-…`; (con un envío hecho queda
    fijo: se prueba en `e2e/aprobacion.spec.ts`, F7).
  - C5: cambiar el cliente vacía el A3; el selector de A3 solo lista los del cliente.
  - C6: «Preguntas para la próxima sesión» junta preguntas abiertas y datos «?»; agregar una pregunta
    la muestra en la lista.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Portar `TabResumen` de `tabs.jsx:23-176` (y `aplicarNombre` 177-195) con: la columna
  Código usa `codigoContacto(prefijo, c)`; «+ Contacto» usa `nuevoContacto(doc)` y hace
  `numSiguiente++` en el mismo `cambiar`; sección nueva **Vínculos** (cliente y A3 con
  `cambiarVinculosAction`, fuera de `cambiar`/deshacer: es columna, no documento) y **Prefijo del
  código** (input de 2–4 caracteres con `cambiarPrefijoAction`; deshabilitado con el texto «Fijo desde
  el primer envío: los códigos ya salieron por correo.» si `inicial.haySolicitudes`); sin los campos
  del remitente. La sección «Cambios pedidos en la aprobación» se agrega en la 7.6.
- [ ] **Step 4:** PASS. **Step 5: Commit** `feat(procesos): resumen con contactos, RACI, vínculos y prefijo`

### Task 4.8: Fases

**Files:** Create `.../_components/tab-fases.tsx` · Test `e2e/fases.spec.ts`
- [ ] **Step 1: Test (D1–D3):** «Criterios» en el tablero abre Fases con el foco en el objetivo de esa
  fase; «Agregar entregables de sus actividades» completa los entregables; volver a Actividades conserva
  la subvista.
- [ ] **Step 2:** FAIL. **Step 3:** Portar `TabFases` de `actividades.jsx:797-869`. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(procesos): pestaña de fases`

### Task 4.9: Actividades · 1 Listar y agrupar

**Files:** Create `.../_components/tab-actividades.tsx`, `.../_components/vista-listar.tsx`, `.../_components/modal-pegar.tsx` · Test `e2e/listar.spec.ts`
- [ ] **Step 1: Test (A3, E1–E9):** proceso vacío (crear uno nuevo desde la lista) con tres fases por
  Enter y seis actividades ACT-01…ACT-06; en la semilla: alta en Cuadre queda al final y renumera
  Cierre, el foco vuelve a «+ Agregar actividad»; pegar 3 líneas en «Sin fase» crea 3; F2 renombra;
  «+ Nueva fase» crea la fase 4 antes de «Sin fase»; arrastre de «Sin fase» a una fase le da número
  (`page.mouse` down/move/up); Supr elimina y Ctrl+Z recupera; Alt+← pasa «Revisar y aprobar» a Cuadre,
  la decisión queda en **Revisar** y la pestaña Actividades muestra «!»; clic en la tarjeta abre
  Caracterizar con esa actividad marcada.
- [ ] **Step 2:** FAIL. **Step 3:** Portar `TabActividades` (80-110) y `VistaListar` (111-158) de
  `actividades.jsx`, y `ModalPegar` de `tabs.jsx:412-447` sin `usarIA`. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(procesos): listar y agrupar actividades`

### Task 4.10: Actividades · 2 Caracterizar (ficha, eventos, decisiones, relato)

**Files:** Create `.../_components/{vista-caracterizar,ficha,eventos,decisiones,relato}.tsx` · Test `e2e/ficha.spec.ts`
- [ ] **Step 1: Test (A4, F1–F3, F5–F7):** Anterior/Siguiente con foco en «Siguiente» y avance que cambia;
  «?», «N/A» y 0 distintos; en «Investigar diferencias» se ve «Por cada partida sin cruce, uno tras
  otro» y la espera de la respuesta; «+ Límite de tiempo» con 3 días y destino ACT-05; la decisión al
  final de la ficha de su origen; «Así se lee en el procedimiento» con Descripción conservada, «Escribir
  mi propio texto» → «Tu texto para este paso», título marca «texto propio», «Volver al texto
  automático» lo borra; avisos «sin responsable» y «sin fase» navegan. En ACT-02 de un proceso nuevo se
  sugiere como entrada el entregable de ACT-01.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Portar `Fragmentos`/`Relato`/`VistaRelato` (24-75), `VistaCaracterizar` (159-216),
  `ListaFicha` (217-291), `Sugerencia` (292-299), `FichaActividad` (302-455), `SeccionEventos`/
  `EditorEvento` (559-686) de `actividades.jsx`, y `decisiones.jsx` completo. `SeccionFormatos`
  (456-558) se porta aquí **sin** subir ni descargar archivos (los botones quedan ocultos hasta la 6.2);
  el resto de la sección (nombre, código, versión, enlace) funciona.
- [ ] **Step 4:** PASS. **Step 5: Commit** `feat(procesos): ficha de la actividad con eventos, decisiones y relato`

### Task 4.11: Tabla

**Files:** Create `.../_components/vista-tabla.tsx` · Test `e2e/tabla.spec.ts`
- [ ] **Step 1: Test (G1–G2):** columna «Datos»; el número de una fila abre su ficha; en el To-Be
  (creado en el `beforeAll` con la acción de la 4.12) la columna «Cambio» marca nuevas y modificadas.
- [ ] **Step 2:** FAIL. **Step 3:** Portar `VistaTabla` (687-796). **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(procesos): tabla de actividades`

### Task 4.12: Versiones (To-Be, versión siguiente, solo lectura)

**Files:** Modify `editor.tsx`, `actions.ts` · Test `e2e/versiones.spec.ts`

- [ ] **Step 1: Acciones:**
```ts
import { createAdminClient } from '@/lib/supabase/admin'
import { crearTobe, crearVersionSiguiente } from '@/lib/data/aprobaciones'

export async function crearTobeAction(id: string, rev: number) {
  const { supabase } = await requireMiembro()
  if (!UUID.test(id) || !Number.isInteger(rev)) throw new Error('Datos inválidos')
  return crearTobe(supabase, createAdminClient(), { procesoId: id, rev })
}
export async function crearVersionSiguienteAction(id: string, version: 'asis' | 'tobe', rev: number) {
  await requireMiembro()
  if (!UUID.test(id) || (version !== 'asis' && version !== 'tobe') || !Number.isInteger(rev)) throw new Error('Datos inválidos')
  return crearVersionSiguiente(createAdminClient(), { procesoId: id, version, rev })
}
```
- [ ] **Step 2: Test (J1–J3):** con el As-Is en revisión (el `beforeAll` lo envía con
  `aprobacion_enviar` vía cliente de servicio) el tablero no tiene altas ni asas y la ficha no se edita;
  «Crear As-Is v2 para editar» abre v2 en borrador (y la solicitud abierta queda `retirada`, comprobado
  con el cliente de servicio); con el As-Is aprobado (otro proceso; aprobado con `aprobacion_registrar`)
  «+ Crear To-Be desde el As-Is» pide confirmación y el selector muestra «Propuesto · To-Be v1 ·
  Borrador».
- [ ] **Step 3:** FAIL.
- [ ] **Step 4: Implementar en el editor:** antes de llamar a cualquiera de las dos acciones,
  `await cola.ahoraMismo()` y pasar `cola.rev`; con la respuesta: si `error === 'rev'`, recargar
  (`recargarProcesoAction`) y avisar con el copy de conflicto; si ok, `recargarProcesoAction` → reemplazar
  `local` y `solicitudes`, `cola.fijarRev(rev)`, **vaciar `pila` y `rehacer`** (deshacer no puede cruzar
  un cambio de versión hecho en el servidor) y cambiar a la versión nueva. Copy de confirmación y avisos
  de `app.jsx:299-371`.
- [ ] **Step 5:** PASS. **Step 6: Commit** `feat(procesos): To-Be y versión siguiente desde el servidor`

### Task 4.13: Móvil (400 px) y cierre de F4

**Files:** `captura.css` (solo si hace falta) · Test `e2e/movil.spec.ts`
- [ ] **Step 1: Test (M1–M2, B4 a 400 px):** proyecto `movil`: en Listar el tablero se desplaza dentro de
  su caja y `document.documentElement.scrollWidth <= innerWidth`; en Caracterizar hay un `<select>` en
  lugar de la lista; migas reducidas a «‹ Captura de procesos»; estado arriba a la derecha; «Guardado»
  como punto; CTA en su propia línea; la lista del selector de versión cabe en pantalla.
- [ ] **Step 2:** Correr; corregir solo con reglas del prototipo que falten en `captura.css`.
- [ ] **Step 3:** `npm test`, `npx tsc --noEmit`, `npm run build`, `npm run e2e` (todo).
- [ ] **Step 4: Commit** `test(e2e): editor a 400 px` · START-HERE: F4 ✅.

---

# F5 · Diagrama

### Task 5.1: Lienzo bpmn.io

**Files:** Create `.../_components/lienzo.ts`, `.../_components/diagrama.tsx`, `types/bpmn-js.d.ts` (si hace falta)

- [ ] **Step 1:** Portar `lienzo.js` completo a `lienzo.ts` ('use client' no aplica: es un módulo que solo
  importa el componente cliente). `window.BpmnJS` → `const { default: Modeler } = await import('bpmn-js/lib/Modeler')`
  dentro de `crearModeler` (que pasa a `async`). `window.Kaze.ICONOS_BPMN` → `@/lib/captura/iconos`.
  `svgDelDiagrama`, `pngDeSvg`, `leerAjustes`, `traducir`, `moduloKaze`, `EDITABLES`, `ejecutorDe` tal
  cual.
- [ ] **Step 2:** `diagrama.tsx` ('use client') importa
  `bpmn-js/dist/assets/diagram-js.css`, `bpmn-js/dist/assets/bpmn-js.css`,
  `bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css` y monta el lienzo (contenedor con clase
  `lienzo`). La pestaña lo carga con `next/dynamic(() => import('./diagrama'), { ssr: false })` desde un
  componente cliente. El logo de bpmn.io se conserva.
- [ ] **Step 3:** `npm run build` (sin errores de SSR). **Step 4: Commit** `feat(procesos): lienzo bpmn.io`

### Task 5.2: Pestaña Diagrama y sincronización

**Files:** Create `lib/captura/bpmn/sincronizar.ts`, `.../_components/tab-diagrama.tsx` · Test `e2e/diagrama.spec.ts`

- [ ] **Step 1: Test e2e (H1–H9)** — uno por escenario de `ESCENARIOS.md` §H: más de 10 elementos y
  0 errores en la semilla; la paleta solo ofrece lo guardable y el menú tiene agregar, cambiar tipo,
  conectar, eliminar y «Ficha»; decisión nueva desde el lienzo tras «Cargar extracto» (queda
  seleccionada, errores en rojo, pestaña con aviso, exportaciones deshabilitadas; doble clic → pregunta;
  con pregunta, dos salidas y condición ya no hay errores; Ctrl+Z en el lienzo la quita); tarea soltada
  = actividad nueva de la fase; mover de carril cambia responsable y avisa; doble clic renombra y llega a
  la ficha; cambiar tipo cambia «quién la ejecuta» y el tipo de espera; «Restablecer diseño»; flujo roto
  (ACT-04 sin entrada) bloquea exportar y deshacer lo libera. Tomar selectores de
  `prototipo/pruebas/test-diagrama.cjs` y `test-sincronizar.cjs`, adaptados a Playwright Test.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Portar `sincronizar.js` a `lib/captura/bpmn/sincronizar.ts` (recibe el modeler; tipos
  mínimos locales para `elementRegistry`/`modeling`), y `TabDiagrama` + `RevisionDiagrama` de
  `tabs.jsx:196-411`.
- [ ] **Step 4:** PASS. **Step 5: Commit** `feat(procesos): diagrama editable sincronizado con la ficha`

### Task 5.3: Exportar .bpmn, SVG y XML

**Files:** Modify `tab-diagrama.tsx` · Test `e2e/diagrama.spec.ts` (ampliar)
- [ ] **Step 1: Test:** en la semilla, «Exportar .bpmn» dispara una descarga cuyo `suggestedFilename()`
  termina en `.bpmn` (no `.zip`) y cuyo contenido parsea con `bpmn-moddle`; «SVG» baja `.svg`; «Copiar
  XML» copia (leer `navigator.clipboard` con permiso `clipboard-read` en el contexto); con errores los
  tres están deshabilitados.
- [ ] **Step 2:** FAIL. **Step 3:** El `descargar(zip(...))` del prototipo pasa a `bajar(nombre + '.bpmn', new Blob([xml], { type: 'application/xml' }))`.
- [ ] **Step 4:** PASS. **Step 5: Commit** `feat(procesos): exportar .bpmn, SVG y XML` · START-HERE: F5 ✅.

---

# F6 · Documento y Storage

### Task 6.1: Bucket `kaze-captura`

**Files:** Create `supabase/migrations/20260924000003_kaze_captura_storage.sql`, `lib/data/procesos-archivos.ts` · Test `tests/data/procesos-archivos.test.ts`

- [ ] **Step 1: Migración:**
```sql
-- 20260924000003_kaze_captura_storage.sql — Adjuntos de formatos (§4.4). Proyecto compartido con el CMS
-- y el HUB: bucket y policies con prefijo kaze_captura.
insert into storage.buckets (id, name, public, file_size_limit)
values ('kaze-captura', 'kaze-captura', false, 26214400)
on conflict (id) do nothing;

create policy "kaze_captura_select" on storage.objects for select to authenticated
  using (bucket_id = 'kaze-captura' and kaze.es_miembro());
create policy "kaze_captura_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'kaze-captura' and kaze.es_miembro());
create policy "kaze_captura_update" on storage.objects for update to authenticated
  using (bucket_id = 'kaze-captura' and kaze.es_miembro()) with check (bucket_id = 'kaze-captura' and kaze.es_miembro());
create policy "kaze_captura_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'kaze-captura' and kaze.es_miembro());
```
  Si `db reset` falla con `must be owner of table objects`, **parar y avisar al usuario** (cambio de
  permisos de Storage en la versión local); no buscar otra vía.
- [ ] **Step 2: Test que falla:** con carmen, `urlSubida(db, procesoId, 'Formato conciliación.xlsx')`
  devuelve `{ path, signedUrl }` con `path` que cumple
  `/^procesos\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/Formato-conciliacion\.xlsx$/` (o lo que devuelva
  `nombreArchivo`, solo ASCII); un `fetch(signedUrl, { method: 'PUT', body })` responde 200;
  `urlDescarga(db, path, 'Formato conciliación.xlsx')` devuelve una URL que baja los mismos bytes y
  trae `content-disposition` con el nombre; con `ajeno`, `urlSubida` y `urlDescarga` fallan; un nombre
  de más de 200 caracteres o un `procesoId` inválido fallan sin llamar a Storage.
- [ ] **Step 3: Implementar:**
```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { nombreArchivo } from '@/lib/captura/zip'

const BUCKET = 'kaze-captura'
const UUID = /^[0-9a-f-]{36}$/
export const MAX_ARCHIVO = 25 * 1024 * 1024

export async function urlSubida(db: SupabaseClient, procesoId: string, nombre: string) {
  if (!UUID.test(procesoId) || !nombre || nombre.length > 200) throw new Error('Datos inválidos')
  const m = /\.([A-Za-z0-9]{1,10})$/.exec(nombre)
  const path = `procesos/${procesoId}/${randomUUID()}/${nombreArchivo(nombre.replace(/\.[^.]*$/, ''))}${m ? '.' + m[1].toLowerCase() : ''}`
  const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error) throw error
  return { path, signedUrl: data.signedUrl }
}
export async function urlDescarga(db: SupabaseClient, path: string, nombre: string) {
  if (!path.startsWith('procesos/') || path.includes('..')) throw new Error('Datos inválidos')
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, 300, { download: nombre })
  if (error) throw error
  return data.signedUrl
}
```
  (Si `createSignedUrl` con `download` no pone el nombre original con tildes en
  `content-disposition`, documentarlo en START-HERE y seguir: lo cubre el riesgo §12.)
- [ ] **Step 4:** `npm run db:reset && npm run seed`, PASS. **Step 5: Commit** `feat(storage): bucket privado de formatos con URLs firmadas`

### Task 6.2: Formatos con archivo

**Files:** Modify `.../_components/ficha.tsx` (sección formatos), `actions.ts` · Test `e2e/ficha.spec.ts` (F4)
- [ ] **Step 1:** Acciones `urlSubidaAction(procesoId, nombre, tamano)` (rechaza `tamano > MAX_ARCHIVO`
  con el copy del prototipo) y `urlDescargaAction(path, nombre)`, ambas con `requireMiembro` y el cliente
  de sesión.
- [ ] **Step 2: Test (F4):** «+ Adjuntar formato» sube `e2e/fixtures/formato.xlsx` (crear un archivo
  pequeño) con código FT-CON-03; «Descargar» baja un archivo con ese nombre.
- [ ] **Step 3:** FAIL. **Step 4:** En `SeccionFormatos`: `guardarArchivo` → `urlSubidaAction` + `fetch(signedUrl, { method: 'PUT', headers: { 'content-type': file.type || 'application/octet-stream' }, body: file })`
  y `archivo = { id: uid('ar'), path, nombre: file.name, tipo: file.type, tamano: file.size }` dentro de
  `cambiar`; `leerArchivo`/descargar → `urlDescargaAction` y abrir la URL. `archivosPersistentes` y la
  limpieza de huérfanos: fuera (tarea posterior, §4.4).
- [ ] **Step 5:** PASS. **Step 6: Commit** `feat(procesos): adjuntar y descargar formatos`

### Task 6.3: Word y .zip

**Files:** Create `lib/captura/documento.ts`, `.../_components/modal-documento.tsx` · Test `e2e/documento.spec.ts`
- [ ] **Step 1: Test (I1–I7):** al abrir el proceso no se pidió ningún chunk de `docx`
  (`page.on('request')` sin URLs que contengan `docx`… comprobar con el nombre real del chunk tras
  `npm run build`: en dev basta con que `window` no tenga el módulo antes de abrir el modal — usar
  `performance.getEntriesByType('resource')` y buscar `docx`); el modal muestra Carta/A4, «una hoja por
  fase», «Antes de exportar» y los botones «Descargar Word» y «Word con anexos (.zip)»; Word de la semilla
  baja `.docx` en < 5 s; el .zip en A4 contiene el `.docx` y la carpeta `Anexos/` (descomprimir con
  `node:zlib`/lectura del directorio central en el test); con errores en el diagrama no baja y «Ver en el
  diagrama» cierra el modal y muestra el diagrama; si el `import('docx')` falla (interceptar con
  `page.route('**/*docx*', r => r.abort())` en dev) aparece «No se pudo cargar el generador de Word.
  Revisa tu conexión…» con «Reintentar»; una versión aprobada (proceso aprobado en `beforeAll` con el
  cliente de servicio) trae en el Word la portada con aprobaciones, «Elaboró» y «8. Control de cambios»
  (leer `word/document.xml` del .docx); `grande.json` exporta sin errores.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Portar `documento.js` (menos `anexosDe`, que ya está en `anexos.ts`) a
  `lib/captura/documento.ts`: `cargarDocx()` → `import('docx')` con el mismo manejo de error;
  `leerArchivo` → `fetch(await urlDescargaAction(path, nombre))`; las aprobaciones de la portada, «Elaboró»
  y el control de cambios salen de las `SolicitudVista` aprobadas (`estado === 'aprobada'`), no de
  `m.historial`. `exportar.jsx` → `modal-documento.tsx`. Activar el CTA de la cabecera.
- [ ] **Step 4:** PASS. Comparar a ojo el `.docx` de la semilla con
  `reference/captura/ejemplos/procedimiento-carta.docx` (misma estructura de secciones).
- [ ] **Step 5: Commit** `feat(procesos): procedimiento en Word y .zip con anexos` · START-HERE: F6 ✅.

---

# F7 · Aprobación

### Task 7.1: Enviar a revisión

**Files:** Modify `actions.ts` · Create `.../_components/tab-aprobacion.tsx`

- [ ] **Step 1: Acción:**
```ts
import { enviarARevision, leerAprobaciones } from '@/lib/data/aprobaciones'
import type { Seleccion } from '@/lib/captura/aprobacion'

export async function enviarARevisionAction(id: string, version: 'asis' | 'tobe', rev: number, seleccion: Seleccion, svg: string | null) {
  const { user, perfil, supabase } = await requireMiembro()
  const ids = (x: unknown) => Array.isArray(x) && x.length <= 50 && x.every(v => typeof v === 'string' && v.length <= 64)
  if (!UUID.test(id) || (version !== 'asis' && version !== 'tobe') || !Number.isInteger(rev) || typeof seleccion?.conVobo !== 'boolean'
      || !ids(seleccion.vobo) || !ids(seleccion.final) || (svg !== null && typeof svg !== 'string')) throw new Error('Datos inválidos')
  return enviarARevision(supabase, createAdminClient(), { procesoId: id, version, rev, seleccion, svg,
    remitente: { id: user.id, nombre: perfil.nombre, correo: user.email ?? '' } })
}
export async function leerAprobacionesAction(id: string) {
  const { supabase } = await requireMiembro()
  if (!UUID.test(id)) throw new Error('Datos inválidos')
  return leerAprobaciones(supabase, id)
}
```
- [ ] **Step 2: Pestaña** — portar `TabAprobacion` (`aprobar.jsx:96-295`), `SelectorPersonas` (19-43) e
  `Historial` (296-303) con: sin «tus datos para las respuestas» (remitente = `yo`); `puedeEnviar` =
  `reglasEnvio(...).bloqueos.length === 0` con los mismos mensajes del prototipo por cada bloqueo;
  aviso de personas sin correo con el copy de §6.1 («Puedes enviar igual y registrar su respuesta a mano,
  o agregarlo en el Resumen»); «Enviar a revisión» → `await cola.ahoraMismo()`, SVG con
  `svgDelDiagrama` del modeler (si la pestaña Diagrama no está montada, montar un modeler oculto
  temporal — mismo mecanismo que usa el prototipo para el Word) y `enviarARevisionAction(id, v, cola.rev,
  sel, svg)`; con ok → `cola.fijarRev(rev)`, recargar proceso y solicitudes, vaciar `pila`/`rehacer`;
  con `bloqueos` → mostrarlos; con `error: 'rev'` → aviso de conflicto y recarga. Sin «Descargar la
  fotografía» ni «Registrar una respuesta» pegada (§6.7). La pestaña recarga solicitudes al volver a
  ella y con «Actualizar».
- [ ] **Step 3:** `npx tsc --noEmit`. **Step 4: Commit** `feat(procesos): enviar a revisión desde el servidor`

### Task 7.2: Correos

**Files:** Modify `tab-aprobacion.tsx` · Create `.../_components/menu-correo.tsx`
- [ ] **Step 1:** Portar `MenuCorreo` (`aprobar.jsx:44-73`): mi correo (mailto), Gmail, Outlook y «Copiar
  el correo», con `correoInvitacion({ …, persona: { nombre, correo, codigo } /* de aprobacion_personas */,
  enlace: KAZE_URL + '/aprobar/' + enlace_token, remitente: yo.nombre })`. `KAZE_URL` llega como prop
  desde `page.tsx`: `process.env.KAZE_URL ?? \`${proto}://${host}\`` con `headers()` (`x-forwarded-proto`,
  `host`). Sin el marcador «preparado».
- [ ] **Step 2:** «Avisar a los informados» con `correoInformados` (CCO) cuando la solicitud está
  `aprobada`.
- [ ] **Step 3: Commit** `feat(procesos): correos de aprobación con enlace y código`

### Task 7.3: Seguimiento, registro a mano, retiro, reenvío

**Files:** Modify `actions.ts`, `tab-aprobacion.tsx`
- [ ] **Step 1: Acciones:**
```ts
import { registrarManual, retirar } from '@/lib/data/aprobaciones'
export async function registrarManualAction(solicitudId: string, personaId: string, decision: 'aprobado' | 'cambios', comentario: string | null, fecha: string) {
  const { user, supabase } = await requireMiembro()
  if (!UUID.test(solicitudId) || !UUID.test(personaId) || (decision !== 'aprobado' && decision !== 'cambios')
      || (comentario !== null && (typeof comentario !== 'string' || comentario.length > 4000)) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error('Datos inválidos')
  return registrarManual(supabase, createAdminClient(), { solicitudId, personaId, decision, comentario, fecha, userId: user.id })
}
export async function retirarAction(solicitudId: string) {
  const { supabase } = await requireMiembro()
  if (!UUID.test(solicitudId)) throw new Error('Datos inválidos')
  const { data } = await supabase.from('aprobacion_solicitudes').select('id').eq('id', solicitudId).maybeSingle()
  if (!data) throw new Error('No existe')
  return retirar(createAdminClient(), solicitudId)
}
```
- [ ] **Step 2:** `RegistroManual` (`aprobar.jsx:74-95`) → `registrarManualAction`; la fila muestra
  «registrado a mano» si `via === 'manual'`. «Retirar de revisión» con `Confirmar` → `retirarAction`.
  Panel por etapas con `PanelAprobacion`, etapa 2 «En espera · Se abre cuando lleguen todos los vistos
  buenos». «Enviar de nuevo a revisión» prellena con `seleccionInicial(contactos, personas de la última
  solicitud)`. Mensajes de avance del prototipo (`registrar`, 128-142) tras cada registro.
- [ ] **Step 3: Commit** `feat(procesos): seguimiento, registro a mano y retiro`

### Task 7.4: «Cambios pedidos en la aprobación» (§6.9)

**Files:** Modify `tab-resumen.tsx`
- [ ] **Step 1:** Sección de solo lectura con los comentarios de la última solicitud en `cambios`: quién
  (nombre y cargo), cuándo (`fechaCorta`) y el texto. Botón «Copiar a preguntas» → un `cambiar` normal
  que agrega a `preguntas` `{ texto: nombre + ' (' + cargo + ') pide: ' + comentario, origen: 'aprobacion' }`
  (mismo formato que `registrarRespuesta` del prototipo).
- [ ] **Step 2: Commit** `feat(procesos): cambios pedidos visibles en el resumen`

### Task 7.5: Ruta pública: proxy, cabeceras y metadatos

**Files:** Modify `proxy.ts`, `lib/supabase/middleware.ts`, `next.config.ts`

- [ ] **Step 1:** Leer `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`
  (o el archivo equivalente que liste `ls node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/`).
- [ ] **Step 2:** `proxy.ts` matcher:
  `'/((?!_next/static|_next/image|favicon.ico|login|auth|aprobar|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'`.
- [ ] **Step 3:** `lib/supabase/middleware.ts`: la condición de redirección pasa a
  `if (!user && !path.startsWith('/login') && !path.startsWith('/auth') && !path.startsWith('/aprobar'))`.
  (Defensa doble: si alguien cambia el matcher, `/aprobar` sigue sin exigir sesión.) **No** tocar
  `cookie-options.ts`.
- [ ] **Step 4:** `next.config.ts`, agregar:
```ts
  async headers() {
    return [{
      source: '/aprobar/:path*',
      headers: [
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Cache-Control', value: 'no-store' },
      ],
    }]
  },
```
- [ ] **Step 5: Commit** `feat(aprobar): ruta pública sin sesión, con noindex y sin marcos`

### Task 7.6: Página `/aprobar/[token]` y sus acciones

**Files:** Create `app/aprobar/[token]/page.tsx`, `app/aprobar/[token]/actions.ts`, `app/aprobar/[token]/_components/{form-codigo,tu-respuesta,contenido}.tsx`

- [ ] **Step 1: Acciones** — `app/aprobar/[token]/actions.ts`:
```ts
'use server'
import 'server-only'
import { cookies, headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { identificar, leerSolicitudPublica, personaPublica, responder } from '@/lib/data/aprobacion-publica'
import { firmarAcceso, leerAcceso, DURACION_ACCESO_MS } from '@/lib/aprobar/firma'
import { TOKEN_RE } from '@/lib/aprobar/hash'

const COOKIE = 'kz_aprobar'
const secreto = () => {
  const s = process.env.KAZE_APROBAR_SECRETO
  if (!s || s.length < 32) throw new Error('Falta KAZE_APROBAR_SECRETO')
  return s
}
async function ipDe() {
  const h = await headers()
  return (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'desconocida'
}

export async function identificarAction(token: unknown, codigo: unknown) {
  if (typeof token !== 'string' || !TOKEN_RE.test(token) || typeof codigo !== 'string') return { ok: false as const, error: 'codigo' }
  const r = await identificar(createAdminClient(), { token, codigo, ip: await ipDe(), sal: secreto() })
  if (!r.ok) return r
  // Cookie de host (sin Domain: no viaja al apex ni a las otras apps), solo para este enlace.
  ;(await cookies()).set(COOKIE, firmarAcceso(secreto(), { solicitud: r.solicitud, persona: r.persona }), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
    path: `/aprobar/${token}`, maxAge: DURACION_ACCESO_MS / 1000,
  })
  return { ok: true as const }
}

export async function responderAction(token: unknown, decision: unknown, comentario: unknown) {
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) return { ok: false as const, error: 'enlace' }
  const admin = createAdminClient()
  const sol = await leerSolicitudPublica(admin, token)
  if (!sol) return { ok: false as const, error: 'enlace' }
  const acceso = leerAcceso(secreto(), (await cookies()).get(COOKIE)?.value)
  // La identidad sale SOLO de la cookie firmada, y debe ser de la solicitud de ESTE token.
  if (!acceso || acceso.solicitud !== sol.id) return { ok: false as const, error: 'sesion' }
  if (!(await personaPublica(admin, sol.id, acceso.persona))) return { ok: false as const, error: 'sesion' }
  const r = await responder(admin, { solicitud: sol.id, persona: acceso.persona, decision, comentario })
  return r === 'ok' ? { ok: true as const } : { ok: false as const, error: r }
}
```
- [ ] **Step 2: Página** — `app/aprobar/[token]/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { leerSolicitudPublica, personaPublica, contenidoDeSolicitud } from '@/lib/data/aprobacion-publica'
import { leerAcceso } from '@/lib/aprobar/firma'
import { contenidoPublico } from '@/lib/captura/fotografia'
import { FormCodigo } from './_components/form-codigo'
import { TuRespuesta } from './_components/tu-respuesta'
import { Contenido } from './_components/contenido'
import '../../(app)/procesos/captura.css'
import '@/components/kaze/kaze.css'

export const metadata: Metadata = { title: 'Kaze · Solicitud de aprobación', robots: { index: false, follow: false }, referrer: 'no-referrer' }

const MENSAJES = {
  enlace: 'Este enlace no es válido o fue retirado.',
  cambios: 'Esta ronda se cerró porque alguien pidió cambios. Te llegará un enlace nuevo.',
  aprobada: 'Este proceso ya quedó aprobado.',
} as const

export default async function AprobarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()
  const sol = await leerSolicitudPublica(admin, token)
  const marco = (hijos: React.ReactNode) => <main className="captura aprobar">{/* cabecera «Kaze · Solicitud de aprobación» */}{hijos}</main>
  if (!sol || sol.estado === 'retirada') return marco(<p role="status">{MENSAJES.enlace}</p>)
  if (sol.estado === 'cambios') return marco(<p role="status">{MENSAJES.cambios}</p>)
  if (sol.estado === 'aprobada') return marco(<p role="status">{MENSAJES.aprobada}</p>)

  const acceso = leerAcceso(process.env.KAZE_APROBAR_SECRETO!, (await cookies()).get('kz_aprobar')?.value)
  const persona = acceso && acceso.solicitud === sol.id ? await personaPublica(admin, sol.id, acceso.persona) : null
  if (!persona) return marco(<FormCodigo token={token} />)       // sin código válido no se lee nada

  const c = await contenidoDeSolicitud(admin, sol.id)
  return marco(<>
    <TuRespuesta token={token} persona={persona} version={sol.version} numero={sol.numero} />
    <Contenido datos={contenidoPublico(c.fotografia as never)} svgDataUrl={c.svgDataUrl} remitente={c.remitente} enviadaAt={c.enviadaAt} version={sol.version} numero={sol.numero} />
  </>)
}
```
  Nota: la página importa `createAdminClient` (`server-only`), así que nunca puede terminar en el
  navegador; lo que reciben los componentes cliente son solo props planas (persona pública y contenido
  ya calculado).
- [ ] **Step 3: Componentes cliente:**
  - `form-codigo.tsx`: campo «Tu código» + «Continuar» → `identificarAction(token, codigo)`; con ok →
    `router.refresh()`; errores: `codigo` → «Ese código no corresponde a esta solicitud.», `intentos` →
    «Demasiados intentos; vuelve a intentarlo en unos minutos.», `cerrada`/`enlace` → `router.refresh()`.
  - `tu-respuesta.tsx`: el panel de `fotografia.js` («Hola, Marta Ríos (Analista contable). Te piden tu
    visto bueno de As-Is v1.»), con los estados: ya respondiste (decisión, comentario y fecha en
    Bogotá), etapa no abierta («Tu etapa aún no está abierta: faltan vistos buenos.»), o los tres pasos
    (elegir «Estoy de acuerdo…» / «Pido cambios»; «¿Qué hay que cambiar?» obligatorio si pide cambios,
    máx. 4.000; confirmar; «Enviar mi respuesta» con `color-marca-cta`). Tras enviar muestra el resumen
    de lo enviado (estado local) y llama a `router.refresh()`. Arriba en móvil, fijo al costado en
    escritorio (clases de `fotografia.js`/`captura.css`).
  - `contenido.tsx` (puede ser server component): datos del proceso (código, versión, quién lo envía y
    cuándo), índice, «En pocas palabras» y alcance, SIPOC, diagrama como
    `<img src={svgDataUrl} alt="Diagrama del proceso">` con zoom (CSS `transform` + botones), paso a
    paso por fases y formatos — mismo orden y copy que `fotografia.js`. **Nunca**
    `dangerouslySetInnerHTML`.
- [ ] **Step 4:** `npm run build`. **Step 5: Commit** `feat(aprobar): página pública con código para leer y responder`

### Task 7.7: E2E de aprobación (K y L)

**Files:** Create `e2e/aprobacion.spec.ts`, `e2e/aprobar-publico.spec.ts`

- [ ] **Step 1: `e2e/aprobacion.spec.ts`** (K1–K8 + C4 fijo): preparar con las personas prellenadas
  (Marta y Carlos en visto bueno; Rosa y Laura en final); persona en dos etapas bloquea; sin correo avisa
  pero deja enviar; diagrama con errores bloquea; enviar → «En revisión» con dos etapas y la etapa 2
  «En espera · Se abre cuando lleguen todos los vistos buenos»; menú de correo de Marta: el `href` de
  Gmail contiene `su=Visto%20bueno%3A%20Conciliaci%C3%B3n%20bancaria%20mensual%20(As-Is%20v1)`, el
  enlace `/aprobar/` y `CBM-01-P3GM`; registrar a mano a Carlos → «registrado a mano»; el prefijo ya
  no se puede editar; retirar → «Borrador».
- [ ] **Step 2: `e2e/aprobar-publico.spec.ts`** — usa un **contexto sin sesión**
  (`test.use({ storageState: { cookies: [], origins: [] } })`), con la solicitud creada en `beforeAll`
  por el cliente de servicio (`aprobacion_enviar`, token conocido). Casos L1–L10:
  - L1: `/aprobar/<token>` responde 200 sin redirigir a `/login`; cabecera `x-robots-tag: noindex, nofollow`,
    `content-security-policy` con `frame-ancestors 'none'`, `referrer-policy: no-referrer`.
  - **Leer exige código:** antes del código, el HTML no contiene «En pocas palabras», «SIPOC» ni nombres
    de actividades.
  - L2: `CBM-09-ZZZZ` → «no corresponde»; `cbm-01-p3gm` → «Hola, Marta Ríos (Analista contable). Te
    piden tu visto bueno de As-Is v1.»
  - L3: tras el código se ven En pocas palabras, alcance, SIPOC, el `<img src^="data:image/svg+xml;base64,">`
    y el paso a paso.
  - L4: Marta aprueba → resumen de lo enviado; recargar → «ya respondiste»; en la pestaña del analista
    (otro contexto con sesión) Marta figura aprobada.
  - L5: en otro contexto sin sesión, el código de Rosa → «Tu etapa aún no está abierta».
  - L6: Carlos «Pido cambios» sin texto no envía; con texto cierra la ronda: recargar muestra
    «Esta ronda se cerró porque alguien pidió cambios…».
  - L7: 10 códigos malos seguidos → «Demasiados intentos…» (la IP en dev es `::1`/`127.0.0.1`: el test
    limpia `aprobacion_intentos` en `afterEach` con el cliente de servicio).
  - L8: un token inexistente (32 caracteres válidos) y el de una solicitud retirada → «Este enlace no es
    válido o fue retirado.» sin contenido.
  - L9: `await page.content()` y el payload RSC (`page.on('response')` de la navegación) no contienen
    `@ejemplo.co`, `CBM-0`, ni ningún `codigo_hash` de la solicitud (64 hex leídos con el cliente de
    servicio); la página dentro de un `<iframe>` de otra página local no se pinta (comprobar la cabecera,
    que es lo que manda en el navegador).
  - Cookie: tras identificarse, `context.cookies()` tiene `kz_aprobar` con `httpOnly: true`,
    `path: '/aprobar/<token>'` y sin `domain` de apex; modificar un carácter de su valor hace volver al
    formulario del código.
  - L10 (proyecto `movil`): «Tu respuesta» está por encima del contenido y no hay desborde horizontal.
- [ ] **Step 3:** `npm run e2e -- aprobacion aprobar-publico` → PASS en escritorio y móvil.
- [ ] **Step 4: Commit** `test(e2e): aprobación de punta a punta y seguridad de /aprobar`

### Task 7.8: Revisión de seguridad de F7

- [ ] **Step 1:** Despachar el subagente `ecc:security-reviewer` (primer plano) sobre
  `app/aprobar/`, `lib/aprobar/`, `lib/data/aprobacion-publica.ts`, `lib/data/aprobaciones.ts`,
  `app/(app)/procesos/actions.ts`, las tres migraciones y `proxy.ts`/`middleware.ts`, con §6.5 del spec y
  la sección 0 de este plan como criterio. Corregir lo confirmado con test primero.
- [ ] **Step 2:** Escaneo del bundle de cliente (`npm run build` y luego):
```bash
cd /c/Users/pauld/dev/cota && grep -rlE "SUPABASE_SERVICE_ROLE_KEY|KAZE_APROBAR_SECRETO|sb_secret_|createAdminClient" .next/static || echo "limpio"
```
Expected: `limpio`.
- [ ] **Step 3: Commit** (si hubo cambios) · START-HERE: F7 ✅.

---

# F8 · Cierre y despliegue

### Task 8.1: Seed local

**Files:** Modify `scripts/seed.ts` · Test `e2e/lista.spec.ts` (A1 con la semilla)
- [ ] **Step 1:** Al final de `main()`, si `A3-014` está en la selección (`SEED_ONLY`), insertar el proceso:
```ts
import { documentoDesdePrototipo } from '../lib/captura/importar'
import semilla from '../reference/captura/ejemplos/semilla.json'
// Verif fijos para que los tests conozcan los códigos (CBM-01-P3GM…). Solo local.
const VERIF_SEMILLA = { u_marta: 'P3GM', u_diego: 'D7KX', u_rosa: 'R4TN', u_carlos: 'C8WQ', u_laura: 'L5HZ' }
// …dentro de main(), con los ids de cliente/proyecto/perfil ya insertados:
const a3 = projectRows.find(p => p.code === 'A3-014')
if (a3) {
  const { error } = await db.from('procesos').insert({ client_id: a3.client_id, project_id: a3.id, prefijo: 'CBM',
    documento: documentoDesdePrototipo(semilla as never, VERIF_SEMILLA) as never, created_by: carmenId, updated_by: carmenId })
  if (error) throw error
  console.log('✓ proceso de captura «Conciliación bancaria mensual»')
}
```
  (Usar los nombres reales de las variables de `seed.ts`; `resolveJsonModule` ya está activo.)
- [ ] **Step 2:** `npm run db:reset && npm run seed` y ampliar `e2e/lista.spec.ts` A1: la fila
  «Conciliación bancaria mensual» con PR-CON-01, Despacho Andrade & Vega, A3-014, «Borrador».
- [ ] **Step 3: Commit** `chore(seed): proceso de ejemplo de captura (solo local)`

### Task 8.2: Verificación completa

- [ ] **Step 1:** `npm test` → todo verde (anotar el número). `npx tsc --noEmit` limpio. `npm run build`
  verde. `npm run lint` (si solo falla por `reference/`, recordárselo al usuario).
- [ ] **Step 2:** `npm run db:reset && npm run seed && npm run e2e` → todo verde en escritorio y móvil.
- [ ] **Step 3:** Recorrido manual con el navegador integrado sobre la semilla (lista → editor → diagrama
  → Word → aprobación → `/aprobar` en ventana sin sesión) y capturas a 1280 y 400 px.
- [ ] **Step 4:** Revisión final de código con `superpowers:requesting-code-review` sobre todo el rango de
  commits del plan.

### Task 8.3: Documentación

- [ ] **Step 1:** `AGENTS.md`: tabla «Documentos clave» con el spec y el plan de captura; nota en
  peculiaridades: `KAZE_URL` (Config) y `KAZE_APROBAR_SECRETO` (Secret) en Vercel; `/aprobar` es la única
  ruta pública y su cookie `kz_aprobar` es de host; las funciones `aprobacion_*`/`crear_version_siguiente`
  solo las ejecuta `service_role`; `npm run e2e` necesita el stack local seedeado.
- [ ] **Step 2:** Spec `2026-07-26-kaze-diagramador-bpmn-design.md`: encabezado «**Reemplazado** por
  `2026-09-24-kaze-captura-procesos-design.md`».
- [ ] **Step 3:** START-HERE: F8 en curso, pendientes conocidos (limpieza de huérfanos de Storage, menú
  móvil, importar .bpmn, IA, `seed-captura.ts` si se pide el ejemplo en producción).
- [ ] **Step 4: Commit** `docs: captura de procesos documentada`

### Task 8.4: Despliegue — **coordinado con el usuario, paso a paso**

Nada de esta tarea se hace sin un «sí» explícito del usuario en ese momento.

- [ ] **Step 1 [USUARIO]:** En Vercel (proyecto `kaze`, Production + Preview): `KAZE_URL=https://kaze.ventosolutions.ca`
  como **Config**; `KAZE_APROBAR_SECRETO` como **Secret** (el usuario lo genera y lo pega; el agente
  puede darle el comando `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`).
- [ ] **Step 2 [coordinar]:** Revisar qué hay sin push en `main` (incluye `73cd257`, la cookie de apex,
  que corta sesiones de las 3 apps): el usuario decide si sale en este push o se aísla antes.
- [ ] **Step 3 [coordinar]:** `npx supabase db push` al proyecto compartido `nrysdnavawyhaqgruunl`:
  primero `npx supabase db push --dry-run` y mostrar al usuario la lista (deben ser exactamente las tres
  migraciones `20260924…`). Tras el push: verificar con la clave publicable que `anon` recibe
  `permission denied` en `kaze.procesos`, y con SQL (`select has_function_privilege('authenticated',
  'kaze.aprobacion_retirar(uuid)', 'execute')` → `false`). Si la migración de Storage falla por
  permisos, parar y avisar.
- [ ] **Step 4 [coordinar]:** `git push origin main` (= deploy). Esperar `● Ready`.
- [ ] **Step 5:** Verificación en `https://kaze.ventosolutions.ca` con el admin real (el usuario entra):
  `/procesos` vacío, crear un proceso de prueba, editar, ver guardado, diagrama, Word; enviar a revisión
  a un contacto con el correo del usuario; abrir `/aprobar/<token>` en ventana privada: sin código no se
  ve nada, con código se ve y responde; cabeceras de `/aprobar` con `curl -sI`; escaneo del bundle de
  START-HERE (`sb_secret_`, y ahora también `KAZE_APROBAR_SECRETO`). Borrar el proceso de prueba.
- [ ] **Step 6:** START-HERE: captura ✅ en producción; siguiente = T11–T14 del plan de SSO.
  `git commit` + push coordinado.

---

## Autorrevisión del plan (hecha al escribirlo)

- **Cobertura del spec:** §1.1 → F3–F7; §1.3 → decisiones 0; §2–3 → F1/F4–F7; §4.1–4.2 → 2.1–2.2;
  §4.3 → 1.1/1.3; §4.4 → 6.1–6.2; §5.1–5.7 → 2.4, 4.4, 4.6, 4.7, 4.12; §6.1–6.9 → 2.5–2.6, 7.1–7.7
  (con el cambio de «leer con código»); §7 → 0.1, 4.1–4.3, 5.1; §8 → 8.1; §9 → 3.1, 3.2, 4.6;
  §10.1 → F1; §10.2 → F2; §10.3 → Playwright en cada fase; §11 → fases; §12 → reglas de la sección 1 y
  pasos concretos (dynamic import, `@theme static`, `@source not`, revokes, nombres con tildes en 6.1);
  §13 → 8.2–8.4.
- **Fuera de alcance, a propósito:** importar .bpmn, IA, SMTP, limpieza de huérfanos de Storage,
  `seed-captura.ts` (solo si el usuario lo pide), menú móvil de la barra superior, marcador «preparado»
  de los correos.
- **Consistencia de nombres:** `ColaGuardado.{programar, ahoraMismo, hayPendientes, fijarRev, rev}`;
  `guardarProceso` → `ResultadoGuardado`; `conInfoDeVersiones`/`sinInfoDeVersiones`;
  `estadoVersion`, `etapaAbierta`, `seleccionInicial`, `reglasEnvio`, `personasDeSeleccion`,
  `codigoContacto(prefijo, contacto)`; `firmarAcceso`/`leerAcceso`; cookie `kz_aprobar`.
