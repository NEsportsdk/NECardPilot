import Image from "next/image";
import Link from "next/link";

import { formatShopifyMoney } from "@/lib/shopify/catalog";
import type { ShopifyProduct } from "@/lib/shopify/types";

import styles from "./storefront.module.css";

export default function ProductCard({ product }: { product: ShopifyProduct }) {
  const image = product.featuredImage;
  const price = product.priceRange.minVariantPrice;

  return (
    <article className={styles.productCard}>
      <Link className={styles.productImage} href={`/shop/products/${product.handle}`}>
        {image ? (
          <Image
            alt={image.altText || product.title}
            fill
            sizes="(max-width: 720px) 90vw, (max-width: 1100px) 45vw, 30vw"
            src={image.url}
          />
        ) : (
          <span aria-hidden="true">V</span>
        )}
        {!product.availableForSale ? (
          <small className={styles.soldBadge}>Collected</small>
        ) : null}
      </Link>
      <div className={styles.productMeta}>
        <div>
          <p>Curated single</p>
          <h3>
            <Link href={`/shop/products/${product.handle}`}>{product.title}</Link>
          </h3>
        </div>
        <strong>{formatShopifyMoney(price.amount, price.currencyCode)}</strong>
      </div>
    </article>
  );
}
