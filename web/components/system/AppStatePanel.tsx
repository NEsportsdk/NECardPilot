import type { ReactNode } from "react";

type AppStatePanelProps = {
  children?: ReactNode;
  description: string;
  headingLevel?: "h2" | "h3";
  icon?: ReactNode;
  loading?: boolean;
  title: string;
};

export default function AppStatePanel({
  children,
  description,
  headingLevel = "h2",
  icon = "V",
  loading = false,
  title,
}: AppStatePanelProps) {
  const Heading = headingLevel;

  return (
    <div
      aria-busy={loading || undefined}
      aria-live={loading ? "polite" : undefined}
      className="app-state-panel"
      data-state={loading ? "loading" : "empty"}
      role={loading ? "status" : undefined}
    >
      {loading ? (
        <span className="app-state-spinner" aria-hidden="true" />
      ) : (
        <span className="app-state-icon" aria-hidden="true">
          {icon}
        </span>
      )}

      <div className="app-state-copy">
        <Heading>{title}</Heading>
        <p>{description}</p>
      </div>

      {children ? <div className="app-state-actions">{children}</div> : null}

      <style jsx>{`
        .app-state-panel {
          min-height: 300px;
          padding: 30px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border: 1px dashed rgba(167, 139, 250, 0.16);
          border-radius: 18px;
          background:
            radial-gradient(
              circle at 50% 18%,
              rgba(124, 92, 255, 0.08),
              transparent 38%
            ),
            rgba(9, 11, 17, 0.35);
          text-align: center;
        }

        .app-state-icon {
          width: 58px;
          height: 58px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(167, 139, 250, 0.18);
          border-radius: 18px;
          background: rgba(124, 92, 255, 0.09);
          color: #a99dff;
          font-size: 20px;
          font-weight: 850;
          box-shadow: 0 16px 35px rgba(70, 51, 170, 0.1);
        }

        .app-state-spinner {
          width: 34px;
          height: 34px;
          border: 2px solid rgba(167, 139, 250, 0.14);
          border-top-color: #9f93ff;
          border-radius: 50%;
          animation: app-state-spin 720ms linear infinite;
        }

        .app-state-copy h2,
        .app-state-copy h3 {
          margin: 17px 0 0;
          color: #ffffff;
          font-size: 18px;
          letter-spacing: -0.025em;
        }

        .app-state-copy p {
          max-width: 480px;
          margin: 8px auto 0;
          color: #747d90;
          font-size: 11px;
          line-height: 1.6;
        }

        .app-state-actions {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 20px;
        }

        .app-state-actions :global(.app-state-action) {
          min-height: 42px;
          padding: 0 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.035);
          color: #d7dae2;
          font-size: 11px;
          font-weight: 750;
          text-decoration: none;
          cursor: pointer;
        }

        .app-state-actions :global(.app-state-action-primary) {
          border-color: rgba(167, 139, 250, 0.28);
          background: linear-gradient(135deg, #8b6dff, #6957dd);
          color: #ffffff;
          box-shadow: 0 12px 28px rgba(94, 70, 216, 0.2);
        }

        .app-state-actions :global(.app-state-action:focus-visible) {
          outline: 2px solid rgba(196, 181, 253, 0.86);
          outline-offset: 3px;
        }

        @keyframes app-state-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 520px) {
          .app-state-panel {
            min-height: 270px;
            padding: 25px 18px;
          }

          .app-state-actions,
          .app-state-actions :global(.app-state-action) {
            width: 100%;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .app-state-spinner {
            animation-duration: 1.5s;
          }
        }
      `}</style>
    </div>
  );
}
