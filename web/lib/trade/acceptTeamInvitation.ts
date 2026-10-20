import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function acceptPendingTradeTeamInvitation(
  supabase: SupabaseClient
) {
  const { data, error } = await supabase.rpc(
    "accept_vallective_team_invitation"
  );

  if (error) {
    console.error("Vallective team invitation acceptance failed", {
      code: error.code,
      message: error.message,
    });
    return false;
  }

  return Array.isArray(data) && data.length > 0;
}
