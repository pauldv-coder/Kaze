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
