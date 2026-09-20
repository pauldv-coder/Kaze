# Kaze · App shell + Lista de Proyectos (sub-proyecto 2, tajada 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App shell (sidebar con navegación + menú de cuenta) y pantalla `/proyectos` rica (summary strip de 6 métricas reales + tabla con estado, barras A3, sparkline del KPI principal, avatares), solo lectura.

**Architecture:** Server components (layout + páginas) leen vía capa de datos con el cliente anon+cookies (RLS por sesión); islas cliente mínimas para el menú de cuenta y el resaltado del nav activo. Sin dependencias nuevas; tokens ya en `app/globals.css`.

**Tech Stack:** Next.js 16 (App Router, route groups, server actions), @supabase/ssr, Tailwind v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-25-kaze-lista-proyectos-design.md` (aprobado 2026-07-25).

**Contexto operativo:** repo `C:\Users\pauld\dev\cota`, rama `main`, remoto GitHub `pauldv-coder/Kaze` (**push = auto-deploy a Vercel**: NO pushear hasta la tarea de docs/cierre). Stack local corriendo (`npx supabase start`, puertos 553xx, contenedores `*_cota`; nunca tocar `*_loro`); psql vía `docker exec supabase_db_cota psql -U postgres -d postgres -c "..."`. Login local: `carmen@cota.test` / `cota-demo-2026` (rol admin). Convención Next 16: `proxy.ts`, NO `middleware.ts`. Escribir archivos UTF-8 sin BOM (herramienta Write). Si el stack acaba de reiniciarse y auth da 502, esperar a que `curl http://127.0.0.1:55321/auth/v1/health` dé 200.

**Precondición de toda tarea que corre tests:** base seedeada. Si dudas: `npx supabase db reset && npm run seed` (espera "Seed OK").

---

### Task 1: Helpers puros de métricas (TDD)

**Files:**
- Test: `tests/data/metrics.test.ts`
- Create: `lib/data/metrics.ts`

- [ ] **Step 1: Test que falla** — `tests/data/metrics.test.ts` EXACTAMENTE:

```ts
import { describe, it, expect } from 'vitest'
import { deltaFavorable, esVencida, relativeDate } from '@/lib/data/metrics'

describe('deltaFavorable', () => {
  it('mejor_baja: bajar es favorable', () => {
    expect(deltaFavorable([11, 8.2], true)).toBe(true)
    expect(deltaFavorable([8.2, 9.4], true)).toBe(false)
  })
  it('mejor_sube: subir es favorable', () => {
    expect(deltaFavorable([84, 91.4], false)).toBe(true)
    expect(deltaFavorable([91.4, 84], false)).toBe(false)
  })
  it('serie plana o corta no es favorable', () => {
    expect(deltaFavorable([5, 5], true)).toBe(false)
    expect(deltaFavorable([5], true)).toBe(false)
    expect(deltaFavorable([], false)).toBe(false)
  })
})

describe('esVencida', () => {
  const hoy = new Date('2026-06-20T12:00:00Z')
  it('vencida si vence < hoy y no está done', () => {
    expect(esVencida('2026-06-18', 'doing', hoy)).toBe(true)
  })
  it('no vencida si está done', () => {
    expect(esVencida('2026-05-01', 'done', hoy)).toBe(false)
  })
  it('no vencida si vence en el futuro o sin fecha', () => {
    expect(esVencida('2026-06-25', 'todo', hoy)).toBe(false)
    expect(esVencida(null, 'todo', hoy)).toBe(false)
  })
})

describe('relativeDate', () => {
  const hoy = new Date('2026-06-20T12:00:00Z')
  it('mismo día → Hoy', () => {
    expect(relativeDate('2026-06-20T09:00:00Z', hoy)).toBe('Hoy')
  })
  it('ayer y hace N días', () => {
    expect(relativeDate('2026-06-19T09:00:00Z', hoy)).toBe('ayer')
    expect(relativeDate('2026-06-17T09:00:00Z', hoy)).toBe('hace 3 d')
  })
  it('más de una semana → fecha corta', () => {
    expect(relativeDate('2026-05-20T09:00:00Z', hoy)).toMatch(/may/)
  })
})
```

- [ ] **Step 2: Correr — falla** — Run: `npm test -- tests/data/metrics.test.ts`. Expected: FALLA con "Cannot find module '@/lib/data/metrics'".

- [ ] **Step 3: Implementar `lib/data/metrics.ts`** — EXACTAMENTE:

```ts
// Helpers puros de métricas de proyecto. `hoy` se inyecta para tests deterministas
// (el dato demo está anclado al "hoy" congelado 2026-06-20 del prototipo/seed).

export function deltaFavorable(serie: number[], mejorBaja: boolean): boolean {
  if (serie.length < 2) return false
  const delta = serie[serie.length - 1] - serie[0]
  if (delta === 0) return false
  return mejorBaja ? delta < 0 : delta > 0
}

export function esVencida(vence: string | null, estado: string | null, hoy: Date): boolean {
  if (!vence || estado === 'done') return false
  return new Date(`${vence}T00:00:00Z`) < hoy
}

export function relativeDate(iso: string, hoy: Date): string {
  const dias = Math.floor((hoy.getTime() - new Date(iso).getTime()) / 86_400_000)
  if (dias <= 0) return 'Hoy'
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} d`
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}
```

- [ ] **Step 4: Correr — pasa** — Run: `npm test -- tests/data/metrics.test.ts` → 3 describes verdes. `npx tsc --noEmit` limpio.

- [ ] **Step 5: Commit** (NO push):

```bash
git add tests/data/metrics.test.ts lib/data/metrics.ts
git commit -m "feat(data): helpers puros de métricas (delta, vencida, fecha relativa)"
```
Trailer tras línea vacía: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 2: `getProjectsList` + tests de integración (TDD)

**Files:**
- Test: `tests/data/projects-list.test.ts`
- Modify: `lib/data/projects.ts` (agregar tipo y función; NO tocar `getProjects`/`getProjectByCode`)

- [ ] **Step 1: Test que falla** — `tests/data/projects-list.test.ts` EXACTAMENTE:

```ts
import { describe, it, expect } from 'vitest'
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getProjectsList } from '@/lib/data/projects'

