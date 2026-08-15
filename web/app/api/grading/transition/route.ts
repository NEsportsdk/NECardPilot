import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const GRADING_STATUSES = [
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

type GradingStatus = (typeof GRADING_STATUSES)[number];

type TransitionGradingSubmissionRequest = {
  submissionId?: unknown;
  targetStatus?: unknown;
  occurredAt?: unknown;
  submissionNumber?: unknown;
  outboundTrackingNumber?: unknown;
  returnTrackingNumber?: unknown;
  notes?: unknown;
};

type TransitionSubmissionRpcRow = {
  submission_id: string;
  previous_status: string;
  new_status: string;
  card_count: number | string;
  updated_card_count: number | string;
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

function getRequiredUuid(value: unknown, label: string) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value.trim())) {
    throw new RequestError(`${label} has an invalid format.`);
  }

  return value.trim();
}

function isGradingStatus(value: unknown): value is GradingStatus {
  return (
    typeof value === "string" &&
    GRADING_STATUSES.includes(value.trim().toLowerCase() as GradingStatus)
  );
}

function getTargetStatus(value: unknown) {
  if (!isGradingStatus(value)) {
    throw new RequestError("The selected grading status is invalid.");
  }

  return value.trim().toLowerCase() as GradingStatus;
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

function getOptionalDateTime(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new RequestError("The status date has an invalid format.");
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    throw new RequestError("The status date is invalid.");
  }

  return date.toISOString();
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

function getNonNegativeInteger(value: unknown, label: string) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
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
    const body =
      (await request.json()) as TransitionGradingSubmissionRequest;

    const submissionId = getRequiredUuid(
      body.submissionId,
      "Submission ID"
    );

    const targetStatus = getTargetStatus(body.targetStatus);

    const occurredAt = getOptionalDateTime(body.occurredAt);

    const submissionNumber = getOptionalText(
      body.submissionNumber,
      "Submission number",
      120
    );

    const outboundTrackingNumber = getOptionalText(
      body.outboundTrackingNumber,
      "Outbound tracking number",
      180
    );

    const returnTrackingNumber = getOptionalText(
      body.returnTrackingNumber,
      "Return tracking number",
      180
    );

    const notes = getOptionalText(body.notes, "Notes", 5000);

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new RequestError(
        "You must be logged in to update a grading submission.",
        401
      );
    }

    const { data, error } = await supabase.rpc(
      "transition_grading_submission",
      {
        p_submission_id: submissionId,
        p_target_status: targetStatus,
        p_occurred_at: occurredAt,
        p_submission_number: submissionNumber,
        p_outbound_tracking_number: outboundTrackingNumber,
        p_return_tracking_number: returnTrackingNumber,
        p_notes: notes,
      }
    );

    if (error) {
      console.error("transition_grading_submission failed:", error);

      throw new RequestError(
        error.message || "The grading submission could not be updated.",
        getRpcErrorStatus(error)
      );
    }

    const rows = (data ?? []) as TransitionSubmissionRpcRow[];
    const result = rows[0];

    if (!result) {
      throw new RequestError(
        "The database did not return a confirmation for the status change.",
        500
      );
    }

    if (
      !isGradingStatus(result.previous_status) ||
      !isGradingStatus(result.new_status)
    ) {
      throw new RequestError(
        "The database returned an invalid grading status.",
        500
      );
    }

    const cardCount = getNonNegativeInteger(
      result.card_count,
      "card count"
    );

    const updatedCardCount = getNonNegativeInteger(
      result.updated_card_count,
      "updated card count"
    );

    return NextResponse.json({
      success: true,
      submissionId: result.submission_id,
      previousStatus: result.previous_status,
      newStatus: result.new_status,
      cardCount,
      updatedCardCount,
      message: result.result_message,
    });
  } catch (error) {
    console.error("Error in grading-transition route:", error);

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
            ? "The grading status data had an invalid format."
            : getErrorMessage(error),
      },
      {
        status,
      }
    );
  }
}