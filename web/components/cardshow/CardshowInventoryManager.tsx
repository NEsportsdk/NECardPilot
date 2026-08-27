"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  type CardshowInventoryItemInput,
  type CardshowInventoryStatus,
  type CardshowPriceSource,
  type UpsertCardshowInventoryResult,
  upsertCardshowInventory,
} from "@/lib/cardshow/upsertCardshowInventory";
import { createClient } from "@/lib/supabase/client";

const CARD_IMAGE_BUCKET = "card-images";
const SIGNED_URL_SECONDS = 60 * 60;
const MAX_BATCH_SIZE = 5000;
const DISPLAY_LIMIT = 250;
const SELECTED_EDITOR_LIMIT = 160;
const IMAGE_SIGN_LIMIT = 160;

const ATTRIBUTE_KEYS = [
  "sport",
  "team",
  "brand",
  "product",
  "set_name",
  "grading_company",
  "grade",
] as const;

type NumericDatabaseValue = number | string | null;
type CollectionType = "pc" | "inventory";
type ValuationSource = "market" | "manual" | "none";
type ConditionFilter = "all" | "raw" | "graded";
type ValuationFilter = "all" | ValuationSource;
type InventoryFilter =
  | "all"
  | "not_added"
  | "in_event"
  | "available"
  | "reserved"
  | "withdrawn";
type SortOption =
  | "newest"
  | "player"
  | "value_high"
  | "asking_high"
  | "collection";
type BulkPricingMode = "current_value" | "manual" | "price_group";

type CollectionRow = {
  id: string;
  name: string;
  type: CollectionType;
  currency: string;
};

type CardRow = {
  id: string;
  current_collection_id: string;
  player_name: string;
  year: string | null;
  manufacturer: string | null;
  set_name: string | null;
  card_number: string | null;
  parallel_name: string | null;
  serial_number: string | null;
  purchase_price: NumericDatabaseValue;
  estimated_value: NumericDatabaseValue;
  market_estimated_value: NumericDatabaseValue;
  market_value_currency: string | null;
  market_value_confidence: NumericDatabaseValue;
  state: string | null;
  created_at: string;
};

type CardImageRow = {
  card_id: string;
  storage_path: string;
};

type CardAttributeRow = {
  card_id: string;
  attribute_key: string;
  attribute_value: unknown;
};

type ExistingInventoryRow = {
  id: string;
  card_id: string;
  status: "available" | "reserved" | "sold" | "withdrawn";
  asking_price: NumericDatabaseValue;
  floor_price: NumericDatabaseValue;
  price_source: CardshowPriceSource;
  price_group_label: string | null;
  price_group_amount: NumericDatabaseValue;
  location_label: string | null;
  inventory_code: string | null;
  reference_value: NumericDatabaseValue;
  reference_value_source: ValuationSource | null;
  reserved_for: string | null;
  reservation_note: string | null;
  reserved_until: string | null;
  notes: string | null;
};

type ManageableCard = CardRow & {
  collection: CollectionRow;
  collectionCurrency: string;
  imagePath: string | null;
  sport: string | null;
  team: string | null;
  brand: string | null;
  product: string | null;
  insertName: string | null;
  gradingCompany: string | null;
  grade: string | null;
  isGraded: boolean;
  valuationValue: number | null;
  valuationSource: ValuationSource;
  existingInventory: ExistingInventoryRow | null;
  eligible: boolean;
  ineligibilityReason: string | null;
};

type InventoryDraft = {
  status: CardshowInventoryStatus;
  askingPrice: string;
  floorPrice: string;
  priceSource: CardshowPriceSource;
  priceGroupLabel: string;
  priceGroupAmount: string;
  locationLabel: string;
  inventoryCode: string;
  reservedFor: string;
  reservationNote: string;
  reservedUntil: string;
  notes: string;
};

type InventoryDraftField = keyof InventoryDraft;

type CardshowInventoryManagerProps = {
  isOpen: boolean;
  eventId: string;
  eventName: string;
  eventCurrency: string;
  eventStatus: "planning" | "active" | "closed" | "cancelled";
  onClose: () => void;
  onSaved: (result: UpsertCardshowInventoryResult) => void;
};

function toOptionalNumber(value: NumericDatabaseValue) {
  if (value === null || value === "") {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function getAttributeValue(attributes: CardAttributeRow[], key: string) {
  return attributes.find(
    (attribute) => attribute.attribute_key === key
  )?.attribute_value;
}

function getStringAttribute(attributes: CardAttributeRow[], key: string) {
  const value = getAttributeValue(attributes, key);

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function getValuation(
  card: CardRow,
  collectionCurrency: string
): { value: number | null; source: ValuationSource } {
  const marketValue = toOptionalNumber(card.market_estimated_value);
  const marketCurrency =
    card.market_value_currency?.trim().toUpperCase() || collectionCurrency;

  if (marketValue !== null && marketCurrency === collectionCurrency) {
    return {
      value: marketValue,
      source: "market",
    };
  }

  const manualValue = toOptionalNumber(card.estimated_value);

  if (manualValue !== null) {
    return {
      value: manualValue,
      source: "manual",
    };
  }

  return {
    value: null,
    source: "none",
  };
}

function normalizeSearch(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function joinDistinct(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .filter(
          (value): value is string =>
            typeof value === "string" && Boolean(value.trim())
        )
        .map((value) => value.trim())
    )
  ).join(" · ");
}

function formatCurrency(value: number | null, currency = "DKK") {
  if (value === null) {
    return "—";
  }

  if (currency === "DKK") {
    return `${value.toLocaleString("da-DK", {
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })} kr.`;
  }

  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateTimeLocal(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset)
    .toISOString()
    .slice(0, 16);
}

function getCollectionTypeLabel(type: CollectionType) {
  return type === "pc" ? "Personal Collection" : "Dealer Inventory";
}

function getValuationLabel(source: ValuationSource) {
  switch (source) {
    case "market":
      return "Market";
    case "manual":
      return "Your estimate";
    default:
      return "No valuation";
  }
}

function getReadableError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Cardshow inventory could not be updated. Try again.";
}

function createDraft(card: ManageableCard): InventoryDraft {
  const existing = card.existingInventory;

  if (existing) {
    return {
      status:
        existing.status === "sold"
          ? "available"
          : existing.status,
      askingPrice:
        existing.asking_price === null
          ? ""
          : String(existing.asking_price),
      floorPrice:
        existing.floor_price === null
          ? ""
          : String(existing.floor_price),
      priceSource: existing.price_source,
      priceGroupLabel: existing.price_group_label ?? "",
      priceGroupAmount:
        existing.price_group_amount === null
          ? ""
          : String(existing.price_group_amount),
      locationLabel: existing.location_label ?? "",
      inventoryCode: existing.inventory_code ?? "",
      reservedFor: existing.reserved_for ?? "",
      reservationNote: existing.reservation_note ?? "",
      reservedUntil: formatDateTimeLocal(existing.reserved_until),
      notes: existing.notes ?? "",
    };
  }

  return {
    status: "available",
    askingPrice:
      card.valuationValue === null ? "" : String(card.valuationValue),
    floorPrice: "",
    priceSource:
      card.valuationSource === "market"
        ? "market"
        : card.valuationSource === "manual"
          ? "suggested"
          : "manual",
    priceGroupLabel: "",
    priceGroupAmount: "",
    locationLabel: "",
    inventoryCode: "",
    reservedFor: "",
    reservationNote: "",
    reservedUntil: "",
    notes: "",
  };
}

function parsePreviewMoney(value: string) {
  if (!value.trim()) {
    return null;
  }

  let normalizedValue = value
    .trim()
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");

  const lastComma = normalizedValue.lastIndexOf(",");
  const lastDot = normalizedValue.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    normalizedValue =
      lastComma > lastDot
        ? normalizedValue.replace(/\./g, "").replace(/,/g, ".")
        : normalizedValue.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalizedValue = normalizedValue.replace(/,/g, ".");
  } else if (lastDot >= 0) {
    const parts = normalizedValue.split(".");

    if (parts.length === 2 && parts[1]?.length === 3) {
      normalizedValue = parts.join("");
    }
  }

  const parsedValue = Number(normalizedValue);
  return Number.isFinite(parsedValue) ? Math.max(0, parsedValue) : null;
}

