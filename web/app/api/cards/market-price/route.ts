import { NextResponse } from "next/server";
import OpenAI from "openai";

import {
  resolveMarketPrice,
  type MarketCardSubject,
  type MarketComparable,
  type MarketPriceResolution,
  type MarketSubjectCondition,
} from "@/lib/market/resolveMarketPrice";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const MARKET_CACHE_HOURS = 24;
const MARKET_METHOD_VERSION = "market-v1";

const MARKET_ATTRIBUTE_KEYS = [
  "manufacturer",
  "brand",
  "product",
  "set_name",
  "year",
  "card_number",
  "parallel",
  "serial_number",
  "serial_numbered_to",
  "rookie_card",
  "autograph",
  "memorabilia",
  "grading_company",
  "grade",
] as const;

type MarketPriceRequest = {
  cardId?: unknown;
  force?: unknown;
};

type CardRow = {
  id: string;
  user_id: string;
  current_collection_id: string;
  player_name: string;
  year: string | null;
  manufacturer: string | null;
  set_name: string | null;
  card_number: string | null;
  parallel_name: string | null;
  serial_number: string | null;
  state: string | null;
  current_market_estimate_id: string | null;
  market_estimated_value: number | string | null;
  market_value_low: number | string | null;
  market_value_high: number | string | null;
  market_value_currency: string | null;
  market_value_confidence: number | string | null;
  market_value_updated_at: string | null;
};

type CollectionRow = {
  id: string;
  user_id: string;
  currency: string;
};

type CardAttributeRow = {
  attribute_key: string;
  attribute_value: unknown;
};

type MarketEstimateRow = {
  id: string;
  status: "pending" | "completed" | "partial" | "failed";
  canonical_title: string | null;
  subject_condition: MarketSubjectCondition;
  grading_company: string | null;
  grade: string | null;
  currency: string;
  estimated_value: number | string | null;
  low_value: number | string | null;
  high_value: number | string | null;
  confidence_score: number | string | null;
  comparable_count: number;
  included_comparable_count: number;
  source_count: number;
  search_query: string | null;
  methodology_version: string;
  valuation_summary: string | null;
  valuation_notes: string[] | null;
  warnings: string[] | null;
  source_urls: string[] | null;
  model_name: string | null;
  response_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  web_search_calls: number | null;
  error_message: string | null;
  data_as_of: string | null;
  is_current: boolean;
  created_at: string;
  updated_at: string;
};

type MarketComparableRow = {
  id: string;
  source_name: string;
  source_domain: string | null;
  source_url: string;
  external_id: string | null;
  evidence_type: MarketComparable["evidenceType"] | "manual";
  title: string;
  sold_at: string | null;
  price: number | string;
  shipping_price: number | string;
  total_price: number | string;
  currency: string;
  exchange_rate_to_estimate: number | string | null;
  normalized_total: number | string | null;
  condition_label: string | null;
  grading_company: string | null;
  grade: string | null;
  serial_number: string | null;
  sale_format: string | null;
  match_score: number | string | null;
  included: boolean;
  exclusion_reason: string | null;
  match_notes: string[] | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type ActivationRow = {
  activated_card_id: string;
  activated_estimate_id: string;
  market_value: number | string;
  market_currency: string;
  market_confidence: number | string | null;
};

class RequestError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "RequestError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRequiredString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new RequestError(`${label} mangler.`);
  }

  return value.trim();
}

function getBoolean(value: unknown) {
  return value === true;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Der opstod en ukendt fejl.";
}

function getErrorStatus(error: unknown) {
  if (error instanceof RequestError) {
    return error.status;
  }

  const message = getErrorMessage(error).toLowerCase();

  if (message.includes("api key") || message.includes("authentication")) {
    return 500;
  }

  if (message.includes("quota") || message.includes("billing")) {
    return 402;
  }

  if (
    message.includes("not specific enough") ||
    message.includes("identity is not specific") ||
    message.includes("player name is required") ||
    message.includes("target currency")
  ) {
    return 400;
  }

  if (message.includes("web search") || message.includes("market research")) {
    return 502;
  }

  return 500;
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  return value.trim();
}

function normalizeOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function normalizeOptionalBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();

    if (normalizedValue === "true") {
      return true;
    }

    if (normalizedValue === "false") {
      return false;
    }
  }

  return null;
}

function normalizeCurrency(value: unknown) {
  const normalizedValue =
    typeof value === "string" ? value.trim().toUpperCase() : "";

  if (!/^[A-Z]{3}$/.test(normalizedValue)) {
    throw new RequestError(
      "Collectionens valuta er ugyldig. Den skal være en trebogstavskode som DKK eller USD.",
      500
    );
  }

  return normalizedValue;
}

