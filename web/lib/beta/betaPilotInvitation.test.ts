import { describe, expect, it } from "vitest";

import {
  BetaPilotInvitationValidationError,
  getBetaPilotInvitationMetrics,
  parseBetaPilotInvitationRequest,
  type BetaPilotInvitation,
} from "@/lib/beta/betaPilotInvitation";

const invitation: BetaPilotInvitation = {
  consent_confirmed_at: "2026-08-28T20:00:00.000Z",
  created_at: "2026-08-28T20:00:00.000Z",
  email: "collector@example.com",
  id: "27bf58dc-0508-42cc-a58d-c31c4a5f7355",
  invited_by: "79223638-ffba-44a7-8f87-d9364fa18446",
  last_error_code: null,
  resend_email_id: "f7fdc64e-1aa7-4d49-b33b-7ec205ac5111",
  send_attempts: 1,
  sent_at: "2026-08-28T20:00:02.000Z",
  status: "sent",
  updated_at: "2026-08-28T20:00:02.000Z",
};

describe("beta pilot invitations", () => {
  it("normalizes an expected one-to-one invitation", () => {
    expect(
      parseBetaPilotInvitationRequest({
        consentConfirmed: true,
        email: "  Collector@Example.COM ",
      })
    ).toEqual({
      consentConfirmed: true,
      email: "collector@example.com",
    });
  });

  it("requires explicit confirmation that the collector expects the email", () => {
    expect(() =>
      parseBetaPilotInvitationRequest({
        consentConfirmed: false,
        email: "collector@example.com",
      })
    ).toThrow(BetaPilotInvitationValidationError);
  });

  it("summarizes provider sending states without inferring delivery", () => {
    expect(
      getBetaPilotInvitationMetrics([
        invitation,
        {
          ...invitation,
          id: "2241d29d-a0e6-4633-95ee-7e3f0f4935d0",
          status: "failed",
        },
        {
          ...invitation,
          id: "f660c7ed-f369-4792-bf04-f8431339a700",
          status: "pending",
        },
      ])
    ).toEqual({ failed: 1, pending: 1, sent: 1, total: 3 });
  });
});
