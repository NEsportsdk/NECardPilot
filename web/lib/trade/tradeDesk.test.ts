import { describe, expect, it } from "vitest";

import {
  calculateTradeDeskMetrics,
  type TradeCard,
  type TradeCardAssignment,
  type TradeMember,
  type TradePurchaseLot,
  type TradeTransaction,
} from "@/lib/trade/tradeDesk";

const member: TradeMember = {
  workspace_id: "workspace-1",
  owner_user_id: "owner-1",
  member_user_id: "noah-1",
  role: "junior_trade_manager",
  display_name: "Noah",
  preferred_language: "da",
  status: "active",
  workspace_name: "Vallective Business",
  can_manage_inventory: true,
  can_manage_sales: true,
  can_manage_grading: true,
  can_manage_cardshows: true,
  can_manage_purchases_within_budget: true,
  can_approve_over_budget_purchases: false,
  can_manage_team: false,
  can_delete_inventory: false,
  hourly_rate: 70,
  weekly_hours_target: 5,
  existing_inventory_commission_rate: 0.05,
  sourced_profit_commission_rate: 0.25,
  monthly_purchase_budget: 3000,
  first_mission_target: 50,
};

const cards: TradeCard[] = [
  {
    id: "existing-card",
    state: "listed",
    purchase_price: 50,
    estimated_value: 125,
    market_estimated_value: null,
  },
  {
    id: "sourced-card",
    state: "sold",
    purchase_price: 200,
    estimated_value: 280,
    market_estimated_value: 300,
  },
  {
    id: "unassigned-card",
    state: "verified",
    purchase_price: 25,
    estimated_value: null,
    market_estimated_value: null,
  },
];

const assignments: TradeCardAssignment[] = [
  {
    card_id: "existing-card",
    assigned_to_user_id: "noah-1",
    inventory_origin: "existing_inventory",
    priority: "normal",
  },
  {
    card_id: "sourced-card",
    assigned_to_user_id: "noah-1",
    inventory_origin: "member_sourced",
    priority: "high",
  },
];

const transactions: TradeTransaction[] = [
  {
    card_id: "existing-card",
    transaction_type: "sale",
    status: "completed",
    occurred_at: "2026-10-08T10:00:00.000Z",
    currency: "DKK",
    item_amount: 1000,
    shipping_income: 0,
    platform_fee: 0,
    payment_fee: 0,
    shipping_cost: 0,
    other_costs: 0,
    realized_profit: 950,
  },
  {
    card_id: "sourced-card",
    transaction_type: "purchase",
    status: "completed",
    occurred_at: "2026-10-03T10:00:00.000Z",
    currency: "DKK",
    item_amount: 200,
    shipping_income: 0,
    platform_fee: 0,
    payment_fee: 5,
    shipping_cost: 25,
    other_costs: 0,
    realized_profit: 0,
  },
  {
    card_id: "sourced-card",
    transaction_type: "sale",
    status: "completed",
    occurred_at: "2026-10-12T10:00:00.000Z",
    currency: "DKK",
    item_amount: 400,
    shipping_income: 40,
    platform_fee: 40,
    payment_fee: 10,
    shipping_cost: 25,
    other_costs: 5,
    realized_profit: 160,
  },
];

const purchaseLots: TradePurchaseLot[] = [
  {
    created_by_user_id: "noah-1",
    status: "locked",
    purchased_at: "2026-10-03T10:00:00.000Z",
    currency: "DKK",
    total_cost: 230,
  },
];

