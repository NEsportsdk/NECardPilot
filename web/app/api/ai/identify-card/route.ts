import { NextResponse } from "next/server";
import OpenAI from "openai";

import {
  calculateModelUsage,
  createIdentificationUsage,
  type IdentificationModelUsage,
  type IdentificationUsage,
} from "@/lib/scan/identificationUsage";
import { createClient } from "@/lib/supabase/server";
import {
  resolveCardWithWeb,
  type CatalogCandidate,
  type CatalogResolution,
} from "@/lib/scan/server/resolveCardWithWeb";

export const runtime = "nodejs";
export const maxDuration = 300;

const CARD_IMAGE_BUCKET = "card-images";
const SIGNED_URL_LIFETIME_SECONDS = 300;

type IdentifyCardRequest = {
  queueItemId?: unknown;
  frontPath?: unknown;
  backPath?: unknown;
};

type CaptureQueueIdentificationRow = {
  id: string;
  status: string;
  front_image_path: string;
  back_image_path: string;
  identification_result: IdentifiedCard | null;
  identification_usage: IdentificationUsage | null;
};

type CardEvidence = {
  visibleTextFront: string[];
  visibleTextBack: string[];
  playerNamesObserved: string[];
  teamNamesObserved: string[];
  manufacturerLogosObserved: string[];
  brandLogosObserved: string[];
  leagueLogosObserved: string[];
  cardNumberObserved: string | null;
  serialNumberObserved: string | null;
  serialNumberedToObserved: number | null;
  copyrightYearsObserved: string[];
  seasonOrYearTextObserved: string[];
  setOrInsertTextObserved: string[];
  parallelTextObserved: string[];
  rookieIndicatorsObserved: string[];
  autographIndicatorsObserved: string[];
  memorabiliaIndicatorsObserved: string[];
  gradingCompanyObserved: string | null;
  gradeObserved: string | null;
  certificationNumberObserved: string | null;
  dominantColorsObserved: string[];
  designFeaturesObserved: string[];
  evidenceNotes: string[];
  imageQualityIssues: string[];
};

type IdentifiedCard = {
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
  rookieCard: boolean | null;
  autograph: boolean | null;
  memorabilia: boolean | null;
  memorabiliaType: string | null;
  gradingCompany: string | null;
  grade: string | null;
  certificationNumber: string | null;
  language: string | null;
  variation: string | null;
  notes: string[];
  confidence: number;
  needsManualReview: boolean;
  uncertainFields: string[];
};

type CardBrainMetadata = {
  used: boolean;
  matched: boolean;
  canonicalTitle: string | null;
  sourceUrls: string[];
  matchNotes: string[];
  error: string | null;
};

const cardEvidenceSchema = {
  type: "object",
  additionalProperties: false,

  properties: {
    visibleTextFront: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "Al læsbar tekst på forsiden. Bevar stavning, tal og tegn bedst muligt.",
    },

    visibleTextBack: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "Al læsbar tekst på bagsiden. Bevar stavning, tal og tegn bedst muligt.",
    },

    playerNamesObserved: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "Spillernavne, som faktisk kan læses på kortet.",
    },

    teamNamesObserved: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "Holdnavne eller holdbetegnelser, som faktisk kan læses.",
    },

    manufacturerLogosObserved: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "Observerede producentlogoer såsom Topps, Panini eller Upper Deck.",
    },

    brandLogosObserved: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "Observerede produktlogoer såsom Chrome, Prizm, Select eller Optic.",
    },

    leagueLogosObserved: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "Observerede liga- eller organisationslogoer.",
    },

    cardNumberObserved: {
      type: ["string", "null"],
      description:
        "Kortnummeret præcis som det kan aflæses, eksempelvis ET-8.",
    },

    serialNumberObserved: {
      type: ["string", "null"],
      description:
        "Det komplette trykte serienummer, eksempelvis 044/150.",
    },

    serialNumberedToObserved: {
      type: ["integer", "null"],
      minimum: 1,
      description:
        "Oplagstallet efter skråstregen. Ved 044/150 er værdien 150.",
    },

    copyrightYearsObserved: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "Copyright-år, der kan aflæses. De er ikke automatisk produktåret.",
    },

    seasonOrYearTextObserved: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "År eller sæsoner, der eksplicit står som produktår eller sæson.",
    },

    setOrInsertTextObserved: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "Observeret tekst, som kan være set-, subset- eller insertnavn.",
    },

    parallelTextObserved: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "Parallel- eller variantnavne, som faktisk kan læses.",
    },

    rookieIndicatorsObserved: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "Synlige rookie-indikatorer såsom RC-logo eller ordet Rookie.",
    },

    autographIndicatorsObserved: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "Synlige indikationer på en ægte autograf.",
    },

    memorabiliaIndicatorsObserved: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "Synlige indikationer på jersey, patch eller memorabilia.",
    },

    gradingCompanyObserved: {
      type: ["string", "null"],
      description:
        "Graderingsfirma, der faktisk står på holderen.",
    },

    gradeObserved: {
      type: ["string", "null"],
      description:
        "Grade, der faktisk står på en grading-etiket.",
    },

    certificationNumberObserved: {
      type: ["string", "null"],
      description:
        "Certificeringsnummer, der kan aflæses på grading-etiketten.",
    },

    dominantColorsObserved: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "Dominerende farver og folieeffekter. Farver beviser ikke alene parallellen.",
    },

    designFeaturesObserved: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "Observerede designtræk såsom refractor-effekt, mønstre eller die-cut.",
    },

    evidenceNotes: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "Korte faktuelle observationer uden endelig produktidentifikation.",
    },

    imageQualityIssues: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "Problemer såsom sløring, genskin, beskæring eller skjult tekst.",
    },
  },

  required: [
    "visibleTextFront",
    "visibleTextBack",
    "playerNamesObserved",
    "teamNamesObserved",
    "manufacturerLogosObserved",
    "brandLogosObserved",
    "leagueLogosObserved",
    "cardNumberObserved",
    "serialNumberObserved",
    "serialNumberedToObserved",
    "copyrightYearsObserved",
    "seasonOrYearTextObserved",
    "setOrInsertTextObserved",
    "parallelTextObserved",
    "rookieIndicatorsObserved",
    "autographIndicatorsObserved",
    "memorabiliaIndicatorsObserved",
    "gradingCompanyObserved",
    "gradeObserved",
    "certificationNumberObserved",
    "dominantColorsObserved",
    "designFeaturesObserved",
    "evidenceNotes",
    "imageQualityIssues",
  ],
} as const;

