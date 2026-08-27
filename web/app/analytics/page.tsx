"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";

type NumericDatabaseValue = number | string | null;
type CollectionType = "pc" | "inventory";
type ValuationSource = "market" | "manual" | "none";
type DateRange = "30" | "90" | "365" | "all";

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
  market_value_confidence: NumericDatabaseValue;
  market_value_updated_at: string | null;
  state: string | null;
  created_at: string;
};

type CardAttributeRow = {
  card_id: string;
  attribute_key: string;
  attribute_value: unknown;
};

type SaleRow = {
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

type AnalyticsCard = CardRow & {
  collection: CollectionRow | null;
  purchaseValue: number;
  valuationValue: number | null;
  valuationSource: ValuationSource;
  marketConfidence: number | null;
  sport: string | null;
  team: string | null;
  brand: string | null;
  product: string | null;
  gradingCompany: string | null;
  grade: string | null;
  isGraded: boolean;
};

type AnalyticsSale = {
  id: string;
  cardId: string;
  collectionId: string | null;
  occurredAt: string;
  currency: string;
  grossAmount: number;
  feesAndCosts: number;
  costBasis: number;
  netAmount: number;
  realizedProfit: number;
  realizedRoi: number | null;
  platform: string;
  counterparty: string | null;
  reference: string | null;
};

type NavigationItem = {
  label: string;
  icon: string;
  href?: string;
  active?: boolean;
  comingSoon?: boolean;
};

type BreakdownItem = {
  label: string;
  count: number;
  value: number;
};

type CollectionPerformance = {
  id: string;
  name: string;
  type: CollectionType;
  activeCards: number;
  portfolioValue: number;
  activeCost: number;
  unrealizedResult: number;
  marketCoverage: number;
};

type PerformanceBucket = {
  key: string;
  label: string;
  start: Date;
  end: Date;
  gross: number;
  net: number;
  profit: number;
  count: number;
};

const navigation: NavigationItem[] = [
  { label: "Home", icon: "⌂", href: "/" },
  { label: "Collections", icon: "◇", href: "/#collections" },
  { label: "Cards", icon: "▱", href: "/cards" },
  { label: "Scanner", icon: "◎", href: "/scanner" },
  { label: "Grading", icon: "◈", comingSoon: true },
  { label: "Transactions", icon: "↕", href: "/transactions" },
  { label: "Analytics", icon: "⌁", active: true },
];

const ATTRIBUTE_KEYS = [
  "sport",
  "team",
  "brand",
  "product",
  "grading_company",
  "grade",
] as const;

function toNumber(value: NumericDatabaseValue) {
  if (value === null || value === "") {
    return 0;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function toOptionalNumber(value: NumericDatabaseValue) {
  if (value === null || value === "") {
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

function getCardValuation(
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

function normalizeSale(row: SaleRow): AnalyticsSale {
  const grossAmount =
    toNumber(row.item_amount) + toNumber(row.shipping_income);
  const feesAndCosts =
    toNumber(row.platform_fee) +
    toNumber(row.payment_fee) +
    toNumber(row.shipping_cost) +
    toNumber(row.other_costs);
  const costBasis = toNumber(row.cost_basis);
  const realizedProfit = toNumber(row.realized_profit);

  return {
    id: row.id,
    cardId: row.card_id,
    collectionId: row.collection_id,
    occurredAt: row.occurred_at,
    currency: row.currency,
    grossAmount,
    feesAndCosts,
    costBasis,
    netAmount: toNumber(row.net_amount),
    realizedProfit,
    realizedRoi:
      costBasis > 0 ? (realizedProfit / costBasis) * 100 : null,
    platform: row.platform?.trim() || "Other",
    counterparty: row.counterparty,
    reference: row.reference,
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
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getDateRangeLabel(range: DateRange) {
  switch (range) {
    case "30":
      return "Last 30 days";
    case "90":
      return "Last 90 days";
    case "365":
      return "Last 12 months";
    case "all":
      return "All time";
  }
}

function getCutoffDate(range: DateRange) {
  if (range === "all") {
    return null;
  }

  const days = Number(range);
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
}

function startOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function endOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(23, 59, 59, 999);
  return nextDate;
}

function buildPerformanceBuckets(
  sales: AnalyticsSale[],
  range: DateRange
): PerformanceBucket[] {
  const now = new Date();
  const buckets: PerformanceBucket[] = [];

  if (range === "30" || range === "90") {
    const totalDays = range === "30" ? 30 : 90;
    const bucketCount = range === "30" ? 5 : 6;
    const bucketDays = Math.ceil(totalDays / bucketCount);

    for (let index = bucketCount - 1; index >= 0; index -= 1) {
      const end = endOfDay(
        new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - index * bucketDays
        )
      );
      const start = startOfDay(
        new Date(
          end.getFullYear(),
          end.getMonth(),
          end.getDate() - bucketDays + 1
        )
      );

      buckets.push({
        key: `${start.toISOString()}-${end.toISOString()}`,
        label: new Intl.DateTimeFormat("da-DK", {
          day: "numeric",
          month: "short",
        }).format(start),
        start,
        end,
        gross: 0,
        net: 0,
        profit: 0,
        count: 0,
      });
    }
  } else {
    const monthCount = 12;

    for (let index = monthCount - 1; index >= 0; index -= 1) {
      const start = new Date(
        now.getFullYear(),
        now.getMonth() - index,
        1
      );
      const end = new Date(
        now.getFullYear(),
        now.getMonth() - index + 1,
        0,
        23,
        59,
        59,
        999
      );

      buckets.push({
        key: `${start.getFullYear()}-${start.getMonth()}`,
        label: new Intl.DateTimeFormat("da-DK", {
          month: "short",
        }).format(start),
        start,
        end,
        gross: 0,
        net: 0,
        profit: 0,
        count: 0,
      });
    }
  }

  for (const sale of sales) {
    const occurredAt = new Date(sale.occurredAt);

    if (Number.isNaN(occurredAt.getTime())) {
      continue;
    }

    const bucket = buckets.find(
      (candidate) =>
        occurredAt >= candidate.start && occurredAt <= candidate.end
    );

    if (!bucket) {
      continue;
    }

    bucket.gross += sale.grossAmount;
    bucket.net += sale.netAmount;
    bucket.profit += sale.realizedProfit;
    bucket.count += 1;
  }

  return buckets;
}

function aggregateCards(
  cards: AnalyticsCard[],
  getLabel: (card: AnalyticsCard) => string
): BreakdownItem[] {
  const aggregates = new Map<string, BreakdownItem>();

  for (const card of cards) {
    const label = getLabel(card).trim() || "Unknown";
    const existing = aggregates.get(label) ?? {
      label,
      count: 0,
      value: 0,
    };

    existing.count += 1;
    existing.value += card.valuationValue ?? 0;
    aggregates.set(label, existing);
  }

  return Array.from(aggregates.values()).sort(
    (first, second) =>
      second.value - first.value || second.count - first.count
  );
}

function getCardSubtitle(card: AnalyticsCard) {
  return [
    card.year,
    card.brand ?? card.manufacturer,
    card.product ?? card.set_name,
    card.card_number ? `#${card.card_number}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function AnalyticsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [cards, setCards] = useState<AnalyticsCard[]>([]);
  const [sales, setSales] = useState<AnalyticsSale[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] =
    useState("all");
  const [dateRange, setDateRange] = useState<DateRange>("365");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadAnalytics = useCallback(async () => {
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

    const [collectionResult, cardResult, saleResult] =
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
          .eq("user_id", user.id)
          .eq("transaction_type", "sale")
          .eq("status", "completed")
          .order("occurred_at", { ascending: false }),
      ]);

    if (collectionResult.error) {
      setMessage(
        `Collections kunne ikke indlæses: ${collectionResult.error.message}`
      );
      setCollections([]);
      setCards([]);
      setSales([]);
      setLoading(false);
      return;
    }

    if (cardResult.error) {
      setMessage(`Kort kunne ikke indlæses: ${cardResult.error.message}`);
      setCollections((collectionResult.data ?? []) as CollectionRow[]);
      setCards([]);
      setSales([]);
      setLoading(false);
      return;
    }

    const warnings: string[] = [];
    const collectionRows = (collectionResult.data ?? []) as CollectionRow[];
    const cardRows = (cardResult.data ?? []) as CardRow[];
    const saleRows = saleResult.error
      ? []
      : ((saleResult.data ?? []) as SaleRow[]).map(normalizeSale);

    if (saleResult.error) {
      console.error("Salg kunne ikke indlæses:", saleResult.error);
      warnings.push("Salgstallene kunne ikke indlæses.");
    }

    const attributesByCardId = new Map<string, CardAttributeRow[]>();

    if (cardRows.length > 0) {
      const attributeResult = await supabase
        .from("card_attributes")
        .select(`
          card_id,
          attribute_key,
          attribute_value
        `)
        .eq("user_id", user.id)
        .in(
          "card_id",
          cardRows.map((card) => card.id)
        )
        .in("attribute_key", Array.from(ATTRIBUTE_KEYS));

      if (attributeResult.error) {
        console.error(
          "Card attributes kunne ikke indlæses:",
          attributeResult.error
        );
        warnings.push("Nogle Card DNA-felter kunne ikke indlæses.");
      } else {
        for (const attribute of (attributeResult.data ?? []) as CardAttributeRow[]) {
          const current = attributesByCardId.get(attribute.card_id) ?? [];
          current.push(attribute);
          attributesByCardId.set(attribute.card_id, current);
        }
      }
    }

    const collectionById = new Map(
      collectionRows.map((collection) => [collection.id, collection])
    );

    const enrichedCards = cardRows.map((card) => {
      const collection =
        collectionById.get(card.current_collection_id) ?? null;
      const collectionCurrency = collection?.currency ?? "DKK";
      const valuation = getCardValuation(card, collectionCurrency);
      const attributes = attributesByCardId.get(card.id) ?? [];
      const gradingCompany = getStringAttribute(
        attributes,
        "grading_company"
      );
      const grade = getStringAttribute(attributes, "grade");

      return {
        ...card,
        collection,
        purchaseValue: toNumber(card.purchase_price),
        valuationValue: valuation.value,
        valuationSource: valuation.source,
        marketConfidence: toOptionalNumber(card.market_value_confidence),
        sport: getStringAttribute(attributes, "sport"),
        team: getStringAttribute(attributes, "team"),
        brand: getStringAttribute(attributes, "brand"),
        product: getStringAttribute(attributes, "product"),
        gradingCompany,
        grade,
        isGraded: Boolean(gradingCompany && grade),
      } satisfies AnalyticsCard;
    });

    setCollections(collectionRows);
    setCards(enrichedCards);
    setSales(saleRows);

    if (warnings.length > 0) {
      setMessage(Array.from(new Set(warnings)).join(" "));
    }

    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const selectedCollection = useMemo(
    () =>
      collections.find(
        (collection) => collection.id === selectedCollectionId
      ) ?? null,
    [collections, selectedCollectionId]
  );

  const analyticsCurrency = selectedCollection?.currency ?? "DKK";

  const collectionFilteredCards = useMemo(
    () =>
      cards.filter((card) =>
        selectedCollectionId === "all"
          ? true
          : card.current_collection_id === selectedCollectionId
      ),
    [cards, selectedCollectionId]
  );

  const currencyCompatibleCards = useMemo(
    () =>
      collectionFilteredCards.filter(
        (card) => (card.collection?.currency ?? "DKK") === analyticsCurrency
      ),
    [analyticsCurrency, collectionFilteredCards]
  );

  const excludedCurrencyCards =
    collectionFilteredCards.length - currencyCompatibleCards.length;

  const activeCards = useMemo(
    () =>
      currencyCompatibleCards.filter(
        (card) => card.state !== "sold" && card.state !== "archived"
      ),
    [currencyCompatibleCards]
  );

  const cutoffDate = useMemo(() => getCutoffDate(dateRange), [dateRange]);

  const collectionFilteredSales = useMemo(
    () =>
      sales.filter((sale) => {
        if (
          selectedCollectionId !== "all" &&
          sale.collectionId !== selectedCollectionId
        ) {
          return false;
        }

        if (cutoffDate && new Date(sale.occurredAt) < cutoffDate) {
          return false;
        }

        return true;
      }),
    [cutoffDate, sales, selectedCollectionId]
  );

  const filteredSales = useMemo(
    () =>
      collectionFilteredSales.filter(
        (sale) => sale.currency === analyticsCurrency
      ),
    [analyticsCurrency, collectionFilteredSales]
  );

  const excludedCurrencySales =
    collectionFilteredSales.length - filteredSales.length;

  const activeCost = activeCards.reduce(
    (total, card) => total + card.purchaseValue,
    0
  );
  const portfolioValue = activeCards.reduce(
    (total, card) => total + (card.valuationValue ?? 0),
    0
  );
  const unrealizedResult = portfolioValue - activeCost;
  const unrealizedRoi =
    activeCost > 0 ? (unrealizedResult / activeCost) * 100 : null;

  const marketValuedCards = activeCards.filter(
    (card) => card.valuationSource === "market"
  );
  const manuallyValuedCards = activeCards.filter(
    (card) => card.valuationSource === "manual"
  );
  const unvaluedCards = activeCards.filter(
    (card) => card.valuationSource === "none"
  );
  const gradedCards = activeCards.filter((card) => card.isGraded);

  const marketCoverage =
    activeCards.length > 0
      ? (marketValuedCards.length / activeCards.length) * 100
      : 0;
  const totalCoverage =
    activeCards.length > 0
      ? ((marketValuedCards.length + manuallyValuedCards.length) /
          activeCards.length) *
        100
      : 0;
  const gradedShare =
    activeCards.length > 0
      ? (gradedCards.length / activeCards.length) * 100
      : 0;

  const grossSales = filteredSales.reduce(
    (total, sale) => total + sale.grossAmount,
    0
  );
  const netProceeds = filteredSales.reduce(
    (total, sale) => total + sale.netAmount,
    0
  );
  const realizedProfit = filteredSales.reduce(
    (total, sale) => total + sale.realizedProfit,
    0
  );
  const soldCostBasis = filteredSales.reduce(
    (total, sale) => total + sale.costBasis,
    0
  );
  const realizedRoi =
    soldCostBasis > 0 ? (realizedProfit / soldCostBasis) * 100 : null;

  const performanceBuckets = useMemo(
    () => buildPerformanceBuckets(filteredSales, dateRange),
    [dateRange, filteredSales]
  );

  const collectionPerformance = useMemo<CollectionPerformance[]>(() => {
    return collections
      .filter(
        (collection) =>
          collection.currency === analyticsCurrency &&
          (selectedCollectionId === "all" ||
            collection.id === selectedCollectionId)
      )
      .map((collection) => {
        const collectionCards = activeCards.filter(
          (card) => card.current_collection_id === collection.id
        );
        const activeCostValue = collectionCards.reduce(
          (total, card) => total + card.purchaseValue,
          0
        );
        const value = collectionCards.reduce(
          (total, card) => total + (card.valuationValue ?? 0),
          0
        );
        const marketCount = collectionCards.filter(
          (card) => card.valuationSource === "market"
        ).length;

        return {
          id: collection.id,
          name: collection.name,
          type: collection.type,
          activeCards: collectionCards.length,
          portfolioValue: value,
          activeCost: activeCostValue,
          unrealizedResult: value - activeCostValue,
          marketCoverage:
            collectionCards.length > 0
              ? (marketCount / collectionCards.length) * 100
              : 0,
        };
      })
      .sort((first, second) => second.portfolioValue - first.portfolioValue);
  }, [
    activeCards,
    analyticsCurrency,
    collections,
    selectedCollectionId,
  ]);

  const personalValue = activeCards
    .filter((card) => card.collection?.type === "pc")
    .reduce((total, card) => total + (card.valuationValue ?? 0), 0);
  const inventoryValue = activeCards
    .filter((card) => card.collection?.type === "inventory")
    .reduce((total, card) => total + (card.valuationValue ?? 0), 0);
  const splitTotal = personalValue + inventoryValue;
  const personalShare =
    splitTotal > 0 ? (personalValue / splitTotal) * 100 : 0;

  const sportBreakdown = useMemo(
    () => aggregateCards(activeCards, (card) => card.sport ?? "Unknown"),
    [activeCards]
  );
  const manufacturerBreakdown = useMemo(
    () =>
      aggregateCards(
        activeCards,
        (card) => card.manufacturer ?? card.brand ?? "Unknown"
      ),
    [activeCards]
  );
  const conditionBreakdown = useMemo(
    () =>
      aggregateCards(activeCards, (card) =>
        card.isGraded ? "Graded" : "RAW"
      ),
    [activeCards]
  );

  const platformBreakdown = useMemo(() => {
    const aggregates = new Map<string, BreakdownItem>();

    for (const sale of filteredSales) {
      const current = aggregates.get(sale.platform) ?? {
        label: sale.platform,
        count: 0,
        value: 0,
      };
      current.count += 1;
      current.value += sale.netAmount;
      aggregates.set(sale.platform, current);
    }

    return Array.from(aggregates.values()).sort(
      (first, second) => second.value - first.value
    );
  }, [filteredSales]);

  const topHoldings = useMemo(
    () =>
      [...activeCards]
        .filter((card) => card.valuationValue !== null)
        .sort(
          (first, second) =>
            (second.valuationValue ?? 0) - (first.valuationValue ?? 0)
        )
        .slice(0, 5),
    [activeCards]
  );

  const cardById = useMemo(
    () => new Map(cards.map((card) => [card.id, card])),
    [cards]
  );

  const topRealizedSales = useMemo(
    () =>
      [...filteredSales]
        .sort(
          (first, second) =>
            second.realizedProfit - first.realizedProfit
        )
        .slice(0, 5),
    [filteredSales]
  );

  function handleCollectionChange(event: ChangeEvent<HTMLSelectElement>) {
    setSelectedCollectionId(event.target.value);
  }

  function handleRangeChange(event: ChangeEvent<HTMLSelectElement>) {
    setDateRange(event.target.value as DateRange);
  }

  return (
    <div className="analytics-shell">
      <aside className="sidebar">
        <div>
          <Link className="brand" href="/">
            <div className="brand-mark">V</div>

            <div>
              <p className="brand-name">Vallective</p>
              <p className="brand-subtitle">Collector Intelligence</p>
            </div>
          </Link>

          <nav className="navigation">
            <p className="navigation-label">Workspace</p>

            {navigation.map((item) => {
              if (item.href && !item.comingSoon) {
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
                  disabled
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
          </div>
        </div>
      </aside>

      <main className="analytics-main">
        <header className="analytics-header">
          <div>
            <p className="eyebrow">Performance center</p>
            <h1>Analytics</h1>
            <p>
              Understand portfolio value, valuation quality and realized
              performance across every collection.
            </p>
          </div>

          <div className="analytics-controls">
            <label>
              <span>Collection</span>
              <select
                value={selectedCollectionId}
                onChange={handleCollectionChange}
              >
                <option value="all">All collections</option>
                {collections.map((collection) => (
                  <option value={collection.id} key={collection.id}>
                    {collection.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Sales period</span>
              <select value={dateRange} onChange={handleRangeChange}>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last 12 months</option>
                <option value="all">All time</option>
              </select>
            </label>
          </div>
        </header>

        {message && (
          <div className="analytics-message" role="status">
            <span>i</span>
            <p>{message}</p>
          </div>
        )}

        {(excludedCurrencyCards > 0 || excludedCurrencySales > 0) && (
          <div className="currency-warning">
            <span>!</span>
            <p>
              {excludedCurrencyCards} card(s) and {excludedCurrencySales}
              transaction(s) in another currency are excluded from the
              {` ${analyticsCurrency} `}
              totals.
            </p>
          </div>
        )}

        {loading ? (
          <div className="analytics-loading">
            <span className="loading-spinner" />
            <p>Building your analytics...</p>
          </div>
        ) : (
          <>
            <section className="metric-grid">
              <MetricCard
                label="Portfolio value"
                value={formatCurrency(portfolioValue, analyticsCurrency)}
                caption={`${activeCards.length} active cards`}
                featured
              />

              <MetricCard
                label="Active cost basis"
                value={formatCurrency(activeCost, analyticsCurrency)}
                caption={`Unrealized ROI ${formatPercentage(unrealizedRoi)}`}
              />

              <MetricCard
                label="Unrealized result"
                value={formatCurrency(unrealizedResult, analyticsCurrency)}
                caption="Current value minus active cost"
                tone={unrealizedResult >= 0 ? "positive" : "negative"}
              />

              <MetricCard
                label="Realized profit"
                value={formatCurrency(realizedProfit, analyticsCurrency)}
                caption={`${filteredSales.length} sales · ROI ${formatPercentage(
                  realizedRoi
                )}`}
                tone={realizedProfit >= 0 ? "positive" : "negative"}
              />
            </section>

            <section className="secondary-metrics">
              <SmallMetric
                label="Market coverage"
                value={formatPercentage(marketCoverage)}
                caption={`${marketValuedCards.length} market valued`}
              />
              <SmallMetric
                label="Total coverage"
                value={formatPercentage(totalCoverage)}
                caption={`${unvaluedCards.length} without valuation`}
              />
              <SmallMetric
                label="Graded share"
                value={formatPercentage(gradedShare)}
                caption={`${gradedCards.length} graded active cards`}
              />
              <SmallMetric
                label="Net proceeds"
                value={formatCurrency(netProceeds, analyticsCurrency)}
                caption={`${formatCurrency(grossSales, analyticsCurrency)} gross`}
              />
            </section>

            <section className="analytics-grid analytics-grid-wide">
              <article className="panel performance-panel">
                <PanelHeader
                  eyebrow="Realized performance"
                  title="Sales and profit over time"
                  caption={`${getDateRangeLabel(dateRange)} · ${filteredSales.length} completed sales`}
                />

                <PerformanceChart
                  buckets={performanceBuckets}
                  currency={analyticsCurrency}
                />

                <div className="performance-footer">
                  <div>
                    <span>Gross sales</span>
                    <strong>{formatCurrency(grossSales, analyticsCurrency)}</strong>
                  </div>
                  <div>
                    <span>Net proceeds</span>
                    <strong>{formatCurrency(netProceeds, analyticsCurrency)}</strong>
                  </div>
                  <div>
                    <span>Cost basis sold</span>
                    <strong>{formatCurrency(soldCostBasis, analyticsCurrency)}</strong>
                  </div>
                  <div>
                    <span>Realized ROI</span>
                    <strong>{formatPercentage(realizedRoi)}</strong>
                  </div>
                </div>
              </article>

              <article className="panel split-panel">
                <PanelHeader
                  eyebrow="Portfolio split"
                  title="PC vs. inventory"
                  caption="Active portfolio value by collection type"
                />

                <div className="split-total">
                  <span>Total active value</span>
                  <strong>{formatCurrency(splitTotal, analyticsCurrency)}</strong>
                </div>

                <div className="split-bar" aria-label="Portfolio split">
                  <span style={{ width: `${personalShare}%` }} />
                  <span style={{ width: `${100 - personalShare}%` }} />
                </div>

                <div className="split-cards">
                  <div>
                    <span className="split-icon split-icon-pc">♥</span>
                    <div>
                      <small>Personal Collection</small>
                      <strong>{formatCurrency(personalValue, analyticsCurrency)}</strong>
                    </div>
                  </div>

                  <div>
                    <span className="split-icon split-icon-inventory">□</span>
                    <div>
                      <small>Dealer Inventory</small>
                      <strong>{formatCurrency(inventoryValue, analyticsCurrency)}</strong>
                    </div>
                  </div>
                </div>
              </article>
            </section>

            <section className="analytics-grid analytics-grid-equal">
              <article className="panel coverage-panel">
                <PanelHeader
                  eyebrow="Valuation quality"
                  title="Coverage"
                  caption="How much of the active portfolio has a usable value"
                />

                <div className="coverage-summary">
                  <div>
                    <span>Market coverage</span>
                    <strong>{formatPercentage(marketCoverage)}</strong>
                  </div>
                  <div>
                    <span>Total coverage</span>
                    <strong>{formatPercentage(totalCoverage)}</strong>
                  </div>
                </div>

                <div className="coverage-track">
                  <span
                    className="coverage-market"
                    style={{ width: `${marketCoverage}%` }}
                  />
                  <span
                    className="coverage-manual"
                    style={{
                      width: `${Math.max(0, totalCoverage - marketCoverage)}%`,
                      left: `${marketCoverage}%`,
                    }}
                  />
                </div>

                <div className="coverage-legend">
                  <CoverageItem
                    label="Market valued"
                    value={marketValuedCards.length}
                    tone="market"
                  />
                  <CoverageItem
                    label="Your estimate"
                    value={manuallyValuedCards.length}
                    tone="manual"
                  />
                  <CoverageItem
                    label="No valuation"
                    value={unvaluedCards.length}
                    tone="none"
                  />
                  <CoverageItem
                    label="Graded"
                    value={gradedCards.length}
                    tone="graded"
                  />
                </div>
              </article>

              <article className="panel collection-panel">
                <PanelHeader
                  eyebrow="Collections"
                  title="Collection performance"
                  caption="Value, cost and market coverage by collection"
                />

                {collectionPerformance.length > 0 ? (
                  <div className="collection-performance-list">
                    {collectionPerformance.map((collection) => (
                      <Link
                        className="collection-performance-row"
                        href={`/collections/${collection.id}`}
                        key={collection.id}
                      >
                        <div className="collection-performance-name">
                          <span>
                            {collection.type === "pc" ? "♥" : "□"}
                          </span>
                          <div>
                            <strong>{collection.name}</strong>
                            <small>
                              {collection.activeCards} active · {Math.round(
                                collection.marketCoverage
                              )}% market
                            </small>
                          </div>
                        </div>

                        <div>
                          <strong>
                            {formatCurrency(
                              collection.portfolioValue,
                              analyticsCurrency
                            )}
                          </strong>
                          <small
                            className={
                              collection.unrealizedResult >= 0
                                ? "result-positive"
                                : "result-negative"
                            }
                          >
                            {collection.unrealizedResult >= 0 ? "+" : ""}
                            {formatCurrency(
                              collection.unrealizedResult,
                              analyticsCurrency
                            )}
                          </small>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <EmptyPanel text="No collections match the current filter." />
                )}
              </article>
            </section>

            <section className="analytics-grid analytics-grid-equal">
              <article className="panel ranking-panel">
                <PanelHeader
                  eyebrow="Active portfolio"
                  title="Largest holdings"
                  caption="Highest current valuation among active cards"
                />

                {topHoldings.length > 0 ? (
                  <div className="ranking-list">
                    {topHoldings.map((card, index) => {
                      const result =
                        (card.valuationValue ?? 0) - card.purchaseValue;

                      return (
                        <Link
                          className="ranking-row"
                          href={`/cards/${card.id}`}
                          key={card.id}
                        >
                          <span className="ranking-position">{index + 1}</span>
                          <div className="ranking-copy">
                            <strong>{card.player_name}</strong>
                            <small>{getCardSubtitle(card)}</small>
                          </div>
                          <div className="ranking-value">
                            <strong>
                              {formatCurrency(
                                card.valuationValue,
                                analyticsCurrency
                              )}
                            </strong>
                            <small
                              className={
                                result >= 0
                                  ? "result-positive"
                                  : "result-negative"
                              }
                            >
                              {result >= 0 ? "+" : ""}
                              {formatCurrency(result, analyticsCurrency)}
                            </small>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyPanel text="No valued active cards yet." />
                )}
              </article>

              <article className="panel ranking-panel">
                <PanelHeader
                  eyebrow="Completed sales"
                  title="Realized performers"
                  caption={`${getDateRangeLabel(dateRange)} · ranked by profit`}
                />

                {topRealizedSales.length > 0 ? (
                  <div className="ranking-list">
                    {topRealizedSales.map((sale, index) => {
                      const card = cardById.get(sale.cardId);

                      return (
                        <Link
                          className="ranking-row"
                          href={`/cards/${sale.cardId}`}
                          key={sale.id}
                        >
                          <span className="ranking-position">{index + 1}</span>
                          <div className="ranking-copy">
                            <strong>{card?.player_name ?? "Unknown card"}</strong>
                            <small>
                              {formatShortDate(sale.occurredAt)} · {sale.platform}
                            </small>
                          </div>
                          <div className="ranking-value">
                            <strong
                              className={
                                sale.realizedProfit >= 0
                                  ? "result-positive"
                                  : "result-negative"
                              }
                            >
                              {sale.realizedProfit >= 0 ? "+" : ""}
                              {formatCurrency(
                                sale.realizedProfit,
                                analyticsCurrency
                              )}
                            </strong>
                            <small>ROI {formatPercentage(sale.realizedRoi)}</small>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyPanel text="No completed sales in this period." />
                )}
              </article>
            </section>

            <section className="breakdown-grid">
              <BreakdownPanel
                eyebrow="Portfolio mix"
                title="Sports"
                items={sportBreakdown}
                currency={analyticsCurrency}
              />
              <BreakdownPanel
                eyebrow="Portfolio mix"
                title="Manufacturers"
                items={manufacturerBreakdown}
                currency={analyticsCurrency}
              />
              <BreakdownPanel
                eyebrow="Condition"
                title="RAW vs. graded"
                items={conditionBreakdown}
                currency={analyticsCurrency}
              />
              <BreakdownPanel
                eyebrow="Sales channels"
                title="Platforms"
                items={platformBreakdown}
                currency={analyticsCurrency}
                valueLabel="Net"
                countLabel="sales"
              />
            </section>
          </>
        )}
      </main>

      <style jsx>{`
        .analytics-shell {
          min-height: 100vh;
          background:
            radial-gradient(
              circle at 77% 2%,
              rgba(124, 92, 255, 0.08),
              transparent 32%
            ),
            #080a10;
          color: #f8fafc;
        }

        .sidebar {
          position: fixed;
          inset: 0 auto 0 0;
          z-index: 20;
          width: 310px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 34px 21px 22px;
          border-right: 1px solid rgba(148, 163, 184, 0.11);
          background: rgba(8, 10, 16, 0.97);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 8px 12px 28px;
          color: inherit;
          text-decoration: none;
        }

        .brand-mark {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          border-radius: 15px;
          background: linear-gradient(135deg, #8b5cf6, #6d5ce7);
          box-shadow: 0 12px 30px rgba(124, 92, 255, 0.28);
          color: #ffffff;
          font-size: 20px;
          font-weight: 800;
        }

        .brand-name,
        .brand-subtitle {
          margin: 0;
        }

        .brand-name {
          color: #ffffff;
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .brand-subtitle {
          margin-top: 4px;
          color: #6f7890;
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .navigation-label {
          margin: 0 14px 12px;
          color: #5e6678;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }

        .navigation {
          display: grid;
          gap: 6px;
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
          border-radius: 12px;
          background: transparent;
          color: #8e97aa;
          font: inherit;
          font-size: 13px;
          text-align: left;
          text-decoration: none;
        }

        .navigation-item:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.025);
          color: #ffffff;
        }

        .navigation-item-active {
          background: rgba(124, 92, 255, 0.16) !important;
          color: #ddd6fe !important;
        }

        .navigation-item:disabled,
        .settings-button:disabled {
          cursor: not-allowed;
        }

        .navigation-icon {
          width: 20px;
          display: inline-flex;
          justify-content: center;
          color: #9ca4b8;
          font-size: 15px;
        }

        .coming-soon {
          margin-left: auto;
          padding: 4px 7px;
          border: 1px solid rgba(148, 163, 184, 0.13);
          border-radius: 7px;
          color: #5d6576;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .sidebar-footer {
          display: grid;
          gap: 12px;
        }

        .settings-button {
          justify-content: flex-start;
        }

        .user-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 13px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.025);
        }

        .user-avatar {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          background: #171b27;
          color: #d8dce6;
          font-size: 11px;
          font-weight: 800;
        }

        .user-information p,
        .user-information span {
          margin: 0;
        }

        .user-information p {
          color: #ffffff;
          font-size: 11px;
          font-weight: 750;
        }

        .user-information span {
          display: block;
          margin-top: 4px;
          color: #667085;
          font-size: 9px;
        }

        .analytics-main {
          min-height: 100vh;
          margin-left: 310px;
          padding: 48px 56px 72px;
        }

        .analytics-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 30px;
          max-width: 1500px;
          margin: 0 auto 28px;
        }

        .eyebrow {
          margin: 0;
          color: #9f93ff;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .analytics-header h1 {
          margin: 10px 0 0;
          color: #ffffff;
          font-size: clamp(44px, 6vw, 72px);
          line-height: 0.96;
          letter-spacing: -0.055em;
        }

        .analytics-header > div:first-child > p:last-child {
          max-width: 760px;
          margin: 16px 0 0;
          color: #9299aa;
          font-size: 14px;
          line-height: 1.6;
        }

        .analytics-controls {
          flex: 0 0 auto;
          display: flex;
          gap: 11px;
        }

        .analytics-controls label {
          min-width: 180px;
          display: grid;
          gap: 7px;
        }

        .analytics-controls span {
          color: #6f7890;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }

        .analytics-controls select {
          min-height: 44px;
          padding: 0 38px 0 13px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 12px;
          outline: none;
          background: #11141d;
          color: #e5e7eb;
          font: inherit;
          font-size: 12px;
        }

        .analytics-controls select:focus {
          border-color: rgba(167, 139, 250, 0.55);
          box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.06);
        }

        .analytics-message,
        .currency-warning {
          max-width: 1500px;
          display: flex;
          align-items: flex-start;
          gap: 11px;
          margin: 0 auto 18px;
          padding: 13px 15px;
          border-radius: 13px;
          font-size: 11px;
        }

        .analytics-message {
          border: 1px solid rgba(96, 165, 250, 0.17);
          background: rgba(59, 130, 246, 0.05);
          color: #bfdbfe;
        }

        .currency-warning {
          border: 1px solid rgba(251, 191, 36, 0.2);
          background: rgba(245, 158, 11, 0.06);
          color: #d6b967;
        }

        .analytics-message p,
        .currency-warning p {
          margin: 0;
          line-height: 1.55;
        }

        .analytics-loading {
          min-height: 60vh;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 13px;
          color: #81899c;
        }

        .loading-spinner {
          width: 28px;
          height: 28px;
          border: 2px solid rgba(167, 139, 250, 0.16);
          border-top-color: #a78bfa;
          border-radius: 50%;
          animation: spin 700ms linear infinite;
        }

        .metric-grid,
        .secondary-metrics,
        .analytics-grid,
        .breakdown-grid {
          max-width: 1500px;
          margin-left: auto;
          margin-right: auto;
        }

        .metric-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        .secondary-metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-top: 12px;
        }

        .analytics-grid {
          display: grid;
          gap: 18px;
          margin-top: 18px;
        }

        .analytics-grid-wide {
          grid-template-columns: minmax(0, 1.65fr) minmax(320px, 0.75fr);
        }

        .analytics-grid-equal {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .breakdown-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
          margin-top: 18px;
        }

        .panel {
          min-width: 0;
          padding: 24px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 21px;
          background:
            radial-gradient(
              circle at top right,
              rgba(124, 92, 255, 0.055),
              transparent 38%
            ),
            #10131b;
          box-shadow: 0 18px 55px rgba(0, 0, 0, 0.16);
        }

        .performance-footer {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 9px;
          margin-top: 16px;
        }

        .performance-footer > div,
        .coverage-summary > div {
          min-width: 0;
          padding: 13px 14px;
          border: 1px solid rgba(148, 163, 184, 0.09);
          border-radius: 13px;
          background: rgba(0, 0, 0, 0.12);
        }

        .performance-footer span,
        .coverage-summary span,
        .split-total span {
          display: block;
          color: #6f7890;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .performance-footer strong,
        .coverage-summary strong,
        .split-total strong {
          display: block;
          margin-top: 7px;
          color: #ffffff;
          font-size: 14px;
        }

        .split-total {
          margin-top: 20px;
          padding: 16px;
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 15px;
          background: rgba(0, 0, 0, 0.12);
        }

        .split-total strong {
          font-size: 25px;
          letter-spacing: -0.03em;
        }

        .split-bar {
          position: relative;
          height: 12px;
          display: flex;
          overflow: hidden;
          margin-top: 17px;
          border-radius: 999px;
          background: #191d29;
        }

        .split-bar span:first-child {
          background: linear-gradient(90deg, #e879b5, #f0a7d0);
        }

        .split-bar span:last-child {
          background: linear-gradient(90deg, #759cf5, #a3bdf8);
        }

        .split-cards {
          display: grid;
          gap: 10px;
          margin-top: 17px;
        }

        .split-cards > div {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 13px;
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 13px;
          background: rgba(0, 0, 0, 0.1);
        }

        .split-icon {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border-radius: 10px;
        }

        .split-icon-pc {
          background: rgba(232, 121, 181, 0.1);
          color: #f0a7d0;
        }

        .split-icon-inventory {
          background: rgba(117, 156, 245, 0.1);
          color: #a3bdf8;
        }

        .split-cards small,
        .split-cards strong {
          display: block;
        }

        .split-cards small {
          color: #71798b;
          font-size: 9px;
        }

        .split-cards strong {
          margin-top: 4px;
          color: #ffffff;
          font-size: 13px;
        }

        .coverage-summary {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 18px;
        }

        .coverage-summary strong {
          font-size: 22px;
        }

        .coverage-track {
          position: relative;
          height: 11px;
          overflow: hidden;
          margin-top: 17px;
          border-radius: 999px;
          background: #191d29;
        }

        .coverage-track span {
          position: absolute;
          inset: 0 auto 0 0;
        }

        .coverage-market {
          background: linear-gradient(90deg, #8b5cf6, #b19af8);
        }

        .coverage-manual {
          background: #7da6f7;
        }

        .coverage-legend {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin-top: 15px;
        }

        .collection-performance-list,
        .ranking-list {
          display: grid;
          gap: 8px;
          margin-top: 17px;
        }

        .collection-performance-row,
        .ranking-row {
          min-width: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 12px 13px;
          border: 1px solid rgba(148, 163, 184, 0.09);
          border-radius: 13px;
          background: rgba(0, 0, 0, 0.11);
          color: inherit;
          text-decoration: none;
          transition: border-color 150ms ease, transform 150ms ease;
        }

        .collection-performance-row:hover,
        .ranking-row:hover {
          transform: translateY(-1px);
          border-color: rgba(167, 139, 250, 0.3);
        }

        .collection-performance-name {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .collection-performance-name > span {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: rgba(124, 92, 255, 0.08);
          color: #c4b5fd;
        }

        .collection-performance-row strong,
        .collection-performance-row small,
        .ranking-row strong,
        .ranking-row small {
          display: block;
        }

        .collection-performance-row strong,
        .ranking-row strong {
          color: #ffffff;
          font-size: 11px;
        }

        .collection-performance-row small,
        .ranking-row small {
          margin-top: 4px;
          color: #71798b;
          font-size: 8px;
          line-height: 1.4;
        }

        .collection-performance-row > div:last-child,
        .ranking-value {
          flex: 0 0 auto;
          text-align: right;
        }

        .ranking-row {
          justify-content: flex-start;
        }

        .ranking-position {
          flex: 0 0 auto;
          width: 27px;
          height: 27px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: rgba(124, 92, 255, 0.08);
          color: #c4b5fd;
          font-size: 9px;
          font-weight: 800;
        }

        .ranking-copy {
          min-width: 0;
          flex: 1;
        }

        .ranking-value {
          margin-left: auto;
        }

        .result-positive {
          color: #86efac !important;
        }

        .result-negative {
          color: #fca5a5 !important;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1280px) {
          .metric-grid,
          .secondary-metrics,
          .breakdown-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .analytics-grid-wide {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 980px) {
          .sidebar {
            position: static;
            width: auto;
            min-height: auto;
          }

          .sidebar-footer {
            display: none;
          }

          .navigation {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }

          .navigation-label {
            display: none;
          }

          .navigation-item {
            justify-content: center;
          }

          .navigation-item > span:nth-child(2),
          .coming-soon {
            display: none;
          }

          .analytics-main {
            margin-left: 0;
            padding: 35px 24px 55px;
          }

          .analytics-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .analytics-controls {
            width: 100%;
          }

          .analytics-controls label {
            flex: 1;
          }

          .analytics-grid-equal {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 650px) {
          .analytics-main {
            padding: 28px 14px 45px;
          }

          .analytics-header h1 {
            font-size: 48px;
          }

          .analytics-controls,
          .metric-grid,
          .secondary-metrics,
          .breakdown-grid,
          .performance-footer,
          .coverage-summary,
          .coverage-legend {
            grid-template-columns: 1fr;
          }

          .analytics-controls {
            display: grid;
          }

          .navigation {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }

          .panel {
            padding: 19px;
          }
        }
      `}</style>
    </div>
  );
}

function MetricCard({
  label,
  value,
  caption,
  featured = false,
  tone = "neutral",
}: {
  label: string;
  value: string;
  caption: string;
  featured?: boolean;
  tone?: "neutral" | "positive" | "negative";
}) {
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
          min-height: 174px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 22px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 19px;
          background: #10131b;
        }

        .metric-card-featured {
          border-color: rgba(139, 92, 246, 0.3);
          background:
            radial-gradient(
              circle at top right,
              rgba(124, 92, 255, 0.17),
              transparent 43%
            ),
            #121522;
        }

        .metric-card > span {
          color: #8d96aa;
          font-size: 11px;
        }

        .metric-card > strong {
          display: block;
          margin-top: auto;
          padding-top: 22px;
          color: #ffffff;
          font-size: clamp(25px, 3vw, 34px);
          line-height: 1;
          letter-spacing: -0.035em;
        }

        .metric-card-positive > strong {
          color: #86efac;
        }

        .metric-card-negative > strong {
          color: #fca5a5;
        }

        .metric-card > small {
          display: block;
          margin-top: 10px;
          color: #657087;
          font-size: 9px;
          line-height: 1.5;
        }
      `}</style>
    </article>
  );
}

function SmallMetric({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <article className="small-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{caption}</small>

      <style jsx>{`
        .small-metric {
          min-width: 0;
          padding: 15px 16px;
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 15px;
          background: rgba(16, 19, 27, 0.78);
        }

        .small-metric span {
          color: #6f7890;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .small-metric strong {
          display: block;
          margin-top: 7px;
          color: #ffffff;
          font-size: 17px;
        }

        .small-metric small {
          display: block;
          margin-top: 5px;
          color: #60697b;
          font-size: 8px;
        }
      `}</style>
    </article>
  );
}

function PanelHeader({
  eyebrow,
  title,
  caption,
}: {
  eyebrow: string;
  title: string;
  caption: string;
}) {
  return (
    <header className="panel-header">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      <p>{caption}</p>

      <style jsx>{`
        .panel-header {
          padding-bottom: 17px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.09);
        }

        .panel-header span {
          color: #9f93ff;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .panel-header h2 {
          margin: 7px 0 0;
          color: #ffffff;
          font-size: 20px;
          letter-spacing: -0.025em;
        }

        .panel-header p {
          margin: 6px 0 0;
          color: #71798b;
          font-size: 10px;
          line-height: 1.5;
        }
      `}</style>
    </header>
  );
}

function PerformanceChart({
  buckets,
  currency,
}: {
  buckets: PerformanceBucket[];
  currency: string;
}) {
  const width = 760;
  const height = 245;
  const paddingX = 34;
  const paddingTop = 25;
  const paddingBottom = 42;
  const values = buckets.flatMap((bucket) => [bucket.gross, bucket.profit]);
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(1, ...values);
  const valueRange = maximum - minimum || 1;
  const plotHeight = height - paddingTop - paddingBottom;
  const plotWidth = width - paddingX * 2;

  function getX(index: number) {
    if (buckets.length <= 1) {
      return width / 2;
    }

    return paddingX + (index / (buckets.length - 1)) * plotWidth;
  }

  function getY(value: number) {
    return paddingTop + ((maximum - value) / valueRange) * plotHeight;
  }

  const grossPoints = buckets
    .map((bucket, index) => `${getX(index)},${getY(bucket.gross)}`)
    .join(" ");
  const profitPoints = buckets
    .map((bucket, index) => `${getX(index)},${getY(bucket.profit)}`)
    .join(" ");
  const zeroY = getY(0);

  return (
    <div className="performance-chart">
      <div className="chart-legend">
        <span><i className="legend-gross" />Gross sales</span>
        <span><i className="legend-profit" />Realized profit</span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Gross sales and realized profit over time"
      >
        {[0, 1, 2, 3, 4].map((line) => {
          const y = paddingTop + (line / 4) * plotHeight;
          return (
            <line
              className="chart-grid-line"
              x1={paddingX}
              x2={width - paddingX}
              y1={y}
              y2={y}
              key={line}
            />
          );
        })}

        <line
          className="chart-zero-line"
          x1={paddingX}
          x2={width - paddingX}
          y1={zeroY}
          y2={zeroY}
        />

        <polyline className="chart-gross-line" points={grossPoints} />
        <polyline className="chart-profit-line" points={profitPoints} />

        {buckets.map((bucket, index) => (
          <g key={bucket.key}>
            <circle
              className="chart-gross-dot"
              cx={getX(index)}
              cy={getY(bucket.gross)}
              r="4"
            />
            <circle
              className="chart-profit-dot"
              cx={getX(index)}
              cy={getY(bucket.profit)}
              r="4"
            />
            <text
              className="chart-label"
              x={getX(index)}
              y={height - 14}
              textAnchor="middle"
            >
              {bucket.label}
            </text>
          </g>
        ))}
      </svg>

      {buckets.every((bucket) => bucket.count === 0) && (
        <div className="chart-empty">
          No sales in the selected period.
        </div>
      )}

      <div className="chart-range">
        <span>{formatCurrency(maximum, currency)}</span>
        <span>{formatCurrency(minimum, currency)}</span>
      </div>

      <style jsx>{`
        .performance-chart {
          position: relative;
          margin-top: 18px;
          padding: 13px 13px 2px;
          border: 1px solid rgba(148, 163, 184, 0.08);
          border-radius: 15px;
          background: rgba(0, 0, 0, 0.12);
        }

        .chart-legend {
          display: flex;
          justify-content: flex-end;
          gap: 14px;
          padding: 0 4px 6px;
        }

        .chart-legend span {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #737c8f;
          font-size: 8px;
        }

        .chart-legend i {
          width: 16px;
          height: 2px;
          border-radius: 999px;
        }

        .legend-gross {
          background: #9f93ff;
        }

        .legend-profit {
          background: #69d9a2;
        }

        svg {
          width: 100%;
          height: auto;
          min-height: 220px;
          overflow: visible;
        }

        :global(.chart-grid-line) {
          stroke: rgba(148, 163, 184, 0.09);
          stroke-width: 1;
        }

        :global(.chart-zero-line) {
          stroke: rgba(148, 163, 184, 0.2);
          stroke-dasharray: 4 5;
          stroke-width: 1;
        }

        :global(.chart-gross-line),
        :global(.chart-profit-line) {
          fill: none;
          stroke-width: 3;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        :global(.chart-gross-line) {
          stroke: #9f93ff;
        }

        :global(.chart-profit-line) {
          stroke: #69d9a2;
        }

        :global(.chart-gross-dot) {
          fill: #9f93ff;
          stroke: #151827;
          stroke-width: 2;
        }

        :global(.chart-profit-dot) {
          fill: #69d9a2;
          stroke: #151827;
          stroke-width: 2;
        }

        :global(.chart-label) {
          fill: #657087;
          font-size: 9px;
          text-transform: capitalize;
        }

        .chart-empty {
          position: absolute;
          inset: 50% auto auto 50%;
          transform: translate(-50%, -50%);
          color: #687184;
          font-size: 10px;
        }

        .chart-range {
          position: absolute;
          inset: 48px auto 42px 12px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          pointer-events: none;
        }

        .chart-range span {
          color: #4f586a;
          font-size: 7px;
        }
      `}</style>
    </div>
  );
}

function CoverageItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "market" | "manual" | "none" | "graded";
}) {
  return (
    <div className="coverage-item">
      <span className={`coverage-dot coverage-dot-${tone}`} />
      <strong>{value}</strong>
      <small>{label}</small>

      <style jsx>{`
        .coverage-item {
          min-width: 0;
          padding: 12px;
          border: 1px solid rgba(148, 163, 184, 0.09);
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.1);
        }

        .coverage-dot {
          width: 8px;
          height: 8px;
          display: block;
          border-radius: 50%;
        }

        .coverage-dot-market {
          background: #9f93ff;
        }

        .coverage-dot-manual {
          background: #7da6f7;
        }

        .coverage-dot-none {
          background: #596274;
        }

        .coverage-dot-graded {
          background: #69d9a2;
        }

        .coverage-item strong,
        .coverage-item small {
          display: block;
        }

        .coverage-item strong {
          margin-top: 7px;
          color: #ffffff;
          font-size: 14px;
        }

        .coverage-item small {
          margin-top: 4px;
          color: #687184;
          font-size: 8px;
        }
      `}</style>
    </div>
  );
}

function BreakdownPanel({
  eyebrow,
  title,
  items,
  currency,
  valueLabel = "Value",
  countLabel = "cards",
}: {
  eyebrow: string;
  title: string;
  items: BreakdownItem[];
  currency: string;
  valueLabel?: string;
  countLabel?: string;
}) {
  const visibleItems = items.slice(0, 5);
  const maximum = Math.max(1, ...visibleItems.map((item) => item.value));

  return (
    <article className="breakdown-panel">
      <span className="breakdown-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>

      {visibleItems.length > 0 ? (
        <div className="breakdown-list">
          {visibleItems.map((item) => (
            <div className="breakdown-row" key={item.label}>
              <div className="breakdown-copy">
                <strong>{item.label}</strong>
                <small>{item.count} {countLabel}</small>
              </div>

              <div className="breakdown-value">
                <strong>{formatCurrency(item.value, currency)}</strong>
                <small>{valueLabel}</small>
              </div>

              <div className="breakdown-bar">
                <span style={{ width: `${(item.value / maximum) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyPanel text="Not enough data yet." />
      )}

      <style jsx>{`
        .breakdown-panel {
          min-width: 0;
          padding: 21px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 19px;
          background: #10131b;
        }

        .breakdown-eyebrow {
          color: #9f93ff;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }

        .breakdown-panel h2 {
          margin: 7px 0 0;
          color: #ffffff;
          font-size: 17px;
        }

        .breakdown-list {
          display: grid;
          gap: 13px;
          margin-top: 17px;
        }

        .breakdown-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 6px 12px;
        }

        .breakdown-copy strong,
        .breakdown-copy small,
        .breakdown-value strong,
        .breakdown-value small {
          display: block;
        }

        .breakdown-copy strong,
        .breakdown-value strong {
          color: #d8dce5;
          font-size: 9px;
        }

        .breakdown-copy small,
        .breakdown-value small {
          margin-top: 3px;
          color: #5f687a;
          font-size: 7px;
        }

        .breakdown-value {
          text-align: right;
        }

        .breakdown-bar {
          grid-column: 1 / -1;
          height: 5px;
          overflow: hidden;
          border-radius: 999px;
          background: #1a1e2a;
        }

        .breakdown-bar span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #7c5cff, #a997ff);
        }
      `}</style>
    </article>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="empty-panel">
      <span>◇</span>
      <p>{text}</p>

      <style jsx>{`
        .empty-panel {
          min-height: 120px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 15px;
          border: 1px dashed rgba(148, 163, 184, 0.14);
          border-radius: 14px;
          color: #626b7e;
          text-align: center;
        }

        .empty-panel span {
          color: #8f82d9;
        }

        .empty-panel p {
          margin: 0;
          font-size: 9px;
        }
      `}</style>
    </div>
  );
}
