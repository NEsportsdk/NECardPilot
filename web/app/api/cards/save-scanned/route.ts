import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const CARD_IMAGE_BUCKET = "card-images";

type AttributeValue =
  | string
  | number
  | boolean
  | string[];

type AttributeSource =
  | "manual"
  | "ai"
  | "import"
  | "marketplace";

type AttributeRow = {
  user_id: string;
  card_id: string;
  attribute_key: string;
  attribute_value: AttributeValue;
  source: AttributeSource;
  confidence_score: number | null;
  is_verified: boolean;
};

type SaveScannedCardRequest = {
  collectionId?: unknown;
  scanId?: unknown;
  frontPath?: unknown;
  backPath?: unknown;
  card?: unknown;
  purchasePrice?: unknown;
  estimatedValue?: unknown;
  purchaseSource?: unknown;
  userNotes?: unknown;
  editedFields?: unknown;
};

class RequestError extends Error {
  status: number;

  constructor(message: string, status = 400) {
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
  fieldLabel: string
) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new RequestError(
      `${fieldLabel} mangler.`
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

function getOptionalNumber(
  value: unknown
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
    return null;
  }

  const normalizedValue =
    typeof value === "string"
      ? value.replace(",", ".").trim()
      : value;

  if (normalizedValue === "") {
    return null;
  }

  const parsedValue = Number(normalizedValue);

  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  return parsedValue;
}

function getOptionalBoolean(
  value: unknown
): boolean | null {
  return typeof value === "boolean"
    ? value
    : null;
}

function getStringArray(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter(
          (item): item is string =>
            typeof item === "string"
        )
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function normalizeConfidence(
  confidence: number | null
) {
  if (confidence === null) {
    return null;
  }

  const percentage =
    confidence <= 1
      ? confidence * 100
      : confidence;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(percentage * 100) / 100
    )
  );
}

function isValidStoragePath(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= 1000 &&
    !value.includes("..") &&
    !value.startsWith("/")
  );
}

