"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import { resolveNavigationPathname } from "@/lib/navigation/pathname";

function subscribeToBrowserPathname(onChange: () => void) {
  window.addEventListener("popstate", onChange);

  return () => {
    window.removeEventListener("popstate", onChange);
  };
}

function getBrowserPathnameSnapshot() {
  return window.location.pathname || "/";
}

function getServerPathnameSnapshot() {
  return null;
}

export function useResolvedPathname() {
  const routerPathname = usePathname();
  const browserPathname = useSyncExternalStore(
    subscribeToBrowserPathname,
    getBrowserPathnameSnapshot,
    getServerPathnameSnapshot
  );

  return resolveNavigationPathname(browserPathname, routerPathname);
}
