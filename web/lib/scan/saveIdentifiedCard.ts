import type {
  IdentifiedCard,
} from "@/lib/scan/identifyCard";

import type {
  UploadCardImagesResult,
} from "@/lib/scan/uploadCardImages";

export type SavedCardState =
  | "verified"
  | "needs_review";

export type SaveIdentifiedCardInput = {
  collectionId: string;

  uploadResult: UploadCardImagesResult;

  card: IdentifiedCard;

  purchasePrice?:
    | string
    | number
    | null;

  estimatedValue?:
    | string
    | number
    | null;

  purchaseSource?:
    | string
    | null;

  userNotes?:
    | string
    | null;

  editedFields?: string[];
};

export type SaveIdentifiedCardResult = {
  success: true;

  cardId: string;

  state: SavedCardState;

  message: string;
};

export type ReviewedCardSaveResult = SaveIdentifiedCardResult & {
  playerName: string;

  estimatedValue: number | null;
};

type ErrorResponse = {
  error?: unknown;
};

function getRequiredText(
  value: string,
  label: string
) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error(
      `${label} mangler.`
    );
  }

  return trimmedValue;
}

export function normalizeOptionalNumber(
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
      ? value
          .trim()
          .replace(",", ".")
      : value;

  if (normalizedValue === "") {
    return null;
  }

  const parsedValue =
    Number(normalizedValue);

  if (!Number.isFinite(parsedValue)) {
    throw new Error(
      `${label} skal være et gyldigt tal.`
    );
  }

  if (parsedValue < 0) {
    throw new Error(
      `${label} kan ikke være negativ.`
    );
  }

  return parsedValue;
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

  const trimmedValue = value.trim();

  return trimmedValue || null;
}

function normalizeEditedFields(
  values: string[] | undefined
) {
  if (!values) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function isSaveIdentifiedCardResult(
  value: unknown
): value is SaveIdentifiedCardResult {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const result =
    value as Record<string, unknown>;

  return (
    result.success === true &&
    typeof result.cardId === "string" &&
    result.cardId.length > 0 &&
    (
      result.state === "verified" ||
      result.state === "needs_review"
    ) &&
    typeof result.message === "string"
  );
}

async function readResponseBody(
  response: Response
): Promise<unknown> {
  const contentType =
    response.headers.get(
      "content-type"
    );

  if (
    contentType?.includes(
      "application/json"
    )
  ) {
    return response.json();
  }

  const text = await response.text();

  return text
    ? {
        error: text,
      }
    : {};
}

function getServerErrorMessage(
  body: unknown
) {
  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body)
  ) {
    return null;
  }

  const errorBody =
    body as ErrorResponse;

  if (
    typeof errorBody.error === "string" &&
    errorBody.error.trim()
  ) {
    return errorBody.error.trim();
  }

  return null;
}

export async function saveIdentifiedCard({
  collectionId,
  uploadResult,
  card,
  purchasePrice,
  estimatedValue,
  purchaseSource,
  userNotes,
  editedFields,
}: SaveIdentifiedCardInput): Promise<SaveIdentifiedCardResult> {
  const normalizedCollectionId =
    getRequiredText(
      collectionId,
      "Collection"
    );

  const scanId =
    getRequiredText(
      uploadResult.scanId,
      "Scan-ID"
    );

  const frontPath =
    getRequiredText(
      uploadResult.front.path,
      "Stien til forsiden"
    );

  const backPath =
    getRequiredText(
      uploadResult.back.path,
      "Stien til bagsiden"
    );

  if (!card.playerName?.trim()) {
    throw new Error(
      "Spillernavn mangler. Ret kortets oplysninger, før det gemmes."
    );
  }

  const response = await fetch(
    "/api/cards/save-scanned",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        collectionId:
          normalizedCollectionId,

        scanId,

        frontPath,

        backPath,

        card,

        purchasePrice:
          normalizeOptionalNumber(
            purchasePrice,
            "Købsprisen"
          ),

        estimatedValue:
          normalizeOptionalNumber(
            estimatedValue,
            "Den estimerede værdi"
          ),

        purchaseSource:
          normalizeOptionalText(
            purchaseSource
          ),

        userNotes:
          normalizeOptionalText(
            userNotes
          ),

        editedFields:
          normalizeEditedFields(
            editedFields
          ),
      }),
    }
  );

  const responseBody =
    await readResponseBody(response);

  if (!response.ok) {
    throw new Error(
      getServerErrorMessage(
        responseBody
      ) ??
        "Kortet kunne ikke gemmes. Prøv igen."
    );
  }

  if (
    !isSaveIdentifiedCardResult(
      responseBody
    )
  ) {
    throw new Error(
      "Serveren returnerede ikke en gyldig bekræftelse på, at kortet blev gemt."
    );
  }

  return responseBody;
}
