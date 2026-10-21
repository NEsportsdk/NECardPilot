import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import PublicFooter from "@/components/storefront/PublicFooter";
import PublicHeader from "@/components/storefront/PublicHeader";
import { getCart } from "@/lib/shopify/cart";
import { formatShopifyMoney } from "@/lib/shopify/catalog";

import { checkoutAction, removeCartLineAction } from "../actions";
import styles from "../shop.module.css";

export const metadata: Metadata = {
  title: "Your bag",
};

export default async function CartPage() {
  const cart = await getCart();
  const lines = cart?.lines.nodes ?? [];

  return (
    <div className={styles.page}>
      <PublicHeader cartCount={cart?.totalQuantity ?? 0} />
      <main className={styles.cartPage}>
        <header className={styles.cartHeader}>
          <div>
            <p className={styles.eyebrow}>Your selection</p>
            <h1>Bag</h1>
          </div>
          <Link href="/shop">Continue exploring</Link>
        </header>

        {lines.length > 0 && cart ? (
          <div className={styles.cartLayout}>
            <section className={styles.cartLines}>
              {lines.map((line) => {
                const product = line.merchandise.product;
                const image = product.featuredImage;

                return (
                  <article className={styles.cartLine} key={line.id}>
                    <Link className={styles.cartImage} href={`/shop/products/${product.handle}`}>
                      {image ? (
                        <Image
                          alt={image.altText || product.title}
                          fill
                          sizes="120px"
                          src={image.url}
                        />
                      ) : (
                        <span>V</span>
                      )}
                    </Link>
                    <div className={styles.cartLineCopy}>
                      <p>Curated single</p>
                      <h2>{product.title}</h2>
                      <small>Quantity {line.quantity}</small>
                    </div>
                    <strong>
                      {formatShopifyMoney(
                        line.cost.totalAmount.amount,
                        line.cost.totalAmount.currencyCode
                      )}
                    </strong>
                    <form action={removeCartLineAction}>
                      <input name="lineId" type="hidden" value={line.id} />
                      <button type="submit">Remove</button>
                    </form>
                  </article>
                );
              })}
            </section>

            <aside className={styles.cartSummary}>
              <p>Order summary</p>
              <div>
                <span>Subtotal</span>
                <strong>
                  {formatShopifyMoney(
                    cart.cost.subtotalAmount.amount,
                    cart.cost.subtotalAmount.currencyCode
                  )}
                </strong>
              </div>
              <small>Shipping and taxes are calculated securely at checkout.</small>
              <form action={checkoutAction}>
                <button className={styles.checkoutButton} type="submit">
                  Continue to secure checkout
                </button>
              </form>
              <p className={styles.shopifyNote}>Checkout powered by Shopify</p>
            </aside>
          </div>
        ) : (
          <section className={styles.emptyCart}>
            <h2>Your bag is waiting.</h2>
            <p>Explore the curated collection and save a card for its next chapter.</p>
            <Link href="/shop">Go to the shop</Link>
          </section>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
