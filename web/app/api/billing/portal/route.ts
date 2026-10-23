import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe/client";
import {
  getPublicSiteUrl,
  isSameOriginBillingRequest,
  isStripeCheckoutEnabled,
  isStripeServerConfigured,
} from "@/lib/stripe/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    if (userError || !user) {
      return NextResponse.json(
        { error: "Sign in to manage your subscription." },
        { status: 401 }
      );
    }

    const { data: subscription, error: subscriptionError } = await supabase
      .from("vallective_subscriptions")
      .select("provider, provider_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (subscriptionError) {
      throw new Error(
        `Billing customer could not be loaded: ${subscriptionError.message}`
      );
    }

    if (
      subscription?.provider !== "stripe" ||
      !subscription.provider_customer_id
    ) {
      return NextResponse.json(
        { error: "No Stripe subscription is connected to this account." },
        { status: 409 }
      );
    }

    const session = await getStripeClient().billingPortal.sessions.create({
      customer: subscription.provider_customer_id,
      return_url: `${getPublicSiteUrl(request.url)}/settings`,
    });

    return NextResponse.json(
      { url: session.url },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Stripe billing portal failed:", error);

    return NextResponse.json(
      { error: "The billing portal could not be opened right now." },
      { status: 500 }
    );
  }
}
