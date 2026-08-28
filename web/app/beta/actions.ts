"use server";

import { revalidatePath } from "next/cache";

import {
  BetaPilotValidationError,
  parseBetaPilotUpdate,
  type BetaPilotProfile,
} from "@/lib/beta/betaPilot";
import { createStructuredErrorEvent } from "@/lib/observability/errorReporting";
import { createClient } from "@/lib/supabase/server";

export type SaveBetaPilotResult =
  | { ok: true; profile: BetaPilotProfile }
  | { error: string; ok: false };

export async function saveBetaPilotAction(
  input: unknown
): Promise<SaveBetaPilotResult> {
  let update: ReturnType<typeof parseBetaPilotUpdate>;

  try {
    update = parseBetaPilotUpdate(input);
  } catch (error) {
    return {
      error:
        error instanceof BetaPilotValidationError
          ? error.message
          : "The pilot update could not be read.",
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
      return { error: "Sign in before updating pilot progress.", ok: false };
    }

    const { data, error } = await supabase
      .from("beta_pilot_participants")
      .upsert(
        {
          browser: update.browser,
          completed_steps: update.completedSteps,
          install_mode: update.installMode,
          primary_device: update.primaryDevice,
          updated_at: new Date().toISOString(),
          user_id: user.id,
        },
        { onConflict: "user_id" }
      )
      .select(
        "user_id,primary_device,browser,install_mode,completed_steps,joined_at,updated_at"
      )
      .single();

    if (error || !data) {
      throw error ?? new Error("Pilot participant was not returned.");
    }

    console.log(
      JSON.stringify({
        completedSteps: update.completedSteps.length,
        event: "beta_pilot_progress_saved",
        installMode: update.installMode,
        level: "info",
        primaryDevice: update.primaryDevice,
        source: "server",
      })
    );

    revalidatePath("/beta");
    revalidatePath("/feedback/manage");

    return { ok: true, profile: data as BetaPilotProfile };
  } catch (error) {
    console.error(
      JSON.stringify(
        createStructuredErrorEvent({
          error,
          event: "beta_pilot_progress_save_failed",
          source: "server",
          context: {
            completedSteps: update.completedSteps.length,
            installMode: update.installMode,
            primaryDevice: update.primaryDevice,
          },
        })
      )
    );

    return {
      error: "Pilot progress could not be saved. Please try again.",
      ok: false,
    };
  }
}
