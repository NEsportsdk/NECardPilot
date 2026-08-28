import { describe, expect, it } from "vitest";

import {
  isMobileMoreNavigationActive,
  isMobileNavigationItemActive,
  mobileNavigationPathnameFromSegment,
  mobilePrimaryNavigation,
  shouldShowMobileNavigation,
} from "@/lib/navigation/mobileNavigation";

describe("mobile navigation", () => {
  it("maps the root layout segment to the home pathname", () => {
    expect(mobileNavigationPathnameFromSegment(null)).toBe("/");
    expect(mobileNavigationPathnameFromSegment("scanner")).toBe("/scanner");
    expect(mobileNavigationPathnameFromSegment("auth")).toBe("/auth");
  });

  it("matches primary routes and their detail pages", () => {
    const cards = mobilePrimaryNavigation.find(
      (item) => item.label === "Cards"
    );

    expect(cards).toBeDefined();
    expect(isMobileNavigationItemActive("/cards", cards!)).toBe(true);
    expect(isMobileNavigationItemActive("/cards/card-123", cards!)).toBe(
      true
    );
    expect(isMobileNavigationItemActive("/scanner", cards!)).toBe(false);
  });

  it("treats an empty initial App Router pathname as the home route", () => {
    const home = mobilePrimaryNavigation.find(
      (item) => item.label === "Home"
    );

    expect(home).toBeDefined();
    expect(isMobileNavigationItemActive("", home!)).toBe(true);
    expect(shouldShowMobileNavigation("")).toBe(true);
  });

  it("marks the overflow entry active for secondary workspaces", () => {
    expect(isMobileMoreNavigationActive("/grading/submission-1")).toBe(true);
    expect(isMobileMoreNavigationActive("/analytics")).toBe(true);
    expect(isMobileMoreNavigationActive("/cards")).toBe(false);
  });

  it("stays hidden throughout authentication flows", () => {
    expect(shouldShowMobileNavigation("/login")).toBe(false);
    expect(shouldShowMobileNavigation("/auth/callback")).toBe(false);
    expect(shouldShowMobileNavigation("/change-password")).toBe(false);
    expect(shouldShowMobileNavigation("/forgot-password")).toBe(false);
    expect(shouldShowMobileNavigation("/signup")).toBe(false);
    expect(shouldShowMobileNavigation("/")).toBe(true);
  });
});
