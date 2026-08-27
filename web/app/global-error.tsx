"use client";

import { AppErrorFallback } from "@/components/system/AppErrorFallback";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="da">
      <body>
        <AppErrorFallback error={error} reset={reset} />
      </body>
    </html>
  );
}
