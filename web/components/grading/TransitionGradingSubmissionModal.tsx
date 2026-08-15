"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  transitionGradingSubmission,
  type GradingStatus,
  type TransitionGradingSubmissionResult,
} from "@/lib/grading/transitionGradingSubmission";

export type GradingSubmissionTransitionSummary = {
  id: string;
  name: string;
  gradingCompany: string;
  status: GradingStatus;
  cardCount: number;
  submissionNumber: string | null;
  outboundTrackingNumber: string | null;
  returnTrackingNumber: string | null;
};

type TransitionGradingSubmissionModalProps = {
  isOpen: boolean;
  submission: GradingSubmissionTransitionSummary | null;
  onClose: () => void;
  onTransitioned: (
    result: TransitionGradingSubmissionResult
  ) => void;
};

type TransitionConfig = {
  targetStatus: GradingStatus;
  eyebrow: string;
  title: string;
  description: string;
  buttonLabel: string;
  warning: string | null;
};

const PRIMARY_TRANSITIONS: Partial<
  Record<GradingStatus, TransitionConfig>
> = {
  draft: {
    targetStatus: "ready",
    eyebrow: "READY TO SHIP",
    title: "Mark submission ready",
    description:
      "Confirm that the cards, paperwork and declared values are prepared for shipment.",
    buttonLabel: "Mark ready",
    warning: null,
  },
  ready: {
    targetStatus: "shipped",
    eyebrow: "OUTBOUND SHIPMENT",
    title: "Mark submission shipped",
    description:
      "Record the shipment to the grading company. The included cards will be marked At grading.",
    buttonLabel: "Mark shipped",
    warning:
      "This moves every queued card into the active grading workflow.",
  },
  shipped: {
    targetStatus: "received",
    eyebrow: "GRADER RECEIPT",
    title: "Mark as received",
    description:
      "Confirm that the grading company has received the submission.",
    buttonLabel: "Mark received",
    warning: null,
  },
  received: {
    targetStatus: "grading",
    eyebrow: "IN GRADING",
    title: "Mark grading started",
    description:
      "Confirm that the submission has entered the grading process.",
    buttonLabel: "Start grading",
    warning: null,
  },
  grading: {
    targetStatus: "grades_ready",
    eyebrow: "RESULTS READY",
    title: "Mark grades ready",
    description:
      "Confirm that all card results have been recorded and the grades are available.",
    buttonLabel: "Mark grades ready",
    warning:
      "Every active card must have a recorded grade before this transition can be completed.",
  },
  grades_ready: {
    targetStatus: "returned",
    eyebrow: "RETURNED CARDS",
    title: "Mark cards returned",
    description:
      "Confirm that the graded cards are back in your possession.",
    buttonLabel: "Mark returned",
    warning:
      "This writes grade, certification number and grading cost into each card's Card DNA and clears any stale RAW market estimate.",
  },
  returned: {
    targetStatus: "completed",
    eyebrow: "COMPLETE WORKFLOW",
    title: "Complete submission",
    description:
      "Close the grading workflow after every returned card has been checked.",
    buttonLabel: "Complete submission",
    warning:
      "The submission remains available as permanent grading history after completion.",
  },
};

const CANCEL_CONFIG: TransitionConfig = {
  targetStatus: "cancelled",
  eyebrow: "CANCEL SUBMISSION",
  title: "Cancel submission",
  description:
    "Cancel this draft workflow before the cards are shipped.",
  buttonLabel: "Cancel submission",
  warning:
    "The submission will remain in history, but its queued cards will be released from the active grading workflow.",
};

function getLocalDateTimeValue(date = new Date()) {
  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000
  );

  return localDate.toISOString().slice(0, 16);
}

function getStatusLabel(status: GradingStatus) {
  switch (status) {
    case "draft":
      return "Draft";
    case "ready":
      return "Ready";
    case "shipped":
      return "Shipped";
    case "received":
      return "Received";
    case "grading":
      return "In grading";
    case "grades_ready":
      return "Grades ready";
    case "returned":
      return "Returned";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
  }
}

function getReadableError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "The grading submission could not be updated. Try again.";
}

