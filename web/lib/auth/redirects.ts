type AuthEnvironment = Partial<
  Record<
    | "NEXT_PUBLIC_SITE_URL"
    | "NEXT_PUBLIC_VERCEL_URL"
    | "VERCEL_ENV"
    | "VERCEL_PROJECT_PRODUCTION_URL"
    | "VERCEL_URL",
    string
  >
>;

function normalizeAbsoluteOrigin(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    const isLocalHttp =
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1");

    if (url.protocol !== "https:" && !isLocalHttp) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function normalizeVercelHost(value: string | undefined) {
  if (!value) {
    return null;
  }

  const withoutProtocol = value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "");

  if (!withoutProtocol || !/^[a-z0-9.-]+$/i.test(withoutProtocol)) {
    return null;
  }

  return `https://${withoutProtocol}`;
}

export function getAuthRedirectOrigin(
  environment: AuthEnvironment = process.env as AuthEnvironment
) {
  const configuredSiteUrl = normalizeAbsoluteOrigin(
    environment.NEXT_PUBLIC_SITE_URL
  );

  if (configuredSiteUrl) {
    return configuredSiteUrl;
  }

  const vercelHost =
    environment.VERCEL_ENV === "production"
      ? environment.VERCEL_PROJECT_PRODUCTION_URL ?? environment.VERCEL_URL
      : environment.VERCEL_URL ?? environment.NEXT_PUBLIC_VERCEL_URL;

  return normalizeVercelHost(vercelHost) ?? "http://localhost:3000";
}

export function getSafeNextPath(value: unknown, fallback = "/") {
  if (typeof value !== "string") {
    return fallback;
  }

  const candidate = value.trim();

  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return fallback;
  }

  try {
    const base = new URL("https://vallective.local");
    const resolved = new URL(candidate, base);

    if (resolved.origin !== base.origin) {
      return fallback;
    }

    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}
