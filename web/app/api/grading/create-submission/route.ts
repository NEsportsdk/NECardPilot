import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type CreateGradingSubmissionRequest = {
  name?: unknown;
  gradingCompany?: unknown;
  serviceLevel?: unknown;
  currency?: unknown;
  submissionNumber?: unknown;
  estimatedTurnaroundDays?: unknown;
  submissionFee?: unknown;
  outboundShippingCost?: unknown;
  returnShippingCost?: unknown;
  insuranceCost?: unknown;
  otherSharedCosts?: unknown;
  notes?: unknown;
  cards?: unknown;
};

type GradingCardRequest = {
  cardId?: unknown;
  declaredValue?: unknown;
  gradingFee?: unknown;
  preparationFee?: unknown;
  otherCardCosts?: unknown;
  expectedGrade?: unknown;
  expectedGradedValue?: unknown;
};

type NormalizedGradingCard = {
  cardId: string;
  declaredValue: number | null;
  gradingFee: number;
  preparationFee: number;
  otherCardCosts: number;
  expectedGrade: string | null;
  expectedGradedValue: number | null;
};

type CreateSubmissionRpcRow = {
  submission_id: string;
  card_count: number | string;
  shared_cost_total: number | string;
  result_message: string;
};

class RequestError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "RequestError";
    this.status = status;
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getRequiredText(
  value: unknown,
  label: string,
  maxLength: number
) {
  if (typeof value !== "string" || !value.trim()) {
    throw new RequestError(`${label} is required.`);
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length > maxLength) {
    throw new RequestError(
      `${label} may contain at most ${maxLength} characters.`
    );
  }

  return normalizedValue;
}

function getOptionalText(
  value: unknown,
  label: string,
  maxLength: number
): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new RequestError(`${label} has an invalid format.`);
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue.length > maxLength) {
    throw new RequestError(
      `${label} may contain at most ${maxLength} characters.`
    );
  }

  return normalizedValue;
}

function normalizeNumberString(value: string) {
  let normalizedValue = value
    .trim()
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");

  const lastComma = normalizedValue.lastIndexOf(",");
  const lastDot = normalizedValue.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      normalizedValue = normalizedValue
        .replace(/\./g, "")
        .replace(/,/g, ".");
    } else {
      normalizedValue = normalizedValue.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    normalizedValue = normalizedValue.replace(/,/g, ".");
  } else if (lastDot >= 0) {
    const parts = normalizedValue.split(".");

    if (parts.length === 2 && parts[1]?.length === 3) {
      normalizedValue = parts.join("");
    }
  }

  return normalizedValue;
}

function getMoneyValue(
  value: unknown,
  label: string,
  options: {
    nullable?: boolean;
  } = {}
): number | null {
  const { nullable = false } = options;

  if (value === null || value === undefined || value === "") {
    return nullable ? null : 0;
  }

  if (typeof value !== "string" && typeof value !== "number") {
    throw new RequestError(`${label} must be a number.`);
  }

  const normalizedValue =
    typeof value === "string" ? normalizeNumberString(value) : value;

  if (normalizedValue === "") {
    return nullable ? null : 0;
  }

  const parsedValue = Number(normalizedValue);

  if (!Number.isFinite(parsedValue)) {
    throw new RequestError(`${label} must be a valid number.`);
  }

  if (parsedValue < 0) {
    throw new RequestError(`${label} cannot be negative.`);
  }

  return Math.round((parsedValue + Number.EPSILON) * 100) / 100;
}

function getOptionalPositiveInteger(
  value: unknown,
  label: string
): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string" && typeof value !== "number") {
    throw new RequestError(`${label} must be a whole number.`);
  }

  const normalizedValue =
    typeof value === "string" ? value.trim() : value;

  if (normalizedValue === "") {
    return null;
  }

  const parsedValue = Number(normalizedValue);

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    throw new RequestError(`${label} must be a positive whole number.`);
  }

  return parsedValue;
}

function getCardId(value: unknown, index: number) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value.trim())) {
    throw new RequestError(
      `Card ${index + 1} has an invalid card ID.`
    );
  }

  return value.trim();
}

function normalizeCard(
  value: unknown,
  index: number
): NormalizedGradingCard {
  if (!isRecord(value)) {
    throw new RequestError(`Card ${index + 1} has an invalid format.`);
  }

  const card = value as GradingCardRequest;

  return {
    cardId: getCardId(card.cardId, index),
    declaredValue: getMoneyValue(
      card.declaredValue,
      `Declared value for card ${index + 1}`,
      { nullable: true }
    ),
    gradingFee:
      getMoneyValue(
        card.gradingFee,
        `Grading fee for card ${index + 1}`
      ) ?? 0,
    preparationFee:
      getMoneyValue(
        card.preparationFee,
        `Preparation fee for card ${index + 1}`
      ) ?? 0,
    otherCardCosts:
      getMoneyValue(
        card.otherCardCosts,
        `Other costs for card ${index + 1}`
      ) ?? 0,
    expectedGrade: getOptionalText(
      card.expectedGrade,
      `Expected grade for card ${index + 1}`,
      40
    ),
    expectedGradedValue: getMoneyValue(
      card.expectedGradedValue,
      `Expected graded value for card ${index + 1}`,
      { nullable: true }
    ),
  };
}

