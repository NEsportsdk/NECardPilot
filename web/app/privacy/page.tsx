import type { Metadata } from "next";

import PublicLegalPage from "@/components/legal/PublicLegalPage";

export const metadata: Metadata = {
  title: "Privacy notice",
  description:
    "How NE Sports ApS handles personal information when you use Vallective.",
};

export default function PrivacyPage() {
  return (
    <PublicLegalPage
      eyebrow="Privacy notice"
      intro="Your collection can be personal. This notice explains what Vallective processes, why it is needed and the choices you have."
      title="Your data should be as carefully handled as your cards."
    >
      <section>
        <h2>1. Data controller</h2>
        <p>NE Sports ApS is responsible for personal data processed through Vallective.</p>
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
        <h2>2. Information we process</h2>
        <ul>
          <li>Account information such as name, email address and authentication records.</li>
          <li>Collection content, including card photos, descriptions, prices, purchase and sales history.</li>
          <li>Usage and technical information needed for security, operation, diagnostics and plan limits.</li>
          <li>Subscription and transaction references from Stripe. Vallective does not store full payment-card details.</li>
          <li>Messages, feedback and support correspondence you choose to send.</li>
        </ul>
      </section>

      <section>
        <h2>3. Why we use the information</h2>
        <p>
          We process data to create and secure your account, deliver collection
          features, perform requested AI work, administer subscriptions, provide
          support, prevent misuse and improve reliability. The legal basis is
          typically performance of our agreement, compliance with legal
          obligations, consent where requested, and our legitimate interest in
          operating and protecting Vallective.
        </p>
      </section>

      <section>
        <h2>4. AI-assisted features</h2>
        <p>
          When you request identification or market assistance, relevant card
          images and information may be sent to an AI service provider to
          produce the result. Only use images and information you are entitled
          to process. AI results can be wrong and should be reviewed by you.
        </p>
      </section>

      <section>
        <h2>5. Service providers</h2>
        <p>
          Vallective uses specialist providers to operate the service. These can
          include Supabase for authentication and data storage, Vercel for
          hosting and operational analytics, Stripe for subscriptions and
          payments, Resend for transactional email, OpenAI for requested AI
          processing, and Shopify for webshop functions. Providers process data
          under their own security commitments and applicable data-processing
          terms.
        </p>
      </section>

      <section>
        <h2>6. International transfers</h2>
        <p>
          Some providers may process information outside Denmark or the EEA.
          Where required, transfers rely on an adequacy decision, approved
          contractual safeguards or another lawful transfer mechanism.
        </p>
      </section>

      <section>
        <h2>7. Retention and deletion</h2>
        <p>
          Account and collection information is generally retained while the
          account is active. After closure, information is deleted or anonymized
          when it is no longer needed, except where security, dispute resolution,
          accounting or other legal obligations require a longer period. Backup
          copies may remain for a limited operational period before rotation.
        </p>
      </section>

      <section>
        <h2>8. Cookies and operational analytics</h2>
        <p>
          Vallective uses essential session technology to keep accounts secure
          and signed in. We also use aggregated operational analytics to
          understand performance and improve the service. Optional tracking will
          not be introduced without the notices and choices required by law.
        </p>
      </section>

      <section>
        <h2>9. Your rights</h2>
        <p>
          Depending on the circumstances, you may request access, correction,
          deletion, restriction, objection or portability of your personal data,
          and withdraw consent where processing relies on consent. Contact{" "}
          <a href="mailto:hello@vallective.com">hello@vallective.com</a>. We may
          need to verify your identity before completing a request.
        </p>
        <p>
          You can also complain to the Danish Data Protection Agency
          (Datatilsynet) if you believe personal data has been handled unlawfully.
        </p>
      </section>

      <section>
        <h2>10. Updates</h2>
        <p>
          This notice may be updated as Vallective develops. Material changes
          will be communicated through the service or by email where appropriate.
          The effective date at the top identifies the current version.
        </p>
      </section>
    </PublicLegalPage>
  );
}