const cardIdentificationSchema = {
  type: "object",
  additionalProperties: false,

  properties: {
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
      description:
        "Produktlinjen, eksempelvis Prizm, Select, Chrome eller Optic.",
    },

    product: {
      type: ["string", "null"],
      description:
        "Hovedproduktet, eksempelvis Topps Cosmic Chrome Basketball.",
    },

    setName: {
      type: ["string", "null"],
      description:
        "Base set, subset eller insertserie. Parallelens navn må ikke bruges her.",
    },

    year: {
      type: ["string", "null"],
      description:
        "Produktår eller sæson, eksempelvis 2025-26. Må ikke bestemmes alene ud fra copyright.",
    },

    cardNumber: {
      type: ["string", "null"],
      description:
        "Kortnummeret præcis med bogstaver og bindestreger.",
    },

    parallel: {
      type: ["string", "null"],
      description:
        "Den præcise parallel. Brug null, hvis navnet ikke kan bestemmes sikkert.",
    },

    serialNumber: {
      type: ["string", "null"],
    },

    serialNumberedTo: {
      type: ["integer", "null"],
      minimum: 1,
    },

    rookieCard: {
      type: ["boolean", "null"],
    },

    autograph: {
      type: ["boolean", "null"],
    },

    memorabilia: {
      type: ["boolean", "null"],
    },

    memorabiliaType: {
      type: ["string", "null"],
    },

    gradingCompany: {
      type: ["string", "null"],
    },

    grade: {
      type: ["string", "null"],
    },

    certificationNumber: {
      type: ["string", "null"],
    },

    language: {
      type: ["string", "null"],
    },

    variation: {
      type: ["string", "null"],
    },

    notes: {
      type: "array",
      items: {
        type: "string",
      },
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
  },

  required: [
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
    "rookieCard",
    "autograph",
    "memorabilia",
    "memorabiliaType",
    "gradingCompany",
    "grade",
    "certificationNumber",
    "language",
    "variation",
    "notes",
    "confidence",
    "needsManualReview",
    "uncertainFields",
  ],
} as const;

const evidencePrompt = `
Du er en ekstremt omhyggelig visuel dokumentanalytiker.

Du får to billeder af det samme sports trading card:
1. Forsiden.
2. Bagsiden.

Din opgave er IKKE at identificere det endelige kort.
Din eneste opgave er at udtrække observerbare beviser.

Regler:
- Gengiv al læsbar tekst så nøjagtigt som muligt.
- Opfind aldrig tekst, logoer eller oplysninger.
- Skeln mellem tekst på forsiden og bagsiden.
- Copyright-år er ikke automatisk produktår.
- Kortnummer og serienummer skal aflæses karakter for karakter.
- 044/150 skal registreres både som 044/150 og med oplagstal 150.
- Farve og folieeffekt er observationer, ikke et sikkert parallelnavn.
- Et spillerbillede er ikke nok til et navn, medmindre navnet også kan læses.
- Et trykt signaturdesign er ikke automatisk en ægte autograf.
- Registrer sløring, genskin, beskæring og skjult tekst.
- Brug tomme arrays eller null, når noget ikke kan ses.
- Ingen endelig produktidentifikation.
- Ingen databaseviden.
- Ingen antagelser.

Returner kun det strukturerede evidence-resultat.
`.trim();

