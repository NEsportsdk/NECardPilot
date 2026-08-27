export type StructuredErrorContext = Record<
  string,
  boolean | null | number | string | undefined
>;

type ErrorWithDigest = Error & { digest?: unknown };

export type StructuredErrorEvent = StructuredErrorContext & {
  level: "error";
  event: string;
  source: "client" | "server";
  timestamp: string;
  errorName: string;
  errorMessage: string;
  errorDigest?: string;
};

function readDigest(error: ErrorWithDigest) {
  return error.digest === undefined ? undefined : String(error.digest);
}

export function normalizeRequestPath(path: string) {
  const [pathname] = path.split(/[?#]/, 1);
  return pathname || "/";
}

export function createStructuredErrorEvent({
  error,
  event,
  source,
  context = {},
  timestamp = new Date().toISOString(),
}: {
  error: unknown;
  event: string;
  source: StructuredErrorEvent["source"];
  context?: StructuredErrorContext;
  timestamp?: string;
}): StructuredErrorEvent {
  const normalizedError =
    error instanceof Error ? error : new Error(String(error));
  const digest = readDigest(normalizedError as ErrorWithDigest);

  return {
    level: "error",
    event,
    source,
    timestamp,
    errorName: normalizedError.name,
    errorMessage: normalizedError.message,
    ...(digest ? { errorDigest: digest } : {}),
    ...context,
  };
}
