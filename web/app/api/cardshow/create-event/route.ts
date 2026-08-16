import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type CreateCardshowEventRequest = {
  name?: unknown;
  venue?: unknown;
  city?: unknown;
  address?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  currency?: unknown;
  paymentMethods?: unknown;
  boothFee?: unknown;
  travelCost?: unknown;
  accommodationCost?: unknown;
  foodCost?: unknown;
  otherEventCosts?: unknown;
  notes?: unknown;
};

type CreateCardshowEventRpcRow = {
  event_id: string;
  event_status: string;
  event_cost_total: number | string;
  result_message: string;
};

const PAYMENT_METHODS = new Set([
  "cash",
  "mobilepay",
  "card",
  "bank_transfer",
  "paypal",
  "other",
]);

class RequestError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "RequestError";
    this.status = status;
  }
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
    throw new RequestError(
      `${label} må højst være ${maxLength} tegn.`
    );
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
    throw new RequestError(
      `${label} må højst være ${maxLength} tegn.`
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

function getMoneyValue(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  if (typeof value !== "string" && typeof value !== "number") {
    throw new RequestError(`${label} skal være et tal.`);
  }

  const normalizedValue =
    typeof value === "string" ? normalizeNumberString(value) : value;

  if (normalizedValue === "") {
    return 0;
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

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  const date = new Date(normalizedValue);

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

function getPaymentMethods(value: unknown) {
  if (value === null || value === undefined) {
    return ["cash", "mobilepay", "card", "other"];
  }

  if (!Array.isArray(value)) {
    throw new RequestError("Betalingsformerne har et ugyldigt format.");
  }

  const methods = Array.from(
    new Set(
      value.map((method) => {
        if (typeof method !== "string") {
          throw new RequestError(
            "En eller flere betalingsformer er ugyldige."
          );
        }

        return method.trim().toLowerCase();
      })
    )
  ).filter(Boolean);

  if (methods.length === 0) {
    return ["cash", "mobilepay", "card", "other"];
  }

  if (methods.some((method) => !PAYMENT_METHODS.has(method))) {
    throw new RequestError(
      "En eller flere betalingsformer er ugyldige."
    );
  }

  return methods;
}

function getResultNumber(value: unknown, label: string) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw new RequestError(
      `Cardshowet blev oprettet, men ${label} kunne ikke læses korrekt.`,
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
    const body = (await request.json()) as CreateCardshowEventRequest;

    const name = getRequiredString(body.name, "Cardshow-navnet", 160);
    const venue = getOptionalString(body.venue, "Venue", 200);
    const city = getOptionalString(body.city, "By", 120);
    const address = getOptionalString(body.address, "Adresse", 300);
    const startsAt = getOptionalDateTime(body.startsAt, "Starttidspunktet");
    const endsAt = getOptionalDateTime(body.endsAt, "Sluttidspunktet");
    const currency = getCurrency(body.currency);
    const paymentMethods = getPaymentMethods(body.paymentMethods);
    const boothFee = getMoneyValue(body.boothFee, "Standlejen");
    const travelCost = getMoneyValue(body.travelCost, "Transportudgiften");
    const accommodationCost = getMoneyValue(
      body.accommodationCost,
      "Overnatningsudgiften"
    );
    const foodCost = getMoneyValue(body.foodCost, "Madudgiften");
    const otherEventCosts = getMoneyValue(
      body.otherEventCosts,
      "De øvrige eventomkostninger"
    );
    const notes = getOptionalString(body.notes, "Noterne", 5000);

    if (
      startsAt &&
      endsAt &&
      new Date(endsAt).getTime() < new Date(startsAt).getTime()
    ) {
      throw new RequestError(
        "Sluttidspunktet kan ikke ligge før starttidspunktet."
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new RequestError(
        "Du skal være logget ind for at oprette et cardshow.",
        401
      );
    }

    const { data, error } = await supabase.rpc("create_cardshow_event", {
      p_name: name,
      p_venue: venue,
      p_city: city,
      p_address: address,
      p_starts_at: startsAt,
      p_ends_at: endsAt,
      p_currency: currency,
      p_payment_methods: paymentMethods,
      p_booth_fee: boothFee,
      p_travel_cost: travelCost,
      p_accommodation_cost: accommodationCost,
      p_food_cost: foodCost,
      p_other_event_costs: otherEventCosts,
      p_notes: notes,
    });

    if (error) {
      console.error("create_cardshow_event failed:", error);
      throw new RequestError(
        error.message || "Cardshowet kunne ikke oprettes.",
        getRpcErrorStatus(error)
      );
    }

    const row = ((data ?? []) as CreateCardshowEventRpcRow[])[0];

    if (!row) {
      throw new RequestError(
        "Databasen returnerede ikke en bekræftelse på cardshowet.",
        500
      );
    }

    return NextResponse.json({
      success: true,
      eventId: row.event_id,
      status: row.event_status,
      eventCostTotal: getResultNumber(
        row.event_cost_total,
        "eventets samlede omkostning"
      ),
      message: row.result_message,
    });
  } catch (error) {
    console.error("Error in create cardshow event route:", error);

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
            ? "Cardshow-oplysningerne havde et ugyldigt format."
            : getErrorMessage(error),
      },
      { status }
    );
  }
}