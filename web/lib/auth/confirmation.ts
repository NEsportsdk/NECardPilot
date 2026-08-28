import type { EmailOtpType } from "@supabase/supabase-js";

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "email",
  "email_change",
  "invite",
  "magiclink",
  "recovery",
  "signup",
]);

const MAX_AUTH_SECRET_LENGTH = 2048;

export function getEmailOtpType(value: unknown): EmailOtpType | null {
  return typeof value === "string" &&
    EMAIL_OTP_TYPES.has(value as EmailOtpType)
    ? (value as EmailOtpType)
    : null;
}

export function getAuthSecret(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const secret = value.trim();

  return secret && secret.length <= MAX_AUTH_SECRET_LENGTH ? secret : null;
}

export function getConfirmationFallbackPath(type: EmailOtpType | null) {
  return type === "recovery" ? "/change-password" : "/welcome";
}

export function getConfirmationCopy(type: EmailOtpType | null) {
  if (type === "recovery") {
    return {
      title: "Reset your password",
      description:
        "Continue securely to choose a new password for your Vallective account.",
      buttonLabel: "Continue to password reset",
      pendingLabel: "Verifying link…",
    };
  }

  return {
    title: "Confirm your account",
    description:
      "One final step keeps your Vallective account secure and confirms that this email belongs to you.",
    buttonLabel: "Confirm account",
    pendingLabel: "Confirming account…",
  };
}
