import type { ReactNode } from "react";

import PublicFooter from "@/components/storefront/PublicFooter";
import PublicHeader from "@/components/storefront/PublicHeader";

import styles from "./legal.module.css";

export default function PublicLegalPage({
  children,
  eyebrow,
  intro,
  title,
}: {
  children: ReactNode;
  eyebrow: string;
  intro: string;
  title: string;
}) {
  return (
    <div className={styles.page}>
      <PublicHeader />
      <main className={styles.main}>
        <header className={styles.hero}>
          <p>{eyebrow}</p>
          <h1>{title}</h1>
          <span>{intro}</span>
          <small>Effective 23 October 2026</small>
        </header>
        <article className={styles.document}>{children}</article>
      </main>
      <PublicFooter />
    </div>
  );
}
