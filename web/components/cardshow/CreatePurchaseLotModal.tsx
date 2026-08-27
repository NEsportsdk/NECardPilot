"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createPurchaseLot,
  type CreatePurchaseLotResult,
  type PurchaseLotAllocationMethod,
} from "@/lib/cardshow/createPurchaseLot";
import { createClient } from "@/lib/supabase/client";

const MAX_BATCH_SIZE = 5000;
const DISPLAY_LIMIT = 250;

type NumericDatabaseValue = number | string | null;
type WizardStep = "details" | "cards" | "review";

type CollectionRow = {
  id: string;
  name: string;
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
  state: string | null;
  created_at: string;
};

type ExistingLotCardRow = {
  card_id: string;
};

type OpenEventRow = {
  id: string;
  currency: string;
};

type AskingPriceRow = {
  event_id: string;
  card_id: string;
  asking_price: NumericDatabaseValue;
  updated_at: string;
};

type ReferenceSource = "market" | "asking" | "estimate" | "none";

type PurchaseCard = CardRow & {
  collectionName: string;
  collectionCurrency: string;
  automaticReference: number | null;
  referenceSource: ReferenceSource;
  assignedToLot: boolean;
};

type AllocationPreview = {
  card: PurchaseCard;
  referenceValue: number | null;
  allocatedCost: number | null;
};

type CreatePurchaseLotModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (result: CreatePurchaseLotResult) => void;
};

