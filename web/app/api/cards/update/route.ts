import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type AttributeSource =
  | "manual"
  | "ai"
  | "import"
  | "marketplace";

type AttributeRow = {
  user_id: string;
  card_id: string;
  attribute_key: string;
  attribute_value: unknown;
  source: AttributeSource;
  confidence_score: number | null;
  is_verified: boolean;
};

type ExistingAttributeRow = {
  attribute_key: string;
  attribute_value: unknown;
  source: string;
  confidence_score: number | null;
  is_verified: boolean;
};

type ExistingCardRow = {
  id: string;
  current_collection_id: string;
  player_name: string;
  year: string | null;
  manufacturer: string | null;
  set_name: string | null;
  card_number: string | null;
  parallel_name: string | null;
  serial_number: string | null;
  purchase_price: number | null;
  estimated_value: number | null;
  notes: string | null;
  state: string | null;
};

type UpdateCardRequest = {
  cardId?: unknown;
  card?: unknown;
  purchasePrice?: unknown;
  estimatedValue?: unknown;
  purchaseSource?: unknown;
  userNotes?: unknown;
};

const EDITABLE_ATTRIBUTE_KEYS = [
  "player_name",
  "sport",
  "team",
  "manufacturer",
  "brand",
  "product",
  "set_name",
  "year",
  "card_number",
  "parallel",
  "serial_number",
  "serial_numbered_to",
  "rookie_card",
  "autograph",
  "memorabilia",
  "memorabilia_type",
  "grading_company",
  "grade",
  "certification_number",
  "language",
  "variation",
  "purchase_source",
  "ai_needs_manual_review",
  "ai_uncertain_fields",
  "manual_reviewed_at",
] as const;

const PROTECTED_WORKFLOW_STATES = new Set([
  "submitted",
  "graded",
  "listed",
  "sold",
  "archived",
]);

class RequestError extends Error {
  status: number;

  constructor(
    message: string,
    status = 400
  ) {
    super(message);

    this.name = "RequestError";
    this.status = status;
  }
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getRequiredString(
  value: unknown,
  label: string
) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new RequestError(
      `${label} mangler.`
    );
  }

  return value.trim();
}

function getOptionalString(
  value: unknown
): string | null {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null;
  }

  return value.trim();
}

function getOptionalBoolean(
  value: unknown
): boolean | null {
  return typeof value === "boolean"
    ? value
    : null;
}

function getOptionalNumber(
  value: unknown,
  label: string
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value !== "number" &&
    typeof value !== "string"
  ) {
    throw new RequestError(
      `${label} skal være et tal.`
    );
  }

  const normalizedValue =
    typeof value === "string"
      ? value.trim().replace(",", ".")
      : value;

  if (normalizedValue === "") {
    return null;
  }

  const parsedValue =
    Number(normalizedValue);

  if (!Number.isFinite(parsedValue)) {
    throw new RequestError(
      `${label} skal være et gyldigt tal.`
    );
  }

  return parsedValue;
}

function getOptionalPositiveInteger(
  value: unknown,
  label: string
): number | null {
  const parsedValue =
    getOptionalNumber(
      value,
      label
    );

  if (parsedValue === null) {
    return null;
  }

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue < 1
  ) {
    throw new RequestError(
      `${label} skal være et positivt heltal.`
    );
  }

  return parsedValue;
}

function getSerialNumberedTo(
  serialNumber: string | null
) {
  if (!serialNumber) {
    return null;
  }

  const match =
    serialNumber.match(
      /\/\s*(\d+)\s*$/
    );

  if (!match) {
    return null;
  }

  const parsedValue =
    Number(match[1]);

  return Number.isInteger(
    parsedValue
  ) && parsedValue > 0
    ? parsedValue
    : null;
}

function hasAttributeValue(
  value: unknown
) {
  if (
    value === null ||
    value === undefined
  ) {
    return false;
  }

  if (
    typeof value === "string" &&
    !value.trim()
  ) {
    return false;
  }

  if (
    Array.isArray(value) &&
    value.length === 0
  ) {
    return false;
  }

  return true;
}

