"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AddCardModal from "@/components/AddCardModal";
import ScanCardModal from "@/components/ScanCardModal";

type Collection = {
  id: string;
  name: string;
  type: "pc" | "inventory";
  currency: string;
  created_at: string;
};

type Card = {
  id: string;
  player_name: string;
  year: string | null;
  manufacturer: string | null;
  set_name: string | null;
  card_number: string | null;
  parallel_name: string | null;
  serial_number: string | null;
  purchase_price: number | null;
  estimated_value: number | null;
  created_at: string;
};

export default function CollectionPage() {
  const params = useParams();
  const collectionId = params.id as string;
  const supabase = createClient();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [showAddCardChoice, setShowAddCardChoice] = useState(false);
  const [showScanCard, setShowScanCard] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);

  const [playerName, setPlayerName] = useState("");
  const [year, setYear] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [setName, setSetName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [parallelName, setParallelName] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [notes, setNotes] = useState("");

  async function loadCollection() {
    setLoading(true);
    setMessage("");

    const { data: collectionData, error: collectionError } = await supabase
      .from("collections")
      .select("*")
      .eq("id", collectionId)
      .single();

    if (collectionError) {
      setMessage(`Kunne ikke hente samlingen: ${collectionError.message}`);
      setLoading(false);
      return;
    }

    const { data: cardData, error: cardError } = await supabase
      .from("cards")
      .select("*")
      .eq("current_collection_id", collectionId)
      .order("created_at", { ascending: false });

    if (cardError) {
      setMessage(`Kunne ikke hente kortene: ${cardError.message}`);
      setLoading(false);
      return;
    }

    setCollection(collectionData);
    setCards(cardData ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (collectionId) {
      loadCollection();
    }
  }, [collectionId]);

  function resetForm() {
    setPlayerName("");
    setYear("");
    setManufacturer("");
    setSetName("");
    setCardNumber("");
    setParallelName("");
    setSerialNumber("");
    setPurchasePrice("");
    setEstimatedValue("");
    setNotes("");
  }

  function parseOptionalNumber(value: string) {
    if (!value.trim()) {
      return null;
    }

    const normalizedValue = value.replace(",", ".");
    const parsedValue = Number(normalizedValue);

    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  function handleScanCard() {
    setShowAddCardChoice(false);
    setMessage("");
    setShowScanCard(true);
  }

  function handleManualCard() {
    setShowAddCardChoice(false);
    setMessage("");
    setShowAddCard(true);
  }

  async function handleAddCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!playerName.trim()) {
      setMessage("Spillernavn er obligatorisk.");
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

    const { error } = await supabase.from("cards").insert({
      user_id: user.id,
      current_collection_id: collectionId,
      player_name: playerName.trim(),
      year: year.trim() || null,
      manufacturer: manufacturer.trim() || null,
      set_name: setName.trim() || null,
      card_number: cardNumber.trim() || null,
      parallel_name: parallelName.trim() || null,
      serial_number: serialNumber.trim() || null,
      purchase_price: parseOptionalNumber(purchasePrice),
      estimated_value: parseOptionalNumber(estimatedValue),
      notes: notes.trim() || null,
    });

    if (error) {
      setMessage(`Kortet kunne ikke gemmes: ${error.message}`);
      setSaving(false);
      return;
    }

    resetForm();
    setShowAddCard(false);
    setMessage("Kortet er tilføjet.");
    setSaving(false);

    await loadCollection();
  }

  const totalPurchasePrice = cards.reduce(
    (total, card) => total + Number(card.purchase_price ?? 0),
    0
  );

  const totalEstimatedValue = cards.reduce(
    (total, card) => total + Number(card.estimated_value ?? 0),
    0
  );

  if (loading) {
    return (
      <main className="collection-page">
        <div className="collection-loading">
          <div className="loading-indicator" />
          <p>Indlæser collection...</p>
        </div>
      </main>
    );
  }

  if (!collection) {
    return (
      <main className="collection-page">
        <Link className="back-link" href="/">
          ← Tilbage til Home
        </Link>

        <section className="panel collection-error-panel">
          <h1>Collection blev ikke fundet</h1>
          <p>{message}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="collection-page">
      <header className="collection-page-header">
        <div>
          <Link className="back-link" href="/">
            ← Tilbage til Home
          </Link>

          <p className="eyebrow">
            {collection.type === "pc"
              ? "Personal Collection"
              : "Dealer Inventory"}
          </p>

          <h1>{collection.name}</h1>

          <p className="collection-page-description">
            {cards.length} {cards.length === 1 ? "card" : "cards"} ·{" "}
            {totalEstimatedValue.toLocaleString("da-DK")} kr.
          </p>
        </div>

        <div className="topbar-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              setMessage("");
              setShowAddCardChoice(true);
            }}
          >
            ◎ Scan card
          </button>

          <button
            className="primary-button"
            type="button"
            onClick={() => {
              setMessage("");
              setShowAddCard(true);
            }}
          >
            ＋ Add card
          </button>
        </div>
      </header>

      <section className="collection-summary-grid">
        <article className="metric-card">
          <div className="metric-card-header">
            <span className="metric-label">Cards</span>
            <span className="metric-icon">▱</span>
          </div>

          <p className="metric-value">{cards.length}</p>
          <p className="metric-caption">registreret i collection</p>
        </article>

        <article className="metric-card">
          <div className="metric-card-header">
            <span className="metric-label">Total cost</span>
            <span className="metric-icon">↘</span>
          </div>

          <p className="metric-value">
            {totalPurchasePrice.toLocaleString("da-DK")} kr.
          </p>

          <p className="metric-caption">samlet købspris</p>
        </article>

        <article className="metric-card metric-card-featured">
          <div className="metric-card-header">
            <span className="metric-label">Estimated value</span>
            <span className="metric-icon">◇</span>
          </div>

          <p className="metric-value">
            {totalEstimatedValue.toLocaleString("da-DK")} kr.
          </p>

          <p className="metric-caption">brugerangivet værdi</p>
        </article>

        <article className="metric-card">
          <div className="metric-card-header">
            <span className="metric-label">Unrealized result</span>
            <span className="metric-icon">⌁</span>
          </div>

          <p className="metric-value">
            {(totalEstimatedValue - totalPurchasePrice).toLocaleString("da-DK")}{" "}
            kr.
          </p>

          <p className="metric-caption">estimeret værdiforskel</p>
        </article>
      </section>

      {message && <p className="collection-status-message">{message}</p>}

      <section className="panel cards-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Inventory</p>
            <h2>Cards</h2>
          </div>

          <div className="card-view-actions">
            <button
              className="small-view-button small-view-button-active"
              type="button"
            >
              Grid
            </button>

            <button className="small-view-button" type="button" disabled>
              List
            </button>
          </div>
        </div>

        {cards.length === 0 ? (
          <div className="empty-state collection-empty-state">
            <div className="empty-state-icon">▱</div>
            <h3>Der er endnu ingen kort</h3>

            <p>
              Tilføj dit første kort manuelt, eller scan det med AI-workflowet.
            </p>

            <button
              className="primary-button"
              type="button"
              onClick={() => setShowAddCardChoice(true)}
            >
              ＋ Add first card
            </button>
          </div>
        ) : (
          <div className="cards-grid">
            {cards.map((card) => (
              <article className="sports-card-item" key={card.id}>
                <div className="sports-card-image-placeholder">
                  <span>NE</span>
                  <small>Image coming soon</small>
                </div>

                <div className="sports-card-content">
                  <p className="sports-card-set">
                    {[card.year, card.manufacturer, card.set_name]
                      .filter(Boolean)
                      .join(" · ") || "Set ikke angivet"}
                  </p>

                  <h3>{card.player_name}</h3>

                  <p className="sports-card-details">
                    {card.parallel_name || "Base"}
                    {card.card_number ? ` · #${card.card_number}` : ""}
                  </p>

                  {card.serial_number && (
                    <span className="serial-badge">{card.serial_number}</span>
                  )}

                  <div className="sports-card-values">
                    <div>
                      <span>Cost</span>
                      <strong>
                        {Number(card.purchase_price ?? 0).toLocaleString(
                          "da-DK"
                        )}{" "}
                        kr.
                      </strong>
                    </div>

                    <div>
                      <span>Value</span>
                      <strong>
                        {Number(card.estimated_value ?? 0).toLocaleString(
                          "da-DK"
                        )}{" "}
                        kr.
                      </strong>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {showAddCardChoice && (
        <AddCardModal
          collections={[collection]}
          onClose={() => setShowAddCardChoice(false)}
          onScanCard={handleScanCard}
          onManualCard={handleManualCard}
        />
      )}

      <ScanCardModal
        isOpen={showScanCard}
        collectionId={collectionId}
        onClose={() => setShowScanCard(false)}
      />

      {showAddCard && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowAddCard(false);
            }
          }}
        >
          <section className="modal add-card-modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Manual entry</p>
                <h2>Add card</h2>
              </div>

              <button
                className="modal-close-button"
                type="button"
                onClick={() => setShowAddCard(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddCard}>
              <div className="form-grid">
                <div className="form-field form-field-full">
                  <label className="field-label" htmlFor="player-name">
                    Player name *
                  </label>

                  <input
                    className="text-input"
                    id="player-name"
                    type="text"
                    value={playerName}
                    onChange={(event) => setPlayerName(event.target.value)}
                    placeholder="Example: Michael Jordan"
                    autoFocus
                  />
                </div>

                <div className="form-field">
                  <label className="field-label" htmlFor="card-year">
                    Year
                  </label>

                  <input
                    className="text-input"
                    id="card-year"
                    type="text"
                    value={year}
                    onChange={(event) => setYear(event.target.value)}
                    placeholder="1997-98"
                  />
                </div>

                <div className="form-field">
                  <label className="field-label" htmlFor="manufacturer">
                    Manufacturer
                  </label>

                  <input
                    className="text-input"
                    id="manufacturer"
                    type="text"
                    value={manufacturer}
                    onChange={(event) => setManufacturer(event.target.value)}
                    placeholder="Upper Deck"
                  />
                </div>

                <div className="form-field form-field-full">
                  <label className="field-label" htmlFor="set-name">
                    Set
                  </label>

                  <input
                    className="text-input"
                    id="set-name"
                    type="text"
                    value={setName}
                    onChange={(event) => setSetName(event.target.value)}
                    placeholder="Example: UD3"
                  />
                </div>

                <div className="form-field">
                  <label className="field-label" htmlFor="card-number">
                    Card number
                  </label>

                  <input
                    className="text-input"
                    id="card-number"
                    type="text"
                    value={cardNumber}
                    onChange={(event) => setCardNumber(event.target.value)}
                    placeholder="23"
                  />
                </div>

                <div className="form-field">
                  <label className="field-label" htmlFor="parallel-name">
                    Parallel
                  </label>

                  <input
                    className="text-input"
                    id="parallel-name"
                    type="text"
                    value={parallelName}
                    onChange={(event) => setParallelName(event.target.value)}
                    placeholder="Silver Prizm"
                  />
                </div>

                <div className="form-field form-field-full">
                  <label className="field-label" htmlFor="serial-number">
                    Serial number
                  </label>

                  <input
                    className="text-input"
                    id="serial-number"
                    type="text"
                    value={serialNumber}
                    onChange={(event) => setSerialNumber(event.target.value)}
                    placeholder="Example: 02/10"
                  />
                </div>

                <div className="form-field">
                  <label className="field-label" htmlFor="purchase-price">
                    Purchase price
                  </label>

                  <input
                    className="text-input"
                    id="purchase-price"
                    type="text"
                    inputMode="decimal"
                    value={purchasePrice}
                    onChange={(event) => setPurchasePrice(event.target.value)}
                    placeholder="500"
                  />
                </div>

                <div className="form-field">
                  <label className="field-label" htmlFor="estimated-value">
                    Estimated value
                  </label>

                  <input
                    className="text-input"
                    id="estimated-value"
                    type="text"
                    inputMode="decimal"
                    value={estimatedValue}
                    onChange={(event) => setEstimatedValue(event.target.value)}
                    placeholder="750"
                  />
                </div>

                <div className="form-field form-field-full">
                  <label className="field-label" htmlFor="card-notes">
                    Notes
                  </label>

                  <textarea
                    className="text-area"
                    id="card-notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Condition, purchase source or other notes..."
                  />
                </div>
              </div>

              {message && <p className="form-message">{message}</p>}

              <div className="modal-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setShowAddCard(false)}
                >
                  Cancel
                </button>

                <button
                  className="primary-button"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save card"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}