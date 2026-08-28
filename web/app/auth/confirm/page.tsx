import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/auth/AuthCard.module.css";
import AuthShell from "@/components/auth/AuthShell";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import {
  getAuthSecret,
  getConfirmationCopy,
  getConfirmationFallbackPath,
  getEmailOtpType,
} from "@/lib/auth/confirmation";
import { getSafeNextPath } from "@/lib/auth/redirects";

import { confirmAuthLink } from "./actions";

export const metadata: Metadata = {
  title: "Confirm your Vallective account",
  robots: {
    index: false,
    follow: false,
  },
  referrer: "no-referrer",
};

type ConfirmationPageProps = {
  searchParams: Promise<{
    code?: string | string[];
    token_hash?: string | string[];
    type?: string | string[];
    next?: string | string[];
  }>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ConfirmationPage({
  searchParams,
}: ConfirmationPageProps) {
  const params = await searchParams;
  const code = getAuthSecret(firstValue(params.code));
  const tokenHash = getAuthSecret(firstValue(params.token_hash));
  const otpType = getEmailOtpType(firstValue(params.type));
  const nextPath = getSafeNextPath(
    firstValue(params.next),
    getConfirmationFallbackPath(otpType)
  );
  const hasValidPayload = Boolean(
    (code && !tokenHash) || (!code && tokenHash && otpType)
  );
  const copy = getConfirmationCopy(otpType);

  return (
    <AuthShell
      title={hasValidPayload ? copy.title : "This link is incomplete"}
      description={
        hasValidPayload
          ? copy.description
          : "Return to the latest Vallective email and open its secure confirmation link again."
      }
      footer={
        hasValidPayload
          ? "The secure one-time link is only used when you press the button."
          : "For your security, incomplete or altered links cannot be used."
      }
    >
      {hasValidPayload ? (
        <form action={confirmAuthLink} className={styles.form}>
          {code && <input type="hidden" name="code" value={code} />}
          {tokenHash && (
            <input type="hidden" name="token_hash" value={tokenHash} />
          )}
          {otpType && <input type="hidden" name="type" value={otpType} />}
          <input type="hidden" name="next" value={nextPath} />

          <div className={`${styles.notice} ${styles.noticeSuccess}`}>
            Your link is ready. Press the button below to continue securely.
          </div>

          <AuthSubmitButton
            label={copy.buttonLabel}
            pendingLabel={copy.pendingLabel}
          />
        </form>
      ) : (
        <nav className={styles.actionLinks} aria-label="Account support">
          <Link className={styles.link} href="/signup">
            Create account
          </Link>
          <Link className={styles.link} href="/forgot-password">
            Request a new link
          </Link>
          <Link className={styles.link} href="/login">
            Go to sign in
          </Link>
        </nav>
      )}
    </AuthShell>
  );
}
