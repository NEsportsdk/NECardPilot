import type {
  DuplicateCardCheckResult,
  DuplicateCardIdentity,
} from "@/lib/cards/duplicateCards";

type DuplicateCheckErrorBody = {
  error?: unknown;
};

export async function checkDuplicateCards(
  identity: DuplicateCardIdentity,
  signal?: AbortSignal
): Promise<DuplicateCardCheckResult> {
  const response = await fetch(
    "/api/cards/duplicate-check",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        card: identity,
      }),
      signal,
    }
  );

  const body = (await response.json()) as
    | DuplicateCardCheckResult
    | DuplicateCheckErrorBody;

  if (!response.ok) {
    const error =
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : "Dubletkontrollen kunne ikke gennemføres.";

    throw new Error(error);
  }

  if (
    !("matches" in body) ||
    !Array.isArray(body.matches) ||
    typeof body.requiresAcknowledgement !==
      "boolean"
  ) {
    throw new Error(
      "Dubletkontrollen returnerede et ugyldigt svar."
    );
  }

  return body;
}
