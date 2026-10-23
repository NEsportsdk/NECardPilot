import "server-only";

export const PAID_PLAN_CODES = ["collector", "collector_plus"] as const;

export type PaidPlanCode = (typeof PAID_PLAN_CODES)[number];
export type BillingMode = "disabled" | "sandbox" | "live";

const PRICE_ENV_BY_PLAN: Record<PaidPlanCode, string> = {
  collector: "STRIPE_PRICE_COLLECTOR_MONTHLY_DKK",
  collector_plus: "STRIPE_PRICE_COLLECTOR_PLUS_MONTHLY_DKK",
};

export function isPaidPlanCode(value: unknown): value is PaidPlanCode {
  return (
    typeof value === "string" &&
    (PAID_PLAN_CODES as readonly string[]).includes(value)
  );
}

export function getBillingMode(): BillingMode {
  const value = process.env.VALLECTIVE_BILLING_MODE?.trim().toLowerCase();

  return value === "sandbox" || value === "live" ? value : "disabled";
}

export function isStripeCheckoutEnabled() {
  const mode = getBillingMode();
  const vercelEnvironment = process.env.VERCEL_ENV?.trim().toLowerCase();

  if (mode === "sandbox") {
    return vercelEnvironment !== "production";
  }

  return mode === "live";
}

export function getStripePriceId(planCode: PaidPlanCode) {
  const priceId = process.env[PRICE_ENV_BY_PLAN[planCode]]?.trim();

  if (!priceId) {
    throw new Error(`Stripe price is not configured for ${planCode}.`);
  }

  return priceId;
}

export function getPlanCodeForStripePrice(
  priceId: string
): PaidPlanCode | null {
  for (const planCode of PAID_PLAN_CODES) {
    if (process.env[PRICE_ENV_BY_PLAN[planCode]]?.trim() === priceId) {
      return planCode;
    }
  }

  return null;
}

export function isStripeServerConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
      PAID_PLAN_CODES.every((planCode) => {
        const variableName = PRICE_ENV_BY_PLAN[planCode];
        return Boolean(process.env[variableName]?.trim());
      })
  );
}

export function getPublicSiteUrl(requestUrl?: string) {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (getBillingMode() === "sandbox" && requestUrl) {
    return new URL(requestUrl).origin;
  }

  if (configuredUrl) {
    return new URL(configuredUrl).origin;
  }

  if (requestUrl) {
    return new URL(requestUrl).origin;
  }

  return "http://localhost:3000";
}

export function isSameOriginBillingRequest(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return false;
  }

  return new URL(origin).origin === new URL(request.url).origin;
}
