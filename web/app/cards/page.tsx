"use client";

import Link from "next/link";
import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import AddCardModal from "@/components/AddCardModal";
import { createClient } from "@/lib/supabase/client";

const CARD_IMAGE_BUCKET = "card-images";
const SIGNED_URL_SECONDS = 60 * 60;

type NumericDatabaseValue = number | string | null;
type CollectionType = "pc" | "inventory";
type ViewMode = "grid" | "list";
type LibraryStatus = "all" | "active" | "sold" | "grading";
type ConditionFilter = "all" | "raw" | "graded";
type ValuationSource = "market" | "manual" | "none";
type SortKey =
  | "newest"
  | "oldest"
  | "value-desc"
  | "cost-desc"
  | "profit-desc"
  | "player-asc";

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
  market_value_low: NumericDatabaseValue;
  market_value_high: NumericDatabaseValue;
  market_value_currency: string | null;
  market_value_confidence: NumericDatabaseValue;
  market_value_updated_at: string | null;
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

type SaleTransactionRow = {
  id: string;
  card_id: string;
  occurred_at: string;
  currency: string;
  item_amount: NumericDatabaseValue;
  net_amount: NumericDatabaseValue;
  cost_basis: NumericDatabaseValue;
  realized_profit: NumericDatabaseValue;
  platform: string | null;
};

type SaleTransaction = {
  id: string;
  occurred_at: string;
  currency: string;
  item_amount: number;
  net_amount: number;
  cost_basis: number;
  realized_profit: number;
  platform: string | null;
};

type LibraryCard = CardRow & {
  collection: CollectionRow | null;
  front_image_url: string | null;
  sport: string | null;
  team: string | null;
  brand: string | null;
  product: string | null;
  insert_name: string | null;
  grading_company: string | null;
  grade: string | null;
  rookie_card: boolean | null;
  autograph: boolean | null;
  memorabilia: boolean | null;
  purchase_value: number;
  valuation_value: number | null;
  valuation_source: ValuationSource;
  market_confidence: number | null;
  sale: SaleTransaction | null;
  profit_value: number | null;
  status_group: Exclude<LibraryStatus, "all">;
  condition_group: Exclude<ConditionFilter, "all">;
  activity_at: string;
};

type NavigationItem = {
  label: string;
  icon: string;
  href?: string;
  active?: boolean;
  comingSoon?: boolean;
};

const navigation: NavigationItem[] = [
  { label: "Home", icon: "⌂", href: "/" },
  { label: "Collections", icon: "◇", href: "/#collections" },
  { label: "Cards", icon: "▱", active: true },
  { label: "Scanner", icon: "◎", href: "/scanner" },
  { label: "Grading", icon: "◈", comingSoon: true },
  { label: "Transactions", icon: "↕", href: "/transactions" },
  { label: "Analytics", icon: "⌁", href: "/analytics" },
];

const ATTRIBUTE_KEYS = [
  "sport",
  "team",
  "brand",
  "product",
  "set_name",
  "grading_company",
  "grade",
  "rookie_card",
  "autograph",
  "memorabilia",
] as const;

function toNumber(value: NumericDatabaseValue) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function toOptionalNumber(value: NumericDatabaseValue) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
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

function getBooleanAttribute(
  attributes: CardAttributeRow[],
  key: string
) {
  const value = getAttributeValue(attributes, key);

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value.toLowerCase() === "true") {
      return true;
    }

    if (value.toLowerCase() === "false") {
      return false;
    }
  }

  return null;
}

