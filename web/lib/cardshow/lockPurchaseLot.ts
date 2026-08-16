export type LockPurchaseLotInput = {
  lotId: string;

  overwriteExistingPurchasePrice?: boolean;

  signal?: AbortSignal;
};

export type LockPurchaseLotResult = {
  success: true;

  lotId: string;

  status: "locked";

  cardCount: number;

  totalCost: number;

  message: string;
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

function getRequiredUuid(value: string) {
  const normalizedValue = value.trim();

  if (!UUID_PATTERN.test(normalizedValue)) {
    throw new Error("Purchase-lot ID is invalid.");
  }

  return normalizedValue;
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

function isLockPurchaseLotResult(
  value: unknown
): value is LockPurchaseLotResult {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.success === true &&
    typeof value.lotId === "string" &&
    UUID_PATTERN.test(value.lotId) &&
    value.status === "locked" &&
    typeof value.cardCount === "number" &&
    Number.isInteger(value.cardCount) &&
    value.cardCount >= 0 &&
    typeof value.totalCost === "number" &&
    Number.isFinite(value.totalCost) &&
    value.totalCost >= 0 &&
    typeof value.message === "string"
  );
}

export async function lockPurchaseLot({
  lotId,
  overwriteExistingPurchasePrice = false,
  signal,
}: LockPurchaseLotInput): Promise<LockPurchaseLotResult> {
  const response = await fetch(
    "/api/cardshow/lock-purchase-lot",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      credentials: "same-origin",

      cache: "no-store",

      signal,

      body: JSON.stringify({
        lotId: getRequiredUuid(lotId),
        overwriteExistingPurchasePrice,
      }),
    }
  );

  const responseBody = await readResponseBody(response);

  if (!response.ok) {
    throw new Error(
      getServerErrorMessage(responseBody) ??
        "The purchase lot could not be locked. Try again."
    );
  }

  if (!isLockPurchaseLotResult(responseBody)) {
    throw new Error(
      "The server did not return a valid confirmation for the locked purchase lot."
    );
  }

  return responseBody;
}