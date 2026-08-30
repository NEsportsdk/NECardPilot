import { describe, expect, it } from "vitest";

import {
  calculateModelUsage,
  createIdentificationUsage,
} from "./identificationUsage";

describe("identification usage", () => {
  it("calculates per-model token cost with the pinned pricing version", () => {
    expect(
      calculateModelUsage({
        model: "gpt-4.1",
        inputTokens: 2_000,
        outputTokens: 500,
      })
    ).toEqual({
      model: "gpt-4.1",
      inputTokens: 2_000,
      outputTokens: 500,
      totalTokens: 2_500,
      estimatedCostUsd: 0.008,
    });
  });

  it("includes web search calls in the complete identification estimate", () => {
    const usage = createIdentificationUsage({
      modelCalls: [
        calculateModelUsage({
          model: "gpt-4.1-mini",
          inputTokens: 1_000,
          outputTokens: 250,
        }),
        calculateModelUsage({
          model: "gpt-5.6",
          inputTokens: 2_000,
          outputTokens: 500,
        }),
      ],
      webSearchCalls: 1,
      note: "Test estimate",
    });

    expect(usage).toMatchObject({
      inputTokens: 3_000,
      outputTokens: 750,
      totalTokens: 3_750,
      webSearchCalls: 1,
      estimatedCostUsd: 0.0288,
      pricingVersion: "2026-08-30",
    });
  });
});
