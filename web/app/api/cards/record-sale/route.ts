import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type RecordSaleRequest = {
  cardId?: unknown;

  salePrice?: unknown;

  shippingIncome?: unknown;

  platformFee?: unknown;

  paymentFee?: unknown;

  shippingCost?: unknown;

  otherCosts?: unknown;

  platform?: unknown;

  buyer?: unknown;

  reference?: unknown;

  notes?: unknown;

  soldAt?: unknown;
};

type RecordSaleRpcRow = {
  transaction_id: string;

  sold_card_id: string;

  new_state: string;

  transaction_currency: string;

  gross_amount:
    | number
    | string;

  net_proceeds:
    | number
    | string;

  cost_basis:
    | number
    | string;

  realized_profit:
    | number
    | string;

  result_message: string;
};

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

function normalizeNumberString(
  value: string
) {
  let normalizedValue = value
    .trim()
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");

  const lastComma =
    normalizedValue.lastIndexOf(",");

  const lastDot =
    normalizedValue.lastIndexOf(".");

  if (
    lastComma >= 0 &&
    lastDot >= 0
  ) {
    if (lastComma > lastDot) {
      /*
       * Eksempel:
       * 1.250,50 → 1250.50
       */
      normalizedValue =
        normalizedValue
          .replace(/\./g, "")
          .replace(/,/g, ".");
    } else {
      /*
       * Eksempel:
       * 1,250.50 → 1250.50
       */
      normalizedValue =
        normalizedValue.replace(
          /,/g,
          ""
        );
    }
  } else if (lastComma >= 0) {
    /*
     * Eksempel:
     * 250,50 → 250.50
     */
    normalizedValue =
      normalizedValue.replace(
        /,/g,
        "."
      );
  }

  return normalizedValue;
}

function getMoneyValue(
  value: unknown,
  label: string,
  {
    required = false,
    mustBePositive = false,
  }: {
    required?: boolean;
    mustBePositive?: boolean;
  } = {}
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    if (required) {
      throw new RequestError(
        `${label} mangler.`
      );
    }

    return 0;
  }

  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    throw new RequestError(
      `${label} skal være et tal.`
    );
  }

  const normalizedValue =
    typeof value === "string"
      ? normalizeNumberString(
          value
        )
      : value;

  if (
    normalizedValue === ""
  ) {
    if (required) {
      throw new RequestError(
        `${label} mangler.`
      );
    }

    return 0;
  }

  const parsedValue =
    Number(normalizedValue);

  if (
    !Number.isFinite(
      parsedValue
    )
  ) {
    throw new RequestError(
      `${label} skal være et gyldigt tal.`
    );
  }

  if (
    mustBePositive &&
    parsedValue <= 0
  ) {
    throw new RequestError(
      `${label} skal være større end 0.`
    );
  }

  if (
    !mustBePositive &&
    parsedValue < 0
  ) {
    throw new RequestError(
      `${label} kan ikke være negativ.`
    );
  }

  return Math.round(
    (parsedValue +
      Number.EPSILON) *
      100
  ) / 100;
}

function getOptionalDateTime(
  value: unknown
): string | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (typeof value !== "string") {
    throw new RequestError(
      "Salgsdatoen er ugyldig."
    );
  }

  const normalizedValue =
    value.trim();

  if (!normalizedValue) {
    return null;
  }

  const date =
    new Date(normalizedValue);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new RequestError(
      "Salgsdatoen er ugyldig."
    );
  }

  return date.toISOString();
}

function getRequiredResultNumber(
  value: unknown,
  label: string
) {
  const parsedValue =
    Number(value);

  if (
    !Number.isFinite(
      parsedValue
    )
  ) {
    throw new RequestError(
      `Salget blev registreret, men ${label} kunne ikke læses korrekt.`,
      500
    );
  }

  return parsedValue;
}

