const PUBLIC_ROUTE_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/auth",
  "/manifest.webmanifest",
  "/opengraph-image",
  "/twitter-image",
] as const;

const GUEST_ONLY_ROUTE_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
] as const;

function matchesRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTE_PREFIXES.some((route) => matchesRoute(pathname, route));
}

export function isGuestOnlyRoute(pathname: string) {
  return GUEST_ONLY_ROUTE_PREFIXES.some((route) =>
    matchesRoute(pathname, route)
  );
}
