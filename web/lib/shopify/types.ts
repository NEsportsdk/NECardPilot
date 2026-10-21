export type ShopifyMoney = {
  amount: string;
  currencyCode: string;
};

export type ShopifyImage = {
  altText: string | null;
  height: number | null;
  url: string;
  width: number | null;
};

export type ShopifyVariant = {
  availableForSale: boolean;
  id: string;
  price: ShopifyMoney;
  title: string;
};

export type ShopifyProduct = {
  availableForSale: boolean;
  description: string;
  featuredImage: ShopifyImage | null;
  handle: string;
  id: string;
  priceRange: {
    minVariantPrice: ShopifyMoney;
  };
  title: string;
  variants: {
    nodes: ShopifyVariant[];
  };
};

export type ShopifyCartLine = {
  cost: {
    totalAmount: ShopifyMoney;
  };
  id: string;
  merchandise: ShopifyVariant & {
    product: Pick<
      ShopifyProduct,
      "featuredImage" | "handle" | "id" | "title"
    >;
  };
  quantity: number;
};

export type ShopifyCart = {
  checkoutUrl: string;
  cost: {
    subtotalAmount: ShopifyMoney;
    totalAmount: ShopifyMoney;
  };
  id: string;
  lines: {
    nodes: ShopifyCartLine[];
  };
  totalQuantity: number;
};

export type ShopifyStore = {
  enabledPresentmentCurrencies: string[];
  name: string;
};

export type StorefrontSnapshot = {
  configured: boolean;
  products: ShopifyProduct[];
  store: ShopifyStore;
  unavailable: boolean;
};
