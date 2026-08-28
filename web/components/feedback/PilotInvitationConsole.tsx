"use client";

import { useMemo, useState, useTransition } from "react";

import { sendBetaPilotInvitationAction } from "@/app/feedback/manage/invitation-actions";
import {
  getBetaPilotInvitationMetrics,
  type BetaPilotInvitation,
} from "@/lib/beta/betaPilotInvitation";

type PilotInvitationConsoleProps = {
  emailReady: boolean;
  initialInvitations: BetaPilotInvitation[];
};

const statusLabels: Record<BetaPilotInvitation["status"], string> = {
  failed: "Needs retry",
  pending: "Sending",
  sent: "Sent",
};

function formatDate(value: string | null) {
  if (!value) {
    return "Not sent";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function PilotInvitationConsole({
  emailReady,
  initialInvitations,
}: PilotInvitationConsoleProps) {
  const [invitations, setInvitations] = useState(initialInvitations);
  const [email, setEmail] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "success">(
    "success"
  );
  const [isPending, startTransition] = useTransition();
  const metrics = useMemo(
    () => getBetaPilotInvitationMetrics(invitations),
    [invitations]
  );

  function sendInvitation() {
    setMessage("");

    startTransition(async () => {
      const result = await sendBetaPilotInvitationAction({
        consentConfirmed,
        email,
      });

      if (!result.ok) {
        const failedInvitation = result.invitation;

        if (failedInvitation) {
          setInvitations((current) => [
            failedInvitation,
            ...current.filter((item) => item.id !== failedInvitation.id),
          ]);
        }

        setMessageTone("error");
        setMessage(result.error);
        return;
      }

      setInvitations((current) => [
        result.invitation,
        ...current.filter((item) => item.id !== result.invitation.id),
      ]);
      setEmail("");
      setConsentConfirmed(false);
      setMessageTone("success");
      setMessage("Invitation sent and added to the pilot audit trail.");
    });
  }

  function prepareRetry(invitation: BetaPilotInvitation) {
    setEmail(invitation.email);
    setConsentConfirmed(false);
    setMessageTone("success");
    setMessage("Address loaded. Reconfirm consent before retrying.");
  }

  return (
    <section
      className="invitation-console"
      aria-labelledby="pilot-invitations-title"
    >
      <div className="invitation-heading">
        <div>
          <p className="invitation-eyebrow">Controlled pilot access</p>
          <h2 id="pilot-invitations-title">Invite private beta testers</h2>
        </div>
        <p>
          Send one expected invitation at a time. Addresses remain visible only
          to beta operators and are never added to a marketing list.
        </p>
      </div>

      <div
        className="invitation-metrics"
        role="region"
        aria-label="Pilot invitation summary"
      >
        <article>
          <span>Total</span>
          <strong>{metrics.total}</strong>
        </article>
        <article>
          <span>Sent</span>
          <strong>{metrics.sent}</strong>
        </article>
        <article>
          <span>Sending</span>
          <strong>{metrics.pending}</strong>
        </article>
        <article>
          <span>Needs retry</span>
          <strong>{metrics.failed}</strong>
        </article>
      </div>

      <form
        className="invitation-form"
        onSubmit={(event) => {
          event.preventDefault();
          sendInvitation();
        }}
      >
        <label className="email-field">
          <span>Collector email</span>
          <input
            autoComplete="email"
            disabled={isPending || !emailReady}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="collector@example.com"
            required
            type="email"
            value={email}
          />
        </label>

        <label className="consent-field">
          <input
            checked={consentConfirmed}
            disabled={isPending || !emailReady}
            onChange={(event) => setConsentConfirmed(event.target.checked)}
            required
            type="checkbox"
          />
          <span>
            I confirm this collector expects a one-to-one private beta
            invitation from Vallective.
          </span>
        </label>

        <button disabled={isPending || !emailReady} type="submit">
          {isPending ? "Sending securely…" : "Send pilot invitation"}
        </button>
      </form>

      {!emailReady ? (
        <p className="configuration-warning" role="status">
          Invitations are paused until the email service has a verified
          Vallective sender and a monitored reply-to inbox.
        </p>
      ) : null}

      {message ? (
        <p className={`invitation-message ${messageTone}`} aria-live="polite">
          {message}
        </p>
      ) : null}

      <p className="delivery-note">
        “Sent” means Resend accepted the request. Delivery and opens are not
        inferred without verified provider events.
      </p>

      {invitations.length ? (
        <div className="invitation-list" aria-label="Recent pilot invitations">
          {invitations.map((invitation) => (
            <article key={invitation.id}>
              <div className="recipient-row">
                <strong>{invitation.email}</strong>
                <span className={`status ${invitation.status}`}>
                  {statusLabels[invitation.status]}
                </span>
              </div>
              <div className="delivery-row">
                <span>Attempt {invitation.send_attempts}</span>
                <time dateTime={invitation.sent_at ?? invitation.updated_at}>
                  {formatDate(invitation.sent_at ?? invitation.updated_at)}
                </time>
                {invitation.status === "failed" ? (
                  <button
                    className="retry-button"
                    onClick={() => prepareRetry(invitation)}
                    type="button"
                  >
                    Prepare retry
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="invitation-empty">
          No invitations yet. Start with one collector who has agreed to join
          the guided pilot.
        </div>
      )}

      <style jsx>{`
        .invitation-console {
          max-width: 1380px;
          margin: 0 auto 14px;
          padding: 20px;
          border: 1px solid rgba(124, 92, 255, 0.22);
          border-radius: 20px;
          background:
            linear-gradient(125deg, rgba(124, 92, 255, 0.1), transparent 48%),
            rgba(14, 17, 25, 0.96);
          color: #f8fafc;
        }

        .invitation-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 16px;
        }

        .invitation-eyebrow {
          margin: 0 0 9px;
          color: #9f93ff;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        h2 {
          margin: 0;
          color: #eef0f5;
          font-size: 22px;
          letter-spacing: -0.035em;
        }

        .invitation-heading > p {
          max-width: 500px;
          margin: 0;
          color: #7a8498;
          font-size: 10px;
          line-height: 1.6;
          text-align: right;
        }

        .invitation-metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 12px;
        }

        .invitation-metrics article {
          padding: 13px;
          border: 1px solid rgba(148, 163, 184, 0.08);
          border-radius: 13px;
          background: rgba(255, 255, 255, 0.018);
        }

        .invitation-metrics span,
        .email-field > span {
          display: block;
          color: #7a8498;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .invitation-metrics strong {
          display: block;
          margin-top: 6px;
          color: #f2f3f7;
          font-size: 20px;
        }

        .invitation-form {
          display: grid;
          grid-template-columns: minmax(220px, 0.8fr) minmax(320px, 1.3fr) auto;
          align-items: end;
          gap: 11px;
          padding: 14px;
          border: 1px solid rgba(148, 163, 184, 0.08);
          border-radius: 14px;
          background: rgba(7, 9, 14, 0.46);
        }

        .email-field input {
          width: 100%;
          min-height: 42px;
          box-sizing: border-box;
          margin-top: 7px;
          padding: 0 12px;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 10px;
          outline: none;
          background: #0b0e15;
          color: #f8fafc;
          font: inherit;
          font-size: 11px;
        }

        .email-field input:focus {
          border-color: rgba(159, 147, 255, 0.7);
          box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.12);
        }

        .consent-field {
          min-height: 42px;
          display: flex;
          align-items: center;
          gap: 10px;
          color: #9aa2b3;
          font-size: 9px;
          line-height: 1.5;
        }

        .consent-field input {
          width: 17px;
          height: 17px;
          flex: 0 0 auto;
          accent-color: #7c5cff;
        }

        .invitation-form > button {
          min-height: 42px;
          padding: 0 16px;
          border: 0;
          border-radius: 10px;
          background: linear-gradient(135deg, #7659ef, #927cff);
          color: white;
          cursor: pointer;
          font-size: 10px;
          font-weight: 820;
          white-space: nowrap;
        }

        button:disabled {
          cursor: wait;
          opacity: 0.55;
        }

        .invitation-message {
          margin: 10px 0 0;
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 9px;
        }

        .configuration-warning {
          margin: 10px 0 0;
          padding: 10px 12px;
          border-radius: 10px;
          background: rgba(251, 191, 36, 0.08);
          color: #f6d57d;
          font-size: 9px;
          line-height: 1.5;
        }

        .invitation-message.success {
          background: rgba(52, 211, 153, 0.08);
          color: #8be2c0;
        }

        .invitation-message.error {
          background: rgba(248, 113, 113, 0.09);
          color: #ffb4b4;
        }

        .delivery-note {
          margin: 11px 2px;
          color: #687185;
          font-size: 8px;
          line-height: 1.5;
        }

        .invitation-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .invitation-list article {
          min-width: 0;
          padding: 13px;
          border: 1px solid rgba(148, 163, 184, 0.08);
          border-radius: 13px;
          background: rgba(7, 9, 14, 0.38);
        }

        .recipient-row,
        .delivery-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .recipient-row strong {
          min-width: 0;
          overflow: hidden;
          color: #d9dce5;
          font-size: 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .status {
          flex: 0 0 auto;
          padding: 4px 7px;
          border-radius: 999px;
          font-size: 7px;
          font-weight: 850;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .status.sent { background: rgba(52, 211, 153, 0.1); color: #83dfbc; }
        .status.failed { background: rgba(248, 113, 113, 0.1); color: #ffaaaa; }
        .status.pending { background: rgba(251, 191, 36, 0.1); color: #f6d57d; }

        .delivery-row {
          justify-content: flex-start;
          flex-wrap: wrap;
          margin-top: 9px;
          color: #626c80;
          font-size: 8px;
        }

        .delivery-row time { margin-left: auto; }

        .retry-button {
          padding: 0;
          border: 0;
          background: transparent;
          color: #aaa2de;
          cursor: pointer;
          font: inherit;
          font-weight: 800;
        }

        .invitation-empty {
          padding: 16px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.018);
          color: #687185;
          font-size: 9px;
          text-align: center;
        }

        @media (max-width: 1120px) {
          .invitation-form { grid-template-columns: 1fr 1fr; }
          .invitation-form > button { grid-column: 1 / -1; }
          .invitation-list { grid-template-columns: 1fr; }
        }

        @media (max-width: 640px) {
          .invitation-console { padding: 17px; }
          .invitation-heading { align-items: flex-start; flex-direction: column; }
          .invitation-heading > p { text-align: left; }
          .invitation-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .invitation-form { grid-template-columns: 1fr; }
          .invitation-form > button { grid-column: auto; width: 100%; }
          .delivery-row time { margin-left: 0; }
        }
      `}</style>
    </section>
  );
}
