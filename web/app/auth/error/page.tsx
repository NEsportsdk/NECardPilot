import Link from "next/link";

import styles from "@/components/auth/AuthCard.module.css";
import AuthShell from "@/components/auth/AuthShell";

export default function AuthErrorPage() {
  return (
    <AuthShell
      title="Linket kunne ikke bruges"
      description="Bekræftelseslinket er udløbet, allerede brugt eller ikke længere gyldigt."
      footer="Hvis problemet fortsætter, kan du anmode om et nyt link eller prøve at logge ind igen."
    >
      <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
        Din konto er ikke ændret. Start flowet igen for at få et nyt, sikkert
        link.
      </div>

      <nav className={styles.actionLinks} aria-label="Kontohjælp">
        <Link className={styles.link} href="/forgot-password">
          Nulstil adgangskode
        </Link>
        <Link className={styles.link} href="/signup">
          Opret konto igen
        </Link>
        <Link className={styles.link} href="/login">
          Gå til login
        </Link>
      </nav>
    </AuthShell>
  );
}
