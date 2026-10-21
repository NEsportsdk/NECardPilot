import { describe, expect, it } from "vitest";

import {
  getActiveWorkspace,
  parseWorkspaceList,
} from "@/lib/workspaces/workspace";

const personalRow = {
  workspace_id: "8fa7d6d7-182a-45ef-8941-a0409d79019a",
  workspace_kind: "personal",
  workspace_name: "My collection",
  base_currency: "dkk",
  data_owner_user_id: "32c3787d-0c75-475a-b97e-f360322dfb74",
  member_role: "owner",
  can_manage_inventory: true,
  can_manage_sales: true,
  can_manage_grading: true,
  can_manage_cardshows: true,
  can_manage_purchases_within_budget: true,
  can_approve_over_budget_purchases: true,
  can_manage_team: true,
  can_delete_inventory: true,
  is_active: true,
};

describe("workspace parsing", () => {
  it("normalizes a valid active workspace", () => {
    const workspaces = parseWorkspaceList([personalRow]);

    expect(getActiveWorkspace(workspaces)).toMatchObject({
      id: personalRow.workspace_id,
      kind: "personal",
      baseCurrency: "DKK",
      isActive: true,
    });
  });

  it("rejects lists without exactly one active workspace", () => {
    expect(() =>
      parseWorkspaceList([{ ...personalRow, is_active: false }])
    ).toThrow("exactly one active workspace");

    expect(() =>
      parseWorkspaceList([
        personalRow,
        {
          ...personalRow,
          workspace_id: "c78d1ad5-20fc-4491-91ef-596a0cbd7d06",
          workspace_kind: "business",
        },
      ])
    ).toThrow("exactly one active workspace");
  });

  it("rejects unsupported roles and malformed ids", () => {
    expect(() =>
      parseWorkspaceList([{ ...personalRow, member_role: "superuser" }])
    ).toThrow("unsupported role");

    expect(() =>
      parseWorkspaceList([{ ...personalRow, workspace_id: "not-an-id" }])
    ).toThrow("invalid ID");
  });
});
