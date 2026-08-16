import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type PurchaseLotCardRequest = {
  cardId?: unknown;
  referenceValue?: unknown;
  manualAllocatedCost?: unknown;
};

type CreatePurchaseLotRequest = {
  name?: unknown;
  allocationMethod?: unknown;
  source?: unknown;
  seller?: unknown;
  purchaseReference?: unknown;
  purchasedAt?: unknown;
  currency?: unknown;
  purchaseAmount?: unknown;
  buyerFee?: unknown;
  shippingCost?: unknown;
  taxes?: unknown;
  otherCosts?: unknown;
  notes?: unknown;
  cards?: unknown;
  lock?: unknown;
  overwriteExistingPurchasePrice?: unknown;
};

type CreatePurchaseLotRpcRow = {
  lot_id: string;
  lot_status: string;
  card_count: number | string;
  total_cost: number | string;
  allocated_total: number | string;
  result_message: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOCATION_METHODS = new Set(["proportional", "equal", "manual"]);

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

function getRequiredString(
  value: unknown,
  label: string,
  maxLength: number
) {
  if (typeof value !== "string" || !value.trim()) {
    throw new RequestError(`${label} mangler.`);
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length > maxLength) {
    throw new RequestError(`${label} må højst være ${maxLength} tegn.`);
  }

  return normalizedValue;
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

function getMoneyValue(
  value: unknown,
  label: string,
  nullable = false
): number | null {
  if (value === null || value === undefined || value === "") {
    return nullable ? null : 0;
  }

  if (typeof value !== "string" && typeof value !== "number") {
    throw new RequestError(`${label} skal være et tal.`);
  }

  const normalizedValue =
    typeof value === "string" ? normalizeNumberString(value) : value;

  if (normalizedValue === "") {
    return nullable ? null : 0;
  }

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

function getCurrency(value: unknown) {
  const currency =
    typeof value === "string" && value.trim()
      ? value.trim().toUpperCase()
      : "DKK";

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new RequestError(
      "Valutaen skal være en gyldig kode på tre bogstaver."
    );
  }

  return currency;
}

function getBoolean(value: unknown, defaultValue: boolean, label: string) {
  if (value === null || value === undefined) {
    return defaultValue;
  }

  if (typeof value !== "boolean") {
    throw new RequestError(`${label} har et ugyldigt format.`);
  }

  return value;
}

function getAllocationMethod(value: unknown) {
  const method =
    typeof value === "string" && value.trim()
      ? value.trim().toLowerCase()
      : "proportional";

  if (!ALLOCATION_METHODS.has(method)) {
    throw new RequestError("Fordelingsmetoden er ugyldig.");
  }

  return method;
}

function normalizeCard(value: unknown, index: number) {
  if (!isRecord(value)) {
    throw new RequestError(
      `Kort ${index + 1} har et ugyldigt format.`
    );
  }

  const cardId =
    typeof value.cardId === "string" ? value.cardId.trim() : "";

  if (!UUID_PATTERN.test(cardId)) {
    throw new RequestError(`Kort ${index + 1} har et ugyldigt kort-ID.`);
  }

  return {
    cardId,
    referenceValue: getMoneyValue(
      value.referenceValue,
      `Referenceværdien for kort ${index + 1}`,
      true
    ),
    manualAllocatedCost: getMoneyValue(
      value.manualAllocatedCost,
      `Den manuelle kostpris for kort ${index + 1}`,
      true
    ),
  };
}

function getResultInteger(value: unknown, label: string) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw new RequestError(
      `Købslottet blev oprettet, men ${label} kunne ikke læses korrekt.`,
      500
    );
  }

  return parsedValue;
}

