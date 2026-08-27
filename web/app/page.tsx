"use client";

import Link from "next/link";
import {
  ChangeEvent,
  FormEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import AddCardModal from "@/components/AddCardModal";
import AuthenticatedUserCard, {
  useCurrentUserIdentity,
} from "@/components/auth/AuthenticatedUserCard";
import { createClient } from "@/lib/supabase/client";

const CARD_IMAGE_BUCKET = "card-images";
const SIGNED_URL_SECONDS = 60 * 60;
const RECENT_CARD_LIMIT = 5;
const RECENT_ACTIVITY_LIMIT = 6;

type CollectionType = "pc" | "inventory";

type Collection = {
  id: string;
  name: string;
  type: CollectionType;
  currency: string;
  created_at: string;
};

type NumericDatabaseValue = number | string | null;

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
  market_value_updated_at: string | null;
  state: string | null;
  created_at: string;
};

type CardImageRow = {
  card_id: string;
  storage_path: string;
};

type SaleTransactionRow = {
  id: string;
  card_id: string;
  collection_id: string | null;
  occurred_at: string;
  currency: string;
  item_amount: NumericDatabaseValue;
  shipping_income: NumericDatabaseValue;
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
  cost_basis: number;
  net_amount: number;
  realized_profit: number;
  platform: string | null;
  counterparty: string | null;
  reference: string | null;
};

type ValuationSource = "market" | "manual" | "none";

type DashboardCard = CardRow & {
  collection: Collection | null;
  front_image_url: string | null;
  purchase_value: number;
  valuation_value: number | null;
  valuation_source: ValuationSource;
  market_confidence: number | null;
};

type CollectionSummary = Collection & {
  active_cards: number;
  sold_cards: number;
  active_cost: number;
  portfolio_value: number;
  unrealized_result: number;
  market_valued_cards: number;
  manually_valued_cards: number;
  unvalued_cards: number;
  market_coverage: number;
  total_coverage: number;
  net_proceeds: number;
  realized_profit: number;
  last_activity_at: string;
};

type NavigationItem = {
  label: string;
  icon: string;
  href?: string;
  targetId?: string;
  active?: boolean;
  comingSoon?: boolean;
};

type ActivityItem = {
  id: string;
  type: "card" | "sale" | "collection";
  occurredAt: string;
  title: string;
  description: string;
  href: string | null;
  amount: number | null;
  currency: string;
  tone: "neutral" | "positive" | "negative";
};

const navigation: NavigationItem[] = [
  { label: "Home", icon: "⌂", active: true },
  { label: "Collections", icon: "◇", targetId: "collections" },
  { label: "Cards", icon: "▱", href: "/cards" },
  { label: "Scanner", icon: "◎", href: "/scanner" },
  { label: "Grading", icon: "◈", comingSoon: true },
  { label: "Transactions", icon: "↕", href: "/transactions" },
  { label: "Analytics", icon: "⌁", href: "/analytics" },
];

function toDatabaseNumber(value: NumericDatabaseValue) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function toOptionalDatabaseNumber(value: NumericDatabaseValue) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function normalizeSaleTransaction(
  transaction: SaleTransactionRow
): SaleTransaction {
  return {
    id: transaction.id,
    card_id: transaction.card_id,
    collection_id: transaction.collection_id,
    occurred_at: transaction.occurred_at,
    currency: transaction.currency,
    item_amount: toDatabaseNumber(transaction.item_amount),
    shipping_income: toDatabaseNumber(transaction.shipping_income),
    cost_basis: toDatabaseNumber(transaction.cost_basis),
    net_amount: toDatabaseNumber(transaction.net_amount),
    realized_profit: toDatabaseNumber(transaction.realized_profit),
    platform: transaction.platform,
    counterparty: transaction.counterparty,
    reference: transaction.reference,
  };
}

function getCardValuation(
  card: CardRow,
  collectionCurrency: string
): {
  value: number | null;
  source: ValuationSource;
} {
  const marketValue = toOptionalDatabaseNumber(
    card.market_estimated_value
  );

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

  const manualValue = toOptionalDatabaseNumber(card.estimated_value);

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

function formatPercentage(value: number | null) {
  if (value === null) {
    return "—";
  }

  return `${value.toLocaleString("da-DK", {
    maximumFractionDigits: 1,
  })}%`;
}

function formatShortDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Dato ukendt";
  }

  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatActivityDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Dato ukendt";
  }

  const now = new Date();
  const difference = now.getTime() - date.getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  if (difference >= 0 && difference < oneDay) {
    return new Intl.DateTimeFormat("da-DK", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  if (difference >= oneDay && difference < oneDay * 2) {
    return "I går";
  }

  return formatShortDate(value);
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 10) {
    return "Godmorgen";
  }

  if (hour < 18) {
    return "God eftermiddag";
  }

  return "Godaften";
}

function getCollectionTypeLabel(type: CollectionType) {
  return type === "pc" ? "Personal Collection" : "Dealer Inventory";
}

function getCardStateLabel(state: string | null) {
  switch (state) {
    case "sold":
      return "Sold";
    case "submitted":
      return "At grading";
    case "graded":
      return "Graded";
    case "listed":
      return "For sale";
    case "needs_review":
    case "draft":
      return "Needs review";
    case "verified":
      return "Verified";
    default:
      return "Registered";
  }
}

