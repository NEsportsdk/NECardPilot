import "server-only";

const SHOPIFY_ADMIN_API_VERSION = "2026-10";
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

type ShopifyAdminConfiguration = {
  clientId: string;
  clientSecret: string;
  shopDomain: string;
};

type ShopifyAccessTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

type ShopifyGraphqlError = {
  message: string;
};

type ShopifyGraphqlResponse<T> = {
  data?: T;
  errors?: ShopifyGraphqlError[];
};

let tokenCache: { accessToken: string; expiresAt: number } | null = null;

export function normalizeShopifyShop(rawShop: string) {
  const shop = rawShop
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .replace(/\.myshopify\.com$/, "");

  if (!/^[a-z0-9][a-z0-9-]*$/.test(shop)) {
    throw new Error("Shopify shop configuration is invalid.");
  }

  return `${shop}.myshopify.com`;
}

export function isShopifyAdminConfigured() {
  return Boolean(
    process.env.SHOPIFY_SHOP?.trim() &&
      process.env.SHOPIFY_CLIENT_ID?.trim() &&
      process.env.SHOPIFY_CLIENT_SECRET?.trim()
  );
}

function getShopifyAdminConfiguration(): ShopifyAdminConfiguration {
  const rawShop = process.env.SHOPIFY_SHOP?.trim();
  const clientId = process.env.SHOPIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET?.trim();

  if (!rawShop || !clientId || !clientSecret) {
    throw new Error("Shopify Admin API is not configured.");
  }

  return {
    clientId,
    clientSecret,
    shopDomain: normalizeShopifyShop(rawShop),
  };
}

async function requestAccessToken(configuration: ShopifyAdminConfiguration) {
  const response = await fetch(
    `https://${configuration.shopDomain}/admin/oauth/access_token`,
    {
      body: new URLSearchParams({
        client_id: configuration.clientId,
        client_secret: configuration.clientSecret,
        grant_type: "client_credentials",
      }),
      cache: "no-store",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    }
  );

  if (!response.ok) {
    throw new Error(`Shopify authentication failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as ShopifyAccessTokenResponse;
  if (!payload.access_token || !payload.expires_in) {
    throw new Error("Shopify authentication returned an invalid response.");
  }

  tokenCache = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
  };

  return tokenCache.accessToken;
}

async function getAccessToken(configuration: ShopifyAdminConfiguration) {
  if (
    tokenCache &&
    tokenCache.expiresAt - TOKEN_EXPIRY_BUFFER_MS > Date.now()
  ) {
    return tokenCache.accessToken;
  }

  return requestAccessToken(configuration);
}

async function sendAdminRequest({
  accessToken,
  configuration,
  query,
  variables,
}: {
  accessToken: string;
  configuration: ShopifyAdminConfiguration;
  query: string;
  variables?: Record<string, unknown>;
}) {
  return fetch(
    `https://${configuration.shopDomain}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`,
    {
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      method: "POST",
    }
  );
}

export async function shopifyAdminFetch<T>({
  query,
  variables,
}: {
  query: string;
  variables?: Record<string, unknown>;
}) {
  const configuration = getShopifyAdminConfiguration();
  let accessToken = await getAccessToken(configuration);
  let response = await sendAdminRequest({
    accessToken,
    configuration,
    query,
    variables,
  });

  if (response.status === 401) {
    tokenCache = null;
    accessToken = await requestAccessToken(configuration);
    response = await sendAdminRequest({
      accessToken,
      configuration,
      query,
      variables,
    });
  }

  if (!response.ok) {
    throw new Error(`Shopify Admin request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as ShopifyGraphqlResponse<T>;
  if (payload.errors?.length || !payload.data) {
    throw new Error(
      payload.errors?.map((error) => error.message).join("; ") ||
        "Shopify Admin returned an empty response."
    );
  }

  return payload.data;
}

