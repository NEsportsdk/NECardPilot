import type { Metadata } from "next";
import Link from "next/link";

import PublicFooter from "@/components/storefront/PublicFooter";
import PublicHeader from "@/components/storefront/PublicHeader";

import styles from "./pricing.module.css";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Choose a clear Vallective collection plan. Consumer prices include applicable VAT and there is no binding period.",
};

const plans = [
  {
    code: "free",
    name: "Free",
    price: "0",
    recommended: false,
    summary: "Start a real collection and learn the Vallective workflow.",
    features: [
      "Store up to 100 cards",
      "5 AI-assisted identifications per month",
      "2 market valuations per month",
      "Manual uploads do not use AI allowance",
    ],
  },
  {
    code: "collector",
    name: "Collector",
    price: "99",
    summary: "For an active personal collection that keeps growing.",
    features: [
      "Store up to 2,000 cards",
      "25 AI-assisted identifications per month",
      "5 market valuations per month",
      "Collection, purchase and sales history",
    ],
    recommended: true,
  },
  {
    code: "collector-plus",
    name: "Collector Plus",
    price: "199",
    recommended: false,
    summary: "For serious collectors with a larger portfolio and workflow.",
    features: [
      "Store up to 10,000 cards",
      "60 AI-assisted identifications per month",
      "15 market valuations per month",
      "More room for continuous collection work",
    ],
  },
] as const;

export default function PricingPage() {
  return (
    <div className={styles.page}>
      <PublicHeader />

      <main>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>Simple collector plans</p>
          <h1>Start free. Upgrade when your collection asks for more.</h1>
          <p>
            Every plan protects your collection workflow. Paid plans add room
            for more cards and carefully limited AI work, so there are no
            surprise usage bills.
          </p>
        </section>

        <section aria-label="Vallective plans" className={styles.planGrid}>
          {plans.map((plan) => (
            <article
              className={plan.recommended ? styles.recommendedPlan : undefined}
              key={plan.code}
            >
              {plan.recommended ? (
                <span className={styles.recommendedBadge}>Recommended</span>
              ) : null}
              <p className={styles.planName}>{plan.name}</p>
              <div className={styles.price}>
                <strong>{plan.price}</strong>
                <span>
                  DKK
                  {plan.price === "0" ? "" : " / month"}
                </span>
              </div>
              <p className={styles.taxLine}>
                {plan.price === "0" ? "No payment card required" : "Consumer price including VAT"}
              </p>
              <p className={styles.planSummary}>{plan.summary}</p>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <Link href="/signup">
                {plan.price === "0" ? "Create free account" : `Choose ${plan.name}`}
              </Link>
            </article>
          ))}
        </section>

        <section className={styles.assurance}>
          <div>
            <p className={styles.eyebrow}>Built for trust</p>
            <h2>Clear limits. No surprise AI charges.</h2>
          </div>
          <div className={styles.assuranceGrid}>
            <article>
              <strong>Cancel anytime</strong>
              <p>
                No binding period. Your paid access continues until the end of
                the current billing period.
              </p>
            </article>
            <article>
              <strong>Manual work stays available</strong>
              <p>
                Adding and editing card information manually does not spend AI
                identification or valuation allowance.
              </p>
            </article>
            <article>
              <strong>Your allowance is visible</strong>
              <p>
                Vallective shows card capacity and monthly AI usage before an
                action can create a cost.
              </p>
            </article>
          </div>
        </section>

        <section className={styles.finePrint}>
          <p>
            Monthly AI allowances reset each billing period. Identification and
            valuation results are decision support and should be reviewed before
            buying or selling a card. See the <Link href="/terms">subscription terms</Link>{" "}
            and <Link href="/privacy">privacy notice</Link>.
          </p>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
