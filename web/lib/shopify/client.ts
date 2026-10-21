import "server-only";

const SHOPIFY_API_VERSION = "2025-01";

type ShopifyGraphqlError = {
  message: string;
};

type ShopifyGraphqlResponse<T> = {
  data?: T;
  errors?: ShopifyGraphqlError[];
};

export function isShopifyConfigured() {
  return Boolean(
    process.env.SHOPIFY_STORE_DOMAIN &&
      process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN
  );
}

function getShopifyConfiguration() {
  const rawDomain = process.env.SHOPIFY_STORE_DOMAIN?.trim();
  const accessToken = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN?.trim();

  if (!rawDomain || !accessToken) {
    throw new Error("Shopify storefront is not configured.");
  }

  const domain = rawDomain
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  return { accessToken, domain };
}

export async function shopifyFetch<T>({
  cache = "force-cache",
  query,
  revalidate = 300,
  tags = [],
  variables,
}: {
  cache?: RequestCache;
  query: string;
  revalidate?: number;
  tags?: string[];
  variables?: Record<string, unknown>;
}) {
  const { accessToken, domain } = getShopifyConfiguration();
  const response = await fetch(
    `https://${domain}/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      body: JSON.stringify({ query, variables }),
      cache,
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": accessToken,
      },
      method: "POST",
      next: cache === "no-store" ? undefined : { revalidate, tags },
    }
  );

  if (!response.ok) {
    throw new Error(`Shopify request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as ShopifyGraphqlResponse<T>;

  if (payload.errors?.length || !payload.data) {
    throw new Error(
      payload.errors?.map((error) => error.message).join("; ") ||
        "Shopify returned an empty response."
    );
  }

  return payload.data;
}
