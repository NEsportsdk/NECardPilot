import { createId } from "@/lib/createId";
import { createClient } from "@/lib/supabase/client";

const CARD_IMAGE_BUCKET = "card-images";
const MAX_IMAGE_SIZE = 15 * 1024 * 1024;

const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export type UploadedCardImage = {
  side: "front" | "back";
  bucket: string;
  path: string;
  originalFileName: string;
  mimeType: string;
  size: number;
};

export type UploadCardImagesResult = {
  scanId: string;
  front: UploadedCardImage;
  back: UploadedCardImage;
};

type UploadCardImagesInput = {
  collectionId: string;
  frontImage: File;
  backImage: File;
  scanId?: string;
  replaceExisting?: boolean;
};

function validateImage(file: File, side: "front" | "back") {
  if (!file) {
    throw new Error(
      side === "front"
        ? "Kortets forside mangler."
        : "Kortets bagside mangler."
    );
  }

  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error(
      `${
        side === "front" ? "Forsiden" : "Bagsiden"
      } skal være et JPG-, PNG-, WEBP- eller HEIC-billede.`
    );
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error(
      `${
        side === "front" ? "Forsiden" : "Bagsiden"
      } må højst fylde 15 MB.`
    );
  }
}

function getFileExtension(file: File) {
  const extensionFromName = file.name
    .split(".")
    .pop()
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  if (extensionFromName) {
    return extensionFromName === "jpeg" ? "jpg" : extensionFromName;
  }

  switch (file.type) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "jpg";
  }
}

async function removeUploadedFiles(paths: string[]) {
  if (paths.length === 0) {
    return;
  }

  const supabase = createClient();

  const { error } = await supabase.storage
    .from(CARD_IMAGE_BUCKET)
    .remove(paths);

  if (error) {
    console.error("Kunne ikke rydde delvist uploadede billeder op:", error);
  }
}

async function uploadSingleImage({
  file,
  path,
  side,
  replaceExisting,
}: {
  file: File;
  path: string;
  side: "front" | "back";
  replaceExisting: boolean;
}): Promise<UploadedCardImage> {
  const supabase = createClient();

  const { error } = await supabase.storage
    .from(CARD_IMAGE_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: replaceExisting,
    });

  if (error) {
    throw new Error(
      `${
        side === "front" ? "Forsiden" : "Bagsiden"
      } kunne ikke uploades: ${error.message}`
    );
  }

  return {
    side,
    bucket: CARD_IMAGE_BUCKET,
    path,
    originalFileName: file.name,
    mimeType: file.type,
    size: file.size,
  };
}

export async function uploadCardImages({
  collectionId,
  frontImage,
  backImage,
  scanId: requestedScanId,
  replaceExisting = false,
}: UploadCardImagesInput): Promise<UploadCardImagesResult> {
  if (!collectionId.trim()) {
    throw new Error("Der mangler en collection til kortet.");
  }

  validateImage(frontImage, "front");
  validateImage(backImage, "back");

  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Du skal være logget ind for at uploade kortbilleder.");
  }

  const scanId = requestedScanId?.trim() || createId();

  if (!/^[a-zA-Z0-9-_]{8,128}$/.test(scanId)) {
    throw new Error("Scan-ID'et er ugyldigt.");
  }

  const safeCollectionId = collectionId.replace(/[^a-zA-Z0-9-_]/g, "");

  const frontPath = [
    user.id,
    safeCollectionId,
    scanId,
    `front.${getFileExtension(frontImage)}`,
  ].join("/");

  const backPath = [
    user.id,
    safeCollectionId,
    scanId,
    `back.${getFileExtension(backImage)}`,
  ].join("/");

  const uploadedPaths: string[] = [];

  try {
    const front = await uploadSingleImage({
      file: frontImage,
      path: frontPath,
      side: "front",
      replaceExisting,
    });

    uploadedPaths.push(front.path);

    const back = await uploadSingleImage({
      file: backImage,
      path: backPath,
      side: "back",
      replaceExisting,
    });

    uploadedPaths.push(back.path);

    return {
      scanId,
      front,
      back,
    };
  } catch (error) {
    await removeUploadedFiles(uploadedPaths);

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Kortbillederne kunne ikke uploades.");
  }
}
