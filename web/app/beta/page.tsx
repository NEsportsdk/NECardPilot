import { redirect } from "next/navigation";

import BetaPilotClient from "@/components/beta/BetaPilotClient";
import type { BetaPilotProfile } from "@/lib/beta/betaPilot";
import { createClient } from "@/lib/supabase/server";

export default async function BetaPilotPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login?next=%2Fbeta");
  }

  const [profileResult, membershipResult] = await Promise.all([
    supabase
      .from("beta_pilot_participants")
      .select(
        "user_id,primary_device,browser,install_mode,completed_steps,joined_at,updated_at"
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("beta_feedback_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (profileResult.error) {
    throw profileResult.error;
  }

  return (
    <BetaPilotClient
      canManagePilot={Boolean(membershipResult.data)}
      initialProfile={(profileResult.data as BetaPilotProfile | null) ?? null}
    />
  );
}