describe("trade desk metrics", () => {
  it("tracks the first 50-card mission and current inventory value", () => {
    const metrics = calculateTradeDeskMetrics({
      assignments,
      cards,
      member,
      now: new Date("2026-10-20T12:00:00.000Z"),
      purchaseLots,
      transactions,
    });

    expect(metrics.inventoryCardCount).toBe(3);
    expect(metrics.inventoryValue).toBe(450);
    expect(metrics.assignedCardCount).toBe(2);
    expect(metrics.availableToAssignCount).toBe(1);
    expect(metrics.valuedCardCount).toBe(2);
    expect(metrics.listedCardCount).toBe(2);
    expect(metrics.firstMissionProgress).toBe(4);
  });

  it("uses the agreed commission model and monthly purchase budget", () => {
    const metrics = calculateTradeDeskMetrics({
      assignments,
      cards,
      member,
      now: new Date("2026-10-20T12:00:00.000Z"),
      purchaseLots,
      transactions,
    });

    expect(metrics.monthlyRevenue).toBe(1440);
    expect(metrics.existingInventoryCommission).toBe(50);
    expect(metrics.sourcedProfitCommission).toBe(40);
    expect(metrics.totalCommission).toBe(90);
    expect(metrics.monthlyPurchaseBudgetUsed).toBe(230);
    expect(metrics.monthlyPurchaseBudgetRemaining).toBe(2770);
  });

  it("ignores unassigned, cancelled, foreign-currency and older activity", () => {
    const ignoredTransactions: TradeTransaction[] = [
      {
        ...transactions[0],
        card_id: "unassigned-card",
      },
      {
        ...transactions[0],
        status: "cancelled",
      },
      {
        ...transactions[0],
        currency: "EUR",
      },
      {
        ...transactions[0],
        occurred_at: "2026-09-30T21:59:59.000Z",
      },
    ];
    const metrics = calculateTradeDeskMetrics({
      assignments,
      cards,
      member,
      now: new Date("2026-10-20T12:00:00.000Z"),
      purchaseLots: [
        { ...purchaseLots[0], created_by_user_id: "someone-else" },
        { ...purchaseLots[0], status: "cancelled" },
        { ...purchaseLots[0], currency: "EUR" },
        { ...purchaseLots[0], purchased_at: "2026-09-30T21:59:59.000Z" },
      ],
      transactions: ignoredTransactions,
    });

    expect(metrics.monthlyRevenue).toBe(0);
    expect(metrics.totalCommission).toBe(0);
    expect(metrics.monthlyPurchaseBudgetUsed).toBe(0);
  });

  it("does not pay profit commission on a loss", () => {
    const metrics = calculateTradeDeskMetrics({
      assignments,
      cards,
      member,
      now: new Date("2026-10-20T12:00:00.000Z"),
      transactions: [
        {
          ...transactions[2],
          realized_profit: -75,
        },
      ],
    });

    expect(metrics.sourcedProfitCommission).toBe(0);
    expect(metrics.totalCommission).toBe(0);
  });

  it("uses Copenhagen month boundaries for the enforced purchase budget", () => {
    const metrics = calculateTradeDeskMetrics({
      assignments,
      cards,
      member,
      now: new Date("2026-11-01T00:15:00.000Z"),
      purchaseLots: [
        {
          ...purchaseLots[0],
          purchased_at: "2026-10-31T23:30:00.000Z",
        },
      ],
      transactions: [],
    });

    expect(metrics.monthlyPurchaseBudgetUsed).toBe(230);
    expect(metrics.monthlyPurchaseBudgetRemaining).toBe(2770);
  });

  it("treats 50 cards as a milestone and never as an inventory limit", () => {
    const extendedCards = Array.from({ length: 75 }, (_, index) => ({
      id: `card-${index + 1}`,
      state: "listed",
      purchase_price: 10,
      estimated_value: 20,
      market_estimated_value: null,
    } satisfies TradeCard));
    const extendedAssignments = extendedCards.map((card) => ({
      card_id: card.id,
      assigned_to_user_id: "noah-1",
      inventory_origin: "existing_inventory" as const,
      priority: "normal" as const,
    }));
    const metrics = calculateTradeDeskMetrics({
      assignments: extendedAssignments,
      cards: extendedCards,
      member,
      now: new Date("2026-10-20T12:00:00.000Z"),
      transactions: [],
    });

    expect(metrics.inventoryCardCount).toBe(75);
    expect(metrics.assignedCardCount).toBe(75);
    expect(metrics.listedCardCount).toBe(75);
    expect(metrics.firstMissionTarget).toBe(50);
    expect(metrics.firstMissionProgress).toBe(100);
  });
});
