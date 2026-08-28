export function resolveNavigationPathname(
  browserPathname: string | null,
  routerPathname: string | null
) {
  return browserPathname || routerPathname || "/";
}
