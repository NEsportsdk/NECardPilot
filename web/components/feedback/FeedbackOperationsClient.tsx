"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  useDeferredValue,
  useMemo,
  useState,
  useTransition,
} from "react";

import { updateBetaFeedbackAction } from "@/app/feedback/manage/actions";
import AppSidebar from "@/components/app/AppSidebar";
import {
  getBetaLaunchReadiness,
  type BetaPilotCoverageCheck,
} from "@/lib/beta/betaLaunchReadiness";
import {
  getBetaPilotMetrics,
  getBetaPilotProgress,
  type BetaPilotProfile,
} from "@/lib/beta/betaPilot";
import {
  betaFeedbackPriorities,
  betaFeedbackStatuses,
  getBetaFeedbackQueueMetrics,
  type BetaFeedbackPriority,
  type BetaFeedbackQueueItem,
  type BetaFeedbackStatus,
} from "@/lib/feedback/betaFeedbackAdmin";
import type { CaptureEnduranceEvidence } from "@/lib/scan/captureEndurance";

const categoryLabels: Record<BetaFeedbackQueueItem["category"], string> = {
  bug: "Broken",
  data: "Card or price data",
  idea: "Feature idea",
  other: "Other",
  usability: "Hard to use",
};

const statusLabels: Record<BetaFeedbackStatus, string> = {
  closed: "Closed",
  new: "New",
  planned: "Planned",
  resolved: "Resolved",
  reviewing: "Reviewing",
};

const priorityLabels: Record<BetaFeedbackPriority, string> = {
  critical: "Critical",
  high: "High",
  low: "Low",
  normal: "Normal",
};

type FeedbackOperationsClientProps = {
  initialCoverageChecks: BetaPilotCoverageCheck[];
  initialEnduranceRuns: CaptureEnduranceEvidence[];
  initialFeedback: BetaFeedbackQueueItem[];
  initialParticipants: BetaPilotProfile[];
  invitationConsole: ReactNode;
};

const pilotDeviceLabels: Record<BetaPilotProfile["primary_device"], string> = {
  android: "Android",
  desktop: "Desktop",
  iphone: "iPhone",
};

