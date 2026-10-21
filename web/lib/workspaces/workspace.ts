export type WorkspaceKind = "business" | "personal";

export type WorkspaceRole =
  | "administrator"
  | "collector"
  | "junior_trade_manager"
  | "owner"
  | "trade_manager";

export type Workspace = {
  id: string;
  kind: WorkspaceKind;
  name: string;
  baseCurrency: string;
  dataOwnerUserId: string;
  role: WorkspaceRole;
  canManageInventory: boolean;
  canManageSales: boolean;
  canManageGrading: boolean;
  canManageCardshows: boolean;
  canManagePurchasesWithinBudget: boolean;
  canApproveOverBudgetPurchases: boolean;
  canManageTeam: boolean;
  canDeleteInventory: boolean;
  isActive: boolean;
};

type WorkspaceRpcRow = {
  workspace_id: unknown;
  workspace_kind: unknown;
  workspace_name: unknown;
  base_currency: unknown;
  data_owner_user_id: unknown;
  member_role: unknown;
  can_manage_inventory: unknown;
  can_manage_sales: unknown;
  can_manage_grading: unknown;
  can_manage_cardshows: unknown;
  can_manage_purchases_within_budget: unknown;
  can_approve_over_budget_purchases: unknown;
  can_manage_team: unknown;
  can_delete_inventory: unknown;
  is_active: unknown;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const workspaceKinds = new Set<WorkspaceKind>(["business", "personal"]);
const workspaceRoles = new Set<WorkspaceRole>([
  "administrator",
  "collector",
  "junior_trade_manager",
  "owner",
  "trade_manager",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function readUuid(value: unknown, label: string) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new Error(`Workspace response has an invalid ${label}.`);
  }

  return value;
}

function readText(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Workspace response is missing ${label}.`);
  }

  return value.trim();
}

function readBoolean(value: unknown, label: string) {
  if (typeof value !== "boolean") {
    throw new Error(`Workspace response has an invalid ${label}.`);
  }

  return value;
}

export function parseWorkspace(value: unknown): Workspace {
  if (!isRecord(value)) {
    throw new Error("Workspace response has an invalid format.");
  }

  const row = value as WorkspaceRpcRow;
  const kind = readText(row.workspace_kind, "kind") as WorkspaceKind;
  const role = readText(row.member_role, "role") as WorkspaceRole;
  const baseCurrency = readText(row.base_currency, "currency").toUpperCase();

  if (!workspaceKinds.has(kind)) {
    throw new Error("Workspace response has an unsupported kind.");
  }

  if (!workspaceRoles.has(role)) {
    throw new Error("Workspace response has an unsupported role.");
  }

  if (!/^[A-Z]{3}$/.test(baseCurrency)) {
    throw new Error("Workspace response has an invalid currency.");
  }

  return {
    id: readUuid(row.workspace_id, "ID"),
    kind,
    name: readText(row.workspace_name, "name"),
    baseCurrency,
    dataOwnerUserId: readUuid(row.data_owner_user_id, "data owner"),
    role,
    canManageInventory: readBoolean(
      row.can_manage_inventory,
      "inventory permission"
    ),
    canManageSales: readBoolean(row.can_manage_sales, "sales permission"),
    canManageGrading: readBoolean(
      row.can_manage_grading,
      "grading permission"
    ),
    canManageCardshows: readBoolean(
      row.can_manage_cardshows,
      "cardshow permission"
    ),
    canManagePurchasesWithinBudget: readBoolean(
      row.can_manage_purchases_within_budget,
      "purchase permission"
    ),
    canApproveOverBudgetPurchases: readBoolean(
      row.can_approve_over_budget_purchases,
      "purchase approval permission"
    ),
    canManageTeam: readBoolean(row.can_manage_team, "team permission"),
    canDeleteInventory: readBoolean(
      row.can_delete_inventory,
      "delete permission"
    ),
    isActive: readBoolean(row.is_active, "active state"),
  };
}

export function parseWorkspaceList(value: unknown): Workspace[] {
  if (!Array.isArray(value)) {
    throw new Error("Workspace list has an invalid format.");
  }

  const workspaces = value.map(parseWorkspace);

  if (workspaces.length === 0) {
    throw new Error("No accessible workspace was returned.");
  }

  if (workspaces.filter((workspace) => workspace.isActive).length !== 1) {
    throw new Error("Workspace list must contain exactly one active workspace.");
  }

  return workspaces;
}

export function getActiveWorkspace(workspaces: Workspace[]) {
  const activeWorkspace = workspaces.find((workspace) => workspace.isActive);

  if (!activeWorkspace) {
    throw new Error("No active workspace is available.");
  }

  return activeWorkspace;
}
