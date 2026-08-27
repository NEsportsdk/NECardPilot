import type { ReactNode } from "react";

import styles from "./AuthCard.module.css";

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

export default function AuthShell({
  title,
  description,
  children,
  footer,
}: AuthShellProps) {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.logo} aria-hidden="true">
          V
        </div>
        <p className={styles.eyebrow}>VALLECTIVE</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
        {children}
        {footer && <p className={styles.footer}>{footer}</p>}
      </section>
    </main>
  );
}
