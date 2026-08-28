const PUBLIC_ROUTE_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/auth",
  "/_vercel",
  "/manifest.webmanifest",
  "/opengraph-image",
  "/twitter-image",
] as const;

const VERCEL_OBSERVABILITY_ROUTE =
  /^\/[a-f0-9]{16}\/(?:script\.js|event|session|view|vitals)$/;

const GUEST_ONLY_ROUTE_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
] as const;

function matchesRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function isPublicRoute(pathname: string) {
  return (
    PUBLIC_ROUTE_PREFIXES.some((route) => matchesRoute(pathname, route)) ||
    VERCEL_OBSERVABILITY_ROUTE.test(pathname)
  );
}

export function isGuestOnlyRoute(pathname: string) {
  return GUEST_ONLY_ROUTE_PREFIXES.some((route) =>
    matchesRoute(pathname, route)
  );
}
