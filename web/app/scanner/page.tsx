"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import ScanCardModal from "@/components/ScanCardModal";
import RapidIntakePanel from "@/components/scan/RapidIntakePanel";
import { upsertCardshowInventory } from "@/lib/cardshow/upsertCardshowInventory";
import type {
  ReviewedCardSaveResult,
} from "@/lib/scan/saveIdentifiedCard";
import {
  DEFAULT_RAPID_INTAKE_SETTINGS,
  getRapidIntakeReadinessError,
  prepareRapidIntakeItem,
  readRapidIntakeSettings,
  type RapidIntakeEvent,
  type RapidIntakeSettings,
} from "@/lib/scan/rapidIntake";
import { createClient } from "@/lib/supabase/client";

type CollectionType = "pc" | "inventory";

type CollectionRow = {
  id: string;
  name: string;
  type: CollectionType;
  currency: string;
  created_at: string;
};

type SessionEntry = {
  cardId: string;
  playerName?: string;
  state: "verified" | "needs_review";
  message: string;
  collectionId: string;
  collectionName: string;
  savedAt: string;
  estimatedValue?: number | null;
  inventoryStatus?:
    | "not_requested"
    | "adding"
    | "added"
    | "failed";
  inventoryMessage?: string;
  eventId?: string;
  eventName?: string;
  askingPrice?: number | null;
  floorPrice?: number | null;
  needsPricing?: boolean;
};

type NavigationItem = {
  label: string;
  icon: string;
  href?: string;
  active?: boolean;
  comingSoon?: boolean;
};

const SELECTED_COLLECTION_KEY =
  "necardpilot.scanner.selectedCollectionId";

const CONTINUOUS_MODE_KEY =
  "necardpilot.scanner.continuousMode";

const SESSION_STATE_KEY =
  "necardpilot.scanner.sessionState";

const RAPID_INTAKE_ENABLED_KEY =
  "necardpilot.scanner.rapidIntakeEnabled";

const RAPID_INTAKE_EVENT_KEY =
  "necardpilot.scanner.rapidIntakeEventId";

const RAPID_INTAKE_SETTINGS_KEY =
  "necardpilot.scanner.rapidIntakeSettings";

const AUTO_CONTINUE_DELAY_MS = 2200;

type PersistedScannerSession = {
  startedAt: string | null;
  entries: SessionEntry[];
  finished: boolean;
};

const navigation: NavigationItem[] = [
  { label: "Home", icon: "⌂", href: "/" },
  { label: "Collections", icon: "◇", href: "/#collections" },
  { label: "Cards", icon: "▱", href: "/cards" },
  { label: "Scanner", icon: "◎", active: true },
  { label: "Grading", icon: "◈", comingSoon: true },
  { label: "Transactions", icon: "↕", href: "/transactions" },
  { label: "Analytics", icon: "⌁", href: "/analytics" },
];

function getCollectionTypeLabel(type: CollectionType) {
  return type === "pc"
    ? "Personal Collection"
    : "Dealer Inventory";
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getReadableError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Scanneren kunne ikke indlæses. Prøv igen.";
}

function isSessionEntry(value: unknown): value is SessionEntry {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const entry = value as Record<string, unknown>;
  const inventoryStatuses = new Set([
    "not_requested",
    "adding",
    "added",
    "failed",
  ]);

  return (
    typeof entry.cardId === "string" &&
    (entry.state === "verified" || entry.state === "needs_review") &&
    typeof entry.message === "string" &&
    typeof entry.collectionId === "string" &&
    typeof entry.collectionName === "string" &&
    typeof entry.savedAt === "string" &&
    (entry.playerName === undefined ||
      typeof entry.playerName === "string") &&
    (entry.estimatedValue === undefined ||
      entry.estimatedValue === null ||
      typeof entry.estimatedValue === "number") &&
    (entry.inventoryStatus === undefined ||
      (typeof entry.inventoryStatus === "string" &&
        inventoryStatuses.has(entry.inventoryStatus))) &&
    (entry.inventoryMessage === undefined ||
      typeof entry.inventoryMessage === "string") &&
    (entry.eventId === undefined || typeof entry.eventId === "string") &&
    (entry.eventName === undefined || typeof entry.eventName === "string") &&
    (entry.askingPrice === undefined ||
      entry.askingPrice === null ||
      typeof entry.askingPrice === "number") &&
    (entry.floorPrice === undefined ||
      entry.floorPrice === null ||
      typeof entry.floorPrice === "number") &&
    (entry.needsPricing === undefined ||
      typeof entry.needsPricing === "boolean")
  );
}

function readPersistedSession(): PersistedScannerSession | null {
  try {
    const rawValue = window.sessionStorage.getItem(
      SESSION_STATE_KEY
    );

    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as unknown;

    if (
      typeof parsedValue !== "object" ||
      parsedValue === null ||
      Array.isArray(parsedValue)
    ) {
      return null;
    }

    const session = parsedValue as Record<string, unknown>;
    const entries = Array.isArray(session.entries)
      ? session.entries.filter(isSessionEntry)
      : [];

    return {
      startedAt:
        typeof session.startedAt === "string"
          ? session.startedAt
          : null,
      entries,
      finished: session.finished === true,
    };
  } catch (error) {
    console.error("Scanner session could not be restored:", error);
    return null;
  }
}

