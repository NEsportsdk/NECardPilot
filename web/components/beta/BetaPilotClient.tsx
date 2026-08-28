"use client";

import { track } from "@vercel/analytics";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";

import { saveBetaPilotAction } from "@/app/beta/actions";
import AppSidebar from "@/components/app/AppSidebar";
import {
  betaPilotBrowsers,
  betaPilotDevices,
  betaPilotInstallModes,
  betaPilotJourney,
  getBetaPilotProgress,
  type BetaPilotBrowser,
  type BetaPilotDevice,
  type BetaPilotInstallMode,
  type BetaPilotProfile,
  type BetaPilotStepId,
} from "@/lib/beta/betaPilot";

const deviceLabels: Record<BetaPilotDevice, string> = {
  android: "Android phone",
  desktop: "Desktop or laptop",
  iphone: "iPhone",
};

const browserLabels: Record<BetaPilotBrowser, string> = {
  chrome: "Chrome",
  edge: "Edge",
  other: "Another browser",
  safari: "Safari",
};

const installModeLabels: Record<BetaPilotInstallMode, string> = {
  browser: "Normal browser tab",
  standalone: "Installed on home screen",
};

type BetaPilotClientProps = {
  canManagePilot: boolean;
  initialProfile: BetaPilotProfile | null;
};

function detectDevice(): BetaPilotDevice {
  const userAgent = navigator.userAgent.toLowerCase();

  if (/iphone|ipad|ipod/.test(userAgent)) {
    return "iphone";
  }

  if (/android/.test(userAgent)) {
    return "android";
  }

  return "desktop";
}

function detectBrowser(): BetaPilotBrowser {
  const userAgent = navigator.userAgent.toLowerCase();

  if (/edg\//.test(userAgent)) {
    return "edge";
  }

  if (/chrome|crios/.test(userAgent)) {
    return "chrome";
  }

  if (/safari/.test(userAgent)) {
    return "safari";
  }

  return "other";
}

function detectInstallMode(): BetaPilotInstallMode {
  const navigatorWithStandalone = navigator as Navigator & {
    standalone?: boolean;
  };

  return window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone
    ? "standalone"
    : "browser";
}

