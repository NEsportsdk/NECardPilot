export type GradingSubgradeValue =
  | string
  | number
  | null;

export type GradingSubgrades = Record<
  string,
  GradingSubgradeValue
>;

export type RecordGradingResultInput = {
  submissionCardId: string;

  resultGrade: string;

  certificationNumber?:
    | string
    | null;

  resultQualifier?:
    | string
    | null;

  resultSubgrades?:
    | GradingSubgrades
    | null;

  resultMarketValue?:
    | string
    | number
    | null;

  resultNotes?:
    | string
    | null;

  gradedAt?:
    | string
    | null;

  signal?: AbortSignal;
};

export type RecordGradingResultResult = {
  success: true;

  submissionId: string;

  submissionCardId: string;

  cardId: string;

  gradingCompany: string;

  resultGrade: string;

  certificationNumber:
    | string
    | null;

  resultMarketValue:
    | number
    | null;

  message: string;
};

type ErrorResponse = {
  error?: unknown;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function getRequiredUuid(
  value: string,
  label: string
) {
  const normalizedValue =
    value.trim();

  if (
    !UUID_PATTERN.test(
      normalizedValue
    )
  ) {
    throw new Error(
      `${label} has an invalid format.`
    );
  }

  return normalizedValue;
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
  if (typeof value !== "string") {
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

function normalizeOptionalMoney(
  value:
    | string
    | number
    | null
    | undefined,
  label: string
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const normalizedValue =
    typeof value === "string"
      ? normalizeNumberString(
          value
        )
      : value;

  if (normalizedValue === "") {
    return null;
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

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new Error(
      "The grading date is invalid."
    );
  }

  return date.toISOString();
}

function normalizeSubgrades(
  value:
    | GradingSubgrades
    | null
    | undefined
): GradingSubgrades {
  if (value === null || value === undefined) {
    return {};
  }

  if (!isRecord(value)) {
    throw new Error(
      "Subgrades must have a valid object format."
    );
  }

  const entries =
    Object.entries(value);

  if (entries.length > 20) {
    throw new Error(
      "At most 20 subgrades may be recorded."
    );
  }

  const normalized: GradingSubgrades = {};

  for (const [rawKey, rawValue] of entries) {
    const key = rawKey.trim();

    if (
      !key ||
      key.length > 80
    ) {
      throw new Error(
        "A subgrade name has an invalid format."
      );
    }

    if (rawValue === null) {
      normalized[key] = null;
      continue;
    }

    if (typeof rawValue === "number") {
      if (
        !Number.isFinite(
          rawValue
        )
      ) {
        throw new Error(
          `Subgrade ${key} must be a valid value.`
        );
      }

      normalized[key] = rawValue;
      continue;
    }

    if (typeof rawValue === "string") {
      const text = rawValue.trim();

      if (text.length > 80) {
        throw new Error(
          `Subgrade ${key} may contain at most 80 characters.`
        );
      }

      normalized[key] = text || null;
      continue;
    }

    throw new Error(
      `Subgrade ${key} must be text, a number or empty.`
    );
  }

  return normalized;
}

function isNullableString(
  value: unknown
): value is string | null {
  return (
    value === null ||
    typeof value === "string"
  );
}

function isNullableNonNegativeNumber(
  value: unknown
): value is number | null {
  return (
    value === null ||
    (
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0
    )
  );
}

function isRecordGradingResultResult(
  value: unknown
): value is RecordGradingResultResult {
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

    typeof value.submissionCardId ===
      "string" &&
    UUID_PATTERN.test(
      value.submissionCardId
    ) &&

    typeof value.cardId ===
      "string" &&
    UUID_PATTERN.test(
      value.cardId
    ) &&

    typeof value.gradingCompany ===
      "string" &&
    value.gradingCompany.length > 0 &&

    typeof value.resultGrade ===
      "string" &&
    value.resultGrade.length > 0 &&

    isNullableString(
      value.certificationNumber
    ) &&

    isNullableNonNegativeNumber(
      value.resultMarketValue
    ) &&

    typeof value.message ===
      "string"
  );
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

export async function recordGradingResult({
  submissionCardId,
  resultGrade,
  certificationNumber,
  resultQualifier,
  resultSubgrades,
  resultMarketValue,
  resultNotes,
  gradedAt,
  signal,
}: RecordGradingResultInput): Promise<RecordGradingResultResult> {
  const normalizedSubmissionCardId =
    getRequiredUuid(
      submissionCardId,
      "Submission card ID"
    );

  const normalizedResultGrade =
    getRequiredText(
      resultGrade,
      "Result grade",
      40
    );

  const response = await fetch(
    "/api/grading/record-result",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      credentials:
        "same-origin",

      cache: "no-store",

      signal,

      body: JSON.stringify({
        submissionCardId:
          normalizedSubmissionCardId,

        resultGrade:
          normalizedResultGrade,

        certificationNumber:
          normalizeOptionalText(
            certificationNumber,
            "Certification number",
            120
          ),

        resultQualifier:
          normalizeOptionalText(
            resultQualifier,
            "Result qualifier",
            120
          ),

        resultSubgrades:
          normalizeSubgrades(
            resultSubgrades
          ),

        resultMarketValue:
          normalizeOptionalMoney(
            resultMarketValue,
            "Result market value"
          ),

        resultNotes:
          normalizeOptionalText(
            resultNotes,
            "Result notes",
            5000
          ),

        gradedAt:
          normalizeOptionalDateTime(
            gradedAt
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
        "The grading result could not be recorded. Try again."
    );
  }

  if (
    !isRecordGradingResultResult(
      responseBody
    )
  ) {
    throw new Error(
      "The server did not return a valid confirmation for the grading result."
    );
  }

  return responseBody;
}