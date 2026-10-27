import Link from "next/link";

import VallectiveMark from "@/components/brand/VallectiveMark";

import styles from "./storefront.module.css";

export default function PublicHeader({ cartCount = 0 }: { cartCount?: number }) {
  return (
    <header className={styles.header}>
      <Link aria-label="Vallective home" className={styles.brand} href="/">
        <span className={styles.markShell}>
          <VallectiveMark className={styles.mark} />
        </span>
        <span>Vallective</span>
      </Link>

      <nav aria-label="Public navigation" className={styles.navigation}>
        <Link href="/#story">Our story</Link>
        <Link href="/pricing">Pricing</Link>
        <Link href="/shop">Shop</Link>
        <Link href="/login">Sign in</Link>
        <Link className={styles.cartLink} href="/shop/cart">
          Bag <span>{cartCount}</span>
        </Link>
      </nav>
    </header>
  );
}
