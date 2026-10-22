export const AI_PRICING_VERSION = "2026-10-22";

const MARKET_INPUT_USD_PER_MILLION_TOKENS = 2;
const MARKET_OUTPUT_USD_PER_MILLION_TOKENS = 12;
const WEB_SEARCH_USD_PER_CALL = 0.01;

function roundUsd(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function estimateMarketValuationCostUsd({
  inputTokens,
  outputTokens,
  webSearchCalls,
}: {
  inputTokens: number | null;
  outputTokens: number | null;
  webSearchCalls: number;
}) {
  const safeInputTokens = Math.max(0, Math.round(inputTokens ?? 0));
  const safeOutputTokens = Math.max(0, Math.round(outputTokens ?? 0));
  const safeWebSearchCalls = Math.max(0, Math.round(webSearchCalls));

  return roundUsd(
    (safeInputTokens * MARKET_INPUT_USD_PER_MILLION_TOKENS +
      safeOutputTokens * MARKET_OUTPUT_USD_PER_MILLION_TOKENS) /
      1_000_000 +
      safeWebSearchCalls * WEB_SEARCH_USD_PER_CALL
  );
}
