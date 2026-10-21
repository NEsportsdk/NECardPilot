import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getActiveWorkspace,
  parseWorkspaceList,
  type Workspace,
} from "@/lib/workspaces/workspace";

export async function listAccessibleWorkspaces(
  supabase: SupabaseClient
): Promise<Workspace[]> {
  const { data, error } = await supabase.rpc("list_vallective_workspaces");

  if (error) {
    throw new Error(error.message || "Workspaces could not be loaded.");
  }

  return parseWorkspaceList(data);
}
export async function loadActiveWorkspace(supabase: SupabaseClient) {
  return getActiveWorkspace(await listAccessibleWorkspaces(supabase));
}

export async function activateWorkspace(
  supabase: SupabaseClient,
  workspaceId: string
) {
  const { error } = await supabase.rpc("set_active_vallective_workspace", {
    requested_workspace_id: workspaceId,
  });

  if (error) {
    throw new Error(error.message || "Workspace could not be activated.");
  }
}
