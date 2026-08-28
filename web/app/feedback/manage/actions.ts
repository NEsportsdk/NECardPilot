"use server";

import { revalidatePath } from "next/cache";

import {
  BetaFeedbackWorkflowValidationError,
  parseBetaFeedbackWorkflowUpdate,
  type BetaFeedbackQueueItem,
} from "@/lib/feedback/betaFeedbackAdmin";
import { createStructuredErrorEvent } from "@/lib/observability/errorReporting";
import { createClient } from "@/lib/supabase/server";

export type UpdateBetaFeedbackResult =
  | { feedback: BetaFeedbackQueueItem; ok: true }
  | { error: string; ok: false };

export async function updateBetaFeedbackAction(
  input: unknown
): Promise<UpdateBetaFeedbackResult> {
  let update: ReturnType<typeof parseBetaFeedbackWorkflowUpdate>;

  try {
    update = parseBetaFeedbackWorkflowUpdate(input);
  } catch (error) {
    return {
      error:
        error instanceof BetaFeedbackWorkflowValidationError
          ? error.message
          : "The feedback update could not be read.",
      ok: false,
    };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { error: "Sign in before managing beta feedback.", ok: false };
    }

    const { data: membership, error: membershipError } = await supabase
      .from("beta_feedback_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      return {
        error: "Your account cannot manage the private beta queue.",
        ok: false,
      };
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("beta_feedback")
      .update({
        internal_note: update.internalNote,
        priority: update.priority,
        reviewed_at: update.status === "new" ? null : now,
        status: update.status,
        updated_at: now,
      })
      .eq("id", update.id)
      .select(
        "id,user_id,category,experience_rating,message,page_path,screen_class,language,is_online,is_standalone,allow_follow_up,contact_email,status,priority,internal_note,reviewed_at,created_at,updated_at"
      )
      .maybeSingle();

    if (error || !data) {
      throw error ?? new Error("Feedback report was not found.");
    }

    console.log(
      JSON.stringify({
        event: "beta_feedback_workflow_updated",
        feedbackId: update.id,
        level: "info",
        priority: update.priority,
        source: "server",
        status: update.status,
      })
    );

    revalidatePath("/feedback/manage");

    return {
      feedback: data as BetaFeedbackQueueItem,
      ok: true,
    };
  } catch (error) {
    console.error(
      JSON.stringify(
        createStructuredErrorEvent({
          error,
          event: "beta_feedback_workflow_update_failed",
          source: "server",
          context: {
            feedbackId: update.id,
            priority: update.priority,
            status: update.status,
          },
        })
      )
    );

    return {
      error: "The beta queue could not be updated. Please try again.",
      ok: false,
    };
  }
}