function normalizeSale(
  row: SaleTransactionRow
): SaleTransaction {
  return {
    id: row.id,
    occurred_at: row.occurred_at,
    currency: row.currency,
    item_amount: toNumber(row.item_amount),
    net_amount: toNumber(row.net_amount),
    cost_basis: toNumber(row.cost_basis),
    realized_profit: toNumber(row.realized_profit),
    platform: row.platform,
  };
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

function getStatusGroup(
  card: CardRow
): Exclude<LibraryStatus, "all"> {
  if (card.state === "sold") {
    return "sold";
  }

  if (card.state === "submitted") {
    return "grading";
  }

  return "active";
}

function getStateLabel(card: LibraryCard) {
  if (card.status_group === "sold") {
    return "Sold";
  }

  if (card.status_group === "grading") {
    return "At grading";
  }

  if (card.state === "verified") {
    return "Verified";
  }

  if (card.state === "needs_review" || card.state === "draft") {
    return "Needs review";
  }

  if (card.state === "listed") {
    return "For sale";
  }

  if (card.state === "graded") {
    return "Graded";
  }

  return "Active";
}

function getStateTone(card: LibraryCard) {
  if (card.status_group === "sold") {
    return "sold";
  }

  if (card.status_group === "grading") {
    return "grading";
  }

  if (card.state === "verified") {
    return "verified";
  }

  if (card.state === "needs_review" || card.state === "draft") {
    return "review";
  }

  if (card.state === "listed") {
    return "listed";
  }

  return "neutral";
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

function getValuationTone(source: ValuationSource) {
  switch (source) {
    case "market":
      return "market";
    case "manual":
      return "manual";
    default:
      return "none";
  }
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

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
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

function uniqueSorted(values: Array<string | null>) {
  return Array.from(
    new Set(
      values
        .filter(
          (value): value is string =>
            typeof value === "string" && Boolean(value.trim())
        )
        .map((value) => value.trim())
    )
  ).sort((first, second) =>
    first.localeCompare(second, "da", {
      sensitivity: "base",
    })
  );
}

export default function GlobalCardsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [cards, setCards] = useState<LibraryCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showAddCard, setShowAddCard] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<LibraryStatus>("all");
  const [collectionFilter, setCollectionFilter] =
    useState("all");
  const [collectionTypeFilter, setCollectionTypeFilter] =
    useState<"all" | CollectionType>("all");
  const [conditionFilter, setConditionFilter] =
    useState<ConditionFilter>("all");
  const [sportFilter, setSportFilter] = useState("all");
  const [manufacturerFilter, setManufacturerFilter] =
    useState("all");
  const [valuationFilter, setValuationFilter] =
    useState<"all" | ValuationSource>("all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const loadCards = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setLoading(false);
      router.push("/login");
      return;
    }

    const [collectionResult, cardResult] = await Promise.all([
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
          market_value_low,
          market_value_high,
          market_value_currency,
          market_value_confidence,
          market_value_updated_at,
          state,
          created_at
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);

    if (collectionResult.error) {
      setMessage(
        `Collections kunne ikke indlæses: ${collectionResult.error.message}`
      );
      setCollections([]);
      setCards([]);
      setLoading(false);
      return;
    }

    if (cardResult.error) {
      setMessage(
        `Kortbiblioteket kunne ikke indlæses: ${cardResult.error.message}`
      );
      setCollections(
        (collectionResult.data ?? []) as CollectionRow[]
      );
      setCards([]);
      setLoading(false);
      return;
    }

    const nextCollections =
      (collectionResult.data ?? []) as CollectionRow[];
    const rawCards = (cardResult.data ?? []) as CardRow[];

    setCollections(nextCollections);

    if (rawCards.length === 0) {
      setCards([]);
      setLoading(false);
      return;
    }

    const cardIds = rawCards.map((card) => card.id);

    const [imageResult, attributeResult, saleResult] =
      await Promise.all([
        supabase
          .from("card_images")
          .select(`
            card_id,
            storage_path
          `)
          .eq("user_id", user.id)
          .eq("image_type", "front")
          .in("card_id", cardIds),

        supabase
          .from("card_attributes")
          .select(`
            card_id,
            attribute_key,
            attribute_value
          `)
          .eq("user_id", user.id)
          .in("card_id", cardIds)
          .in("attribute_key", [...ATTRIBUTE_KEYS]),

        supabase
          .from("card_transactions")
          .select(`
            id,
            card_id,
            occurred_at,
            currency,
            item_amount,
            net_amount,
            cost_basis,
            realized_profit,
            platform
          `)
          .eq("user_id", user.id)
          .eq("transaction_type", "sale")
          .eq("status", "completed")
          .in("card_id", cardIds)
          .order("occurred_at", { ascending: false }),
      ]);

    const warnings: string[] = [];

    if (imageResult.error) {
      console.error("Card images could not be loaded:", imageResult.error);
      warnings.push("Nogle kortbilleder kunne ikke indlæses.");
    }

    if (attributeResult.error) {
      console.error("Card DNA could not be loaded:", attributeResult.error);
      warnings.push("Nogle Card DNA-oplysninger kunne ikke indlæses.");
    }

    if (saleResult.error) {
      console.error("Sales could not be loaded:", saleResult.error);
      warnings.push("Nogle salgsoplysninger kunne ikke indlæses.");
    }

    const collectionById = new Map(
      nextCollections.map((collection) => [collection.id, collection])
    );

    const attributesByCardId = new Map<
      string,
      CardAttributeRow[]
    >();

    for (const attribute of
      (attributeResult.data ?? []) as CardAttributeRow[]) {
      const current = attributesByCardId.get(attribute.card_id) ?? [];
      current.push(attribute);
      attributesByCardId.set(attribute.card_id, current);
    }

    const saleByCardId = new Map<string, SaleTransaction>();

    for (const saleRow of
      (saleResult.data ?? []) as SaleTransactionRow[]) {
      if (!saleByCardId.has(saleRow.card_id)) {
        saleByCardId.set(saleRow.card_id, normalizeSale(saleRow));
      }
    }

    const imageRows =
      (imageResult.data ?? []) as CardImageRow[];
    const imageUrlByCardId = new Map<string, string>();

    await Promise.all(
      imageRows.map(async (image) => {
        const { data, error } = await supabase.storage
          .from(CARD_IMAGE_BUCKET)
          .createSignedUrl(image.storage_path, SIGNED_URL_SECONDS);

        if (error || !data?.signedUrl) {
          console.error("Signed card URL could not be created:", {
            path: image.storage_path,
            error,
          });
          return;
        }

        imageUrlByCardId.set(image.card_id, data.signedUrl);
      })
    );

    const nextCards = rawCards.map<LibraryCard>((card) => {
      const collection =
        collectionById.get(card.current_collection_id) ?? null;
      const collectionCurrency = collection?.currency ?? "DKK";
      const cardAttributes = attributesByCardId.get(card.id) ?? [];
      const valuation = getValuation(card, collectionCurrency);
      const purchaseValue = toNumber(card.purchase_price);
      const sale = saleByCardId.get(card.id) ?? null;
      const gradingCompany = getStringAttribute(
        cardAttributes,
        "grading_company"
      );
      const grade = getStringAttribute(cardAttributes, "grade");
      const statusGroup = getStatusGroup(card);
      const conditionGroup =
        gradingCompany || grade ? "graded" : "raw";
      const profitValue =
        statusGroup === "sold"
          ? sale?.realized_profit ?? null
          : valuation.value === null
            ? null
            : valuation.value - purchaseValue;

      return {
        ...card,
        collection,
        front_image_url: imageUrlByCardId.get(card.id) ?? null,
        sport: getStringAttribute(cardAttributes, "sport"),
        team: getStringAttribute(cardAttributes, "team"),
        brand: getStringAttribute(cardAttributes, "brand"),
        product: getStringAttribute(cardAttributes, "product"),
        insert_name:
          getStringAttribute(cardAttributes, "set_name") ??
          card.set_name,
        grading_company: gradingCompany,
        grade,
        rookie_card: getBooleanAttribute(
          cardAttributes,
          "rookie_card"
        ),
        autograph: getBooleanAttribute(cardAttributes, "autograph"),
        memorabilia: getBooleanAttribute(
          cardAttributes,
          "memorabilia"
        ),
        purchase_value: purchaseValue,
        valuation_value: valuation.value,
        valuation_source: valuation.source,
        market_confidence: toOptionalNumber(
          card.market_value_confidence
        ),
        sale,
        profit_value: profitValue,
        status_group: statusGroup,
        condition_group: conditionGroup,
        activity_at:
          sale?.occurred_at ??
          card.market_value_updated_at ??
          card.created_at,
      };
    });

    setCards(nextCards);

    if (warnings.length > 0) {
      setMessage(Array.from(new Set(warnings)).join(" "));
    }

    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  const sports = useMemo(
    () => uniqueSorted(cards.map((card) => card.sport)),
    [cards]
  );

  const manufacturers = useMemo(
    () => uniqueSorted(cards.map((card) => card.manufacturer)),
    [cards]
  );

  const filteredCards = useMemo(() => {
    const normalizedSearch = normalizeSearch(searchTerm);

    const matchingCards = cards.filter((card) => {
      if (
        statusFilter !== "all" &&
        card.status_group !== statusFilter
      ) {
        return false;
      }

      if (
        collectionFilter !== "all" &&
        card.current_collection_id !== collectionFilter
      ) {
        return false;
      }

      if (
        collectionTypeFilter !== "all" &&
        card.collection?.type !== collectionTypeFilter
      ) {
        return false;
      }

      if (
        conditionFilter !== "all" &&
        card.condition_group !== conditionFilter
      ) {
        return false;
      }

      if (
        sportFilter !== "all" &&
        card.sport !== sportFilter
      ) {
        return false;
      }

      if (
        manufacturerFilter !== "all" &&
        card.manufacturer !== manufacturerFilter
      ) {
        return false;
      }

      if (
        valuationFilter !== "all" &&
        card.valuation_source !== valuationFilter
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchableValue = normalizeSearch(
        [
          card.player_name,
          card.team,
          card.sport,
          card.year,
          card.manufacturer,
          card.brand,
          card.product,
          card.insert_name,
          card.card_number,
          card.parallel_name,
          card.serial_number,
          card.grading_company,
          card.grade,
          card.collection?.name,
        ]
          .filter(Boolean)
          .join(" ")
      );

      return searchableValue.includes(normalizedSearch);
    });

    return [...matchingCards].sort((first, second) => {
      switch (sortKey) {
        case "oldest":
          return (
            new Date(first.activity_at).getTime() -
            new Date(second.activity_at).getTime()
          );

        case "value-desc":
          return (
            (second.valuation_value ?? -1) -
            (first.valuation_value ?? -1)
          );

        case "cost-desc":
          return second.purchase_value - first.purchase_value;

        case "profit-desc":
          return (
            (second.profit_value ?? Number.NEGATIVE_INFINITY) -
            (first.profit_value ?? Number.NEGATIVE_INFINITY)
          );

        case "player-asc":
          return first.player_name.localeCompare(
            second.player_name,
            "da",
            { sensitivity: "base" }
          );

        case "newest":
        default:
          return (
            new Date(second.activity_at).getTime() -
            new Date(first.activity_at).getTime()
          );
      }
    });
  }, [
    cards,
    collectionFilter,
    collectionTypeFilter,
    conditionFilter,
    manufacturerFilter,
    searchTerm,
    sortKey,
    sportFilter,
    statusFilter,
    valuationFilter,
  ]);

  const libraryMetrics = useMemo(() => {
    const activeCards = filteredCards.filter(
      (card) => card.status_group !== "sold"
    );
    const soldCards = filteredCards.filter(
      (card) => card.status_group === "sold"
    );
    const portfolioValue = activeCards.reduce(
      (total, card) => total + (card.valuation_value ?? 0),
      0
    );
    const activeCost = activeCards.reduce(
      (total, card) => total + card.purchase_value,
      0
    );
    const realizedProfit = soldCards.reduce(
      (total, card) => total + (card.sale?.realized_profit ?? 0),
      0
    );
    const marketValuedCards = activeCards.filter(
      (card) => card.valuation_source === "market"
    ).length;
    const marketCoverage =
      activeCards.length > 0
        ? (marketValuedCards / activeCards.length) * 100
        : 0;

    return {
      visibleCards: filteredCards.length,
      activeCards: activeCards.length,
      soldCards: soldCards.length,
      portfolioValue,
      activeCost,
      unrealizedResult: portfolioValue - activeCost,
      realizedProfit,
      marketCoverage,
    };
  }, [filteredCards]);

  const hasActiveFilters =
    Boolean(searchTerm.trim()) ||
    statusFilter !== "all" ||
    collectionFilter !== "all" ||
    collectionTypeFilter !== "all" ||
    conditionFilter !== "all" ||
    sportFilter !== "all" ||
    manufacturerFilter !== "all" ||
    valuationFilter !== "all";

  function clearFilters() {
    setSearchTerm("");
    setStatusFilter("all");
    setCollectionFilter("all");
    setCollectionTypeFilter("all");
    setConditionFilter("all");
    setSportFilter("all");
    setManufacturerFilter("all");
    setValuationFilter("all");
    setSortKey("newest");
  }

  function handleScanCard() {
    setShowAddCard(false);
    router.push("/scanner");
  }

  function handleManualCard(collectionId: string) {
    setShowAddCard(false);
    router.push(`/collections/${collectionId}`);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="cards-app-shell">
      <aside className="cards-sidebar">
        <div>
          <Link className="brand" href="/">
            <div className="brand-mark">N</div>

            <div>
              <p className="brand-name">NECardPilot</p>
              <p className="brand-subtitle">Collectibles OS</p>
            </div>
          </Link>

          <nav className="navigation">
            <p className="navigation-label">Workspace</p>

            {navigation.map((item) => {
              if (item.href) {
                return (
                  <Link
                    className={`navigation-item ${
                      item.active ? "navigation-item-active" : ""
                    }`}
                    href={item.href}
                    key={item.label}
                  >
                    <span className="navigation-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              }

              return (
                <button
                  className={`navigation-item ${
                    item.active ? "navigation-item-active" : ""
                  }`}
                  key={item.label}
                  type="button"
                  disabled={item.comingSoon || item.active}
                >
                  <span className="navigation-icon">{item.icon}</span>
                  <span>{item.label}</span>

                  {item.comingSoon && (
                    <span className="coming-soon">Soon</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-footer">
          <button className="settings-button" type="button" disabled>
            <span className="navigation-icon">⚙</span>
            Settings
            <span className="coming-soon">Soon</span>
          </button>

          <div className="user-card">
            <div className="user-avatar">NE</div>

            <div className="user-information">
              <p>Nicky Eckhardt</p>
              <span>Owner</span>
            </div>

            <button
              className="logout-button"
              type="button"
              onClick={handleLogout}
              title="Log ud"
            >
              ↗
            </button>
          </div>
        </div>
      </aside>

      <main className="cards-main-content">
        <header className="cards-page-header">
          <div>
            <p className="eyebrow">Global library</p>
            <h1>Cards</h1>
            <p>
              Søg, filtrér og sammenlign alle kort på tværs af dine
              collections.
            </p>
          </div>

          <div className="header-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => void loadCards()}
              disabled={loading}
            >
              ↻ Refresh
            </button>

            <button
              className="primary-button"
              type="button"
              onClick={() => setShowAddCard(true)}
            >
              ＋ Add card
            </button>
          </div>
        </header>

        <section className="library-metrics">
          <MetricCard
            label="Matching cards"
            value={String(libraryMetrics.visibleCards)}
            caption={`${libraryMetrics.activeCards} active · ${libraryMetrics.soldCards} sold`}
          />

          <MetricCard
            label="Portfolio value"
            value={formatCurrency(libraryMetrics.portfolioValue)}
            caption={`${Math.round(
              libraryMetrics.marketCoverage
            )}% market coverage`}
            featured
          />

          <MetricCard
            label="Unrealized result"
            value={formatCurrency(libraryMetrics.unrealizedResult)}
            caption={`Cost basis ${formatCurrency(
              libraryMetrics.activeCost
            )}`}
            tone={
              libraryMetrics.unrealizedResult >= 0
                ? "positive"
                : "negative"
            }
          />

          <MetricCard
            label="Realized profit"
            value={formatCurrency(libraryMetrics.realizedProfit)}
            caption="From matching sold cards"
            tone={
              libraryMetrics.realizedProfit >= 0
                ? "positive"
                : "negative"
            }
          />
        </section>

        {message && (
          <div className="library-message" role="status">
            {message}
          </div>
        )}

        <section className="library-panel">
          <div className="search-row">
            <label className="search-field">
              <span>⌕</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setSearchTerm(event.target.value)
                }
                placeholder="Search player, product, card number, parallel, serial or collection..."
              />
            </label>

            <div className="view-toggle" aria-label="View mode">
              <button
                className={viewMode === "grid" ? "view-active" : ""}
                type="button"
                onClick={() => setViewMode("grid")}
              >
                Grid
              </button>

              <button
                className={viewMode === "list" ? "view-active" : ""}
                type="button"
                onClick={() => setViewMode("list")}
              >
                List
              </button>
            </div>
          </div>

          <div className="filter-grid">
            <FilterSelect
              label="Status"
              value={statusFilter}
              onChange={(value) =>
                setStatusFilter(value as LibraryStatus)
              }
              options={[
                ["all", "All statuses"],
                ["active", "Active"],
                ["sold", "Sold"],
                ["grading", "At grading"],
              ]}
            />

            <FilterSelect
              label="Collection"
              value={collectionFilter}
              onChange={setCollectionFilter}
              options={[
                ["all", "All collections"],
                ...collections.map(
                  (collection) =>
                    [collection.id, collection.name] as [string, string]
                ),
              ]}
            />

            <FilterSelect
              label="Collection type"
              value={collectionTypeFilter}
              onChange={(value) =>
                setCollectionTypeFilter(
                  value as "all" | CollectionType
                )
              }
              options={[
                ["all", "PC + Inventory"],
                ["pc", "Personal Collection"],
                ["inventory", "Dealer Inventory"],
              ]}
            />

            <FilterSelect
              label="Condition"
              value={conditionFilter}
              onChange={(value) =>
                setConditionFilter(value as ConditionFilter)
              }
              options={[
                ["all", "RAW + Graded"],
                ["raw", "RAW"],
                ["graded", "Graded"],
              ]}
            />

            <FilterSelect
              label="Sport"
              value={sportFilter}
              onChange={setSportFilter}
              options={[
                ["all", "All sports"],
                ...sports.map(
                  (sport) => [sport, sport] as [string, string]
                ),
              ]}
            />

            <FilterSelect
              label="Manufacturer"
              value={manufacturerFilter}
              onChange={setManufacturerFilter}
              options={[
                ["all", "All manufacturers"],
                ...manufacturers.map(
                  (manufacturer) =>
                    [manufacturer, manufacturer] as [string, string]
                ),
              ]}
            />

            <FilterSelect
              label="Value source"
              value={valuationFilter}
              onChange={(value) =>
                setValuationFilter(
                  value as "all" | ValuationSource
                )
              }
              options={[
                ["all", "All value sources"],
                ["market", "Market estimate"],
                ["manual", "Your estimate"],
                ["none", "No valuation"],
              ]}
            />

            <FilterSelect
              label="Sort by"
              value={sortKey}
              onChange={(value) => setSortKey(value as SortKey)}
              options={[
                ["newest", "Latest activity"],
                ["oldest", "Oldest activity"],
                ["value-desc", "Highest value"],
                ["cost-desc", "Highest cost"],
                ["profit-desc", "Highest profit"],
                ["player-asc", "Player A–Z"],
              ]}
            />
          </div>

          <div className="results-toolbar">
            <p>
              Showing <strong>{filteredCards.length}</strong> of {cards.length}
              {cards.length >= 1000 ? " (first 1,000 loaded)" : ""}
            </p>

            {hasActiveFilters && (
              <button type="button" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>

          {loading ? (
            <div className="library-loading">
              <span className="loading-spinner" />
              <p>Loading your card library...</p>
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="library-empty">
              <span>▱</span>
              <h2>No matching cards</h2>
              <p>
                Adjust the filters, search for another term or add a new card.
              </p>

              <div>
                {hasActiveFilters && (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </button>
                )}

                <button
                  className="primary-button"
                  type="button"
                  onClick={() => setShowAddCard(true)}
                >
                  Add card
                </button>
              </div>
            </div>
          ) : viewMode === "grid" ? (
            <div className="global-card-grid">
              {filteredCards.map((card) => (
                <LibraryGridCard card={card} key={card.id} />
              ))}
            </div>
          ) : (
            <div className="global-card-list">
              <div className="list-header">
                <span>Card</span>
                <span>Collection</span>
                <span>Status</span>
                <span>Cost</span>
                <span>Value / proceeds</span>
                <span>Result</span>
              </div>

              {filteredCards.map((card) => (
                <LibraryListRow card={card} key={card.id} />
              ))}
            </div>
          )}
        </section>
      </main>

      {showAddCard && (
        <AddCardModal
          collections={collections}
          onClose={() => setShowAddCard(false)}
          onScanCard={handleScanCard}
          onManualCard={handleManualCard}
        />
      )}

      <style jsx>{`
        .cards-app-shell {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 312px minmax(0, 1fr);
          background:
            radial-gradient(
              circle at 78% 0%,
              rgba(124, 92, 255, 0.08),
              transparent 33%
            ),
            #080a10;
          color: #f8fafc;
        }

        .cards-sidebar {
          position: sticky;
          top: 0;
          height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 31px 21px 22px;
          border-right: 1px solid rgba(148, 163, 184, 0.1);
          background: rgba(9, 11, 17, 0.97);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 0 12px;
          color: inherit;
          text-decoration: none;
        }

        .brand-mark {
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          border-radius: 15px;
          background: linear-gradient(145deg, #9b82ff, #6552e8);
          color: #ffffff;
          font-size: 20px;
          font-weight: 900;
          box-shadow: 0 14px 35px rgba(124, 92, 255, 0.3);
        }

        .brand-name,
        .brand-subtitle,
        .navigation-label,
        .user-information p,
        .user-information span {
          margin: 0;
        }

        .brand-name {
          color: #ffffff;
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -0.025em;
        }

        .brand-subtitle {
          margin-top: 4px;
          color: #6e7689;
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .navigation {
          display: grid;
          gap: 6px;
          margin-top: 38px;
        }

        .navigation-label {
          padding: 0 14px 10px;
          color: #626a7b;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .navigation-item,
        .settings-button {
          width: 100%;
          min-height: 52px;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 0 15px;
          border: 0;
          border-radius: 13px;
          background: transparent;
          color: #8b93a5;
          font: inherit;
          font-size: 14px;
          text-align: left;
          text-decoration: none;
          cursor: pointer;
        }

        .navigation-item:hover:not(:disabled),
        .settings-button:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.035);
          color: #ffffff;
        }

        .navigation-item-active {
          background: rgba(124, 92, 255, 0.15) !important;
          color: #ddd6fe !important;
        }

        .navigation-item:disabled,
        .settings-button:disabled {
          cursor: default;
        }

        .navigation-icon {
          width: 24px;
          display: inline-flex;
          justify-content: center;
          color: #a1a9ba;
          font-size: 16px;
        }

        .navigation-item-active .navigation-icon {
          color: #c4b5fd;
        }

        .coming-soon {
          margin-left: auto;
          padding: 4px 7px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 7px;
          color: #596173;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .sidebar-footer {
          display: grid;
          gap: 14px;
        }

        .settings-button {
          position: relative;
        }

        .user-card {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 13px;
          border: 1px solid rgba(148, 163, 184, 0.13);
          border-radius: 15px;
          background: rgba(255, 255, 255, 0.025);
        }

        .user-avatar {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 13px;
          background: #171c29;
          color: #c7cddd;
          font-size: 11px;
          font-weight: 800;
        }

        .user-information {
          min-width: 0;
          flex: 1;
        }

        .user-information p {
          overflow: hidden;
          color: #ffffff;
          font-size: 12px;
          font-weight: 750;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .user-information span {
          display: block;
          margin-top: 5px;
          color: #687083;
          font-size: 10px;
        }

        .logout-button {
          width: 30px;
          height: 30px;
          flex: 0 0 auto;
          border: 0;
          background: transparent;
          color: #737b8d;
          cursor: pointer;
        }

        .logout-button:hover {
          color: #ffffff;
        }

        .cards-main-content {
          min-width: 0;
          padding: 48px clamp(28px, 4.5vw, 70px) 70px;
        }

        .cards-page-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 28px;
          margin-bottom: 28px;
        }

        .eyebrow {
          margin: 0;
          color: #9f93ff;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .cards-page-header h1 {
          margin: 12px 0 0;
          color: #ffffff;
          font-size: clamp(44px, 6vw, 72px);
          line-height: 0.95;
          letter-spacing: -0.055em;
        }

        .cards-page-header p:not(.eyebrow) {
          max-width: 650px;
          margin: 13px 0 0;
          color: #8891a4;
          font-size: 14px;
          line-height: 1.55;
        }

        .header-actions {
          flex: 0 0 auto;
          display: flex;
          gap: 11px;
        }

        .primary-button,
        .secondary-button {
          min-height: 48px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 18px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 750;
          cursor: pointer;
        }

        .primary-button {
          border: 0;
          background: linear-gradient(135deg, #9177ff, #6855e8);
          color: #ffffff;
          box-shadow: 0 12px 31px rgba(124, 92, 255, 0.24);
        }

        .secondary-button {
          border: 1px solid rgba(148, 163, 184, 0.16);
          background: rgba(255, 255, 255, 0.025);
          color: #c0c6d2;
        }

        .primary-button:hover,
        .secondary-button:hover:not(:disabled) {
          filter: brightness(1.08);
        }

        .secondary-button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .library-metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 22px;
        }

        .library-message {
          margin-bottom: 18px;
          padding: 13px 15px;
          border: 1px solid rgba(251, 191, 36, 0.2);
          border-radius: 13px;
          background: rgba(245, 158, 11, 0.06);
          color: #d8bf73;
          font-size: 11px;
          line-height: 1.5;
        }

        .library-panel {
          min-width: 0;
          padding: 24px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 22px;
          background:
            radial-gradient(
              circle at top right,
              rgba(124, 92, 255, 0.055),
              transparent 40%
            ),
            #10131b;
          box-shadow: 0 18px 55px rgba(0, 0, 0, 0.18);
        }

        .search-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .search-field {
          min-width: 0;
          flex: 1;
          min-height: 50px;
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 0 15px;
          border: 1px solid rgba(148, 163, 184, 0.13);
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.16);
        }

        .search-field:focus-within {
          border-color: rgba(167, 139, 250, 0.55);
          box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.06);
        }

        .search-field > span {
          color: #8f98aa;
          font-size: 19px;
        }

        .search-field input {
          min-width: 0;
          flex: 1;
          border: 0;
          outline: none;
          background: transparent;
          color: #ffffff;
          font: inherit;
          font-size: 13px;
        }

        .search-field input::placeholder {
          color: #5d6576;
        }

        .view-toggle {
          flex: 0 0 auto;
          display: flex;
          gap: 4px;
          padding: 4px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.12);
        }

        .view-toggle button {
          min-height: 40px;
          padding: 0 13px;
          border: 0;
          border-radius: 9px;
          background: transparent;
          color: #70798c;
          font-size: 10px;
          font-weight: 750;
          cursor: pointer;
        }

        .view-toggle .view-active {
          background: #1a2030;
          color: #ffffff;
        }

        .filter-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 11px;
          margin-top: 14px;
        }

        .results-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin: 18px 0 16px;
          padding-top: 17px;
          border-top: 1px solid rgba(148, 163, 184, 0.09);
        }

        .results-toolbar p {
          margin: 0;
          color: #71798b;
          font-size: 11px;
        }

        .results-toolbar p strong {
          color: #cfd4df;
        }

        .results-toolbar button {
          border: 0;
          background: transparent;
          color: #a99dfd;
          font-size: 10px;
          font-weight: 750;
          cursor: pointer;
        }

        .library-loading,
        .library-empty {
          min-height: 360px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 36px;
          border: 1px dashed rgba(148, 163, 184, 0.16);
          border-radius: 18px;
          background: rgba(0, 0, 0, 0.1);
          text-align: center;
        }

        .loading-spinner {
          width: 30px;
          height: 30px;
          border: 2px solid rgba(167, 139, 250, 0.17);
          border-top-color: #a78bfa;
          border-radius: 50%;
          animation: spin 700ms linear infinite;
        }

        .library-loading p {
          margin: 14px 0 0;
          color: #7d8699;
          font-size: 12px;
        }

        .library-empty > span {
          width: 58px;
          height: 58px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(167, 139, 250, 0.2);
          border-radius: 16px;
          background: rgba(139, 92, 246, 0.07);
          color: #c4b5fd;
          font-size: 24px;
        }

        .library-empty h2 {
          margin: 16px 0 0;
          color: #ffffff;
          font-size: 20px;
        }

        .library-empty p {
          max-width: 470px;
          margin: 8px 0 0;
          color: #71798b;
          font-size: 12px;
          line-height: 1.55;
        }

        .library-empty > div {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }

        .global-card-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(245px, 1fr));
          gap: 17px;
        }

        .global-card-list {
          min-width: 0;
          overflow-x: auto;
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 16px;
          background: rgba(0, 0, 0, 0.1);
        }

        .list-header {
          min-width: 940px;
          display: grid;
          grid-template-columns:
            minmax(280px, 2.1fr)
            minmax(150px, 1fr)
            minmax(120px, 0.8fr)
            minmax(110px, 0.7fr)
            minmax(130px, 0.85fr)
            minmax(110px, 0.7fr);
          gap: 14px;
          align-items: center;
          padding: 13px 16px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.09);
          color: #626b7d;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1180px) {
          .cards-app-shell {
            grid-template-columns: 260px minmax(0, 1fr);
          }

          .library-metrics,
          .filter-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 850px) {
          .cards-app-shell {
            display: block;
          }

          .cards-sidebar {
            position: static;
            height: auto;
            padding: 18px;
          }

          .navigation {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            margin-top: 22px;
          }

          .navigation-label,
          .sidebar-footer {
            display: none;
          }

          .cards-main-content {
            padding: 30px 20px 55px;
          }

          .cards-page-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .header-actions {
            width: 100%;
          }

          .header-actions button {
            flex: 1;
          }
        }

        @media (max-width: 620px) {
          .cards-page-header h1 {
            font-size: 48px;
          }

          .library-metrics,
          .filter-grid {
            grid-template-columns: 1fr;
          }

          .search-row {
            align-items: stretch;
            flex-direction: column;
          }

          .view-toggle {
            align-self: flex-end;
          }

          .navigation {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
  caption: string;
  featured?: boolean;
  tone?: "neutral" | "positive" | "negative";
};

function MetricCard({
  label,
  value,
  caption,
  featured = false,
  tone = "neutral",
}: MetricCardProps) {
  return (
    <article
      className={[
        "metric-card",
        featured ? "metric-card-featured" : "",
        `metric-card-${tone}`,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{caption}</small>

      <style jsx>{`
        .metric-card {
          min-width: 0;
          min-height: 145px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 21px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 18px;
          background: #10131b;
        }

        .metric-card-featured {
          border-color: rgba(139, 92, 246, 0.25);
          background:
            radial-gradient(
              circle at top right,
              rgba(124, 92, 255, 0.15),
              transparent 48%
            ),
            #121424;
        }

        .metric-card > span {
          color: #8b94a8;
          font-size: 11px;
          font-weight: 650;
        }

        .metric-card > strong {
          display: block;
          margin-top: 15px;
          color: #ffffff;
          font-size: clamp(24px, 3vw, 34px);
          letter-spacing: -0.035em;
        }

        .metric-card > small {
          display: block;
          margin-top: 7px;
          color: #657083;
          font-size: 10px;
          line-height: 1.4;
        }

        .metric-card-positive > strong {
          color: #86efac;
        }

        .metric-card-negative > strong {
          color: #fca5a5;
        }
      `}</style>
    </article>
  );
}

type FilterSelectProps = {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
};

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: FilterSelectProps) {
  return (
    <label className="filter-select">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          onChange(event.target.value)
        }
      >
        {options.map(([optionValue, optionLabel]) => (
          <option value={optionValue} key={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>

      <style jsx>{`
        .filter-select {
          min-width: 0;
          display: grid;
          gap: 7px;
        }

        .filter-select > span {
          color: #667083;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .filter-select select {
          width: 100%;
          min-width: 0;
          min-height: 43px;
          padding: 0 12px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 11px;
          outline: none;
          background: #11151f;
          color: #c9ced8;
          font: inherit;
          font-size: 11px;
          cursor: pointer;
        }

        .filter-select select:focus {
          border-color: rgba(167, 139, 250, 0.5);
          box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.05);
        }
      `}</style>
    </label>
  );
}

function LibraryGridCard({ card }: { card: LibraryCard }) {
  const currency = card.collection?.currency ?? "DKK";
  const stateTone = getStateTone(card);
  const valueTone = getValuationTone(card.valuation_source);
  const headline =
    joinDistinct([
      card.year,
      card.brand ?? card.manufacturer,
      card.product,
    ]) || "Product not specified";
  const details =
    joinDistinct([
      card.insert_name,
      card.parallel_name,
      card.card_number ? `#${card.card_number}` : null,
    ]) || "Card details not specified";
  const gradeLabel =
    joinDistinct([card.grading_company, card.grade]) || null;
  const resultTone =
    card.profit_value === null
      ? "neutral"
      : card.profit_value >= 0
        ? "positive"
        : "negative";

  return (
    <Link className="library-card-link" href={`/cards/${card.id}`}>
      <article className="library-card">
        <div className="library-card-image-frame">
          {card.front_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.front_image_url}
              alt={`${card.player_name} card front`}
            />
          ) : (
            <div className="no-card-image">
              <span>NE</span>
              <small>No image</small>
            </div>
          )}

          <span className={`state-badge state-${stateTone}`}>
            {getStateLabel(card)}
          </span>

          <span className={`value-badge value-${valueTone}`}>
            {card.valuation_source === "market" &&
            card.market_confidence !== null
              ? `Market ${Math.round(card.market_confidence)}%`
              : getValuationLabel(card.valuation_source)}
          </span>
        </div>

        <div className="library-card-body">
          <p className="library-card-product">{headline}</p>
          <h2>{card.player_name}</h2>

          {card.team && <p className="library-card-team">{card.team}</p>}

          <p className="library-card-details">{details}</p>

          <div className="card-tags">
            {gradeLabel && <span>{gradeLabel}</span>}
            {card.serial_number && <span>{card.serial_number}</span>}
            {card.rookie_card && <span>Rookie</span>}
            {card.autograph && <span>Auto</span>}
            {card.memorabilia && <span>Memorabilia</span>}
          </div>

          <div className="collection-line">
            <span>
              {card.collection?.type === "pc" ? "♥" : "□"}
            </span>
            <strong>{card.collection?.name ?? "No collection"}</strong>
          </div>

          <div className="card-value-grid">
            <div>
              <span>Cost</span>
              <strong>{formatCurrency(card.purchase_value, currency)}</strong>
            </div>

            <div>
              <span>
                {card.status_group === "sold" ? "Net proceeds" : "Value"}
              </span>
              <strong>
                {card.status_group === "sold"
                  ? formatCurrency(
                      card.sale?.net_amount ?? null,
                      card.sale?.currency ?? currency
                    )
                  : formatCurrency(card.valuation_value, currency)}
              </strong>
            </div>
          </div>

          <div className={`card-result card-result-${resultTone}`}>
            <span>
              {card.status_group === "sold"
                ? "Realized result"
                : "Current result"}
            </span>
            <strong>{formatCurrency(card.profit_value, currency)}</strong>
          </div>

          <footer>
            <span>{formatDate(card.activity_at)}</span>
            <strong>Open card →</strong>
          </footer>
        </div>
      </article>

      <style jsx>{`
        .library-card-link {
          min-width: 0;
          display: block;
          height: 100%;
          color: inherit;
          text-decoration: none;
        }

        .library-card {
          height: 100%;
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 18px;
          background: #11141d;
          transition:
            transform 170ms ease,
            border-color 170ms ease,
            box-shadow 170ms ease;
        }

        .library-card-link:hover .library-card {
          transform: translateY(-4px);
          border-color: rgba(139, 92, 246, 0.38);
          box-shadow: 0 20px 44px rgba(0, 0, 0, 0.28);
        }

        .library-card-image-frame {
          position: relative;
          aspect-ratio: 2.5 / 3.5;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          padding: 11px;
          background:
            radial-gradient(
              circle at 80% 10%,
              rgba(124, 92, 255, 0.18),
              transparent 37%
            ),
            #080a0f;
        }

        .library-card-image-frame img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: contain;
          transition: transform 220ms ease;
        }

        .library-card-link:hover .library-card-image-frame img {
          transform: scale(1.022);
        }

        .no-card-image {
          display: grid;
          place-items: center;
          gap: 9px;
        }

        .no-card-image span {
          width: 55px;
          height: 55px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(167, 139, 250, 0.23);
          border-radius: 15px;
          background: rgba(139, 92, 246, 0.08);
          color: #c4b5fd;
          font-weight: 850;
        }

        .no-card-image small {
          color: #5e6779;
          font-size: 9px;
          text-transform: uppercase;
        }

        .state-badge,
        .value-badge {
          position: absolute;
          top: 10px;
          z-index: 2;
          padding: 6px 9px;
          border-radius: 999px;
          font-size: 8px;
          font-weight: 850;
          letter-spacing: 0.05em;
          backdrop-filter: blur(10px);
        }

        .state-badge {
          left: 10px;
        }

        .value-badge {
          right: 10px;
        }

        .state-verified {
          border: 1px solid rgba(52, 211, 153, 0.25);
          background: rgba(7, 62, 47, 0.82);
          color: #a7f3d0;
        }

        .state-review {
          border: 1px solid rgba(251, 191, 36, 0.27);
          background: rgba(62, 44, 8, 0.84);
          color: #fde68a;
        }

        .state-grading {
          border: 1px solid rgba(96, 165, 250, 0.25);
          background: rgba(14, 36, 65, 0.84);
          color: #bfdbfe;
        }

        .state-listed {
          border: 1px solid rgba(167, 139, 250, 0.26);
          background: rgba(42, 30, 71, 0.84);
          color: #ddd6fe;
        }

        .state-sold,
        .state-neutral {
          border: 1px solid rgba(148, 163, 184, 0.2);
          background: rgba(26, 31, 42, 0.86);
          color: #cbd5e1;
        }

        .value-market {
          border: 1px solid rgba(167, 139, 250, 0.26);
          background: rgba(21, 14, 45, 0.84);
          color: #c4b5fd;
        }

        .value-manual {
          border: 1px solid rgba(96, 165, 250, 0.23);
          background: rgba(12, 34, 61, 0.84);
          color: #bfdbfe;
        }

        .value-none {
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(24, 28, 38, 0.84);
          color: #7e8798;
        }

        .library-card-body {
          padding: 16px;
        }

        .library-card-product,
        .library-card-team,
        .library-card-details {
          margin: 0;
        }

        .library-card-product {
          min-height: 31px;
          color: #646d80;
          font-size: 9px;
          font-weight: 650;
          line-height: 1.5;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .library-card-body h2 {
          margin: 9px 0 0;
          color: #ffffff;
          font-size: 17px;
          letter-spacing: -0.025em;
        }

        .library-card-team {
          margin-top: 5px;
          color: #727b8e;
          font-size: 10px;
        }

        .library-card-details {
          min-height: 33px;
          margin-top: 10px;
          color: #9aa2b2;
          font-size: 10px;
          line-height: 1.5;
        }

        .card-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          min-height: 25px;
          margin-top: 10px;
        }

        .card-tags span {
          padding: 5px 7px;
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.02);
          color: #7b8496;
          font-size: 8px;
          font-weight: 700;
        }

        .collection-line {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-top: 13px;
          padding: 10px 11px;
          border: 1px solid rgba(148, 163, 184, 0.08);
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.11);
        }

        .collection-line span {
          color: #9f93ff;
          font-size: 10px;
        }

        .collection-line strong {
          overflow: hidden;
          color: #aeb5c3;
          font-size: 9px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .card-value-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-top: 12px;
        }

        .card-value-grid div,
        .card-result {
          padding: 10px;
          border: 1px solid rgba(148, 163, 184, 0.08);
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.1);
        }

        .card-value-grid span,
        .card-result span {
          display: block;
          color: #626b7e;
          font-size: 8px;
          font-weight: 750;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .card-value-grid strong,
        .card-result strong {
          display: block;
          margin-top: 5px;
          color: #ffffff;
          font-size: 11px;
        }

        .card-result {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 8px;
        }

        .card-result strong {
          margin-top: 0;
        }

        .card-result-positive strong {
          color: #86efac;
        }

        .card-result-negative strong {
          color: #fca5a5;
        }

        .library-card-body footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 13px;
          padding-top: 12px;
          border-top: 1px solid rgba(148, 163, 184, 0.08);
        }

        .library-card-body footer span {
          color: #5f687a;
          font-size: 8px;
        }

        .library-card-body footer strong {
          color: #a99dfd;
          font-size: 9px;
        }
      `}</style>
    </Link>
  );
}

function LibraryListRow({ card }: { card: LibraryCard }) {
  const currency = card.collection?.currency ?? "DKK";
  const stateTone = getStateTone(card);
  const resultTone =
    card.profit_value === null
      ? "neutral"
      : card.profit_value >= 0
        ? "positive"
        : "negative";
  const subtitle =
    joinDistinct([
      card.year,
      card.product ?? card.set_name,
      card.parallel_name,
      card.card_number ? `#${card.card_number}` : null,
    ]) || "Card details not specified";

  return (
    <Link className="list-row" href={`/cards/${card.id}`}>
      <div className="list-card-identity">
        <div className="list-thumbnail">
          {card.front_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.front_image_url}
              alt={`${card.player_name} thumbnail`}
            />
          ) : (
            <span>NE</span>
          )}
        </div>

        <div>
          <strong>{card.player_name}</strong>
          <span>{subtitle}</span>
        </div>
      </div>

      <div className="list-collection">
        <strong>{card.collection?.name ?? "—"}</strong>
        <span>
          {card.collection?.type === "pc"
            ? "Personal Collection"
            : "Dealer Inventory"}
        </span>
      </div>

      <div>
        <span className={`list-state state-${stateTone}`}>
          {getStateLabel(card)}
        </span>
      </div>

      <strong className="numeric-cell">
        {formatCurrency(card.purchase_value, currency)}
      </strong>

      <div className="list-value-cell">
        <strong>
          {card.status_group === "sold"
            ? formatCurrency(
                card.sale?.net_amount ?? null,
                card.sale?.currency ?? currency
              )
            : formatCurrency(card.valuation_value, currency)}
        </strong>
        <span>{getValuationLabel(card.valuation_source)}</span>
      </div>

      <strong className={`numeric-cell result-${resultTone}`}>
        {formatCurrency(card.profit_value, currency)}
      </strong>

      <style jsx>{`
        .list-row {
          min-width: 940px;
          display: grid;
          grid-template-columns:
            minmax(280px, 2.1fr)
            minmax(150px, 1fr)
            minmax(120px, 0.8fr)
            minmax(110px, 0.7fr)
            minmax(130px, 0.85fr)
            minmax(110px, 0.7fr);
          gap: 14px;
          align-items: center;
          padding: 13px 16px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.07);
          color: inherit;
          text-decoration: none;
          transition: background 140ms ease;
        }

        .list-row:last-child {
          border-bottom: 0;
        }

        .list-row:hover {
          background: rgba(124, 92, 255, 0.045);
        }

        .list-card-identity {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .list-thumbnail {
          width: 44px;
          height: 61px;
          display: grid;
          place-items: center;
          overflow: hidden;
          flex: 0 0 auto;
          border-radius: 8px;
          background: #080a0f;
        }

        .list-thumbnail img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .list-thumbnail span {
          color: #786ca8;
          font-size: 9px;
          font-weight: 800;
        }

        .list-card-identity > div:last-child,
        .list-collection,
        .list-value-cell {
          min-width: 0;
        }

        .list-card-identity strong,
        .list-collection strong,
        .list-value-cell strong,
        .numeric-cell {
          color: #e6e9ef;
          font-size: 11px;
        }

        .list-card-identity span,
        .list-collection span,
        .list-value-cell span {
          display: block;
          overflow: hidden;
          margin-top: 4px;
          color: #687184;
          font-size: 9px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .list-state {
          display: inline-flex;
          padding: 6px 8px;
          border-radius: 999px;
          font-size: 8px;
          font-weight: 800;
        }

        .state-verified {
          background: rgba(16, 185, 129, 0.08);
          color: #a7f3d0;
        }

        .state-review {
          background: rgba(245, 158, 11, 0.08);
          color: #fde68a;
        }

        .state-grading {
          background: rgba(59, 130, 246, 0.08);
          color: #bfdbfe;
        }

        .state-listed {
          background: rgba(139, 92, 246, 0.08);
          color: #ddd6fe;
        }

        .state-sold,
        .state-neutral {
          background: rgba(148, 163, 184, 0.07);
          color: #cbd5e1;
        }

        .numeric-cell,
        .list-value-cell {
          text-align: right;
        }

        .result-positive {
          color: #86efac;
        }

        .result-negative {
          color: #fca5a5;
        }
      `}</style>
    </Link>
  );
}
