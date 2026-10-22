export type AiFeature = "card_identification" | "market_valuation";

export type AiUsageAllowance = {
  feature: AiFeature;
  planCode: string;
  planName: string;
  monthlyLimit: number | null;
  used: number;
  remaining: number | null;
  periodStart: string;
  periodEnd: string;
};

export type AiUsageReservation = {
  id: string;
  allowance: AiUsageAllowance;
};

export type AiUsageReservationDecision = {
  reservationId: string | null;
  allowed: boolean;
  reason: string;
  reservationState: string;
  allowance: AiUsageAllowance | null;
};

type ReservationRow = {
  reservation_id?: unknown;
  allowed?: unknown;
  reason?: unknown;
  reservation_state?: unknown;
  plan_code?: unknown;
  plan_name?: unknown;
  monthly_limit?: unknown;
  used?: unknown;
  remaining?: unknown;
  period_start?: unknown;
  period_end?: unknown;
};

function nullableNonNegativeInteger(value: unknown) {
  if (value === null) {
    return null;
  }

  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
}

function isIsoDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !Number.isNaN(new Date(value).getTime())
  );
}

export function parseAiUsageReservationDecision(
  value: unknown,
  feature: AiFeature
): AiUsageReservationDecision {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("AI usage reservation returned an invalid response.");
  }

  const row = value as ReservationRow;

  if (
    typeof row.allowed !== "boolean" ||
    typeof row.reason !== "string" ||
    typeof row.reservation_state !== "string" ||
    (row.reservation_id !== null && typeof row.reservation_id !== "string")
  ) {
    throw new Error("AI usage reservation returned incomplete data.");
  }

  const monthlyLimit = nullableNonNegativeInteger(row.monthly_limit);
  const used = nullableNonNegativeInteger(row.used);
  const remaining = nullableNonNegativeInteger(row.remaining);
  const hasAllowance =
    typeof row.plan_code === "string" &&
    typeof row.plan_name === "string" &&
    monthlyLimit !== undefined &&
    used !== undefined &&
    used !== null &&
    remaining !== undefined &&
    isIsoDate(row.period_start) &&
    isIsoDate(row.period_end);

  return {
    reservationId:
      typeof row.reservation_id === "string" ? row.reservation_id : null,
    allowed: row.allowed,
    reason: row.reason,
    reservationState: row.reservation_state,
    allowance: hasAllowance
      ? {
          feature,
          planCode: row.plan_code as string,
          planName: row.plan_name as string,
          monthlyLimit: monthlyLimit as number | null,
          used,
          remaining: remaining as number | null,
          periodStart: row.period_start as string,
          periodEnd: row.period_end as string,
        }
      : null,
  };
}

export function toPublicAiUsageAllowance(allowance: AiUsageAllowance | null) {
  if (!allowance) {
    return null;
  }

  return {
    feature: allowance.feature,
    planCode: allowance.planCode,
    planName: allowance.planName,
    monthlyLimit: allowance.monthlyLimit,
    used: allowance.used,
    remaining: allowance.remaining,
    periodStart: allowance.periodStart,
    periodEnd: allowance.periodEnd,
  };
}