function toOptionalNumber(value: NumericDatabaseValue) {
  if (value === null || value === "") {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function parseMoney(value: string) {
  if (!value.trim()) {
    return 0;
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
  return Number.isFinite(parsedValue) && parsedValue >= 0
    ? Math.round((parsedValue + Number.EPSILON) * 100) / 100
    : null;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function truncateMoney(value: number) {
  return Math.trunc((value + Number.EPSILON) * 100) / 100;
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

function formatDateInput() {
  const date = new Date();
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function normalizeSearch(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function joinCardDescription(card: PurchaseCard) {
  return [
    card.year,
    card.manufacturer,
    card.set_name,
    card.parallel_name,
    card.card_number ? `#${card.card_number}` : null,
    card.serial_number ? `SN ${card.serial_number}` : null,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" · ");
}

function getReferenceLabel(source: ReferenceSource) {
  switch (source) {
    case "market":
      return "Market";
    case "asking":
      return "Cardshow asking";
    case "estimate":
      return "Your estimate";
    default:
      return "Missing";
  }
}

function getReadableError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The purchase lot could not be created. Try again.";
}

export default function CreatePurchaseLotModal({
  isOpen,
  onClose,
  onCreated,
}: CreatePurchaseLotModalProps) {
  const supabase = useMemo(() => createClient(), []);
  const [step, setStep] = useState<WizardStep>("details");
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [cards, setCards] = useState<PurchaseCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [seller, setSeller] = useState("");
  const [purchaseReference, setPurchaseReference] = useState("");
  const [purchasedAt, setPurchasedAt] = useState(formatDateInput);
  const [currency, setCurrency] = useState("DKK");
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [buyerFee, setBuyerFee] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  const [taxes, setTaxes] = useState("");
  const [otherCosts, setOtherCosts] = useState("");
  const [notes, setNotes] = useState("");
  const [allocationMethod, setAllocationMethod] =
    useState<PurchaseLotAllocationMethod>("proportional");

  const [searchTerm, setSearchTerm] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(
    () => new Set()
  );
  const [referenceOverrides, setReferenceOverrides] = useState<
    Record<string, string>
  >({});
  const [manualAllocations, setManualAllocations] = useState<
    Record<string, string>
  >({});

  const resetModal = useCallback(() => {
    setStep("details");
    setCollections([]);
    setCards([]);
    setIsLoading(false);
    setIsSaving(false);
    setLoadError(null);
    setSaveError(null);
    setNotice(null);
    setName("");
    setSource("");
    setSeller("");
    setPurchaseReference("");
    setPurchasedAt(formatDateInput());
    setCurrency("DKK");
    setPurchaseAmount("");
    setBuyerFee("");
    setShippingCost("");
    setTaxes("");
    setOtherCosts("");
    setNotes("");
    setAllocationMethod("proportional");
    setSearchTerm("");
    setCollectionFilter("all");
    setSelectedCardIds(new Set());
    setReferenceOverrides({});
    setManualAllocations({});
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
      setLoadError("You must be logged in to create a purchase lot.");
      setIsLoading(false);
      return;
    }

    const [collectionResult, cardResult, lotCardResult, eventResult] =
      await Promise.all([
        supabase
          .from("collections")
          .select("id, name, currency")
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
            state,
            created_at
          `)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(MAX_BATCH_SIZE),
        supabase
          .from("purchase_lot_cards")
          .select("card_id")
          .eq("user_id", user.id)
          .limit(MAX_BATCH_SIZE),
        supabase
          .from("cardshow_events")
          .select("id, currency")
          .eq("user_id", user.id)
          .in("status", ["planning", "active"]),
      ]);

    if (collectionResult.error || cardResult.error || lotCardResult.error) {
      setLoadError(
        collectionResult.error?.message ??
          cardResult.error?.message ??
          lotCardResult.error?.message ??
          "Cards could not be loaded."
      );
      setIsLoading(false);
      return;
    }

    const collectionRows =
      (collectionResult.data ?? []) as CollectionRow[];
    const cardRows = (cardResult.data ?? []) as CardRow[];
    const assignedCardIds = new Set(
      ((lotCardResult.data ?? []) as ExistingLotCardRow[]).map(
        (lotCard) => lotCard.card_id
      )
    );
    const openEvents = eventResult.error
      ? []
      : ((eventResult.data ?? []) as OpenEventRow[]);

    let askingRows: AskingPriceRow[] = [];

    if (openEvents.length > 0) {
      const askingResult = await supabase
        .from("cardshow_inventory_items")
        .select("event_id, card_id, asking_price, updated_at")
        .eq("user_id", user.id)
        .in(
          "event_id",
          openEvents.map((event) => event.id)
        )
        .in("status", ["available", "reserved"])
        .not("asking_price", "is", null)
        .order("updated_at", { ascending: false })
        .limit(10000);

      if (!askingResult.error) {
        askingRows = (askingResult.data ?? []) as AskingPriceRow[];
      }
    }

    const collectionById = new Map(
      collectionRows.map((collection) => [collection.id, collection])
    );
    const eventById = new Map(openEvents.map((event) => [event.id, event]));
    const askingByCardAndCurrency = new Map<string, number>();

    for (const askingRow of askingRows) {
      const event = eventById.get(askingRow.event_id);
      const askingValue = toOptionalNumber(askingRow.asking_price);

      if (!event || askingValue === null) {
        continue;
      }

      const key = `${askingRow.card_id}:${event.currency.trim().toUpperCase()}`;

      if (!askingByCardAndCurrency.has(key)) {
        askingByCardAndCurrency.set(key, askingValue);
      }
    }

    const nextCards = cardRows
      .map<PurchaseCard | null>((card) => {
        const collection = collectionById.get(card.current_collection_id);

        if (!collection) {
          return null;
        }

        const collectionCurrency = collection.currency.trim().toUpperCase();
        const marketValue = toOptionalNumber(card.market_estimated_value);
        const marketCurrency =
          card.market_value_currency?.trim().toUpperCase() ||
          collectionCurrency;
        const askingValue = askingByCardAndCurrency.get(
          `${card.id}:${collectionCurrency}`
        );
        const estimatedValue = toOptionalNumber(card.estimated_value);

        let automaticReference: number | null = null;
        let referenceSource: ReferenceSource = "none";

        if (marketValue !== null && marketCurrency === collectionCurrency) {
          automaticReference = marketValue;
          referenceSource = "market";
        } else if (askingValue !== undefined) {
          automaticReference = askingValue;
          referenceSource = "asking";
        } else if (estimatedValue !== null) {
          automaticReference = estimatedValue;
          referenceSource = "estimate";
        }

        return {
          ...card,
          collectionName: collection.name,
          collectionCurrency,
          automaticReference,
          referenceSource,
          assignedToLot: assignedCardIds.has(card.id),
        };
      })
      .filter((card): card is PurchaseCard => card !== null);

    setCollections(collectionRows);
    setCards(nextCards);

    const preferredCurrency =
      collectionRows.find(
        (collection) => collection.currency.trim().toUpperCase() === "DKK"
      )?.currency ?? collectionRows[0]?.currency;

    if (preferredCurrency) {
      setCurrency(preferredCurrency.trim().toUpperCase());
    }

    if (eventResult.error) {
      setNotice(
        "Cardshow asking prices could not be loaded; market and manual estimates remain available."
      );
    } else if (cardRows.length === 0) {
      setNotice("No cards are registered yet.");
    }

    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    resetModal();
    void loadCards();
  }, [isOpen, loadCards, resetModal]);

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

  const currencyOptions = useMemo(
    () =>
      Array.from(
        new Set(
          collections.map((collection) =>
            collection.currency.trim().toUpperCase()
          )
        )
      ).sort(),
    [collections]
  );

  const selectedCards = useMemo(
    () => cards.filter((card) => selectedCardIds.has(card.id)),
    [cards, selectedCardIds]
  );

  const totalCost = useMemo(() => {
    const values = [
      purchaseAmount,
      buyerFee,
      shippingCost,
      taxes,
      otherCosts,
    ].map(parseMoney);

    if (values.some((value) => value === null)) {
      return null;
    }

    return roundMoney(
      values.reduce<number>((total, value) => total + (value ?? 0), 0)
    );
  }, [buyerFee, otherCosts, purchaseAmount, shippingCost, taxes]);

  const allocationPreview = useMemo<AllocationPreview[]>(() => {
    if (selectedCards.length === 0 || totalCost === null) {
      return [];
    }

    if (allocationMethod === "manual") {
      return selectedCards.map((card) => ({
        card,
        referenceValue: null,
        allocatedCost: parseMoney(manualAllocations[card.id] ?? ""),
      }));
    }

    if (allocationMethod === "equal") {
      const baseAllocation = truncateMoney(totalCost / selectedCards.length);
      const remainder = roundMoney(
        totalCost - baseAllocation * selectedCards.length
      );

      return selectedCards.map((card, index) => ({
        card,
        referenceValue: null,
        allocatedCost: roundMoney(
          baseAllocation + (index === 0 ? remainder : 0)
        ),
      }));
    }

    const cardsWithReferences = selectedCards.map((card) => {
      const override = referenceOverrides[card.id];
      const referenceValue = override?.trim()
        ? parseMoney(override)
        : card.automaticReference;

      return { card, referenceValue };
    });
    const referenceTotal = cardsWithReferences.reduce(
      (total, item) => total + (item.referenceValue ?? 0),
      0
    );

    if (
      referenceTotal <= 0 ||
      cardsWithReferences.some(
        (item) => item.referenceValue === null || item.referenceValue <= 0
      )
    ) {
      return cardsWithReferences.map(({ card, referenceValue }) => ({
        card,
        referenceValue,
        allocatedCost: null,
      }));
    }

    const allocations = cardsWithReferences.map(({ card, referenceValue }) => ({
      card,
      referenceValue,
      allocatedCost: truncateMoney(
        (totalCost * (referenceValue ?? 0)) / referenceTotal
      ),
    }));
    const allocatedBeforeRemainder = allocations.reduce(
      (total, item) => total + (item.allocatedCost ?? 0),
      0
    );
    const remainder = roundMoney(totalCost - allocatedBeforeRemainder);

    if (allocations[0]?.allocatedCost !== null) {
      allocations[0].allocatedCost = roundMoney(
        (allocations[0].allocatedCost ?? 0) + remainder
      );
    }

    return allocations;
  }, [
    allocationMethod,
    manualAllocations,
    referenceOverrides,
    selectedCards,
    totalCost,
  ]);

  const allocatedTotal = useMemo(
    () =>
      roundMoney(
        allocationPreview.reduce(
          (total, item) => total + (item.allocatedCost ?? 0),
          0
        )
      ),
    [allocationPreview]
  );

  const allocationError = useMemo(() => {
    if (selectedCards.length === 0) {
      return "Select at least one card.";
    }

    if (totalCost === null || totalCost <= 0) {
      return "The total purchase cost must be greater than zero.";
    }

    if (allocationMethod === "proportional") {
      const missingCount = allocationPreview.filter(
        (item) =>
          item.referenceValue === null || item.referenceValue <= 0
      ).length;

      if (missingCount > 0) {
        return `${missingCount} selected ${missingCount === 1 ? "card needs" : "cards need"} a positive reference value.`;
      }
    }

    if (allocationMethod === "manual") {
      if (allocationPreview.some((item) => item.allocatedCost === null)) {
        return "Enter a valid manual cost for every selected card.";
      }

      if (Math.abs(allocatedTotal - totalCost) >= 0.005) {
        return `Manual costs must total exactly ${formatCurrency(totalCost, currency)}.`;
      }
    }

    if (allocationPreview.some((item) => item.allocatedCost === null)) {
      return "The allocation could not be calculated.";
    }

    return null;
  }, [
    allocatedTotal,
    allocationMethod,
    allocationPreview,
    currency,
    selectedCards.length,
    totalCost,
  ]);

  const filteredCards = useMemo(() => {
    const normalizedSearch = normalizeSearch(searchTerm);

    return cards.filter((card) => {
      if (card.collectionCurrency !== currency) {
        return false;
      }

      if (
        collectionFilter !== "all" &&
        card.current_collection_id !== collectionFilter
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return normalizeSearch(
        [
          card.player_name,
          card.year,
          card.manufacturer,
          card.set_name,
          card.card_number,
          card.parallel_name,
          card.serial_number,
          card.collectionName,
        ]
          .filter(Boolean)
          .join(" ")
      ).includes(normalizedSearch);
    });
  }, [cards, collectionFilter, currency, searchTerm]);

  const selectableFilteredCards = filteredCards.filter(
    (card) =>
      !card.assignedToLot &&
      !["sold", "archived"].includes(card.state ?? "")
  );
  const visibleCards = filteredCards.slice(0, DISPLAY_LIMIT);

  function handleCurrencyChange(nextCurrency: string) {
    setCurrency(nextCurrency);
    setCollectionFilter("all");
    setSelectedCardIds((currentIds) =>
      new Set(
        [...currentIds].filter(
          (cardId) =>
            cards.find((card) => card.id === cardId)?.collectionCurrency ===
            nextCurrency
        )
      )
    );
  }

  function toggleCard(card: PurchaseCard) {
    if (
      card.assignedToLot ||
      ["sold", "archived"].includes(card.state ?? "")
    ) {
      return;
    }

    setSelectedCardIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(card.id)) {
        nextIds.delete(card.id);
      } else if (nextIds.size < MAX_BATCH_SIZE) {
        nextIds.add(card.id);
      }

      return nextIds;
    });
  }

  function selectVisibleCards() {
    setSelectedCardIds((currentIds) => {
      const nextIds = new Set(currentIds);

      for (const card of selectableFilteredCards) {
        if (nextIds.size >= MAX_BATCH_SIZE) {
          break;
        }

        nextIds.add(card.id);
      }

      return nextIds;
    });
  }

  function validateDetails() {
    setSaveError(null);

    if (!name.trim()) {
      setSaveError("Enter a name for the purchase lot.");
      return false;
    }

    if (name.trim().length > 160) {
      setSaveError("The purchase-lot name may contain at most 160 characters.");
      return false;
    }

    if (totalCost === null || totalCost <= 0) {
      setSaveError("Enter valid costs with a total greater than zero.");
      return false;
    }

    return true;
  }

  function goToCards() {
    if (validateDetails()) {
      setStep("cards");
    }
  }

  function goToReview() {
    setSaveError(null);

    if (selectedCards.length === 0) {
      setSaveError("Select at least one card for the purchase lot.");
      return;
    }

    setStep("review");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError(null);

    if (!validateDetails()) {
      setStep("details");
      return;
    }

    if (allocationError) {
      setSaveError(allocationError);
      setStep("review");
      return;
    }

    setIsSaving(true);

    try {
      const allocationByCardId = new Map(
        allocationPreview.map((item) => [item.card.id, item])
      );
      const result = await createPurchaseLot({
        name,
        source,
        seller,
        purchaseReference,
        purchasedAt,
        currency,
        purchaseAmount,
        buyerFee,
        shippingCost,
        taxes,
        otherCosts,
        notes,
        allocationMethod,
        cards: selectedCards.map((card) => {
          const allocation = allocationByCardId.get(card.id);

          return {
            cardId: card.id,
            referenceValue:
              allocationMethod === "proportional"
                ? allocation?.referenceValue
                : null,
            manualAllocatedCost:
              allocationMethod === "manual"
                ? allocation?.allocatedCost
                : null,
          };
        }),
        lock: false,
      });

      onCreated(result);
    } catch (error) {
      setSaveError(getReadableError(error));
      setIsSaving(false);
    }
  }

  if (!isOpen) {
    return null;
  }

  const selectedWithExistingCost = selectedCards.filter(
    (card) => (toOptionalNumber(card.purchase_price) ?? 0) > 0
  ).length;

  return (
    <div className="purchase-backdrop" role="presentation">
      <section
        aria-labelledby="purchase-lot-title"
        aria-modal="true"
        className="purchase-modal"
        role="dialog"
      >
        <header className="purchase-header">
          <div>
            <span className="purchase-badge">ACQUISITION ACCOUNTING</span>
            <h2 id="purchase-lot-title">Create purchase lot</h2>
            <p>
              Capture the full landed cost and allocate it precisely across the
              cards you acquired.
            </p>
          </div>
          <button
            aria-label="Close purchase-lot creator"
            className="close-button"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <nav aria-label="Purchase-lot steps" className="step-navigation">
          {([
            ["details", "1", "Lot & costs"],
            ["cards", "2", "Select cards"],
            ["review", "3", "Review allocation"],
          ] as const).map(([stepId, number, label]) => (
            <button
              aria-current={step === stepId ? "step" : undefined}
              className={step === stepId ? "step-active" : ""}
              disabled={
                isSaving ||
                (stepId === "cards" && !name.trim()) ||
                (stepId === "review" && selectedCards.length === 0)
              }
              key={stepId}
              onClick={() => setStep(stepId)}
              type="button"
            >
              <span>{number}</span>
              <strong>{label}</strong>
            </button>
          ))}
        </nav>

        <form onSubmit={handleSubmit}>
          <div className="purchase-content">
            {isLoading ? (
              <div className="center-state">
                <span className="loading-spinner" />
                <strong>Loading cards and acquisition data…</strong>
              </div>
            ) : loadError ? (
              <div className="error-state" role="alert">
                <strong>Purchase-lot data could not be loaded</strong>
                <p>{loadError}</p>
                <button onClick={() => void loadCards()} type="button">
                  Try again
                </button>
              </div>
            ) : (
              <>
                {notice && <p className="notice-banner">{notice}</p>}

                {step === "details" && (
                  <div className="details-layout">
                    <div className="form-section">
                      <div className="section-heading">
                        <span>01</span>
                        <div>
                          <h3>Purchase details</h3>
                          <p>Identify the acquisition and its original source.</p>
                        </div>
                      </div>

                      <div className="field-grid">
                        <label className="field field-wide">
                          <span>Lot name *</span>
                          <input
                            autoFocus
                            data-testid="purchase-lot-name"
                            maxLength={160}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="e.g. Copenhagen collection · August 2026"
                            value={name}
                          />
                        </label>
                        <label className="field">
                          <span>Source</span>
                          <input
                            maxLength={160}
                            onChange={(event) => setSource(event.target.value)}
                            placeholder="Auction, cardshow, private deal…"
                            value={source}
                          />
                        </label>
                        <label className="field">
                          <span>Seller</span>
                          <input
                            maxLength={200}
                            onChange={(event) => setSeller(event.target.value)}
                            placeholder="Name or business"
                            value={seller}
                          />
                        </label>
                        <label className="field">
                          <span>Purchase reference</span>
                          <input
                            maxLength={200}
                            onChange={(event) =>
                              setPurchaseReference(event.target.value)
                            }
                            placeholder="Order, invoice or receipt no."
                            value={purchaseReference}
                          />
                        </label>
                        <label className="field">
                          <span>Purchase date</span>
                          <input
                            onChange={(event) => setPurchasedAt(event.target.value)}
                            type="date"
                            value={purchasedAt}
                          />
                        </label>
                        <label className="field">
                          <span>Currency</span>
                          <select
                            data-testid="purchase-lot-currency"
                            onChange={(event) =>
                              handleCurrencyChange(event.target.value)
                            }
                            value={currency}
                          >
                            {(currencyOptions.length > 0
                              ? currencyOptions
                              : ["DKK"]
                            ).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>

                    <div className="form-section">
                      <div className="section-heading">
                        <span>02</span>
                        <div>
                          <h3>Landed cost</h3>
                          <p>Include every cost required to acquire the cards.</p>
                        </div>
                      </div>

                      <div className="cost-grid">
                        {[
                          ["Purchase amount *", purchaseAmount, setPurchaseAmount],
                          ["Buyer fee", buyerFee, setBuyerFee],
                          ["Shipping", shippingCost, setShippingCost],
                          ["Taxes / customs", taxes, setTaxes],
                          ["Other costs", otherCosts, setOtherCosts],
                        ].map(([label, value, setter]) => (
                          <label className="field" key={label as string}>
                            <span>{label as string}</span>
                            <div className="money-input">
                              <input
                                data-testid={
                                  label === "Purchase amount *"
                                    ? "purchase-lot-amount"
                                    : undefined
                                }
                                inputMode="decimal"
                                onChange={(event) =>
                                  (setter as (value: string) => void)(
                                    event.target.value
                                  )
                                }
                                placeholder="0,00"
                                value={value as string}
                              />
                              <small>{currency}</small>
                            </div>
                          </label>
                        ))}
                      </div>

                      <div className="total-card">
                        <div>
                          <span>Total acquisition cost</span>
                          <small>Amount to allocate across selected cards</small>
                        </div>
                        <strong>
                          {totalCost === null
                            ? "Invalid amount"
                            : formatCurrency(totalCost, currency)}
                        </strong>
                      </div>
                    </div>

                    <div className="form-section">
                      <div className="section-heading">
                        <span>03</span>
                        <div>
                          <h3>Allocation method</h3>
                          <p>Choose how landed cost should be split.</p>
                        </div>
                      </div>

                      <div className="method-grid">
                        {([
                          [
                            "proportional",
                            "Proportional",
                            "Allocate by market, asking or your own reference value.",
                          ],
                          [
                            "equal",
                            "Equal",
                            "Split the total cost equally across every selected card.",
                          ],
                          [
                            "manual",
                            "Manual",
                            "Set the exact acquisition cost for each individual card.",
                          ],
                        ] as const).map(([method, label, description]) => (
                          <button
                            aria-pressed={allocationMethod === method}
                            className={
                              allocationMethod === method ? "method-active" : ""
                            }
                            key={method}
                            onClick={() => setAllocationMethod(method)}
                            type="button"
                          >
                            <span>{allocationMethod === method ? "●" : "○"}</span>
                            <strong>{label}</strong>
                            <small>{description}</small>
                          </button>
                        ))}
                      </div>

                      <label className="field notes-field">
                        <span>Internal notes</span>
                        <textarea
                          maxLength={5000}
                          onChange={(event) => setNotes(event.target.value)}
                          placeholder="Condition notes, negotiation context, provenance…"
                          rows={3}
                          value={notes}
                        />
                      </label>
                    </div>
                  </div>
                )}

                {step === "cards" && (
                  <div className="cards-layout">
                    <div className="cards-toolbar">
                      <div>
                        <span className="toolbar-label">Eligible cards</span>
                        <strong>
                          {selectableFilteredCards.length.toLocaleString("da-DK")} in {currency}
                        </strong>
                      </div>
                      <label className="search-box">
                        <span>⌕</span>
                        <input
                          data-testid="purchase-lot-card-search"
                          onChange={(event) => setSearchTerm(event.target.value)}
                          placeholder="Search player, set, parallel or card no."
                          value={searchTerm}
                        />
                      </label>
                      <select
                        aria-label="Filter by collection"
                        onChange={(event) =>
                          setCollectionFilter(event.target.value)
                        }
                        value={collectionFilter}
                      >
                        <option value="all">All {currency} collections</option>
                        {collections
                          .filter(
                            (collection) =>
                              collection.currency.trim().toUpperCase() === currency
                          )
                          .map((collection) => (
                            <option key={collection.id} value={collection.id}>
                              {collection.name}
                            </option>
                          ))}
                      </select>
                      <button
                        className="select-all-button"
                        onClick={selectVisibleCards}
                        type="button"
                      >
                        Select filtered
                      </button>
                    </div>

                    <div className="selection-summary">
                      <div>
                        <strong>{selectedCards.length}</strong>
                        <span>cards selected</span>
                      </div>
                      <div>
                        <strong>{formatCurrency(totalCost, currency)}</strong>
                        <span>to allocate</span>
                      </div>
                      <button
                        disabled={selectedCards.length === 0}
                        onClick={() => setSelectedCardIds(new Set())}
                        type="button"
                      >
                        Clear selection
                      </button>
                    </div>

                    {visibleCards.length === 0 ? (
                      <div className="empty-state">
                        <strong>No matching cards</strong>
                        <p>
                          Add cards in a {currency} collection or adjust the filters.
                        </p>
                      </div>
                    ) : (
                      <div className="card-list">
                        {visibleCards.map((card) => {
                          const isSelected = selectedCardIds.has(card.id);
                          const isUnavailable =
                            card.assignedToLot ||
                            ["sold", "archived"].includes(card.state ?? "");
                          const unavailableReason = card.assignedToLot
                            ? "Already assigned to a purchase lot"
                            : isUnavailable
                              ? `Card status is ${card.state}`
                              : null;

                          return (
                            <button
                              aria-pressed={isSelected}
                              className={[
                                "card-row",
                                isSelected ? "card-row-selected" : "",
                                isUnavailable ? "card-row-disabled" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              data-testid={`purchase-card-${card.id}`}
                              disabled={isUnavailable}
                              key={card.id}
                              onClick={() => toggleCard(card)}
                              type="button"
                            >
                              <span className="selection-mark">
                                {isSelected ? "✓" : ""}
                              </span>
                              <span className="card-copy">
                                <strong>{card.player_name}</strong>
                                <small>
                                  {joinCardDescription(card) || "Card details not set"}
                                </small>
                                <em>{card.collectionName}</em>
                              </span>
                              <span className="card-reference">
                                <small>{getReferenceLabel(card.referenceSource)}</small>
                                <strong>
                                  {formatCurrency(
                                    card.automaticReference,
                                    card.collectionCurrency
                                  )}
                                </strong>
                              </span>
                              <span className="card-cost">
                                <small>Current cost</small>
                                <strong>
                                  {formatCurrency(
                                    toOptionalNumber(card.purchase_price),
                                    card.collectionCurrency
                                  )}
                                </strong>
                              </span>
                              {unavailableReason && (
                                <span className="unavailable-tag">
                                  {unavailableReason}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {filteredCards.length > DISPLAY_LIMIT && (
                      <p className="limit-note">
                        Showing the first {DISPLAY_LIMIT} matching cards. Narrow the
                        search to find additional cards.
                      </p>
                    )}
                  </div>
                )}

                {step === "review" && (
                  <div className="review-layout">
                    <div className="review-hero">
                      <div>
                        <span>ALLOCATION PREVIEW</span>
                        <h3>{name || "Untitled purchase lot"}</h3>
                        <p>
                          {selectedCards.length} cards · {allocationMethod} allocation · {currency}
                        </p>
                      </div>
                      <div className="review-total">
                        <small>Total landed cost</small>
                        <strong>{formatCurrency(totalCost, currency)}</strong>
                        <span>
                          Allocated {formatCurrency(allocatedTotal, currency)}
                        </span>
                      </div>
                    </div>

                    {selectedWithExistingCost > 0 && (
                      <div className="warning-banner">
                        <strong>
                          {selectedWithExistingCost} selected {selectedWithExistingCost === 1 ? "card has" : "cards have"} an existing cost basis
                        </strong>
                        <p>
                          The lot will be saved for review without changing those
                          values. You decide separately whether to overwrite them
                          when the allocation is locked.
                        </p>
                      </div>
                    )}

                    {allocationError && (
                      <div className="allocation-error" role="alert">
                        <strong>Allocation needs attention</strong>
                        <span>{allocationError}</span>
                      </div>
                    )}

                    <div className="allocation-table" role="table">
                      <div className="allocation-head" role="row">
                        <span role="columnheader">Card</span>
                        <span role="columnheader">
                          {allocationMethod === "manual"
                            ? "Manual cost"
                            : allocationMethod === "proportional"
                              ? "Reference value"
                              : "Method"}
                        </span>
                        <span role="columnheader">Allocated cost</span>
                        <span role="columnheader">Weight</span>
                      </div>

                      {allocationPreview.map((item) => {
                        const weight =
                          totalCost && item.allocatedCost !== null
                            ? (item.allocatedCost / totalCost) * 100
                            : 0;

                        return (
                          <div className="allocation-row" key={item.card.id} role="row">
                            <span className="allocation-card" role="cell">
                              <strong>{item.card.player_name}</strong>
                              <small>
                                {joinCardDescription(item.card) ||
                                  item.card.collectionName}
                              </small>
                            </span>
                            <span role="cell">
                              {allocationMethod === "proportional" ? (
                                <label className="allocation-input">
                                  <input
                                    aria-label={`Reference value for ${item.card.player_name}`}
                                    inputMode="decimal"
                                    onChange={(event) =>
                                      setReferenceOverrides((current) => ({
                                        ...current,
                                        [item.card.id]: event.target.value,
                                      }))
                                    }
                                    placeholder={
                                      item.card.automaticReference === null
                                        ? "Required"
                                        : String(item.card.automaticReference)
                                    }
                                    value={referenceOverrides[item.card.id] ?? ""}
                                  />
                                  <small>{currency}</small>
                                </label>
                              ) : allocationMethod === "manual" ? (
                                <label className="allocation-input">
                                  <input
                                    aria-label={`Manual cost for ${item.card.player_name}`}
                                    inputMode="decimal"
                                    onChange={(event) =>
                                      setManualAllocations((current) => ({
                                        ...current,
                                        [item.card.id]: event.target.value,
                                      }))
                                    }
                                    placeholder="0,00"
                                    value={manualAllocations[item.card.id] ?? ""}
                                  />
                                  <small>{currency}</small>
                                </label>
                              ) : (
                                <span className="equal-tag">Equal split</span>
                              )}
                              {allocationMethod === "proportional" && (
                                <small className="source-note">
                                  {referenceOverrides[item.card.id]?.trim()
                                    ? "Override"
                                    : getReferenceLabel(item.card.referenceSource)}
                                </small>
                              )}
                            </span>
                            <strong className="allocated-value" role="cell">
                              {formatCurrency(item.allocatedCost, currency)}
                            </strong>
                            <span className="weight-cell" role="cell">
                              <span style={{ width: `${Math.min(100, weight)}%` }} />
                              <small>{weight.toLocaleString("da-DK", { maximumFractionDigits: 1 })}%</small>
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="review-explainer">
                      <span>SAFE CHECKPOINT</span>
                      <div>
                        <strong>Creating does not change card cost basis yet</strong>
                        <p>
                          The lot is first saved as Allocated. Review its recorded
                          values in Cardshow Center, then lock the lot to transfer
                          each allocation to the selected cards.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <footer className="purchase-footer">
            <div className="footer-status">
              <span>{selectedCards.length} cards</span>
              <strong>{formatCurrency(totalCost, currency)}</strong>
              <small>{allocationMethod} allocation</small>
            </div>

            {saveError && (
              <p className="save-error" role="alert">
                {saveError}
              </p>
            )}

            <div className="footer-actions">
              {step !== "details" && (
                <button
                  className="secondary-button"
                  disabled={isSaving}
                  onClick={() =>
                    setStep(step === "review" ? "cards" : "details")
                  }
                  type="button"
                >
                  Back
                </button>
              )}
              {step === "details" && (
                <button
                  className="primary-button"
                  data-testid="purchase-lot-next-cards"
                  disabled={isLoading || Boolean(loadError)}
                  onClick={goToCards}
                  type="button"
                >
                  Select cards <span>→</span>
                </button>
              )}
              {step === "cards" && (
                <button
                  className="primary-button"
                  data-testid="purchase-lot-review"
                  disabled={selectedCards.length === 0}
                  onClick={goToReview}
                  type="button"
                >
                  Review allocation <span>→</span>
                </button>
              )}
              {step === "review" && (
                <button
                  className="primary-button"
                  data-testid="purchase-lot-create"
                  disabled={isSaving || Boolean(allocationError)}
                  type="submit"
                >
                  {isSaving ? "Creating lot…" : "Create allocated lot"}
                  {!isSaving && <span>✓</span>}
                </button>
              )}
            </div>
          </footer>
        </form>
      </section>

      <style jsx>{`
        .purchase-backdrop {
          position: fixed;
          inset: 0;
          z-index: 2500;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background: rgba(3, 5, 12, 0.9);
          backdrop-filter: blur(18px);
        }

        .purchase-modal {
          width: min(1240px, 100%);
          max-height: calc(100vh - 36px);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          border: 1px solid rgba(139, 109, 255, 0.26);
          border-radius: 28px;
          background:
            radial-gradient(circle at 88% 0%, rgba(124, 92, 255, 0.13), transparent 32%),
            #0a0d15;
          box-shadow: 0 34px 110px rgba(0, 0, 0, 0.62);
          color: #f8fafc;
        }

        .purchase-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          padding: 28px 32px 22px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.11);
        }

        .purchase-header h2,
        .purchase-header p,
        .section-heading h3,
        .section-heading p,
        .review-hero h3,
        .review-hero p,
        .error-state p,
        .empty-state p,
        .warning-banner p,
        .review-explainer p {
          margin: 0;
        }

        .purchase-header h2 {
          margin-top: 8px;
          font-size: clamp(25px, 3vw, 36px);
          letter-spacing: -0.04em;
        }

        .purchase-header p {
          margin-top: 7px;
          color: #8d96aa;
          font-size: 13px;
        }

        .purchase-badge,
        .review-hero span,
        .review-explainer > span {
          color: #9b87ff;
          font-size: 10px;
          font-weight: 850;
          letter-spacing: 0.16em;
        }

        .close-button {
          width: 42px;
          height: 42px;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 13px;
          background: rgba(255, 255, 255, 0.035);
          color: #aeb6c8;
          font-size: 25px;
          cursor: pointer;
        }

        .step-navigation {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          padding: 14px 32px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.09);
          background: rgba(3, 5, 10, 0.3);
        }

        .step-navigation button {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 10px 12px;
          border: 1px solid transparent;
          border-radius: 13px;
          background: transparent;
          color: #697286;
          text-align: left;
          cursor: pointer;
        }

        .step-navigation button > span {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(148, 163, 184, 0.15);
          border-radius: 9px;
          font-size: 11px;
        }

        .step-navigation button strong {
          font-size: 12px;
        }

        .step-navigation button.step-active {
          border-color: rgba(139, 109, 255, 0.25);
          background: rgba(124, 92, 255, 0.1);
          color: #f4f1ff;
        }

        .step-navigation button.step-active > span {
          border-color: transparent;
          background: #765ee8;
          color: white;
        }

        .step-navigation button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        form {
          min-height: 0;
          display: flex;
          flex: 1;
          flex-direction: column;
        }

        .purchase-content {
          min-height: 0;
          overflow-y: auto;
          flex: 1;
          padding: 26px 32px 32px;
        }

        .details-layout {
          display: grid;
          gap: 18px;
        }

        .form-section {
          padding: 22px;
          border: 1px solid rgba(148, 163, 184, 0.11);
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.018);
        }

        .section-heading {
          display: flex;
          align-items: flex-start;
          gap: 13px;
          margin-bottom: 19px;
        }

        .section-heading > span {
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: rgba(124, 92, 255, 0.12);
          color: #9b87ff;
          font-size: 10px;
          font-weight: 850;
        }

        .section-heading h3 {
          font-size: 16px;
        }

        .section-heading p {
          margin-top: 4px;
          color: #727c91;
          font-size: 11px;
        }

        .field-grid,
        .cost-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .cost-grid {
          grid-template-columns: repeat(5, minmax(0, 1fr));
        }

        .field-wide {
          grid-column: span 2;
        }

        .field {
          display: grid;
          gap: 7px;
          min-width: 0;
        }

        .field > span,
        .toolbar-label {
          color: #8992a5;
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        input,
        select,
        textarea {
          width: 100%;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 12px;
          outline: none;
          background: #0d111c;
          color: #f8fafc;
          font: inherit;
          font-size: 12px;
        }

        input,
        select {
          height: 43px;
          padding: 0 12px;
        }

        textarea {
          min-height: 86px;
          padding: 12px;
          resize: vertical;
        }

        input:focus,
        select:focus,
        textarea:focus {
          border-color: rgba(139, 109, 255, 0.7);
          box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.1);
        }

        .money-input {
          position: relative;
        }

        .money-input input {
          padding-right: 46px;
        }

        .money-input small {
          position: absolute;
          top: 50%;
          right: 12px;
          transform: translateY(-50%);
          color: #646f85;
          font-size: 9px;
          font-weight: 800;
        }

        .total-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-top: 17px;
          padding: 16px 18px;
          border: 1px solid rgba(139, 109, 255, 0.24);
          border-radius: 15px;
          background: linear-gradient(120deg, rgba(124, 92, 255, 0.1), rgba(35, 220, 171, 0.035));
        }

        .total-card div {
          display: grid;
          gap: 4px;
        }

        .total-card span {
          font-size: 12px;
          font-weight: 800;
        }

        .total-card small {
          color: #727c91;
          font-size: 10px;
        }

        .total-card strong {
          color: #b9aaff;
          font-size: 22px;
        }

        .method-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .method-grid button {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 5px 9px;
          padding: 15px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 15px;
          background: #0c1019;
          color: #f8fafc;
          text-align: left;
          cursor: pointer;
        }

        .method-grid button > span {
          grid-row: span 2;
          color: #626c80;
        }

        .method-grid strong {
          font-size: 12px;
        }

        .method-grid small {
          color: #737d91;
          font-size: 10px;
          line-height: 1.45;
        }

        .method-grid button.method-active {
          border-color: rgba(139, 109, 255, 0.55);
          background: rgba(124, 92, 255, 0.09);
        }

        .method-grid button.method-active > span {
          color: #9d89ff;
        }

        .notes-field {
          margin-top: 16px;
        }

        .cards-layout,
        .review-layout {
          display: grid;
          gap: 16px;
        }

        .cards-toolbar {
          display: grid;
          grid-template-columns: auto minmax(260px, 1fr) minmax(180px, 240px) auto;
          align-items: end;
          gap: 12px;
        }

        .cards-toolbar > div:first-child {
          display: grid;
          gap: 5px;
          min-width: 130px;
        }

        .cards-toolbar > div:first-child strong {
          font-size: 14px;
        }

        .search-box {
          position: relative;
        }

        .search-box > span {
          position: absolute;
          top: 50%;
          left: 13px;
          transform: translateY(-50%);
          color: #657086;
        }

        .search-box input {
          padding-left: 36px;
        }

        .select-all-button,
        .secondary-button,
        .error-state button {
          height: 43px;
          padding: 0 15px;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.035);
          color: #dce2ee;
          font-size: 11px;
          font-weight: 750;
          cursor: pointer;
        }

        .selection-summary {
          display: flex;
          align-items: center;
          gap: 28px;
          padding: 13px 17px;
          border: 1px solid rgba(124, 92, 255, 0.18);
          border-radius: 15px;
          background: rgba(124, 92, 255, 0.055);
        }

        .selection-summary > div {
          display: grid;
          gap: 2px;
        }

        .selection-summary strong {
          font-size: 13px;
        }

        .selection-summary span {
          color: #717b90;
          font-size: 9px;
          text-transform: uppercase;
        }

        .selection-summary button {
          margin-left: auto;
          border: 0;
          background: transparent;
          color: #9b87ff;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
        }

        .card-list {
          display: grid;
          gap: 7px;
        }

        .card-row {
          position: relative;
          content-visibility: auto;
          contain-intrinsic-size: auto 72px;
          display: grid;
          grid-template-columns: 30px minmax(220px, 1fr) minmax(120px, 170px) minmax(110px, 150px);
          align-items: center;
          gap: 14px;
          width: 100%;
          padding: 12px 15px;
          border: 1px solid rgba(148, 163, 184, 0.095);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.018);
          color: #f8fafc;
          text-align: left;
          cursor: pointer;
        }

        .card-row:hover:not(:disabled),
        .card-row-selected {
          border-color: rgba(139, 109, 255, 0.42);
          background: rgba(124, 92, 255, 0.07);
        }

        .card-row-disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .selection-mark {
          width: 25px;
          height: 25px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 8px;
          color: white;
          font-size: 11px;
        }

        .card-row-selected .selection-mark {
          border-color: transparent;
          background: #765ee8;
        }

        .card-copy,
        .card-reference,
        .card-cost {
          display: grid;
          gap: 3px;
          min-width: 0;
        }

        .card-copy strong,
        .card-reference strong,
        .card-cost strong {
          overflow: hidden;
          font-size: 12px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .card-copy small,
        .card-reference small,
        .card-cost small,
        .card-copy em {
          overflow: hidden;
          color: #737d91;
          font-size: 9px;
          font-style: normal;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .card-copy em {
          color: #9683f2;
        }

        .unavailable-tag {
          position: absolute;
          top: 7px;
          right: 9px;
          color: #e6a7b1;
          font-size: 8px;
        }

        .review-hero {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding: 22px;
          border: 1px solid rgba(139, 109, 255, 0.22);
          border-radius: 20px;
          background: linear-gradient(130deg, rgba(124, 92, 255, 0.1), rgba(10, 13, 21, 0.4));
        }

        .review-hero h3 {
          margin-top: 8px;
          font-size: 22px;
        }

        .review-hero p {
          margin-top: 6px;
          color: #7d879b;
          font-size: 11px;
          text-transform: capitalize;
        }

        .review-total {
          display: grid;
          gap: 4px;
          text-align: right;
        }

        .review-total small,
        .review-total span {
          color: #778196;
          font-size: 9px;
          letter-spacing: normal;
        }

        .review-total strong {
          color: #b7a7ff;
          font-size: 24px;
        }

        .allocation-table {
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.11);
          border-radius: 18px;
        }

        .allocation-head,
        .allocation-row {
          display: grid;
          grid-template-columns: minmax(260px, 1.4fr) minmax(150px, 0.8fr) minmax(120px, 0.6fr) minmax(120px, 0.7fr);
          align-items: center;
          gap: 16px;
          padding: 12px 16px;
        }

        .allocation-head {
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
          background: rgba(255, 255, 255, 0.025);
          color: #667187;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .allocation-row {
          content-visibility: auto;
          contain-intrinsic-size: auto 66px;
          min-height: 66px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.075);
        }

        .allocation-row:last-child {
          border-bottom: 0;
        }

        .allocation-card {
          display: grid;
          gap: 4px;
          min-width: 0;
        }

        .allocation-card strong,
        .allocated-value {
          font-size: 12px;
        }

        .allocation-card small,
        .source-note {
          overflow: hidden;
          color: #737d91;
          font-size: 9px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .allocation-input {
          position: relative;
          display: block;
        }

        .allocation-input input {
          height: 36px;
          padding-right: 42px;
        }

        .allocation-input > small {
          position: absolute;
          top: 50%;
          right: 9px;
          transform: translateY(-50%);
          color: #616b80;
          font-size: 8px;
        }

        .source-note {
          display: block;
          margin-top: 4px;
        }

        .equal-tag {
          display: inline-flex;
          padding: 6px 9px;
          border-radius: 8px;
          background: rgba(35, 220, 171, 0.07);
          color: #65d8b5;
          font-size: 9px;
          font-weight: 750;
        }

        .weight-cell {
          position: relative;
          height: 22px;
          overflow: hidden;
          display: flex;
          align-items: center;
          border-radius: 8px;
          background: rgba(148, 163, 184, 0.075);
        }

        .weight-cell > span {
          position: absolute;
          inset: 0 auto 0 0;
          background: rgba(124, 92, 255, 0.22);
        }

        .weight-cell small {
          position: relative;
          z-index: 1;
          padding-left: 8px;
          color: #aeb6c8;
          font-size: 8px;
        }

        .warning-banner,
        .allocation-error,
        .notice-banner,
        .review-explainer {
          padding: 14px 16px;
          border-radius: 14px;
          font-size: 11px;
        }

        .warning-banner {
          border: 1px solid rgba(245, 158, 11, 0.2);
          background: rgba(245, 158, 11, 0.055);
        }

        .warning-banner p {
          margin-top: 4px;
          color: #aa9473;
          line-height: 1.5;
        }

        .allocation-error {
          display: grid;
          gap: 3px;
          border: 1px solid rgba(244, 63, 94, 0.25);
          background: rgba(244, 63, 94, 0.07);
          color: #ffc1cb;
        }

        .allocation-error span {
          color: #c68c96;
          font-size: 10px;
        }

        .review-explainer {
          display: flex;
          align-items: flex-start;
          gap: 15px;
          border: 1px solid rgba(35, 220, 171, 0.18);
          background: rgba(35, 220, 171, 0.045);
        }

        .review-explainer > span {
          flex: 0 0 auto;
          color: #5ed8b3;
        }

        .review-explainer p {
          margin-top: 4px;
          color: #789387;
          font-size: 10px;
          line-height: 1.5;
        }

        .notice-banner {
          margin: 0 0 16px;
          border: 1px solid rgba(56, 189, 248, 0.17);
          background: rgba(56, 189, 248, 0.05);
          color: #8fcde6;
        }

        .center-state,
        .error-state,
        .empty-state {
          min-height: 260px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          text-align: center;
        }

        .center-state strong,
        .error-state strong,
        .empty-state strong {
          font-size: 13px;
        }

        .center-state,
        .error-state p,
        .empty-state p {
          color: #717b90;
          font-size: 11px;
        }

        .loading-spinner {
          width: 30px;
          height: 30px;
          border: 3px solid rgba(124, 92, 255, 0.16);
          border-top-color: #8b6dff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .limit-note {
          margin: 0;
          color: #727c91;
          font-size: 10px;
          text-align: center;
        }

        .purchase-footer {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 16px 32px;
          border-top: 1px solid rgba(148, 163, 184, 0.11);
          background: rgba(5, 7, 12, 0.75);
        }

        .footer-status {
          display: flex;
          align-items: baseline;
          gap: 12px;
          min-width: 300px;
        }

        .footer-status span,
        .footer-status small {
          color: #717b90;
          font-size: 9px;
          text-transform: uppercase;
        }

        .footer-status strong {
          color: #b6a6ff;
          font-size: 13px;
        }

        .save-error {
          overflow: hidden;
          flex: 1;
          margin: 0;
          color: #f2a4b1;
          font-size: 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .footer-actions {
          display: flex;
          gap: 10px;
          margin-left: auto;
        }

        .primary-button {
          min-width: 178px;
          height: 45px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 0 18px;
          border: 0;
          border-radius: 13px;
          background: linear-gradient(135deg, #8b6dff, #6551d8);
          box-shadow: 0 14px 30px rgba(91, 66, 205, 0.24);
          color: white;
          font-size: 11px;
          font-weight: 850;
          cursor: pointer;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 900px) {
          .purchase-backdrop {
            padding: 0;
          }

          .purchase-modal {
            min-height: 100vh;
            max-height: 100vh;
            border: 0;
            border-radius: 0;
          }

          .purchase-header,
          .purchase-content,
          .purchase-footer {
            padding-left: 18px;
            padding-right: 18px;
          }

          .step-navigation {
            padding-left: 18px;
            padding-right: 18px;
          }

          .step-navigation button {
            justify-content: center;
          }

          .step-navigation button strong {
            display: none;
          }

          .field-grid,
          .cost-grid,
          .method-grid {
            grid-template-columns: 1fr 1fr;
          }

          .cost-grid > :last-child {
            grid-column: span 2;
          }

          .cards-toolbar {
            grid-template-columns: 1fr 1fr;
          }

          .search-box {
            grid-column: span 2;
            grid-row: 1;
          }

          .card-row {
            grid-template-columns: 30px minmax(0, 1fr) minmax(100px, 130px);
          }

          .card-cost {
            display: none;
          }

          .allocation-head,
          .allocation-row {
            grid-template-columns: minmax(160px, 1fr) minmax(130px, 0.8fr) minmax(100px, 0.6fr);
          }

          .allocation-head > :last-child,
          .allocation-row > :last-child {
            display: none;
          }

          .footer-status {
            display: none;
          }
        }

        @media (max-width: 620px) {
          .purchase-header {
            padding-top: 20px;
          }

          .purchase-header p {
            display: none;
          }

          .purchase-content {
            padding-top: 18px;
          }

          .form-section {
            padding: 17px;
          }

          .field-grid,
          .cost-grid,
          .method-grid,
          .cards-toolbar {
            grid-template-columns: 1fr;
          }

          .field-wide,
          .cost-grid > :last-child,
          .search-box {
            grid-column: auto;
          }

          .method-grid button {
            min-height: 74px;
          }

          .selection-summary {
            gap: 14px;
          }

          .selection-summary button {
            font-size: 0;
          }

          .selection-summary button::after {
            content: "Clear";
            font-size: 10px;
          }

          .card-row {
            grid-template-columns: 28px minmax(0, 1fr);
          }

          .card-reference {
            grid-column: 2;
          }

          .review-hero {
            display: grid;
          }

          .review-total {
            text-align: left;
          }

          .allocation-table {
            overflow-x: auto;
          }

          .allocation-head,
          .allocation-row {
            min-width: 620px;
          }

          .purchase-footer {
            gap: 8px;
          }

          .footer-actions,
          .footer-actions button {
            width: 100%;
          }

          .save-error {
            position: absolute;
            right: 18px;
            bottom: 72px;
            left: 18px;
            padding: 10px;
            border-radius: 10px;
            background: #35131b;
            white-space: normal;
          }
        }
      `}</style>
    </div>
  );
}
