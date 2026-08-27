"use client";

import { useState } from "react";

import VallectiveMark from "@/components/brand/VallectiveMark";
import { useInstallExperience } from "@/components/pwa/InstallExperienceProvider";

export default function InstallAppCard() {
  const { canPrompt, environment, install, ready } = useInstallExperience();
  const [feedback, setFeedback] = useState("");
  const [installing, setInstalling] = useState(false);

  async function handleInstall() {
    setInstalling(true);
    setFeedback("");

    const outcome = await install();

    if (outcome === "dismissed") {
      setFeedback("Installation cancelled. You can try again from the browser menu.");
    } else if (outcome === "unavailable") {
      setFeedback("Use your browser's install option to add Vallective.");
    }

    setInstalling(false);
  }

  const installed = environment === "installed";
  const ios = environment === "ios";

  return (
    <section className="install-card" data-install-state={environment}>
      <div className="install-heading">
        <span className="install-mark" aria-hidden="true">
          <VallectiveMark />
        </span>
        <div>
          <p className="install-eyebrow">Vallective app</p>
          <h2>Keep your collection one tap away</h2>
        </div>
        <span className={`install-status ${installed ? "installed" : ""}`}>
          {!ready ? "Checking" : installed ? "Installed" : "Web app"}
        </span>
      </div>

      {installed ? (
        <p className="install-copy">
          Vallective is running as an installed app with its own home-screen
          icon and standalone window.
        </p>
      ) : ios ? (
        <div className="install-instructions">
          <p>Install from Safari on iPhone or iPad:</p>
          <ol>
            <li>Tap the Share button.</li>
            <li>Choose Add to Home Screen.</li>
            <li>Confirm with Add.</li>
          </ol>
        </div>
      ) : (
        <>
          <p className="install-copy">
            Launch Vallective without browser chrome and get a dedicated icon
            on your phone, tablet or desktop.
          </p>

          {canPrompt ? (
            <button
              className="install-button"
              disabled={installing}
              onClick={() => void handleInstall()}
              type="button"
            >
              {installing ? "Opening installer..." : "Install Vallective"}
            </button>
          ) : (
            <p className="browser-guidance">
              Choose <strong>Install app</strong> from your browser menu when
              it appears. Chrome and Edge may wait until you have used the app
              briefly before offering installation.
            </p>
          )}
        </>
      )}

      {feedback ? (
        <p className="install-feedback" role="status">
          {feedback}
        </p>
      ) : null}

      <style jsx>{`
        .install-card {
          padding: 24px;
          overflow: hidden;
          position: relative;
          border: 1px solid rgba(167, 139, 250, 0.22);
          border-radius: 22px;
          background:
            radial-gradient(
              circle at 100% 0%,
              rgba(139, 92, 246, 0.18),
              transparent 44%
            ),
            rgba(16, 19, 27, 0.98);
          box-shadow: 0 22px 60px rgba(0, 0, 0, 0.2);
          color: #f8fafc;
        }

        .install-heading {
          display: grid;
          grid-template-columns: 50px minmax(0, 1fr) auto;
          align-items: center;
          gap: 13px;
        }

        .install-mark {
          width: 50px;
          height: 50px;
          display: grid;
          place-items: center;
          border-radius: 16px;
          background: linear-gradient(145deg, #a88cff, #6552e8);
          color: #ffffff;
          box-shadow: 0 12px 28px rgba(101, 82, 232, 0.28);
        }

        .install-mark :global(svg) {
          width: 31px;
          height: 31px;
        }

        .install-eyebrow {
          margin: 0 0 5px;
          color: #a99dff;
          font-size: 8px;
          font-weight: 850;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        h2 {
          margin: 0;
          color: #ffffff;
          font-size: 16px;
          letter-spacing: -0.03em;
          line-height: 1.25;
        }

        .install-status {
          padding: 6px 8px;
          border: 1px solid rgba(167, 139, 250, 0.18);
          border-radius: 999px;
          background: rgba(124, 92, 255, 0.08);
          color: #c4b5fd;
          font-size: 7px;
          font-weight: 850;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .install-status.installed {
          border-color: rgba(52, 211, 153, 0.2);
          background: rgba(16, 185, 129, 0.08);
          color: #86efac;
        }

        .install-copy,
        .install-instructions,
        .browser-guidance,
        .install-feedback {
          color: #747d90;
          font-size: 10px;
          line-height: 1.65;
        }

        .install-copy {
          margin: 18px 0 0;
        }

        .install-button {
          width: 100%;
          min-height: 44px;
          margin-top: 18px;
          border: 0;
          border-radius: 12px;
          background: linear-gradient(135deg, #8b6dff, #6957dd);
          color: #ffffff;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 12px 28px rgba(94, 70, 216, 0.22);
        }

        .install-button:disabled {
          opacity: 0.58;
          cursor: wait;
        }

        .install-button:focus-visible {
          outline: 2px solid rgba(196, 181, 253, 0.9);
          outline-offset: 3px;
        }

        .browser-guidance {
          margin: 15px 0 0;
          padding: 11px 12px;
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.025);
        }

        .browser-guidance strong {
          color: #c9ced8;
        }

        .install-instructions {
          margin-top: 18px;
        }

        .install-instructions p {
          margin: 0 0 8px;
          color: #9da5b5;
          font-weight: 750;
        }

        .install-instructions ol {
          margin: 0;
          padding-left: 19px;
        }

        .install-feedback {
          margin: 13px 0 0;
          color: #c4b5fd;
        }

        @media (max-width: 430px) {
          .install-heading {
            grid-template-columns: 46px minmax(0, 1fr);
          }

          .install-mark {
            width: 46px;
            height: 46px;
            border-radius: 14px;
          }

          .install-status {
            width: max-content;
            margin-left: 59px;
            grid-column: 1 / -1;
          }
        }
      `}</style>
    </section>
  );
}
