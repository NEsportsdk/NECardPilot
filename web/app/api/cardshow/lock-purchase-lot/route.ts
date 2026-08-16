import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type LockPurchaseLotRequest = {
  lotId?: unknown;
  overwriteExistingPurchasePrice?: unknown;
};

type LockPurchaseLotRpcRow = {
  lot_id: string;
  lot_status: string;
  card_count: number | string;
  total_cost: number | string;
  result_message: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class RequestError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "RequestError";
    this.status = status;
  }
}

function getRequiredUuid(value: unknown) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value.trim())) {
    throw new RequestError("Købslot-ID er ugyldigt.");
  }

  return value.trim();
}

function getBoolean(value: unknown, defaultValue: boolean) {
  if (value === null || value === undefined) {
    return defaultValue;
  }

  if (typeof value !== "boolean") {
    throw new RequestError(
      "Overskrivelsesindstillingen har et ugyldigt format."
    );
  }

  return value;
}

function getResultInteger(value: unknown, label: string) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw new RequestError(
      `Købslottet blev låst, men ${label} kunne ikke læses korrekt.`,
      500
    );
  }

  return parsedValue;
}

function getResultNumber(value: unknown, label: string) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    throw new RequestError(
      `Købslottet blev låst, men ${label} kunne ikke læses korrekt.`,
      500
    );
  }

  return parsedValue;
}

function getRpcErrorStatus(error: {
  code?: string | null;
  message: string;
}) {
  const message = error.message.toLowerCase();

  if (error.code === "23505" || message.includes("allerede")) {
    return 409;
  }

  if (message.includes("ikke fundet") || message.includes("ikke adgang")) {
    return 404;
  }

  if (message.includes("logget ind")) {
    return 401;
  }

  if (error.code === "42501") {
    return 403;
  }

  return error.code === "P0001" ? 400 : 500;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Der opstod en ukendt fejl.";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LockPurchaseLotRequest;
    const lotId = getRequiredUuid(body.lotId);
    const overwriteExistingPurchasePrice = getBoolean(
      body.overwriteExistingPurchasePrice,
      false
    );

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new RequestError(
        "Du skal være logget ind for at låse et købslot.",
        401
      );
    }

    const { data, error } = await supabase.rpc("lock_purchase_lot", {
      p_lot_id: lotId,
      p_overwrite_existing_purchase_price: overwriteExistingPurchasePrice,
    });

    if (error) {
      console.error("lock_purchase_lot failed:", error);
      throw new RequestError(
        error.message || "Købslottet kunne ikke låses.",
        getRpcErrorStatus(error)
      );
    }

    const row = ((data ?? []) as LockPurchaseLotRpcRow[])[0];

    if (!row) {
      throw new RequestError(
        "Databasen returnerede ikke en bekræftelse på låsningen.",
        500
      );
    }

    return NextResponse.json({
      success: true,
      lotId: row.lot_id,
      status: row.lot_status,
      cardCount: getResultInteger(row.card_count, "antallet af kort"),
      totalCost: getResultNumber(row.total_cost, "den samlede kostpris"),
      message: row.result_message,
    });
  } catch (error) {
    console.error("Error in lock purchase lot route:", error);

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
            ? "Købslot-oplysningerne havde et ugyldigt format."
            : getErrorMessage(error),
      },
      { status }
    );
  }
}