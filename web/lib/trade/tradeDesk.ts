export type NumericDatabaseValue = number | string | null;

export type TradeMember = {
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
function isInSameUtcMonth(dateValue: string, now: Date) {
  const date = new Date(dateValue);

  return (
    Number.isFinite(date.getTime()) &&
    date.getUTCFullYear() === now.getUTCFullYear() &&
    date.getUTCMonth() === now.getUTCMonth()
  );
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
  transactions,
}: {
  assignments: TradeCardAssignment[];
  cards: TradeCard[];
  member: TradeMember | null;
  now?: Date;
  transactions: TradeTransaction[];
}): TradeDeskMetrics {
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
      isInSameUtcMonth(transaction.occurred_at, now) &&
      assignmentsByCard.has(transaction.card_id)
  );

  const monthlySales = completedMonthlyTransactions.filter(
    (transaction) => transaction.transaction_type === "sale"
  );
  const monthlyPurchases = completedMonthlyTransactions.filter(
    (transaction) =>
      transaction.transaction_type === "purchase" &&
      assignmentsByCard.get(transaction.card_id)?.inventory_origin ===
        "member_sourced"
  );
  const monthlyRevenue = monthlySales.reduce(
    (sum, transaction) =>
      sum +
      toNumber(transaction.item_amount) +
      toNumber(transaction.shipping_income),
    0
  );
  const existingInventoryCommissionRate = member
    ? toNumber(member.existing_inventory_commission_rate)
    : defaultTradeTerms.existingInventoryCommissionRate;
  const sourcedProfitCommissionRate = member
    ? toNumber(member.sourced_profit_commission_rate)
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
  const monthlyPurchaseBudget = member
    ? toNumber(member.monthly_purchase_budget)
    : defaultTradeTerms.monthlyPurchaseBudget;
  const monthlyPurchaseBudgetUsed = monthlyPurchases.reduce(
    (sum, transaction) =>
      sum +
      toNumber(transaction.item_amount) +
      toNumber(transaction.platform_fee) +
      toNumber(transaction.payment_fee) +
      toNumber(transaction.shipping_cost) +
      toNumber(transaction.other_costs),
    0
  );
  const firstMissionTarget =
    member?.first_mission_target ?? defaultTradeTerms.firstMissionTarget;
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
