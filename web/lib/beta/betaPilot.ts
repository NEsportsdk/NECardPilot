export const betaPilotDevices = ["iphone", "android", "desktop"] as const;
export const betaPilotBrowsers = ["safari", "chrome", "edge", "other"] as const;
export const betaPilotInstallModes = ["browser", "standalone"] as const;

export const betaPilotJourney = [
  {
    description: "Create your account, confirm the email and sign in again.",
    href: "/settings",
    id: 1,
    label: "Secure account",
  },
  {
    description: "Create one personal collection and one inventory collection.",
    href: "/#collections",
    id: 2,
    label: "Collection setup",
  },
  {
    description: "Scan both sides with the camera and choose an existing image.",
    href: "/scanner",
    id: 3,
    label: "Capture both ways",
  },
  {
    description: "Review the AI suggestion, correct at least one field and save.",
    href: "/scanner",
    id: 4,
    label: "Human-reviewed AI",
  },
  {
    description: "Find the saved card again with search and filters.",
    href: "/cards",
    id: 5,
    label: "Find a card",
  },
  {
    description: "Move a card between collections and record a sale.",
    href: "/transactions",
    id: 6,
    label: "Move and sell",
  },
  {
    description: "Create or review a grading submission and its result flow.",
    href: "/grading",
    id: 7,
    label: "Grading lifecycle",
  },
  {
    description: "Review Analytics and Cardshow on a narrow mobile screen.",
    href: "/analytics",
    id: 8,
    label: "Mobile intelligence",
  },
  {
    description: "Install Vallective, close it fully and reopen it from the home screen.",
    href: "/",
    id: 9,
    label: "Installed app return",
  },
  {
    description: "Send one concrete report from the page where friction occurred.",
    href: "/feedback",
    id: 10,
    label: "Close the feedback loop",
  },
] as const;

export type BetaPilotDevice = (typeof betaPilotDevices)[number];
export type BetaPilotBrowser = (typeof betaPilotBrowsers)[number];
export type BetaPilotInstallMode = (typeof betaPilotInstallModes)[number];
export type BetaPilotStepId = (typeof betaPilotJourney)[number]["id"];

export type BetaPilotProfile = {
  browser: BetaPilotBrowser;
  completed_steps: BetaPilotStepId[];
  install_mode: BetaPilotInstallMode;
  joined_at: string;
  primary_device: BetaPilotDevice;
  updated_at: string;
  user_id: string;
};

export type BetaPilotUpdate = {
  browser: BetaPilotBrowser;
  completedSteps: BetaPilotStepId[];
  installMode: BetaPilotInstallMode;
  primaryDevice: BetaPilotDevice;
};

export type BetaPilotMetrics = {
  completed: number;
  installed: number;
  mobile: number;
  total: number;
};

export class BetaPilotValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BetaPilotValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseChoice<T extends string>(
  value: unknown,
  choices: readonly T[],
  message: string
) {
  if (typeof value !== "string" || !choices.includes(value as T)) {
    throw new BetaPilotValidationError(message);
  }

  return value as T;
}

function parseCompletedSteps(value: unknown): BetaPilotStepId[] {
  if (!Array.isArray(value)) {
    throw new BetaPilotValidationError("Pilot progress is missing.");
  }

  const steps = value.map((step) => Number(step));

  if (
    steps.some(
      (step) =>
        !Number.isInteger(step) ||
        step < 1 ||
        step > betaPilotJourney.length
    )
  ) {
    throw new BetaPilotValidationError("Pilot progress contains an unknown step.");
  }

  return [...new Set(steps)].sort((left, right) => left - right) as BetaPilotStepId[];
}

export function parseBetaPilotUpdate(value: unknown): BetaPilotUpdate {
  if (!isRecord(value)) {
    throw new BetaPilotValidationError("Pilot details are missing.");
  }

  return {
    browser: parseChoice(
      value.browser,
      betaPilotBrowsers,
      "Choose the browser used for the pilot."
    ),
    completedSteps: parseCompletedSteps(value.completedSteps),
    installMode: parseChoice(
      value.installMode,
      betaPilotInstallModes,
      "Choose whether Vallective runs in a browser or as an installed app."
    ),
    primaryDevice: parseChoice(
      value.primaryDevice,
      betaPilotDevices,
      "Choose the primary device used for the pilot."
    ),
  };
}

export function getBetaPilotProgress(completedSteps: readonly number[]) {
  const completed = new Set(
    completedSteps.filter(
      (step) => Number.isInteger(step) && step >= 1 && step <= betaPilotJourney.length
    )
  ).size;
  const total = betaPilotJourney.length;

  return {
    completed,
    finished: completed === total,
    percent: Math.round((completed / total) * 100),
    total,
  };
}

export function getBetaPilotMetrics(
  participants: readonly BetaPilotProfile[]
): BetaPilotMetrics {
  return participants.reduce<BetaPilotMetrics>(
    (metrics, participant) => ({
      completed:
        metrics.completed +
        (getBetaPilotProgress(participant.completed_steps).finished ? 1 : 0),
      installed:
        metrics.installed + (participant.install_mode === "standalone" ? 1 : 0),
      mobile:
        metrics.mobile + (participant.primary_device === "desktop" ? 0 : 1),
      total: metrics.total + 1,
    }),
    { completed: 0, installed: 0, mobile: 0, total: 0 }
  );
}
