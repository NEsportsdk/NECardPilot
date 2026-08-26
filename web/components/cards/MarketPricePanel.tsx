"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getMarketPrice,
  type GetMarketPriceResult,
  type MarketPriceComparable,
} from "@/lib/market/getMarketPrice";

export type InitialMarketPriceSnapshot = {
  estimatedValue: number | null;

  lowValue: number | null;

  highValue: number | null;

  confidenceScore: number | null;

  currency: string | null;

  updatedAt: string | null;
};

type MarketPricePanelProps = {
  cardId: string;

  currency?: string;

  manualEstimate: number | null;

  purchasePrice: number | null;

  initialMarketPrice?:
    | InitialMarketPriceSnapshot
    | null;

  onUpdated?: (
    result: GetMarketPriceResult
  ) => void;
};

function formatCurrency(
  value: number | null,
  currency: string
) {
  if (value === null) {
    return "—";
  }

  if (currency === "DKK") {
    return `${value.toLocaleString(
      "da-DK",
      {
        minimumFractionDigits:
          value % 1 === 0 ? 0 : 2,

        maximumFractionDigits: 2,
      }
    )} kr.`;
  }

  return new Intl.NumberFormat(
    "da-DK",
    {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }
  ).format(value);
}

function formatDateTime(
  value: string | null
) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(
    "da-DK",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}

