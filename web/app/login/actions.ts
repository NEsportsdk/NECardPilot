"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function loginErrorMessage(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "E-mail eller adgangskode er forkert.";
  }

  if (normalized.includes("email not confirmed")) {
    return "E-mailadressen er endnu ikke bekræftet.";
  }

  if (normalized.includes("too many requests")) {
    return "Der har været for mange loginforsøg. Vent et øjeblik og prøv igen.";
  }

  return `Login mislykkedes: ${message}`;
}

function redirectToLoginWithError(message: string): never {
  redirect(`/login?error=${encodeURIComponent(message)}`);
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  const password = String(formData.get("password") ?? "");

  if (!email) {
    redirectToLoginWithError("Indtast din e-mailadresse.");
  }

  if (!password) {
    redirectToLoginWithError("Indtast din adgangskode.");
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirectToLoginWithError(loginErrorMessage(error.message));
  }

  if (!data.user || !data.session) {
    redirectToLoginWithError(
      "Supabase godkendte ikke en komplet login-session. Prøv igen."
    );
  }

  revalidatePath("/", "layout");
  redirect("/");
}