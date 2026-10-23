"use client";

import { useEffect, useState } from "react";

import type {
  BillingOverview,
  BillingUsageMetric,
  PublicPlan,
} from "@/lib/billing/billingOverview";

type BillingOverviewResponse = {
  overview: BillingOverview;
  plans: PublicPlan[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatPrice(monthlyPriceDkkOre: number) {
  if (monthlyPriceDkkOre === 0) {
    return "Free";
  }

  return `${new Intl.NumberFormat("da-DK").format(
    monthlyPriceDkkOre / 100
  )} DKK / month`;
}

function formatLimit(value: number | null) {
  return value === null
    ? "Unlimited"
    : new Intl.NumberFormat("en-GB").format(value);
}

function usagePercentage(metric: BillingUsageMetric) {
  if (metric.limit === null || metric.limit === 0) {
    return metric.used > 0 ? 100 : 0;
  }

  return Math.min((metric.used / metric.limit) * 100, 100);
}

function UsageMeter({
  description,
  label,
  metric,
}: {
  description: string;
  label: string;
  metric: BillingUsageMetric;
}) {
  const percentage = usagePercentage(metric);
  const remainingLabel =
    metric.remaining === null
      ? "No fixed limit"
      : `${formatLimit(metric.remaining)} remaining`;

  return (
    <div className="usage-meter">
      <div className="usage-heading">
        <div>
          <strong>{label}</strong>
          <span>{description}</span>
        </div>
        <p>
          {formatLimit(metric.used)} / {formatLimit(metric.limit)}
        </p>
      </div>
      <div
        aria-label={`${label}: ${remainingLabel}`}
        aria-valuemax={metric.limit ?? undefined}
        aria-valuemin={0}
        aria-valuenow={metric.limit === null ? undefined : metric.used}
        aria-valuetext={remainingLabel}
        className="usage-track"
        role="progressbar"
      >
        <span style={{ width: `${percentage}%` }} />
      </div>
      <small>{remainingLabel}</small>

      <style jsx>{`
        .usage-meter {
          min-width: 0;
          padding: 17px;
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 15px;
          background: rgba(5, 7, 12, 0.42);
        }

        .usage-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .usage-heading > div {
          min-width: 0;
          display: grid;
          gap: 4px;
        }

        strong {
          color: #f8fafc;
          font-size: 12px;
        }

        .usage-heading span,
        small {
          color: #697286;
          font-size: 9px;
          line-height: 1.45;
        }

        .usage-heading p {
          margin: 0;
          flex: 0 0 auto;
          color: #c4b5fd;
          font-size: 10px;
          font-weight: 800;
        }

        .usage-track {
          height: 6px;
          margin: 14px 0 8px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.1);
        }

        .usage-track span {
          height: 100%;
          display: block;
          border-radius: inherit;
          background: linear-gradient(90deg, #7c5cff, #a99dff);
          transition: width 300ms ease;
        }
      `}</style>
    </div>
  );
}

export default function BillingOverviewCard() {
  const [data, setData] = useState<BillingOverviewResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function loadBillingOverview() {
      try {
        const response = await fetch("/api/billing/overview", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        const payload = (await response.json()) as
          | BillingOverviewResponse
          | { error?: string };

        if (!response.ok || !("overview" in payload)) {
          throw new Error(
            "error" in payload && payload.error
              ? payload.error
              : "Your plan could not be loaded."
          );
        }

        setData(payload);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Your plan could not be loaded."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadBillingOverview();

    return () => controller.abort();
  }, []);

  return (
    <section className="billing-card" aria-labelledby="billing-heading">
      <div className="billing-header">
        <div>
          <p className="eyebrow">Plan & usage</p>
          <h2 id="billing-heading">
            {data?.overview.planName ?? "Your Vallective allowance"}
          </h2>
          <p className="billing-intro">
            Track stored cards and paid AI work before it can create a cost.
          </p>
        </div>

        {data ? (
          <div className="plan-status">
            <strong>{formatPrice(data.overview.monthlyPriceDkkOre)}</strong>
            <span>{data.overview.subscriptionStatus}</span>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="billing-state" aria-live="polite">
          <span className="spinner" />
          Loading plan and usage...
        </div>
      ) : error ? (
        <p className="billing-error" role="alert">
          {error}
        </p>
      ) : data ? (
        <>
          <div className="usage-grid">
            <UsageMeter
              description="Cards kept in your personal collection"
              label="Card capacity"
              metric={data.overview.storage}
            />
            <UsageMeter
              description="AI-assisted card matches this period"
              label="Identifications"
              metric={data.overview.identification}
            />
            <UsageMeter
              description="AI market research requests this period"
              label="Valuations"
              metric={data.overview.valuation}
            />
          </div>

          <div className="billing-footer">
            <p>
              AI allowance resets {formatDate(data.overview.periodEnd)}. Manual
              uploads do not spend AI allowance.
            </p>
            <span>
              {data.overview.subscriptionProvider === "manual"
                ? "Managed Vallective access"
                : data.overview.subscriptionProvider
                  ? `Billing via ${data.overview.subscriptionProvider}`
                  : "No payment method required"}
            </span>
          </div>

          {data.overview.planCode !== "internal" ? (
            <div className="plan-options" aria-label="Available plans">
              {data.plans.map((plan) => (
                <article
                  className={
                    plan.code === data.overview.planCode ? "current-plan" : ""
                  }
                  key={plan.code}
                >
                  <div>
                    <strong>{plan.displayName}</strong>
                    <span>{formatPrice(plan.monthlyPriceDkkOre)}</span>
                  </div>
                  <p>
                    {formatLimit(plan.storageCardLimit)} cards ·{" "}
                    {formatLimit(plan.monthlyIdentificationLimit)} AI matches ·{" "}
                    {formatLimit(plan.monthlyValuationLimit)} valuations
                  </p>
                  {plan.code === data.overview.planCode ? (
                    <small>Current plan</small>
                  ) : null}
                </article>
              ))}
              <p className="checkout-note">
                Secure self-service upgrades will open when Vallective billing
                is connected. Limits are already enforced safely.
              </p>
            </div>
          ) : null}
        </>
      ) : null}

      <style jsx>{`
        .billing-card {
          grid-column: 1 / -1;
          padding: 27px;
          border: 1px solid rgba(167, 139, 250, 0.22);
          border-radius: 22px;
          background:
            radial-gradient(
              circle at 100% 0%,
              rgba(124, 92, 255, 0.14),
              transparent 34%
            ),
            rgba(16, 19, 27, 0.98);
          box-shadow: 0 22px 60px rgba(0, 0, 0, 0.2);
        }

        .billing-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
        }

        .eyebrow {
          margin: 0 0 9px;
          color: #9f93ff;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        h2 {
          margin: 0;
          color: #ffffff;
          font-size: 24px;
          letter-spacing: -0.04em;
        }

        .billing-intro {
          margin: 9px 0 0;
          color: #747d90;
          font-size: 10px;
          line-height: 1.6;
        }

        .plan-status {
          display: grid;
          gap: 4px;
          padding: 10px 13px;
          border: 1px solid rgba(52, 211, 153, 0.18);
          border-radius: 13px;
          background: rgba(16, 185, 129, 0.07);
          text-align: right;
        }

        .plan-status strong {
          color: #d1fae5;
          font-size: 11px;
        }

        .plan-status span {
          color: #6ee7b7;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .billing-state {
          min-height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: #7d8598;
          font-size: 11px;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(148, 163, 184, 0.14);
          border-top-color: #9f93ff;
          border-radius: 50%;
          animation: spin 750ms linear infinite;
        }

        .billing-error {
          margin: 22px 0 0;
          padding: 13px 14px;
          border: 1px solid rgba(248, 113, 113, 0.22);
          border-radius: 12px;
          background: rgba(239, 68, 68, 0.07);
          color: #fecaca;
          font-size: 10px;
        }

        .usage-grid {
          margin-top: 24px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 13px;
        }

        .billing-footer {
          margin-top: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .billing-footer p,
        .billing-footer span,
        .checkout-note {
          margin: 0;
          color: #687185;
          font-size: 9px;
          line-height: 1.55;
        }

        .billing-footer span {
          color: #9f93ff;
          font-weight: 750;
        }

        .plan-options {
          margin-top: 22px;
          padding-top: 20px;
          border-top: 1px solid rgba(148, 163, 184, 0.09);
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .plan-options article {
          padding: 14px;
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 13px;
          background: rgba(5, 7, 12, 0.32);
        }

        .plan-options article.current-plan {
          border-color: rgba(167, 139, 250, 0.34);
          background: rgba(124, 92, 255, 0.08);
        }

        .plan-options article > div {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 10px;
        }

        .plan-options strong {
          color: #f8fafc;
          font-size: 11px;
        }

        .plan-options span,
        .plan-options small {
          color: #c4b5fd;
          font-size: 8px;
          font-weight: 800;
        }

        .plan-options article p {
          margin: 8px 0 0;
          color: #697286;
          font-size: 8px;
          line-height: 1.55;
        }

        .plan-options small {
          display: block;
          margin-top: 8px;
          text-transform: uppercase;
          letter-spacing: 0.07em;
        }

        .checkout-note {
          grid-column: 1 / -1;
          padding: 2px 4px 0;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 820px) {
          .usage-grid,
          .plan-options {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 560px) {
          .billing-card {
            padding: 20px;
            border-radius: 18px;
          }

          .billing-header,
          .billing-footer {
            align-items: flex-start;
            flex-direction: column;
          }

          .plan-status {
            width: 100%;
            text-align: left;
          }
        }
      `}</style>
    </section>
  );
}