function hasAttributeValue(
  value: AttributeValue | null
) {
  if (value === null) {
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
      (await request.json()) as SaveScannedCardRequest;

    const collectionId =
      getRequiredString(
        body.collectionId,
        "Collection"
      );

    const scanId =
      getRequiredString(
        body.scanId,
        "Scan-ID"
      );

    const frontPathInput = body.frontPath;
    const backPathInput = body.backPath;

    if (
      !isValidStoragePath(frontPathInput) ||
      !isValidStoragePath(backPathInput)
    ) {
      throw new RequestError(
        "Der mangler en gyldig billedsti til forsiden eller bagsiden."
      );
    }

    const frontPath = frontPathInput;
    const backPath = backPathInput;

    if (frontPath === backPath) {
      throw new RequestError(
        "Forsiden og bagsiden skal være to forskellige billeder."
      );
    }

    const cardInput = body.card;

    if (!isRecord(cardInput)) {
      throw new RequestError(
        "Kortets identificerede oplysninger mangler."
      );
    }

    const playerName =
      getRequiredString(
        cardInput.playerName,
        "Spillernavn"
      );

    const sport =
      getOptionalString(cardInput.sport);

    const team =
      getOptionalString(cardInput.team);

    const year =
      getOptionalString(cardInput.year);

    const manufacturer =
      getOptionalString(
        cardInput.manufacturer
      );

    const brand =
      getOptionalString(cardInput.brand);

    const product =
      getOptionalString(cardInput.product);

    const setName =
      getOptionalString(cardInput.setName);

    const cardNumber =
      getOptionalString(
        cardInput.cardNumber
      );

    const parallel =
      getOptionalString(cardInput.parallel);

    const serialNumber =
      getOptionalString(
        cardInput.serialNumber
      );

    const serialNumberedTo =
      getOptionalNumber(
        cardInput.serialNumberedTo
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
      getOptionalString(cardInput.grade);

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

    const aiNotes =
      getStringArray(cardInput.notes);

    const uncertainFields =
      getStringArray(
        cardInput.uncertainFields
      );

    const confidence =
      normalizeConfidence(
        getOptionalNumber(
          cardInput.confidence
        )
      );

    const needsManualReview =
      getOptionalBoolean(
        cardInput.needsManualReview
      ) ?? false;

    const purchasePrice =
      getOptionalNumber(
        body.purchasePrice
      );

    const estimatedValue =
      getOptionalNumber(
        body.estimatedValue
      );

    const purchaseSource =
      getOptionalString(
        body.purchaseSource
      );

    const userNotes =
      getOptionalString(
        body.userNotes
      );

    const editedFields =
      new Set(
        getStringArray(
          body.editedFields
        )
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

    const supabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new RequestError(
        "Du skal være logget ind for at gemme kortet.",
        401
      );
    }

    /*
     * Gem ID'et som en almindelig streng.
     *
     * Dermed ved TypeScript også, at værdien
     * ikke kan være null inde i funktionerne
     * længere nede i filen.
     */
    const userId = user.id;

    const {
      data: collection,
      error: collectionError,
    } = await supabase
      .from("collections")
      .select("id")
      .eq("id", collectionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (
      collectionError ||
      !collection
    ) {
      throw new RequestError(
        "Collection blev ikke fundet, eller du har ikke adgang til den.",
        403
      );
    }

    const expectedPathPrefix =
      `${userId}/${collectionId}/${scanId}/`;

    if (
      !frontPath.startsWith(
        expectedPathPrefix
      ) ||
      !backPath.startsWith(
        expectedPathPrefix
      )
    ) {
      throw new RequestError(
        "Kortbillederne tilhører ikke den valgte collection eller scanning.",
        403
      );
    }

    const hasCoreIdentity =
      Boolean(
        playerName &&
          year &&
          (manufacturer || brand) &&
          (product || setName) &&
          cardNumber
      );

    const cardState =
      hasCoreIdentity &&
      !needsManualReview
        ? "verified"
        : "needs_review";

    const cleanupUploadedImages =
      async () => {
        const { error } =
          await supabase.storage
            .from(CARD_IMAGE_BUCKET)
            .remove([
              frontPath,
              backPath,
            ]);

        if (error) {
          console.error(
            "Kortbillederne kunne ikke ryddes op:",
            error
          );
        }
      };

    const {
      data: createdCard,
      error: cardError,
    } = await supabase
      .from("cards")
      .insert({
        user_id: userId,

        current_collection_id:
          collectionId,

        player_name: playerName,

        year,

        manufacturer:
          manufacturer ?? brand,

        set_name:
          setName ?? product,

        card_number: cardNumber,

        parallel_name: parallel,

        serial_number: serialNumber,

        purchase_price: purchasePrice,

        estimated_value:
          estimatedValue,

        notes: userNotes,

        state: cardState,
      })
      .select("id")
      .single();

    if (
      cardError ||
      !createdCard
    ) {
      await cleanupUploadedImages();

      return NextResponse.json(
        {
          error:
            cardError?.message ??
            "Kortet kunne ikke oprettes.",
        },
        {
          status: 500,
        }
      );
    }

    const cardId =
      createdCard.id as string;

    const rollbackSave =
      async () => {
        const { error: deleteError } =
          await supabase
            .from("cards")
            .delete()
            .eq("id", cardId)
            .eq("user_id", userId);

        if (deleteError) {
          console.error(
            "Kortet kunne ikke rulles tilbage:",
            deleteError
          );
        }

        await cleanupUploadedImages();
      };

    const {
      error: imageError,
    } = await supabase
      .from("card_images")
      .insert([
        {
          user_id: userId,
          card_id: cardId,
          image_type: "front",
          storage_path: frontPath,
          public_url: null,
        },
        {
          user_id: userId,
          card_id: cardId,
          image_type: "back",
          storage_path: backPath,
          public_url: null,
        },
      ]);

    if (imageError) {
      await rollbackSave();

      return NextResponse.json(
        {
          error:
            `Kortets billeder kunne ikke registreres: ${imageError.message}`,
        },
        {
          status: 500,
        }
      );
    }

    const attributes: AttributeRow[] = [];

    const uncertainFieldSet =
      new Set(uncertainFields);

    function sourceForField(
      fieldName: string
    ): AttributeSource {
      return editedFields.has(fieldName)
        ? "manual"
        : "ai";
    }

    function addAttribute(
      key: string,
      value: AttributeValue | null,
      source: AttributeSource,
      attributeConfidence:
        | number
        | null = confidence,
      isVerified = true
    ) {
      if (!hasAttributeValue(value)) {
        return;
      }

      attributes.push({
        user_id: userId,

        card_id: cardId,

        attribute_key: key,

        attribute_value:
          value as AttributeValue,

        source,

        confidence_score:
          source === "ai"
            ? attributeConfidence
            : null,

        is_verified:
          isVerified,
      });
    }

    const identityAttributes: Array<{
      key: string;
      value: AttributeValue | null;
      fieldName: string;
    }> = [
      {
        key: "player_name",
        value: playerName,
        fieldName: "playerName",
      },
      {
        key: "sport",
        value: sport,
        fieldName: "sport",
      },
      {
        key: "team",
        value: team,
        fieldName: "team",
      },
      {
        key: "manufacturer",
        value: manufacturer,
        fieldName: "manufacturer",
      },
      {
        key: "brand",
        value: brand,
        fieldName: "brand",
      },
      {
        key: "product",
        value: product,
        fieldName: "product",
      },
      {
        key: "set_name",
        value: setName,
        fieldName: "setName",
      },
      {
        key: "year",
        value: year,
        fieldName: "year",
      },
      {
        key: "card_number",
        value: cardNumber,
        fieldName: "cardNumber",
      },
      {
        key: "parallel",
        value: parallel,
        fieldName: "parallel",
      },
      {
        key: "serial_number",
        value: serialNumber,
        fieldName: "serialNumber",
      },
      {
        key: "serial_numbered_to",
        value: serialNumberedTo,
        fieldName: "serialNumberedTo",
      },
      {
        key: "rookie_card",
        value: rookieCard,
        fieldName: "rookieCard",
      },
      {
        key: "autograph",
        value: autograph,
        fieldName: "autograph",
      },
      {
        key: "memorabilia",
        value: memorabilia,
        fieldName: "memorabilia",
      },
      {
        key: "memorabilia_type",
        value: memorabiliaType,
        fieldName: "memorabiliaType",
      },
      {
        key: "grading_company",
        value: gradingCompany,
        fieldName: "gradingCompany",
      },
      {
        key: "grade",
        value: grade,
        fieldName: "grade",
      },
      {
        key: "certification_number",
        value: certificationNumber,
        fieldName: "certificationNumber",
      },
      {
        key: "language",
        value: language,
        fieldName: "language",
      },
      {
        key: "variation",
        value: variation,
        fieldName: "variation",
      },
    ];

    for (
      const attribute
      of identityAttributes
    ) {
      const source =
        sourceForField(
          attribute.fieldName
        );

      const fieldIsVerified =
        source === "manual" ||
        !uncertainFieldSet.has(
          attribute.fieldName
        );

      addAttribute(
        attribute.key,
        attribute.value,
        source,
        confidence,
        fieldIsVerified
      );
    }

    addAttribute(
      "ai_confidence",
      confidence,
      "ai",
      confidence,
      true
    );

    addAttribute(
      "ai_needs_manual_review",
      needsManualReview,
      "ai",
      confidence,
      true
    );

    addAttribute(
      "ai_uncertain_fields",
      uncertainFields,
      "ai",
      confidence,
      true
    );

    addAttribute(
      "ai_notes",
      aiNotes,
      "ai",
      confidence,
      true
    );

    addAttribute(
      "purchase_source",
      purchaseSource,
      "manual",
      null,
      true
    );

    addAttribute(
      "scan_id",
      scanId,
      "import",
      null,
      true
    );

    if (attributes.length > 0) {
      const {
        error: attributeError,
      } = await supabase
        .from("card_attributes")
        .insert(attributes);

      if (attributeError) {
        await rollbackSave();

        return NextResponse.json(
          {
            error:
              `Card DNA kunne ikke gemmes: ${attributeError.message}`,
          },
          {
            status: 500,
          }
        );
      }
    }

    return NextResponse.json({
      success: true,

      cardId,

      state: cardState,

      message:
        cardState === "verified"
          ? "Kortet er gemt og verificeret."
          : "Kortet er gemt, men kræver yderligere kontrol.",
    });
  } catch (error) {
    console.error(
      "Fejl i save-scanned route:",
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