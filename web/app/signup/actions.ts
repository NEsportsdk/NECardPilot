"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { validateSignupInput } from "@/lib/auth/forms";
import {
  getAuthRedirectOrigin,
  getSafeNextPath,
} from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";

function signupUrl(
  nextPath: string,
  values: Record<string, string>
) {
  const params = new URLSearchParams(values);

  if (nextPath !== "/welcome") {
    params.set("next", nextPath);
  }

  return `/signup?${params.toString()}`;
}

export async function signup(formData: FormData) {
  const nextPath = getSafeNextPath(formData.get("next"), "/welcome");
  const result = validateSignupInput({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!result.ok) {
    redirect(signupUrl(nextPath, { error: result.message }));
  }

  const supabase = await createClient();
  const confirmationUrl = new URL("/auth/confirm", getAuthRedirectOrigin());
  confirmationUrl.searchParams.set("next", nextPath);

  const { data, error } = await supabase.auth.signUp({
    email: result.data.email,
    password: result.data.password,
    options: {
      data: {
        display_name: result.data.displayName,
      },
      emailRedirectTo: confirmationUrl.toString(),
    },
  });

  if (error) {
    const normalizedMessage = error.message.toLowerCase();

    if (normalizedMessage.includes("already registered")) {
      redirect(signupUrl(nextPath, { sent: "1" }));
    }

    console.error("Supabase signup failed", {
      code: error.code,
      status: error.status,
    });

    const message = normalizedMessage.includes("too many requests")
      ? "Too many requests. Wait a moment and try again."
      : "We couldn't create your account right now. Try again shortly.";

    redirect(signupUrl(nextPath, { error: message }));
  }

  if (data.session && data.user) {
    revalidatePath("/", "layout");
    redirect(nextPath);
  }

  redirect(signupUrl(nextPath, { sent: "1" }));
}
