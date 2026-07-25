"use client";

import { useEffect, useState } from "react";

type Collection = {
  id: string;
  name: string;
  type: "pc" | "inventory";
  currency: string;
  created_at: string;
};

type AddCardModalProps = {
  collections: Collection[];
  onClose: () => void;
  onScanCard: () => void;
  onManualCard: (collectionId: string) => void;
};

export default function AddCardModal({
  collections,
  onClose,
  onScanCard,
  onManualCard,
}: AddCardModalProps) {
  const [selectedCollectionId, setSelectedCollectionId] = useState(
    collections[0]?.id ?? ""
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  function handleManualContinue() {
    if (!selectedCollectionId) {
      return;
    }

    onManualCard(selectedCollectionId);
  }

  return (
    <div
      className="add-card-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="add-card-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-card-title"
      >
        <header className="add-card-header">
          <div>
            <p className="add-card-eyebrow">NEW CARD</p>

            <h2 id="add-card-title">How would you like to add it?</h2>

            <p className="add-card-intro">
              Scan the card with AI or add it manually to one of your
              collections.
            </p>
          </div>

          <button
            className="add-card-close"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="add-card-content">
          <button
            className="scan-card-option"
            type="button"
            onClick={onScanCard}
          >
            <span className="option-icon scan-option-icon">◎</span>

            <span className="option-copy">
              <strong>Scan card</strong>

              <small>
                Upload or photograph the front and back. AI identifies the card
                automatically.
              </small>
            </span>

            <span className="option-arrow">→</span>
          </button>

          <div className="option-divider">
            <span />
            <p>OR</p>
            <span />
          </div>

          <div className="manual-card-section">
            <div className="manual-card-heading">
              <span className="option-icon manual-option-icon">＋</span>

              <div>
                <h3>Add manually</h3>
                <p>Choose which collection the new card belongs to.</p>
              </div>
            </div>

            {collections.length === 0 ? (
              <div className="no-collections">
                <strong>No collections found</strong>

                <p>Create a collection before adding a card manually.</p>
              </div>
            ) : (
              <div className="collection-options">
                {collections.map((collection) => {
                  const isSelected =
                    selectedCollectionId === collection.id;

                  return (
                    <button
                      className={`collection-option ${
                        isSelected ? "collection-option-selected" : ""
                      }`}
                      key={collection.id}
                      type="button"
                      onClick={() =>
                        setSelectedCollectionId(collection.id)
                      }
                    >
                      <span
                        className={`collection-option-symbol ${
                          collection.type === "pc"
                            ? "collection-option-symbol-pc"
                            : "collection-option-symbol-inventory"
                        }`}
                      >
                        {collection.type === "pc" ? "♥" : "□"}
                      </span>

                      <span className="collection-option-copy">
                        <strong>{collection.name}</strong>

                        <small>
                          {collection.type === "pc"
                            ? "Personal Collection"
                            : "Dealer Inventory"}
                        </small>
                      </span>

                      <span
                        className={`collection-radio ${
                          isSelected ? "collection-radio-selected" : ""
                        }`}
                      >
                        {isSelected && <span />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <footer className="add-card-footer">
          <button
            className="cancel-button"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            className="continue-button"
            type="button"
            onClick={handleManualContinue}
            disabled={!selectedCollectionId}
          >
            Continue manually
            <span>→</span>
          </button>
        </footer>
      </section>

      <style jsx>{`
        .add-card-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(3, 5, 12, 0.82);
          backdrop-filter: blur(14px);
        }

        .add-card-modal {
          width: min(620px, 100%);
          max-height: calc(100vh - 48px);
          overflow-y: auto;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 24px;
          background:
            radial-gradient(
              circle at top right,
              rgba(124, 92, 255, 0.13),
              transparent 36%
            ),
            #11131c;
          box-shadow:
            0 30px 100px rgba(0, 0, 0, 0.55),
            0 0 0 1px rgba(255, 255, 255, 0.02);
          color: #f8fafc;
        }

        .add-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          padding: 30px 30px 24px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.12);
        }

        .add-card-eyebrow {
          margin: 0 0 8px;
          color: #a78bfa;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.16em;
        }

        .add-card-header h2 {
          margin: 0;
          color: #ffffff;
          font-size: 25px;
          line-height: 1.2;
          letter-spacing: -0.03em;
        }

        .add-card-intro {
          max-width: 470px;
          margin: 10px 0 0;
          color: #9299aa;
          font-size: 14px;
          line-height: 1.55;
        }

        .add-card-close {
          flex: 0 0 auto;
          width: 38px;
          height: 38px;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.025);
          color: #9299aa;
          font-size: 25px;
          line-height: 1;
          cursor: pointer;
          transition:
            background 160ms ease,
            color 160ms ease,
            border-color 160ms ease;
        }

        .add-card-close:hover {
          border-color: rgba(167, 139, 250, 0.5);
          background: rgba(167, 139, 250, 0.09);
          color: #ffffff;
        }

        .add-card-content {
          padding: 26px 30px;
        }

        .scan-card-option {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 17px;
          padding: 20px;
          border: 1px solid rgba(139, 92, 246, 0.4);
          border-radius: 18px;
          background:
            linear-gradient(
              135deg,
              rgba(124, 92, 255, 0.18),
              rgba(124, 92, 255, 0.04)
            );
          color: #ffffff;
          text-align: left;
          cursor: pointer;
          transition:
            transform 160ms ease,
            border-color 160ms ease,
            background 160ms ease;
        }

        .scan-card-option:hover {
          transform: translateY(-2px);
          border-color: rgba(167, 139, 250, 0.8);
          background:
            linear-gradient(
              135deg,
              rgba(124, 92, 255, 0.27),
              rgba(124, 92, 255, 0.07)
            );
        }

        .option-icon {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          border-radius: 14px;
          font-size: 24px;
        }

        .scan-option-icon {
          background: linear-gradient(135deg, #8b5cf6, #6d5ce7);
          box-shadow: 0 10px 28px rgba(124, 92, 255, 0.28);
        }

        .manual-option-icon {
          background: rgba(255, 255, 255, 0.055);
          color: #b8c0d4;
        }

        .option-copy {
          min-width: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .option-copy strong {
          color: #ffffff;
          font-size: 17px;
        }

        .option-copy small {
          color: #adb3c2;
          font-size: 13px;
          line-height: 1.45;
        }

        .option-arrow {
          color: #c4b5fd;
          font-size: 22px;
        }

        .option-divider {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 14px;
          margin: 24px 0;
        }

        .option-divider span {
          height: 1px;
          background: rgba(148, 163, 184, 0.12);
        }

        .option-divider p {
          margin: 0;
          color: #697184;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.15em;
        }

        .manual-card-section {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .manual-card-heading {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .manual-card-heading h3 {
          margin: 0;
          color: #ffffff;
          font-size: 18px;
        }

        .manual-card-heading p {
          margin: 5px 0 0;
          color: #81899c;
          font-size: 13px;
        }

        .collection-options {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .collection-option {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 15px;
          background: rgba(255, 255, 255, 0.018);
          color: #ffffff;
          text-align: left;
          cursor: pointer;
          transition:
            border-color 150ms ease,
            background 150ms ease;
        }

        .collection-option:hover {
          border-color: rgba(148, 163, 184, 0.3);
          background: rgba(255, 255, 255, 0.035);
        }

        .collection-option-selected {
          border-color: rgba(139, 92, 246, 0.72);
          background: rgba(124, 92, 255, 0.1);
        }

        .collection-option-symbol {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 43px;
          height: 43px;
          border-radius: 12px;
          font-size: 18px;
        }

        .collection-option-symbol-pc {
          background: rgba(244, 114, 182, 0.11);
          color: #f48aab;
        }

        .collection-option-symbol-inventory {
          background: rgba(96, 165, 250, 0.11);
          color: #7db6ff;
        }

        .collection-option-copy {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .collection-option-copy strong {
          overflow: hidden;
          color: #f8fafc;
          font-size: 15px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .collection-option-copy small {
          color: #7e8799;
          font-size: 12px;
        }

        .collection-radio {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border: 1px solid rgba(148, 163, 184, 0.4);
          border-radius: 50%;
        }

        .collection-radio-selected {
          border-color: #8b5cf6;
        }

        .collection-radio-selected span {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #8b5cf6;
          box-shadow: 0 0 12px rgba(139, 92, 246, 0.65);
        }

        .no-collections {
          padding: 20px;
          border: 1px dashed rgba(148, 163, 184, 0.25);
          border-radius: 15px;
          text-align: center;
        }

        .no-collections strong {
          color: #f8fafc;
        }

        .no-collections p {
          margin: 6px 0 0;
          color: #81899c;
          font-size: 13px;
        }

        .add-card-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          padding: 20px 30px 26px;
          border-top: 1px solid rgba(148, 163, 184, 0.12);
        }

        .cancel-button,
        .continue-button {
          min-height: 44px;
          padding: 0 18px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .cancel-button {
          border: 1px solid rgba(148, 163, 184, 0.16);
          background: rgba(255, 255, 255, 0.025);
          color: #a5adbd;
        }

        .cancel-button:hover {
          border-color: rgba(148, 163, 184, 0.3);
          color: #ffffff;
        }

        .continue-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border: 0;
          background: linear-gradient(135deg, #8b5cf6, #6d5ce7);
          color: #ffffff;
          box-shadow: 0 10px 26px rgba(124, 92, 255, 0.22);
        }

        .continue-button:hover:not(:disabled) {
          filter: brightness(1.08);
        }

        .continue-button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        @media (max-width: 640px) {
          .add-card-backdrop {
            align-items: flex-end;
            padding: 12px;
          }

          .add-card-modal {
            max-height: calc(100vh - 24px);
            border-radius: 22px;
          }

          .add-card-header,
          .add-card-content,
          .add-card-footer {
            padding-left: 20px;
            padding-right: 20px;
          }

          .add-card-header h2 {
            font-size: 22px;
          }

          .add-card-footer {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .cancel-button,
          .continue-button {
            width: 100%;
            padding-left: 12px;
            padding-right: 12px;
          }
        }
      `}</style>
    </div>
  );
}