"use server";

import { revalidatePath } from "next/cache";

import { getAuthRedirectOrigin } from "@/lib/auth/redirects";
import {
  BetaPilotInvitationValidationError,
  parseBetaPilotInvitationRequest,
  type BetaPilotInvitation,
} from "@/lib/beta/betaPilotInvitation";
import { sendBetaPilotInvitation } from "@/lib/email/sendBetaPilotInvitation";
import { createStructuredErrorEvent } from "@/lib/observability/errorReporting";
import { createClient } from "@/lib/supabase/server";

const invitationColumns =
  "id,email,status,send_attempts,resend_email_id,last_error_code,consent_confirmed_at,invited_by,sent_at,created_at,updated_at";

export type SendBetaPilotInvitationActionResult =
  | { invitation: BetaPilotInvitation; ok: true }
  | {
      error: string;
      invitation?: BetaPilotInvitation;
      ok: false;
    };

function invitationErrorMessage(errorCode: string) {
  switch (errorCode) {
    case "missing_api_key":
    case "authentication_error":
      return "The pilot email service is not connected yet.";
    case "missing_from_email":
    case "authorization_error":
      return "The verified Vallective sender address is not ready yet.";
    case "missing_reply_to_email":
      return "A monitored reply-to inbox is required before invitations can be sent.";
    case "rate_limit_exceeded":
      return "The email service is busy. Try this invitation again shortly.";
    default:
      return "The invitation could not be sent. Check the pilot queue and try again.";
  }
}

export async function sendBetaPilotInvitationAction(
  input: unknown
): Promise<SendBetaPilotInvitationActionResult> {
  let request: ReturnType<typeof parseBetaPilotInvitationRequest>;

  try {
    request = parseBetaPilotInvitationRequest(input);
  } catch (error) {
    return {
      error:
        error instanceof BetaPilotInvitationValidationError
          ? error.message
          : "The invitation could not be read.",
      ok: false,
    };
  }

  let invitationId: string | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { error: "Sign in before inviting a beta tester.", ok: false };
    }

    const { data: membership, error: membershipError } = await supabase
      .from("beta_feedback_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      return {
        error: "Your account cannot send private beta invitations.",
        ok: false,
      };
    }

    const { data: existing, error: existingError } = await supabase
      .from("beta_pilot_invitations")
      .select(invitationColumns)
      .eq("email", request.email)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existing?.status === "sent") {
      return {
        error: "This collector already has a sent pilot invitation.",
        ok: false,
      };
    }

    const now = new Date().toISOString();
    let invitation: BetaPilotInvitation;

    if (existing) {
      const current = existing as BetaPilotInvitation;
      const nextAttempt =
        current.status === "failed"
          ? current.send_attempts + 1
          : current.send_attempts;

      if (nextAttempt > 20) {
        return {
          error: "This invitation has reached its retry limit.",
          ok: false,
        };
      }

      const { data, error } = await supabase
        .from("beta_pilot_invitations")
        .update({
          last_error_code: null,
          resend_email_id: null,
          send_attempts: nextAttempt,
          sent_at: null,
          status: "pending",
          updated_at: now,
        })
        .eq("id", current.id)
        .select(invitationColumns)
        .single();

      if (error || !data) {
        throw error ?? new Error("Invitation retry was not returned.");
      }

      invitation = data as BetaPilotInvitation;
    } else {
      const { data, error } = await supabase
        .from("beta_pilot_invitations")
        .insert({
          consent_confirmed_at: now,
          email: request.email,
          invited_by: user.id,
          send_attempts: 1,
        })
        .select(invitationColumns)
        .single();

      if (error || !data) {
        throw error ?? new Error("Pilot invitation was not returned.");
      }

      invitation = data as BetaPilotInvitation;
    }

    invitationId = invitation.id;

    const inviteUrl = new URL(
      "/signup?next=%2Fbeta",
      getAuthRedirectOrigin()
    ).toString();
    const sendResult = await sendBetaPilotInvitation({
      email: invitation.email,
      idempotencyKey: `beta-pilot-invitation/${invitation.id}/attempt-${invitation.send_attempts}`,
      inviteUrl,
    });

    if (!sendResult.ok) {
      const { data, error } = await supabase
        .from("beta_pilot_invitations")
        .update({
          last_error_code: sendResult.errorCode,
          resend_email_id: null,
          sent_at: null,
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", invitation.id)
        .select(invitationColumns)
        .single();

      if (error || !data) {
        throw error ?? new Error("Failed invitation state was not returned.");
      }

      const failedInvitation = data as BetaPilotInvitation;

      console.warn(
        JSON.stringify({
          errorCode: sendResult.errorCode,
          event: "beta_pilot_invitation_provider_rejected",
          invitationId: invitation.id,
          level: "warn",
          sendAttempts: invitation.send_attempts,
          source: "server",
        })
      );

      revalidatePath("/feedback/manage");

      return {
        error: invitationErrorMessage(sendResult.errorCode),
        invitation: failedInvitation,
        ok: false,
      };
    }

    const sentAt = new Date().toISOString();
    const { data: sentInvitation, error: sentError } = await supabase
      .from("beta_pilot_invitations")
      .update({
        last_error_code: null,
        resend_email_id: sendResult.emailId,
        sent_at: sentAt,
        status: "sent",
        updated_at: sentAt,
      })
      .eq("id", invitation.id)
      .select(invitationColumns)
      .single();

    if (sentError || !sentInvitation) {
      throw sentError ?? new Error("Sent invitation state was not returned.");
    }

    console.log(
      JSON.stringify({
        event: "beta_pilot_invitation_sent",
        invitationId: invitation.id,
        level: "info",
        sendAttempts: invitation.send_attempts,
        source: "server",
      })
    );

    revalidatePath("/feedback/manage");

    return {
      invitation: sentInvitation as BetaPilotInvitation,
      ok: true,
    };
  } catch (error) {
    console.error(
      JSON.stringify(
        createStructuredErrorEvent({
          error,
          event: "beta_pilot_invitation_send_failed",
          source: "server",
          context: { invitationId },
        })
      )
    );

    return {
      error: "The pilot invitation could not be completed. Please try again.",
      ok: false,
    };
  }
}
