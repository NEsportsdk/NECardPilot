"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  getAuthSecret,
  getConfirmationFallbackPath,
  getEmailOtpType,
} from "@/lib/auth/confirmation";
import { getSafeNextPath } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";

export async function confirmAuthLink(formData: FormData) {
  const code = getAuthSecret(formData.get("code"));
  const tokenHash = getAuthSecret(formData.get("token_hash"));
  const otpType = getEmailOtpType(formData.get("type"));
  const nextPath = getSafeNextPath(
    formData.get("next"),
    getConfirmationFallbackPath(otpType)
  );

  if ((!code && (!tokenHash || !otpType)) || (code && tokenHash)) {
    redirect("/auth/error");
  }

  const supabase = await createClient();
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({
        token_hash: tokenHash!,
        type: otpType!,
      });

  if (error) {
    console.error("Supabase auth link confirmation failed", {
      code: error.code,
      status: error.status,
      type: otpType,
    });
    redirect("/auth/error");
  }

  revalidatePath("/", "layout");
  redirect(nextPath);
}
