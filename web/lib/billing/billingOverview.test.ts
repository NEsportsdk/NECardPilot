import { describe, expect, it } from "vitest";

import {
  isCardLimitError,
  parseBillingOverview,
  parsePublicPlans,
} from "./billingOverview";

describe("billing overview", () => {
  it("parses plan, card capacity and monthly AI usage", () => {
    expect(
      parseBillingOverview([
        {
          plan_code: "collector",
          plan_name: "Collector",
          monthly_price_dkk_ore: 9900,
          subscription_status: "active",
          subscription_provider: "stripe",
          storage_card_limit: 2000,
          stored_card_count: 125,
          identification_limit: 25,
          identification_used: 7,
          identification_remaining: 18,
          valuation_limit: 5,
          valuation_used: 2,
          valuation_remaining: 3,
          period_start: "2026-10-01T00:00:00.000Z",
          period_end: "2026-11-01T00:00:00.000Z",
        },
      ])
    ).toMatchObject({
      planCode: "collector",
      subscriptionProvider: "stripe",
      storage: { limit: 2000, used: 125, remaining: 1875 },
      identification: { limit: 25, used: 7, remaining: 18 },
      valuation: { limit: 5, used: 2, remaining: 3 },
    });
  });

  it("supports uncapped plan metrics", () => {
    const overview = parseBillingOverview({
      plan_code: "internal",
      plan_name: "Vallective Internal",
      monthly_price_dkk_ore: 0,
      subscription_status: "active",
      subscription_provider: "manual",
      storage_card_limit: null,
      stored_card_count: 450,
      identification_limit: null,
      identification_used: 80,
      identification_remaining: null,
      valuation_limit: null,
      valuation_used: 4,
      valuation_remaining: null,
      period_start: "2026-10-01T00:00:00.000Z",
      period_end: "2026-11-01T00:00:00.000Z",
    });

    expect(overview.storage.remaining).toBeNull();
    expect(overview.identification.remaining).toBeNull();
  });

  it("parses public plans and recognizes the database limit marker", () => {
    expect(
      parsePublicPlans([
        {
          code: "free",
          display_name: "Free",
          monthly_price_dkk_ore: 0,
          monthly_identification_limit: 5,
          monthly_valuation_limit: 2,
          storage_card_limit: 100,
        },
      ])
    ).toEqual([
      {
        code: "free",
        displayName: "Free",
        monthlyPriceDkkOre: 0,
        monthlyIdentificationLimit: 5,
        monthlyValuationLimit: 2,
        storageCardLimit: 100,
      },
    ]);

    expect(
      isCardLimitError(
        "new row rejected: VALLECTIVE_CARD_LIMIT_REACHED"
      )
    ).toBe(true);
  });
});
