export type NumericDatabaseValue = number | string | null;

export type TradeMember = {
  workspace_id: string;
  owner_user_id: string;
  member_user_id: string;
  role: "administrator" | "junior_trade_manager" | "trade_manager";
  display_name: string;
  preferred_language: "da" | "en";
  status: "active" | "paused";
  workspace_name: string;
  can_manage_inventory: boolean;
  can_manage_sales: boolean;
  can_manage_grading: boolean;
  can_manage_cardshows: boolean;
  can_manage_purchases_within_budget: boolean;
  can_approve_over_budget_purchases: boolean;
  can_manage_team: boolean;
  can_delete_inventory: boolean;
  hourly_rate: NumericDatabaseValue;
  weekly_hours_target: NumericDatabaseValue;
  existing_inventory_commission_rate: NumericDatabaseValue;
  sourced_profit_commission_rate: NumericDatabaseValue;
  monthly_purchase_budget: NumericDatabaseValue;
  first_mission_target: number;
};

export type TradeInvitation = Omit<
  TradeMember,
  "member_user_id" | "preferred_language" | "status"
> & {
  email: string;
  status: "accepted" | "failed" | "pending" | "revoked" | "sent";
};

export type TradeCard = {
  id: string;
  state: string | null;
  purchase_price: NumericDatabaseValue;
  estimated_value: NumericDatabaseValue;
  market_estimated_value: NumericDatabaseValue;
};

export type TradeCardAssignment = {
  card_id: string;
  assigned_to_user_id: string | null;
  inventory_origin: "existing_inventory" | "member_sourced";
  priority: "high" | "low" | "normal";
};

export type TradeTransaction = {
  card_id: string;
  transaction_type: "adjustment" | "fee" | "purchase" | "refund" | "sale";
  status: "cancelled" | "completed" | "pending" | "refunded";
  occurred_at: string;
  currency: string;
  item_amount: NumericDatabaseValue;
  shipping_income: NumericDatabaseValue;
  platform_fee: NumericDatabaseValue;
  payment_fee: NumericDatabaseValue;
  shipping_cost: NumericDatabaseValue;
  other_costs: NumericDatabaseValue;
  realized_profit: NumericDatabaseValue;
};

export type TradePurchaseLot = {
  created_by_user_id: string;
  status: "allocated" | "cancelled" | "draft" | "locked";
  purchased_at: string;
  currency: string;
  total_cost: NumericDatabaseValue;
};

export type TradeDeskMetrics = {
  assignedCardCount: number;
  availableToAssignCount: number;
  existingInventoryCommission: number;
  firstMissionProgress: number;
  firstMissionTarget: number;
  inventoryCardCount: number;
  inventoryValue: number;
  listedCardCount: number;
  monthlyPurchaseBudget: number;
  monthlyPurchaseBudgetRemaining: number;
  monthlyPurchaseBudgetUsed: number;
  monthlyRevenue: number;
  sourcedProfitCommission: number;
  totalCommission: number;
  valuedCardCount: number;
};

export const defaultTradeTerms = {
  existingInventoryCommissionRate: 0.05,
  firstMissionTarget: 50,
  hourlyRate: 70,
  monthlyPurchaseBudget: 3000,
  sourcedProfitCommissionRate: 0.25,
  weeklyHoursTarget: 5,
} as const;

