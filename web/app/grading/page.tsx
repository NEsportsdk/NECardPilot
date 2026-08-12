"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import CreateGradingSubmissionModal from "@/components/grading/CreateGradingSubmissionModal";
import type {
  CreateGradingSubmissionResult,
} from "@/lib/grading/createGradingSubmission";
import { createClient } from "@/lib/supabase/client";

const CARD_IMAGE_BUCKET = "card-images";
const SIGNED_URL_SECONDS = 60 * 60;

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
type GradingSubmissionStatus =
  | "draft"
  | "ready"
  | "shipped"
  | "received"
  | "grading"
  | "grades_ready"
  | "returned"
  | "completed"
  | "cancelled";

type SubmissionCardStatus =
  | "queued"
  | "submitted"
  | "grading"
  | "graded"
  | "returned"
  | "cancelled";

type SubmissionFilter =
  | "all"
  | "active"
  | "draft"
  | "in-transit"
  | "grading"
  | "results"
  | "completed"
  | "cancelled";

type SortOption =
  | "newest"
  | "oldest"
  | "company"
  | "cost-high";

type CollectionRow = {
  id: string;
  name: string;
  type: CollectionType;
  currency: string;
};

type GradingSubmissionRow = {
  id: string;
  name: string;
  grading_company: string;
  service_level: string | null;
  status: GradingSubmissionStatus;
  currency: string;
  submission_number: string | null;
  outbound_tracking_number: string | null;
  return_tracking_number: string | null;
  estimated_turnaround_days: number | null;
  submission_fee: NumericDatabaseValue;
  outbound_shipping_cost: NumericDatabaseValue;
  return_shipping_cost: NumericDatabaseValue;
  insurance_cost: NumericDatabaseValue;
  other_shared_costs: NumericDatabaseValue;
  shared_cost_total: NumericDatabaseValue;
  notes: string | null;
  ready_at: string | null;
  shipped_at: string | null;
  received_by_grader_at: string | null;
  grading_started_at: string | null;
  grades_ready_at: string | null;
  returned_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

type GradingSubmissionCardRow = {
  id: string;
  submission_id: string;
  card_id: string;
  position: number;
  status: SubmissionCardStatus;
  original_card_state: string | null;
  declared_value: NumericDatabaseValue;
  grading_fee: NumericDatabaseValue;
  preparation_fee: NumericDatabaseValue;
  allocated_shared_cost: NumericDatabaseValue;
  other_card_costs: NumericDatabaseValue;
  total_grading_cost: NumericDatabaseValue;
  raw_value_snapshot: NumericDatabaseValue;
  expected_grade: string | null;
  expected_graded_value: NumericDatabaseValue;
  result_grade: string | null;
  result_qualifier: string | null;
  certification_number: string | null;
  result_market_value: NumericDatabaseValue;
  result_notes: string | null;
  submitted_at: string | null;
  graded_at: string | null;
  returned_at: string | null;
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
  state: string | null;
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

type SubmissionCard = GradingSubmissionCardRow & {
  card: CardRow | null;
  collection: CollectionRow | null;
  imageUrl: string | null;
  sport: string | null;
  team: string | null;
  brand: string | null;
  product: string | null;
  insertName: string | null;
  currentGradingCompany: string | null;
  currentGrade: string | null;
  declaredValue: number | null;
  gradingFee: number;
  preparationFee: number;
  allocatedSharedCost: number;
  otherCardCosts: number;
  totalGradingCost: number;
  rawValueSnapshot: number | null;
  expectedGradedValue: number | null;
  resultMarketValue: number | null;
};

type GradingSubmission = GradingSubmissionRow & {
  cards: SubmissionCard[];
  sharedCostTotal: number;
  totalGradingCost: number;
  rawValueTotal: number;
  declaredValueTotal: number;
  expectedGradedValueTotal: number;
  expectedNetUpside: number | null;
  resultMarketValueTotal: number;
  realizedGradingUplift: number | null;
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
  { label: "Cards", icon: "▱", href: "/cards" },
  { label: "Scanner", icon: "◎", href: "/scanner" },
  { label: "Grading", icon: "◈", active: true },
  { label: "Transactions", icon: "↕", href: "/transactions" },
  { label: "Analytics", icon: "⌁", href: "/analytics" },
];

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

function formatPercentage(value: number | null) {
  if (value === null) {
    return "—";
  }

  return `${value.toLocaleString("da-DK", {
    maximumFractionDigits: 1,
  })}%`;
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

function normalizeSearch(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getSubmissionStatusLabel(
  status: GradingSubmissionStatus
) {
  switch (status) {
    case "draft":
      return "Draft";
    case "ready":
      return "Ready to ship";
    case "shipped":
      return "Shipped";
    case "received":
      return "Received by grader";
    case "grading":
      return "In grading";
    case "grades_ready":
      return "Grades ready";
    case "returned":
      return "Returned";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
  }
}

function getSubmissionStatusTone(
  status: GradingSubmissionStatus
) {
  switch (status) {
    case "draft":
      return "draft";
    case "ready":
      return "ready";
    case "shipped":
    case "received":
      return "transit";
    case "grading":
      return "grading";
    case "grades_ready":
      return "results";
    case "returned":
    case "completed":
      return "complete";
    case "cancelled":
      return "cancelled";
  }
}

function getCardStatusLabel(status: SubmissionCardStatus) {
  switch (status) {
    case "queued":
      return "Queued";
    case "submitted":
      return "Submitted";
    case "grading":
      return "In grading";
    case "graded":
      return "Graded";
    case "returned":
      return "Returned";
    case "cancelled":
      return "Cancelled";
  }
}

function matchesSubmissionFilter(
  status: GradingSubmissionStatus,
  filter: SubmissionFilter
) {
  switch (filter) {
    case "all":
      return true;
    case "active":
      return !["completed", "cancelled"].includes(status);
    case "draft":
      return ["draft", "ready"].includes(status);
    case "in-transit":
      return ["shipped", "received"].includes(status);
    case "grading":
      return status === "grading";
    case "results":
      return ["grades_ready", "returned"].includes(status);
    case "completed":
      return status === "completed";
    case "cancelled":
      return status === "cancelled";
  }
}

function getCollectionTypeLabel(type: CollectionType) {
  return type === "pc"
    ? "Personal Collection"
    : "Dealer Inventory";
}

export default function GradingCenterPage() {
  const supabase = useMemo(() => createClient(), []);

  const [submissions, setSubmissions] = useState<GradingSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showCreateSubmission, setShowCreateSubmission] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<SubmissionFilter>("all");
  const [sortOption, setSortOption] =
    useState<SortOption>("newest");
  const [expandedSubmissionIds, setExpandedSubmissionIds] =
    useState<Set<string>>(() => new Set());

  const loadGradingCenter = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "/login";
      return;
    }

    const [submissionResult, collectionResult] = await Promise.all([
      supabase
        .from("grading_submissions")
        .select(`
          id,
          name,
          grading_company,
          service_level,
          status,
          currency,
          submission_number,
          outbound_tracking_number,
          return_tracking_number,
          estimated_turnaround_days,
          submission_fee,
          outbound_shipping_cost,
          return_shipping_cost,
          insurance_cost,
          other_shared_costs,
          shared_cost_total,
          notes,
          ready_at,
          shipped_at,
          received_by_grader_at,
          grading_started_at,
          grades_ready_at,
          returned_at,
          completed_at,
          cancelled_at,
          created_at,
          updated_at
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),

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
    ]);

    if (submissionResult.error) {
      setSubmissions([]);
      setMessage(
        `Grading submissions could not be loaded: ${submissionResult.error.message}`
      );
      setLoading(false);
      return;
    }

    const submissionRows =
      (submissionResult.data ?? []) as GradingSubmissionRow[];
    const collectionRows = collectionResult.error
      ? []
      : ((collectionResult.data ?? []) as CollectionRow[]);

    if (submissionRows.length === 0) {
      setSubmissions([]);
      setLoading(false);
      return;
    }

    const submissionIds = submissionRows.map((submission) => submission.id);

    const submissionCardsResult = await supabase
      .from("grading_submission_cards")
      .select(`
        id,
        submission_id,
        card_id,
        position,
        status,
        original_card_state,
        declared_value,
        grading_fee,
        preparation_fee,
        allocated_shared_cost,
        other_card_costs,
        total_grading_cost,
        raw_value_snapshot,
        expected_grade,
        expected_graded_value,
        result_grade,
        result_qualifier,
        certification_number,
        result_market_value,
        result_notes,
        submitted_at,
        graded_at,
        returned_at,
        created_at
      `)
      .eq("user_id", user.id)
      .in("submission_id", submissionIds)
      .order("position", { ascending: true });

    if (submissionCardsResult.error) {
      setSubmissions([]);
      setMessage(
        `Submission cards could not be loaded: ${submissionCardsResult.error.message}`
      );
      setLoading(false);
      return;
    }

    const submissionCardRows =
      (submissionCardsResult.data ?? []) as GradingSubmissionCardRow[];
    const cardIds = Array.from(
      new Set(submissionCardRows.map((row) => row.card_id))
    );

    const warnings: string[] = [];

    if (collectionResult.error) {
      warnings.push("Collection names could not be loaded.");
    }

    let cardRows: CardRow[] = [];
    let imageRows: CardImageRow[] = [];
    let attributeRows: CardAttributeRow[] = [];

    if (cardIds.length > 0) {
      const [cardResult, imageResult, attributeResult] = await Promise.all([
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
            state
          `)
          .eq("user_id", user.id)
          .in("id", cardIds),

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
      ]);

      if (cardResult.error) {
        warnings.push("Some card details could not be loaded.");
      } else {
        cardRows = (cardResult.data ?? []) as CardRow[];
      }

      if (imageResult.error) {
        warnings.push("Some card images could not be loaded.");
      } else {
        imageRows = (imageResult.data ?? []) as CardImageRow[];
      }

      if (attributeResult.error) {
        warnings.push("Some Card DNA details could not be loaded.");
      } else {
        attributeRows =
          (attributeResult.data ?? []) as CardAttributeRow[];
      }
    }

    const collectionById = new Map(
      collectionRows.map((collection) => [collection.id, collection])
    );
    const cardById = new Map(cardRows.map((card) => [card.id, card]));
    const attributesByCardId = new Map<string, CardAttributeRow[]>();

    for (const attribute of attributeRows) {
      const current = attributesByCardId.get(attribute.card_id) ?? [];
      current.push(attribute);
      attributesByCardId.set(attribute.card_id, current);
    }

    const imageUrlByCardId = new Map<string, string>();

    await Promise.all(
      imageRows.map(async (image) => {
        const { data, error } = await supabase.storage
          .from(CARD_IMAGE_BUCKET)
          .createSignedUrl(image.storage_path, SIGNED_URL_SECONDS);

        if (!error && data?.signedUrl) {
          imageUrlByCardId.set(image.card_id, data.signedUrl);
        }
      })
    );

    const cardsBySubmissionId = new Map<string, SubmissionCard[]>();

    for (const row of submissionCardRows) {
      const card = cardById.get(row.card_id) ?? null;
      const attributes = attributesByCardId.get(row.card_id) ?? [];
      const collection = card
        ? collectionById.get(card.current_collection_id) ?? null
        : null;

      const enrichedCard: SubmissionCard = {
        ...row,
        card,
        collection,
        imageUrl: imageUrlByCardId.get(row.card_id) ?? null,
        sport: getStringAttribute(attributes, "sport"),
        team: getStringAttribute(attributes, "team"),
        brand: getStringAttribute(attributes, "brand"),
        product: getStringAttribute(attributes, "product"),
        insertName:
          getStringAttribute(attributes, "set_name") ??
          card?.set_name ??
          null,
        currentGradingCompany: getStringAttribute(
          attributes,
          "grading_company"
        ),
        currentGrade: getStringAttribute(attributes, "grade"),
        declaredValue: toOptionalNumber(row.declared_value),
        gradingFee: toNumber(row.grading_fee),
        preparationFee: toNumber(row.preparation_fee),
        allocatedSharedCost: toNumber(row.allocated_shared_cost),
        otherCardCosts: toNumber(row.other_card_costs),
        totalGradingCost: toNumber(row.total_grading_cost),
        rawValueSnapshot: toOptionalNumber(row.raw_value_snapshot),
        expectedGradedValue: toOptionalNumber(row.expected_graded_value),
        resultMarketValue: toOptionalNumber(row.result_market_value),
      };

      const currentCards = cardsBySubmissionId.get(row.submission_id) ?? [];
      currentCards.push(enrichedCard);
      cardsBySubmissionId.set(row.submission_id, currentCards);
    }

    const nextSubmissions = submissionRows.map<GradingSubmission>(
      (submission) => {
        const cards = (cardsBySubmissionId.get(submission.id) ?? []).sort(
          (first, second) => first.position - second.position
        );
        const totalGradingCost = cards.reduce(
          (total, card) => total + card.totalGradingCost,
          0
        );
        const rawValueTotal = cards.reduce(
          (total, card) => total + (card.rawValueSnapshot ?? 0),
          0
        );
        const declaredValueTotal = cards.reduce(
          (total, card) => total + (card.declaredValue ?? 0),
          0
        );
        const expectedCards = cards.filter(
          (card) => card.expectedGradedValue !== null
        );
        const expectedGradedValueTotal = expectedCards.reduce(
          (total, card) => total + (card.expectedGradedValue ?? 0),
          0
        );
        const resultCards = cards.filter(
          (card) => card.resultMarketValue !== null
        );
        const resultMarketValueTotal = resultCards.reduce(
          (total, card) => total + (card.resultMarketValue ?? 0),
          0
        );

        return {
          ...submission,
          cards,
          sharedCostTotal: toNumber(submission.shared_cost_total),
          totalGradingCost,
          rawValueTotal,
          declaredValueTotal,
          expectedGradedValueTotal,
          expectedNetUpside:
            expectedCards.length === cards.length && cards.length > 0
              ? expectedGradedValueTotal - rawValueTotal - totalGradingCost
              : null,
          resultMarketValueTotal,
          realizedGradingUplift:
            resultCards.length === cards.length && cards.length > 0
              ? resultMarketValueTotal - rawValueTotal - totalGradingCost
              : null,
        };
      }
    );

    setSubmissions(nextSubmissions);

    if (warnings.length > 0) {
      setMessage(Array.from(new Set(warnings)).join(" "));
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadGradingCenter();
  }, [loadGradingCenter]);

  const filteredSubmissions = useMemo(() => {
    const normalizedSearch = normalizeSearch(searchTerm);

    const filtered = submissions.filter((submission) => {
      if (!matchesSubmissionFilter(submission.status, statusFilter)) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchText = normalizeSearch(
        [
          submission.name,
          submission.grading_company,
          submission.service_level,
          submission.submission_number,
          ...submission.cards.flatMap((card) => [
            card.card?.player_name,
            card.card?.year,
            card.card?.manufacturer,
            card.product,
            card.insertName,
            card.card?.card_number,
            card.card?.parallel_name,
            card.card?.serial_number,
            card.expected_grade,
            card.result_grade,
            card.certification_number,
          ]),
        ]
          .filter(Boolean)
          .join(" ")
      );

      return searchText.includes(normalizedSearch);
    });

    return [...filtered].sort((first, second) => {
      switch (sortOption) {
        case "oldest":
          return (
            new Date(first.created_at).getTime() -
            new Date(second.created_at).getTime()
          );
        case "company":
          return first.grading_company.localeCompare(
            second.grading_company,
            "da",
            { sensitivity: "base" }
          );
        case "cost-high":
          return second.totalGradingCost - first.totalGradingCost;
        case "newest":
        default:
          return (
            new Date(second.created_at).getTime() -
            new Date(first.created_at).getTime()
          );
      }
    });
  }, [searchTerm, sortOption, statusFilter, submissions]);

  const activeSubmissions = submissions.filter(
    (submission) => !["completed", "cancelled"].includes(submission.status)
  );
  const activeCards = activeSubmissions.flatMap(
    (submission) => submission.cards
  );
  const cardsInPhysicalGrading = activeCards.filter((card) =>
    ["submitted", "grading", "graded"].includes(card.status)
  ).length;
  const totalActiveGradingCost = activeCards.reduce(
    (total, card) => total + card.totalGradingCost,
    0
  );
  const expectedSubmissions = activeSubmissions.filter(
    (submission) => submission.expectedNetUpside !== null
  );
  const expectedNetUpside = expectedSubmissions.reduce(
    (total, submission) => total + (submission.expectedNetUpside ?? 0),
    0
  );
  const summaryCurrency = submissions[0]?.currency ?? "DKK";
  const mixedCurrencies =
    new Set(submissions.map((submission) => submission.currency)).size > 1;

  function toggleSubmission(submissionId: string) {
    setExpandedSubmissionIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(submissionId)) {
        nextIds.delete(submissionId);
      } else {
        nextIds.add(submissionId);
      }

      return nextIds;
    });
  }

  async function handleCreated(result: CreateGradingSubmissionResult) {
    setShowCreateSubmission(false);
    await loadGradingCenter();
    setMessage(result.message);
    setExpandedSubmissionIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.add(result.submissionId);
      return nextIds;
    });
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
                  disabled={item.active || item.comingSoon}
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
              onClick={() => {
                void handleLogout();
              }}
              title="Log out"
            >
              ↗
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div>
            <p className="eyebrow">Submission operations</p>
            <h1>Grading Center</h1>
            <p className="page-description">
              Plan, price and follow every grading batch from draft to
              returned card.
            </p>
          </div>

          <div className="page-actions">
            <Link className="secondary-button" href="/cards">
              Open cards
            </Link>

            <button
              className="primary-button"
              type="button"
              onClick={() => {
                setMessage("");
                setShowCreateSubmission(true);
              }}
            >
              <span>＋</span>
              Create submission
            </button>
          </div>
        </header>

        {message && <p className="status-message">{message}</p>}

        <section className="metrics-grid">
          <article className="metric-card metric-card-featured">
            <div className="metric-card-header">
              <span className="metric-label">Active submissions</span>
              <span className="metric-icon">◈</span>
            </div>

            <p className="metric-value">{activeSubmissions.length}</p>
            <p className="metric-caption">
              draft, shipping, grading or results
            </p>
          </article>

          <article className="metric-card">
            <div className="metric-card-header">
              <span className="metric-label">Cards in workflow</span>
              <span className="metric-icon">▱</span>
            </div>

            <p className="metric-value">{activeCards.length}</p>
            <p className="metric-caption">
              {cardsInPhysicalGrading} physically submitted
            </p>
          </article>

          <article className="metric-card">
            <div className="metric-card-header">
              <span className="metric-label">Active grading cost</span>
              <span className="metric-icon">↘</span>
            </div>

            <p className="metric-value">
              {mixedCurrencies
                ? "Mixed"
                : formatCurrency(totalActiveGradingCost, summaryCurrency)}
            </p>
            <p className="metric-caption">
              allocated fees, shipping and preparation
            </p>
          </article>

          <article className="metric-card">
            <div className="metric-card-header">
              <span className="metric-label">Expected net upside</span>
              <span className="metric-icon">⌁</span>
            </div>

            <p
              className={`metric-value ${
                expectedNetUpside > 0
                  ? "metric-positive"
                  : expectedNetUpside < 0
                    ? "metric-negative"
                    : ""
              }`}
            >
              {mixedCurrencies || expectedSubmissions.length === 0
                ? "—"
                : formatCurrency(expectedNetUpside, summaryCurrency)}
            </p>
            <p className="metric-caption">
              only submissions with complete forecasts
            </p>
          </article>
        </section>

        <section className="workflow-panel">
          <div className="workflow-heading">
            <div>
              <p className="eyebrow">Workflow</p>
              <h2>Submission lifecycle</h2>
              <p>
                Drafts remain editable. Card status changes only after the
                batch is actually shipped.
              </p>
            </div>
          </div>

          <div className="workflow-steps">
            {[
              ["1", "Draft", "Select cards and plan costs"],
              ["2", "Ready", "Package and confirm the batch"],
              ["3", "Shipped", "Cards become At grading"],
              ["4", "Grading", "Track receipt and processing"],
              ["5", "Results", "Register grades and certificates"],
              ["6", "Returned", "Revalue and complete the batch"],
            ].map(([number, title, description]) => (
              <div className="workflow-step" key={title}>
                <span>{number}</span>
                <strong>{title}</strong>
                <small>{description}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="grading-panel">
          <div className="grading-panel-header">
            <div>
              <p className="eyebrow">Submission archive</p>
              <h2>Grading submissions</h2>
              <p>
                Search drafts and historic batches, then expand a submission
                to review its cards and economics.
              </p>
            </div>

            <span className="result-count">
              {filteredSubmissions.length} of {submissions.length}
            </span>
          </div>

          <div className="filter-grid">
            <label className="search-field">
              <span>Search</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Submission, player, card number, cert..."
              />
            </label>

            <label className="filter-field">
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as SubmissionFilter)
                }
              >
                <option value="all">All submissions</option>
                <option value="active">All active</option>
                <option value="draft">Draft and ready</option>
                <option value="in-transit">Shipped and received</option>
                <option value="grading">In grading</option>
                <option value="results">Results and returned</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>

            <label className="filter-field">
              <span>Sort</span>
              <select
                value={sortOption}
                onChange={(event) =>
                  setSortOption(event.target.value as SortOption)
                }
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="company">Grading company</option>
                <option value="cost-high">Highest cost</option>
              </select>
            </label>
          </div>

          {loading ? (
            <div className="loading-state">
              <span className="loading-spinner" />
              <p>Loading grading submissions...</p>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">◈</div>
              <h3>
                {submissions.length === 0
                  ? "Create your first grading submission"
                  : "No submissions match the filters"}
              </h3>
              <p>
                {submissions.length === 0
                  ? "Select eligible cards, plan costs and create a secure draft batch."
                  : "Adjust the search or status filter to see more submissions."}
              </p>

              {submissions.length === 0 && (
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => setShowCreateSubmission(true)}
                >
                  <span>＋</span>
                  Create submission
                </button>
              )}
            </div>
          ) : (
            <div className="submission-list">
              {filteredSubmissions.map((submission) => {
                const isExpanded = expandedSubmissionIds.has(submission.id);
                const statusTone = getSubmissionStatusTone(submission.status);
                const forecastRoi =
                  submission.expectedNetUpside !== null &&
                  submission.rawValueTotal + submission.totalGradingCost > 0
                    ? (submission.expectedNetUpside /
                        (submission.rawValueTotal +
                          submission.totalGradingCost)) *
                      100
                    : null;

                return (
                  <article className="submission-card" key={submission.id}>
                    <div className="submission-summary">
                      <div className="submission-company-mark">
                        {submission.grading_company.slice(0, 3)}
                      </div>

                      <div className="submission-identity">
                        <div className="submission-title-row">
                          <h3>{submission.name}</h3>
                          <span className={`status-pill status-${statusTone}`}>
                            {getSubmissionStatusLabel(submission.status)}
                          </span>
                        </div>

                        <p>
                          {joinDistinct([
                            submission.grading_company,
                            submission.service_level,
                            submission.submission_number
                              ? `#${submission.submission_number}`
                              : null,
                          ]) || submission.grading_company}
                        </p>

                        <div className="submission-meta">
                          <span>{submission.cards.length} cards</span>
                          <span>Created {formatDate(submission.created_at)}</span>
                          {submission.estimated_turnaround_days && (
                            <span>
                              {submission.estimated_turnaround_days} day estimate
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="submission-actions">
                        <button
                          type="button"
                          onClick={() => toggleSubmission(submission.id)}
                        >
                          {isExpanded ? "Hide cards" : "View cards"}
                          <span>{isExpanded ? "↑" : "↓"}</span>
                        </button>
                      </div>
                    </div>

                    <div className="submission-metrics">
                      <div>
                        <span>RAW snapshot</span>
                        <strong>
                          {formatCurrency(
                            submission.rawValueTotal,
                            submission.currency
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Declared value</span>
                        <strong>
                          {formatCurrency(
                            submission.declaredValueTotal,
                            submission.currency
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Grading cost</span>
                        <strong>
                          {formatCurrency(
                            submission.totalGradingCost,
                            submission.currency
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Expected graded value</span>
                        <strong>
                          {submission.expectedGradedValueTotal > 0
                            ? formatCurrency(
                                submission.expectedGradedValueTotal,
                                submission.currency
                              )
                            : "—"}
                        </strong>
                      </div>

                      <div>
                        <span>Expected net upside</span>
                        <strong
                          className={
                            submission.expectedNetUpside !== null &&
                            submission.expectedNetUpside >= 0
                              ? "value-positive"
                              : submission.expectedNetUpside !== null
                                ? "value-negative"
                                : ""
                          }
                        >
                          {formatCurrency(
                            submission.expectedNetUpside,
                            submission.currency
                          )}
                        </strong>
                        <small>{formatPercentage(forecastRoi)} forecast ROI</small>
                      </div>
                    </div>

                    {submission.notes && (
                      <p className="submission-notes">{submission.notes}</p>
                    )}

                    {isExpanded && (
                      <div className="submission-details">
                        <div className="detail-heading">
                          <div>
                            <p className="eyebrow">Batch cards</p>
                            <h4>Cards in submission</h4>
                          </div>

                          <span>
                            Shared costs: {formatCurrency(
                              submission.sharedCostTotal,
                              submission.currency
                            )}
                          </span>
                        </div>

                        <div className="submission-card-list">
                          {submission.cards.map((submissionCard) => {
                            const card = submissionCard.card;
                            const cardTitle =
                              card?.player_name ?? "Unavailable card";
                            const cardSubtitle = joinDistinct([
                              card?.year,
                              submissionCard.brand ?? card?.manufacturer,
                              submissionCard.product,
                              submissionCard.insertName,
                              card?.card_number
                                ? `#${card.card_number}`
                                : null,
                            ]);
                            const currentSlab = joinDistinct([
                              submissionCard.currentGradingCompany,
                              submissionCard.currentGrade,
                            ]);

                            return (
                              <div
                                className="submission-card-row"
                                key={submissionCard.id}
                              >
                                <div className="card-position">
                                  {submissionCard.position}
                                </div>

                                <div className="card-thumbnail">
                                  {submissionCard.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={submissionCard.imageUrl}
                                      alt={`${cardTitle} card front`}
                                    />
                                  ) : (
                                    <span>NE</span>
                                  )}
                                </div>

                                <div className="card-copy">
                                  <div className="card-title-line">
                                    <h5>{cardTitle}</h5>
                                    <span className="card-status-pill">
                                      {getCardStatusLabel(submissionCard.status)}
                                    </span>
                                  </div>

                                  <p>{cardSubtitle || "Card details unavailable"}</p>

                                  <div className="card-tags">
                                    {submissionCard.collection && (
                                      <span>
                                        {submissionCard.collection.name} · {getCollectionTypeLabel(
                                          submissionCard.collection.type
                                        )}
                                      </span>
                                    )}
                                    {currentSlab && <span>{currentSlab}</span>}
                                    {card?.serial_number && (
                                      <span>{card.serial_number}</span>
                                    )}
                                  </div>
                                </div>

                                <div className="card-economics">
                                  <div>
                                    <span>RAW value</span>
                                    <strong>
                                      {formatCurrency(
                                        submissionCard.rawValueSnapshot,
                                        submission.currency
                                      )}
                                    </strong>
                                  </div>

                                  <div>
                                    <span>Total cost</span>
                                    <strong>
                                      {formatCurrency(
                                        submissionCard.totalGradingCost,
                                        submission.currency
                                      )}
                                    </strong>
                                  </div>

                                  <div>
                                    <span>Expected</span>
                                    <strong>
                                      {submissionCard.expected_grade || "—"}
                                    </strong>
                                    <small>
                                      {formatCurrency(
                                        submissionCard.expectedGradedValue,
                                        submission.currency
                                      )}
                                    </small>
                                  </div>

                                  <div>
                                    <span>Result</span>
                                    <strong>
                                      {joinDistinct([
                                        submission.grading_company,
                                        submissionCard.result_grade,
                                        submissionCard.result_qualifier,
                                      ]) || "—"}
                                    </strong>
                                    {submissionCard.certification_number && (
                                      <small>
                                        Cert {submissionCard.certification_number}
                                      </small>
                                    )}
                                  </div>
                                </div>

                                {card && (
                                  <Link
                                    className="open-card-link"
                                    href={`/cards/${card.id}`}
                                  >
                                    Open card
                                    <span>→</span>
                                  </Link>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <CreateGradingSubmissionModal
        isOpen={showCreateSubmission}
        onClose={() => setShowCreateSubmission(false)}
        onCreated={(result) => {
          void handleCreated(result);
        }}
      />

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
              rgba(124, 92, 255, 0.09),
              transparent 30%
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
          opacity: 0.75;
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
          max-width: 1500px;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 28px;
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
          font-size: clamp(40px, 5vw, 66px);
          line-height: 1;
          letter-spacing: -0.055em;
        }

        .page-description {
          max-width: 760px;
          margin: 14px 0 0;
          color: #838c9f;
          font-size: 14px;
          line-height: 1.6;
        }

        .page-actions {
          flex: 0 0 auto;
          display: flex;
          gap: 10px;
        }

        .primary-button,
        .secondary-button {
          min-height: 46px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          padding: 0 18px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 780;
          text-decoration: none;
          cursor: pointer;
        }

        .primary-button {
          border: 0;
          background: linear-gradient(135deg, #8b5cf6, #6d5ce7);
          box-shadow: 0 12px 28px rgba(124, 92, 255, 0.24);
          color: #ffffff;
        }

        .primary-button:hover {
          filter: brightness(1.08);
        }

        .secondary-button {
          border: 1px solid rgba(148, 163, 184, 0.15);
          background: rgba(255, 255, 255, 0.025);
          color: #a8afbd;
        }

        .secondary-button:hover {
          background: rgba(255, 255, 255, 0.055);
          color: #ffffff;
        }

        .status-message {
          max-width: 1500px;
          margin: 0 auto 20px;
          padding: 13px 15px;
          border: 1px solid rgba(52, 211, 153, 0.2);
          border-radius: 13px;
          background: rgba(16, 185, 129, 0.06);
          color: #a7f3d0;
          font-size: 12px;
        }

        .metrics-grid {
          max-width: 1500px;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin: 0 auto;
        }

        .metric-card {
          min-width: 0;
          padding: 21px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 19px;
          background: #10131b;
          box-shadow: 0 15px 38px rgba(0, 0, 0, 0.16);
        }

        .metric-card-featured {
          border-color: rgba(139, 92, 246, 0.28);
          background:
            radial-gradient(
              circle at top right,
              rgba(124, 92, 255, 0.16),
              transparent 46%
            ),
            #12131d;
        }

        .metric-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .metric-label {
          color: #71798b;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .metric-icon {
          color: #9488f4;
          font-size: 15px;
        }

        .metric-value {
          margin: 15px 0 0;
          color: #ffffff;
          font-size: clamp(25px, 2.3vw, 35px);
          font-weight: 800;
          letter-spacing: -0.04em;
        }

        .metric-caption {
          margin: 7px 0 0;
          color: #697184;
          font-size: 10px;
          line-height: 1.5;
        }

        .metric-positive,
        .value-positive {
          color: #86efac !important;
        }

        .metric-negative,
        .value-negative {
          color: #fca5a5 !important;
        }

        .workflow-panel,
        .grading-panel {
          max-width: 1500px;
          margin: 22px auto 0;
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
        }

        .workflow-heading h2,
        .grading-panel-header h2 {
          margin: 7px 0 0;
          color: #ffffff;
          font-size: 22px;
          letter-spacing: -0.025em;
        }

        .workflow-heading p:not(.eyebrow),
        .grading-panel-header p:not(.eyebrow) {
          max-width: 720px;
          margin: 7px 0 0;
          color: #737c8e;
          font-size: 11px;
          line-height: 1.55;
        }

        .workflow-steps {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 9px;
          margin-top: 20px;
        }

        .workflow-step {
          min-width: 0;
          padding: 15px;
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.12);
        }

        .workflow-step > span {
          width: 25px;
          height: 25px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          background: rgba(124, 92, 255, 0.12);
          color: #c4b5fd;
          font-size: 9px;
          font-weight: 850;
        }

        .workflow-step strong {
          display: block;
          margin-top: 12px;
          color: #ffffff;
          font-size: 11px;
        }

        .workflow-step small {
          display: block;
          margin-top: 6px;
          color: #657084;
          font-size: 9px;
          line-height: 1.45;
        }

        .grading-panel-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
        }

        .result-count {
          flex: 0 0 auto;
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(124, 92, 255, 0.08);
          color: #c4b5fd;
          font-size: 9px;
          font-weight: 800;
        }

        .filter-grid {
          display: grid;
          grid-template-columns: minmax(250px, 1fr) 220px 220px;
          gap: 11px;
          padding: 19px 0;
        }

        .search-field,
        .filter-field {
          min-width: 0;
          display: grid;
          gap: 7px;
        }

        .search-field > span,
        .filter-field > span {
          color: #70798d;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }

        .search-field input,
        .filter-field select {
          width: 100%;
          min-height: 43px;
          padding: 0 13px;
          border: 1px solid rgba(148, 163, 184, 0.13);
          border-radius: 12px;
          outline: none;
          background: rgba(0, 0, 0, 0.16);
          color: #ffffff;
          color-scheme: dark;
          font: inherit;
          font-size: 12px;
        }

        .search-field input:focus,
        .filter-field select:focus {
          border-color: rgba(167, 139, 250, 0.56);
          box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.06);
        }

        .loading-state,
        .empty-state {
          min-height: 290px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 30px;
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

        .loading-state p {
          margin: 13px 0 0;
          color: #7c8598;
          font-size: 11px;
        }

        .empty-state-icon {
          width: 54px;
          height: 54px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(167, 139, 250, 0.2);
          border-radius: 16px;
          background: rgba(124, 92, 255, 0.08);
          color: #c4b5fd;
          font-size: 20px;
        }

        .empty-state h3 {
          margin: 15px 0 0;
          color: #ffffff;
          font-size: 17px;
        }

        .empty-state p {
          max-width: 510px;
          margin: 8px 0 18px;
          color: #71798b;
          font-size: 11px;
          line-height: 1.55;
        }

        .submission-list {
          display: grid;
          gap: 14px;
        }

        .submission-card {
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 19px;
          background: rgba(0, 0, 0, 0.12);
        }

        .submission-summary {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 16px;
          padding: 18px;
        }

        .submission-company-mark {
          width: 52px;
          height: 52px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(167, 139, 250, 0.22);
          border-radius: 15px;
          background: rgba(124, 92, 255, 0.09);
          color: #d8d1ff;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.06em;
        }

        .submission-identity {
          min-width: 0;
        }

        .submission-title-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 9px;
        }

        .submission-title-row h3 {
          margin: 0;
          color: #ffffff;
          font-size: 16px;
        }

        .status-pill,
        .card-status-pill {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          padding: 0 8px;
          border-radius: 999px;
          font-size: 8px;
          font-weight: 850;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .status-draft {
          border: 1px solid rgba(148, 163, 184, 0.17);
          background: rgba(148, 163, 184, 0.06);
          color: #cbd5e1;
        }

        .status-ready {
          border: 1px solid rgba(251, 191, 36, 0.22);
          background: rgba(245, 158, 11, 0.07);
          color: #fde68a;
        }

        .status-transit {
          border: 1px solid rgba(96, 165, 250, 0.22);
          background: rgba(59, 130, 246, 0.07);
          color: #bfdbfe;
        }

        .status-grading {
          border: 1px solid rgba(167, 139, 250, 0.24);
          background: rgba(139, 92, 246, 0.08);
          color: #ddd6fe;
        }

        .status-results,
        .status-complete {
          border: 1px solid rgba(52, 211, 153, 0.22);
          background: rgba(16, 185, 129, 0.07);
          color: #a7f3d0;
        }

        .status-cancelled {
          border: 1px solid rgba(248, 113, 113, 0.2);
          background: rgba(239, 68, 68, 0.06);
          color: #fca5a5;
        }

        .submission-identity > p {
          margin: 6px 0 0;
          color: #8992a5;
          font-size: 11px;
        }

        .submission-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 10px;
        }

        .submission-meta span,
        .card-tags span {
          padding: 5px 7px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.03);
          color: #6f788b;
          font-size: 8px;
          font-weight: 700;
        }

        .submission-actions button {
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 0 12px;
          border: 1px solid rgba(148, 163, 184, 0.13);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.025);
          color: #a1a8b6;
          font-size: 10px;
          font-weight: 750;
          cursor: pointer;
        }

        .submission-actions button:hover {
          border-color: rgba(167, 139, 250, 0.28);
          color: #ffffff;
        }

        .submission-metrics {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 1px;
          border-top: 1px solid rgba(148, 163, 184, 0.09);
          border-bottom: 1px solid rgba(148, 163, 184, 0.09);
          background: rgba(148, 163, 184, 0.08);
        }

        .submission-metrics > div {
          min-width: 0;
          padding: 14px 15px;
          background: #0d1017;
        }

        .submission-metrics span,
        .card-economics span {
          display: block;
          color: #667084;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .submission-metrics strong,
        .card-economics strong {
          display: block;
          margin-top: 7px;
          color: #ffffff;
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        .submission-metrics small,
        .card-economics small {
          display: block;
          margin-top: 4px;
          color: #657084;
          font-size: 8px;
        }

        .submission-notes {
          margin: 0;
          padding: 13px 18px;
          color: #858da0;
          font-size: 10px;
          line-height: 1.55;
        }

        .submission-details {
          padding: 19px;
          background: rgba(8, 10, 16, 0.56);
        }

        .detail-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 13px;
        }

        .detail-heading h4 {
          margin: 6px 0 0;
          color: #ffffff;
          font-size: 15px;
        }

        .detail-heading > span {
          color: #8178b2;
          font-size: 9px;
          font-weight: 750;
        }

        .submission-card-list {
          display: grid;
          gap: 8px;
        }

        .submission-card-row {
          min-width: 0;
          display: grid;
          grid-template-columns: auto auto minmax(180px, 1fr) minmax(420px, 1.8fr) auto;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.018);
        }

        .card-position {
          width: 26px;
          height: 26px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          background: rgba(124, 92, 255, 0.1);
          color: #c4b5fd;
          font-size: 9px;
          font-weight: 850;
        }

        .card-thumbnail {
          width: 48px;
          height: 67px;
          display: grid;
          place-items: center;
          overflow: hidden;
          border-radius: 8px;
          background: #07090e;
        }

        .card-thumbnail img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: contain;
        }

        .card-thumbnail span {
          color: #786ea9;
          font-size: 9px;
          font-weight: 850;
        }

        .card-copy {
          min-width: 0;
        }

        .card-title-line {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 7px;
        }

        .card-title-line h5 {
          margin: 0;
          color: #ffffff;
          font-size: 12px;
        }

        .card-status-pill {
          border: 1px solid rgba(148, 163, 184, 0.14);
          background: rgba(148, 163, 184, 0.05);
          color: #aab1bf;
        }

        .card-copy > p {
          margin: 6px 0 0;
          color: #767f92;
          font-size: 9px;
          line-height: 1.45;
        }

        .card-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }

        .card-economics {
          min-width: 0;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .card-economics > div {
          min-width: 0;
          padding: 9px 10px;
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.14);
        }

        .open-card-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #a99dfd;
          font-size: 9px;
          font-weight: 750;
          text-decoration: none;
          white-space: nowrap;
        }

        .open-card-link:hover {
          color: #ddd6fe;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1260px) {
          .metrics-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .workflow-steps {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .submission-metrics {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .submission-card-row {
            grid-template-columns: auto auto minmax(0, 1fr) auto;
          }

          .card-economics {
            grid-column: 3 / -1;
          }
        }

        @media (max-width: 980px) {
          .app-shell {
            display: block;
          }

          .sidebar {
            position: static;
            width: 100%;
            height: auto;
            padding: 17px 16px 13px;
            border-right: 0;
            border-bottom: 1px solid rgba(148, 163, 184, 0.11);
          }

          .sidebar > div:first-child {
            min-width: 0;
          }

          .brand {
            padding: 0 4px;
          }

          .brand-mark {
            width: 44px;
            height: 44px;
            border-radius: 14px;
            font-size: 19px;
          }

          .brand-name {
            font-size: 16px;
          }

          .brand-subtitle {
            font-size: 9px;
          }

          .navigation {
            display: flex;
            overflow-x: auto;
            gap: 7px;
            margin-top: 16px;
            padding-bottom: 2px;
          }

          .navigation-label,
          .sidebar-footer {
            display: none;
          }

          .navigation-item {
            width: auto;
            min-width: max-content;
            min-height: 40px;
            padding: 0 12px;
            border: 1px solid rgba(148, 163, 184, 0.1);
          }

          .navigation-icon {
            width: auto;
          }

          .main-content {
            padding: 30px 20px 55px;
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

          .filter-grid {
            grid-template-columns: 1fr 1fr;
          }

          .search-field {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 700px) {
          .main-content {
            padding: 24px 13px 45px;
          }

          .page-header h1 {
            font-size: 40px;
          }

          .metrics-grid,
          .workflow-steps,
          .filter-grid,
          .submission-metrics {
            grid-template-columns: 1fr;
          }

          .workflow-panel,
          .grading-panel {
            padding: 18px;
            border-radius: 19px;
          }

          .grading-panel-header,
          .detail-heading {
            flex-direction: column;
          }

          .submission-summary {
            grid-template-columns: auto minmax(0, 1fr);
            align-items: start;
          }

          .submission-actions {
            grid-column: 1 / -1;
          }

          .submission-actions button {
            width: 100%;
            justify-content: center;
          }

          .submission-card-row {
            grid-template-columns: auto auto minmax(0, 1fr);
            align-items: start;
          }

          .card-economics {
            grid-column: 1 / -1;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .open-card-link {
            grid-column: 1 / -1;
            justify-content: flex-end;
          }
        }

        @media (max-width: 440px) {
          .page-actions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .card-economics {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}