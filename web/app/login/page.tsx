import Link from "next/link";

import styles from "@/components/auth/AuthCard.module.css";
import AuthShell from "@/components/auth/AuthShell";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import { getSafeNextPath } from "@/lib/auth/redirects";

import { login } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    success?: string | string[];
    next?: string | string[];
  }>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function withNext(pathname: string, nextPath: string) {
  if (nextPath === "/") {
    return pathname;
  }

  return `${pathname}?next=${encodeURIComponent(nextPath)}`;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const errorMessage = firstValue(params.error);
  const successMessage = firstValue(params.success);
  const nextPath = getSafeNextPath(firstValue(params.next));

  return (
    <AuthShell
      title="Sign in"
      description="Continue to your collection, scanner, transactions, and portfolio."
      footer="Supabase Auth and per-user access controls protect your account and cards."
    >
      {errorMessage && (
        <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div
          className={`${styles.notice} ${styles.noticeSuccess}`}
          role="status"
        >
          {successMessage}
        </div>
      )}

      <form action={login} className={styles.form}>
        <input type="hidden" name="next" value={nextPath} />

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
            autoComplete="current-password"
            required
          />
        </label>

        <AuthSubmitButton label="Sign in" pendingLabel="Signing in…" />
      </form>

      <nav className={styles.actionLinks} aria-label="Account support">
        <Link className={styles.link} href={withNext("/signup", nextPath)}>
          Create account
        </Link>
        <Link className={styles.link} href="/forgot-password">
          Forgot password?
        </Link>
      </nav>
    </AuthShell>
  );
}
