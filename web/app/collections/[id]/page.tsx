"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams } from "next/navigation";

import AddCardModal from "@/components/AddCardModal";
import ScanCardModal from "@/components/ScanCardModal";
import { createClient } from "@/lib/supabase/client";

const CARD_IMAGE_BUCKET = "card-images";
const SIGNED_URL_SECONDS = 60 * 60;

type Collection = {
  id: string;
  name: string;
  type: "pc" | "inventory";
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
  purchase_price: number | null;
  estimated_value: number | null;
  state: string | null;
  created_at: string;
};

type CardImageRow = {
  card_id: string;
  image_type: string;
  storage_path: string;
};

type CardAttributeRow = {
  card_id: string;
  attribute_key: string;
  attribute_value: unknown;
};

type NumericDatabaseValue =
  | number
  | string
  | null;

type SaleTransactionRow = {
  id: string;
  card_id: string;
  collection_id: string | null;
  occurred_at: string;
  currency: string;
  item_amount: NumericDatabaseValue;
  shipping_income: NumericDatabaseValue;
  platform_fee: NumericDatabaseValue;
  payment_fee: NumericDatabaseValue;
  shipping_cost: NumericDatabaseValue;
  other_costs: NumericDatabaseValue;
  cost_basis: NumericDatabaseValue;
  net_amount: NumericDatabaseValue;
  realized_profit: NumericDatabaseValue;
  platform: string | null;
  counterparty: string | null;
  reference: string | null;
};

type SaleTransaction = {
  id: string;
  card_id: string;
  collection_id: string | null;
  occurred_at: string;
  currency: string;
  item_amount: number;
  shipping_income: number;
  platform_fee: number;
  payment_fee: number;
  shipping_cost: number;
  other_costs: number;
  cost_basis: number;
  net_amount: number;
  realized_profit: number;
  platform: string | null;
  counterparty: string | null;
  reference: string | null;
};

type Card = CardRow & {
  front_image_url: string | null;
  sport: string | null;
  team: string | null;
  brand: string | null;
  product: string | null;
  insert_name: string | null;
  ai_confidence: number | null;
  is_current_collection: boolean;
  sale: SaleTransaction | null;
};

type CardFilter =
  | "active"
  | "sold"
  | "all";

type CardStateMeta = {
  label: string;
  tone:
    | "verified"
    | "review"
    | "grading"
    | "listed"
    | "sold"
    | "neutral";
};

function getAttributeValue(
  attributes: CardAttributeRow[],
  attributeKey: string
) {
  return attributes.find(
    (attribute) => attribute.attribute_key === attributeKey
  )?.attribute_value;
}

function getStringAttribute(
  attributes: CardAttributeRow[],
  attributeKey: string
) {
  const value = getAttributeValue(attributes, attributeKey);

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}

