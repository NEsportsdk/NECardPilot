"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { validateEmail } from "@/lib/auth/forms";
import { getSafeNextPath } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";

function loginErrorMessage(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Incorrect email or password.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Confirm your email address before signing in.";
  }

  if (normalized.includes("too many requests")) {
    return "Too many sign-in attempts. Wait a moment and try again.";
  }

  return "We couldn't sign you in. Check your details and try again.";
}

function redirectToLoginWithError(message: string, nextPath: string): never {
  const params = new URLSearchParams({ error: message });

  if (nextPath !== "/") {
    params.set("next", nextPath);
  }

  redirect(`/login?${params.toString()}`);
}

export async function login(formData: FormData) {
  const nextPath = getSafeNextPath(formData.get("next"));
  const emailResult = validateEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");

  if (!emailResult.ok) {
    redirectToLoginWithError(emailResult.message, nextPath);
  }

  if (!password) {
    redirectToLoginWithError("Enter your password.", nextPath);
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailResult.data,
    password,
  });

  if (error) {
    redirectToLoginWithError(loginErrorMessage(error.message), nextPath);
  }

  if (!data.user || !data.session) {
    redirectToLoginWithError(
      "We couldn't sign you in. Try again.",
      nextPath
    );
  }

  revalidatePath("/", "layout");
  redirect(nextPath);
}
