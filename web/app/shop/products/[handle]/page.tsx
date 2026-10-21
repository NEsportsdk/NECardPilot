import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import PublicFooter from "@/components/storefront/PublicFooter";
import PublicHeader from "@/components/storefront/PublicHeader";
import { getCart } from "@/lib/shopify/cart";
import {
  formatShopifyMoney,
  getProductByHandle,
} from "@/lib/shopify/catalog";

import { addToCartAction } from "../../actions";
import styles from "../../shop.module.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const product = await getProductByHandle(handle).catch(() => null);

  return product
    ? { description: product.description, title: product.title }
    : { title: "Card not found" };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const [product, cart] = await Promise.all([
    getProductByHandle(handle).catch(() => null),
    getCart(),
  ]);

  if (!product) {
    notFound();
  }

  const variant =
    product.variants.nodes.find((item) => item.availableForSale) ??
    product.variants.nodes[0];
  const image = product.featuredImage;
  const price = variant?.price ?? product.priceRange.minVariantPrice;

  return (
    <div className={styles.page}>
      <PublicHeader cartCount={cart?.totalQuantity ?? 0} />
      <main className={styles.productPage}>
        <Link className={styles.backLink} href="/shop">
          ← Back to the shop
        </Link>
        <div className={styles.productLayout}>
          <div className={styles.productHeroImage}>
            {image ? (
              <Image
                alt={image.altText || product.title}
                fill
                priority
                sizes="(max-width: 850px) 92vw, 50vw"
                src={image.url}
              />
            ) : (
              <span aria-hidden="true">V</span>
            )}
          </div>
          <section className={styles.productDetails}>
            <p className={styles.eyebrow}>Vallective curated single</p>
            <h1>{product.title}</h1>
            <strong className={styles.productPrice}>
              {formatShopifyMoney(price.amount, price.currencyCode)}
            </strong>
            <p className={styles.productDescription}>
              {product.description ||
                "A carefully selected card from the Vallective collection."}
            </p>
            <div className={styles.assuranceList}>
              <span>Checked by Vallective</span>
              <span>Secure Shopify checkout</span>
              <span>Single-card inventory</span>
            </div>
            {variant && product.availableForSale && variant.availableForSale ? (
              <form action={addToCartAction}>
                <input name="variantId" type="hidden" value={variant.id} />
                <button className={styles.addButton} type="submit">
                  Add to bag
                </button>
              </form>
            ) : (
              <p className={styles.unavailable}>This card has been collected.</p>
            )}
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
