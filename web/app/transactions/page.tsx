"use client";

import Link from "next/link";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";

const CARD_IMAGE_BUCKET = "card-images";
const SIGNED_URL_SECONDS = 60 * 60;

type NumericDatabaseValue = number | string | null;

type TransactionType =
  | "purchase"
  | "sale"
  | "refund"
  | "fee"
  | "adjustment";

type TransactionStatus =
  | "pending"
  | "completed"
  | "cancelled"
  | "refunded";

type TransactionTypeFilter = "all" | TransactionType;
type TransactionStatusFilter = "all" | TransactionStatus;
type DateRangeFilter = "all" | "30" | "90" | "365";
type ResultFilter = "all" | "profit" | "loss" | "break-even";
type SortOption =
  | "latest"
  | "oldest"
  | "gross-high"
  | "net-high"
  | "profit-high"
  | "profit-low"
  | "player";

type TransactionRow = {
  id: string;
  card_id: string;
  collection_id: string | null;
  transaction_type: TransactionType;
  status: TransactionStatus;
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
  notes: string | null;
  card_state_before: string | null;
  created_at: string;
};

type CardRow = {
  id: string;
  player_name: string;
  year: string | null;
  manufacturer: string | null;
  set_name: string | null;
  card_number: string | null;
  parallel_name: string | null;
  serial_number: string | null;
  state: string | null;
  current_collection_id: string;
};

type CollectionRow = {
  id: string;
  name: string;
  type: "pc" | "inventory";
  currency: string;
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

type CardDetails = {
  playerName: string;
  year: string | null;
  manufacturer: string | null;
  brand: string | null;
  product: string | null;
  setName: string | null;
  cardNumber: string | null;
  parallelName: string | null;
  serialNumber: string | null;
  team: string | null;
  gradingCompany: string | null;
  grade: string | null;
  imageUrl: string | null;
};

type TransactionRecord = {
  id: string;
  cardId: string;
  collectionId: string | null;
  collectionName: string;
  collectionType: "pc" | "inventory" | null;
  transactionType: TransactionType;
  status: TransactionStatus;
  occurredAt: string;
  currency: string;
  itemAmount: number;
  shippingIncome: number;
  grossAmount: number;
  platformFee: number;
  paymentFee: number;
  shippingCost: number;
  otherCosts: number;
  totalCosts: number;
  costBasis: number;
  netAmount: number;
  realizedProfit: number;
  realizedRoi: number | null;
  platform: string | null;
  counterparty: string | null;
  reference: string | null;
  notes: string | null;
  cardStateBefore: string | null;
  card: CardDetails;
};

type NavigationItem = {
  label: string;
  icon: string;
  href?: string;
  active?: boolean;
  comingSoon?: boolean;
};

const navigation: NavigationItem[] = [
  { label: "Home", icon: "\u2302", href: "/" },
  { label: "Collections", icon: "\u25C7", href: "/#collections" },
  { label: "Cards", icon: "\u25B1", href: "/cards" },
  { label: "Scanner", icon: "\u25CE", comingSoon: true },
  { label: "Grading", icon: "\u25C8", comingSoon: true },
  { label: "Transactions", icon: "\u2195", active: true },
  { label: "Analytics", icon: "\u2301", href: "/analytics" },
];

const ATTRIBUTE_KEYS = [
  "team",
  "brand",
  "product",
  "set_name",
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
  ).join(" - ");
}

