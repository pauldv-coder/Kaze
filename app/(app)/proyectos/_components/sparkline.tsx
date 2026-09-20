export function Sparkline({ serie }: { serie: number[] }) {
  const w = 88, h = 26, p = 4
  if (serie.length < 2) return null
  const min = Math.min(...serie), max = Math.max(...serie), rng = (max - min) || 1
  // Mismas fórmulas que antes, pero sin mutar nada dentro del .map(): el último punto se
  // deriva de su índice. Reasignar en el map rompía react-hooks/immutability (error de
  // ESLint) y bloqueaba al React Compiler. La salida es idéntica, punto por punto.
  const last = serie.length - 1
  const xAt = (i: number) => p + (i / last) * (w - 2 * p)
  const yAt = (v: number) => p + (1 - (v - min) / rng) * (h - 2 * p)
  const pts = serie.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="block h-[26px] w-[88px] shrink-0" aria-hidden>
      <polyline points={pts} fill="none" stroke="var(--color-marca)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={xAt(last).toFixed(1)} cy={yAt(serie[last]).toFixed(1)} r="2.6" fill="var(--color-marca)" />
    </svg>
  )
}
