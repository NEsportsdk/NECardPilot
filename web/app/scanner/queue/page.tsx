"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import AppSidebar from "@/components/app/AppSidebar";
import AIReviewPanel from "@/components/scan/AIReviewPanel";
import ImageUploadBox, {
  type ImageSide,
} from "@/components/scan/ImageUploadBox";
import { createId } from "@/lib/createId";
import {
  canIdentifyCaptureItem,
  captureQueueItemToUploadResult,
  createCapturePreviewUrls,
  createUploadedCaptureItem,
  listCaptureQueueItems,
  markCaptureItemFailed,
  markCaptureItemIdentified,
  markCaptureItemIdentifying,
  markCaptureItemSaved,
  recoverInterruptedIdentification,
  removeCaptureQueueItem,
  type CaptureQueueItem,
} from "@/lib/scan/captureQueue";
import { identifyCard } from "@/lib/scan/identifyCard";
import {
  createLocalCaptureItem,
  getCaptureStorageEstimate,
  listLocalCaptureItems,
  localCaptureImageToFile,
  removeLocalCaptureItem,
  requestPersistentCaptureStorage,
  saveLocalCaptureItem,
  type CaptureStorageEstimate,
  type LocalCaptureItem,
} from "@/lib/scan/localCaptureQueue";
import {
  prepareCardImage,
  type PreparedCardImage,
} from "@/lib/scan/prepareCardImage";
import type { ReviewedCardSaveResult } from "@/lib/scan/saveIdentifiedCard";
import { uploadCardImages } from "@/lib/scan/uploadCardImages";
import { createClient } from "@/lib/supabase/client";

type CollectionRow = {
  id: string;
  name: string;
  type: "pc" | "inventory";
  currency: string;
};

type ReviewState = {
  item: CaptureQueueItem;
  frontPreviewUrl: string;
  backPreviewUrl: string;
};

const SELECTED_COLLECTION_KEY =
  "necardpilot.scanner.selectedCollectionId";
const CAPTURE_SESSION_KEY = "vallective.captureQueue.sessionId";
const INTERRUPTED_IDENTIFICATION_MINUTES = 15;

