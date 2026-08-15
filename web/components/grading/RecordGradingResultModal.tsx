"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  recordGradingResult,
  type GradingSubgrades,
  type RecordGradingResultResult,
} from "@/lib/grading/recordGradingResult";

export type GradingResultCardSummary = {
  submissionCardId: string;
  cardId: string;
  playerName: string;
  cardSubtitle: string | null;
  gradingCompany: string;
  currency: string;
  expectedGrade: string | null;
  expectedGradedValue: number | null;
  rawValueSnapshot: number | null;
  totalGradingCost: number;
  resultGrade: string | null;
  resultQualifier: string | null;
  certificationNumber: string | null;
  resultMarketValue: number | null;
  resultNotes: string | null;
  resultSubgrades?: GradingSubgrades | null;
  gradedAt: string | null;
  imageUrl: string | null;
};

type RecordGradingResultModalProps = {
  isOpen: boolean;
  card: GradingResultCardSummary | null;
  onClose: () => void;
  onRecorded: (
    result: RecordGradingResultResult
  ) => void;
};

type SubgradeKey =
  | "Centering"
  | "Corners"
  | "Edges"
  | "Surface";

const SUBGRADE_KEYS: SubgradeKey[] = [
  "Centering",
  "Corners",
  "Edges",
  "Surface",
];

function getLocalDateTimeValue(date = new Date()) {
  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000
  );

  return localDate.toISOString().slice(0, 16);
}

function toLocalDateTimeValue(value: string | null) {
  if (!value) {
    return getLocalDateTimeValue();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return getLocalDateTimeValue();
  }

  return getLocalDateTimeValue(date);
}

function numberToText(value: number | null) {
  return value === null ? "" : String(value);
}