function toNumber(value: NumericDatabaseValue) {
  if (value === null || value === "") {
    return 0;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
const copenhagenMonthFormatter = new Intl.DateTimeFormat("en-CA", {
  month: "2-digit",
  timeZone: "Europe/Copenhagen",
  year: "numeric",
});

function isInSameCopenhagenMonth(dateValue: string, now: Date) {
  const date = new Date(dateValue);

  return Number.isFinite(date.getTime()) &&
    copenhagenMonthFormatter.format(date) ===
      copenhagenMonthFormatter.format(now);
}

function getInventoryValue(card: TradeCard) {
  const marketValue = toNumber(card.market_estimated_value);

  if (marketValue > 0) {
    return marketValue;
  }

  const manualValue = toNumber(card.estimated_value);

  if (manualValue > 0) {
    return manualValue;
  }

  return toNumber(card.purchase_price);
}

export function calculateTradeDeskMetrics({
  assignments,
  cards,
  member,
  now = new Date(),
  purchaseLots = [],
  terms,
  transactions,
}: {
  assignments: TradeCardAssignment[];
  cards: TradeCard[];
  member: TradeMember | null;
  now?: Date;
  purchaseLots?: TradePurchaseLot[];
  terms?: TradeInvitation | TradeMember | null;
  transactions: TradeTransaction[];
}): TradeDeskMetrics {
  const agreement = terms ?? member;
  const memberUserId = member?.member_user_id ?? null;
  const memberAssignments = memberUserId
    ? assignments.filter(
        (assignment) => assignment.assigned_to_user_id === memberUserId
      )
    : [];
  const assignmentsByCard = new Map(
    memberAssignments.map((assignment) => [assignment.card_id, assignment])
  );
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const assignedCards = memberAssignments
    .map((assignment) => cardsById.get(assignment.card_id))
    .filter((card): card is TradeCard => Boolean(card));
  const completedMonthlyTransactions = transactions.filter(
    (transaction) =>
      transaction.status === "completed" &&
      transaction.currency.toUpperCase() === "DKK" &&
      isInSameCopenhagenMonth(transaction.occurred_at, now) &&
      assignmentsByCard.has(transaction.card_id)
  );

  const monthlySales = completedMonthlyTransactions.filter(
    (transaction) => transaction.transaction_type === "sale"
  );
  const monthlyRevenue = monthlySales.reduce(
    (sum, transaction) =>
      sum +
      toNumber(transaction.item_amount) +
      toNumber(transaction.shipping_income),
    0
  );
  const existingInventoryCommissionRate = agreement
    ? toNumber(agreement.existing_inventory_commission_rate)
    : defaultTradeTerms.existingInventoryCommissionRate;
  const sourcedProfitCommissionRate = agreement
    ? toNumber(agreement.sourced_profit_commission_rate)
    : defaultTradeTerms.sourcedProfitCommissionRate;
  const existingInventoryCommission = monthlySales.reduce(
    (sum, transaction) => {
      const assignment = assignmentsByCard.get(transaction.card_id);

      if (assignment?.inventory_origin !== "existing_inventory") {
        return sum;
      }

      return (
        sum +
        (toNumber(transaction.item_amount) +
          toNumber(transaction.shipping_income)) *
          existingInventoryCommissionRate
      );
    },
    0
  );
  const sourcedProfitCommission = monthlySales.reduce((sum, transaction) => {
    const assignment = assignmentsByCard.get(transaction.card_id);

    if (assignment?.inventory_origin !== "member_sourced") {
      return sum;
    }

    return (
      sum +
      Math.max(0, toNumber(transaction.realized_profit)) *
        sourcedProfitCommissionRate
    );
  }, 0);
  const monthlyPurchaseBudget = agreement
    ? toNumber(agreement.monthly_purchase_budget)
    : defaultTradeTerms.monthlyPurchaseBudget;
  const monthlyPurchaseBudgetUsed = memberUserId
    ? purchaseLots
        .filter(
          (lot) =>
            lot.created_by_user_id === memberUserId &&
            lot.status !== "cancelled" &&
            lot.currency.toUpperCase() === "DKK" &&
            isInSameCopenhagenMonth(lot.purchased_at, now)
        )
        .reduce((sum, lot) => sum + toNumber(lot.total_cost), 0)
    : 0;
  const firstMissionTarget =
    agreement?.first_mission_target ?? defaultTradeTerms.firstMissionTarget;
  const valuedCardCount = assignedCards.filter(
    (card) =>
      toNumber(card.market_estimated_value) > 0 ||
      toNumber(card.estimated_value) > 0
  ).length;
  const listedCardCount = assignedCards.filter(
    (card) => card.state === "listed" || card.state === "sold"
  ).length;

  return {
    assignedCardCount: assignedCards.length,
    availableToAssignCount: Math.max(0, cards.length - assignedCards.length),
    existingInventoryCommission,
    firstMissionProgress: Math.min(
      100,
      Math.round((listedCardCount / firstMissionTarget) * 100)
    ),
    firstMissionTarget,
    inventoryCardCount: cards.length,
    inventoryValue: cards.reduce(
      (sum, card) => sum + getInventoryValue(card),
      0
    ),
    listedCardCount,
    monthlyPurchaseBudget,
    monthlyPurchaseBudgetRemaining: Math.max(
      0,
      monthlyPurchaseBudget - monthlyPurchaseBudgetUsed
    ),
    monthlyPurchaseBudgetUsed,
    monthlyRevenue,
    sourcedProfitCommission,
    totalCommission:
      existingInventoryCommission + sourcedProfitCommission,
    valuedCardCount,
  };
}
