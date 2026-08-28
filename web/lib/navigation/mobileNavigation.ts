export type MobileNavigationIcon =
  | "analytics"
  | "beta"
  | "cards"
  | "cardshow"
  | "collections"
  | "feedback"
  | "grading"
  | "home"
  | "more"
  | "scanner"
  | "settings"
  | "transactions";

export type MobileNavigationItem = {
  href: string;
  icon: MobileNavigationIcon;
  label: string;
  matches: (pathname: string) => boolean;
};

export const mobilePrimaryNavigation: MobileNavigationItem[] = [
  {
    href: "/",
    icon: "home",
    label: "Home",
    matches: (pathname) => pathname === "/",
  },
  {
    href: "/cards",
    icon: "cards",
    label: "Cards",
    matches: (pathname) => pathname.startsWith("/cards"),
  },
  {
    href: "/scanner",
    icon: "scanner",
    label: "Scan",
    matches: (pathname) => pathname.startsWith("/scanner"),
  },
  {
    href: "/#collections",
    icon: "collections",
    label: "Collections",
    matches: (pathname) => pathname.startsWith("/collections"),
  },
];

export const mobileMoreNavigation: MobileNavigationItem[] = [
  {
    href: "/grading",
    icon: "grading",
    label: "Grading",
    matches: (pathname) => pathname.startsWith("/grading"),
  },
  {
    href: "/cardshow",
    icon: "cardshow",
    label: "Cardshow",
    matches: (pathname) => pathname.startsWith("/cardshow"),
  },
  {
    href: "/transactions",
    icon: "transactions",
    label: "Transactions",
    matches: (pathname) => pathname.startsWith("/transactions"),
  },
  {
    href: "/analytics",
    icon: "analytics",
    label: "Analytics",
    matches: (pathname) => pathname.startsWith("/analytics"),
  },
  {
    href: "/beta",
    icon: "beta",
    label: "Beta pilot",
    matches: (pathname) => pathname.startsWith("/beta"),
  },
  {
    href: "/feedback",
    icon: "feedback",
    label: "Beta feedback",
    matches: (pathname) => pathname.startsWith("/feedback"),
  },
  {
    href: "/settings",
    icon: "settings",
    label: "Settings",
    matches: (pathname) =>
      pathname.startsWith("/settings") ||
      pathname.startsWith("/change-password"),
  },
];

const mobileNavigationExcludedRoutes = [
  "/auth",
  "/change-password",
  "/forgot-password",
  "/login",
  "/signup",
];

export function mobileNavigationPathnameFromSegment(segment: string | null) {
  return segment ? `/${segment}` : "/";
}

export function isMobileNavigationItemActive(
  pathname: string,
  item: MobileNavigationItem
) {
  return item.matches(pathname || "/");
}

export function isMobileMoreNavigationActive(pathname: string) {
  const currentPathname = pathname || "/";

  return mobileMoreNavigation.some((item) => item.matches(currentPathname));
}

export function shouldShowMobileNavigation(pathname: string) {
  const currentPathname = pathname || "/";

  return !mobileNavigationExcludedRoutes.some(
    (route) =>
      currentPathname === route || currentPathname.startsWith(`${route}/`)
  );
}