function formatCurrency(value: number, currency: string) {
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
    return "-";
  }

  return `${value.toLocaleString("da-DK", {
    maximumFractionDigits: 1,
  })}%`;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDate(value: string) {
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

function getTransactionTypeLabel(type: TransactionType) {
  switch (type) {
    case "sale":
      return "Sale";
    case "purchase":
      return "Purchase";
    case "refund":
      return "Refund";
    case "fee":
      return "Fee";
    case "adjustment":
      return "Adjustment";
    default:
      return "Transaction";
  }
}

function getStatusLabel(status: TransactionStatus) {
  switch (status) {
    case "completed":
      return "Completed";
    case "pending":
      return "Pending";
    case "cancelled":
      return "Cancelled";
    case "refunded":
      return "Refunded";
    default:
      return status;
  }
}

function escapeCsvValue(value: unknown) {
  const normalizedValue = value === null || value === undefined
    ? ""
    : String(value);

  return `"${normalizedValue.replace(/"/g, '""')}"`;
}

export default function TransactionsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] =
    useState<TransactionTypeFilter>("all");
  const [statusFilter, setStatusFilter] =
    useState<TransactionStatusFilter>("all");
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [dateRangeFilter, setDateRangeFilter] =
    useState<DateRangeFilter>("all");
  const [resultFilter, setResultFilter] =
    useState<ResultFilter>("all");
  const [sortOption, setSortOption] =
    useState<SortOption>("latest");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set()
  );

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const [transactionResult, collectionResult] = await Promise.all([
      supabase
        .from("card_transactions")
        .select(`
          id,
          card_id,
          collection_id,
          transaction_type,
          status,
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
          reference,
          notes,
          card_state_before,
          created_at
        `)
        .order("occurred_at", { ascending: false }),

      supabase
        .from("collections")
        .select(`
          id,
          name,
          type,
          currency
        `)
        .order("created_at", { ascending: true }),
    ]);

    if (transactionResult.error) {
      setMessage(
        `Transactions could not be loaded: ${transactionResult.error.message}`
      );
      setTransactions([]);
      setCollections(
        collectionResult.error
          ? []
          : ((collectionResult.data ?? []) as CollectionRow[])
      );
      setLoading(false);
      return;
    }

    const transactionRows =
      (transactionResult.data ?? []) as TransactionRow[];
    const collectionRows = collectionResult.error
      ? []
      : ((collectionResult.data ?? []) as CollectionRow[]);

    setCollections(collectionRows);

    if (transactionRows.length === 0) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    const cardIds = Array.from(
      new Set(transactionRows.map((transaction) => transaction.card_id))
    );

    const [cardResult, imageResult, attributeResult] = await Promise.all([
      supabase
        .from("cards")
        .select(`
          id,
          player_name,
          year,
          manufacturer,
          set_name,
          card_number,
          parallel_name,
          serial_number,
          state,
          current_collection_id
        `)
        .in("id", cardIds),

      supabase
        .from("card_images")
        .select(`
          card_id,
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
        .in("card_id", cardIds)
        .in("attribute_key", Array.from(ATTRIBUTE_KEYS)),
    ]);

    const warnings: string[] = [];

    if (collectionResult.error) {
      warnings.push("Collection names could not be loaded.");
    }

    if (cardResult.error) {
      warnings.push("Card details could not be loaded.");
    }

    if (imageResult.error) {
      warnings.push("Some card images could not be loaded.");
    }

    if (attributeResult.error) {
      warnings.push("Some Card DNA details could not be loaded.");
    }

    const cards = cardResult.error
      ? []
      : ((cardResult.data ?? []) as CardRow[]);
    const images = imageResult.error
      ? []
      : ((imageResult.data ?? []) as CardImageRow[]);
    const attributes = attributeResult.error
      ? []
      : ((attributeResult.data ?? []) as CardAttributeRow[]);

    const collectionById = new Map(
      collectionRows.map((collection) => [collection.id, collection])
    );
    const cardById = new Map(cards.map((card) => [card.id, card]));

    const attributesByCardId = new Map<string, CardAttributeRow[]>();

    for (const attribute of attributes) {
      const current = attributesByCardId.get(attribute.card_id) ?? [];
      current.push(attribute);
      attributesByCardId.set(attribute.card_id, current);
    }

    const imageUrlByCardId = new Map<string, string>();

    await Promise.all(
      images.map(async (image) => {
        const { data, error } = await supabase.storage
          .from(CARD_IMAGE_BUCKET)
          .createSignedUrl(image.storage_path, SIGNED_URL_SECONDS);

        if (!error && data?.signedUrl) {
          imageUrlByCardId.set(image.card_id, data.signedUrl);
        }
      })
    );

    const normalizedTransactions = transactionRows.map((transaction) => {
      const card = cardById.get(transaction.card_id);
      const collection = transaction.collection_id
        ? collectionById.get(transaction.collection_id)
        : null;
      const cardAttributes = attributesByCardId.get(transaction.card_id) ?? [];

      const itemAmount = toNumber(transaction.item_amount);
      const shippingIncome = toNumber(transaction.shipping_income);
      const platformFee = toNumber(transaction.platform_fee);
      const paymentFee = toNumber(transaction.payment_fee);
      const shippingCost = toNumber(transaction.shipping_cost);
      const otherCosts = toNumber(transaction.other_costs);
      const costBasis = toNumber(transaction.cost_basis);
      const netAmount = toNumber(transaction.net_amount);
      const realizedProfit = toNumber(transaction.realized_profit);
      const totalCosts =
        platformFee + paymentFee + shippingCost + otherCosts;

      return {
        id: transaction.id,
        cardId: transaction.card_id,
        collectionId: transaction.collection_id,
        collectionName: collection?.name ?? "Unknown collection",
        collectionType: collection?.type ?? null,
        transactionType: transaction.transaction_type,
        status: transaction.status,
        occurredAt: transaction.occurred_at,
        currency: transaction.currency,
        itemAmount,
        shippingIncome,
        grossAmount: itemAmount + shippingIncome,
        platformFee,
        paymentFee,
        shippingCost,
        otherCosts,
        totalCosts,
        costBasis,
        netAmount,
        realizedProfit,
        realizedRoi:
          costBasis > 0 ? (realizedProfit / costBasis) * 100 : null,
        platform: transaction.platform,
        counterparty: transaction.counterparty,
        reference: transaction.reference,
        notes: transaction.notes,
        cardStateBefore: transaction.card_state_before,
        card: {
          playerName: card?.player_name ?? "Unknown card",
          year: card?.year ?? null,
          manufacturer: card?.manufacturer ?? null,
          brand: getStringAttribute(cardAttributes, "brand"),
          product: getStringAttribute(cardAttributes, "product"),
          setName:
            getStringAttribute(cardAttributes, "set_name") ??
            card?.set_name ??
            null,
          cardNumber: card?.card_number ?? null,
          parallelName: card?.parallel_name ?? null,
          serialNumber: card?.serial_number ?? null,
          team: getStringAttribute(cardAttributes, "team"),
          gradingCompany: getStringAttribute(
            cardAttributes,
            "grading_company"
          ),
          grade: getStringAttribute(cardAttributes, "grade"),
          imageUrl: imageUrlByCardId.get(transaction.card_id) ?? null,
        },
      } satisfies TransactionRecord;
    });

    setTransactions(normalizedTransactions);

    if (warnings.length > 0) {
      setMessage(Array.from(new Set(warnings)).join(" "));
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const platforms = useMemo(
    () =>
      Array.from(
        new Set(
          transactions
            .map((transaction) => transaction.platform?.trim())
            .filter((platform): platform is string => Boolean(platform))
        )
      ).sort((first, second) => first.localeCompare(second)),
    [transactions]
  );

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const now = Date.now();
    const dateRangeDays = dateRangeFilter === "all"
      ? null
      : Number(dateRangeFilter);

    const filtered = transactions.filter((transaction) => {
      if (
        typeFilter !== "all" &&
        transaction.transactionType !== typeFilter
      ) {
        return false;
      }

      if (
        statusFilter !== "all" &&
        transaction.status !== statusFilter
      ) {
        return false;
      }

      if (
        collectionFilter !== "all" &&
        transaction.collectionId !== collectionFilter
      ) {
        return false;
      }

      if (
        platformFilter !== "all" &&
        transaction.platform !== platformFilter
      ) {
        return false;
      }

      if (dateRangeDays !== null) {
        const transactionTime = new Date(transaction.occurredAt).getTime();
        const cutoff = now - dateRangeDays * 24 * 60 * 60 * 1000;

        if (!Number.isFinite(transactionTime) || transactionTime < cutoff) {
          return false;
        }
      }

      if (resultFilter === "profit" && transaction.realizedProfit <= 0) {
        return false;
      }

      if (resultFilter === "loss" && transaction.realizedProfit >= 0) {
        return false;
      }

      if (
        resultFilter === "break-even" &&
        Math.abs(transaction.realizedProfit) >= 0.005
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchText = [
        transaction.card.playerName,
        transaction.card.team,
        transaction.card.year,
        transaction.card.manufacturer,
        transaction.card.brand,
        transaction.card.product,
        transaction.card.setName,
        transaction.card.cardNumber,
        transaction.card.parallelName,
        transaction.card.serialNumber,
        transaction.card.gradingCompany,
        transaction.card.grade,
        transaction.collectionName,
        transaction.platform,
        transaction.counterparty,
        transaction.reference,
        transaction.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchText.includes(normalizedSearch);
    });

    return [...filtered].sort((first, second) => {
      switch (sortOption) {
        case "oldest":
          return (
            new Date(first.occurredAt).getTime() -
            new Date(second.occurredAt).getTime()
          );
        case "gross-high":
          return second.grossAmount - first.grossAmount;
        case "net-high":
          return second.netAmount - first.netAmount;
        case "profit-high":
          return second.realizedProfit - first.realizedProfit;
        case "profit-low":
          return first.realizedProfit - second.realizedProfit;
        case "player":
          return first.card.playerName.localeCompare(second.card.playerName);
        case "latest":
        default:
          return (
            new Date(second.occurredAt).getTime() -
            new Date(first.occurredAt).getTime()
          );
      }
    });
  }, [
    collectionFilter,
    dateRangeFilter,
    platformFilter,
    resultFilter,
    search,
    sortOption,
    statusFilter,
    transactions,
    typeFilter,
  ]);

  const summaryCurrency = useMemo(() => {
    const currencies = Array.from(
      new Set(filteredTransactions.map((transaction) => transaction.currency))
    );

    if (currencies.length === 1) {
      return currencies[0];
    }

    return collections[0]?.currency ?? "DKK";
  }, [collections, filteredTransactions]);

  const summaryTransactions = useMemo(
    () =>
      filteredTransactions.filter(
        (transaction) => transaction.currency === summaryCurrency
      ),
    [filteredTransactions, summaryCurrency]
  );

  const completedSales = useMemo(
    () =>
      summaryTransactions.filter(
        (transaction) =>
          transaction.transactionType === "sale" &&
          transaction.status === "completed"
      ),
    [summaryTransactions]
  );

  const grossSales = completedSales.reduce(
    (total, transaction) => total + transaction.grossAmount,
    0
  );
  const netProceeds = completedSales.reduce(
    (total, transaction) => total + transaction.netAmount,
    0
  );
  const costBasis = completedSales.reduce(
    (total, transaction) => total + transaction.costBasis,
    0
  );
  const realizedProfit = completedSales.reduce(
    (total, transaction) => total + transaction.realizedProfit,
    0
  );
  const totalFeesAndCosts = completedSales.reduce(
    (total, transaction) => total + transaction.totalCosts,
    0
  );
  const realizedRoi = costBasis > 0
    ? (realizedProfit / costBasis) * 100
    : null;
  const averageNetSale = completedSales.length > 0
    ? netProceeds / completedSales.length
    : 0;

  const excludedCurrencyCount =
    filteredTransactions.length - summaryTransactions.length;

  const hasActiveFilters =
    Boolean(search.trim()) ||
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    collectionFilter !== "all" ||
    platformFilter !== "all" ||
    dateRangeFilter !== "all" ||
    resultFilter !== "all" ||
    sortOption !== "latest";

  function clearFilters() {
    setSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
    setCollectionFilter("all");
    setPlatformFilter("all");
    setDateRangeFilter("all");
    setResultFilter("all");
    setSortOption("latest");
  }

  function toggleExpanded(transactionId: string) {
    setExpandedIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(transactionId)) {
        nextIds.delete(transactionId);
      } else {
        nextIds.add(transactionId);
      }

      return nextIds;
    });
  }

  function exportCsv() {
    if (filteredTransactions.length === 0) {
      return;
    }

    const header = [
      "Date",
      "Type",
      "Status",
      "Player",
      "Card",
      "Collection",
      "Platform",
      "Buyer",
      "Gross",
      "Fees and costs",
      "Net proceeds",
      "Cost basis",
      "Realized profit",
      "Realized ROI",
      "Currency",
      "Reference",
      "Notes",
    ];

    const rows = filteredTransactions.map((transaction) => [
      transaction.occurredAt,
      getTransactionTypeLabel(transaction.transactionType),
      getStatusLabel(transaction.status),
      transaction.card.playerName,
      joinDistinct([
        transaction.card.year,
        transaction.card.product ?? transaction.card.setName,
        transaction.card.cardNumber
          ? `#${transaction.card.cardNumber}`
          : null,
        transaction.card.parallelName,
      ]),
      transaction.collectionName,
      transaction.platform ?? "",
      transaction.counterparty ?? "",
      transaction.grossAmount,
      transaction.totalCosts,
      transaction.netAmount,
      transaction.costBasis,
      transaction.realizedProfit,
      transaction.realizedRoi ?? "",
      transaction.currency,
      transaction.reference ?? "",
      transaction.notes ?? "",
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map(escapeCsvValue).join(";"))
      .join("\r\n");

    const blob = new Blob(["\ufeff", csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `necardpilot-transactions-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
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
            <span className="navigation-icon">{"\u2699"}</span>
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
              onClick={() => {
                void handleLogout();
              }}
              title="Log out"
            >
              {"\u2197"}
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div>
            <p className="eyebrow">Financial history</p>
            <h1>Transactions</h1>
            <p className="page-description">
              Review completed sales, fees, net proceeds and realized profit
              across every collection.
            </p>
          </div>

          <div className="page-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={exportCsv}
              disabled={filteredTransactions.length === 0}
            >
              Export CSV
            </button>

            <Link className="primary-button" href="/cards">
              Open cards
            </Link>
          </div>
        </header>

        {message && <p className="status-message">{message}</p>}

        <section className="metrics-grid">
          <MetricCard
            label="Completed sales"
            value={String(completedSales.length)}
            caption={`${filteredTransactions.length} matching transactions`}
          />

          <MetricCard
            label="Gross sales"
            value={formatCurrency(grossSales, summaryCurrency)}
            caption="Sale price plus shipping income"
          />

          <MetricCard
            label="Net proceeds"
            value={formatCurrency(netProceeds, summaryCurrency)}
            caption={`${formatCurrency(
              totalFeesAndCosts,
              summaryCurrency
            )} in fees and costs`}
            featured
          />

          <MetricCard
            label="Realized profit"
            value={formatCurrency(realizedProfit, summaryCurrency)}
            caption={`Weighted ROI ${formatPercentage(realizedRoi)}`}
            tone={realizedProfit >= 0 ? "positive" : "negative"}
          />
        </section>

        <section className="economics-grid">
          <EconomicsCard
            label="Cost basis sold"
            value={formatCurrency(costBasis, summaryCurrency)}
          />
          <EconomicsCard
            label="Average net sale"
            value={formatCurrency(averageNetSale, summaryCurrency)}
          />
          <EconomicsCard
            label="Realized ROI"
            value={formatPercentage(realizedRoi)}
          />
          <EconomicsCard
            label="Currencies excluded"
            value={String(excludedCurrencyCount)}
            caption={
              excludedCurrencyCount > 0
                ? `Summary shown in ${summaryCurrency}`
                : `All shown in ${summaryCurrency}`
            }
          />
        </section>

        <section className="transactions-panel">
          <div className="filter-header">
            <div>
              <p className="eyebrow">Transaction archive</p>
              <h2>History</h2>
              <p>
                Search and filter every recorded transaction without changing
                the underlying financial history.
              </p>
            </div>

            <span className="result-count">
              {filteredTransactions.length} of {transactions.length}
            </span>
          </div>

          <div className="filters-grid">
            <label className="search-field">
              <span>Search</span>
              <input
                type="search"
                value={search}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setSearch(event.target.value)
                }
                placeholder="Player, card, platform, buyer, reference..."
              />
            </label>

            <FilterSelect
              label="Type"
              value={typeFilter}
              onChange={(value) =>
                setTypeFilter(value as TransactionTypeFilter)
              }
              options={[
                ["all", "All types"],
                ["sale", "Sales"],
                ["purchase", "Purchases"],
                ["refund", "Refunds"],
                ["fee", "Fees"],
                ["adjustment", "Adjustments"],
              ]}
            />

            <FilterSelect
              label="Status"
              value={statusFilter}
              onChange={(value) =>
                setStatusFilter(value as TransactionStatusFilter)
              }
              options={[
                ["all", "All statuses"],
                ["completed", "Completed"],
                ["pending", "Pending"],
                ["cancelled", "Cancelled"],
                ["refunded", "Refunded"],
              ]}
            />

            <FilterSelect
              label="Collection"
              value={collectionFilter}
              onChange={setCollectionFilter}
              options={[
                ["all", "All collections"],
                ...collections.map(
                  (collection) => [collection.id, collection.name] as [
                    string,
                    string,
                  ]
                ),
              ]}
            />

            <FilterSelect
              label="Platform"
              value={platformFilter}
              onChange={setPlatformFilter}
              options={[
                ["all", "All platforms"],
                ...platforms.map(
                  (platform) => [platform, platform] as [string, string]
                ),
              ]}
            />

            <FilterSelect
              label="Date range"
              value={dateRangeFilter}
              onChange={(value) =>
                setDateRangeFilter(value as DateRangeFilter)
              }
              options={[
                ["all", "All time"],
                ["30", "Last 30 days"],
                ["90", "Last 90 days"],
                ["365", "Last 12 months"],
              ]}
            />

            <FilterSelect
              label="Result"
              value={resultFilter}
              onChange={(value) => setResultFilter(value as ResultFilter)}
              options={[
                ["all", "All results"],
                ["profit", "Profit"],
                ["loss", "Loss"],
                ["break-even", "Break-even"],
              ]}
            />

            <FilterSelect
              label="Sort by"
              value={sortOption}
              onChange={(value) => setSortOption(value as SortOption)}
              options={[
                ["latest", "Latest first"],
                ["oldest", "Oldest first"],
                ["gross-high", "Highest gross"],
                ["net-high", "Highest net"],
                ["profit-high", "Highest profit"],
                ["profit-low", "Lowest profit"],
                ["player", "Player A-Z"],
              ]}
            />
          </div>

          <div className="filter-footer">
            <span>
              Summary currency: <strong>{summaryCurrency}</strong>
            </span>

            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
            >
              Clear filters
            </button>
          </div>

          {loading ? (
            <div className="empty-state">
              <span className="loading-spinner" />
              <div>
                <h3>Loading transactions</h3>
                <p>Preparing cards, collections and financial details.</p>
              </div>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">T</div>
              <div>
                <h3>No matching transactions</h3>
                <p>
                  Record a completed sale from a card detail page, or clear the
                  active filters.
                </p>
              </div>

              {hasActiveFilters ? (
                <button type="button" onClick={clearFilters}>
                  Clear filters
                </button>
              ) : (
                <Link href="/cards">Open cards</Link>
              )}
            </div>
          ) : (
            <div className="transaction-list">
              {filteredTransactions.map((transaction) => (
                <TransactionItem
                  key={transaction.id}
                  transaction={transaction}
                  expanded={expandedIds.has(transaction.id)}
                  onToggle={() => toggleExpanded(transaction.id)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <style jsx>{`
        :global(*) {
          box-sizing: border-box;
        }

        :global(body) {
          margin: 0;
          background: #080a10;
        }

        :global(a) {
          color: inherit;
        }

        .app-shell {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 310px minmax(0, 1fr);
          background:
            radial-gradient(
              circle at 84% 0%,
              rgba(124, 92, 255, 0.08),
              transparent 29%
            ),
            #080a10;
          color: #f8fafc;
        }

        .sidebar {
          position: sticky;
          top: 0;
          height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 34px 21px 22px;
          border-right: 1px solid rgba(148, 163, 184, 0.11);
          background: rgba(8, 10, 16, 0.96);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 0 12px;
          text-decoration: none;
        }

        .brand-mark {
          width: 58px;
          height: 58px;
          display: grid;
          place-items: center;
          border-radius: 18px;
          background: linear-gradient(145deg, #8b6dff, #6353dd);
          box-shadow: 0 18px 35px rgba(94, 70, 216, 0.3);
          color: #ffffff;
          font-size: 24px;
          font-weight: 850;
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
          font-size: 19px;
          font-weight: 850;
          letter-spacing: -0.025em;
        }

        .brand-subtitle {
          margin-top: 5px;
          color: #71798b;
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .navigation {
          display: grid;
          gap: 6px;
          margin-top: 62px;
        }

        .navigation-label {
          padding: 0 15px 13px;
          color: #596172;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .navigation-item,
        .settings-button {
          width: 100%;
          min-height: 53px;
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 0 15px;
          border: 0;
          border-radius: 13px;
          background: transparent;
          color: #8d95a7;
          font: inherit;
          font-size: 14px;
          text-decoration: none;
          text-align: left;
        }

        .navigation-item:hover:not(:disabled),
        .settings-button:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.035);
          color: #ffffff;
        }

        .navigation-item-active {
          background: rgba(124, 92, 255, 0.17);
          color: #e8e2ff;
        }

        .navigation-item:disabled,
        .settings-button:disabled {
          cursor: not-allowed;
          opacity: 0.7;
        }

        .navigation-icon {
          width: 24px;
          display: inline-flex;
          justify-content: center;
          color: #8992a5;
          font-size: 12px;
          font-weight: 850;
        }

        .navigation-item-active .navigation-icon {
          color: #c4b5fd;
        }

        .coming-soon {
          margin-left: auto;
          padding: 4px 7px;
          border: 1px solid rgba(148, 163, 184, 0.13);
          border-radius: 6px;
          color: #5f6879;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .sidebar-footer {
          display: grid;
          gap: 15px;
        }

        .settings-button {
          justify-content: flex-start;
        }

        .user-card {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 14px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.024);
        }

        .user-avatar {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 13px;
          background: #171b28;
          color: #ffffff;
          font-size: 12px;
          font-weight: 850;
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
          color: #697184;
          font-size: 10px;
        }

        .logout-button {
          width: 30px;
          height: 30px;
          border: 0;
          border-radius: 9px;
          background: transparent;
          color: #6f7789;
          cursor: pointer;
        }

        .logout-button:hover {
          background: rgba(255, 255, 255, 0.04);
          color: #ffffff;
        }

        .main-content {
          min-width: 0;
          padding: 52px 56px 70px;
        }

        .page-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 28px;
          max-width: 1500px;
          margin: 0 auto 31px;
        }

        .eyebrow {
          margin: 0;
          color: #9f93ff;
          font-size: 10px;
          font-weight: 850;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .page-header h1 {
          margin: 10px 0 0;
          color: #ffffff;
          font-size: clamp(43px, 5vw, 68px);
          line-height: 0.98;
          letter-spacing: -0.055em;
        }

        .page-description {
          max-width: 750px;
          margin: 16px 0 0;
          color: #8d96aa;
          font-size: 14px;
          line-height: 1.6;
        }

        .page-actions {
          display: flex;
          gap: 11px;
        }

        .primary-button,
        .secondary-button {
          min-height: 49px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 18px;
          border-radius: 13px;
          font-size: 12px;
          font-weight: 800;
          text-decoration: none;
          cursor: pointer;
        }

        .primary-button {
          border: 0;
          background: linear-gradient(135deg, #8b6dff, #705ce6);
          color: #ffffff;
          box-shadow: 0 13px 30px rgba(111, 87, 231, 0.25);
        }

        .secondary-button {
          border: 1px solid rgba(148, 163, 184, 0.16);
          background: rgba(255, 255, 255, 0.025);
          color: #c4cad5;
        }

        .primary-button:hover,
        .secondary-button:hover:not(:disabled) {
          filter: brightness(1.08);
        }

        .secondary-button:disabled {
          cursor: not-allowed;
          opacity: 0.4;
        }

        .status-message {
          max-width: 1500px;
          margin: 0 auto 17px;
          padding: 12px 14px;
          border: 1px solid rgba(251, 191, 36, 0.18);
          border-radius: 12px;
          background: rgba(245, 158, 11, 0.05);
          color: #d1b66d;
          font-size: 11px;
        }

        .metrics-grid,
        .economics-grid {
          max-width: 1500px;
          display: grid;
          gap: 14px;
          margin: 0 auto;
        }

        .metrics-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .economics-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-top: 14px;
        }

        .transactions-panel {
          max-width: 1500px;
          margin: 25px auto 0;
          padding: 28px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 23px;
          background:
            radial-gradient(
              circle at top right,
              rgba(124, 92, 255, 0.055),
              transparent 36%
            ),
            #10131b;
          box-shadow: 0 22px 60px rgba(0, 0, 0, 0.19);
        }

        .filter-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
        }

        .filter-header h2 {
          margin: 7px 0 0;
          color: #ffffff;
          font-size: 23px;
          letter-spacing: -0.03em;
        }

        .filter-header p {
          max-width: 670px;
          margin: 7px 0 0;
          color: #737c8f;
          font-size: 11px;
          line-height: 1.55;
        }

        .result-count {
          flex: 0 0 auto;
          padding: 7px 10px;
          border: 1px solid rgba(167, 139, 250, 0.17);
          border-radius: 999px;
          background: rgba(139, 92, 246, 0.055);
          color: #c4b5fd;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .filters-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-top: 22px;
          padding-top: 22px;
          border-top: 1px solid rgba(148, 163, 184, 0.1);
        }

        .search-field {
          grid-column: span 2;
          display: grid;
          gap: 7px;
        }

        .search-field > span {
          color: #71798b;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }

        .search-field input {
          width: 100%;
          min-height: 48px;
          padding: 0 14px;
          border: 1px solid rgba(148, 163, 184, 0.13);
          border-radius: 13px;
          outline: none;
          background: rgba(0, 0, 0, 0.15);
          color: #ffffff;
          font: inherit;
          font-size: 12px;
        }

        .search-field input:focus {
          border-color: rgba(167, 139, 250, 0.58);
          box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.06);
        }

        .search-field input::placeholder {
          color: #4f5768;
        }

        .filter-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-top: 16px;
          padding-bottom: 19px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
          color: #6f788a;
          font-size: 10px;
        }

        .filter-footer strong {
          color: #b5bdca;
        }

        .filter-footer button {
          border: 0;
          background: transparent;
          color: #a99dfd;
          font: inherit;
          font-size: 10px;
          font-weight: 750;
          cursor: pointer;
        }

        .filter-footer button:disabled {
          cursor: not-allowed;
          color: #4e5564;
        }

        .empty-state {
          min-height: 240px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          margin-top: 20px;
          padding: 28px;
          border: 1px dashed rgba(148, 163, 184, 0.17);
          border-radius: 18px;
          background: rgba(0, 0, 0, 0.1);
          text-align: left;
        }

        .empty-state h3 {
          margin: 0;
          color: #ffffff;
          font-size: 15px;
        }

        .empty-state p {
          max-width: 550px;
          margin: 7px 0 0;
          color: #71798b;
          font-size: 11px;
          line-height: 1.55;
        }

        .empty-state button,
        .empty-state a {
          min-height: 39px;
          display: inline-flex;
          align-items: center;
          margin-left: auto;
          padding: 0 13px;
          border: 1px solid rgba(167, 139, 250, 0.2);
          border-radius: 11px;
          background: rgba(124, 92, 255, 0.07);
          color: #c4b5fd;
          font-size: 10px;
          font-weight: 750;
          text-decoration: none;
          cursor: pointer;
        }

        .empty-icon {
          width: 47px;
          height: 47px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border: 1px solid rgba(167, 139, 250, 0.19);
          border-radius: 14px;
          background: rgba(139, 92, 246, 0.065);
          color: #c4b5fd;
          font-weight: 850;
        }

        .loading-spinner {
          width: 30px;
          height: 30px;
          flex: 0 0 auto;
          border: 2px solid rgba(167, 139, 250, 0.17);
          border-top-color: #a78bfa;
          border-radius: 50%;
          animation: spin 700ms linear infinite;
        }

        .transaction-list {
          display: grid;
          gap: 12px;
          margin-top: 20px;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1180px) {
          .app-shell {
            grid-template-columns: 240px minmax(0, 1fr);
          }

          .main-content {
            padding: 42px 30px 60px;
          }

          .metrics-grid,
          .economics-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .filters-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 780px) {
          .app-shell {
            display: block;
          }

          .sidebar {
            position: relative;
            width: 100%;
            height: auto;
            padding: 18px;
          }

          .navigation {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            margin-top: 24px;
          }

          .navigation-label,
          .sidebar-footer {
            display: none;
          }

          .navigation-item {
            justify-content: center;
            padding: 0 8px;
          }

          .navigation-icon,
          .coming-soon {
            display: none;
          }

          .main-content {
            padding: 30px 18px 50px;
          }

          .page-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .page-actions {
            width: 100%;
          }

          .page-actions > * {
            flex: 1;
          }

          .filters-grid,
          .metrics-grid,
          .economics-grid {
            grid-template-columns: 1fr;
          }

          .search-field {
            grid-column: auto;
          }

          .transactions-panel {
            padding: 20px;
          }
        }

        @media (max-width: 520px) {
          .navigation {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .page-header h1 {
            font-size: 42px;
          }

          .page-actions {
            display: grid;
          }

          .filter-header,
          .filter-footer {
            align-items: flex-start;
            flex-direction: column;
          }

          .empty-state {
            align-items: flex-start;
            flex-direction: column;
          }

          .empty-state button,
          .empty-state a {
            width: 100%;
            justify-content: center;
            margin-left: 0;
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
          min-height: 155px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 22px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 20px;
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
            #141525;
        }

        .metric-card > span {
          color: #8f99b0;
          font-size: 11px;
        }

        .metric-card > strong {
          display: block;
          margin-top: 20px;
          color: #ffffff;
          font-size: 28px;
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
          margin-top: 8px;
          color: #667085;
          font-size: 10px;
          line-height: 1.45;
        }
      `}</style>
    </article>
  );
}

type EconomicsCardProps = {
  label: string;
  value: string;
  caption?: string;
};

function EconomicsCard({ label, value, caption }: EconomicsCardProps) {
  return (
    <article className="economics-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {caption && <small>{caption}</small>}

      <style jsx>{`
        .economics-card {
          min-width: 0;
          padding: 15px 17px;
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 15px;
          background: rgba(16, 19, 27, 0.76);
        }

        .economics-card span {
          color: #71798b;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .economics-card strong {
          display: block;
          margin-top: 7px;
          color: #dce0e8;
          font-size: 15px;
        }

        .economics-card small {
          display: block;
          margin-top: 5px;
          color: #636c7d;
          font-size: 9px;
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
          color: #71798b;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }

        .filter-select select {
          width: 100%;
          min-height: 48px;
          padding: 0 13px;
          border: 1px solid rgba(148, 163, 184, 0.13);
          border-radius: 13px;
          outline: none;
          background: rgba(0, 0, 0, 0.15);
          color: #d7dce5;
          color-scheme: dark;
          font: inherit;
          font-size: 11px;
          cursor: pointer;
        }

        .filter-select select:focus {
          border-color: rgba(167, 139, 250, 0.58);
          box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.06);
        }
      `}</style>
    </label>
  );
}

function TransactionItem({
  transaction,
  expanded,
  onToggle,
}: {
  transaction: TransactionRecord;
  expanded: boolean;
  onToggle: () => void;
}) {
  const cardSubtitle =
    joinDistinct([
      transaction.card.year,
      transaction.card.product ?? transaction.card.setName,
      transaction.card.cardNumber
        ? `#${transaction.card.cardNumber}`
        : null,
      transaction.card.parallelName,
    ]) || "Card details not specified";

  const gradingLabel = joinDistinct([
    transaction.card.gradingCompany,
    transaction.card.grade,
  ]);

  return (
    <article className="transaction-item">
      <div className="transaction-main-row">
        <Link className="card-link" href={`/cards/${transaction.cardId}`}>
          <div className="card-image-frame">
            {transaction.card.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={transaction.card.imageUrl}
                alt={`${transaction.card.playerName} card front`}
              />
            ) : (
              <span>NE</span>
            )}
          </div>

          <div className="card-copy">
            <div className="badges">
              <span className={`type-badge type-${transaction.transactionType}`}>
                {getTransactionTypeLabel(transaction.transactionType)}
              </span>
              <span className={`status-badge status-${transaction.status}`}>
                {getStatusLabel(transaction.status)}
              </span>
              {gradingLabel && <span className="grade-badge">{gradingLabel}</span>}
            </div>

            <h3>{transaction.card.playerName}</h3>
            <p>{cardSubtitle}</p>

            <div className="card-meta">
              <span>{transaction.collectionName}</span>
              <span>{formatDate(transaction.occurredAt)}</span>
              {transaction.platform && <span>{transaction.platform}</span>}
              {transaction.counterparty && (
                <span>{transaction.counterparty}</span>
              )}
            </div>
          </div>
        </Link>

        <div className="transaction-values">
          <ValueCell
            label="Gross"
            value={formatCurrency(
              transaction.grossAmount,
              transaction.currency
            )}
          />
          <ValueCell
            label="Net"
            value={formatCurrency(
              transaction.netAmount,
              transaction.currency
            )}
          />
          <ValueCell
            label="Profit"
            value={formatCurrency(
              transaction.realizedProfit,
              transaction.currency
            )}
            tone={
              transaction.realizedProfit > 0
                ? "positive"
                : transaction.realizedProfit < 0
                  ? "negative"
                  : "neutral"
            }
            caption={formatPercentage(transaction.realizedRoi)}
          />
        </div>

        <button
          className="details-button"
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          {expanded ? "Hide" : "Details"}
        </button>
      </div>

      {expanded && (
        <div className="transaction-details">
          <div className="detail-grid">
            <DetailValue
              label="Sale price"
              value={formatCurrency(
                transaction.itemAmount,
                transaction.currency
              )}
            />
            <DetailValue
              label="Shipping income"
              value={formatCurrency(
                transaction.shippingIncome,
                transaction.currency
              )}
            />
            <DetailValue
              label="Platform fee"
              value={formatCurrency(
                transaction.platformFee,
                transaction.currency
              )}
            />
            <DetailValue
              label="Payment fee"
              value={formatCurrency(
                transaction.paymentFee,
                transaction.currency
              )}
            />
            <DetailValue
              label="Shipping cost"
              value={formatCurrency(
                transaction.shippingCost,
                transaction.currency
              )}
            />
            <DetailValue
              label="Other costs"
              value={formatCurrency(
                transaction.otherCosts,
                transaction.currency
              )}
            />
            <DetailValue
              label="Cost basis"
              value={formatCurrency(
                transaction.costBasis,
                transaction.currency
              )}
            />
            <DetailValue
              label="Occurred"
              value={formatDateTime(transaction.occurredAt)}
            />
          </div>

          <div className="detail-notes-grid">
            <div>
              <span>Reference</span>
              <p>{transaction.reference || "No reference recorded."}</p>
            </div>
            <div>
              <span>Notes</span>
              <p>{transaction.notes || "No transaction notes recorded."}</p>
            </div>
          </div>

          <div className="detail-actions">
            <Link href={`/cards/${transaction.cardId}`}>Open card</Link>
            {transaction.collectionId && (
              <Link href={`/collections/${transaction.collectionId}`}>
                Open collection
              </Link>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .transaction-item {
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.11);
          border-radius: 17px;
          background: rgba(0, 0, 0, 0.13);
        }

        .transaction-main-row {
          display: grid;
          grid-template-columns: minmax(330px, 1fr) minmax(360px, 0.8fr) auto;
          align-items: center;
          gap: 22px;
          padding: 15px;
        }

        .card-link {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 14px;
          color: inherit;
          text-decoration: none;
        }

        .card-link:hover h3 {
          color: #c4b5fd;
        }

        .card-image-frame {
          width: 62px;
          height: 82px;
          display: grid;
          place-items: center;
          overflow: hidden;
          flex: 0 0 auto;
          border-radius: 10px;
          background: #080a10;
        }

        .card-image-frame img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: contain;
        }

        .card-image-frame span {
          color: #7d70c4;
          font-size: 10px;
          font-weight: 850;
        }

        .card-copy {
          min-width: 0;
        }

        .badges,
        .card-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .badges span,
        .card-meta span {
          display: inline-flex;
          align-items: center;
          min-height: 22px;
          padding: 0 7px;
          border-radius: 999px;
          font-size: 8px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .type-badge {
          border: 1px solid rgba(96, 165, 250, 0.17);
          background: rgba(59, 130, 246, 0.055);
          color: #bfdbfe;
        }

        .type-sale {
          border-color: rgba(52, 211, 153, 0.18);
          background: rgba(16, 185, 129, 0.06);
          color: #a7f3d0;
        }

        .status-badge {
          border: 1px solid rgba(148, 163, 184, 0.14);
          background: rgba(148, 163, 184, 0.045);
          color: #aab2c0;
        }

        .status-completed {
          border-color: rgba(52, 211, 153, 0.16);
          color: #86efac;
        }

        .status-cancelled,
        .status-refunded {
          border-color: rgba(248, 113, 113, 0.15);
          color: #fca5a5;
        }

        .grade-badge {
          border: 1px solid rgba(167, 139, 250, 0.17);
          background: rgba(139, 92, 246, 0.055);
          color: #c4b5fd;
        }

        .card-copy h3 {
          overflow: hidden;
          margin: 8px 0 0;
          color: #ffffff;
          font-size: 14px;
          text-overflow: ellipsis;
          white-space: nowrap;
          transition: color 150ms ease;
        }

        .card-copy > p {
          overflow: hidden;
          margin: 5px 0 0;
          color: #7d8698;
          font-size: 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .card-meta {
          margin-top: 9px;
        }

        .card-meta span {
          background: rgba(255, 255, 255, 0.028);
          color: #667085;
          text-transform: none;
        }

        .transaction-values {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 9px;
        }

        .details-button {
          min-height: 38px;
          padding: 0 12px;
          border: 1px solid rgba(148, 163, 184, 0.13);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.025);
          color: #a6adba;
          font: inherit;
          font-size: 9px;
          font-weight: 750;
          cursor: pointer;
        }

        .details-button:hover {
          border-color: rgba(167, 139, 250, 0.31);
          color: #ffffff;
        }

        .transaction-details {
          padding: 18px;
          border-top: 1px solid rgba(148, 163, 184, 0.09);
          background: rgba(255, 255, 255, 0.012);
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 9px;
        }

        .detail-notes-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 9px;
          margin-top: 9px;
        }

        .detail-notes-grid > div {
          padding: 13px;
          border: 1px solid rgba(148, 163, 184, 0.09);
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.1);
        }

        .detail-notes-grid span {
          color: #6f788a;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .detail-notes-grid p {
          margin: 7px 0 0;
          color: #9ba3b1;
          font-size: 10px;
          line-height: 1.5;
        }

        .detail-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 12px;
        }

        .detail-actions a {
          min-height: 34px;
          display: inline-flex;
          align-items: center;
          padding: 0 11px;
          border: 1px solid rgba(167, 139, 250, 0.16);
          border-radius: 9px;
          background: rgba(124, 92, 255, 0.05);
          color: #c4b5fd;
          font-size: 9px;
          font-weight: 750;
          text-decoration: none;
        }

        @media (max-width: 1100px) {
          .transaction-main-row {
            grid-template-columns: 1fr auto;
          }

          .transaction-values {
            grid-column: 1 / -1;
          }

          .detail-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 620px) {
          .transaction-main-row {
            grid-template-columns: 1fr;
          }

          .details-button {
            width: 100%;
          }

          .transaction-values,
          .detail-grid,
          .detail-notes-grid {
            grid-template-columns: 1fr;
          }

          .detail-actions {
            display: grid;
          }

          .detail-actions a {
            justify-content: center;
          }
        }
      `}</style>
    </article>
  );
}

function ValueCell({
  label,
  value,
  caption,
  tone = "neutral",
}: {
  label: string;
  value: string;
  caption?: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  return (
    <div className={`value-cell value-cell-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {caption && <small>{caption}</small>}

      <style jsx>{`
        .value-cell {
          min-width: 0;
          padding: 11px 12px;
          border: 1px solid rgba(148, 163, 184, 0.09);
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.018);
        }

        .value-cell span {
          color: #667085;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .value-cell strong {
          display: block;
          overflow: hidden;
          margin-top: 6px;
          color: #ffffff;
          font-size: 12px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .value-cell-positive strong {
          color: #86efac;
        }

        .value-cell-negative strong {
          color: #fca5a5;
        }

        .value-cell small {
          display: block;
          margin-top: 4px;
          color: #71798b;
          font-size: 8px;
        }
      `}</style>
    </div>
  );
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-value">
      <span>{label}</span>
      <strong>{value}</strong>

      <style jsx>{`
        .detail-value {
          min-width: 0;
          padding: 12px 13px;
          border: 1px solid rgba(148, 163, 184, 0.09);
          border-radius: 11px;
          background: rgba(0, 0, 0, 0.1);
        }

        .detail-value span {
          color: #667085;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .detail-value strong {
          display: block;
          overflow-wrap: anywhere;
          margin-top: 6px;
          color: #d7dce5;
          font-size: 10px;
          line-height: 1.45;
        }
      `}</style>
    </div>
  );
}