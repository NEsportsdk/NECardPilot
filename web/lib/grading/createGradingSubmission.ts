export type CreateGradingSubmissionCardInput = {
  cardId: string;

  declaredValue?:
    | string
    | number
    | null;

  gradingFee?:
    | string
    | number
    | null;

  preparationFee?:
    | string
    | number
    | null;

  otherCardCosts?:
    | string
    | number
    | null;

  expectedGrade?:
    | string
    | null;

  expectedGradedValue?:
    | string
    | number
    | null;
};

export type CreateGradingSubmissionInput = {
  name: string;

  gradingCompany: string;

  serviceLevel?:
    | string
    | null;

  currency?: string;

  submissionNumber?:
    | string
    | null;

  estimatedTurnaroundDays?:
    | string
    | number
    | null;

  submissionFee?:
    | string
    | number
    | null;

  outboundShippingCost?:
    | string
    | number
    | null;

  returnShippingCost?:
    | string
    | number
    | null;

  insuranceCost?:
    | string
    | number
    | null;

  otherSharedCosts?:
    | string
    | number
    | null;

  notes?:
    | string
    | null;

  cards: CreateGradingSubmissionCardInput[];

  signal?: AbortSignal;
};

export type CreateGradingSubmissionResult = {
  success: true;

  submissionId: string;

  cardCount: number;

  sharedCostTotal: number;

  message: string;
};

type NormalizedGradingSubmissionCard = {
  cardId: string;

  declaredValue: number | null;

  gradingFee: number;

  preparationFee: number;

  otherCardCosts: number;

  expectedGrade: string | null;

  expectedGradedValue: number | null;
};

type ErrorResponse = {
  error?: unknown;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const normalizedValue =
    value.trim();

  if (!normalizedValue) {
    throw new Error(
      `${label} is required.`
    );
  }

  if (
    normalizedValue.length >
    maxLength
  ) {
    throw new Error(
      `${label} may contain at most ${maxLength} characters.`
    );
  }

  return normalizedValue;
}

function normalizeOptionalText(
  value:
    | string
    | null
    | undefined,
  label: string,
  maxLength: number
) {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const normalizedValue =
    value.trim();

  if (!normalizedValue) {
    return null;
  }

  if (
    normalizedValue.length >
    maxLength
  ) {
    throw new Error(
      `${label} may contain at most ${maxLength} characters.`
    );
  }

  return normalizedValue;
}

function normalizeNumberString(
  value: string
) {
  let normalizedValue = value
    .trim()
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");

  const lastComma =
    normalizedValue.lastIndexOf(
      ","
    );

  const lastDot =
    normalizedValue.lastIndexOf(
      "."
    );

  if (
    lastComma >= 0 &&
    lastDot >= 0
  ) {
    if (lastComma > lastDot) {
      normalizedValue =
        normalizedValue
          .replace(/\./g, "")
          .replace(/,/g, ".");
    } else {
      normalizedValue =
        normalizedValue.replace(
          /,/g,
          ""
        );
    }
  } else if (lastComma >= 0) {
    normalizedValue =
      normalizedValue.replace(
        /,/g,
        "."
      );
  } else if (lastDot >= 0) {
    const parts =
      normalizedValue.split(".");

    if (
      parts.length === 2 &&
      parts[1]?.length === 3
    ) {
      normalizedValue =
        parts.join("");
    }
  }

  return normalizedValue;
}

function normalizeMoney(
  value:
    | string
    | number
    | null
    | undefined,
  label: string,
  options: {
    nullable?: boolean;
  } = {}
) {
  const {
    nullable = false,
  } = options;

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return nullable ? null : 0;
  }

  const normalizedValue =
    typeof value === "string"
      ? normalizeNumberString(
          value
        )
      : value;

  if (normalizedValue === "") {
    return nullable ? null : 0;
  }

  const parsedValue =
    Number(normalizedValue);

  if (
    !Number.isFinite(
      parsedValue
    )
  ) {
    throw new Error(
      `${label} must be a valid number.`
    );
  }

  if (parsedValue < 0) {
    throw new Error(
      `${label} cannot be negative.`
    );
  }

  return Math.round(
    (
      parsedValue +
      Number.EPSILON
    ) * 100
  ) / 100;
}

function normalizePositiveInteger(
  value:
    | string
    | number
    | null
    | undefined,
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
      ? value.trim()
      : value;

  if (normalizedValue === "") {
    return null;
  }

  const parsedValue =
    Number(normalizedValue);

  if (
    !Number.isInteger(
      parsedValue
    ) ||
    parsedValue < 1
  ) {
    throw new Error(
      `${label} must be a positive whole number.`
    );
  }

  return parsedValue;
}

function normalizeCurrency(
  value:
    | string
    | undefined
) {
  const currency =
    value?.trim().toUpperCase() ||
    "DKK";

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error(
      "Currency must be a valid three-letter code."
    );
  }

  return currency;
}