export default function CardshowInventoryManager({
  isOpen,
  eventId,
  eventName,
  eventCurrency,
  eventStatus,
  onClose,
  onSaved,
}: CardshowInventoryManagerProps) {
  const supabase = useMemo(() => createClient(), []);

  const [cards, setCards] = useState<ManageableCard[]>([]);
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [selectedDrafts, setSelectedDrafts] = useState<
    Record<string, InventoryDraft>
  >({});
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  const [searchTerm, setSearchTerm] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [conditionFilter, setConditionFilter] =
    useState<ConditionFilter>("all");
  const [valuationFilter, setValuationFilter] =
    useState<ValuationFilter>("all");
  const [inventoryFilter, setInventoryFilter] =
    useState<InventoryFilter>("all");
  const [sortOption, setSortOption] = useState<SortOption>("newest");

  const [bulkStatus, setBulkStatus] =
    useState<CardshowInventoryStatus>("available");
  const [bulkPricingMode, setBulkPricingMode] =
    useState<BulkPricingMode>("current_value");
  const [bulkAskingPrice, setBulkAskingPrice] = useState("");
  const [bulkFloorPrice, setBulkFloorPrice] = useState("");
  const [bulkPriceGroupLabel, setBulkPriceGroupLabel] = useState("");
  const [bulkPriceGroupAmount, setBulkPriceGroupAmount] = useState("");
  const [bulkLocationLabel, setBulkLocationLabel] = useState("");
  const [bulkInventoryPrefix, setBulkInventoryPrefix] = useState("");
  const [bulkReservedFor, setBulkReservedFor] = useState("");
  const [bulkReservationNote, setBulkReservationNote] = useState("");
  const [bulkReservedUntil, setBulkReservedUntil] = useState("");
  const [bulkNotes, setBulkNotes] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const resetManager = useCallback(() => {
    setCards([]);
    setCollections([]);
    setSelectedDrafts({});
    setImageUrls({});
    setSearchTerm("");
    setCollectionFilter("all");
    setConditionFilter("all");
    setValuationFilter("all");
    setInventoryFilter("all");
    setSortOption("newest");
    setBulkStatus("available");
    setBulkPricingMode("current_value");
    setBulkAskingPrice("");
    setBulkFloorPrice("");
    setBulkPriceGroupLabel("");
    setBulkPriceGroupAmount("");
    setBulkLocationLabel("");
    setBulkInventoryPrefix("");
    setBulkReservedFor("");
    setBulkReservationNote("");
    setBulkReservedUntil("");
    setBulkNotes("");
    setIsLoading(false);
    setIsSaving(false);
    setLoadError(null);
    setSaveError(null);
    setNotice(null);
  }, []);

  const loadCards = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    setNotice(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setLoadError("You must be logged in to manage cardshow inventory.");
      setIsLoading(false);
      return;
    }

    const [collectionResult, cardResult, inventoryResult] = await Promise.all([
      supabase
        .from("collections")
        .select(`
          id,
          name,
          type,
          currency
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),

      supabase
        .from("cards")
        .select(`
          id,
          current_collection_id,
          player_name,
          year,
          manufacturer,
          set_name,
          card_number,
          parallel_name,
          serial_number,
          purchase_price,
          estimated_value,
          market_estimated_value,
          market_value_currency,
          market_value_confidence,
          state,
          created_at
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(MAX_BATCH_SIZE),

      supabase
        .from("cardshow_inventory_items")
        .select(`
          id,
          card_id,
          status,
          asking_price,
          floor_price,
          price_source,
          price_group_label,
          price_group_amount,
          location_label,
          inventory_code,
          reference_value,
          reference_value_source,
          reserved_for,
          reservation_note,
          reserved_until,
          notes
        `)
        .eq("user_id", user.id)
        .eq("event_id", eventId),
    ]);

    if (collectionResult.error) {
      setLoadError(
        `Collections could not be loaded: ${collectionResult.error.message}`
      );
      setIsLoading(false);
      return;
    }

    if (cardResult.error) {
      setLoadError(`Cards could not be loaded: ${cardResult.error.message}`);
      setIsLoading(false);
      return;
    }

    if (inventoryResult.error) {
      setLoadError(
        `Existing event inventory could not be loaded: ${inventoryResult.error.message}`
      );
      setIsLoading(false);
      return;
    }

    const collectionRows =
      (collectionResult.data ?? []) as CollectionRow[];
    const cardRows = (cardResult.data ?? []) as CardRow[];
    const inventoryRows =
      (inventoryResult.data ?? []) as ExistingInventoryRow[];

    setCollections(collectionRows);

    if (cardRows.length === 0) {
      setCards([]);
      setNotice("No cards are registered yet.");
      setIsLoading(false);
      return;
    }

    const [imageResult, attributeResult] = await Promise.all([
      supabase
        .from("card_images")
        .select(`
          card_id,
          storage_path
        `)
        .eq("user_id", user.id)
        .eq("image_type", "front")
        .limit(10000),

      supabase
        .from("card_attributes")
        .select(`
          card_id,
          attribute_key,
          attribute_value
        `)
        .eq("user_id", user.id)
        .in("attribute_key", [...ATTRIBUTE_KEYS])
        .limit(20000),
    ]);

    const warnings: string[] = [];

    if (imageResult.error) {
      warnings.push("Some card images could not be loaded.");
    }

    if (attributeResult.error) {
      warnings.push("Some Card DNA details could not be loaded.");
    }

    const collectionById = new Map(
      collectionRows.map((collection) => [collection.id, collection])
    );
    const inventoryByCardId = new Map(
      inventoryRows.map((item) => [item.card_id, item])
    );
    const imagePathByCardId = new Map(
      ((imageResult.data ?? []) as CardImageRow[]).map((image) => [
        image.card_id,
        image.storage_path,
      ])
    );
    const attributesByCardId = new Map<string, CardAttributeRow[]>();

    for (const attribute of
      (attributeResult.data ?? []) as CardAttributeRow[]) {
      const current = attributesByCardId.get(attribute.card_id) ?? [];
      current.push(attribute);
      attributesByCardId.set(attribute.card_id, current);
    }

    const normalizedEventCurrency = eventCurrency.trim().toUpperCase();

    const nextCards = cardRows
      .map<ManageableCard | null>((card) => {
        const collection = collectionById.get(card.current_collection_id);

        if (!collection) {
          return null;
        }

        const collectionCurrency = collection.currency.trim().toUpperCase();
        const attributes = attributesByCardId.get(card.id) ?? [];
        const gradingCompany = getStringAttribute(
          attributes,
          "grading_company"
        );
        const grade = getStringAttribute(attributes, "grade");
        const valuation = getValuation(card, collectionCurrency);
        const existingInventory = inventoryByCardId.get(card.id) ?? null;

        let ineligibilityReason: string | null = null;

        if (collectionCurrency !== normalizedEventCurrency) {
          ineligibilityReason = `Uses ${collectionCurrency}, while this event uses ${normalizedEventCurrency}.`;
        } else if (["sold", "archived"].includes(card.state ?? "")) {
          ineligibilityReason = `Card status is ${card.state}.`;
        } else if (card.state === "submitted") {
          ineligibilityReason = "Card is currently at grading.";
        } else if (existingInventory?.status === "sold") {
          ineligibilityReason = "Already sold at this event.";
        }

        return {
          ...card,
          collection,
          collectionCurrency,
          imagePath: imagePathByCardId.get(card.id) ?? null,
          sport: getStringAttribute(attributes, "sport"),
          team: getStringAttribute(attributes, "team"),
          brand: getStringAttribute(attributes, "brand"),
          product: getStringAttribute(attributes, "product"),
          insertName:
            getStringAttribute(attributes, "set_name") ?? card.set_name,
          gradingCompany,
          grade,
          isGraded: Boolean(gradingCompany || grade || card.state === "graded"),
          valuationValue: valuation.value,
          valuationSource: valuation.source,
          existingInventory,
          eligible: ineligibilityReason === null,
          ineligibilityReason,
        };
      })
      .filter((card): card is ManageableCard => card !== null);

    setCards(nextCards);

    if (warnings.length > 0) {
      setNotice(Array.from(new Set(warnings)).join(" "));
    }

    setIsLoading(false);
  }, [eventCurrency, eventId, supabase]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    resetManager();
    void loadCards();
  }, [isOpen, loadCards, resetManager]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSaving) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, isSaving, onClose]);

  const filteredCards = useMemo(() => {
    const normalizedSearch = normalizeSearch(searchTerm);

    const matchingCards = cards.filter((card) => {
      if (
        collectionFilter !== "all" &&
        card.current_collection_id !== collectionFilter
      ) {
        return false;
      }

      if (
        conditionFilter !== "all" &&
        (conditionFilter === "graded") !== card.isGraded
      ) {
        return false;
      }

      if (
        valuationFilter !== "all" &&
        card.valuationSource !== valuationFilter
      ) {
        return false;
      }

      const existingStatus = card.existingInventory?.status ?? null;

      if (inventoryFilter === "not_added" && card.existingInventory) {
        return false;
      }

      if (inventoryFilter === "in_event" && !card.existingInventory) {
        return false;
      }

      if (
        ["available", "reserved", "withdrawn"].includes(inventoryFilter) &&
        existingStatus !== inventoryFilter
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchText = normalizeSearch(
        [
          card.player_name,
          card.team,
          card.sport,
          card.year,
          card.manufacturer,
          card.brand,
          card.product,
          card.insertName,
          card.card_number,
          card.parallel_name,
          card.serial_number,
          card.collection.name,
          card.gradingCompany,
          card.grade,
          card.existingInventory?.location_label,
          card.existingInventory?.inventory_code,
        ]
          .filter(Boolean)
          .join(" ")
      );

      return searchText.includes(normalizedSearch);
    });

    return [...matchingCards].sort((first, second) => {
      switch (sortOption) {
        case "player":
          return first.player_name.localeCompare(second.player_name, "da", {
            sensitivity: "base",
          });
        case "value_high":
          return (second.valuationValue ?? -1) - (first.valuationValue ?? -1);
        case "asking_high":
          return (
            (toOptionalNumber(second.existingInventory?.asking_price ?? null) ??
              -1) -
            (toOptionalNumber(first.existingInventory?.asking_price ?? null) ??
              -1)
          );
        case "collection":
          return first.collection.name.localeCompare(
            second.collection.name,
            "da",
            { sensitivity: "base" }
          );
        case "newest":
        default:
          return (
            new Date(second.created_at).getTime() -
            new Date(first.created_at).getTime()
          );
      }
    });
  }, [
    cards,
    collectionFilter,
    conditionFilter,
    inventoryFilter,
    searchTerm,
    sortOption,
    valuationFilter,
  ]);

  const selectedCards = useMemo(
    () => cards.filter((card) => Boolean(selectedDrafts[card.id])),
    [cards, selectedDrafts]
  );

  const displayedCards = filteredCards.slice(0, DISPLAY_LIMIT);
  const selectedEditorCards = selectedCards.slice(0, SELECTED_EDITOR_LIMIT);
  const selectedCount = selectedCards.length;
  const eligibleFilteredCards = filteredCards.filter((card) => card.eligible);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const candidates = Array.from(
      new Map(
        [...displayedCards, ...selectedEditorCards]
          .slice(0, IMAGE_SIGN_LIMIT)
          .map((card) => [card.id, card])
      ).values()
    ).filter(
      (card) => card.imagePath && !imageUrls[card.id]
    );

    if (candidates.length === 0) {
      return;
    }

    let cancelled = false;

    void Promise.all(
      candidates.map(async (card) => {
        const { data, error } = await supabase.storage
          .from(CARD_IMAGE_BUCKET)
          .createSignedUrl(card.imagePath!, SIGNED_URL_SECONDS);

        if (error || !data?.signedUrl) {
          return null;
        }

        return [card.id, data.signedUrl] as const;
      })
    ).then((entries) => {
      if (cancelled) {
        return;
      }

      const validEntries = entries.filter(
        (entry): entry is readonly [string, string] => entry !== null
      );

      if (validEntries.length === 0) {
        return;
      }

      setImageUrls((currentUrls) => ({
        ...currentUrls,
        ...Object.fromEntries(validEntries),
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [displayedCards, imageUrls, isOpen, selectedEditorCards, supabase]);

  const selectedAskingTotal = useMemo(
    () =>
      selectedCards.reduce((total, card) => {
        const amount = parsePreviewMoney(selectedDrafts[card.id].askingPrice);
        return total + (amount ?? 0);
      }, 0),
    [selectedCards, selectedDrafts]
  );

  const selectedFloorTotal = useMemo(
    () =>
      selectedCards.reduce((total, card) => {
        const amount = parsePreviewMoney(selectedDrafts[card.id].floorPrice);
        return total + (amount ?? 0);
      }, 0),
    [selectedCards, selectedDrafts]
  );

  const selectedWithPrice = selectedCards.filter(
    (card) => parsePreviewMoney(selectedDrafts[card.id].askingPrice) !== null
  ).length;

  function toggleCard(card: ManageableCard) {
    setSaveError(null);
    setNotice(null);

    if (!card.eligible) {
      setSaveError(card.ineligibilityReason ?? "This card is not eligible.");
      return;
    }

    setSelectedDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };

      if (nextDrafts[card.id]) {
        delete nextDrafts[card.id];
      } else if (Object.keys(nextDrafts).length < MAX_BATCH_SIZE) {
        nextDrafts[card.id] = createDraft(card);
      }

      return nextDrafts;
    });
  }

  function selectMatchingCards() {
    const cardsToSelect = eligibleFilteredCards.slice(0, MAX_BATCH_SIZE);

    if (cardsToSelect.length === 0) {
      setNotice("No eligible cards match the current filters.");
      return;
    }

    setSelectedDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };

      for (const card of cardsToSelect) {
        if (!nextDrafts[card.id]) {
          nextDrafts[card.id] = createDraft(card);
        }
      }

      return nextDrafts;
    });

    setNotice(
      `${cardsToSelect.length.toLocaleString("da-DK")} matching cards selected.`
    );
  }

  function selectExistingInventory() {
    const existingCards = cards.filter(
      (card) => card.eligible && card.existingInventory
    );

    setSelectedDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };

      for (const card of existingCards) {
        nextDrafts[card.id] = createDraft(card);
      }

      return nextDrafts;
    });

    setNotice(
      `${existingCards.length.toLocaleString("da-DK")} existing inventory cards selected.`
    );
  }

  function clearSelection() {
    setSelectedDrafts({});
    setSaveError(null);
    setNotice(null);
  }

  function updateDraft(
    cardId: string,
    field: InventoryDraftField,
    value: string
  ) {
    setSaveError(null);

    setSelectedDrafts((currentDrafts) => ({
      ...currentDrafts,
      [cardId]: {
        ...currentDrafts[cardId],
        [field]: value,
      },
    }));
  }

  function applyBulkSettings() {
    if (selectedCount === 0) {
      setSaveError("Select at least one card before applying batch settings.");
      return;
    }

    let missingValueCount = 0;
    const normalizedPrefix = bulkInventoryPrefix.trim();

    setSelectedDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };

      selectedCards.forEach((card, index) => {
        const currentDraft = nextDrafts[card.id];
        let nextDraft: InventoryDraft = {
          ...currentDraft,
          status: bulkStatus,
          floorPrice: bulkFloorPrice,
        };

        if (bulkPricingMode === "current_value") {
          if (card.valuationValue !== null) {
            nextDraft = {
              ...nextDraft,
              askingPrice: String(card.valuationValue),
              priceSource:
                card.valuationSource === "market" ? "market" : "suggested",
              priceGroupLabel: "",
              priceGroupAmount: "",
            };
          } else {
            missingValueCount += 1;
          }
        } else if (bulkPricingMode === "manual") {
          nextDraft = {
            ...nextDraft,
            askingPrice: bulkAskingPrice,
            priceSource: "manual",
            priceGroupLabel: "",
            priceGroupAmount: "",
          };
        } else {
          nextDraft = {
            ...nextDraft,
            askingPrice: bulkPriceGroupAmount,
            priceSource: "price_group",
            priceGroupLabel: bulkPriceGroupLabel,
            priceGroupAmount: bulkPriceGroupAmount,
          };
        }

        if (bulkLocationLabel.trim()) {
          nextDraft.locationLabel = bulkLocationLabel.trim();
        }

        if (normalizedPrefix) {
          nextDraft.inventoryCode = `${normalizedPrefix}-${String(
            index + 1
          ).padStart(4, "0")}`;
        }

        if (bulkNotes.trim()) {
          nextDraft.notes = bulkNotes.trim();
        }

        if (bulkStatus === "reserved") {
          nextDraft.reservedFor = bulkReservedFor;
          nextDraft.reservationNote = bulkReservationNote;
          nextDraft.reservedUntil = bulkReservedUntil;
        } else {
          nextDraft.reservedFor = "";
          nextDraft.reservationNote = "";
          nextDraft.reservedUntil = "";
        }

        nextDrafts[card.id] = nextDraft;
      });

      return nextDrafts;
    });

    setSaveError(null);
    setNotice(
      missingValueCount > 0
        ? `Batch settings applied. ${missingValueCount} cards had no current valuation and kept their existing asking price.`
        : `Batch settings applied to ${selectedCount.toLocaleString(
            "da-DK"
          )} cards.`
    );
  }

  function applyPriceGroup(amount: number) {
    setBulkPricingMode("price_group");
    setBulkPriceGroupAmount(String(amount));
    setBulkPriceGroupLabel(`${amount} kr. box`);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selectedCount < 1) {
      setSaveError("Select at least one card for the cardshow.");
      return;
    }

    if (!["planning", "active"].includes(eventStatus)) {
      setSaveError("Inventory can only be changed for planning or active events.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const items: CardshowInventoryItemInput[] = selectedCards.map((card) => {
        const draft = selectedDrafts[card.id];

        return {
          cardId: card.id,
          status: draft.status,
          askingPrice: draft.askingPrice,
          floorPrice: draft.floorPrice,
          priceSource: draft.priceSource,
          priceGroupLabel: draft.priceGroupLabel,
          priceGroupAmount: draft.priceGroupAmount,
          locationLabel: draft.locationLabel,
          inventoryCode: draft.inventoryCode,
          reservedFor: draft.reservedFor,
          reservationNote: draft.reservationNote,
          reservedUntil: draft.reservedUntil,
          notes: draft.notes,
        };
      });

      const result = await upsertCardshowInventory({
        eventId,
        items,
      });

      setIsSaving(false);
      onSaved(result);
    } catch (error) {
      setSaveError(getReadableError(error));
      setIsSaving(false);
    }
  }

  if (!isOpen) {
    return null;
  }

  const eventIsEditable = ["planning", "active"].includes(eventStatus);

  return (
    <div
      className="inventory-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <section
        className="inventory-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-manager-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="inventory-header">
          <div>
            <span className="inventory-badge">CARDSHOW INVENTORY</span>
            <h2 id="inventory-manager-title">Manage inventory</h2>
            <p>
              {eventName} · {eventCurrency} · Select cards, apply batch pricing
              and assign their physical show location.
            </p>
          </div>

          <button
            className="close-button"
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close inventory manager"
          >
            ×
          </button>
        </header>

        <form className="inventory-form" onSubmit={handleSubmit}>
          <fieldset disabled={isSaving || !eventIsEditable}>
            <div className="inventory-content">
              {!eventIsEditable && (
                <div className="message error-message">
                  Inventory is read-only because this event is {eventStatus}.
                </div>
              )}

              {loadError && (
                <div className="message error-message">{loadError}</div>
              )}

              {saveError && (
                <div className="message error-message">{saveError}</div>
              )}

              {notice && <div className="message notice-message">{notice}</div>}

              <section className="summary-strip">
                <SummaryValue label="Selected" value={selectedCount.toLocaleString("da-DK")} />
                <SummaryValue
                  label="With asking price"
                  value={`${selectedWithPrice.toLocaleString("da-DK")} / ${selectedCount.toLocaleString("da-DK")}`}
                />
                <SummaryValue
                  label="Asking total"
                  value={formatCurrency(selectedAskingTotal, eventCurrency)}
                />
                <SummaryValue
                  label="Floor total"
                  value={formatCurrency(selectedFloorTotal, eventCurrency)}
                />
              </section>

              <section className="bulk-section">
                <div className="section-heading">
                  <div>
                    <span>01 · BATCH SETTINGS</span>
                    <h3>Apply pricing and location to selected cards</h3>
                    <p>
                      Use one set of show rules for a full box, then fine-tune
                      valuable cards individually below.
                    </p>
                  </div>
                  <button
                    className="apply-button"
                    type="button"
                    onClick={applyBulkSettings}
                    disabled={selectedCount === 0}
                  >
                    Apply to {selectedCount.toLocaleString("da-DK")}
                  </button>
                </div>

                <div className="bulk-grid">
                  <label>
                    <span>STATUS</span>
                    <select
                      value={bulkStatus}
                      onChange={(event) =>
                        setBulkStatus(
                          event.target.value as CardshowInventoryStatus
                        )
                      }
                    >
                      <option value="available">Available</option>
                      <option value="reserved">Reserved</option>
                      <option value="withdrawn">Withdrawn</option>
                    </select>
                  </label>

                  <label>
                    <span>PRICING METHOD</span>
                    <select
                      value={bulkPricingMode}
                      onChange={(event) =>
                        setBulkPricingMode(
                          event.target.value as BulkPricingMode
                        )
                      }
                    >
                      <option value="current_value">Use current value</option>
                      <option value="manual">Manual asking price</option>
                      <option value="price_group">Price group / box</option>
                    </select>
                  </label>

                  {bulkPricingMode === "manual" && (
                    <label>
                      <span>ASKING PRICE</span>
                      <input
                        inputMode="decimal"
                        value={bulkAskingPrice}
                        onChange={(event) =>
                          setBulkAskingPrice(event.target.value)
                        }
                        placeholder="Example: 100"
                      />
                    </label>
                  )}

                  {bulkPricingMode === "price_group" && (
                    <>
                      <label>
                        <span>PRICE GROUP LABEL</span>
                        <input
                          value={bulkPriceGroupLabel}
                          onChange={(event) =>
                            setBulkPriceGroupLabel(event.target.value)
                          }
                          placeholder="Example: 20 kr. box"
                        />
                      </label>
                      <label>
                        <span>PRICE GROUP AMOUNT</span>
                        <input
                          inputMode="decimal"
                          value={bulkPriceGroupAmount}
                          onChange={(event) =>
                            setBulkPriceGroupAmount(event.target.value)
                          }
                          placeholder="20"
                        />
                      </label>
                    </>
                  )}

                  <label>
                    <span>FLOOR PRICE</span>
                    <input
                      inputMode="decimal"
                      value={bulkFloorPrice}
                      onChange={(event) =>
                        setBulkFloorPrice(event.target.value)
                      }
                      placeholder="Optional fixed floor"
                    />
                  </label>

                  <label>
                    <span>PHYSICAL LOCATION</span>
                    <input
                      value={bulkLocationLabel}
                      onChange={(event) =>
                        setBulkLocationLabel(event.target.value)
                      }
                      placeholder="Box A · Row 2"
                    />
                  </label>

                  <label>
                    <span>INVENTORY CODE PREFIX</span>
                    <input
                      value={bulkInventoryPrefix}
                      onChange={(event) =>
                        setBulkInventoryPrefix(event.target.value)
                      }
                      placeholder="Example: OCS-A"
                    />
                  </label>

                  {bulkStatus === "reserved" && (
                    <>
                      <label>
                        <span>RESERVED FOR</span>
                        <input
                          value={bulkReservedFor}
                          onChange={(event) =>
                            setBulkReservedFor(event.target.value)
                          }
                          placeholder="Customer name"
                        />
                      </label>
                      <label>
                        <span>RESERVED UNTIL</span>
                        <input
                          type="datetime-local"
                          value={bulkReservedUntil}
                          onChange={(event) =>
                            setBulkReservedUntil(event.target.value)
                          }
                        />
                      </label>
                      <label className="wide-field">
                        <span>RESERVATION NOTE</span>
                        <input
                          value={bulkReservationNote}
                          onChange={(event) =>
                            setBulkReservationNote(event.target.value)
                          }
                          placeholder="Optional reservation note"
                        />
                      </label>
                    </>
                  )}

                  <label className="wide-field">
                    <span>BATCH NOTE</span>
                    <input
                      value={bulkNotes}
                      onChange={(event) => setBulkNotes(event.target.value)}
                      placeholder="Optional note copied to selected inventory rows"
                    />
                  </label>
                </div>

                <div className="price-presets">
                  <span>QUICK PRICE GROUPS</span>
                  {[10, 20, 30, 50, 100, 200].map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => applyPriceGroup(amount)}
                    >
                      {amount} kr.
                    </button>
                  ))}
                </div>
              </section>

              <div className="workspace-grid">
                <section className="library-section">
                  <div className="section-heading compact-heading">
                    <div>
                      <span>02 · CARD LIBRARY</span>
                      <h3>Select cards for {eventName}</h3>
                      <p>
                        Sold, archived, cards at grading and currency mismatches
                        are protected from selection.
                      </p>
                    </div>
                    <div className="selection-buttons">
                      <button type="button" onClick={selectMatchingCards}>
                        Select all matching
                      </button>
                      <button type="button" onClick={selectExistingInventory}>
                        Select existing
                      </button>
                      <button type="button" onClick={clearSelection}>
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="filter-grid">
                    <label className="search-field">
                      <span>SEARCH</span>
                      <input
                        type="search"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Player, product, card number, parallel, box..."
                      />
                    </label>

                    <label>
                      <span>COLLECTION</span>
                      <select
                        value={collectionFilter}
                        onChange={(event) =>
                          setCollectionFilter(event.target.value)
                        }
                      >
                        <option value="all">All collections</option>
                        {collections.map((collection) => (
                          <option key={collection.id} value={collection.id}>
                            {collection.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>CONDITION</span>
                      <select
                        value={conditionFilter}
                        onChange={(event) =>
                          setConditionFilter(
                            event.target.value as ConditionFilter
                          )
                        }
                      >
                        <option value="all">RAW + graded</option>
                        <option value="raw">RAW only</option>
                        <option value="graded">Graded only</option>
                      </select>
                    </label>

                    <label>
                      <span>VALUATION</span>
                      <select
                        value={valuationFilter}
                        onChange={(event) =>
                          setValuationFilter(
                            event.target.value as ValuationFilter
                          )
                        }
                      >
                        <option value="all">All value sources</option>
                        <option value="market">Market estimate</option>
                        <option value="manual">Your estimate</option>
                        <option value="none">No valuation</option>
                      </select>
                    </label>

                    <label>
                      <span>EVENT INVENTORY</span>
                      <select
                        value={inventoryFilter}
                        onChange={(event) =>
                          setInventoryFilter(
                            event.target.value as InventoryFilter
                          )
                        }
                      >
                        <option value="all">All cards</option>
                        <option value="not_added">Not added</option>
                        <option value="in_event">Already in event</option>
                        <option value="available">Available</option>
                        <option value="reserved">Reserved</option>
                        <option value="withdrawn">Withdrawn</option>
                      </select>
                    </label>

                    <label>
                      <span>SORT</span>
                      <select
                        value={sortOption}
                        onChange={(event) =>
                          setSortOption(event.target.value as SortOption)
                        }
                      >
                        <option value="newest">Newest cards</option>
                        <option value="player">Player A–Z</option>
                        <option value="value_high">Highest value</option>
                        <option value="asking_high">Highest asking</option>
                        <option value="collection">Collection</option>
                      </select>
                    </label>
                  </div>

                  <div className="result-bar">
                    <span>
                      Showing {displayedCards.length.toLocaleString("da-DK")} of{" "}
                      {filteredCards.length.toLocaleString("da-DK")} matching cards
                    </span>
                    {filteredCards.length > DISPLAY_LIMIT && (
                      <small>
                        Narrow the filters to browse beyond the first {DISPLAY_LIMIT}.
                        “Select all matching” still selects the complete result set.
                      </small>
                    )}
                  </div>

                  {isLoading ? (
                    <div className="loading-state">
                      <span className="spinner" />
                      <p>Loading cards and existing event inventory...</p>
                    </div>
                  ) : displayedCards.length === 0 ? (
                    <div className="empty-state">
                      <strong>No matching cards</strong>
                      <p>Adjust the filters or scan more cards first.</p>
                    </div>
                  ) : (
                    <div className="card-list">
                      {displayedCards.map((card) => {
                        const isSelected = Boolean(selectedDrafts[card.id]);
                        const existingStatus =
                          card.existingInventory?.status ?? null;
                        const subtitle = joinDistinct([
                          card.year,
                          card.brand ?? card.manufacturer,
                          card.product ?? card.insertName,
                          card.card_number ? `#${card.card_number}` : null,
                          card.parallel_name,
                          card.serial_number,
                        ]);

                        return (
                          <button
                            className={[
                              "library-card",
                              isSelected ? "selected" : "",
                              !card.eligible ? "ineligible" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            key={card.id}
                            type="button"
                            onClick={() => toggleCard(card)}
                            disabled={!card.eligible}
                          >
                            <span className="select-mark">
                              {isSelected ? "✓" : ""}
                            </span>

                            <span className="thumbnail">
                              {imageUrls[card.id] ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={imageUrls[card.id]}
                                  alt={`${card.player_name} card front`}
                                />
                              ) : (
                                <span>NE</span>
                              )}
                            </span>

                            <span className="card-copy">
                              <strong>{card.player_name}</strong>
                              <small>{subtitle || "Card details unavailable"}</small>
                              <span className="tags">
                                <i>{card.collection.name}</i>
                                <i>{getCollectionTypeLabel(card.collection.type)}</i>
                                {card.isGraded && (
                                  <i>
                                    {joinDistinct([
                                      card.gradingCompany,
                                      card.grade,
                                    ]) || "Graded"}
                                  </i>
                                )}
                                {existingStatus && <i>{existingStatus}</i>}
                              </span>
                              {!card.eligible && (
                                <em>{card.ineligibilityReason}</em>
                              )}
                            </span>

                            <span className="card-value">
                              <strong>
                                {formatCurrency(
                                  card.valuationValue,
                                  card.collectionCurrency
                                )}
                              </strong>
                              <small>
                                {getValuationLabel(card.valuationSource)}
                              </small>
                              {card.existingInventory?.asking_price !== null &&
                                card.existingInventory && (
                                  <i>
                                    Asking{" "}
                                    {formatCurrency(
                                      toOptionalNumber(
                                        card.existingInventory.asking_price
                                      ),
                                      eventCurrency
                                    )}
                                  </i>
                                )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="selected-section">
                  <div className="section-heading compact-heading">
                    <div>
                      <span>03 · SELECTED CARDS</span>
                      <h3>Review show settings</h3>
                      <p>
                        Bulk settings handle large boxes. Individual rows below
                        are intended for higher-value exceptions.
                      </p>
                    </div>
                    <strong className="selected-count">
                      {selectedCount.toLocaleString("da-DK")}
                    </strong>
                  </div>

                  {selectedCount === 0 ? (
                    <div className="empty-state compact-empty">
                      <strong>No cards selected</strong>
                      <p>Select cards from the library or use a batch selector.</p>
                    </div>
                  ) : (
                    <>
                      {selectedCount > SELECTED_EDITOR_LIMIT && (
                        <div className="selection-notice">
                          The first {SELECTED_EDITOR_LIMIT} selected cards are shown
                          for individual editing. Batch settings and saving still
                          apply to all {selectedCount.toLocaleString("da-DK")} cards.
                        </div>
                      )}

                      <div className="selected-list">
                        {selectedEditorCards.map((card) => {
                          const draft = selectedDrafts[card.id];
                          const title = joinDistinct([
                            card.year,
                            card.card_number ? `#${card.card_number}` : null,
                            card.parallel_name,
                          ]);

                          return (
                            <article className="selected-card" key={card.id}>
                              <div className="selected-card-heading">
                                <div>
                                  <strong>{card.player_name}</strong>
                                  <span>{title || card.collection.name}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => toggleCard(card)}
                                >
                                  Remove
                                </button>
                              </div>

                              <div className="selected-card-grid">
                                <label>
                                  <span>STATUS</span>
                                  <select
                                    value={draft.status}
                                    onChange={(event) =>
                                      updateDraft(
                                        card.id,
                                        "status",
                                        event.target.value
                                      )
                                    }
                                  >
                                    <option value="available">Available</option>
                                    <option value="reserved">Reserved</option>
                                    <option value="withdrawn">Withdrawn</option>
                                  </select>
                                </label>

                                <label>
                                  <span>PRICE SOURCE</span>
                                  <select
                                    value={draft.priceSource}
                                    onChange={(event) =>
                                      updateDraft(
                                        card.id,
                                        "priceSource",
                                        event.target.value
                                      )
                                    }
                                  >
                                    <option value="manual">Manual</option>
                                    <option value="market">Market</option>
                                    <option value="suggested">Suggested</option>
                                    <option value="price_group">Price group</option>
                                  </select>
                                </label>

                                <label>
                                  <span>ASKING</span>
                                  <input
                                    inputMode="decimal"
                                    value={draft.askingPrice}
                                    onChange={(event) =>
                                      updateDraft(
                                        card.id,
                                        "askingPrice",
                                        event.target.value
                                      )
                                    }
                                    placeholder="Price"
                                  />
                                </label>

                                <label>
                                  <span>FLOOR</span>
                                  <input
                                    inputMode="decimal"
                                    value={draft.floorPrice}
                                    onChange={(event) =>
                                      updateDraft(
                                        card.id,
                                        "floorPrice",
                                        event.target.value
                                      )
                                    }
                                    placeholder="Optional"
                                  />
                                </label>

                                <label>
                                  <span>LOCATION</span>
                                  <input
                                    value={draft.locationLabel}
                                    onChange={(event) =>
                                      updateDraft(
                                        card.id,
                                        "locationLabel",
                                        event.target.value
                                      )
                                    }
                                    placeholder="Box / row"
                                  />
                                </label>

                                <label>
                                  <span>INVENTORY CODE</span>
                                  <input
                                    value={draft.inventoryCode}
                                    onChange={(event) =>
                                      updateDraft(
                                        card.id,
                                        "inventoryCode",
                                        event.target.value
                                      )
                                    }
                                    placeholder="Optional code"
                                  />
                                </label>

                                {draft.priceSource === "price_group" && (
                                  <>
                                    <label>
                                      <span>GROUP LABEL</span>
                                      <input
                                        value={draft.priceGroupLabel}
                                        onChange={(event) =>
                                          updateDraft(
                                            card.id,
                                            "priceGroupLabel",
                                            event.target.value
                                          )
                                        }
                                      />
                                    </label>
                                    <label>
                                      <span>GROUP AMOUNT</span>
                                      <input
                                        inputMode="decimal"
                                        value={draft.priceGroupAmount}
                                        onChange={(event) =>
                                          updateDraft(
                                            card.id,
                                            "priceGroupAmount",
                                            event.target.value
                                          )
                                        }
                                      />
                                    </label>
                                  </>
                                )}

                                {draft.status === "reserved" && (
                                  <>
                                    <label>
                                      <span>RESERVED FOR</span>
                                      <input
                                        value={draft.reservedFor}
                                        onChange={(event) =>
                                          updateDraft(
                                            card.id,
                                            "reservedFor",
                                            event.target.value
                                          )
                                        }
                                      />
                                    </label>
                                    <label>
                                      <span>RESERVED UNTIL</span>
                                      <input
                                        type="datetime-local"
                                        value={draft.reservedUntil}
                                        onChange={(event) =>
                                          updateDraft(
                                            card.id,
                                            "reservedUntil",
                                            event.target.value
                                          )
                                        }
                                      />
                                    </label>
                                  </>
                                )}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </>
                  )}
                </section>
              </div>
            </div>
          </fieldset>

          <footer className="inventory-footer">
            <div>
              <strong>
                {selectedCount.toLocaleString("da-DK")} cards selected
              </strong>
              <span>
                {selectedWithPrice.toLocaleString("da-DK")} have an asking
                price · {formatCurrency(selectedAskingTotal, eventCurrency)} total
              </span>
            </div>

            <div className="footer-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                className="save-button"
                type="submit"
                disabled={
                  isSaving ||
                  isLoading ||
                  selectedCount === 0 ||
                  !eventIsEditable
                }
              >
                {isSaving ? "Saving inventory..." : "Save event inventory"}
              </button>
            </div>
          </footer>
        </form>
      </section>

      <style jsx>{`
        .inventory-backdrop {
          position: fixed;
          inset: 0;
          z-index: 2400;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(3, 5, 12, 0.88);
          backdrop-filter: blur(16px);
        }

        .inventory-modal {
          width: min(1520px, 100%);
          max-height: calc(100vh - 40px);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 25px;
          background:
            radial-gradient(
              circle at top right,
              rgba(124, 92, 255, 0.13),
              transparent 32%
            ),
            #0e1119;
          color: #f8fafc;
          box-shadow: 0 35px 120px rgba(0, 0, 0, 0.68);
        }

        .inventory-header {
          flex: 0 0 auto;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding: 24px 26px 20px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.11);
          background: rgba(14, 17, 25, 0.96);
        }

        .inventory-badge {
          display: inline-flex;
          padding: 6px 9px;
          border: 1px solid rgba(167, 139, 250, 0.25);
          border-radius: 999px;
          background: rgba(139, 92, 246, 0.1);
          color: #c4b5fd;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 0.15em;
        }

        .inventory-header h2 {
          margin: 11px 0 0;
          color: #ffffff;
          font-size: 27px;
          letter-spacing: -0.04em;
        }

        .inventory-header p {
          margin: 7px 0 0;
          color: #858da0;
          font-size: 12px;
          line-height: 1.55;
        }

        .close-button {
          width: 39px;
          height: 39px;
          flex: 0 0 auto;
          border: 1px solid rgba(148, 163, 184, 0.15);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.025);
          color: #9299aa;
          font-size: 24px;
          cursor: pointer;
        }

        .inventory-form {
          min-height: 0;
          display: flex;
          flex: 1;
          flex-direction: column;
        }

        fieldset {
          min-width: 0;
          min-height: 0;
          margin: 0;
          padding: 0;
          border: 0;
          overflow-y: auto;
        }

        .inventory-content {
          display: grid;
          gap: 16px;
          padding: 20px 22px 26px;
        }

        .message {
          padding: 12px 14px;
          border-radius: 12px;
          font-size: 11px;
          line-height: 1.5;
        }

        .error-message {
          border: 1px solid rgba(248, 113, 113, 0.22);
          background: rgba(239, 68, 68, 0.07);
          color: #fecaca;
        }

        .notice-message {
          border: 1px solid rgba(96, 165, 250, 0.2);
          background: rgba(59, 130, 246, 0.06);
          color: #bfdbfe;
        }

        .summary-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .bulk-section,
        .library-section,
        .selected-section {
          min-width: 0;
          padding: 18px;
          border: 1px solid rgba(148, 163, 184, 0.11);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.018);
        }

        .section-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding-bottom: 15px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.09);
        }

        .compact-heading {
          padding-bottom: 12px;
        }

        .section-heading span,
        .bulk-grid label > span,
        .filter-grid label > span,
        .selected-card-grid label > span,
        .price-presets > span {
          color: #70798d;
          font-size: 8px;
          font-weight: 850;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .section-heading h3 {
          margin: 6px 0 0;
          color: #ffffff;
          font-size: 17px;
          letter-spacing: -0.025em;
        }

        .section-heading p {
          max-width: 650px;
          margin: 6px 0 0;
          color: #747d90;
          font-size: 10px;
          line-height: 1.5;
        }

        .apply-button,
        .selection-buttons button,
        .selected-card-heading button,
        .price-presets button {
          min-height: 34px;
          border: 1px solid rgba(167, 139, 250, 0.18);
          border-radius: 9px;
          background: rgba(124, 92, 255, 0.055);
          color: #c8c0ff;
          font-size: 9px;
          font-weight: 750;
          cursor: pointer;
        }

        .apply-button {
          flex: 0 0 auto;
          padding: 0 12px;
        }

        .bulk-grid,
        .filter-grid,
        .selected-card-grid {
          display: grid;
          gap: 10px;
          margin-top: 15px;
        }

        .bulk-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .filter-grid {
          grid-template-columns: minmax(240px, 1.5fr) repeat(5, minmax(135px, 0.7fr));
        }

        .selected-card-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .bulk-grid label,
        .filter-grid label,
        .selected-card-grid label {
          min-width: 0;
          display: grid;
          gap: 6px;
        }

        .wide-field {
          grid-column: span 2;
        }

        input,
        select {
          width: 100%;
          min-height: 40px;
          padding: 0 11px;
          border: 1px solid rgba(148, 163, 184, 0.13);
          border-radius: 10px;
          outline: none;
          background: rgba(0, 0, 0, 0.18);
          color: #ffffff;
          color-scheme: dark;
          font: inherit;
          font-size: 10px;
        }

        input:focus,
        select:focus {
          border-color: rgba(167, 139, 250, 0.5);
          box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.06);
        }

        .price-presets {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 12px;
        }

        .price-presets > span {
          margin-right: 3px;
        }

        .price-presets button {
          min-height: 30px;
          padding: 0 9px;
        }

        .workspace-grid {
          min-width: 0;
          display: grid;
          grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
          gap: 16px;
          align-items: start;
        }

        .selection-buttons {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 6px;
        }

        .selection-buttons button {
          padding: 0 9px;
        }

        .result-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 11px 0;
          color: #7c8598;
          font-size: 9px;
        }

        .result-bar small {
          max-width: 430px;
          color: #625e72;
          text-align: right;
          line-height: 1.4;
        }

        .card-list,
        .selected-list {
          display: grid;
          gap: 7px;
          max-height: 640px;
          overflow-y: auto;
          padding-right: 3px;
        }

        .library-card {
          width: 100%;
          min-width: 0;
          display: grid;
          grid-template-columns: auto auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 10px;
          padding: 10px;
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 13px;
          background: rgba(0, 0, 0, 0.13);
          color: inherit;
          text-align: left;
          cursor: pointer;
        }

        .library-card:hover:not(:disabled),
        .library-card.selected {
          border-color: rgba(167, 139, 250, 0.4);
          background: rgba(124, 92, 255, 0.06);
        }

        .library-card.ineligible {
          cursor: not-allowed;
          opacity: 0.48;
        }

        .select-mark {
          width: 24px;
          height: 24px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(148, 163, 184, 0.15);
          border-radius: 7px;
          color: #d8d1ff;
          font-size: 10px;
        }

        .selected .select-mark {
          border-color: rgba(167, 139, 250, 0.4);
          background: rgba(124, 92, 255, 0.17);
        }

        .thumbnail {
          width: 42px;
          height: 58px;
          display: grid;
          place-items: center;
          overflow: hidden;
          border-radius: 8px;
          background: #07090e;
        }

        .thumbnail img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: contain;
        }

        .thumbnail > span {
          color: #766ba9;
          font-size: 8px;
          font-weight: 850;
        }

        .card-copy {
          min-width: 0;
        }

        .card-copy > strong,
        .card-copy > small,
        .card-copy > em,
        .card-value strong,
        .card-value small,
        .card-value i {
          display: block;
        }

        .card-copy > strong {
          color: #ffffff;
          font-size: 11px;
        }

        .card-copy > small {
          margin-top: 4px;
          overflow: hidden;
          color: #747d90;
          font-size: 8px;
          line-height: 1.4;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .card-copy > em {
          margin-top: 5px;
          color: #fca5a5;
          font-size: 8px;
          font-style: normal;
        }

        .tags {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-top: 6px;
        }

        .tags i {
          padding: 4px 6px;
          border-radius: 7px;
          background: rgba(255, 255, 255, 0.03);
          color: #697184;
          font-size: 7px;
          font-style: normal;
        }

        .card-value {
          min-width: 94px;
          text-align: right;
        }

        .card-value strong {
          color: #ffffff;
          font-size: 10px;
        }

        .card-value small {
          margin-top: 4px;
          color: #8178b2;
          font-size: 7px;
        }

        .card-value i {
          margin-top: 5px;
          color: #86efac;
          font-size: 7px;
          font-style: normal;
        }

        .selected-count {
          min-width: 38px;
          min-height: 38px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          background: rgba(124, 92, 255, 0.12);
          color: #d8d1ff;
          font-size: 13px;
        }

        .selection-notice {
          margin: 11px 0;
          padding: 10px 11px;
          border-radius: 10px;
          background: rgba(59, 130, 246, 0.06);
          color: #9bbff6;
          font-size: 8px;
          line-height: 1.45;
        }

        .selected-card {
          padding: 11px;
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.12);
        }

        .selected-card-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .selected-card-heading strong,
        .selected-card-heading span {
          display: block;
        }

        .selected-card-heading strong {
          color: #ffffff;
          font-size: 10px;
        }

        .selected-card-heading span {
          margin-top: 4px;
          color: #6f788b;
          font-size: 8px;
        }

        .selected-card-heading button {
          min-height: 28px;
          padding: 0 8px;
          color: #fca5a5;
        }

        .loading-state,
        .empty-state {
          min-height: 220px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 25px;
          border: 1px dashed rgba(148, 163, 184, 0.14);
          border-radius: 14px;
          color: #737c8e;
          text-align: center;
        }

        .compact-empty {
          min-height: 160px;
          margin-top: 12px;
        }

        .loading-state p,
        .empty-state p {
          margin: 7px 0 0;
          font-size: 9px;
        }

        .empty-state strong {
          color: #ffffff;
          font-size: 12px;
        }

        .spinner {
          width: 28px;
          height: 28px;
          border: 2px solid rgba(167, 139, 250, 0.17);
          border-top-color: #a78bfa;
          border-radius: 50%;
          animation: spin 700ms linear infinite;
        }

        .inventory-footer {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 16px 22px calc(16px + env(safe-area-inset-bottom));
          border-top: 1px solid rgba(148, 163, 184, 0.11);
          background: rgba(14, 17, 25, 0.97);
        }

        .inventory-footer strong,
        .inventory-footer span {
          display: block;
        }

        .inventory-footer strong {
          color: #ffffff;
          font-size: 11px;
        }

        .inventory-footer span {
          margin-top: 4px;
          color: #727b8e;
          font-size: 8px;
        }

        .footer-actions {
          display: flex;
          gap: 9px;
        }

        .secondary-button,
        .save-button {
          min-height: 42px;
          padding: 0 15px;
          border-radius: 11px;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
        }

        .secondary-button {
          border: 1px solid rgba(148, 163, 184, 0.15);
          background: rgba(255, 255, 255, 0.025);
          color: #a8afbd;
        }

        .save-button {
          border: 0;
          background: linear-gradient(135deg, #8b5cf6, #6d5ce7);
          color: #ffffff;
          box-shadow: 0 12px 28px rgba(124, 92, 255, 0.24);
        }

        button:disabled,
        fieldset:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1250px) {
          .bulk-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .filter-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .search-field {
            grid-column: 1 / -1;
          }

          .workspace-grid {
            grid-template-columns: 1fr;
          }

          .card-list,
          .selected-list {
            max-height: 520px;
          }
        }

        @media (max-width: 760px) {
          .inventory-backdrop {
            padding: 0;
          }

          .inventory-modal {
            width: 100%;
            height: 100dvh;
            max-height: none;
            border: 0;
            border-radius: 0;
          }

          .inventory-header {
            padding: calc(16px + env(safe-area-inset-top)) 15px 15px;
          }

          .inventory-header h2 {
            font-size: 24px;
          }

          .inventory-content {
            padding: 14px 12px 20px;
          }

          .summary-strip,
          .bulk-grid,
          .filter-grid,
          .selected-card-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .wide-field,
          .search-field {
            grid-column: 1 / -1;
          }

          .section-heading,
          .inventory-footer {
            align-items: stretch;
            flex-direction: column;
          }

          .apply-button {
            width: 100%;
          }

          .selection-buttons {
            justify-content: flex-start;
          }

          .library-card {
            grid-template-columns: auto auto minmax(0, 1fr);
          }

          .card-value {
            grid-column: 2 / -1;
            text-align: left;
          }

          .footer-actions {
            display: grid;
            grid-template-columns: 0.7fr 1.3fr;
          }
        }

        @media (max-width: 440px) {
          .summary-strip,
          .bulk-grid,
          .filter-grid,
          .selected-card-grid {
            grid-template-columns: 1fr;
          }

          .wide-field,
          .search-field {
            grid-column: auto;
          }

          .selection-buttons {
            display: grid;
            grid-template-columns: 1fr 1fr;
            width: 100%;
          }

          .selection-buttons button:last-child {
            grid-column: 1 / -1;
          }

          .footer-actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

type SummaryValueProps = {
  label: string;
  value: string;
};

function SummaryValue({ label, value }: SummaryValueProps) {
  return (
    <div className="summary-value">
      <span>{label}</span>
      <strong>{value}</strong>

      <style jsx>{`
        .summary-value {
          min-width: 0;
          padding: 13px 14px;
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 13px;
          background: rgba(0, 0, 0, 0.13);
        }

        .summary-value span {
          display: block;
          color: #697184;
          font-size: 7px;
          font-weight: 850;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .summary-value strong {
          display: block;
          margin-top: 7px;
          overflow-wrap: anywhere;
          color: #ffffff;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}