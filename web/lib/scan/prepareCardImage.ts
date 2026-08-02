export type CardImageSide = "front" | "back";

export type PreparedCardImage = {
  file: File;
  originalFileName: string;
  originalSize: number;
  preparedSize: number;
  width: number;
  height: number;
  wasOptimized: boolean;
};

type PrepareCardImageOptions = {
  side: CardImageSide;
  maxDimension?: number;
  targetBytes?: number;
  maximumInputBytes?: number;
};

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
};

const DEFAULT_MAX_DIMENSION = 2400;
const DEFAULT_TARGET_BYTES = 3 * 1024 * 1024;
const DEFAULT_MAXIMUM_INPUT_BYTES = 40 * 1024 * 1024;
const MIN_JPEG_QUALITY = 0.62;
const QUALITY_STEP = 0.08;
const SCALE_STEP = 0.86;
const MAX_SCALE_ATTEMPTS = 4;

const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function getNormalizedMimeType(file: File) {
  const normalizedType = file.type.trim().toLowerCase();

  if (normalizedType) {
    return normalizedType;
  }

  const extension = file.name
    .split(".")
    .pop()
    ?.trim()
    .toLowerCase();

  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "heic":
      return "image/heic";
    case "heif":
      return "image/heif";
    default:
      return normalizedType;
  }
}

function getOutputFileName(file: File, side: CardImageSide) {
  const baseName = file.name
    .replace(/\.[^.]+$/, "")
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  const safeBaseName = baseName || `card-${side}`;

  return `${safeBaseName}-${side}.jpg`;
}

function calculateTargetDimensions(
  width: number,
  height: number,
  maxDimension: number
) {
  const longestEdge = Math.max(width, height);

  if (longestEdge <= maxDimension) {
    return {
      width,
      height,
    };
  }

  const scale = maxDimension / longestEdge;

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function decodeWithImageBitmap(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap !== "function") {
    throw new Error("createImageBitmap is unavailable.");
  }

  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });

  return {
    source: bitmap,
    width: bitmap.width,
    height: bitmap.height,
    cleanup: () => bitmap.close(),
  };
}

async function decodeWithImageElement(file: File): Promise<DecodedImage> {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Browseren kunne ikke læse billedfilen."));
      image.src = objectUrl;
    });

    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error("Billedet har ugyldige dimensioner.");
    }

    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      cleanup: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

async function decodeImage(file: File): Promise<DecodedImage> {
  try {
    return await decodeWithImageBitmap(file);
  } catch {
    return decodeWithImageElement(file);
  }
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", {
    alpha: false,
  });

  if (!context) {
    throw new Error("Browseren kunne ikke klargøre billedet.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);

  return {
    canvas,
    context,
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Browseren kunne ikke komprimere billedet."));
          return;
        }

        resolve(blob);
      },
      "image/jpeg",
      quality
    );
  });
}

async function renderJpeg(
  decodedImage: DecodedImage,
  width: number,
  height: number,
  targetBytes: number
) {
  let currentWidth = width;
  let currentHeight = height;
  let bestBlob: Blob | null = null;
  let bestWidth = width;
  let bestHeight = height;

  for (let scaleAttempt = 0; scaleAttempt < MAX_SCALE_ATTEMPTS; scaleAttempt += 1) {
    const { canvas, context } = createCanvas(currentWidth, currentHeight);

    context.drawImage(
      decodedImage.source,
      0,
      0,
      currentWidth,
      currentHeight
    );

    for (
      let quality = 0.9;
      quality >= MIN_JPEG_QUALITY - 0.001;
      quality -= QUALITY_STEP
    ) {
      const blob = await canvasToBlob(canvas, Math.max(MIN_JPEG_QUALITY, quality));

      if (!bestBlob || blob.size < bestBlob.size) {
        bestBlob = blob;
        bestWidth = currentWidth;
        bestHeight = currentHeight;
      }

      if (blob.size <= targetBytes) {
        return {
          blob,
          width: currentWidth,
          height: currentHeight,
        };
      }
    }

    currentWidth = Math.max(1, Math.round(currentWidth * SCALE_STEP));
    currentHeight = Math.max(1, Math.round(currentHeight * SCALE_STEP));
  }

  if (!bestBlob) {
    throw new Error("Billedet kunne ikke komprimeres.");
  }

  return {
    blob: bestBlob,
    width: bestWidth,
    height: bestHeight,
  };
}

export async function prepareCardImage(
  file: File,
  {
    side,
    maxDimension = DEFAULT_MAX_DIMENSION,
    targetBytes = DEFAULT_TARGET_BYTES,
    maximumInputBytes = DEFAULT_MAXIMUM_INPUT_BYTES,
  }: PrepareCardImageOptions
): Promise<PreparedCardImage> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Billedet skal klargøres i browseren.");
  }

  const mimeType = getNormalizedMimeType(file);

  if (!ACCEPTED_IMAGE_TYPES.has(mimeType)) {
    throw new Error(
      "Billedet skal være en JPG-, PNG-, WEBP-, HEIC- eller HEIF-fil."
    );
  }

  if (file.size <= 0) {
    throw new Error("Billedfilen er tom.");
  }

  if (file.size > maximumInputBytes) {
    throw new Error("Det oprindelige billede må højst fylde 40 MB.");
  }

  let decodedImage: DecodedImage;

  try {
    decodedImage = await decodeImage(file);
  } catch {
    if (mimeType === "image/heic" || mimeType === "image/heif") {
      throw new Error(
        "Denne HEIC/HEIF-fil kunne ikke konverteres i browseren. Tag billedet direkte med kamera-knappen, eller vælg JPG under iPhone-indstillingerne Kamera → Formater → Mest kompatibel."
      );
    }

    throw new Error(
      "Billedet kunne ikke læses. Prøv at tage et nyt foto eller vælge en anden fil."
    );
  }

  try {
    const targetDimensions = calculateTargetDimensions(
      decodedImage.width,
      decodedImage.height,
      maxDimension
    );

    const renderedImage = await renderJpeg(
      decodedImage,
      targetDimensions.width,
      targetDimensions.height,
      targetBytes
    );

    const preparedFile = new File(
      [renderedImage.blob],
      getOutputFileName(file, side),
      {
        type: "image/jpeg",
        lastModified: Date.now(),
      }
    );

    return {
      file: preparedFile,
      originalFileName: file.name,
      originalSize: file.size,
      preparedSize: preparedFile.size,
      width: renderedImage.width,
      height: renderedImage.height,
      wasOptimized:
        preparedFile.size < file.size ||
        mimeType !== "image/jpeg" ||
        renderedImage.width !== decodedImage.width ||
        renderedImage.height !== decodedImage.height,
    };
  } finally {
    decodedImage.cleanup();
  }
}