export const IDENTIFICATION_PRICING_VERSION = "2026-08-30";
export const DEFAULT_IDENTIFICATION_COST_USD = 0.04;

const MODEL_PRICING_USD_PER_MILLION_TOKENS = {
  "gpt-4.1-mini": {
    input: 0.4,
    output: 1.6,
  },
  "gpt-4.1": {
    input: 2,
    output: 8,
  },
  "gpt-5.6": {
    input: 4,
    output: 20,
  },
} as const;

const WEB_SEARCH_COST_USD_PER_CALL = 0.01;

export type IdentificationModel = keyof typeof MODEL_PRICING_USD_PER_MILLION_TOKENS;

export type IdentificationModelUsage = {
  model: IdentificationModel;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
};

export type IdentificationUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd?: number;
  modelCalls?: IdentificationModelUsage[];
  webSearchCalls?: number;
  pricingVersion?: string;
  note?: string;
};

function roundUsd(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function calculateModelUsage({
  model,
  inputTokens,
  outputTokens,
}: {
  model: IdentificationModel;
  inputTokens: number;
  outputTokens: number;
}): IdentificationModelUsage {
  const safeInputTokens = Math.max(0, Math.round(inputTokens));
  const safeOutputTokens = Math.max(0, Math.round(outputTokens));
  const pricing = MODEL_PRICING_USD_PER_MILLION_TOKENS[model];
  const estimatedCostUsd =
    (safeInputTokens * pricing.input + safeOutputTokens * pricing.output) /
    1_000_000;

  return {
    model,
    inputTokens: safeInputTokens,
    outputTokens: safeOutputTokens,
    totalTokens: safeInputTokens + safeOutputTokens,
    estimatedCostUsd: roundUsd(estimatedCostUsd),
  };
}

export function createIdentificationUsage({
  modelCalls,
  webSearchCalls,
  note,
}: {
  modelCalls: IdentificationModelUsage[];
  webSearchCalls: number;
  note: string;
}): IdentificationUsage {
  const safeWebSearchCalls = Math.max(0, Math.round(webSearchCalls));
  const inputTokens = modelCalls.reduce(
    (total, call) => total + call.inputTokens,
    0
  );
  const outputTokens = modelCalls.reduce(
    (total, call) => total + call.outputTokens,
    0
  );
  const modelCost = modelCalls.reduce(
    (total, call) => total + call.estimatedCostUsd,
    0
  );

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    estimatedCostUsd: roundUsd(
      modelCost + safeWebSearchCalls * WEB_SEARCH_COST_USD_PER_CALL
    ),
    modelCalls,
    webSearchCalls: safeWebSearchCalls,
    pricingVersion: IDENTIFICATION_PRICING_VERSION,
    note,
  };
}

export function getIdentificationCostUsd(
  usage:
    | Pick<IdentificationUsage, "estimatedCostUsd">
    | null
    | undefined
) {
  return usage?.estimatedCostUsd ?? null;
}
