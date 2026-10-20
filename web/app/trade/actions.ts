"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAuthRedirectOrigin } from "@/lib/auth/redirects";
import { sendTradeTeamInvitation } from "@/lib/email/sendTradeTeamInvitation";
import { createClient } from "@/lib/supabase/server";

type InvitationRow = {
  id: string;
  email: string;
  display_name: string;
  send_attempts: number;
  status: "accepted" | "failed" | "pending" | "revoked" | "sent";
};

function invitationRedirect(status: "failed" | "sent"): never {
  redirect(`/trade?invite=${status}`);
}

export async function sendPendingTradeTeamInvitationAction() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login?next=%2Ftrade");
  }

  const { data, error } = await supabase
    .from("vallective_team_invitations")
    .select("id,email,display_name,send_attempts,status")
    .or(`owner_user_id.eq.${user.id},invited_by.eq.${user.id}`)
    .in("status", ["pending", "failed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    console.error("Vallective team invitation could not be loaded", {
      code: error?.code ?? "not_found",
      ownerUserId: user.id,
    });
    invitationRedirect("failed");
  }

  const invitation = data as InvitationRow;
  const sendAttempts =
    invitation.status === "failed"
      ? invitation.send_attempts + 1
      : invitation.send_attempts;

  if (sendAttempts > 20) {
    invitationRedirect("failed");
  }

  const inviteUrl = new URL("/signup", getAuthRedirectOrigin());
  inviteUrl.searchParams.set("next", "/trade");

  const sendResult = await sendTradeTeamInvitation({
    email: invitation.email,
    idempotencyKey: `trade-team-invitation/${invitation.id}/attempt-${sendAttempts}`,
    inviteUrl: inviteUrl.toString(),
    name: invitation.display_name,
  });
  const now = new Date().toISOString();

  if (!sendResult.ok) {
    await supabase
      .from("vallective_team_invitations")
      .update({
        last_error_code: sendResult.errorCode,
        resend_email_id: null,
        send_attempts: sendAttempts,
        sent_at: null,
        status: "failed",
        updated_at: now,
      })
      .eq("id", invitation.id);

    console.warn("Vallective team invitation provider rejected the email", {
      errorCode: sendResult.errorCode,
      invitationId: invitation.id,
      sendAttempts,
    });
    revalidatePath("/trade");
    invitationRedirect("failed");
  }

  const { error: updateError } = await supabase
    .from("vallective_team_invitations")
    .update({
      last_error_code: null,
      resend_email_id: sendResult.emailId,
      send_attempts: sendAttempts,
      sent_at: now,
      status: "sent",
      updated_at: now,
    })
    .eq("id", invitation.id);

  if (updateError) {
    console.error("Sent Vallective team invitation was not recorded", {
      code: updateError.code,
      invitationId: invitation.id,
    });
    invitationRedirect("failed");
  }

  revalidatePath("/trade");
  invitationRedirect("sent");
}
