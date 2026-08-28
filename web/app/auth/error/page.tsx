import Link from "next/link";

import styles from "@/components/auth/AuthCard.module.css";
import AuthShell from "@/components/auth/AuthShell";

export default function AuthErrorPage() {
  return (
    <AuthShell
      title="We couldn't use that link"
      description="The confirmation link has expired, has already been used, or is no longer valid."
      footer="If the problem continues, request a new link or try signing in again."
    >
      <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
        Your account wasn&apos;t changed. Start the flow again to receive a
        new, secure link.
      </div>

      <nav className={styles.actionLinks} aria-label="Account support">
        <Link className={styles.link} href="/forgot-password">
          Request a new password
        </Link>
        <Link className={styles.link} href="/signup">
          Create account
        </Link>
        <Link className={styles.link} href="/login">
          Go to sign in
        </Link>
      </nav>
    </AuthShell>
  );
}
