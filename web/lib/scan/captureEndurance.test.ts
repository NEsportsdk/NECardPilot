import { describe, expect, it } from "vitest";

import {
  createCaptureEnduranceEvidence,
  createCaptureEnduranceRun,
  getCaptureEnduranceProgress,
  parseCaptureEnduranceRun,
  resumeCaptureEnduranceRun,
  updateCaptureEnduranceConnection,
} from "@/lib/scan/captureEndurance";

const startedAt = new Date("2026-08-30T20:00:00.000Z");

function createRun() {
  return createCaptureEnduranceRun({
    captureSessionId: "7af40613-b104-4f15-aa23-d965db2f11ea",
    pageInstanceId: "page-one",
    targetCount: 10,
    now: startedAt,
  });
}

describe("capture endurance evidence", () => {
  it("parses only complete versioned local state", () => {
    const run = createRun();

    expect(parseCaptureEnduranceRun(run)).toEqual(run);
    expect(parseCaptureEnduranceRun({ ...run, targetCount: 11 })).toBeNull();
    expect(parseCaptureEnduranceRun({ ...run, startedAt: "later" })).toBeNull();
  });

  it("verifies a reload only when a new page instance resumes the run", () => {
    const run = createRun();

    expect(resumeCaptureEnduranceRun(run, "page-one").reloadVerified).toBe(
      false
    );
    expect(resumeCaptureEnduranceRun(run, "page-two").reloadVerified).toBe(
      true
    );
  });

  it("requires an observed offline to online transition", () => {
    const run = createRun();
    const stillOnline = updateCaptureEnduranceConnection(run, true);
    const offline = updateCaptureEnduranceConnection(stillOnline, false);
    const recovered = updateCaptureEnduranceConnection(offline, true);

    expect(stillOnline.offlineRecoveryVerified).toBe(false);
    expect(offline).toMatchObject({
      offlineRecoveryVerified: false,
      sawOffline: true,
    });
    expect(recovered.offlineRecoveryVerified).toBe(true);
  });

  it("passes only after target capture, upload, reload and recovery", () => {
    let run = resumeCaptureEnduranceRun(createRun(), "page-two");
    run = updateCaptureEnduranceConnection(run, false);
    run = updateCaptureEnduranceConnection(run, true);
    const remoteItems = Array.from({ length: 10 }, (_, index) => ({
      captureSessionId: run.captureSessionId,
      id: `card-${index}`,
      status: "uploaded",
    }));
    const progress = getCaptureEnduranceProgress(run, [], remoteItems);

    expect(progress).toMatchObject({
      capturedCount: 10,
      failedCount: 0,
      passed: true,
      uploadedCount: 10,
    });
    expect(
      createCaptureEnduranceEvidence({
        browser: "chrome",
        completedAt: new Date("2026-08-30T20:15:00.000Z"),
        installMode: "standalone",
        primaryDevice: "android",
        progress,
        run,
      })
    ).toMatchObject({
      capture_session_id: run.captureSessionId,
      target_count: 10,
      primary_device: "android",
      uploaded_count: 10,
    });
  });

  it("does not count identification failures as transport failures", () => {
    const run = createRun();
    const progress = getCaptureEnduranceProgress(run, [], [
      {
        captureSessionId: run.captureSessionId,
        failureStage: "identification",
        id: "identified-later",
        status: "failed",
      },
    ]);

    expect(progress.failedCount).toBe(0);
    expect(progress.uploadedCount).toBe(1);
  });
});