function normalizeCard(
  card: CreateGradingSubmissionCardInput,
  index: number
): NormalizedGradingSubmissionCard {
  const cardId =
    card.cardId.trim();

  if (!UUID_PATTERN.test(cardId)) {
    throw new Error(
      `Card ${index + 1} has an invalid card ID.`
    );
  }

  return {
    cardId,

    declaredValue:
      normalizeMoney(
        card.declaredValue,
        `Declared value for card ${index + 1}`,
        {
          nullable: true,
        }
      ),

    gradingFee:
      normalizeMoney(
        card.gradingFee,
        `Grading fee for card ${index + 1}`
      ) ?? 0,

    preparationFee:
      normalizeMoney(
        card.preparationFee,
        `Preparation fee for card ${index + 1}`
      ) ?? 0,

    otherCardCosts:
      normalizeMoney(
        card.otherCardCosts,
        `Other costs for card ${index + 1}`
      ) ?? 0,

    expectedGrade:
      normalizeOptionalText(
        card.expectedGrade,
        `Expected grade for card ${index + 1}`,
        40
      ),

    expectedGradedValue:
      normalizeMoney(
        card.expectedGradedValue,
        `Expected graded value for card ${index + 1}`,
        {
          nullable: true,
        }
      ),
  };
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

function isCreateGradingSubmissionResult(
  value: unknown
): value is CreateGradingSubmissionResult {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.success === true &&
    typeof value.submissionId ===
      "string" &&
    UUID_PATTERN.test(
      value.submissionId
    ) &&
    typeof value.cardCount ===
      "number" &&
    Number.isInteger(
      value.cardCount
    ) &&
    value.cardCount > 0 &&
    typeof value.sharedCostTotal ===
      "number" &&
    Number.isFinite(
      value.sharedCostTotal
    ) &&
    value.sharedCostTotal >= 0 &&
    typeof value.message ===
      "string"
  );
}

export async function createGradingSubmission({
  name,
  gradingCompany,
  serviceLevel,
  currency,
  submissionNumber,
  estimatedTurnaroundDays,
  submissionFee,
  outboundShippingCost,
  returnShippingCost,
  insuranceCost,
  otherSharedCosts,
  notes,
  cards,
  signal,
}: CreateGradingSubmissionInput): Promise<CreateGradingSubmissionResult> {
  const normalizedName =
    getRequiredText(
      name,
      "Submission name",
      160
    );

  const normalizedGradingCompany =
    getRequiredText(
      gradingCompany,
      "Grading company",
      40
    ).toUpperCase();

  if (!Array.isArray(cards)) {
    throw new Error(
      "The card list has an invalid format."
    );
  }

  if (cards.length < 1) {
    throw new Error(
      "Select at least one card."
    );
  }

  if (cards.length > 200) {
    throw new Error(
      "A grading submission may contain at most 200 cards."
    );
  }

  const normalizedCards =
    cards.map(normalizeCard);

  const uniqueCardIds =
    new Set(
      normalizedCards.map(
        (card) => card.cardId
      )
    );

  if (
    uniqueCardIds.size !==
    normalizedCards.length
  ) {
    throw new Error(
      "The same card may only be added once to a submission."
    );
  }

  const response = await fetch(
    "/api/grading/create-submission",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        name:
          normalizedName,

        gradingCompany:
          normalizedGradingCompany,

        serviceLevel:
          normalizeOptionalText(
            serviceLevel,
            "Service level",
            120
          ),

        currency:
          normalizeCurrency(
            currency
          ),

        submissionNumber:
          normalizeOptionalText(
            submissionNumber,
            "Submission number",
            120
          ),

        estimatedTurnaroundDays:
          normalizePositiveInteger(
            estimatedTurnaroundDays,
            "Estimated turnaround"
          ),

        submissionFee:
          normalizeMoney(
            submissionFee,
            "Submission fee"
          ),

        outboundShippingCost:
          normalizeMoney(
            outboundShippingCost,
            "Outbound shipping cost"
          ),

        returnShippingCost:
          normalizeMoney(
            returnShippingCost,
            "Return shipping cost"
          ),

        insuranceCost:
          normalizeMoney(
            insuranceCost,
            "Insurance cost"
          ),

        otherSharedCosts:
          normalizeMoney(
            otherSharedCosts,
            "Other shared costs"
          ),

        notes:
          normalizeOptionalText(
            notes,
            "Notes",
            5000
          ),

        cards:
          normalizedCards,
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
        "The grading submission could not be created. Try again."
    );
  }

  if (
    !isCreateGradingSubmissionResult(
      responseBody
    )
  ) {
    throw new Error(
      "The server did not return a valid grading-submission confirmation."
    );
  }

  return responseBody;
}