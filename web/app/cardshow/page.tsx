"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import CreateCardshowEventModal from "@/components/cardshow/CreateCardshowEventModal";
import type { CreateCardshowEventResult } from "@/lib/cardshow/createCardshowEvent";
import { createClient } from "@/lib/supabase/client";

type NumericDatabaseValue = number | string | null;
type CardshowEventStatus = "planning" | "active" | "closed" | "cancelled";
type InventoryStatus = "available" | "reserved" | "sold" | "withdrawn";
type PurchaseLotStatus = "draft" | "allocated" | "locked" | "cancelled";
type EventFilter = "all" | CardshowEventStatus;
type EventSort = "upcoming" | "newest" | "cost-high" | "inventory-high";

type CardshowEventRow = {
  id: string;
  name: string;
  status: CardshowEventStatus;
  venue: string | null;
  city: string | null;
  address: string | null;
  starts_at: string | null;
  ends_at: string | null;
  currency: string;
  payment_methods: string[];
  booth_fee: NumericDatabaseValue;
  travel_cost: NumericDatabaseValue;
  accommodation_cost: NumericDatabaseValue;
  food_cost: NumericDatabaseValue;
  other_event_costs: NumericDatabaseValue;
  event_cost_total: NumericDatabaseValue;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type InventoryRow = {
  id: string;
  event_id: string;
  card_id: string;
  status: InventoryStatus;
  asking_price: NumericDatabaseValue;
  floor_price: NumericDatabaseValue;
  reference_value: NumericDatabaseValue;
  location_label: string | null;
  added_at: string;
};

type PurchaseLotRow = {
  id: string;
  name: string;
  status: PurchaseLotStatus;
  allocation_method: string;
  source: string | null;
  seller: string | null;
  purchased_at: string;
  currency: string;
  total_cost: NumericDatabaseValue;
  allocated_total: NumericDatabaseValue;
  created_at: string;
};

type EventSummary = CardshowEventRow & {
  eventCostTotal: number;
  inventoryCount: number;
  availableCount: number;
  reservedCount: number;
  soldCount: number;
  withdrawnCount: number;
  askingTotal: number;
  floorTotal: number;
  referenceTotal: number;
  locationCount: number;
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
  { label: "Grading", icon: "◈", href: "/grading" },
  { label: "Cardshow", icon: "▦", active: true },
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

function formatCurrency(value: number, currency = "DKK") {
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
    return "Date not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date not set";
  }

  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getStatusLabel(status: CardshowEventStatus) {
  switch (status) {
    case "planning":
      return "Planning";
    case "active":
      return "Active";
    case "closed":
      return "Closed";
    case "cancelled":
      return "Cancelled";
  }
}

function getStatusTone(status: CardshowEventStatus) {
  switch (status) {
    case "planning":
      return "planning";
    case "active":
      return "active";
    case "closed":
      return "closed";
    case "cancelled":
      return "cancelled";
  }
}

function getLocation(event: CardshowEventRow) {
  return [event.venue, event.city]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" · ") || "Location not set";
}

function getPaymentMethodLabel(method: string) {
  switch (method) {
    case "cash":
      return "Cash";
    case "mobilepay":
      return "MobilePay";
    case "card":
      return "Card";
    case "bank_transfer":
      return "Bank transfer";
    case "paypal":
      return "PayPal";
    case "other":
      return "Other";
    default:
      return method;
  }
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export default function CardshowCenterPage() {
  const supabase = useMemo(() => createClient(), []);

  const [events, setEvents] = useState<EventSummary[]>([]);
  const [purchaseLots, setPurchaseLots] = useState<PurchaseLotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(
    () => new Set()
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<EventFilter>("all");
  const [sortOption, setSortOption] = useState<EventSort>("upcoming");

  const loadCardshowCenter = useCallback(async () => {
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

    const [eventResult, inventoryResult, lotResult] = await Promise.all([
      supabase
        .from("cardshow_events")
        .select(`
          id,
          name,
          status,
          venue,
          city,
          address,
          starts_at,
          ends_at,
          currency,
          payment_methods,
          booth_fee,
          travel_cost,
          accommodation_cost,
          food_cost,
          other_event_costs,
          event_cost_total,
          notes,
          created_at,
          updated_at
        `)
        .eq("user_id", user.id)
        .order("starts_at", { ascending: false, nullsFirst: false }),

      supabase
        .from("cardshow_inventory_items")
        .select(`
          id,
          event_id,
          card_id,
          status,
          asking_price,
          floor_price,
          reference_value,
          location_label,
          added_at
        `)
        .eq("user_id", user.id),

      supabase
        .from("purchase_lots")
        .select(`
          id,
          name,
          status,
          allocation_method,
          source,
          seller,
          purchased_at,
          currency,
          total_cost,
          allocated_total,
          created_at
        `)
        .eq("user_id", user.id)
        .order("purchased_at", { ascending: false })
        .limit(10),
    ]);

    if (eventResult.error) {
      setEvents([]);
      setPurchaseLots([]);
      setMessage(`Cardshows could not be loaded: ${eventResult.error.message}`);
      setLoading(false);
      return;
    }

    const warnings: string[] = [];
    const eventRows = (eventResult.data ?? []) as CardshowEventRow[];
    const inventoryRows = inventoryResult.error
      ? []
      : ((inventoryResult.data ?? []) as InventoryRow[]);
    const lotRows = lotResult.error
      ? []
      : ((lotResult.data ?? []) as PurchaseLotRow[]);

    if (inventoryResult.error) {
      warnings.push("Cardshow inventory totals could not be loaded.");
    }

    if (lotResult.error) {
      warnings.push("Purchase lots could not be loaded.");
    }

    const inventoryByEventId = new Map<string, InventoryRow[]>();

    for (const inventoryItem of inventoryRows) {
      const currentItems = inventoryByEventId.get(inventoryItem.event_id) ?? [];
      currentItems.push(inventoryItem);
      inventoryByEventId.set(inventoryItem.event_id, currentItems);
    }

    const nextEvents = eventRows.map<EventSummary>((event) => {
      const items = inventoryByEventId.get(event.id) ?? [];
      const locations = new Set(
        items
          .map((item) => item.location_label?.trim())
          .filter((value): value is string => Boolean(value))
      );

      return {
        ...event,
        eventCostTotal: toNumber(event.event_cost_total),
        inventoryCount: items.length,
        availableCount: items.filter((item) => item.status === "available").length,
        reservedCount: items.filter((item) => item.status === "reserved").length,
        soldCount: items.filter((item) => item.status === "sold").length,
        withdrawnCount: items.filter((item) => item.status === "withdrawn").length,
        askingTotal: items.reduce(
          (total, item) => total + toNumber(item.asking_price),
          0
        ),
        floorTotal: items.reduce(
          (total, item) => total + toNumber(item.floor_price),
          0
        ),
        referenceTotal: items.reduce(
          (total, item) => total + toNumber(item.reference_value),
          0
        ),
        locationCount: locations.size,
      };
    });

    setEvents(nextEvents);
    setPurchaseLots(lotRows);

    if (warnings.length > 0) {
      setMessage(warnings.join(" "));
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadCardshowCenter();
  }, [loadCardshowCenter]);

  async function handleCreated(result: CreateCardshowEventResult) {
    setShowCreateEvent(false);
    await loadCardshowCenter();
    setMessage(result.message);
    setExpandedEventIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.add(result.eventId);
      return nextIds;
    });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function toggleEvent(eventId: string) {
    setExpandedEventIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(eventId)) {
        nextIds.delete(eventId);
      } else {
        nextIds.add(eventId);
      }

      return nextIds;
    });
  }

  const filteredEvents = useMemo(() => {
    const normalizedSearch = normalizeSearch(searchTerm);

    const matchingEvents = events.filter((event) => {
      if (statusFilter !== "all" && event.status !== statusFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return normalizeSearch(
        [event.name, event.venue, event.city, event.address, event.notes]
          .filter(Boolean)
          .join(" ")
      ).includes(normalizedSearch);
    });

    return [...matchingEvents].sort((first, second) => {
      switch (sortOption) {
        case "newest":
          return (
            new Date(second.created_at).getTime() -
            new Date(first.created_at).getTime()
          );
        case "cost-high":
          return second.eventCostTotal - first.eventCostTotal;
        case "inventory-high":
          return second.inventoryCount - first.inventoryCount;
        case "upcoming":
        default: {
          const firstTime = first.starts_at
            ? new Date(first.starts_at).getTime()
            : Number.MAX_SAFE_INTEGER;
          const secondTime = second.starts_at
            ? new Date(second.starts_at).getTime()
            : Number.MAX_SAFE_INTEGER;

          return firstTime - secondTime;
        }
      }
    });
  }, [events, searchTerm, sortOption, statusFilter]);

  const activeEvents = events.filter((event) => event.status === "active");
  const planningEvents = events.filter((event) => event.status === "planning");
  const openEvents = events.filter((event) =>
    ["planning", "active"].includes(event.status)
  );
  const primaryCurrency = events[0]?.currency ?? "DKK";
  const mixedCurrencies = new Set(events.map((event) => event.currency)).size > 1;
  const totalAvailableCards = openEvents.reduce(
    (total, event) => total + event.availableCount,
    0
  );
  const totalAskingValue = openEvents
    .filter((event) => event.currency === primaryCurrency)
    .reduce((total, event) => total + event.askingTotal, 0);
  const totalEventCosts = openEvents
    .filter((event) => event.currency === primaryCurrency)
    .reduce((total, event) => total + event.eventCostTotal, 0);
  const lockedLots = purchaseLots.filter((lot) => lot.status === "locked");
  const lockedLotCost = lockedLots
    .filter((lot) => lot.currency === primaryCurrency)
    .reduce((total, lot) => total + toNumber(lot.total_cost), 0);

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
                    className="navigation-item"
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
                  className={[
                    "navigation-item",
                    item.active ? "navigation-item-active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={item.label}
                  type="button"
                  disabled={item.active || item.comingSoon}
                >
                  <span className="navigation-icon">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.comingSoon && <span className="coming-soon">Soon</span>}
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
            <p className="eyebrow">Seller operations</p>
            <h1>Cardshow Center</h1>
            <p className="page-description">
              Plan events, prepare inventory, track operating costs and build a
              reliable checkout foundation for show day.
            </p>
          </div>

          <div className="page-actions">
            <Link className="secondary-button" href="/scanner">
              Open scanner
            </Link>
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                setMessage("");
                setShowCreateEvent(true);
              }}
            >
              <span>＋</span>
              Create cardshow
            </button>
          </div>
        </header>

        {message && <p className="status-message">{message}</p>}

        <section className="metrics-grid">
          <MetricCard
            label="Active events"
            value={String(activeEvents.length)}
            caption={`${planningEvents.length} still in planning`}
            icon="▦"
            featured
          />
          <MetricCard
            label="Available cards"
            value={totalAvailableCards.toLocaleString("da-DK")}
            caption="across planning and active events"
            icon="▱"
          />
          <MetricCard
            label="Asking value"
            value={
              mixedCurrencies
                ? "Mixed"
                : formatCurrency(totalAskingValue, primaryCurrency)
            }
            caption="current available event inventory"
            icon="◇"
          />
          <MetricCard
            label="Open-event costs"
            value={
              mixedCurrencies
                ? "Mixed"
                : formatCurrency(totalEventCosts, primaryCurrency)
            }
            caption="booth, travel and shared event expenses"
            icon="↘"
          />
        </section>

        <section className="readiness-panel">
          <div>
            <p className="eyebrow">Two-week sprint</p>
            <h2>Cardshow readiness</h2>
            <p>
              Event setup is live. Inventory preparation, purchase-lot allocation
              and multi-card checkout are the next operational layers.
            </p>
          </div>

          <div className="readiness-steps">
            <ReadinessStep number="1" title="Event" status="Ready" active />
            <ReadinessStep number="2" title="Inventory" status="Next" />
            <ReadinessStep number="3" title="Rapid intake" status="Planned" />
            <ReadinessStep number="4" title="Checkout" status="Planned" />
            <ReadinessStep number="5" title="Deploy" status="Planned" />
          </div>
        </section>

        <section className="event-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Event operations</p>
              <h2>Cardshows</h2>
              <p>
                Create events now. Inventory, pricing and checkout actions will
                attach to these event records.
              </p>
            </div>
            <span className="result-count">
              {filteredEvents.length} of {events.length}
            </span>
          </div>

          <div className="filter-grid">
            <label className="search-field">
              <span>SEARCH</span>
              <input
                type="search"
                value={searchTerm}
                placeholder="Event, venue, city or note..."
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </label>

            <label className="filter-field">
              <span>STATUS</span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as EventFilter)
                }
              >
                <option value="all">All events</option>
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>

            <label className="filter-field">
              <span>SORT</span>
              <select
                value={sortOption}
                onChange={(event) =>
                  setSortOption(event.target.value as EventSort)
                }
              >
                <option value="upcoming">Upcoming first</option>
                <option value="newest">Newest created</option>
                <option value="inventory-high">Most inventory</option>
                <option value="cost-high">Highest event cost</option>
              </select>
            </label>
          </div>

          {loading ? (
            <div className="loading-state">
              <span className="loading-spinner" />
              <p>Loading cardshow operations...</p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">▦</div>
              <h3>
                {events.length === 0
                  ? "Create your first cardshow"
                  : "No events match the filters"}
              </h3>
              <p>
                {events.length === 0
                  ? "Start with the event details. Inventory and seller checkout will be attached next."
                  : "Adjust the search or status filter to show more events."}
              </p>
              {events.length === 0 && (
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => setShowCreateEvent(true)}
                >
                  <span>＋</span>
                  Create cardshow
                </button>
              )}
            </div>
          ) : (
            <div className="event-list">
              {filteredEvents.map((event) => {
                const isExpanded = expandedEventIds.has(event.id);

                return (
                  <article className="event-card" key={event.id}>
                    <div className="event-summary">
                      <div className="event-mark">SHOW</div>

                      <div className="event-copy">
                        <div className="event-title-row">
                          <h3>{event.name}</h3>
                          <span
                            className={`status-pill status-${getStatusTone(
                              event.status
                            )}`}
                          >
                            {getStatusLabel(event.status)}
                          </span>
                        </div>
                        <p>{getLocation(event)}</p>
                        <div className="event-meta">
                          <span>{formatDate(event.starts_at)}</span>
                          <span>{event.currency}</span>
                          <span>{event.inventoryCount} cards</span>
                          {event.locationCount > 0 && (
                            <span>{event.locationCount} locations</span>
                          )}
                        </div>
                      </div>

                      <div className="event-actions">
                        <button
                          type="button"
                          onClick={() => toggleEvent(event.id)}
                        >
                          {isExpanded ? "Hide details" : "View details"}
                          <span>{isExpanded ? "↑" : "↓"}</span>
                        </button>
                      </div>
                    </div>

                    <div className="event-metrics">
                      <EventMetric
                        label="Available"
                        value={String(event.availableCount)}
                      />
                      <EventMetric
                        label="Reserved"
                        value={String(event.reservedCount)}
                      />
                      <EventMetric
                        label="Sold"
                        value={String(event.soldCount)}
                      />
                      <EventMetric
                        label="Asking value"
                        value={formatCurrency(event.askingTotal, event.currency)}
                      />
                      <EventMetric
                        label="Event cost"
                        value={formatCurrency(
                          event.eventCostTotal,
                          event.currency
                        )}
                      />
                    </div>

                    {isExpanded && (
                      <div className="event-details">
                        <div className="detail-grid">
                          <DetailBlock
                            label="Schedule"
                            value={`${formatDateTime(
                              event.starts_at
                            )} → ${formatDateTime(event.ends_at)}`}
                          />
                          <DetailBlock
                            label="Address"
                            value={event.address || "Not set"}
                          />
                          <DetailBlock
                            label="Payment methods"
                            value={
                              event.payment_methods
                                .map(getPaymentMethodLabel)
                                .join(" · ") || "Not set"
                            }
                          />
                          <DetailBlock
                            label="Floor total"
                            value={formatCurrency(event.floorTotal, event.currency)}
                          />
                          <DetailBlock
                            label="Reference value"
                            value={formatCurrency(
                              event.referenceTotal,
                              event.currency
                            )}
                          />
                          <DetailBlock
                            label="Withdrawn"
                            value={String(event.withdrawnCount)}
                          />
                        </div>

                        {event.notes && <p className="event-notes">{event.notes}</p>}

                        <div className="next-actions">
                          <div>
                            <strong>Inventory management is next</strong>
                            <p>
                              The next sprint adds bulk card selection, asking and
                              floor prices, price groups and physical locations.
                            </p>
                          </div>
                          <button type="button" disabled>
                            Manage inventory
                            <span>Next</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="lots-panel">
          <div className="panel-heading compact-heading">
            <div>
              <p className="eyebrow">Acquisition accounting</p>
              <h2>Purchase lots</h2>
              <p>
                Lots will distribute total acquisition cost across individual
                cards before sales are recorded.
              </p>
            </div>
            <span className="result-count">{purchaseLots.length} recent</span>
          </div>

          <div className="lot-summary-grid">
            <MetricCard
              label="Locked lots"
              value={String(lockedLots.length)}
              caption="cost basis transferred to cards"
              icon="✓"
            />
            <MetricCard
              label="Locked cost"
              value={
                mixedCurrencies
                  ? "Mixed"
                  : formatCurrency(lockedLotCost, primaryCurrency)
              }
              caption="recent locked acquisition lots"
              icon="↘"
            />
            <article className="lot-next-card">
              <span>PURCHASE LOTS</span>
              <strong>Create and allocate lots next</strong>
              <p>
                Proportional, equal and manual allocation services are ready. The
                next UI will let you select cards and preview every allocated cost.
              </p>
              <button type="button" disabled>
                Create purchase lot
                <small>Next sprint</small>
              </button>
            </article>
          </div>
        </section>
      </main>

      <CreateCardshowEventModal
        isOpen={showCreateEvent}
        onClose={() => setShowCreateEvent(false)}
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
          grid-template-columns: 290px minmax(0, 1fr);
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
          width: 54px;
          height: 54px;
          display: grid;
          place-items: center;
          border-radius: 17px;
          background: linear-gradient(145deg, #8b6dff, #6353dd);
          box-shadow: 0 18px 35px rgba(94, 70, 216, 0.3);
          color: #ffffff;
          font-size: 23px;
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
          font-size: 18px;
          font-weight: 850;
        }

        .brand-subtitle {
          margin-top: 5px;
          color: #71798b;
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .navigation {
          display: grid;
          gap: 5px;
          margin-top: 48px;
        }

        .navigation-label {
          padding: 0 15px 12px;
          color: #596172;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .navigation-item,
        .settings-button {
          width: 100%;
          min-height: 49px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 15px;
          border: 0;
          border-radius: 13px;
          background: transparent;
          color: #8d95a7;
          font: inherit;
          font-size: 13px;
          text-decoration: none;
          text-align: left;
        }

        .navigation-item:hover:not(:disabled) {
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
          opacity: 0.8;
        }

        .navigation-icon {
          width: 23px;
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
          font-size: 7px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .sidebar-footer {
          display: grid;
          gap: 14px;
        }

        .settings-button {
          justify-content: flex-start;
        }

        .user-card {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 13px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.024);
        }

        .user-avatar {
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 12px;
          background: #171b28;
          color: #ffffff;
          font-size: 11px;
          font-weight: 850;
        }

        .user-information {
          min-width: 0;
          flex: 1;
        }

        .user-information p {
          overflow: hidden;
          color: #ffffff;
          font-size: 11px;
          font-weight: 750;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .user-information span {
          display: block;
          margin-top: 4px;
          color: #697184;
          font-size: 9px;
        }

        .logout-button {
          width: 29px;
          height: 29px;
          border: 0;
          border-radius: 9px;
          background: transparent;
          color: #6f7789;
          cursor: pointer;
        }

        .main-content {
          min-width: 0;
          padding: 50px 50px 70px;
        }

        .page-header,
        .metrics-grid,
        .readiness-panel,
        .event-panel,
        .lots-panel,
        .status-message {
          max-width: 1500px;
          margin-right: auto;
          margin-left: auto;
        }

        .page-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 28px;
          margin-bottom: 30px;
        }

        .eyebrow {
          margin: 0;
          color: #9f93ff;
          font-size: 9px;
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
          font-size: 13px;
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
          font-size: 12px;
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

        .secondary-button {
          border: 1px solid rgba(148, 163, 184, 0.15);
          background: rgba(255, 255, 255, 0.025);
          color: #a8afbd;
        }

        .status-message {
          margin-bottom: 20px;
          padding: 13px 15px;
          border: 1px solid rgba(52, 211, 153, 0.2);
          border-radius: 13px;
          background: rgba(16, 185, 129, 0.06);
          color: #a7f3d0;
          font-size: 11px;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 13px;
        }

        .readiness-panel,
        .event-panel,
        .lots-panel {
          margin-top: 21px;
          padding: 23px;
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

        .readiness-panel {
          display: grid;
          grid-template-columns: minmax(250px, 0.8fr) minmax(0, 1.7fr);
          align-items: center;
          gap: 24px;
        }

        .readiness-panel h2,
        .panel-heading h2 {
          margin: 7px 0 0;
          color: #ffffff;
          font-size: 21px;
          letter-spacing: -0.025em;
        }

        .readiness-panel p:not(.eyebrow),
        .panel-heading p:not(.eyebrow) {
          margin: 7px 0 0;
          color: #737c8e;
          font-size: 10px;
          line-height: 1.55;
        }

        .readiness-steps {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
        }

        .panel-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding-bottom: 19px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
        }

        .compact-heading {
          border-bottom: 0;
          padding-bottom: 6px;
        }

        .result-count {
          flex: 0 0 auto;
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(124, 92, 255, 0.08);
          color: #c4b5fd;
          font-size: 8px;
          font-weight: 800;
        }

        .filter-grid {
          display: grid;
          grid-template-columns: minmax(250px, 1fr) 190px 190px;
          gap: 10px;
          padding: 18px 0;
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
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.09em;
        }

        .search-field input,
        .filter-field select {
          width: 100%;
          min-height: 42px;
          padding: 0 12px;
          border: 1px solid rgba(148, 163, 184, 0.13);
          border-radius: 12px;
          outline: none;
          background: rgba(0, 0, 0, 0.16);
          color: #ffffff;
          color-scheme: dark;
          font: inherit;
          font-size: 11px;
        }

        .loading-state,
        .empty-state {
          min-height: 280px;
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
          font-size: 10px;
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
          font-size: 16px;
        }

        .empty-state p {
          max-width: 520px;
          margin: 8px 0 18px;
          color: #71798b;
          font-size: 10px;
          line-height: 1.55;
        }

        .event-list {
          display: grid;
          gap: 13px;
        }

        .event-card {
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 19px;
          background: rgba(0, 0, 0, 0.12);
        }

        .event-summary {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 16px;
          padding: 18px;
        }

        .event-mark {
          width: 54px;
          height: 54px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(167, 139, 250, 0.22);
          border-radius: 15px;
          background: rgba(124, 92, 255, 0.09);
          color: #d8d1ff;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.06em;
        }

        .event-copy {
          min-width: 0;
        }

        .event-title-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 9px;
        }

        .event-title-row h3 {
          margin: 0;
          color: #ffffff;
          font-size: 15px;
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          min-height: 23px;
          padding: 0 8px;
          border-radius: 999px;
          font-size: 7px;
          font-weight: 850;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .status-planning {
          border: 1px solid rgba(251, 191, 36, 0.22);
          background: rgba(245, 158, 11, 0.07);
          color: #fde68a;
        }

        .status-active {
          border: 1px solid rgba(52, 211, 153, 0.22);
          background: rgba(16, 185, 129, 0.07);
          color: #a7f3d0;
        }

        .status-closed {
          border: 1px solid rgba(96, 165, 250, 0.2);
          background: rgba(59, 130, 246, 0.06);
          color: #bfdbfe;
        }

        .status-cancelled {
          border: 1px solid rgba(248, 113, 113, 0.2);
          background: rgba(239, 68, 68, 0.06);
          color: #fca5a5;
        }

        .event-copy > p {
          margin: 6px 0 0;
          color: #8992a5;
          font-size: 10px;
        }

        .event-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 10px;
        }

        .event-meta span {
          padding: 5px 7px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.03);
          color: #6f788b;
          font-size: 7px;
          font-weight: 700;
        }

        .event-actions button {
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 0 12px;
          border: 1px solid rgba(148, 163, 184, 0.13);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.025);
          color: #a1a8b6;
          font-size: 9px;
          font-weight: 750;
          cursor: pointer;
        }

        .event-metrics {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 1px;
          border-top: 1px solid rgba(148, 163, 184, 0.09);
          border-bottom: 1px solid rgba(148, 163, 184, 0.09);
          background: rgba(148, 163, 184, 0.08);
        }

        .event-details {
          padding: 18px;
          background: rgba(8, 10, 16, 0.56);
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 9px;
        }

        .event-notes {
          margin: 12px 0 0;
          padding: 12px 13px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.025);
          color: #81899c;
          font-size: 9px;
          line-height: 1.55;
        }

        .next-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-top: 13px;
          padding: 14px;
          border: 1px solid rgba(139, 92, 246, 0.17);
          border-radius: 14px;
          background: rgba(124, 92, 255, 0.05);
        }

        .next-actions strong {
          color: #ddd6fe;
          font-size: 10px;
        }

        .next-actions p {
          margin: 5px 0 0;
          color: #78718d;
          font-size: 8px;
          line-height: 1.45;
        }

        .next-actions button {
          flex: 0 0 auto;
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 0 12px;
          border: 1px solid rgba(167, 139, 250, 0.18);
          border-radius: 10px;
          background: rgba(124, 92, 255, 0.06);
          color: #968fac;
          font-size: 9px;
        }

        .next-actions button span {
          padding: 3px 5px;
          border-radius: 5px;
          background: rgba(255, 255, 255, 0.04);
          font-size: 7px;
          text-transform: uppercase;
        }

        .lot-summary-grid {
          display: grid;
          grid-template-columns: 0.65fr 0.65fr 1.7fr;
          gap: 12px;
          margin-top: 14px;
        }

        .lot-next-card {
          min-width: 0;
          padding: 18px;
          border: 1px solid rgba(139, 92, 246, 0.2);
          border-radius: 17px;
          background: rgba(124, 92, 255, 0.045);
        }

        .lot-next-card > span {
          color: #9f93ff;
          font-size: 8px;
          font-weight: 850;
          letter-spacing: 0.12em;
        }

        .lot-next-card strong {
          display: block;
          margin-top: 7px;
          color: #ffffff;
          font-size: 14px;
        }

        .lot-next-card p {
          margin: 7px 0 0;
          color: #737c8e;
          font-size: 9px;
          line-height: 1.55;
        }

        .lot-next-card button {
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
          padding: 0 12px;
          border: 1px solid rgba(167, 139, 250, 0.17);
          border-radius: 10px;
          background: rgba(124, 92, 255, 0.06);
          color: #9189a9;
          font-size: 9px;
        }

        .lot-next-card small {
          padding: 3px 5px;
          border-radius: 5px;
          background: rgba(255, 255, 255, 0.04);
          font-size: 7px;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1180px) {
          .metrics-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .readiness-panel {
            grid-template-columns: 1fr;
          }

          .event-metrics {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .lot-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .lot-next-card {
            grid-column: 1 / -1;
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
          .readiness-steps,
          .filter-grid,
          .event-metrics,
          .detail-grid,
          .lot-summary-grid {
            grid-template-columns: 1fr;
          }

          .event-panel,
          .readiness-panel,
          .lots-panel {
            padding: 17px;
            border-radius: 19px;
          }

          .panel-heading,
          .event-summary,
          .next-actions {
            align-items: flex-start;
            flex-direction: column;
          }

          .event-summary {
            display: grid;
            grid-template-columns: auto minmax(0, 1fr);
          }

          .event-actions {
            grid-column: 1 / -1;
            width: 100%;
          }

          .event-actions button {
            width: 100%;
            justify-content: center;
          }

          .next-actions button {
            width: 100%;
            justify-content: center;
          }
        }

        @media (max-width: 440px) {
          .page-actions {
            display: grid;
            grid-template-columns: 1fr;
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
  icon: string;
  featured?: boolean;
};

function MetricCard({
  label,
  value,
  caption,
  icon,
  featured = false,
}: MetricCardProps) {
  return (
    <article className={featured ? "metric-card featured" : "metric-card"}>
      <div>
        <span>{label}</span>
        <i>{icon}</i>
      </div>
      <strong>{value}</strong>
      <p>{caption}</p>

      <style jsx>{`
        .metric-card {
          min-width: 0;
          padding: 20px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 19px;
          background: #10131b;
          box-shadow: 0 15px 38px rgba(0, 0, 0, 0.16);
        }

        .featured {
          border-color: rgba(139, 92, 246, 0.28);
          background:
            radial-gradient(
              circle at top right,
              rgba(124, 92, 255, 0.16),
              transparent 46%
            ),
            #12131d;
        }

        .metric-card > div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .metric-card span {
          color: #71798b;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .metric-card i {
          color: #9488f4;
          font-size: 14px;
          font-style: normal;
        }

        .metric-card strong {
          display: block;
          margin-top: 14px;
          color: #ffffff;
          font-size: clamp(24px, 2.3vw, 34px);
          letter-spacing: -0.04em;
        }

        .metric-card p {
          margin: 7px 0 0;
          color: #697184;
          font-size: 9px;
          line-height: 1.5;
        }
      `}</style>
    </article>
  );
}

type ReadinessStepProps = {
  number: string;
  title: string;
  status: string;
  active?: boolean;
};

function ReadinessStep({
  number,
  title,
  status,
  active = false,
}: ReadinessStepProps) {
  return (
    <div className={active ? "readiness-step active" : "readiness-step"}>
      <span>{number}</span>
      <strong>{title}</strong>
      <small>{status}</small>

      <style jsx>{`
        .readiness-step {
          min-width: 0;
          padding: 13px;
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 13px;
          background: rgba(0, 0, 0, 0.12);
        }

        .active {
          border-color: rgba(52, 211, 153, 0.2);
          background: rgba(16, 185, 129, 0.05);
        }

        .readiness-step > span {
          width: 23px;
          height: 23px;
          display: grid;
          place-items: center;
          border-radius: 7px;
          background: rgba(124, 92, 255, 0.12);
          color: #c4b5fd;
          font-size: 8px;
          font-weight: 850;
        }

        .active > span {
          background: rgba(16, 185, 129, 0.12);
          color: #a7f3d0;
        }

        .readiness-step strong,
        .readiness-step small {
          display: block;
        }

        .readiness-step strong {
          margin-top: 10px;
          color: #ffffff;
          font-size: 10px;
        }

        .readiness-step small {
          margin-top: 5px;
          color: #657084;
          font-size: 8px;
        }
      `}</style>
    </div>
  );
}

type EventMetricProps = {
  label: string;
  value: string;
};

function EventMetric({ label, value }: EventMetricProps) {
  return (
    <div className="event-metric">
      <span>{label}</span>
      <strong>{value}</strong>

      <style jsx>{`
        .event-metric {
          min-width: 0;
          padding: 13px 14px;
          background: #0d1017;
        }

        .event-metric span {
          display: block;
          color: #667084;
          font-size: 7px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .event-metric strong {
          display: block;
          overflow-wrap: anywhere;
          margin-top: 7px;
          color: #ffffff;
          font-size: 11px;
        }
      `}</style>
    </div>
  );
}

type DetailBlockProps = {
  label: string;
  value: string;
};

function DetailBlock({ label, value }: DetailBlockProps) {
  return (
    <div className="detail-block">
      <span>{label}</span>
      <strong>{value}</strong>

      <style jsx>{`
        .detail-block {
          min-width: 0;
          padding: 12px 13px;
          border: 1px solid rgba(148, 163, 184, 0.09);
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.12);
        }

        .detail-block span {
          display: block;
          color: #697184;
          font-size: 7px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .detail-block strong {
          display: block;
          margin-top: 7px;
          color: #d8dce5;
          font-size: 9px;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }
      `}</style>
    </div>
  );
}