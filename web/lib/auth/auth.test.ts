import { describe, expect, it } from "vitest";

import {
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  validateEmail,
  validatePassword,
  validateSignupInput,
} from "./forms";
import {
  getAuthSecret,
  getConfirmationCopy,
  getConfirmationFallbackPath,
  getEmailOtpType,
} from "./confirmation";
import { getAuthRedirectOrigin, getSafeNextPath } from "./redirects";
import { isGuestOnlyRoute, isPublicRoute } from "./routes";

describe("auth form validation", () => {
  it("normalizes email addresses", () => {
    expect(normalizeEmail("  USER@Example.COM ")).toBe("user@example.com");
  });

  it("rejects malformed email addresses", () => {
    expect(validateEmail("not-an-email").ok).toBe(false);
  });

  it("requires a strong password", () => {
    expect(validatePassword("a".repeat(MIN_PASSWORD_LENGTH)).ok).toBe(false);
    expect(validatePassword("SecurePassword9").ok).toBe(true);
  });

  it("accepts international uppercase and lowercase letters", () => {
    expect(validatePassword("ÉÉÉÉÉÉéééééé9").ok).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = validateSignupInput({
      displayName: "Niels",
      email: "niels@example.com",
      password: "SecurePassword9",
      confirmPassword: "DifferentPassword9",
    });

    expect(result.ok).toBe(false);
  });

  it("returns normalized signup data", () => {
    const result = validateSignupInput({
      displayName: "  Niels Eckhardt  ",
      email: " NIELS@example.com ",
      password: "SecurePassword9",
      confirmPassword: "SecurePassword9",
    });

    expect(result).toEqual({
      ok: true,
      data: {
        displayName: "Niels Eckhardt",
        email: "niels@example.com",
        password: "SecurePassword9",
      },
    });
  });
});

describe("auth redirects", () => {
  it("accepts local paths with query strings", () => {
    expect(getSafeNextPath("/cards?state=graded")).toBe(
      "/cards?state=graded"
    );
  });

  it.each([
    "https://evil.example",
    "//evil.example/path",
    "/\\evil.example/path",
    "javascript:alert(1)",
  ])("rejects unsafe redirect %s", (value) => {
    expect(getSafeNextPath(value, "/welcome")).toBe("/welcome");
  });

  it("prefers the configured production site URL", () => {
    expect(
      getAuthRedirectOrigin({
        NEXT_PUBLIC_SITE_URL: "https://vallective.com/path",
        VERCEL_URL: "preview.example.vercel.app",
      })
    ).toBe("https://vallective.com");
  });

  it("uses the preview host outside production", () => {
    expect(
      getAuthRedirectOrigin({
        VERCEL_ENV: "preview",
        VERCEL_URL: "preview-ne-7291.vercel.app",
      })
    ).toBe("https://preview-ne-7291.vercel.app");
  });

  it("falls back safely for invalid configuration", () => {
    expect(
      getAuthRedirectOrigin({ NEXT_PUBLIC_SITE_URL: "javascript:alert(1)" })
    ).toBe("http://localhost:3000");
  });
});

describe("auth link confirmation", () => {
  it("accepts supported one-time-password types", () => {
    expect(getEmailOtpType("signup")).toBe("signup");
    expect(getEmailOtpType("recovery")).toBe("recovery");
    expect(getEmailOtpType("unsupported")).toBeNull();
  });

  it("rejects missing or unreasonably large auth secrets", () => {
    expect(getAuthSecret(" token-hash ")).toBe("token-hash");
    expect(getAuthSecret(" ")).toBeNull();
    expect(getAuthSecret("x".repeat(2049))).toBeNull();
  });

  it("routes recovery links to password change", () => {
    expect(getConfirmationFallbackPath("recovery")).toBe(
      "/change-password"
    );
    expect(getConfirmationFallbackPath("signup")).toBe("/welcome");
    expect(getConfirmationCopy("recovery").buttonLabel).toBe(
      "Continue to password reset"
    );
  });
});

describe("auth route classification", () => {
  it("keeps callbacks public", () => {
    expect(isPublicRoute("/auth/confirm")).toBe(true);
  });

  it("keeps installable app metadata public", () => {
    expect(isPublicRoute("/manifest.webmanifest")).toBe(true);
    expect(isPublicRoute("/offline.html")).toBe(true);
    expect(isPublicRoute("/opengraph-image")).toBe(true);
    expect(isPublicRoute("/sw.js")).toBe(true);
    expect(isPublicRoute("/twitter-image")).toBe(true);
  });

  it("keeps Vercel observability assets and ingestion endpoints public", () => {
    expect(isPublicRoute("/_vercel/insights/script.js")).toBe(true);
    expect(isPublicRoute("/c2c51b1bdd6a144a/script.js")).toBe(true);
    expect(isPublicRoute("/c2c51b1bdd6a144a/view")).toBe(true);
    expect(isPublicRoute("/d24fe9315a3bb930/vitals")).toBe(true);
    expect(isPublicRoute("/c2c51b1bdd6a144a/cards")).toBe(false);
    expect(isPublicRoute("/not-a-hash/script.js")).toBe(false);
  });

  it("keeps app routes protected", () => {
    expect(isPublicRoute("/cards")).toBe(false);
  });

  it("redirects authenticated users away from entry pages", () => {
    expect(isGuestOnlyRoute("/login")).toBe(true);
    expect(isGuestOnlyRoute("/auth/confirm")).toBe(false);
  });
});
