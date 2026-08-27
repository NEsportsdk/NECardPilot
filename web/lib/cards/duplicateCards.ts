export type DuplicateCardIdentity = {
  playerName: string | null;
  year: string | null;
  manufacturer: string | null;
  brand: string | null;
  product: string | null;
  setName: string | null;
  cardNumber: string | null;
  parallel: string | null;
  serialNumber: string | null;
};

export type DuplicateCardCandidate = {
  id: string;
  current_collection_id: string;
  player_name: string;
  year: string | null;
  manufacturer: string | null;
  set_name: string | null;
  card_number: string | null;
  parallel_name: string | null;
  serial_number: string | null;
  state: string | null;
  created_at: string;
};

export type DuplicateMatchLevel =
  | "exact"
  | "probable"
  | "possible";

export type DuplicateCardMatch = {
  cardId: string;
  collectionId: string;
  collectionName: string | null;
  playerName: string;
  year: string | null;
  setName: string | null;
  cardNumber: string | null;
  parallel: string | null;
  serialNumber: string | null;
  state: string | null;
  createdAt: string;
  score: number;
  level: DuplicateMatchLevel;
  reasons: string[];
};

export type DuplicateCardCheckResult = {
  matches: DuplicateCardMatch[];
  requiresAcknowledgement: boolean;
};

function normalizeIdentityText(
  value: string | null | undefined
) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]/g, "");
}

function valuesMatch(
  first: string | null | undefined,
  second: string | null | undefined
) {
  const normalizedFirst =
    normalizeIdentityText(first);
  const normalizedSecond =
    normalizeIdentityText(second);

  return Boolean(
    normalizedFirst &&
      normalizedSecond &&
      normalizedFirst === normalizedSecond
  );
}

function valueMatchesAny(
  value: string | null | undefined,
  alternatives: Array<
    string | null | undefined
  >
) {
  return alternatives.some((alternative) =>
    valuesMatch(value, alternative)
  );
}

export function hasDuplicateCheckIdentity(
  identity: DuplicateCardIdentity
) {
  if (!identity.playerName?.trim()) {
    return false;
  }

  return (
    [
      identity.year,
      identity.product,
      identity.setName,
      identity.cardNumber,
      identity.parallel,
      identity.serialNumber,
    ].filter((value) => value?.trim()).length >= 2
  );
}

export function getDuplicateIdentityKey(
  identity: DuplicateCardIdentity
) {
  return [
    identity.playerName,
    identity.year,
    identity.manufacturer,
    identity.brand,
    identity.product,
    identity.setName,
    identity.cardNumber,
    identity.parallel,
    identity.serialNumber,
  ]
    .map(normalizeIdentityText)
    .join("|");
}

export function scoreDuplicateCandidate(
  identity: DuplicateCardIdentity,
  candidate: DuplicateCardCandidate,
  collectionName: string | null = null
): DuplicateCardMatch | null {
  if (
    !valuesMatch(
      identity.playerName,
      candidate.player_name
    )
  ) {
    return null;
  }

  const yearMatches = valuesMatch(
    identity.year,
    candidate.year
  );
  const manufacturerMatches =
    valueMatchesAny(candidate.manufacturer, [
      identity.manufacturer,
      identity.brand,
    ]);
  const setMatches = valueMatchesAny(
    candidate.set_name,
    [identity.setName, identity.product]
  );
  const cardNumberMatches = valuesMatch(
    identity.cardNumber,
    candidate.card_number
  );
  const parallelMatches = valuesMatch(
    identity.parallel,
    candidate.parallel_name
  );
  const serialMatches = valuesMatch(
    identity.serialNumber,
    candidate.serial_number
  );

  const bothHaveDifferentSerials = Boolean(
    identity.serialNumber?.trim() &&
      candidate.serial_number?.trim() &&
      !serialMatches
  );

  if (bothHaveDifferentSerials) {
    return null;
  }

  const specificMatches = [
    yearMatches,
    setMatches,
    cardNumberMatches,
    parallelMatches,
    serialMatches,
  ].filter(Boolean).length;

  if (specificMatches < 2) {
    return null;
  }

  let score = 24;
  const reasons = ["Same player"];

  if (yearMatches) {
    score += 12;
    reasons.push("Same year");
  }

  if (manufacturerMatches) {
    score += 8;
    reasons.push("Same manufacturer / brand");
  }

  if (setMatches) {
    score += 18;
    reasons.push("Same product / set");
  }

  if (cardNumberMatches) {
    score += 18;
    reasons.push("Same card number");
  }

  if (parallelMatches) {
    score += 10;
    reasons.push("Same parallel");
  }

  if (serialMatches) {
    score += 35;
    reasons.push("Same serial number");
  }

  if (
    identity.year?.trim() &&
    candidate.year?.trim() &&
    !yearMatches
  ) {
    score -= 12;
  }

  if (
    identity.cardNumber?.trim() &&
    candidate.card_number?.trim() &&
    !cardNumberMatches
  ) {
    score -= 20;
  }

  if (
    identity.parallel?.trim() &&
    candidate.parallel_name?.trim() &&
    !parallelMatches
  ) {
    score -= 14;
  }

  if (score < 55) {
    return null;
  }

  const boundedScore = Math.min(
    100,
    Math.max(0, score)
  );

  const level: DuplicateMatchLevel = serialMatches
    ? "exact"
    : boundedScore >= 72
      ? "probable"
      : "possible";

  return {
    cardId: candidate.id,
    collectionId:
      candidate.current_collection_id,
    collectionName,
    playerName: candidate.player_name,
    year: candidate.year,
    setName: candidate.set_name,
    cardNumber: candidate.card_number,
    parallel: candidate.parallel_name,
    serialNumber: candidate.serial_number,
    state: candidate.state,
    createdAt: candidate.created_at,
    score: boundedScore,
    level,
    reasons,
  };
}

export function buildDuplicateCheckResult(
  identity: DuplicateCardIdentity,
  candidates: DuplicateCardCandidate[],
  collectionNames: Map<string, string> = new Map()
): DuplicateCardCheckResult {
  if (!hasDuplicateCheckIdentity(identity)) {
    return {
      matches: [],
      requiresAcknowledgement: false,
    };
  }

  const matches = candidates
    .map((candidate) =>
      scoreDuplicateCandidate(
        identity,
        candidate,
        collectionNames.get(
          candidate.current_collection_id
        ) ?? null
      )
    )
    .filter(
      (match): match is DuplicateCardMatch =>
        match !== null
    )
    .sort(
      (first, second) =>
        second.score - first.score ||
        new Date(second.createdAt).getTime() -
          new Date(first.createdAt).getTime()
    )
    .slice(0, 5);

  return {
    matches,
    requiresAcknowledgement: matches.some(
      (match) =>
        match.level === "exact" ||
        match.level === "probable"
    ),
  };
}
