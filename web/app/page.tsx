export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
              Project Rookie
            </p>

            <h1 className="mt-2 text-4xl font-bold">NECardPilot</h1>

            <p className="mt-2 text-zinc-400">
              Dit intelligente cockpit til sportskort.
            </p>
          </div>

          <button className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-emerald-400">
            + Tilføj kort
          </button>
        </header>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <DashboardCard title="Kort i samlingen" value="0" />
          <DashboardCard title="Samlet værdi" value="0 kr." />
          <DashboardCard title="Hos PSA" value="0" />
          <DashboardCard title="Solgte kort" value="0" />
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 lg:col-span-2">
            <h2 className="text-xl font-semibold">Seneste aktivitet</h2>

            <div className="mt-8 rounded-xl border border-dashed border-zinc-700 p-10 text-center">
              <p className="font-medium">Ingen kort registreret endnu</p>

              <p className="mt-2 text-sm text-zinc-400">
                Dit første kort bliver begyndelsen på samlingen.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-xl font-semibold">Quick Scan</h2>

            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Scan et kort og få hjælp til identifikation, værdi og
              dubletkontrol.
            </p>

            <button className="mt-8 w-full rounded-xl border border-zinc-700 px-4 py-3 font-medium text-zinc-300">
              Kommer snart
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function DashboardCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <p className="text-sm text-zinc-400">{title}</p>
      <p className="mt-3 text-3xl font-bold">{value}</p>
    </article>
  );
}