const pilotInstallLabels: Record<BetaPilotProfile["install_mode"], string> = {
  browser: "Browser",
  standalone: "Installed",
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function shortReporterId(value: string) {
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

export default function FeedbackOperationsClient({
  initialCoverageChecks,
  initialEnduranceRuns,
  initialFeedback,
  initialParticipants,
  invitationConsole,
}: FeedbackOperationsClientProps) {
  const [feedback, setFeedback] = useState(initialFeedback);
  const [selectedId, setSelectedId] = useState(initialFeedback[0]?.id ?? null);
  const [statusFilter, setStatusFilter] = useState<"all" | BetaFeedbackStatus>(
    "all"
  );
  const [categoryFilter, setCategoryFilter] = useState<
    "all" | BetaFeedbackQueueItem["category"]
  >("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLocaleLowerCase());
  const [draftStatus, setDraftStatus] = useState<BetaFeedbackStatus>(
    initialFeedback[0]?.status ?? "new"
  );
  const [draftPriority, setDraftPriority] = useState<BetaFeedbackPriority>(
    initialFeedback[0]?.priority ?? "normal"
  );
  const [draftNote, setDraftNote] = useState(
    initialFeedback[0]?.internal_note ?? ""
  );
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "success">(
    "success"
  );
  const [isPending, startTransition] = useTransition();

  const feedbackMetrics = useMemo(
    () => getBetaFeedbackQueueMetrics(feedback),
    [feedback]
  );
  const pilotMetrics = useMemo(
    () => getBetaPilotMetrics(initialParticipants),
    [initialParticipants]
  );
  const launchReadiness = useMemo(
    () =>
      getBetaLaunchReadiness(
        initialCoverageChecks,
        feedback,
        initialEnduranceRuns
      ),
    [feedback, initialCoverageChecks, initialEnduranceRuns]
  );
  const enduranceMetrics = useMemo(
    () => ({
      largestRun: initialEnduranceRuns.reduce(
        (largest, run) => Math.max(largest, run.target_count),
        0
      ),
      mobile: initialEnduranceRuns.filter(
        (run) => run.primary_device !== "desktop"
      ).length,
      total: initialEnduranceRuns.length,
    }),
    [initialEnduranceRuns]
  );

  const filteredFeedback = useMemo(
    () =>
      feedback.filter((item) => {
        if (statusFilter !== "all" && item.status !== statusFilter) {
          return false;
        }

        if (categoryFilter !== "all" && item.category !== categoryFilter) {
          return false;
        }

        if (!deferredSearch) {
          return true;
        }

        return [
          item.message,
          item.page_path,
          item.contact_email ?? "",
          item.internal_note ?? "",
        ].some((value) => value.toLocaleLowerCase().includes(deferredSearch));
      }),
    [categoryFilter, deferredSearch, feedback, statusFilter]
  );

  const selected = feedback.find((item) => item.id === selectedId) ?? null;

  function selectFeedback(item: BetaFeedbackQueueItem) {
    setSelectedId(item.id);
    setDraftStatus(item.status);
    setDraftPriority(item.priority);
    setDraftNote(item.internal_note ?? "");
    setMessage("");
  }

  function saveWorkflow() {
    if (!selected) {
      return;
    }

    setMessage("");

    startTransition(async () => {
      const result = await updateBetaFeedbackAction({
        id: selected.id,
        internalNote: draftNote,
        priority: draftPriority,
        status: draftStatus,
      });

      if (!result.ok) {
        setMessageTone("error");
        setMessage(result.error);
        return;
      }

      setFeedback((current) =>
        current.map((item) =>
          item.id === result.feedback.id ? result.feedback : item
        )
      );
      setDraftNote(result.feedback.internal_note ?? "");
      setMessageTone("success");
      setMessage("Workflow saved. The queue is up to date.");
    });
  }

  return (
    <div className="operations-shell">
      <AppSidebar variant="fixed" />

      <main className="operations-main">
        <header className="operations-header">
          <div>
            <p className="eyebrow">Private beta operations</p>
            <h1>Feedback command centre</h1>
            <p>
              Turn collector friction into a visible decision queue. Review,
              prioritize and close the loop without exposing reports to other
              beta users.
            </p>
          </div>

          <div className="header-actions">
            <Link className="pilot-link" href="/beta">
              Open pilot journey →
            </Link>
            <Link className="back-link" href="/feedback">
              ← Feedback form
            </Link>
          </div>
        </header>

        {invitationConsole}

        <section
          className="launch-readiness"
          aria-labelledby="launch-readiness-title"
          data-status={launchReadiness.status}
        >
          <div className="readiness-heading">
            <div>
              <p className="eyebrow">Public beta release gate</p>
              <h2 id="launch-readiness-title">Launch readiness</h2>
              <p>
                Evidence survives later device tests, while feedback decisions
                update this gate immediately.
              </p>
            </div>
            <div className="readiness-score" aria-live="polite">
              <span>{launchReadiness.status === "ready" ? "Go" : "Hold"}</span>
              <strong>
                {launchReadiness.met}/{launchReadiness.total}
              </strong>
              <small>gates complete</small>
            </div>
          </div>

          <div className="readiness-gates" role="list">
            {launchReadiness.gates.map((gate) => (
              <article data-met={gate.met} key={gate.id} role="listitem">
                <span aria-hidden="true">{gate.met ? "✓" : "○"}</span>
                <div>
                  <strong>{gate.label}</strong>
                  <p>{gate.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          className="endurance-evidence"
          aria-labelledby="endurance-evidence-title"
        >
          <div className="coverage-heading">
            <div>
              <p className="eyebrow">Queue reliability evidence</p>
              <h2 id="endurance-evidence-title">Capture endurance</h2>
            </div>
            <p>
              Passed real-device runs contain aggregate counts and broad
              platform context only—never card data or hardware identifiers.
            </p>
          </div>

          <div
            className="endurance-metrics"
            role="region"
            aria-label="Capture endurance summary"
          >
            <article>
              <span>Passed runs</span>
              <strong>{enduranceMetrics.total}</strong>
            </article>
            <article>
              <span>Mobile runs</span>
              <strong>{enduranceMetrics.mobile}</strong>
            </article>
            <article>
              <span>Largest batch</span>
              <strong>{enduranceMetrics.largestRun}</strong>
            </article>
          </div>

          {initialEnduranceRuns.length ? (
            <div className="endurance-list">
              {initialEnduranceRuns.slice(0, 6).map((run) => (
                <article key={run.id ?? run.capture_session_id}>
                  <div className="endurance-card-heading">
                    <strong>{run.target_count}-card run</strong>
                    <time dateTime={run.completed_at}>
                      {formatDate(run.completed_at)}
                    </time>
                  </div>
                  <div className="endurance-card-context">
                    <span>{pilotDeviceLabels[run.primary_device]}</span>
                    <span>{run.browser}</span>
                    <span>{pilotInstallLabels[run.install_mode]}</span>
                    <span>{run.uploaded_count} uploaded</span>
                    <span>Reopen ✓</span>
                    <span>Offline recovery ✓</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="coverage-empty">
              No passed endurance run yet. Start one from <code>/scanner/queue</code>.
            </div>
          )}
        </section>

        <section className="pilot-coverage" aria-labelledby="pilot-coverage-title">
          <div className="coverage-heading">
            <div>
              <p className="eyebrow">Real-device coverage</p>
              <h2 id="pilot-coverage-title">Pilot participants</h2>
            </div>
            <p>
              Privacy-conscious progress by account ID, device class and launch
              mode. Contact details remain in consented feedback only.
            </p>
          </div>

          <div
            className="coverage-metrics"
            role="region"
            aria-label="Pilot coverage summary"
          >
            <article>
              <span>Participants</span>
              <strong>{pilotMetrics.total}</strong>
            </article>
            <article>
              <span>Journey complete</span>
              <strong>{pilotMetrics.completed}</strong>
            </article>
            <article>
              <span>Mobile coverage</span>
              <strong>{pilotMetrics.mobile}</strong>
            </article>
            <article>
              <span>Installed app</span>
              <strong>{pilotMetrics.installed}</strong>
            </article>
          </div>

          {initialParticipants.length ? (
            <div className="participant-list">
              {initialParticipants.map((participant) => {
                const progress = getBetaPilotProgress(
                  participant.completed_steps
                );

                return (
                  <article className="participant-card" key={participant.user_id}>
                    <div className="participant-identity">
                      <span>{shortReporterId(participant.user_id)}</span>
                      <strong>{progress.percent}% complete</strong>
                    </div>
                    <div className="participant-progress" aria-hidden="true">
                      <span style={{ width: `${progress.percent}%` }} />
                    </div>
                    <div className="participant-context">
                      <span>{pilotDeviceLabels[participant.primary_device]}</span>
                      <span>{participant.browser}</span>
                      <span>{pilotInstallLabels[participant.install_mode]}</span>
                      <time dateTime={participant.updated_at}>
                        {formatDate(participant.updated_at)}
                      </time>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="coverage-empty">
              No pilot participants yet. The first save from <code>/beta</code>
              will appear here.
            </div>
          )}
        </section>

        <section className="metrics-grid" aria-label="Feedback queue summary">
          <article>
            <span>Total reports</span>
            <strong>{feedbackMetrics.total}</strong>
            <small>Latest 100 reports</small>
          </article>
          <article>
            <span>Needs action</span>
            <strong>{feedbackMetrics.actionable}</strong>
            <small>New or under review</small>
          </article>
          <article>
            <span>Critical</span>
            <strong>{feedbackMetrics.critical}</strong>
            <small>Immediate attention</small>
          </article>
          <article>
            <span>Follow-up ready</span>
            <strong>{feedbackMetrics.followUpAllowed}</strong>
            <small>Collector consent recorded</small>
          </article>
        </section>

        <section className="filters-panel" aria-label="Filter beta feedback">
          <label>
            <span>Search</span>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Message, route, email or internal note"
              type="search"
              value={search}
            />
          </label>

          <label>
            <span>Status</span>
            <select
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as "all" | BetaFeedbackStatus
                )
              }
              value={statusFilter}
            >
              <option value="all">All statuses</option>
              {betaFeedbackStatuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Category</span>
            <select
              onChange={(event) =>
                setCategoryFilter(
                  event.target.value as
                    | "all"
                    | BetaFeedbackQueueItem["category"]
                )
              }
              value={categoryFilter}
            >
              <option value="all">All categories</option>
              {Object.entries(categoryLabels).map(([category, label]) => (
                <option key={category} value={category}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <p aria-live="polite">
            Showing <strong>{filteredFeedback.length}</strong> of {feedback.length}
          </p>
        </section>

        <div className="operations-grid">
          <section className="queue-panel" aria-label="Beta feedback queue">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Decision queue</p>
                <h2>Collector reports</h2>
              </div>
              <span>{filteredFeedback.length}</span>
            </div>

            {filteredFeedback.length === 0 ? (
              <div className="empty-state">
                <strong>No reports match this view</strong>
                <p>Adjust the filters or wait for the next beta signal.</p>
              </div>
            ) : (
              <div className="queue-list">
                {filteredFeedback.map((item) => (
                  <button
                    aria-pressed={selected?.id === item.id}
                    className={`queue-item ${
                      selected?.id === item.id ? "queue-item-active" : ""
                    }`}
                    key={item.id}
                    onClick={() => selectFeedback(item)}
                    type="button"
                  >
                    <span className="queue-item-topline">
                      <span className={`priority-dot priority-${item.priority}`} />
                      <strong>{categoryLabels[item.category]}</strong>
                      <span className={`status-pill status-${item.status}`}>
                        {statusLabels[item.status]}
                      </span>
                    </span>
                    <span className="queue-message">{item.message}</span>
                    <span className="queue-meta">
                      {item.page_path} · {formatDate(item.created_at)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="detail-panel" aria-label="Selected feedback report">
            {selected ? (
              <>
                <div className="panel-heading detail-heading">
                  <div>
                    <p className="eyebrow">Report detail</p>
                    <h2>{categoryLabels[selected.category]}</h2>
                  </div>
                  <span className={`rating-badge rating-${selected.experience_rating}`}>
                    {selected.experience_rating}/5
                  </span>
                </div>

                <blockquote>{selected.message}</blockquote>

                <dl className="context-grid">
                  <div>
                    <dt>Origin</dt>
                    <dd>{selected.page_path}</dd>
                  </div>
                  <div>
                    <dt>Screen</dt>
                    <dd>{selected.screen_class}</dd>
                  </div>
                  <div>
                    <dt>Language</dt>
                    <dd>{selected.language}</dd>
                  </div>
                  <div>
                    <dt>App state</dt>
                    <dd>{selected.is_standalone ? "Installed" : "Browser"}</dd>
                  </div>
                  <div>
                    <dt>Connectivity</dt>
                    <dd>{selected.is_online ? "Online" : "Offline"}</dd>
                  </div>
                  <div>
                    <dt>Submitted</dt>
                    <dd>{formatDate(selected.created_at)}</dd>
                  </div>
                </dl>

                <section className="contact-card">
                  <div>
                    <span>Reporter</span>
                    <strong>
                      {selected.contact_email ?? shortReporterId(selected.user_id)}
                    </strong>
                  </div>
                  <span
                    className={`consent-pill ${
                      selected.allow_follow_up ? "consent-yes" : "consent-no"
                    }`}
                  >
                    {selected.allow_follow_up
                      ? "Follow-up allowed"
                      : "No follow-up"}
                  </span>
                </section>

                <div className="workflow-grid">
                  <label>
                    <span>Status</span>
                    <select
                      disabled={isPending}
                      onChange={(event) =>
                        setDraftStatus(event.target.value as BetaFeedbackStatus)
                      }
                      value={draftStatus}
                    >
                      {betaFeedbackStatuses.map((status) => (
                        <option key={status} value={status}>
                          {statusLabels[status]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Priority</span>
                    <select
                      disabled={isPending}
                      onChange={(event) =>
                        setDraftPriority(
                          event.target.value as BetaFeedbackPriority
                        )
                      }
                      value={draftPriority}
                    >
                      {betaFeedbackPriorities.map((priority) => (
                        <option key={priority} value={priority}>
                          {priorityLabels[priority]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="note-field">
                  <span>Internal decision note</span>
                  <textarea
                    disabled={isPending}
                    maxLength={2000}
                    onChange={(event) => setDraftNote(event.target.value)}
                    placeholder="Decision, reproduction steps, owner or next milestone…"
                    rows={6}
                    value={draftNote}
                  />
                  <small>{draftNote.length}/2,000 · visible only to beta admins</small>
                </label>

                {message ? (
                  <p className={`form-message form-message-${messageTone}`} role="status">
                    {message}
                  </p>
                ) : null}

                <div className="detail-actions">
                  <span>
                    Last updated {formatDate(selected.updated_at)}
                  </span>
                  <button disabled={isPending} onClick={saveWorkflow} type="button">
                    {isPending ? "Saving workflow…" : "Save workflow"}
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-state detail-empty">
                <strong>The queue is clear</strong>
                <p>New beta reports will appear here automatically.</p>
              </div>
            )}
          </section>
        </div>
      </main>

      <style jsx>{`
        .operations-shell {
          min-height: 100vh;
          background:
            radial-gradient(circle at 84% 0%, rgba(124, 92, 255, 0.14), transparent 30%),
            #080a10;
          color: #f8fafc;
        }

        .operations-main {
          min-height: 100vh;
          margin-left: 310px;
          padding: 46px clamp(24px, 3.5vw, 58px) 70px;
        }

        .operations-header,
        .launch-readiness,
        .endurance-evidence,
        .pilot-coverage,
        .metrics-grid,
        .filters-panel,
        .operations-grid {
          max-width: 1380px;
          margin-inline: auto;
        }

        .operations-header {
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

        .operations-header h1 {
          margin: 0;
          color: #fff;
          font-size: clamp(38px, 4.5vw, 62px);
          letter-spacing: -0.055em;
          line-height: 0.98;
        }

        .operations-header > div > p:last-child {
          max-width: 720px;
          margin: 15px 0 0;
          color: #7d8598;
          font-size: 13px;
          line-height: 1.65;
        }

        .back-link {
          color: #aaa2de;
          font-size: 11px;
          font-weight: 750;
          text-decoration: none;
          white-space: nowrap;
        }

        .header-actions {
          display: grid;
          justify-items: end;
          gap: 11px;
          flex: 0 0 auto;
        }

        .pilot-link {
          min-height: 39px;
          display: inline-flex;
          align-items: center;
          padding: 0 13px;
          border: 1px solid rgba(167, 139, 250, 0.24);
          border-radius: 11px;
          background: rgba(124, 92, 255, 0.08);
          color: #cfc7ff;
          font-size: 10px;
          font-weight: 780;
          text-decoration: none;
        }

        .pilot-coverage {
          margin-bottom: 14px;
          padding: 20px;
          border: 1px solid rgba(167, 139, 250, 0.16);
          border-radius: 20px;
          background:
            linear-gradient(125deg, rgba(124, 92, 255, 0.07), transparent 48%),
            rgba(14, 17, 25, 0.94);
        }

        .endurance-evidence {
          margin-bottom: 14px;
          padding: 20px;
          border: 1px solid rgba(52, 211, 153, 0.15);
          border-radius: 20px;
          background:
            linear-gradient(125deg, rgba(16, 185, 129, 0.06), transparent 48%),
            rgba(14, 17, 25, 0.94);
        }

        .endurance-metrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 10px;
        }

        .endurance-metrics article {
          padding: 13px;
          border: 1px solid rgba(52, 211, 153, 0.1);
          border-radius: 13px;
          background: rgba(16, 185, 129, 0.025);
        }

        .endurance-metrics span {
          display: block;
          color: #657084;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .endurance-metrics strong {
          display: block;
          margin-top: 6px;
          color: #d7f9e9;
          font-size: 20px;
        }

        .endurance-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .endurance-list > article {
          padding: 13px;
          border: 1px solid rgba(148, 163, 184, 0.08);
          border-radius: 13px;
          background: rgba(7, 9, 14, 0.38);
        }

        .endurance-card-heading,
        .endurance-card-context {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .endurance-card-heading { justify-content: space-between; }
        .endurance-card-heading strong { color: #b7f7dc; font-size: 10px; }
        .endurance-card-heading time { color: #515a6d; font-size: 8px; }
        .endurance-card-context {
          flex-wrap: wrap;
          margin-top: 9px;
          color: #667084;
          font-size: 8px;
          text-transform: capitalize;
        }
        .endurance-card-context span:not(:last-child)::after {
          margin-left: 9px;
          color: #323949;
          content: "·";
        }

        .launch-readiness {
          margin-bottom: 14px;
          padding: 22px;
          border: 1px solid rgba(251, 191, 36, 0.18);
          border-radius: 20px;
          background:
            linear-gradient(125deg, rgba(245, 158, 11, 0.07), transparent 48%),
            rgba(14, 17, 25, 0.96);
        }

        .launch-readiness[data-status="ready"] {
          border-color: rgba(52, 211, 153, 0.22);
          background:
            linear-gradient(125deg, rgba(16, 185, 129, 0.07), transparent 48%),
            rgba(14, 17, 25, 0.96);
        }

        .readiness-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 17px;
        }

        .readiness-heading h2 {
          margin: 0;
          color: #f1f3f7;
          font-size: 24px;
          letter-spacing: -0.04em;
        }

        .readiness-heading > div:first-child > p:last-child {
          max-width: 620px;
          margin: 8px 0 0;
          color: #6f788b;
          font-size: 9px;
          line-height: 1.55;
        }

        .readiness-score {
          flex: 0 0 auto;
          display: grid;
          grid-template-columns: auto auto;
          align-items: center;
          column-gap: 9px;
          min-width: 118px;
          padding: 12px 14px;
          border: 1px solid rgba(251, 191, 36, 0.16);
          border-radius: 14px;
          background: rgba(245, 158, 11, 0.055);
        }

        [data-status="ready"] .readiness-score {
          border-color: rgba(52, 211, 153, 0.18);
          background: rgba(16, 185, 129, 0.055);
        }

        .readiness-score span {
          color: #fcd34d;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        [data-status="ready"] .readiness-score span { color: #6ee7b7; }
        .readiness-score strong { color: #fff; font-size: 19px; }
        .readiness-score small {
          grid-column: 1 / -1;
          margin-top: 3px;
          color: #646d7f;
          font-size: 8px;
        }

        .readiness-gates {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .readiness-gates article {
          display: grid;
          grid-template-columns: 22px minmax(0, 1fr);
          gap: 9px;
          padding: 13px;
          border: 1px solid rgba(148, 163, 184, 0.08);
          border-radius: 13px;
          background: rgba(7, 9, 14, 0.4);
        }

        .readiness-gates article[data-met="true"] {
          border-color: rgba(52, 211, 153, 0.14);
          background: rgba(16, 185, 129, 0.035);
        }

        .readiness-gates article > span {
          color: #788195;
          font-size: 17px;
          line-height: 1;
        }

        .readiness-gates article[data-met="true"] > span { color: #6ee7b7; }
        .readiness-gates strong { color: #c7ccd7; font-size: 10px; }
        .readiness-gates article[data-met="true"] strong { color: #b7f7dc; }
        .readiness-gates p {
          margin: 5px 0 0;
          color: #616a7d;
          font-size: 8px;
          line-height: 1.5;
        }

        .coverage-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 16px;
        }

        .coverage-heading h2 {
          margin: 0;
          color: #eef0f5;
          font-size: 22px;
          letter-spacing: -0.035em;
        }

        .coverage-heading > p {
          max-width: 470px;
          margin: 0;
          color: #687185;
          font-size: 9px;
          line-height: 1.55;
          text-align: right;
        }

        .coverage-metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 10px;
        }

        .coverage-metrics article {
          padding: 13px;
          border: 1px solid rgba(148, 163, 184, 0.08);
          border-radius: 13px;
          background: rgba(255, 255, 255, 0.018);
        }

        .coverage-metrics span {
          display: block;
          color: #657084;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .coverage-metrics strong {
          display: block;
          margin-top: 6px;
          color: #f2f3f7;
          font-size: 20px;
        }

        .participant-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .participant-card {
          min-width: 0;
          padding: 13px;
          border: 1px solid rgba(148, 163, 184, 0.08);
          border-radius: 13px;
          background: rgba(7, 9, 14, 0.38);
        }

        .participant-identity,
        .participant-context {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .participant-identity span {
          color: #9199aa;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 9px;
        }

        .participant-identity strong {
          color: #c9c2ff;
          font-size: 9px;
        }

        .participant-progress {
          height: 4px;
          margin: 10px 0;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.09);
        }

        .participant-progress span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #7867ed, #a99eff);
        }

        .participant-context {
          justify-content: flex-start;
          flex-wrap: wrap;
          color: #667084;
          font-size: 8px;
          text-transform: capitalize;
        }

        .participant-context span:not(:last-of-type)::after {
          margin-left: 10px;
          color: #323949;
          content: "·";
        }

        .participant-context time {
          margin-left: auto;
          color: #515a6d;
        }

        .coverage-empty {
          padding: 16px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.018);
          color: #687185;
          font-size: 9px;
          text-align: center;
        }

        .coverage-empty code { color: #aaa2de; }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 14px;
        }

        .metrics-grid article {
          padding: 18px;
          border: 1px solid rgba(148, 163, 184, 0.11);
          border-radius: 17px;
          background: rgba(16, 19, 27, 0.9);
        }

        .metrics-grid span,
        label > span,
        dt,
        .contact-card > div > span {
          display: block;
          color: #697286;
          font-size: 8px;
          font-weight: 850;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .metrics-grid strong {
          display: block;
          margin-top: 9px;
          color: #fff;
          font-size: 25px;
        }

        .metrics-grid small {
          display: block;
          margin-top: 5px;
          color: #596174;
          font-size: 9px;
        }

        .filters-panel {
          display: grid;
          grid-template-columns: minmax(230px, 1.7fr) repeat(2, minmax(150px, 0.7fr)) auto;
          align-items: end;
          gap: 11px;
          margin-bottom: 14px;
          padding: 15px;
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 17px;
          background: rgba(13, 16, 23, 0.92);
        }

        label {
          display: grid;
          gap: 7px;
        }

        input,
        select,
        textarea {
          width: 100%;
          border: 1px solid rgba(148, 163, 184, 0.13);
          border-radius: 11px;
          outline: 0;
          background: rgba(7, 9, 14, 0.8);
          color: #e8ebf2;
          font: inherit;
          font-size: 11px;
        }

        input,
        select {
          min-height: 43px;
          padding: 0 12px;
        }

        textarea {
          min-height: 118px;
          padding: 12px;
          line-height: 1.55;
          resize: vertical;
        }

        input:focus,
        select:focus,
        textarea:focus {
          border-color: rgba(167, 139, 250, 0.68);
          box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.1);
        }

        .filters-panel > p {
          margin: 0 3px 13px;
          color: #687185;
          font-size: 9px;
          white-space: nowrap;
        }

        .filters-panel > p strong {
          color: #c8c2f5;
        }

        .operations-grid {
          display: grid;
          grid-template-columns: minmax(330px, 0.85fr) minmax(460px, 1.35fr);
          gap: 14px;
          align-items: start;
        }

        .queue-panel,
        .detail-panel {
          min-width: 0;
          border: 1px solid rgba(148, 163, 184, 0.11);
          border-radius: 21px;
          background: rgba(16, 19, 27, 0.96);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
        }

        .queue-panel {
          padding: 18px;
        }

        .detail-panel {
          padding: 24px;
        }

        .panel-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 17px;
        }

        .panel-heading h2 {
          margin: 0;
          color: #fff;
          font-size: 19px;
          letter-spacing: -0.035em;
        }

        .panel-heading > span:not(.rating-badge) {
          min-width: 29px;
          min-height: 29px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: rgba(124, 92, 255, 0.1);
          color: #c4b5fd;
          font-size: 10px;
          font-weight: 850;
        }

        .queue-list {
          display: grid;
          gap: 8px;
          max-height: 720px;
          overflow-y: auto;
          padding-right: 2px;
        }

        .queue-item {
          width: 100%;
          display: grid;
          gap: 9px;
          padding: 14px;
          border: 1px solid rgba(148, 163, 184, 0.09);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.018);
          color: inherit;
          text-align: left;
          cursor: pointer;
        }

        .queue-item:hover,
        .queue-item-active {
          border-color: rgba(167, 139, 250, 0.3);
          background: rgba(124, 92, 255, 0.075);
        }

        .queue-item:focus-visible,
        .detail-actions button:focus-visible,
        .back-link:focus-visible {
          outline: 2px solid rgba(167, 139, 250, 0.78);
          outline-offset: 2px;
        }

        .queue-item-topline {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .queue-item-topline strong {
          min-width: 0;
          flex: 1;
          color: #dce0e9;
          font-size: 10px;
        }

        .priority-dot {
          width: 7px;
          height: 7px;
          flex: 0 0 auto;
          border-radius: 50%;
          background: #7b8496;
        }

        .priority-high { background: #fb923c; }
        .priority-critical { background: #f87171; box-shadow: 0 0 0 4px rgba(248, 113, 113, 0.08); }
        .priority-low { background: #60a5fa; }

        .status-pill,
        .consent-pill,
        .rating-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          font-size: 7px;
          font-weight: 850;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .status-pill {
          min-height: 22px;
          padding: 0 7px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          color: #9ca5b7;
        }

        .status-new { color: #ddd6fe; border-color: rgba(167, 139, 250, 0.25); }
        .status-reviewing { color: #bfdbfe; border-color: rgba(96, 165, 250, 0.25); }
        .status-planned { color: #fde68a; border-color: rgba(251, 191, 36, 0.25); }
        .status-resolved { color: #a7f3d0; border-color: rgba(52, 211, 153, 0.25); }

        .queue-message {
          display: -webkit-box;
          overflow: hidden;
          color: #a6adbc;
          font-size: 10px;
          line-height: 1.52;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .queue-meta {
          overflow: hidden;
          color: #596275;
          font-size: 8px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .rating-badge {
          min-width: 49px;
          min-height: 31px;
          border: 1px solid rgba(167, 139, 250, 0.25);
          background: rgba(124, 92, 255, 0.09);
          color: #d6ceff;
          font-size: 9px;
        }

        blockquote {
          margin: 0 0 20px;
          padding: 17px 18px;
          border-left: 3px solid #836cf2;
          border-radius: 0 13px 13px 0;
          background: rgba(124, 92, 255, 0.055);
          color: #d7dbe4;
          font-size: 12px;
          line-height: 1.7;
          overflow-wrap: anywhere;
        }

        .context-grid {
          margin: 0 0 18px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1px;
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.09);
          border-radius: 14px;
          background: rgba(148, 163, 184, 0.08);
        }

        .context-grid > div {
          min-width: 0;
          padding: 12px;
          background: #0d1017;
        }

        dd {
          overflow: hidden;
          margin: 6px 0 0;
          color: #d4d8e1;
          font-size: 9px;
          text-overflow: ellipsis;
          text-transform: capitalize;
          white-space: nowrap;
        }

        .contact-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 18px;
          padding: 14px;
          border: 1px solid rgba(52, 211, 153, 0.12);
          border-radius: 13px;
          background: rgba(16, 185, 129, 0.035);
        }

        .contact-card strong {
          display: block;
          margin-top: 6px;
          color: #dce5e0;
          font-size: 10px;
          overflow-wrap: anywhere;
        }

        .consent-pill {
          min-height: 25px;
          padding: 0 8px;
          white-space: nowrap;
        }

        .consent-yes { color: #a7f3d0; background: rgba(16, 185, 129, 0.08); }
        .consent-no { color: #9ba3b3; background: rgba(148, 163, 184, 0.07); }

        .workflow-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 14px;
        }

        .note-field small {
          color: #596275;
          font-size: 8px;
          text-align: right;
        }

        .form-message {
          margin: 13px 0 0;
          padding: 11px 12px;
          border-radius: 11px;
          font-size: 9px;
          line-height: 1.5;
        }

        .form-message-success { color: #a7f3d0; background: rgba(16, 185, 129, 0.07); }
        .form-message-error { color: #fecaca; background: rgba(239, 68, 68, 0.07); }

        .detail-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-top: 16px;
        }

        .detail-actions > span {
          color: #596275;
          font-size: 8px;
        }

        .detail-actions button {
          min-height: 43px;
          padding: 0 17px;
          border: 0;
          border-radius: 11px;
          background: linear-gradient(135deg, #8b6dff, #6957dd);
          color: #fff;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 12px 28px rgba(94, 70, 216, 0.22);
        }

        .detail-actions button:disabled {
          opacity: 0.5;
          box-shadow: none;
        }

        .empty-state {
          min-height: 220px;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 8px;
          padding: 30px;
          color: #667084;
          text-align: center;
        }

        .detail-empty { min-height: 520px; }
        .empty-state strong { color: #c8cdd8; font-size: 12px; }
        .empty-state p { margin: 0; font-size: 9px; line-height: 1.55; }

        @media (max-width: 1120px) {
          .readiness-gates { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .metrics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .participant-list { grid-template-columns: 1fr; }
          .endurance-list { grid-template-columns: 1fr; }
          .operations-grid { grid-template-columns: 1fr; }
          .queue-list { max-height: 430px; }
        }

        @media (max-width: 980px) {
          .operations-main { margin-left: 0; padding: 34px 22px 110px; }
          .filters-panel { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .filters-panel > label:first-child { grid-column: 1 / -1; }
        }

        @media (max-width: 640px) {
          .operations-main { padding: 27px 13px 112px; }
          .operations-header { align-items: flex-start; flex-direction: column; }
          .header-actions { justify-items: start; }
          .launch-readiness { padding: 17px; }
          .readiness-heading { flex-direction: column; }
          .readiness-score { width: 100%; }
          .readiness-gates { grid-template-columns: 1fr; }
          .pilot-coverage { padding: 17px; }
          .endurance-evidence { padding: 17px; }
          .coverage-heading { align-items: flex-start; flex-direction: column; }
          .coverage-heading > p { text-align: left; }
          .coverage-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .endurance-metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .metrics-grid,
          .filters-panel,
          .workflow-grid { grid-template-columns: 1fr; }
          .filters-panel > label:first-child { grid-column: auto; }
          .filters-panel > p { margin-bottom: 3px; }
          .queue-panel,
          .detail-panel { padding: 17px; border-radius: 18px; }
          .context-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .contact-card,
          .detail-actions { align-items: flex-start; flex-direction: column; }
          .detail-actions button { width: 100%; }
        }
      `}</style>
    </div>
  );
}
