import "server-only";

import type Stripe from "stripe";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPlanCodeForStripePrice,
  isPaidPlanCode,
  type PaidPlanCode,
} from "@/lib/stripe/config";

type BillingEventStatus = "processed" | "ignored";

function stripeId(value: string | { id: string } | null | undefined) {
  if (!value) {
    return null;
  }

  return typeof value === "string" ? value : value.id;
}

function mapSubscriptionStatus(
  status: Stripe.Subscription.Status
): "active" | "trialing" | "past_due" | "paused" | "canceled" {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "paused":
      return "paused";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "past_due";
  }
}

function subscriptionPeriod(subscription: Stripe.Subscription) {
  const starts = subscription.items.data.map(
    (item) => item.current_period_start
  );
  const ends = subscription.items.data.map((item) => item.current_period_end);

  if (!starts.length || !ends.length) {
    throw new Error("Stripe subscription has no billing period.");
  }

  return {
    start: new Date(Math.min(...starts) * 1000).toISOString(),
    end: new Date(Math.max(...ends) * 1000).toISOString(),
  };
}

function resolvePlanCode(subscription: Stripe.Subscription): PaidPlanCode {
  const priceId = subscription.items.data[0]?.price.id;
  const planFromPrice = priceId
    ? getPlanCodeForStripePrice(priceId)
    : null;
  const planFromMetadata = subscription.metadata.vallective_plan_code;

  if (planFromPrice) {
    return planFromPrice;
  }

  if (isPaidPlanCode(planFromMetadata)) {
    return planFromMetadata;
  }

  throw new Error("Stripe subscription does not match a Vallective plan.");
}

async function findUserId(
  customerId: string,
  subscription: Stripe.Subscription,
  fallbackUserId?: string | null
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("vallective_subscriptions")
    .select("user_id")
    .eq("provider", "stripe")
    .eq("provider_customer_id", customerId)
    .maybeSingle();

  if (error) {
    throw new Error(`Stripe customer lookup failed: ${error.message}`);
  }

  return (
    data?.user_id ??
    fallbackUserId ??
    subscription.metadata.vallective_user_id ??
    null
  );
}

export async function syncStripeSubscription({
  eventCreated,
  fallbackUserId,
  invoiceStatus,
  subscription,
}: {
  eventCreated: number;
  fallbackUserId?: string | null;
  invoiceStatus?: string | null;
  subscription: Stripe.Subscription;
}): Promise<BillingEventStatus> {
  const customerId = stripeId(subscription.customer);
  const priceId = subscription.items.data[0]?.price.id;

  if (!customerId || !priceId) {
    throw new Error("Stripe subscription identity is incomplete.");
  }

  const userId = await findUserId(
    customerId,
    subscription,
    fallbackUserId
  );

  if (!userId) {
    throw new Error("Stripe subscription could not be matched to a user.");
  }

  const period = subscriptionPeriod(subscription);
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    "sync_vallective_stripe_subscription",
    {
      requested_cancel_at_period_end: subscription.cancel_at_period_end,
      requested_canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
      requested_customer_id: customerId,
      requested_event_created_at: new Date(eventCreated * 1000).toISOString(),
      requested_invoice_status: invoiceStatus ?? null,
      requested_period_end: period.end,
      requested_period_start: period.start,
      requested_plan_code: resolvePlanCode(subscription),
      requested_price_id: priceId,
      requested_status: mapSubscriptionStatus(subscription.status),
      requested_subscription_id: subscription.id,
      requested_user_id: userId,
    }
  );

  if (error) {
    throw new Error(`Stripe subscription sync failed: ${error.message}`);
  }

  return data === "applied" ? "processed" : "ignored";
}
