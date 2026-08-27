"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  moveCard,
  type CollectionType,
  type MoveCardResult,
} from "@/lib/cards/moveCard";

import { createClient } from "@/lib/supabase/client";

type CollectionOption = {
  id: string;
  name: string;
  type: CollectionType;
  currency: string;
  created_at: string;
};

export type MoveCardCurrentCollection = {
  id: string;
  name: string;
  type: CollectionType;
  currency: string;
};

type MoveCardModalProps = {
  isOpen: boolean;

  cardId: string;

  playerName: string;

  currentCollection:
    MoveCardCurrentCollection;

  onClose: () => void;

  onMoved: (
    result: MoveCardResult
  ) => void;
};

function getCollectionTypeLabel(
  type: CollectionType
) {
  return type === "pc"
    ? "Personal Collection"
    : "Dealer Inventory";
}

function getReadableError(
  error: unknown
) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Kortet kunne ikke flyttes. Prøv igen.";
}

export default function MoveCardModal({
  isOpen,
  cardId,
  playerName,
  currentCollection,
  onClose,
  onMoved,
}: MoveCardModalProps) {
  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [
    collections,
    setCollections,
  ] = useState<
    CollectionOption[]
  >([]);

  const [
    selectedCollectionId,
    setSelectedCollectionId,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    isMoving,
    setIsMoving,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<
    string | null
  >(null);

  const loadCollections =
    useCallback(async () => {
      setLoading(true);
      setErrorMessage(null);

      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (
        userError ||
        !user
      ) {
        setCollections([]);

        setErrorMessage(
          "Du skal være logget ind for at flytte kortet."
        );

        setLoading(false);
        return;
      }

      const {
        data,
        error,
      } = await supabase
        .from("collections")
        .select(`
          id,
          name,
          type,
          currency,
          created_at
        `)
        .eq(
          "user_id",
          user.id
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        );

      if (error) {
        setCollections([]);

        setErrorMessage(
          `Dine collections kunne ikke indlæses: ${error.message}`
        );

        setLoading(false);
        return;
      }

      setCollections(
        (data ??
          []) as CollectionOption[]
      );

      setLoading(false);
    }, [
      supabase,
    ]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSelectedCollectionId("");
    setErrorMessage(null);
    setIsMoving(false);

    void loadCollections();
  }, [
    isOpen,
    loadCollections,
    cardId,
  ]);

  const handleClose =
    useCallback(() => {
      if (isMoving) {
        return;
      }

      setSelectedCollectionId("");
      setErrorMessage(null);

      onClose();
    }, [
      isMoving,
      onClose,
    ]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(
      event: KeyboardEvent
    ) {
      if (
        event.key ===
          "Escape" &&
        !isMoving
      ) {
        handleClose();
      }
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );

      document.body.style.overflow =
        previousOverflow;
    };
  }, [
    handleClose,
    isOpen,
    isMoving,
  ]);

  const destinationCollections =
    collections.filter(
      (collection) =>
        collection.id !==
        currentCollection.id
    );

  const eligibleCollections =
    destinationCollections.filter(
      (collection) =>
        collection.currency ===
        currentCollection.currency
    );

  const selectedCollection =
    collections.find(
      (collection) =>
        collection.id ===
        selectedCollectionId
    );

  const canMove =
    Boolean(
      selectedCollectionId
    ) &&
    selectedCollection?.id !==
      currentCollection.id &&
    selectedCollection?.currency ===
      currentCollection.currency &&
    !loading &&
    !isMoving;

  function selectCollection(
    collection: CollectionOption
  ) {
    if (
      isMoving ||
      collection.id ===
        currentCollection.id ||
      collection.currency !==
        currentCollection.currency
    ) {
      return;
    }

    setSelectedCollectionId(
      collection.id
    );

    setErrorMessage(null);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      !selectedCollectionId
    ) {
      setErrorMessage(
        "Vælg den collection, kortet skal flyttes til."
      );

      return;
    }

    if (
      selectedCollectionId ===
      currentCollection.id
    ) {
      setErrorMessage(
        "Kortet ligger allerede i den valgte collection."
      );

      return;
    }

    if (
      !selectedCollection
    ) {
      setErrorMessage(
        "Den valgte collection blev ikke fundet."
      );

      return;
    }

    if (
      selectedCollection.currency !==
      currentCollection.currency
    ) {
      setErrorMessage(
        `Kortet kan ikke flyttes mellem ${currentCollection.currency} og ${selectedCollection.currency}, før valutaomregning er bygget.`
      );

      return;
    }

    setIsMoving(true);
    setErrorMessage(null);

    try {
      const result =
        await moveCard({
          cardId,

          targetCollectionId:
            selectedCollectionId,
        });

      onMoved(result);
    } catch (error) {
      setErrorMessage(
        getReadableError(
          error
        )
      );

      setIsMoving(false);
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="move-card-backdrop"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          handleClose();
        }
      }}
    >
      <section
        className="move-card-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-card-title"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <header className="move-card-header">
          <div>
            <span className="move-card-badge">
              COLLECTION
            </span>

            <h2 id="move-card-title">
              Move card
            </h2>

            <p>
              Move {playerName} to
              another collection. All
              images, Card DNA and
              financial data will follow
              the card.
            </p>
          </div>

          <button
            className="move-card-close"
            type="button"
            onClick={handleClose}
            disabled={isMoving}
            aria-label="Close move card"
          >
            ×
          </button>
        </header>

        <form
          className="move-card-form"
          onSubmit={handleSubmit}
        >
          <div className="move-card-content">
            <section className="current-collection-section">
              <span className="section-label">
                CURRENT LOCATION
              </span>

              <div className="current-collection-card">
                <div
                  className={[
                    "collection-icon",

                    currentCollection.type ===
                    "pc"
                      ? "collection-icon-pc"
                      : "collection-icon-inventory",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {currentCollection.type ===
                  "pc"
                    ? "♥"
                    : "□"}
                </div>

                <div className="collection-information">
                  <strong>
                    {
                      currentCollection.name
                    }
                  </strong>

                  <span>
                    {getCollectionTypeLabel(
                      currentCollection.type
                    )}
                  </span>
                </div>

                <div className="current-badge">
                  Current
                </div>
              </div>
            </section>

            <section className="destination-section">
              <div className="destination-heading">
                <div>
                  <span className="section-label">
                    DESTINATION
                  </span>

                  <h3>
                    Choose a collection
                  </h3>

                  <p>
                    Select where the card
                    should be stored.
                  </p>
                </div>

                {!loading && (
                  <span className="destination-count">
                    {
                      eligibleCollections.length
                    }{" "}
                    available
                  </span>
                )}
              </div>

              {loading ? (
                <div className="move-loading">
                  <span className="move-loading-spinner" />

                  <p>
                    Loading your
                    collections...
                  </p>
                </div>
              ) : destinationCollections.length ===
                0 ? (
                <div className="move-empty-state">
                  <div>
                    ＋
                  </div>

                  <h4>
                    No other collections
                  </h4>

                  <p>
                    Create another
                    Personal Collection
                    or Dealer Inventory
                    before moving this
                    card.
                  </p>
                </div>
              ) : (
                <div className="collection-options">
                  {destinationCollections.map(
                    (
                      collection
                    ) => {
                      const isSelected =
                        selectedCollectionId ===
                        collection.id;

                      const hasDifferentCurrency =
                        collection.currency !==
                        currentCollection.currency;

                      const isDisabled =
                        isMoving ||
                        hasDifferentCurrency;

                      return (
                        <label
                          className={[
                            "collection-option",

                            isSelected
                              ? "collection-option-selected"
                              : "",

                            isDisabled
                              ? "collection-option-disabled"
                              : "",
                          ]
                            .filter(
                              Boolean
                            )
                            .join(" ")}
                          key={
                            collection.id
                          }
                          onClick={() =>
                            selectCollection(
                              collection
                            )
                          }
                        >
                          <input
                            type="radio"
                            name="target-collection"
                            value={
                              collection.id
                            }
                            checked={
                              isSelected
                            }
                            disabled={
                              isDisabled
                            }
                            onChange={() =>
                              selectCollection(
                                collection
                              )
                            }
                          />

                          <div
                            className={[
                              "collection-icon",

                              collection.type ===
                              "pc"
                                ? "collection-icon-pc"
                                : "collection-icon-inventory",
                            ]
                              .filter(
                                Boolean
                              )
                              .join(" ")}
                          >
                            {collection.type ===
                            "pc"
                              ? "♥"
                              : "□"}
                          </div>

                          <div className="collection-information">
                            <strong>
                              {
                                collection.name
                              }
                            </strong>

                            <span>
                              {getCollectionTypeLabel(
                                collection.type
                              )}
                            </span>
                          </div>

                          <div className="collection-option-meta">
                            <span>
                              {
                                collection.currency
                              }
                            </span>

                            {hasDifferentCurrency && (
                              <small>
                                Different
                                currency
                              </small>
                            )}
                          </div>

                          <span className="collection-radio">
                            <span />
                          </span>
                        </label>
                      );
                    }
                  )}
                </div>
              )}
            </section>

            <div className="move-information">
              <span>↕</span>

              <div>
                <strong>
                  The card itself is not
                  duplicated
                </strong>

                <p>
                  Vallective updates its
                  location and records
                  the movement in the
                  card’s collection
                  history.
                </p>
              </div>
            </div>

            {errorMessage && (
              <div
                className="move-error"
                role="alert"
              >
                <span>!</span>

                <div>
                  <strong>
                    Card could not be
                    moved
                  </strong>

                  <p>
                    {errorMessage}
                  </p>
                </div>
              </div>
            )}
          </div>

          <footer className="move-card-footer">
            <p>
              {selectedCollection
                ? `Move to ${selectedCollection.name}`
                : "Select a destination collection."}
            </p>

            <div className="move-card-actions">
              <button
                className="move-cancel-button"
                type="button"
                onClick={handleClose}
                disabled={isMoving}
              >
                Cancel
              </button>

              <button
                className="move-confirm-button"
                type="submit"
                disabled={!canMove}
              >
                {isMoving ? (
                  <>
                    <span className="move-spinner" />
                    Moving card...
                  </>
                ) : (
                  <>
                    <span>→</span>
                    Move card
                  </>
                )}
              </button>
            </div>
          </footer>
        </form>
      </section>

      <style jsx>{`
        .move-card-backdrop {
          position: fixed;
          inset: 0;
          z-index: 3000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(
            3,
            5,
            12,
            0.88
          );
          backdrop-filter: blur(
            15px
          );
        }

        .move-card-modal {
          width: min(
            720px,
            100%
          );
          max-height: calc(
            100vh - 48px
          );
          overflow-y: auto;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.18
            );
          border-radius: 26px;
          background:
            radial-gradient(
              circle at top right,
              rgba(
                124,
                92,
                255,
                0.14
              ),
              transparent 37%
            ),
            #11131c;
          box-shadow:
            0 38px 120px
              rgba(
                0,
                0,
                0,
                0.68
              ),
            0 0 0 1px
              rgba(
                255,
                255,
                255,
                0.02
              );
          color: #f8fafc;
        }

        .move-card-header {
          position: sticky;
          top: 0;
          z-index: 10;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          padding: 28px 30px 24px;
          border-bottom: 1px solid
            rgba(
              148,
              163,
              184,
              0.12
            );
          background: rgba(
            17,
            19,
            28,
            0.97
          );
          backdrop-filter: blur(
            18px
          );
        }

        .move-card-badge {
          display: inline-flex;
          padding: 6px 10px;
          border: 1px solid
            rgba(
              167,
              139,
              250,
              0.25
            );
          border-radius: 999px;
          background: rgba(
            139,
            92,
            246,
            0.1
          );
          color: #c4b5fd;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.16em;
        }

        .move-card-header h2 {
          margin: 13px 0 0;
          color: #ffffff;
          font-size: 28px;
          letter-spacing: -0.035em;
        }

        .move-card-header p {
          max-width: 510px;
          margin: 8px 0 0;
          color: #9299aa;
          font-size: 14px;
          line-height: 1.55;
        }

        .move-card-close {
          flex: 0 0 auto;
          width: 40px;
          height: 40px;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.16
            );
          border-radius: 12px;
          background: rgba(
            255,
            255,
            255,
            0.03
          );
          color: #9299aa;
          font-size: 26px;
          line-height: 1;
          cursor: pointer;
        }

        .move-card-close:hover:not(
            :disabled
          ) {
          border-color: rgba(
            167,
            139,
            250,
            0.5
          );
          background: rgba(
            167,
            139,
            250,
            0.09
          );
          color: #ffffff;
        }

        .move-card-close:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .move-card-form {
          min-width: 0;
        }

        .move-card-content {
          display: grid;
          gap: 24px;
          padding: 28px 30px;
        }

        .section-label {
          display: block;
          color: #9f93ff;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.15em;
        }

        .current-collection-card,
        .collection-option {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 15px 16px;
          border-radius: 16px;
        }

        .current-collection-card {
          margin-top: 11px;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.12
            );
          background: rgba(
            255,
            255,
            255,
            0.024
          );
        }

        .collection-icon {
          flex: 0 0 auto;
          width: 43px;
          height: 43px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 13px;
          font-size: 16px;
          font-weight: 800;
        }

        .collection-icon-pc {
          border: 1px solid
            rgba(
              244,
              114,
              182,
              0.23
            );
          background: rgba(
            244,
            114,
            182,
            0.09
          );
          color: #f9a8d4;
        }

        .collection-icon-inventory {
          border: 1px solid
            rgba(
              96,
              165,
              250,
              0.23
            );
          background: rgba(
            59,
            130,
            246,
            0.08
          );
          color: #bfdbfe;
        }

        .collection-information {
          min-width: 0;
          flex: 1;
        }

        .collection-information strong {
          display: block;
          overflow: hidden;
          color: #ffffff;
          font-size: 14px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .collection-information span {
          display: block;
          margin-top: 5px;
          color: #71798b;
          font-size: 11px;
        }

        .current-badge {
          flex: 0 0 auto;
          padding: 6px 9px;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.14
            );
          border-radius: 999px;
          background: rgba(
            255,
            255,
            255,
            0.03
          );
          color: #858da0;
          font-size: 9px;
          font-weight: 750;
          text-transform: uppercase;
        }

        .destination-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
        }

        .destination-heading h3 {
          margin: 7px 0 0;
          color: #ffffff;
          font-size: 18px;
          letter-spacing: -0.02em;
        }

        .destination-heading p {
          margin: 6px 0 0;
          color: #71798b;
          font-size: 12px;
        }

        .destination-count {
          flex: 0 0 auto;
          padding: 6px 9px;
          border-radius: 999px;
          background: rgba(
            139,
            92,
            246,
            0.08
          );
          color: #c4b5fd;
          font-size: 9px;
          font-weight: 750;
          text-transform: uppercase;
        }

        .collection-options {
          display: grid;
          gap: 10px;
          margin-top: 15px;
        }

        .collection-option {
          position: relative;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.12
            );
          background: rgba(
            255,
            255,
            255,
            0.02
          );
          cursor: pointer;
          transition:
            transform 150ms ease,
            border-color 150ms ease,
            background 150ms ease;
        }

        .collection-option:hover:not(
            .collection-option-disabled
          ) {
          transform: translateY(
            -1px
          );
          border-color: rgba(
            167,
            139,
            250,
            0.35
          );
          background: rgba(
            124,
            92,
            255,
            0.055
          );
        }

        .collection-option-selected {
          border-color: rgba(
            139,
            92,
            246,
            0.7
          );
          background: rgba(
            124,
            92,
            255,
            0.09
          );
          box-shadow: 0 0 0 3px
            rgba(
              124,
              92,
              255,
              0.055
            );
        }

        .collection-option-disabled {
          cursor: not-allowed;
          opacity: 0.46;
        }

        .collection-option input {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          opacity: 0;
          pointer-events: none;
        }

        .collection-option-meta {
          flex: 0 0 auto;
          display: grid;
          justify-items: end;
          gap: 4px;
        }

        .collection-option-meta > span {
          color: #8b93a5;
          font-size: 10px;
          font-weight: 750;
        }

        .collection-option-meta small {
          color: #d6b967;
          font-size: 8px;
          text-transform: uppercase;
        }

        .collection-radio {
          flex: 0 0 auto;
          width: 19px;
          height: 19px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.28
            );
          border-radius: 50%;
          background: rgba(
            0,
            0,
            0,
            0.15
          );
        }

        .collection-radio span {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: transparent;
        }

        .collection-option-selected
          .collection-radio {
          border-color: #9f93ff;
        }

        .collection-option-selected
          .collection-radio
          span {
          background: #8b5cf6;
          box-shadow: 0 0 10px
            rgba(
              139,
              92,
              246,
              0.7
            );
        }

        .move-loading,
        .move-empty-state {
          min-height: 190px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          margin-top: 15px;
          padding: 24px;
          border: 1px dashed
            rgba(
              148,
              163,
              184,
              0.17
            );
          border-radius: 17px;
          background: rgba(
            0,
            0,
            0,
            0.11
          );
          text-align: center;
        }

        .move-loading {
          color: #9299aa;
        }

        .move-loading-spinner,
        .move-spinner {
          border-radius: 50%;
          animation: move-spin
            700ms linear infinite;
        }

        .move-loading-spinner {
          width: 28px;
          height: 28px;
          border: 2px solid
            rgba(
              167,
              139,
              250,
              0.18
            );
          border-top-color: #a78bfa;
        }

        .move-loading p {
          margin: 13px 0 0;
          font-size: 12px;
        }

        .move-empty-state > div {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid
            rgba(
              167,
              139,
              250,
              0.19
            );
          border-radius: 14px;
          background: rgba(
            139,
            92,
            246,
            0.07
          );
          color: #c4b5fd;
          font-size: 20px;
        }

        .move-empty-state h4 {
          margin: 14px 0 0;
          color: #ffffff;
          font-size: 15px;
        }

        .move-empty-state p {
          max-width: 390px;
          margin: 8px 0 0;
          color: #71798b;
          font-size: 12px;
          line-height: 1.55;
        }

        .move-information,
        .move-error {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 15px 16px;
          border-radius: 15px;
        }

        .move-information {
          border: 1px solid
            rgba(
              96,
              165,
              250,
              0.18
            );
          background: rgba(
            59,
            130,
            246,
            0.055
          );
          color: #bfdbfe;
        }

        .move-error {
          border: 1px solid
            rgba(
              248,
              113,
              113,
              0.25
            );
          background: rgba(
            239,
            68,
            68,
            0.09
          );
          color: #fecaca;
        }

        .move-information > span,
        .move-error > span {
          flex: 0 0 auto;
          width: 25px;
          height: 25px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(
            255,
            255,
            255,
            0.08
          );
          font-size: 13px;
          font-weight: 800;
        }

        .move-information strong,
        .move-error strong {
          display: block;
          font-size: 13px;
        }

        .move-information p,
        .move-error p {
          margin: 5px 0 0;
          color: currentColor;
          font-size: 12px;
          line-height: 1.55;
          opacity: 0.8;
        }

        .move-card-footer {
          position: sticky;
          bottom: 0;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 20px 30px;
          border-top: 1px solid
            rgba(
              148,
              163,
              184,
              0.12
            );
          background: rgba(
            17,
            19,
            28,
            0.97
          );
          backdrop-filter: blur(
            18px
          );
        }

        .move-card-footer > p {
          margin: 0;
          color: #71798b;
          font-size: 12px;
          line-height: 1.5;
        }

        .move-card-actions {
          flex: 0 0 auto;
          display: flex;
          gap: 11px;
        }

        .move-cancel-button,
        .move-confirm-button {
          min-height: 46px;
          padding: 0 19px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 750;
          cursor: pointer;
        }

        .move-cancel-button {
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.16
            );
          background: rgba(
            255,
            255,
            255,
            0.03
          );
          color: #a5adbd;
        }

        .move-cancel-button:hover:not(
            :disabled
          ) {
          background: rgba(
            255,
            255,
            255,
            0.06
          );
          color: #ffffff;
        }

        .move-confirm-button {
          min-width: 150px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border: 0;
          background: linear-gradient(
            135deg,
            #8b5cf6,
            #6d5ce7
          );
          color: #ffffff;
          box-shadow: 0 10px 28px
            rgba(
              124,
              92,
              255,
              0.24
            );
        }

        .move-confirm-button:hover:not(
            :disabled
          ) {
          filter: brightness(
            1.08
          );
        }

        .move-cancel-button:disabled,
        .move-confirm-button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .move-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid
            rgba(
              255,
              255,
              255,
              0.3
            );
          border-top-color: #ffffff;
        }

        @keyframes move-spin {
          to {
            transform: rotate(
              360deg
            );
          }
        }

        @media (
          max-width: 620px
        ) {
          .move-card-backdrop {
            align-items: flex-end;
            padding: 10px;
          }

          .move-card-modal {
            max-height: calc(
              100vh - 20px
            );
            border-radius: 22px;
          }

          .move-card-header,
          .move-card-content,
          .move-card-footer {
            padding-left: 20px;
            padding-right: 20px;
          }

          .move-card-header h2 {
            font-size: 24px;
          }

          .destination-heading {
            flex-direction: column;
          }

          .collection-option {
            align-items: flex-start;
          }

          .collection-option-meta {
            display: none;
          }

          .move-card-footer {
            align-items: stretch;
            flex-direction: column;
            gap: 14px;
          }

          .move-card-actions {
            display: grid;
            grid-template-columns:
              1fr 1fr;
          }

          .move-cancel-button,
          .move-confirm-button {
            width: 100%;
            min-width: 0;
          }
        }
      `}</style>
    </div>
  );
}
