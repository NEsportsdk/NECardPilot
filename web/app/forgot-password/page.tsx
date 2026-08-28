import Link from "next/link";

import styles from "@/components/auth/AuthCard.module.css";
import AuthShell from "@/components/auth/AuthShell";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";

import { requestPasswordReset } from "./actions";

type ForgotPasswordPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    sent?: string | string[];
  }>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const params = await searchParams;
  const errorMessage = firstValue(params.error);
  const resetSent = firstValue(params.sent) === "1";

  return (
    <AuthShell
      title="Reset your password"
      description="Enter your email and we'll send a secure link to choose a new password."
      footer="For your security, we never reveal whether a specific email is registered."
    >
      {errorMessage && (
        <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
          {errorMessage}
        </div>
      )}

      {resetSent ? (
        <div
          className={`${styles.notice} ${styles.noticeSuccess}`}
          role="status"
        >
          If the email is linked to an account, the reset link has been sent.
          Check your spam folder too.
        </div>
      ) : (
        <form action={requestPasswordReset} className={styles.form}>
          <label className={styles.field} htmlFor="email">
            <span className={styles.fieldLabel}>Email</span>
            <input
              className={styles.input}
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              inputMode="email"
              required
            />
          </label>

          <AuthSubmitButton
            label="Send reset link"
            pendingLabel="Sending link…"
          />
        </form>
      )}

      <nav className={styles.actionLinks} aria-label="Account support">
        <Link className={styles.link} href="/login">
          Back to sign in
        </Link>
        {resetSent && (
          <Link className={styles.link} href="/forgot-password">
            Send again
          </Link>
        )}
      </nav>
    </AuthShell>
  );
}
