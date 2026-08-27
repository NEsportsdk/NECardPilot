"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { validateEmail } from "@/lib/auth/forms";
import { getSafeNextPath } from "@/lib/auth/redirects";
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

  return "Login kunne ikke gennemføres. Kontrollér dine oplysninger og prøv igen.";
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
    redirectToLoginWithError("Indtast din adgangskode.", nextPath);
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
      "Login kunne ikke gennemføres. Prøv igen.",
      nextPath
    );
  }

  revalidatePath("/", "layout");
  redirect(nextPath);
}