function createIdentificationPrompt(
  evidence: CardEvidence
) {
  return `
Du er en skeptisk ekspert i sports trading cards.

Du får:
1. Kortets forside.
2. Kortets bagside.
3. Observerede beviser fra billederne.

EVIDENCE:
${JSON.stringify(evidence, null, 2)}

Identificer kortet så præcist som muligt.

BEVISRÆKKEFØLGE:
- Kortnummer er et meget stærkt identitetsbevis.
- Spiller- og holdnavn er stærke beviser.
- Producent- og brandlogoer er stærke beviser.
- Eksplicit set- eller inserttekst er et stærkt bevis.
- Serienummer og print run er stærke, men print run alene beviser ikke altid parallelnavnet.
- Copyright-år er et svagt bevis og må aldrig alene bruges som produktår.
- Farve alene er et svagt bevis for parallel.

ÅRGANG:
- Skeln mellem copyright-år og produktår.
- Returner ikke automatisk copyright-år som sæson.
- Brug null, hvis årgangen ikke kan bestemmes sikkert.
- Brug sæsonformat som 2025-26, når produktet bruger sæsonformat.

PRODUKTSTRUKTUR:
- manufacturer er virksomheden, eksempelvis Topps.
- brand er produktlinjen, eksempelvis Chrome.
- product er hovedproduktet, eksempelvis Topps Cosmic Chrome Basketball.
- setName er base set, subset eller insertserie.
- parallel er den nummererede, farvede eller refractor-variant.
- Brug ikke samme navn ukritisk i product, setName og parallel.
- Brug null, hvis et niveau ikke kan fastslås sikkert.

KORTNUMMER OG SERIENUMMER:
- Bevar bindestreger og bogstaver.
- ET-8 er ikke det samme som nummer 8.
- Gengiv 044/150 præcist.
- serialNumberedTo skal være 150.

AUTOGRAF, MEMORABILIA OG ROOKIE:
- True kræver synligt eller sikkert bevis.
- Trykte signaturer er ikke ægte autografer.
- Design uden fysisk materiale er ikke memorabilia.
- Rookie-status må ikke udledes af spillerens alder.

VALIDERING:
- Stemmer spiller, hold og kortnummer sammen?
- Stemmer producent og brand med logoerne?
- Er year blevet forvekslet med copyright?
- Er setName blevet forvekslet med product?
- Er parallel blevet gættet alene ud fra farven?
- Er serienummeret gengivet præcist?
- Er der konflikter mellem forside, bagside og evidence?

SIKKERHED:
- Confidence over 0.95 kræver stærke beviser for spiller, produkt, årgang, kortnummer og parallel.
- Sænk confidence, hvis produkt, årgang, set eller parallel er usikker.
- Markér alle usikre centrale felter i uncertainFields.
- Sæt needsManualReview til true, hvis year, product, setName, cardNumber eller parallel er usikker.
- Beskriv centrale konflikter kort i notes.
- Opfind aldrig oplysninger.

Returner kun det strukturerede identifikationsresultat.
`.trim();
}

function isValidStoragePath(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= 1000 &&
    !value.includes("..") &&
    !value.startsWith("/")
  );
}