function formatShortDate(
  value: string | null
) {
  if (!value) {
    return "Date unknown";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Date unknown";
  }

  return new Intl.DateTimeFormat(
    "da-DK",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}

function formatPercentage(
  value: number | null
) {
  if (value === null) {
    return "—";
  }

  return `${value.toLocaleString(
    "da-DK",
    {
      maximumFractionDigits: 1,
    }
  )}%`;
}

function getEvidenceTypeLabel(
  evidenceType:
    MarketPriceComparable["evidenceType"]
) {
  switch (evidenceType) {
    case "sold":
      return "Sold";

    case "accepted_offer":
      return "Accepted offer";

    case "asking":
      return "Asking price";

    case "market_index":
      return "Market index";

    case "manual":
      return "Manual evidence";

    default:
      return "Price evidence";
  }
}

function getConditionLabel(
  subjectCondition: string
) {
  switch (subjectCondition) {
    case "raw":
      return "RAW";

    case "graded":
      return "Graded";

    default:
      return "Condition unknown";
  }
}

function getConfidenceLabel(
  confidence: number | null
) {
  if (confidence === null) {
    return "Not calculated";
  }

  if (confidence >= 90) {
    return "High confidence";
  }

  if (confidence >= 70) {
    return "Medium confidence";
  }

  return "Low confidence";
}

function getConfidenceTone(
  confidence: number | null
) {
  if (confidence === null) {
    return "neutral";
  }

  if (confidence >= 90) {
    return "high";
  }

  if (confidence >= 70) {
    return "medium";
  }

  return "low";
}

function getSafeHttpUrl(
  value: string
) {
  try {
    const url = new URL(value);

    if (
      url.protocol !== "https:" &&
      url.protocol !== "http:"
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function getReadableError(
  error: unknown
) {
  if (
    error instanceof DOMException &&
    error.name === "AbortError"
  ) {
    return null;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Markedsprisen kunne ikke beregnes. Prøv igen.";
}

export default function MarketPricePanel({
  cardId,
  currency = "DKK",
  manualEstimate,
  purchasePrice,
  initialMarketPrice = null,
  onUpdated,
}: MarketPricePanelProps) {
  const [
    result,
    setResult,
  ] =
    useState<GetMarketPriceResult | null>(
      null
    );

  const [
    isLoading,
    setIsLoading,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null
  );

  const [
    showAllComparables,
    setShowAllComparables,
  ] = useState(false);

  const [
    showRefreshConfirmation,
    setShowRefreshConfirmation,
  ] = useState(false);

  const activeRequestRef =
    useRef<AbortController | null>(
      null
    );

  useEffect(() => {
    setResult(null);
    setIsLoading(false);
    setErrorMessage(null);
    setShowAllComparables(false);
    setShowRefreshConfirmation(false);

    activeRequestRef.current?.abort();
    activeRequestRef.current = null;
  }, [cardId]);

  useEffect(() => {
    return () => {
      activeRequestRef.current?.abort();
    };
  }, []);

  const marketCurrency =
    result?.estimate.currency ??
    initialMarketPrice?.currency ??
    currency;

  const marketEstimate =
    result?.estimate.estimatedValue ??
    initialMarketPrice?.estimatedValue ??
    null;

  const marketLow =
    result?.estimate.lowValue ??
    initialMarketPrice?.lowValue ??
    null;

  const marketHigh =
    result?.estimate.highValue ??
    initialMarketPrice?.highValue ??
    null;

  const marketConfidence =
    result?.estimate.confidenceScore ??
    initialMarketPrice?.confidenceScore ??
    null;

  const marketUpdatedAt =
    result?.estimate.dataAsOf ??
    result?.estimate.updatedAt ??
    initialMarketPrice?.updatedAt ??
    null;

  const hasMarketEstimate =
    marketEstimate !== null;

  const comparables = useMemo(
    () => result?.comparables ?? [],
    [result?.comparables]
  );

  const includedComparables =
    useMemo(
      () =>
        comparables
          .filter(
            (comparable) =>
              comparable.included
          )
          .sort((first, second) => {
            const firstDate =
              first.soldAt
                ? new Date(
                    first.soldAt
                  ).getTime()
                : 0;

            const secondDate =
              second.soldAt
                ? new Date(
                    second.soldAt
                  ).getTime()
                : 0;

            return (
              secondDate -
              firstDate
            );
          }),
      [comparables]
    );

  const excludedComparables =
    useMemo(
      () =>
        comparables
          .filter(
            (comparable) =>
              !comparable.included
          )
          .sort(
            (first, second) =>
              (second.matchScore ??
                0) -
              (first.matchScore ??
                0)
          ),
      [comparables]
    );

  const visibleComparables =
    showAllComparables
      ? [
          ...includedComparables,
          ...excludedComparables,
        ]
      : includedComparables.length >
          0
        ? includedComparables
        : comparables;

  const differenceFromManual =
    marketEstimate !== null &&
    manualEstimate !== null
      ? marketEstimate -
        manualEstimate
      : null;

  const differenceFromCost =
    marketEstimate !== null &&
    purchasePrice !== null
      ? marketEstimate -
        purchasePrice
      : null;

  const marketRoi =
    differenceFromCost !== null &&
    purchasePrice !== null &&
    purchasePrice > 0
      ? (
          differenceFromCost /
          purchasePrice
        ) * 100
      : null;

  const confidenceTone =
    getConfidenceTone(
      marketConfidence
    );

  const canRefresh =
    hasMarketEstimate &&
    !isLoading;

  const hasResearchDetails =
    result !== null;

  const primaryButtonLabel =
    hasMarketEstimate
      ? "Load research details"
      : "Find market value";

  const researchWarnings =
    result?.estimate.warnings ?? [];

  const valuationNotes =
    result?.estimate.valuationNotes ??
    [];

  const sourceUrls =
    result?.estimate.sourceUrls ?? [];

  const loadMarketPrice =
    useCallback(
      async (force: boolean) => {
        activeRequestRef.current?.abort();

        const controller =
          new AbortController();

        activeRequestRef.current =
          controller;

        setIsLoading(true);
        setErrorMessage(null);
        setShowRefreshConfirmation(
          false
        );

        try {
          const nextResult =
            await getMarketPrice({
              cardId,
              force,
              signal:
                controller.signal,
            });

          setResult(nextResult);
          setShowAllComparables(false);

          onUpdated?.(
            nextResult
          );
        } catch (error) {
          const message =
            getReadableError(error);

          if (message) {
            setErrorMessage(
              message
            );
          }
        } finally {
          if (
            activeRequestRef.current ===
            controller
          ) {
            activeRequestRef.current =
              null;

            setIsLoading(false);
          }
        }
      },
      [
        cardId,
        onUpdated,
      ]
    );

  return (
    <section className="market-panel">
      <header className="market-header">
        <div>
          <span className="market-eyebrow">
            MARKET INTELLIGENCE
          </span>

          <h2>
            Automatic market value
          </h2>

          <p>
            NECardPilot researches price
            evidence for the exact card,
            filters mismatched listings
            and calculates a weighted
            market estimate.
          </p>
        </div>

        <div className="market-header-actions">
          {!hasResearchDetails && (
            <button
              className="market-primary-button"
              type="button"
              onClick={() => {
                void loadMarketPrice(
                  false
                );
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="market-spinner" />
                  Researching...
                </>
              ) : (
                <>
                  <span>✦</span>
                  {primaryButtonLabel}
                </>
              )}
            </button>
          )}

          {hasMarketEstimate && (
            <button
              className="market-refresh-button"
              type="button"
              onClick={() =>
                setShowRefreshConfirmation(
                  true
                )
              }
              disabled={!canRefresh}
            >
              ↻ Refresh market value
            </button>
          )}
        </div>
      </header>

      {isLoading && (
        <div className="market-progress">
          <span className="market-large-spinner" />

          <div>
            <strong>
              Researching the market
            </strong>

            <p>
              Matching the exact card,
              reviewing price evidence,
              removing bad comparables
              and calculating the
              estimate.
            </p>

            <div className="market-progress-steps">
              <span>
                Searching sources
              </span>

              <span>
                Matching Card DNA
              </span>

              <span>
                Filtering evidence
              </span>

              <span>
                Calculating value
              </span>
            </div>
          </div>
        </div>
      )}

      {showRefreshConfirmation && (
        <div className="refresh-confirmation">
          <span className="refresh-confirmation-icon">
            ↻
          </span>

          <div>
            <strong>
              Start a new paid research?
            </strong>

            <p>
              Refresh ignores the cached
              estimate and runs a new
              market search. This uses
              OpenAI API and web-search
              credits.
            </p>
          </div>

          <div className="refresh-confirmation-actions">
            <button
              type="button"
              onClick={() =>
                setShowRefreshConfirmation(
                  false
                )
              }
            >
              Cancel
            </button>

            <button
              className="confirm-refresh-button"
              type="button"
              onClick={() => {
                void loadMarketPrice(
                  true
                );
              }}
            >
              Run new research
            </button>
          </div>
        </div>
      )}

      {errorMessage && (
        <div
          className="market-error"
          role="alert"
        >
          <span>!</span>

          <div>
            <strong>
              Market research failed
            </strong>

            <p>
              {errorMessage}
            </p>
          </div>
        </div>
      )}

      {hasMarketEstimate ? (
        <>
          <div className="market-summary-grid">
            <MarketMetric
              label="Market estimate"
              value={formatCurrency(
                marketEstimate,
                marketCurrency
              )}
              featured
            />

            <MarketMetric
              label="Realistic range"
              value={
                marketLow !== null &&
                marketHigh !== null
                  ? `${formatCurrency(
                      marketLow,
                      marketCurrency
                    )} – ${formatCurrency(
                      marketHigh,
                      marketCurrency
                    )}`
                  : "—"
              }
            />

            <MarketMetric
              label="Confidence"
              value={
                marketConfidence ===
                null
                  ? "—"
                  : `${Math.round(
                      marketConfidence
                    )}%`
              }
              caption={getConfidenceLabel(
                marketConfidence
              )}
              tone={
                confidenceTone
              }
            />

            <MarketMetric
              label="Included evidence"
              value={String(
                result?.estimate
                  .includedComparableCount ??
                  includedComparables.length
              )}
              caption={
                result
                  ? `${result.estimate.comparableCount} total observations`
                  : "Load research details"
              }
            />
          </div>

          <div className="market-comparison-grid">
            <div className="comparison-card">
              <span>
                YOUR ESTIMATE
              </span>

              <strong>
                {formatCurrency(
                  manualEstimate,
                  currency
                )}
              </strong>

              <p>
                {differenceFromManual ===
                null
                  ? "No manual comparison available."
                  : differenceFromManual ===
                      0
                    ? "Matches the market estimate."
                    : `${differenceFromManual >
                        0
                        ? "+"
                        : ""}${formatCurrency(
                        differenceFromManual,
                        marketCurrency
                      )} versus your estimate.`}
              </p>
            </div>

            <div className="comparison-card">
              <span>
                MARKET VS. COST
              </span>

              <strong
                className={
                  differenceFromCost !==
                    null &&
                  differenceFromCost >= 0
                    ? "comparison-positive"
                    : differenceFromCost !==
                          null &&
                        differenceFromCost <
                          0
                      ? "comparison-negative"
                      : ""
                }
              >
                {formatCurrency(
                  differenceFromCost,
                  marketCurrency
                )}
              </strong>

              <p>
                Estimated market ROI:{" "}
                {formatPercentage(
                  marketRoi
                )}
              </p>
            </div>
          </div>

          <div className="market-meta-row">
            <span>
              {result?.cached
                ? "Cached estimate"
                : result
                  ? "New research"
                  : "Stored estimate"}
            </span>

            {result?.estimate
              .subjectCondition && (
              <span>
                {getConditionLabel(
                  result.estimate
                    .subjectCondition
                )}
              </span>
            )}

            {result?.estimate
              .gradingCompany &&
              result.estimate
                .grade && (
                <span>
                  {
                    result.estimate
                      .gradingCompany
                  }{" "}
                  {
                    result.estimate
                      .grade
                  }
                </span>
              )}

            <span>
              Updated{" "}
              {formatDateTime(
                marketUpdatedAt
              )}
            </span>

            {result?.estimate
              .methodologyVersion && (
              <span>
                {
                  result.estimate
                    .methodologyVersion
                }
              </span>
            )}
          </div>

          {result?.estimate
            .valuationSummary && (
            <div className="valuation-summary">
              <span>✦</span>

              <div>
                <strong>
                  Valuation summary
                </strong>

                <p>
                  {
                    result.estimate
                      .valuationSummary
                  }
                </p>
              </div>
            </div>
          )}

          {valuationNotes.length >
            0 && (
            <div className="market-notes">
              <strong>
                Valuation notes
              </strong>

              <ul>
                {valuationNotes.map(
                  (note, index) => (
                    <li
                      key={`${note}-${index}`}
                    >
                      {note}
                    </li>
                  )
                )}
              </ul>
            </div>
          )}

          {researchWarnings.length >
            0 && (
            <div className="market-warnings">
              <span>!</span>

              <div>
                <strong>
                  Research warnings
                </strong>

                <ul>
                  {researchWarnings.map(
                    (
                      warning,
                      index
                    ) => (
                      <li
                        key={`${warning}-${index}`}
                      >
                        {warning}
                      </li>
                    )
                  )}
                </ul>
              </div>
            </div>
          )}

          {result && (
            <section className="comparables-section">
              <div className="comparables-heading">
                <div>
                  <span>
                    PRICE EVIDENCE
                  </span>

                  <h3>
                    Comparable sales and
                    observations
                  </h3>

                  <p>
                    Included evidence is
                    used in the estimate.
                    Excluded observations
                    remain visible for
                    transparency.
                  </p>
                </div>

                {excludedComparables.length >
                  0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setShowAllComparables(
                        (
                          currentValue
                        ) =>
                          !currentValue
                      )
                    }
                  >
                    {showAllComparables
                      ? "Show included only"
                      : `Show all (${comparables.length})`}
                  </button>
                )}
              </div>

              {visibleComparables.length >
              0 ? (
                <div className="comparables-list">
                  {visibleComparables.map(
                    (comparable) => (
                      <ComparableCard
                        key={
                          comparable.id
                        }
                        comparable={
                          comparable
                        }
                        estimateCurrency={
                          marketCurrency
                        }
                      />
                    )
                  )}
                </div>
              ) : (
                <div className="comparables-empty">
                  <span>⌕</span>

                  <div>
                    <strong>
                      No usable
                      comparables found
                    </strong>

                    <p>
                      The estimate may be
                      based on limited
                      market context or
                      may require another
                      research attempt
                      later.
                    </p>
                  </div>
                </div>
              )}

              {sourceUrls.length > 0 && (
                <div className="market-sources">
                  <strong>
                    Research sources
                  </strong>

                  <div>
                    {sourceUrls.map(
                      (
                        sourceUrl,
                        index
                      ) => {
                        const safeUrl =
                          getSafeHttpUrl(
                            sourceUrl
                          );

                        if (!safeUrl) {
                          return null;
                        }

                        return (
                          <a
                            href={
                              safeUrl
                            }
                            target="_blank"
                            rel="noreferrer"
                            key={`${safeUrl}-${index}`}
                          >
                            Source{" "}
                            {index + 1}
                            <span>↗</span>
                          </a>
                        );
                      }
                    )}
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      ) : (
        !isLoading && (
          <div className="market-empty">
            <div className="market-empty-icon">
              ◇
            </div>

            <div>
              <h3>
                No automatic market
                estimate yet
              </h3>

              <p>
                Start a market research
                to find relevant price
                evidence for the exact
                card. Your own estimate
                remains stored
                separately.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                void loadMarketPrice(
                  false
                );
              }}
            >
              <span>✦</span>
              Find market value
            </button>
          </div>
        )
      )}

      <style jsx>{`
        .market-panel {
          min-width: 0;
          padding: 24px;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.13
            );
          border-radius: 22px;
          background:
            radial-gradient(
              circle at top right,
              rgba(
                124,
                92,
                255,
                0.09
              ),
              transparent 39%
            ),
            #10131b;
          box-shadow: 0 18px 55px
            rgba(
              0,
              0,
              0,
              0.18
            );
          color: #f8fafc;
        }

        .market-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          padding-bottom: 20px;
          border-bottom: 1px solid
            rgba(
              148,
              163,
              184,
              0.1
            );
        }

        .market-eyebrow {
          color: #9f93ff;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.15em;
        }

        .market-header h2 {
          margin: 7px 0 0;
          color: #ffffff;
          font-size: 21px;
          letter-spacing: -0.025em;
        }

        .market-header p {
          max-width: 720px;
          margin: 7px 0 0;
          color: #7d8699;
          font-size: 12px;
          line-height: 1.55;
        }

        .market-header-actions {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .market-primary-button,
        .market-refresh-button {
          min-height: 43px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 15px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 750;
          cursor: pointer;
        }

        .market-primary-button {
          border: 0;
          background: linear-gradient(
            135deg,
            #8b5cf6,
            #6d5ce7
          );
          color: #ffffff;
          box-shadow: 0 10px 25px
            rgba(
              124,
              92,
              255,
              0.22
            );
        }

        .market-primary-button:hover:not(
            :disabled
          ) {
          filter: brightness(
            1.08
          );
        }

        .market-refresh-button {
          border: 1px solid
            rgba(
              167,
              139,
              250,
              0.22
            );
          background: rgba(
            124,
            92,
            255,
            0.06
          );
          color: #c4b5fd;
        }

        .market-refresh-button:hover:not(
            :disabled
          ) {
          border-color: rgba(
            167,
            139,
            250,
            0.48
          );
          background: rgba(
            124,
            92,
            255,
            0.1
          );
        }

        .market-primary-button:disabled,
        .market-refresh-button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .market-spinner,
        .market-large-spinner {
          border-radius: 50%;
          animation: market-spin
            700ms linear infinite;
        }

        .market-spinner {
          width: 15px;
          height: 15px;
          border: 2px solid
            rgba(
              255,
              255,
              255,
              0.3
            );
          border-top-color: #ffffff;
        }

        .market-large-spinner {
          flex: 0 0 auto;
          width: 30px;
          height: 30px;
          border: 2px solid
            rgba(
              167,
              139,
              250,
              0.18
            );
          border-top-color: #a78bfa;
        }

        .market-progress {
          display: flex;
          align-items: flex-start;
          gap: 15px;
          margin-top: 20px;
          padding: 17px;
          border: 1px solid
            rgba(
              167,
              139,
              250,
              0.21
            );
          border-radius: 16px;
          background: rgba(
            124,
            92,
            255,
            0.065
          );
        }

        .market-progress strong {
          color: #ddd6fe;
          font-size: 13px;
        }

        .market-progress p {
          margin: 5px 0 0;
          color: #9489bd;
          font-size: 11px;
          line-height: 1.5;
        }

        .market-progress-steps {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 11px;
        }

        .market-progress-steps span {
          padding: 5px 8px;
          border-radius: 999px;
          background: rgba(
            255,
            255,
            255,
            0.045
          );
          color: #b7aed9;
          font-size: 9px;
          font-weight: 700;
        }

        .refresh-confirmation {
          display: grid;
          grid-template-columns:
            auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 14px;
          margin-top: 20px;
          padding: 16px;
          border: 1px solid
            rgba(
              251,
              191,
              36,
              0.22
            );
          border-radius: 16px;
          background: rgba(
            245,
            158,
            11,
            0.07
          );
          color: #fde68a;
        }

        .refresh-confirmation-icon {
          width: 29px;
          height: 29px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: rgba(
            255,
            255,
            255,
            0.08
          );
          font-size: 15px;
        }

        .refresh-confirmation strong {
          font-size: 13px;
        }

        .refresh-confirmation p {
          margin: 5px 0 0;
          color: #d0b567;
          font-size: 11px;
          line-height: 1.5;
        }

        .refresh-confirmation-actions {
          display: flex;
          gap: 8px;
        }

        .refresh-confirmation-actions
          button {
          min-height: 37px;
          padding: 0 12px;
          border: 1px solid
            rgba(
              251,
              191,
              36,
              0.18
            );
          border-radius: 10px;
          background: rgba(
            0,
            0,
            0,
            0.12
          );
          color: #dbc680;
          font-size: 10px;
          font-weight: 750;
          cursor: pointer;
        }

        .confirm-refresh-button {
          border: 0 !important;
          background: #d69d23 !important;
          color: #171006 !important;
        }

        .market-error {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-top: 20px;
          padding: 15px 16px;
          border: 1px solid
            rgba(
              248,
              113,
              113,
              0.25
            );
          border-radius: 15px;
          background: rgba(
            239,
            68,
            68,
            0.09
          );
          color: #fecaca;
        }

        .market-error > span {
          flex: 0 0 auto;
          width: 25px;
          height: 25px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: rgba(
            255,
            255,
            255,
            0.08
          );
          font-weight: 800;
        }

        .market-error strong {
          font-size: 13px;
        }

        .market-error p {
          margin: 5px 0 0;
          color: #dca9a9;
          font-size: 11px;
          line-height: 1.5;
        }

        .market-summary-grid {
          display: grid;
          grid-template-columns:
            repeat(
              4,
              minmax(0, 1fr)
            );
          gap: 10px;
          margin-top: 20px;
        }

        .market-comparison-grid {
          display: grid;
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
          gap: 10px;
          margin-top: 10px;
        }

        .comparison-card {
          min-width: 0;
          padding: 15px 16px;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.11
            );
          border-radius: 15px;
          background: rgba(
            0,
            0,
            0,
            0.13
          );
        }

        .comparison-card > span {
          color: #71798b;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.09em;
        }

        .comparison-card > strong {
          display: block;
          margin-top: 7px;
          color: #ffffff;
          font-size: 18px;
        }

        .comparison-card p {
          margin: 6px 0 0;
          color: #71798b;
          font-size: 10px;
          line-height: 1.45;
        }

        .comparison-positive {
          color: #86efac !important;
        }

        .comparison-negative {
          color: #fca5a5 !important;
        }

        .market-meta-row {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 13px;
        }

        .market-meta-row span {
          padding: 6px 9px;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.11
            );
          border-radius: 999px;
          background: rgba(
            255,
            255,
            255,
            0.02
          );
          color: #7e879a;
          font-size: 9px;
          font-weight: 700;
        }

        .valuation-summary {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-top: 18px;
          padding: 16px;
          border: 1px solid
            rgba(
              96,
              165,
              250,
              0.17
            );
          border-radius: 15px;
          background: rgba(
            59,
            130,
            246,
            0.05
          );
          color: #bfdbfe;
        }

        .valuation-summary > span {
          color: #93c5fd;
        }

        .valuation-summary strong {
          font-size: 12px;
        }

        .valuation-summary p {
          margin: 5px 0 0;
          color: #879db9;
          font-size: 11px;
          line-height: 1.55;
        }

        .market-notes {
          margin-top: 13px;
          padding: 15px 16px;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.1
            );
          border-radius: 15px;
          background: rgba(
            0,
            0,
            0,
            0.12
          );
        }

        .market-notes strong {
          color: #cfd4df;
          font-size: 11px;
        }

        .market-notes ul {
          margin: 9px 0 0;
          padding-left: 17px;
          color: #7e879a;
          font-size: 10px;
          line-height: 1.6;
        }

        .market-warnings {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-top: 13px;
          padding: 15px 16px;
          border: 1px solid
            rgba(
              251,
              191,
              36,
              0.2
            );
          border-radius: 15px;
          background: rgba(
            245,
            158,
            11,
            0.06
          );
          color: #fde68a;
        }

        .market-warnings > span {
          flex: 0 0 auto;
          width: 24px;
          height: 24px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: rgba(
            255,
            255,
            255,
            0.07
          );
          font-weight: 800;
        }

        .market-warnings strong {
          font-size: 11px;
        }

        .market-warnings ul {
          margin: 7px 0 0;
          padding-left: 17px;
          color: #cbb46c;
          font-size: 10px;
          line-height: 1.55;
        }

        .comparables-section {
          margin-top: 21px;
          padding-top: 21px;
          border-top: 1px solid
            rgba(
              148,
              163,
              184,
              0.1
            );
        }

        .comparables-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
        }

        .comparables-heading
          > div
          > span {
          color: #9f93ff;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.14em;
        }

        .comparables-heading h3 {
          margin: 6px 0 0;
          color: #ffffff;
          font-size: 17px;
        }

        .comparables-heading p {
          max-width: 650px;
          margin: 6px 0 0;
          color: #71798b;
          font-size: 10px;
          line-height: 1.5;
        }

        .comparables-heading
          button {
          flex: 0 0 auto;
          min-height: 36px;
          padding: 0 11px;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.13
            );
          border-radius: 10px;
          background: rgba(
            255,
            255,
            255,
            0.025
          );
          color: #8e96a8;
          font-size: 9px;
          font-weight: 750;
          cursor: pointer;
        }

        .comparables-heading
          button:hover {
          border-color: rgba(
            167,
            139,
            250,
            0.3
          );
          color: #ffffff;
        }

        .comparables-list {
          display: grid;
          gap: 10px;
          margin-top: 15px;
        }

        .comparables-empty {
          display: flex;
          align-items: flex-start;
          gap: 13px;
          margin-top: 15px;
          padding: 18px;
          border: 1px dashed
            rgba(
              148,
              163,
              184,
              0.17
            );
          border-radius: 16px;
          background: rgba(
            0,
            0,
            0,
            0.1
          );
        }

        .comparables-empty > span {
          color: #8e82d9;
          font-size: 22px;
        }

        .comparables-empty strong {
          color: #d5d9e2;
          font-size: 12px;
        }

        .comparables-empty p {
          margin: 5px 0 0;
          color: #71798b;
          font-size: 10px;
          line-height: 1.5;
        }

        .market-sources {
          margin-top: 15px;
          padding: 14px 15px;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.1
            );
          border-radius: 14px;
          background: rgba(
            0,
            0,
            0,
            0.11
          );
        }

        .market-sources > strong {
          color: #a8afbd;
          font-size: 10px;
        }

        .market-sources > div {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 9px;
        }

        .market-sources a {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 9px;
          border: 1px solid
            rgba(
              96,
              165,
              250,
              0.16
            );
          border-radius: 9px;
          background: rgba(
            59,
            130,
            246,
            0.05
          );
          color: #93c5fd;
          font-size: 9px;
          font-weight: 700;
          text-decoration: none;
        }

        .market-sources a:hover {
          border-color: rgba(
            96,
            165,
            250,
            0.35
          );
          color: #dbeafe;
        }

        .market-empty {
          min-height: 230px;
          display: grid;
          grid-template-columns:
            auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 18px;
          margin-top: 20px;
          padding: 25px;
          border: 1px dashed
            rgba(
              148,
              163,
              184,
              0.18
            );
          border-radius: 18px;
          background: rgba(
            0,
            0,
            0,
            0.11
          );
        }

        .market-empty-icon {
          width: 52px;
          height: 52px;
          display: grid;
          place-items: center;
          border: 1px solid
            rgba(
              167,
              139,
              250,
              0.2
            );
          border-radius: 15px;
          background: rgba(
            139,
            92,
            246,
            0.07
          );
          color: #c4b5fd;
          font-size: 22px;
        }

        .market-empty h3 {
          margin: 0;
          color: #ffffff;
          font-size: 15px;
        }

        .market-empty p {
          max-width: 620px;
          margin: 7px 0 0;
          color: #71798b;
          font-size: 11px;
          line-height: 1.55;
        }

        .market-empty button {
          min-height: 42px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 0 15px;
          border: 0;
          border-radius: 12px;
          background: linear-gradient(
            135deg,
            #8b5cf6,
            #6d5ce7
          );
          color: #ffffff;
          font-size: 11px;
          font-weight: 750;
          cursor: pointer;
        }

        @keyframes market-spin {
          to {
            transform: rotate(
              360deg
            );
          }
        }

        @media (
          max-width: 980px
        ) {
          .market-summary-grid {
            grid-template-columns:
              repeat(
                2,
                minmax(0, 1fr)
              );
          }
        }

        @media (
          max-width: 720px
        ) {
          .market-header,
          .comparables-heading {
            flex-direction: column;
          }

          .market-header-actions {
            width: 100%;
            flex-wrap: wrap;
          }

          .market-primary-button,
          .market-refresh-button {
            flex: 1;
          }

          .refresh-confirmation {
            grid-template-columns:
              auto minmax(0, 1fr);
          }

          .refresh-confirmation-actions {
            grid-column: 1 / -1;
            justify-content: flex-end;
          }

          .market-empty {
            grid-template-columns:
              auto minmax(0, 1fr);
          }

          .market-empty button {
            grid-column: 1 / -1;
            justify-content: center;
          }
        }

        @media (
          max-width: 520px
        ) {
          .market-panel {
            padding: 19px;
          }

          .market-summary-grid,
          .market-comparison-grid {
            grid-template-columns:
              1fr;
          }

          .market-header-actions {
            display: grid;
          }

          .refresh-confirmation {
            grid-template-columns:
              1fr;
          }

          .refresh-confirmation-icon {
            display: none;
          }

          .refresh-confirmation-actions {
            grid-column: auto;
            display: grid;
            grid-template-columns:
              1fr 1fr;
          }

          .market-empty {
            grid-template-columns:
              1fr;
            text-align: center;
          }

          .market-empty-icon {
            margin: 0 auto;
          }
        }
      `}</style>
    </section>
  );
}

type MarketMetricProps = {
  label: string;

  value: string;

  caption?: string;

  featured?: boolean;

  tone?:
    | "high"
    | "medium"
    | "low"
    | "neutral";
};

function MarketMetric({
  label,
  value,
  caption,
  featured = false,
  tone = "neutral",
}: MarketMetricProps) {
  return (
    <article
      className={[
        "market-metric",
        featured
          ? "market-metric-featured"
          : "",
        `market-metric-${tone}`,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span>{label}</span>

      <strong>{value}</strong>

      {caption && (
        <small>{caption}</small>
      )}

      <style jsx>{`
        .market-metric {
          min-width: 0;
          padding: 16px;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.11
            );
          border-radius: 16px;
          background: rgba(
            0,
            0,
            0,
            0.13
          );
        }

        .market-metric-featured {
          border-color: rgba(
            139,
            92,
            246,
            0.3
          );
          background:
            radial-gradient(
              circle at top right,
              rgba(
                124,
                92,
                255,
                0.14
              ),
              transparent 45%
            ),
            rgba(
              124,
              92,
              255,
              0.06
            );
        }

        .market-metric > span {
          display: block;
          color: #71798b;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }

        .market-metric > strong {
          display: block;
          overflow-wrap: anywhere;
          margin-top: 8px;
          color: #ffffff;
          font-size: 18px;
          letter-spacing: -0.02em;
        }

        .market-metric-featured
          > strong {
          color: #ddd6fe;
          font-size: 21px;
        }

        .market-metric > small {
          display: block;
          margin-top: 5px;
          color: #71798b;
          font-size: 9px;
        }

        .market-metric-high
          > strong {
          color: #86efac;
        }

        .market-metric-medium
          > strong {
          color: #fde68a;
        }

        .market-metric-low
          > strong {
          color: #fca5a5;
        }
      `}</style>
    </article>
  );
}

function ComparableCard({
  comparable,
  estimateCurrency,
}: {
  comparable:
    MarketPriceComparable;

  estimateCurrency: string;
}) {
  const safeUrl =
    getSafeHttpUrl(
      comparable.sourceUrl
    );

  const displayPrice =
    comparable.normalizedTotal ??
    comparable.totalPrice;

  const displayCurrency =
    comparable.normalizedTotal !==
    null
      ? estimateCurrency
      : comparable.currency;

  const gradeLabel =
    [
      comparable.gradingCompany,
      comparable.grade,
    ]
      .filter(Boolean)
      .join(" ") || null;

  return (
    <article
      className={[
        "comparable-card",
        comparable.included
          ? "comparable-card-included"
          : "comparable-card-excluded",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="comparable-top-row">
        <div className="comparable-badges">
          <span
            className={`evidence-badge evidence-${comparable.evidenceType}`}
          >
            {getEvidenceTypeLabel(
              comparable.evidenceType
            )}
          </span>

          <span
            className={
              comparable.included
                ? "included-badge"
                : "excluded-badge"
            }
          >
            {comparable.included
              ? "Included"
              : "Excluded"}
          </span>

          {comparable.matchScore !==
            null && (
            <span className="match-badge">
              {Math.round(
                comparable.matchScore
              )}
              % match
            </span>
          )}
        </div>

        <strong className="comparable-price">
          {formatCurrency(
            displayPrice,
            displayCurrency
          )}
        </strong>
      </div>

      <h4>{comparable.title}</h4>

      <div className="comparable-meta">
        <span>
          {comparable.sourceName}
        </span>

        <span>
          {formatShortDate(
            comparable.soldAt
          )}
        </span>

        {comparable.conditionLabel && (
          <span>
            {
              comparable.conditionLabel
            }
          </span>
        )}

        {gradeLabel && (
          <span>{gradeLabel}</span>
        )}

        {comparable.serialNumber && (
          <span>
            {
              comparable.serialNumber
            }
          </span>
        )}

        {comparable.saleFormat && (
          <span>
            {comparable.saleFormat}
          </span>
        )}
      </div>

      {comparable.currency !==
        estimateCurrency &&
        comparable.normalizedTotal !==
          null && (
        <p className="currency-note">
          Original total:{" "}
          {formatCurrency(
            comparable.totalPrice,
            comparable.currency
          )}
        </p>
      )}

      {!comparable.included &&
        comparable.exclusionReason && (
          <div className="exclusion-reason">
            <strong>
              Excluded because:
            </strong>

            <span>
              {
                comparable.exclusionReason
              }
            </span>
          </div>
        )}

      {comparable.matchNotes.length >
        0 && (
        <ul className="match-notes">
          {comparable.matchNotes.map(
            (note, index) => (
              <li
                key={`${note}-${index}`}
              >
                {note}
              </li>
            )
          )}
        </ul>
      )}

      {safeUrl && (
        <a
          className="comparable-source-link"
          href={safeUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open source
          <span>↗</span>
        </a>
      )}

      <style jsx>{`
        .comparable-card {
          min-width: 0;
          padding: 16px;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.11
            );
          border-radius: 16px;
          background: rgba(
            0,
            0,
            0,
            0.12
          );
        }

        .comparable-card-included {
          border-color: rgba(
            52,
            211,
            153,
            0.16
          );
        }

        .comparable-card-excluded {
          opacity: 0.72;
        }

        .comparable-top-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 17px;
        }

        .comparable-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .comparable-badges span {
          display: inline-flex;
          align-items: center;
          min-height: 23px;
          padding: 0 7px;
          border-radius: 999px;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .evidence-badge {
          border: 1px solid
            rgba(
              96,
              165,
              250,
              0.18
            );
          background: rgba(
            59,
            130,
            246,
            0.06
          );
          color: #bfdbfe;
        }

        .evidence-sold,
        .evidence-accepted_offer {
          border-color: rgba(
            52,
            211,
            153,
            0.19
          );
          background: rgba(
            16,
            185,
            129,
            0.065
          );
          color: #a7f3d0;
        }

        .evidence-asking {
          border-color: rgba(
            251,
            191,
            36,
            0.18
          );
          background: rgba(
            245,
            158,
            11,
            0.06
          );
          color: #fde68a;
        }

        .included-badge {
          border: 1px solid
            rgba(
              52,
              211,
              153,
              0.17
            );
          background: rgba(
            16,
            185,
            129,
            0.05
          );
          color: #86efac;
        }

        .excluded-badge {
          border: 1px solid
            rgba(
              248,
              113,
              113,
              0.16
            );
          background: rgba(
            239,
            68,
            68,
            0.05
          );
          color: #fca5a5;
        }

        .match-badge {
          border: 1px solid
            rgba(
              167,
              139,
              250,
              0.17
            );
          background: rgba(
            139,
            92,
            246,
            0.055
          );
          color: #c4b5fd;
        }

        .comparable-price {
          flex: 0 0 auto;
          color: #ffffff;
          font-size: 18px;
        }

        .comparable-card h4 {
          margin: 13px 0 0;
          color: #d9dde6;
          font-size: 12px;
          line-height: 1.5;
        }

        .comparable-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 10px;
        }

        .comparable-meta span {
          padding: 5px 7px;
          border-radius: 8px;
          background: rgba(
            255,
            255,
            255,
            0.03
          );
          color: #737c8e;
          font-size: 8px;
          font-weight: 700;
        }

        .currency-note {
          margin: 9px 0 0;
          color: #71798b;
          font-size: 9px;
        }

        .exclusion-reason {
          display: flex;
          gap: 6px;
          margin-top: 11px;
          padding: 9px 10px;
          border-radius: 10px;
          background: rgba(
            239,
            68,
            68,
            0.045
          );
          color: #c88d8d;
          font-size: 9px;
          line-height: 1.45;
        }

        .match-notes {
          margin: 10px 0 0;
          padding-left: 17px;
          color: #71798b;
          font-size: 9px;
          line-height: 1.5;
        }

        .comparable-source-link {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          margin-top: 12px;
          color: #93c5fd;
          font-size: 9px;
          font-weight: 750;
          text-decoration: none;
        }

        .comparable-source-link:hover {
          color: #dbeafe;
        }

        @media (
          max-width: 520px
        ) {
          .comparable-top-row {
            flex-direction: column;
          }
        }
      `}</style>
    </article>
  );
}
