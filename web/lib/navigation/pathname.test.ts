import { describe, expect, it } from "vitest";

import { resolveNavigationPathname } from "@/lib/navigation/pathname";

describe("navigation pathname", () => {
  it("prefers the browser URL after hydration", () => {
    expect(resolveNavigationPathname("/", "/scanner")).toBe("/");
    expect(resolveNavigationPathname("/cards", "/scanner")).toBe("/cards");
  });

  it("uses the App Router pathname while hydrating", () => {
    expect(resolveNavigationPathname(null, "/scanner")).toBe("/scanner");
  });

  it("falls back to home when neither source has a pathname", () => {
    expect(resolveNavigationPathname(null, null)).toBe("/");
  });
});
