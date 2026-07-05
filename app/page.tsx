export default function Home() {
  return (
    <main className="grid min-h-screen place-items-center">
      <div className="text-center">
        <div className="mx-auto mb-4 grid size-8 place-items-center rounded-lg bg-tinta">
          <div className="size-3 rounded-full border-[3px] border-marca" />
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Cota</h1>
        <p className="mt-1 text-sm text-apagado">
          Mejoramiento de procesos · en construcción
        </p>
      </div>
    </main>
  );
}
