export type BillingUsageMetric = {
  limit: number | null;
  used: number;
  remaining: number | null;
};

export type BillingOverview = {
  planCode: string;
  planName: string;
  monthlyPriceDkkOre: number;
  subscriptionStatus: string;
  subscriptionProvider: string | null;
  storage: BillingUsageMetric;
  identification: BillingUsageMetric;
  valuation: BillingUsageMetric;
  periodStart: string;
  periodEnd: string;
};

export type PublicPlan = {
  code: string;
  displayName: string;
  monthlyPriceDkkOre: number;
  monthlyIdentificationLimit: number | null;
  monthlyValuationLimit: number | null;
  storageCardLimit: number | null;
};

type BillingOverviewRow = {
  plan_code?: unknown;
  plan_name?: unknown;
  monthly_price_dkk_ore?: unknown;
  subscription_status?: unknown;
  subscription_provider?: unknown;
  storage_card_limit?: unknown;
  stored_card_count?: unknown;
  identification_limit?: unknown;
  identification_used?: unknown;
  identification_remaining?: unknown;
  valuation_limit?: unknown;
  valuation_used?: unknown;
  valuation_remaining?: unknown;
  period_start?: unknown;
  period_end?: unknown;
};

type PublicPlanRow = {
  code?: unknown;
  display_name?: unknown;
  monthly_price_dkk_ore?: unknown;
  monthly_identification_limit?: unknown;
  monthly_valuation_limit?: unknown;
  storage_card_limit?: unknown;
};

function nonNegativeInteger(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }

  return value;
}

function nullableNonNegativeInteger(value: unknown, label: string) {
  return value === null ? null : nonNegativeInteger(value, label);
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value;
}

function nullableString(value: unknown, label: string) {
  if (value === null) {
    return null;
  }

  return requiredString(value, label);
}

function isoDate(value: unknown, label: string) {
  const date = requiredString(value, label);

  if (Number.isNaN(new Date(date).getTime())) {
    throw new Error(`${label} must be a valid date.`);
  }

  return date;
}

export function parseBillingOverview(value: unknown): BillingOverview {
  const row = Array.isArray(value) ? value[0] : value;

  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new Error("Billing overview returned an invalid response.");
  }

  const data = row as BillingOverviewRow;
  const storageLimit = nullableNonNegativeInteger(
    data.storage_card_limit,
    "Storage limit"
  );
  const storedCards = nonNegativeInteger(
    data.stored_card_count,
    "Stored card count"
  );

  return {
    planCode: requiredString(data.plan_code, "Plan code"),
    planName: requiredString(data.plan_name, "Plan name"),
    monthlyPriceDkkOre: nonNegativeInteger(
      data.monthly_price_dkk_ore,
      "Monthly price"
    ),
    subscriptionStatus: requiredString(
      data.subscription_status,
      "Subscription status"
    ),
    subscriptionProvider: nullableString(
      data.subscription_provider,
      "Subscription provider"
    ),
    storage: {
      limit: storageLimit,
      used: storedCards,
      remaining:
        storageLimit === null
          ? null
          : Math.max(storageLimit - storedCards, 0),
    },
    identification: {
      limit: nullableNonNegativeInteger(
        data.identification_limit,
        "Identification limit"
      ),
      used: nonNegativeInteger(
        data.identification_used,
        "Identification usage"
      ),
      remaining: nullableNonNegativeInteger(
        data.identification_remaining,
        "Identification remaining"
      ),
    },
    valuation: {
      limit: nullableNonNegativeInteger(
        data.valuation_limit,
        "Valuation limit"
      ),
      used: nonNegativeInteger(data.valuation_used, "Valuation usage"),
      remaining: nullableNonNegativeInteger(
        data.valuation_remaining,
        "Valuation remaining"
      ),
    },
    periodStart: isoDate(data.period_start, "Period start"),
    periodEnd: isoDate(data.period_end, "Period end"),
  };
}

export function parsePublicPlans(value: unknown): PublicPlan[] {
  if (!Array.isArray(value)) {
    throw new Error("Public plans returned an invalid response.");
  }

  return value.map((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error(`Public plan ${index + 1} is invalid.`);
    }

    const data = row as PublicPlanRow;

    return {
      code: requiredString(data.code, "Plan code"),
      displayName: requiredString(data.display_name, "Plan name"),
      monthlyPriceDkkOre: nonNegativeInteger(
        data.monthly_price_dkk_ore,
        "Monthly price"
      ),
      monthlyIdentificationLimit: nullableNonNegativeInteger(
        data.monthly_identification_limit,
        "Identification limit"
      ),
      monthlyValuationLimit: nullableNonNegativeInteger(
        data.monthly_valuation_limit,
        "Valuation limit"
      ),
      storageCardLimit: nullableNonNegativeInteger(
        data.storage_card_limit,
        "Storage limit"
      ),
    };
  });
}

export function isCardLimitError(message: string) {
  return message.includes("VALLECTIVE_CARD_LIMIT_REACHED");
}
