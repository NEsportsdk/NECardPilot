import { validateEmail } from "@/lib/auth/forms";

export const betaPilotInvitationStatuses = [
  "pending",
  "sent",
  "failed",
] as const;

export type BetaPilotInvitationStatus =
  (typeof betaPilotInvitationStatuses)[number];

export type BetaPilotInvitation = {
  consent_confirmed_at: string;
  created_at: string;
  email: string;
  id: string;
  invited_by: string | null;
  last_error_code: string | null;
  resend_email_id: string | null;
  send_attempts: number;
  sent_at: string | null;
  status: BetaPilotInvitationStatus;
  updated_at: string;
};

export type BetaPilotInvitationRequest = {
  consentConfirmed: true;
  email: string;
};

export type BetaPilotInvitationMetrics = {
  failed: number;
  pending: number;
  sent: number;
  total: number;
};

export class BetaPilotInvitationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BetaPilotInvitationValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseBetaPilotInvitationRequest(
  value: unknown
): BetaPilotInvitationRequest {
  if (!isRecord(value)) {
    throw new BetaPilotInvitationValidationError(
      "Invitation details are missing."
    );
  }

  const emailResult = validateEmail(value.email);

  if (!emailResult.ok) {
    throw new BetaPilotInvitationValidationError(emailResult.message);
  }

  if (value.consentConfirmed !== true) {
    throw new BetaPilotInvitationValidationError(
      "Confirm that this collector expects a private beta invitation."
    );
  }

  return {
    consentConfirmed: true,
    email: emailResult.data,
  };
}

export function getBetaPilotInvitationMetrics(
  invitations: readonly BetaPilotInvitation[]
): BetaPilotInvitationMetrics {
  return invitations.reduce<BetaPilotInvitationMetrics>(
    (metrics, invitation) => ({
      ...metrics,
      [invitation.status]: metrics[invitation.status] + 1,
      total: metrics.total + 1,
    }),
    { failed: 0, pending: 0, sent: 0, total: 0 }
  );
}
