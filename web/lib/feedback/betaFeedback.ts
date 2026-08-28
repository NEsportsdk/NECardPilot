export const betaFeedbackCategories = [
  "bug",
  "idea",
  "usability",
  "data",
  "other",
] as const;

export type BetaFeedbackCategory = (typeof betaFeedbackCategories)[number];

export type BetaFeedbackDeviceContext = {
  language: string;
  online: boolean;
  screen: "desktop" | "mobile" | "tablet";
  standalone: boolean;
};

export type BetaFeedback = {
  allowFollowUp: boolean;
  category: BetaFeedbackCategory;
  deviceContext: BetaFeedbackDeviceContext;
  experienceRating: number;
  message: string;
  pagePath: string;
};

export class BetaFeedbackValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BetaFeedbackValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCategory(value: unknown): BetaFeedbackCategory {
  if (
    typeof value !== "string" ||
    !betaFeedbackCategories.includes(value as BetaFeedbackCategory)
  ) {
    throw new BetaFeedbackValidationError("Choose a feedback category.");
  }

  return value as BetaFeedbackCategory;
}

function parseRating(value: unknown) {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 5) {
    throw new BetaFeedbackValidationError(
      "Rate your current experience from 1 to 5."
    );
  }

  return Number(value);
}

function parseMessage(value: unknown) {
  if (typeof value !== "string") {
    throw new BetaFeedbackValidationError("Describe your feedback.");
  }

  const message = value.trim();

  if (message.length < 20) {
    throw new BetaFeedbackValidationError(
      "Please add at least 20 characters so we can act on your feedback."
    );
  }

  if (message.length > 2000) {
    throw new BetaFeedbackValidationError(
      "Feedback cannot exceed 2,000 characters."
    );
  }

  return message;
}

export function normalizeBetaFeedbackPagePath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return "/";
  }

  const [pathname] = value.trim().split(/[?#]/, 1);
  return (pathname || "/").slice(0, 300);
}

export function getBetaFeedbackHref(currentPathname: string) {
  const pathname = normalizeBetaFeedbackPagePath(currentPathname);

  return pathname.startsWith("/feedback")
    ? "/feedback"
    : `/feedback?from=${encodeURIComponent(pathname)}`;
}

export function getBetaFeedbackOriginPath(
  search: string,
  currentPathname: string
) {
  const from = new URLSearchParams(search).get("from");

  if (!from?.startsWith("/")) {
    return normalizeBetaFeedbackPagePath(currentPathname);
  }

  return normalizeBetaFeedbackPagePath(from);
}

function parseScreen(value: unknown): BetaFeedbackDeviceContext["screen"] {
  return value === "mobile" || value === "tablet" || value === "desktop"
    ? value
    : "desktop";
}

function parseDeviceContext(value: unknown): BetaFeedbackDeviceContext {
  const context = isRecord(value) ? value : {};
  const language =
    typeof context.language === "string"
      ? context.language.trim().slice(0, 20)
      : "unknown";

  return {
    language: language || "unknown",
    online: context.online !== false,
    screen: parseScreen(context.screen),
    standalone: context.standalone === true,
  };
}

export function parseBetaFeedback(value: unknown): BetaFeedback {
  if (!isRecord(value)) {
    throw new BetaFeedbackValidationError("Feedback details are missing.");
  }

  return {
    allowFollowUp: value.allowFollowUp !== false,
    category: parseCategory(value.category),
    deviceContext: parseDeviceContext(value.deviceContext),
    experienceRating: parseRating(value.experienceRating),
    message: parseMessage(value.message),
    pagePath: normalizeBetaFeedbackPagePath(value.pagePath),
  };
}
