"use client";

import { track } from "@vercel/analytics";
import { useEffect, useMemo, useState } from "react";

import { useInstallExperience } from "@/components/pwa/InstallExperienceProvider";
import type {
  BetaPilotBrowser,
  BetaPilotDevice,
  BetaPilotInstallMode,
} from "@/lib/beta/betaPilot";
import { createId } from "@/lib/createId";
import type { CaptureQueueItem } from "@/lib/scan/captureQueue";
import {
  captureEnduranceTargets,
  createCaptureEnduranceEvidence,
  createCaptureEnduranceRun,
  getCaptureEnduranceProgress,
  parseCaptureEnduranceRun,
  resumeCaptureEnduranceRun,
  type CaptureEnduranceLocalRun,
  type CaptureEnduranceTarget,
  updateCaptureEnduranceConnection,
} from "@/lib/scan/captureEndurance";
import { saveCaptureEnduranceEvidence } from "@/lib/scan/captureEnduranceStore";
import type { LocalCaptureItem } from "@/lib/scan/localCaptureQueue";

const STORAGE_KEY = "vallective.captureQueue.enduranceRun:v1";

type CaptureEndurancePanelProps = {
  disabled: boolean;
  isOnline: boolean;
  localItems: LocalCaptureItem[];
  onActiveChange: (active: boolean) => void;
  onStartNewSession: () => string;
  remoteItems: CaptureQueueItem[];
};

function detectDevice(): BetaPilotDevice {
  const userAgent = navigator.userAgent.toLowerCase();

  if (/iphone|ipad|ipod/.test(userAgent)) {
    return "iphone";
  }

  return /android/.test(userAgent) ? "android" : "desktop";
}

function detectBrowser(): BetaPilotBrowser {
  const userAgent = navigator.userAgent.toLowerCase();

  if (/edg\//.test(userAgent)) {
    return "edge";
  }

  if (/chrome|crios/.test(userAgent)) {
    return "chrome";
  }

  return /safari/.test(userAgent) ? "safari" : "other";
}

function persistRun(run: CaptureEnduranceLocalRun) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(run));
    return true;
  } catch {
    return false;
  }
}

function clearPersistedRun() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // The in-memory run can still be ended when storage is unavailable.
  }
}

