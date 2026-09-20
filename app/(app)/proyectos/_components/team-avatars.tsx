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