function getRpcErrorStatus(
  error: {
    code?: string | null;
    message: string;
  }
) {
  const normalizedMessage =
    error.message.toLowerCase();

  if (
    error.code === "23505" ||
    normalizedMessage.includes(
      "allerede"
    )
  ) {
    return 409;
  }

  if (
    normalizedMessage.includes(
      "ikke fundet"
    ) ||
    normalizedMessage.includes(
      "ikke adgang"
    )
  ) {
    return 404;
  }

  if (
    normalizedMessage.includes(
      "logget ind"
    )
  ) {
    return 401;
  }

  if (
    error.code === "P0001"
  ) {
    return 400;
  }

  return 500;
}

function getErrorMessage(
  error: unknown
) {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return "Der opstod en ukendt fejl.";
}

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as RecordSaleRequest;

    const cardId =
      getRequiredString(
        body.cardId,
        "Kort-ID"
      );

    const salePrice =
      getMoneyValue(
        body.salePrice,
        "Salgsprisen",
        {
          required: true,
          mustBePositive: true,
        }
      );

    const shippingIncome =
      getMoneyValue(
        body.shippingIncome,
        "Fragt betalt af køber"
      );

    const platformFee =
      getMoneyValue(
        body.platformFee,
        "Platformgebyret"
      );

    const paymentFee =
      getMoneyValue(
        body.paymentFee,
        "Betalingsgebyret"
      );

    const shippingCost =
      getMoneyValue(
        body.shippingCost,
        "Fragtudgiften"
      );

    const otherCosts =
      getMoneyValue(
        body.otherCosts,
        "Øvrige omkostninger"
      );

    const platform =
      getOptionalString(
        body.platform
      );

    const buyer =
      getOptionalString(
        body.buyer
      );

    const reference =
      getOptionalString(
        body.reference
      );

    const notes =
      getOptionalString(
        body.notes
      );

    const soldAt =
      getOptionalDateTime(
        body.soldAt
      );

    const supabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      throw new RequestError(
        "Du skal være logget ind for at registrere et salg.",
        401
      );
    }

    const {
      data,
      error,
    } = await supabase.rpc(
      "record_card_sale",
      {
        p_card_id:
          cardId,

        p_sale_price:
          salePrice,

        p_shipping_income:
          shippingIncome,

        p_platform_fee:
          platformFee,

        p_payment_fee:
          paymentFee,

        p_shipping_cost:
          shippingCost,

        p_other_costs:
          otherCosts,

        p_platform:
          platform,

        p_buyer:
          buyer,

        p_reference:
          reference,

        p_notes:
          notes,

        p_sold_at:
          soldAt,
      }
    );

    if (error) {
      console.error(
        "record_card_sale fejlede:",
        error
      );

      throw new RequestError(
        error.message ||
          "Salget kunne ikke registreres.",
        getRpcErrorStatus(
          error
        )
      );
    }

    const saleRows =
      (data ??
        []) as RecordSaleRpcRow[];

    const sale =
      saleRows[0];

    if (!sale) {
      throw new RequestError(
        "Databasen returnerede ikke en bekræftelse på salget.",
        500
      );
    }

    const grossAmount =
      getRequiredResultNumber(
        sale.gross_amount,
        "bruttobeløbet"
      );

    const netProceeds =
      getRequiredResultNumber(
        sale.net_proceeds,
        "nettobeløbet"
      );

    const costBasis =
      getRequiredResultNumber(
        sale.cost_basis,
        "kostprisen"
      );

    const realizedProfit =
      getRequiredResultNumber(
        sale.realized_profit,
        "den realiserede gevinst"
      );

    return NextResponse.json({
      success: true,

      transactionId:
        sale.transaction_id,

      cardId:
        sale.sold_card_id,

      state:
        sale.new_state,

      currency:
        sale.transaction_currency,

      grossAmount,

      netProceeds,

      costBasis,

      realizedProfit,

      message:
        sale.result_message,
    });
  } catch (error) {
    console.error(
      "Fejl i record-sale route:",
      error
    );

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
            ? "Salgsoplysningerne havde et ugyldigt format."
            : getErrorMessage(
                error
              ),
      },
      {
        status,
      }
    );
  }
}