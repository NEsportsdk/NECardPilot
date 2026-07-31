export type MarketEstimateStatus =
  | "pending"
  | "completed"
  | "partial"
  | "failed";

export type MarketSubjectCondition =
  | "raw"
  | "graded"
  | "unknown";

export type MarketEvidenceType =
  | "sold"
  | "accepted_offer"
  | "asking"
  | "market_index"
  | "manual";

export type MarketPriceEstimate = {
  id: string;

  status: MarketEstimateStatus;

  canonicalTitle: string | null;

  subjectCondition:
    MarketSubjectCondition;

  gradingCompany: string | null;

  grade: string | null;

  currency: string;

  estimatedValue: number | null;

  lowValue: number | null;

  highValue: number | null;

  confidenceScore: number | null;

  comparableCount: number;

  includedComparableCount: number;

  sourceCount: number;

  searchQuery: string | null;

  methodologyVersion: string;

  valuationSummary: string | null;

  valuationNotes: string[];

  warnings: string[];

  sourceUrls: string[];

  modelName: string | null;

  responseId: string | null;

  inputTokens: number | null;

  outputTokens: number | null;

  webSearchCalls: number;

  errorMessage: string | null;

  dataAsOf: string | null;

  isCurrent: boolean;

  createdAt: string;

  updatedAt: string;
};

export type MarketPriceComparable = {
  id: string;

  sourceName: string;

  sourceDomain: string | null;

  sourceUrl: string;

  externalId: string | null;

  evidenceType:
    MarketEvidenceType;

  title: string;

  soldAt: string | null;

  price: number;

  shippingPrice: number;

  totalPrice: number;

  currency: string;

  exchangeRateToEstimate:
    number | null;

  normalizedTotal: number | null;

  conditionLabel: string | null;

  gradingCompany: string | null;

  grade: string | null;

  serialNumber: string | null;

  saleFormat: string | null;

  matchScore: number | null;

  included: boolean;

  exclusionReason: string | null;

  matchNotes: string[];

  metadata: Record<
    string,
    unknown
  >;

  createdAt: string;
};

export type GetMarketPriceInput = {
  cardId: string;

  /*
   * false:
   * Genbrug et estimat, hvis det er
   * mindre end 24 timer gammelt.
   *
   * true:
   * Kør en ny betalt markedsresearch.
   */
  force?: boolean;

  /*
   * Gør det muligt for en komponent
   * at afbryde requesten, hvis den
   * lukkes eller unmountes.
   */
  signal?: AbortSignal;
};

export type GetMarketPriceResult = {
  success: true;

  cached: boolean;

  activated: boolean;

  cardId: string;

  estimate: MarketPriceEstimate;

  comparables:
    MarketPriceComparable[];

  message: string;
};

type ErrorResponse = {
  error?: unknown;
};

function isRecord(
  value: unknown
): value is Record<
  string,
  unknown
> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isFiniteNumber(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
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

function isNullableString(
  value: unknown
): value is string | null {
  return (
    value === null ||
    typeof value === "string"
  );
}

function isNullableNumber(
  value: unknown
): value is number | null {
  return (
    value === null ||
    isFiniteNumber(value)
  );
}

function isNullableNonNegativeInteger(
  value: unknown
): value is number | null {
  return (
    value === null ||
    isNonNegativeInteger(value)
  );
}

function isStringArray(
  value: unknown
): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "string"
    )
  );
}

function isMarketEstimateStatus(
  value: unknown
): value is MarketEstimateStatus {
  return (
    value === "pending" ||
    value === "completed" ||
    value === "partial" ||
    value === "failed"
  );
}

function isMarketSubjectCondition(
  value: unknown
): value is MarketSubjectCondition {
  return (
    value === "raw" ||
    value === "graded" ||
    value === "unknown"
  );
}

function isMarketEvidenceType(
  value: unknown
): value is MarketEvidenceType {
  return (
    value === "sold" ||
    value === "accepted_offer" ||
    value === "asking" ||
    value === "market_index" ||
    value === "manual"
  );
}

function isCurrencyCode(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    /^[A-Z]{3}$/.test(value)
  );
}