function getCardSubtitle(card: DashboardCard) {
  return [
    card.year,
    card.manufacturer,
    card.set_name,
    card.card_number ? `#${card.card_number}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function HomePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const userIdentity = useCurrentUserIdentity();

  const [collections, setCollections] = useState<Collection[]>([]);
  const [cards, setCards] = useState<DashboardCard[]>([]);
  const [saleTransactions, setSaleTransactions] = useState<
    SaleTransaction[]
  >([]);

  const [name, setName] = useState("");
  const [type, setType] = useState<CollectionType>("pc");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [createMessage, setCreateMessage] = useState("");
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.replace("/login");
      return;
    }

    const [collectionResult, cardResult, saleResult] = await Promise.all([
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
          market_value_confidence,
          market_value_updated_at,
          state,
          created_at
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),

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
          cost_basis,
          net_amount,
          realized_profit,
          platform,
          counterparty,
          reference
        `)
        .eq("user_id", user.id)
        .eq("transaction_type", "sale")
        .eq("status", "completed")
        .order("occurred_at", { ascending: false }),
    ]);

    if (collectionResult.error) {
      setMessage(`Collections kunne ikke indlæses: ${collectionResult.error.message}`);
      setCollections([]);
      setCards([]);
      setSaleTransactions([]);
      setLoading(false);
      return;
    }

    if (cardResult.error) {
      setMessage(`Kortene kunne ikke indlæses: ${cardResult.error.message}`);
      setCollections((collectionResult.data ?? []) as Collection[]);
      setCards([]);
      setSaleTransactions([]);
      setLoading(false);
      return;
    }

    const warnings: string[] = [];

    const collectionRows = (collectionResult.data ?? []) as Collection[];
    const cardRows = (cardResult.data ?? []) as CardRow[];
    const normalizedSales = saleResult.error
      ? []
      : ((saleResult.data ?? []) as SaleTransactionRow[]).map(
          normalizeSaleTransaction
        );

    if (saleResult.error) {
      console.error("Salgstransaktioner kunne ikke hentes:", saleResult.error);
      warnings.push("Salgstallene kunne ikke indlæses.");
    }

    const collectionById = new Map(
      collectionRows.map((collection) => [collection.id, collection])
    );

    const recentCardIds = cardRows
      .slice(0, RECENT_CARD_LIMIT)
      .map((card) => card.id);

    const signedImageByCardId = new Map<string, string>();

    if (recentCardIds.length > 0) {
      const imageResult = await supabase
        .from("card_images")
        .select(`
          card_id,
          storage_path
        `)
        .in("card_id", recentCardIds)
        .eq("image_type", "front");

      if (imageResult.error) {
        console.error("Seneste kortbilleder kunne ikke hentes:", imageResult.error);
        warnings.push("Nogle seneste kortbilleder kunne ikke vises.");
      } else {
        await Promise.all(
          ((imageResult.data ?? []) as CardImageRow[]).map(async (image) => {
            const { data, error } = await supabase.storage
              .from(CARD_IMAGE_BUCKET)
              .createSignedUrl(image.storage_path, SIGNED_URL_SECONDS);

            if (error || !data?.signedUrl) {
              console.error("Signed URL kunne ikke oprettes:", {
                path: image.storage_path,
                error,
              });
              return;
            }

            signedImageByCardId.set(image.card_id, data.signedUrl);
          })
        );
      }
    }

    const enrichedCards = cardRows.map((card) => {
      const collection = collectionById.get(card.current_collection_id) ?? null;
      const collectionCurrency = collection?.currency ?? "DKK";
      const valuation = getCardValuation(card, collectionCurrency);

      return {
        ...card,
        collection,
        front_image_url: signedImageByCardId.get(card.id) ?? null,
        purchase_value: toDatabaseNumber(card.purchase_price),
        valuation_value: valuation.value,
        valuation_source: valuation.source,
        market_confidence: toOptionalDatabaseNumber(
          card.market_value_confidence
        ),
      } satisfies DashboardCard;
    });

    setCollections(collectionRows);
    setCards(enrichedCards);
    setSaleTransactions(normalizedSales);

    if (warnings.length > 0) {
      setMessage(Array.from(new Set(warnings)).join(" "));
    }

    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setCreateMessage("Skriv et navn på samlingen.");
      return;
    }

    setSaving(true);
    setCreateMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setCreateMessage("Du er ikke logget ind.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("collections").insert({
      user_id: user.id,
      name: name.trim(),
      type,
      currency: "DKK",
    });

    if (error) {
      setCreateMessage(`Collection kunne ikke oprettes: ${error.message}`);
      setSaving(false);
      return;
    }

    setName("");
    setType("pc");
    setSaving(false);
    setShowCreateCollection(false);
    setCreateMessage("");
    setMessage("Collection er oprettet.");

    await loadDashboard();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function handleScanCard() {
    setShowAddCard(false);
    router.push("/scanner");
  }

  function handleManualCard(collectionId: string) {
    setShowAddCard(false);
    router.push(`/collections/${collectionId}`);
  }

  function handleNavigation(item: NavigationItem) {
    if (item.comingSoon) {
      return;
    }

    if (item.active) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (item.href) {
      router.push(item.href);
      return;
    }

    if (item.targetId) {
      document.getElementById(item.targetId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  const collectionSummaries = useMemo<CollectionSummary[]>(() => {
    return collections.map((collection) => {
      const activeCards = cards.filter(
        (card) =>
          card.current_collection_id === collection.id &&
          card.state !== "sold"
      );

      const collectionSales = saleTransactions.filter(
        (sale) => sale.collection_id === collection.id
      );

      const activeCost = activeCards.reduce(
        (total, card) => total + card.purchase_value,
        0
      );

      const portfolioValue = activeCards.reduce(
        (total, card) => total + (card.valuation_value ?? 0),
        0
      );

      const marketValuedCards = activeCards.filter(
        (card) => card.valuation_source === "market"
      ).length;

      const manuallyValuedCards = activeCards.filter(
        (card) => card.valuation_source === "manual"
      ).length;

      const unvaluedCards = activeCards.filter(
        (card) => card.valuation_source === "none"
      ).length;

      const latestCardDate = activeCards[0]?.created_at ?? collection.created_at;
      const latestSaleDate = collectionSales[0]?.occurred_at ?? collection.created_at;

      return {
        ...collection,
        active_cards: activeCards.length,
        sold_cards: collectionSales.length,
        active_cost: activeCost,
        portfolio_value: portfolioValue,
        unrealized_result: portfolioValue - activeCost,
        market_valued_cards: marketValuedCards,
        manually_valued_cards: manuallyValuedCards,
        unvalued_cards: unvaluedCards,
        market_coverage:
          activeCards.length > 0
            ? (marketValuedCards / activeCards.length) * 100
            : 0,
        total_coverage:
          activeCards.length > 0
            ? ((marketValuedCards + manuallyValuedCards) /
                activeCards.length) *
              100
            : 0,
        net_proceeds: collectionSales.reduce(
          (total, sale) => total + sale.net_amount,
          0
        ),
        realized_profit: collectionSales.reduce(
          (total, sale) => total + sale.realized_profit,
          0
        ),
        last_activity_at:
          new Date(latestSaleDate).getTime() >
          new Date(latestCardDate).getTime()
            ? latestSaleDate
            : latestCardDate,
      };
    });
  }, [cards, collections, saleTransactions]);

  const dashboardCurrency = collections[0]?.currency ?? "DKK";
  const hasMixedCurrencies = new Set(
    collections.map((collection) => collection.currency)
  ).size > 1;

  const activeCards = cards.filter((card) => card.state !== "sold");
  const activeCardsInDashboardCurrency = activeCards.filter(
    (card) => (card.collection?.currency ?? dashboardCurrency) === dashboardCurrency
  );
  const salesInDashboardCurrency = saleTransactions.filter(
    (sale) => sale.currency === dashboardCurrency
  );

  const activeCostBasis = activeCardsInDashboardCurrency.reduce(
    (total, card) => total + card.purchase_value,
    0
  );

  const totalPortfolioValue = activeCardsInDashboardCurrency.reduce(
    (total, card) => total + (card.valuation_value ?? 0),
    0
  );

  const unrealizedResult = totalPortfolioValue - activeCostBasis;

  const marketValuedCards = activeCards.filter(
    (card) => card.valuation_source === "market"
  );

  const manuallyValuedCards = activeCards.filter(
    (card) => card.valuation_source === "manual"
  );

  const unvaluedCards = activeCards.filter(
    (card) => card.valuation_source === "none"
  );

  const marketCoverage =
    activeCards.length > 0
      ? (marketValuedCards.length / activeCards.length) * 100
      : 0;

  const totalValuationCoverage =
    activeCards.length > 0
      ? ((marketValuedCards.length + manuallyValuedCards.length) /
          activeCards.length) *
        100
      : 0;

  const soldCardsCount = new Set(
    saleTransactions.map((sale) => sale.card_id)
  ).size;

  const grossSales = salesInDashboardCurrency.reduce(
    (total, sale) => total + sale.item_amount + sale.shipping_income,
    0
  );

  const netProceeds = salesInDashboardCurrency.reduce(
    (total, sale) => total + sale.net_amount,
    0
  );

  const soldCostBasis = salesInDashboardCurrency.reduce(
    (total, sale) => total + sale.cost_basis,
    0
  );

  const realizedProfit = salesInDashboardCurrency.reduce(
    (total, sale) => total + sale.realized_profit,
    0
  );

  const realizedRoi =
    soldCostBasis > 0 ? (realizedProfit / soldCostBasis) * 100 : null;

  const cardsInGrading = activeCards.filter(
    (card) => card.state === "submitted"
  ).length;

  const personalSummaries = collectionSummaries.filter(
    (collection) => collection.type === "pc"
  );

  const inventorySummaries = collectionSummaries.filter(
    (collection) => collection.type === "inventory"
  );

  const personalPortfolioValue = personalSummaries
    .filter((collection) => collection.currency === dashboardCurrency)
    .reduce((total, collection) => total + collection.portfolio_value, 0);

  const inventoryPortfolioValue = inventorySummaries
    .filter((collection) => collection.currency === dashboardCurrency)
    .reduce((total, collection) => total + collection.portfolio_value, 0);

  const personalActiveCards = personalSummaries.reduce(
    (total, collection) => total + collection.active_cards,
    0
  );

  const inventoryActiveCards = inventorySummaries.reduce(
    (total, collection) => total + collection.active_cards,
    0
  );

  const portfolioSplitTotal = personalPortfolioValue + inventoryPortfolioValue;
  const personalShare =
    portfolioSplitTotal > 0
      ? (personalPortfolioValue / portfolioSplitTotal) * 100
      : 0;
  const inventoryShare =
    portfolioSplitTotal > 0
      ? (inventoryPortfolioValue / portfolioSplitTotal) * 100
      : 0;

  const recentCards = [...cards]
    .sort(
      (first, second) =>
        new Date(second.created_at).getTime() -
        new Date(first.created_at).getTime()
    )
    .slice(0, RECENT_CARD_LIMIT);

  const cardById = useMemo(
    () => new Map(cards.map((card) => [card.id, card])),
    [cards]
  );
  const collectionById = useMemo(
    () =>
      new Map(
        collections.map((collection) => [collection.id, collection])
      ),
    [collections]
  );

  const recentActivity = useMemo<ActivityItem[]>(() => {
    const cardActivities: ActivityItem[] = cards.slice(0, 5).map((card) => ({
      id: `card-${card.id}`,
      type: "card",
      occurredAt: card.created_at,
      title: `${card.player_name} added`,
      description: card.collection
        ? `${getCollectionTypeLabel(card.collection.type)} · ${card.collection.name}`
        : "Card registered",
      href: `/cards/${card.id}`,
      amount: card.valuation_value,
      currency: card.collection?.currency ?? dashboardCurrency,
      tone: "neutral",
    }));

    const saleActivities: ActivityItem[] = saleTransactions
      .slice(0, 5)
      .map((sale) => {
        const card = cardById.get(sale.card_id);
        const collection = sale.collection_id
          ? collectionById.get(sale.collection_id)
          : null;

        return {
          id: `sale-${sale.id}`,
          type: "sale",
          occurredAt: sale.occurred_at,
          title: `${card?.player_name ?? "Card"} sold`,
          description: [
            sale.platform,
            collection?.name,
            `Net ${formatCurrency(sale.net_amount, sale.currency)}`,
          ]
            .filter(Boolean)
            .join(" · "),
          href: card ? `/cards/${card.id}` : null,
          amount: sale.realized_profit,
          currency: sale.currency,
          tone:
            sale.realized_profit >= 0
              ? "positive"
              : "negative",
        };
      });

    const collectionActivities: ActivityItem[] = collections
      .slice(-3)
      .map((collection) => ({
        id: `collection-${collection.id}`,
        type: "collection",
        occurredAt: collection.created_at,
        title: `${collection.name} created`,
        description: getCollectionTypeLabel(collection.type),
        href: `/collections/${collection.id}`,
        amount: null,
        currency: collection.currency,
        tone: "neutral",
      }));

    return [
      ...cardActivities,
      ...saleActivities,
      ...collectionActivities,
    ]
      .sort(
        (first, second) =>
          new Date(second.occurredAt).getTime() -
          new Date(first.occurredAt).getTime()
      )
      .slice(0, RECENT_ACTIVITY_LIMIT);
  }, [
    cards,
    collections,
    saleTransactions,
    dashboardCurrency,
    cardById,
    collectionById,
  ]);

  const highestValueCollection = [...collectionSummaries]
    .filter((collection) => collection.currency === dashboardCurrency)
    .sort(
      (first, second) => second.portfolio_value - first.portfolio_value
    )[0];

  const bestMarketCoverageCollection = [...collectionSummaries]
    .filter((collection) => collection.active_cards > 0)
    .sort((first, second) => second.market_coverage - first.market_coverage)[0];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand">
            <div className="brand-mark">V</div>

            <div>
              <p className="brand-name">Vallective</p>
              <p className="brand-subtitle">Collector Intelligence</p>
            </div>
          </div>

          <nav className="navigation">
            <p className="navigation-label">Workspace</p>

            {navigation.map((item) => (
              <button
                className={`navigation-item ${
                  item.active ? "navigation-item-active" : ""
                }`}
                key={item.label}
                type="button"
                disabled={item.comingSoon}
                onClick={() => handleNavigation(item)}
              >
                <span className="navigation-icon">{item.icon}</span>
                <span>{item.label}</span>

                {item.comingSoon && (
                  <span className="coming-soon">Soon</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <button className="settings-button" type="button" disabled>
            <span className="navigation-icon">⚙</span>
            Settings
            <span className="coming-soon">Soon</span>
          </button>

          <AuthenticatedUserCard
            identity={userIdentity}
            onLogout={handleLogout}
          />
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Command center</p>
            <h1>{getGreeting()}, {userIdentity.displayName}</h1>

            <p className="topbar-description">
              Dit samlede overblik over aktive kort, markedsværdi og realiserede salg.
            </p>
          </div>

          <div className="topbar-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => setShowAddCard(true)}
            >
              <span>◎</span>
              Add card
            </button>

            <button
              className="primary-button"
              type="button"
              onClick={() => {
                setCreateMessage("");
                setShowCreateCollection(true);
              }}
            >
              <span>＋</span>
              New collection
            </button>
          </div>
        </header>

        {message && (
          <div className="dashboard-message" role="status">
            <span>i</span>
            <p>{message}</p>
          </div>
        )}

        {hasMixedCurrencies && (
          <div className="dashboard-message dashboard-message-warning">
            <span>!</span>
            <p>
              Dashboard-totaler vises i {dashboardCurrency}. Collections i andre valutaer er ikke medregnet, før valutaomregning er bygget.
            </p>
          </div>
        )}

        <section className="metrics-grid dashboard-metrics" id="analytics">
          <article className="metric-card metric-card-featured">
            <div className="metric-card-header">
              <span className="metric-label">Total portfolio value</span>
              <span className="metric-icon">◇</span>
            </div>

            <p className="metric-value">
              {formatCurrency(totalPortfolioValue, dashboardCurrency)}
            </p>

            <p className="metric-caption">
              market estimate first, then your estimate
            </p>
          </article>

          <article className="metric-card">
            <div className="metric-card-header">
              <span className="metric-label">Active cost basis</span>
              <span className="metric-icon">↘</span>
            </div>

            <p className="metric-value">
              {formatCurrency(activeCostBasis, dashboardCurrency)}
            </p>

            <p className="metric-caption">
              {activeCards.length} active {activeCards.length === 1 ? "card" : "cards"}
            </p>
          </article>

          <article
            className={`metric-card ${
              unrealizedResult >= 0
                ? "dashboard-positive-card"
                : "dashboard-negative-card"
            }`}
          >
            <div className="metric-card-header">
              <span className="metric-label">Unrealized result</span>
              <span className="metric-icon">⌁</span>
            </div>

            <p className="metric-value">
              {formatCurrency(unrealizedResult, dashboardCurrency)}
            </p>

            <p className="metric-caption">
              current portfolio value minus active cost
            </p>
          </article>

          <article
            className={`metric-card ${
              realizedProfit >= 0
                ? "dashboard-positive-card"
                : "dashboard-negative-card"
            }`}
          >
            <div className="metric-card-header">
              <span className="metric-label">Realized profit</span>
              <span className="metric-icon">↕</span>
            </div>

            <p className="metric-value">
              {formatCurrency(realizedProfit, dashboardCurrency)}
            </p>

            <p className="metric-caption">
              {soldCardsCount} completed {soldCardsCount === 1 ? "sale" : "sales"} · ROI {formatPercentage(realizedRoi)}
            </p>
          </article>
        </section>

        <section className="portfolio-health-grid">
          <article className="panel coverage-panel">
            <div className="panel-header coverage-panel-header">
              <div>
                <p className="eyebrow">Valuation coverage</p>
                <h2>{Math.round(marketCoverage)}% market coverage</h2>
                <p className="coverage-description">
                  Market value is used first, then your own estimate. Cards without either value contribute 0 to the portfolio total.
                </p>
              </div>

              <div className="coverage-score">
                <span>Total coverage</span>
                <strong>{Math.round(totalValuationCoverage)}%</strong>
              </div>
            </div>

            <div className="coverage-progress" aria-label="Market coverage">
              <span
                style={{
                  width: `${Math.max(0, Math.min(100, marketCoverage))}%`,
                }}
              />
            </div>

            <div className="coverage-stat-grid">
              <div>
                <span className="coverage-dot coverage-dot-market" />
                <strong>{marketValuedCards.length}</strong>
                <small>Market valued</small>
              </div>

              <div>
                <span className="coverage-dot coverage-dot-manual" />
                <strong>{manuallyValuedCards.length}</strong>
                <small>Your estimate</small>
              </div>

              <div>
                <span className="coverage-dot coverage-dot-none" />
                <strong>{unvaluedCards.length}</strong>
                <small>No valuation</small>
              </div>

              <div>
                <span className="coverage-dot coverage-dot-grading" />
                <strong>{cardsInGrading}</strong>
                <small>At grading</small>
              </div>
            </div>
          </article>

          <article className="panel split-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Portfolio split</p>
                <h2>PC vs. inventory</h2>
              </div>
            </div>

            <div className="split-bar" aria-label="Portfolio split">
              <span
                className="split-bar-personal"
                style={{ width: `${personalShare}%` }}
              />
              <span
                className="split-bar-inventory"
                style={{ width: `${inventoryShare}%` }}
              />
            </div>

            <div className="split-list">
              <div>
                <span className="split-symbol split-symbol-personal">♥</span>
                <div>
                  <strong>Personal Collection</strong>
                  <small>{personalActiveCards} active cards</small>
                </div>
                <b>{formatCurrency(personalPortfolioValue, dashboardCurrency)}</b>
              </div>

              <div>
                <span className="split-symbol split-symbol-inventory">□</span>
                <div>
                  <strong>Dealer Inventory</strong>
                  <small>{inventoryActiveCards} active cards</small>
                </div>
                <b>{formatCurrency(inventoryPortfolioValue, dashboardCurrency)}</b>
              </div>
            </div>
          </article>
        </section>

        <section className="dashboard-grid">
          <div className="dashboard-main-column">
            <section className="panel" id="collections">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Portfolio</p>
                  <h2>Your collections</h2>
                </div>

                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    setCreateMessage("");
                    setShowCreateCollection(true);
                  }}
                >
                  Add collection
                  <span>→</span>
                </button>
              </div>

              {loading && (
                <div className="empty-state">
                  <div className="loading-indicator" />
                  <p>Indlæser dit dashboard...</p>
                </div>
              )}

              {!loading && collectionSummaries.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state-icon">◇</div>
                  <h3>Start din første collection</h3>

                  <p>
                    Opret en Personal Collection eller et Dealer Inventory.
                  </p>

                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => setShowCreateCollection(true)}
                  >
                    <span>＋</span>
                    New collection
                  </button>
                </div>
              )}

              {!loading && collectionSummaries.length > 0 && (
                <div className="collection-grid dashboard-collection-grid">
                  {collectionSummaries.map((collection) => (
                    <article
                      className="collection-card dashboard-collection-card"
                      key={collection.id}
                    >
                      <div
                        className={`collection-symbol ${
                          collection.type === "pc"
                            ? "collection-symbol-pc"
                            : "collection-symbol-inventory"
                        }`}
                      >
                        {collection.type === "pc" ? "♥" : "□"}
                      </div>

                      <div className="collection-card-content">
                        <div className="collection-card-heading">
                          <div>
                            <p className="collection-type">
                              {getCollectionTypeLabel(collection.type)}
                            </p>

                            <h3>{collection.name}</h3>
                          </div>

                          <span className="collection-coverage-badge">
                            {Math.round(collection.market_coverage)}% market
                          </span>
                        </div>

                        <div className="collection-summary-grid">
                          <div>
                            <span>Active cards</span>
                            <strong>{collection.active_cards}</strong>
                          </div>

                          <div>
                            <span>Portfolio value</span>
                            <strong>
                              {formatCurrency(
                                collection.portfolio_value,
                                collection.currency
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>Unrealized</span>
                            <strong
                              className={
                                collection.unrealized_result >= 0
                                  ? "value-positive"
                                  : "value-negative"
                              }
                            >
                              {formatCurrency(
                                collection.unrealized_result,
                                collection.currency
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>Sold</span>
                            <strong>{collection.sold_cards}</strong>
                          </div>
                        </div>

                        <div className="collection-card-footer-meta">
                          <span>
                            {collection.market_valued_cards} market · {collection.manually_valued_cards} manual · {collection.unvalued_cards} unvalued
                          </span>
                          <span>{formatShortDate(collection.last_activity_at)}</span>
                        </div>

                        <button
                          className="collection-open-button"
                          type="button"
                          onClick={() =>
                            router.push(`/collections/${collection.id}`)
                          }
                        >
                          Open collection
                          <span>→</span>
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="panel recent-cards-panel" id="recent-cards">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Latest additions</p>
                  <h2>Recent cards</h2>
                </div>

                <span className="panel-count-badge">{cards.length} total</span>
              </div>

              {!loading && recentCards.length === 0 ? (
                <div className="empty-state compact-empty-state">
                  <div className="empty-state-icon">▱</div>
                  <h3>No cards yet</h3>
                  <p>Add or scan your first card to see it here.</p>
                </div>
              ) : (
                <div className="recent-card-list">
                  {recentCards.map((card) => (
                    <Link
                      className="recent-card-row"
                      href={`/cards/${card.id}`}
                      key={card.id}
                    >
                      <div className="recent-card-image">
                        {card.front_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={card.front_image_url}
                            alt={`${card.player_name} card front`}
                          />
                        ) : (
                          <span>NE</span>
                        )}
                      </div>

                      <div className="recent-card-copy">
                        <div>
                          <strong>{card.player_name}</strong>
                          <span>{getCardStateLabel(card.state)}</span>
                        </div>

                        <p>{getCardSubtitle(card) || "Card details not specified"}</p>
                        <small>{card.collection?.name ?? "Collection unavailable"}</small>
                      </div>

                      <div className="recent-card-value">
                        <strong>
                          {formatCurrency(
                            card.valuation_value,
                            card.collection?.currency ?? dashboardCurrency
                          )}
                        </strong>

                        <span
                          className={`valuation-source-badge valuation-source-${card.valuation_source}`}
                        >
                          {card.valuation_source === "market"
                            ? `Market${
                                card.market_confidence !== null
                                  ? ` ${Math.round(card.market_confidence)}%`
                                  : ""
                              }`
                            : card.valuation_source === "manual"
                              ? "Your estimate"
                              : "No valuation"}
                        </span>
                      </div>

                      <span className="recent-card-arrow">→</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="dashboard-side-column">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Actions</p>
                  <h2>Quick actions</h2>
                </div>
              </div>

              <div className="quick-actions">
                <button
                  className="quick-action"
                  type="button"
                  onClick={handleScanCard}
                >
                  <span className="quick-action-icon">◎</span>

                  <span>
                    <strong>Scan card</strong>
                    <small>AI identification</small>
                  </span>

                  <span className="quick-action-arrow">→</span>
                </button>

                <button
                  className="quick-action"
                  type="button"
                  onClick={() => setShowAddCard(true)}
                >
                  <span className="quick-action-icon">＋</span>

                  <span>
                    <strong>Add card manually</strong>
                    <small>Choose a collection</small>
                  </span>

                  <span className="quick-action-arrow">→</span>
                </button>

                <button
                  className="quick-action"
                  type="button"
                  onClick={() => {
                    setCreateMessage("");
                    setShowCreateCollection(true);
                  }}
                >
                  <span className="quick-action-icon">◇</span>

                  <span>
                    <strong>New collection</strong>
                    <small>PC or inventory</small>
                  </span>

                  <span className="quick-action-arrow">→</span>
                </button>

                <button className="quick-action" type="button" disabled>
                  <span className="quick-action-icon">◈</span>

                  <span>
                    <strong>New grading order</strong>
                    <small>PSA, BGS or SGC</small>
                  </span>

                  <span className="coming-soon">Soon</span>
                </button>
              </div>
            </section>

            <section className="panel sales-panel" id="sales">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Realized performance</p>
                  <h2>Sales</h2>
                </div>

                <span className="panel-count-badge">{soldCardsCount}</span>
              </div>

              <div className="sales-stat-list">
                <div>
                  <span>Gross sales</span>
                  <strong>{formatCurrency(grossSales, dashboardCurrency)}</strong>
                </div>

                <div>
                  <span>Net proceeds</span>
                  <strong>{formatCurrency(netProceeds, dashboardCurrency)}</strong>
                </div>

                <div>
                  <span>Realized profit</span>
                  <strong
                    className={realizedProfit >= 0 ? "value-positive" : "value-negative"}
                  >
                    {formatCurrency(realizedProfit, dashboardCurrency)}
                  </strong>
                </div>

                <div>
                  <span>Realized ROI</span>
                  <strong>{formatPercentage(realizedRoi)}</strong>
                </div>
              </div>

              {saleTransactions[0] && (
                <Link
                  className="latest-sale-link"
                  href={`/cards/${saleTransactions[0].card_id}`}
                >
                  <span>
                    Latest sale · {formatActivityDate(saleTransactions[0].occurred_at)}
                  </span>
                  <strong>
                    {formatCurrency(
                      saleTransactions[0].net_amount,
                      saleTransactions[0].currency
                    )}
                  </strong>
                  <b>→</b>
                </Link>
              )}
            </section>

            <section className="panel activity-panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Latest</p>
                  <h2>Recent activity</h2>
                </div>
              </div>

              {recentActivity.length === 0 ? (
                <div className="activity-empty">
                  <p>Your activity will appear here.</p>
                </div>
              ) : (
                <div className="activity-list">
                  {recentActivity.map((activity) => {
                    const content = (
                      <>
                        <span
                          className={`activity-icon activity-icon-${activity.type}`}
                        >
                          {activity.type === "sale"
                            ? "↕"
                            : activity.type === "collection"
                              ? "◇"
                              : "▱"}
                        </span>

                        <div className="activity-copy">
                          <strong>{activity.title}</strong>
                          <p>{activity.description}</p>
                          <small>{formatActivityDate(activity.occurredAt)}</small>
                        </div>

                        {activity.amount !== null && (
                          <span
                            className={`activity-amount activity-amount-${activity.tone}`}
                          >
                            {activity.type === "sale" && activity.amount > 0
                              ? "+"
                              : ""}
                            {formatCurrency(activity.amount, activity.currency)}
                          </span>
                        )}
                      </>
                    );

                    return activity.href ? (
                      <Link
                        className="activity-row"
                        href={activity.href}
                        key={activity.id}
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="activity-row" key={activity.id}>
                        {content}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="panel insight-panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Snapshot</p>
                  <h2>Portfolio insights</h2>
                </div>
              </div>

              <div className="insight-list">
                <div>
                  <span>Largest collection</span>
                  <strong>{highestValueCollection?.name ?? "—"}</strong>
                  <small>
                    {highestValueCollection
                      ? formatCurrency(
                          highestValueCollection.portfolio_value,
                          highestValueCollection.currency
                        )
                      : "No portfolio value yet"}
                  </small>
                </div>

                <div>
                  <span>Best market coverage</span>
                  <strong>{bestMarketCoverageCollection?.name ?? "—"}</strong>
                  <small>
                    {bestMarketCoverageCollection
                      ? `${Math.round(
                          bestMarketCoverageCollection.market_coverage
                        )}% market valued`
                      : "No active cards yet"}
                  </small>
                </div>
              </div>
            </section>
          </aside>
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

      {showCreateCollection && (
        <div
          className="modal-backdrop"
          onMouseDown={(event: MouseEvent<HTMLDivElement>) => {
            if (event.target === event.currentTarget) {
              setShowCreateCollection(false);
            }
          }}
        >
          <section className="modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">New collection</p>
                <h2>Create collection</h2>
              </div>

              <button
                className="modal-close-button"
                type="button"
                onClick={() => setShowCreateCollection(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <label className="field-label" htmlFor="collection-name">
                Collection name
              </label>

              <input
                className="text-input"
                id="collection-name"
                type="text"
                value={name}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setName(event.target.value)
                }
                placeholder="Example: Rookie collection"
                autoFocus
              />

              <fieldset className="collection-type-selector">
                <legend>Collection type</legend>

                <label
                  className={`type-option ${
                    type === "pc" ? "type-option-selected" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="collection-type"
                    value="pc"
                    checked={type === "pc"}
                    onChange={() => setType("pc")}
                  />

                  <span className="type-option-icon">♥</span>

                  <span>
                    <strong>Personal Collection</strong>
                    <small>Cards you collect and intend to keep</small>
                  </span>
                </label>

                <label
                  className={`type-option ${
                    type === "inventory" ? "type-option-selected" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="collection-type"
                    value="inventory"
                    checked={type === "inventory"}
                    onChange={() => setType("inventory")}
                  />

                  <span className="type-option-icon">□</span>

                  <span>
                    <strong>Dealer Inventory</strong>
                    <small>Cards held for resale or business purposes</small>
                  </span>
                </label>
              </fieldset>

              {createMessage && <p className="form-message">{createMessage}</p>}

              <div className="modal-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setShowCreateCollection(false)}
                >
                  Cancel
                </button>

                <button
                  className="primary-button"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Creating..." : "Create collection"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      <style jsx>{`
        .dashboard-message {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 18px;
          padding: 12px 14px;
          border: 1px solid rgba(96, 165, 250, 0.18);
          border-radius: 13px;
          background: rgba(59, 130, 246, 0.055);
          color: #bfdbfe;
        }

        .dashboard-message-warning {
          border-color: rgba(251, 191, 36, 0.22);
          background: rgba(245, 158, 11, 0.065);
          color: #fde68a;
        }

        .dashboard-message > span {
          flex: 0 0 auto;
          width: 22px;
          height: 22px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.07);
          font-size: 11px;
          font-weight: 800;
        }

        .dashboard-message p {
          margin: 2px 0 0;
          color: currentColor;
          font-size: 11px;
          line-height: 1.5;
          opacity: 0.82;
        }

        .dashboard-positive-card .metric-value,
        .value-positive {
          color: #86efac !important;
        }

        .dashboard-negative-card .metric-value,
        .value-negative {
          color: #fca5a5 !important;
        }

        .portfolio-health-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.55fr) minmax(300px, 0.85fr);
          gap: 20px;
          margin-top: 20px;
        }

        .coverage-panel,
        .split-panel {
          padding: 24px;
        }

        .coverage-panel-header {
          align-items: flex-start;
        }

        .coverage-description {
          max-width: 700px;
          margin: 7px 0 0;
          color: #778096;
          font-size: 11px;
          line-height: 1.55;
        }

        .coverage-score {
          flex: 0 0 auto;
          min-width: 135px;
          padding: 13px 15px;
          border: 1px solid rgba(139, 92, 246, 0.24);
          border-radius: 15px;
          background: rgba(124, 92, 255, 0.07);
          text-align: right;
        }

        .coverage-score span {
          display: block;
          color: #8d86a9;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .coverage-score strong {
          display: block;
          margin-top: 6px;
          color: #ddd6fe;
          font-size: 24px;
        }

        .coverage-progress {
          height: 10px;
          overflow: hidden;
          margin-top: 18px;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.09);
        }

        .coverage-progress span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #8b5cf6, #b19cff);
          box-shadow: 0 0 20px rgba(139, 92, 246, 0.25);
        }

        .coverage-stat-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-top: 16px;
        }

        .coverage-stat-grid > div {
          position: relative;
          min-width: 0;
          padding: 13px 14px 13px 37px;
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 13px;
          background: rgba(0, 0, 0, 0.12);
        }

        .coverage-dot {
          position: absolute;
          top: 18px;
          left: 14px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .coverage-dot-market {
          background: #a78bfa;
          box-shadow: 0 0 10px rgba(167, 139, 250, 0.55);
        }

        .coverage-dot-manual {
          background: #7aa7ff;
        }

        .coverage-dot-none {
          background: #5d6678;
        }

        .coverage-dot-grading {
          background: #60a5fa;
        }

        .coverage-stat-grid strong {
          display: block;
          color: #ffffff;
          font-size: 16px;
        }

        .coverage-stat-grid small {
          display: block;
          margin-top: 3px;
          color: #71798b;
          font-size: 9px;
        }

        .split-bar {
          display: flex;
          height: 12px;
          overflow: hidden;
          margin: 18px 0;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.08);
        }

        .split-bar-personal {
          background: linear-gradient(90deg, #db6faa, #f9a8d4);
        }

        .split-bar-inventory {
          background: linear-gradient(90deg, #5b8ce7, #93c5fd);
        }

        .split-list {
          display: grid;
          gap: 10px;
        }

        .split-list > div {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 11px;
          padding: 12px;
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 13px;
          background: rgba(0, 0, 0, 0.12);
        }

        .split-symbol {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          font-size: 13px;
        }

        .split-symbol-personal {
          border: 1px solid rgba(244, 114, 182, 0.22);
          background: rgba(244, 114, 182, 0.08);
          color: #f9a8d4;
        }

        .split-symbol-inventory {
          border: 1px solid rgba(96, 165, 250, 0.22);
          background: rgba(59, 130, 246, 0.07);
          color: #bfdbfe;
        }

        .split-list strong,
        .split-list b {
          color: #ffffff;
          font-size: 11px;
        }

        .split-list small {
          display: block;
          margin-top: 3px;
          color: #71798b;
          font-size: 9px;
        }

        .split-list b {
          font-size: 12px;
        }

        .dashboard-collection-grid {
          align-items: stretch;
        }

        .dashboard-collection-card {
          height: 100%;
        }

        .collection-coverage-badge,
        .panel-count-badge {
          flex: 0 0 auto;
          padding: 6px 9px;
          border: 1px solid rgba(167, 139, 250, 0.17);
          border-radius: 999px;
          background: rgba(139, 92, 246, 0.055);
          color: #c4b5fd;
          font-size: 8px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .collection-summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 9px;
          margin-top: 17px;
        }

        .collection-summary-grid > div {
          min-width: 0;
          padding: 10px 11px;
          border: 1px solid rgba(148, 163, 184, 0.09);
          border-radius: 11px;
          background: rgba(0, 0, 0, 0.1);
        }

        .collection-summary-grid span {
          display: block;
          color: #71798b;
          font-size: 8px;
          font-weight: 750;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .collection-summary-grid strong {
          display: block;
          overflow-wrap: anywhere;
          margin-top: 5px;
          color: #ffffff;
          font-size: 12px;
        }

        .collection-card-footer-meta {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-top: 12px;
          color: #626b7e;
          font-size: 8px;
          line-height: 1.4;
        }

        .recent-cards-panel {
          margin-top: 20px;
        }

        .compact-empty-state {
          min-height: 220px;
        }

        .recent-card-list {
          display: grid;
          gap: 9px;
        }

        .recent-card-row {
          min-width: 0;
          display: grid;
          grid-template-columns: 58px minmax(0, 1fr) auto auto;
          align-items: center;
          gap: 13px;
          padding: 11px;
          border: 1px solid rgba(148, 163, 184, 0.09);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.018);
          color: inherit;
          text-decoration: none;
          transition: border-color 150ms ease, background 150ms ease, transform 150ms ease;
        }

        .recent-card-row:hover {
          transform: translateY(-1px);
          border-color: rgba(167, 139, 250, 0.3);
          background: rgba(124, 92, 255, 0.045);
        }

        .recent-card-image {
          width: 58px;
          height: 78px;
          display: grid;
          place-items: center;
          overflow: hidden;
          border-radius: 10px;
          background: #090b11;
        }

        .recent-card-image img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: contain;
        }

        .recent-card-image span {
          color: #887bd2;
          font-size: 11px;
          font-weight: 800;
        }

        .recent-card-copy {
          min-width: 0;
        }

        .recent-card-copy > div {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 7px;
        }

        .recent-card-copy strong {
          color: #ffffff;
          font-size: 12px;
        }

        .recent-card-copy > div > span {
          padding: 4px 6px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.035);
          color: #7f8798;
          font-size: 7px;
          font-weight: 750;
          text-transform: uppercase;
        }

        .recent-card-copy p {
          overflow: hidden;
          margin: 5px 0 0;
          color: #7c8597;
          font-size: 9px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .recent-card-copy small {
          display: block;
          margin-top: 4px;
          color: #5f687a;
          font-size: 8px;
        }

        .recent-card-value {
          min-width: 110px;
          text-align: right;
        }

        .recent-card-value > strong {
          display: block;
          color: #ffffff;
          font-size: 12px;
        }

        .valuation-source-badge {
          display: inline-flex;
          margin-top: 6px;
          padding: 4px 6px;
          border-radius: 999px;
          font-size: 7px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .valuation-source-market {
          background: rgba(139, 92, 246, 0.08);
          color: #c4b5fd;
        }

        .valuation-source-manual {
          background: rgba(59, 130, 246, 0.07);
          color: #bfdbfe;
        }

        .valuation-source-none {
          background: rgba(148, 163, 184, 0.06);
          color: #71798b;
        }

        .recent-card-arrow {
          color: #8e82d9;
          font-size: 15px;
        }

        .sales-stat-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 9px;
        }

        .sales-stat-list > div {
          min-width: 0;
          padding: 12px;
          border: 1px solid rgba(148, 163, 184, 0.09);
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.11);
        }

        .sales-stat-list span,
        .insight-list span {
          display: block;
          color: #71798b;
          font-size: 8px;
          font-weight: 750;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .sales-stat-list strong {
          display: block;
          margin-top: 5px;
          color: #ffffff;
          font-size: 12px;
        }

        .latest-sale-link {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto auto;
          align-items: center;
          gap: 9px;
          margin-top: 11px;
          padding: 11px 12px;
          border: 1px solid rgba(52, 211, 153, 0.12);
          border-radius: 12px;
          background: rgba(16, 185, 129, 0.04);
          color: inherit;
          text-decoration: none;
        }

        .latest-sale-link span {
          color: #7c8795;
          font-size: 9px;
        }

        .latest-sale-link strong {
          color: #a7f3d0;
          font-size: 11px;
        }

        .latest-sale-link b {
          color: #86efac;
        }

        .activity-list {
          display: grid;
        }

        .activity-row {
          min-width: 0;
          display: grid;
          grid-template-columns: 32px minmax(0, 1fr) auto;
          align-items: start;
          gap: 10px;
          padding: 11px 0;
          border-bottom: 1px solid rgba(148, 163, 184, 0.08);
          color: inherit;
          text-decoration: none;
        }

        .activity-row:last-child {
          border-bottom: 0;
        }

        a.activity-row:hover .activity-copy strong {
          color: #c4b5fd;
        }

        .activity-icon {
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 800;
        }

        .activity-icon-card {
          background: rgba(139, 92, 246, 0.07);
          color: #c4b5fd;
        }

        .activity-icon-sale {
          background: rgba(16, 185, 129, 0.06);
          color: #a7f3d0;
        }

        .activity-icon-collection {
          background: rgba(59, 130, 246, 0.06);
          color: #bfdbfe;
        }

        .activity-copy {
          min-width: 0;
        }

        .activity-copy strong {
          display: block;
          color: #d9dde6;
          font-size: 10px;
          transition: color 150ms ease;
        }

        .activity-copy p {
          overflow: hidden;
          margin: 4px 0 0;
          color: #71798b;
          font-size: 8px;
          line-height: 1.4;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .activity-copy small {
          display: block;
          margin-top: 4px;
          color: #555f71;
          font-size: 8px;
        }

        .activity-amount {
          padding-top: 2px;
          color: #9aa1af;
          font-size: 9px;
          font-weight: 750;
          white-space: nowrap;
        }

        .activity-amount-positive {
          color: #86efac;
        }

        .activity-amount-negative {
          color: #fca5a5;
        }

        .activity-empty {
          padding: 25px 0 10px;
          color: #71798b;
          font-size: 10px;
          text-align: center;
        }

        .insight-list {
          display: grid;
          gap: 9px;
        }

        .insight-list > div {
          padding: 12px;
          border: 1px solid rgba(148, 163, 184, 0.09);
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.11);
        }

        .insight-list strong {
          display: block;
          margin-top: 5px;
          color: #ffffff;
          font-size: 11px;
        }

        .insight-list small {
          display: block;
          margin-top: 4px;
          color: #71798b;
          font-size: 8px;
        }

        @media (max-width: 1180px) {
          .portfolio-health-grid {
            grid-template-columns: 1fr;
          }

          .coverage-stat-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .coverage-panel-header,
          .panel-header {
            align-items: flex-start;
          }

          .coverage-score {
            min-width: 110px;
          }

          .recent-card-row {
            grid-template-columns: 50px minmax(0, 1fr) auto;
          }

          .recent-card-image {
            width: 50px;
            height: 68px;
          }

          .recent-card-value {
            min-width: 95px;
          }

          .recent-card-arrow {
            display: none;
          }
        }

        @media (max-width: 560px) {
          .coverage-panel,
          .split-panel {
            padding: 19px;
          }

          .coverage-panel-header {
            flex-direction: column;
          }

          .coverage-score {
            width: 100%;
            text-align: left;
          }

          .coverage-stat-grid,
          .collection-summary-grid,
          .sales-stat-list {
            grid-template-columns: 1fr;
          }

          .recent-card-row {
            grid-template-columns: 46px minmax(0, 1fr);
          }

          .recent-card-image {
            width: 46px;
            height: 62px;
          }

          .recent-card-value {
            grid-column: 1 / -1;
            display: flex;
            align-items: center;
            justify-content: space-between;
            min-width: 0;
            padding-top: 8px;
            border-top: 1px solid rgba(148, 163, 184, 0.08);
            text-align: left;
          }

          .collection-card-footer-meta {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