function getNumberAttribute(
  attributes: CardAttributeRow[],
  attributeKey: string
) {
  const value = getAttributeValue(attributes, attributeKey);

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsedValue = Number(value.replace(",", "."));

    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  return null;
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

function toDatabaseNumber(
  value: NumericDatabaseValue
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : 0;
}

function formatCurrency(
  value: number | null,
  currency = "DKK"
) {
  if (value === null) {
    return "—";
  }

  if (currency === "DKK") {
    return `${Number(value).toLocaleString(
      "da-DK",
      {
        minimumFractionDigits:
          value % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      }
    )} kr.`;
  }

  return new Intl.NumberFormat(
    "da-DK",
    {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }
  ).format(value);
}

function formatPercentage(
  value: number | null
) {
  if (value === null) {
    return "—";
  }

  return `${value.toLocaleString(
    "da-DK",
    {
      maximumFractionDigits: 1,
    }
  )}%`;
}

function formatShortDate(
  value: string
) {
  return new Intl.DateTimeFormat(
    "da-DK",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(new Date(value));
}

function normalizeSaleTransaction(
  transaction: SaleTransactionRow
): SaleTransaction {
  return {
    id: transaction.id,
    card_id: transaction.card_id,
    collection_id:
      transaction.collection_id,
    occurred_at:
      transaction.occurred_at,
    currency:
      transaction.currency,
    item_amount:
      toDatabaseNumber(
        transaction.item_amount
      ),
    shipping_income:
      toDatabaseNumber(
        transaction.shipping_income
      ),
    platform_fee:
      toDatabaseNumber(
        transaction.platform_fee
      ),
    payment_fee:
      toDatabaseNumber(
        transaction.payment_fee
      ),
    shipping_cost:
      toDatabaseNumber(
        transaction.shipping_cost
      ),
    other_costs:
      toDatabaseNumber(
        transaction.other_costs
      ),
    cost_basis:
      toDatabaseNumber(
        transaction.cost_basis
      ),
    net_amount:
      toDatabaseNumber(
        transaction.net_amount
      ),
    realized_profit:
      toDatabaseNumber(
        transaction.realized_profit
      ),
    platform:
      transaction.platform,
    counterparty:
      transaction.counterparty,
    reference:
      transaction.reference,
  };
}

function getCardStateMeta(state: string | null): CardStateMeta {
  switch (state) {
    case "verified":
      return {
        label: "Verified",
        tone: "verified",
      };

    case "needs_review":
    case "draft":
      return {
        label: "Needs review",
        tone: "review",
      };

    case "submitted":
    case "graded":
      return {
        label: state === "graded" ? "Graded" : "At grading",
        tone: "grading",
      };

    case "listed":
      return {
        label: "For sale",
        tone: "listed",
      };

    case "sold":
      return {
        label: "Sold",
        tone: "sold",
      };

    default:
      return {
        label: "Registered",
        tone: "neutral",
      };
  }
}

export default function CollectionPage() {
  const params = useParams();

  const rawCollectionId = params.id;

  const collectionId = Array.isArray(rawCollectionId)
    ? rawCollectionId[0]
    : rawCollectionId ?? "";

  const supabase = useMemo(() => createClient(), []);

  const [collection, setCollection] =
    useState<Collection | null>(null);

  const [cards, setCards] = useState<Card[]>([]);

  const [saleTransactions, setSaleTransactions] =
    useState<SaleTransaction[]>([]);

  const [cardFilter, setCardFilter] =
    useState<CardFilter>("active");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");

  const [showAddCardChoice, setShowAddCardChoice] =
    useState(false);

  const [showScanCard, setShowScanCard] =
    useState(false);

  const [showAddCard, setShowAddCard] =
    useState(false);

  const [playerName, setPlayerName] = useState("");
  const [year, setYear] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [setName, setSetName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [parallelName, setParallelName] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [notes, setNotes] = useState("");

  const loadCollection = useCallback(async () => {
    if (!collectionId) {
      setMessage("Collection-ID mangler.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    const [
      collectionResult,
      currentCardResult,
      saleResult,
    ] = await Promise.all([
      supabase
        .from("collections")
        .select("*")
        .eq("id", collectionId)
        .single(),

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
          state,
          created_at
        `)
        .eq(
          "current_collection_id",
          collectionId
        )
        .order("created_at", {
          ascending: false,
        }),

      supabase
        .from("card_transactions")
        .select(`
          id,
          card_id,
          collection_id,
          occurred_at,
          currency,
          item_amount,
          shipping_income,
          platform_fee,
          payment_fee,
          shipping_cost,
          other_costs,
          cost_basis,
          net_amount,
          realized_profit,
          platform,
          counterparty,
          reference
        `)
        .eq("collection_id", collectionId)
        .eq("transaction_type", "sale")
        .eq("status", "completed")
        .order("occurred_at", {
          ascending: false,
        }),
    ]);

    if (collectionResult.error) {
      setMessage(
        `Kunne ikke hente samlingen: ${collectionResult.error.message}`
      );
      setLoading(false);
      return;
    }

    if (currentCardResult.error) {
      setMessage(
        `Kunne ikke hente kortene: ${currentCardResult.error.message}`
      );
      setLoading(false);
      return;
    }

    const warnings: string[] = [];

    const currentCards =
      (currentCardResult.data ?? []) as CardRow[];

    const normalizedSales = saleResult.error
      ? []
      : ((saleResult.data ?? []) as SaleTransactionRow[]).map(
          normalizeSaleTransaction
        );

    if (saleResult.error) {
      console.error(
        "Salgstransaktionerne kunne ikke hentes:",
        saleResult.error
      );

      warnings.push(
        "Kortene blev indlæst, men salgsresultaterne kunne ikke vises."
      );
    }

    setCollection(
      collectionResult.data as Collection
    );

    setSaleTransactions(
      normalizedSales
    );

    const currentCardIds = new Set(
      currentCards.map((card) => card.id)
    );

    const historicalSoldCardIds =
      normalizedSales
        .map((sale) => sale.card_id)
        .filter(
          (cardId) =>
            !currentCardIds.has(cardId)
        );

    let historicalSoldCards: CardRow[] = [];

    if (historicalSoldCardIds.length > 0) {
      const historicalCardResult =
        await supabase
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
            state,
            created_at
          `)
          .in("id", historicalSoldCardIds);

      if (historicalCardResult.error) {
        console.error(
          "Historiske salgskort kunne ikke hentes:",
          historicalCardResult.error
        );

        warnings.push(
          "Nogle historiske salgskort kunne ikke vises."
        );
      } else {
        historicalSoldCards =
          (historicalCardResult.data ?? []) as CardRow[];
      }
    }

    const rawCards = [
      ...currentCards,
      ...historicalSoldCards,
    ];

    if (rawCards.length === 0) {
      setCards([]);

      if (warnings.length > 0) {
        setMessage(
          Array.from(
            new Set(warnings)
          ).join(" ")
        );
      }

      setLoading(false);
      return;
    }

    const cardIds = Array.from(
      new Set(
        rawCards.map((card) => card.id)
      )
    );

    const [
      imageResult,
      attributeResult,
    ] = await Promise.all([
      supabase
        .from("card_images")
        .select(`
          card_id,
          image_type,
          storage_path
        `)
        .in("card_id", cardIds)
        .eq("image_type", "front"),

      supabase
        .from("card_attributes")
        .select(`
          card_id,
          attribute_key,
          attribute_value
        `)
        .in("card_id", cardIds),
    ]);

    const imageRows = imageResult.error
      ? []
      : ((imageResult.data ?? []) as CardImageRow[]);

    const attributeRows = attributeResult.error
      ? []
      : ((attributeResult.data ?? []) as CardAttributeRow[]);

    if (imageResult.error) {
      console.error(
        "Kortbillederne kunne ikke hentes:",
        imageResult.error
      );

      warnings.push(
        "Kortene blev indlæst, men nogle billeder kunne ikke vises."
      );
    }

    if (attributeResult.error) {
      console.error(
        "Card DNA kunne ikke hentes:",
        attributeResult.error
      );

      warnings.push(
        "Kortene blev indlæst, men nogle detaljer kunne ikke vises."
      );
    }

    const signedImageByCardId =
      new Map<string, string>();

    let signedUrlFailure = false;

    await Promise.all(
      imageRows.map(async (image) => {
        const { data, error } =
          await supabase.storage
            .from(CARD_IMAGE_BUCKET)
            .createSignedUrl(
              image.storage_path,
              SIGNED_URL_SECONDS
            );

        if (error || !data?.signedUrl) {
          signedUrlFailure = true;

          console.error(
            "Signed URL kunne ikke oprettes:",
            {
              path: image.storage_path,
              error,
            }
          );

          return;
        }

        signedImageByCardId.set(
          image.card_id,
          data.signedUrl
        );
      })
    );

    if (signedUrlFailure) {
      warnings.push(
        "Et eller flere kortbilleder kunne ikke åbnes."
      );
    }

    const attributesByCardId =
      new Map<string, CardAttributeRow[]>();

    for (const attribute of attributeRows) {
      const currentAttributes =
        attributesByCardId.get(
          attribute.card_id
        ) ?? [];

      currentAttributes.push(attribute);

      attributesByCardId.set(
        attribute.card_id,
        currentAttributes
      );
    }

    const saleByCardId =
      new Map<string, SaleTransaction>();

    for (const sale of normalizedSales) {
      saleByCardId.set(
        sale.card_id,
        sale
      );
    }

    const enrichedCards: Card[] =
      rawCards.map((card) => {
        const cardAttributes =
          attributesByCardId.get(card.id) ?? [];

        return {
          ...card,

          front_image_url:
            signedImageByCardId.get(card.id) ?? null,

          sport:
            getStringAttribute(
              cardAttributes,
              "sport"
            ),

          team:
            getStringAttribute(
              cardAttributes,
              "team"
            ),

          brand:
            getStringAttribute(
              cardAttributes,
              "brand"
            ),

          product:
            getStringAttribute(
              cardAttributes,
              "product"
            ),

          insert_name:
            getStringAttribute(
              cardAttributes,
              "set_name"
            ) ?? card.set_name,

          ai_confidence:
            getNumberAttribute(
              cardAttributes,
              "ai_confidence"
            ),

          is_current_collection:
            card.current_collection_id ===
            collectionId,

          sale:
            saleByCardId.get(card.id) ?? null,
        };
      });

    setCards(enrichedCards);

    if (warnings.length > 0) {
      setMessage(
        Array.from(
          new Set(warnings)
        ).join(" ")
      );
    }

    setLoading(false);
  }, [
    collectionId,
    supabase,
  ]);

  useEffect(() => {
    void loadCollection();
  }, [loadCollection]);

  function resetForm() {
    setPlayerName("");
    setYear("");
    setManufacturer("");
    setSetName("");
    setCardNumber("");
    setParallelName("");
    setSerialNumber("");
    setPurchasePrice("");
    setEstimatedValue("");
    setNotes("");
  }

  function parseOptionalNumber(value: string) {
    if (!value.trim()) {
      return null;
    }

    const normalizedValue =
      value.replace(",", ".");

    const parsedValue =
      Number(normalizedValue);

    return Number.isFinite(parsedValue)
      ? parsedValue
      : null;
  }

  function handleScanCard() {
    setShowAddCardChoice(false);
    setMessage("");
    setShowScanCard(true);
  }

  function handleManualCard() {
    setShowAddCardChoice(false);
    setMessage("");
    setShowAddCard(true);
  }

  async function handleAddCard(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!playerName.trim()) {
      setMessage(
        "Spillernavn er obligatorisk."
      );
      return;
    }

    setSaving(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage(
        "Du er ikke logget ind."
      );
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("cards")
      .insert({
        user_id: user.id,
        current_collection_id:
          collectionId,
        player_name:
          playerName.trim(),
        year:
          year.trim() || null,
        manufacturer:
          manufacturer.trim() || null,
        set_name:
          setName.trim() || null,
        card_number:
          cardNumber.trim() || null,
        parallel_name:
          parallelName.trim() || null,
        serial_number:
          serialNumber.trim() || null,
        purchase_price:
          parseOptionalNumber(
            purchasePrice
          ),
        estimated_value:
          parseOptionalNumber(
            estimatedValue
          ),
        notes:
          notes.trim() || null,
      });

    if (error) {
      setMessage(
        `Kortet kunne ikke gemmes: ${error.message}`
      );
      setSaving(false);
      return;
    }

    resetForm();

    setShowAddCard(false);

    setMessage(
      "Kortet er tilføjet."
    );

    setSaving(false);

    await loadCollection();
  }

  const activeCards = cards.filter(
    (card) =>
      card.is_current_collection &&
      card.state !== "sold"
  );

  const soldCards = cards.filter(
    (card) => Boolean(card.sale)
  );

  const visibleCards =
    cardFilter === "active"
      ? activeCards
      : cardFilter === "sold"
        ? [...soldCards].sort(
            (firstCard, secondCard) =>
              new Date(
                secondCard.sale?.occurred_at ??
                  secondCard.created_at
              ).getTime() -
              new Date(
                firstCard.sale?.occurred_at ??
                  firstCard.created_at
              ).getTime()
          )
        : cards;

  const activePurchasePrice =
    activeCards.reduce(
      (total, card) =>
        total +
        Number(
          card.purchase_price ?? 0
        ),
      0
    );

  const activeEstimatedValue =
    activeCards.reduce(
      (total, card) =>
        total +
        Number(
          card.estimated_value ?? 0
        ),
      0
    );

  const activeUnrealizedResult =
    activeEstimatedValue -
    activePurchasePrice;

  const soldGrossRevenue =
    saleTransactions.reduce(
      (total, sale) =>
        total +
        sale.item_amount +
        sale.shipping_income,
      0
    );

  const soldNetProceeds =
    saleTransactions.reduce(
      (total, sale) =>
        total +
        sale.net_amount,
      0
    );

  const soldCostBasis =
    saleTransactions.reduce(
      (total, sale) =>
        total +
        sale.cost_basis,
      0
    );

  const soldRealizedProfit =
    saleTransactions.reduce(
      (total, sale) =>
        total +
        sale.realized_profit,
      0
    );

  const soldRealizedRoi =
    soldCostBasis > 0
      ? (soldRealizedProfit /
          soldCostBasis) *
        100
      : null;

  if (loading) {
    return (
      <main className="collection-page">
        <div className="collection-loading">
          <div className="loading-indicator" />
          <p>Indlæser collection...</p>
        </div>
      </main>
    );
  }

  if (!collection) {
    return (
      <main className="collection-page">
        <Link
          className="back-link"
          href="/"
        >
          ← Tilbage til Home
        </Link>

        <section className="panel collection-error-panel">
          <h1>
            Collection blev ikke fundet
          </h1>

          <p>{message}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="collection-page">
      <header className="collection-page-header">
        <div>
          <Link
            className="back-link"
            href="/"
          >
            ← Tilbage til Home
          </Link>

          <p className="eyebrow">
            {collection.type === "pc"
              ? "Personal Collection"
              : "Dealer Inventory"}
          </p>

          <h1>{collection.name}</h1>

          <p className="collection-page-description">
            {activeCards.length}{" "}
            {activeCards.length === 1
              ? "active card"
              : "active cards"}{" "}
            ·{" "}
            {formatCurrency(
              activeEstimatedValue,
              collection.currency
            )}{" "}
            active value
            {saleTransactions.length > 0
              ? ` · ${saleTransactions.length} sold`
              : ""}
          </p>
        </div>

        <div className="topbar-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              setMessage("");
              setShowAddCardChoice(
                true
              );
            }}
          >
            ◎ Scan card
          </button>

          <button
            className="primary-button"
            type="button"
            onClick={() => {
              setMessage("");
              setShowAddCard(true);
            }}
          >
            ＋ Add card
          </button>
        </div>
      </header>

      <section className="collection-summary-grid">
        <article className="metric-card">
          <div className="metric-card-header">
            <span className="metric-label">
              Active cards
            </span>

            <span className="metric-icon">
              ▱
            </span>
          </div>

          <p className="metric-value">
            {activeCards.length}
          </p>

          <p className="metric-caption">
            currently held
          </p>
        </article>

        <article className="metric-card">
          <div className="metric-card-header">
            <span className="metric-label">
              Active cost
            </span>

            <span className="metric-icon">
              ↘
            </span>
          </div>

          <p className="metric-value">
            {formatCurrency(
              activePurchasePrice,
              collection.currency
            )}
          </p>

          <p className="metric-caption">
            cost basis still held
          </p>
        </article>

        <article className="metric-card metric-card-featured">
          <div className="metric-card-header">
            <span className="metric-label">
              Active value
            </span>

            <span className="metric-icon">
              ◇
            </span>
          </div>

          <p className="metric-value">
            {formatCurrency(
              activeEstimatedValue,
              collection.currency
            )}
          </p>

          <p className="metric-caption">
            current estimated value
          </p>
        </article>

        <article className="metric-card">
          <div className="metric-card-header">
            <span className="metric-label">
              Unrealized result
            </span>

            <span className="metric-icon">
              ⌁
            </span>
          </div>

          <p
            className={[
              "metric-value",
              activeUnrealizedResult > 0
                ? "metric-value-positive"
                : "",
              activeUnrealizedResult < 0
                ? "metric-value-negative"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {formatCurrency(
              activeUnrealizedResult,
              collection.currency
            )}
          </p>

          <p className="metric-caption">
            active portfolio difference
          </p>
        </article>
      </section>

      <section className="sales-performance-panel">
        <div className="sales-performance-heading">
          <div>
            <p className="eyebrow">
              Realized performance
            </p>

            <h2>Sales</h2>

            <p>
              Completed sales recorded from this collection.
            </p>
          </div>

          <button
            className="view-sold-button"
            type="button"
            onClick={() =>
              setCardFilter("sold")
            }
            disabled={
              saleTransactions.length === 0
            }
          >
            View sold cards →
          </button>
        </div>

        <div className="sales-summary-grid">
          <article className="sales-metric-card">
            <span>Sold cards</span>
            <strong>
              {saleTransactions.length}
            </strong>
            <small>completed sales</small>
          </article>

          <article className="sales-metric-card">
            <span>Gross sales</span>
            <strong>
              {formatCurrency(
                soldGrossRevenue,
                collection.currency
              )}
            </strong>
            <small>price plus shipping income</small>
          </article>

          <article className="sales-metric-card">
            <span>Net proceeds</span>
            <strong>
              {formatCurrency(
                soldNetProceeds,
                collection.currency
              )}
            </strong>
            <small>after fees and costs</small>
          </article>

          <article
            className={[
              "sales-metric-card",
              soldRealizedProfit > 0
                ? "sales-metric-positive"
                : "",
              soldRealizedProfit < 0
                ? "sales-metric-negative"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span>Realized profit</span>
            <strong>
              {formatCurrency(
                soldRealizedProfit,
                collection.currency
              )}
            </strong>
            <small>net proceeds minus cost basis</small>
          </article>

          <article className="sales-metric-card">
            <span>Realized ROI</span>
            <strong>
              {formatPercentage(
                soldRealizedRoi
              )}
            </strong>
            <small>weighted return on sold cards</small>
          </article>
        </div>
      </section>

      {message && (
        <p className="collection-status-message">
          {message}
        </p>
      )}

      <section className="panel cards-panel">
        <div className="panel-header cards-panel-header">
          <div>
            <p className="eyebrow">
              {cardFilter === "sold"
                ? "Sales history"
                : cardFilter === "all"
                  ? "Complete history"
                  : "Inventory"}
            </p>

            <h2>
              {cardFilter === "sold"
                ? "Sold cards"
                : cardFilter === "all"
                  ? "All cards"
                  : "Active cards"}
            </h2>
          </div>

          <div className="cards-panel-controls">
            <div
              className="card-filter-tabs"
              role="tablist"
              aria-label="Card filter"
            >
              <button
                className={
                  cardFilter === "active"
                    ? "card-filter-active"
                    : ""
                }
                type="button"
                role="tab"
                aria-selected={
                  cardFilter === "active"
                }
                onClick={() =>
                  setCardFilter("active")
                }
              >
                Active
                <span>{activeCards.length}</span>
              </button>

              <button
                className={
                  cardFilter === "sold"
                    ? "card-filter-active"
                    : ""
                }
                type="button"
                role="tab"
                aria-selected={
                  cardFilter === "sold"
                }
                onClick={() =>
                  setCardFilter("sold")
                }
              >
                Sold
                <span>{soldCards.length}</span>
              </button>

              <button
                className={
                  cardFilter === "all"
                    ? "card-filter-active"
                    : ""
                }
                type="button"
                role="tab"
                aria-selected={
                  cardFilter === "all"
                }
                onClick={() =>
                  setCardFilter("all")
                }
              >
                All
                <span>{cards.length}</span>
              </button>
            </div>

            <div className="card-view-actions">
              <button
                className="small-view-button small-view-button-active"
                type="button"
              >
                Grid
              </button>

              <button
                className="small-view-button"
                type="button"
                disabled
              >
                List
              </button>
            </div>
          </div>
        </div>

        {visibleCards.length === 0 ? (
          <div className="empty-state collection-empty-state">
            <div className="empty-state-icon">
              {cardFilter === "sold"
                ? "✓"
                : "▱"}
            </div>

            <h3>
              {cardFilter === "sold"
                ? "No sold cards yet"
                : cardFilter === "active"
                  ? "No active cards"
                  : "There are no cards yet"}
            </h3>

            <p>
              {cardFilter === "sold"
                ? "Completed sales will appear here with their realized result."
                : cardFilter === "active" && cards.length > 0
                  ? "All cards in this collection have been sold. Open the Sold tab to see the history."
                  : "Add your first card manually, or scan it with the AI workflow."}
            </p>

            {cards.length === 0 && (
              <button
                className="primary-button"
                type="button"
                onClick={() =>
                  setShowAddCardChoice(
                    true
                  )
                }
              >
                ＋ Add first card
              </button>
            )}
          </div>
        ) : (
          <div className="cards-grid">
            {visibleCards.map((card) => {
              const stateMeta =
                getCardStateMeta(
                  card.state
                );

              const titleLine =
                joinDistinct([
                  card.year,
                  card.brand ??
                    card.manufacturer,
                  card.product,
                ]) ||
                "Product not specified";

              const detailLine =
                joinDistinct([
                  card.insert_name,
                  card.parallel_name,
                  card.card_number
                    ? `#${card.card_number}`
                    : null,
                ]) ||
                "Card details not specified";

              return (
                <Link
                  className="sports-card-link"
                  href={`/cards/${card.id}`}
                  key={card.id}
                  aria-label={`Open ${card.player_name}`}
                >
                  <article className="sports-card-item">
                    <div className="sports-card-image-frame">
                      {card.front_image_url ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            className="sports-card-image"
                            src={
                              card.front_image_url
                            }
                            alt={`${card.player_name} card front`}
                          />
                        </>
                      ) : (
                        <div className="sports-card-no-image">
                          <span>NE</span>

                          <small>
                            No image available
                          </small>
                        </div>
                      )}

                      <span
                        className={`card-state-badge card-state-${stateMeta.tone}`}
                      >
                        {stateMeta.label}
                      </span>

                      {card.ai_confidence !==
                        null && (
                        <span className="card-confidence-badge">
                          {Math.round(
                            card.ai_confidence
                          )}
                          % AI
                        </span>
                      )}
                    </div>

                    <div className="sports-card-content">
                      <p className="sports-card-set">
                        {titleLine}
                      </p>

                      <h3>
                        {card.player_name}
                      </h3>

                      {card.team && (
                        <p className="sports-card-team">
                          {card.team}
                        </p>
                      )}

                      <p className="sports-card-details">
                        {detailLine}
                      </p>

                      {card.serial_number && (
                        <span className="serial-badge">
                          {
                            card.serial_number
                          }
                        </span>
                      )}

                      {card.sale ? (
                        <>
                          <div className="sports-card-sale-meta">
                            <span>
                              Sold {formatShortDate(
                                card.sale.occurred_at
                              )}
                            </span>

                            {card.sale.platform && (
                              <strong>
                                {card.sale.platform}
                              </strong>
                            )}
                          </div>

                          <div className="sports-card-values sports-card-values-sold">
                            <div>
                              <span>
                                Net
                              </span>

                              <strong>
                                {formatCurrency(
                                  card.sale.net_amount,
                                  card.sale.currency
                                )}
                              </strong>
                            </div>

                            <div>
                              <span>
                                Profit
                              </span>

                              <strong
                                className={
                                  card.sale.realized_profit >= 0
                                    ? "card-profit-positive"
                                    : "card-profit-negative"
                                }
                              >
                                {formatCurrency(
                                  card.sale.realized_profit,
                                  card.sale.currency
                                )}
                              </strong>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="sports-card-values">
                          <div>
                            <span>
                              Cost
                            </span>

                            <strong>
                              {formatCurrency(
                                card.purchase_price,
                                collection.currency
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Value
                            </span>

                            <strong>
                              {formatCurrency(
                                card.estimated_value,
                                collection.currency
                              )}
                            </strong>
                          </div>
                        </div>
                      )}

                      <div className="sports-card-open-row">
                        <span>
                          Open card
                        </span>

                        <strong>
                          →
                        </strong>
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {showAddCardChoice && (
        <AddCardModal
          collections={[collection]}
          onClose={() =>
            setShowAddCardChoice(
              false
            )
          }
          onScanCard={
            handleScanCard
          }
          onManualCard={
            handleManualCard
          }
        />
      )}

      <ScanCardModal
        isOpen={showScanCard}
        collectionId={collectionId}
        onClose={() =>
          setShowScanCard(false)
        }
      />

      {showAddCard && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowAddCard(false);
            }
          }}
        >
          <section className="modal add-card-modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">
                  Manual entry
                </p>

                <h2>Add card</h2>
              </div>

              <button
                className="modal-close-button"
                type="button"
                onClick={() =>
                  setShowAddCard(
                    false
                  )
                }
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                handleAddCard
              }
            >
              <div className="form-grid">
                <div className="form-field form-field-full">
                  <label
                    className="field-label"
                    htmlFor="player-name"
                  >
                    Player name *
                  </label>

                  <input
                    className="text-input"
                    id="player-name"
                    type="text"
                    value={playerName}
                    onChange={(
                      event
                    ) =>
                      setPlayerName(
                        event.target
                          .value
                      )
                    }
                    placeholder="Example: Michael Jordan"
                    autoFocus
                  />
                </div>

                <div className="form-field">
                  <label
                    className="field-label"
                    htmlFor="card-year"
                  >
                    Year
                  </label>

                  <input
                    className="text-input"
                    id="card-year"
                    type="text"
                    value={year}
                    onChange={(
                      event
                    ) =>
                      setYear(
                        event.target
                          .value
                      )
                    }
                    placeholder="1997-98"
                  />
                </div>

                <div className="form-field">
                  <label
                    className="field-label"
                    htmlFor="manufacturer"
                  >
                    Manufacturer
                  </label>

                  <input
                    className="text-input"
                    id="manufacturer"
                    type="text"
                    value={
                      manufacturer
                    }
                    onChange={(
                      event
                    ) =>
                      setManufacturer(
                        event.target
                          .value
                      )
                    }
                    placeholder="Upper Deck"
                  />
                </div>

                <div className="form-field form-field-full">
                  <label
                    className="field-label"
                    htmlFor="set-name"
                  >
                    Set
                  </label>

                  <input
                    className="text-input"
                    id="set-name"
                    type="text"
                    value={setName}
                    onChange={(
                      event
                    ) =>
                      setSetName(
                        event.target
                          .value
                      )
                    }
                    placeholder="Example: UD3"
                  />
                </div>

                <div className="form-field">
                  <label
                    className="field-label"
                    htmlFor="card-number"
                  >
                    Card number
                  </label>

                  <input
                    className="text-input"
                    id="card-number"
                    type="text"
                    value={
                      cardNumber
                    }
                    onChange={(
                      event
                    ) =>
                      setCardNumber(
                        event.target
                          .value
                      )
                    }
                    placeholder="23"
                  />
                </div>

                <div className="form-field">
                  <label
                    className="field-label"
                    htmlFor="parallel-name"
                  >
                    Parallel
                  </label>

                  <input
                    className="text-input"
                    id="parallel-name"
                    type="text"
                    value={
                      parallelName
                    }
                    onChange={(
                      event
                    ) =>
                      setParallelName(
                        event.target
                          .value
                      )
                    }
                    placeholder="Silver Prizm"
                  />
                </div>

                <div className="form-field form-field-full">
                  <label
                    className="field-label"
                    htmlFor="serial-number"
                  >
                    Serial number
                  </label>

                  <input
                    className="text-input"
                    id="serial-number"
                    type="text"
                    value={
                      serialNumber
                    }
                    onChange={(
                      event
                    ) =>
                      setSerialNumber(
                        event.target
                          .value
                      )
                    }
                    placeholder="Example: 02/10"
                  />
                </div>

                <div className="form-field">
                  <label
                    className="field-label"
                    htmlFor="purchase-price"
                  >
                    Purchase price
                  </label>

                  <input
                    className="text-input"
                    id="purchase-price"
                    type="text"
                    inputMode="decimal"
                    value={
                      purchasePrice
                    }
                    onChange={(
                      event
                    ) =>
                      setPurchasePrice(
                        event.target
                          .value
                      )
                    }
                    placeholder="500"
                  />
                </div>

                <div className="form-field">
                  <label
                    className="field-label"
                    htmlFor="estimated-value"
                  >
                    Estimated value
                  </label>

                  <input
                    className="text-input"
                    id="estimated-value"
                    type="text"
                    inputMode="decimal"
                    value={
                      estimatedValue
                    }
                    onChange={(
                      event
                    ) =>
                      setEstimatedValue(
                        event.target
                          .value
                      )
                    }
                    placeholder="750"
                  />
                </div>

                <div className="form-field form-field-full">
                  <label
                    className="field-label"
                    htmlFor="card-notes"
                  >
                    Notes
                  </label>

                  <textarea
                    className="text-area"
                    id="card-notes"
                    value={notes}
                    onChange={(
                      event
                    ) =>
                      setNotes(
                        event.target
                          .value
                      )
                    }
                    placeholder="Condition, purchase source or other notes..."
                  />
                </div>
              </div>

              {message && (
                <p className="form-message">
                  {message}
                </p>
              )}

              <div className="modal-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() =>
                    setShowAddCard(
                      false
                    )
                  }
                >
                  Cancel
                </button>

                <button
                  className="primary-button"
                  type="submit"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : "Save card"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      <style jsx>{`
        .metric-value-positive {
          color: #86efac;
        }

        .metric-value-negative {
          color: #fca5a5;
        }

        .sales-performance-panel {
          margin-top: 22px;
          padding: 24px 26px;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.13
            );
          border-radius: 22px;
          background:
            radial-gradient(
              circle at top right,
              rgba(
                52,
                211,
                153,
                0.06
              ),
              transparent 38%
            ),
            #10131b;
        }

        .sales-performance-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 18px;
        }

        .sales-performance-heading h2 {
          margin: 6px 0 0;
          color: #ffffff;
          font-size: 21px;
          letter-spacing: -0.025em;
        }

        .sales-performance-heading > div > p:last-child {
          margin: 6px 0 0;
          color: #71798b;
          font-size: 12px;
          line-height: 1.5;
        }

        .view-sold-button {
          min-height: 38px;
          padding: 0 13px;
          border: 1px solid
            rgba(
              52,
              211,
              153,
              0.2
            );
          border-radius: 11px;
          background: rgba(
            16,
            185,
            129,
            0.06
          );
          color: #a7f3d0;
          font-size: 11px;
          font-weight: 750;
          cursor: pointer;
        }

        .view-sold-button:hover:not(:disabled) {
          border-color: rgba(
            52,
            211,
            153,
            0.42
          );
          background: rgba(
            16,
            185,
            129,
            0.1
          );
        }

        .view-sold-button:disabled {
          cursor: not-allowed;
          opacity: 0.4;
        }

        .sales-summary-grid {
          display: grid;
          grid-template-columns:
            repeat(
              5,
              minmax(0, 1fr)
            );
          gap: 10px;
        }

        .sales-metric-card {
          min-width: 0;
          padding: 16px;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.11
            );
          border-radius: 15px;
          background: rgba(
            0,
            0,
            0,
            0.14
          );
        }

        .sales-metric-card > span {
          display: block;
          color: #71798b;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .sales-metric-card > strong {
          display: block;
          margin-top: 8px;
          color: #ffffff;
          font-size: 18px;
          letter-spacing: -0.02em;
          overflow-wrap: anywhere;
        }

        .sales-metric-card > small {
          display: block;
          margin-top: 6px;
          color: #5f687b;
          font-size: 9px;
          line-height: 1.4;
        }

        .sales-metric-positive > strong {
          color: #86efac;
        }

        .sales-metric-negative > strong {
          color: #fca5a5;
        }

        .cards-panel-header {
          align-items: flex-start;
        }

        .cards-panel-controls {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          flex-wrap: wrap;
          gap: 12px;
        }

        .card-filter-tabs {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.12
            );
          border-radius: 12px;
          background: rgba(
            0,
            0,
            0,
            0.13
          );
        }

        .card-filter-tabs button {
          min-height: 34px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 0 10px;
          border: 0;
          border-radius: 9px;
          background: transparent;
          color: #71798b;
          font-size: 10px;
          font-weight: 750;
          cursor: pointer;
        }

        .card-filter-tabs button:hover {
          color: #ffffff;
        }

        .card-filter-tabs button span {
          min-width: 20px;
          padding: 3px 5px;
          border-radius: 999px;
          background: rgba(
            255,
            255,
            255,
            0.05
          );
          color: #8b93a5;
          font-size: 8px;
          text-align: center;
        }

        .card-filter-tabs .card-filter-active {
          background: rgba(
            124,
            92,
            255,
            0.12
          );
          color: #ffffff;
          box-shadow: 0 0 0 1px
            rgba(
              139,
              92,
              246,
              0.13
            );
        }

        .card-filter-tabs .card-filter-active span {
          background: rgba(
            139,
            92,
            246,
            0.18
          );
          color: #c4b5fd;
        }

        .sports-card-sale-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin: 13px 0 0;
          padding: 8px 9px;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.1
            );
          border-radius: 10px;
          background: rgba(
            255,
            255,
            255,
            0.02
          );
          color: #71798b;
          font-size: 9px;
        }

        .sports-card-sale-meta strong {
          color: #a5adbd;
          font-size: 9px;
          font-weight: 750;
        }

        .sports-card-values-sold {
          margin-top: 10px;
        }

        .card-profit-positive {
          color: #86efac !important;
        }

        .card-profit-negative {
          color: #fca5a5 !important;
        }

        .sports-card-link {
          min-width: 0;
          height: 100%;
          display: block;
          border-radius: 20px;
          color: inherit;
          text-decoration: none;
          outline: none;
        }

        .sports-card-link .sports-card-item {
          height: 100%;
          transition:
            transform 170ms ease,
            border-color 170ms ease,
            box-shadow 170ms ease;
        }

        .sports-card-link:hover .sports-card-item {
          transform: translateY(
            -4px
          );
          border-color: rgba(
            139,
            92,
            246,
            0.38
          );
          box-shadow:
            0 20px 44px
              rgba(
                0,
                0,
                0,
                0.28
              ),
            0 0 0 1px
              rgba(
                139,
                92,
                246,
                0.05
              );
        }

        .sports-card-link:focus-visible {
          box-shadow: 0 0 0 3px
            rgba(
              139,
              92,
              246,
              0.5
            );
        }

        .sports-card-image-frame {
          position: relative;
          aspect-ratio: 2.5 / 3.5;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            radial-gradient(
              circle at 78% 12%,
              rgba(
                120,
                103,
                255,
                0.2
              ),
              transparent 36%
            ),
            #090c12;
        }

        .sports-card-image {
          width: 100%;
          height: 100%;
          display: block;
          padding: 11px;
          object-fit: contain;
          transition:
            transform 220ms ease;
        }

        .sports-card-link:hover
          .sports-card-image {
          transform: scale(1.025);
        }

        .sports-card-no-image {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 9px;
        }

        .sports-card-no-image span {
          width: 52px;
          height: 52px;
          display: grid;
          place-items: center;
          border: 1px solid
            rgba(
              149,
              137,
              255,
              0.28
            );
          border-radius: 15px;
          background: rgba(
            120,
            103,
            255,
            0.14
          );
          color: #9589ff;
          font-size: 16px;
          font-weight: 800;
        }

        .sports-card-no-image small {
          color: #5d6678;
          font-size: 9px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .card-state-badge,
        .card-confidence-badge {
          position: absolute;
          top: 10px;
          z-index: 3;
          padding: 6px 9px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.06em;
          backdrop-filter: blur(
            10px
          );
        }

        .card-state-badge {
          left: 10px;
        }

        .card-confidence-badge {
          right: 10px;
          border: 1px solid
            rgba(
              167,
              139,
              250,
              0.26
            );
          background: rgba(
            12,
            10,
            26,
            0.8
          );
          color: #c4b5fd;
        }

        .card-state-verified {
          border: 1px solid
            rgba(
              52,
              211,
              153,
              0.28
            );
          background: rgba(
            6,
            54,
            42,
            0.78
          );
          color: #a7f3d0;
        }

        .card-state-review {
          border: 1px solid
            rgba(
              251,
              191,
              36,
              0.3
            );
          background: rgba(
            64,
            45,
            9,
            0.82
          );
          color: #fde68a;
        }

        .card-state-grading {
          border: 1px solid
            rgba(
              96,
              165,
              250,
              0.28
            );
          background: rgba(
            14,
            36,
            65,
            0.82
          );
          color: #bfdbfe;
        }

        .card-state-listed {
          border: 1px solid
            rgba(
              196,
              181,
              253,
              0.3
            );
          background: rgba(
            42,
            30,
            71,
            0.82
          );
          color: #ddd6fe;
        }

        .card-state-sold {
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.24
            );
          background: rgba(
            30,
            36,
            47,
            0.84
          );
          color: #cbd5e1;
        }

        .card-state-neutral {
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.2
            );
          background: rgba(
            15,
            19,
            27,
            0.82
          );
          color: #a5adbd;
        }

        .sports-card-team {
          margin: -1px 0 8px;
          color: #6f7890;
          font-size: 10px;
        }

        .sports-card-open-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 15px;
          padding-top: 13px;
          border-top: 1px solid
            rgba(
              148,
              163,
              184,
              0.1
            );
          color: #777f91;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.03em;
        }

        .sports-card-open-row strong {
          color: #9f93ff;
          font-size: 14px;
          transition:
            transform 170ms ease;
        }

        .sports-card-link:hover
          .sports-card-open-row {
          color: #c7ccd6;
        }

        .sports-card-link:hover
          .sports-card-open-row
          strong {
          transform: translateX(
            3px
          );
        }

        @media (
          max-width: 1150px
        ) {
          .sales-summary-grid {
            grid-template-columns:
              repeat(
                3,
                minmax(0, 1fr)
              );
          }
        }

        @media (
          max-width: 760px
        ) {
          .sales-performance-heading,
          .cards-panel-header {
            align-items: stretch;
            flex-direction: column;
          }

          .cards-panel-controls {
            justify-content: space-between;
          }

          .sales-summary-grid {
            grid-template-columns:
              repeat(
                2,
                minmax(0, 1fr)
              );
          }
        }

        @media (
          max-width: 520px
        ) {
          .sales-performance-panel {
            padding: 19px;
          }

          .sales-summary-grid {
            grid-template-columns: 1fr;
          }

          .cards-panel-controls {
            align-items: stretch;
            flex-direction: column;
          }

          .card-filter-tabs {
            width: 100%;
          }

          .card-filter-tabs button {
            flex: 1;
            justify-content: center;
          }

          .sports-card-image {
            padding: 8px;
          }

          .card-state-badge,
          .card-confidence-badge {
            top: 8px;
            padding: 5px 7px;
            font-size: 8px;
          }

          .card-state-badge {
            left: 8px;
          }

          .card-confidence-badge {
            right: 8px;
          }
        }
      `}</style>
    </main>
  );
}