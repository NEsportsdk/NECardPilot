import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getActiveWorkspace,
  parseWorkspaceList,
  type Workspace,
} from "@/lib/workspaces/workspace";

export type WorkspaceCapability =
  | "cardshows"
  | "grading"
  | "inventory"
  | "purchases"
  | "sales"
  | "team";

export async function resolveActiveWorkspace(
  supabase: SupabaseClient
): Promise<Workspace> {
  const { data, error } = await supabase.rpc("list_vallective_workspaces");

  if (error) {
    throw new Error(error.message || "Workspace could not be resolved.");
  }

  return getActiveWorkspace(parseWorkspaceList(data));
}
export function workspaceHasCapability(
  workspace: Workspace,
  capability: WorkspaceCapability
) {
  switch (capability) {
    case "cardshows":
      return workspace.canManageCardshows;
    case "grading":
      return workspace.canManageGrading;
    case "inventory":
      return workspace.canManageInventory;
    case "purchases":
      return workspace.canManagePurchasesWithinBudget;
    case "sales":
      return workspace.canManageSales;
    case "team":
      return workspace.canManageTeam;
  }
}

export function requireWorkspaceCapability(
  workspace: Workspace,
  capability: WorkspaceCapability
) {
  if (!workspaceHasCapability(workspace, capability)) {
    throw new Error(`Workspace permission '${capability}' is required.`);
  }
}