export default function ScannerPage() {
  const supabase = useMemo(() => createClient(), []);

  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [cardshowEvents, setCardshowEvents] =
    useState<RapidIntakeEvent[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  const [sessionStartedAt, setSessionStartedAt] =
    useState<string | null>(null);
  const [sessionEntries, setSessionEntries] =
    useState<SessionEntry[]>([]);
  const [lastSaved, setLastSaved] =
    useState<SessionEntry | null>(null);
  const [sessionFinished, setSessionFinished] = useState(false);
  const [continuousMode, setContinuousMode] = useState(false);
  const [autoContinueSeconds, setAutoContinueSeconds] =
    useState<number | null>(null);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [rapidIntakeEnabled, setRapidIntakeEnabled] = useState(false);
  const [selectedCardshowEventId, setSelectedCardshowEventId] =
    useState("");
  const [rapidIntakeSettings, setRapidIntakeSettings] =
    useState<RapidIntakeSettings>(() => ({
      ...DEFAULT_RAPID_INTAKE_SETTINGS,
    }));
  const [rapidIntakeRestored, setRapidIntakeRestored] = useState(false);

  const autoContinueTimeoutRef = useRef<number | null>(null);
  const autoContinueIntervalRef = useRef<number | null>(null);

  const cancelAutoContinue = useCallback(() => {
    if (autoContinueTimeoutRef.current !== null) {
      window.clearTimeout(autoContinueTimeoutRef.current);
      autoContinueTimeoutRef.current = null;
    }

    if (autoContinueIntervalRef.current !== null) {
      window.clearInterval(autoContinueIntervalRef.current);
      autoContinueIntervalRef.current = null;
    }

    setAutoContinueSeconds(null);
  }, []);

  const scheduleAutoContinue = useCallback(() => {
    cancelAutoContinue();

    const startedAt = Date.now();
    setAutoContinueSeconds(
      Math.ceil(AUTO_CONTINUE_DELAY_MS / 1000)
    );

    autoContinueIntervalRef.current = window.setInterval(() => {
      const remainingMilliseconds = Math.max(
        0,
        AUTO_CONTINUE_DELAY_MS - (Date.now() - startedAt)
      );

      setAutoContinueSeconds(
        remainingMilliseconds > 0
          ? Math.ceil(remainingMilliseconds / 1000)
          : null
      );
    }, 200);

    autoContinueTimeoutRef.current = window.setTimeout(() => {
      cancelAutoContinue();
      setLastSaved(null);
      setShowScanner(true);
    }, AUTO_CONTINUE_DELAY_MS);
  }, [cancelAutoContinue]);

  useEffect(() => {
    const storedMode = window.localStorage.getItem(
      CONTINUOUS_MODE_KEY
    );

    setContinuousMode(storedMode === "true");

    const storedSession = readPersistedSession();

    if (storedSession) {
      setSessionStartedAt(storedSession.startedAt);
      setSessionEntries(storedSession.entries);
      setSessionFinished(storedSession.finished);
    }

    setRapidIntakeEnabled(
      window.localStorage.getItem(RAPID_INTAKE_ENABLED_KEY) === "true"
    );
    setSelectedCardshowEventId(
      window.localStorage.getItem(RAPID_INTAKE_EVENT_KEY) ?? ""
    );

    try {
      const storedSettings = window.localStorage.getItem(
        RAPID_INTAKE_SETTINGS_KEY
      );

      setRapidIntakeSettings(
        storedSettings
          ? readRapidIntakeSettings(JSON.parse(storedSettings) as unknown)
          : { ...DEFAULT_RAPID_INTAKE_SETTINGS }
      );
    } catch (error) {
      console.error("Rapid intake settings could not be restored:", error);
      setRapidIntakeSettings({ ...DEFAULT_RAPID_INTAKE_SETTINGS });
    }

    setSessionRestored(true);
    setRapidIntakeRestored(true);
  }, []);

  useEffect(() => {
    if (!rapidIntakeRestored) {
      return;
    }

    window.localStorage.setItem(
      RAPID_INTAKE_ENABLED_KEY,
      String(rapidIntakeEnabled)
    );

    if (selectedCardshowEventId) {
      window.localStorage.setItem(
        RAPID_INTAKE_EVENT_KEY,
        selectedCardshowEventId
      );
    } else {
      window.localStorage.removeItem(RAPID_INTAKE_EVENT_KEY);
    }

    window.localStorage.setItem(
      RAPID_INTAKE_SETTINGS_KEY,
      JSON.stringify(rapidIntakeSettings)
    );
  }, [
    rapidIntakeEnabled,
    rapidIntakeRestored,
    rapidIntakeSettings,
    selectedCardshowEventId,
  ]);

  useEffect(() => {
    if (!sessionRestored) {
      return;
    }

    const persistedSession: PersistedScannerSession = {
      startedAt: sessionStartedAt,
      entries: sessionEntries,
      finished: sessionFinished,
    };

    window.sessionStorage.setItem(
      SESSION_STATE_KEY,
      JSON.stringify(persistedSession)
    );
  }, [
    sessionEntries,
    sessionFinished,
    sessionRestored,
    sessionStartedAt,
  ]);

  useEffect(() => {
    return () => {
      if (autoContinueTimeoutRef.current !== null) {
        window.clearTimeout(autoContinueTimeoutRef.current);
      }

      if (autoContinueIntervalRef.current !== null) {
        window.clearInterval(autoContinueIntervalRef.current);
      }
    };
  }, []);

  const loadCollections = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "Du skal være logget ind for at bruge scanneren."
        );
      }

      const [collectionResult, eventResult] = await Promise.all([
        supabase
          .from("collections")
          .select(`
            id,
            name,
            type,
            currency,
            created_at
          `)
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("cardshow_events")
          .select(`
            id,
            name,
            status,
            currency,
            starts_at
          `)
          .eq("user_id", user.id)
          .in("status", ["planning", "active"])
          .order("starts_at", {
            ascending: true,
            nullsFirst: false,
          }),
      ]);

      if (collectionResult.error) {
        throw new Error(
          `Dine collections kunne ikke indlæses: ${collectionResult.error.message}`
        );
      }

      const nextCollections =
        (collectionResult.data ?? []) as CollectionRow[];

      if (eventResult.error) {
        throw new Error(
          `Dine Cardshows kunne ikke indlæses: ${eventResult.error.message}`
        );
      }

      const nextEvents = (eventResult.data ?? []).map((event) => ({
        id: event.id as string,
        name: event.name as string,
        status: event.status as RapidIntakeEvent["status"],
        currency: event.currency as string,
        startsAt: event.starts_at as string | null,
      }));

      setCollections(nextCollections);
      setCardshowEvents(nextEvents);

      const storedCollectionId =
        window.localStorage.getItem(
          SELECTED_COLLECTION_KEY
        );

      const storedCollectionExists =
        storedCollectionId &&
        nextCollections.some(
          (collection) =>
            collection.id === storedCollectionId
        );

      if (storedCollectionExists) {
        setSelectedCollectionId(storedCollectionId);
      } else if (nextCollections.length === 1) {
        const onlyCollectionId = nextCollections[0]?.id ?? "";
        setSelectedCollectionId(onlyCollectionId);

        if (onlyCollectionId) {
          window.localStorage.setItem(
            SELECTED_COLLECTION_KEY,
            onlyCollectionId
          );
        }
      } else {
        setSelectedCollectionId("");
      }

      const storedEventId = window.localStorage.getItem(
        RAPID_INTAKE_EVENT_KEY
      );

      if (
        storedEventId &&
        nextEvents.some((event) => event.id === storedEventId)
      ) {
        setSelectedCardshowEventId(storedEventId);
      } else if (nextEvents.length === 1) {
        setSelectedCardshowEventId(nextEvents[0]?.id ?? "");
      } else {
        setSelectedCardshowEventId("");
      }
    } catch (error) {
      setCollections([]);
      setCardshowEvents([]);
      setSelectedCollectionId("");
      setErrorMessage(getReadableError(error));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadCollections();
  }, [loadCollections]);

  const selectedCollection = useMemo(
    () =>
      collections.find(
        (collection) =>
          collection.id === selectedCollectionId
      ) ?? null,
    [collections, selectedCollectionId]
  );

  const selectedCardshowEvent = useMemo(
    () =>
      cardshowEvents.find(
        (event) => event.id === selectedCardshowEventId
      ) ?? null,
    [cardshowEvents, selectedCardshowEventId]
  );

  const destinationLocked =
    sessionEntries.length > 0 && !sessionFinished;

  const rapidIntakeReadinessError = getRapidIntakeReadinessError({
    enabled: rapidIntakeEnabled,
    collectionType: selectedCollection?.type ?? null,
    collectionCurrency: selectedCollection?.currency ?? null,
    event: selectedCardshowEvent,
    settings: rapidIntakeSettings,
  });

  const verifiedCount = sessionEntries.filter(
    (entry) => entry.state === "verified"
  ).length;

  const reviewCount = sessionEntries.filter(
    (entry) => entry.state === "needs_review"
  ).length;

  const rapidIntakeAddedCount = sessionEntries.filter(
    (entry) => entry.inventoryStatus === "added"
  ).length;

  const rapidIntakeFailedCount = sessionEntries.filter(
    (entry) => entry.inventoryStatus === "failed"
  ).length;

  function handleSelectCollection(collectionId: string) {
    if (
      destinationLocked &&
      collectionId !== selectedCollectionId
    ) {
      setErrorMessage(
        "Finish the current session before changing its destination collection."
      );
      return;
    }

    setSelectedCollectionId(collectionId);
    setErrorMessage(null);

    if (collectionId) {
      window.localStorage.setItem(
        SELECTED_COLLECTION_KEY,
        collectionId
      );
    } else {
      window.localStorage.removeItem(
        SELECTED_COLLECTION_KEY
      );
    }
  }

  function handleRapidIntakeEnabledChange(enabled: boolean) {
    if (destinationLocked) {
      setErrorMessage(
        "Finish the current session before changing Rapid intake."
      );
      return;
    }

    setRapidIntakeEnabled(enabled);
    setErrorMessage(null);
  }

  function handleCardshowEventChange(eventId: string) {
    if (destinationLocked) {
      setErrorMessage(
        "Finish the current session before changing its Cardshow."
      );
      return;
    }

    setSelectedCardshowEventId(eventId);
    setErrorMessage(null);
  }

  function handleRapidIntakeSettingsChange(
    settings: RapidIntakeSettings
  ) {
    if (destinationLocked) {
      setErrorMessage(
        "Finish the current session before changing Rapid intake pricing."
      );
      return;
    }

    setRapidIntakeSettings(settings);
    setErrorMessage(null);
  }

  function handleContinuousModeChange(enabled: boolean) {
    setContinuousMode(enabled);
    window.localStorage.setItem(
      CONTINUOUS_MODE_KEY,
      String(enabled)
    );

    if (!enabled) {
      cancelAutoContinue();
    }
  }

  function handleStartScanner() {
    cancelAutoContinue();

    if (!selectedCollection) {
      setErrorMessage(
        "Vælg den collection, kortet skal gemmes i."
      );
      return;
    }

    if (rapidIntakeReadinessError) {
      setErrorMessage(rapidIntakeReadinessError);
      return;
    }

    if (sessionFinished) {
      setSessionEntries([]);
      setSessionStartedAt(new Date().toISOString());
      setSessionFinished(false);
    } else if (!sessionStartedAt) {
      setSessionStartedAt(new Date().toISOString());
    }

    setLastSaved(null);
    setErrorMessage(null);
    setShowScanner(true);
  }

  function replaceSessionEntry(nextEntry: SessionEntry) {
    setSessionEntries((currentEntries) =>
      currentEntries.map((entry) =>
        entry.cardId === nextEntry.cardId &&
        entry.savedAt === nextEntry.savedAt
          ? nextEntry
          : entry
      )
    );
  }

  async function addEntryToCardshow(
    entry: SessionEntry,
    event: RapidIntakeEvent
  ): Promise<SessionEntry> {
    const preparedItem = prepareRapidIntakeItem(
      {
        cardId: entry.cardId,
        estimatedValue: entry.estimatedValue ?? null,
      },
      rapidIntakeSettings
    );

    const pendingEntry: SessionEntry = {
      ...entry,
      inventoryStatus: "adding",
      inventoryMessage: `Adding to ${event.name}…`,
      eventId: event.id,
      eventName: event.name,
      askingPrice: preparedItem.askingPrice,
      floorPrice: preparedItem.floorPrice,
      needsPricing: preparedItem.needsPricing,
    };

    replaceSessionEntry(pendingEntry);

    try {
      const inventoryResult = await upsertCardshowInventory({
        eventId: event.id,
        items: [preparedItem.item],
      });

      return {
        ...pendingEntry,
        inventoryStatus: "added",
        inventoryMessage: preparedItem.needsPricing
          ? `${inventoryResult.message} Pricing is still required.`
          : inventoryResult.message,
      };
    } catch (error) {
      return {
        ...pendingEntry,
        inventoryStatus: "failed",
        inventoryMessage:
          error instanceof Error
            ? error.message
            : "Cardshow inventory could not be updated.",
      };
    }
  }

  async function handleCardSaved(
    result: ReviewedCardSaveResult
  ) {
    if (!selectedCollection) {
      return;
    }

    const entry: SessionEntry = {
      cardId: result.cardId,
      playerName: result.playerName,
      state: result.state,
      message: result.message,
      collectionId: selectedCollection.id,
      collectionName: selectedCollection.name,
      savedAt: new Date().toISOString(),
      estimatedValue: result.estimatedValue,
      inventoryStatus: rapidIntakeEnabled ? "adding" : "not_requested",
      inventoryMessage: rapidIntakeEnabled
        ? "Preparing Cardshow inventory…"
        : undefined,
      eventId: rapidIntakeEnabled
        ? selectedCardshowEvent?.id
        : undefined,
      eventName: rapidIntakeEnabled
        ? selectedCardshowEvent?.name
        : undefined,
    };

    setSessionEntries((currentEntries) => [
      entry,
      ...currentEntries,
    ]);

    const completedEntry =
      rapidIntakeEnabled && selectedCardshowEvent
        ? await addEntryToCardshow(entry, selectedCardshowEvent)
        : entry;

    replaceSessionEntry(completedEntry);
    setLastSaved(completedEntry);

    if (
      typeof navigator !== "undefined" &&
      typeof navigator.vibrate === "function"
    ) {
      navigator.vibrate(70);
    }

    if (continuousMode) {
      scheduleAutoContinue();
    }
  }

  async function handleRetryRapidIntake(entry: SessionEntry) {
    const event = cardshowEvents.find(
      (candidate) => candidate.id === entry.eventId
    );

    if (!event) {
      setErrorMessage(
        "The Cardshow is no longer planning or active. Choose a new session."
      );
      return;
    }

    setErrorMessage(null);
    const completedEntry = await addEntryToCardshow(entry, event);
    replaceSessionEntry(completedEntry);

    if (
      lastSaved?.cardId === completedEntry.cardId &&
      lastSaved.savedAt === completedEntry.savedAt
    ) {
      setLastSaved(completedEntry);
    }
  }

  function handleFinishSession() {
    cancelAutoContinue();
    setShowScanner(false);
    setLastSaved(null);
    setSessionFinished(true);
  }

  function handleNewSession() {
    cancelAutoContinue();
    setSessionEntries([]);
    setLastSaved(null);
    setSessionStartedAt(null);
    setSessionFinished(false);
    setErrorMessage(null);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <Link className="brand" href="/">
            <div className="brand-mark">V</div>

            <div>
              <p className="brand-name">Vallective</p>
              <p className="brand-subtitle">Collector Intelligence</p>
            </div>
          </Link>

          <nav className="navigation">
            <p className="navigation-label">Workspace</p>

            {navigation.map((item) => {
              if (item.href) {
                return (
                  <Link
                    className="navigation-item"
                    href={item.href}
                    key={item.label}
                  >
                    <span className="navigation-icon">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                );
              }

              return (
                <button
                  className={`navigation-item ${
                    item.active
                      ? "navigation-item-active"
                      : ""
                  }`}
                  key={item.label}
                  type="button"
                  disabled={
                    item.active || item.comingSoon
                  }
                >
                  <span className="navigation-icon">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>

                  {item.comingSoon && (
                    <span className="coming-soon">Soon</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-footer">
          <button
            className="settings-button"
            type="button"
            disabled
          >
            <span className="navigation-icon">⚙</span>
            Settings
            <span className="coming-soon">Soon</span>
          </button>

          <div className="user-card">
            <div className="user-avatar">NE</div>

            <div className="user-information">
              <p>Nicky Eckhardt</p>
              <span>Owner</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="scanner-header">
          <div>
            <p className="eyebrow">Mobile workspace</p>
            <h1>Global Scanner</h1>
            <p className="scanner-description">
              Choose a collection and optional Cardshow once, photograph both
              sides, review the AI result and continue directly with the next
              card.
            </p>
          </div>

          <div className="header-actions">
            <Link className="secondary-link" href="/cards">
              View all cards
            </Link>

            <button
              className="primary-button"
              type="button"
              onClick={handleStartScanner}
              disabled={
                loading ||
                !selectedCollection ||
                Boolean(rapidIntakeReadinessError)
              }
            >
              <span>◎</span>
              Start scanning
            </button>
          </div>
        </header>

        <section className="scanner-metrics">
          <article>
            <span>Saved this session</span>
            <strong>{sessionEntries.length}</strong>
          </article>

          <article>
            <span>Verified</span>
            <strong>{verifiedCount}</strong>
          </article>

          <article>
            <span>Needs review</span>
            <strong>{reviewCount}</strong>
          </article>

          <article className="destination-metric">
            <span>Destination</span>
            <strong title={selectedCollection?.name}>
              {selectedCollection?.name ?? "Not selected"}
            </strong>
          </article>

          <article>
            <span>Cardshow intake</span>
            <strong>
              {rapidIntakeEnabled
                ? `${rapidIntakeAddedCount} added`
                : "Off"}
            </strong>
          </article>
        </section>

        {errorMessage && (
          <div className="scanner-error" role="alert">
            <span>!</span>
            <div>
              <strong>Scanner unavailable</strong>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        <section className="scanner-layout">
          <div className="scanner-main-column">
            {lastSaved ? (
              <section className="panel success-panel">
                <div className="success-icon">✓</div>

                <div className="success-copy">
                  <p className="eyebrow">Card saved</p>
                  <h2>Ready for the next card</h2>
                  <p>
                    {lastSaved.message} It was saved in
                    <strong> {lastSaved.collectionName}</strong>.
                  </p>

                  <div className="success-badges">
                    <span>
                      {lastSaved.state === "verified"
                        ? "Verified"
                        : "Needs review"}
                    </span>
                    <span>{formatTime(lastSaved.savedAt)}</span>
                    {lastSaved.eventName ? (
                      <span>{lastSaved.eventName}</span>
                    ) : null}
                  </div>

                  {lastSaved.inventoryStatus &&
                  lastSaved.inventoryStatus !== "not_requested" ? (
                    <div
                      className={`inventory-sync inventory-sync-${lastSaved.inventoryStatus}`}
                      data-testid="rapid-intake-result"
                    >
                      <span>
                        {lastSaved.inventoryStatus === "added" ? "✓" : "!"}
                      </span>
                      <div>
                        <strong>
                          {lastSaved.inventoryStatus === "added"
                            ? "Added to Cardshow inventory"
                            : "Card saved · inventory needs retry"}
                        </strong>
                        <p>{lastSaved.inventoryMessage}</p>
                        {lastSaved.inventoryStatus === "added" &&
                        lastSaved.askingPrice !== null &&
                        lastSaved.askingPrice !== undefined ? (
                          <small>
                            Asking {lastSaved.askingPrice.toLocaleString("da-DK")} ·
                            Floor {lastSaved.floorPrice?.toLocaleString("da-DK") ?? "—"}
                          </small>
                        ) : null}
                      </div>

                      {lastSaved.inventoryStatus === "failed" ? (
                        <button
                          data-testid="retry-rapid-intake"
                          onClick={() => void handleRetryRapidIntake(lastSaved)}
                          type="button"
                        >
                          Retry
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {autoContinueSeconds !== null && (
                    <div className="auto-continue-banner">
                      <span className="auto-continue-spinner" />

                      <div>
                        <strong>
                          Next scan opens in {autoContinueSeconds}s
                        </strong>
                        <p>
                          Continuous mode keeps the review step, then
                          prepares a fresh front-and-back capture.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={cancelAutoContinue}
                      >
                        Pause
                      </button>
                    </div>
                  )}
                </div>

                <div className="success-actions">
                  <Link
                    className="secondary-link"
                    href={`/cards/${lastSaved.cardId}`}
                  >
                    View card
                  </Link>

                  <button
                    className="primary-button"
                    type="button"
                    onClick={handleStartScanner}
                  >
                    Scan next card
                  </button>

                  <button
                    className="text-button"
                    type="button"
                    onClick={handleFinishSession}
                  >
                    Finish session
                  </button>
                </div>
              </section>
            ) : sessionFinished && sessionEntries.length > 0 ? (
              <section className="panel finished-panel">
                <p className="eyebrow">Session complete</p>
                <h2>{sessionEntries.length} cards saved</h2>
                <p>
                  {verifiedCount} verified and {reviewCount} marked
                  for manual review.
                </p>

                {rapidIntakeEnabled ? (
                  <p>
                    {rapidIntakeAddedCount} added to Cardshow inventory
                    {rapidIntakeFailedCount > 0
                      ? ` · ${rapidIntakeFailedCount} need retry`
                      : ""}
                    .
                  </p>
                ) : null}

                <div className="finished-actions">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={handleNewSession}
                  >
                    Start new session
                  </button>

                  <Link className="secondary-link" href="/cards">
                    Open card library
                  </Link>
                </div>
              </section>
            ) : (
              <section className="panel start-panel">
                <div className="start-visual">
                  <span>1</span>
                  <div />
                  <span>2</span>
                  <div />
                  <span>3</span>
                </div>

                <div className="start-copy">
                  <p className="eyebrow">Fast capture flow</p>
                  <h2>Front, back, identify, save</h2>
                  <p>
                    The scanner keeps your selected collection for
                    the full session. Phone photos are rotated and
                    compressed locally before upload.
                  </p>
                </div>

                <ol className="workflow-list">
                  <li>
                    <span>1</span>
                    <div>
                      <strong>Capture the front</strong>
                      <p>Use the rear camera and avoid glare.</p>
                    </div>
                  </li>

                  <li>
                    <span>2</span>
                    <div>
                      <strong>Capture the back</strong>
                      <p>Card number and certification data matter.</p>
                    </div>
                  </li>

                  <li>
                    <span>3</span>
                    <div>
                      <strong>Review and save</strong>
                      <p>Correct uncertain fields before continuing.</p>
                    </div>
                  </li>
                </ol>

                <button
                  className="large-start-button"
                  type="button"
                  onClick={handleStartScanner}
                  disabled={
                    loading ||
                    !selectedCollection ||
                    Boolean(rapidIntakeReadinessError)
                  }
                >
                  <span>◎</span>
                  Start scanner
                </button>
              </section>
            )}

            {sessionEntries.length > 0 && (
              <section className="panel session-history-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Current session</p>
                    <h2>Recently saved</h2>
                  </div>

                  {sessionStartedAt && (
                    <span>
                      Started {formatTime(sessionStartedAt)}
                    </span>
                  )}
                </div>

                <div className="session-list">
                  {sessionEntries.slice(0, 8).map((entry, index) => (
                    <article
                      className="session-item"
                      key={`${entry.cardId}-${entry.savedAt}`}
                    >
                      <Link
                        className="session-card-link"
                        href={`/cards/${entry.cardId}`}
                      >
                        <span className="session-number">
                          {sessionEntries.length - index}
                        </span>

                        <div>
                          <strong>
                            {entry.playerName ||
                              (entry.state === "verified"
                                ? "Verified card"
                                : "Card needs review")}
                          </strong>
                          <p>{entry.collectionName}</p>
                        </div>

                        <span className="session-time">
                          {formatTime(entry.savedAt)}
                        </span>

                        <span className="session-arrow">→</span>
                      </Link>

                      {entry.inventoryStatus &&
                      entry.inventoryStatus !== "not_requested" ? (
                        <div
                          className={`session-inventory session-inventory-${entry.inventoryStatus}`}
                        >
                          <span>
                            {entry.inventoryStatus === "added"
                              ? "✓"
                              : entry.inventoryStatus === "adding"
                                ? "…"
                                : "!"}
                          </span>
                          <p>
                            {entry.inventoryStatus === "added"
                              ? `Added to ${entry.eventName}`
                              : entry.inventoryMessage}
                          </p>
                          {entry.inventoryStatus === "failed" ? (
                            <button
                              onClick={() => void handleRetryRapidIntake(entry)}
                              type="button"
                            >
                              Retry
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="scanner-side-column">
            <section className="panel destination-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Destination</p>
                  <h2>Save cards to</h2>
                </div>

                {destinationLocked && (
                  <span className="destination-lock">Locked</span>
                )}
              </div>

              {loading ? (
                <div className="loading-state">
                  <span className="loading-spinner" />
                  <p>Loading collections...</p>
                </div>
              ) : collections.length === 0 ? (
                <div className="empty-state">
                  <strong>No collections yet</strong>
                  <p>Create a collection before starting a scan.</p>
                  <Link href="/#collections">Go to collections</Link>
                </div>
              ) : (
                <div className="destination-options">
                  {collections.map((collection) => {
                    const isSelected =
                      collection.id === selectedCollectionId;

                    return (
                      <label
                        className={`destination-option ${
                          isSelected
                            ? "destination-option-selected"
                            : ""
                        } ${
                          destinationLocked && !isSelected
                            ? "destination-option-locked"
                            : ""
                        }`}
                        key={collection.id}
                      >
                        <input
                          type="radio"
                          name="scanner-collection"
                          value={collection.id}
                          checked={isSelected}
                          disabled={destinationLocked && !isSelected}
                          onChange={() =>
                            handleSelectCollection(collection.id)
                          }
                        />

                        <span
                          className={`destination-icon destination-icon-${collection.type}`}
                        >
                          {collection.type === "pc" ? "♥" : "□"}
                        </span>

                        <span className="destination-copy">
                          <strong>{collection.name}</strong>
                          <small>
                            {getCollectionTypeLabel(collection.type)} ·{" "}
                            {collection.currency}
                          </small>
                        </span>

                        <span className="radio-mark">
                          <span />
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </section>

            <RapidIntakePanel
              collectionCurrency={selectedCollection?.currency ?? null}
              collectionType={selectedCollection?.type ?? null}
              destinationLocked={destinationLocked}
              enabled={rapidIntakeEnabled}
              events={cardshowEvents}
              loading={loading}
              onEnabledChange={handleRapidIntakeEnabledChange}
              onEventChange={handleCardshowEventChange}
              onSettingsChange={handleRapidIntakeSettingsChange}
              readinessError={rapidIntakeReadinessError}
              selectedEvent={selectedCardshowEvent}
              selectedEventId={selectedCardshowEventId}
              settings={rapidIntakeSettings}
            />

            <section className="panel continuous-mode-panel">
              <div className="continuous-mode-copy">
                <p className="eyebrow">Session mode</p>
                <h2>Continuous scanning</h2>
                <p>
                  After each reviewed and saved card, Vallective opens
                  a fresh scanner automatically. The camera itself still
                  requires a tap on iPhone.
                </p>
              </div>

              <button
                className={`mode-switch ${
                  continuousMode ? "mode-switch-active" : ""
                }`}
                type="button"
                role="switch"
                aria-checked={continuousMode}
                onClick={() =>
                  handleContinuousModeChange(!continuousMode)
                }
              >
                <span />
                <strong>{continuousMode ? "On" : "Off"}</strong>
              </button>
            </section>

            <section className="panel mobile-note-panel">
              <span className="note-icon">⌁</span>
              <div>
                <strong>Built for mobile capture</strong>
                <p>
                  Use Take photo on your phone. Choose from library
                  remains available when the browser cannot open the
                  rear camera directly.
                </p>
              </div>
            </section>

            <section className="panel coming-next-panel">
              <p className="eyebrow">Coming next</p>
              <h2>Offline-safe queue</h2>
              <p>
                A later scanner sprint adds retry after network errors,
                identify-only mode and a true offline capture queue.
              </p>
            </section>
          </aside>
        </section>
      </main>

      <div className="mobile-start-bar">
        <div>
          <span>Destination</span>
          <strong>
            {selectedCollection?.name ?? "Choose collection"}
            {continuousMode ? " · Continuous" : ""}
          </strong>
        </div>

        <button
          type="button"
          onClick={handleStartScanner}
          disabled={
            loading ||
            !selectedCollection ||
            Boolean(rapidIntakeReadinessError)
          }
        >
          ◎ Scan card
        </button>
      </div>

      <ScanCardModal
        isOpen={showScanner}
        collectionId={selectedCollectionId}
        onClose={() => setShowScanner(false)}
        onCardSaved={handleCardSaved}
        reloadAfterSave={false}
      />

      <style jsx>{`
        .app-shell {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 248px minmax(0, 1fr);
          background:
            radial-gradient(
              circle at 78% 5%,
              rgba(124, 92, 255, 0.09),
              transparent 30%
            ),
            #080a10;
          color: #f8fafc;
        }

        .sidebar {
          position: sticky;
          top: 0;
          height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 24px 18px;
          border-right: 1px solid rgba(148, 163, 184, 0.11);
          background: rgba(10, 12, 18, 0.96);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 8px;
          color: inherit;
          text-decoration: none;
        }

        .brand-mark {
          width: 39px;
          height: 39px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: linear-gradient(135deg, #8b5cf6, #6957dd);
          color: #ffffff;
          font-weight: 850;
          box-shadow: 0 10px 26px rgba(124, 92, 255, 0.24);
        }

        .brand-name,
        .brand-subtitle,
        .navigation-label,
        .user-information p,
        .user-information span {
          margin: 0;
        }

        .brand-name {
          font-size: 14px;
          font-weight: 800;
        }

        .brand-subtitle {
          margin-top: 3px;
          color: #6f7789;
          font-size: 10px;
        }

        .navigation {
          display: grid;
          gap: 5px;
          margin-top: 37px;
        }

        .navigation-label {
          padding: 0 11px 8px;
          color: #4f5768;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .navigation-item,
        .settings-button {
          min-width: 0;
          min-height: 42px;
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 0 12px;
          border: 0;
          border-radius: 11px;
          background: transparent;
          color: #81899a;
          font: inherit;
          font-size: 12px;
          font-weight: 680;
          text-decoration: none;
          cursor: pointer;
        }

        .navigation-item:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.035);
          color: #ffffff;
        }

        .navigation-item-active {
          background: rgba(124, 92, 255, 0.1);
          color: #d7d1ff;
        }

        .navigation-item:disabled,
        .settings-button:disabled {
          cursor: default;
        }

        .navigation-icon {
          width: 20px;
          display: inline-flex;
          justify-content: center;
          color: #6f7789;
          font-size: 16px;
        }

        .navigation-item-active .navigation-icon {
          color: #9f93ff;
        }

        .coming-soon {
          margin-left: auto;
          padding: 3px 6px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.04);
          color: #555d6d;
          font-size: 7px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .sidebar-footer {
          display: grid;
          gap: 11px;
        }

        .settings-button {
          width: 100%;
        }

        .user-card {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 13px;
          background: rgba(255, 255, 255, 0.02);
        }

        .user-avatar {
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: rgba(124, 92, 255, 0.12);
          color: #c4b5fd;
          font-size: 10px;
          font-weight: 800;
        }

        .user-information {
          min-width: 0;
        }

        .user-information p {
          color: #d9dde6;
          font-size: 11px;
          font-weight: 700;
        }

        .user-information span {
          display: block;
          margin-top: 3px;
          color: #626a7a;
          font-size: 9px;
        }

        .main-content {
          min-width: 0;
          padding: 38px 42px 80px;
        }

        .scanner-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 28px;
          max-width: 1380px;
          margin: 0 auto;
        }

        .eyebrow {
          margin: 0;
          color: #9f93ff;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .scanner-header h1 {
          margin: 10px 0 0;
          color: #ffffff;
          font-size: clamp(38px, 5vw, 62px);
          line-height: 1;
          letter-spacing: -0.055em;
        }

        .scanner-description {
          max-width: 720px;
          margin: 13px 0 0;
          color: #858d9f;
          font-size: 14px;
          line-height: 1.6;
        }

        .header-actions,
        .success-actions,
        .finished-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
        }

        .primary-button,
        .secondary-link,
        .text-button {
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 16px;
          border-radius: 12px;
          font: inherit;
          font-size: 12px;
          font-weight: 750;
          text-decoration: none;
          cursor: pointer;
        }

        .primary-button {
          border: 0;
          background: linear-gradient(135deg, #8b5cf6, #6d5ce7);
          color: #ffffff;
          box-shadow: 0 10px 28px rgba(124, 92, 255, 0.22);
        }

        .primary-button:hover:not(:disabled) {
          filter: brightness(1.08);
        }

        .primary-button:disabled {
          cursor: not-allowed;
          opacity: 0.42;
        }

        .secondary-link {
          border: 1px solid rgba(148, 163, 184, 0.14);
          background: rgba(255, 255, 255, 0.025);
          color: #a5adbd;
        }

        .secondary-link:hover {
          border-color: rgba(167, 139, 250, 0.32);
          color: #ffffff;
        }

        .text-button {
          border: 0;
          background: transparent;
          color: #8e96a8;
        }

        .text-button:hover {
          color: #ffffff;
        }

        .scanner-metrics {
          max-width: 1380px;
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
          margin: 28px auto 0;
        }

        .scanner-metrics article {
          min-width: 0;
          padding: 17px;
          border: 1px solid rgba(148, 163, 184, 0.11);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.022);
        }

        .scanner-metrics span {
          display: block;
          color: #697183;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .scanner-metrics strong {
          display: block;
          overflow: hidden;
          margin-top: 8px;
          color: #ffffff;
          font-size: 21px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .scanner-metrics .destination-metric strong {
          display: -webkit-box;
          overflow-wrap: anywhere;
          font-size: 15px;
          line-height: 1.15;
          white-space: normal;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 3;
        }

        .scanner-error {
          max-width: 1380px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin: 18px auto 0;
          padding: 15px 16px;
          border: 1px solid rgba(248, 113, 113, 0.24);
          border-radius: 15px;
          background: rgba(239, 68, 68, 0.08);
          color: #fecaca;
        }

        .scanner-error > span {
          flex: 0 0 auto;
          width: 25px;
          height: 25px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.08);
          font-weight: 800;
        }

        .scanner-error strong {
          font-size: 13px;
        }

        .scanner-error p {
          margin: 5px 0 0;
          color: #dca9a9;
          font-size: 11px;
        }

        .scanner-layout {
          max-width: 1380px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 350px;
          gap: 22px;
          margin: 22px auto 0;
        }

        .scanner-main-column {
          min-width: 0;
          display: grid;
          align-content: start;
          gap: 18px;
        }

        .auto-continue-banner {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 12px;
          margin-top: 15px;
          padding: 13px 14px;
          border: 1px solid rgba(167, 139, 250, 0.22);
          border-radius: 14px;
          background: rgba(124, 92, 255, 0.07);
        }

        .auto-continue-spinner {
          width: 22px;
          height: 22px;
          border: 2px solid rgba(196, 181, 253, 0.2);
          border-top-color: #c4b5fd;
          border-radius: 50%;
          animation: scanner-spin 700ms linear infinite;
        }

        .auto-continue-banner strong {
          color: #ddd6fe;
          font-size: 11px;
        }

        .auto-continue-banner p {
          margin: 4px 0 0;
          color: #8f86ad;
          font-size: 9px;
          line-height: 1.45;
        }

        .auto-continue-banner button {
          min-height: 34px;
          padding: 0 10px;
          border: 1px solid rgba(167, 139, 250, 0.2);
          border-radius: 9px;
          background: rgba(0, 0, 0, 0.12);
          color: #c4b5fd;
          font: inherit;
          font-size: 9px;
          font-weight: 800;
          cursor: pointer;
        }

        .destination-lock {
          padding: 5px 8px;
          border: 1px solid rgba(251, 191, 36, 0.18);
          border-radius: 999px;
          background: rgba(245, 158, 11, 0.06);
          color: #fde68a;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .destination-option-locked {
          cursor: not-allowed;
          opacity: 0.42;
        }

        .continuous-mode-panel {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 18px;
        }

        .continuous-mode-copy h2 {
          margin: 6px 0 0;
          color: #ffffff;
          font-size: 16px;
        }

        .continuous-mode-copy p:last-child {
          margin: 7px 0 0;
          color: #71798b;
          font-size: 10px;
          line-height: 1.5;
        }

        .mode-switch {
          width: 75px;
          min-height: 38px;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          gap: 7px;
          padding: 4px 8px 4px 4px;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.025);
          color: #71798b;
          font: inherit;
          cursor: pointer;
        }

        .mode-switch > span {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #3b4150;
          transition: transform 160ms ease, background 160ms ease;
        }

        .mode-switch strong {
          font-size: 9px;
          text-transform: uppercase;
        }

        .mode-switch-active {
          border-color: rgba(52, 211, 153, 0.24);
          background: rgba(16, 185, 129, 0.07);
          color: #a7f3d0;
        }

        .mode-switch-active > span {
          background: #34d399;
        }

        .scanner-side-column {
          min-width: 0;
          display: grid;
          align-content: start;
          gap: 18px;
        }

        .panel {
          min-width: 0;
          padding: 24px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 22px;
          background:
            radial-gradient(
              circle at top right,
              rgba(124, 92, 255, 0.055),
              transparent 40%
            ),
            #10131b;
          box-shadow: 0 18px 55px rgba(0, 0, 0, 0.17);
        }

        .panel-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          padding-bottom: 17px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.09);
        }

        .panel-heading h2,
        .start-panel h2,
        .success-panel h2,
        .finished-panel h2,
        .coming-next-panel h2 {
          margin: 7px 0 0;
          color: #ffffff;
          font-size: 21px;
          letter-spacing: -0.025em;
        }

        .panel-heading > span {
          color: #61697a;
          font-size: 9px;
        }

        .start-panel {
          display: grid;
          justify-items: center;
          padding: 38px;
          text-align: center;
        }

        .start-visual {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 22px;
        }

        .start-visual span {
          width: 39px;
          height: 39px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(167, 139, 250, 0.25);
          border-radius: 13px;
          background: rgba(124, 92, 255, 0.08);
          color: #c4b5fd;
          font-size: 12px;
          font-weight: 800;
        }

        .start-visual div {
          width: 44px;
          height: 1px;
          background: linear-gradient(
            90deg,
            rgba(167, 139, 250, 0.35),
            rgba(167, 139, 250, 0.08)
          );
        }

        .start-copy {
          max-width: 650px;
        }

        .start-copy p:last-child,
        .success-copy p:last-child,
        .finished-panel > p,
        .coming-next-panel > p:last-child {
          margin: 9px 0 0;
          color: #7d8698;
          font-size: 12px;
          line-height: 1.6;
        }

        .workflow-list {
          width: min(620px, 100%);
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin: 27px 0 0;
          padding: 0;
          list-style: none;
          text-align: left;
        }

        .workflow-list li {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 14px;
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.12);
        }

        .workflow-list li > span {
          flex: 0 0 auto;
          width: 25px;
          height: 25px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          background: rgba(124, 92, 255, 0.1);
          color: #c4b5fd;
          font-size: 9px;
          font-weight: 800;
        }

        .workflow-list strong {
          color: #d9dde6;
          font-size: 11px;
        }

        .workflow-list p {
          margin: 5px 0 0;
          color: #697183;
          font-size: 9px;
          line-height: 1.45;
        }

        .large-start-button {
          min-height: 52px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          margin-top: 28px;
          padding: 0 24px;
          border: 0;
          border-radius: 14px;
          background: linear-gradient(135deg, #8b5cf6, #6d5ce7);
          color: #ffffff;
          font: inherit;
          font-size: 14px;
          font-weight: 800;
          box-shadow: 0 14px 32px rgba(124, 92, 255, 0.24);
          cursor: pointer;
        }

        .large-start-button:disabled {
          cursor: not-allowed;
          opacity: 0.42;
        }

        .success-panel {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 20px;
          border-color: rgba(52, 211, 153, 0.18);
          background:
            radial-gradient(
              circle at top right,
              rgba(16, 185, 129, 0.09),
              transparent 42%
            ),
            #10131b;
        }

        .success-icon {
          width: 58px;
          height: 58px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(52, 211, 153, 0.24);
          border-radius: 18px;
          background: rgba(16, 185, 129, 0.08);
          color: #86efac;
          font-size: 24px;
          font-weight: 850;
        }

        .success-copy p strong {
          color: #cdd2dc;
        }

        .success-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 12px;
        }

        .success-badges span {
          padding: 6px 9px;
          border-radius: 999px;
          background: rgba(16, 185, 129, 0.07);
          color: #a7f3d0;
          font-size: 9px;
          font-weight: 750;
        }

        .inventory-sync {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 10px;
          margin-top: 14px;
          padding: 12px;
          border: 1px solid rgba(52, 211, 153, 0.18);
          border-radius: 13px;
          background: rgba(16, 185, 129, 0.055);
        }

        .inventory-sync > span {
          width: 27px;
          height: 27px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: rgba(52, 211, 153, 0.1);
          color: #86efac;
          font-size: 11px;
          font-weight: 850;
        }

        .inventory-sync strong {
          color: #d1fae5;
          font-size: 10px;
        }

        .inventory-sync p,
        .inventory-sync small {
          display: block;
          margin: 4px 0 0;
          color: #78a99a;
          font-size: 8px;
          line-height: 1.45;
        }

        .inventory-sync-failed {
          border-color: rgba(248, 113, 113, 0.22);
          background: rgba(239, 68, 68, 0.065);
        }

        .inventory-sync-failed > span {
          background: rgba(248, 113, 113, 0.11);
          color: #fca5a5;
        }

        .inventory-sync-failed strong {
          color: #fecaca;
        }

        .inventory-sync-failed p {
          color: #d69b9b;
        }

        .inventory-sync button,
        .session-inventory button {
          min-height: 31px;
          padding: 0 9px;
          border: 1px solid rgba(248, 113, 113, 0.24);
          border-radius: 8px;
          background: rgba(239, 68, 68, 0.08);
          color: #fecaca;
          font: inherit;
          font-size: 8px;
          font-weight: 800;
          cursor: pointer;
        }

        .success-actions {
          justify-content: flex-end;
        }

        .finished-panel {
          padding: 34px;
          text-align: center;
        }

        .finished-actions {
          justify-content: center;
          margin-top: 22px;
        }

        .session-list {
          display: grid;
          gap: 8px;
          padding-top: 16px;
        }

        .session-item {
          min-width: 0;
          border: 1px solid rgba(148, 163, 184, 0.09);
          border-radius: 13px;
          background: rgba(0, 0, 0, 0.11);
          overflow: hidden;
        }

        .session-item:hover {
          border-color: rgba(167, 139, 250, 0.26);
          background: rgba(124, 92, 255, 0.045);
        }

        .session-card-link {
          min-width: 0;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto auto;
          align-items: center;
          gap: 12px;
          padding: 12px 13px;
          color: inherit;
          text-decoration: none;
        }

        .session-number {
          width: 29px;
          height: 29px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: rgba(124, 92, 255, 0.09);
          color: #c4b5fd;
          font-size: 9px;
          font-weight: 800;
        }

        .session-card-link strong {
          color: #d7dbe4;
          font-size: 11px;
        }

        .session-card-link p {
          margin: 4px 0 0;
          color: #697183;
          font-size: 9px;
        }

        .session-time {
          color: #61697a;
          font-size: 9px;
        }

        .session-arrow {
          color: #9f93ff;
        }

        .session-inventory {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-top: 1px solid rgba(148, 163, 184, 0.07);
          background: rgba(20, 184, 166, 0.03);
          color: #79cbbb;
        }

        .session-inventory > span {
          font-size: 9px;
          font-weight: 850;
        }

        .session-inventory p {
          margin: 0;
          color: inherit;
          font-size: 8px;
          line-height: 1.4;
        }

        .session-inventory-failed {
          background: rgba(239, 68, 68, 0.045);
          color: #e5a5a5;
        }

        .session-inventory-adding {
          color: #c4b5fd;
        }

        .destination-options {
          display: grid;
          gap: 9px;
          padding-top: 16px;
        }

        .destination-option {
          position: relative;
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 13px;
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.11);
          cursor: pointer;
        }

        .destination-option:hover {
          border-color: rgba(167, 139, 250, 0.28);
        }

        .destination-option-selected {
          border-color: rgba(139, 92, 246, 0.56);
          background: rgba(124, 92, 255, 0.075);
          box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.045);
        }

        .destination-option input {
          position: absolute;
          width: 1px;
          height: 1px;
          opacity: 0;
          pointer-events: none;
        }

        .destination-icon {
          flex: 0 0 auto;
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          font-size: 14px;
        }

        .destination-icon-pc {
          background: rgba(244, 114, 182, 0.08);
          color: #f9a8d4;
        }

        .destination-icon-inventory {
          background: rgba(59, 130, 246, 0.08);
          color: #bfdbfe;
        }

        .destination-copy {
          min-width: 0;
          flex: 1;
        }

        .destination-copy strong,
        .destination-copy small {
          display: block;
        }

        .destination-copy strong {
          overflow: hidden;
          color: #d9dde6;
          font-size: 11px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .destination-copy small {
          margin-top: 4px;
          color: #697183;
          font-size: 8px;
        }

        .radio-mark {
          flex: 0 0 auto;
          width: 19px;
          height: 19px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(148, 163, 184, 0.27);
          border-radius: 50%;
        }

        .radio-mark span {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: transparent;
        }

        .destination-option-selected .radio-mark {
          border-color: #9f93ff;
        }

        .destination-option-selected .radio-mark span {
          background: #8b5cf6;
          box-shadow: 0 0 10px rgba(139, 92, 246, 0.65);
        }

        .loading-state,
        .empty-state {
          min-height: 150px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 20px;
          text-align: center;
        }

        .loading-spinner {
          width: 25px;
          height: 25px;
          border: 2px solid rgba(167, 139, 250, 0.16);
          border-top-color: #a78bfa;
          border-radius: 50%;
          animation: scanner-spin 700ms linear infinite;
        }

        .loading-state p,
        .empty-state p {
          margin: 0;
          color: #697183;
          font-size: 10px;
        }

        .empty-state strong {
          color: #d9dde6;
          font-size: 12px;
        }

        .empty-state a {
          color: #c4b5fd;
          font-size: 10px;
        }

        .mobile-note-panel {
          display: flex;
          align-items: flex-start;
          gap: 13px;
        }

        .note-icon {
          flex: 0 0 auto;
          width: 33px;
          height: 33px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          background: rgba(59, 130, 246, 0.07);
          color: #93c5fd;
        }

        .mobile-note-panel strong {
          color: #d9dde6;
          font-size: 11px;
        }

        .mobile-note-panel p,
        .coming-next-panel p:last-child {
          margin: 6px 0 0;
          color: #697183;
          font-size: 9px;
          line-height: 1.55;
        }

        .mobile-start-bar {
          display: none;
        }

        @keyframes scanner-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1050px) {
          .app-shell {
            grid-template-columns: 1fr;
          }

          .sidebar {
            position: sticky;
            top: 0;
            z-index: 50;
            width: 100%;
            height: auto;
            display: block;
            padding: 12px 16px;
            border-right: 0;
            border-bottom: 1px solid rgba(148, 163, 184, 0.11);
          }

          .sidebar > div:first-child {
            display: flex;
            align-items: center;
            gap: 18px;
          }

          .brand {
            flex: 0 0 auto;
            padding: 0;
          }

          .brand > div:last-child,
          .sidebar-footer,
          .navigation-label,
          .navigation-item > span:nth-child(2),
          .coming-soon {
            display: none;
          }

          .navigation {
            display: flex;
            gap: 4px;
            margin: 0 0 0 auto;
            overflow-x: auto;
          }

          .navigation-item {
            width: 40px;
            min-height: 40px;
            justify-content: center;
            padding: 0;
          }

          .navigation-icon {
            width: auto;
          }

          .main-content {
            padding: 30px 24px 100px;
          }

          .scanner-layout {
            grid-template-columns: 1fr;
          }

          .scanner-side-column {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .destination-panel {
            grid-column: 1 / -1;
          }

          :global(.rapid-intake-panel) {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 760px) {
          .scanner-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .header-actions {
            display: none;
          }

          .scanner-header h1 {
            font-size: 42px;
          }

          .scanner-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .inventory-sync {
            grid-template-columns: auto minmax(0, 1fr);
          }

          .inventory-sync button {
            grid-column: 1 / -1;
            width: 100%;
          }

          .scanner-layout {
            margin-top: 16px;
          }

          .scanner-side-column {
            grid-template-columns: 1fr;
          }

          .success-panel {
            grid-template-columns: 1fr;
            justify-items: start;
          }

          .success-actions {
            width: 100%;
            display: grid;
            grid-template-columns: 1fr 1fr;
            justify-content: stretch;
          }

          .success-actions .text-button {
            grid-column: 1 / -1;
          }

          .workflow-list {
            grid-template-columns: 1fr;
          }

          .start-visual div {
            width: 27px;
          }

          .auto-continue-banner {
            grid-template-columns: auto minmax(0, 1fr);
          }

          .auto-continue-banner button {
            grid-column: 1 / -1;
            width: 100%;
          }

          .continuous-mode-panel {
            grid-template-columns: 1fr;
          }

          .mode-switch {
            width: 100%;
            grid-template-columns: auto minmax(0, 1fr);
          }

          .mobile-start-bar {
            position: fixed;
            right: 0;
            bottom: 0;
            left: 0;
            z-index: 60;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding:
              12px
              max(14px, env(safe-area-inset-right))
              max(12px, env(safe-area-inset-bottom))
              max(14px, env(safe-area-inset-left));
            border-top: 1px solid rgba(148, 163, 184, 0.12);
            background: rgba(10, 12, 18, 0.96);
            backdrop-filter: blur(18px);
          }

          .mobile-start-bar > div {
            min-width: 0;
          }

          .mobile-start-bar span,
          .mobile-start-bar strong {
            display: block;
          }

          .mobile-start-bar span {
            color: #61697a;
            font-size: 8px;
            font-weight: 800;
            text-transform: uppercase;
          }

          .mobile-start-bar strong {
            overflow: hidden;
            margin-top: 3px;
            color: #d9dde6;
            font-size: 10px;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .mobile-start-bar button {
            flex: 0 0 auto;
            min-height: 44px;
            padding: 0 15px;
            border: 0;
            border-radius: 12px;
            background: linear-gradient(135deg, #8b5cf6, #6d5ce7);
            color: #ffffff;
            font: inherit;
            font-size: 11px;
            font-weight: 800;
          }

          .mobile-start-bar button:disabled {
            opacity: 0.42;
          }
        }

        @media (max-width: 520px) {
          .sidebar {
            padding: 10px 12px;
          }

          .brand-mark {
            width: 36px;
            height: 36px;
          }

          .main-content {
            padding: 24px 14px 105px;
          }

          .scanner-header h1 {
            font-size: 37px;
          }

          .scanner-description {
            font-size: 12px;
          }

          .scanner-metrics article,
          .panel {
            padding: 17px;
          }

          .scanner-metrics strong {
            font-size: 17px;
          }

          .start-panel {
            padding: 27px 17px;
          }

          .success-actions,
          .finished-actions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .success-actions .text-button {
            grid-column: auto;
          }

          .session-card-link {
            grid-template-columns: auto minmax(0, 1fr) auto;
          }

          .session-time {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
