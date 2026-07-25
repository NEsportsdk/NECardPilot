export type CollectionType =
  | "pc"
  | "inventory";

export type MoveCardCollection = {
  id: string;

  name: string;

  type: CollectionType;
};

export type MoveCardInput = {
  cardId: string;

  targetCollectionId: string;
};

export type MoveCardResult = {
  success: true;

  cardId: string;

  playerName: string;

  fromCollection:
    MoveCardCollection;

  toCollection:
    MoveCardCollection;

  message: string;
};

type ErrorResponse = {
  error?: unknown;
};

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

function isCollectionType(
  value: unknown
): value is CollectionType {
  return (
    value === "pc" ||
    value === "inventory"
  );
}

function isMoveCardCollection(
  value: unknown
): value is MoveCardCollection {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id ===
      "string" &&
    value.id.length > 0 &&
    typeof value.name ===
      "string" &&
    value.name.length > 0 &&
    isCollectionType(
      value.type
    )
  );
}

function isMoveCardResult(
  value: unknown
): value is MoveCardResult {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.success === true &&
    typeof value.cardId ===
      "string" &&
    value.cardId.length > 0 &&
    typeof value.playerName ===
      "string" &&
    value.playerName.length > 0 &&
    isMoveCardCollection(
      value.fromCollection
    ) &&
    isMoveCardCollection(
      value.toCollection
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

export async function moveCard({
  cardId,
  targetCollectionId,
}: MoveCardInput): Promise<MoveCardResult> {
  const normalizedCardId =
    getRequiredText(
      cardId,
      "Kort-ID"
    );

  const normalizedTargetCollectionId =
    getRequiredText(
      targetCollectionId,
      "Den nye collection"
    );

  const response = await fetch(
    "/api/cards/move",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        cardId:
          normalizedCardId,

        targetCollectionId:
          normalizedTargetCollectionId,
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
        "Kortet kunne ikke flyttes. Prøv igen."
    );
  }

  if (
    !isMoveCardResult(
      responseBody
    )
  ) {
    throw new Error(
      "Serveren returnerede ikke en gyldig bekræftelse på flytningen."
    );
  }

  return responseBody;
}