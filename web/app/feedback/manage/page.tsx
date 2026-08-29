import { redirect } from "next/navigation";

import FeedbackOperationsClient from "@/components/feedback/FeedbackOperationsClient";
import PilotInvitationConsole from "@/components/feedback/PilotInvitationConsole";
import type { BetaPilotCoverageCheck } from "@/lib/beta/betaLaunchReadiness";
import type { BetaPilotProfile } from "@/lib/beta/betaPilot";
import type { BetaPilotInvitation } from "@/lib/beta/betaPilotInvitation";
import { isBetaPilotEmailConfigured } from "@/lib/email/sendBetaPilotInvitation";
import type { BetaFeedbackQueueItem } from "@/lib/feedback/betaFeedbackAdmin";
import { createClient } from "@/lib/supabase/server";

export default async function FeedbackOperationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login?next=%2Ffeedback%2Fmanage");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("beta_feedback_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError || !membership) {
    redirect("/feedback");
  }

  const [feedbackResult, participantsResult, coverageResult, invitationsResult] =
    await Promise.all([
      supabase
        .from("beta_feedback")
        .select(
          "id,user_id,category,experience_rating,message,page_path,screen_class,language,is_online,is_standalone,allow_follow_up,contact_email,status,priority,internal_note,reviewed_at,created_at,updated_at"
        )
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(100),
      supabase
        .from("beta_pilot_participants")
        .select(
          "user_id,primary_device,browser,install_mode,completed_steps,joined_at,updated_at"
        )
        .order("updated_at", { ascending: false })
        .limit(100),
      supabase
        .from("beta_pilot_coverage_checks")
        .select(
          "user_id,primary_device,browser,install_mode,first_verified_at,last_verified_at"
        )
        .order("last_verified_at", { ascending: false })
        .limit(100),
      supabase
        .from("beta_pilot_invitations")
        .select(
          "id,email,status,send_attempts,resend_email_id,last_error_code,consent_confirmed_at,invited_by,sent_at,created_at,updated_at"
        )
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(100),
    ]);

  if (
    feedbackResult.error ||
    participantsResult.error ||
    coverageResult.error ||
    invitationsResult.error
  ) {
    throw (
      feedbackResult.error ??
      participantsResult.error ??
      coverageResult.error ??
      invitationsResult.error
    );
  }

  return (
    <FeedbackOperationsClient
      initialCoverageChecks={
        (coverageResult.data ?? []) as BetaPilotCoverageCheck[]
      }
      initialFeedback={(feedbackResult.data ?? []) as BetaFeedbackQueueItem[]}
      initialParticipants={(participantsResult.data ?? []) as BetaPilotProfile[]}
      invitationConsole={
        <PilotInvitationConsole
          emailReady={isBetaPilotEmailConfigured()}
          initialInvitations={
            (invitationsResult.data ?? []) as BetaPilotInvitation[]
          }
        />
      }
    />
  );
}
