import { describe, expect, it } from "vitest";

import { parseAiUsageReservationDecision } from "./aiUsage";
import { estimateMarketValuationCostUsd } from "./aiPricing";

describe("AI usage guardrails", () => {
  it("parses an allowed reservation and its remaining allowance", () => {
    expect(
      parseAiUsageReservationDecision(
        {
          reservation_id: "4f86ae65-cc6a-4a6a-882f-552b7a49d09d",
          allowed: true,
          reason: "reserved",
          reservation_state: "created",
          plan_code: "collector",
          plan_name: "Collector",
          monthly_limit: 25,
          used: 7,
          remaining: 18,
          period_start: "2026-10-01T00:00:00.000Z",
          period_end: "2026-11-01T00:00:00.000Z",
        },
        "card_identification"
      )
    ).toMatchObject({
      allowed: true,
      allowance: {
        feature: "card_identification",
        planCode: "collector",
        monthlyLimit: 25,
        used: 7,
        remaining: 18,
      },
    });
  });

  it("supports an unlimited internal allowance", () => {
    const result = parseAiUsageReservationDecision(
      {
        reservation_id: "4f86ae65-cc6a-4a6a-882f-552b7a49d09d",
        allowed: true,
        reason: "reserved",
        reservation_state: "created",
        plan_code: "internal",
        plan_name: "Vallective Internal",
        monthly_limit: null,
        used: 101,
        remaining: null,
        period_start: "2026-10-01T00:00:00.000Z",
        period_end: "2026-11-01T00:00:00.000Z",
      },
      "market_valuation"
    );

    expect(result.allowance?.monthlyLimit).toBeNull();
    expect(result.allowance?.remaining).toBeNull();
  });

  it("estimates market research cost from tokens and web searches", () => {
    expect(
      estimateMarketValuationCostUsd({
        inputTokens: 20_000,
        outputTokens: 5_000,
        webSearchCalls: 3,
      })
    ).toBe(0.13);
  });
});
