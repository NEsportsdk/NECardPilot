"use server";

import { redirect } from "next/navigation";

import { validateEmail } from "@/lib/auth/forms";
import { getAuthRedirectOrigin } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";

export async function requestPasswordReset(formData: FormData) {
  const emailResult = validateEmail(formData.get("email"));

  if (!emailResult.ok) {
    redirect(
      `/forgot-password?error=${encodeURIComponent(emailResult.message)}`
    );
  }

  const supabase = await createClient();
  const confirmationUrl = new URL("/auth/confirm", getAuthRedirectOrigin());
  confirmationUrl.searchParams.set("next", "/change-password");

  const { error } = await supabase.auth.resetPasswordForEmail(
    emailResult.data,
    {
      redirectTo: confirmationUrl.toString(),
    }
  );

  if (error) {
    console.error("Supabase password reset request failed", {
      code: error.code,
      status: error.status,
    });
  }

  redirect("/forgot-password?sent=1");
}
