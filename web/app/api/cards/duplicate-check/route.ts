import { NextResponse } from "next/server";

import {
  hasDuplicateCheckIdentity,
  type DuplicateCardIdentity,
} from "@/lib/cards/duplicateCards";
import { findDuplicateCards } from "@/lib/cards/findDuplicateCards";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type DuplicateCheckRequest = {
  card?: unknown;
};

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function optionalText(value: unknown) {
  return typeof value === "string" &&
    value.trim()
    ? value.trim().slice(0, 250)
    : null;
}

function getIdentity(
  value: unknown
): DuplicateCardIdentity {
  if (!isRecord(value)) {
    throw new Error(
      "Kortets identitet mangler."
    );
  }

  return {
    playerName: optionalText(value.playerName),
    year: optionalText(value.year),
    manufacturer: optionalText(
      value.manufacturer
    ),
    brand: optionalText(value.brand),
    product: optionalText(value.product),
    setName: optionalText(value.setName),
    cardNumber: optionalText(
      value.cardNumber
    ),
    parallel: optionalText(value.parallel),
    serialNumber: optionalText(
      value.serialNumber
    ),
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Dubletkontrollen kunne ikke gennemføres.";
}

export async function POST(request: Request) {
  let identity: DuplicateCardIdentity;

  try {
    const body =
      (await request.json()) as DuplicateCheckRequest;
    identity = getIdentity(body.card);
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(error),
      },
      {
        status: 400,
      }
    );
  }

  try {
    if (!hasDuplicateCheckIdentity(identity)) {
      return NextResponse.json({
        matches: [],
        requiresAcknowledgement: false,
      });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error:
            "Du skal være logget ind for at kontrollere dubletter.",
        },
        {
          status: 401,
        }
      );
    }

    const result = await findDuplicateCards(
      supabase,
      user.id,
      identity
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "Fejl i duplicate-check route:",
      error
    );

    return NextResponse.json(
      {
        error: getErrorMessage(error),
      },
      {
        status: 500,
      }
    );
  }
}
