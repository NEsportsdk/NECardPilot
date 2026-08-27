import type {
  CardshowInventoryItemInput,
  CardshowPriceSource,
} from "@/lib/cardshow/upsertCardshowInventory";

export type RapidIntakePricingMode =
  | "estimate"
  | "fixed"
  | "unpriced";

export type RapidIntakeEvent = {
  id: string;
  name: string;
  status: "planning" | "active";
  currency: string;
  startsAt: string | null;
};

export type RapidIntakeSettings = {
  pricingMode: RapidIntakePricingMode;
  askingPercentage: string;
  floorPercentage: string;
  fixedAskingPrice: string;
  fixedFloorPrice: string;
  locationLabel: string;
  inventoryCodePrefix: string;
};

export type RapidIntakeCard = {
  cardId: string;
  estimatedValue: number | null;
};

export type PreparedRapidIntakeItem = {
  item: CardshowInventoryItemInput;
  askingPrice: number | null;
  floorPrice: number | null;
  needsPricing: boolean;
};

export const DEFAULT_RAPID_INTAKE_SETTINGS: RapidIntakeSettings = {
  pricingMode: "estimate",
  askingPercentage: "100",
  floorPercentage: "85",
  fixedAskingPrice: "",
  fixedFloorPrice: "",
  locationLabel: "",
  inventoryCodePrefix: "",
};

const PRICING_MODES = new Set<RapidIntakePricingMode>([
  "estimate",
  "fixed",
  "unpriced",
]);

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseNumber(value: string, label: string) {
  const normalizedValue = value
    .trim()
    .replace(/\s/g, "")
    .replace(/,/g, ".");
  const parsedValue = Number(normalizedValue);

  if (!Number.isFinite(parsedValue)) {
    throw new Error(`${label} skal være et gyldigt tal.`);
  }

  return parsedValue;
}

function parseOptionalMoney(value: string, label: string) {
  if (!value.trim()) {
    return null;
  }

  const parsedValue = parseNumber(value, label);

  if (parsedValue < 0) {
    throw new Error(`${label} kan ikke være negativ.`);
  }

  return roundMoney(parsedValue);
}

function normalizeText(value: string, maxLength: number) {
  const normalizedValue = value.trim();

  if (normalizedValue.length > maxLength) {
    throw new Error(`Feltet må højst være ${maxLength} tegn.`);
  }

  return normalizedValue || null;
}

function normalizeInventoryCodePrefix(value: string) {
  const normalizedValue = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return normalizedValue || null;
}

export function readRapidIntakeSettings(
  value: unknown
): RapidIntakeSettings {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ...DEFAULT_RAPID_INTAKE_SETTINGS };
  }

  const record = value as Record<string, unknown>;
  const pricingMode =
    typeof record.pricingMode === "string" &&
    PRICING_MODES.has(record.pricingMode as RapidIntakePricingMode)
      ? (record.pricingMode as RapidIntakePricingMode)
      : DEFAULT_RAPID_INTAKE_SETTINGS.pricingMode;

  function getString(key: keyof RapidIntakeSettings) {
    return typeof record[key] === "string"
      ? (record[key] as string)
      : DEFAULT_RAPID_INTAKE_SETTINGS[key];
  }

  return {
    pricingMode,
    askingPercentage: getString("askingPercentage"),
    floorPercentage: getString("floorPercentage"),
    fixedAskingPrice: getString("fixedAskingPrice"),
    fixedFloorPrice: getString("fixedFloorPrice"),
    locationLabel: getString("locationLabel"),
    inventoryCodePrefix: getString("inventoryCodePrefix"),
  };
}

export function getRapidIntakeReadinessError({
  enabled,
  collectionType,
  collectionCurrency,
  event,
  settings,
}: {
  enabled: boolean;
  collectionType: "pc" | "inventory" | null;
  collectionCurrency: string | null;
  event: RapidIntakeEvent | null;
  settings: RapidIntakeSettings;
}) {
  if (!enabled) {
    return null;
  }

  if (collectionType !== "inventory") {
    return "Rapid intake kræver en Dealer Inventory-collection.";
  }

  if (!event) {
    return "Vælg det Cardshow, de scannede kort skal tilføjes til.";
  }

  if (
    collectionCurrency &&
    collectionCurrency.toUpperCase() !== event.currency.toUpperCase()
  ) {
    return `Collectionen bruger ${collectionCurrency}, mens Cardshowet bruger ${event.currency}.`;
  }

  try {
    normalizeText(settings.locationLabel, 160);
    normalizeText(settings.inventoryCodePrefix, 40);

    if (settings.pricingMode === "estimate") {
      const askingPercentage = parseNumber(
        settings.askingPercentage,
        "Asking-procenten"
      );
      const floorPercentage = parseNumber(
        settings.floorPercentage,
        "Floor-procenten"
      );

      if (askingPercentage <= 0 || askingPercentage > 300) {
        return "Asking-procenten skal være over 0 og højst 300 %.";
      }

      if (floorPercentage < 0 || floorPercentage > 100) {
        return "Floor-procenten skal være mellem 0 og 100 %.";
      }
    }

    if (settings.pricingMode === "fixed") {
      const askingPrice = parseOptionalMoney(
        settings.fixedAskingPrice,
        "Fast asking price"
      );
      const floorPrice = parseOptionalMoney(
        settings.fixedFloorPrice,
        "Fast floor price"
      );

      if (askingPrice === null || askingPrice <= 0) {
        return "Angiv en fast asking price større end 0.";
      }

      if (floorPrice !== null && floorPrice > askingPrice) {
        return "Fast floor price kan ikke være højere end asking price.";
      }
    }
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Rapid intake-indstillingerne er ugyldige.";
  }

  return null;
}

export function prepareRapidIntakeItem(
  card: RapidIntakeCard,
  settings: RapidIntakeSettings
): PreparedRapidIntakeItem {
  let askingPrice: number | null = null;
  let floorPrice: number | null = null;
  let priceSource: CardshowPriceSource = "manual";
  let needsPricing = false;

  if (settings.pricingMode === "estimate") {
    const askingPercentage = parseNumber(
      settings.askingPercentage,
      "Asking-procenten"
    );
    const floorPercentage = parseNumber(
      settings.floorPercentage,
      "Floor-procenten"
    );

    if (card.estimatedValue !== null && card.estimatedValue > 0) {
      askingPrice = roundMoney(
        card.estimatedValue * (askingPercentage / 100)
      );
      floorPrice = roundMoney(askingPrice * (floorPercentage / 100));
      priceSource = "suggested";
    } else {
      needsPricing = true;
      priceSource = "suggested";
    }
  } else if (settings.pricingMode === "fixed") {
    askingPrice = parseOptionalMoney(
      settings.fixedAskingPrice,
      "Fast asking price"
    );
    floorPrice = parseOptionalMoney(
      settings.fixedFloorPrice,
      "Fast floor price"
    );
  } else {
    needsPricing = true;
  }

  const prefix = normalizeInventoryCodePrefix(
    settings.inventoryCodePrefix
  );
  const cardSuffix = card.cardId.replace(/-/g, "").slice(-6).toUpperCase();

  return {
    askingPrice,
    floorPrice,
    needsPricing,
    item: {
      cardId: card.cardId,
      status: "available",
      askingPrice,
      floorPrice,
      priceSource,
      locationLabel: normalizeText(settings.locationLabel, 160),
      inventoryCode: prefix ? `${prefix}-${cardSuffix}` : null,
      notes: needsPricing
        ? "Rapid intake · Pricing required"
        : "Rapid intake",
    },
  };
}