const db = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)
// "hoy" congelado del seed (scripts/seed.ts:22) → expectativas de vencidas estables.
const HOY = new Date('2026-06-20T12:00:00Z')

describe('getProjectsList', () => {
  it('devuelve las 8 filas ordenadas por code', async () => {
    const rows = await getProjectsList(db, HOY)
    expect(rows).toHaveLength(8)
    expect(rows.map(r => r.code)).toEqual(['A3-007','A3-009','A3-012','A3-014','A3-018','A3-021','A3-025','A3-030'])
  })

  it('A3-014: KPI principal, delta favorable, equipo y vencidas', async () => {
    const r = (await getProjectsList(db, HOY)).find(x => x.code === 'A3-014')!
    expect(r.titulo).toMatch(/conciliaciones/i)
    expect(r.cliente).toBe('Despacho Andrade & Vega')
    expect(r.estado).toBe('progreso')
    expect(r.avancePasos).toBe(4)
    expect(r.equipo).toEqual(['CV', 'DL'])
    expect(r.kpiPrincipal?.nombre).toBe('Lead time de cierre')
    expect(r.kpiPrincipal?.valor).toBeCloseTo(8.2)
    expect(r.kpiPrincipal?.deltaBueno).toBe(true)
    expect(r.kpiPrincipal?.serie.length).toBe(6)
    expect(r.accionesVencidas).toBe(1)
  })

  it('A3-021: KPI que empeora (delta no favorable)', async () => {
    const r = (await getProjectsList(db, HOY)).find(x => x.code === 'A3-021')!
    expect(r.kpiPrincipal?.nombre).toBe('Tiempo de alta de cliente')
    expect(r.kpiPrincipal?.deltaBueno).toBe(false)
    expect(r.accionesVencidas).toBe(1)
  })

  it('A3-009 y A3-030 no tienen KPI en el seed → kpiPrincipal null', async () => {
    const rows = await getProjectsList(db, HOY)
    expect(rows.find(x => x.code === 'A3-009')!.kpiPrincipal).toBeNull()
    expect(rows.find(x => x.code === 'A3-030')!.kpiPrincipal).toBeNull()
    expect(rows.find(x => x.code === 'A3-030')!.avancePasos).toBe(1)
  })
})
```

- [ ] **Step 2: Correr — falla** — Run: `npm test -- tests/data/projects-list.test.ts`. Expected: FALLA (`getProjectsList` no existe).

- [ ] **Step 3: Implementar en `lib/data/projects.ts`** — agregar al final (deja intactos los imports y las funciones existentes; añade el import de metrics arriba junto a los otros imports):

Import a agregar (arriba, tras los imports existentes):
```ts
import { deltaFavorable, esVencida, relativeDate } from '@/lib/data/metrics'
```

Código a agregar al final del archivo:
```ts
export type ProjectListRow = {
  id: string
  code: string
  titulo: string
  cliente: string | null
  estado: string | null
  avancePasos: number
  equipo: string[]
  kpiPrincipal: {
    nombre: string
    unidad: string | null
    valor: number
    delta: number
    deltaBueno: boolean
    serie: number[]
  } | null
  accionesVencidas: number
  updated: string
}

