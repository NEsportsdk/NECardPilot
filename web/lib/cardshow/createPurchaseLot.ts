export type PurchaseLotAllocationMethod =
  | "proportional"
  | "equal"
  | "manual";

export type PurchaseLotStatus =
  | "draft"
  | "allocated"
  | "locked"
  | "cancelled";

export type PurchaseLotCardInput = {
  cardId: string;

  referenceValue?: string | number | null;

  manualAllocatedCost?: string | number | null;
};

export type CreatePurchaseLotInput = {
  name: string;

  allocationMethod?: PurchaseLotAllocationMethod;

  source?: string | null;

  seller?: string | null;

  purchaseReference?: string | null;

  purchasedAt?: string | null;

  currency?: string;

  purchaseAmount?: string | number | null;

  buyerFee?: string | number | null;

  shippingCost?: string | number | null;

  taxes?: string | number | null;

  otherCosts?: string | number | null;

  notes?: string | null;

  cards: PurchaseLotCardInput[];

  lock?: boolean;

  overwriteExistingPurchasePrice?: boolean;

  signal?: AbortSignal;
};

export type CreatePurchaseLotResult = {
  success: true;

  lotId: string;

  status: PurchaseLotStatus;

  cardCount: number;

  totalCost: number;

  allocatedTotal: number;

  message: string;
};

type ErrorResponse = {
  error?: unknown;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOCATION_METHODS =
  new Set<PurchaseLotAllocationMethod>([
    "proportional",
    "equal",
    "manual",
  ]);

const LOT_STATUSES = new Set<PurchaseLotStatus>([
  "draft",
  "allocated",
  "locked",
  "cancelled",
]);

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getRequiredText(
  value: string,
  label: string,
  maxLength: number
) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new Error(`${label} is required.`);
  }

  if (normalizedValue.length > maxLength) {
    throw new Error(
      `${label} may contain at most ${maxLength} characters.`
    );
  }

  return normalizedValue;
}

function normalizeOptionalText(
  value: string | null | undefined,
  label: string,
  maxLength: number
) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue.length > maxLength) {
    throw new Error(
      `${label} may contain at most ${maxLength} characters.`
    );
  }

  return normalizedValue;
}

function normalizeNumberString(value: string) {
  let normalizedValue = value
    .trim()
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");

  const lastComma = normalizedValue.lastIndexOf(",");
  const lastDot = normalizedValue.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    normalizedValue =
      lastComma > lastDot
        ? normalizedValue.replace(/\./g, "").replace(/,/g, ".")
        : normalizedValue.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalizedValue = normalizedValue.replace(/,/g, ".");
  } else if (lastDot >= 0) {
    const parts = normalizedValue.split(".");

    if (parts.length === 2 && parts[1]?.length === 3) {
      normalizedValue = parts.join("");
    }
  }

  return normalizedValue;
}

function normalizeMoney(
  value: string | number | null | undefined,
  label: string,
  {
    nullable = false,
  }: {
    nullable?: boolean;
  } = {}
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return nullable ? null : 0;
  }

  const normalizedValue =
    typeof value === "string"
      ? normalizeNumberString(value)
      : value;

  if (normalizedValue === "") {
    return nullable ? null : 0;
  }

  const parsedValue = Number(normalizedValue);

  if (!Number.isFinite(parsedValue)) {
    throw new Error(`${label} must be a valid number.`);
  }

  if (parsedValue < 0) {
    throw new Error(`${label} cannot be negative.`);
  }

  return (
    Math.round(
      (parsedValue + Number.EPSILON) * 100
    ) / 100
  );
}

