import "server-only";

import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!secretKey) {
    throw new Error("Stripe is not configured in this environment.");
  }

  stripeClient ??= new Stripe(secretKey, {
    apiVersion: "2026-09-30.endive",
    appInfo: {
      name: "Vallective",
      version: "0.1.0",
      url: "https://vallective.com",
    },
  });

  return stripeClient;
}
