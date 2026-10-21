import Link from "next/link";

import styles from "./storefront.module.css";

export default function PublicFooter() {
  return (
    <footer className={styles.footer}>
      <div>
        <strong>Vallective</strong>
        <p>Collect what matters. Know what it&apos;s worth.</p>
      </div>
      <div className={styles.footerLinks}>
        <Link href="/shop">Shop</Link>
        <Link href="/signup">Create account</Link>
        <a href="mailto:hello@vallective.com">hello@vallective.com</a>
      </div>
      <p className={styles.copyright}>© {new Date().getFullYear()} Vallective</p>
    </footer>
  );
}
