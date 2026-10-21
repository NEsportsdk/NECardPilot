import "server-only";

import { shopifyAdminFetch } from "@/lib/shopify/admin";
import {
  type CardAttribute,
  type CardDnaSource,
  buildCardDna,
  descriptionToHtml,
  escapeHtml,
} from "@/lib/storefront/cardDna";

type ShopifyUserError = {
  field?: string[] | null;
  message: string;
};

export type ShopifyListingInput = {
  attributes: CardAttribute[];
  card: CardDnaSource & { id: string };
  conditionLabel: string | null;
  currency: "DKK" | "EUR";
  description: string | null;
  imageUrls: Array<{ alt: string; url: string }>;
  priceAmount: number;
  shopifyProductId: string | null;
  shopifyVariantId: string | null;
  title: string;
};

export type ShopifyProductIdentity = {
  handle: string;
  productId: string;
  variantId: string;
};

const SALES_CONTEXT_QUERY = `#graphql
  query VallectiveShopifySalesContext {
    locations(first: 10) {
      nodes { id name }
    }
    publications(first: 20) {
      nodes {
        id
        supportsFuturePublishing
        catalog { title }
      }
    }
  }
`;

const PRODUCT_SET_MUTATION = `#graphql
  mutation VallectiveProductSet(
    $identifier: ProductSetIdentifiers
    $input: ProductSetInput!
  ) {
    productSet(identifier: $identifier, input: $input, synchronous: true) {
      product {
        id
        handle
        variants(first: 1) { nodes { id } }
      }
      userErrors { field message }
    }
  }
`;

const PUBLISH_PRODUCT_MUTATION = `#graphql
  mutation VallectivePublishProduct($productId: ID!, $publicationId: ID!) {
    publishablePublish(
      id: $productId
      input: [{ publicationId: $publicationId }]
    ) {
      publishable {
        publishedOnPublication(publicationId: $publicationId)
      }
      userErrors { field message }
    }
  }
`;

let salesContextCache:
  | { locationId: string; publicationId: string }
  | null = null;

function throwForUserErrors(operation: string, errors: ShopifyUserError[]) {
  if (!errors.length) return;

  throw new Error(
    `${operation}: ${errors.map((error) => error.message).join("; ")}`
  );
}

function deterministicHandle(cardId: string) {
  return `vallective-card-${cardId.toLowerCase()}`;
}

function buildDescriptionHtml(input: ShopifyListingInput) {
  const dna = buildCardDna(input.card, input.attributes);
  const customDescription = input.description?.trim();
  const paragraphs = customDescription && customDescription !== dna.description
    ? `<p>${descriptionToHtml(customDescription)}</p>`
    : "";
  const details = dna.description
    .split("\n")
    .filter((line) => line.startsWith("• "))
    .map((line) => `<li>${escapeHtml(line.slice(2))}</li>`)
    .join("");
  const condition = input.conditionLabel
    ? `<p><strong>Condition:</strong> ${escapeHtml(input.conditionLabel)}</p>`
    : "";

  return `${paragraphs}${condition}${details ? `<h3>Card details</h3><ul>${details}</ul>` : ""}<p><em>Stored, identified and listed through Vallective.</em></p>`;
}

async function getSalesContext() {
  if (salesContextCache) return salesContextCache;

  const data = await shopifyAdminFetch<{
    locations: { nodes: Array<{ id: string; name: string }> };
    publications: {
      nodes: Array<{
        catalog: { title: string } | null;
        id: string;
        supportsFuturePublishing: boolean;
      }>;
    };
  }>({ query: SALES_CONTEXT_QUERY });

  const location = data.locations.nodes[0];
  const publication =
    data.publications.nodes.find((candidate) => candidate.supportsFuturePublishing) ??
    data.publications.nodes.find((candidate) =>
      candidate.catalog?.title.toLowerCase().includes("online store")
    );

  if (!location) {
    throw new Error("Shopify has no active inventory location.");
  }

  if (!publication) {
    throw new Error("Shopify Online Store publication could not be found.");
  }

  salesContextCache = {
    locationId: location.id,
    publicationId: publication.id,
  };
  return salesContextCache;
}

export async function upsertShopifyProduct(
  input: ShopifyListingInput
): Promise<ShopifyProductIdentity> {
  if (input.currency !== "DKK") {
    throw new Error("Only DKK listings can be published before Markets is enabled.");
  }

  const salesContext = await getSalesContext();
  const dna = buildCardDna(input.card, input.attributes);
  const handle = deterministicHandle(input.card.id);
  const variant = {
    ...(input.shopifyVariantId ? { id: input.shopifyVariantId } : {}),
    inventoryItem: { requiresShipping: true, tracked: true },
    inventoryPolicy: "DENY",
    inventoryQuantities: [
      { locationId: salesContext.locationId, name: "available", quantity: 1 },
    ],
    optionValues: [{ name: "Default Title", optionName: "Title" }],
    price: input.priceAmount,
    sku: `VAL-${input.card.id.slice(0, 8).toUpperCase()}`,
    taxable: true,
  };
  const productInput = {
    descriptionHtml: buildDescriptionHtml(input),
    ...(input.imageUrls.length
      ? {
          files: input.imageUrls.map((image, index) => ({
            alt: image.alt,
            contentType: "IMAGE",
            duplicateResolutionMode: "REPLACE",
            filename: `vallective-${input.card.id}-${index + 1}.${
              new URL(image.url).pathname.match(/\.(jpe?g|png|webp|gif)$/i)?.[1] ??
              "jpg"
            }`,
            originalSource: image.url,
          })),
        }
      : {}),
    handle,
    productOptions: [
      { name: "Title", position: 1, values: [{ name: "Default Title" }] },
    ],
    productType: "Trading Card",
    seo: {
      description: `${input.card.player_name} trading card from Vallective.`.slice(0, 320),
      title: input.title.slice(0, 70),
    },
    status: "ACTIVE",
    tags: dna.tags,
    title: input.title,
    variants: [variant],
    vendor: "Vallective",
  };

  const data = await shopifyAdminFetch<{
    productSet: {
      product: {
        handle: string;
        id: string;
        variants: { nodes: Array<{ id: string }> };
      } | null;
      userErrors: ShopifyUserError[];
    };
  }>({
    query: PRODUCT_SET_MUTATION,
    variables: {
      identifier: input.shopifyProductId
        ? { id: input.shopifyProductId }
        : { handle },
      input: productInput,
    },
  });

  throwForUserErrors("Shopify could not save the product", data.productSet.userErrors);

  const product = data.productSet.product;
  const variantId = product?.variants.nodes[0]?.id;
  if (!product || !variantId) {
    throw new Error("Shopify saved the product without a usable variant.");
  }

  return {
    handle: product.handle,
    productId: product.id,
    variantId,
  };
}

export async function publishShopifyProduct(productId: string) {
  const { publicationId } = await getSalesContext();
  const data = await shopifyAdminFetch<{
    publishablePublish: {
      publishable: { publishedOnPublication: boolean } | null;
      userErrors: ShopifyUserError[];
    };
  }>({
    query: PUBLISH_PRODUCT_MUTATION,
    variables: { productId, publicationId },
  });

  throwForUserErrors(
    "Shopify could not publish the product",
    data.publishablePublish.userErrors
  );

  if (!data.publishablePublish.publishable?.publishedOnPublication) {
    throw new Error("Shopify did not confirm Online Store publication.");
  }
}