export default function TransitionGradingSubmissionModal({
  isOpen,
  submission,
  onClose,
  onTransitioned,
}: TransitionGradingSubmissionModalProps) {
  const [targetStatus, setTargetStatus] =
    useState<GradingStatus | null>(null);
  const [occurredAt, setOccurredAt] = useState(
    getLocalDateTimeValue()
  );
  const [submissionNumber, setSubmissionNumber] = useState("");
  const [outboundTrackingNumber, setOutboundTrackingNumber] =
    useState("");
  const [returnTrackingNumber, setReturnTrackingNumber] =
    useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    null
  );

  const primaryConfig = submission
    ? PRIMARY_TRANSITIONS[submission.status] ?? null
    : null;

  const canCancel =
    submission?.status === "draft" || submission?.status === "ready";

  useEffect(() => {
    if (!isOpen || !submission) {
      return;
    }

    setTargetStatus(primaryConfig?.targetStatus ?? null);
    setOccurredAt(getLocalDateTimeValue());
    setSubmissionNumber(submission.submissionNumber ?? "");
    setOutboundTrackingNumber(
      submission.outboundTrackingNumber ?? ""
    );
    setReturnTrackingNumber(submission.returnTrackingNumber ?? "");
    setNotes("");
    setIsSaving(false);
    setErrorMessage(null);
  }, [isOpen, primaryConfig?.targetStatus, submission]);

  const handleClose = useCallback(() => {
    if (isSaving) {
      return;
    }

    onClose();
  }, [isSaving, onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSaving) {
        handleClose();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [handleClose, isOpen, isSaving]);

  const selectedConfig = useMemo(() => {
    if (!targetStatus) {
      return null;
    }

    if (targetStatus === "cancelled") {
      return CANCEL_CONFIG;
    }

    return primaryConfig?.targetStatus === targetStatus
      ? primaryConfig
      : null;
  }, [primaryConfig, targetStatus]);

  const showSubmissionNumber =
    targetStatus === "ready" || targetStatus === "shipped";
  const showOutboundTracking = targetStatus === "shipped";
  const showReturnTracking = targetStatus === "returned";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!submission || !selectedConfig || !targetStatus) {
      setErrorMessage("No valid status transition is available.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const result = await transitionGradingSubmission({
        submissionId: submission.id,
        targetStatus,
        occurredAt,
        submissionNumber,
        outboundTrackingNumber,
        returnTrackingNumber,
        notes,
      });

      onTransitioned(result);
    } catch (error) {
      setErrorMessage(getReadableError(error));
      setIsSaving(false);
    }
  }

  if (!isOpen || !submission) {
    return null;
  }

  return (
    <div
      className="transition-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <section
        className="transition-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="grading-transition-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="transition-header">
          <div>
            <span className="transition-badge">GRADING WORKFLOW</span>
            <h2 id="grading-transition-title">Update submission</h2>
            <p>
              Move the batch through its validated lifecycle. Card status
              and history are updated atomically.
            </p>
          </div>

          <button
            className="transition-close"
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            aria-label="Close status update"
          >
            ×
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <fieldset disabled={isSaving}>
            <div className="transition-content">
              <section className="submission-context">
                <div className="company-mark">
                  {submission.gradingCompany.slice(0, 3).toUpperCase()}
                </div>

                <div className="context-copy">
                  <strong>{submission.name}</strong>
                  <span>
                    {submission.gradingCompany} · {submission.cardCount}{" "}
                    {submission.cardCount === 1 ? "card" : "cards"}
                  </span>
                </div>

                <div className="current-status">
                  <span>Current status</span>
                  <strong>{getStatusLabel(submission.status)}</strong>
                </div>
              </section>

              {primaryConfig ? (
                <section className="transition-choice-section">
                  <span className="section-eyebrow">NEXT ACTION</span>
                  <div className="transition-choices">
                    <button
                      className={
                        targetStatus === primaryConfig.targetStatus
                          ? "transition-choice transition-choice-selected"
                          : "transition-choice"
                      }
                      type="button"
                      onClick={() => {
                        setTargetStatus(primaryConfig.targetStatus);
                        setErrorMessage(null);
                      }}
                    >
                      <span className="choice-arrow">→</span>
                      <span>
                        <strong>{primaryConfig.title}</strong>
                        <small>{primaryConfig.description}</small>
                      </span>
                    </button>

                    {canCancel && (
                      <button
                        className={
                          targetStatus === "cancelled"
                            ? "transition-choice transition-choice-selected transition-choice-danger"
                            : "transition-choice transition-choice-danger"
                        }
                        type="button"
                        onClick={() => {
                          setTargetStatus("cancelled");
                          setErrorMessage(null);
                        }}
                      >
                        <span className="choice-arrow">×</span>
                        <span>
                          <strong>{CANCEL_CONFIG.title}</strong>
                          <small>{CANCEL_CONFIG.description}</small>
                        </span>
                      </button>
                    )}
                  </div>
                </section>
              ) : (
                <div className="terminal-state">
                  <strong>No further transition is available.</strong>
                  <p>
                    This submission is already {getStatusLabel(
                      submission.status
                    ).toLowerCase()}.
                  </p>
                </div>
              )}

              {selectedConfig && (
                <section className="transition-form-section">
                  <div className="section-heading">
                    <div>
                      <span>{selectedConfig.eyebrow}</span>
                      <h3>{selectedConfig.title}</h3>
                      <p>{selectedConfig.description}</p>
                    </div>

                    <span className="target-status-pill">
                      {getStatusLabel(selectedConfig.targetStatus)}
                    </span>
                  </div>

                  <div className="form-grid">
                    <label className="field">
                      <span>Status date and time</span>
                      <input
                        type="datetime-local"
                        value={occurredAt}
                        onChange={(event) =>
                          setOccurredAt(event.target.value)
                        }
                      />
                    </label>

                    {showSubmissionNumber && (
                      <label className="field">
                        <span>Submission number</span>
                        <input
                          type="text"
                          value={submissionNumber}
                          onChange={(event) =>
                            setSubmissionNumber(event.target.value)
                          }
                          placeholder="Grader submission number"
                        />
                      </label>
                    )}

                    {showOutboundTracking && (
                      <label className="field field-wide">
                        <span>Outbound tracking number</span>
                        <input
                          type="text"
                          value={outboundTrackingNumber}
                          onChange={(event) =>
                            setOutboundTrackingNumber(event.target.value)
                          }
                          placeholder="Carrier tracking number"
                        />
                      </label>
                    )}

                    {showReturnTracking && (
                      <label className="field field-wide">
                        <span>Return tracking number</span>
                        <input
                          type="text"
                          value={returnTrackingNumber}
                          onChange={(event) =>
                            setReturnTrackingNumber(event.target.value)
                          }
                          placeholder="Return shipment tracking number"
                        />
                      </label>
                    )}
                  </div>

                  <label className="notes-field">
                    <span>Workflow notes</span>
                    <textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Optional note for the permanent grading history..."
                    />
                  </label>

                  {selectedConfig.warning && (
                    <div
                      className={
                        targetStatus === "cancelled"
                          ? "transition-warning transition-warning-danger"
                          : "transition-warning"
                      }
                    >
                      <span>!</span>
                      <p>{selectedConfig.warning}</p>
                    </div>
                  )}
                </section>
              )}

              {errorMessage && (
                <div className="transition-error" role="alert">
                  <span>!</span>
                  <div>
                    <strong>Status could not be updated</strong>
                    <p>{errorMessage}</p>
                  </div>
                </div>
              )}
            </div>
          </fieldset>

          <footer className="transition-footer">
            <p>
              {selectedConfig
                ? `${getStatusLabel(submission.status)} → ${getStatusLabel(
                    selectedConfig.targetStatus
                  )}`
                : "No action available"}
            </p>

            <div className="footer-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={handleClose}
                disabled={isSaving}
              >
                Close
              </button>

              {selectedConfig && (
                <button
                  className={
                    targetStatus === "cancelled"
                      ? "primary-button primary-button-danger"
                      : "primary-button"
                  }
                  type="submit"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <span className="button-spinner" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <span>{targetStatus === "cancelled" ? "×" : "✓"}</span>
                      {selectedConfig.buttonLabel}
                    </>
                  )}
                </button>
              )}
            </div>
          </footer>
        </form>
      </section>

      <style jsx>{`
        .transition-backdrop {
          position: fixed;
          inset: 0;
          z-index: 3500;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(3, 5, 12, 0.9);
          backdrop-filter: blur(16px);
        }

        .transition-modal {
          width: min(760px, 100%);
          max-height: calc(100vh - 48px);
          overflow-y: auto;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 26px;
          background:
            radial-gradient(
              circle at top right,
              rgba(124, 92, 255, 0.13),
              transparent 37%
            ),
            #11131c;
          box-shadow: 0 38px 120px rgba(0, 0, 0, 0.7);
          color: #f8fafc;
        }

        .transition-header {
          position: sticky;
          top: 0;
          z-index: 10;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          padding: 28px 30px 24px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.12);
          background: rgba(17, 19, 28, 0.97);
          backdrop-filter: blur(18px);
        }

        .transition-badge {
          display: inline-flex;
          padding: 6px 10px;
          border: 1px solid rgba(167, 139, 250, 0.25);
          border-radius: 999px;
          background: rgba(139, 92, 246, 0.1);
          color: #c4b5fd;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.16em;
        }

        .transition-header h2 {
          margin: 13px 0 0;
          color: #fff;
          font-size: 28px;
          letter-spacing: -0.035em;
        }

        .transition-header p {
          max-width: 580px;
          margin: 8px 0 0;
          color: #9299aa;
          font-size: 13px;
          line-height: 1.55;
        }

        .transition-close {
          width: 40px;
          height: 40px;
          flex: 0 0 auto;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.03);
          color: #9299aa;
          font-size: 26px;
          cursor: pointer;
        }

        .transition-close:hover:not(:disabled) {
          border-color: rgba(167, 139, 250, 0.5);
          color: #fff;
        }

        fieldset {
          margin: 0;
          padding: 0;
          border: 0;
        }

        .transition-content {
          display: grid;
          gap: 20px;
          padding: 28px 30px;
        }

        .submission-context {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.025);
        }

        .company-mark {
          width: 48px;
          height: 48px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border: 1px solid rgba(167, 139, 250, 0.24);
          border-radius: 14px;
          background: rgba(124, 92, 255, 0.09);
          color: #c4b5fd;
          font-size: 12px;
          font-weight: 850;
        }

        .context-copy {
          min-width: 0;
          flex: 1;
        }

        .context-copy strong {
          display: block;
          overflow: hidden;
          color: #fff;
          font-size: 14px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .context-copy span {
          display: block;
          margin-top: 5px;
          color: #71798b;
          font-size: 11px;
        }

        .current-status {
          flex: 0 0 auto;
          text-align: right;
        }

        .current-status span {
          display: block;
          color: #71798b;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }

        .current-status strong {
          display: block;
          margin-top: 6px;
          color: #ddd6fe;
          font-size: 12px;
        }

        .section-eyebrow,
        .section-heading > div > span {
          color: #9f93ff;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.15em;
        }

        .transition-choices {
          display: grid;
          gap: 10px;
          margin-top: 11px;
        }

        .transition-choice {
          width: 100%;
          display: flex;
          align-items: flex-start;
          gap: 13px;
          padding: 15px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 15px;
          background: rgba(255, 255, 255, 0.02);
          color: inherit;
          text-align: left;
          cursor: pointer;
        }

        .transition-choice:hover {
          border-color: rgba(167, 139, 250, 0.35);
          background: rgba(124, 92, 255, 0.05);
        }

        .transition-choice-selected {
          border-color: rgba(139, 92, 246, 0.68);
          background: rgba(124, 92, 255, 0.09);
          box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.055);
        }

        .transition-choice-danger:hover,
        .transition-choice-danger.transition-choice-selected {
          border-color: rgba(248, 113, 113, 0.52);
          background: rgba(239, 68, 68, 0.07);
        }

        .choice-arrow {
          width: 29px;
          height: 29px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: rgba(255, 255, 255, 0.05);
          color: #c4b5fd;
          font-weight: 800;
        }

        .transition-choice strong {
          display: block;
          color: #fff;
          font-size: 13px;
        }

        .transition-choice small {
          display: block;
          margin-top: 5px;
          color: #71798b;
          font-size: 10px;
          line-height: 1.5;
        }

        .transition-form-section {
          padding: 21px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.022);
        }

        .section-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          padding-bottom: 17px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
        }

        .section-heading h3 {
          margin: 7px 0 0;
          color: #fff;
          font-size: 18px;
        }

        .section-heading p {
          max-width: 510px;
          margin: 6px 0 0;
          color: #71798b;
          font-size: 11px;
          line-height: 1.5;
        }

        .target-status-pill {
          flex: 0 0 auto;
          padding: 7px 9px;
          border-radius: 999px;
          background: rgba(139, 92, 246, 0.1);
          color: #c4b5fd;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 11px;
          margin-top: 17px;
        }

        .field,
        .notes-field {
          display: grid;
          gap: 7px;
        }

        .field-wide {
          grid-column: 1 / -1;
        }

        .field > span,
        .notes-field > span {
          color: #81899c;
          font-size: 9px;
          font-weight: 750;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .field input,
        .notes-field textarea {
          width: 100%;
          border: 1px solid rgba(148, 163, 184, 0.13);
          border-radius: 12px;
          outline: none;
          background: rgba(0, 0, 0, 0.18);
          color: #fff;
          color-scheme: dark;
          font: inherit;
          font-size: 12px;
        }

        .field input {
          min-height: 43px;
          padding: 0 12px;
        }

        .notes-field {
          margin-top: 12px;
        }

        .notes-field textarea {
          min-height: 92px;
          resize: vertical;
          padding: 12px;
          line-height: 1.5;
        }

        .field input:focus,
        .notes-field textarea:focus {
          border-color: rgba(167, 139, 250, 0.62);
          box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.07);
        }

        .transition-warning,
        .transition-error {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          margin-top: 14px;
          padding: 13px 14px;
          border-radius: 13px;
        }

        .transition-warning {
          border: 1px solid rgba(251, 191, 36, 0.2);
          background: rgba(245, 158, 11, 0.06);
          color: #fde68a;
        }

        .transition-warning-danger,
        .transition-error {
          border: 1px solid rgba(248, 113, 113, 0.24);
          background: rgba(239, 68, 68, 0.08);
          color: #fecaca;
        }

        .transition-warning > span,
        .transition-error > span {
          width: 24px;
          height: 24px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.07);
          font-size: 11px;
          font-weight: 800;
        }

        .transition-warning p,
        .transition-error p {
          margin: 2px 0 0;
          color: currentColor;
          font-size: 10px;
          line-height: 1.5;
          opacity: 0.82;
        }

        .transition-error {
          margin-top: 0;
        }

        .transition-error strong {
          font-size: 12px;
        }

        .terminal-state {
          padding: 22px;
          border: 1px dashed rgba(148, 163, 184, 0.17);
          border-radius: 16px;
          background: rgba(0, 0, 0, 0.11);
          text-align: center;
        }

        .terminal-state strong {
          color: #d5d9e2;
          font-size: 13px;
        }

        .terminal-state p {
          margin: 7px 0 0;
          color: #71798b;
          font-size: 11px;
        }

        .transition-footer {
          position: sticky;
          bottom: 0;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 20px 30px;
          border-top: 1px solid rgba(148, 163, 184, 0.12);
          background: rgba(17, 19, 28, 0.97);
          backdrop-filter: blur(18px);
        }

        .transition-footer > p {
          margin: 0;
          color: #71798b;
          font-size: 11px;
        }

        .footer-actions {
          display: flex;
          gap: 10px;
        }

        .secondary-button,
        .primary-button {
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 17px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 750;
          cursor: pointer;
        }

        .secondary-button {
          border: 1px solid rgba(148, 163, 184, 0.16);
          background: rgba(255, 255, 255, 0.03);
          color: #a5adbd;
        }

        .primary-button {
          min-width: 155px;
          border: 0;
          background: linear-gradient(135deg, #8b5cf6, #6d5ce7);
          color: #fff;
          box-shadow: 0 10px 28px rgba(124, 92, 255, 0.23);
        }

        .primary-button-danger {
          background: linear-gradient(135deg, #ef4444, #c24141);
          box-shadow: 0 10px 28px rgba(239, 68, 68, 0.18);
        }

        .secondary-button:disabled,
        .primary-button:disabled,
        .transition-close:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .button-spinner {
          width: 15px;
          height: 15px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: transition-spin 700ms linear infinite;
        }

        @keyframes transition-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 640px) {
          .transition-backdrop {
            align-items: flex-end;
            padding: 0;
          }

          .transition-modal {
            width: 100%;
            max-height: 100dvh;
            border-radius: 0;
          }

          .transition-header,
          .transition-content,
          .transition-footer {
            padding-left: 18px;
            padding-right: 18px;
          }

          .transition-header {
            padding-top: max(22px, env(safe-area-inset-top));
          }

          .submission-context {
            align-items: flex-start;
          }

          .current-status {
            display: none;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .field-wide {
            grid-column: auto;
          }

          .section-heading {
            flex-direction: column;
          }

          .transition-footer {
            align-items: stretch;
            flex-direction: column;
            padding-bottom: max(18px, env(safe-area-inset-bottom));
          }

          .footer-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </div>
  );
}