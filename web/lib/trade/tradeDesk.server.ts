import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  calculateTradeDeskMetrics,
  type TradeCard,
  type TradeCardAssignment,
  type TradeDeskMetrics,
  type TradeInvitation,
  type TradeMember,
  type TradePurchaseLot,
  type TradeTransaction,
} from "@/lib/trade/tradeDesk";

export type TradeDeskData = {
  invitation: TradeInvitation | null;
  member: TradeMember | null;
  metrics: TradeDeskMetrics;
  viewerRole: "administrator" | "junior_trade_manager" | "owner" | "trade_manager";
};

const memberSelection =
  "workspace_id,owner_user_id,member_user_id,role,display_name,preferred_language,status,workspace_name,can_manage_inventory,can_manage_sales,can_manage_grading,can_manage_cardshows,can_manage_purchases_within_budget,can_approve_over_budget_purchases,can_manage_team,can_delete_inventory,hourly_rate,weekly_hours_target,existing_inventory_commission_rate,sourced_profit_commission_rate,monthly_purchase_budget,first_mission_target";
const invitationSelection =
  "workspace_id,owner_user_id,invited_by,email,role,display_name,status,workspace_name,can_manage_inventory,can_manage_sales,can_manage_grading,can_manage_cardshows,can_manage_purchases_within_budget,can_approve_over_budget_purchases,can_manage_team,can_delete_inventory,hourly_rate,weekly_hours_target,existing_inventory_commission_rate,sourced_profit_commission_rate,monthly_purchase_budget,first_mission_target";

export async function loadTradeDesk(): Promise<TradeDeskData> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login?next=%2Ftrade");
  }

  const [workspaceAccessResult, membershipResult] = await Promise.all([
    supabase
      .from("vallective_team_invitations")
      .select(invitationSelection)
      .or(`owner_user_id.eq.${user.id},invited_by.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("vallective_team_members")
      .select(memberSelection)
      .eq("member_user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),
  ]);

  if (membershipResult.error) {
    throw membershipResult.error;
  }

  if (workspaceAccessResult.error) {
    throw workspaceAccessResult.error;
  }

  const viewerMembership = membershipResult.data as TradeMember | null;
  const workspaceAccess = workspaceAccessResult.data as (TradeInvitation & {
    invited_by: string | null;
  }) | null;

  if (!workspaceAccess && !viewerMembership) {
    redirect("/");
  }

  const workspaceId =
    viewerMembership?.workspace_id ?? workspaceAccess!.workspace_id;
  const memberResult = viewerMembership
    ? { data: viewerMembership, error: null }
    : await supabase
        .from("vallective_team_members")
        .select(memberSelection)
        .eq("workspace_id", workspaceId)
        .eq("role", "junior_trade_manager")
        .eq("status", "active")
        .order("joined_at", { ascending: true })
        .limit(1)
        .maybeSingle();

  if (memberResult.error) {
    throw memberResult.error;
  }

  const member = (memberResult.data as TradeMember | null) ?? null;
  const [cardsResult, transactionsResult, assignmentsResult, purchaseLotsResult] =
    await Promise.all([
      supabase
        .from("cards")
        .select(
          "id,state,purchase_price,estimated_value,market_estimated_value"
        )
        .eq("workspace_id", workspaceId),
      supabase
        .from("card_transactions")
        .select(
          "card_id,transaction_type,status,occurred_at,currency,item_amount,shipping_income,platform_fee,payment_fee,shipping_cost,other_costs,realized_profit"
        )
        .eq("workspace_id", workspaceId),
      supabase
        .from("trade_card_assignments")
        .select(
          "card_id,assigned_to_user_id,inventory_origin,priority"
        )
        .eq("workspace_id", workspaceId),
      supabase
        .from("purchase_lots")
        .select(
          "created_by_user_id,status,purchased_at,currency,total_cost"
        )
        .eq("workspace_id", workspaceId),
    ]);

  if (
    cardsResult.error ||
    transactionsResult.error ||
    assignmentsResult.error ||
    purchaseLotsResult.error
  ) {
    throw (
      cardsResult.error ??
      transactionsResult.error ??
      assignmentsResult.error ??
      purchaseLotsResult.error
    );
  }

  return {
    invitation: workspaceAccess,
    member,
    metrics: calculateTradeDeskMetrics({
      assignments: (assignmentsResult.data ?? []) as TradeCardAssignment[],
      cards: (cardsResult.data ?? []) as TradeCard[],
      member,
      purchaseLots: (purchaseLotsResult.data ?? []) as TradePurchaseLot[],
      terms: member ?? workspaceAccess,
      transactions: (transactionsResult.data ?? []) as TradeTransaction[],
    }),
    viewerRole:
      viewerMembership?.role ??
      (workspaceAccess?.owner_user_id === user.id ? "owner" : "administrator"),
  };
}
