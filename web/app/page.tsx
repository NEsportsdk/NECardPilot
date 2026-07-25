"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AddCardModal from "@/components/AddCardModal";

type Collection = {
  id: string;
  name: string;
  type: "pc" | "inventory";
  currency: string;
  created_at: string;
};

type NavigationItem = {
  label: string;
  icon: string;
  active?: boolean;
  comingSoon?: boolean;
};

const navigation: NavigationItem[] = [
  { label: "Home", icon: "⌂", active: true },
  { label: "Collections", icon: "◇" },
  { label: "Cards", icon: "▱", comingSoon: true },
  { label: "Scanner", icon: "◎", comingSoon: true },
  { label: "Grading", icon: "◈", comingSoon: true },
  { label: "Transactions", icon: "↕", comingSoon: true },
  { label: "Analytics", icon: "⌁", comingSoon: true },
];

export default function HomePage() {
  const router = useRouter();
  const supabase = createClient();

  const [collections, setCollections] = useState<Collection[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<"pc" | "inventory">("pc");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);

  async function loadCollections() {
    setLoading(true);

    const { data, error } = await supabase
      .from("collections")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      setMessage(`Fejl: ${error.message}`);
      setCollections([]);
    } else {
      setCollections(data ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadCollections();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setMessage("Skriv et navn på samlingen.");
      return;
    }

    setSaving(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("Du er ikke logget ind.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("collections").insert({
      user_id: user.id,
      name: name.trim(),
      type,
      currency: "DKK",
    });

    if (error) {
      setMessage(`Fejl: ${error.message}`);
      setSaving(false);
      return;
    }

    setName("");
    setType("pc");
    setMessage("Samlingen er oprettet.");
    setSaving(false);
    setShowCreateCollection(false);

    await loadCollections();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function handleScanCard() {
    setShowAddCard(false);

    window.alert(
      "Scan-flowet er klar til næste trin: upload af kortets forside og bagside."
    );
  }

  function handleManualCard(collectionId: string) {
    setShowAddCard(false);
    router.push(`/collections/${collectionId}`);
  }

  const personalCollections = collections.filter(
    (collection) => collection.type === "pc"
  );

  const inventoryCollections = collections.filter(
    (collection) => collection.type === "inventory"
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand">
            <div className="brand-mark">N</div>

            <div>
              <p className="brand-name">NECardPilot</p>
              <p className="brand-subtitle">Collectibles OS</p>
            </div>
          </div>

          <nav className="navigation">
            <p className="navigation-label">Workspace</p>

            {navigation.map((item) => (
              <button
                className={`navigation-item ${
                  item.active ? "navigation-item-active" : ""
                }`}
                key={item.label}
                type="button"
                disabled={!item.active}
              >
                <span className="navigation-icon">{item.icon}</span>
                <span>{item.label}</span>

                {item.comingSoon && (
                  <span className="coming-soon">Soon</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <button className="settings-button" type="button">
            <span className="navigation-icon">⚙</span>
            Settings
          </button>

          <div className="user-card">
            <div className="user-avatar">NE</div>

            <div className="user-information">
              <p>Nicky Eckhardt</p>
              <span>Owner</span>
            </div>

            <button
              className="logout-button"
              type="button"
              onClick={handleLogout}
              title="Log ud"
            >
              ↗
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Command center</p>
            <h1>God aften, Nicky</h1>

            <p className="topbar-description">
              Her får du det samlede overblik over dine collectibles.
            </p>
          </div>

          <div className="topbar-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => setShowAddCard(true)}
            >
              <span>◎</span>
              Add card
            </button>

            <button
              className="primary-button"
              type="button"
              onClick={() => {
                setMessage("");
                setShowCreateCollection(true);
              }}
            >
              <span>＋</span>
              New collection
            </button>
          </div>
        </header>

        <section className="metrics-grid">
          <article className="metric-card metric-card-featured">
            <div className="metric-card-header">
              <span className="metric-label">Total portfolio value</span>
              <span className="metric-icon">◇</span>
            </div>

            <p className="metric-value">0 kr.</p>

            <div className="metric-change metric-change-neutral">
              Markedsdata tilføjes senere
            </div>
          </article>

          <article className="metric-card">
            <div className="metric-card-header">
              <span className="metric-label">Personal collection</span>
              <span className="metric-icon">♥</span>
            </div>

            <p className="metric-value">{personalCollections.length}</p>
            <p className="metric-caption">aktive samlinger</p>
          </article>

          <article className="metric-card">
            <div className="metric-card-header">
              <span className="metric-label">Dealer inventory</span>
              <span className="metric-icon">□</span>
            </div>

            <p className="metric-value">{inventoryCollections.length}</p>
            <p className="metric-caption">aktive lagre</p>
          </article>

          <article className="metric-card">
            <div className="metric-card-header">
              <span className="metric-label">Cards in grading</span>
              <span className="metric-icon">◈</span>
            </div>

            <p className="metric-value">0</p>
            <p className="metric-caption">ingen aktive submissions</p>
          </article>
        </section>

        <section className="dashboard-grid">
          <div className="dashboard-main-column">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Portfolio</p>
                  <h2>Your collections</h2>
                </div>

                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    setMessage("");
                    setShowCreateCollection(true);
                  }}
                >
                  Add collection
                  <span>→</span>
                </button>
              </div>

              {loading && (
                <div className="empty-state">
                  <div className="loading-indicator" />
                  <p>Indlæser dine samlinger...</p>
                </div>
              )}

              {!loading && collections.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state-icon">◇</div>
                  <h3>Start din første collection</h3>

                  <p>
                    Opret en Personal Collection eller et Dealer Inventory.
                  </p>

                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => setShowCreateCollection(true)}
                  >
                    <span>＋</span>
                    New collection
                  </button>
                </div>
              )}

              {!loading && collections.length > 0 && (
                <div className="collection-grid">
                  {collections.map((collection) => (
                    <article className="collection-card" key={collection.id}>
                      <div
                        className={`collection-symbol ${
                          collection.type === "pc"
                            ? "collection-symbol-pc"
                            : "collection-symbol-inventory"
                        }`}
                      >
                        {collection.type === "pc" ? "♥" : "□"}
                      </div>

                      <div className="collection-card-content">
                        <div className="collection-card-heading">
                          <div>
                            <p className="collection-type">
                              {collection.type === "pc"
                                ? "Personal Collection"
                                : "Dealer Inventory"}
                            </p>

                            <h3>{collection.name}</h3>
                          </div>

                          <button
                            className="collection-menu"
                            type="button"
                            title="Flere muligheder"
                          >
                            ···
                          </button>
                        </div>

                        <div className="collection-statistics">
                          <div>
                            <span>Cards</span>
                            <strong>0</strong>
                          </div>

                          <div>
                            <span>Value</span>
                            <strong>0 kr.</strong>
                          </div>
                        </div>

                        <button
                          className="collection-open-button"
                          type="button"
                          onClick={() =>
                            router.push(`/collections/${collection.id}`)
                          }
                        >
                          Open collection
                          <span>→</span>
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="dashboard-side-column">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Actions</p>
                  <h2>Quick actions</h2>
                </div>
              </div>

              <div className="quick-actions">
                <button
                  className="quick-action"
                  type="button"
                  onClick={() => setShowAddCard(true)}
                >
                  <span className="quick-action-icon">◎</span>

                  <span>
                    <strong>Scan card</strong>
                    <small>AI identification</small>
                  </span>

                  <span className="quick-action-arrow">→</span>
                </button>

                <button
                  className="quick-action"
                  type="button"
                  onClick={() => setShowAddCard(true)}
                >
                  <span className="quick-action-icon">＋</span>

                  <span>
                    <strong>Add card manually</strong>
                    <small>Create a new card</small>
                  </span>

                  <span className="quick-action-arrow">→</span>
                </button>

                <button className="quick-action" type="button" disabled>
                  <span className="quick-action-icon">◈</span>

                  <span>
                    <strong>New grading order</strong>
                    <small>PSA, BGS or SGC</small>
                  </span>

                  <span className="quick-action-arrow">→</span>
                </button>

                <button className="quick-action" type="button" disabled>
                  <span className="quick-action-icon">↕</span>

                  <span>
                    <strong>Record transaction</strong>
                    <small>Purchase or sale</small>
                  </span>

                  <span className="quick-action-arrow">→</span>
                </button>
              </div>
            </section>

            <section className="panel activity-panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Latest</p>
                  <h2>Recent activity</h2>
                </div>
              </div>

              <div className="activity-item">
                <div className="activity-dot" />

                <div>
                  <strong>NECardPilot is ready</strong>
                  <p>Your first workspace has been created.</p>
                  <span>Today</span>
                </div>
              </div>
            </section>
          </aside>
        </section>
      </main>

      {showAddCard && (
        <AddCardModal
          collections={collections}
          onClose={() => setShowAddCard(false)}
          onScanCard={handleScanCard}
          onManualCard={handleManualCard}
        />
      )}

      {showCreateCollection && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowCreateCollection(false);
            }
          }}
        >
          <section className="modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">New collection</p>
                <h2>Create collection</h2>
              </div>

              <button
                className="modal-close-button"
                type="button"
                onClick={() => setShowCreateCollection(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <label className="field-label" htmlFor="collection-name">
                Collection name
              </label>

              <input
                className="text-input"
                id="collection-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Example: Nicky PC"
                autoFocus
              />

              <fieldset className="collection-type-selector">
                <legend>Collection type</legend>

                <label
                  className={`type-option ${
                    type === "pc" ? "type-option-selected" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="collection-type"
                    value="pc"
                    checked={type === "pc"}
                    onChange={() => setType("pc")}
                  />

                  <span className="type-option-icon">♥</span>

                  <span>
                    <strong>Personal Collection</strong>
                    <small>Cards you collect and intend to keep</small>
                  </span>
                </label>

                <label
                  className={`type-option ${
                    type === "inventory" ? "type-option-selected" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="collection-type"
                    value="inventory"
                    checked={type === "inventory"}
                    onChange={() => setType("inventory")}
                  />

                  <span className="type-option-icon">□</span>

                  <span>
                    <strong>Dealer Inventory</strong>
                    <small>Cards held for resale or business purposes</small>
                  </span>
                </label>
              </fieldset>

              {message && <p className="form-message">{message}</p>}

              <div className="modal-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setShowCreateCollection(false)}
                >
                  Cancel
                </button>

                <button
                  className="primary-button"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Creating..." : "Create collection"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}