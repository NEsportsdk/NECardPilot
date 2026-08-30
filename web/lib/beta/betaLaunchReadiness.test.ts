import { describe, expect, it } from "vitest";

import {
  getBetaLaunchReadiness,
  type BetaPilotCoverageCheck,
} from "@/lib/beta/betaLaunchReadiness";
import type { BetaFeedbackQueueItem } from "@/lib/feedback/betaFeedbackAdmin";
import type { CaptureEnduranceEvidence } from "@/lib/scan/captureEndurance";

const coverage: BetaPilotCoverageCheck = {
  browser: "safari",
  first_verified_at: "2026-08-29T16:49:16.320Z",
  install_mode: "standalone",
  last_verified_at: "2026-08-29T16:49:16.320Z",
  primary_device: "iphone",
  user_id: "79223638-ffba-44a7-8f87-d9364fa18446",
};

const feedback: BetaFeedbackQueueItem = {
  allow_follow_up: true,
  category: "idea",
  contact_email: "pilot@example.com",
  created_at: "2026-08-29T08:00:00.000Z",
  experience_rating: 5,
  id: "9408407c-f4bd-4cad-b859-0f92a29dbaf0",
  internal_note: null,
  is_online: true,
  is_standalone: false,
  language: "da-DK",
  message: "A sufficiently detailed piece of beta feedback.",
  page_path: "/cards",
  priority: "normal",
  reviewed_at: null,
  screen_class: "mobile",
  status: "new",
  updated_at: "2026-08-29T08:00:00.000Z",
  user_id: coverage.user_id,
};

const endurance: CaptureEnduranceEvidence = {
  browser: "chrome",
  capture_session_id: "7af40613-b104-4f15-aa23-d965db2f11ea",
  captured_count: 10,
  completed_at: "2026-08-30T20:15:00.000Z",
  failed_count: 0,
  install_mode: "standalone",
  offline_recovery_verified: true,
  primary_device: "android",
  reload_verified: true,
  started_at: "2026-08-30T20:00:00.000Z",
  target_count: 10,
  uploaded_count: 10,
};

describe("beta launch readiness", () => {
  it("keeps launch on hold when platform coverage and triage are incomplete", () => {
    const readiness = getBetaLaunchReadiness([coverage], [feedback]);

    expect(readiness.status).toBe("hold");
    expect(readiness.met).toBe(3);
    expect(
      readiness.gates.filter((gate) => !gate.met).map((gate) => gate.id)
    ).toEqual([
      "capture-endurance",
      "android-installed",
      "desktop-browser",
      "feedback-triage",
    ]);
  });

  it("reports ready only when every launch gate is satisfied", () => {
    const readiness = getBetaLaunchReadiness(
      [
        coverage,
        {
          ...coverage,
          browser: "chrome",
          primary_device: "android",
        },
        {
          ...coverage,
          browser: "edge",
          install_mode: "browser",
          primary_device: "desktop",
        },
      ],
      [{ ...feedback, reviewed_at: feedback.updated_at, status: "planned" }],
      [endurance]
    );

    expect(readiness).toMatchObject({ met: 7, status: "ready", total: 7 });
    expect(readiness.gates.every((gate) => gate.met)).toBe(true);
  });

  it("treats unresolved high-priority feedback as a launch blocker", () => {
    const readiness = getBetaLaunchReadiness(
      [coverage],
      [{ ...feedback, priority: "high", status: "reviewing" }]
    );

    expect(
      readiness.gates.find((gate) => gate.id === "feedback-risk")?.met
    ).toBe(false);
  });

  it("rejects incomplete endurance evidence", () => {
    const readiness = getBetaLaunchReadiness([coverage], [], [
      { ...endurance, offline_recovery_verified: false },
    ]);

    expect(
      readiness.gates.find((gate) => gate.id === "capture-endurance")?.met
    ).toBe(false);
  });
});
