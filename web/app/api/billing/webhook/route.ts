import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe/client";
import { syncStripeSubscription } from "@/lib/stripe/subscriptionSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function claimEvent(event: Stripe.Event) {
  const supabase = createAdminClient();
  const eventRecord = {
    attempt_count: 1,
    event_id: event.id,
    event_type: event.type,
    last_error: null,
    livemode: event.livemode,
    provider: "stripe",
    provider_created_at: new Date(event.created * 1000).toISOString(),
    status: "processing",
  };
  const { error: insertError } = await supabase
    .from("vallective_billing_events")
    .insert(eventRecord);

  if (!insertError) {
    return true;
  }

  if (insertError.code !== "23505") {
    throw new Error(`Billing event claim failed: ${insertError.message}`);
  }

  const { data: existing, error: existingError } = await supabase
    .from("vallective_billing_events")
    .select("status, attempt_count")
    .eq("provider", "stripe")
    .eq("event_id", event.id)
    .single();

  if (existingError) {
    throw new Error(`Billing event lookup failed: ${existingError.message}`);
  }

  if (existing.status !== "failed") {
    return false;
  }

  const { data: retryClaim, error: retryError } = await supabase
    .from("vallective_billing_events")
    .update({
      attempt_count: existing.attempt_count + 1,
      last_error: null,
      status: "processing",
    })
    .eq("provider", "stripe")
    .eq("event_id", event.id)
    .eq("status", "failed")
    .select("event_id")
    .maybeSingle();

  if (retryError) {
    throw new Error(`Billing event retry failed: ${retryError.message}`);
  }

  return Boolean(retryClaim);
}

async function finishEvent(
  eventId: string,
  status: "processed" | "ignored"
) {
  const { error } = await createAdminClient()
    .from("vallective_billing_events")
    .update({
      last_error: null,
      processed_at: new Date().toISOString(),
      status,
    })
    .eq("provider", "stripe")
    .eq("event_id", eventId);

  if (error) {
    throw new Error(`Billing event completion failed: ${error.message}`);
  }
}

async function failEvent(eventId: string, error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unknown billing event failure.";

  await createAdminClient()
    .from("vallective_billing_events")
    .update({
      last_error: message.slice(0, 500),
      status: "failed",
    })
    .eq("provider", "stripe")
    .eq("event_id", eventId);
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice) {
  return invoice.parent?.subscription_details
    ? invoice.parent.subscription_details.subscription
    : null;
}

async function processEvent(event: Stripe.Event) {
  const stripe = getStripeClient();

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;

      if (
        session.mode !== "subscription" ||
        session.payment_status === "unpaid" ||
        !subscriptionId
      ) {
        return "ignored" as const;
      }

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      return syncStripeSubscription({
        eventCreated: event.created,
        fallbackUserId: session.client_reference_id,
        subscription,
      });
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed": {
      const currentSubscription = await stripe.subscriptions.retrieve(
        event.data.object.id
      );

      return syncStripeSubscription({
        eventCreated: event.created,
        subscription: currentSubscription,
      });
    }

    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const subscriptionReference = subscriptionIdFromInvoice(invoice);
      const subscriptionId =
        typeof subscriptionReference === "string"
          ? subscriptionReference
          : subscriptionReference?.id;

      if (!subscriptionId) {
        return "ignored" as const;
      }

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      return syncStripeSubscription({
        eventCreated: event.created,
        invoiceStatus: invoice.status,
        subscription,
      });
    }

    case "checkout.session.async_payment_failed":
      return "ignored" as const;

    default:
      return "ignored" as const;
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook verification is not configured." },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = await getStripeClient().webhooks.constructEventAsync(
      await request.text(),
      signature,
      webhookSecret
    );
  } catch (error) {
    console.warn("Stripe webhook signature rejected:", error);

    return NextResponse.json(
      { error: "Invalid Stripe webhook signature." },
      { status: 400 }
    );
  }

  try {
    if (!(await claimEvent(event))) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    const status = await processEvent(event);
    await finishEvent(event.id, status);

    return NextResponse.json({ received: true });
  } catch (error) {
    await failEvent(event.id, error).catch((failureError) => {
      console.error("Stripe webhook failure could not be recorded:", failureError);
    });
    console.error("Stripe webhook processing failed:", error);

    return NextResponse.json(
      { error: "Stripe webhook processing failed." },
      { status: 500 }
    );
  }
}
