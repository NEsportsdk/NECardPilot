import "server-only";

import { cookies } from "next/headers";

import { shopifyFetch } from "@/lib/shopify/client";
import {
  CART_CREATE_MUTATION,
  CART_LINES_ADD_MUTATION,
  CART_LINES_REMOVE_MUTATION,
  CART_LINES_UPDATE_MUTATION,
  CART_QUERY,
} from "@/lib/shopify/queries";
import type { ShopifyCart } from "@/lib/shopify/types";

const CART_COOKIE = "vallective_shopify_cart";

type MutationPayload = {
  cart: { id: string } | null;
  userErrors: Array<{ field: string[] | null; message: string }>;
};

function assertMutationSucceeded(payload: MutationPayload) {
  if (payload.userErrors.length > 0 || !payload.cart) {
    throw new Error(
      payload.userErrors.map((error) => error.message).join("; ") ||
        "Shopify could not update the cart."
    );
  }

  return payload.cart.id;
}

export async function getCartId() {
  return (await cookies()).get(CART_COOKIE)?.value ?? null;
}

async function saveCartId(cartId: string) {
  (await cookies()).set(CART_COOKIE, cartId, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function getCart(): Promise<ShopifyCart | null> {
  const cartId = await getCartId();

  if (!cartId) {
    return null;
  }

  try {
    const data = await shopifyFetch<{ cart: ShopifyCart | null }>({
      cache: "no-store",
      query: CART_QUERY,
      variables: { id: cartId },
    });

    return data.cart;
  } catch {
    return null;
  }
}

export async function addVariantToCart(merchandiseId: string) {
  const cartId = await getCartId();

  if (cartId) {
    try {
      const data = await shopifyFetch<{ cartLinesAdd: MutationPayload }>({
        cache: "no-store",
        query: CART_LINES_ADD_MUTATION,
        variables: {
          cartId,
          lines: [{ merchandiseId, quantity: 1 }],
        },
      });

      assertMutationSucceeded(data.cartLinesAdd);
      return;
    } catch {
      // A stale or expired cart is replaced below.
    }
  }

  const data = await shopifyFetch<{ cartCreate: MutationPayload }>({
    cache: "no-store",
    query: CART_CREATE_MUTATION,
    variables: { lines: [{ merchandiseId, quantity: 1 }] },
  });
  const newCartId = assertMutationSucceeded(data.cartCreate);
  await saveCartId(newCartId);
}

export async function updateCartLine(lineId: string, quantity: number) {
  const cartId = await getCartId();

  if (!cartId) {
    return;
  }

  const data = await shopifyFetch<{ cartLinesUpdate: MutationPayload }>({
    cache: "no-store",
    query: CART_LINES_UPDATE_MUTATION,
    variables: { cartId, lines: [{ id: lineId, quantity }] },
  });
  assertMutationSucceeded(data.cartLinesUpdate);
}

export async function removeCartLine(lineId: string) {
  const cartId = await getCartId();

  if (!cartId) {
    return;
  }

  const data = await shopifyFetch<{ cartLinesRemove: MutationPayload }>({
    cache: "no-store",
    query: CART_LINES_REMOVE_MUTATION,
    variables: { cartId, lineIds: [lineId] },
  });
  assertMutationSucceeded(data.cartLinesRemove);
}
