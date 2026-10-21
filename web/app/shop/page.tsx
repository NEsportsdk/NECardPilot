import type { Metadata } from "next";
import Link from "next/link";

import ProductCard from "@/components/storefront/ProductCard";
import PublicFooter from "@/components/storefront/PublicFooter";
import PublicHeader from "@/components/storefront/PublicHeader";
import { getCart } from "@/lib/shopify/cart";
import { getStorefrontSnapshot } from "@/lib/shopify/catalog";

import styles from "./shop.module.css";

export const metadata: Metadata = {
  title: "Shop",
  description: "Shop carefully selected cards from Vallective.",
};

export default async function ShopPage() {
  const [storefront, cart] = await Promise.all([
    getStorefrontSnapshot(),
    getCart(),
  ]);
  const currencies = storefront.store.enabledPresentmentCurrencies.join(" · ");

  return (
    <div className={styles.page}>
      <PublicHeader cartCount={cart?.totalQuantity ?? 0} />
      <main className={styles.main}>
        <header className={styles.shopHero}>
          <p className={styles.eyebrow}>Vallective shop</p>
          <h1>Cards worth a closer look.</h1>
          <div className={styles.heroMeta}>
            <p>
              A considered selection of sports cards, checked and prepared by
              Vallective before they reach the shelf.
            </p>
            <span>Checkout currencies: {currencies || "DKK"}</span>
          </div>
        </header>

        {storefront.products.length > 0 ? (
          <section aria-label="Available cards" className={styles.productGrid}>
            {storefront.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </section>
        ) : (
          <section className={styles.emptyState}>
            <div className={styles.emptyMark}>V</div>
            <p className={styles.eyebrow}>
              {storefront.unavailable ? "Shop update" : "First drop"}
            </p>
            <h2>
              {storefront.unavailable
                ? "The collection is briefly out of view."
                : "The first selection is being curated."}
            </h2>
            <p>
              {storefront.unavailable
                ? "Please return shortly while we reconnect the catalogue."
                : "We are checking the cards, photography and pricing before the doors open. No placeholders — only real inventory when it is ready."}
            </p>
            <Link href="/signup">Build your own collection meanwhile</Link>
          </section>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
