"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createGradingSubmission,
  type CreateGradingSubmissionResult,
} from "@/lib/grading/createGradingSubmission";
import { createClient } from "@/lib/supabase/client";

const CARD_IMAGE_BUCKET = "card-images";
const SIGNED_URL_SECONDS = 60 * 60;
const MAX_CARDS_PER_SUBMISSION = 200;

const ACTIVE_GRADING_STATUSES = [
  "queued",
  "submitted",
  "grading",
  "graded",
] as const;

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

type CollectionRow = {
  id: string;
  name: string;
  type: CollectionType;
  currency: string;
  created_at: string;
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

type CardImageRow = {
  card_id: string;
  storage_path: string;
};

type CardAttributeRow = {
  card_id: string;
  attribute_key: string;
  attribute_value: unknown;
};

type ActiveGradingCardRow = {
  card_id: string;
};

type AvailableCard = CardRow & {
  collection: CollectionRow;
  collectionCurrency: string;
  imageUrl: string | null;
  sport: string | null;
  team: string | null;
  brand: string | null;
  product: string | null;
  insertName: string | null;
  currentGradingCompany: string | null;
  currentGrade: string | null;
  valuationValue: number | null;
  valuationSource: ValuationSource;
};

type SelectedCardDraft = {
  declaredValue: string;
  gradingFee: string;
  preparationFee: string;
  otherCardCosts: string;
  expectedGrade: string;
  expectedGradedValue: string;
};

type SelectedCardField = keyof SelectedCardDraft;

type CreateGradingSubmissionModalProps = {
  isOpen: boolean;
  initialCardId?: string | null;
  onClose: () => void;
  onCreated: (result: CreateGradingSubmissionResult) => void;
};

function toOptionalNumber(value: NumericDatabaseValue) {
  if (value === null || value === "") {
    return null;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : null;
}

function getAttributeValue(
  attributes: CardAttributeRow[],
  key: string
) {
  return attributes.find(
    (attribute) => attribute.attribute_key === key
  )?.attribute_value;
}

function getStringAttribute(
  attributes: CardAttributeRow[],
  key: string
) {
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
): {
  value: number | null;
  source: ValuationSource;
} {
  const marketValue = toOptionalNumber(card.market_estimated_value);
  const marketCurrency =
    card.market_value_currency?.trim().toUpperCase() ||
    collectionCurrency;

  if (
    marketValue !== null &&
    marketCurrency === collectionCurrency
  ) {
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

function joinDistinct(
  values: Array<string | null | undefined>
) {
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

function normalizeMoneyString(value: string) {
  let normalizedValue = value
    .trim()
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");

  const lastComma = normalizedValue.lastIndexOf(",");
  const lastDot = normalizedValue.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      normalizedValue = normalizedValue
        .replace(/\./g, "")
        .replace(/,/g, ".");
    } else {
      normalizedValue = normalizedValue.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    normalizedValue = normalizedValue.replace(/,/g, ".");
  } else if (lastDot >= 0) {
    const parts = normalizedValue.split(".");

    if (parts.length === 2 && parts[1]?.length === 3) {
      normalizedValue = parts.join("");
    }
  }

  return normalizedValue;
}

function parsePreviewMoney(value: string) {
  if (!value.trim()) {
    return 0;
  }

  const parsedValue = Number(normalizeMoneyString(value));

  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  return Math.max(0, parsedValue);
}

function formatCurrency(
  value: number | null,
  currency = "DKK"
) {
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

function createDefaultSubmissionName(company = "PSA") {
  const dateLabel = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(new Date());

  return `${company} ${dateLabel}`;
}

function createCardDraft(card: AvailableCard): SelectedCardDraft {
  return {
    declaredValue:
      card.valuationValue === null
        ? ""
        : String(card.valuationValue),
    gradingFee: "",
    preparationFee: "",
    otherCardCosts: "",
    expectedGrade: "",
    expectedGradedValue: "",
  };
}

function getCollectionTypeLabel(type: CollectionType) {
  return type === "pc"
    ? "Personal Collection"
    : "Dealer Inventory";
}

function getValuationLabel(source: ValuationSource) {
  switch (source) {
    case "market":
      return "Market value";
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

  return "The grading submission could not be created. Try again.";
}

export default function CreateGradingSubmissionModal({
  isOpen,
  initialCardId = null,
  onClose,
  onCreated,
}: CreateGradingSubmissionModalProps) {
  const supabase = useMemo(() => createClient(), []);

  const [availableCards, setAvailableCards] = useState<
    AvailableCard[]
  >([]);
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [selectedCardDrafts, setSelectedCardDrafts] = useState<
    Record<string, SelectedCardDraft>
  >({});

  const [name, setName] = useState(() =>
    createDefaultSubmissionName("PSA")
  );
  const [nameTouched, setNameTouched] = useState(false);
  const [gradingCompany, setGradingCompany] = useState("PSA");
  const [serviceLevel, setServiceLevel] = useState("");
  const [currency, setCurrency] = useState("DKK");
  const [submissionNumber, setSubmissionNumber] = useState("");
  const [estimatedTurnaroundDays, setEstimatedTurnaroundDays] =
    useState("");
  const [submissionFee, setSubmissionFee] = useState("");
  const [outboundShippingCost, setOutboundShippingCost] =
    useState("");
  const [returnShippingCost, setReturnShippingCost] = useState("");
  const [insuranceCost, setInsuranceCost] = useState("");
  const [otherSharedCosts, setOtherSharedCosts] = useState("");
  const [notes, setNotes] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [isLoadingCards, setIsLoadingCards] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setAvailableCards([]);
    setCollections([]);
    setSelectedCardDrafts({});
    setName(createDefaultSubmissionName("PSA"));
    setNameTouched(false);
    setGradingCompany("PSA");
    setServiceLevel("");
    setCurrency("DKK");
    setSubmissionNumber("");
    setEstimatedTurnaroundDays("");
    setSubmissionFee("");
    setOutboundShippingCost("");
    setReturnShippingCost("");
    setInsuranceCost("");
    setOtherSharedCosts("");
    setNotes("");
    setSearchTerm("");
    setCollectionFilter("all");
    setIsLoadingCards(false);
    setIsSubmitting(false);
    setLoadError(null);
    setSubmitError(null);
    setNoticeMessage(null);
  }, []);

  const loadAvailableCards = useCallback(async () => {
    setIsLoadingCards(true);
    setLoadError(null);
    setNoticeMessage(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setLoadError(
        "You must be logged in to create a grading submission."
      );
      setIsLoadingCards(false);
      return;
    }

    const [collectionResult, cardResult, activeGradingResult] =
      await Promise.all([
        supabase
          .from("collections")
          .select(`
            id,
            name,
            type,
            currency,
            created_at
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
            state,
            created_at
          `)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1000),

        supabase
          .from("grading_submission_cards")
          .select("card_id")
          .eq("user_id", user.id)
          .in("status", [...ACTIVE_GRADING_STATUSES]),
      ]);

    if (collectionResult.error) {
      setLoadError(
        `Collections could not be loaded: ${collectionResult.error.message}`
      );
      setIsLoadingCards(false);
      return;
    }

    if (cardResult.error) {
      setLoadError(
        `Cards could not be loaded: ${cardResult.error.message}`
      );
      setIsLoadingCards(false);
      return;
    }

    if (activeGradingResult.error) {
      setLoadError(
        `Active grading submissions could not be checked: ${activeGradingResult.error.message}`
      );
      setIsLoadingCards(false);
      return;
    }

    const collectionRows =
      (collectionResult.data ?? []) as CollectionRow[];
    const cardRows = (cardResult.data ?? []) as CardRow[];
    const activeGradingCardIds = new Set(
      ((activeGradingResult.data ?? []) as ActiveGradingCardRow[]).map(
        (row) => row.card_id
      )
    );

    const collectionById = new Map(
      collectionRows.map((collection) => [collection.id, collection])
    );

    const eligibleRows = cardRows.filter((card) => {
      const collection = collectionById.get(card.current_collection_id);

      if (!collection) {
        return false;
      }

      if (["sold", "archived", "submitted"].includes(card.state ?? "")) {
        return false;
      }

      return !activeGradingCardIds.has(card.id);
    });

    setCollections(collectionRows);

    const uniqueCurrencies = Array.from(
      new Set(
        collectionRows
          .map((collection) => collection.currency?.trim().toUpperCase())
          .filter(Boolean)
      )
    );

    if (uniqueCurrencies.length === 1) {
      setCurrency(uniqueCurrencies[0]);
    }

    if (eligibleRows.length === 0) {
      setAvailableCards([]);
      setNoticeMessage(
        "No eligible cards are available. Sold, archived and cards already in grading are excluded."
      );
      setIsLoadingCards(false);
      return;
    }

    const eligibleCardIds = eligibleRows.map((card) => card.id);

    const [imageResult, attributeResult] = await Promise.all([
      supabase
        .from("card_images")
        .select(`
          card_id,
          storage_path
        `)
        .eq("user_id", user.id)
        .eq("image_type", "front")
        .in("card_id", eligibleCardIds),

      supabase
        .from("card_attributes")
        .select(`
          card_id,
          attribute_key,
          attribute_value
        `)
        .eq("user_id", user.id)
        .in("card_id", eligibleCardIds)
        .in("attribute_key", [...ATTRIBUTE_KEYS]),
    ]);

    const warnings: string[] = [];

    if (imageResult.error) {
      warnings.push("Some card images could not be loaded.");
    }

    if (attributeResult.error) {
      warnings.push("Some Card DNA details could not be loaded.");
    }

    const attributesByCardId = new Map<string, CardAttributeRow[]>();

    for (const attribute of
      (attributeResult.data ?? []) as CardAttributeRow[]) {
      const current = attributesByCardId.get(attribute.card_id) ?? [];
      current.push(attribute);
      attributesByCardId.set(attribute.card_id, current);
    }

    const imageUrlByCardId = new Map<string, string>();

    await Promise.all(
      ((imageResult.data ?? []) as CardImageRow[]).map(async (image) => {
        const { data, error } = await supabase.storage
          .from(CARD_IMAGE_BUCKET)
          .createSignedUrl(image.storage_path, SIGNED_URL_SECONDS);

        if (!error && data?.signedUrl) {
          imageUrlByCardId.set(image.card_id, data.signedUrl);
        }
      })
    );

    const nextCards = eligibleRows.map<AvailableCard>((card) => {
      const collection = collectionById.get(card.current_collection_id)!;
      const collectionCurrency = collection.currency.trim().toUpperCase();
      const attributes = attributesByCardId.get(card.id) ?? [];
      const valuation = getValuation(card, collectionCurrency);

      return {
        ...card,
        collection,
        collectionCurrency,
        imageUrl: imageUrlByCardId.get(card.id) ?? null,
        sport: getStringAttribute(attributes, "sport"),
        team: getStringAttribute(attributes, "team"),
        brand: getStringAttribute(attributes, "brand"),
        product: getStringAttribute(attributes, "product"),
        insertName:
          getStringAttribute(attributes, "set_name") ?? card.set_name,
        currentGradingCompany: getStringAttribute(
          attributes,
          "grading_company"
        ),
        currentGrade: getStringAttribute(attributes, "grade"),
        valuationValue: valuation.value,
        valuationSource: valuation.source,
      };
    });

    setAvailableCards(nextCards);

    if (warnings.length > 0) {
      setNoticeMessage(Array.from(new Set(warnings)).join(" "));
    }

    if (initialCardId) {
      const initialCard = nextCards.find(
        (card) => card.id === initialCardId
      );

      if (initialCard) {
        setCurrency(initialCard.collectionCurrency);
        setSelectedCardDrafts({
          [initialCard.id]: createCardDraft(initialCard),
        });
      } else {
        setNoticeMessage(
          "The requested card is not eligible for a new grading submission."
        );
      }
    }

    setIsLoadingCards(false);
  }, [initialCardId, supabase]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    resetForm();
    void loadAvailableCards();
  }, [isOpen, loadAvailableCards, resetForm]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, isSubmitting, onClose]);

  const currencyOptions = useMemo(
    () =>
      Array.from(
        new Set(
          collections
            .map((collection) => collection.currency.trim().toUpperCase())
            .filter(Boolean)
        )
      ).sort(),
    [collections]
  );

  const filteredCards = useMemo(() => {
    const normalizedSearch = normalizeSearch(searchTerm);

    return availableCards.filter((card) => {
      if (
        collectionFilter !== "all" &&
        card.current_collection_id !== collectionFilter
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
          card.currentGradingCompany,
          card.currentGrade,
        ]
          .filter(Boolean)
          .join(" ")
      );

      return searchText.includes(normalizedSearch);
    });
  }, [availableCards, collectionFilter, searchTerm]);

  const selectedCards = useMemo(
    () =>
      availableCards.filter((card) =>
        Boolean(selectedCardDrafts[card.id])
      ),
    [availableCards, selectedCardDrafts]
  );

  const selectedCount = selectedCards.length;

  const sharedCostTotal = useMemo(
    () =>
      parsePreviewMoney(submissionFee) +
      parsePreviewMoney(outboundShippingCost) +
      parsePreviewMoney(returnShippingCost) +
      parsePreviewMoney(insuranceCost) +
      parsePreviewMoney(otherSharedCosts),
    [
      insuranceCost,
      otherSharedCosts,
      outboundShippingCost,
      returnShippingCost,
      submissionFee,
    ]
  );

  const cardSpecificCostTotal = useMemo(
    () =>
      selectedCards.reduce((total, card) => {
        const draft = selectedCardDrafts[card.id];

        return (
          total +
          parsePreviewMoney(draft.gradingFee) +
          parsePreviewMoney(draft.preparationFee) +
          parsePreviewMoney(draft.otherCardCosts)
        );
      }, 0),
    [selectedCards, selectedCardDrafts]
  );

  const currentValueTotal = useMemo(
    () =>
      selectedCards.reduce(
        (total, card) => total + (card.valuationValue ?? 0),
        0
      ),
    [selectedCards]
  );

  const declaredValueTotal = useMemo(
    () =>
      selectedCards.reduce((total, card) => {
        const draft = selectedCardDrafts[card.id];
        return total + parsePreviewMoney(draft.declaredValue);
      }, 0),
    [selectedCards, selectedCardDrafts]
  );

  const expectedValueTotal = useMemo(
    () =>
      selectedCards.reduce((total, card) => {
        const draft = selectedCardDrafts[card.id];
        return total + parsePreviewMoney(draft.expectedGradedValue);
      }, 0),
    [selectedCards, selectedCardDrafts]
  );

  const expectedValueComplete =
    selectedCount > 0 &&
    selectedCards.every((card) =>
      Boolean(selectedCardDrafts[card.id].expectedGradedValue.trim())
    );

  const totalPlannedCost = sharedCostTotal + cardSpecificCostTotal;
  const sharedCostPerCard =
    selectedCount > 0 ? sharedCostTotal / selectedCount : 0;
  const projectedNetUplift = expectedValueComplete
    ? expectedValueTotal - currentValueTotal - totalPlannedCost
    : null;

  function handleGradingCompanyChange(value: string) {
    const normalizedValue = value.toUpperCase();

    setGradingCompany(normalizedValue);

    if (!nameTouched) {
      setName(createDefaultSubmissionName(normalizedValue || "Grading"));
    }
  }

  function toggleCard(card: AvailableCard) {
    setSubmitError(null);
    setNoticeMessage(null);

    if (selectedCardDrafts[card.id]) {
      setSelectedCardDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };
        delete nextDrafts[card.id];
        return nextDrafts;
      });
      return;
    }

    if (selectedCount >= MAX_CARDS_PER_SUBMISSION) {
      setSubmitError(
        `A submission may contain at most ${MAX_CARDS_PER_SUBMISSION} cards.`
      );
      return;
    }

    if (selectedCount === 0) {
      setCurrency(card.collectionCurrency);
    } else if (card.collectionCurrency !== currency) {
      setSubmitError(
        `This card uses ${card.collectionCurrency}. A submission can only contain cards in ${currency}.`
      );
      return;
    }

    setSelectedCardDrafts((currentDrafts) => ({
      ...currentDrafts,
      [card.id]: createCardDraft(card),
    }));
  }

  function updateSelectedCard(
    cardId: string,
    field: SelectedCardField,
    value: string
  ) {
    setSubmitError(null);

    setSelectedCardDrafts((currentDrafts) => ({
      ...currentDrafts,
      [cardId]: {
        ...currentDrafts[cardId],
        [field]: value,
      },
    }));
  }

  function clearSelection() {
    setSelectedCardDrafts({});
    setSubmitError(null);
  }

  function selectVisibleCards() {
    const matchingCurrencyCards = filteredCards.filter(
      (card) => card.collectionCurrency === currency
    );

    const remainingSlots =
      MAX_CARDS_PER_SUBMISSION - selectedCount;

    if (remainingSlots <= 0) {
      return;
    }

    const cardsToAdd = matchingCurrencyCards
      .filter((card) => !selectedCardDrafts[card.id])
      .slice(0, remainingSlots);

    if (cardsToAdd.length === 0) {
      setNoticeMessage(
        `No additional visible cards match the submission currency ${currency}.`
      );
      return;
    }

    setSelectedCardDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };

      for (const card of cardsToAdd) {
        nextDrafts[card.id] = createCardDraft(card);
      }

      return nextDrafts;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selectedCount < 1) {
      setSubmitError("Select at least one card.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await createGradingSubmission({
        name,
        gradingCompany,
        serviceLevel,
        currency,
        submissionNumber,
        estimatedTurnaroundDays,
        submissionFee,
        outboundShippingCost,
        returnShippingCost,
        insuranceCost,
        otherSharedCosts,
        notes,
        cards: selectedCards.map((card) => {
          const draft = selectedCardDrafts[card.id];

          return {
            cardId: card.id,
            declaredValue: draft.declaredValue,
            gradingFee: draft.gradingFee,
            preparationFee: draft.preparationFee,
            otherCardCosts: draft.otherCardCosts,
            expectedGrade: draft.expectedGrade,
            expectedGradedValue: draft.expectedGradedValue,
          };
        }),
      });

      setIsSubmitting(false);
      onCreated(result);
    } catch (error) {
      setSubmitError(getReadableError(error));
      setIsSubmitting(false);
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="grading-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <section
        className="grading-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-grading-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="grading-header">
          <div>
            <span className="grading-badge">GRADING CENTER</span>
            <h2 id="create-grading-title">Create submission</h2>
            <p>
              Build a grading batch, choose the cards and record the full
              expected cost before anything is shipped.
            </p>
          </div>

          <button
            className="grading-close"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close create submission"
          >
            ×
          </button>
        </header>

        <form className="grading-form" onSubmit={handleSubmit}>
          <fieldset disabled={isSubmitting}>
            <div className="grading-content">
              <div className="grading-top-grid">
                <section className="grading-section">
                  <div className="section-heading">
                    <div>
                      <span>SUBMISSION</span>
                      <h3>Order details</h3>
                      <p>
                        Create the draft batch. The cards are only marked as
                        submitted when the batch is shipped later.
                      </p>
                    </div>
                  </div>

                  <div className="field-grid">
                    <label className="field field-wide">
                      <span>Submission name *</span>
                      <input
                        type="text"
                        value={name}
                        maxLength={160}
                        required
                        onChange={(event) => {
                          setName(event.target.value);
                          setNameTouched(true);
                          setSubmitError(null);
                        }}
                      />
                    </label>

                    <label className="field">
                      <span>Grading company *</span>
                      <input
                        type="text"
                        value={gradingCompany}
                        maxLength={40}
                        required
                        list="grading-company-options"
                        onChange={(event) =>
                          handleGradingCompanyChange(event.target.value)
                        }
                      />
                    </label>

                    <label className="field">
                      <span>Service level</span>
                      <input
                        type="text"
                        value={serviceLevel}
                        maxLength={120}
                        list="grading-service-options"
                        placeholder="Value, Regular, Express..."
                        onChange={(event) =>
                          setServiceLevel(event.target.value)
                        }
                      />
                    </label>

                    <label className="field">
                      <span>Currency</span>
                      <select
                        value={currency}
                        disabled={selectedCount > 0}
                        onChange={(event) => setCurrency(event.target.value)}
                      >
                        {(currencyOptions.length > 0
                          ? currencyOptions
                          : [currency]
                        ).map((currencyOption) => (
                          <option key={currencyOption} value={currencyOption}>
                            {currencyOption}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span>Submission number</span>
                      <input
                        type="text"
                        value={submissionNumber}
                        maxLength={120}
                        placeholder="Optional until created with grader"
                        onChange={(event) =>
                          setSubmissionNumber(event.target.value)
                        }
                      />
                    </label>

                    <label className="field field-wide">
                      <span>Estimated turnaround</span>
                      <div className="input-suffix">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={estimatedTurnaroundDays}
                          placeholder="45"
                          onChange={(event) =>
                            setEstimatedTurnaroundDays(event.target.value)
                          }
                        />
                        <strong>days</strong>
                      </div>
                    </label>
                  </div>

                  <datalist id="grading-company-options">
                    <option value="PSA" />
                    <option value="BGS" />
                    <option value="SGC" />
                    <option value="CGC" />
                    <option value="TAG" />
                  </datalist>

                  <datalist id="grading-service-options">
                    <option value="Value" />
                    <option value="Value Plus" />
                    <option value="Regular" />
                    <option value="Express" />
                    <option value="Super Express" />
                    <option value="Bulk" />
                  </datalist>
                </section>

                <section className="grading-section cost-section">
                  <div className="section-heading">
                    <div>
                      <span>SHARED COSTS</span>
                      <h3>Batch expenses</h3>
                      <p>
                        Shared costs are allocated evenly across the selected
                        cards when the submission is saved.
                      </p>
                    </div>
                  </div>

                  <div className="cost-grid">
                    <MoneyField
                      label="Submission fee"
                      value={submissionFee}
                      currency={currency}
                      onChange={setSubmissionFee}
                    />
                    <MoneyField
                      label="Outbound shipping"
                      value={outboundShippingCost}
                      currency={currency}
                      onChange={setOutboundShippingCost}
                    />
                    <MoneyField
                      label="Return shipping"
                      value={returnShippingCost}
                      currency={currency}
                      onChange={setReturnShippingCost}
                    />
                    <MoneyField
                      label="Insurance"
                      value={insuranceCost}
                      currency={currency}
                      onChange={setInsuranceCost}
                    />
                    <MoneyField
                      label="Other shared costs"
                      value={otherSharedCosts}
                      currency={currency}
                      onChange={setOtherSharedCosts}
                      wide
                    />
                  </div>

                  <div className="cost-allocation-note">
                    <span>÷</span>
                    <p>
                      {selectedCount > 0
                        ? `${formatCurrency(
                            sharedCostPerCard,
                            currency
                          )} will be allocated to each selected card.`
                        : "Select cards to preview the shared cost per card."}
                    </p>
                  </div>
                </section>
              </div>

              <section className="grading-section card-picker-section">
                <div className="picker-heading">
                  <div>
                    <span>ELIGIBLE CARDS</span>
                    <h3>Select cards</h3>
                    <p>
                      Sold, archived and cards already in an active grading
                      workflow are excluded automatically.
                    </p>
                  </div>

                  <div className="picker-actions">
                    <button
                      type="button"
                      onClick={selectVisibleCards}
                      disabled={isLoadingCards || filteredCards.length === 0}
                    >
                      Select visible
                    </button>
                    <button
                      type="button"
                      onClick={clearSelection}
                      disabled={selectedCount === 0}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="picker-toolbar">
                  <label className="search-field">
                    <span>⌕</span>
                    <input
                      type="search"
                      value={searchTerm}
                      placeholder="Search player, card, product or collection..."
                      onChange={(event) => setSearchTerm(event.target.value)}
                    />
                  </label>

                  <label className="filter-field">
                    <span>Collection</span>
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

                  <div className="selection-counter">
                    <strong>{selectedCount}</strong>
                    <span>selected</span>
                  </div>
                </div>

                {isLoadingCards ? (
                  <div className="picker-state">
                    <span className="grading-spinner" />
                    <p>Loading eligible cards...</p>
                  </div>
                ) : loadError ? (
                  <div className="picker-error" role="alert">
                    <span>!</span>
                    <div>
                      <strong>Cards could not be loaded</strong>
                      <p>{loadError}</p>
                    </div>
                  </div>
                ) : filteredCards.length === 0 ? (
                  <div className="picker-state">
                    <span className="empty-icon">▱</span>
                    <p>No cards match the current filters.</p>
                  </div>
                ) : (
                  <div className="card-picker-grid">
                    {filteredCards.map((card) => {
                      const isSelected = Boolean(
                        selectedCardDrafts[card.id]
                      );
                      const currencyMismatch =
                        selectedCount > 0 &&
                        card.collectionCurrency !== currency;
                      const conditionLabel =
                        card.currentGradingCompany && card.currentGrade
                          ? `${card.currentGradingCompany} ${card.currentGrade}`
                          : "RAW";

                      return (
                        <button
                          className={[
                            "card-option",
                            isSelected ? "card-option-selected" : "",
                            currencyMismatch ? "card-option-disabled" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          type="button"
                          key={card.id}
                          onClick={() => toggleCard(card)}
                          disabled={currencyMismatch}
                        >
                          <div className="card-option-image">
                            {card.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={card.imageUrl}
                                alt={`${card.player_name} card front`}
                              />
                            ) : (
                              <span>NE</span>
                            )}

                            <span className="card-check">
                              {isSelected ? "✓" : ""}
                            </span>
                          </div>

                          <div className="card-option-copy">
                            <span className="card-collection">
                              {card.collection.name}
                            </span>
                            <strong>{card.player_name}</strong>
                            <p>
                              {joinDistinct([
                                card.year,
                                card.brand ?? card.manufacturer,
                                card.product ?? card.insertName,
                                card.card_number
                                  ? `#${card.card_number}`
                                  : null,
                              ]) || "Card details not specified"}
                            </p>

                            <div className="card-option-meta">
                              <span>{conditionLabel}</span>
                              <span>{card.collectionCurrency}</span>
                              <span>
                                {getValuationLabel(card.valuationSource)}
                              </span>
                            </div>

                            <div className="card-option-value">
                              <span>Current value</span>
                              <strong>
                                {formatCurrency(
                                  card.valuationValue,
                                  card.collectionCurrency
                                )}
                              </strong>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {noticeMessage && (
                  <p className="notice-message">{noticeMessage}</p>
                )}
              </section>

              {selectedCount > 0 && (
                <section className="grading-section selected-section">
                  <div className="section-heading">
                    <div>
                      <span>SUBMISSION CARDS</span>
                      <h3>Review card expectations</h3>
                      <p>
                        Record card-specific fees, expected grade and expected
                        value. Every field can be adjusted later in the draft.
                      </p>
                    </div>
                    <span className="selected-badge">
                      {selectedCount} cards
                    </span>
                  </div>

                  <div className="selected-card-list">
                    {selectedCards.map((card, index) => {
                      const draft = selectedCardDrafts[card.id];
                      const allocatedSharedCost =
                        selectedCount > 0
                          ? sharedCostTotal / selectedCount
                          : 0;
                      const cardSpecificCost =
                        parsePreviewMoney(draft.gradingFee) +
                        parsePreviewMoney(draft.preparationFee) +
                        parsePreviewMoney(draft.otherCardCosts);

                      return (
                        <article className="selected-card" key={card.id}>
                          <div className="selected-card-heading">
                            <span className="position-badge">{index + 1}</span>

                            <div className="selected-thumb">
                              {card.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={card.imageUrl}
                                  alt={`${card.player_name} thumbnail`}
                                />
                              ) : (
                                <span>NE</span>
                              )}
                            </div>

                            <div className="selected-card-title">
                              <strong>{card.player_name}</strong>
                              <p>
                                {joinDistinct([
                                  card.year,
                                  card.brand ?? card.manufacturer,
                                  card.product ?? card.insertName,
                                  card.card_number
                                    ? `#${card.card_number}`
                                    : null,
                                  card.parallel_name,
                                ])}
                              </p>
                              <span>
                                {card.collection.name} · Current value {" "}
                                {formatCurrency(
                                  card.valuationValue,
                                  card.collectionCurrency
                                )}
                              </span>
                            </div>

                            <button
                              className="remove-card-button"
                              type="button"
                              onClick={() => toggleCard(card)}
                            >
                              Remove
                            </button>
                          </div>

                          <div className="selected-fields">
                            <CompactMoneyField
                              label="Declared value"
                              value={draft.declaredValue}
                              currency={currency}
                              onChange={(value) =>
                                updateSelectedCard(
                                  card.id,
                                  "declaredValue",
                                  value
                                )
                              }
                            />
                            <CompactMoneyField
                              label="Grading fee"
                              value={draft.gradingFee}
                              currency={currency}
                              onChange={(value) =>
                                updateSelectedCard(
                                  card.id,
                                  "gradingFee",
                                  value
                                )
                              }
                            />
                            <CompactMoneyField
                              label="Preparation fee"
                              value={draft.preparationFee}
                              currency={currency}
                              onChange={(value) =>
                                updateSelectedCard(
                                  card.id,
                                  "preparationFee",
                                  value
                                )
                              }
                            />
                            <CompactMoneyField
                              label="Other card costs"
                              value={draft.otherCardCosts}
                              currency={currency}
                              onChange={(value) =>
                                updateSelectedCard(
                                  card.id,
                                  "otherCardCosts",
                                  value
                                )
                              }
                            />

                            <label className="compact-field">
                              <span>Expected grade</span>
                              <input
                                type="text"
                                value={draft.expectedGrade}
                                placeholder="PSA 9, 10..."
                                onChange={(event) =>
                                  updateSelectedCard(
                                    card.id,
                                    "expectedGrade",
                                    event.target.value
                                  )
                                }
                              />
                            </label>

                            <CompactMoneyField
                              label="Expected graded value"
                              value={draft.expectedGradedValue}
                              currency={currency}
                              onChange={(value) =>
                                updateSelectedCard(
                                  card.id,
                                  "expectedGradedValue",
                                  value
                                )
                              }
                            />
                          </div>

                          <div className="selected-card-costs">
                            <span>
                              Shared allocation {" "}
                              <strong>
                                {formatCurrency(allocatedSharedCost, currency)}
                              </strong>
                            </span>
                            <span>
                              Card-specific costs {" "}
                              <strong>
                                {formatCurrency(cardSpecificCost, currency)}
                              </strong>
                            </span>
                            <span>
                              Planned grading cost {" "}
                              <strong>
                                {formatCurrency(
                                  allocatedSharedCost + cardSpecificCost,
                                  currency
                                )}
                              </strong>
                            </span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              )}

              <section className="grading-summary">
                <div className="summary-heading">
                  <div>
                    <span>SUBMISSION PREVIEW</span>
                    <h3>Financial summary</h3>
                  </div>
                  <span className="summary-currency">{currency}</span>
                </div>

                <div className="summary-grid">
                  <SummaryMetric
                    label="Selected cards"
                    value={String(selectedCount)}
                    caption={`${availableCards.length} eligible`}
                  />
                  <SummaryMetric
                    label="Current RAW value"
                    value={formatCurrency(currentValueTotal, currency)}
                    caption="Market value first, then your estimate"
                  />
                  <SummaryMetric
                    label="Declared value"
                    value={formatCurrency(declaredValueTotal, currency)}
                  />
                  <SummaryMetric
                    label="Shared costs"
                    value={formatCurrency(sharedCostTotal, currency)}
                    caption={
                      selectedCount > 0
                        ? `${formatCurrency(
                            sharedCostPerCard,
                            currency
                          )} per card`
                        : "Select cards to allocate"
                    }
                  />
                  <SummaryMetric
                    label="Card-specific costs"
                    value={formatCurrency(cardSpecificCostTotal, currency)}
                  />
                  <SummaryMetric
                    label="Total grading cost"
                    value={formatCurrency(totalPlannedCost, currency)}
                    featured
                  />
                  <SummaryMetric
                    label="Expected graded value"
                    value={
                      expectedValueComplete
                        ? formatCurrency(expectedValueTotal, currency)
                        : "Incomplete"
                    }
                    caption="Based on your expectations"
                  />
                  <SummaryMetric
                    label="Projected net uplift"
                    value={
                      projectedNetUplift === null
                        ? "—"
                        : formatCurrency(projectedNetUplift, currency)
                    }
                    tone={
                      projectedNetUplift === null
                        ? "neutral"
                        : projectedNetUplift >= 0
                          ? "positive"
                          : "negative"
                    }
                    caption="Expected value minus RAW value and grading cost"
                  />
                </div>
              </section>

              <label className="notes-field">
                <span>SUBMISSION NOTES</span>
                <textarea
                  value={notes}
                  maxLength={5000}
                  placeholder="Preparation details, packaging, grader instructions or internal notes..."
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>

              {submitError && (
                <div className="submit-error" role="alert">
                  <span>!</span>
                  <div>
                    <strong>Submission could not be created</strong>
                    <p>{submitError}</p>
                  </div>
                </div>
              )}
            </div>
          </fieldset>

          <footer className="grading-footer">
            <p>
              {selectedCount > 0
                ? `${selectedCount} card${
                    selectedCount === 1 ? "" : "s"
                  } · ${formatCurrency(totalPlannedCost, currency)} planned cost`
                : "Select at least one eligible card."}
            </p>

            <div className="footer-actions">
              <button
                className="cancel-button"
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>

              <button
                className="create-button"
                type="submit"
                disabled={
                  isSubmitting ||
                  isLoadingCards ||
                  selectedCount === 0
                }
              >
                {isSubmitting ? (
                  <>
                    <span className="button-spinner" />
                    Creating submission...
                  </>
                ) : (
                  <>
                    <span>＋</span>
                    Create draft submission
                  </>
                )}
              </button>
            </div>
          </footer>
        </form>
      </section>

      <style jsx>{`
        .grading-backdrop {
          position: fixed;
          inset: 0;
          z-index: 4000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 22px;
          background: rgba(3, 5, 12, 0.9);
          backdrop-filter: blur(16px);
        }

        .grading-modal {
          width: min(1220px, 100%);
          max-height: calc(100vh - 44px);
          overflow-y: auto;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 27px;
          background:
            radial-gradient(
              circle at top right,
              rgba(124, 92, 255, 0.13),
              transparent 34%
            ),
            #11131c;
          box-shadow:
            0 40px 130px rgba(0, 0, 0, 0.72),
            0 0 0 1px rgba(255, 255, 255, 0.02);
          color: #f8fafc;
        }

        .grading-header {
          position: sticky;
          top: 0;
          z-index: 20;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          padding: 28px 30px 24px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.12);
          background: rgba(17, 19, 28, 0.97);
          backdrop-filter: blur(18px);
        }

        .grading-badge {
          display: inline-flex;
          padding: 6px 10px;
          border: 1px solid rgba(167, 139, 250, 0.25);
          border-radius: 999px;
          background: rgba(139, 92, 246, 0.1);
          color: #c4b5fd;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.16em;
        }

        .grading-header h2 {
          margin: 13px 0 0;
          color: #ffffff;
          font-size: 29px;
          letter-spacing: -0.035em;
        }

        .grading-header p {
          max-width: 720px;
          margin: 8px 0 0;
          color: #9299aa;
          font-size: 13px;
          line-height: 1.55;
        }

        .grading-close {
          flex: 0 0 auto;
          width: 40px;
          height: 40px;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.03);
          color: #9299aa;
          font-size: 26px;
          line-height: 1;
          cursor: pointer;
        }

        .grading-close:hover:not(:disabled) {
          border-color: rgba(167, 139, 250, 0.5);
          background: rgba(167, 139, 250, 0.09);
          color: #ffffff;
        }

        .grading-close:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .grading-form fieldset {
          min-width: 0;
          margin: 0;
          padding: 0;
          border: 0;
        }

        .grading-content {
          display: grid;
          gap: 20px;
          padding: 28px 30px;
        }

        .grading-top-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
          gap: 20px;
        }

        .grading-section,
        .grading-summary,
        .notes-field {
          min-width: 0;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 19px;
          background: rgba(255, 255, 255, 0.022);
        }

        .grading-section {
          padding: 22px;
        }

        .cost-section {
          background:
            radial-gradient(
              circle at top right,
              rgba(124, 92, 255, 0.08),
              transparent 43%
            ),
            rgba(255, 255, 255, 0.022);
        }

        .section-heading,
        .picker-heading,
        .summary-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
        }

        .section-heading {
          margin-bottom: 17px;
        }

        .section-heading > div > span,
        .picker-heading > div > span,
        .summary-heading > div > span {
          color: #9f93ff;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.15em;
        }

        .section-heading h3,
        .picker-heading h3,
        .summary-heading h3 {
          margin: 7px 0 0;
          color: #ffffff;
          font-size: 18px;
          letter-spacing: -0.02em;
        }

        .section-heading p,
        .picker-heading p {
          max-width: 690px;
          margin: 6px 0 0;
          color: #71798b;
          font-size: 11px;
          line-height: 1.5;
        }

        .field-grid,
        .cost-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 11px;
        }

        .field,
        .compact-field {
          min-width: 0;
          display: grid;
          gap: 7px;
        }

        .field-wide {
          grid-column: 1 / -1;
        }

        .field > span,
        .compact-field > span,
        .notes-field > span {
          color: #81899c;
          font-size: 9px;
          font-weight: 750;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .field input,
        .field select,
        .compact-field input,
        .filter-field select,
        .search-field,
        .input-suffix {
          width: 100%;
          min-width: 0;
          border: 1px solid rgba(148, 163, 184, 0.13);
          border-radius: 12px;
          outline: none;
          background: rgba(0, 0, 0, 0.18);
          color: #ffffff;
          font: inherit;
          font-size: 12px;
        }

        .field input,
        .field select,
        .compact-field input {
          min-height: 42px;
          padding: 0 12px;
        }

        .field select,
        .filter-field select {
          color-scheme: dark;
        }

        .field input:focus,
        .field select:focus,
        .compact-field input:focus,
        .input-suffix:focus-within,
        .search-field:focus-within,
        .filter-field select:focus {
          border-color: rgba(167, 139, 250, 0.62);
          box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.07);
        }

        .input-suffix {
          display: flex;
          align-items: center;
          overflow: hidden;
        }

        .input-suffix input {
          min-width: 0;
          flex: 1;
          border: 0;
          background: transparent;
          box-shadow: none;
        }

        .input-suffix strong {
          padding: 0 12px;
          color: #71798b;
          font-size: 10px;
        }

        .cost-allocation-note {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 13px;
          padding: 12px 13px;
          border: 1px solid rgba(96, 165, 250, 0.14);
          border-radius: 13px;
          background: rgba(59, 130, 246, 0.045);
          color: #bfdbfe;
        }

        .cost-allocation-note > span {
          flex: 0 0 auto;
          width: 24px;
          height: 24px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.06);
          font-weight: 800;
        }

        .cost-allocation-note p {
          margin: 0;
          color: #879db9;
          font-size: 10px;
          line-height: 1.5;
        }

        .picker-heading {
          padding-bottom: 17px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
        }

        .picker-actions {
          flex: 0 0 auto;
          display: flex;
          gap: 8px;
        }

        .picker-actions button {
          min-height: 36px;
          padding: 0 11px;
          border: 1px solid rgba(148, 163, 184, 0.13);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.025);
          color: #8f98aa;
          font-size: 9px;
          font-weight: 750;
          cursor: pointer;
        }

        .picker-actions button:hover:not(:disabled) {
          border-color: rgba(167, 139, 250, 0.35);
          color: #ffffff;
        }

        .picker-actions button:disabled {
          cursor: not-allowed;
          opacity: 0.4;
        }

        .picker-toolbar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 220px auto;
          gap: 10px;
          margin-top: 16px;
        }

        .search-field {
          min-height: 43px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 0 12px;
        }

        .search-field > span {
          color: #8e82d9;
          font-size: 18px;
        }

        .search-field input {
          min-width: 0;
          flex: 1;
          border: 0;
          outline: none;
          background: transparent;
          color: #ffffff;
          font: inherit;
          font-size: 12px;
        }

        .filter-field {
          display: grid;
          gap: 5px;
        }

        .filter-field > span {
          display: none;
        }

        .filter-field select {
          min-height: 43px;
          padding: 0 11px;
        }

        .selection-counter {
          min-width: 84px;
          display: grid;
          place-items: center;
          align-content: center;
          padding: 6px 11px;
          border: 1px solid rgba(167, 139, 250, 0.18);
          border-radius: 12px;
          background: rgba(139, 92, 246, 0.06);
        }

        .selection-counter strong {
          color: #ddd6fe;
          font-size: 15px;
        }

        .selection-counter span {
          color: #8e84ad;
          font-size: 8px;
          font-weight: 750;
          text-transform: uppercase;
        }

        .picker-state {
          min-height: 210px;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 11px;
          margin-top: 15px;
          border: 1px dashed rgba(148, 163, 184, 0.17);
          border-radius: 16px;
          background: rgba(0, 0, 0, 0.1);
          color: #71798b;
        }

        .picker-state p {
          margin: 0;
          font-size: 11px;
        }

        .empty-icon {
          color: #8e82d9;
          font-size: 28px;
        }

        .grading-spinner,
        .button-spinner {
          border-radius: 50%;
          animation: grading-spin 700ms linear infinite;
        }

        .grading-spinner {
          width: 28px;
          height: 28px;
          border: 2px solid rgba(167, 139, 250, 0.18);
          border-top-color: #a78bfa;
        }

        .picker-error,
        .submit-error {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 15px 16px;
          border: 1px solid rgba(248, 113, 113, 0.25);
          border-radius: 15px;
          background: rgba(239, 68, 68, 0.09);
          color: #fecaca;
        }

        .picker-error {
          margin-top: 15px;
        }

        .picker-error > span,
        .submit-error > span {
          flex: 0 0 auto;
          width: 25px;
          height: 25px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.08);
          font-weight: 800;
        }

        .picker-error strong,
        .submit-error strong {
          font-size: 12px;
        }

        .picker-error p,
        .submit-error p {
          margin: 5px 0 0;
          color: #dca9a9;
          font-size: 10px;
          line-height: 1.5;
        }

        .card-picker-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 11px;
          margin-top: 15px;
        }

        .card-option {
          min-width: 0;
          display: grid;
          grid-template-columns: 86px minmax(0, 1fr);
          gap: 13px;
          padding: 11px;
          border: 1px solid rgba(148, 163, 184, 0.11);
          border-radius: 15px;
          background: rgba(0, 0, 0, 0.12);
          color: inherit;
          text-align: left;
          cursor: pointer;
          transition:
            transform 150ms ease,
            border-color 150ms ease,
            background 150ms ease;
        }

        .card-option:hover:not(:disabled) {
          transform: translateY(-1px);
          border-color: rgba(167, 139, 250, 0.35);
          background: rgba(124, 92, 255, 0.045);
        }

        .card-option-selected {
          border-color: rgba(139, 92, 246, 0.7);
          background: rgba(124, 92, 255, 0.08);
          box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.045);
        }

        .card-option-disabled {
          cursor: not-allowed;
          opacity: 0.42;
        }

        .card-option-image {
          position: relative;
          height: 118px;
          display: grid;
          place-items: center;
          overflow: hidden;
          border-radius: 11px;
          background: #080a10;
        }

        .card-option-image img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .card-option-image > span:not(.card-check) {
          color: #8e82d9;
          font-size: 13px;
          font-weight: 800;
        }

        .card-check {
          position: absolute;
          top: 7px;
          right: 7px;
          width: 22px;
          height: 22px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(148, 163, 184, 0.3);
          border-radius: 50%;
          background: rgba(6, 8, 14, 0.8);
          color: transparent;
          font-size: 11px;
          font-weight: 800;
        }

        .card-option-selected .card-check {
          border-color: #8b5cf6;
          background: #7c5cff;
          color: #ffffff;
        }

        .card-option-copy {
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .card-collection {
          overflow: hidden;
          color: #8d83b4;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-overflow: ellipsis;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .card-option-copy > strong {
          overflow: hidden;
          margin-top: 5px;
          color: #ffffff;
          font-size: 12px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .card-option-copy > p {
          display: -webkit-box;
          overflow: hidden;
          margin: 6px 0 0;
          color: #747d90;
          font-size: 9px;
          line-height: 1.45;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .card-option-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-top: 8px;
        }

        .card-option-meta span {
          padding: 4px 6px;
          border-radius: 7px;
          background: rgba(255, 255, 255, 0.035);
          color: #737c8e;
          font-size: 7px;
          font-weight: 750;
        }

        .card-option-value {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 8px;
          margin-top: auto;
          padding-top: 9px;
        }

        .card-option-value span {
          color: #626b7d;
          font-size: 8px;
        }

        .card-option-value strong {
          color: #d9dce4;
          font-size: 11px;
        }

        .notice-message {
          margin: 12px 0 0;
          padding: 10px 12px;
          border-radius: 11px;
          background: rgba(245, 158, 11, 0.055);
          color: #c7ae68;
          font-size: 9px;
          line-height: 1.5;
        }

        .selected-badge,
        .summary-currency {
          flex: 0 0 auto;
          padding: 6px 9px;
          border-radius: 999px;
          background: rgba(139, 92, 246, 0.08);
          color: #c4b5fd;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .selected-card-list {
          display: grid;
          gap: 11px;
        }

        .selected-card {
          min-width: 0;
          padding: 15px;
          border: 1px solid rgba(148, 163, 184, 0.11);
          border-radius: 16px;
          background: rgba(0, 0, 0, 0.13);
        }

        .selected-card-heading {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .position-badge {
          flex: 0 0 auto;
          width: 27px;
          height: 27px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: rgba(139, 92, 246, 0.09);
          color: #c4b5fd;
          font-size: 10px;
          font-weight: 800;
        }

        .selected-thumb {
          flex: 0 0 auto;
          width: 48px;
          height: 66px;
          display: grid;
          place-items: center;
          overflow: hidden;
          border-radius: 8px;
          background: #080a10;
        }

        .selected-thumb img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .selected-thumb span {
          color: #7d72ba;
          font-size: 9px;
          font-weight: 800;
        }

        .selected-card-title {
          min-width: 0;
          flex: 1;
        }

        .selected-card-title > strong {
          display: block;
          color: #ffffff;
          font-size: 12px;
        }

        .selected-card-title p {
          margin: 5px 0 0;
          color: #747d90;
          font-size: 9px;
          line-height: 1.45;
        }

        .selected-card-title > span {
          display: block;
          margin-top: 5px;
          color: #666f81;
          font-size: 8px;
        }

        .remove-card-button {
          flex: 0 0 auto;
          border: 0;
          border-radius: 9px;
          padding: 7px 9px;
          background: transparent;
          color: #8f98aa;
          font-size: 9px;
          font-weight: 700;
          cursor: pointer;
        }

        .remove-card-button:hover {
          background: rgba(239, 68, 68, 0.07);
          color: #fca5a5;
        }

        .selected-fields {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 9px;
          margin-top: 13px;
        }

        .selected-card-costs {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 11px;
          padding-top: 11px;
          border-top: 1px solid rgba(148, 163, 184, 0.08);
        }

        .selected-card-costs span {
          padding: 5px 7px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.025);
          color: #687183;
          font-size: 8px;
        }

        .selected-card-costs strong {
          color: #aeb4c1;
        }

        .grading-summary {
          padding: 22px;
          background:
            radial-gradient(
              circle at top right,
              rgba(124, 92, 255, 0.1),
              transparent 42%
            ),
            rgba(124, 92, 255, 0.035);
        }

        .summary-heading {
          padding-bottom: 17px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-top: 16px;
        }

        .notes-field {
          display: grid;
          gap: 8px;
          padding: 18px;
        }

        .notes-field textarea {
          width: 100%;
          min-height: 95px;
          resize: vertical;
          padding: 12px 13px;
          border: 1px solid rgba(148, 163, 184, 0.13);
          border-radius: 12px;
          outline: none;
          background: rgba(0, 0, 0, 0.18);
          color: #ffffff;
          font: inherit;
          font-size: 11px;
          line-height: 1.55;
        }

        .notes-field textarea:focus {
          border-color: rgba(167, 139, 250, 0.62);
          box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.07);
        }

        .grading-footer {
          position: sticky;
          bottom: 0;
          z-index: 20;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 22px;
          padding: 20px 30px;
          border-top: 1px solid rgba(148, 163, 184, 0.12);
          background: rgba(17, 19, 28, 0.97);
          backdrop-filter: blur(18px);
        }

        .grading-footer > p {
          margin: 0;
          color: #71798b;
          font-size: 10px;
        }

        .footer-actions {
          flex: 0 0 auto;
          display: flex;
          gap: 10px;
        }

        .cancel-button,
        .create-button {
          min-height: 46px;
          padding: 0 18px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 750;
          cursor: pointer;
        }

        .cancel-button {
          border: 1px solid rgba(148, 163, 184, 0.16);
          background: rgba(255, 255, 255, 0.03);
          color: #a5adbd;
        }

        .cancel-button:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.06);
          color: #ffffff;
        }

        .create-button {
          min-width: 205px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border: 0;
          background: linear-gradient(135deg, #8b5cf6, #6d5ce7);
          color: #ffffff;
          box-shadow: 0 10px 28px rgba(124, 92, 255, 0.24);
        }

        .create-button:hover:not(:disabled) {
          filter: brightness(1.08);
        }

        .cancel-button:disabled,
        .create-button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .button-spinner {
          width: 15px;
          height: 15px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #ffffff;
        }

        @keyframes grading-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1080px) {
          .grading-top-grid {
            grid-template-columns: 1fr;
          }

          .card-picker-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .selected-fields {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .grading-backdrop {
            align-items: stretch;
            padding: 0;
          }

          .grading-modal {
            width: 100%;
            max-height: 100dvh;
            border: 0;
            border-radius: 0;
          }

          .grading-header,
          .grading-content,
          .grading-footer {
            padding-left: 18px;
            padding-right: 18px;
          }

          .grading-header {
            padding-top: calc(19px + env(safe-area-inset-top));
          }

          .grading-header h2 {
            font-size: 25px;
          }

          .grading-content {
            padding-top: 18px;
            padding-bottom: 18px;
          }

          .field-grid,
          .cost-grid,
          .selected-fields,
          .summary-grid {
            grid-template-columns: 1fr;
          }

          .field-wide {
            grid-column: auto;
          }

          .picker-heading {
            flex-direction: column;
          }

          .picker-actions {
            width: 100%;
          }

          .picker-actions button {
            flex: 1;
          }

          .picker-toolbar {
            grid-template-columns: 1fr;
          }

          .selection-counter {
            display: flex;
            justify-content: center;
            gap: 6px;
          }

          .card-picker-grid {
            grid-template-columns: 1fr;
          }

          .card-option {
            grid-template-columns: 96px minmax(0, 1fr);
          }

          .card-option-image {
            height: 132px;
          }

          .selected-card-heading {
            align-items: flex-start;
            flex-wrap: wrap;
          }

          .selected-card-title {
            flex-basis: calc(100% - 100px);
          }

          .remove-card-button {
            margin-left: auto;
          }

          .grading-footer {
            align-items: stretch;
            flex-direction: column;
            gap: 13px;
            padding-bottom: calc(16px + env(safe-area-inset-bottom));
          }

          .footer-actions {
            display: grid;
            grid-template-columns: 1fr 1.5fr;
          }

          .cancel-button,
          .create-button {
            width: 100%;
            min-width: 0;
          }
        }

        @media (max-width: 430px) {
          .grading-section,
          .grading-summary {
            padding: 17px;
          }

          .card-option {
            grid-template-columns: 82px minmax(0, 1fr);
          }

          .card-option-image {
            height: 116px;
          }

          .footer-actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

type MoneyFieldProps = {
  label: string;
  value: string;
  currency: string;
  wide?: boolean;
  onChange: (value: string) => void;
};

function MoneyField({
  label,
  value,
  currency,
  wide = false,
  onChange,
}: MoneyFieldProps) {
  return (
    <label className={wide ? "money-field money-field-wide" : "money-field"}>
      <span>{label}</span>
      <div>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          placeholder="0"
          onChange={(event) => onChange(event.target.value)}
        />
        <strong>{currency}</strong>
      </div>

      <style jsx>{`
        .money-field {
          min-width: 0;
          display: grid;
          gap: 7px;
        }

        .money-field-wide {
          grid-column: 1 / -1;
        }

        .money-field > span {
          color: #81899c;
          font-size: 9px;
          font-weight: 750;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .money-field > div {
          display: flex;
          align-items: center;
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.13);
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.18);
        }

        .money-field input {
          min-width: 0;
          min-height: 42px;
          flex: 1;
          padding: 0 12px;
          border: 0;
          outline: none;
          background: transparent;
          color: #ffffff;
          font: inherit;
          font-size: 12px;
        }

        .money-field strong {
          flex: 0 0 auto;
          padding: 0 12px;
          color: #71798b;
          font-size: 9px;
        }

        .money-field > div:focus-within {
          border-color: rgba(167, 139, 250, 0.62);
          box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.07);
        }

        @media (max-width: 720px) {
          .money-field-wide {
            grid-column: auto;
          }
        }
      `}</style>
    </label>
  );
}

type CompactMoneyFieldProps = {
  label: string;
  value: string;
  currency: string;
  onChange: (value: string) => void;
};

function CompactMoneyField({
  label,
  value,
  currency,
  onChange,
}: CompactMoneyFieldProps) {
  return (
    <label className="compact-money-field">
      <span>{label}</span>
      <div>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          placeholder="0"
          onChange={(event) => onChange(event.target.value)}
        />
        <strong>{currency}</strong>
      </div>

      <style jsx>{`
        .compact-money-field {
          min-width: 0;
          display: grid;
          gap: 6px;
        }

        .compact-money-field > span {
          color: #747d90;
          font-size: 8px;
          font-weight: 750;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .compact-money-field > div {
          display: flex;
          align-items: center;
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.11);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.018);
        }

        .compact-money-field input {
          min-width: 0;
          min-height: 39px;
          flex: 1;
          padding: 0 9px;
          border: 0;
          outline: none;
          background: transparent;
          color: #ffffff;
          font: inherit;
          font-size: 10px;
        }

        .compact-money-field strong {
          flex: 0 0 auto;
          padding: 0 8px;
          color: #626b7d;
          font-size: 7px;
        }

        .compact-money-field > div:focus-within {
          border-color: rgba(167, 139, 250, 0.55);
        }
      `}</style>
    </label>
  );
}

type SummaryMetricProps = {
  label: string;
  value: string;
  caption?: string;
  featured?: boolean;
  tone?: "neutral" | "positive" | "negative";
};

function SummaryMetric({
  label,
  value,
  caption,
  featured = false,
  tone = "neutral",
}: SummaryMetricProps) {
  return (
    <article
      className={[
        "summary-metric",
        featured ? "summary-metric-featured" : "",
        `summary-metric-${tone}`,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span>{label}</span>
      <strong>{value}</strong>
      {caption && <small>{caption}</small>}

      <style jsx>{`
        .summary-metric {
          min-width: 0;
          padding: 15px;
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.13);
        }

        .summary-metric-featured {
          border-color: rgba(139, 92, 246, 0.28);
          background: rgba(124, 92, 255, 0.065);
        }

        .summary-metric > span {
          display: block;
          color: #71798b;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .summary-metric > strong {
          display: block;
          overflow-wrap: anywhere;
          margin-top: 7px;
          color: #ffffff;
          font-size: 16px;
          letter-spacing: -0.02em;
        }

        .summary-metric-featured > strong {
          color: #ddd6fe;
          font-size: 18px;
        }

        .summary-metric > small {
          display: block;
          margin-top: 5px;
          color: #666f81;
          font-size: 8px;
          line-height: 1.4;
        }

        .summary-metric-positive > strong {
          color: #86efac;
        }

        .summary-metric-negative > strong {
          color: #fca5a5;
        }
      `}</style>
    </article>
  );
}