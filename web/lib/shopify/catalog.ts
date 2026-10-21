import "server-only";

import { isShopifyConfigured, shopifyFetch } from "@/lib/shopify/client";
import {
  PRODUCT_BY_HANDLE_QUERY,
  STOREFRONT_OVERVIEW_QUERY,
} from "@/lib/shopify/queries";
import type {
  ShopifyProduct,
  StorefrontSnapshot,
} from "@/lib/shopify/types";

const emptySnapshot: StorefrontSnapshot = {
  configured: false,
  products: [],
  store: {
    enabledPresentmentCurrencies: ["DKK"],
    name: "Vallective",
  },
  unavailable: false,
};

export function formatShopifyMoney(amount: string, currencyCode: string) {
  const numericAmount = Number(amount);

  return new Intl.NumberFormat(currencyCode === "DKK" ? "da-DK" : "en-IE", {
    currency: currencyCode,
    maximumFractionDigits: currencyCode === "DKK" ? 0 : 2,
    style: "currency",
  }).format(Number.isFinite(numericAmount) ? numericAmount : 0);
}

export async function getStorefrontSnapshot(
  first = 24
): Promise<StorefrontSnapshot> {
  if (!isShopifyConfigured()) {
    return emptySnapshot;
  }

  try {
    const data = await shopifyFetch<{
      products: { nodes: ShopifyProduct[] };
      shop: {
        name: string;
        paymentSettings: { enabledPresentmentCurrencies: string[] };
      };
    }>({
      query: STOREFRONT_OVERVIEW_QUERY,
      tags: ["shopify-products", "shopify-store"],
      variables: { first },
    });

    return {
      configured: true,
      products: data.products.nodes,
      store: {
        enabledPresentmentCurrencies:
          data.shop.paymentSettings.enabledPresentmentCurrencies,
        name: data.shop.name || "Vallective",
      },
      unavailable: false,
    };
  } catch {
    return {
      ...emptySnapshot,
      configured: true,
      unavailable: true,
    };
  }
}

export async function getProductByHandle(handle: string) {
  if (!isShopifyConfigured()) {
    return null;
  }

  const data = await shopifyFetch<{ product: ShopifyProduct | null }>({
    query: PRODUCT_BY_HANDLE_QUERY,
    tags: ["shopify-products", `shopify-product-${handle}`],
    variables: { handle },
  });

  return data.product;
}
