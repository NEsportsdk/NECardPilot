import type { ReactNode } from "react";

import VallectiveMark from "@/components/brand/VallectiveMark";

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
        <VallectiveMark className={styles.logo} />
        <p className={styles.eyebrow}>VALLECTIVE</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
        {children}
        {footer && <p className={styles.footer}>{footer}</p>}
      </section>
    </main>
  );
}
