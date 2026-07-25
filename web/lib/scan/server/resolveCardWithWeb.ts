import "server-only";

import OpenAI from "openai";

export type CatalogCandidate = {
  sport: string | null;
  playerName: string | null;
  team: string | null;
  manufacturer: string | null;
  brand: string | null;
  product: string | null;
  setName: string | null;
  year: string | null;
  cardNumber: string | null;
  parallel: string | null;
  serialNumber: string | null;
  serialNumberedTo: number | null;
};

export type CatalogResolution = {
  matched: boolean;
  canonicalTitle: string | null;
  sport: string | null;
  playerName: string | null;
  team: string | null;
  manufacturer: string | null;
  brand: string | null;
  product: string | null;
  setName: string | null;
  year: string | null;
  cardNumber: string | null;
  parallel: string | null;
  serialNumber: string | null;
  serialNumberedTo: number | null;
  confidence: number;
  needsManualReview: boolean;
  uncertainFields: string[];
  matchNotes: string[];
  sourceUrls: string[];
};

type ResolveCardWithWebInput = {
  openai: OpenAI;
  evidence: Record<string, unknown>;
  candidate: CatalogCandidate;
};

const catalogResolutionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    matched: {
      type: "boolean",
      description:
        "True only when trusted catalog sources support a specific card match.",
    },
    canonicalTitle: {
      type: ["string", "null"],
      description:
        "Complete canonical title with season, product, insert, player, card number and parallel when verified.",
    },
    sport: {
      type: ["string", "null"],
    },
    playerName: {
      type: ["string", "null"],
    },
    team: {
      type: ["string", "null"],
    },
    manufacturer: {
      type: ["string", "null"],
    },
    brand: {
      type: ["string", "null"],
    },
    product: {
      type: ["string", "null"],
      description:
        "Exact main product, for example Topps Cosmic Chrome Basketball.",
    },
    setName: {
      type: ["string", "null"],
      description:
        "Exact base set, subset or insert name, for example Extraterrestrial Talent.",
    },
    year: {
      type: ["string", "null"],
      description:
        "Verified product year or season, for example 2025-26.",
    },
    cardNumber: {
      type: ["string", "null"],
      description:
        "Exact checklist card number preserving letters and hyphens.",
    },
    parallel: {
      type: ["string", "null"],
      description:
        "Exact catalog parallel name, for example Purple Nebula Refractor.",
    },
    serialNumber: {
      type: ["string", "null"],
    },
    serialNumberedTo: {
      type: ["integer", "null"],
      minimum: 1,
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
    },
    needsManualReview: {
      type: "boolean",
    },
    uncertainFields: {
      type: "array",
      items: {
        type: "string",
      },
    },
    matchNotes: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "Short explanations of which evidence and catalog matches support the result.",
    },
    sourceUrls: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "URLs of the trusted checklist or catalog pages used for the match.",
    },
  },
  required: [
    "matched",
    "canonicalTitle",
    "sport",
    "playerName",
    "team",
    "manufacturer",
    "brand",
    "product",
    "setName",
    "year",
    "cardNumber",
    "parallel",
    "serialNumber",
    "serialNumberedTo",
    "confidence",
    "needsManualReview",
    "uncertainFields",
    "matchNotes",
    "sourceUrls",
  ],
} as const;

function createCatalogPrompt({
  evidence,
  candidate,
}: {
  evidence: Record<string, unknown>;
  candidate: CatalogCandidate;
}) {
  return `
You are the catalog-resolution layer for a professional sports trading-card system.

Use live web search to verify the exact card.

INITIAL VISUAL CANDIDATE:
${JSON.stringify(candidate, null, 2)}

OBSERVED IMAGE EVIDENCE:
${JSON.stringify(evidence, null, 2)}

SEARCH PROCEDURE:
1. Search for the exact combination of player, card number, manufacturer and print run.
2. Prefer an official manufacturer checklist.
3. Use established catalog sources to verify insert names and parallel names when the official checklist does not list every parallel.
4. Compare the card number character by character.
5. Use the serial print run to distinguish parallels.
6. Check that player, team, season, product, insert and card number all agree.
7. Do not infer the product season solely from a copyright year.
8. Do not infer a parallel solely from its visible color.
9. A print run such as /150 may identify a parallel only when a trusted catalog explicitly maps that parallel to /150.
10. Ignore prices and market values. This task is identity resolution only.

SOURCE PRIORITY:
1. Official manufacturer checklist or official product page.
2. Beckett.
3. Trading Card Database.
4. Other established checklist sources only when required.

MATCH STANDARD:
- matched may be true only when trusted sources confirm the player and exact card number.
- confidence of 0.98 or higher requires verification of:
  player,
  product or release,
  year or season,
  set or insert,
  card number,
  and parallel when serial numbered.
- If the exact parallel cannot be verified, return parallel as null and mark it uncertain.
- If sources conflict, do not silently choose one. Mark manual review and explain the conflict.
- Never invent a source URL.
- Return only the structured result.
`.trim();
}

