import type {
  BetaPilotBrowser,
  BetaPilotDevice,
  BetaPilotInstallMode,
} from "@/lib/beta/betaPilot";
import type { BetaFeedbackQueueItem } from "@/lib/feedback/betaFeedbackAdmin";

export type BetaPilotCoverageCheck = {
  browser: BetaPilotBrowser;
  first_verified_at: string;
  install_mode: BetaPilotInstallMode;
  last_verified_at: string;
  primary_device: BetaPilotDevice;
  user_id: string;
};

export type BetaLaunchReadinessGateId =
  | "android-installed"
  | "desktop-browser"
  | "feedback-risk"
  | "feedback-triage"
  | "iphone-installed"
  | "journey-verified";

export type BetaLaunchReadinessGate = {
  detail: string;
  id: BetaLaunchReadinessGateId;
  label: string;
  met: boolean;
};

export type BetaLaunchReadiness = {
  gates: BetaLaunchReadinessGate[];
  met: number;
  status: "hold" | "ready";
  total: number;
};

function hasCoverage(
  checks: readonly BetaPilotCoverageCheck[],
  expected: Pick<
    BetaPilotCoverageCheck,
    "install_mode" | "primary_device"
  >
) {
  return checks.some(
    (check) =>
      check.install_mode === expected.install_mode &&
      check.primary_device === expected.primary_device
  );
}

export function getBetaLaunchReadiness(
  coverageChecks: readonly BetaPilotCoverageCheck[],
  feedback: readonly BetaFeedbackQueueItem[]
): BetaLaunchReadiness {
  const unresolvedFeedback = feedback.filter(
    (item) => item.status !== "closed" && item.status !== "resolved"
  );
  const gates: BetaLaunchReadinessGate[] = [
    {
      detail: "At least one complete 10-step journey is preserved as evidence.",
      id: "journey-verified",
      label: "Journey verified",
      met: coverageChecks.length > 0,
    },
    {
      detail: "The installed iPhone experience has completed the full journey.",
      id: "iphone-installed",
      label: "iPhone installed",
      met: hasCoverage(coverageChecks, {
        install_mode: "standalone",
        primary_device: "iphone",
      }),
    },
    {
      detail: "The installed Android experience has completed the full journey.",
      id: "android-installed",
      label: "Android installed",
      met: hasCoverage(coverageChecks, {
        install_mode: "standalone",
        primary_device: "android",
      }),
    },
    {
      detail: "A desktop browser has completed the same critical workflow.",
      id: "desktop-browser",
      label: "Desktop browser",
      met: hasCoverage(coverageChecks, {
        install_mode: "browser",
        primary_device: "desktop",
      }),
    },
    {
      detail: "Every submitted report has been reviewed beyond the New state.",
      id: "feedback-triage",
      label: "Feedback triaged",
      met: feedback.every((item) => item.status !== "new"),
    },
    {
      detail: "No unresolved report is marked High or Critical.",
      id: "feedback-risk",
      label: "No blocking feedback",
      met: unresolvedFeedback.every(
        (item) => item.priority !== "high" && item.priority !== "critical"
      ),
    },
  ];
  const met = gates.filter((gate) => gate.met).length;

  return {
    gates,
    met,
    status: met === gates.length ? "ready" : "hold",
    total: gates.length,
  };
}