function getSubgradeText(
  subgrades: GradingSubgrades | null | undefined,
  key: SubgradeKey
) {
  const value = subgrades?.[key];

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function formatCurrency(value: number | null, currency: string) {
  if (value === null) {
    return "—";
  }

  if (currency === "DKK") {
    return `${value.toLocaleString("da-DK", {
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })} kr.`;
  }

  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function parsePreviewNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  let normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");

  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    normalized =
      lastComma > lastDot
        ? normalized.replace(/\./g, "").replace(/,/g, ".")
        : normalized.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = normalized.replace(/,/g, ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function supportsSubgrades(gradingCompany: string) {
  const company = gradingCompany.trim().toUpperCase();

  return ["BGS", "BECKETT", "CGC", "CSG", "TAG"].some((name) =>
    company.includes(name)
  );
}

function getReadableError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "The grading result could not be recorded. Try again.";
}

export default function RecordGradingResultModal({
  isOpen,
  card,
  onClose,
  onRecorded,
}: RecordGradingResultModalProps) {
  const [resultGrade, setResultGrade] = useState("");
  const [certificationNumber, setCertificationNumber] = useState("");
  const [resultQualifier, setResultQualifier] = useState("");
  const [resultMarketValue, setResultMarketValue] = useState("");
  const [resultNotes, setResultNotes] = useState("");
  const [gradedAt, setGradedAt] = useState(getLocalDateTimeValue());
  const [showSubgrades, setShowSubgrades] = useState(false);
  const [subgrades, setSubgrades] = useState<Record<SubgradeKey, string>>({
    Centering: "",
    Corners: "",
    Edges: "",
    Surface: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !card) {
      return;
    }

    setResultGrade(card.resultGrade ?? "");
    setCertificationNumber(card.certificationNumber ?? "");
    setResultQualifier(card.resultQualifier ?? "");
    setResultMarketValue(numberToText(card.resultMarketValue));
    setResultNotes(card.resultNotes ?? "");
    setGradedAt(toLocalDateTimeValue(card.gradedAt));

    const nextSubgrades = {
      Centering: getSubgradeText(card.resultSubgrades, "Centering"),
      Corners: getSubgradeText(card.resultSubgrades, "Corners"),
      Edges: getSubgradeText(card.resultSubgrades, "Edges"),
      Surface: getSubgradeText(card.resultSubgrades, "Surface"),
    };

    setSubgrades(nextSubgrades);
    setShowSubgrades(
      supportsSubgrades(card.gradingCompany) ||
        Object.values(nextSubgrades).some(Boolean)
    );
    setIsSaving(false);
    setErrorMessage(null);
  }, [card, isOpen]);

  const handleClose = useCallback(() => {
    if (isSaving) {
      return;
    }

    onClose();
  }, [isSaving, onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSaving) {
        handleClose();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [handleClose, isOpen, isSaving]);

  const parsedResultMarketValue = useMemo(
    () => parsePreviewNumber(resultMarketValue),
    [resultMarketValue]
  );

  const valueChange =
    card && parsedResultMarketValue !== null
      ? parsedResultMarketValue - (card.rawValueSnapshot ?? 0)
      : null;

  const netGradingUplift =
    valueChange !== null && card
      ? valueChange - card.totalGradingCost
      : null;

  const canSave = Boolean(resultGrade.trim()) && !isSaving;

  function updateSubgrade(key: SubgradeKey, value: string) {
    setSubgrades((current) => ({
      ...current,
      [key]: value,
    }));
    setErrorMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!card) {
      return;
    }

    if (!resultGrade.trim()) {
      setErrorMessage("Enter the final grade before saving.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const resultSubgrades: GradingSubgrades = {};

    if (showSubgrades) {
      for (const key of SUBGRADE_KEYS) {
        const value = subgrades[key].trim();

        if (value) {
          resultSubgrades[key] = value;
        }
      }
    }

    try {
      const result = await recordGradingResult({
        submissionCardId: card.submissionCardId,
        resultGrade,
        certificationNumber,
        resultQualifier,
        resultSubgrades,
        resultMarketValue,
        resultNotes,
        gradedAt,
      });

      onRecorded(result);
    } catch (error) {
      setErrorMessage(getReadableError(error));
      setIsSaving(false);
    }
  }

  if (!isOpen || !card) {
    return null;
  }

  return (
    <div
      className="result-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <section
        className="result-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-grade-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="result-header">
          <div>
            <span className="result-badge">GRADING RESULT</span>
            <h2 id="record-grade-title">Record card result</h2>
            <p>
              Save the final grade, certification number and optional
              post-grading value.
            </p>
          </div>

          <button
            className="result-close"
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            aria-label="Close grading result"
          >
            ×
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <fieldset disabled={isSaving}>
            <div className="result-content">
              <section className="card-context">
                <div className="card-image">
                  {card.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.imageUrl} alt={`${card.playerName} card`} />
                  ) : (
                    <span>NE</span>
                  )}
                </div>

                <div className="card-copy">
                  <span>{card.gradingCompany}</span>
                  <h3>{card.playerName}</h3>
                  <p>{card.cardSubtitle || "Card details unavailable"}</p>
                </div>

                <div className="expected-result">
                  <span>Expected</span>
                  <strong>{card.expectedGrade || "—"}</strong>
                  <small>
                    {formatCurrency(
                      card.expectedGradedValue,
                      card.currency
                    )}
                  </small>
                </div>
              </section>

              <section className="result-section">
                <div className="section-heading">
                  <div>
                    <span>FINAL RESULT</span>
                    <h3>Grade and certification</h3>
                    <p>
                      Enter the information exactly as it appears on the
                      grading label.
                    </p>
                  </div>
                </div>

                <div className="form-grid">
                  <label className="field">
                    <span>Final grade *</span>
                    <input
                      type="text"
                      value={resultGrade}
                      onChange={(event) => {
                        setResultGrade(event.target.value);
                        setErrorMessage(null);
                      }}
                      placeholder="Example: 9, 9.5, 10 or Authentic"
                      autoFocus
                      required
                    />
                  </label>

                  <label className="field">
                    <span>Qualifier</span>
                    <input
                      type="text"
                      value={resultQualifier}
                      onChange={(event) =>
                        setResultQualifier(event.target.value)
                      }
                      placeholder="Optional qualifier"
                    />
                  </label>

                  <label className="field field-wide">
                    <span>Certification number</span>
                    <input
                      type="text"
                      value={certificationNumber}
                      onChange={(event) =>
                        setCertificationNumber(event.target.value)
                      }
                      placeholder="Certification number from the slab"
                    />
                  </label>

                  <label className="field">
                    <span>Grading date</span>
                    <input
                      type="datetime-local"
                      value={gradedAt}
                      onChange={(event) => setGradedAt(event.target.value)}
                    />
                  </label>

                  <label className="money-field">
                    <span>Estimated graded value</span>
                    <div>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={resultMarketValue}
                        onChange={(event) =>
                          setResultMarketValue(event.target.value)
                        }
                        placeholder="0"
                      />
                      <strong>{card.currency}</strong>
                    </div>
                  </label>
                </div>
              </section>

              <section className="result-section">
                <button
                  className="subgrade-toggle"
                  type="button"
                  onClick={() => setShowSubgrades((current) => !current)}
                >
                  <span>
                    <strong>Subgrades</strong>
                    <small>
                      Centering, corners, edges and surface when supplied by
                      the grading company.
                    </small>
                  </span>
                  <span>{showSubgrades ? "−" : "+"}</span>
                </button>

                {showSubgrades && (
                  <div className="subgrade-grid">
                    {SUBGRADE_KEYS.map((key) => (
                      <label className="field" key={key}>
                        <span>{key}</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={subgrades[key]}
                          onChange={(event) =>
                            updateSubgrade(key, event.target.value)
                          }
                          placeholder="Example: 9.5"
                        />
                      </label>
                    ))}
                  </div>
                )}
              </section>

              <section className="economics-grid">
                <div>
                  <span>RAW snapshot</span>
                  <strong>
                    {formatCurrency(card.rawValueSnapshot, card.currency)}
                  </strong>
                </div>

                <div>
                  <span>Grading cost</span>
                  <strong>
                    {formatCurrency(card.totalGradingCost, card.currency)}
                  </strong>
                </div>

                <div>
                  <span>Result value</span>
                  <strong>
                    {formatCurrency(parsedResultMarketValue, card.currency)}
                  </strong>
                </div>

                <div
                  className={
                    netGradingUplift !== null && netGradingUplift >= 0
                      ? "economics-positive"
                      : netGradingUplift !== null
                        ? "economics-negative"
                        : ""
                  }
                >
                  <span>Net grading uplift</span>
                  <strong>
                    {formatCurrency(netGradingUplift, card.currency)}
                  </strong>
                </div>
              </section>

              <label className="notes-field">
                <span>Result notes</span>
                <textarea
                  value={resultNotes}
                  onChange={(event) => setResultNotes(event.target.value)}
                  placeholder="Optional notes about the result, label or slab..."
                />
              </label>

              <div className="result-information">
                <span>i</span>
                <p>
                  The grade is stored now. It is written into the card's Card
                  DNA when the submission is marked Returned.
                </p>
              </div>

              {errorMessage && (
                <div className="result-error" role="alert">
                  <span>!</span>
                  <div>
                    <strong>Result could not be saved</strong>
                    <p>{errorMessage}</p>
                  </div>
                </div>
              )}
            </div>
          </fieldset>

          <footer className="result-footer">
            <p>
              {card.gradingCompany} {resultGrade.trim() || "result"}
            </p>

            <div className="footer-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={handleClose}
                disabled={isSaving}
              >
                Cancel
              </button>

              <button
                className="primary-button"
                type="submit"
                disabled={!canSave}
              >
                {isSaving ? (
                  <>
                    <span className="button-spinner" />
                    Saving result...
                  </>
                ) : (
                  <>
                    <span>✓</span>
                    Save result
                  </>
                )}
              </button>
            </div>
          </footer>
        </form>
      </section>

      <style jsx>{`
        .result-backdrop {
          position: fixed;
          inset: 0;
          z-index: 3600;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(3, 5, 12, 0.9);
          backdrop-filter: blur(16px);
        }

        .result-modal {
          width: min(820px, 100%);
          max-height: calc(100vh - 48px);
          overflow-y: auto;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 26px;
          background:
            radial-gradient(
              circle at top right,
              rgba(124, 92, 255, 0.13),
              transparent 36%
            ),
            #11131c;
          box-shadow: 0 38px 120px rgba(0, 0, 0, 0.7);
          color: #f8fafc;
        }

        .result-header {
          position: sticky;
          top: 0;
          z-index: 10;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          padding: 28px 30px 24px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.12);
          background: rgba(17, 19, 28, 0.97);
          backdrop-filter: blur(18px);
        }

        .result-badge {
          display: inline-flex;
          padding: 6px 10px;
          border: 1px solid rgba(167, 139, 250, 0.25);
          border-radius: 999px;
          background: rgba(139, 92, 246, 0.1);
          color: #c4b5fd;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.16em;
        }

        .result-header h2 {
          margin: 13px 0 0;
          color: #fff;
          font-size: 28px;
          letter-spacing: -0.035em;
        }

        .result-header p {
          max-width: 590px;
          margin: 8px 0 0;
          color: #9299aa;
          font-size: 13px;
          line-height: 1.55;
        }

        .result-close {
          width: 40px;
          height: 40px;
          flex: 0 0 auto;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.03);
          color: #9299aa;
          font-size: 26px;
          cursor: pointer;
        }

        fieldset {
          margin: 0;
          padding: 0;
          border: 0;
        }

        .result-content {
          display: grid;
          gap: 18px;
          padding: 28px 30px;
        }

        .card-context {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 14px;
          padding: 15px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.025);
        }

        .card-image {
          width: 54px;
          height: 72px;
          display: grid;
          place-items: center;
          overflow: hidden;
          border-radius: 10px;
          background: #080a10;
          color: #8f82d9;
          font-size: 10px;
          font-weight: 800;
        }

        .card-image img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .card-copy {
          min-width: 0;
        }

        .card-copy > span {
          color: #9f93ff;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.12em;
        }

        .card-copy h3 {
          margin: 5px 0 0;
          overflow: hidden;
          color: #fff;
          font-size: 15px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .card-copy p {
          margin: 5px 0 0;
          color: #71798b;
          font-size: 10px;
          line-height: 1.45;
        }

        .expected-result {
          min-width: 95px;
          text-align: right;
        }

        .expected-result span,
        .expected-result small {
          display: block;
          color: #71798b;
          font-size: 8px;
          text-transform: uppercase;
        }

        .expected-result strong {
          display: block;
          margin-top: 5px;
          color: #ddd6fe;
          font-size: 16px;
        }

        .expected-result small {
          margin-top: 4px;
          text-transform: none;
        }

        .result-section {
          padding: 21px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.022);
        }

        .section-heading {
          padding-bottom: 16px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
        }

        .section-heading span {
          color: #9f93ff;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.15em;
        }

        .section-heading h3 {
          margin: 7px 0 0;
          color: #fff;
          font-size: 18px;
        }

        .section-heading p {
          margin: 6px 0 0;
          color: #71798b;
          font-size: 11px;
          line-height: 1.5;
        }

        .form-grid,
        .subgrade-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 11px;
          margin-top: 16px;
        }

        .field,
        .money-field,
        .notes-field {
          display: grid;
          gap: 7px;
        }

        .field-wide {
          grid-column: 1 / -1;
        }

        .field > span,
        .money-field > span,
        .notes-field > span {
          color: #81899c;
          font-size: 9px;
          font-weight: 750;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .field input,
        .money-field > div,
        .notes-field textarea {
          border: 1px solid rgba(148, 163, 184, 0.13);
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.18);
        }

        .field input,
        .money-field input,
        .notes-field textarea {
          width: 100%;
          outline: none;
          background: transparent;
          color: #fff;
          color-scheme: dark;
          font: inherit;
          font-size: 12px;
        }

        .field input {
          min-height: 43px;
          padding: 0 12px;
        }

        .money-field > div {
          display: flex;
          align-items: center;
          overflow: hidden;
        }

        .money-field input {
          min-width: 0;
          flex: 1;
          min-height: 43px;
          padding: 0 12px;
          border: 0;
        }

        .money-field > div > strong {
          padding: 0 12px;
          color: #71798b;
          font-size: 10px;
        }

        .field input:focus,
        .money-field > div:focus-within,
        .notes-field textarea:focus {
          border-color: rgba(167, 139, 250, 0.62);
          box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.07);
        }

        .subgrade-toggle {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 0;
          border: 0;
          background: transparent;
          color: inherit;
          text-align: left;
          cursor: pointer;
        }

        .subgrade-toggle strong {
          display: block;
          color: #fff;
          font-size: 13px;
        }

        .subgrade-toggle small {
          display: block;
          margin-top: 5px;
          color: #71798b;
          font-size: 10px;
          line-height: 1.45;
        }

        .subgrade-toggle > span:last-child {
          color: #c4b5fd;
          font-size: 20px;
        }

        .economics-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 9px;
        }

        .economics-grid > div {
          min-width: 0;
          padding: 13px;
          border: 1px solid rgba(148, 163, 184, 0.11);
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.13);
        }

        .economics-grid span {
          display: block;
          color: #71798b;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }

        .economics-grid strong {
          display: block;
          margin-top: 7px;
          color: #fff;
          font-size: 13px;
        }

        .economics-positive strong {
          color: #86efac;
        }

        .economics-negative strong {
          color: #fca5a5;
        }

        .notes-field textarea {
          min-height: 96px;
          resize: vertical;
          padding: 12px;
          line-height: 1.5;
        }

        .result-information,
        .result-error {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          padding: 13px 14px;
          border-radius: 13px;
        }

        .result-information {
          border: 1px solid rgba(96, 165, 250, 0.18);
          background: rgba(59, 130, 246, 0.055);
          color: #bfdbfe;
        }

        .result-error {
          border: 1px solid rgba(248, 113, 113, 0.24);
          background: rgba(239, 68, 68, 0.08);
          color: #fecaca;
        }

        .result-information > span,
        .result-error > span {
          width: 24px;
          height: 24px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.07);
          font-size: 10px;
          font-weight: 800;
        }

        .result-information p,
        .result-error p {
          margin: 2px 0 0;
          color: currentColor;
          font-size: 10px;
          line-height: 1.5;
          opacity: 0.82;
        }

        .result-error strong {
          font-size: 12px;
        }

        .result-footer {
          position: sticky;
          bottom: 0;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 20px 30px;
          border-top: 1px solid rgba(148, 163, 184, 0.12);
          background: rgba(17, 19, 28, 0.97);
          backdrop-filter: blur(18px);
        }

        .result-footer > p {
          margin: 0;
          color: #71798b;
          font-size: 11px;
        }

        .footer-actions {
          display: flex;
          gap: 10px;
        }

        .secondary-button,
        .primary-button {
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 17px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 750;
          cursor: pointer;
        }

        .secondary-button {
          border: 1px solid rgba(148, 163, 184, 0.16);
          background: rgba(255, 255, 255, 0.03);
          color: #a5adbd;
        }

        .primary-button {
          min-width: 150px;
          border: 0;
          background: linear-gradient(135deg, #8b5cf6, #6d5ce7);
          color: #fff;
          box-shadow: 0 10px 28px rgba(124, 92, 255, 0.23);
        }

        .secondary-button:disabled,
        .primary-button:disabled,
        .result-close:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .button-spinner {
          width: 15px;
          height: 15px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: result-spin 700ms linear infinite;
        }

        @keyframes result-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 720px) {
          .economics-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .result-backdrop {
            align-items: flex-end;
            padding: 0;
          }

          .result-modal {
            width: 100%;
            max-height: 100dvh;
            border-radius: 0;
          }

          .result-header,
          .result-content,
          .result-footer {
            padding-left: 18px;
            padding-right: 18px;
          }

          .result-header {
            padding-top: max(22px, env(safe-area-inset-top));
          }

          .card-context {
            grid-template-columns: auto minmax(0, 1fr);
          }

          .expected-result {
            grid-column: 1 / -1;
            padding-top: 11px;
            border-top: 1px solid rgba(148, 163, 184, 0.1);
            text-align: left;
          }

          .form-grid,
          .subgrade-grid,
          .economics-grid {
            grid-template-columns: 1fr;
          }

          .field-wide {
            grid-column: auto;
          }

          .result-footer {
            align-items: stretch;
            flex-direction: column;
            padding-bottom: max(18px, env(safe-area-inset-bottom));
          }

          .footer-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </div>
  );
}