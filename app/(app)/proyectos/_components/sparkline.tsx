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