function isUnsupportedImageFormat(path: string) {
  const normalizedPath = path
    .toLowerCase()
    .split("?")[0];

  return (
    normalizedPath.endsWith(".heic") ||
    normalizedPath.endsWith(".heif")
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Der opstod en ukendt fejl.";
}

function parseStructuredOutput<T>(
  outputText: string,
  label: string
): T {
  try {
    return JSON.parse(outputText) as T;
  } catch (error) {
    console.error(`Kunne ikke læse ${label}:`, {
      error,
      outputText,
    });

    throw new Error(
      `${label} havde et ugyldigt JSON-format.`
    );
  }
}

function canonicalFieldName(field: string) {
  const normalized = field
    .toLowerCase()
    .replace(/[\s_-]/g, "");

  const aliases: Record<string, string> = {
    player: "playerName",
    playername: "playerName",
    team: "team",
    manufacturer: "manufacturer",
    brand: "brand",
    product: "product",
    set: "setName",
    setname: "setName",
    subset: "setName",
    insert: "setName",
    year: "year",
    season: "year",
    cardnumber: "cardNumber",
    parallel: "parallel",
    serial: "serialNumber",
    serialnumber: "serialNumber",
  };

  return aliases[normalized] ?? field;
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

function normalizeIdentifiedCard(
  card: IdentifiedCard,
  evidence: CardEvidence
): IdentifiedCard {
  const normalizedCard: IdentifiedCard = {
    ...card,

    uncertainFields: uniqueStrings(
      card.uncertainFields.map(canonicalFieldName)
    ),

    notes: uniqueStrings(card.notes),

    confidence: Math.max(
      0,
      Math.min(1, card.confidence)
    ),
  };

  if (
    evidence.serialNumberObserved &&
    !normalizedCard.serialNumber
  ) {
    normalizedCard.serialNumber =
      evidence.serialNumberObserved;
  }

  if (
    evidence.serialNumberedToObserved &&
    !normalizedCard.serialNumberedTo
  ) {
    normalizedCard.serialNumberedTo =
      evidence.serialNumberedToObserved;
  }

  if (
    evidence.cardNumberObserved &&
    !normalizedCard.cardNumber
  ) {
    normalizedCard.cardNumber =
      evidence.cardNumberObserved;
  }

  const centralFields = [
    "year",
    "product",
    "setName",
    "cardNumber",
  ];

  if (normalizedCard.serialNumberedTo) {
    centralFields.push("parallel");
  }

  for (const field of centralFields) {
    const value =
      normalizedCard[
        field as keyof IdentifiedCard
      ];

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      if (
        !normalizedCard.uncertainFields.includes(field)
      ) {
        normalizedCard.uncertainFields.push(field);
      }
    }
  }

  if (
    normalizedCard.uncertainFields.some((field) =>
      [
        "year",
        "product",
        "setName",
        "cardNumber",
        "parallel",
      ].includes(field)
    )
  ) {
    normalizedCard.needsManualReview = true;
    normalizedCard.confidence = Math.min(
      normalizedCard.confidence,
      0.89
    );
  }

  if (evidence.imageQualityIssues.length > 0) {
    normalizedCard.notes.push(
      `Billedkvalitet: ${evidence.imageQualityIssues.join(
        "; "
      )}`
    );

    normalizedCard.confidence = Math.min(
      normalizedCard.confidence,
      0.9
    );
  }

  normalizedCard.notes = uniqueStrings(
    normalizedCard.notes
  );

  normalizedCard.uncertainFields = uniqueStrings(
    normalizedCard.uncertainFields
  );

  return normalizedCard;
}

function shouldUseCardBrain(
  card: IdentifiedCard,
  evidence: CardEvidence
) {
  const uncertainFields = new Set(
    card.uncertainFields.map(canonicalFieldName)
  );

  const hasCentralUncertainty =
    card.needsManualReview ||
    card.confidence < 0.96 ||
    !card.year ||
    !card.product ||
    !card.setName ||
    !card.cardNumber ||
    Boolean(
      card.serialNumberedTo && !card.parallel
    ) ||
    [
      "year",
      "product",
      "setName",
      "cardNumber",
      "parallel",
    ].some((field) => uncertainFields.has(field));

  const lookupSignals = [
    card.playerName ??
      evidence.playerNamesObserved[0],
    card.cardNumber ??
      evidence.cardNumberObserved,
    card.manufacturer ??
      evidence.manufacturerLogosObserved[0],
    card.brand ??
      evidence.brandLogosObserved[0],
    card.serialNumberedTo ??
      evidence.serialNumberedToObserved,
    card.product,
  ].filter(Boolean);

  return (
    hasCentralUncertainty &&
    lookupSignals.length >= 2
  );
}

function normalizeComparableText(
  value: string | null
) {
  return (
    value
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") ?? ""
  );
}

function valuesConflict(
  first: string | null,
  second: string | null
) {
  if (!first || !second) {
    return false;
  }

  return (
    normalizeComparableText(first) !==
    normalizeComparableText(second)
  );
}

function getCatalogConflicts(
  card: IdentifiedCard,
  catalog: CatalogResolution
) {
  const conflicts: string[] = [];

  if (
    valuesConflict(
      card.playerName,
      catalog.playerName
    )
  ) {
    conflicts.push("playerName");
  }

  if (
    valuesConflict(
      card.cardNumber,
      catalog.cardNumber
    )
  ) {
    conflicts.push("cardNumber");
  }

  if (
    card.serialNumberedTo &&
    catalog.serialNumberedTo &&
    card.serialNumberedTo !==
      catalog.serialNumberedTo
  ) {
    conflicts.push("serialNumberedTo");
  }

  return conflicts;
}

function mergeCatalogResolution(
  visualCard: IdentifiedCard,
  catalog: CatalogResolution
): IdentifiedCard {
  if (!catalog.matched) {
    return {
      ...visualCard,

      notes: uniqueStrings([
        ...visualCard.notes,
        ...catalog.matchNotes.map(
          (note) => `Card Brain: ${note}`
        ),
      ]),

      needsManualReview: true,
    };
  }

  const conflicts = getCatalogConflicts(
    visualCard,
    catalog
  );

  if (conflicts.length > 0) {
    return {
      ...visualCard,

      confidence: Math.min(
        visualCard.confidence,
        0.79
      ),

      needsManualReview: true,

      uncertainFields: uniqueStrings([
        ...visualCard.uncertainFields,
        ...conflicts,
      ]),

      notes: uniqueStrings([
        ...visualCard.notes,
        `Card Brain fandt en mulig katalogkonflikt i: ${conflicts.join(
          ", "
        )}.`,
        ...catalog.matchNotes.map(
          (note) => `Card Brain: ${note}`
        ),
      ]),
    };
  }

  const catalogUncertain = new Set(
    catalog.uncertainFields.map(
      canonicalFieldName
    )
  );

  const resolvedCatalogFields = new Set<string>();

  if (catalog.sport) {
    resolvedCatalogFields.add("sport");
  }

  if (catalog.playerName) {
    resolvedCatalogFields.add("playerName");
  }

  if (catalog.team) {
    resolvedCatalogFields.add("team");
  }

  if (catalog.manufacturer) {
    resolvedCatalogFields.add("manufacturer");
  }

  if (catalog.brand) {
    resolvedCatalogFields.add("brand");
  }

  if (catalog.product) {
    resolvedCatalogFields.add("product");
  }

  if (catalog.setName) {
    resolvedCatalogFields.add("setName");
  }

  if (catalog.year) {
    resolvedCatalogFields.add("year");
  }

  if (catalog.cardNumber) {
    resolvedCatalogFields.add("cardNumber");
  }

  if (catalog.parallel) {
    resolvedCatalogFields.add("parallel");
  }

  if (catalog.serialNumber) {
    resolvedCatalogFields.add("serialNumber");
  }

  const remainingVisualUncertainty =
    visualCard.uncertainFields
      .map(canonicalFieldName)
      .filter(
        (field) =>
          !(
            resolvedCatalogFields.has(field) &&
            !catalogUncertain.has(field)
          )
      );

  const mergedUncertainty = uniqueStrings([
    ...remainingVisualUncertainty,
    ...Array.from(catalogUncertain),
  ]);

  let mergedParallel =
    catalog.parallel ?? visualCard.parallel;

  if (
    catalog.matched &&
    !catalog.parallel &&
    !catalog.serialNumberedTo &&
    !catalogUncertain.has("parallel")
  ) {
    mergedParallel =
      visualCard.parallel ?? "Base";
  }

  const coreUncertainty = mergedUncertainty.some(
    (field) =>
      [
        "year",
        "product",
        "setName",
        "cardNumber",
        "parallel",
      ].includes(field)
  );

  const needsManualReview =
    catalog.needsManualReview ||
    coreUncertainty;

  let mergedConfidence = Math.max(
    visualCard.confidence,
    catalog.confidence
  );

  if (needsManualReview) {
    mergedConfidence = Math.min(
      mergedConfidence,
      0.95
    );
  }

  return {
    ...visualCard,

    sport:
      catalog.sport ?? visualCard.sport,

    playerName:
      catalog.playerName ??
      visualCard.playerName,

    team:
      catalog.team ?? visualCard.team,

    manufacturer:
      catalog.manufacturer ??
      visualCard.manufacturer,

    brand:
      catalog.brand ?? visualCard.brand,

    product:
      catalog.product ?? visualCard.product,

    setName:
      catalog.setName ?? visualCard.setName,

    year:
      catalog.year ?? visualCard.year,

    cardNumber:
      catalog.cardNumber ??
      visualCard.cardNumber,

    parallel: mergedParallel,

    serialNumber:
      visualCard.serialNumber ??
      catalog.serialNumber,

    serialNumberedTo:
      visualCard.serialNumberedTo ??
      catalog.serialNumberedTo,

    confidence: Math.max(
      0,
      Math.min(1, mergedConfidence)
    ),

    needsManualReview,

    uncertainFields: mergedUncertainty,

    notes: uniqueStrings([
      ...visualCard.notes,

      catalog.canonicalTitle
        ? `Katalogmatch: ${catalog.canonicalTitle}`
        : "",

      ...catalog.matchNotes.map(
        (note) => `Card Brain: ${note}`
      ),

      catalog.sourceUrls.length > 0
        ? `Card Brain verificerede resultatet med ${catalog.sourceUrls.length} katalogkilde(r).`
        : "",
    ]),
  };
}

function createCatalogCandidate(
  card: IdentifiedCard
): CatalogCandidate {
  return {
    sport: card.sport,
    playerName: card.playerName,
    team: card.team,
    manufacturer: card.manufacturer,
    brand: card.brand,
    product: card.product,
    setName: card.setName,
    year: card.year,
    cardNumber: card.cardNumber,
    parallel: card.parallel,
    serialNumber: card.serialNumber,
    serialNumberedTo:
      card.serialNumberedTo,
  };
}

export async function POST(request: Request) {
  const requestStartedAt = Date.now();

  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error(
        "OPENAI_API_KEY mangler i .env.local."
      );

      return NextResponse.json(
        {
          error:
            "OpenAI er ikke konfigureret på serveren. Kontrollér OPENAI_API_KEY.",
        },
        {
          status: 500,
        }
      );
    }

    const body =
      (await request.json()) as IdentifyCardRequest;

    const { queueItemId, frontPath, backPath } = body;

    if (
      queueItemId !== undefined &&
      (typeof queueItemId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          queueItemId
        ))
    ) {
      return NextResponse.json(
        {
          error: "Der mangler et gyldigt kø-ID til identifikationen.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !isValidStoragePath(frontPath) ||
      !isValidStoragePath(backPath)
    ) {
      return NextResponse.json(
        {
          error:
            "Der mangler en gyldig billedsti til kortets forside eller bagside.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      isUnsupportedImageFormat(frontPath) ||
      isUnsupportedImageFormat(backPath)
    ) {
      return NextResponse.json(
        {
          error:
            "HEIC- og HEIF-billeder skal først konverteres til JPG, PNG eller WEBP, før AI-scanningen kan gennemføres.",

          code: "UNSUPPORTED_IMAGE_FORMAT",
        },
        {
          status: 415,
        }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error:
            "Du skal være logget ind for at scanne et kort.",
        },
        {
          status: 401,
        }
      );
    }

    const requiredUserPrefix = `${user.id}/`;

    if (
      !frontPath.startsWith(
        requiredUserPrefix
      ) ||
      !backPath.startsWith(
        requiredUserPrefix
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Du har ikke adgang til de valgte kortbilleder.",
        },
        {
          status: 403,
        }
      );
    }

    if (frontPath === backPath) {
      return NextResponse.json(
        {
          error:
            "Forsiden og bagsiden skal være to forskellige billeder.",
        },
        {
          status: 400,
        }
      );
    }

    if (typeof queueItemId === "string") {
      const { data: queueItemData, error: queueItemError } = await supabase
        .from("scan_capture_items")
        .select(
          "id, status, front_image_path, back_image_path, identification_result, identification_usage"
        )
        .eq("id", queueItemId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (queueItemError) {
        console.error("Capture-køposten kunne ikke læses:", queueItemError);

        return NextResponse.json(
          {
            error: "Capture-køposten kunne ikke kontrolleres sikkert.",
          },
          {
            status: 500,
          }
        );
      }

      if (!queueItemData) {
        return NextResponse.json(
          {
            error: "Capture-køposten findes ikke længere.",
          },
          {
            status: 404,
          }
        );
      }

      const queueItem = queueItemData as CaptureQueueIdentificationRow;

      if (
        queueItem.front_image_path !== frontPath ||
        queueItem.back_image_path !== backPath
      ) {
        return NextResponse.json(
          {
            error: "Billedstierne matcher ikke den valgte capture-køpost.",
          },
          {
            status: 403,
          }
        );
      }

      if (
        (queueItem.status === "identified" ||
          queueItem.status === "needs_review" ||
          queueItem.status === "saved") &&
        queueItem.identification_result
      ) {
        return NextResponse.json({
          success: true,
          card: queueItem.identification_result,
          usage: queueItem.identification_usage,
          persisted: true,
          reused: true,
        });
      }

      if (queueItem.status !== "identifying") {
        return NextResponse.json(
          {
            error:
              "Kortet er ikke låst til identifikation. Genstart køen og prøv igen.",
          },
          {
            status: 409,
          }
        );
      }
    }

    const [
      {
        data: frontSignedData,
        error: frontSignedError,
      },

      {
        data: backSignedData,
        error: backSignedError,
      },
    ] = await Promise.all([
      supabase.storage
        .from(CARD_IMAGE_BUCKET)
        .createSignedUrl(
          frontPath,
          SIGNED_URL_LIFETIME_SECONDS
        ),

      supabase.storage
        .from(CARD_IMAGE_BUCKET)
        .createSignedUrl(
          backPath,
          SIGNED_URL_LIFETIME_SECONDS
        ),
    ]);

    if (
      frontSignedError ||
      backSignedError ||
      !frontSignedData?.signedUrl ||
      !backSignedData?.signedUrl
    ) {
      console.error(
        "Kunne ikke oprette signed URLs:",
        {
          frontSignedError,
          backSignedError,
        }
      );

      return NextResponse.json(
        {
          error:
            "Kortbillederne kunne ikke åbnes sikkert fra lageret.",
        },
        {
          status: 500,
        }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const evidenceResponse =
      await openai.responses.create({
        model: "gpt-4.1-mini",

        store: false,

        input: [
          {
            role: "user",

            content: [
              {
                type: "input_text",
                text: evidencePrompt,
              },

              {
                type: "input_image",
                image_url:
                  frontSignedData.signedUrl,
                detail: "high",
              },

              {
                type: "input_image",
                image_url:
                  backSignedData.signedUrl,
                detail: "high",
              },
            ],
          },
        ],

        text: {
          format: {
            type: "json_schema",
            name: "card_evidence",
            strict: true,
            schema: cardEvidenceSchema,
          },
        },

        max_output_tokens: 3000,
      });

    if (!evidenceResponse.output_text) {
      console.error(
        "OpenAI returnerede intet evidence-output:",
        evidenceResponse
      );

      return NextResponse.json(
        {
          error:
            "AI-modellen kunne ikke læse kortets synlige oplysninger.",
        },
        {
          status: 502,
        }
      );
    }

    const evidence =
      parseStructuredOutput<CardEvidence>(
        evidenceResponse.output_text,
        "AI evidence-resultatet"
      );

    const identificationResponse =
      await openai.responses.create({
        model: "gpt-4.1",

        store: false,

        input: [
          {
            role: "user",

            content: [
              {
                type: "input_text",

                text: createIdentificationPrompt(
                  evidence
                ),
              },

              {
                type: "input_image",

                image_url:
                  frontSignedData.signedUrl,

                detail: "high",
              },

              {
                type: "input_image",

                image_url:
                  backSignedData.signedUrl,

                detail: "high",
              },
            ],
          },
        ],

        text: {
          format: {
            type: "json_schema",
            name: "card_identification",
            strict: true,
            schema:
              cardIdentificationSchema,
          },
        },

        max_output_tokens: 3000,
      });

    if (
      !identificationResponse.output_text
    ) {
      console.error(
        "OpenAI returnerede intet identifikations-output:",
        identificationResponse
      );

      return NextResponse.json(
        {
          error:
            "AI-modellen returnerede ikke et brugbart identifikationsresultat.",
        },
        {
          status: 502,
        }
      );
    }

    const rawIdentifiedCard =
      parseStructuredOutput<IdentifiedCard>(
        identificationResponse.output_text,
        "AI-identifikationen"
      );

    const visualCard =
      normalizeIdentifiedCard(
        rawIdentifiedCard,
        evidence
      );

    let identifiedCard = visualCard;

    let catalogResolution:
      | CatalogResolution
      | null = null;

    let cardBrainUsage: IdentificationModelUsage | null = null;

    let webSearchCalls = 0;

    let cardBrainError: string | null =
      null;

    const useCardBrain =
      shouldUseCardBrain(
        visualCard,
        evidence
      );

    if (useCardBrain) {
      try {
        const evidenceForWeb: Record<
          string,
          unknown
        > = {
          ...evidence,
        };

        const catalogResult = await resolveCardWithWeb({
          openai,

          evidence: evidenceForWeb,

          candidate:
            createCatalogCandidate(
              visualCard
            ),
        });

        catalogResolution = catalogResult.resolution;
        cardBrainUsage = catalogResult.usage;
        webSearchCalls = catalogResult.webSearchCalls;

        identifiedCard =
          mergeCatalogResolution(
            visualCard,
            catalogResolution
          );
      } catch (error) {
        cardBrainError =
          getErrorMessage(error);

        console.error(
          "Card Brain-opslaget fejlede. Det visuelle resultat bevares:",
          error
        );

        identifiedCard = {
          ...visualCard,

          needsManualReview: true,

          notes: uniqueStrings([
            ...visualCard.notes,

            "Card Brain-katalogopslaget kunne ikke gennemføres. Det viste resultat er derfor baseret på billedanalysen alene.",
          ]),
        };
      }
    }

    const evidenceInputTokens =
      evidenceResponse.usage
        ?.input_tokens ?? 0;

    const evidenceOutputTokens =
      evidenceResponse.usage
        ?.output_tokens ?? 0;

    const identificationInputTokens =
      identificationResponse.usage
        ?.input_tokens ?? 0;

    const identificationOutputTokens =
      identificationResponse.usage
        ?.output_tokens ?? 0;

    const cardBrain: CardBrainMetadata = {
      used: useCardBrain,

      matched:
        catalogResolution?.matched ??
        false,

      canonicalTitle:
        catalogResolution
          ?.canonicalTitle ?? null,

      sourceUrls:
        catalogResolution
          ?.sourceUrls ?? [],

      matchNotes:
        catalogResolution
          ?.matchNotes ?? [],

      error: cardBrainError,
    };

    const modelCalls: IdentificationModelUsage[] = [
      calculateModelUsage({
        model: "gpt-4.1-mini",
        inputTokens: evidenceInputTokens,
        outputTokens: evidenceOutputTokens,
      }),
      calculateModelUsage({
        model: "gpt-4.1",
        inputTokens: identificationInputTokens,
        outputTokens: identificationOutputTokens,
      }),
    ];

    if (cardBrainUsage) {
      modelCalls.push(cardBrainUsage);
    }

    const usage = createIdentificationUsage({
      modelCalls,
      webSearchCalls,
      note: useCardBrain
        ? "Estimatet omfatter visuel identifikation, Card Brain-tokenforbrug og registrerede web search-kald."
        : "Card Brain-webopslag var ikke nødvendigt for denne scanning.",
    });

    if (typeof queueItemId === "string") {
      const identifiedAt = new Date().toISOString();
      const nextStatus = identifiedCard.needsManualReview
        ? "needs_review"
        : "identified";
      const { data: persistedItem, error: persistError } = await supabase
        .from("scan_capture_items")
        .update({
          status: nextStatus,
          identification_result: identifiedCard,
          identification_usage: usage,
          failure_stage: null,
          error_message: null,
          identified_at: identifiedAt,
        })
        .eq("id", queueItemId)
        .eq("user_id", user.id)
        .eq("status", "identifying")
        .select("id")
        .maybeSingle();

      if (persistError || !persistedItem) {
        const { data: existingItem } = await supabase
          .from("scan_capture_items")
          .select("status, identification_result, identification_usage")
          .eq("id", queueItemId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (
          existingItem?.identification_result &&
          (existingItem.status === "identified" ||
            existingItem.status === "needs_review" ||
            existingItem.status === "saved")
        ) {
          return NextResponse.json({
            success: true,
            card: existingItem.identification_result,
            usage: existingItem.identification_usage,
            persisted: true,
            reused: true,
          });
        }

        console.error("AI-resultatet kunne ikke gemmes i capture-køen:", {
          queueItemId,
          persistError,
        });

        throw new Error(
          "AI-resultatet blev oprettet, men kunne ikke gemmes sikkert i capture-køen."
        );
      }
    }

    return NextResponse.json({
      success: true,

      card: identifiedCard,

      evidence,

      cardBrain,

      pipeline: {
        visualIdentificationUsed: true,
        cardBrainUsed: useCardBrain,
        cardBrainMatched:
          cardBrain.matched,
        durationMs:
          Date.now() -
          requestStartedAt,
      },
      usage,
      persisted: typeof queueItemId === "string",
      reused: false,
    });
  } catch (error) {
    console.error(
      "Fejl i identify-card route:",
      error
    );

    const message =
      getErrorMessage(error);

    const normalizedMessage =
      message.toLowerCase();

    if (
      normalizedMessage.includes(
        "api key"
      ) ||
      normalizedMessage.includes(
        "authentication"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "OpenAI API-nøglen blev afvist. Kontrollér nøglen i .env.local.",
        },
        {
          status: 500,
        }
      );
    }

    if (
      normalizedMessage.includes(
        "quota"
      ) ||
      normalizedMessage.includes(
        "billing"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "OpenAI-kontoen har ikke tilgængeligt API-forbrug. Kontrollér billing og forbrugsgrænser hos OpenAI.",
        },
        {
          status: 402,
        }
      );
    }

    if (
      normalizedMessage.includes(
        "json"
      ) ||
      normalizedMessage.includes(
        "format"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "AI-resultatet kunne ikke behandles korrekt. Prøv scanningen igen.",
        },
        {
          status: 502,
        }
      );
    }

    return NextResponse.json(
      {
        error:
          "Kortet kunne ikke identificeres. Prøv igen med tydeligere billeder.",
      },
      {
        status: 500,
      }
    );
  }
}
