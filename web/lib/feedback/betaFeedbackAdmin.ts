import type { BetaFeedbackCategory } from "@/lib/feedback/betaFeedback";

export const betaFeedbackStatuses = [
  "new",
  "reviewing",
  "planned",
  "resolved",
  "closed",
] as const;

export const betaFeedbackPriorities = [
  "low",
  "normal",
  "high",
  "critical",
] as const;

export type BetaFeedbackStatus = (typeof betaFeedbackStatuses)[number];
export type BetaFeedbackPriority = (typeof betaFeedbackPriorities)[number];

export type BetaFeedbackQueueItem = {
  allow_follow_up: boolean;
  category: BetaFeedbackCategory;
  contact_email: string | null;
  created_at: string;
  experience_rating: number;
  id: string;
  internal_note: string | null;
  is_online: boolean;
  is_standalone: boolean;
  language: string;
  message: string;
  page_path: string;
  priority: BetaFeedbackPriority;
  reviewed_at: string | null;
  screen_class: "desktop" | "mobile" | "tablet";
  status: BetaFeedbackStatus;
  updated_at: string;
  user_id: string;
};

export type BetaFeedbackWorkflowUpdate = {
  id: string;
  internalNote: string | null;
  priority: BetaFeedbackPriority;
  status: BetaFeedbackStatus;
};

export type BetaFeedbackQueueMetrics = {
  actionable: number;
  critical: number;
  followUpAllowed: number;
  new: number;
  total: number;
};

export class BetaFeedbackWorkflowValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BetaFeedbackWorkflowValidationError";
  }
}
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStatus(value: unknown): BetaFeedbackStatus {
  if (
    typeof value !== "string" ||
    !betaFeedbackStatuses.includes(value as BetaFeedbackStatus)
  ) {
    throw new BetaFeedbackWorkflowValidationError(
      "Choose a valid feedback status."
    );
  }

  return value as BetaFeedbackStatus;
}

function parsePriority(value: unknown): BetaFeedbackPriority {
  if (
    typeof value !== "string" ||
    !betaFeedbackPriorities.includes(value as BetaFeedbackPriority)
  ) {
    throw new BetaFeedbackWorkflowValidationError(
      "Choose a valid feedback priority."
    );
  }

  return value as BetaFeedbackPriority;
}

function parseInternalNote(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new BetaFeedbackWorkflowValidationError(
      "The internal note must be text."
    );
  }

  const note = value.trim();

  if (!note) {
    return null;
  }

  if (note.length > 2000) {
    throw new BetaFeedbackWorkflowValidationError(
      "The internal note cannot exceed 2,000 characters."
    );
  }

  return note;
}

export function parseBetaFeedbackWorkflowUpdate(
  value: unknown
): BetaFeedbackWorkflowUpdate {
  if (!isRecord(value)) {
    throw new BetaFeedbackWorkflowValidationError(
      "Feedback workflow details are missing."
    );
  }

  if (typeof value.id !== "string" || !uuidPattern.test(value.id)) {
    throw new BetaFeedbackWorkflowValidationError(
      "The feedback report could not be identified."
    );
  }

  return {
    id: value.id,
    internalNote: parseInternalNote(value.internalNote),
    priority: parsePriority(value.priority),
    status: parseStatus(value.status),
  };
}

export function getBetaFeedbackQueueMetrics(
  items: BetaFeedbackQueueItem[]
): BetaFeedbackQueueMetrics {
  return items.reduce<BetaFeedbackQueueMetrics>(
    (metrics, item) => ({
      actionable:
        metrics.actionable +
        (item.status === "new" || item.status === "reviewing" ? 1 : 0),
      critical: metrics.critical + (item.priority === "critical" ? 1 : 0),
      followUpAllowed:
        metrics.followUpAllowed + (item.allow_follow_up ? 1 : 0),
      new: metrics.new + (item.status === "new" ? 1 : 0),
      total: metrics.total + 1,
    }),
    {
      actionable: 0,
      critical: 0,
      followUpAllowed: 0,
      new: 0,
      total: 0,
    }
  );
}
