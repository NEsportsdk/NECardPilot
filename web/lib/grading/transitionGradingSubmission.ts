export const GRADING_STATUSES = [
  "draft",
  "ready",
  "shipped",
  "received",
  "grading",
  "grades_ready",
  "returned",
  "completed",
  "cancelled",
] as const;

export type GradingStatus =
  (typeof GRADING_STATUSES)[number];

export type TransitionGradingSubmissionInput = {
  submissionId: string;

  targetStatus: GradingStatus;

  occurredAt?:
    | string
    | null;

  submissionNumber?:
    | string
    | null;

  outboundTrackingNumber?:
    | string
    | null;

  returnTrackingNumber?:
    | string
    | null;

  notes?:
    | string
    | null;

  signal?: AbortSignal;
};

export type TransitionGradingSubmissionResult = {
  success: true;

  submissionId: string;

  previousStatus: GradingStatus;

  newStatus: GradingStatus;

  cardCount: number;

  updatedCardCount: number;

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

function isGradingStatus(
  value: unknown
): value is GradingStatus {
  return (
    typeof value === "string" &&
    GRADING_STATUSES.includes(
      value as GradingStatus
    )
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
      "The status date is invalid."
    );
  }

  return date.toISOString();
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

function isTransitionGradingSubmissionResult(
  value: unknown
): value is TransitionGradingSubmissionResult {
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

    isGradingStatus(
      value.previousStatus
    ) &&

    isGradingStatus(
      value.newStatus
    ) &&

    isNonNegativeInteger(
      value.cardCount
    ) &&

    isNonNegativeInteger(
      value.updatedCardCount
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

export async function transitionGradingSubmission({
  submissionId,
  targetStatus,
  occurredAt,
  submissionNumber,
  outboundTrackingNumber,
  returnTrackingNumber,
  notes,
  signal,
}: TransitionGradingSubmissionInput): Promise<TransitionGradingSubmissionResult> {
  const normalizedSubmissionId =
    getRequiredUuid(
      submissionId,
      "Submission ID"
    );

  if (
    !isGradingStatus(
      targetStatus
    )
  ) {
    throw new Error(
      "The selected grading status is invalid."
    );
  }

  const response = await fetch(
    "/api/grading/transition",
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
        submissionId:
          normalizedSubmissionId,

        targetStatus,

        occurredAt:
          normalizeOptionalDateTime(
            occurredAt
          ),

        submissionNumber:
          normalizeOptionalText(
            submissionNumber,
            "Submission number",
            120
          ),

        outboundTrackingNumber:
          normalizeOptionalText(
            outboundTrackingNumber,
            "Outbound tracking number",
            180
          ),

        returnTrackingNumber:
          normalizeOptionalText(
            returnTrackingNumber,
            "Return tracking number",
            180
          ),

        notes:
          normalizeOptionalText(
            notes,
            "Notes",
            5000
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
        "The grading submission could not be updated. Try again."
    );
  }

  if (
    !isTransitionGradingSubmissionResult(
      responseBody
    )
  ) {
    throw new Error(
      "The server did not return a valid confirmation for the grading status change."
    );
  }

  return responseBody;
}