import { redirect } from "next/navigation";

import FeedbackOperationsClient from "@/components/feedback/FeedbackOperationsClient";
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

  const { data, error } = await supabase
    .from("beta_feedback")
    .select(
      "id,user_id,category,experience_rating,message,page_path,screen_class,language,is_online,is_standalone,allow_follow_up,contact_email,status,priority,internal_note,reviewed_at,created_at,updated_at"
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(100);

  if (error) {
    throw error;
  }

  return (
    <FeedbackOperationsClient
      initialFeedback={(data ?? []) as BetaFeedbackQueueItem[]}
    />
  );
}
