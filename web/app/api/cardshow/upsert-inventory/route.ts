import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type UpsertInventoryRequest = {
  eventId?: unknown;
  items?: unknown;
};

type UpsertInventoryRpcRow = {
  event_id: string;
  added_count: number | string;
  updated_count: number | string;
  item_count: number | string;
  result_message: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ITEM_STATUSES = new Set(["available", "reserved", "withdrawn"]);
const PRICE_SOURCES = new Set([
  "manual",
  "market",
  "suggested",
  "price_group",
]);

class RequestError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "RequestError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRequiredUuid(value: unknown, label: string) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value.trim())) {
    throw new RequestError(`${label} er ugyldigt.`);
  }

  return value.trim();
}

function getOptionalString(
  value: unknown,
  label: string,
  maxLength: number
): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new RequestError(`${label} har et ugyldigt format.`);
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue.length > maxLength) {
    throw new RequestError(`${label} må højst være ${maxLength} tegn.`);
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
    normalizedValue =
      lastComma > lastDot
        ? normalizedValue.replace(/\./g, "").replace(/,/g, ".")
        : normalizedValue.replace(/,/g, "");
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

function getOptionalMoney(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string" && typeof value !== "number") {
    throw new RequestError(`${label} skal være et tal.`);
  }

  const normalizedValue =
    typeof value === "string" ? normalizeNumberString(value) : value;
  const parsedValue = Number(normalizedValue);

  if (!Number.isFinite(parsedValue)) {
    throw new RequestError(`${label} skal være et gyldigt tal.`);
  }

  if (parsedValue < 0) {
    throw new RequestError(`${label} kan ikke være negativ.`);
  }

  return Math.round((parsedValue + Number.EPSILON) * 100) / 100;
}

function getOptionalDateTime(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new RequestError(`${label} har et ugyldigt format.`);
  }

  const date = new Date(value.trim());

  if (Number.isNaN(date.getTime())) {
    throw new RequestError(`${label} er ugyldigt.`);
  }

  return date.toISOString();
}

function getEnumValue(
  value: unknown,
  defaultValue: string,
  allowedValues: Set<string>,
  label: string
) {
  const normalizedValue =
    typeof value === "string" && value.trim()
      ? value.trim().toLowerCase()
      : defaultValue;

  if (!allowedValues.has(normalizedValue)) {
    throw new RequestError(`${label} er ugyldig.`);
  }

  return normalizedValue;
}

function normalizeItem(value: unknown, index: number) {
  if (!isRecord(value)) {
    throw new RequestError(
      `Inventory-element ${index + 1} har et ugyldigt format.`
    );
  }

  const cardId = getRequiredUuid(value.cardId, `Kort-ID ${index + 1}`);
  const status = getEnumValue(
    value.status,
    "available",
    ITEM_STATUSES,
    `Status for kort ${index + 1}`
  );
  const askingPrice = getOptionalMoney(
    value.askingPrice,
    `Asking price for kort ${index + 1}`
  );
  const floorPrice = getOptionalMoney(
    value.floorPrice,
    `Floor price for kort ${index + 1}`
  );
  const priceSource = getEnumValue(
    value.priceSource,
    "manual",
    PRICE_SOURCES,
    `Priskilden for kort ${index + 1}`
  );
  const priceGroupAmount = getOptionalMoney(
    value.priceGroupAmount,
    `Prisgruppebeløbet for kort ${index + 1}`
  );
  const reservedFor = getOptionalString(
    value.reservedFor,
    `Reservationsnavnet for kort ${index + 1}`,
    160
  );

  if (askingPrice !== null && askingPrice <= 0) {
    throw new RequestError(
      `Asking price for kort ${index + 1} skal være større end 0.`
    );
  }

  if (priceGroupAmount !== null && priceGroupAmount <= 0) {
    throw new RequestError(
      `Prisgruppebeløbet for kort ${index + 1} skal være større end 0.`
    );
  }

  if (
    floorPrice !== null &&
    askingPrice !== null &&
    floorPrice > askingPrice
  ) {
    throw new RequestError(
      `Floor price kan ikke være højere end asking price for kort ${index + 1}.`
    );
  }

  if (status === "reserved" && !reservedFor) {
    throw new RequestError(
      `Angiv hvem kort ${index + 1} er reserveret til.`
    );
  }

  return {
    cardId,
    status,
    askingPrice,
    floorPrice,
    priceSource,
    priceGroupLabel: getOptionalString(
      value.priceGroupLabel,
      `Prisgruppens navn for kort ${index + 1}`,
      120
    ),
    priceGroupAmount,
    locationLabel: getOptionalString(
      value.locationLabel,
      `Placeringen for kort ${index + 1}`,
      160
    ),
    inventoryCode: getOptionalString(
      value.inventoryCode,
      `Inventory-koden for kort ${index + 1}`,
      120
    ),
    reservedFor,
    reservationNote: getOptionalString(
      value.reservationNote,
      `Reservationsnoten for kort ${index + 1}`,
      1000
    ),
    reservedUntil: getOptionalDateTime(
      value.reservedUntil,
      `Reservationens udløbstidspunkt for kort ${index + 1}`
    ),
    notes: getOptionalString(
      value.notes,
      `Noterne for kort ${index + 1}`,
      3000
    ),
  };
}

function getResultInteger(value: unknown, label: string) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw new RequestError(
      `Inventory blev opdateret, men ${label} kunne ikke læses korrekt.`,
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
    const body = (await request.json()) as UpsertInventoryRequest;
    const eventId = getRequiredUuid(body.eventId, "Cardshow-ID");

    if (!Array.isArray(body.items)) {
      throw new RequestError("Kortlisten har et ugyldigt format.");
    }

    if (body.items.length < 1) {
      throw new RequestError("Vælg mindst ét kort til cardshowet.");
    }

    if (body.items.length > 5000) {
      throw new RequestError(
        "Der kan højst behandles 5.000 kort ad gangen."
      );
    }

    const items = body.items.map(normalizeItem);
    const uniqueCardIds = new Set(items.map((item) => item.cardId));

    if (uniqueCardIds.size !== items.length) {
      throw new RequestError(
        "Det samme kort må kun forekomme én gang i batchen."
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new RequestError(
        "Du skal være logget ind for at administrere cardshow-inventory.",
        401
      );
    }

    const { data, error } = await supabase.rpc(
      "upsert_cardshow_inventory_items",
      {
        p_event_id: eventId,
        p_items: items,
      }
    );

    if (error) {
      console.error("upsert_cardshow_inventory_items failed:", error);
      throw new RequestError(
        error.message || "Cardshow-inventory kunne ikke opdateres.",
        getRpcErrorStatus(error)
      );
    }

    const row = ((data ?? []) as UpsertInventoryRpcRow[])[0];

    if (!row) {
      throw new RequestError(
        "Databasen returnerede ikke en bekræftelse på inventory-opdateringen.",
        500
      );
    }

    return NextResponse.json({
      success: true,
      eventId: row.event_id,
      addedCount: getResultInteger(row.added_count, "antal tilføjede kort"),
      updatedCount: getResultInteger(
        row.updated_count,
        "antal opdaterede kort"
      ),
      itemCount: getResultInteger(row.item_count, "det samlede antal kort"),
      message: row.result_message,
    });
  } catch (error) {
    console.error("Error in upsert cardshow inventory route:", error);

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
            ? "Inventory-oplysningerne havde et ugyldigt format."
            : getErrorMessage(error),
      },
      { status }
    );
  }
}
