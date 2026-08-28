"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { resolveNavigationPathname } from "@/lib/navigation/pathname";

export function useResolvedPathname() {
  const routerPathname = usePathname();
  const [browserPathname, setBrowserPathname] = useState<string | null>(null);

  useEffect(() => {
    setBrowserPathname(window.location.pathname || "/");
  }, [routerPathname]);

  return resolveNavigationPathname(browserPathname, routerPathname);
}