function uniqueStrings(
  values: string[]
) {
  return Array.from(
    new Set(
      values
        .map((value) =>
          value.trim()
        )
        .filter(Boolean)
    )
  );
}

function getErrorMessage(
  error: unknown
) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Der opstod en ukendt fejl.";
}

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as UpdateCardRequest;

    const cardId =
      getRequiredString(
        body.cardId,
        "Kort-ID"
      );

    if (!isRecord(body.card)) {
      throw new RequestError(
        "Kortets oplysninger mangler."
      );
    }

    const cardInput = body.card;

    const playerName =
      getRequiredString(
        cardInput.playerName,
        "Spillernavn"
      );

    const sport =
      getOptionalString(
        cardInput.sport
      );

    const team =
      getOptionalString(
        cardInput.team
      );

    const manufacturer =
      getOptionalString(
        cardInput.manufacturer
      );

    const brand =
      getOptionalString(
        cardInput.brand
      );

    const product =
      getOptionalString(
        cardInput.product
      );

    const setName =
      getOptionalString(
        cardInput.setName
      );

    const year =
      getOptionalString(
        cardInput.year
      );

    const cardNumber =
      getOptionalString(
        cardInput.cardNumber
      );

    const parallel =
      getOptionalString(
        cardInput.parallel
      );

    const serialNumber =
      getOptionalString(
        cardInput.serialNumber
      );

    const explicitSerialNumberedTo =
      getOptionalPositiveInteger(
        cardInput.serialNumberedTo,
        "Print run"
      );

    const serialNumberedTo =
      explicitSerialNumberedTo ??
      getSerialNumberedTo(
        serialNumber
      );

    const rookieCard =
      getOptionalBoolean(
        cardInput.rookieCard
      );

    const autograph =
      getOptionalBoolean(
        cardInput.autograph
      );

    const memorabilia =
      getOptionalBoolean(
        cardInput.memorabilia
      );

    const memorabiliaType =
      getOptionalString(
        cardInput.memorabiliaType
      );

    const gradingCompany =
      getOptionalString(
        cardInput.gradingCompany
      );

    const grade =
      getOptionalString(
        cardInput.grade
      );

    const certificationNumber =
      getOptionalString(
        cardInput.certificationNumber
      );

    const language =
      getOptionalString(
        cardInput.language
      );

    const variation =
      getOptionalString(
        cardInput.variation
      );

    const purchasePrice =
      getOptionalNumber(
        body.purchasePrice,
        "Købsprisen"
      );

    const estimatedValue =
      getOptionalNumber(
        body.estimatedValue,
        "Den estimerede værdi"
      );

    const purchaseSource =
      getOptionalString(
        body.purchaseSource
      );

    const userNotes =
      getOptionalString(
        body.userNotes
      );

    if (
      purchasePrice !== null &&
      purchasePrice < 0
    ) {
      throw new RequestError(
        "Købsprisen kan ikke være negativ."
      );
    }

    if (
      estimatedValue !== null &&
      estimatedValue < 0
    ) {
      throw new RequestError(
        "Den estimerede værdi kan ikke være negativ."
      );
    }

    const missingCoreFields: string[] = [];

    if (!playerName) {
      missingCoreFields.push(
        "playerName"
      );
    }

    if (!year) {
      missingCoreFields.push(
        "year"
      );
    }

    if (
      !manufacturer &&
      !brand
    ) {
      missingCoreFields.push(
        "manufacturer"
      );
    }

    if (
      !product &&
      !setName
    ) {
      missingCoreFields.push(
        "product"
      );
    }

    if (!cardNumber) {
      missingCoreFields.push(
        "cardNumber"
      );
    }

    if (
      serialNumberedTo &&
      !parallel
    ) {
      missingCoreFields.push(
        "parallel"
      );
    }

    const unresolvedFields =
      uniqueStrings(
        missingCoreFields
      );

    const needsManualReview =
      unresolvedFields.length > 0;

    const supabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      throw new RequestError(
        "Du skal være logget ind for at redigere kortet.",
        401
      );
    }

    const userId = user.id;

    const {
      data: originalCardData,
      error: originalCardError,
    } = await supabase
      .from("cards")
      .select(`
        id,
        current_collection_id,
        player_name,
        year,
        manufacturer,
        set_name,
        card_number,
        parallel_name,
        serial_number,
        purchase_price,
        estimated_value,
        notes,
        state
      `)
      .eq("id", cardId)
      .eq("user_id", userId)
      .maybeSingle();

    if (
      originalCardError ||
      !originalCardData
    ) {
      throw new RequestError(
        "Kortet blev ikke fundet, eller du har ikke adgang til det.",
        404
      );
    }

    const originalCard =
      originalCardData as ExistingCardRow;

    const {
      data: originalAttributeData,
      error: originalAttributeError,
    } = await supabase
      .from("card_attributes")
      .select(`
        attribute_key,
        attribute_value,
        source,
        confidence_score,
        is_verified
      `)
      .eq("card_id", cardId)
      .eq("user_id", userId)
      .in(
        "attribute_key",
        Array.from(
          EDITABLE_ATTRIBUTE_KEYS
        )
      );

    if (originalAttributeError) {
      throw new RequestError(
        `Card DNA kunne ikke indlæses: ${originalAttributeError.message}`,
        500
      );
    }

    const originalAttributes =
      (originalAttributeData ??
        []) as ExistingAttributeRow[];

    const nextState =
      originalCard.state &&
      PROTECTED_WORKFLOW_STATES.has(
        originalCard.state
      )
        ? originalCard.state
        : needsManualReview
          ? "needs_review"
          : "verified";

    const restoreOriginalState =
      async () => {
        const {
          error: restoreCardError,
        } = await supabase
          .from("cards")
          .update({
            player_name:
              originalCard.player_name,

            year:
              originalCard.year,

            manufacturer:
              originalCard.manufacturer,

            set_name:
              originalCard.set_name,

            card_number:
              originalCard.card_number,

            parallel_name:
              originalCard.parallel_name,

            serial_number:
              originalCard.serial_number,

            purchase_price:
              originalCard.purchase_price,

            estimated_value:
              originalCard.estimated_value,

            notes:
              originalCard.notes,

            state:
              originalCard.state,
          })
          .eq("id", cardId)
          .eq("user_id", userId);

        if (restoreCardError) {
          console.error(
            "Kortets oprindelige data kunne ikke gendannes:",
            restoreCardError
          );
        }

        const {
          error: clearAttributeError,
        } = await supabase
          .from("card_attributes")
          .delete()
          .eq("card_id", cardId)
          .eq("user_id", userId)
          .in(
            "attribute_key",
            Array.from(
              EDITABLE_ATTRIBUTE_KEYS
            )
          );

        if (clearAttributeError) {
          console.error(
            "De nye Card DNA-felter kunne ikke ryddes:",
            clearAttributeError
          );

          return;
        }

        if (
          originalAttributes.length ===
          0
        ) {
          return;
        }

        const {
          error: restoreAttributeError,
        } = await supabase
          .from("card_attributes")
          .insert(
            originalAttributes.map(
              (attribute) => ({
                user_id: userId,

                card_id: cardId,

                attribute_key:
                  attribute.attribute_key,

                attribute_value:
                  attribute.attribute_value,

                source:
                  attribute.source,

                confidence_score:
                  attribute.confidence_score,

                is_verified:
                  attribute.is_verified,
              })
            )
          );

        if (restoreAttributeError) {
          console.error(
            "Det oprindelige Card DNA kunne ikke gendannes:",
            restoreAttributeError
          );
        }
      };

    const {
      error: cardUpdateError,
    } = await supabase
      .from("cards")
      .update({
        player_name:
          playerName,

        year,

        manufacturer:
          manufacturer ?? brand,

        set_name:
          setName ?? product,

        card_number:
          cardNumber,

        parallel_name:
          parallel,

        serial_number:
          serialNumber,

        purchase_price:
          purchasePrice,

        estimated_value:
          estimatedValue,

        notes:
          userNotes,

        state:
          nextState,
      })
      .eq("id", cardId)
      .eq("user_id", userId);

    if (cardUpdateError) {
      throw new RequestError(
        `Kortet kunne ikke opdateres: ${cardUpdateError.message}`,
        500
      );
    }

    const attributes: AttributeRow[] = [];

    function addAttribute(
      key: string,
      value: unknown
    ) {
      if (
        !hasAttributeValue(
          value
        )
      ) {
        return;
      }

      attributes.push({
        user_id:
          userId,

        card_id:
          cardId,

        attribute_key:
          key,

        attribute_value:
          value,

        source:
          "manual",

        confidence_score:
          null,

        is_verified:
          true,
      });
    }

    addAttribute(
      "player_name",
      playerName
    );

    addAttribute(
      "sport",
      sport
    );

    addAttribute(
      "team",
      team
    );

    addAttribute(
      "manufacturer",
      manufacturer
    );

    addAttribute(
      "brand",
      brand
    );

    addAttribute(
      "product",
      product
    );

    addAttribute(
      "set_name",
      setName
    );

    addAttribute(
      "year",
      year
    );

    addAttribute(
      "card_number",
      cardNumber
    );

    addAttribute(
      "parallel",
      parallel
    );

    addAttribute(
      "serial_number",
      serialNumber
    );

    addAttribute(
      "serial_numbered_to",
      serialNumberedTo
    );

    addAttribute(
      "rookie_card",
      rookieCard
    );

    addAttribute(
      "autograph",
      autograph
    );

    addAttribute(
      "memorabilia",
      memorabilia
    );

    addAttribute(
      "memorabilia_type",
      memorabiliaType
    );

    addAttribute(
      "grading_company",
      gradingCompany
    );

    addAttribute(
      "grade",
      grade
    );

    addAttribute(
      "certification_number",
      certificationNumber
    );

    addAttribute(
      "language",
      language
    );

    addAttribute(
      "variation",
      variation
    );

    addAttribute(
      "purchase_source",
      purchaseSource
    );

    addAttribute(
      "ai_needs_manual_review",
      needsManualReview
    );

    addAttribute(
      "ai_uncertain_fields",
      unresolvedFields
    );

    addAttribute(
      "manual_reviewed_at",
      new Date().toISOString()
    );

    const {
      error: deleteAttributeError,
    } = await supabase
      .from("card_attributes")
      .delete()
      .eq("card_id", cardId)
      .eq("user_id", userId)
      .in(
        "attribute_key",
        Array.from(
          EDITABLE_ATTRIBUTE_KEYS
        )
      );

    if (deleteAttributeError) {
      await restoreOriginalState();

      throw new RequestError(
        `De eksisterende Card DNA-felter kunne ikke opdateres: ${deleteAttributeError.message}`,
        500
      );
    }

    if (
      attributes.length > 0
    ) {
      const {
        error: insertAttributeError,
      } = await supabase
        .from("card_attributes")
        .insert(attributes);

      if (insertAttributeError) {
        await restoreOriginalState();

        throw new RequestError(
          `Det opdaterede Card DNA kunne ikke gemmes: ${insertAttributeError.message}`,
          500
        );
      }
    }

    return NextResponse.json({
      success: true,

      cardId,

      state:
        nextState,

      needsManualReview,

      unresolvedFields,

      message:
        needsManualReview
          ? "Kortet er opdateret, men mangler fortsat enkelte oplysninger."
          : "Kortet er opdateret og verificeret.",
    });
  } catch (error) {
    console.error(
      "Fejl i update-card route:",
      error
    );

    const status =
      error instanceof RequestError
        ? error.status
        : 500;

    return NextResponse.json(
      {
        error:
          getErrorMessage(error),
      },
      {
        status,
      }
    );
  }
}