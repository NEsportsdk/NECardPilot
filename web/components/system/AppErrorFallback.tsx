"use client";

import { useEffect } from "react";
import { createStructuredErrorEvent } from "@/lib/observability/errorReporting";

export function AppErrorFallback({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify(
        createStructuredErrorEvent({
          error,
          event: "react_error_boundary",
          source: "client",
          context: {
            path: window.location.pathname,
          },
        })
      )
    );
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-16 text-zinc-100">
      <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-900 p-8 text-center shadow-2xl shadow-black/30">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-400">
          NECardPilot
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          Noget gik galt
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Fejlen er registreret. Prøv igen, eller genindlæs siden hvis
          problemet fortsætter.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-7 rounded-xl bg-amber-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
        >
          Prøv igen
        </button>
        {error.digest ? (
          <p className="mt-5 text-xs text-zinc-500">
            Fejlreference: {error.digest}
          </p>
        ) : null}
      </section>
    </main>
  );
}
