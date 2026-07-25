export type RecordSaleInput = {
  cardId: string;

  salePrice:
    | string
    | number;

  shippingIncome?:
    | string
    | number
    | null;

  platformFee?:
    | string
    | number
    | null;

  paymentFee?:
    | string
    | number
    | null;

  shippingCost?:
    | string
    | number
    | null;

  otherCosts?:
    | string
    | number
    | null;

  platform?:
    | string
    | null;

  buyer?:
    | string
    | null;

  reference?:
    | string
    | null;

  notes?:
    | string
    | null;

  soldAt?:
    | string
    | null;
};

export type RecordSaleResult = {
  success: true;

  transactionId: string;

  cardId: string;

  state: string;

  currency: string;

  grossAmount: number;

  netProceeds: number;

  costBasis: number;

  realizedProfit: number;

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

function normalizeOptionalText(
  value:
    | string
    | null
    | undefined
) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue =
    value.trim();

  return normalizedValue || null;
}

function normalizeNumberString(
  value: string
) {
  let normalizedValue = value
    .trim()
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");

  const lastComma =
    normalizedValue.lastIndexOf(",");

  const lastDot =
    normalizedValue.lastIndexOf(".");

  if (
    lastComma >= 0 &&
    lastDot >= 0
  ) {
    if (lastComma > lastDot) {
      /*
       * Dansk format:
       * 1.250,50 → 1250.50
       */
      normalizedValue =
        normalizedValue
          .replace(/\./g, "")
          .replace(/,/g, ".");
    } else {
      /*
       * Engelsk format:
       * 1,250.50 → 1250.50
       */
      normalizedValue =
        normalizedValue.replace(
          /,/g,
          ""
        );
    }
  } else if (lastComma >= 0) {
    /*
     * Dansk decimalkomma:
     * 250,50 → 250.50
     */
    normalizedValue =
      normalizedValue.replace(
        /,/g,
        "."
      );
  } else if (
    lastDot >= 0
  ) {
    const parts =
      normalizedValue.split(".");

    /*
     * Dansk tusindtalsseparator:
     * 1.250 → 1250
     * 12.500 → 12500
     */
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
  {
    required = false,
    mustBePositive = false,
  }: {
    required?: boolean;
    mustBePositive?: boolean;
  } = {}
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    if (required) {
      throw new Error(
        `${label} mangler.`
      );
    }

    return 0;
  }

  const normalizedValue =
    typeof value === "string"
      ? normalizeNumberString(
          value
        )
      : value;

  if (normalizedValue === "") {
    if (required) {
      throw new Error(
        `${label} mangler.`
      );
    }

    return 0;
  }

  const parsedValue =
    Number(normalizedValue);

  if (
    !Number.isFinite(
      parsedValue
    )
  ) {
    throw new Error(
      `${label} skal være et gyldigt tal.`
    );
  }

  if (
    mustBePositive &&
    parsedValue <= 0
  ) {
    throw new Error(
      `${label} skal være større end 0.`
    );
  }

  if (
    !mustBePositive &&
    parsedValue < 0
  ) {
    throw new Error(
      `${label} kan ikke være negativ.`
    );
  }

  return Math.round(
    (
      parsedValue +
      Number.EPSILON
    ) *
      100
  ) / 100;
}

function normalizeOptionalDateTime(
  value:
    | string
    | null
    | undefined
) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new Error(
      "Salgsdatoen er ugyldig."
    );
  }

  return date.toISOString();
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

function isFiniteNumber(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}

function isRecordSaleResult(
  value: unknown
): value is RecordSaleResult {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.success === true &&
    typeof value.transactionId ===
      "string" &&
    value.transactionId.length > 0 &&
    typeof value.cardId ===
      "string" &&
    value.cardId.length > 0 &&
    typeof value.state ===
      "string" &&
    typeof value.currency ===
      "string" &&
    value.currency.length === 3 &&
    isFiniteNumber(
      value.grossAmount
    ) &&
    isFiniteNumber(
      value.netProceeds
    ) &&
    isFiniteNumber(
      value.costBasis
    ) &&
    isFiniteNumber(
      value.realizedProfit
    ) &&
    typeof value.message ===
      "string"
  );
}

export async function recordSale({
  cardId,
  salePrice,
  shippingIncome,
  platformFee,
  paymentFee,
  shippingCost,
  otherCosts,
  platform,
  buyer,
  reference,
  notes,
  soldAt,
}: RecordSaleInput): Promise<RecordSaleResult> {
  const normalizedCardId =
    getRequiredText(
      cardId,
      "Kort-ID"
    );

  const response = await fetch(
    "/api/cards/record-sale",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        cardId:
          normalizedCardId,

        salePrice:
          normalizeMoney(
            salePrice,
            "Salgsprisen",
            {
              required: true,
              mustBePositive: true,
            }
          ),

        shippingIncome:
          normalizeMoney(
            shippingIncome,
            "Fragt betalt af køber"
          ),

        platformFee:
          normalizeMoney(
            platformFee,
            "Platformgebyret"
          ),

        paymentFee:
          normalizeMoney(
            paymentFee,
            "Betalingsgebyret"
          ),

        shippingCost:
          normalizeMoney(
            shippingCost,
            "Fragtudgiften"
          ),

        otherCosts:
          normalizeMoney(
            otherCosts,
            "Øvrige omkostninger"
          ),

        platform:
          normalizeOptionalText(
            platform
          ),

        buyer:
          normalizeOptionalText(
            buyer
          ),

        reference:
          normalizeOptionalText(
            reference
          ),

        notes:
          normalizeOptionalText(
            notes
          ),

        soldAt:
          normalizeOptionalDateTime(
            soldAt
          ),
      }),
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
        "Salget kunne ikke registreres. Prøv igen."
    );
  }

  if (
    !isRecordSaleResult(
      responseBody
    )
  ) {
    throw new Error(
      "Serveren returnerede ikke en gyldig bekræftelse på salget."
    );
  }

  return responseBody;
}