function getResultNumber(value: unknown, label: string) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    throw new RequestError(
      `Købslottet blev oprettet, men ${label} kunne ikke læses korrekt.`,
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
    const body = (await request.json()) as CreatePurchaseLotRequest;

    const name = getRequiredString(body.name, "Navnet på købslottet", 160);
    const allocationMethod = getAllocationMethod(body.allocationMethod);
    const source = getOptionalString(body.source, "Købskilden", 160);
    const seller = getOptionalString(body.seller, "Sælgeren", 200);
    const purchaseReference = getOptionalString(
      body.purchaseReference,
      "Købsreferencen",
      200
    );
    const purchasedAt = getOptionalDateTime(body.purchasedAt, "Købsdatoen");
    const currency = getCurrency(body.currency);
    const purchaseAmount = getMoneyValue(
      body.purchaseAmount,
      "Købsbeløbet"
    ) as number;
    const buyerFee = getMoneyValue(body.buyerFee, "Købergebyret") as number;
    const shippingCost = getMoneyValue(
      body.shippingCost,
      "Fragtudgiften"
    ) as number;
    const taxes = getMoneyValue(body.taxes, "Skat eller moms") as number;
    const otherCosts = getMoneyValue(
      body.otherCosts,
      "De øvrige omkostninger"
    ) as number;
    const notes = getOptionalString(body.notes, "Noterne", 5000);
    const lock = getBoolean(body.lock, true, "Lås-indstillingen");
    const overwriteExistingPurchasePrice = getBoolean(
      body.overwriteExistingPurchasePrice,
      false,
      "Overskrivelsesindstillingen"
    );

    if (!Array.isArray(body.cards)) {
      throw new RequestError("Kortlisten har et ugyldigt format.");
    }

    if (body.cards.length < 1) {
      throw new RequestError("Vælg mindst ét kort til købslottet.");
    }

    if (body.cards.length > 5000) {
      throw new RequestError(
        "Et købslot kan højst indeholde 5.000 kort."
      );
    }

    const cards = body.cards.map(normalizeCard);
    const uniqueCardIds = new Set(cards.map((card) => card.cardId));

    if (uniqueCardIds.size !== cards.length) {
      throw new RequestError(
        "Det samme kort må kun tilføjes én gang til købslottet."
      );
    }

    if (
      allocationMethod === "manual" &&
      cards.some((card) => card.manualAllocatedCost === null)
    ) {
      throw new RequestError(
        "Manuel fordeling kræver en manuel kostpris for hvert kort."
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new RequestError(
        "Du skal være logget ind for at oprette et købslot.",
        401
      );
    }

    const { data, error } = await supabase.rpc("create_purchase_lot", {
      p_name: name,
      p_allocation_method: allocationMethod,
      p_source: source,
      p_seller: seller,
      p_purchase_reference: purchaseReference,
      p_purchased_at: purchasedAt,
      p_currency: currency,
      p_purchase_amount: purchaseAmount,
      p_buyer_fee: buyerFee,
      p_shipping_cost: shippingCost,
      p_taxes: taxes,
      p_other_costs: otherCosts,
      p_notes: notes,
      p_cards: cards,
      p_lock: lock,
      p_overwrite_existing_purchase_price: overwriteExistingPurchasePrice,
    });

    if (error) {
      console.error("create_purchase_lot failed:", error);
      throw new RequestError(
        error.message || "Købslottet kunne ikke oprettes.",
        getRpcErrorStatus(error)
      );
    }

    const row = ((data ?? []) as CreatePurchaseLotRpcRow[])[0];

    if (!row) {
      throw new RequestError(
        "Databasen returnerede ikke en bekræftelse på købslottet.",
        500
      );
    }

    return NextResponse.json({
      success: true,
      lotId: row.lot_id,
      status: row.lot_status,
      cardCount: getResultInteger(row.card_count, "antallet af kort"),
      totalCost: getResultNumber(row.total_cost, "den samlede kostpris"),
      allocatedTotal: getResultNumber(
        row.allocated_total,
        "det fordelte totalbeløb"
      ),
      message: row.result_message,
    });
  } catch (error) {
    console.error("Error in create purchase lot route:", error);

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