// Nota: projects tiene DOS FKs a profiles (consultor_id, lider_id) y miembros es uuid[]
// (no embebible). Por eso el equipo se resuelve cargando profiles a un Map, sin embeds.
export async function getProjectsList(db: DB, hoy: Date = new Date()): Promise<ProjectListRow[]> {
  const { data: projects, error } = await db
    .from('projects')
    .select('id, code, titulo, estado, avance_pasos, updated_at, consultor_id, lider_id, miembros, client:clients(nombre)')
    .order('code')
  if (error) throw error

  const { data: profiles, error: pErr } = await db.from('profiles').select('id, iniciales')
  if (pErr) throw pErr
  const iniById = new Map(profiles.map(p => [p.id, p.iniciales ?? '']))

  const { data: kpis, error: kErr } = await db
    .from('kpis').select('id, project_id, nombre, unidad, mejor_baja, created_at').order('created_at')
  if (kErr) throw kErr
  const { data: meas, error: mErr } = await db
    .from('measurements').select('kpi_id, valor, fecha').order('fecha')
  if (mErr) throw mErr
  const serieByKpi = new Map<string, number[]>()
  for (const m of meas) {
    const arr = serieByKpi.get(m.kpi_id) ?? []
    arr.push(Number(m.valor))
    serieByKpi.set(m.kpi_id, arr)
  }

  const { data: actions, error: aErr } = await db.from('actions').select('project_id, vence, estado')
  if (aErr) throw aErr

  return projects.map(p => {
    const equipo = [p.consultor_id, p.lider_id, ...(p.miembros ?? [])]
      .filter((id): id is string => !!id)
      .filter((id, i, a) => a.indexOf(id) === i)
      .map(id => iniById.get(id) ?? '')
      .filter(Boolean)

    let kpiPrincipal: ProjectListRow['kpiPrincipal'] = null
    for (const k of kpis.filter(k => k.project_id === p.id)) {
      const serie = serieByKpi.get(k.id) ?? []
      if (serie.length >= 2) {
        kpiPrincipal = {
          nombre: k.nombre,
          unidad: k.unidad,
          valor: serie[serie.length - 1],
          delta: serie[serie.length - 1] - serie[0],
          deltaBueno: deltaFavorable(serie, k.mejor_baja),
          serie,
        }
        break
      }
    }

    return {
      id: p.id,
      code: p.code,
      titulo: p.titulo,
      cliente: p.client?.nombre ?? null,
      estado: p.estado,
      avancePasos: p.avance_pasos,
      equipo,
      kpiPrincipal,
      accionesVencidas: actions.filter(a => a.project_id === p.id && esVencida(a.vence, a.estado, hoy)).length,
      updated: relativeDate(p.updated_at, hoy),
    }
  })
}
```

- [ ] **Step 4: Correr — pasa** — Run: `npm test -- tests/data/projects-list.test.ts` → 4 verdes. `npx tsc --noEmit` limpio.

- [ ] **Step 5: Commit** (NO push):

```bash
git add tests/data/projects-list.test.ts lib/data/projects.ts
git commit -m "feat(data): getProjectsList (KPI principal, equipo, vencidas) con tests"
```
+ trailer.

---

### Task 3: `getProjectsSummary` + `getSidebarClientes` + tests (TDD)

**Files:**
- Test: `tests/data/summary.test.ts`
- Create: `lib/data/summary.ts`

- [ ] **Step 1: Test que falla** — `tests/data/summary.test.ts` EXACTAMENTE:

```ts
import { describe, it, expect } from 'vitest'
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getProjectsSummary, getSidebarClientes } from '@/lib/data/summary'

const db = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)
const HOY = new Date('2026-06-20T12:00:00Z')

describe('getProjectsSummary', () => {
  it('métricas del seed', async () => {
    const s = await getProjectsSummary(db, HOY)
    expect(s.total).toBe(8)
    expect(s.activos).toBe(5)      // progreso 4 + riesgo 1
    expect(s.enRiesgo).toBe(1)
    expect(s.cerrados).toBe(2)
    expect(s.accionesVencidas).toBe(2)   // AC-41 (A3-014) + AC-52 (A3-021) al 2026-06-20
    expect(s.ahorroAnual).toBe(53500)    // 32000 + 21500
    expect(s.inversion).toBe(25500)      // 18000 + 7500
    expect(s.nCasos).toBe(2)
  })
})

describe('getSidebarClientes', () => {
  it('clientes con conteo de proyectos, ordenados por nombre', async () => {
    const cs = await getSidebarClientes(db)
    expect(cs).toHaveLength(5)
    expect(cs[0].nombre).toBe('Clínica Norte')
    expect(cs.find(c => c.nombre === 'Despacho Andrade & Vega')!.nProyectos).toBe(2)
    expect(cs.find(c => c.nombre === 'Clínica Norte')!.nProyectos).toBe(1)
  })
})
```

- [ ] **Step 2: Correr — falla** — Run: `npm test -- tests/data/summary.test.ts`. Expected: FALLA (módulo no existe).

- [ ] **Step 3: Implementar `lib/data/summary.ts`** — EXACTAMENTE:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { esVencida } from '@/lib/data/metrics'

type DB = SupabaseClient<Database>

export type ProjectsSummary = {
  total: number
  activos: number
  enRiesgo: number
  accionesVencidas: number
  cerrados: number
  ahorroAnual: number
  inversion: number
  nCasos: number
}

export type SidebarCliente = { id: string; nombre: string; nProyectos: number }

export async function getProjectsSummary(db: DB, hoy: Date = new Date()): Promise<ProjectsSummary> {
  const { data: projects, error } = await db.from('projects').select('estado')
  if (error) throw error
  const { data: actions, error: aErr } = await db.from('actions').select('vence, estado')
  if (aErr) throw aErr
  const { data: cases, error: cErr } = await db.from('business_cases').select('ahorro_bruto_anual, capex')
  if (cErr) throw cErr

  const count = (e: string) => projects.filter(p => p.estado === e).length
  return {
    total: projects.length,
    activos: count('progreso') + count('riesgo'),
    enRiesgo: count('riesgo'),
    accionesVencidas: actions.filter(a => esVencida(a.vence, a.estado, hoy)).length,
    cerrados: count('cerrado'),
    ahorroAnual: cases.reduce((s, c) => s + Number(c.ahorro_bruto_anual ?? 0), 0),
    inversion: cases.reduce((s, c) => s + Number(c.capex ?? 0), 0),
    nCasos: cases.length,
  }
}

export async function getSidebarClientes(db: DB): Promise<SidebarCliente[]> {
  const { data: projects, error } = await db.from('projects').select('client_id')
  if (error) throw error
  const { data: clients, error: cErr } = await db.from('clients').select('id, nombre').order('nombre')
  if (cErr) throw cErr
  const countBy = new Map<string, number>()
  for (const p of projects) if (p.client_id) countBy.set(p.client_id, (countBy.get(p.client_id) ?? 0) + 1)
  return clients
    .map(c => ({ id: c.id, nombre: c.nombre, nProyectos: countBy.get(c.id) ?? 0 }))
    .filter(c => c.nProyectos > 0)
}
```