function formatDuration(startedAt: string) {
  const durationMs = Math.max(0, Date.now() - Date.parse(startedAt));
  const minutes = Math.floor(durationMs / 60_000);

  if (minutes < 1) {
    return "under one minute";
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours}h ${remainingMinutes}m`;
}

export default function CaptureEndurancePanel({
  disabled,
  isOnline,
  localItems,
  onActiveChange,
  onStartNewSession,
  remoteItems,
}: CaptureEndurancePanelProps) {
  const [pageInstanceId] = useState(createId);
  const [targetCount, setTargetCount] =
    useState<CaptureEnduranceTarget>(10);
  const [run, setRun] = useState<CaptureEnduranceLocalRun | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"error" | "success">(
    "success"
  );
  const {
    environment: installEnvironment,
    ready: installEnvironmentReady,
  } = useInstallExperience();
  const installMode: BetaPilotInstallMode =
    installEnvironmentReady && installEnvironment === "installed"
      ? "standalone"
      : "browser";

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? parseCaptureEnduranceRun(JSON.parse(raw)) : null;

      if (parsed) {
        const resumed = resumeCaptureEnduranceRun(parsed, pageInstanceId);
        persistRun(resumed);
        setRun(resumed);
        setTargetCount(resumed.targetCount);
        onActiveChange(true);
      } else if (raw) {
        clearPersistedRun();
      }
    } catch {
      clearPersistedRun();
    } finally {
      setHydrated(true);
    }
  }, [onActiveChange, pageInstanceId]);

  useEffect(() => {
    if (!run) {
      return;
    }

    const nextRun = updateCaptureEnduranceConnection(run, isOnline);

    if (
      nextRun.sawOffline === run.sawOffline &&
      nextRun.offlineRecoveryVerified === run.offlineRecoveryVerified
    ) {
      return;
    }

    if (!persistRun(nextRun)) {
      setMessageTone("error");
      setMessage(
        "This browser blocked the local test record. Keep this page open and retry after allowing site storage."
      );
    }
    setRun(nextRun);
  }, [isOnline, run]);

  const progress = useMemo(
    () =>
      run
        ? getCaptureEnduranceProgress(run, localItems, remoteItems)
        : null,
    [localItems, remoteItems, run]
  );

  function startRun() {
    if (
      run &&
      !window.confirm(
        "Start a fresh endurance run? The unfinished local test record will be replaced, but captured cards remain in the queue."
      )
    ) {
      return;
    }

    const captureSessionId = onStartNewSession();
    const nextRun = createCaptureEnduranceRun({
      captureSessionId,
      pageInstanceId,
      targetCount,
    });

    if (!persistRun(nextRun)) {
      setMessageTone("error");
      setMessage(
        "This browser cannot preserve the test between app launches. Allow site storage before starting the endurance run."
      );
      return;
    }
    setRun(nextRun);
    setMessage(null);
    onActiveChange(true);
    track("capture_endurance_started", { target_count: targetCount });
  }

  function abandonRun() {
    if (
      !window.confirm(
        "End this endurance run? Captured cards remain safe; only the local test checklist is removed."
      )
    ) {
      return;
    }

    clearPersistedRun();
    setRun(null);
    setMessage(null);
    onActiveChange(false);
  }

  async function saveEvidence() {
    if (!run || !progress?.passed || !installEnvironmentReady) {
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const evidence = createCaptureEnduranceEvidence({
        browser: detectBrowser(),
        installMode,
        primaryDevice: detectDevice(),
        progress,
        run,
      });

      await saveCaptureEnduranceEvidence(evidence);
      clearPersistedRun();
      setRun(null);
      setMessageTone("success");
      setMessage(
        "Endurance evidence saved. This device run now counts toward launch readiness."
      );
      onActiveChange(false);
      track("capture_endurance_completed", {
        install_mode: installMode,
        target_count: evidence.target_count,
      });
    } catch (error) {
      setMessageTone("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Endurance evidence could not be saved."
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!hydrated) {
    return null;
  }

  const checkpoints = progress
    ? [
        {
          detail: `${progress.capturedCount}/${progress.targetCount}`,
          label: "Capture target",
          met: progress.capturedCount >= progress.targetCount,
        },
        {
          detail: `${progress.uploadedCount}/${progress.targetCount}`,
          label: "Cloud upload",
          met: progress.uploadedCount >= progress.targetCount,
        },
        {
          detail: progress.reloadVerified ? "Recovered" : "Reopen required",
          label: "App reopen",
          met: progress.reloadVerified,
        },
        {
          detail: progress.offlineRecoveryVerified
            ? "Recovered"
            : "Offline → online required",
          label: "Network recovery",
          met: progress.offlineRecoveryVerified,
        },
        {
          detail:
            progress.failedCount === 0
              ? "No transport failures"
              : `${progress.failedCount} need attention`,
          label: "Queue integrity",
          met: progress.failedCount === 0,
        },
      ]
    : [];

  return (
    <section
      className="endurance-panel"
      aria-labelledby="endurance-title"
      data-active={Boolean(run)}
    >
      <div className="endurance-heading">
        <div>
          <p className="endurance-eyebrow">M23 · real-device proof</p>
          <h2 id="endurance-title">
            {run ? "Endurance run in progress" : "Prove the capture queue"}
          </h2>
          <p>
            {run
              ? `Session ${run.captureSessionId.slice(0, 8)} · ${formatDuration(run.startedAt)}`
              : "Run a guided capture, reload and offline recovery test without starting AI identification."}
          </p>
        </div>

        {run ? (
          <button className="quiet-button" onClick={abandonRun} type="button">
            End test
          </button>
        ) : (
          <div className="endurance-start">
            <label>
              <span>Cards in test</span>
              <select
                disabled={disabled}
                onChange={(event) =>
                  setTargetCount(
                    Number(event.target.value) as CaptureEnduranceTarget
                  )
                }
                value={targetCount}
              >
                {captureEnduranceTargets.map((target) => (
                  <option key={target} value={target}>
                    {target} cards
                  </option>
                ))}
              </select>
            </label>
            <button disabled={disabled} onClick={startRun} type="button">
              Start endurance run
            </button>
          </div>
        )}
      </div>

      {run && progress ? (
        <>
          <div className="endurance-checkpoints" role="list">
            {checkpoints.map((checkpoint) => (
              <article
                data-met={checkpoint.met}
                key={checkpoint.label}
                role="listitem"
              >
                <span aria-hidden="true">{checkpoint.met ? "✓" : "○"}</span>
                <div>
                  <strong>{checkpoint.label}</strong>
                  <small>{checkpoint.detail}</small>
                </div>
              </article>
            ))}
          </div>

          <div className="endurance-instructions">
            <p>
              <strong>1.</strong> Capture {run.targetCount} cards continuously.
            </p>
            <p>
              <strong>2.</strong> Reload or fully close and reopen this page once.
            </p>
            <p>
              <strong>3.</strong> Go offline, capture at least one card, then reconnect
              and let every card upload.
            </p>
          </div>

          <footer className="endurance-footer">
            <div>
              <strong>
                {progress.passed
                  ? "All five reliability gates passed"
                  : `${progress.remainingCaptures} capture(s) and ${progress.remainingUploads} upload(s) remain`}
              </strong>
              <span>
                Only aggregate counts and broad device context are saved. No
                card data or hardware identifier leaves this test panel.
              </span>
            </div>
            <button
              disabled={
                !progress.passed || isSaving || !installEnvironmentReady
              }
              onClick={saveEvidence}
              type="button"
            >
              {isSaving ? "Saving proof…" : "Save passed run"}
            </button>
          </footer>
        </>
      ) : null}

      {message ? (
        <p
          className={`endurance-message endurance-message-${messageTone}`}
          role={messageTone === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}

      <style jsx>{`
        .endurance-panel {
          max-width: 1440px;
          margin: 0 auto 18px;
          padding: 22px;
          border: 1px solid rgba(167, 139, 250, 0.16);
          border-radius: 19px;
          background:
            linear-gradient(120deg, rgba(124, 92, 255, 0.09), transparent 48%),
            rgba(15, 18, 27, 0.98);
        }

        .endurance-panel[data-active="true"] {
          border-color: rgba(52, 211, 153, 0.2);
          background:
            linear-gradient(120deg, rgba(16, 185, 129, 0.07), transparent 48%),
            rgba(15, 18, 27, 0.98);
        }

        .endurance-heading,
        .endurance-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .endurance-eyebrow {
          margin: 0 0 7px;
          color: #9f93ff;
          font-size: 8px;
          font-weight: 850;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        h2 { margin: 0; color: #f3f4f8; font-size: 20px; letter-spacing: -0.035em; }
        .endurance-heading > div:first-child > p:last-child {
          margin: 8px 0 0;
          color: #747d90;
          font-size: 9px;
          line-height: 1.55;
        }

        .endurance-start { display: flex; align-items: flex-end; gap: 10px; }
        label > span { display: block; margin-bottom: 6px; color: #7f889b; font-size: 8px; font-weight: 760; }
        select,
        button {
          min-height: 40px;
          border: 1px solid rgba(167, 139, 250, 0.18);
          border-radius: 11px;
          background: #0b0e15;
          color: #d9d5ff;
          font: inherit;
          font-size: 9px;
          font-weight: 800;
        }
        select { min-width: 105px; padding: 0 11px; }
        button { padding: 0 14px; cursor: pointer; }
        .endurance-start button,
        .endurance-footer button {
          border: 0;
          background: linear-gradient(135deg, #8b6dff, #6957dd);
          color: #fff;
          box-shadow: 0 10px 25px rgba(94, 70, 216, 0.2);
        }
        .quiet-button { background: rgba(255, 255, 255, 0.025); color: #8f98aa; }
        button:disabled, select:disabled { opacity: 0.45; cursor: not-allowed; }
        button:focus-visible, select:focus-visible { outline: 2px solid #9f93ff; outline-offset: 2px; }

        .endurance-checkpoints {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 9px;
          margin-top: 18px;
        }
        .endurance-checkpoints article {
          min-height: 67px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 11px;
          border: 1px solid rgba(148, 163, 184, 0.09);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.018);
        }
        .endurance-checkpoints article[data-met="true"] {
          border-color: rgba(52, 211, 153, 0.16);
          background: rgba(16, 185, 129, 0.045);
        }
        .endurance-checkpoints article > span { color: #7668ea; font-size: 15px; }
        .endurance-checkpoints article[data-met="true"] > span { color: #6ee7b7; }
        .endurance-checkpoints article div { min-width: 0; display: grid; gap: 4px; }
        .endurance-checkpoints strong { color: #cbd0da; font-size: 9px; }
        .endurance-checkpoints small { color: #687184; font-size: 8px; line-height: 1.35; }
        .endurance-checkpoints article[data-met="true"] strong { color: #b7f7dc; }

        .endurance-instructions {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 11px;
        }
        .endurance-instructions p {
          margin: 0;
          padding: 10px 12px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.02);
          color: #717a8d;
          font-size: 8px;
          line-height: 1.55;
        }
        .endurance-instructions strong { color: #a99eff; }

        .endurance-footer {
          margin-top: 13px;
          padding-top: 13px;
          border-top: 1px solid rgba(148, 163, 184, 0.08);
        }
        .endurance-footer > div { display: grid; gap: 5px; }
        .endurance-footer strong { color: #d7dbe4; font-size: 10px; }
        .endurance-footer span { max-width: 720px; color: #687184; font-size: 8px; line-height: 1.5; }
        .endurance-message { margin: 12px 0 0; padding: 10px 12px; border-radius: 10px; font-size: 9px; }
        .endurance-message-success { color: #a7f3d0; background: rgba(16, 185, 129, 0.07); }
        .endurance-message-error { color: #fecaca; background: rgba(239, 68, 68, 0.07); }

        @media (max-width: 1040px) {
          .endurance-checkpoints { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }

        @media (max-width: 680px) {
          .endurance-panel { padding: 17px; border-radius: 16px; }
          .endurance-heading, .endurance-footer { align-items: flex-start; flex-direction: column; }
          .endurance-start { width: 100%; display: grid; grid-template-columns: 1fr 1.35fr; }
          .endurance-start select, .endurance-start button, .endurance-footer button { width: 100%; }
          .endurance-checkpoints { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .endurance-instructions { grid-template-columns: 1fr; }
        }

        @media (max-width: 390px) {
          .endurance-checkpoints { grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  );
}
