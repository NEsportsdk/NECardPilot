import "server-only";

import OpenAI from "openai";

export type MarketSubjectCondition = "raw" | "graded" | "unknown";

export type MarketEvidenceType =
  | "sold"
  | "accepted_offer"
  | "asking"
  | "market_index";

export type MarketCardSubject = {
  playerName: string;
  year: string | null;
  manufacturer: string | null;
  brand: string | null;
  product: string | null;
  setName: string | null;
  cardNumber: string | null;
  parallel: string | null;
  serialNumber: string | null;
  serialNumberedTo: number | null;
  rookieCard: boolean | null;
  autograph: boolean | null;
  memorabilia: boolean | null;
  gradingCompany: string | null;
  grade: string | null;
  targetCurrency: string;
};

export type MarketComparable = {
  sourceName: string;
  sourceDomain: string | null;
  sourceUrl: string;
  externalId: string | null;
  evidenceType: MarketEvidenceType;
  title: string;
  soldAt: string | null;
  price: number;
  shippingPrice: number;
  currency: string;
  exchangeRateToEstimate: number | null;
  normalizedTotal: number | null;
  conditionLabel: string | null;
  gradingCompany: string | null;
  grade: string | null;
  serialNumber: string | null;
  saleFormat: string | null;
  matchScore: number;
  included: boolean;
  exclusionReason: string | null;
  matchNotes: string[];
  metadata: Record<string, unknown>;
};

export type MarketPriceResolution = {
  status: "completed" | "partial" | "failed";
  canonicalTitle: string | null;
  subjectCondition: MarketSubjectCondition;
  gradingCompany: string | null;
  grade: string | null;
  currency: string;
  estimatedValue: number | null;
  lowValue: number | null;
  highValue: number | null;
  confidenceScore: number | null;
  comparableCount: number;
  includedComparableCount: number;
  sourceCount: number;
  searchQuery: string | null;
  valuationSummary: string | null;
  valuationNotes: string[];
  warnings: string[];
  sourceUrls: string[];
  modelName: string;
  responseId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  webSearchCalls: number;
  dataAsOf: string;
  comparables: MarketComparable[];
};

type ResolveMarketPriceInput = {
  openai: OpenAI;
  subject: MarketCardSubject;
};

type PriceEvidenceQuality =
  | "direct_sale_page"
  | "aggregate_completed_sales_page"
  | "hidden_offer"
  | "asking_only"
  | "unknown";

type RawMarketComparable = {
  sourceName: string;
  sourceUrl: string;
  verificationSourceUrl: string | null;
  priceEvidenceQuality: PriceEvidenceQuality;
  externalId: string | null;
  evidenceType: MarketEvidenceType;
  title: string;
  soldAt: string | null;
  price: number;
  shippingPrice: number;
  currency: string;
  exchangeRateToEstimate: number | null;
  normalizedTotal: number | null;
  conditionLabel: string | null;
  gradingCompany: string | null;
  grade: string | null;
  serialNumber: string | null;
  saleFormat: string | null;
  exactIdentityMatch: boolean;
  conditionMatch: boolean;
  sourceReliabilityScore: number;
  matchScore: number;
  recommendedInclude: boolean;
  exclusionReason: string | null;
  matchNotes: string[];
};

type RawMarketResearch = {
  canonicalTitle: string | null;
  subjectCondition: MarketSubjectCondition;
  searchQuery: string;
  researchSummary: string;
  warnings: string[];
  sourceUrls: string[];
  comparables: RawMarketComparable[];
};

type WeightedComparable = {
  comparable: MarketComparable;
  value: number;
  weight: number;
};

const MARKET_MODEL = "gpt-5.6-terra";
const MAX_COMPARABLES = 10;
const MIN_MATCH_SCORE = 82;
const MIN_SOURCE_RELIABILITY = 55;

const TRUSTED_SEARCH_DOMAINS = [
  "ebay.com",
  "ebay.co.uk",
  "ebay.de",
  "ebay.ca",
  "ebay.com.au",
  "130point.com",
  "cardladder.com",
  "psacard.com",
  "fanaticscollect.com",
  "pwccmarketplace.com",
  "goldin.co",
  "ha.com",
  "myslabs.com",
  "comc.com",
  "sportscardspro.com",
  "pricecharting.com",
  "beckett.com",
  "worthpoint.com",
  "ecb.europa.eu",
  "nationalbanken.dk",
  "federalreserve.gov",
  "bankofengland.co.uk",
  "bankofcanada.ca",
  "rba.gov.au",
] as const;

const EBAY_SEARCH_DOMAINS = [
  "ebay.com",
  "ebay.co.uk",
  "ebay.de",
  "ebay.ca",
  "ebay.com.au",
  "130point.com",
  "sportscardspro.com",
  "pricecharting.com",
] as const;

const EXACT_AGGREGATE_SEARCH_DOMAINS = [
  "sportscardspro.com",
  "pricecharting.com",
] as const;

const TRUSTED_AGGREGATE_HISTORY_DOMAINS = new Set([
  "sportscardspro.com",
  "pricecharting.com",
  "130point.com",
  "cardladder.com",
  "psacard.com",
]);

const MAX_TOTAL_COMPARABLES = 18;
const MARKET_MAX_OUTPUT_TOKENS = 12000;
const FX_API_URL = "https://api.frankfurter.dev/v1/latest";
const exchangeRateCache = new Map<string, number | null>();

const marketResearchSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    canonicalTitle: {
      type: ["string", "null"],
      description:
        "The exact canonical card title used for pricing, including year, product, set or insert, player, card number, parallel, and grade when applicable.",
    },
    subjectCondition: {
      type: "string",
      enum: ["raw", "graded", "unknown"],
    },
    searchQuery: {
      type: "string",
      description:
        "A concise human-readable summary of the principal search query used.",
    },
    researchSummary: {
      type: "string",
      description:
        "A short factual summary of the available market evidence. Do not calculate the final estimate here.",
    },
    warnings: {
      type: "array",
      items: {
        type: "string",
      },
    },
    sourceUrls: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "Direct URLs actually opened during web research. Do not invent URLs.",
    },
    comparables: {
      type: "array",
      maxItems: MAX_COMPARABLES,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          sourceName: {
            type: "string",
          },
          sourceUrl: {
            type: "string",
            description:
              "Direct URL for the exact sale/listing when available. If the direct marketplace page could not be opened, this may still be the outbound item URL shown by a trusted completed-sales history page.",
          },
          verificationSourceUrl: {
            type: ["string", "null"],
            description:
              "The exact page where title, completed-sale status, date, and price were visibly verified. Use the trusted aggregate completed-sales page when the outbound marketplace page cannot be opened.",
          },
          priceEvidenceQuality: {
            type: "string",
            enum: [
              "direct_sale_page",
              "aggregate_completed_sales_page",
              "hidden_offer",
              "asking_only",
              "unknown"
            ],
          },
          externalId: {
            type: ["string", "null"],
          },
          evidenceType: {
            type: "string",
            enum: [
              "sold",
              "accepted_offer",
              "asking",
              "market_index",
            ],
          },
          title: {
            type: "string",
          },
          soldAt: {
            type: ["string", "null"],
            description:
              "ISO date or datetime when the sale completed, or null when unknown.",
          },
          price: {
            type: "number",
            minimum: 0,
          },
          shippingPrice: {
            type: "number",
            minimum: 0,
          },
          currency: {
            type: "string",
            description: "Three-letter ISO currency code.",
          },
          exchangeRateToEstimate: {
            type: ["number", "null"],
            minimum: 0,
            description:
              "Multiplier from the original currency into the target estimate currency.",
          },
          normalizedTotal: {
            type: ["number", "null"],
            minimum: 0,
            description:
              "Price plus buyer-paid shipping, converted into the target estimate currency. Null if conversion is not reliable.",
          },
          conditionLabel: {
            type: ["string", "null"],
          },
          gradingCompany: {
            type: ["string", "null"],
          },
          grade: {
            type: ["string", "null"],
          },
          serialNumber: {
            type: ["string", "null"],
          },
          saleFormat: {
            type: ["string", "null"],
          },
          exactIdentityMatch: {
            type: "boolean",
            description:
              "True only when year, player, product, set or insert, card number, and parallel agree with the subject.",
          },
          conditionMatch: {
            type: "boolean",
            description:
              "For raw subjects, true only for raw sales. For graded subjects, true only for the same grading company and grade.",
          },
          sourceReliabilityScore: {
            type: "number",
            minimum: 0,
            maximum: 100,
          },
          matchScore: {
            type: "number",
            minimum: 0,
            maximum: 100,
          },
          recommendedInclude: {
            type: "boolean",
          },
          exclusionReason: {
            type: ["string", "null"],
          },
          matchNotes: {
            type: "array",
            items: {
              type: "string",
            },
          },
        },
        required: [
          "sourceName",
          "sourceUrl",
          "verificationSourceUrl",
          "priceEvidenceQuality",
          "externalId",
          "evidenceType",
          "title",
          "soldAt",
          "price",
          "shippingPrice",
          "currency",
          "exchangeRateToEstimate",
          "normalizedTotal",
          "conditionLabel",
          "gradingCompany",
          "grade",
          "serialNumber",
          "saleFormat",
          "exactIdentityMatch",
          "conditionMatch",
          "sourceReliabilityScore",
          "matchScore",
          "recommendedInclude",
          "exclusionReason",
          "matchNotes",
        ],
      },
    },
  },
  required: [
    "canonicalTitle",
    "subjectCondition",
    "searchQuery",
    "researchSummary",
    "warnings",
    "sourceUrls",
    "comparables",
  ],
} as const;

