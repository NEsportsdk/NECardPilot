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
      title="Nulstil adgangskode"
      description="Skriv din e-mail, så sender vi et sikkert link til at vælge en ny adgangskode."
      footer="Af sikkerhedshensyn fortæller vi ikke, om en bestemt e-mail findes i systemet."
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
          Hvis e-mailadressen er knyttet til en konto, er nulstillingslinket
          sendt. Tjek også spam-mappen.
        </div>
      ) : (
        <form action={requestPasswordReset} className={styles.form}>
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

          <AuthSubmitButton
            label="Send nulstillingslink"
            pendingLabel="Sender link…"
          />
        </form>
      )}

      <nav className={styles.actionLinks} aria-label="Kontohjælp">
        <Link className={styles.link} href="/login">
          Tilbage til login
        </Link>
        {resetSent && (
          <Link className={styles.link} href="/forgot-password">
            Send igen
          </Link>
        )}
      </nav>
    </AuthShell>
  );
}
