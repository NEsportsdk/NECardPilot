import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type RecordGradingResultRequest = {
  submissionCardId?: unknown;
  resultGrade?: unknown;
  certificationNumber?: unknown;
  resultQualifier?: unknown;
  resultSubgrades?: unknown;
  resultMarketValue?: unknown;
  resultNotes?: unknown;
  gradedAt?: unknown;
};

type NormalizedSubgrades = Record<string, string | number | null>;

type RecordGradingResultRpcRow = {
  submission_id: string;
  submission_card_id: string;
  card_id: string;
  grading_company: string;
  result_grade: string;
  certification_number: string | null;
  result_market_value: number | string | null;
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

function getRequiredUuid(value: unknown, label: string) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value.trim())) {
    throw new RequestError(`${label} has an invalid format.`);
  }

  return value.trim();
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

function getOptionalMoney(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string" && typeof value !== "number") {
    throw new RequestError(`${label} must be a number.`);
  }

  const normalizedValue =
    typeof value === "string" ? normalizeNumberString(value) : value;

  if (normalizedValue === "") {
    return null;
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

function getOptionalDateTime(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new RequestError("The grading date has an invalid format.");
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    throw new RequestError("The grading date is invalid.");
  }

  return date.toISOString();
}

function normalizeSubgrades(value: unknown): NormalizedSubgrades {
  if (value === null || value === undefined) {
    return {};
  }

  if (!isRecord(value)) {
    throw new RequestError("Subgrades must have a valid object format.");
  }

  const entries = Object.entries(value);

  if (entries.length > 20) {
    throw new RequestError("At most 20 subgrades may be recorded.");
  }

  const normalized: NormalizedSubgrades = {};

  for (const [rawKey, rawValue] of entries) {
    const key = rawKey.trim();

    if (!key || key.length > 80) {
      throw new RequestError("A subgrade name has an invalid format.");
    }

    if (rawValue === null) {
      normalized[key] = null;
      continue;
    }

    if (typeof rawValue === "number") {
      if (!Number.isFinite(rawValue)) {
        throw new RequestError(`Subgrade ${key} must be a valid value.`);
      }

      normalized[key] = rawValue;
      continue;
    }

    if (typeof rawValue === "string") {
      const text = rawValue.trim();

      if (text.length > 80) {
        throw new RequestError(
          `Subgrade ${key} may contain at most 80 characters.`
        );
      }

      normalized[key] = text || null;
      continue;
    }

    throw new RequestError(
      `Subgrade ${key} must be text, a number or empty.`
    );
  }

  return normalized;
}

function getRpcErrorStatus(error: {
  code?: string | null;
  message: string;
}) {
  const message = error.message.toLowerCase();

  if (
    error.code === "23505" ||
    message.includes("already") ||
    message.includes("allerede")
  ) {
    return 409;
  }

  if (
    message.includes("not found") ||
    message.includes("ikke fundet") ||
    message.includes("do not have access") ||
    message.includes("ikke adgang")
  ) {
    return 404;
  }

  if (message.includes("logged in") || message.includes("logget ind")) {
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

function getNullableResultNumber(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    throw new RequestError(
      `The database returned an invalid ${label}.`,
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
    const body = (await request.json()) as RecordGradingResultRequest;

    const submissionCardId = getRequiredUuid(
      body.submissionCardId,
      "Submission card ID"
    );

    const resultGrade = getRequiredText(
      body.resultGrade,
      "Result grade",
      40
    );

    const certificationNumber = getOptionalText(
      body.certificationNumber,
      "Certification number",
      120
    );

    const resultQualifier = getOptionalText(
      body.resultQualifier,
      "Result qualifier",
      120
    );

    const resultSubgrades = normalizeSubgrades(body.resultSubgrades);

    const resultMarketValue = getOptionalMoney(
      body.resultMarketValue,
      "Result market value"
    );

    const resultNotes = getOptionalText(
      body.resultNotes,
      "Result notes",
      5000
    );

    const gradedAt = getOptionalDateTime(body.gradedAt);

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new RequestError(
        "You must be logged in to record a grading result.",
        401
      );
    }

    const { data, error } = await supabase.rpc(
      "record_grading_card_result",
      {
        p_submission_card_id: submissionCardId,
        p_result_grade: resultGrade,
        p_certification_number: certificationNumber,
        p_result_qualifier: resultQualifier,
        p_result_subgrades: resultSubgrades,
        p_result_market_value: resultMarketValue,
        p_result_notes: resultNotes,
        p_graded_at: gradedAt,
      }
    );

    if (error) {
      console.error("record_grading_card_result failed:", error);

      throw new RequestError(
        error.message || "The grading result could not be recorded.",
        getRpcErrorStatus(error)
      );
    }

    const rows = (data ?? []) as RecordGradingResultRpcRow[];
    const result = rows[0];

    if (!result) {
      throw new RequestError(
        "The database did not return a confirmation for the grading result.",
        500
      );
    }

    if (
      !UUID_PATTERN.test(result.submission_id) ||
      !UUID_PATTERN.test(result.submission_card_id) ||
      !UUID_PATTERN.test(result.card_id)
    ) {
      throw new RequestError(
        "The database returned an invalid grading result reference.",
        500
      );
    }

    const normalizedMarketValue = getNullableResultNumber(
      result.result_market_value,
      "result market value"
    );

    return NextResponse.json({
      success: true,
      submissionId: result.submission_id,
      submissionCardId: result.submission_card_id,
      cardId: result.card_id,
      gradingCompany: result.grading_company,
      resultGrade: result.result_grade,
      certificationNumber: result.certification_number,
      resultMarketValue: normalizedMarketValue,
      message: result.result_message,
    });
  } catch (error) {
    console.error("Error in grading-record-result route:", error);

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
            ? "The grading result data had an invalid format."
            : getErrorMessage(error),
      },
      {
        status,
      }
    );
  }
}