function slugifyForSportsCardsPro(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[’']/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function getSportsCardsProSportPrefix(subject: MarketCardSubject) {
  const haystack = [
    subject.product,
    subject.brand,
    subject.setName,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  const sportMappings: Array<[string[], string]> = [
    [["basketball", "nba"], "basketball-cards"],
    [["baseball", "mlb"], "baseball-cards"],
    [["football", "nfl"], "football-cards"],
    [["soccer", "fifa"], "soccer-cards"],
    [["hockey", "nhl"], "hockey-cards"],
    [["racing", "nascar"], "racing-cards"],
    [["wrestling", "wwe"], "wrestling-cards"],
    [["ufc", "mma"], "ufc-cards"],
  ];

  return (
    sportMappings.find(([tokens]) =>
      tokens.some((token) => haystack.includes(token))
    )?.[1] ?? null
  );
}

function getFirstYearToken(year: string | null) {
  return year?.match(/(?:19|20)\d{2}/)?.[0] ?? null;
}

function removeWords(value: string, words: Array<string | null>) {
  let result = ` ${value} `;

  for (const word of words) {
    if (!word?.trim()) {
      continue;
    }

    const escapedWord = word
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    result = result.replace(
      new RegExp(`\\b${escapedWord}\\b`, "gi"),
      " "
    );
  }

  return result.replace(/\s+/g, " ").trim();
}

function getSportsCardsProCandidateUrls(subject: MarketCardSubject) {
  const sportPrefix = getSportsCardsProSportPrefix(subject);
  const yearToken = getFirstYearToken(subject.year);
  const cardNumber = normalizeOptionalString(subject.cardNumber);

  if (!sportPrefix || !yearToken || !cardNumber) {
    return [];
  }

  const setSlug = subject.setName
    ? slugifyForSportsCardsPro(subject.setName)
    : "";

  const productSource =
    subject.product ??
    [subject.manufacturer, subject.brand]
      .filter((value): value is string => Boolean(value))
      .join(" ");

  const productCore = removeWords(productSource, [
    subject.year,
    subject.setName,
    "basketball",
    "baseball",
    "football",
    "soccer",
    "hockey",
    "racing",
    "wrestling",
    "ufc",
    "cards",
    "card",
  ]);

  const productSlug = slugifyForSportsCardsPro(productCore);
  const manufacturerBrandSlug = slugifyForSportsCardsPro(
    [subject.manufacturer, subject.brand]
      .filter((value): value is string => Boolean(value))
      .join(" ")
  );

  const categorySlugs = uniqueStrings([
    [sportPrefix, yearToken, productSlug, setSlug]
      .filter(Boolean)
      .join("-"),
    [sportPrefix, yearToken, manufacturerBrandSlug, setSlug]
      .filter(Boolean)
      .join("-"),
    [sportPrefix, yearToken, productSlug]
      .filter(Boolean)
      .join("-"),
  ]);

  const playerSlug = slugifyForSportsCardsPro(subject.playerName);
  const cardNumberSlug = slugifyForSportsCardsPro(cardNumber.replace(/^#/, ""));
  const parallelSlug = subject.parallel
    ? slugifyForSportsCardsPro(subject.parallel)
    : "";

  const itemSlugs = uniqueStrings([
    [playerSlug, parallelSlug, cardNumberSlug]
      .filter(Boolean)
      .join("-"),
    [playerSlug, cardNumberSlug]
      .filter(Boolean)
      .join("-"),
  ]);

  return categorySlugs
    .flatMap((categorySlug) =>
      itemSlugs.map(
        (itemSlug) =>
          `https://www.sportscardspro.com/game/${categorySlug}/${itemSlug}`
      )
    )
    .slice(0, 6);
}

function createExactAggregatePrompt(subject: MarketCardSubject) {
  const candidateUrls = getSportsCardsProCandidateUrls(subject);
  const expectedCondition = getSubjectCondition(subject);

  return `
You are the exact-source extraction layer for a sports trading-card valuation system.

TARGET CARD:
${JSON.stringify(subject, null, 2)}

EXPECTED CONDITION:
${expectedCondition}

POSSIBLE EXACT ITEM PAGES:
${candidateUrls.length > 0 ? candidateUrls.map((url) => `- ${url}`).join("\n") : "- No deterministic candidate URL could be constructed."}

TASK:
1. Open the candidate SportsCardsPro pages first. If none is the exact item, search SportsCardsPro/PriceCharting for the exact player, set or insert, card number, parallel, and print run.
2. Use only the exact item page. A page for the base card, another parallel, another card number, or another grade is not acceptable.
3. For a raw target, inspect the page's Ungraded Sold Listings. Return at most 8 of the most recent unambiguous completed sales.
4. Every unambiguous row in an exact item's completed-sales table may be returned as evidenceType "sold" with priceEvidenceQuality "aggregate_completed_sales_page".
5. Put the exact item history page in verificationSourceUrl. Put the outbound marketplace URL in sourceUrl when it is exposed; otherwise use the exact item history page in sourceUrl too.
6. A row with exactly one visible completed price is usable. If a row shows several conflicting figures and the final amount is not unambiguous, return it as excluded evidence with recommendedInclude false.
7. Hidden accepted-offer amounts, active listings, unsold listings, lots, wrong parallels, and wrong conditions must be excluded.
8. For a valid exact raw sold row, set exactIdentityMatch true, conditionMatch true, sourceReliabilityScore between 80 and 90, matchScore between 90 and 98, and recommendedInclude true.
9. Scores must be written on a 0-100 scale, never a 0-1 scale.
10. If no unambiguous completed sale is visible but the exact page shows a current Ungraded value, return one evidenceType "market_index" observation. It must have recommendedInclude false; the application may use it only as a low-confidence fallback.
11. Keep prices in their original currency. Leave exchangeRateToEstimate and normalizedTotal null when you do not have a reliable conversion; the application converts currency deterministically.
12. Return no more than 8 comparables and keep matchNotes concise.

Return only the structured research result.
`.trim();
}

function createMarketResearchPrompt(subject: MarketCardSubject) {
  const now = new Date().toISOString();

  return `
You are the market-research layer for a professional sports trading-card platform.

CURRENT TIME:
${now}

TARGET CARD:
${JSON.stringify(subject, null, 2)}

Your task is to search the live web for price evidence for this exact card.
Do not produce the final market estimate. The application will calculate it deterministically from your evidence.

SEARCH STRATEGY:
1. Search the exact player, year or season, product, set or insert, card number, parallel, and print run.
2. Search multiple wording variants and marketplace formats. For eBay, explicitly search exact quoted variants that combine the player, card number, print run, set or insert, and parallel.
3. Continue searching until you have either opened the relevant direct sold-item pages or can state that no exact sold page was found. Do not stop at an eBay category page or an active product page.
4. Prefer direct completed-sale pages and auction archives. A reputable exact-card completed-sales history page is also valid evidence when it visibly shows the exact listing title, sale date, and final completed price, even if its outbound marketplace link cannot be opened.
5. Useful sources may include eBay sold records, 130point, Card Ladder, PSA auction prices, Goldin, Fanatics Collect, PWCC archives, Heritage Auctions, and other established auction archives.
6. Active listings may be returned only as evidenceType \"asking\" and must never be recommended for inclusion in the sold-price estimate.
7. A market index may be returned only as evidenceType \"market_index\" and clearly labeled.

IDENTITY RULES:
- The player must match.
- The year or season must match.
- The main product must match.
- The set or insert must match.
- The card number must match character for character.
- The parallel must match. A different color, refractor, print run, autograph, memorabilia version, variation, or base card is not an exact match.
- A seller title may omit the formal parallel name. When Card DNA already provides an exact card number and print-run denominator, and a trusted catalog/product record maps that exact combination to the target parallel with no conflicting evidence, you may still mark the sold listing as an exact identity match. Explain this in matchNotes.
- The numerator of a serial number may differ, but the denominator and parallel must agree.
- Exclude reprints, customs, digital cards, oversized cards, lots, boxes, packs, and unrelated memorabilia.

CONDITION RULES:
- If the target is raw, graded sales are not condition matches.
- If the target is graded, only the same grading company and exact grade are condition matches.
- Do not mix raw, PSA 9, PSA 10, BGS, SGC, or other grades.

PRICE RULES:
- Use only a price that is visibly supported by either the direct completed-sale page or a trusted exact-card completed-sales history page.
- A row on a trusted completed-sales history page may be recommended for inclusion when the row itself visibly shows an unambiguous final price and date. Do not require the outbound eBay page to open in that case.
- Set verificationSourceUrl to the page where the price was actually visible.
- Set priceEvidenceQuality to aggregate_completed_sales_page when a trusted history page is the visible evidence.
- If a best-offer sale does not reveal one unambiguous accepted amount, set priceEvidenceQuality to hidden_offer and do not recommend inclusion.
- If one row shows multiple conflicting price figures, exclude only that row. Do not reject the other unambiguous rows on the same page.
- Keep the original price and currency.
- Add buyer-paid shipping when shown.
- Convert the total into ${subject.targetCurrency} using a current, defensible exchange rate. If conversion is not reliable, set normalizedTotal to null.
- Do not include sales tax.
- Do not invent a sold date, price, source URL, exchange rate, or shipping amount.

SOURCE RULES:
- Use direct evidence URLs, not generic search-result URLs.
- sourceUrl should be the outbound item/auction URL when available.
- verificationSourceUrl must be the exact page that was actually opened and visibly showed the completed price.
- A trusted completed-sales history page is sufficient verification for an unambiguous row even when its outbound eBay page returns a tool error.
- A source may be useful context even when it should be excluded from the estimate.

SCORING RULES:
- exactIdentityMatch is true only when every important identity field agrees.
- conditionMatch is true only when the raw or graded condition agrees exactly.
- sourceReliabilityScore reflects the reliability of the underlying price source.
- matchScore reflects identity, condition, price visibility, and evidence quality.
- recommendedInclude may be true only for exact, condition-matched sold or accepted-offer evidence with one visible final price.
- An unambiguous row on a trusted completed-sales history page counts as a visible final price.
- Asking prices must always have recommendedInclude false.

Return only the structured research result.
`.trim();
}

function createEbayFallbackPrompt(subject: MarketCardSubject) {
  const quotedParts = [
    subject.playerName,
    subject.year,
    subject.product,
    subject.setName,
    subject.cardNumber,
    subject.parallel,
    subject.serialNumberedTo ? `/${subject.serialNumberedTo}` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => `"${value}"`)
    .join(" ");

  return `
You are performing a second, targeted sold-listing search because a broad market search did not produce a usable exact comparable.

TARGET CARD:
${JSON.stringify(subject, null, 2)}

RUN THESE SEARCH PATTERNS AND CLOSE VARIANTS:
- site:ebay.com/itm ${quotedParts} sold
- site:ebay.com/itm "${subject.playerName}" "${subject.cardNumber ?? ""}" "${subject.serialNumberedTo ? `/${subject.serialNumberedTo}` : ""}"
- site:ebay.com/itm "${subject.setName ?? ""}" "${subject.parallel ?? ""}" "${subject.playerName}"
- site:130point.com "${subject.playerName}" "${subject.cardNumber ?? ""}" "${subject.serialNumberedTo ? `/${subject.serialNumberedTo}` : ""}"

REQUIREMENTS:
1. Open direct eBay item pages when available. Also open exact-card completed-sales history pages from SportsCardsPro/PriceCharting or 130point. Do not return only category, product, or generic search-result pages.
2. Verify that either the direct page or the exact-card history row explicitly represents a completed sale.
3. Extract the visible completed price and sold date. For an auction, the final bid price is usable. An unambiguous completed-sales-history row is usable even when its outbound eBay page cannot be opened.
4. For Best Offer Accepted, use a numeric price only when the accepted amount is visibly shown as the completed price. If the page merely shows the original asking price, return it as excluded evidence and explain that the accepted amount is hidden.
5. Verify player, season, product, insert/set, card number, raw/graded condition, and print-run denominator.
6. If the seller title omits the formal parallel name but the exact card number plus print run maps uniquely to the target parallel and nothing conflicts, exactIdentityMatch may be true. Explain the mapping in matchNotes.
7. Do not use active asking prices in the estimate.
8. Never invent an eBay item number or URL. Put the outbound item URL in sourceUrl when it is shown by the history page, and put the actually opened history page in verificationSourceUrl.
9. Set priceEvidenceQuality accurately. Use aggregate_completed_sales_page for an unambiguous trusted history row; hidden_offer for an undisclosed accepted offer; asking_only for an active/unsold listing.
10. Keep original currencies. If you cannot confidently convert to ${subject.targetCurrency}, leave exchangeRateToEstimate and normalizedTotal null; the application will attempt a deterministic central-bank conversion.
11. Return only the structured research result.
`.trim();
}

type MarketResearchRun = {
  research: RawMarketResearch;
  actualSourceUrls: string[];
  modelSourceUrls: string[];
  responseId: string | null;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  webSearchCalls: number;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundScore(value: number) {
  return Math.round(clamp(value, 0, 100) * 100) / 100;
}

/**
 * The research model occasionally returns confidence values as 0..1 even
 * though the schema describes 0..100. Accept both scales so an otherwise
 * valid sale is not rejected merely because 0.92 was interpreted as 0.92%.
 */
function normalizeResearchScore(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return roundScore(value >= 0 && value <= 1 ? value * 100 : value);
}

function uniqueStrings(values: string[]) {
  return Array.from(
    new Set(
      values
        .filter((value) => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function normalizeCurrency(value: string, fallback: string) {
  const normalizedValue = value.trim().toUpperCase();

  return /^[A-Z]{3}$/.test(normalizedValue)
    ? normalizedValue
    : fallback;
}

function normalizeOptionalString(value: string | null) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  return normalizedValue || null;
}

function normalizeUrl(value: string) {
  try {
    const url = new URL(value.trim());

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    url.hash = "";

    return url.toString();
  } catch {
    return null;
  }
}

function getSourceDomain(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function getComparableUrlKey(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const path = decodeURIComponent(url.pathname)
      .replace(/\/+$/, "")
      .toLowerCase();

    return `${host}${path}`;
  } catch {
    return value.trim().toLowerCase();
  }
}

function urlsAreEquivalent(first: string, second: string) {
  try {
    const firstUrl = new URL(first);
    const secondUrl = new URL(second);

    const firstHost = firstUrl.hostname.replace(/^www\./, "").toLowerCase();
    const secondHost = secondUrl.hostname.replace(/^www\./, "").toLowerCase();

    if (firstHost !== secondHost) {
      return false;
    }

    const firstPath = decodeURIComponent(firstUrl.pathname)
      .replace(/\/+$/, "")
      .toLowerCase();
    const secondPath = decodeURIComponent(secondUrl.pathname)
      .replace(/\/+$/, "")
      .toLowerCase();

    if (firstPath === secondPath) {
      return true;
    }

    const shorterPath =
      firstPath.length <= secondPath.length ? firstPath : secondPath;
    const longerPath =
      firstPath.length > secondPath.length ? firstPath : secondPath;

    return shorterPath.length >= 12 && longerPath.startsWith(shorterPath);
  } catch {
    return false;
  }
}

function addSourceUrl(value: unknown, urls: Set<string>) {
  if (typeof value !== "string") {
    return;
  }

  const normalizedUrl = normalizeUrl(value);

  if (normalizedUrl) {
    urls.add(normalizedUrl);
  }
}

function extractWebSourceUrls(output: unknown) {
  const urls = new Set<string>();

  if (!Array.isArray(output)) {
    return [];
  }

  for (const outputItem of output) {
    if (typeof outputItem !== "object" || outputItem === null) {
      continue;
    }

    const item = outputItem as Record<string, unknown>;

    if (item.type === "web_search_call") {
      const action = item.action;

      if (typeof action === "object" && action !== null) {
        const sources = (action as Record<string, unknown>).sources;

        if (Array.isArray(sources)) {
          for (const source of sources) {
            if (typeof source === "object" && source !== null) {
              addSourceUrl((source as Record<string, unknown>).url, urls);
            }
          }
        }
      }
    }

    if (item.type === "message" && Array.isArray(item.content)) {
      for (const contentItem of item.content) {
        if (typeof contentItem !== "object" || contentItem === null) {
          continue;
        }

        const annotations = (contentItem as Record<string, unknown>).annotations;

        if (!Array.isArray(annotations)) {
          continue;
        }

        for (const annotation of annotations) {
          if (typeof annotation !== "object" || annotation === null) {
            continue;
          }

          const annotationRecord = annotation as Record<string, unknown>;
          addSourceUrl(annotationRecord.url, urls);

          if (
            typeof annotationRecord.url_citation === "object" &&
            annotationRecord.url_citation !== null
          ) {
            addSourceUrl(
              (annotationRecord.url_citation as Record<string, unknown>).url,
              urls
            );
          }
        }
      }
    }
  }

  return Array.from(urls);
}

function countObjectType(
  value: unknown,
  objectType: string,
  seen = new WeakSet<object>(),
  depth = 0
): number {
  if (depth > 14 || value === null || value === undefined) {
    return 0;
  }

  if (Array.isArray(value)) {
    return value.reduce<number>(
      (total, item) =>
        total + countObjectType(item, objectType, seen, depth + 1),
      0
    );
  }

  if (typeof value !== "object") {
    return 0;
  }

  if (seen.has(value)) {
    return 0;
  }

  seen.add(value);

  const record = value as Record<string, unknown>;
  const ownCount = record.type === objectType ? 1 : 0;

  return (
    ownCount +
    Object.values(record).reduce<number>(
      (total, item) =>
        total + countObjectType(item, objectType, seen, depth + 1),
      0
    )
  );
}

function parseStructuredOutput<T>(outputText: string, label: string): T {
  const trimmedOutput = outputText.trim();
  const withoutCodeFence = trimmedOutput
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const candidates = [withoutCodeFence];
  const firstBrace = withoutCodeFence.indexOf("{");
  const lastBrace = withoutCodeFence.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(withoutCodeFence.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of uniqueStrings(candidates)) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // Try the next candidate before reporting the complete response.
    }
  }

  console.error(`Could not parse ${label}:`, {
    outputText,
  });

  throw new Error(`${label} returned invalid JSON.`);
}

function getSubjectCondition(subject: MarketCardSubject): MarketSubjectCondition {
  if (subject.gradingCompany && subject.grade) {
    return "graded";
  }

  if (!subject.gradingCompany && !subject.grade) {
    return "raw";
  }

  return "unknown";
}

function validateSubject(subject: MarketCardSubject) {
  if (!subject.playerName.trim()) {
    throw new Error("Player name is required before market research can run.");
  }

  const identitySignals = [
    subject.year,
    subject.product,
    subject.setName,
    subject.cardNumber,
    subject.parallel,
    subject.serialNumberedTo,
  ].filter((value) => value !== null && value !== undefined && value !== "");

  if (identitySignals.length < 3) {
    throw new Error(
      "The card identity is not specific enough for reliable market research."
    );
  }

  if (!/^[A-Z]{3}$/.test(subject.targetCurrency.trim().toUpperCase())) {
    throw new Error("The target currency must be a three-letter ISO code.");
  }
}

function isDirectTrustedEvidenceUrl(
  sourceUrl: string,
  comparable: RawMarketComparable
) {
  try {
    const url = new URL(sourceUrl);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const path = decodeURIComponent(url.pathname).replace(/\/+$/, "");

    if (
      ![
        "ebay.com",
        "ebay.co.uk",
        "ebay.de",
        "ebay.ca",
        "ebay.com.au",
      ].includes(host)
    ) {
      return false;
    }

    const itemIdMatch = path.match(/^\/itm\/(\d{9,15})$/i);

    if (!itemIdMatch) {
      return false;
    }

    const urlItemId = itemIdMatch[1];
    const externalItemId = comparable.externalId?.replace(/\D/g, "") ?? "";
    const externalIdMatches =
      externalItemId.length === 0 || externalItemId === urlItemId;

    return (
      externalIdMatches &&
      normalizeResearchScore(comparable.sourceReliabilityScore) >= 85 &&
      comparable.exactIdentityMatch &&
      comparable.conditionMatch &&
      comparable.recommendedInclude &&
      (comparable.evidenceType === "sold" ||
        comparable.evidenceType === "accepted_offer")
    );
  } catch {
    return false;
  }
}


function isTrustedAggregateHistoryUrl(
  verificationSourceUrl: string | null,
  comparable: RawMarketComparable
) {
  if (!verificationSourceUrl) {
    return false;
  }

  try {
    const url = new URL(verificationSourceUrl);
    const host = url.hostname
      .replace(/^www\./, "")
      .toLowerCase();
    const path = decodeURIComponent(url.pathname)
      .replace(/\/+$/, "");

    return (
      TRUSTED_AGGREGATE_HISTORY_DOMAINS.has(host) &&
      path.length >= 8 &&
      normalizeResearchScore(comparable.sourceReliabilityScore) >= 75 &&
      comparable.exactIdentityMatch &&
      comparable.conditionMatch &&
      (comparable.evidenceType === "sold" ||
        comparable.evidenceType === "accepted_offer") &&
      comparable.priceEvidenceQuality !== "hidden_offer" &&
      comparable.priceEvidenceQuality !== "asking_only"
    );
  } catch {
    return false;
  }
}

function findTrustedAggregateSourceUrl(actualSourceUrls: string[]) {
  return (
    actualSourceUrls.find((sourceUrl) => {
      try {
        const url = new URL(sourceUrl);
        const host = url.hostname
          .replace(/^www\./, "")
          .toLowerCase();
        const path = decodeURIComponent(url.pathname)
          .replace(/\/+$/, "");

        return (
          TRUSTED_AGGREGATE_HISTORY_DOMAINS.has(host) &&
          path.length >= 8
        );
      } catch {
        return false;
      }
    }) ?? null
  );
}

function hasUnsafeAggregateEvidenceReason(reason: string | null) {
  if (!reason) {
    return false;
  }

  const normalizedReason = reason.toLowerCase();

  return [
    "conflict",
    "ambiguous",
    "hidden",
    "undisclosed",
    "asking",
    "not sold",
    "unsold",
    "wrong card",
    "different parallel",
    "different grade",
    "different condition",
    "lot",
    "box",
    "pack",
    "price unavailable",
    "price not visible",
    "no visible price",
  ].some((token) => normalizedReason.includes(token));
}

async function fetchExchangeRate(fromCurrency: string, toCurrency: string) {
  const from = fromCurrency.trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();

  if (from === to) {
    return 1;
  }

  const cacheKey = `${from}:${to}`;

  if (exchangeRateCache.has(cacheKey)) {
    return exchangeRateCache.get(cacheKey) ?? null;
  }

  try {
    const url = new URL(FX_API_URL);
    url.searchParams.set("base", from);
    url.searchParams.set("symbols", to);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      exchangeRateCache.set(cacheKey, null);
      return null;
    }

    const body = (await response.json()) as {
      rates?: Record<string, unknown>;
    };
    const rate = Number(body.rates?.[to]);
    const normalizedRate = Number.isFinite(rate) && rate > 0 ? rate : null;

    exchangeRateCache.set(cacheKey, normalizedRate);
    return normalizedRate;
  } catch (error) {
    console.error("Could not retrieve fallback exchange rate:", {
      from,
      to,
      error,
    });
    exchangeRateCache.set(cacheKey, null);
    return null;
  }
}

async function getFallbackExchangeRates(
  comparables: RawMarketComparable[],
  targetCurrency: string
) {
  const currencies = uniqueStrings(
    comparables.map((comparable) =>
      normalizeCurrency(comparable.currency, targetCurrency)
    )
  ).filter((currency) => currency !== targetCurrency);

  const entries = await Promise.all(
    currencies.map(async (currency) => [
      currency,
      await fetchExchangeRate(currency, targetCurrency),
    ] as const)
  );

  return new Map<string, number | null>(entries);
}

function sourceWasVerified(sourceUrl: string, actualSourceUrls: string[]) {
  if (actualSourceUrls.length === 0) {
    return false;
  }

  return actualSourceUrls.some((actualUrl) =>
    urlsAreEquivalent(sourceUrl, actualUrl)
  );
}

function getInitialExclusionReason(
  comparable: RawMarketComparable,
  sourceVerified: boolean,
  actualSourceListAvailable: boolean,
  trustedDirectEvidenceUrl: boolean,
  trustedAggregateHistoryUrl: boolean,
  normalizedTotal: number | null
) {
  if (
    comparable.priceEvidenceQuality === "hidden_offer" ||
    comparable.priceEvidenceQuality === "asking_only"
  ) {
    return (
      comparable.exclusionReason ??
      "The final completed price was not visibly available."
    );
  }

  const aggregateOverrideAllowed =
    trustedAggregateHistoryUrl &&
    !hasUnsafeAggregateEvidenceReason(comparable.exclusionReason) &&
    normalizeResearchScore(comparable.matchScore) >= MIN_MATCH_SCORE &&
    normalizeResearchScore(comparable.sourceReliabilityScore) >= 75 &&
    normalizedTotal !== null &&
    Number.isFinite(normalizedTotal) &&
    normalizedTotal > 0;

  if (!comparable.recommendedInclude && !aggregateOverrideAllowed) {
    return (
      comparable.exclusionReason ??
      "Research model did not recommend inclusion."
    );
  }

  if (
    comparable.evidenceType !== "sold" &&
    comparable.evidenceType !== "accepted_offer"
  ) {
    return "Only completed sold or visible accepted-offer evidence is used.";
  }

  if (!comparable.exactIdentityMatch) {
    return "Card identity does not match exactly.";
  }

  if (!comparable.conditionMatch) {
    return "Raw or graded condition does not match the subject.";
  }

  if (normalizeResearchScore(comparable.matchScore) < MIN_MATCH_SCORE) {
    return `Match score is below ${MIN_MATCH_SCORE}.`;
  }

  if (normalizeResearchScore(comparable.sourceReliabilityScore) < MIN_SOURCE_RELIABILITY) {
    return `Source reliability is below ${MIN_SOURCE_RELIABILITY}.`;
  }

  if (
    normalizedTotal === null ||
    !Number.isFinite(normalizedTotal) ||
    normalizedTotal <= 0
  ) {
    return "A reliable normalized total price is unavailable.";
  }

  if (
    actualSourceListAvailable &&
    !sourceVerified &&
    !trustedDirectEvidenceUrl &&
    !trustedAggregateHistoryUrl
  ) {
    return "Neither the evidence URL nor its trusted verification page was present in the web-search source list.";
  }

  return null;
}

function normalizeComparable(
  comparable: RawMarketComparable,
  targetCurrency: string,
  actualSourceUrls: string[],
  verificationSourceCandidates: string[],
  fallbackExchangeRates: Map<string, number | null>
): MarketComparable | null {
  const sourceUrl = normalizeUrl(comparable.sourceUrl);
  const verificationSourceUrl = normalizeOptionalString(
    comparable.verificationSourceUrl
  );
  const normalizedVerificationSourceUrl =
    (verificationSourceUrl
      ? normalizeUrl(verificationSourceUrl)
      : null) ?? findTrustedAggregateSourceUrl(verificationSourceCandidates);

  if (!sourceUrl && !normalizedVerificationSourceUrl) {
    return null;
  }

  const effectiveSourceUrl = sourceUrl ?? normalizedVerificationSourceUrl as string;
  const directSourceVerified = sourceUrl
    ? sourceWasVerified(sourceUrl, actualSourceUrls)
    : false;
  const verificationSourceVerified = normalizedVerificationSourceUrl
    ? sourceWasVerified(normalizedVerificationSourceUrl, actualSourceUrls)
    : false;
  const sourceVerified = directSourceVerified || verificationSourceVerified;
  const actualSourceListAvailable = actualSourceUrls.length > 0;
  const trustedDirectEvidenceUrl = sourceUrl
    ? isDirectTrustedEvidenceUrl(sourceUrl, comparable)
    : false;
  const trustedAggregateHistoryUrl = isTrustedAggregateHistoryUrl(
    normalizedVerificationSourceUrl,
    comparable
  );

  const price = roundMoney(Math.max(0, comparable.price));
  const shippingPrice = roundMoney(Math.max(0, comparable.shippingPrice));
  const comparableCurrency = normalizeCurrency(
    comparable.currency,
    targetCurrency
  );
  const modelExchangeRate =
    comparable.exchangeRateToEstimate !== null &&
    Number.isFinite(comparable.exchangeRateToEstimate) &&
    comparable.exchangeRateToEstimate > 0
      ? comparable.exchangeRateToEstimate
      : null;
  const fallbackExchangeRate =
    fallbackExchangeRates.get(comparableCurrency) ?? null;
  const exchangeRateToEstimate =
    comparableCurrency === targetCurrency
      ? 1
      : modelExchangeRate ?? fallbackExchangeRate;
  const normalizedTotal =
    exchangeRateToEstimate !== null
      ? roundMoney((price + shippingPrice) * exchangeRateToEstimate)
      : null;

  /*
   * Inclusion must be decided after deterministic FX conversion.
   * The model is allowed to leave normalizedTotal null, and the
   * application then fills it from central-bank exchange-rate data.
   */
  const exclusionReason = getInitialExclusionReason(
    comparable,
    sourceVerified,
    actualSourceListAvailable,
    trustedDirectEvidenceUrl,
    trustedAggregateHistoryUrl,
    normalizedTotal
  );

  return {
    sourceName: comparable.sourceName.trim() || "Unknown source",
    sourceDomain: getSourceDomain(effectiveSourceUrl),
    sourceUrl: effectiveSourceUrl,
    externalId: normalizeOptionalString(comparable.externalId),
    evidenceType: comparable.evidenceType,
    title: comparable.title.trim() || "Untitled market evidence",
    soldAt: normalizeOptionalString(comparable.soldAt),
    price,
    shippingPrice,
    currency: comparableCurrency,
    exchangeRateToEstimate,
    normalizedTotal,
    conditionLabel: normalizeOptionalString(comparable.conditionLabel),
    gradingCompany: normalizeOptionalString(comparable.gradingCompany),
    grade: normalizeOptionalString(comparable.grade),
    serialNumber: normalizeOptionalString(comparable.serialNumber),
    saleFormat: normalizeOptionalString(comparable.saleFormat),
    matchScore: normalizeResearchScore(comparable.matchScore),
    included: exclusionReason === null,
    exclusionReason,
    matchNotes: uniqueStrings([
      ...comparable.matchNotes,
      ...(trustedAggregateHistoryUrl &&
      exclusionReason === null &&
      !comparable.recommendedInclude
        ? [
            "Included deterministically from a trusted exact-card completed-sales history row even though the outbound marketplace page could not be opened.",
          ]
        : []),
    ]),
    metadata: {
      exactIdentityMatch: comparable.exactIdentityMatch,
      conditionMatch: comparable.conditionMatch,
      sourceReliabilityScore: normalizeResearchScore(comparable.sourceReliabilityScore),
      recommendedInclude: comparable.recommendedInclude,
      sourceVerified,
      directSourceVerified,
      verificationSourceVerified,
      actualSourceListAvailable,
      trustedDirectEvidenceUrl,
      trustedAggregateHistoryUrl,
      verificationSourceUrl: normalizedVerificationSourceUrl,
      priceEvidenceQuality: comparable.priceEvidenceQuality,
      exchangeRateSource:
        comparableCurrency === targetCurrency
          ? "identity"
          : modelExchangeRate !== null
            ? "research_model"
            : fallbackExchangeRate !== null
              ? "frankfurter_central_bank_data"
              : null,
      modelNormalizedTotal: comparable.normalizedTotal,
    },
  };
}

function median(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const sortedValues = [...values].sort((first, second) => first - second);
  const midpoint = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 0) {
    return (sortedValues[midpoint - 1] + sortedValues[midpoint]) / 2;
  }

  return sortedValues[midpoint];
}

function removeStatisticalOutliers(comparables: MarketComparable[]) {
  const includedComparables = comparables.filter(
    (comparable) => comparable.included && comparable.normalizedTotal !== null
  );

  if (includedComparables.length < 4) {
    return comparables;
  }

  const values = includedComparables.map(
    (comparable) => comparable.normalizedTotal as number
  );
  const center = median(values);

  if (center === null || center <= 0) {
    return comparables;
  }

  const deviations = values.map((value) => Math.abs(value - center));
  const medianAbsoluteDeviation = median(deviations) ?? 0;

  return comparables.map((comparable) => {
    if (!comparable.included || comparable.normalizedTotal === null) {
      return comparable;
    }

    const value = comparable.normalizedTotal;
    const ratio = value / center;
    const ratioOutlier = ratio < 0.25 || ratio > 4;
    const robustZScore =
      medianAbsoluteDeviation > 0
        ? (0.6745 * (value - center)) / medianAbsoluteDeviation
        : 0;
    const madOutlier =
      medianAbsoluteDeviation > 0 && Math.abs(robustZScore) > 3.5;

    if (!ratioOutlier && !madOutlier) {
      return comparable;
    }

    return {
      ...comparable,
      included: false,
      exclusionReason: "Price was excluded as a statistical outlier.",
      matchNotes: uniqueStrings([
        ...comparable.matchNotes,
        `Observed normalized price ${roundMoney(value)} was far from the robust center ${roundMoney(center)}.`,
      ]),
      metadata: {
        ...comparable.metadata,
        statisticalOutlier: true,
        robustZScore: roundScore(Math.abs(robustZScore)),
      },
    };
  });
}

function getRecencyWeight(soldAt: string | null) {
  if (!soldAt) {
    return 0.6;
  }

  const soldDate = new Date(soldAt);

  if (Number.isNaN(soldDate.getTime())) {
    return 0.6;
  }

  const ageInDays = Math.max(
    0,
    (Date.now() - soldDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (ageInDays <= 30) {
    return 1;
  }

  if (ageInDays <= 90) {
    return 0.88;
  }

  if (ageInDays <= 180) {
    return 0.74;
  }

  if (ageInDays <= 365) {
    return 0.58;
  }

  if (ageInDays <= 730) {
    return 0.4;
  }

  return 0.28;
}

function getSourceReliability(comparable: MarketComparable) {
  const metadataValue = comparable.metadata.sourceReliabilityScore;

  return typeof metadataValue === "number" && Number.isFinite(metadataValue)
    ? clamp(metadataValue, 0, 100)
    : 50;
}

function createWeightedComparables(
  comparables: MarketComparable[]
): WeightedComparable[] {
  return comparables
    .filter(
      (comparable) => comparable.included && comparable.normalizedTotal !== null
    )
    .map((comparable) => {
      const matchWeight = clamp(comparable.matchScore / 100, 0.4, 1);
      const reliabilityWeight = clamp(
        getSourceReliability(comparable) / 100,
        0.5,
        1
      );
      const recencyWeight = getRecencyWeight(comparable.soldAt);
      const evidenceWeight =
        comparable.evidenceType === "accepted_offer" ? 0.92 : 1;

      return {
        comparable,
        value: comparable.normalizedTotal as number,
        weight:
          matchWeight * reliabilityWeight * recencyWeight * evidenceWeight,
      };
    });
}

function weightedQuantile(
  comparables: WeightedComparable[],
  quantile: number
) {
  if (comparables.length === 0) {
    return null;
  }

  const sortedComparables = [...comparables].sort(
    (first, second) => first.value - second.value
  );
  const totalWeight = sortedComparables.reduce(
    (total, comparable) => total + comparable.weight,
    0
  );

  if (totalWeight <= 0) {
    return median(sortedComparables.map((comparable) => comparable.value));
  }

  const targetWeight = clamp(quantile, 0, 1) * totalWeight;
  let accumulatedWeight = 0;

  for (const comparable of sortedComparables) {
    accumulatedWeight += comparable.weight;

    if (accumulatedWeight >= targetWeight) {
      return comparable.value;
    }
  }

  return sortedComparables[sortedComparables.length - 1].value;
}

function calculateRange(weightedComparables: WeightedComparable[]) {
  const estimate = weightedQuantile(weightedComparables, 0.5);

  if (estimate === null) {
    return {
      estimate: null,
      low: null,
      high: null,
    };
  }

  if (weightedComparables.length === 1) {
    return {
      estimate: roundMoney(estimate),
      low: roundMoney(estimate * 0.8),
      high: roundMoney(estimate * 1.2),
    };
  }

  if (weightedComparables.length === 2) {
    const values = weightedComparables
      .map((comparable) => comparable.value)
      .sort((first, second) => first - second);

    return {
      estimate: roundMoney(estimate),
      low: roundMoney(values[0] * 0.95),
      high: roundMoney(values[1] * 1.05),
    };
  }

  const low = weightedQuantile(weightedComparables, 0.2) ?? estimate;
  const high = weightedQuantile(weightedComparables, 0.8) ?? estimate;

  return {
    estimate: roundMoney(estimate),
    low: roundMoney(Math.min(low, estimate)),
    high: roundMoney(Math.max(high, estimate)),
  };
}

function getCountConfidenceScore(count: number) {
  if (count <= 0) return 0;
  if (count === 1) return 35;
  if (count === 2) return 52;
  if (count === 3) return 65;
  if (count === 4) return 72;
  if (count === 5) return 78;
  if (count === 6) return 82;
  if (count <= 8) return 86;
  if (count <= 10) return 89;
  return 91;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function calculateConfidence({
  weightedComparables,
  estimate,
  low,
  high,
  actualSourceListAvailable,
  subject,
}: {
  weightedComparables: WeightedComparable[];
  estimate: number | null;
  low: number | null;
  high: number | null;
  actualSourceListAvailable: boolean;
  subject: MarketCardSubject;
}) {
  if (weightedComparables.length === 0 || estimate === null) {
    return null;
  }

  let score = getCountConfidenceScore(weightedComparables.length);

  const averageMatchScore = average(
    weightedComparables.map((item) => item.comparable.matchScore)
  );
  const averageSourceReliability = average(
    weightedComparables.map((item) => getSourceReliability(item.comparable))
  );
  const averageRecency = average(
    weightedComparables.map((item) => getRecencyWeight(item.comparable.soldAt))
  );
  const sourceDomains = new Set(
    weightedComparables
      .map((item) => item.comparable.sourceDomain)
      .filter((domain): domain is string => Boolean(domain))
  );

  score += ((averageMatchScore - 75) / 25) * 5;
  score += ((averageSourceReliability - 55) / 45) * 4;
  score += averageRecency * 4;
  score += Math.min(4, Math.max(0, sourceDomains.size - 1) * 1.5);

  if (low !== null && high !== null && estimate > 0) {
    const relativeSpread = (high - low) / estimate;

    if (relativeSpread > 1) {
      score -= 18;
    } else if (relativeSpread > 0.7) {
      score -= 12;
    } else if (relativeSpread > 0.45) {
      score -= 7;
    } else if (relativeSpread > 0.25) {
      score -= 3;
    }
  }

  if (!actualSourceListAvailable) {
    score = Math.min(score, 60);
  }

  if (!subject.cardNumber || !subject.parallel) {
    score = Math.min(score, 72);
  }

  if (weightedComparables.length === 1) {
    score = Math.min(score, 48);
  }

  if (weightedComparables.length === 2) {
    score = Math.min(score, 64);
  }

  return roundScore(Math.min(score, 95));
}

function buildValuationSummary({
  includedCount,
  estimate,
  low,
  high,
  currency,
}: {
  includedCount: number;
  estimate: number | null;
  low: number | null;
  high: number | null;
  currency: string;
}) {
  if (estimate === null) {
    return "No sufficiently reliable exact sold comparables were available for an automatic market estimate.";
  }

  const rangeText =
    low !== null && high !== null
      ? ` The current evidence range is ${low.toLocaleString("en-US")} to ${high.toLocaleString("en-US")} ${currency}.`
      : "";

  return `The estimate is based on ${includedCount} exact sold comparable${
    includedCount === 1 ? "" : "s"
  } and a recency-, match-, and source-weighted median.${rangeText}`;
}

function addEvidenceFragment(
  sourceUrl: string,
  comparable: MarketComparable,
  occurrence: number
) {
  try {
    const url = new URL(sourceUrl);
    const dateToken = (comparable.soldAt ?? "unknown-date")
      .replace(/[^0-9a-z]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    const priceToken = comparable.price.toFixed(2).replace(".", "-");

    url.hash = `necp-sale-${dateToken}-${priceToken}-${occurrence}`;
    return url.toString();
  } catch {
    return sourceUrl;
  }
}

function finalizeComparables(
  normalizedComparables: MarketComparable[]
): MarketComparable[] {
  const seenEvidenceKeys = new Set<string>();
  const sourceUrlOccurrences = new Map<string, number>();

  const deduplicatedComparables = normalizedComparables.map((comparable) => {
    const sourceKey = getComparableUrlKey(comparable.sourceUrl);
    const evidenceKey = [
      sourceKey,
      comparable.soldAt ?? "unknown-date",
      comparable.price.toFixed(2),
      comparable.title.trim().toLowerCase(),
    ].join("|");

    if (seenEvidenceKeys.has(evidenceKey)) {
      return {
        ...comparable,
        included: false,
        exclusionReason: "Duplicate price evidence.",
        metadata: {
          ...comparable.metadata,
          duplicate: true,
        },
      };
    }

    seenEvidenceKeys.add(evidenceKey);

    const occurrence = sourceUrlOccurrences.get(sourceKey) ?? 0;
    sourceUrlOccurrences.set(sourceKey, occurrence + 1);

    if (occurrence === 0) {
      return comparable;
    }

    /*
     * card_market_comparables currently has a unique constraint on
     * (estimate_id, source_url). Multiple distinct completed-sale rows may
     * live on the same aggregate history page, so add a harmless fragment to
     * keep each evidence row persistable while all links still open the same
     * source page.
     */
    return {
      ...comparable,
      sourceUrl: addEvidenceFragment(
        comparable.sourceUrl,
        comparable,
        occurrence + 1
      ),
      metadata: {
        ...comparable.metadata,
        sharedAggregateSourcePage: true,
      },
    };
  });

  return removeStatisticalOutliers(deduplicatedComparables);
}

async function runMarketResearch({
  openai,
  prompt,
  allowedDomains,
  effort,
  schemaName,
}: {
  openai: OpenAI;
  prompt: string;
  allowedDomains: readonly string[];
  effort: "low" | "medium" | "high";
  schemaName: string;
}): Promise<MarketResearchRun> {
  const response = await openai.responses.create({
    model: MARKET_MODEL,
    store: false,
    reasoning: {
      effort,
    },
    tools: [
      {
        type: "web_search",
        filters: {
          allowed_domains: [...allowedDomains],
        },
      },
    ],
    tool_choice: "required",
    include: ["web_search_call.action.sources"],
    input: prompt,
    text: {
      format: {
        type: "json_schema",
        name: schemaName,
        strict: true,
        schema: marketResearchSchema,
      },
    },
    max_output_tokens: MARKET_MAX_OUTPUT_TOKENS,
  });

  const responseForInspection = response as unknown as {
    output?: unknown;
    id?: string;
    model?: string;
    status?: string;
    incomplete_details?: {
      reason?: string | null;
    } | null;
    error?: {
      message?: string | null;
    } | null;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
    };
  };

  if (responseForInspection.status === "incomplete") {
    const reason =
      responseForInspection.incomplete_details?.reason ??
      "the response reached an internal limit";

    throw new Error(`Market research was incomplete because ${reason}.`);
  }

  if (responseForInspection.status === "failed") {
    throw new Error(
      responseForInspection.error?.message ?? "Market research failed."
    );
  }

  if (!response.output_text) {
    console.error("Market research returned no output:", response);
    throw new Error("Market research did not return a usable result.");
  }

  const research = parseStructuredOutput<RawMarketResearch>(
    response.output_text,
    "Market research"
  );

  return {
    research,
    actualSourceUrls: uniqueStrings(
      extractWebSourceUrls(responseForInspection.output)
    ),
    modelSourceUrls: uniqueStrings(
      research.sourceUrls
        .map((sourceUrl) => normalizeUrl(sourceUrl))
        .filter((sourceUrl): sourceUrl is string => Boolean(sourceUrl))
    ),
    responseId: responseForInspection.id ?? null,
    modelName: responseForInspection.model ?? MARKET_MODEL,
    inputTokens: responseForInspection.usage?.input_tokens ?? 0,
    outputTokens: responseForInspection.usage?.output_tokens ?? 0,
    webSearchCalls: countObjectType(
      responseForInspection.output,
      "web_search_call"
    ),
  };
}

async function normalizeResearchComparables({
  rawComparables,
  targetCurrency,
  actualSourceUrls,
  verificationSourceCandidates,
}: {
  rawComparables: RawMarketComparable[];
  targetCurrency: string;
  actualSourceUrls: string[];
  verificationSourceCandidates: string[];
}) {
  const fallbackExchangeRates = await getFallbackExchangeRates(
    rawComparables,
    targetCurrency
  );

  return rawComparables
    .slice(0, MAX_TOTAL_COMPARABLES)
    .map((comparable) =>
      normalizeComparable(
        comparable,
        targetCurrency,
        actualSourceUrls,
        verificationSourceCandidates,
        fallbackExchangeRates
      )
    )
    .filter((comparable): comparable is MarketComparable => Boolean(comparable));
}

export async function resolveMarketPrice({
  openai,
  subject,
}: ResolveMarketPriceInput): Promise<MarketPriceResolution> {
  validateSubject(subject);

  const targetCurrency = subject.targetCurrency.trim().toUpperCase();
  const normalizedSubject = {
    ...subject,
    targetCurrency,
  };
  const expectedSubjectCondition = getSubjectCondition(normalizedSubject);

  let researchRuns: MarketResearchRun[] = [];
  let combinedRawComparables: RawMarketComparable[] = [];
  let combinedActualSourceUrls: string[] = [];
  let combinedModelSourceUrls: string[] = [];
  const warnings: string[] = [];
  const valuationNotes: string[] = [];

  const getResearchErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : "Unknown market-research error.";

  function addResearchRun(
    run: MarketResearchRun,
    note?: string
  ) {
    researchRuns = [...researchRuns, run];
    combinedRawComparables = [
      ...combinedRawComparables,
      ...run.research.comparables,
    ];
    combinedActualSourceUrls = uniqueStrings([
      ...combinedActualSourceUrls,
      ...run.actualSourceUrls,
    ]);
    combinedModelSourceUrls = uniqueStrings([
      ...combinedModelSourceUrls,
      ...run.modelSourceUrls,
    ]);
    warnings.push(...run.research.warnings);

    if (note) {
      valuationNotes.push(note);
    }

    if (run.research.researchSummary) {
      valuationNotes.push(run.research.researchSummary);
    }
  }

  async function buildCurrentComparables() {
    const normalizedComparables = await normalizeResearchComparables({
      rawComparables: combinedRawComparables,
      targetCurrency,
      actualSourceUrls: combinedActualSourceUrls,
      verificationSourceCandidates: uniqueStrings([
        ...combinedActualSourceUrls,
        ...combinedModelSourceUrls,
      ]),
    });

    const comparables = finalizeComparables(normalizedComparables);

    return {
      comparables,
      weightedComparables: createWeightedComparables(comparables),
    };
  }

  /*
   * First, run a small exact-source lookup. This is deliberately narrower
   * than the general web search and opens the likely SportsCardsPro item page
   * before searching broadly. For cards covered by an exact completed-sales
   * page, this normally avoids the much larger fallback search entirely.
   */
  try {
    const exactAggregateRun = await runMarketResearch({
      openai,
      prompt: createExactAggregatePrompt(normalizedSubject),
      allowedDomains: EXACT_AGGREGATE_SEARCH_DOMAINS,
      effort: "low",
      schemaName: "card_market_exact_source",
    });

    addResearchRun(
      exactAggregateRun,
      "An exact-item completed-sales lookup was run before the broader market search."
    );
  } catch (error) {
    warnings.push(
      `The exact-item price-history lookup could not be completed: ${getResearchErrorMessage(
        error
      )}`
    );
  }

  let {
    comparables,
    weightedComparables,
  } = await buildCurrentComparables();

  if (weightedComparables.length === 0) {
    try {
      const primaryRun = await runMarketResearch({
        openai,
        prompt: createMarketResearchPrompt(normalizedSubject),
        allowedDomains: TRUSTED_SEARCH_DOMAINS,
        effort: "low",
        schemaName: "card_market_research",
      });

      addResearchRun(
        primaryRun,
        "A broader market search was run because the exact-source lookup produced no usable exact sold comparable."
      );
    } catch (error) {
      warnings.push(
        `The broader market search could not be completed: ${getResearchErrorMessage(
          error
        )}`
      );
    }

    ({ comparables, weightedComparables } = await buildCurrentComparables());
  }

  if (weightedComparables.length === 0) {
    try {
      const ebayFallbackRun = await runMarketResearch({
        openai,
        prompt: createEbayFallbackPrompt(normalizedSubject),
        allowedDomains: EBAY_SEARCH_DOMAINS,
        effort: "medium",
        schemaName: "card_market_ebay_fallback",
      });

      addResearchRun(
        ebayFallbackRun,
        "A targeted marketplace and completed-sales-history search was run because the earlier searches produced no usable exact sold comparable."
      );
    } catch (error) {
      warnings.push(
        `The targeted fallback search could not be completed: ${getResearchErrorMessage(
          error
        )}`
      );
    }

    ({ comparables, weightedComparables } = await buildCurrentComparables());
  }

  if (weightedComparables.length === 0) {
    const fallbackMarketIndex = comparables
      .filter((comparable) => {
        const sourceReliability = getSourceReliability(comparable);
        const exactIdentityMatch =
          comparable.metadata.exactIdentityMatch === true;
        const conditionMatch = comparable.metadata.conditionMatch === true;

        return (
          comparable.evidenceType === "market_index" &&
          exactIdentityMatch &&
          conditionMatch &&
          comparable.matchScore >= 80 &&
          sourceReliability >= 80 &&
          comparable.normalizedTotal !== null &&
          comparable.normalizedTotal > 0
        );
      })
      .sort((first, second) => second.matchScore - first.matchScore)[0];

    if (fallbackMarketIndex) {
      comparables = comparables.map((comparable) =>
        comparable.sourceUrl === fallbackMarketIndex.sourceUrl
          ? {
              ...comparable,
              included: true,
              exclusionReason: null,
              matchNotes: uniqueStrings([
                ...comparable.matchNotes,
                "Used only as a low-confidence market-index fallback because no exact sold comparable was available.",
              ]),
              metadata: {
                ...comparable.metadata,
                marketIndexFallback: true,
              },
            }
          : comparable
      );

      weightedComparables = createWeightedComparables(comparables);
      warnings.push(
        "No exact sold comparable was available. The estimate uses a market-index fallback and should be reviewed manually."
      );
    }
  }

  const { estimate, low, high } = calculateRange(weightedComparables);
  let confidenceScore = calculateConfidence({
    weightedComparables,
    estimate,
    low,
    high,
    actualSourceListAvailable: combinedActualSourceUrls.length > 0,
    subject: normalizedSubject,
  });

  const usedMarketIndexFallback = weightedComparables.some(
    (item) => item.comparable.metadata.marketIndexFallback === true
  );

  if (usedMarketIndexFallback && confidenceScore !== null) {
    confidenceScore = Math.min(confidenceScore, 55);
  }

  const usedDirectUrlVerificationFallback = weightedComparables.some(
    (item) =>
      item.comparable.metadata.trustedDirectEvidenceUrl === true &&
      item.comparable.metadata.sourceVerified !== true
  );

  if (usedDirectUrlVerificationFallback) {
    warnings.push(
      "A direct eBay or 130point evidence URL was used even though the hosted web-search source list did not expose the same URL. Open the evidence link and review it manually."
    );

    if (confidenceScore !== null) {
      confidenceScore = Math.min(confidenceScore, 60);
    }
  }

  const usedAggregateHistoryFallback = weightedComparables.some(
    (item) =>
      item.comparable.metadata.trustedAggregateHistoryUrl === true &&
      item.comparable.metadata.directSourceVerified !== true
  );

  if (usedAggregateHistoryFallback) {
    warnings.push(
      "One or more exact sold prices were verified on a trusted completed-sales history page because the outbound marketplace pages could not be opened. Review the evidence links when making a high-value decision."
    );

    if (confidenceScore !== null) {
      confidenceScore = Math.min(confidenceScore, 72);
    }
  }

  if (researchRuns.length > 0 && combinedActualSourceUrls.length === 0) {
    warnings.push(
      "The OpenAI response did not expose a machine-verifiable web source list. Source confidence was capped."
    );
  }

  if (weightedComparables.length < 3 && weightedComparables.length > 0) {
    warnings.push(
      "Fewer than three exact price observations were available, so the estimate has limited statistical support."
    );
  }

  if (estimate !== null && low !== null && high !== null && estimate > 0) {
    const relativeSpread = (high - low) / estimate;

    if (relativeSpread > 0.7) {
      warnings.push(
        "Comparable prices have a wide spread. Treat the estimate as a broad market range."
      );
    }
  }

  const includedComparables = weightedComparables.map(
    (item) => item.comparable
  );
  const includedSourceUrls = uniqueStrings(
    includedComparables.flatMap((comparable) => {
      const verificationSourceUrl =
        typeof comparable.metadata.verificationSourceUrl === "string"
          ? comparable.metadata.verificationSourceUrl
          : null;

      return [comparable.sourceUrl, verificationSourceUrl].filter(
        (value): value is string => Boolean(value)
      );
    })
  );
  const sourceUrls = uniqueStrings([
    ...includedSourceUrls,
    ...(combinedActualSourceUrls.length > 0
      ? combinedActualSourceUrls
      : combinedModelSourceUrls),
  ]);
  const sourceDomains = new Set(
    includedComparables
      .map((comparable) => comparable.sourceDomain)
      .filter((domain): domain is string => Boolean(domain))
  );

  const status: MarketPriceResolution["status"] =
    estimate === null
      ? "failed"
      : weightedComparables.length >= 3 &&
          confidenceScore !== null &&
          confidenceScore >= 70
        ? "completed"
        : "partial";

  const conditionReportedByResearch = researchRuns
    .map((run) => run.research.subjectCondition)
    .find((condition) => Boolean(condition));
  const resolvedCondition =
    conditionReportedByResearch === expectedSubjectCondition
      ? conditionReportedByResearch
      : expectedSubjectCondition;

  if (
    conditionReportedByResearch &&
    conditionReportedByResearch !== expectedSubjectCondition
  ) {
    warnings.push(
      "The research model's subject condition differed from Card DNA; Card DNA was used as the authority."
    );
  }

  const inputTokens = researchRuns.reduce(
    (total, run) => total + run.inputTokens,
    0
  );
  const outputTokens = researchRuns.reduce(
    (total, run) => total + run.outputTokens,
    0
  );
  const webSearchCalls = researchRuns.reduce(
    (total, run) => total + run.webSearchCalls,
    0
  );

  const researchCanonicalTitle = researchRuns
    .map((run) => normalizeOptionalString(run.research.canonicalTitle))
    .find((title): title is string => Boolean(title));

  const fallbackCanonicalTitle =
    [
      normalizedSubject.year,
      normalizedSubject.product,
      normalizedSubject.setName,
      normalizedSubject.playerName,
      normalizedSubject.cardNumber
        ? `#${normalizedSubject.cardNumber}`
        : null,
      normalizedSubject.parallel,
      normalizedSubject.gradingCompany && normalizedSubject.grade
        ? `${normalizedSubject.gradingCompany} ${normalizedSubject.grade}`
        : null,
    ]
      .filter(Boolean)
      .join(" ") || null;

  return {
    status,
    canonicalTitle: researchCanonicalTitle ?? fallbackCanonicalTitle,
    subjectCondition: resolvedCondition,
    gradingCompany: normalizedSubject.gradingCompany,
    grade: normalizedSubject.grade,
    currency: targetCurrency,
    estimatedValue: estimate,
    lowValue: low,
    highValue: high,
    confidenceScore,
    comparableCount: comparables.length,
    includedComparableCount: weightedComparables.length,
    sourceCount: sourceDomains.size,
    searchQuery:
      uniqueStrings(researchRuns.map((run) => run.research.searchQuery)).join(
        " | "
      ) || null,
    valuationSummary: buildValuationSummary({
      includedCount: weightedComparables.length,
      estimate,
      low,
      high,
      currency: targetCurrency,
    }),
    valuationNotes: uniqueStrings(valuationNotes),
    warnings: uniqueStrings(warnings),
    sourceUrls,
    modelName:
      uniqueStrings(researchRuns.map((run) => run.modelName)).join(" + ") ||
      MARKET_MODEL,
    responseId:
      uniqueStrings(
        researchRuns
          .map((run) => run.responseId)
          .filter((responseId): responseId is string => Boolean(responseId))
      ).join(",") || null,
    inputTokens,
    outputTokens,
    webSearchCalls,
    dataAsOf: new Date().toISOString(),
    comparables,
  };
}
