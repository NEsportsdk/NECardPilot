export type CardshowPaymentMethod =
  | "cash"
  | "mobilepay"
  | "card"
  | "bank_transfer"
  | "paypal"
  | "other";

export type CardshowEventStatus =
  | "planning"
  | "active"
  | "closed"
  | "cancelled";

export type CreateCardshowEventInput = {
  name: string;

  venue?: string | null;

  city?: string | null;

  address?: string | null;

  startsAt?: string | null;

  endsAt?: string | null;

  currency?: string;

  paymentMethods?: CardshowPaymentMethod[];

  boothFee?: string | number | null;

  travelCost?: string | number | null;

  accommodationCost?: string | number | null;

  foodCost?: string | number | null;

  otherEventCosts?: string | number | null;

  notes?: string | null;

  signal?: AbortSignal;
};

export type CreateCardshowEventResult = {
  success: true;

  eventId: string;

  status: CardshowEventStatus;

  eventCostTotal: number;

  message: string;
};

type ErrorResponse = {
  error?: unknown;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PAYMENT_METHODS = new Set<CardshowPaymentMethod>([
  "cash",
  "mobilepay",
  "card",
  "bank_transfer",
  "paypal",
  "other",
]);

const EVENT_STATUSES = new Set<CardshowEventStatus>([
  "planning",
  "active",
  "closed",
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
  label: string
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const normalizedValue =
    typeof value === "string"
      ? normalizeNumberString(value)
      : value;

  if (normalizedValue === "") {
    return 0;
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

function normalizePaymentMethods(
  value: CardshowPaymentMethod[] | undefined
) {
  const methods = value ?? [
    "cash",
    "mobilepay",
    "card",
    "other",
  ];

  const normalizedMethods = Array.from(
    new Set(methods)
  );

  if (normalizedMethods.length === 0) {
    return [
      "cash",
      "mobilepay",
      "card",
      "other",
    ] satisfies CardshowPaymentMethod[];
  }

  if (
    normalizedMethods.some(
      (method) => !PAYMENT_METHODS.has(method)
    )
  ) {
    throw new Error(
      "One or more payment methods are invalid."
    );
  }

  return normalizedMethods;
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

function isCreateCardshowEventResult(
  value: unknown
): value is CreateCardshowEventResult {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.success === true &&
    typeof value.eventId === "string" &&
    UUID_PATTERN.test(value.eventId) &&
    typeof value.status === "string" &&
    EVENT_STATUSES.has(
      value.status as CardshowEventStatus
    ) &&
    typeof value.eventCostTotal === "number" &&
    Number.isFinite(value.eventCostTotal) &&
    value.eventCostTotal >= 0 &&
    typeof value.message === "string"
  );
}

export async function createCardshowEvent({
  name,
  venue,
  city,
  address,
  startsAt,
  endsAt,
  currency = "DKK",
  paymentMethods,
  boothFee,
  travelCost,
  accommodationCost,
  foodCost,
  otherEventCosts,
  notes,
  signal,
}: CreateCardshowEventInput): Promise<CreateCardshowEventResult> {
  const normalizedStartsAt = normalizeOptionalDateTime(
    startsAt,
    "Start time"
  );

  const normalizedEndsAt = normalizeOptionalDateTime(
    endsAt,
    "End time"
  );

  if (
    normalizedStartsAt &&
    normalizedEndsAt &&
    new Date(normalizedEndsAt).getTime() <
      new Date(normalizedStartsAt).getTime()
  ) {
    throw new Error(
      "End time cannot be earlier than start time."
    );
  }

  const response = await fetch(
    "/api/cardshow/create-event",
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
          "Event name",
          160
        ),

        venue: normalizeOptionalText(
          venue,
          "Venue",
          200
        ),

        city: normalizeOptionalText(
          city,
          "City",
          120
        ),

        address: normalizeOptionalText(
          address,
          "Address",
          300
        ),

        startsAt: normalizedStartsAt,

        endsAt: normalizedEndsAt,

        currency: normalizeCurrency(currency),

        paymentMethods:
          normalizePaymentMethods(paymentMethods),

        boothFee: normalizeMoney(
          boothFee,
          "Booth fee"
        ),

        travelCost: normalizeMoney(
          travelCost,
          "Travel cost"
        ),

        accommodationCost: normalizeMoney(
          accommodationCost,
          "Accommodation cost"
        ),

        foodCost: normalizeMoney(
          foodCost,
          "Food cost"
        ),

        otherEventCosts: normalizeMoney(
          otherEventCosts,
          "Other event costs"
        ),

        notes: normalizeOptionalText(
          notes,
          "Notes",
          5000
        ),
      }),
    }
  );

  const responseBody = await readResponseBody(response);

  if (!response.ok) {
    throw new Error(
      getServerErrorMessage(responseBody) ??
        "The cardshow event could not be created. Try again."
    );
  }

  if (!isCreateCardshowEventResult(responseBody)) {
    throw new Error(
      "The server did not return a valid confirmation for the cardshow event."
    );
  }

  return responseBody;
}