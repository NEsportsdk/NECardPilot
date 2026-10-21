export type StorefrontListingInput = {
  cardId: string;
  conditionLabel: string | null;
  currency: "DKK" | "EUR";
  description: string | null;
  priceAmount: number;
  title: string;
  workspaceId: string;
};

export type StorefrontListingInputResult =
  | { data: StorefrontListingInput; ok: true }
  | { error: string; ok: false };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parsePrice(value: string) {
  const compact = value.replace(/\s/g, "");
  const normalized = compact.includes(",")
    ? compact.replace(/\./g, "").replace(",", ".")
    : compact;

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const price = Number(normalized);
  return Number.isFinite(price) && price > 0 && price <= 99999999.99
    ? price
    : null;
}

export function parseStorefrontListingInput(
  formData: FormData
): StorefrontListingInputResult {
  const workspaceId = readText(formData, "workspaceId");
  const cardId = readText(formData, "cardId");
  const title = readText(formData, "title");
  const description = readText(formData, "description");
  const conditionLabel = readText(formData, "conditionLabel");
  const currency = readText(formData, "currency").toUpperCase();
  const priceAmount = parsePrice(readText(formData, "priceAmount"));

  if (!UUID_PATTERN.test(workspaceId) || !UUID_PATTERN.test(cardId)) {
    return { error: "Kortet eller arbejdsrummet er ugyldigt.", ok: false };
  }

  if (title.length < 1 || title.length > 180) {
    return { error: "Titlen skal være mellem 1 og 180 tegn.", ok: false };
  }

  if (description.length > 5000) {
    return { error: "Beskrivelsen er for lang.", ok: false };
  }

  if (conditionLabel.length > 80) {
    return { error: "Tilstandsbeskrivelsen er for lang.", ok: false };
  }

  if (currency !== "DKK" && currency !== "EUR") {
    return { error: "Valutaen understøttes ikke.", ok: false };
  }

  if (priceAmount === null) {
    return { error: "Indtast en gyldig pris over 0.", ok: false };
  }

  return {
    data: {
      cardId,
      conditionLabel: conditionLabel || null,
      currency,
      description: description || null,
      priceAmount,
      title,
      workspaceId,
    },
    ok: true,
  };
}
