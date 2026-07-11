import { login } from './actions'

export default async function LoginPage({
  searchParams,
}: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  return (
    <main className="min-h-screen grid place-items-center bg-panel">
      <form action={login} className="w-80 bg-white border border-borde rounded-lg p-8 space-y-4">
        <h1 className="font-display text-xl font-bold">Cota</h1>
        <input name="email" type="email" required placeholder="Correo"
               className="w-full border border-borde rounded-md px-3 py-2 text-sm" />
        <input name="password" type="password" required placeholder="Contraseña"
               className="w-full border border-borde rounded-md px-3 py-2 text-sm" />
        {error && <p className="text-estado-mal text-xs">{error}</p>}
        <button className="w-full bg-tinta text-white rounded-md py-2 text-sm font-semibold">
          Entrar
        </button>
      </form>
    </main>
  )
}
