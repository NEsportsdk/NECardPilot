import type { Metadata } from "next";
import Link from "next/link";

import ProductCard from "@/components/storefront/ProductCard";
import PublicFooter from "@/components/storefront/PublicFooter";
import PublicHeader from "@/components/storefront/PublicHeader";
import { getStorefrontSnapshot } from "@/lib/shopify/catalog";

import styles from "./home.module.css";

export const metadata: Metadata = {
  title: "Collect what matters",
  description:
    "Vallective brings scanning, collection intelligence and carefully selected trading cards into one modern collecting experience.",
};

export default async function PublicHomePage() {
  const storefront = await getStorefrontSnapshot(3);

  return (
    <div className={styles.page}>
      <PublicHeader />

      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>The intelligent home for card collectors</p>
            <h1>
              Collect what matters.
              <span> Know what it&apos;s worth.</span>
            </h1>
            <p className={styles.lead}>
              Scan faster, understand every card and build a collection that is
              as clear, personal and alive as the stories behind it.
            </p>
            <div className={styles.actions}>
              <Link className={styles.primaryAction} href="/signup">
                Start your collection
              </Link>
              <Link className={styles.secondaryAction} href="/shop">
                Explore the shop
              </Link>
            </div>
            <div className={styles.proofRow}>
              <span>Fast capture</span>
              <span>Collection intelligence</span>
              <span>Curated trading</span>
            </div>
          </div>

          <div aria-label="Vallective collection preview" className={styles.heroVisual}>
            <div className={`${styles.cardShape} ${styles.cardBack}`}>
              <span>Organize</span>
            </div>
            <div className={`${styles.cardShape} ${styles.cardMiddle}`}>
              <span>Understand</span>
            </div>
            <div className={`${styles.cardShape} ${styles.cardFront}`}>
              <div className={styles.cardMonogram}>V</div>
              <p>YOUR COLLECTION</p>
              <strong>IN FOCUS</strong>
              <small>Vallective / 01</small>
            </div>
            <div className={styles.valueChip}>
              <span>Collection signal</span>
              <strong>Clear</strong>
            </div>
          </div>
        </section>

        <section className={styles.story} id="story">
          <div>
            <p className={styles.eyebrow}>Why Vallective</p>
            <h2>A collection should feel exciting — not impossible to manage.</h2>
          </div>
          <p>
            Vallective is being built by collectors for the full journey: from
            the moment a card enters your hands to the moment you understand
            its place, value and next chapter. Technology handles the friction.
            You keep the instinct, memories and joy of collecting.
          </p>
        </section>

        <section className={styles.featureGrid}>
          <article>
            <span>01</span>
            <h3>Capture without the pause</h3>
            <p>Photograph a stack first. Let identification and review follow at your pace.</p>
          </article>
          <article>
            <span>02</span>
            <h3>See the whole collection</h3>
            <p>Keep cards, costs, estimates and history connected in one secure workspace.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Trade with confidence</h3>
            <p>Move selected cards into a curated sales flow without exposing private inventory.</p>
          </article>
        </section>

        <section className={styles.shopSection}>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>The Vallective shop</p>
              <h2>Cards chosen with intent.</h2>
            </div>
            <Link href="/shop">View the collection →</Link>
          </div>

          {storefront.products.length > 0 ? (
            <div className={styles.productGrid}>
              {storefront.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className={styles.emptyDrop}>
              <div>
                <span>First drop</span>
                <strong>In curation</strong>
              </div>
              <p>
                The first Vallective selection is being prepared. Every card
                will be checked, described and priced before it appears here.
              </p>
              <Link href="/shop">Enter the shop</Link>
            </div>
          )}
        </section>

        <section className={styles.finalCta}>
          <p className={styles.eyebrow}>Your cards. Your story.</p>
          <h2>Build the collection you can finally understand.</h2>
          <Link className={styles.primaryAction} href="/signup">
            Create your Vallective account
          </Link>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
