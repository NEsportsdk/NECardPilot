import type {
  IdentifiedCard,
  IdentifyCardResult,
} from "@/lib/scan/identifyCard";
import type {
  UploadedCardImage,
  UploadCardImagesResult,
} from "@/lib/scan/uploadCardImages";
import { createClient } from "@/lib/supabase/client";

const CARD_IMAGE_BUCKET = "card-images";
const SIGNED_PREVIEW_SECONDS = 60 * 20;

export type CaptureQueueStatus =
  | "uploaded"
  | "identifying"
  | "identified"
  | "needs_review"
  | "saved"
  | "failed";

export type CaptureQueueFailureStage =
  | "upload"
  | "identification"
  | "review"
  | null;

export type CaptureQueueItem = {
  id: string;
  userId: string;
  collectionId: string;
  captureSessionId: string;
  status: CaptureQueueStatus;
  frontImagePath: string;
  backImagePath: string;
  frontOriginalName: string;
  backOriginalName: string;
  frontMimeType: string;
  backMimeType: string;
  frontSizeBytes: number;
  backSizeBytes: number;
  identificationResult: IdentifiedCard | null;
  identificationUsage: IdentifyCardResult["usage"];
  attemptCount: number;
  failureStage: CaptureQueueFailureStage;
  errorMessage: string | null;
  cardId: string | null;
  capturedAt: string;
  identificationStartedAt: string | null;
  identifiedAt: string | null;
  savedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type CaptureQueueRow = {
  id: string;
  user_id: string;
  collection_id: string;
  capture_session_id: string;
  status: CaptureQueueStatus;
  front_image_path: string;
  back_image_path: string;
  front_original_name: string;
  back_original_name: string;
  front_mime_type: string;
  back_mime_type: string;
  front_size_bytes: number;
  back_size_bytes: number;
  identification_result: unknown;
  identification_usage: unknown;
  attempt_count: number;
  failure_stage: CaptureQueueFailureStage;
  error_message: string | null;
  card_id: string | null;
  captured_at: string;
  identification_started_at: string | null;
  identified_at: string | null;
  saved_at: string | null;
  created_at: string;
  updated_at: string;
};

type CaptureQueueUpdate = Partial<{
  status: CaptureQueueStatus;
  identification_result: IdentifiedCard | null;
  identification_usage: IdentifyCardResult["usage"];
  attempt_count: number;
  failure_stage: CaptureQueueFailureStage;
  error_message: string | null;
  card_id: string | null;
  identification_started_at: string | null;
  identified_at: string | null;
  saved_at: string | null;
}>;

function getReadableError(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message;
  }

  return fallback;
}

function isIdentifiedCard(value: unknown): value is IdentifiedCard {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const card = value as Record<string, unknown>;

  return (
    typeof card.confidence === "number" &&
    typeof card.needsManualReview === "boolean" &&
    Array.isArray(card.notes) &&
    Array.isArray(card.uncertainFields)
  );
}

