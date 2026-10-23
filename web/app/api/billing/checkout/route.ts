import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import {
  CURRENT_TERMS_VERSION,
  hasAcceptedCurrentTerms,
} from "@/lib/legal/consent";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe/client";
import {
  getPublicSiteUrl,
  getStripePriceId,
  isPaidPlanCode,
  isSameOriginBillingRequest,
  isStripeCheckoutEnabled,
  isStripeServerConfigured,
  isStripeTaxEnabled,
} from "@/lib/stripe/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function integrationIdentifier() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";

  return `vallective_${Array.from(randomBytes(8), (value) =>
    alphabet[value % alphabet.length]
  ).join("")}`;
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginBillingRequest(request)) {
      return NextResponse.json(
        { error: "This billing request was not accepted." },
        { status: 403 }
      );
    }

    if (!isStripeCheckoutEnabled() || !isStripeServerConfigured()) {
      return NextResponse.json(
        { error: "Vallective billing is not open in this environment." },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      return NextResponse.json(
        { error: "Sign in with a verified email to choose a plan." },
        { status: 401 }
      );
    }

    const payload = (await request.json().catch(() => null)) as
      | {
          acceptedTerms?: unknown;
          planCode?: unknown;
          termsVersion?: unknown;
        }
      | null;

    if (!payload || !isPaidPlanCode(payload.planCode)) {
      return NextResponse.json(
        { error: "Choose a valid Vallective plan." },
        { status: 400 }
      );
    }

    if (!hasAcceptedCurrentTerms(payload)) {
      return NextResponse.json(
        { error: "Accept the current subscription terms before checkout." },
        { status: 400 }
      );
    }

    const { data: subscription, error: subscriptionError } = await supabase
      .from("vallective_subscriptions")
      .select("plan_code, status, provider, provider_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (subscriptionError) {
      throw new Error(
        `Current subscription could not be loaded: ${subscriptionError.message}`
      );
    }

    if (
      subscription?.provider === "manual" &&
      subscription.plan_code === "internal"
    ) {
      return NextResponse.json(
        { error: "This account already has managed Vallective access." },
        { status: 409 }
      );
    }

    if (
      subscription?.provider === "stripe" &&
      ["active", "trialing", "past_due", "paused"].includes(
        subscription.status
      )
    ) {
      return NextResponse.json(
        { error: "Manage your existing subscription in the billing portal." },
        { status: 409 }
      );
    }

    const stripe = getStripeClient();
    const siteUrl = getPublicSiteUrl(request.url);
    const customerId =
      subscription?.provider === "stripe"
        ? subscription.provider_customer_id
        : null;
    const acceptedAt = new Date().toISOString();
    const taxEnabled = isStripeTaxEnabled();
    const session = await stripe.checkout.sessions.create(
      {
        automatic_tax: { enabled: taxEnabled },
        cancel_url: `${siteUrl}/settings?billing=canceled`,
        client_reference_id: user.id,
        customer: customerId || undefined,
        customer_email: customerId ? undefined : user.email,
        integration_identifier: integrationIdentifier(),
        line_items: [
          {
            price: getStripePriceId(payload.planCode),
            quantity: 1,
          },
        ],
        metadata: {
          vallective_plan_code: payload.planCode,
          vallective_terms_accepted_at: acceptedAt,
          vallective_terms_version: CURRENT_TERMS_VERSION,
          vallective_user_id: user.id,
        },
        mode: "subscription",
        subscription_data: {
          metadata: {
            vallective_plan_code: payload.planCode,
            vallective_terms_accepted_at: acceptedAt,
            vallective_terms_version: CURRENT_TERMS_VERSION,
            vallective_user_id: user.id,
          },
        },
        success_url: `${siteUrl}/settings?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      },
      {
        idempotencyKey: `vallective-checkout-${user.id}-${payload.planCode}-${Math.floor(
          Date.now() / 60_000
        )}`,
      }
    );

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }

    return NextResponse.json(
      { url: session.url },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Stripe checkout failed:", error);

    return NextResponse.json(
      { error: "Secure checkout could not be opened right now." },
      { status: 500 }
    );
  }
}
