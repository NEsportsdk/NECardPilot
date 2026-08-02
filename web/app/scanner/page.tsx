"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import ScanCardModal from "@/components/ScanCardModal";
import type {
  SaveIdentifiedCardResult,
} from "@/lib/scan/saveIdentifiedCard";
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
  state: "verified" | "needs_review";
  message: string;
  collectionId: string;
  collectionName: string;
  savedAt: string;
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

export default function ScannerPage() {
  const supabase = useMemo(() => createClient(), []);

  const [collections, setCollections] = useState<CollectionRow[]>([]);
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

      const { data, error } = await supabase
        .from("collections")
        .select(`
          id,
          name,
          type,
          currency,
          created_at
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) {
        throw new Error(
          `Dine collections kunne ikke indlæses: ${error.message}`
        );
      }

      const nextCollections =
        (data ?? []) as CollectionRow[];

      setCollections(nextCollections);

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
    } catch (error) {
      setCollections([]);
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

  const verifiedCount = sessionEntries.filter(
    (entry) => entry.state === "verified"
  ).length;

  const reviewCount = sessionEntries.filter(
    (entry) => entry.state === "needs_review"
  ).length;

  function handleSelectCollection(collectionId: string) {
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

  function handleStartScanner() {
    if (!selectedCollection) {
      setErrorMessage(
        "Vælg den collection, kortet skal gemmes i."
      );
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

  function handleCardSaved(
    result: SaveIdentifiedCardResult
  ) {
    if (!selectedCollection) {
      return;
    }

    const entry: SessionEntry = {
      cardId: result.cardId,
      state: result.state,
      message: result.message,
      collectionId: selectedCollection.id,
      collectionName: selectedCollection.name,
      savedAt: new Date().toISOString(),
    };

    setSessionEntries((currentEntries) => [
      entry,
      ...currentEntries,
    ]);
    setLastSaved(entry);
  }

  function handleFinishSession() {
    setShowScanner(false);
    setLastSaved(null);
    setSessionFinished(true);
  }

  function handleNewSession() {
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
            <div className="brand-mark">N</div>

            <div>
              <p className="brand-name">NECardPilot</p>
              <p className="brand-subtitle">Collectibles OS</p>
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
              Choose a destination once, photograph both sides,
              review the AI result and continue directly with the
              next card.
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
              disabled={loading || !selectedCollection}
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

          <article>
            <span>Destination</span>
            <strong>
              {selectedCollection?.name ?? "Not selected"}
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
                  </div>
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
                  disabled={loading || !selectedCollection}
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
                    <Link
                      href={`/cards/${entry.cardId}`}
                      className="session-item"
                      key={`${entry.cardId}-${entry.savedAt}`}
                    >
                      <span className="session-number">
                        {sessionEntries.length - index}
                      </span>

                      <div>
                        <strong>
                          {entry.state === "verified"
                            ? "Verified card"
                            : "Card needs review"}
                        </strong>
                        <p>{entry.collectionName}</p>
                      </div>

                      <span className="session-time">
                        {formatTime(entry.savedAt)}
                      </span>

                      <span className="session-arrow">→</span>
                    </Link>
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
                        }`}
                        key={collection.id}
                      >
                        <input
                          type="radio"
                          name="scanner-collection"
                          value={collection.id}
                          checked={isSelected}
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
              <h2>Scanner queue</h2>
              <p>
                The next scanner sprint adds queued cards, retry after
                network errors and identify-only mode for card shows.
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
          </strong>
        </div>

        <button
          type="button"
          onClick={handleStartScanner}
          disabled={loading || !selectedCollection}
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
          grid-template-columns: repeat(4, minmax(0, 1fr));
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

        .scanner-main-column,
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
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto auto;
          align-items: center;
          gap: 12px;
          padding: 12px 13px;
          border: 1px solid rgba(148, 163, 184, 0.09);
          border-radius: 13px;
          background: rgba(0, 0, 0, 0.11);
          color: inherit;
          text-decoration: none;
        }

        .session-item:hover {
          border-color: rgba(167, 139, 250, 0.26);
          background: rgba(124, 92, 255, 0.045);
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

        .session-item strong {
          color: #d7dbe4;
          font-size: 11px;
        }

        .session-item p {
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

          .session-item {
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