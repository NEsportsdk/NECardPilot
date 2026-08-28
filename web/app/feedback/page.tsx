"use client";

import { track } from "@vercel/analytics";
import Link from "next/link";
import { FormEvent, useState } from "react";

import AppSidebar from "@/components/app/AppSidebar";
import {
  betaFeedbackCategories,
  getBetaFeedbackOriginPath,
  type BetaFeedbackCategory,
  type BetaFeedbackDeviceContext,
} from "@/lib/feedback/betaFeedback";

const categoryLabels: Record<BetaFeedbackCategory, string> = {
  bug: "Something is broken",
  idea: "Feature idea",
  usability: "Hard to use",
  data: "Card or price data",
  other: "Something else",
};

const ratingLabels = ["Blocked", "Frustrating", "Okay", "Good", "Excellent"];

function getDeviceContext(): BetaFeedbackDeviceContext {
  const width = window.innerWidth;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone));

  return {
    language: navigator.language || "unknown",
    online: navigator.onLine,
    screen: width < 620 ? "mobile" : width < 1024 ? "tablet" : "desktop",
    standalone,
  };
}

export default function FeedbackPage() {
  const [category, setCategory] = useState<BetaFeedbackCategory>("idea");
  const [experienceRating, setExperienceRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [allowFollowUp, setAllowFollowUp] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"error" | "idle" | "success">("idle");
  const [statusMessage, setStatusMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (experienceRating === null) {
      setStatus("error");
      setStatusMessage("Rate your current Vallective experience from 1 to 5.");
      return;
    }

    setSubmitting(true);
    setStatus("idle");
    setStatusMessage("");

    try {
      const response = await fetch("/api/beta-feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          allowFollowUp,
          category,
          deviceContext: getDeviceContext(),
          experienceRating,
          message,
          pagePath: getBetaFeedbackOriginPath(
            window.location.search,
            window.location.pathname
          ),
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        submitted?: boolean;
      };

      if (!response.ok || !result.submitted) {
        throw new Error(result.error || "Your feedback could not be sent.");
      }

      track("beta_feedback_submitted", {
        category,
        experience_rating: experienceRating,
      });
      setMessage("");
      setExperienceRating(null);
      setStatus("success");
      setStatusMessage(
        "Thank you — your feedback is now in the Vallective beta queue."
      );
    } catch (error) {
      setStatus("error");
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Your feedback could not be sent. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="feedback-shell">
      <AppSidebar variant="fixed" />

      <main className="feedback-main">
        <header className="feedback-header">
          <div>
            <p className="eyebrow">Private beta</p>
            <h1>Beta feedback</h1>
            <p>
              Tell us what slows you down, what feels great and what would make
              Vallective indispensable for your collection.
            </p>
          </div>

          <Link className="back-link" href="/">
            ← Back to dashboard
          </Link>
        </header>

        <div className="feedback-grid">
          <section className="feedback-panel form-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Shape the product</p>
                <h2>What should we know?</h2>
              </div>
              <span className="beta-badge">Beta</span>
            </div>

            <form onSubmit={handleSubmit}>
              <label className="field" htmlFor="feedback-category">
                <span>Feedback type</span>
                <select
                  disabled={submitting}
                  id="feedback-category"
                  onChange={(event) =>
                    setCategory(event.target.value as BetaFeedbackCategory)
                  }
                  value={category}
                >
                  {betaFeedbackCategories.map((value) => (
                    <option key={value} value={value}>
                      {categoryLabels[value]}
                    </option>
                  ))}
                </select>
              </label>

              <fieldset>
                <legend>How does Vallective feel right now?</legend>
                <div className="rating-grid">
                  {ratingLabels.map((label, index) => {
                    const value = index + 1;

                    return (
                      <label className="rating-option" key={label}>
                        <input
                          checked={experienceRating === value}
                          disabled={submitting}
                          name="experience-rating"
                          onChange={() => setExperienceRating(value)}
                          required
                          type="radio"
                          value={value}
                        />
                        <strong>{value}</strong>
                        <span>{label}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <label className="field" htmlFor="feedback-message">
                <span>Your feedback</span>
                <textarea
                  disabled={submitting}
                  id="feedback-message"
                  maxLength={2000}
                  minLength={20}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="What happened, what did you expect, or what should we build next?"
                  required
                  rows={8}
                  value={message}
                />
                <small>{message.length}/2,000 characters · minimum 20</small>
              </label>

              <label className="follow-up-option">
                <input
                  checked={allowFollowUp}
                  disabled={submitting}
                  onChange={(event) => setAllowFollowUp(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  Vallective may contact me through my account email if a
                  follow-up would help.
                </span>
              </label>

              {status !== "idle" ? (
                <p
                  className={`form-message form-message-${status}`}
                  role={status === "error" ? "alert" : "status"}
                >
                  {statusMessage}
                </p>
              ) : null}

              <div className="form-actions">
                <button
                  className="primary-button"
                  disabled={submitting || message.trim().length < 20}
                  type="submit"
                >
                  {submitting ? "Sending feedback..." : "Send beta feedback"}
                </button>
              </div>
            </form>
          </section>

          <aside className="feedback-side-column">
            <section className="feedback-panel context-panel">
              <p className="eyebrow">Useful context</p>
              <h2>What we attach</h2>
              <p>
                To reproduce issues, Vallective includes only the current page,
                screen class, language, connectivity and installed-app state.
              </p>
              <ul>
                <li>No card images</li>
                <li>No collection contents</li>
                <li>No browser history or query strings</li>
              </ul>
            </section>

            <section className="feedback-panel promise-panel">
              <p className="eyebrow">The beta promise</p>
              <h2>Every report becomes a decision</h2>
              <p>
                We will group recurring friction, prioritize blockers and use
                real collector feedback to shape each coming milestone.
              </p>
            </section>
          </aside>
        </div>
      </main>

      <style jsx>{`
        .feedback-shell {
          min-height: 100vh;
          background:
            radial-gradient(circle at 82% 0%, rgba(124, 92, 255, 0.13), transparent 32%),
            #080a10;
          color: #f8fafc;
        }

        .feedback-main {
          min-height: 100vh;
          margin-left: 310px;
          padding: 50px clamp(28px, 4vw, 66px) 70px;
        }

        .feedback-header {
          max-width: 1180px;
          margin: 0 auto 30px;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 28px;
        }

        .eyebrow {
          margin: 0 0 9px;
          color: #9f93ff;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .feedback-header h1 {
          margin: 0;
          color: #fff;
          font-size: clamp(44px, 5vw, 68px);
          letter-spacing: -0.055em;
          line-height: 0.98;
        }

        .feedback-header > div > p:last-child {
          max-width: 690px;
          margin: 15px 0 0;
          color: #7d8598;
          font-size: 13px;
          line-height: 1.65;
        }

        .back-link {
          color: #a8afbe;
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
        }

        .back-link:hover {
          color: #fff;
        }

        .feedback-grid {
          max-width: 1180px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(0, 1.45fr) minmax(300px, 0.75fr);
          gap: 22px;
          align-items: start;
        }

        .feedback-panel {
          padding: 27px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 22px;
          background: rgba(16, 19, 27, 0.96);
          box-shadow: 0 22px 60px rgba(0, 0, 0, 0.2);
        }

        .form-panel {
          border-color: rgba(139, 92, 246, 0.22);
          background:
            radial-gradient(circle at top right, rgba(124, 92, 255, 0.12), transparent 37%),
            rgba(16, 19, 27, 0.98);
        }

        .panel-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 28px;
        }

        h2 {
          margin: 0;
          color: #fff;
          font-size: 21px;
          letter-spacing: -0.035em;
        }

        .beta-badge {
          padding: 7px 10px;
          border: 1px solid rgba(167, 139, 250, 0.24);
          border-radius: 999px;
          background: rgba(124, 92, 255, 0.1);
          color: #ddd6fe;
          font-size: 8px;
          font-weight: 850;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        form,
        .feedback-side-column {
          display: grid;
          gap: 22px;
        }

        .field {
          display: grid;
          gap: 8px;
        }

        .field > span,
        legend {
          color: #a5adbd;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        select,
        textarea {
          width: 100%;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 13px;
          outline: 0;
          background: rgba(7, 9, 14, 0.78);
          color: #fff;
          font: inherit;
          font-size: 13px;
        }

        select {
          min-height: 52px;
          padding: 0 15px;
        }

        textarea {
          min-height: 180px;
          padding: 15px;
          line-height: 1.6;
          resize: vertical;
        }

        select:focus,
        textarea:focus {
          border-color: rgba(167, 139, 250, 0.72);
          box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.11);
        }

        .field small {
          color: #626b7d;
          font-size: 10px;
          text-align: right;
        }

        fieldset {
          margin: 0;
          padding: 0;
          border: 0;
        }

        legend {
          margin-bottom: 10px;
        }

        .rating-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
        }

        .rating-option {
          min-height: 76px;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 4px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 13px;
          background: rgba(255, 255, 255, 0.025);
          cursor: pointer;
        }

        .rating-option:has(input:checked) {
          border-color: rgba(167, 139, 250, 0.58);
          background: rgba(124, 92, 255, 0.13);
          box-shadow: inset 0 0 0 1px rgba(167, 139, 250, 0.1);
        }

        .rating-option:has(input:focus-visible) {
          outline: 2px solid #a78bfa;
          outline-offset: 2px;
        }

        .rating-option input {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          opacity: 0;
        }

        .rating-option strong {
          color: #e7e3ff;
          font-size: 17px;
        }

        .rating-option span {
          color: #727b8e;
          font-size: 8px;
          font-weight: 700;
          text-align: center;
        }

        .follow-up-option {
          display: grid;
          grid-template-columns: auto 1fr;
          align-items: start;
          gap: 10px;
          color: #8992a4;
          font-size: 11px;
          line-height: 1.55;
        }

        .follow-up-option input {
          width: 16px;
          height: 16px;
          margin: 1px 0 0;
          accent-color: #8b6dff;
        }

        .form-message {
          margin: 0;
          padding: 12px 14px;
          border-radius: 12px;
          font-size: 11px;
          line-height: 1.5;
        }

        .form-message-success {
          border: 1px solid rgba(52, 211, 153, 0.2);
          background: rgba(16, 185, 129, 0.07);
          color: #a7f3d0;
        }

        .form-message-error {
          border: 1px solid rgba(248, 113, 113, 0.22);
          background: rgba(239, 68, 68, 0.07);
          color: #fecaca;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
        }

        .primary-button {
          min-height: 48px;
          padding: 0 20px;
          border: 0;
          border-radius: 13px;
          background: linear-gradient(135deg, #8b6dff, #6957dd);
          color: #fff;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 13px 30px rgba(94, 70, 216, 0.24);
        }

        .primary-button:disabled {
          opacity: 0.48;
          box-shadow: none;
          cursor: not-allowed;
        }

        .context-panel p:not(.eyebrow),
        .promise-panel p:not(.eyebrow) {
          margin: 12px 0 0;
          color: #727b8e;
          font-size: 11px;
          line-height: 1.7;
        }

        .context-panel ul {
          margin: 19px 0 0;
          display: grid;
          gap: 9px;
          padding: 0;
          list-style: none;
        }

        .context-panel li {
          position: relative;
          padding-left: 18px;
          color: #a5adbd;
          font-size: 10px;
        }

        .context-panel li::before {
          position: absolute;
          left: 0;
          color: #67e8b5;
          content: "✓";
        }

        .promise-panel {
          background:
            radial-gradient(circle at 100% 0%, rgba(52, 211, 153, 0.08), transparent 40%),
            rgba(16, 19, 27, 0.96);
        }

        @media (max-width: 980px) {
          .feedback-main {
            margin-left: 0;
            padding: 35px 24px 110px;
          }

          .feedback-grid {
            grid-template-columns: 1fr;
          }

          .feedback-side-column {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 680px) {
          .feedback-main {
            padding: 28px 14px 112px;
          }

          .feedback-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .feedback-panel {
            padding: 20px;
            border-radius: 18px;
          }

          .rating-grid {
            grid-template-columns: repeat(5, minmax(54px, 1fr));
            overflow-x: auto;
            padding-bottom: 3px;
          }

          .feedback-side-column {
            grid-template-columns: 1fr;
          }

          .form-actions,
          .primary-button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
