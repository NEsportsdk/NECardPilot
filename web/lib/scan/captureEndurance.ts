import type {
  BetaPilotBrowser,
  BetaPilotDevice,
  BetaPilotInstallMode,
} from "@/lib/beta/betaPilot";

export const captureEnduranceTargets = [10, 25, 50] as const;

export type CaptureEnduranceTarget =
  (typeof captureEnduranceTargets)[number];

export type CaptureEnduranceLocalRun = {
  captureSessionId: string;
  lastPageInstanceId: string;
  lastSeenAt: string;
  offlineRecoveryVerified: boolean;
  reloadVerified: boolean;
  sawOffline: boolean;
  startedAt: string;
  targetCount: CaptureEnduranceTarget;
  version: 1;
};

export type CaptureEnduranceQueueItem = {
  captureSessionId: string;
  failureStage?: string | null;
  id: string;
  status: string;
};

export type CaptureEnduranceProgress = {
  capturedCount: number;
  failedCount: number;
  offlineRecoveryVerified: boolean;
  passed: boolean;
  reloadVerified: boolean;
  remainingCaptures: number;
  remainingUploads: number;
  targetCount: CaptureEnduranceTarget;
  uploadedCount: number;
};

export type CaptureEnduranceEvidence = {
  browser: BetaPilotBrowser;
  capture_session_id: string;
  captured_count: number;
  completed_at: string;
  created_at?: string;
  failed_count: number;
  id?: string;
  install_mode: BetaPilotInstallMode;
  offline_recovery_verified: boolean;
  primary_device: BetaPilotDevice;
  reload_verified: boolean;
  started_at: string;
  target_count: CaptureEnduranceTarget;
  uploaded_count: number;
  user_id?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isCaptureEnduranceTarget(
  value: unknown
): value is CaptureEnduranceTarget {
  return (
    typeof value === "number" &&
    captureEnduranceTargets.includes(value as CaptureEnduranceTarget)
  );
}

export function parseCaptureEnduranceRun(
  value: unknown
): CaptureEnduranceLocalRun | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    value.version !== 1 ||
    typeof value.captureSessionId !== "string" ||
    !value.captureSessionId.trim() ||
    typeof value.lastPageInstanceId !== "string" ||
    !isValidDate(value.lastSeenAt) ||
    !isValidDate(value.startedAt) ||
    !isCaptureEnduranceTarget(value.targetCount) ||
    typeof value.sawOffline !== "boolean" ||
    typeof value.reloadVerified !== "boolean" ||
    typeof value.offlineRecoveryVerified !== "boolean"
  ) {
    return null;
  }

  return {
    captureSessionId: value.captureSessionId,
    lastPageInstanceId: value.lastPageInstanceId,
    lastSeenAt: value.lastSeenAt,
    offlineRecoveryVerified: value.offlineRecoveryVerified,
    reloadVerified: value.reloadVerified,
    sawOffline: value.sawOffline,
    startedAt: value.startedAt,
    targetCount: value.targetCount,
    version: 1,
  };
}

export function createCaptureEnduranceRun({
  captureSessionId,
  pageInstanceId,
  targetCount,
  now = new Date(),
}: {
  captureSessionId: string;
  pageInstanceId: string;
  targetCount: CaptureEnduranceTarget;
  now?: Date;
}): CaptureEnduranceLocalRun {
  const timestamp = now.toISOString();

  return {
    captureSessionId,
    lastPageInstanceId: pageInstanceId,
    lastSeenAt: timestamp,
    offlineRecoveryVerified: false,
    reloadVerified: false,
    sawOffline: false,
    startedAt: timestamp,
    targetCount,
    version: 1,
  };
}

export function resumeCaptureEnduranceRun(
  run: CaptureEnduranceLocalRun,
  pageInstanceId: string,
  now = new Date()
): CaptureEnduranceLocalRun {
  return {
    ...run,
    lastPageInstanceId: pageInstanceId,
    lastSeenAt: now.toISOString(),
    reloadVerified:
      run.reloadVerified || run.lastPageInstanceId !== pageInstanceId,
  };
}

export function updateCaptureEnduranceConnection(
  run: CaptureEnduranceLocalRun,
  isOnline: boolean,
  now = new Date()
): CaptureEnduranceLocalRun {
  return {
    ...run,
    lastSeenAt: now.toISOString(),
    offlineRecoveryVerified:
      run.offlineRecoveryVerified || (isOnline && run.sawOffline),
    sawOffline: run.sawOffline || !isOnline,
  };
}

export function getCaptureEnduranceProgress(
  run: CaptureEnduranceLocalRun,
  localItems: readonly CaptureEnduranceQueueItem[],
  remoteItems: readonly CaptureEnduranceQueueItem[]
): CaptureEnduranceProgress {
  const localRunItems = localItems.filter(
    (item) => item.captureSessionId === run.captureSessionId
  );
  const remoteRunItems = remoteItems.filter(
    (item) => item.captureSessionId === run.captureSessionId
  );
  const capturedIds = new Set([
    ...localRunItems.map((item) => item.id),
    ...remoteRunItems.map((item) => item.id),
  ]);
  const uploadedIds = new Set(remoteRunItems.map((item) => item.id));
  const failedIds = new Set([
    ...localRunItems
      .filter((item) => item.status === "failed")
      .map((item) => item.id),
    ...remoteRunItems
      .filter(
        (item) =>
          item.status === "failed" && item.failureStage === "upload"
      )
      .map((item) => item.id),
  ]);
  const capturedCount = capturedIds.size;
  const uploadedCount = uploadedIds.size;
  const failedCount = failedIds.size;
  const passed =
    capturedCount >= run.targetCount &&
    uploadedCount >= run.targetCount &&
    failedCount === 0 &&
    run.reloadVerified &&
    run.offlineRecoveryVerified;

  return {
    capturedCount,
    failedCount,
    offlineRecoveryVerified: run.offlineRecoveryVerified,
    passed,
    reloadVerified: run.reloadVerified,
    remainingCaptures: Math.max(0, run.targetCount - capturedCount),
    remainingUploads: Math.max(0, run.targetCount - uploadedCount),
    targetCount: run.targetCount,
    uploadedCount,
  };
}

export function createCaptureEnduranceEvidence({
  browser,
  completedAt = new Date(),
  installMode,
  primaryDevice,
  progress,
  run,
}: {
  browser: BetaPilotBrowser;
  completedAt?: Date;
  installMode: BetaPilotInstallMode;
  primaryDevice: BetaPilotDevice;
  progress: CaptureEnduranceProgress;
  run: CaptureEnduranceLocalRun;
}): CaptureEnduranceEvidence {
  if (!progress.passed) {
    throw new Error("Endurance-runnet mangler stadig et eller flere beviser.");
  }

  return {
    browser,
    capture_session_id: run.captureSessionId,
    captured_count: progress.capturedCount,
    completed_at: completedAt.toISOString(),
    failed_count: progress.failedCount,
    install_mode: installMode,
    offline_recovery_verified: progress.offlineRecoveryVerified,
    primary_device: primaryDevice,
    reload_verified: progress.reloadVerified,
    started_at: run.startedAt,
    target_count: progress.targetCount,
    uploaded_count: progress.uploadedCount,
  };
}
