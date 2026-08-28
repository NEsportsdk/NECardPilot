import Link from "next/link";

import styles from "@/components/auth/AuthCard.module.css";
import AuthShell from "@/components/auth/AuthShell";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/forms";
import { getSafeNextPath } from "@/lib/auth/redirects";

import { signup } from "./actions";

type SignupPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    sent?: string | string[];
    next?: string | string[];
  }>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const errorMessage = firstValue(params.error);
  const confirmationSent = firstValue(params.sent) === "1";
  const nextPath = getSafeNextPath(firstValue(params.next), "/welcome");
  const loginHref =
    nextPath === "/welcome"
      ? "/login"
      : `/login?next=${encodeURIComponent(nextPath)}`;

  return (
    <AuthShell
      title="Create your account"
      description="Build your secure card collection and keep every part of Vallective in one place."
      footer="We'll only send essential account and security emails."
    >
      {errorMessage && (
        <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
          {errorMessage}
        </div>
      )}

      {confirmationSent ? (
        <>
          <div
            className={`${styles.notice} ${styles.noticeSuccess}`}
            role="status"
          >
            Check your inbox. If this address can be used, we sent a secure
            confirmation link that opens your new Vallective account.
          </div>
          <nav className={styles.actionLinks} aria-label="Account support">
            <Link className={styles.link} href={loginHref}>
              Back to sign in
            </Link>
          </nav>
        </>
      ) : (
        <>
          <form action={signup} className={styles.form}>
            <input type="hidden" name="next" value={nextPath} />

            <label className={styles.field} htmlFor="displayName">
              <span className={styles.fieldLabel}>Name</span>
              <input
                className={styles.input}
                id="displayName"
                name="displayName"
                type="text"
                autoComplete="name"
                minLength={2}
                maxLength={80}
                required
              />
            </label>

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

            <label className={styles.field} htmlFor="password">
              <span className={styles.fieldLabel}>Password</span>
              <input
                className={styles.input}
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
              <span className={styles.hint}>
                At least {MIN_PASSWORD_LENGTH} characters with uppercase and
                lowercase letters plus a number.
              </span>
            </label>

            <label className={styles.field} htmlFor="confirmPassword">
              <span className={styles.fieldLabel}>Confirm password</span>
              <input
                className={styles.input}
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
            </label>

            <AuthSubmitButton
              label="Create account"
              pendingLabel="Creating account…"
            />
          </form>

          <nav className={styles.actionLinks} aria-label="Account support">
            <Link className={styles.link} href={loginHref}>
              Already have an account? Sign in
            </Link>
          </nav>
        </>
      )}
    </AuthShell>
  );
}