- [ ] **Step 4: Correr — pasa** — Run: `npm test -- tests/data/summary.test.ts` → verdes. `npx tsc --noEmit` limpio.

- [ ] **Step 5: Commit** (NO push):

```bash
git add tests/data/summary.test.ts lib/data/summary.ts
git commit -m "feat(data): getProjectsSummary + getSidebarClientes con tests"
```
+ trailer.

---

### Task 4: Test de capa de datos como usuario `authenticated` (higiene RLS)

**Files:**
- Test: `tests/data/rls-authenticated.test.ts`

- [ ] **Step 1: Escribir el test** — EXACTAMENTE (usa el cliente ANON firmado como carmen, no service_role → prueba que RLS "equipo total" + grants dejan leer todo lo que la pantalla necesita):

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getProjectsList } from '@/lib/data/projects'
import { getProjectsSummary } from '@/lib/data/summary'

const db = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
)
const HOY = new Date('2026-06-20T12:00:00Z')

beforeAll(async () => {
  const { error } = await db.auth.signInWithPassword({ email: 'carmen@cota.test', password: 'cota-demo-2026' })
  if (error) throw error
})

describe('lectura como usuario authenticated (RLS + grants)', () => {
  it('getProjectsList devuelve las 8 filas con KPI leído bajo RLS', async () => {
    const rows = await getProjectsList(db, HOY)
    expect(rows).toHaveLength(8)
    // que A3-014 traiga su KPI prueba que kpis+measurements son legibles bajo el JWT del usuario
    expect(rows.find(r => r.code === 'A3-014')!.kpiPrincipal?.nombre).toBe('Lead time de cierre')
  })

  it('getProjectsSummary lee actions y business_cases bajo RLS', async () => {
    const s = await getProjectsSummary(db, HOY)
    expect(s.total).toBe(8)
    expect(s.ahorroAnual).toBe(53500)
  })
})
```

- [ ] **Step 2: Correr** — Run: `npm test -- tests/data/rls-authenticated.test.ts` → verdes. Si falla por permisos (42501/empty), NO cambies el test: reporta — significaría un hueco de grants real. Si el stack reinició y da 502, espera health 200 y reintenta.

- [ ] **Step 3: Suite completa** — `npm test` → todos verdes (metrics + projects + roles + users + projects-list + summary + rls-authenticated). `npx tsc --noEmit` limpio.

- [ ] **Step 4: Commit** (NO push):

```bash
git add tests/data/rls-authenticated.test.ts
git commit -m "test(data): lectura de la lista como usuario authenticated (RLS/grants)"
```
+ trailer.

---

### Task 5: Componentes presentacionales de la tabla

**Files:**
- Create: `app/(app)/proyectos/_components/estado-chip.tsx`, `a3-progress.tsx`, `sparkline.tsx`, `team-avatars.tsx`

Todos server components (sin interactividad). Escribir UTF-8 sin BOM.

- [ ] **Step 1: `estado-chip.tsx`** — EXACTAMENTE:

```tsx
const MAP: Record<string, { label: string; cls: string; dot: string }> = {
  progreso: { label: 'En progreso', cls: 'text-estado-bien bg-estado-bien/10 border-estado-bien/25', dot: 'bg-estado-bien' },
  riesgo:   { label: 'En riesgo',   cls: 'text-estado-mal bg-estado-mal/10 border-estado-mal/25',   dot: 'bg-estado-mal' },
  cerrado:  { label: 'Cerrado',     cls: 'text-apagado bg-panel border-borde',                       dot: 'bg-apagado' },
  nuevo:    { label: 'Por iniciar', cls: 'text-apagado bg-panel border-borde',                       dot: 'bg-borde' },
}

