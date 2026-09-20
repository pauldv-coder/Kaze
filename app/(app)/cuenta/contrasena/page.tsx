import { updatePassword } from './actions'

export default async function ContrasenaPage({
  searchParams,
}: { searchParams: Promise<{ error?: string; bienvenida?: string }> }) {
  const { error, bienvenida } = await searchParams
  return (
    // min-h-full, NO min-h-screen: dentro del <main> del shell (h-dvh) pedir 100vh
    // provocaba un scroll innecesario.
    <main className="min-h-full grid place-items-center bg-panel">
      <form action={updatePassword} className="w-80 bg-white border border-borde rounded-lg p-8 space-y-4">
        <h1 className="font-display text-xl font-bold">
          {bienvenida ? 'Bienvenido a Kaze' : 'Cambiar contraseña'}
        </h1>
        {bienvenida && <p className="text-xs text-apagado">Define tu contraseña para entrar.</p>}
        <input name="password" type="password" required minLength={8} placeholder="Nueva contraseña"
               className="w-full border border-borde rounded-md px-3 py-2 text-sm" />
        <input name="confirm" type="password" required minLength={8} placeholder="Confirmar contraseña"
               className="w-full border border-borde rounded-md px-3 py-2 text-sm" />
        {error && <p className="text-estado-mal text-xs">{error}</p>}
        <button className="w-full bg-tinta text-white rounded-md py-2 text-sm font-semibold">Guardar</button>
      </form>
    </main>
  )
}