function parseCatalogResolution(
  outputText: string
): CatalogResolution {
  try {
    return JSON.parse(outputText) as CatalogResolution;
  } catch (error) {
    console.error("Kunne ikke læse Card Brain-resultatet:", {
      error,
      outputText,
    });

    throw new Error(
      "Card Brain returnerede et ugyldigt resultat."
    );
  }
}

function normalizeResolution(
  resolution: CatalogResolution,
  candidate: CatalogCandidate
): CatalogResolution {
  const sourceUrls = Array.from(
    new Set(
      resolution.sourceUrls.filter(
        (url) =>
          typeof url === "string" &&
          (url.startsWith("https://") ||
            url.startsWith("http://"))
      )
    )
  );

  const uncertainFields = Array.from(
    new Set(resolution.uncertainFields)
  );

  const matchNotes = Array.from(
    new Set(resolution.matchNotes)
  );

  const normalized: CatalogResolution = {
    ...resolution,
    serialNumber:
      resolution.serialNumber ?? candidate.serialNumber,
    serialNumberedTo:
      resolution.serialNumberedTo ??
      candidate.serialNumberedTo,
    sourceUrls,
    uncertainFields,
    matchNotes,
    confidence: Math.max(
      0,
      Math.min(1, resolution.confidence)
    ),
  };

  const requiredExactFields: Array<
    keyof CatalogResolution
  > = [
    "playerName",
    "product",
    "setName",
    "year",
    "cardNumber",
  ];

  for (const field of requiredExactFields) {
    if (!normalized[field]) {
      if (!normalized.uncertainFields.includes(field)) {
        normalized.uncertainFields.push(field);
      }

      normalized.needsManualReview = true;
      normalized.confidence = Math.min(
        normalized.confidence,
        0.89
      );
    }
  }

  if (
    normalized.serialNumberedTo &&
    !normalized.parallel
  ) {
    if (
      !normalized.uncertainFields.includes("parallel")
    ) {
      normalized.uncertainFields.push("parallel");
    }

    normalized.needsManualReview = true;
    normalized.confidence = Math.min(
      normalized.confidence,
      0.92
    );
  }

  if (normalized.sourceUrls.length === 0) {
    normalized.matched = false;
    normalized.needsManualReview = true;
    normalized.confidence = Math.min(
      normalized.confidence,
      0.75
    );

    normalized.matchNotes.push(
      "No verifiable catalog source URL was returned."
    );
  }

  return normalized;
}

export async function resolveCardWithWeb({
  openai,
  evidence,
  candidate,
}: ResolveCardWithWebInput): Promise<CatalogResolution> {
  const response = await openai.responses.create({
    model: "gpt-5.6",

    reasoning: {
      effort: "low",
    },

    tools: [
      {
        type: "web_search",

        filters: {
          allowed_domains: [
            "topps.com",
            "cdn.shopify.com",
            "paniniamerica.net",
            "beckett.com",
            "tcdb.com",
          ],
        },
      },
    ],

    tool_choice: "required",

    include: ["web_search_call.action.sources"],

    input: createCatalogPrompt({
      evidence,
      candidate,
    }),

    text: {
      format: {
        type: "json_schema",
        name: "card_catalog_resolution",
        strict: true,
        schema: catalogResolutionSchema,
      },
    },

    max_output_tokens: 2500,
  });

  if (!response.output_text) {
    console.error(
      "Card Brain returnerede intet output:",
      response
    );

    throw new Error(
      "Card Brain kunne ikke finde et katalogresultat."
    );
  }

  const resolution = parseCatalogResolution(
    response.output_text
  );

  return normalizeResolution(resolution, candidate);
}