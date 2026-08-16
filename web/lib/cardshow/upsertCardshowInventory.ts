export type CardshowInventoryStatus =
  | "available"
  | "reserved"
  | "withdrawn";

export type CardshowPriceSource =
  | "manual"
  | "market"
  | "suggested"
  | "price_group";

export type CardshowInventoryItemInput = {
  cardId: string;

  status?: CardshowInventoryStatus;

  askingPrice?: string | number | null;

  floorPrice?: string | number | null;

  priceSource?: CardshowPriceSource;

  priceGroupLabel?: string | null;

  priceGroupAmount?: string | number | null;

  locationLabel?: string | null;

  inventoryCode?: string | null;

  reservedFor?: string | null;

  reservationNote?: string | null;

  reservedUntil?: string | null;

  notes?: string | null;
};

export type UpsertCardshowInventoryInput = {
  eventId: string;

  items: CardshowInventoryItemInput[];

  signal?: AbortSignal;
};

export type UpsertCardshowInventoryResult = {
  success: true;

  eventId: string;

  addedCount: number;

  updatedCount: number;

  itemCount: number;

  message: string;
};

type ErrorResponse = {
  error?: unknown;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ITEM_STATUSES = new Set<CardshowInventoryStatus>([
  "available",
  "reserved",
  "withdrawn",
]);

const PRICE_SOURCES = new Set<CardshowPriceSource>([
  "manual",
  "market",
  "suggested",
  "price_group",
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

function getRequiredUuid(
  value: string,
  label: string
) {
  const normalizedValue = value.trim();

  if (!UUID_PATTERN.test(normalizedValue)) {
    throw new Error(`${label} is invalid.`);
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

function normalizeOptionalMoney(
  value: string | number | null | undefined,
  label: string
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const normalizedValue =
    typeof value === "string"
      ? normalizeNumberString(value)
      : value;

  if (normalizedValue === "") {
    return null;
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

function normalizeItem(
  item: CardshowInventoryItemInput,
  index: number
) {
  const cardId = getRequiredUuid(
    item.cardId,
    `Card ID ${index + 1}`
  );

  const status = item.status ?? "available";

  if (!ITEM_STATUSES.has(status)) {
    throw new Error(
      `Status for card ${index + 1} is invalid.`
    );
  }

  const priceSource = item.priceSource ?? "manual";

  if (!PRICE_SOURCES.has(priceSource)) {
    throw new Error(
      `Price source for card ${index + 1} is invalid.`
    );
  }

  const askingPrice = normalizeOptionalMoney(
    item.askingPrice,
    `Asking price for card ${index + 1}`
  );

  const floorPrice = normalizeOptionalMoney(
    item.floorPrice,
    `Floor price for card ${index + 1}`
  );

  const priceGroupAmount = normalizeOptionalMoney(
    item.priceGroupAmount,
    `Price-group amount for card ${index + 1}`
  );

  if (askingPrice !== null && askingPrice <= 0) {
    throw new Error(
      `Asking price for card ${index + 1} must be greater than 0.`
    );
  }

  if (
    priceGroupAmount !== null &&
    priceGroupAmount <= 0
  ) {
    throw new Error(
      `Price-group amount for card ${index + 1} must be greater than 0.`
    );
  }

  if (
    floorPrice !== null &&
    askingPrice !== null &&
    floorPrice > askingPrice
  ) {
    throw new Error(
      `Floor price cannot exceed asking price for card ${index + 1}.`
    );
  }

  const reservedFor = normalizeOptionalText(
    item.reservedFor,
    `Reservation name for card ${index + 1}`,
    160
  );

  if (status === "reserved" && !reservedFor) {
    throw new Error(
      `Enter who card ${index + 1} is reserved for.`
    );
  }

  return {
    cardId,
    status,
    askingPrice,
    floorPrice,
    priceSource,
    priceGroupLabel: normalizeOptionalText(
      item.priceGroupLabel,
      `Price-group label for card ${index + 1}`,
      120
    ),
    priceGroupAmount,
    locationLabel: normalizeOptionalText(
      item.locationLabel,
      `Location for card ${index + 1}`,
      160
    ),
    inventoryCode: normalizeOptionalText(
      item.inventoryCode,
      `Inventory code for card ${index + 1}`,
      120
    ),
    reservedFor,
    reservationNote: normalizeOptionalText(
      item.reservationNote,
      `Reservation note for card ${index + 1}`,
      1000
    ),
    reservedUntil: normalizeOptionalDateTime(
      item.reservedUntil,
      `Reservation expiry for card ${index + 1}`
    ),
    notes: normalizeOptionalText(
      item.notes,
      `Notes for card ${index + 1}`,
      3000
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

function isNonNegativeInteger(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0
  );
}

function isUpsertCardshowInventoryResult(
  value: unknown
): value is UpsertCardshowInventoryResult {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.success === true &&
    typeof value.eventId === "string" &&
    UUID_PATTERN.test(value.eventId) &&
    isNonNegativeInteger(value.addedCount) &&
    isNonNegativeInteger(value.updatedCount) &&
    isNonNegativeInteger(value.itemCount) &&
    value.addedCount + value.updatedCount ===
      value.itemCount &&
    typeof value.message === "string"
  );
}

export async function upsertCardshowInventory({
  eventId,
  items,
  signal,
}: UpsertCardshowInventoryInput): Promise<UpsertCardshowInventoryResult> {
  const normalizedEventId = getRequiredUuid(
    eventId,
    "Cardshow ID"
  );

  if (!Array.isArray(items)) {
    throw new Error(
      "The inventory list has an invalid format."
    );
  }

  if (items.length < 1) {
    throw new Error(
      "Select at least one card for the cardshow."
    );
  }

  if (items.length > 5000) {
    throw new Error(
      "A maximum of 5,000 cards can be processed at once."
    );
  }

  const normalizedItems = items.map(normalizeItem);

  const uniqueCardIds = new Set(
    normalizedItems.map((item) => item.cardId)
  );

  if (uniqueCardIds.size !== normalizedItems.length) {
    throw new Error(
      "The same card may only appear once in the batch."
    );
  }

  const response = await fetch(
    "/api/cardshow/upsert-inventory",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      credentials: "same-origin",

      cache: "no-store",

      signal,

      body: JSON.stringify({
        eventId: normalizedEventId,
        items: normalizedItems,
      }),
    }
  );

  const responseBody = await readResponseBody(response);

  if (!response.ok) {
    throw new Error(
      getServerErrorMessage(responseBody) ??
        "Cardshow inventory could not be updated. Try again."
    );
  }

  if (!isUpsertCardshowInventoryResult(responseBody)) {
    throw new Error(
      "The server did not return a valid confirmation for the inventory update."
    );
  }

  return responseBody;
}