function isIdentificationUsage(
  value: unknown
): value is IdentifyCardResult["usage"] {
  if (value === null) {
    return true;
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const usage = value as Record<string, unknown>;

  return (
    typeof usage.inputTokens === "number" &&
    typeof usage.outputTokens === "number" &&
    typeof usage.totalTokens === "number"
  );
}

function mapCaptureQueueRow(row: CaptureQueueRow): CaptureQueueItem {
  return {
    id: row.id,
    userId: row.user_id,
    collectionId: row.collection_id,
    captureSessionId: row.capture_session_id,
    status: row.status,
    frontImagePath: row.front_image_path,
    backImagePath: row.back_image_path,
    frontOriginalName: row.front_original_name,
    backOriginalName: row.back_original_name,
    frontMimeType: row.front_mime_type,
    backMimeType: row.back_mime_type,
    frontSizeBytes: row.front_size_bytes,
    backSizeBytes: row.back_size_bytes,
    identificationResult: isIdentifiedCard(row.identification_result)
      ? row.identification_result
      : null,
    identificationUsage: isIdentificationUsage(row.identification_usage)
      ? row.identification_usage
      : null,
    attemptCount: row.attempt_count,
    failureStage: row.failure_stage,
    errorMessage: row.error_message,
    cardId: row.card_id,
    capturedAt: row.captured_at,
    identificationStartedAt: row.identification_started_at,
    identifiedAt: row.identified_at,
    savedAt: row.saved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function uploadedImageFromItem(
  item: CaptureQueueItem,
  side: "front" | "back"
): UploadedCardImage {
  const front = side === "front";

  return {
    side,
    bucket: CARD_IMAGE_BUCKET,
    path: front ? item.frontImagePath : item.backImagePath,
    originalFileName: front
      ? item.frontOriginalName
      : item.backOriginalName,
    mimeType: front ? item.frontMimeType : item.backMimeType,
    size: front ? item.frontSizeBytes : item.backSizeBytes,
  };
}

export function captureQueueItemToUploadResult(
  item: CaptureQueueItem
): UploadCardImagesResult {
  return {
    scanId: item.id,
    front: uploadedImageFromItem(item, "front"),
    back: uploadedImageFromItem(item, "back"),
  };
}

export function canIdentifyCaptureItem(item: CaptureQueueItem) {
  return (
    item.status === "uploaded" ||
    (item.status === "failed" && item.failureStage === "identification")
  );
}

export async function listCaptureQueueItems(collectionId?: string) {
  const supabase = createClient();
  let query = supabase
    .from("scan_capture_items")
    .select("*")
    .order("created_at", { ascending: true });

  if (collectionId?.trim()) {
    query = query.eq("collection_id", collectionId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      getReadableError(error, "Capture-køen kunne ikke indlæses.")
    );
  }

  return ((data ?? []) as CaptureQueueRow[]).map(mapCaptureQueueRow);
}

export async function createUploadedCaptureItem({
  itemId,
  captureSessionId,
  collectionId,
  capturedAt,
  uploadResult,
}: {
  itemId: string;
  captureSessionId: string;
  collectionId: string;
  capturedAt: string;
  uploadResult: UploadCardImagesResult;
}) {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Du skal være logget ind for at gemme capture-køen.");
  }

  const payload = {
    id: itemId,
    user_id: user.id,
    collection_id: collectionId,
    capture_session_id: captureSessionId,
    status: "uploaded" as const,
    front_image_path: uploadResult.front.path,
    back_image_path: uploadResult.back.path,
    front_original_name: uploadResult.front.originalFileName,
    back_original_name: uploadResult.back.originalFileName,
    front_mime_type: uploadResult.front.mimeType,
    back_mime_type: uploadResult.back.mimeType,
    front_size_bytes: uploadResult.front.size,
    back_size_bytes: uploadResult.back.size,
    captured_at: capturedAt,
  };

  const { data, error } = await supabase
    .from("scan_capture_items")
    .insert(payload)
    .select("*")
    .single();

  if (!error && data) {
    return mapCaptureQueueRow(data as CaptureQueueRow);
  }

  if (error?.code === "23505") {
    const { data: existing, error: existingError } = await supabase
      .from("scan_capture_items")
      .select("*")
      .eq("id", itemId)
      .single();

    if (!existingError && existing) {
      return mapCaptureQueueRow(existing as CaptureQueueRow);
    }
  }

  throw new Error(
    getReadableError(error, "Det uploadede kort kunne ikke føjes til køen.")
  );
}

export async function updateCaptureQueueItem(
  itemId: string,
  update: CaptureQueueUpdate
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scan_capture_items")
    .update(update)
    .eq("id", itemId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      getReadableError(error, "Capture-køen kunne ikke opdateres.")
    );
  }

  return mapCaptureQueueRow(data as CaptureQueueRow);
}

export async function markCaptureItemIdentifying(item: CaptureQueueItem) {
  const supabase = createClient();
  let query = supabase
    .from("scan_capture_items")
    .update({
    status: "identifying",
    attempt_count: Math.min(20, item.attemptCount + 1),
    failure_stage: null,
    error_message: null,
    identification_started_at: new Date().toISOString(),
    })
    .eq("id", item.id)
    .eq("status", item.status);

  if (item.status === "failed") {
    query = query.eq("failure_stage", "identification");
  }

  const { data, error } = await query.select("*").maybeSingle();

  if (error) {
    throw new Error(
      getReadableError(error, "Kortet kunne ikke startes i AI-køen.")
    );
  }

  return data ? mapCaptureQueueRow(data as CaptureQueueRow) : null;
}

export async function markCaptureItemIdentified(
  itemId: string,
  result: IdentifyCardResult
) {
  const identifiedAt = new Date().toISOString();

  return updateCaptureQueueItem(itemId, {
    status: result.card.needsManualReview ? "needs_review" : "identified",
    identification_result: result.card,
    identification_usage: result.usage,
    failure_stage: null,
    error_message: null,
    identified_at: identifiedAt,
  });
}

export async function markCaptureItemFailed(
  itemId: string,
  error: unknown,
  failureStage: Exclude<CaptureQueueFailureStage, null>
) {
  return updateCaptureQueueItem(itemId, {
    status: "failed",
    failure_stage: failureStage,
    error_message: getReadableError(error, "Behandlingen af kortet mislykkedes."),
  });
}

export async function markCaptureItemSaved(itemId: string, cardId: string) {
  return updateCaptureQueueItem(itemId, {
    status: "saved",
    card_id: cardId,
    failure_stage: null,
    error_message: null,
    saved_at: new Date().toISOString(),
  });
}

export async function recoverInterruptedIdentification(item: CaptureQueueItem) {
  if (item.status !== "identifying") {
    return item;
  }

  return updateCaptureQueueItem(item.id, {
    status: "uploaded",
    failure_stage: null,
    error_message: null,
    identification_started_at: null,
  });
}

export async function createCapturePreviewUrls(item: CaptureQueueItem) {
  const supabase = createClient();
  const [frontResult, backResult] = await Promise.all([
    supabase.storage
      .from(CARD_IMAGE_BUCKET)
      .createSignedUrl(item.frontImagePath, SIGNED_PREVIEW_SECONDS),
    supabase.storage
      .from(CARD_IMAGE_BUCKET)
      .createSignedUrl(item.backImagePath, SIGNED_PREVIEW_SECONDS),
  ]);

  if (frontResult.error || backResult.error) {
    throw new Error(
      getReadableError(
        frontResult.error ?? backResult.error,
        "Billederne kunne ikke åbnes til review."
      )
    );
  }

  return {
    front: frontResult.data.signedUrl,
    back: backResult.data.signedUrl,
  };
}

export async function removeCaptureQueueItem(item: CaptureQueueItem) {
  const supabase = createClient();
  const { error: deleteError } = await supabase
    .from("scan_capture_items")
    .delete()
    .eq("id", item.id);

  if (deleteError) {
    throw new Error(
      getReadableError(deleteError, "Kortet kunne ikke fjernes fra køen.")
    );
  }

  const { error: storageError } = await supabase.storage
    .from(CARD_IMAGE_BUCKET)
    .remove([item.frontImagePath, item.backImagePath]);

  if (storageError) {
    console.error("Capture queue images could not be removed:", storageError);
  }
}
