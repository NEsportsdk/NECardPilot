"use client";

import Link from "next/link";

type FirstRunOnboardingProps = {
  cardsCount: number;
  collectionsCount: number;
  displayName: string;
  firstCardId?: string;
  onAddCard: () => void;
  onCreateCollection: () => void;
  valuedCardsCount: number;
};

type OnboardingStep = {
  title: string;
  description: string;
  complete: boolean;
  icon: string;
};

export default function FirstRunOnboarding({
  cardsCount,
  collectionsCount,
  displayName,
  firstCardId,
  onAddCard,
  onCreateCollection,
  valuedCardsCount,
}: FirstRunOnboardingProps) {
  const steps: OnboardingStep[] = [
    {
      title: "Account ready",
      description: `${displayName}, your secure collector workspace is active.`,
      complete: true,
      icon: "✓",
    },
    {
      title: "Create your first collection",
      description: "Separate personal cards from dealer inventory from day one.",
      complete: collectionsCount > 0,
      icon: "◇",
    },
    {
      title: "Add your first card",
      description: "Scan both sides with AI or register the card manually.",
      complete: cardsCount > 0,
      icon: "◎",
    },
    {
      title: "Build a valuation-ready portfolio",
      description: "Confirm card data and add a market or manual valuation.",
      complete: valuedCardsCount > 0,
      icon: "⌁",
    },
  ];
  const completedSteps = steps.filter((step) => step.complete).length;
  const progress = Math.round((completedSteps / steps.length) * 100);

  if (completedSteps === steps.length) {
    return null;
  }

  return (
    <section className="onboarding" aria-labelledby="onboarding-title">
      <div className="onboarding-copy">
        <p className="eyebrow">First run</p>
        <h2 id="onboarding-title">Turn your cards into collector intelligence</h2>
        <p>
          Complete these four steps to unlock the full dashboard, market
          coverage and performance insights.
        </p>

        <div
          className="progress-track"
          role="progressbar"
          aria-label="Onboarding progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <span style={{ width: `${progress}%` }} />
        </div>

        <div className="progress-copy">
          <strong>{completedSteps} of {steps.length} complete</strong>
          <span>{progress}%</span>
        </div>

        <div className="onboarding-action">
          {collectionsCount === 0 ? (
            <button type="button" onClick={onCreateCollection}>
              Create first collection
              <span aria-hidden="true">→</span>
            </button>
          ) : cardsCount === 0 ? (
            <div className="action-group">
              <button type="button" onClick={onAddCard}>
                Add first card
                <span aria-hidden="true">→</span>
              </button>
              <Link href="/scanner">Open AI scanner</Link>
            </div>
          ) : (
            <Link className="primary-link" href={firstCardId ? `/cards/${firstCardId}` : "/cards"}>
              Complete first valuation
              <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      </div>

      <ol className="step-list">
        {steps.map((step, index) => (
          <li className={step.complete ? "step-complete" : ""} key={step.title}>
            <span className="step-icon" aria-hidden="true">
              {step.complete ? "✓" : step.icon}
            </span>
            <div>
              <small>Step {index + 1}</small>
              <strong>{step.title}</strong>
              <p>{step.description}</p>
            </div>
          </li>
        ))}
      </ol>

      <style jsx>{`
        .onboarding {
          max-width: 1400px;
          margin: 0 auto 20px;
          display: grid;
          grid-template-columns: minmax(0, 0.85fr) minmax(500px, 1.15fr);
          gap: 30px;
          padding: 28px;
          overflow: hidden;
          border: 1px solid rgba(139, 92, 246, 0.25);
          border-radius: 22px;
          background:
            radial-gradient(
              circle at 10% 0%,
              rgba(139, 92, 246, 0.16),
              transparent 38%
            ),
            radial-gradient(
              circle at 100% 100%,
              rgba(59, 130, 246, 0.08),
              transparent 38%
            ),
            #10131d;
          box-shadow: 0 22px 65px rgba(0, 0, 0, 0.24);
        }

        .eyebrow {
          margin: 0 0 9px;
          color: #a89cff;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .onboarding-copy h2 {
          max-width: 520px;
          margin: 0;
          color: #ffffff;
          font-size: clamp(25px, 2.5vw, 38px);
          letter-spacing: -0.045em;
          line-height: 1.08;
        }

        .onboarding-copy > p:not(.eyebrow) {
          max-width: 530px;
          margin: 14px 0 0;
          color: #7f8799;
          font-size: 11px;
          line-height: 1.65;
        }

        .progress-track {
          height: 8px;
          overflow: hidden;
          margin-top: 23px;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.1);
        }

        .progress-track span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #8b5cf6, #a78bfa, #60a5fa);
          box-shadow: 0 0 20px rgba(139, 92, 246, 0.35);
          transition: width 300ms ease;
        }

        .progress-copy {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 8px;
          color: #71798b;
          font-size: 9px;
        }

        .progress-copy strong {
          color: #a8afbd;
        }

        .onboarding-action {
          margin-top: 24px;
        }

        .onboarding-action button,
        .primary-link {
          min-height: 48px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          padding: 0 18px;
          border: 0;
          border-radius: 13px;
          background: linear-gradient(135deg, #8b6dff, #6754df);
          color: #ffffff;
          font: inherit;
          font-size: 11px;
          font-weight: 800;
          text-decoration: none;
          cursor: pointer;
          box-shadow: 0 13px 28px rgba(94, 70, 216, 0.25);
        }

        .action-group {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }

        .action-group > :global(a) {
          color: #aab1c0;
          font-size: 10px;
          font-weight: 750;
          text-decoration: none;
        }

        .action-group > :global(a):hover {
          color: #ffffff;
        }

        .step-list {
          margin: 0;
          padding: 0;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          list-style: none;
        }

        .step-list li {
          min-width: 0;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 11px;
          padding: 15px;
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 15px;
          background: rgba(6, 8, 13, 0.36);
        }

        .step-list li.step-complete {
          border-color: rgba(52, 211, 153, 0.14);
          background: rgba(16, 185, 129, 0.035);
        }

        .step-icon {
          width: 31px;
          height: 31px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: rgba(124, 92, 255, 0.11);
          color: #b7adff;
          font-size: 12px;
          font-weight: 900;
        }

        .step-complete .step-icon {
          background: rgba(16, 185, 129, 0.11);
          color: #6ee7b7;
        }

        .step-list small {
          color: #596274;
          font-size: 7px;
          font-weight: 850;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .step-list strong {
          display: block;
          margin-top: 4px;
          color: #e6e9ef;
          font-size: 11px;
        }

        .step-list p {
          margin: 5px 0 0;
          color: #697184;
          font-size: 9px;
          line-height: 1.5;
        }

        @media (max-width: 1180px) {
          .onboarding {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 680px) {
          .onboarding {
            padding: 20px;
          }

          .step-list {
            grid-template-columns: 1fr;
          }

          .onboarding-action button,
          .primary-link {
            width: 100%;
          }

          .action-group {
            display: grid;
            text-align: center;
          }
        }
      `}</style>
    </section>
  );
}
