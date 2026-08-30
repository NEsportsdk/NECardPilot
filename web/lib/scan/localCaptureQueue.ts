import { createId } from "@/lib/createId";
import type { UploadCardImagesResult } from "@/lib/scan/uploadCardImages";

const DATABASE_NAME = "vallective-capture-queue";
const DATABASE_VERSION = 1;
const ITEM_STORE = "capture-items";

export type LocalCaptureStatus =
  | "queued"
  | "uploading"
  | "persisting"
  | "failed";

export type LocalCaptureFailureStage = "upload" | "persist";

export type LocalCaptureImage = {
  blob: Blob;
  name: string;
  type: string;
  lastModified: number;
};

export type LocalCaptureItem = {
  id: string;
  captureSessionId: string;
  collectionId: string;
  collectionName: string;
  capturedAt: string;
  updatedAt: string;
  status: LocalCaptureStatus;
  front: LocalCaptureImage;
  back: LocalCaptureImage;
  uploadResult?: UploadCardImagesResult;
  attemptCount: number;
  failureStage?: LocalCaptureFailureStage;
  errorMessage?: string;
};

export type CaptureStorageEstimate = {
  quota: number | null;
  usage: number | null;
  persisted: boolean | null;
};

function requireIndexedDb() {
  if (typeof indexedDB === "undefined") {
    throw new Error(
      "Denne browser understøtter ikke den lokale capture-kø."
    );
  }

  return indexedDB;
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Den lokale kø kunne ikke læses."));
  });
}

function transactionCompleted(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(
        transaction.error ?? new Error("Den lokale kø kunne ikke opdateres.")
      );
    transaction.onabort = () =>
      reject(
        transaction.error ?? new Error("Opdateringen af den lokale kø blev afbrudt.")
      );
  });
}

function openCaptureDatabase() {
  const databaseRequest = requireIndexedDb().open(
    DATABASE_NAME,
    DATABASE_VERSION
  );

  databaseRequest.onupgradeneeded = () => {
    const database = databaseRequest.result;

    if (!database.objectStoreNames.contains(ITEM_STORE)) {
      const store = database.createObjectStore(ITEM_STORE, {
        keyPath: "id",
      });

      store.createIndex("capturedAt", "capturedAt");
      store.createIndex("status", "status");
    }
  };

  return requestResult(databaseRequest);
}

function imageFromFile(file: File): LocalCaptureImage {
  return {
    blob: file,
    name: file.name,
    type: file.type,
    lastModified: file.lastModified,
  };
}

export function localCaptureImageToFile(image: LocalCaptureImage) {
  return new File([image.blob], image.name, {
    type: image.type,
    lastModified: image.lastModified,
  });
}

export function createLocalCaptureItem({
  captureSessionId,
  collectionId,
  collectionName,
  frontImage,
  backImage,
}: {
  captureSessionId: string;
  collectionId: string;
  collectionName: string;
  frontImage: File;
  backImage: File;
}): LocalCaptureItem {
  const timestamp = new Date().toISOString();

  return {
    id: createId(),
    captureSessionId,
    collectionId,
    collectionName,
    capturedAt: timestamp,
    updatedAt: timestamp,
    status: "queued",
    front: imageFromFile(frontImage),
    back: imageFromFile(backImage),
    attemptCount: 0,
  };
}

export async function listLocalCaptureItems() {
  const database = await openCaptureDatabase();

  try {
    const transaction = database.transaction(ITEM_STORE, "readonly");
    const completion = transactionCompleted(transaction);
    const request = transaction.objectStore(ITEM_STORE).getAll();
    const items = (await requestResult(request)) as LocalCaptureItem[];

    await completion;

    return items.sort((first, second) =>
      first.capturedAt.localeCompare(second.capturedAt)
    );
  } finally {
    database.close();
  }
}

export async function saveLocalCaptureItem(item: LocalCaptureItem) {
  const database = await openCaptureDatabase();

  try {
    const transaction = database.transaction(ITEM_STORE, "readwrite");
    transaction.objectStore(ITEM_STORE).put({
      ...item,
      updatedAt: new Date().toISOString(),
    });
    await transactionCompleted(transaction);
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === "QuotaExceededError" || error.name === "UnknownError")
    ) {
      throw new Error(
        "Telefonens lokale lager er fyldt. Gå online, så Vallective kan uploade køen, før du tager flere billeder."
      );
    }

    throw error;
  } finally {
    database.close();
  }
}

export async function removeLocalCaptureItem(itemId: string) {
  const database = await openCaptureDatabase();

  try {
    const transaction = database.transaction(ITEM_STORE, "readwrite");
    transaction.objectStore(ITEM_STORE).delete(itemId);
    await transactionCompleted(transaction);
  } finally {
    database.close();
  }
}

export async function requestPersistentCaptureStorage(): Promise<boolean | null> {
  if (
    typeof navigator === "undefined" ||
    !navigator.storage ||
    typeof navigator.storage.persist !== "function"
  ) {
    return null;
  }

  try {
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function getCaptureStorageEstimate(): Promise<CaptureStorageEstimate> {
  if (typeof navigator === "undefined" || !navigator.storage) {
    return {
      quota: null,
      usage: null,
      persisted: null,
    };
  }

  const [estimate, persisted] = await Promise.all([
    typeof navigator.storage.estimate === "function"
      ? navigator.storage.estimate().catch(() => null)
      : Promise.resolve(null),
    typeof navigator.storage.persisted === "function"
      ? navigator.storage.persisted().catch(() => null)
      : Promise.resolve(null),
  ]);

  return {
    quota: estimate?.quota ?? null,
    usage: estimate?.usage ?? null,
    persisted,
  };
}
