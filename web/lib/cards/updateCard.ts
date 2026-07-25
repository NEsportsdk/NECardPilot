export type EditableCardData = {
  playerName: string;

  sport: string | null;

  team: string | null;

  manufacturer: string | null;

  brand: string | null;

  product: string | null;

  setName: string | null;

  year: string | null;

  cardNumber: string | null;

  parallel: string | null;

  serialNumber: string | null;

  serialNumberedTo: number | null;

  rookieCard: boolean | null;

  autograph: boolean | null;

  memorabilia: boolean | null;

  memorabiliaType: string | null;

  gradingCompany: string | null;

  grade: string | null;

  certificationNumber: string | null;

  language: string | null;

  variation: string | null;
};

export type UpdateCardInput = {
  cardId: string;

  card: EditableCardData;

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
};

export type UpdateCardResult = {
  success: true;

  cardId: string;

  state: string;

  needsManualReview: boolean;

  unresolvedFields: string[];

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

function normalizeOptionalNumber(
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

function normalizeOptionalPositiveInteger(
  value: number | null
) {
  if (value === null) {
    return null;
  }

  if (
    !Number.isInteger(value) ||
    value < 1
  ) {
    throw new Error(
      "Print run skal være et positivt heltal."
    );
  }

  return value;
}

function normalizeBoolean(
  value: boolean | null
) {
  return typeof value === "boolean"
    ? value
    : null;
}

function normalizeCard(
  card: EditableCardData
): EditableCardData {
  return {
    playerName:
      getRequiredText(
        card.playerName,
        "Spillernavn"
      ),

    sport:
      normalizeOptionalText(
        card.sport
      ),

    team:
      normalizeOptionalText(
        card.team
      ),

    manufacturer:
      normalizeOptionalText(
        card.manufacturer
      ),

    brand:
      normalizeOptionalText(
        card.brand
      ),

    product:
      normalizeOptionalText(
        card.product
      ),

    setName:
      normalizeOptionalText(
        card.setName
      ),

    year:
      normalizeOptionalText(
        card.year
      ),

    cardNumber:
      normalizeOptionalText(
        card.cardNumber
      ),

    parallel:
      normalizeOptionalText(
        card.parallel
      ),

    serialNumber:
      normalizeOptionalText(
        card.serialNumber
      ),

    serialNumberedTo:
      normalizeOptionalPositiveInteger(
        card.serialNumberedTo
      ),

    rookieCard:
      normalizeBoolean(
        card.rookieCard
      ),

    autograph:
      normalizeBoolean(
        card.autograph
      ),

    memorabilia:
      normalizeBoolean(
        card.memorabilia
      ),

    memorabiliaType:
      normalizeOptionalText(
        card.memorabiliaType
      ),

    gradingCompany:
      normalizeOptionalText(
        card.gradingCompany
      ),

    grade:
      normalizeOptionalText(
        card.grade
      ),

    certificationNumber:
      normalizeOptionalText(
        card.certificationNumber
      ),

    language:
      normalizeOptionalText(
        card.language
      ),

    variation:
      normalizeOptionalText(
        card.variation
      ),
  };
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

  const text =
    await response.text();

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
    typeof errorBody.error ===
      "string" &&
    errorBody.error.trim()
  ) {
    return errorBody.error.trim();
  }

  return null;
}

function isUpdateCardResult(
  value: unknown
): value is UpdateCardResult {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const result =
    value as Record<
      string,
      unknown
    >;

  return (
    result.success === true &&
    typeof result.cardId ===
      "string" &&
    result.cardId.length > 0 &&
    typeof result.state ===
      "string" &&
    typeof result.needsManualReview ===
      "boolean" &&
    Array.isArray(
      result.unresolvedFields
    ) &&
    result.unresolvedFields.every(
      (field) =>
        typeof field === "string"
    ) &&
    typeof result.message ===
      "string"
  );
}

export async function updateCard({
  cardId,
  card,
  purchasePrice,
  estimatedValue,
  purchaseSource,
  userNotes,
}: UpdateCardInput): Promise<UpdateCardResult> {
  const normalizedCardId =
    getRequiredText(
      cardId,
      "Kort-ID"
    );

  const normalizedCard =
    normalizeCard(card);

  const response = await fetch(
    "/api/cards/update",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        cardId:
          normalizedCardId,

        card:
          normalizedCard,

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
        "Kortet kunne ikke opdateres. Prøv igen."
    );
  }

  if (
    !isUpdateCardResult(
      responseBody
    )
  ) {
    throw new Error(
      "Serveren returnerede ikke en gyldig bekræftelse på opdateringen."
    );
  }

  return responseBody;
}