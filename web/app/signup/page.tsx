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
      title="Opret din konto"
      description="Start din sikre kortsamling og få hele Vallective samlet ét sted."
      footer="Vi sender kun kontomails, som er nødvendige for login og sikkerhed."
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
            Tjek din indbakke. Hvis adressen kan bruges, har vi sendt et
            bekræftelseslink, som åbner din nye Vallective-konto.
          </div>
          <nav className={styles.actionLinks} aria-label="Kontohjælp">
            <Link className={styles.link} href={loginHref}>
              Tilbage til login
            </Link>
          </nav>
        </>
      ) : (
        <>
          <form action={signup} className={styles.form}>
            <input type="hidden" name="next" value={nextPath} />

            <label className={styles.field} htmlFor="displayName">
              <span className={styles.fieldLabel}>Navn</span>
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
              <span className={styles.fieldLabel}>E-mail</span>
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
              <span className={styles.fieldLabel}>Adgangskode</span>
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
                Mindst {MIN_PASSWORD_LENGTH} tegn med små og store bogstaver
                samt et tal.
              </span>
            </label>

            <label className={styles.field} htmlFor="confirmPassword">
              <span className={styles.fieldLabel}>Gentag adgangskode</span>
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
              label="Opret konto"
              pendingLabel="Opretter konto…"
            />
          </form>

          <nav className={styles.actionLinks} aria-label="Kontohjælp">
            <Link className={styles.link} href={loginHref}>
              Har du allerede en konto? Log ind
            </Link>
          </nav>
        </>
      )}
    </AuthShell>
  );
}