function getReadableError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatBytes(value: number | null) {
  if (value === null) {
    return "Unknown";
  }

  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getRemoteStatusLabel(item: CaptureQueueItem) {
  switch (item.status) {
    case "uploaded":
      return "Ready for identification";
    case "identifying":
      return "Identifying";
    case "identified":
      return "Ready to review";
    case "needs_review":
      return "Needs review";
    case "saved":
      return "Saved";
    case "failed":
      return "Identification failed";
  }
}

function getLocalStatusLabel(item: LocalCaptureItem) {
  switch (item.status) {
    case "queued":
      return "Waiting for upload";
    case "uploading":
      return "Uploading in background";
    case "persisting":
      return "Securing queue item";
    case "failed":
      return item.failureStage === "persist"
        ? "Queue sync failed"
        : "Upload failed";
  }
}

function isInterrupted(item: CaptureQueueItem) {
  if (item.status !== "identifying") {
    return false;
  }

  const updatedAt = new Date(item.updatedAt).getTime();
  const staleAfter =
    INTERRUPTED_IDENTIFICATION_MINUTES * 60 * 1000;

  return Number.isFinite(updatedAt) && Date.now() - updatedAt > staleAfter;
}

function replaceRemoteItem(
  items: CaptureQueueItem[],
  nextItem: CaptureQueueItem
) {
  const existing = items.some((item) => item.id === nextItem.id);

  if (!existing) {
    return [...items, nextItem].sort((first, second) =>
      first.createdAt.localeCompare(second.createdAt)
    );
  }

  return items.map((item) =>
    item.id === nextItem.id ? nextItem : item
  );
}

export default function CaptureQueuePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [captureSessionId, setCaptureSessionId] = useState("");
  const [frontImage, setFrontImage] = useState<File | null>(null);
  const [backImage, setBackImage] = useState<File | null>(null);
  const [frontPreparation, setFrontPreparation] =
    useState<PreparedCardImage | null>(null);
  const [backPreparation, setBackPreparation] =
    useState<PreparedCardImage | null>(null);
  const [preparingSide, setPreparingSide] = useState<ImageSide | null>(null);
  const [localItems, setLocalItems] = useState<LocalCaptureItem[]>([]);
  const [remoteItems, setRemoteItems] = useState<CaptureQueueItem[]>([]);
  const [storageEstimate, setStorageEstimate] =
    useState<CaptureStorageEstimate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isQueueing, setIsQueueing] = useState(false);
  const [uploadWorkerActive, setUploadWorkerActive] = useState(false);
  const [identificationActive, setIdentificationActive] = useState(false);
  const [reviewLoadingId, setReviewLoadingId] = useState<string | null>(null);
  const [reviewState, setReviewState] = useState<ReviewState | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const uploadWorkerRef = useRef(false);
  const stopIdentificationRef = useRef(false);
  const preparationRequestRef = useRef<Record<ImageSide, number>>({
    front: 0,
    back: 0,
  });

  const frontPreviewUrl = useMemo(
    () => (frontImage ? URL.createObjectURL(frontImage) : null),
    [frontImage]
  );
  const backPreviewUrl = useMemo(
    () => (backImage ? URL.createObjectURL(backImage) : null),
    [backImage]
  );

  useEffect(() => {
    return () => {
      if (frontPreviewUrl) {
        URL.revokeObjectURL(frontPreviewUrl);
      }
    };
  }, [frontPreviewUrl]);

  useEffect(() => {
    return () => {
      if (backPreviewUrl) {
        URL.revokeObjectURL(backPreviewUrl);
      }
    };
  }, [backPreviewUrl]);

  const selectedCollection = useMemo(
    () =>
      collections.find(
        (collection) => collection.id === selectedCollectionId
      ) ?? null,
    [collections, selectedCollectionId]
  );

  const queueCounts = useMemo(() => {
    const ready = remoteItems.filter(canIdentifyCaptureItem).length;
    const review = remoteItems.filter(
      (item) =>
        item.status === "identified" || item.status === "needs_review"
    ).length;
    const saved = remoteItems.filter((item) => item.status === "saved").length;
    const failed =
      localItems.filter((item) => item.status === "failed").length +
      remoteItems.filter((item) => item.status === "failed").length;

    return {
      captured: localItems.length + remoteItems.length,
      local: localItems.length,
      ready,
      review,
      saved,
      failed,
    };
  }, [localItems, remoteItems]);

  const updateLocalState = useCallback((nextItem: LocalCaptureItem) => {
    setLocalItems((currentItems) =>
      currentItems.map((item) =>
        item.id === nextItem.id ? nextItem : item
      )
    );
  }, []);

  const refreshStorageEstimate = useCallback(async () => {
    setStorageEstimate(await getCaptureStorageEstimate());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.replace("/login?next=/scanner/queue");
          return;
        }

        const [collectionResult, storedLocalItems, storedRemoteItems] =
          await Promise.all([
            supabase
              .from("collections")
              .select("id, name, type, currency")
              .order("created_at", { ascending: true }),
            listLocalCaptureItems(),
            listCaptureQueueItems(),
          ]);

        if (collectionResult.error) {
          throw new Error(collectionResult.error.message);
        }

        const recoveredLocalItems = storedLocalItems.map((item) => {
          if (item.status === "uploading") {
            return {
              ...item,
              status: "queued" as const,
              errorMessage: undefined,
            };
          }

          if (item.status === "persisting") {
            return {
              ...item,
              status: item.uploadResult
                ? ("persisting" as const)
                : ("queued" as const),
            };
          }

          return item;
        });

        await Promise.all(
          recoveredLocalItems
            .filter(
              (item, index) => item.status !== storedLocalItems[index].status
            )
            .map(saveLocalCaptureItem)
        );

        const recoveredRemoteItems = await Promise.all(
          storedRemoteItems.map((item) =>
            isInterrupted(item)
              ? recoverInterruptedIdentification(item)
              : Promise.resolve(item)
          )
        );

        if (cancelled) {
          return;
        }

        const nextCollections = (collectionResult.data ?? []) as CollectionRow[];
        const storedCollectionId = window.localStorage.getItem(
          SELECTED_COLLECTION_KEY
        );
        const nextSelectedCollection = nextCollections.some(
          (collection) => collection.id === storedCollectionId
        )
          ? storedCollectionId ?? ""
          : nextCollections[0]?.id ?? "";
        const storedSessionId = window.localStorage.getItem(CAPTURE_SESSION_KEY);
        const nextSessionId = storedSessionId || createId();

        window.localStorage.setItem(CAPTURE_SESSION_KEY, nextSessionId);

        setCollections(nextCollections);
        setSelectedCollectionId(nextSelectedCollection);
        setCaptureSessionId(nextSessionId);
        setLocalItems(recoveredLocalItems);
        setRemoteItems(recoveredRemoteItems);
        setIsOnline(navigator.onLine);

        await requestPersistentCaptureStorage();
        await refreshStorageEstimate();
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            getReadableError(
              error,
              "Capture-køen kunne ikke startes. Prøv at genindlæse siden."
            )
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadWorkspace();

    return () => {
      cancelled = true;
      stopIdentificationRef.current = true;
    };
  }, [refreshStorageEstimate, router, supabase]);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      setNotice("Forbindelsen er tilbage. Upload-køen fortsætter automatisk.");
    }

    function handleOffline() {
      setIsOnline(false);
      setNotice(
        "Du er offline. Nye billeder bliver på telefonen og uploades, når forbindelsen er tilbage."
      );
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const processLocalItem = useCallback(
    async (item: LocalCaptureItem) => {
      let workingItem: LocalCaptureItem = {
        ...item,
        status: item.uploadResult ? "persisting" : "uploading",
        attemptCount: Math.min(20, item.attemptCount + 1),
        failureStage: undefined,
        errorMessage: undefined,
      };

      await saveLocalCaptureItem(workingItem);
      updateLocalState(workingItem);

      try {
        const uploadResult =
          workingItem.uploadResult ??
          (await uploadCardImages({
            collectionId: workingItem.collectionId,
            frontImage: localCaptureImageToFile(workingItem.front),
            backImage: localCaptureImageToFile(workingItem.back),
            scanId: workingItem.id,
            replaceExisting: true,
          }));

        workingItem = {
          ...workingItem,
          status: "persisting",
          uploadResult,
        };

        await saveLocalCaptureItem(workingItem);
        updateLocalState(workingItem);

        const remoteItem = await createUploadedCaptureItem({
          itemId: workingItem.id,
          captureSessionId: workingItem.captureSessionId,
          collectionId: workingItem.collectionId,
          capturedAt: workingItem.capturedAt,
          uploadResult,
        });

        await removeLocalCaptureItem(workingItem.id);
        setLocalItems((currentItems) =>
          currentItems.filter((candidate) => candidate.id !== workingItem.id)
        );
        setRemoteItems((currentItems) =>
          replaceRemoteItem(currentItems, remoteItem)
        );
        await refreshStorageEstimate();
      } catch (error) {
        const waitingForNetwork =
          typeof navigator !== "undefined" && !navigator.onLine;
        const failedItem: LocalCaptureItem = {
          ...workingItem,
          status: waitingForNetwork
            ? workingItem.uploadResult
              ? "persisting"
              : "queued"
            : "failed",
          failureStage: waitingForNetwork
            ? undefined
            : workingItem.uploadResult
              ? "persist"
              : "upload",
          errorMessage: waitingForNetwork
            ? undefined
            : getReadableError(
                error,
                "Billederne kunne ikke uploades."
              ),
        };

        await saveLocalCaptureItem(failedItem);
        updateLocalState(failedItem);
      }
    },
    [refreshStorageEstimate, updateLocalState]
  );

  useEffect(() => {
    if (
      isLoading ||
      !isOnline ||
      uploadWorkerRef.current ||
      !localItems.some(
        (item) => item.status === "queued" || item.status === "persisting"
      )
    ) {
      return;
    }

    const nextItem = localItems.find(
      (item) => item.status === "queued" || item.status === "persisting"
    );

    if (!nextItem) {
      return;
    }

    uploadWorkerRef.current = true;
    setUploadWorkerActive(true);

    void processLocalItem(nextItem).finally(() => {
      uploadWorkerRef.current = false;
      setUploadWorkerActive(false);
    });
  }, [isLoading, isOnline, localItems, processLocalItem]);

  function handleCollectionChange(collectionId: string) {
    setSelectedCollectionId(collectionId);
    setErrorMessage(null);
    window.localStorage.setItem(SELECTED_COLLECTION_KEY, collectionId);
  }

  async function handleSelectImage(side: ImageSide, file: File) {
    const requestId = preparationRequestRef.current[side] + 1;
    preparationRequestRef.current[side] = requestId;
    setPreparingSide(side);
    setErrorMessage(null);

    try {
      const preparation = await prepareCardImage(file, { side });

      if (preparationRequestRef.current[side] !== requestId) {
        return;
      }

      if (side === "front") {
        setFrontImage(preparation.file);
        setFrontPreparation(preparation);
      } else {
        setBackImage(preparation.file);
        setBackPreparation(preparation);
      }
    } catch (error) {
      setErrorMessage(
        getReadableError(error, "Billedet kunne ikke klargøres.")
      );
    } finally {
      if (preparationRequestRef.current[side] === requestId) {
        setPreparingSide(null);
      }
    }
  }

  function handleRemoveImage(side: ImageSide) {
    preparationRequestRef.current[side] += 1;

    if (side === "front") {
      setFrontImage(null);
      setFrontPreparation(null);
    } else {
      setBackImage(null);
      setBackPreparation(null);
    }
  }

  async function handleQueueCard() {
    if (
      !selectedCollection ||
      !captureSessionId ||
      !frontImage ||
      !backImage ||
      preparingSide
    ) {
      setErrorMessage(
        "Vælg en collection og tag både forside og bagside først."
      );
      return;
    }

    setIsQueueing(true);
    setErrorMessage(null);
    setNotice(null);

    try {
      const item = createLocalCaptureItem({
        captureSessionId,
        collectionId: selectedCollection.id,
        collectionName: selectedCollection.name,
        frontImage,
        backImage,
      });

      await saveLocalCaptureItem(item);
      setLocalItems((currentItems) => [...currentItems, item]);
      setFrontImage(null);
      setBackImage(null);
      setFrontPreparation(null);
      setBackPreparation(null);
      setNotice(
        `Kort ${queueCounts.captured + 1} er sikret lokalt. Tag straks det næste.`
      );
      await refreshStorageEstimate();
    } catch (error) {
      setErrorMessage(
        getReadableError(error, "Kortet kunne ikke føjes til capture-køen.")
      );
    } finally {
      setIsQueueing(false);
    }
  }

  async function retryLocalItem(item: LocalCaptureItem) {
    const nextItem: LocalCaptureItem = {
      ...item,
      status: item.uploadResult ? "persisting" : "queued",
      failureStage: undefined,
      errorMessage: undefined,
    };

    await saveLocalCaptureItem(nextItem);
    updateLocalState(nextItem);
  }

  async function discardLocalItem(item: LocalCaptureItem) {
    if (!window.confirm("Fjern dette ikke-uploadede kort fra capture-køen?")) {
      return;
    }

    await removeLocalCaptureItem(item.id);
    setLocalItems((currentItems) =>
      currentItems.filter((candidate) => candidate.id !== item.id)
    );
    await refreshStorageEstimate();
  }

  async function startIdentification() {
    const candidates = remoteItems.filter(canIdentifyCaptureItem);

    if (identificationActive || candidates.length === 0) {
      return;
    }

    stopIdentificationRef.current = false;
    setIdentificationActive(true);
    setErrorMessage(null);
    setNotice(
      `${candidates.length} kort er sat i identifikationskø. Du kan pause efter det aktuelle kort.`
    );

    for (const candidate of candidates) {
      if (stopIdentificationRef.current) {
        break;
      }

      try {
        const identifyingItem = await markCaptureItemIdentifying(candidate);

        if (!identifyingItem) {
          continue;
        }

        setRemoteItems((currentItems) =>
          replaceRemoteItem(currentItems, identifyingItem)
        );

        const result = await identifyCard(
          identifyingItem.frontImagePath,
          identifyingItem.backImagePath
        );
        const identifiedItem = await markCaptureItemIdentified(
          identifyingItem.id,
          result
        );

        setRemoteItems((currentItems) =>
          replaceRemoteItem(currentItems, identifiedItem)
        );
      } catch (error) {
        try {
          const failedItem = await markCaptureItemFailed(
            candidate.id,
            error,
            "identification"
          );
          setRemoteItems((currentItems) =>
            replaceRemoteItem(currentItems, failedItem)
          );
        } catch (updateError) {
          setErrorMessage(
            getReadableError(
              updateError,
              "Identifikationsfejlen kunne ikke gemmes i køen."
            )
          );
        }
      }
    }

    setIdentificationActive(false);
    setNotice(
      stopIdentificationRef.current
        ? "Identifikationen er pauset efter det aktuelle kort."
        : "Identifikationskøen er færdig. Resultaterne er klar til review."
    );
  }

  function pauseIdentification() {
    stopIdentificationRef.current = true;
    setNotice("Pauser efter det kort, der behandles nu.");
  }

  async function openReview(item: CaptureQueueItem) {
    if (!item.identificationResult) {
      return;
    }

    setReviewLoadingId(item.id);
    setErrorMessage(null);

    try {
      const previews = await createCapturePreviewUrls(item);
      setReviewState({
        item,
        frontPreviewUrl: previews.front,
        backPreviewUrl: previews.back,
      });
    } catch (error) {
      setErrorMessage(
        getReadableError(error, "Kortet kunne ikke åbnes til review.")
      );
    } finally {
      setReviewLoadingId(null);
    }
  }

  async function handleReviewedCardSaved(result: ReviewedCardSaveResult) {
    if (!reviewState) {
      return;
    }

    const savedItem = await markCaptureItemSaved(
      reviewState.item.id,
      result.cardId
    );
    setRemoteItems((currentItems) =>
      replaceRemoteItem(currentItems, savedItem)
    );
    setReviewState(null);

    if (result.nextAction === "value") {
      router.push(`/cards/${result.cardId}?value=1#market-value`);
    } else {
      setNotice("Kortet er gemt. Det næste review er klar i køen.");
    }
  }

  async function discardRemoteItem(item: CaptureQueueItem) {
    if (
      !window.confirm(
        "Fjern dette kort og de to uploadede billeder fra capture-køen?"
      )
    ) {
      return;
    }

    try {
      await removeCaptureQueueItem(item);
      setRemoteItems((currentItems) =>
        currentItems.filter((candidate) => candidate.id !== item.id)
      );
    } catch (error) {
      setErrorMessage(
        getReadableError(error, "Kortet kunne ikke fjernes fra køen.")
      );
    }
  }

  function startNewCaptureSession() {
    const nextSessionId = createId();
    window.localStorage.setItem(CAPTURE_SESSION_KEY, nextSessionId);
    setCaptureSessionId(nextSessionId);
    setNotice("En ny capture-session er startet. Eksisterende kø bevares.");
  }

  return (
    <div className="capture-app-shell">
      <AppSidebar variant="grid-scanner" />

      <main className="capture-main">
        <header className="capture-header">
          <div>
            <p className="eyebrow">M21 · Local-first intake</p>
            <h1>Capture Queue</h1>
            <p>
              Photograph continuously now. Upload runs in the background, and
              AI identification only starts when you decide.
            </p>
          </div>

          <div className="header-actions">
            <Link href="/scanner">Guided scanner</Link>
            <button type="button" onClick={startNewCaptureSession}>
              New capture session
            </button>
          </div>
        </header>

        <section className="capture-metrics" aria-label="Capture queue status">
          <article>
            <span>Captured</span>
            <strong>{queueCounts.captured}</strong>
          </article>
          <article>
            <span>On this device</span>
            <strong>{queueCounts.local}</strong>
          </article>
          <article>
            <span>Ready for AI</span>
            <strong>{queueCounts.ready}</strong>
          </article>
          <article>
            <span>Ready to review</span>
            <strong>{queueCounts.review}</strong>
          </article>
          <article>
            <span>Saved</span>
            <strong>{queueCounts.saved}</strong>
          </article>
        </section>

        {!isOnline ? (
          <div className="status-banner status-banner-offline" role="status">
            <span>⌁</span>
            <div>
              <strong>Offline capture is active</strong>
              <p>Your photos stay on this device and resume upload later.</p>
            </div>
          </div>
        ) : null}

        {notice ? (
          <div className="status-banner" role="status">
            <span>✓</span>
            <p>{notice}</p>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="status-banner status-banner-error" role="alert">
            <span>!</span>
            <p>{errorMessage}</p>
          </div>
        ) : null}

        <section className="capture-layout">
          <div className="capture-column">
            <section className="panel capture-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Capture next card</p>
                  <h2>Front, back, queue — keep moving</h2>
                </div>

                <label>
                  <span>Destination collection</span>
                  <select
                    value={selectedCollectionId}
                    onChange={(event) =>
                      handleCollectionChange(event.target.value)
                    }
                    disabled={isLoading || isQueueing}
                  >
                    {collections.length === 0 ? (
                      <option value="">No collection available</option>
                    ) : null}
                    {collections.map((collection) => (
                      <option value={collection.id} key={collection.id}>
                        {collection.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="capture-images">
                <ImageUploadBox
                  side="front"
                  file={frontImage}
                  previewUrl={frontPreviewUrl}
                  disabled={isQueueing}
                  isPreparing={preparingSide === "front"}
                  preparation={frontPreparation}
                  onSelect={(file) => handleSelectImage("front", file)}
                  onRemove={() => handleRemoveImage("front")}
                />
                <ImageUploadBox
                  side="back"
                  file={backImage}
                  previewUrl={backPreviewUrl}
                  disabled={isQueueing}
                  isPreparing={preparingSide === "back"}
                  preparation={backPreparation}
                  onSelect={(file) => handleSelectImage("back", file)}
                  onRemove={() => handleRemoveImage("back")}
                />
              </div>

              <footer className="capture-footer">
                <div>
                  <strong>
                    {uploadWorkerActive
                      ? "Background upload is running"
                      : isOnline
                        ? "Ready for instant local capture"
                        : "Photos will remain safely on this device"}
                  </strong>
                  <span>
                    Local storage {formatBytes(storageEstimate?.usage ?? null)}
                    {storageEstimate?.quota
                      ? ` of ${formatBytes(storageEstimate.quota)}`
                      : ""}
                    {storageEstimate?.persisted ? " · persistent" : ""}
                  </span>
                </div>

                <button
                  className="queue-card-button"
                  type="button"
                  onClick={() => void handleQueueCard()}
                  disabled={
                    isQueueing ||
                    !selectedCollection ||
                    !frontImage ||
                    !backImage ||
                    Boolean(preparingSide)
                  }
                >
                  {isQueueing ? "Securing photos…" : "Add to capture queue"}
                </button>
              </footer>
            </section>

            <section className="panel queue-panel">
              <div className="queue-heading">
                <div>
                  <p className="eyebrow">Processing control</p>
                  <h2>Identification queue</h2>
                  <p>
                    Identification is sequential and cost-controlled. Pause at
                    any time; an in-flight card finishes safely.
                  </p>
                </div>

                <div className="queue-actions">
                  {identificationActive ? (
                    <button
                      className="pause-button"
                      type="button"
                      onClick={pauseIdentification}
                    >
                      Pause after current
                    </button>
                  ) : (
                    <button
                      className="identify-button"
                      type="button"
                      onClick={() => void startIdentification()}
                      disabled={queueCounts.ready === 0 || !isOnline}
                    >
                      Start identification ({queueCounts.ready})
                    </button>
                  )}
                </div>
              </div>

              <div className="queue-list">
                {localItems.map((item, index) => (
                  <article className="queue-item" key={item.id}>
                    <span className="queue-number">{index + 1}</span>
                    <div className="queue-item-copy">
                      <strong>{item.collectionName}</strong>
                      <p>{getLocalStatusLabel(item)}</p>
                      {item.errorMessage ? <small>{item.errorMessage}</small> : null}
                    </div>
                    <span className={`queue-status queue-status-${item.status}`}>
                      Local
                    </span>
                    {item.status === "failed" ? (
                      <div className="item-actions">
                        <button
                          type="button"
                          onClick={() => void retryLocalItem(item)}
                        >
                          Retry
                        </button>
                        <button
                          type="button"
                          onClick={() => void discardLocalItem(item)}
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}

                {remoteItems.map((item, index) => {
                  const identified = item.identificationResult;
                  const collectionName =
                    collections.find(
                      (collection) => collection.id === item.collectionId
                    )?.name ?? "Collection";

                  return (
                    <article className="queue-item" key={item.id}>
                      <span className="queue-number">
                        {localItems.length + index + 1}
                      </span>
                      <div className="queue-item-copy">
                        <strong>
                          {identified?.playerName || collectionName}
                        </strong>
                        <p>
                          {identified
                            ? [
                                identified.year,
                                identified.product,
                                identified.cardNumber
                                  ? `#${identified.cardNumber}`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ") || getRemoteStatusLabel(item)
                            : getRemoteStatusLabel(item)}
                        </p>
                        <small>
                          {collectionName} · {formatTime(item.capturedAt)}
                          {item.errorMessage ? ` · ${item.errorMessage}` : ""}
                        </small>
                      </div>
                      <span
                        className={`queue-status queue-status-${item.status}`}
                      >
                        {getRemoteStatusLabel(item)}
                      </span>
                      <div className="item-actions">
                        {(item.status === "identified" ||
                          item.status === "needs_review") &&
                        item.identificationResult ? (
                          <button
                            className="review-button"
                            type="button"
                            onClick={() => void openReview(item)}
                            disabled={reviewLoadingId === item.id}
                          >
                            {reviewLoadingId === item.id
                              ? "Opening…"
                              : "Review & save"}
                          </button>
                        ) : null}
                        {item.status === "saved" && item.cardId ? (
                          <Link href={`/cards/${item.cardId}`}>View card</Link>
                        ) : null}
                        {item.status !== "saved" &&
                        item.status !== "identifying" ? (
                          <button
                            type="button"
                            onClick={() => void discardRemoteItem(item)}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}

                {!isLoading && localItems.length + remoteItems.length === 0 ? (
                  <div className="empty-queue">
                    <span>◎</span>
                    <h3>Your queue is ready</h3>
                    <p>Capture a front and back above to add the first card.</p>
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          <aside className="capture-aside">
            <section className="panel flow-panel">
              <p className="eyebrow">How it works</p>
              <ol>
                <li>
                  <span>1</span>
                  <div>
                    <strong>Capture</strong>
                    <p>Both photos are compressed and secured locally.</p>
                  </div>
                </li>
                <li>
                  <span>2</span>
                  <div>
                    <strong>Background upload</strong>
                    <p>You continue while Vallective syncs in order.</p>
                  </div>
                </li>
                <li>
                  <span>3</span>
                  <div>
                    <strong>Identify later</strong>
                    <p>AI only starts after your explicit command.</p>
                  </div>
                </li>
                <li>
                  <span>4</span>
                  <div>
                    <strong>Review & value</strong>
                    <p>Confirm identity first; valuation remains separate.</p>
                  </div>
                </li>
              </ol>
            </section>

            <section className="panel safety-panel">
              <span>{isOnline ? "✓" : "⌁"}</span>
              <div>
                <strong>{isOnline ? "Connected" : "Offline-safe"}</strong>
                <p>
                  {storageEstimate?.persisted
                    ? "The browser granted persistent local storage for pending photos."
                    : "Keep Vallective installed and reopen this page to resume pending uploads."}
                </p>
              </div>
            </section>

            {queueCounts.failed > 0 ? (
              <section className="panel warning-panel">
                <strong>{queueCounts.failed} item(s) need attention</strong>
                <p>
                  Failed uploads stay on this device. Failed identifications stay
                  in the cloud queue until retried or removed.
                </p>
              </section>
            ) : null}
          </aside>
        </section>
      </main>

      {reviewState?.item.identificationResult ? (
        <div className="review-overlay" role="dialog" aria-modal="true">
          <div className="review-dialog">
            <AIReviewPanel
              key={reviewState.item.id}
              collectionId={reviewState.item.collectionId}
              card={reviewState.item.identificationResult}
              uploadResult={captureQueueItemToUploadResult(reviewState.item)}
              frontPreviewUrl={reviewState.frontPreviewUrl}
              backPreviewUrl={reviewState.backPreviewUrl}
              onScanAgain={() => setReviewState(null)}
              onSaved={handleReviewedCardSaved}
            />
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .capture-app-shell {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 250px minmax(0, 1fr);
          background:
            radial-gradient(circle at 78% 2%, rgba(124, 92, 255, 0.1), transparent 30%),
            #07090d;
          color: #f8fafc;
        }

        .capture-main {
          min-width: 0;
          padding: 32px clamp(20px, 4vw, 54px) 90px;
        }

        .capture-header,
        .panel-heading,
        .queue-heading,
        .capture-footer {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
        }

        .capture-header h1 {
          margin: 7px 0 0;
          font-size: clamp(30px, 4vw, 48px);
          letter-spacing: -0.045em;
        }

        .capture-header > div > p:last-child,
        .queue-heading p {
          max-width: 720px;
          margin: 10px 0 0;
          color: #8b93a5;
          font-size: 13px;
          line-height: 1.6;
        }

        .eyebrow {
          margin: 0;
          color: #9f93ff;
          font-size: 10px;
          font-weight: 850;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }

        .header-actions,
        .queue-actions,
        .item-actions {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .header-actions a,
        .header-actions button,
        .queue-actions button,
        .item-actions button,
        .item-actions a {
          min-height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 13px;
          border: 1px solid rgba(148, 163, 184, 0.17);
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.035);
          color: #c9cfdb;
          font: inherit;
          font-size: 11px;
          font-weight: 750;
          text-decoration: none;
          cursor: pointer;
        }

        .capture-metrics {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
          margin-top: 26px;
        }

        .capture-metrics article {
          padding: 15px 16px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 15px;
          background: rgba(255, 255, 255, 0.025);
        }

        .capture-metrics span,
        .capture-footer span {
          display: block;
          color: #6f788b;
          font-size: 9px;
          font-weight: 780;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .capture-metrics strong {
          display: block;
          margin-top: 7px;
          color: #ffffff;
          font-size: 22px;
        }

        .status-banner {
          display: flex;
          align-items: center;
          gap: 11px;
          margin-top: 13px;
          padding: 12px 14px;
          border: 1px solid rgba(52, 211, 153, 0.18);
          border-radius: 13px;
          background: rgba(16, 185, 129, 0.055);
          color: #b7f7dd;
          font-size: 12px;
        }

        .status-banner p {
          margin: 0;
        }

        .status-banner-offline {
          border-color: rgba(251, 191, 36, 0.2);
          background: rgba(251, 191, 36, 0.055);
          color: #fde68a;
        }

        .status-banner-offline strong {
          display: block;
          font-size: 12px;
        }

        .status-banner-offline p {
          margin-top: 3px;
          color: #cdbb80;
          font-size: 10px;
        }

        .status-banner-error {
          border-color: rgba(248, 113, 113, 0.24);
          background: rgba(248, 113, 113, 0.07);
          color: #fecaca;
        }

        .capture-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 300px;
          gap: 18px;
          margin-top: 18px;
        }

        .capture-column,
        .capture-aside {
          min-width: 0;
          display: grid;
          align-content: start;
          gap: 18px;
        }

        .panel {
          min-width: 0;
          padding: 22px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 20px;
          background: rgba(13, 16, 24, 0.91);
          box-shadow: 0 20px 55px rgba(0, 0, 0, 0.18);
        }

        .panel h2 {
          margin: 7px 0 0;
          font-size: 20px;
          letter-spacing: -0.025em;
        }

        .panel-heading label {
          min-width: 240px;
          display: grid;
          gap: 7px;
          color: #737c8e;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .panel-heading select {
          min-height: 43px;
          border: 1px solid rgba(148, 163, 184, 0.17);
          border-radius: 11px;
          padding: 0 12px;
          background: #0b0e15;
          color: #ffffff;
          font: inherit;
          font-size: 12px;
          text-transform: none;
        }

        .capture-images {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          margin-top: 22px;
        }

        .capture-footer {
          align-items: center;
          margin-top: 18px;
          padding-top: 18px;
          border-top: 1px solid rgba(148, 163, 184, 0.1);
        }

        .capture-footer strong {
          display: block;
          color: #dce1ea;
          font-size: 12px;
        }

        .capture-footer span {
          margin-top: 5px;
          text-transform: none;
        }

        .queue-card-button,
        .identify-button,
        .review-button {
          min-height: 46px;
          border: 0 !important;
          border-radius: 12px;
          padding: 0 17px;
          background: linear-gradient(135deg, #8b5cf6, #6552e8) !important;
          color: #ffffff !important;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 12px 26px rgba(124, 92, 255, 0.2);
        }

        button:disabled {
          cursor: not-allowed !important;
          opacity: 0.45;
        }

        .pause-button {
          border-color: rgba(251, 191, 36, 0.24) !important;
          color: #fde68a !important;
        }

        .queue-list {
          display: grid;
          gap: 8px;
          margin-top: 20px;
        }

        .queue-item {
          min-width: 0;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto auto;
          align-items: center;
          gap: 12px;
          padding: 12px 13px;
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.022);
        }

        .queue-number {
          width: 29px;
          height: 29px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: rgba(124, 92, 255, 0.1);
          color: #c4b5fd;
          font-size: 10px;
          font-weight: 850;
        }

        .queue-item-copy {
          min-width: 0;
        }

        .queue-item-copy strong,
        .queue-item-copy p,
        .queue-item-copy small {
          display: block;
          overflow: hidden;
          margin: 0;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .queue-item-copy strong {
          color: #e8ebf1;
          font-size: 12px;
        }

        .queue-item-copy p {
          margin-top: 4px;
          color: #8d95a6;
          font-size: 10px;
        }

        .queue-item-copy small {
          margin-top: 4px;
          color: #616a7d;
          font-size: 9px;
        }

        .queue-status {
          max-width: 150px;
          padding: 6px 8px;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.08);
          color: #a5adbc;
          font-size: 8px;
          font-weight: 850;
          letter-spacing: 0.04em;
          text-align: center;
          text-transform: uppercase;
        }

        .queue-status-identified,
        .queue-status-saved {
          background: rgba(16, 185, 129, 0.09);
          color: #a7f3d0;
        }

        .queue-status-needs_review,
        .queue-status-failed {
          background: rgba(251, 191, 36, 0.09);
          color: #fde68a;
        }

        .queue-status-identifying,
        .queue-status-uploading,
        .queue-status-persisting {
          background: rgba(96, 165, 250, 0.09);
          color: #bfdbfe;
        }

        .item-actions button,
        .item-actions a {
          min-height: 34px;
          padding: 0 10px;
          font-size: 9px;
        }

        .empty-queue {
          padding: 36px 20px;
          text-align: center;
          color: #71798b;
        }

        .empty-queue > span {
          display: block;
          color: #9f93ff;
          font-size: 28px;
        }

        .empty-queue h3 {
          margin: 12px 0 0;
          color: #ffffff;
          font-size: 15px;
        }

        .empty-queue p {
          margin: 7px 0 0;
          font-size: 11px;
        }

        .flow-panel ol {
          display: grid;
          gap: 15px;
          margin: 18px 0 0;
          padding: 0;
          list-style: none;
        }

        .flow-panel li,
        .safety-panel {
          display: flex;
          align-items: flex-start;
          gap: 11px;
        }

        .flow-panel li > span,
        .safety-panel > span {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 9px;
          background: rgba(124, 92, 255, 0.1);
          color: #c4b5fd;
          font-size: 10px;
          font-weight: 850;
        }

        .flow-panel strong,
        .safety-panel strong,
        .warning-panel strong {
          color: #e1e5ed;
          font-size: 11px;
        }

        .flow-panel p,
        .safety-panel p,
        .warning-panel p {
          margin: 4px 0 0;
          color: #71798b;
          font-size: 10px;
          line-height: 1.5;
        }

        .warning-panel {
          border-color: rgba(251, 191, 36, 0.15);
          background: rgba(251, 191, 36, 0.035);
        }

        .review-overlay {
          position: fixed;
          inset: 0;
          z-index: 200;
          overflow-y: auto;
          padding: 24px;
          background: rgba(3, 5, 10, 0.86);
          backdrop-filter: blur(14px);
        }

        .review-dialog {
          width: min(1180px, 100%);
          margin: 0 auto;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 22px;
          background: #0b0e15;
          box-shadow: 0 30px 100px rgba(0, 0, 0, 0.45);
        }

        @media (max-width: 1120px) {
          .capture-app-shell {
            grid-template-columns: 1fr;
          }

          .capture-layout {
            grid-template-columns: 1fr;
          }

          .capture-aside {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .flow-panel {
            grid-row: span 2;
          }
        }

        @media (max-width: 820px) {
          .capture-main {
            padding: 22px 15px 110px;
          }

          .capture-header,
          .panel-heading,
          .queue-heading,
          .capture-footer {
            flex-direction: column;
          }

          .header-actions,
          .queue-actions,
          .queue-actions button,
          .queue-card-button,
          .panel-heading label {
            width: 100%;
          }

          .capture-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .capture-metrics article:first-child {
            grid-column: span 2;
          }

          .capture-images,
          .capture-aside {
            grid-template-columns: 1fr;
          }

          .flow-panel {
            grid-row: auto;
          }

          .queue-item {
            grid-template-columns: auto minmax(0, 1fr) auto;
          }

          .item-actions {
            grid-column: 2 / -1;
            justify-content: flex-end;
          }

          .review-overlay {
            padding: 8px;
          }
        }

        @media (max-width: 520px) {
          .panel {
            padding: 17px;
            border-radius: 17px;
          }

          .capture-header h1 {
            font-size: 34px;
          }

          .queue-item {
            grid-template-columns: auto minmax(0, 1fr);
          }

          .queue-status,
          .item-actions {
            grid-column: 2;
            justify-self: start;
          }

          .item-actions {
            width: 100%;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .item-actions > * {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
