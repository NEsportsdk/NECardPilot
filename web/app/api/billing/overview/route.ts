import { NextResponse } from "next/server";

import {
  parseBillingOverview,
  parsePublicPlans,
} from "@/lib/billing/billingOverview";
import { createClient } from "@/lib/supabase/server";
import {
  isStripeCheckoutEnabled,
  isStripeServerConfigured,
} from "@/lib/stripe/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Sign in to view your Vallective plan." },
        { status: 401 }
      );
    }

    const [overviewResult, plansResult, subscriptionResult] = await Promise.all([
      supabase.rpc("get_vallective_billing_overview"),
      supabase
        .from("vallective_plans")
        .select(
          "code, display_name, monthly_price_dkk_ore, monthly_identification_limit, monthly_valuation_limit, storage_card_limit"
        )
        .eq("is_active", true)
        .eq("is_public", true)
        .order("monthly_price_dkk_ore", { ascending: true }),
      supabase
        .from("vallective_subscriptions")
        .select("provider, provider_customer_id")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (overviewResult.error) {
      throw new Error(
        `Billing overview could not be loaded: ${overviewResult.error.message}`
      );
    }

    if (plansResult.error) {
      throw new Error(
        `Public plans could not be loaded: ${plansResult.error.message}`
      );
    }

    if (subscriptionResult.error) {
      throw new Error(
        `Billing customer could not be loaded: ${subscriptionResult.error.message}`
      );
    }

    const checkoutAvailable =
      isStripeCheckoutEnabled() && isStripeServerConfigured();

    return NextResponse.json(
      {
        overview: parseBillingOverview(overviewResult.data),
        plans: parsePublicPlans(plansResult.data),
        billing: {
          checkoutAvailable,
          portalAvailable: Boolean(
            checkoutAvailable &&
              subscriptionResult.data?.provider === "stripe" &&
              subscriptionResult.data.provider_customer_id
          ),
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Billing overview failed:", error);

    return NextResponse.json(
      { error: "Your plan and usage could not be loaded right now." },
      { status: 500 }
    );
  }
}