function isMarketPriceEstimate(
  value: unknown
): value is MarketPriceEstimate {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&

    isMarketEstimateStatus(
      value.status
    ) &&

    isNullableString(
      value.canonicalTitle
    ) &&

    isMarketSubjectCondition(
      value.subjectCondition
    ) &&

    isNullableString(
      value.gradingCompany
    ) &&

    isNullableString(
      value.grade
    ) &&

    isCurrencyCode(
      value.currency
    ) &&

    isNullableNumber(
      value.estimatedValue
    ) &&

    isNullableNumber(
      value.lowValue
    ) &&

    isNullableNumber(
      value.highValue
    ) &&

    isNullableNumber(
      value.confidenceScore
    ) &&

    isNonNegativeInteger(
      value.comparableCount
    ) &&

    isNonNegativeInteger(
      value.includedComparableCount
    ) &&

    isNonNegativeInteger(
      value.sourceCount
    ) &&

    isNullableString(
      value.searchQuery
    ) &&

    typeof value.methodologyVersion ===
      "string" &&

    isNullableString(
      value.valuationSummary
    ) &&

    isStringArray(
      value.valuationNotes
    ) &&

    isStringArray(
      value.warnings
    ) &&

    isStringArray(
      value.sourceUrls
    ) &&

    isNullableString(
      value.modelName
    ) &&

    isNullableString(
      value.responseId
    ) &&

    isNullableNonNegativeInteger(
      value.inputTokens
    ) &&

    isNullableNonNegativeInteger(
      value.outputTokens
    ) &&

    isNonNegativeInteger(
      value.webSearchCalls
    ) &&

    isNullableString(
      value.errorMessage
    ) &&

    isNullableString(
      value.dataAsOf
    ) &&

    typeof value.isCurrent ===
      "boolean" &&

    typeof value.createdAt ===
      "string" &&

    typeof value.updatedAt ===
      "string"
  );
}

function isMarketPriceComparable(
  value: unknown
): value is MarketPriceComparable {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&

    typeof value.sourceName ===
      "string" &&
    value.sourceName.length > 0 &&

    isNullableString(
      value.sourceDomain
    ) &&

    typeof value.sourceUrl ===
      "string" &&
    value.sourceUrl.length > 0 &&

    isNullableString(
      value.externalId
    ) &&

    isMarketEvidenceType(
      value.evidenceType
    ) &&

    typeof value.title ===
      "string" &&
    value.title.length > 0 &&

    isNullableString(
      value.soldAt
    ) &&

    isFiniteNumber(
      value.price
    ) &&

    isFiniteNumber(
      value.shippingPrice
    ) &&

    isFiniteNumber(
      value.totalPrice
    ) &&

    isCurrencyCode(
      value.currency
    ) &&

    isNullableNumber(
      value.exchangeRateToEstimate
    ) &&

    isNullableNumber(
      value.normalizedTotal
    ) &&

    isNullableString(
      value.conditionLabel
    ) &&

    isNullableString(
      value.gradingCompany
    ) &&

    isNullableString(
      value.grade
    ) &&

    isNullableString(
      value.serialNumber
    ) &&

    isNullableString(
      value.saleFormat
    ) &&

    isNullableNumber(
      value.matchScore
    ) &&

    typeof value.included ===
      "boolean" &&

    isNullableString(
      value.exclusionReason
    ) &&

    isStringArray(
      value.matchNotes
    ) &&

    isRecord(
      value.metadata
    ) &&

    typeof value.createdAt ===
      "string"
  );
}

function isGetMarketPriceResult(
  value: unknown
): value is GetMarketPriceResult {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.success === true &&

    typeof value.cached ===
      "boolean" &&

    typeof value.activated ===
      "boolean" &&

    typeof value.cardId ===
      "string" &&
    value.cardId.length > 0 &&

    isMarketPriceEstimate(
      value.estimate
    ) &&

    Array.isArray(
      value.comparables
    ) &&

    value.comparables.every(
      isMarketPriceComparable
    ) &&

    typeof value.message ===
      "string"
  );
}

function getRequiredText(
  value: string,
  label: string
) {
  const normalizedValue =
    value.trim();

  if (!normalizedValue) {
    throw new Error(
      `${label} mangler.`
    );
  }

  return normalizedValue;
}

async function readResponseBody(
  response: Response
): Promise<unknown> {
  const responseText =
    await response.text();

  if (!responseText) {
    return {};
  }

  try {
    return JSON.parse(
      responseText
    ) as unknown;
  } catch {
    return {
      error: responseText,
    };
  }
}

function getServerErrorMessage(
  body: unknown
) {
  if (!isRecord(body)) {
    return null;
  }

  const errorBody =
    body as ErrorResponse;

  if (
    typeof errorBody.error ===
      "string" &&
    errorBody.error.trim()
  ) {
    return errorBody.error.trim();
  }

  return null;
}

export async function getMarketPrice({
  cardId,
  force = false,
  signal,
}: GetMarketPriceInput): Promise<GetMarketPriceResult> {
  const normalizedCardId =
    getRequiredText(
      cardId,
      "Kort-ID"
    );

  const response = await fetch(
    "/api/cards/market-price",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        cardId:
          normalizedCardId,

        force,
      }),

      signal,
    }
  );

  const responseBody =
    await readResponseBody(
      response
    );

  if (!response.ok) {
    throw new Error(
      getServerErrorMessage(
        responseBody
      ) ??
        "Markedsprisen kunne ikke beregnes. Prøv igen."
    );
  }

  if (
    !isGetMarketPriceResult(
      responseBody
    )
  ) {
    throw new Error(
      "Serveren returnerede ikke et gyldigt markedsprisresultat."
    );
  }

  return responseBody;
}