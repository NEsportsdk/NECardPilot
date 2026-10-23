import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY is required.");
}

const stripe = new Stripe(secretKey, {
  apiVersion: "2026-09-30.endive",
  appInfo: {
    name: "Vallective sandbox setup",
    version: "0.1.0",
    url: "https://vallective.com",
  },
});

const plans = [
  {
    code: "collector",
    lookupKey: "vallective_collector_monthly_dkk",
    name: "Vallective Collector",
    price: 9900,
  },
  {
    code: "collector_plus",
    lookupKey: "vallective_collector_plus_monthly_dkk",
    name: "Vallective Collector Plus",
    price: 19900,
  },
];

const result = {};

for (const plan of plans) {
  const products = await stripe.products.search({
    query: `metadata['vallective_plan_code']:'${plan.code}'`,
  });
  const product = products.data[0]
    ? await stripe.products.update(products.data[0].id, {
        active: true,
        name: plan.name,
      })
    : await stripe.products.create({
        name: plan.name,
        metadata: { vallective_plan_code: plan.code },
      });
  const prices = await stripe.prices.list({
    active: true,
    lookup_keys: [plan.lookupKey],
    limit: 1,
  });
  const price =
    prices.data[0] ??
    (await stripe.prices.create({
      currency: "dkk",
      lookup_key: plan.lookupKey,
      product: product.id,
      recurring: { interval: "month" },
      unit_amount: plan.price,
    }));

  result[plan.code] = {
    priceId: price.id,
    productId: product.id,
  };
}

console.log(JSON.stringify(result, null, 2));