export default function BetaPilotClient({
  canManagePilot,
  initialProfile,
}: BetaPilotClientProps) {
  const [profile, setProfile] = useState(initialProfile);
  const [primaryDevice, setPrimaryDevice] = useState<BetaPilotDevice>(
    initialProfile?.primary_device ?? "desktop"
  );
  const [browser, setBrowser] = useState<BetaPilotBrowser>(
    initialProfile?.browser ?? "chrome"
  );
  const [installMode, setInstallMode] = useState<BetaPilotInstallMode>(
    initialProfile?.install_mode ?? "browser"
  );
  const [completedSteps, setCompletedSteps] = useState<BetaPilotStepId[]>(
    initialProfile?.completed_steps ?? []
  );
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "success">(
    "success"
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (initialProfile) {
      return;
    }

    setPrimaryDevice(detectDevice());
    setBrowser(detectBrowser());
    setInstallMode(detectInstallMode());
  }, [initialProfile]);

  const progress = useMemo(
    () => getBetaPilotProgress(completedSteps),
    [completedSteps]
  );

  function toggleStep(step: BetaPilotStepId) {
    setCompletedSteps((current) =>
      current.includes(step)
        ? current.filter((value) => value !== step)
        : [...current, step].sort((left, right) => left - right)
    );
    setMessage("");
  }

  function saveProgress() {
    setMessage("");

    startTransition(async () => {
      const result = await saveBetaPilotAction({
        browser,
        completedSteps,
        installMode,
        primaryDevice,
      });

      if (!result.ok) {
        setMessageTone("error");
        setMessage(result.error);
        return;
      }

      setProfile(result.profile);
      setCompletedSteps(result.profile.completed_steps);
      setMessageTone("success");
      setMessage(
        progress.finished
          ? "Pilot journey complete — thank you. Your result is ready for review."
          : "Pilot progress saved. You can return on this or another device."
      );
      track("beta_pilot_progress_saved", {
        completed_steps: result.profile.completed_steps.length,
        install_mode: result.profile.install_mode,
        primary_device: result.profile.primary_device,
      });
    });
  }

  return (
    <div className="pilot-shell">
      <AppSidebar variant="fixed" />

      <main className="pilot-main">
        <header className="pilot-header">
          <div>
            <p className="eyebrow">Controlled private beta</p>
            <h1>Your pilot journey</h1>
            <p>
              Put Vallective through a real collector workflow. Save as you go,
              report friction where it happens and help us prove the experience
              across devices.
            </p>
          </div>

          <div className="header-actions">
            {canManagePilot ? (
              <Link className="operations-link" href="/feedback/manage">
                Open pilot operations →
              </Link>
            ) : null}
            <Link className="feedback-link" href="/feedback?from=%2Fbeta">
              Send feedback
            </Link>
          </div>
        </header>

        <section className="progress-hero" aria-label="Pilot progress">
          <div className="progress-copy">
            <p className="eyebrow">
              {progress.finished ? "Journey complete" : "Journey in progress"}
            </p>
            <strong>
              {progress.completed}
              <span> / {progress.total}</span>
            </strong>
            <p>
              {progress.finished
                ? "All ten signals are recorded. Keep sending feedback if you find more friction."
                : `${progress.total - progress.completed} checkpoints remain in this test round.`}
            </p>
          </div>

          <div className="progress-visual" aria-hidden="true">
            <div
              className="progress-ring"
              style={{ "--progress": `${progress.percent}%` } as React.CSSProperties}
            >
              <span>{progress.percent}%</span>
            </div>
          </div>
        </section>

        <div className="pilot-grid">
          <section className="pilot-panel context-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Test context</p>
                <h2>What are you testing on?</h2>
              </div>
              <span className="privacy-badge">No device ID</span>
            </div>

            <div className="context-fields">
              <label>
                <span>Primary device</span>
                <select
                  disabled={isPending}
                  onChange={(event) =>
                    setPrimaryDevice(event.target.value as BetaPilotDevice)
                  }
                  value={primaryDevice}
                >
                  {betaPilotDevices.map((value) => (
                    <option key={value} value={value}>
                      {deviceLabels[value]}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Browser</span>
                <select
                  disabled={isPending}
                  onChange={(event) =>
                    setBrowser(event.target.value as BetaPilotBrowser)
                  }
                  value={browser}
                >
                  {betaPilotBrowsers.map((value) => (
                    <option key={value} value={value}>
                      {browserLabels[value]}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Launch mode</span>
                <select
                  disabled={isPending}
                  onChange={(event) =>
                    setInstallMode(event.target.value as BetaPilotInstallMode)
                  }
                  value={installMode}
                >
                  {betaPilotInstallModes.map((value) => (
                    <option key={value} value={value}>
                      {installModeLabels[value]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="context-note">
              <span aria-hidden="true">◎</span>
              <p>
                We store only these broad choices and your checklist progress.
                No hardware identifier, full user agent or card data is attached.
              </p>
            </div>
          </section>

          <aside className="pilot-panel discipline-panel">
            <p className="eyebrow">Pilot discipline</p>
            <h2>Use realistic data, safely</h2>
            <ul>
              <li>Never add passwords or payment details.</li>
              <li>Test on a connection you normally use.</li>
              <li>Report blockers from the page where they happen.</li>
              <li>Only mark a checkpoint after completing the full action.</li>
            </ul>
            <Link href="/feedback?from=%2Fbeta">Report a blocker →</Link>
          </aside>
        </div>

        <section className="journey-section">
          <div className="journey-heading">
            <div>
              <p className="eyebrow">Guided collector journey</p>
              <h2>Ten checkpoints to a launch decision</h2>
            </div>
            <p>Complete them in order when possible. Save after each session.</p>
          </div>

          <div className="journey-list">
            {betaPilotJourney.map((step) => {
              const completed = completedSteps.includes(step.id);

              return (
                <article
                  className={`journey-step ${completed ? "journey-step-complete" : ""}`}
                  key={step.id}
                >
                  <label>
                    <input
                      checked={completed}
                      disabled={isPending}
                      onChange={() => toggleStep(step.id)}
                      type="checkbox"
                    />
                    <span className="step-control" aria-hidden="true">
                      {completed ? "✓" : step.id}
                    </span>
                    <span className="step-copy">
                      <strong>{step.label}</strong>
                      <span>{step.description}</span>
                    </span>
                  </label>
                  <Link href={step.href}>Open →</Link>
                </article>
              );
            })}
          </div>
        </section>

        <section className="save-bar" aria-label="Save pilot progress">
          <div>
            <strong>
              {profile ? "Progress is connected to your account" : "Ready to join the pilot"}
            </strong>
            <span>
              {profile
                ? `Last saved ${new Intl.DateTimeFormat("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(profile.updated_at))}`
                : "Your first save creates a private pilot record."}
            </span>
          </div>

          <button disabled={isPending} onClick={saveProgress} type="button">
            {isPending ? "Saving…" : "Save pilot progress"}
          </button>
        </section>

        {message ? (
          <p
            className={`save-message save-message-${messageTone}`}
            role={messageTone === "error" ? "alert" : "status"}
          >
            {message}
          </p>
        ) : null}
      </main>

      <style jsx>{`
        .pilot-shell {
          min-height: 100vh;
          background:
            radial-gradient(circle at 82% 0%, rgba(124, 92, 255, 0.14), transparent 31%),
            radial-gradient(circle at 16% 100%, rgba(14, 165, 233, 0.07), transparent 30%),
            #080a10;
          color: #f8fafc;
        }

        .pilot-main {
          min-height: 100vh;
          margin-left: 310px;
          padding: 50px clamp(28px, 4vw, 66px) 80px;
        }

        .pilot-header,
        .progress-hero,
        .pilot-grid,
        .journey-section,
        .save-bar,
        .save-message {
          max-width: 1180px;
          margin-inline: auto;
        }

        .pilot-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 28px;
          margin-bottom: 28px;
        }

        .eyebrow {
          margin: 0 0 9px;
          color: #9f93ff;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .pilot-header h1 {
          margin: 0;
          color: #fff;
          font-size: clamp(43px, 5vw, 68px);
          letter-spacing: -0.055em;
          line-height: 0.98;
        }

        .pilot-header > div:first-child > p:last-child {
          max-width: 710px;
          margin: 15px 0 0;
          color: #7d8598;
          font-size: 13px;
          line-height: 1.65;
        }

        .header-actions {
          display: grid;
          justify-items: end;
          gap: 11px;
          flex: 0 0 auto;
        }

        .header-actions a,
        .discipline-panel a,
        .journey-step > a {
          color: #c8c0ff;
          font-size: 10px;
          font-weight: 780;
          text-decoration: none;
        }

        .operations-link {
          min-height: 39px;
          display: inline-flex;
          align-items: center;
          padding: 0 13px;
          border: 1px solid rgba(167, 139, 250, 0.24);
          border-radius: 11px;
          background: rgba(124, 92, 255, 0.08);
        }

        .feedback-link { color: #8f98aa !important; }

        .progress-hero {
          min-height: 220px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 30px;
          margin-bottom: 22px;
          padding: 31px 36px;
          overflow: hidden;
          border: 1px solid rgba(167, 139, 250, 0.2);
          border-radius: 24px;
          background:
            linear-gradient(120deg, rgba(124, 92, 255, 0.12), transparent 50%),
            rgba(16, 19, 27, 0.98);
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.22);
        }

        .progress-copy strong {
          display: block;
          color: #fff;
          font-size: clamp(55px, 7vw, 88px);
          letter-spacing: -0.07em;
          line-height: 0.95;
        }

        .progress-copy strong span { color: #60697b; font-size: 0.42em; }
        .progress-copy > p:last-child { max-width: 570px; margin: 17px 0 0; color: #8992a5; font-size: 12px; line-height: 1.6; }

        .progress-ring {
          --progress: 0%;
          width: 132px;
          height: 132px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: conic-gradient(#8b7bff var(--progress), rgba(148, 163, 184, 0.1) 0);
          box-shadow: 0 0 55px rgba(124, 92, 255, 0.16);
        }

        .progress-ring::before {
          width: 103px;
          height: 103px;
          grid-area: 1 / 1;
          border-radius: 50%;
          background: #0d1018;
          content: "";
        }

        .progress-ring span { z-index: 1; grid-area: 1 / 1; color: #ddd8ff; font-size: 22px; font-weight: 850; }

        .pilot-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(300px, 0.6fr);
          gap: 22px;
          margin-bottom: 22px;
        }

        .pilot-panel,
        .journey-section {
          padding: 27px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 22px;
          background: rgba(16, 19, 27, 0.96);
        }

        .panel-heading,
        .journey-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
        }

        h2 { margin: 0; color: #f3f4f8; font-size: 22px; letter-spacing: -0.035em; }

        .privacy-badge {
          min-height: 27px;
          display: inline-flex;
          align-items: center;
          padding: 0 9px;
          border-radius: 999px;
          background: rgba(16, 185, 129, 0.08);
          color: #a7f3d0;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .context-fields {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-top: 23px;
        }

        label > span:first-child { display: block; margin-bottom: 7px; color: #7f889b; font-size: 9px; font-weight: 750; }

        select {
          width: 100%;
          min-height: 45px;
          padding: 0 12px;
          border: 1px solid rgba(148, 163, 184, 0.13);
          border-radius: 11px;
          background: #0b0e15;
          color: #d7dbe4;
          font: inherit;
          font-size: 10px;
        }

        select:focus-visible,
        button:focus-visible,
        a:focus-visible,
        .journey-step label:focus-within {
          outline: 2px solid rgba(167, 139, 250, 0.78);
          outline-offset: 2px;
        }

        .context-note {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          margin-top: 16px;
          padding: 13px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.025);
          color: #697285;
        }

        .context-note > span { color: #8b7bff; }
        .context-note p { margin: 0; font-size: 9px; line-height: 1.6; }

        .discipline-panel h2 { margin-bottom: 19px; }
        .discipline-panel ul { display: grid; gap: 10px; margin: 0 0 21px; padding: 0; list-style: none; }
        .discipline-panel li { position: relative; padding-left: 17px; color: #8992a5; font-size: 10px; line-height: 1.5; }
        .discipline-panel li::before { position: absolute; top: 6px; left: 0; width: 6px; height: 6px; border-radius: 50%; background: #7365e8; content: ""; }

        .journey-section { margin-bottom: 22px; }
        .journey-heading { align-items: flex-end; margin-bottom: 20px; }
        .journey-heading > p { max-width: 300px; margin: 0; color: #687184; font-size: 9px; line-height: 1.55; text-align: right; }
        .journey-list { display: grid; gap: 9px; }

        .journey-step {
          min-height: 75px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 16px;
          padding: 11px 14px;
          border: 1px solid rgba(148, 163, 184, 0.09);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.018);
        }

        .journey-step-complete { border-color: rgba(52, 211, 153, 0.16); background: rgba(16, 185, 129, 0.035); }
        .journey-step label { min-width: 0; display: grid; grid-template-columns: 39px minmax(0, 1fr); align-items: center; gap: 13px; cursor: pointer; }
        .journey-step input { position: absolute; width: 1px; height: 1px; opacity: 0; }

        .step-control {
          width: 39px;
          height: 39px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(167, 139, 250, 0.2);
          border-radius: 12px;
          background: rgba(124, 92, 255, 0.06);
          color: #a99eff;
          font-size: 11px;
          font-weight: 850;
        }

        .journey-step-complete .step-control { border-color: rgba(52, 211, 153, 0.22); background: rgba(16, 185, 129, 0.09); color: #86efac; }
        .step-copy { min-width: 0; display: grid; gap: 5px; }
        .step-copy strong { color: #dce0e8; font-size: 11px; }
        .step-copy > span { color: #747d90; font-size: 9px; line-height: 1.5; }
        .journey-step-complete .step-copy strong { color: #b9e6d1; }

        .save-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 22px;
          padding: 19px 22px;
          border: 1px solid rgba(167, 139, 250, 0.17);
          border-radius: 17px;
          background: rgba(17, 20, 29, 0.97);
          box-shadow: 0 20px 55px rgba(0, 0, 0, 0.2);
        }

        .save-bar > div { display: grid; gap: 5px; }
        .save-bar strong { color: #dfe2ea; font-size: 11px; }
        .save-bar span { color: #687184; font-size: 9px; }
        .save-bar button {
          min-height: 45px;
          padding: 0 18px;
          border: 0;
          border-radius: 12px;
          background: linear-gradient(135deg, #8b6dff, #6957dd);
          color: #fff;
          font: inherit;
          font-size: 10px;
          font-weight: 820;
          cursor: pointer;
          box-shadow: 0 13px 30px rgba(94, 70, 216, 0.24);
        }

        button:disabled, select:disabled { opacity: 0.55; cursor: wait; }
        .save-message { margin-top: 12px; padding: 13px 15px; border-radius: 12px; font-size: 10px; line-height: 1.5; }
        .save-message-success { color: #a7f3d0; background: rgba(16, 185, 129, 0.07); }
        .save-message-error { color: #fecaca; background: rgba(239, 68, 68, 0.07); }

        @media (max-width: 1080px) {
          .pilot-grid { grid-template-columns: 1fr; }
          .context-fields { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }

        @media (max-width: 980px) {
          .pilot-main { margin-left: 0; padding: 34px 22px 110px; }
        }

        @media (max-width: 640px) {
          .pilot-main { padding: 27px 13px 112px; }
          .pilot-header, .save-bar, .journey-heading { align-items: flex-start; flex-direction: column; }
          .pilot-header h1 { font-size: 45px; }
          .header-actions { width: 100%; justify-items: start; }
          .progress-hero { min-height: 0; align-items: flex-start; padding: 24px 21px; }
          .progress-ring { width: 92px; height: 92px; }
          .progress-ring::before { width: 71px; height: 71px; }
          .progress-ring span { font-size: 16px; }
          .pilot-panel, .journey-section { padding: 19px; border-radius: 19px; }
          .context-fields { grid-template-columns: 1fr; }
          .journey-heading > p { text-align: left; }
          .journey-step { align-items: flex-end; grid-template-columns: 1fr; }
          .journey-step > a { margin-left: 52px; }
          .save-bar button { width: 100%; }
        }

        @media (max-width: 430px) {
          .progress-hero { flex-direction: column; }
          .progress-visual { align-self: flex-end; margin-top: -78px; }
          .progress-copy > p:last-child { max-width: 210px; }
        }
      `}</style>
    </div>
  );
}
