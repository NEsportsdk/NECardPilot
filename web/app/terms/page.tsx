import type { Metadata } from "next";
import Link from "next/link";

import PublicLegalPage from "@/components/legal/PublicLegalPage";

export const metadata: Metadata = {
  title: "Subscription terms",
  description:
    "Terms for Vallective accounts and recurring collector subscriptions provided by NE Sports ApS.",
};

export default function TermsPage() {
  return (
    <PublicLegalPage
      eyebrow="Subscription terms"
      intro="These terms cover Vallective accounts and digital collection subscriptions. They are designed to make price, renewal, cancellation and AI allowances clear before you pay."
      title="Clear terms for your collection workspace."
    >
      <section>
        <h2>1. Provider and contact</h2>
        <p>
          Vallective is provided by NE Sports ApS, a Danish company. Questions
          about an account, subscription or these terms can be sent to the
          contact details below.
        </p>
        <address>
          <strong>NE Sports ApS</strong>
          <br />
          CVR 46212762
          <br />
          Platanvej 45, 5230 Odense M, Denmark
          <br />
          <a href="mailto:hello@vallective.com">hello@vallective.com</a>
        </address>
      </section>

      <section>
        <h2>2. The Vallective service</h2>
        <p>
          Vallective helps collectors capture, organize and understand trading
          cards. Depending on the selected plan, features can include card
          storage, AI-assisted identification, market research, portfolio
          history and sales workflows.
        </p>
        <p>
          Identification and valuation output is decision support. It can be
          incomplete or inaccurate and is not a guarantee of authenticity,
          grade, market value or a future sale price. You should review the
          result before relying on it for a purchase or sale.
        </p>
      </section>

      <section>
        <h2>3. Plans, prices and allowances</h2>
        <p>
          Current plan contents and prices are shown on the{" "}
          <Link href="/pricing">pricing page</Link> and immediately before
          checkout. Consumer prices are stated in Danish kroner and include
          applicable VAT. The tax treatment is shown at checkout.
        </p>
        <p>
          Monthly AI identification and valuation allowances reset at the start
          of each billing period. Unused allowance does not roll over. Manual
          card uploads and manual edits do not consume AI allowance. Vallective
          will not silently charge usage-based overage fees.
        </p>
      </section>

      <section>
        <h2>4. Payment and automatic renewal</h2>
        <p>
          Paid plans are recurring monthly subscriptions processed securely by
          Stripe. The price and billing interval are shown before you confirm.
          By completing checkout, you authorize NE Sports ApS to charge the
          selected price at the start of each billing period until you cancel.
        </p>
        <p>
          If a payment fails, access to paid features may be restricted after a
          reasonable attempt to notify you. Your underlying account and data are
          handled as described in these terms and the privacy notice.
        </p>
      </section>

      <section>
        <h2>5. Cancellation and plan changes</h2>
        <p>
          There is no binding period beyond the current paid month. You can
          cancel through the subscription controls in Vallective settings. A
          cancellation stops the next renewal, while paid access normally
          continues until the end of the current billing period.
        </p>
        <p>
          If you move to a plan with a lower card capacity, Vallective will not
          silently delete cards. Some actions may be limited until the
          collection fits the new allowance or the plan is upgraded again.
        </p>
      </section>

      <section>
        <h2>6. Right of withdrawal</h2>
        <p>
          Consumers generally have a 14-day right of withdrawal for an online
          service agreement. If you ask Vallective to begin providing the paid
          service during that period and later withdraw, NE Sports ApS may be
          entitled to payment for the proportion already supplied where Danish
          consumer law permits it.
        </p>
        <p>
          To exercise the right of withdrawal, send a clear statement to{" "}
          <a href="mailto:hello@vallective.com">hello@vallective.com</a>. Your
          statutory consumer rights are not limited by these terms.
        </p>
      </section>

      <section>
        <h2>7. Account responsibility and fair use</h2>
        <p>
          Keep account credentials secure and provide accurate information. Do
          not use Vallective to infringe rights, mislead buyers, bypass plan
          limits, disrupt the service or process material you are not entitled
          to use. We may restrict abusive or unlawful activity while taking
          reasonable care to protect legitimate collection data.
        </p>
      </section>

      <section>
        <h2>8. Availability and changes</h2>
        <p>
          Vallective is under active development. Features may evolve, and
          maintenance or external service failures can temporarily affect
          availability. Material changes to a paid plan or these terms will be
          communicated before they take effect. A price change applies no
          earlier than a future renewal after notice.
        </p>
      </section>

      <section>
        <h2>9. Data and account closure</h2>
        <p>
          Personal data is handled under the <Link href="/privacy">privacy notice</Link>.
          Cancelling a paid subscription does not automatically delete the
          account. Contact us if you want the account closed and eligible data
          deleted, subject to records we must retain by law.
        </p>
      </section>

      <section>
        <h2>10. Governing law and complaints</h2>
        <p>
          These terms are governed by Danish law, without limiting mandatory
          consumer protection available to you. Please contact NE Sports ApS
          first so we can try to resolve a complaint. Danish consumers may also
          use the applicable public consumer complaint system where its
          conditions are met.
        </p>
      </section>
    </PublicLegalPage>
  );
}