export function EstadoChip({ estado }: { estado: string | null }) {
  const e = MAP[estado ?? ''] ?? MAP.nuevo
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold ${e.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${e.dot}`} />
      {e.label}
    </span>
  )
}
```

- [ ] **Step 2: `a3-progress.tsx`** — EXACTAMENTE:

```tsx
export function A3Progress({ done, total = 7 }: { done: number; total?: number }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="font-display text-[12.5px] font-bold tabular-nums">
          {done}<span className="font-medium text-apagado">/{total}</span>
        </span>
        <span className="text-[10.5px] text-apagado">pasos</span>
      </div>
      <div className="flex gap-[3px]">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`h-[5px] flex-1 rounded-sm ${i < done ? 'bg-tinta' : 'bg-borde'}`} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: `sparkline.tsx`** — EXACTAMENTE (misma matemática del prototipo, Lista de Proyectos:385-397):

```tsx
export function Sparkline({ serie }: { serie: number[] }) {
  const w = 88, h = 26, p = 4
  if (serie.length < 2) return null
  const min = Math.min(...serie), max = Math.max(...serie), rng = (max - min) || 1
  let lastX = 0, lastY = 0
  const pts = serie.map((v, i) => {
    const x = p + (i / (serie.length - 1)) * (w - 2 * p)
    const y = p + (1 - (v - min) / rng) * (h - 2 * p)
    lastX = x; lastY = y
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="block h-[26px] w-[88px] shrink-0" aria-hidden>
      <polyline points={pts} fill="none" stroke="var(--color-marca)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX.toFixed(1)} cy={lastY.toFixed(1)} r="2.6" fill="var(--color-marca)" />
    </svg>
  )
}
```

- [ ] **Step 4: `team-avatars.tsx`** — EXACTAMENTE:

```tsx
export function TeamAvatars({ iniciales }: { iniciales: string[] }) {
  return (
    <div className="flex items-center">
      {iniciales.map((ini, i) => (
        <span
          key={i}
          className="flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-white bg-tinta font-display text-[9.5px] font-bold text-marca"
          style={{ marginLeft: i === 0 ? 0 : '-7px' }}
        >
          {ini}
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Verificar + commit** — `npx tsc --noEmit` limpio; `npm run build` verde (aún nadie los importa; deben compilar). Commit (NO push):

```bash
git add "app/(app)/proyectos/_components"
git commit -m "feat(ui): componentes presentacionales de la tabla de proyectos"
```
+ trailer.

---

### Task 6: `SummaryStrip` y `ProjectsTable`

**Files:**
- Create: `app/(app)/proyectos/_components/summary-strip.tsx`, `projects-table.tsx`

- [ ] **Step 1: `summary-strip.tsx`** — EXACTAMENTE:

```tsx
import type { ProjectsSummary } from '@/lib/data/summary'

function miles(n: number) {
  return '$' + Math.round(n / 1000) + 'k'
}

export function SummaryStrip({ s }: { s: ProjectsSummary }) {
  const cells = [
    { val: String(s.total), sub: 'Proyectos totales', color: 'text-tinta' },
    { val: String(s.activos), sub: 'Activos', color: 'text-estado-bien' },
    { val: String(s.enRiesgo), sub: 'Requiere atención', color: 'text-estado-mal' },
    { val: String(s.accionesVencidas), sub: 'Acciones vencidas', color: 'text-tinta' },
    { val: String(s.cerrados), sub: 'Cerrados', color: 'text-apagado' },
    { val: `${miles(s.ahorroAnual)}/año`, sub: `${miles(s.inversion)} inv · ${s.nCasos} casos`, color: 'text-estado-bien' },
  ]
  return (
    <div className="mb-5 grid grid-cols-2 overflow-hidden rounded-lg border border-borde sm:grid-cols-3 lg:grid-cols-6">
      {cells.map((c, i) => (
        <div key={i} className="border-b border-borde px-4 py-3 sm:border-r sm:[&:nth-child(3n)]:border-r-0 lg:border-b-0 lg:[&:nth-child(3n)]:border-r lg:[&:last-child]:border-r-0">
          <div className={`font-display text-2xl font-bold tabular-nums ${c.color}`}>{c.val}</div>
          <div className="mt-0.5 text-[11.5px] text-apagado">{c.sub}</div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: `projects-table.tsx`** — EXACTAMENTE (filas NO navegables: `<div>`, no `<a>`):

```tsx
import type { ProjectListRow } from '@/lib/data/projects'
import { EstadoChip } from './estado-chip'
import { A3Progress } from './a3-progress'
import { Sparkline } from './sparkline'
import { TeamAvatars } from './team-avatars'

const COLS = 'grid-cols-[minmax(200px,2.4fr)_120px_minmax(120px,150px)_minmax(170px,1.4fr)_84px_92px]'

export function ProjectsTable({ rows }: { rows: ProjectListRow[] }) {
  if (rows.length === 0) {
    return <div className="py-16 text-center text-sm text-apagado">Ningún proyecto todavía.</div>
  }
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[860px]">
        <div className={`grid ${COLS} items-center gap-4 px-4 pb-3`}>
          {['Proyecto', 'Estado', 'A3 · completitud', 'Indicador principal', 'Equipo', 'Actualizado'].map(h => (
            <div key={h} className="text-[10.5px] font-semibold uppercase tracking-wider text-apagado">{h}</div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {rows.map(p => (
            <div key={p.id} className={`grid ${COLS} items-center gap-4 rounded-lg border border-borde bg-white px-4 py-3.5`}>
              <div className="min-w-0">
                <div className="truncate font-display text-sm font-semibold">{p.titulo}</div>
                <div className="mt-0.5 flex items-center gap-1.5 truncate text-[11.5px] text-apagado">
                  <span className="tabular-nums">{p.code}</span><span>·</span>
                  <span className="truncate">{p.cliente ?? '—'}</span>
                </div>
              </div>
              <div><EstadoChip estado={p.estado} /></div>
              <A3Progress done={p.avancePasos} />
              <div className="flex min-w-0 items-center gap-3">
                {p.kpiPrincipal ? (
                  <>
                    <Sparkline serie={p.kpiPrincipal.serie} />
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-display text-base font-bold tabular-nums leading-none">
                          {p.kpiPrincipal.valor.toLocaleString('es')}
                        </span>
                        <span className="text-[11px] font-semibold text-apagado">{p.kpiPrincipal.unidad}</span>
                        <span className={`text-[11px] font-bold ${p.kpiPrincipal.delta === 0 ? 'text-apagado' : p.kpiPrincipal.deltaBueno ? 'text-estado-bien' : 'text-estado-mal'}`}>
                          {p.kpiPrincipal.delta === 0
                            ? '—'
                            : `${p.kpiPrincipal.delta < 0 ? '▼' : '▲'} ${Math.abs(p.kpiPrincipal.delta).toLocaleString('es', { maximumFractionDigits: 1 })}`}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-[10.5px] text-apagado">{p.kpiPrincipal.nombre}</div>
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-apagado">Sin tendencia aún</span>
                )}
              </div>
              <TeamAvatars iniciales={p.equipo} />
              <div>
                <div className="text-xs font-medium text-tinta">{p.updated}</div>
                {p.accionesVencidas > 0 && (
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] font-semibold text-estado-mal">
                    <span className="h-[5px] w-[5px] rounded-full bg-estado-mal" />
                    {p.accionesVencidas} {p.accionesVencidas === 1 ? 'acción vencida' : 'acciones vencidas'}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verificar + commit** — `npx tsc --noEmit` limpio; `npm run build` verde. Commit (NO push):

```bash
git add "app/(app)/proyectos/_components"
git commit -m "feat(ui): summary strip + tabla de proyectos"
```
+ trailer.

---

### Task 7: `signOut` + islas cliente del shell (account-menu, sidebar-nav)

**Files:**
- Create: `app/(app)/actions.ts`, `app/(app)/_components/account-menu.tsx`, `app/(app)/_components/sidebar-nav.tsx`

- [ ] **Step 1: `app/(app)/actions.ts`** — EXACTAMENTE:

```ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

- [ ] **Step 2: `app/(app)/_components/sidebar-nav.tsx`** — EXACTAMENTE (cliente; resalta el activo; ítems futuros deshabilitados):

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { label: 'Proyectos', href: '/proyectos' },
  { label: 'Mapas de valor · VSM', href: null },
  { label: 'Acciones', href: null },
  { label: 'Indicadores', href: null },
  { label: 'Casos de negocio', href: null },
  { label: 'Plantillas A3', href: null },
] as const

export function SidebarNav() {
  const path = usePathname()
  return (
    <nav className="flex flex-col gap-px px-2">
      {ITEMS.map(it => {
        const active = it.href && path.startsWith(it.href)
        if (!it.href) {
          return (
            <span key={it.label} title="Próximamente"
              className="flex cursor-default items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-white/35">
              <span className="h-3.5 w-1 rounded-sm bg-transparent" />{it.label}
            </span>
          )
        }
        return (
          <Link key={it.label} href={it.href}
            className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] ${active ? 'bg-white/10 font-semibold text-white' : 'text-white/70 hover:bg-white/5'}`}>
            <span className={`h-3.5 w-1 rounded-sm ${active ? 'bg-marca' : 'bg-transparent'}`} />{it.label}
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 3: `app/(app)/_components/account-menu.tsx`** — EXACTAMENTE (cliente; menú con Cuenta, Admin si corresponde, Cerrar sesión):

```tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { signOut } from '../actions'

export function AccountMenu({ nombre, iniciales, rol }: { nombre: string; iniciales: string; rol: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-56 rounded-lg border border-borde bg-white p-1 text-tinta shadow-lg">
          <Link href="/cuenta/contrasena" onClick={() => setOpen(false)}
            className="block rounded-md px-3 py-2 text-sm hover:bg-panel">Cuenta</Link>
          {rol === 'admin' && (
            <Link href="/admin" onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm hover:bg-panel">Administración</Link>
          )}
          <form action={signOut}>
            <button className="block w-full rounded-md px-3 py-2 text-left text-sm text-estado-mal hover:bg-panel">
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
      <button onClick={() => setOpen(v => !v)} className="flex w-full items-center gap-2.5 rounded-md p-1 text-left hover:bg-white/5">
        <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-white/10 font-display text-[11px] font-bold text-marca">{iniciales}</span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold text-white">{nombre}</span>
          <span className="block text-[10.5px] capitalize text-white/45">{rol}</span>
        </span>
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Verificar + commit** — `npx tsc --noEmit` limpio; `npm run build` verde. Commit (NO push):

```bash
git add "app/(app)/actions.ts" "app/(app)/_components/account-menu.tsx" "app/(app)/_components/sidebar-nav.tsx"
git commit -m "feat(shell): signOut + account-menu + sidebar-nav (islas cliente)"
```
+ trailer.

---

### Task 8: `Sidebar` + `(app)/layout.tsx`

**Files:**
- Create: `app/(app)/_components/sidebar.tsx`, `app/(app)/layout.tsx`

- [ ] **Step 1: `app/(app)/_components/sidebar.tsx`** — EXACTAMENTE (server):

```tsx
import type { SidebarCliente } from '@/lib/data/summary'
import { SidebarNav } from './sidebar-nav'
import { AccountMenu } from './account-menu'

export function Sidebar({ nombre, iniciales, rol, clientes }: {
  nombre: string; iniciales: string; rol: string; clientes: SidebarCliente[]
}) {
  return (
    <aside className="flex w-[222px] shrink-0 flex-col bg-tinta py-4 text-white/90">
      <div className="flex items-center gap-2.5 border-b border-white/10 px-5 pb-5">
        <span className="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-white/5">
          <span className="h-[11px] w-[11px] rounded-full border-[2.5px] border-marca" />
        </span>
        <span className="font-display text-base font-bold tracking-tight text-white">Kaze</span>
      </div>

      <div className="px-5 pb-2 pt-4 text-[10px] uppercase tracking-widest text-white/40">Espacio de trabajo</div>
      <SidebarNav />

      <div className="px-5 pb-2 pt-6 text-[10px] uppercase tracking-widest text-white/40">Clientes</div>
      <nav className="flex flex-col gap-px px-2">
        {clientes.map(c => (
          <span key={c.id} className="flex items-center justify-between rounded-md px-3 py-1.5 text-[12.5px] text-white/65">
            <span className="truncate">{c.nombre}</span>
            <span className="tabular-nums text-[11px] text-white/40">{c.nProyectos}</span>
          </span>
        ))}
      </nav>

      <div className="mt-auto border-t border-white/10 px-3 pt-3">
        <AccountMenu nombre={nombre} iniciales={iniciales} rol={rol} />
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: `app/(app)/layout.tsx`** — EXACTAMENTE (server; envuelve todas las páginas de `(app)`):

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSidebarClientes } from '@/lib/data/summary'
import { Sidebar } from './_components/sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('nombre, iniciales, rol').eq('id', user.id).single()
  const clientes = await getSidebarClientes(supabase)

  return (
    <div className="flex min-h-screen bg-panel max-md:flex-col">
      <Sidebar
        nombre={profile?.nombre ?? user.email ?? ''}
        iniciales={profile?.iniciales ?? ''}
        rol={profile?.rol ?? 'consultor'}
        clientes={clientes}
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
```

Nota: el shell aplica a `/proyectos`, `/admin` y `/cuenta/contrasena` (todas bajo `(app)`). La página de contraseña ya trae su propio `min-h-screen grid place-items-center`; queda centrada dentro del `<main>`, es aceptable.

- [ ] **Step 3: Verificar** — `npx tsc --noEmit` limpio; `npm run build` verde. `npm run dev` en background; `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/proyectos` sin cookies → 307 a /login (proxy intacto). Matar dev server; puerto libre.

- [ ] **Step 4: Commit** (NO push):

```bash
git add "app/(app)/_components/sidebar.tsx" "app/(app)/layout.tsx"
git commit -m "feat(shell): sidebar + layout del grupo (app)"
```
+ trailer.

---

### Task 9: Redirigir `/login` si ya hay sesión

**Files:**
- Modify: `app/(auth)/login/page.tsx`

- [ ] **Step 1: Editar `app/(auth)/login/page.tsx`** — agregar, al inicio del componente (antes del `return`), el check de sesión. El archivo actual empieza así:

```tsx
import { login } from './actions'

export default async function LoginPage({
  searchParams,
}: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
```

Reemplazar esas líneas por (agrega dos imports y el check; conserva el resto del archivo tal cual):

```tsx
import { login } from './actions'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function LoginPage({
  searchParams,
}: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/proyectos')

  const { error } = await searchParams
```

- [ ] **Step 2: Verificar** — `npx tsc --noEmit` limpio; `npm run build` verde. `npm run dev` background; sin cookies `curl .../login` → 200 (muestra el form). El caso con sesión se prueba en el e2e (T11). Matar dev server.

- [ ] **Step 3: Commit** (NO push):

```bash
git add "app/(auth)/login/page.tsx"
git commit -m "feat(auth): /login redirige a /proyectos si ya hay sesión"
```
+ trailer.

---

### Task 10: Reescribir `/proyectos` con el shell + strip + tabla

**Files:**
- Modify: `app/(app)/proyectos/page.tsx` (reescritura completa)
- Create: `app/(app)/error.tsx`

- [ ] **Step 1: Reescribir `app/(app)/proyectos/page.tsx`** — EXACTAMENTE:

```tsx
import { createClient } from '@/lib/supabase/server'
import { getProjectsList } from '@/lib/data/projects'
import { getProjectsSummary } from '@/lib/data/summary'
import { SummaryStrip } from './_components/summary-strip'
import { ProjectsTable } from './_components/projects-table'

export default async function ProyectosPage() {
  const supabase = await createClient()
  const [rows, summary] = await Promise.all([getProjectsList(supabase), getProjectsSummary(supabase)])

  return (
    <div className="flex h-screen flex-col">
      <header className="shrink-0 border-b border-borde bg-white px-7 pt-5">
        <div className="mb-4">
          <h1 className="font-display text-[22px] font-bold tracking-tight">Proyectos</h1>
          <p className="mt-0.5 text-[12.5px] text-apagado">Cartera de mejoras lean en curso</p>
        </div>
      </header>
      <div className="flex-1 overflow-auto px-7 py-5">
        <SummaryStrip s={summary} />
        <ProjectsTable rows={rows} />
      </div>
    </div>
  )
}
```

(Usa el `hoy` real por defecto — en producción con datos vivos es lo correcto; los tests inyectan la fecha congelada.)

- [ ] **Step 1b: Crear `app/(app)/error.tsx`** — EXACTAMENTE. La capa de datos hace `throw error` en cada query; sin este boundary cualquier fallo de Postgrest muestra la pantalla de error cruda de Next dentro del shell:

```tsx
'use client'

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center px-7">
      <div className="max-w-md text-center">
        <h2 className="font-display text-lg font-bold">No pudimos cargar esta pantalla</h2>
        <p className="mt-1.5 text-[12.5px] text-apagado">
          Hubo un problema al leer los datos. Reintenta; si persiste, avisa al equipo.
        </p>
        <button
          onClick={reset}
          className="mt-4 rounded-md border border-borde px-3 py-2 text-sm font-semibold hover:bg-panel"
        >
          Reintentar
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar** — `npx tsc --noEmit` limpio; `npm run build` verde con rutas `ƒ /proyectos`, `/admin`, `/cuenta/contrasena` (todas con el shell). `npm test` completo verde.

- [ ] **Step 3: Commit** (NO push):

```bash
git add "app/(app)/proyectos/page.tsx" "app/(app)/error.tsx"
git commit -m "feat: /proyectos con app shell, summary strip y tabla rica"
```
+ trailer.

---

### Task 11: e2e local con navegador

Sin archivos nuevos (verificación; commit solo si hay fixes de bugs reales). Precondición: `npx supabase db reset && npm run seed`, `npm run dev` en background. Navegador: **Claude Preview MCP** (`mcp__Claude_Browser__*`; el MCP de Playwright NO funciona en este entorno). Cargar con ToolSearch si hace falta: `select:mcp__Claude_Browser__preview_start,mcp__Claude_Browser__navigate,mcp__Claude_Browser__get_page_text,mcp__Claude_Browser__javascript_tool,mcp__Claude_Browser__computer`. Pasar siempre el tabId.

- [ ] **Step 1:** Login `carmen@cota.test` / `cota-demo-2026` (submit del form vía JS: setear value con native setter + `input` event + `form.requestSubmit(button)`, patrón usado en e2e previos si los clicks del pane no componen). Esperar y navegar a `/proyectos`.
- [ ] **Step 2:** `get_page_text` de `/proyectos` → contiene el sidebar ("Kaze", "Proyectos", "Espacio de trabajo", "Clientes" con nombres), el summary strip y la tabla con las 8 filas. Verificar los números **estables** del strip: total **8**, activos **5**, en riesgo **1**, cerrados **2**, ahorro **$54k/año** (con "$26k inv · 2 casos"). ⚠️ NO fijar el número de "Acciones vencidas": la página usa `hoy` real y los datos demo están fechados en el pasado (~junio 2026), así que en vivo ese contador sale alto (casi todas las acciones no-`done` cuentan como vencidas) — solo confirmar que la celda existe y muestra un entero. Tabla: títulos, códigos A3-007…A3-030, chips "En progreso"/"En riesgo"/"Cerrado"/"Por iniciar", y "Sin tendencia aún" en A3-009/A3-007/A3-030.
- [ ] **Step 2b:** Screenshot de `/proyectos` como evidencia.
- [ ] **Step 3:** Ítems de nav deshabilitados no navegan: leer el DOM y confirmar que "Acciones"/"Indicadores"/etc. no son `<a>` (son `<span>` con `text-white/35`).
- [ ] **Step 4:** Menú de cuenta: abrirlo (click en el botón del pie) → contiene "Cuenta", "Administración" (carmen es admin) y "Cerrar sesión". Navegar a `/cuenta/contrasena` → muestra el shell (sidebar visible) + el form. Navegar a `/admin` → shell + tabla de usuarios (carmen es admin).
- [ ] **Step 5:** Cerrar sesión (submit del form de signOut) → vuelve a `/login`. Luego navegar a `/proyectos` sin sesión → redirige a `/login`. Y navegar a `/login` — como no hay sesión, muestra el form (no redirige).
- [ ] **Step 6 (higiene del redirect):** Volver a loguear carmen; ya con sesión, navegar a `/login` → redirige a `/proyectos`.
- [ ] **Step 7:** Matar dev server; puerto 3000 libre. `npm test` → verde. `git status` limpio (sin cambios accidentales). Si hubo fixes de código durante el e2e: commitear con mensaje claro; si no, sin commit.

Reporta el resultado paso a paso con evidencia (textos vistos + screenshot). Si algo falla y es bug real, diagnostica, corrige mínimo y re-verifica.

---

### Task 12: Docs + push + review final de la tajada

**Files:**
- Modify: `docs/superpowers/START-HERE.md`

- [ ] **Step 1:** Actualizar `docs/superpowers/START-HERE.md`:
  - Estado: sub-proyecto 2 tajada 1 (app shell + Lista de Proyectos, solo lectura) COMPLETA; `/admin` y `/cuenta` ahora descubribles vía el menú de cuenta.
  - Higiene del handoff: marcar hecho el app shell, el redirect de `/login` con sesión, y el test authenticated.
  - Prompt para retomar → siguiente: **tajada 2b** (búsqueda + filtros facetados + orden) y luego **2c** (modal "Nuevo proyecto" / creación). Mencionar que el KPI principal = primer KPI con mediciones, que A3-009/A3-007/A3-030 no tienen KPI en el seed, y que "vencidas" usa `hoy` real (inyectable en tests con la fecha congelada 2026-06-20).
  - ⚠️ Nota de dato demo a registrar: como el seed está fechado en ~junio 2026 (HOY congelado 2026-06-20) y la app usa la fecha real, el contador de "Acciones vencidas" sale alto en producción (casi todas las acciones no-`done`). No es un bug de lógica; se corrige con datos demo más frescos o, si molesta, re-sembrando producción con fechas actuales — anotarlo como pendiente de dato, no de código.

- [ ] **Step 2: Commit + push** (este push despliega a Vercel):

```bash
git add docs/superpowers/START-HERE.md
git commit -m "docs: sub-proyecto 2 tajada 1 completa (app shell + lista de proyectos)"
git push origin main
```
+ trailer en el commit.

- [ ] **Step 3:** Confirmar el auto-deploy: `npx vercel ls` → el deployment más reciente `● Ready`. (Smoke opcional: el dominio de producción `/proyectos` sin sesión → 307 a `/login`.)

- [ ] **Step 4:** El controlador despacha el review final del rango de la tajada.

---

## Verificación final (DoD del spec)

- [ ] `(app)/layout.tsx` envuelve proyectos/admin/cuenta con la sidebar; menú de cuenta con Cuenta + Administración (solo admin) + Cerrar sesión; logout funciona.
- [ ] `/proyectos`: summary strip (6 métricas reales) + tabla rica (estado, barras A3, sparkline del KPI principal, avatares, actualizado, acciones vencidas). Filas no navegables.
- [ ] Ítems de nav futuros deshabilitados (no 404).
- [ ] `/login` redirige a `/proyectos` con sesión.
- [ ] Tests verdes (metrics, projects-list, summary, rls-authenticated + los previos); `npm test` completo verde; `npx tsc --noEmit` limpio; `npm run build` verde.
- [ ] e2e de navegador OK; START-HERE al día; desplegado.
- [ ] Sin escritura de negocio ni filtros en esta tajada.