function getRpcErrorStatus(error: {
  code?: string | null;
  message: string;
}) {
  const message = error.message.toLowerCase();

  if (
    error.code === "23505" ||
    message.includes("already") ||
    message.includes("active grading submission")
  ) {
    return 409;
  }

  if (
    message.includes("not found") ||
    message.includes("do not have access")
  ) {
    return 404;
  }

  if (message.includes("logged in")) {
    return 401;
  }

  if (error.code === "42501") {
    return 403;
  }

  if (
    error.code === "P0001" ||
    error.code === "22P02" ||
    error.code === "23514"
  ) {
    return 400;
  }

  return 500;
}

function getResultNumber(value: unknown, label: string) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw new RequestError(
      `The submission was created, but ${label} could not be read.`,
      500
    );
  }

  return parsedValue;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "An unknown error occurred.";
}

export async function POST(request: Request) {
  try {
    const body =
      (await request.json()) as CreateGradingSubmissionRequest;

    const name = getRequiredText(body.name, "Submission name", 160);

    const gradingCompany = getRequiredText(
      body.gradingCompany,
      "Grading company",
      40
    ).toUpperCase();

    const serviceLevel = getOptionalText(
      body.serviceLevel,
      "Service level",
      120
    );

    const currency =
      typeof body.currency === "string" && body.currency.trim()
        ? body.currency.trim().toUpperCase()
        : "DKK";

    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new RequestError(
        "Currency must be a valid three-letter code."
      );
    }

    const submissionNumber = getOptionalText(
      body.submissionNumber,
      "Submission number",
      120
    );

    const estimatedTurnaroundDays = getOptionalPositiveInteger(
      body.estimatedTurnaroundDays,
      "Estimated turnaround"
    );

    const submissionFee =
      getMoneyValue(body.submissionFee, "Submission fee") ?? 0;

    const outboundShippingCost =
      getMoneyValue(
        body.outboundShippingCost,
        "Outbound shipping cost"
      ) ?? 0;

    const returnShippingCost =
      getMoneyValue(
        body.returnShippingCost,
        "Return shipping cost"
      ) ?? 0;

    const insuranceCost =
      getMoneyValue(body.insuranceCost, "Insurance cost") ?? 0;

    const otherSharedCosts =
      getMoneyValue(body.otherSharedCosts, "Other shared costs") ?? 0;

    const notes = getOptionalText(body.notes, "Notes", 5000);

    if (!Array.isArray(body.cards)) {
      throw new RequestError("The card list has an invalid format.");
    }

    if (body.cards.length < 1) {
      throw new RequestError("Select at least one card.");
    }

    if (body.cards.length > 200) {
      throw new RequestError(
        "A grading submission may contain at most 200 cards."
      );
    }

    const cards = body.cards.map(normalizeCard);
    const uniqueCardIds = new Set(cards.map((card) => card.cardId));

    if (uniqueCardIds.size !== cards.length) {
      throw new RequestError(
        "The same card may only be added once to a submission."
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new RequestError(
        "You must be logged in to create a grading submission.",
        401
      );
    }

    const { data, error } = await supabase.rpc(
      "create_grading_submission",
      {
        p_name: name,
        p_grading_company: gradingCompany,
        p_service_level: serviceLevel,
        p_currency: currency,
        p_submission_number: submissionNumber,
        p_estimated_turnaround_days: estimatedTurnaroundDays,
        p_submission_fee: submissionFee,
        p_outbound_shipping_cost: outboundShippingCost,
        p_return_shipping_cost: returnShippingCost,
        p_insurance_cost: insuranceCost,
        p_other_shared_costs: otherSharedCosts,
        p_notes: notes,
        p_cards: cards,
      }
    );

    if (error) {
      console.error("create_grading_submission failed:", error);

      throw new RequestError(
        error.message || "The grading submission could not be created.",
        getRpcErrorStatus(error)
      );
    }

    const resultRows = (data ?? []) as CreateSubmissionRpcRow[];
    const result = resultRows[0];

    if (!result) {
      throw new RequestError(
        "The database did not return a confirmation for the submission.",
        500
      );
    }

    const cardCount = getResultNumber(result.card_count, "the card count");
    const sharedCostTotal = getResultNumber(
      result.shared_cost_total,
      "the shared cost total"
    );

    if (!Number.isInteger(cardCount) || cardCount < 1) {
      throw new RequestError(
        "The database returned an invalid card count.",
        500
      );
    }

    return NextResponse.json({
      success: true,
      submissionId: result.submission_id,
      cardCount,
      sharedCostTotal,
      message: result.result_message,
    });
  } catch (error) {
    console.error("Error in create-grading-submission route:", error);

    const status =
      error instanceof RequestError
        ? error.status
        : error instanceof SyntaxError
          ? 400
          : 500;

    return NextResponse.json(
      {
        error:
          error instanceof SyntaxError
            ? "The submission data had an invalid format."
            : getErrorMessage(error),
      },
      {
        status,
      }
    );
  }
}