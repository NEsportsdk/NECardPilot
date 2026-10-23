import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getBillingMode,
  getPlanCodeForStripePrice,
  getPublicSiteUrl,
  isPaidPlanCode,
  isSameOriginBillingRequest,
  isStripeCheckoutEnabled,
} from "./config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Stripe billing configuration", () => {
  it("only recognizes Vallective's public paid plans", () => {
    expect(isPaidPlanCode("collector")).toBe(true);
    expect(isPaidPlanCode("collector_plus")).toBe(true);
    expect(isPaidPlanCode("internal")).toBe(false);
    expect(isPaidPlanCode("free")).toBe(false);
  });

  it("keeps sandbox checkout away from production", () => {
    vi.stubEnv("VALLECTIVE_BILLING_MODE", "sandbox");
    vi.stubEnv("VERCEL_ENV", "preview");

    expect(getBillingMode()).toBe("sandbox");
    expect(isStripeCheckoutEnabled()).toBe(true);

    vi.stubEnv("VERCEL_ENV", "production");
    expect(isStripeCheckoutEnabled()).toBe(false);
  });

  it("maps configured Stripe prices and uses the preview origin in sandbox", () => {
    vi.stubEnv("VALLECTIVE_BILLING_MODE", "sandbox");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://vallective.com");
    vi.stubEnv("STRIPE_PRICE_COLLECTOR_MONTHLY_DKK", "price_collector");
    vi.stubEnv(
      "STRIPE_PRICE_COLLECTOR_PLUS_MONTHLY_DKK",
      "price_collector_plus"
    );

    expect(getPlanCodeForStripePrice("price_collector_plus")).toBe(
      "collector_plus"
    );
    expect(
      getPublicSiteUrl("https://preview.example.com/api/billing/checkout")
    ).toBe("https://preview.example.com");
  });

  it("accepts billing mutations only from the same browser origin", () => {
    expect(
      isSameOriginBillingRequest(
        new Request("https://preview.example.com/api/billing/checkout", {
          headers: { origin: "https://preview.example.com" },
        })
      )
    ).toBe(true);

    expect(
      isSameOriginBillingRequest(
        new Request("https://preview.example.com/api/billing/checkout", {
          headers: { origin: "https://malicious.example" },
        })
      )
    ).toBe(false);
  });
});
