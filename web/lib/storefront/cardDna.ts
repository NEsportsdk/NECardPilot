export type CardAttribute = {
  attribute_key: string;
  attribute_value: unknown;
};

export type CardDnaSource = {
  card_number: string | null;
  manufacturer: string | null;
  parallel_name: string | null;
  player_name: string;
  serial_number: string | null;
  set_name: string | null;
  year: string | null;
};

export type CardDna = {
  description: string;
  featureLabels: string[];
  tags: string[];
  title: string;
};

function attributeValue(attributes: CardAttribute[], key: string) {
  return attributes.find((attribute) => attribute.attribute_key === key)
    ?.attribute_value;
}

function stringAttribute(attributes: CardAttribute[], key: string) {
  const value = attributeValue(attributes, key);

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function numberAttribute(attributes: CardAttribute[], key: string) {
  const value = attributeValue(attributes, key);
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function booleanAttribute(attributes: CardAttribute[], key: string) {
  const value = attributeValue(attributes, key);
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "ja", "1"].includes(normalized)) return true;
    if (["false", "no", "nej", "0"].includes(normalized)) return false;
  }

  return null;
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])
  );
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function descriptionToHtml(value: string) {
  return escapeHtml(value).replaceAll("\n", "<br />");
}

export function buildCardDna(
  card: CardDnaSource,
  attributes: CardAttribute[] = []
): CardDna {
  const sport = stringAttribute(attributes, "sport");
  const team = stringAttribute(attributes, "team");
  const variation = stringAttribute(attributes, "variation");
  const language = stringAttribute(attributes, "language");
  const grade = stringAttribute(attributes, "grade");
  const gradingCompany = stringAttribute(attributes, "grading_company");
  const memorabiliaType = stringAttribute(attributes, "memorabilia_type");
  const serialNumber =
    stringAttribute(attributes, "serial_number") ?? card.serial_number;
  const numberedTo = numberAttribute(attributes, "serial_numbered_to");
  const rookie = booleanAttribute(attributes, "rookie_card") === true;
  const autograph = booleanAttribute(attributes, "autograph") === true;
  const memorabilia = booleanAttribute(attributes, "memorabilia") === true;

  const featureLabels = unique([
    rookie ? "Rookie Card" : null,
    autograph ? "Autograph" : null,
    memorabilia ? memorabiliaType ?? "Memorabilia" : null,
    numberedTo
      ? serialNumber
        ? `Numbered ${serialNumber}/${numberedTo}`
        : `Numbered /${numberedTo}`
      : null,
    grade && gradingCompany ? `${gradingCompany} ${grade}` : grade,
    variation,
  ]);

  const title = unique([
    card.year,
    card.manufacturer,
    card.set_name,
    card.player_name,
    card.parallel_name,
    card.card_number ? `#${card.card_number}` : null,
    rookie ? "RC" : null,
    autograph ? "Auto" : null,
    numberedTo ? `/${numberedTo}` : null,
  ]).join(" · ");

  const details = unique([
    sport ? `Sport: ${sport}` : null,
    team ? `Team: ${team}` : null,
    card.set_name ? `Set: ${card.set_name}` : null,
    card.parallel_name ? `Parallel: ${card.parallel_name}` : null,
    card.card_number ? `Card number: ${card.card_number}` : null,
    ...featureLabels,
    language ? `Language: ${language}` : null,
  ]);

  return {
    description: details.length
      ? `Card details\n${details.map((detail) => `• ${detail}`).join("\n")}`
      : "Trading card from the Vallective inventory.",
    featureLabels,
    tags: unique([
      "Vallective",
      "Trading Card",
      sport,
      team,
      card.player_name,
      card.year,
      card.manufacturer,
      card.set_name,
      card.parallel_name,
      rookie ? "Rookie Card" : null,
      autograph ? "Autograph" : null,
      memorabilia ? "Memorabilia" : null,
      numberedTo ? "Serial Numbered" : null,
      variation,
    ]).slice(0, 40),
    title: title.slice(0, 180),
  };
}

