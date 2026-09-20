'use client'

// Next NO deja que error.tsx capture lo que lanza el layout.tsx de su MISMO segmento, y el
// layout de (app) es justo donde se leen `profiles` y `getSidebarClientes` (la capa de datos
// lanza ante cualquier error de query, incluida la guardia de truncamiento fail-closed).
// Sin este archivo ese fallo caía en la pantalla de error por defecto de Next.
//
// global-error reemplaza al layout raíz cuando se activa, así que tiene que traer su propio
// <html>, su propio <body> y sus propios estilos globales (las variables de next/font viven
// en el layout raíz y aquí NO existen: por eso la tipografía se fija a la del sistema).
//
// Misma regla que en app/(app)/error.tsx: NO se renderiza `error.message` — el texto de
// Postgrest no debe llegar al cliente.
import './globals.css'

// Next le pasa `error` y `reset`; aquí no se usa ninguno a propósito (ver el onClick).
export default function GlobalError() {
  return (
    <html lang="es">
      <body
        className="bg-panel text-tinta antialiased"
        style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif' }}
      >
        <div className="grid min-h-screen place-items-center px-7">
          <div className="max-w-md text-center">
            <h2 className="text-lg font-bold">No pudimos cargar esta pantalla</h2>
            <p className="mt-1.5 text-[12.5px] text-apagado">
              Hubo un problema al leer los datos. Reintenta; si persiste, avisa al equipo.
            </p>
            <button
              // Recarga dura, no reset(): el fallo viene de una lectura en el servidor, y
              // reset() solo limpia el estado del boundary y re-renderiza con la MISMA
              // carga RSC ya cacheada — volvería a lanzar y el botón parecería no hacer nada.
              onClick={() => window.location.reload()}
              className="mt-4 rounded-md border border-borde px-3 py-2 text-sm font-semibold hover:bg-white"
            >
              Reintentar
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
