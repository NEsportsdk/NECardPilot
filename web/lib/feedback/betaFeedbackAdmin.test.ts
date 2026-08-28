import { describe, expect, it } from "vitest";

import {
  BetaFeedbackWorkflowValidationError,
  getBetaFeedbackQueueMetrics,
  parseBetaFeedbackWorkflowUpdate,
  type BetaFeedbackQueueItem,
} from "@/lib/feedback/betaFeedbackAdmin";

const queueItem: BetaFeedbackQueueItem = {
  allow_follow_up: true,
  category: "usability",
  contact_email: "collector@example.com",
  created_at: "2026-08-28T18:00:00.000Z",
  experience_rating: 3,
  id: "d0c7c4ff-77a5-4bea-908f-688b8273dc21",
  internal_note: null,
  is_online: true,
  is_standalone: false,
  language: "en-GB",
  message: "The scanner action needs a clearer label for new users.",
  page_path: "/scanner",
  priority: "normal",
  reviewed_at: null,
  screen_class: "mobile",
  status: "new",
  updated_at: "2026-08-28T18:00:00.000Z",
  user_id: "79223638-ffba-44a7-8f87-d9364fa18446",
};

describe("beta feedback operations", () => {
  it("normalizes a valid workflow update", () => {
    expect(
      parseBetaFeedbackWorkflowUpdate({
        id: queueItem.id,
        internalNote: "  Reproduce on a narrow viewport.  ",
        priority: "high",
        status: "reviewing",
      })
    ).toEqual({
      id: queueItem.id,
      internalNote: "Reproduce on a narrow viewport.",
      priority: "high",
      status: "reviewing",
    });
  });

  it("rejects invalid ids, statuses and priorities", () => {
    expect(() =>
      parseBetaFeedbackWorkflowUpdate({
        id: "not-an-id",
        internalNote: null,
        priority: "normal",
        status: "new",
      })
    ).toThrow(BetaFeedbackWorkflowValidationError);

    expect(() =>
      parseBetaFeedbackWorkflowUpdate({
        id: queueItem.id,
        internalNote: null,
        priority: "urgent",
        status: "ignored",
      })
    ).toThrow("valid feedback priority");
  });

  it("removes empty notes and rejects oversized notes", () => {
    expect(
      parseBetaFeedbackWorkflowUpdate({
        id: queueItem.id,
        internalNote: "   ",
        priority: "normal",
        status: "new",
      }).internalNote
    ).toBeNull();

    expect(() =>
      parseBetaFeedbackWorkflowUpdate({
        id: queueItem.id,
        internalNote: "a".repeat(2001),
        priority: "normal",
        status: "new",
      })
    ).toThrow("2,000 characters");
  });

  it("summarizes the actionable beta queue", () => {
    expect(
      getBetaFeedbackQueueMetrics([
        queueItem,
        {
          ...queueItem,
          id: "875b6fd0-4d22-4cf2-aebb-56b1f8b4d474",
          allow_follow_up: false,
          priority: "critical",
          status: "reviewing",
        },
        {
          ...queueItem,
          id: "f4f3cce0-2af4-4816-9db4-63e373b86a79",
          priority: "low",
          status: "resolved",
        },
      ])
    ).toEqual({
      actionable: 2,
      critical: 1,
      followUpAllowed: 2,
      new: 1,
      total: 3,
    });
  });
});