function normalizeDateTime(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getSerialNumberedTo(serialNumber: string | null) {
  if (!serialNumber) {
    return null;
  }

  const match = serialNumber.match(/\/\s*(\d+)\s*$/);

  if (!match) {
    return null;
  }

  const parsedValue = Number(match[1]);

  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function getAttributeValue(
  attributes: CardAttributeRow[],
  attributeKey: string
) {
  return attributes.find(
    (attribute) => attribute.attribute_key === attributeKey
  )?.attribute_value;
}

function getStringAttribute(
  attributes: CardAttributeRow[],
  attributeKey: string
) {
  return normalizeOptionalString(getAttributeValue(attributes, attributeKey));
}

function getNumberAttribute(
  attributes: CardAttributeRow[],
  attributeKey: string
) {
  return normalizeOptionalNumber(getAttributeValue(attributes, attributeKey));
}

function getBooleanAttribute(
  attributes: CardAttributeRow[],
  attributeKey: string
) {
  return normalizeOptionalBoolean(getAttributeValue(attributes, attributeKey));
}

function getSubjectCondition(
  gradingCompany: string | null,
  grade: string | null
): MarketSubjectCondition {
  if (gradingCompany && grade) {
    return "graded";
  }

  if (!gradingCompany && !grade) {
    return "raw";
  }

  return "unknown";
}

function validateMarketSubject(subject: MarketCardSubject) {
  if (!subject.playerName.trim()) {
    throw new RequestError(
      "Spillernavn mangler. Ret kortets Card DNA, før markedsprisen beregnes."
    );
  }

  const identitySignals = [
    subject.year,
    subject.product,
    subject.setName,
    subject.cardNumber,
    subject.parallel,
    subject.serialNumberedTo,
  ].filter(
    (value) => value !== null && value !== undefined && value !== ""
  );

  if (identitySignals.length < 3) {
    throw new RequestError(
      "Kortets identitet er ikke præcis nok til en pålidelig markedsvurdering. Kontrollér årgang, produkt, set, kortnummer og parallel."
    );
  }
}

function buildProvisionalCanonicalTitle(subject: MarketCardSubject) {
  return (
    [
      subject.year,
      subject.product,
      subject.setName,
      subject.playerName,
      subject.cardNumber ? `#${subject.cardNumber}` : null,
      subject.parallel,
      subject.gradingCompany && subject.grade
        ? `${subject.gradingCompany} ${subject.grade}`
        : null,
    ]
      .filter(Boolean)
      .join(" ") || null
  );
}

function isFreshMarketEstimate(updatedAt: string | null) {
  if (!updatedAt) {
    return false;
  }

  const updatedDate = new Date(updatedAt);

  if (Number.isNaN(updatedDate.getTime())) {
    return false;
  }

  const cacheLifetimeMs = MARKET_CACHE_HOURS * 60 * 60 * 1000;

  return Date.now() - updatedDate.getTime() < cacheLifetimeMs;
}

function toPublicEstimate(estimate: MarketEstimateRow) {
  return {
    id: estimate.id,
    status: estimate.status,
    canonicalTitle: estimate.canonical_title,
    subjectCondition: estimate.subject_condition,
    gradingCompany: estimate.grading_company,
    grade: estimate.grade,
    currency: estimate.currency,
    estimatedValue: normalizeOptionalNumber(estimate.estimated_value),
    lowValue: normalizeOptionalNumber(estimate.low_value),
    highValue: normalizeOptionalNumber(estimate.high_value),
    confidenceScore: normalizeOptionalNumber(estimate.confidence_score),
    comparableCount: estimate.comparable_count,
    includedComparableCount: estimate.included_comparable_count,
    sourceCount: estimate.source_count,
    searchQuery: estimate.search_query,
    methodologyVersion: estimate.methodology_version,
    valuationSummary: estimate.valuation_summary,
    valuationNotes: estimate.valuation_notes ?? [],
    warnings: estimate.warnings ?? [],
    sourceUrls: estimate.source_urls ?? [],
    modelName: estimate.model_name,
    responseId: estimate.response_id,
    inputTokens: estimate.input_tokens,
    outputTokens: estimate.output_tokens,
    webSearchCalls: estimate.web_search_calls ?? 0,
    errorMessage: estimate.error_message,
    dataAsOf: estimate.data_as_of,
    isCurrent: estimate.is_current,
    createdAt: estimate.created_at,
    updatedAt: estimate.updated_at,
  };
}

function toPublicComparable(comparable: MarketComparableRow) {
  return {
    id: comparable.id,
    sourceName: comparable.source_name,
    sourceDomain: comparable.source_domain,
    sourceUrl: comparable.source_url,
    externalId: comparable.external_id,
    evidenceType: comparable.evidence_type,
    title: comparable.title,
    soldAt: comparable.sold_at,
    price: normalizeOptionalNumber(comparable.price) ?? 0,
    shippingPrice: normalizeOptionalNumber(comparable.shipping_price) ?? 0,
    totalPrice: normalizeOptionalNumber(comparable.total_price) ?? 0,
    currency: comparable.currency,
    exchangeRateToEstimate: normalizeOptionalNumber(
      comparable.exchange_rate_to_estimate
    ),
    normalizedTotal: normalizeOptionalNumber(comparable.normalized_total),
    conditionLabel: comparable.condition_label,
    gradingCompany: comparable.grading_company,
    grade: comparable.grade,
    serialNumber: comparable.serial_number,
    saleFormat: comparable.sale_format,
    matchScore: normalizeOptionalNumber(comparable.match_score),
    included: comparable.included,
    exclusionReason: comparable.exclusion_reason,
    matchNotes: comparable.match_notes ?? [],
    metadata: comparable.metadata ?? {},
    createdAt: comparable.created_at,
  };
}

function buildResolutionUpdate(resolution: MarketPriceResolution) {
  return {
    status: resolution.status,
    canonical_title: resolution.canonicalTitle,
    subject_condition: resolution.subjectCondition,
    grading_company: resolution.gradingCompany,
    grade: resolution.grade,
    currency: resolution.currency,
    estimated_value: resolution.estimatedValue,
    low_value: resolution.lowValue,
    high_value: resolution.highValue,
    confidence_score: resolution.confidenceScore,
    comparable_count: resolution.comparableCount,
    included_comparable_count: resolution.includedComparableCount,
    source_count: resolution.sourceCount,
    search_query: resolution.searchQuery,
    methodology_version: MARKET_METHOD_VERSION,
    valuation_summary: resolution.valuationSummary,
    valuation_notes: resolution.valuationNotes,
    warnings: resolution.warnings,
    source_urls: resolution.sourceUrls,
    model_name: resolution.modelName,
    response_id: resolution.responseId,
    input_tokens: resolution.inputTokens,
    output_tokens: resolution.outputTokens,
    web_search_calls: resolution.webSearchCalls,
    error_message:
      resolution.status === "failed"
        ? resolution.valuationSummary ??
          "Der blev ikke fundet tilstrækkelige markedsdata."
        : null,
    data_as_of: resolution.dataAsOf,
    is_current: false,
  };
}

function buildComparableRows({
  userId,
  cardId,
  estimateId,
  comparables,
}: {
  userId: string;
  cardId: string;
  estimateId: string;
  comparables: MarketComparable[];
}) {
  const seenUrls = new Set<string>();

  return comparables.flatMap((comparable) => {
    const sourceUrl = comparable.sourceUrl.trim();

    if (!sourceUrl || seenUrls.has(sourceUrl)) {
      return [];
    }

    seenUrls.add(sourceUrl);

    return [
      {
        user_id: userId,
        estimate_id: estimateId,
        card_id: cardId,
        source_name: comparable.sourceName,
        source_domain: comparable.sourceDomain,
        source_url: sourceUrl,
        external_id: comparable.externalId,
        evidence_type: comparable.evidenceType,
        title: comparable.title,
        sold_at: normalizeDateTime(comparable.soldAt),
        price: comparable.price,
        shipping_price: comparable.shippingPrice,
        currency: comparable.currency,
        exchange_rate_to_estimate: comparable.exchangeRateToEstimate,
        normalized_total: comparable.normalizedTotal,
        condition_label: comparable.conditionLabel,
        grading_company: comparable.gradingCompany,
        grade: comparable.grade,
        serial_number: comparable.serialNumber,
        sale_format: comparable.saleFormat,
        match_score: comparable.matchScore,
        included: comparable.included,
        exclusion_reason: comparable.exclusionReason,
        match_notes: comparable.matchNotes,
        metadata: comparable.metadata,
      },
    ];
  });
}

async function markEstimateFailed({
  supabase,
  estimateId,
  userId,
  errorMessage,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  estimateId: string;
  userId: string;
  errorMessage: string;
}) {
  const { error } = await supabase
    .from("card_market_estimates")
    .update({
      status: "failed",
      error_message: errorMessage,
      is_current: false,
    })
    .eq("id", estimateId)
    .eq("user_id", userId);

  if (error) {
    console.error("Markedsestimatet kunne ikke markeres som fejlet:", error);
  }
}

async function loadSavedEstimate({
  supabase,
  estimateId,
  userId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  estimateId: string;
  userId: string;
}) {
  const [estimateResult, comparableResult] = await Promise.all([
    supabase
      .from("card_market_estimates")
      .select("*")
      .eq("id", estimateId)
      .eq("user_id", userId)
      .maybeSingle(),

    supabase
      .from("card_market_comparables")
      .select("*")
      .eq("estimate_id", estimateId)
      .eq("user_id", userId)
      .order("included", { ascending: false })
      .order("sold_at", { ascending: false, nullsFirst: false }),
  ]);

  if (estimateResult.error || !estimateResult.data) {
    return null;
  }

  if (comparableResult.error) {
    console.error("Sammenlignelige salg kunne ikke genindlæses:", comparableResult.error);
  }

  return {
    estimate: estimateResult.data as MarketEstimateRow,
    comparables: (comparableResult.data ?? []) as MarketComparableRow[],
  };
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new RequestError(
        "OpenAI er ikke konfigureret på serveren. Kontrollér OPENAI_API_KEY.",
        500
      );
    }

    const body = (await request.json()) as MarketPriceRequest;
    const cardId = getRequiredString(body.cardId, "Kort-ID");
    const force = getBoolean(body.force);

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new RequestError(
        "Du skal være logget ind for at beregne en markedspris.",
        401
      );
    }

    const userId = user.id;

    const { data: cardData, error: cardError } = await supabase
      .from("cards")
      .select(`
        id,
        user_id,
        current_collection_id,
        player_name,
        year,
        manufacturer,
        set_name,
        card_number,
        parallel_name,
        serial_number,
        state,
        current_market_estimate_id,
        market_estimated_value,
        market_value_low,
        market_value_high,
        market_value_currency,
        market_value_confidence,
        market_value_updated_at
      `)
      .eq("id", cardId)
      .eq("user_id", userId)
      .maybeSingle();

    if (cardError || !cardData) {
      throw new RequestError(
        "Kortet blev ikke fundet, eller du har ikke adgang til det.",
        404
      );
    }

    const card = cardData as CardRow;

    if (
      !force &&
      card.current_market_estimate_id &&
      isFreshMarketEstimate(card.market_value_updated_at)
    ) {
      const cachedResult = await loadSavedEstimate({
        supabase,
        estimateId: card.current_market_estimate_id,
        userId,
      });

      if (cachedResult) {
        return NextResponse.json({
          success: true,
          cached: true,
          activated: cachedResult.estimate.is_current,
          cardId,
          estimate: toPublicEstimate(cachedResult.estimate),
          comparables: cachedResult.comparables.map(toPublicComparable),
          message: `Det eksisterende markedsestimat er under ${MARKET_CACHE_HOURS} timer gammelt og blev genbrugt.`,
        });
      }
    }

    const [collectionResult, attributeResult] = await Promise.all([
      supabase
        .from("collections")
        .select("id, user_id, currency")
        .eq("id", card.current_collection_id)
        .eq("user_id", userId)
        .maybeSingle(),

      supabase
        .from("card_attributes")
        .select("attribute_key, attribute_value")
        .eq("card_id", cardId)
        .eq("user_id", userId)
        .in("attribute_key", [...MARKET_ATTRIBUTE_KEYS]),
    ]);

    if (collectionResult.error || !collectionResult.data) {
      throw new RequestError(
        "Kortets collection eller valuta kunne ikke indlæses.",
        500
      );
    }

    if (attributeResult.error) {
      throw new RequestError(
        `Card DNA kunne ikke indlæses: ${attributeResult.error.message}`,
        500
      );
    }

    const collection = collectionResult.data as CollectionRow;
    const attributes = (attributeResult.data ?? []) as CardAttributeRow[];

    const manufacturer =
      getStringAttribute(attributes, "manufacturer") ?? card.manufacturer;
    const brand = getStringAttribute(attributes, "brand");
    const product = getStringAttribute(attributes, "product");
    const setName =
      getStringAttribute(attributes, "set_name") ?? card.set_name;
    const year = getStringAttribute(attributes, "year") ?? card.year;
    const cardNumber =
      getStringAttribute(attributes, "card_number") ?? card.card_number;
    const parallel =
      getStringAttribute(attributes, "parallel") ?? card.parallel_name;
    const serialNumber =
      getStringAttribute(attributes, "serial_number") ?? card.serial_number;
    const serialNumberedTo =
      getNumberAttribute(attributes, "serial_numbered_to") ??
      getSerialNumberedTo(serialNumber);
    const rookieCard = getBooleanAttribute(attributes, "rookie_card");
    const autograph = getBooleanAttribute(attributes, "autograph");
    const memorabilia = getBooleanAttribute(attributes, "memorabilia");
    const gradingCompany = getStringAttribute(attributes, "grading_company");
    const grade = getStringAttribute(attributes, "grade");
    const targetCurrency = normalizeCurrency(collection.currency);

    const subject: MarketCardSubject = {
      playerName: card.player_name,
      year,
      manufacturer,
      brand,
      product,
      setName,
      cardNumber,
      parallel,
      serialNumber,
      serialNumberedTo,
      rookieCard,
      autograph,
      memorabilia,
      gradingCompany,
      grade,
      targetCurrency,
    };

    validateMarketSubject(subject);

    const subjectCondition = getSubjectCondition(gradingCompany, grade);
    const provisionalCanonicalTitle = buildProvisionalCanonicalTitle(subject);

    const { data: estimateData, error: estimateInsertError } = await supabase
      .from("card_market_estimates")
      .insert({
        user_id: userId,
        card_id: cardId,
        status: "pending",
        canonical_title: provisionalCanonicalTitle,
        subject_condition: subjectCondition,
        grading_company: gradingCompany,
        grade,
        currency: targetCurrency,
        methodology_version: MARKET_METHOD_VERSION,
        is_current: false,
      })
      .select("id")
      .single();

    if (estimateInsertError || !estimateData?.id) {
      throw new RequestError(
        estimateInsertError?.message ??
          "Markedsestimatet kunne ikke oprettes i databasen.",
        500
      );
    }

    const estimateId = String(estimateData.id);

    try {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const resolution = await resolveMarketPrice({
        openai,
        subject,
      });

      const { error: estimateUpdateError } = await supabase
        .from("card_market_estimates")
        .update(buildResolutionUpdate(resolution))
        .eq("id", estimateId)
        .eq("user_id", userId);

      if (estimateUpdateError) {
        throw new RequestError(
          `Markedsresultatet kunne ikke gemmes: ${estimateUpdateError.message}`,
          500
        );
      }

      const comparableRows = buildComparableRows({
        userId,
        cardId,
        estimateId,
        comparables: resolution.comparables,
      });

      if (comparableRows.length > 0) {
        const { error: comparableInsertError } = await supabase
          .from("card_market_comparables")
          .insert(comparableRows);

        if (comparableInsertError) {
          throw new RequestError(
            `Prisbeviserne kunne ikke gemmes: ${comparableInsertError.message}`,
            500
          );
        }
      }

      let activated = false;

      if (
        resolution.estimatedValue !== null &&
        (resolution.status === "completed" || resolution.status === "partial")
      ) {
        const { data: activationData, error: activationError } =
          await supabase.rpc("activate_card_market_estimate", {
            p_estimate_id: estimateId,
          });

        if (activationError) {
          throw new RequestError(
            `Markedsestimatet blev beregnet, men kunne ikke aktiveres: ${activationError.message}`,
            500
          );
        }

        const activationRows = (activationData ?? []) as ActivationRow[];
        activated = activationRows[0]?.activated_estimate_id === estimateId;
      }

      const savedResult = await loadSavedEstimate({
        supabase,
        estimateId,
        userId,
      });

      if (!savedResult) {
        throw new RequestError(
          "Markedsestimatet blev beregnet, men kunne ikke genindlæses.",
          500
        );
      }

      const message =
        resolution.estimatedValue === null
          ? "Der blev ikke fundet tilstrækkelige, pålidelige prisbeviser til et automatisk markedsestimat."
          : resolution.status === "completed"
            ? "Markedsestimatet er beregnet og aktiveret."
            : "Et foreløbigt markedsestimat er beregnet. Datagrundlaget er begrænset og bør gennemgås.";

      return NextResponse.json({
        success: true,
        cached: false,
        activated,
        cardId,
        estimate: toPublicEstimate(savedResult.estimate),
        comparables: savedResult.comparables.map(toPublicComparable),
        message,
      });
    } catch (error) {
      await markEstimateFailed({
        supabase,
        estimateId,
        userId,
        errorMessage: getErrorMessage(error),
      });

      throw error;
    }
  } catch (error) {
    console.error("Fejl i market-price route:", error);

    const status =
      error instanceof SyntaxError ? 400 : getErrorStatus(error);

    return NextResponse.json(
      {
        error:
          error instanceof SyntaxError
            ? "Forespørgslen havde et ugyldigt format."
            : getErrorMessage(error),
      },
      {
        status,
      }
    );
  }
}