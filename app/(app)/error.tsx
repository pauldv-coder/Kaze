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