function normalizeOptionalDateTime(
  value: string | null | undefined,
  label: string
) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} is invalid.`);
  }

  return date.toISOString();
}

function normalizeCurrency(value: string | undefined) {
  const currency = (value ?? "DKK").trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error(
      "Currency must be a valid three-letter code."
    );
  }

  return currency;
}

function normalizeCard(
  card: PurchaseLotCardInput,
  index: number
) {
  const cardId = card.cardId.trim();

  if (!UUID_PATTERN.test(cardId)) {
    throw new Error(
      `Card ${index + 1} has an invalid card ID.`
    );
  }

  return {
    cardId,
    referenceValue: normalizeMoney(
      card.referenceValue,
      `Reference value for card ${index + 1}`,
      {
        nullable: true,
      }
    ),
    manualAllocatedCost: normalizeMoney(
      card.manualAllocatedCost,
      `Manual allocated cost for card ${index + 1}`,
      {
        nullable: true,
      }
    ),
  };
}

async function readResponseBody(
  response: Response
): Promise<unknown> {
  const responseText = await response.text();

  if (!responseText) {
    return {};
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return {
      error: responseText,
    };
  }
}

function getServerErrorMessage(body: unknown) {
  if (!isRecord(body)) {
    return null;
  }

  const errorBody = body as ErrorResponse;

  if (
    typeof errorBody.error === "string" &&
    errorBody.error.trim()
  ) {
    return errorBody.error.trim();
  }

  return null;
}

function isCreatePurchaseLotResult(
  value: unknown
): value is CreatePurchaseLotResult {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.success === true &&
    typeof value.lotId === "string" &&
    UUID_PATTERN.test(value.lotId) &&
    typeof value.status === "string" &&
    LOT_STATUSES.has(value.status as PurchaseLotStatus) &&
    typeof value.cardCount === "number" &&
    Number.isInteger(value.cardCount) &&
    value.cardCount > 0 &&
    typeof value.totalCost === "number" &&
    Number.isFinite(value.totalCost) &&
    value.totalCost >= 0 &&
    typeof value.allocatedTotal === "number" &&
    Number.isFinite(value.allocatedTotal) &&
    value.allocatedTotal >= 0 &&
    Math.abs(
      value.totalCost - value.allocatedTotal
    ) < 0.005 &&
    typeof value.message === "string"
  );
}

export async function createPurchaseLot({
  name,
  allocationMethod = "proportional",
  source,
  seller,
  purchaseReference,
  purchasedAt,
  currency = "DKK",
  purchaseAmount,
  buyerFee,
  shippingCost,
  taxes,
  otherCosts,
  notes,
  cards,
  lock = true,
  overwriteExistingPurchasePrice = false,
  signal,
}: CreatePurchaseLotInput): Promise<CreatePurchaseLotResult> {
  if (!ALLOCATION_METHODS.has(allocationMethod)) {
    throw new Error(
      "The allocation method is invalid."
    );
  }

  if (!Array.isArray(cards)) {
    throw new Error(
      "The card list has an invalid format."
    );
  }

  if (cards.length < 1) {
    throw new Error(
      "Select at least one card for the purchase lot."
    );
  }

  if (cards.length > 5000) {
    throw new Error(
      "A purchase lot may contain at most 5,000 cards."
    );
  }

  const normalizedCards = cards.map(normalizeCard);

  const uniqueCardIds = new Set(
    normalizedCards.map((card) => card.cardId)
  );

  if (uniqueCardIds.size !== normalizedCards.length) {
    throw new Error(
      "The same card may only be added once to the purchase lot."
    );
  }

  if (
    allocationMethod === "manual" &&
    normalizedCards.some(
      (card) => card.manualAllocatedCost === null
    )
  ) {
    throw new Error(
      "Manual allocation requires a manual cost for every card."
    );
  }

  const response = await fetch(
    "/api/cardshow/create-purchase-lot",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      credentials: "same-origin",

      cache: "no-store",

      signal,

      body: JSON.stringify({
        name: getRequiredText(
          name,
          "Purchase-lot name",
          160
        ),
        allocationMethod,
        source: normalizeOptionalText(
          source,
          "Purchase source",
          160
        ),
        seller: normalizeOptionalText(
          seller,
          "Seller",
          200
        ),
        purchaseReference: normalizeOptionalText(
          purchaseReference,
          "Purchase reference",
          200
        ),
        purchasedAt: normalizeOptionalDateTime(
          purchasedAt,
          "Purchase date"
        ),
        currency: normalizeCurrency(currency),
        purchaseAmount: normalizeMoney(
          purchaseAmount,
          "Purchase amount"
        ),
        buyerFee: normalizeMoney(
          buyerFee,
          "Buyer fee"
        ),
        shippingCost: normalizeMoney(
          shippingCost,
          "Shipping cost"
        ),
        taxes: normalizeMoney(
          taxes,
          "Taxes"
        ),
        otherCosts: normalizeMoney(
          otherCosts,
          "Other costs"
        ),
        notes: normalizeOptionalText(
          notes,
          "Notes",
          5000
        ),
        cards: normalizedCards,
        lock,
        overwriteExistingPurchasePrice,
      }),
    }
  );

  const responseBody = await readResponseBody(response);

  if (!response.ok) {
    throw new Error(
      getServerErrorMessage(responseBody) ??
        "The purchase lot could not be created. Try again."
    );
  }

  if (!isCreatePurchaseLotResult(responseBody)) {
    throw new Error(
      "The server did not return a valid confirmation for the purchase lot."
    );
  }

  return responseBody;
}