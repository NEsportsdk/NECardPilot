import type { CaptureEnduranceEvidence } from "@/lib/scan/captureEndurance";
import { createClient } from "@/lib/supabase/client";

function getReadableError(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message;
  }

  return fallback;
}

export async function saveCaptureEnduranceEvidence(
  evidence: CaptureEnduranceEvidence
) {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Log ind igen, før endurance-beviset gemmes.");
  }

  const payload = {
    ...evidence,
    user_id: user.id,
  };
  const { data, error } = await supabase
    .from("beta_capture_endurance_runs")
    .insert(payload)
    .select("*")
    .single();

  if (!error && data) {
    return data as CaptureEnduranceEvidence;
  }

  if (error?.code === "23505") {
    const { data: existing, error: existingError } = await supabase
      .from("beta_capture_endurance_runs")
      .select("*")
      .eq("capture_session_id", evidence.capture_session_id)
      .maybeSingle();

    if (!existingError && existing) {
      return existing as CaptureEnduranceEvidence;
    }
  }

  throw new Error(
    getReadableError(error, "Endurance-beviset kunne ikke gemmes sikkert.")
  );
}
