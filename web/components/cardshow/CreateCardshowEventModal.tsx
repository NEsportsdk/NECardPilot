"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createCardshowEvent,
  type CardshowPaymentMethod,
  type CreateCardshowEventResult,
} from "@/lib/cardshow/createCardshowEvent";

type CreateCardshowEventModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (result: CreateCardshowEventResult) => void;
};

type EventForm = {
  name: string;
  venue: string;
  city: string;
  address: string;
  startsAt: string;
  endsAt: string;
  currency: string;
  boothFee: string;
  travelCost: string;
  accommodationCost: string;
  foodCost: string;
  otherEventCosts: string;
  notes: string;
};

const PAYMENT_METHOD_OPTIONS: Array<{
  value: CardshowPaymentMethod;
  label: string;
  description: string;
}> = [
  {
    value: "cash",
    label: "Cash",
    description: "Cash payments at the table",
  },
  {
    value: "mobilepay",
    label: "MobilePay",
    description: "Fast mobile transfers",
  },
  {
    value: "card",
    label: "Card",
    description: "Terminal or card reader",
  },
  {
    value: "bank_transfer",
    label: "Bank transfer",
    description: "Direct bank transfer",
  },
  {
    value: "paypal",
    label: "PayPal",
    description: "PayPal payment",
  },
  {
    value: "other",
    label: "Other",
    description: "Any other agreed method",
  },
];

function createInitialForm(): EventForm {
  return {
    name: "",
    venue: "",
    city: "",
    address: "",
    startsAt: "",
    endsAt: "",
    currency: "DKK",
    boothFee: "",
    travelCost: "",
    accommodationCost: "",
    foodCost: "",
    otherEventCosts: "",
    notes: "",
  };
}

function normalizeNumberString(value: string) {
  let normalizedValue = value
    .trim()
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");

  const lastComma = normalizedValue.lastIndexOf(",");
  const lastDot = normalizedValue.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    normalizedValue =
      lastComma > lastDot
        ? normalizedValue.replace(/\./g, "").replace(/,/g, ".")
        : normalizedValue.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalizedValue = normalizedValue.replace(/,/g, ".");
  } else if (lastDot >= 0) {
    const parts = normalizedValue.split(".");

    if (parts.length === 2 && parts[1]?.length === 3) {
      normalizedValue = parts.join("");
    }
  }

  return normalizedValue;
}

function parseMoneyPreview(value: string) {
  if (!value.trim()) {
    return 0;
  }

  const parsedValue = Number(normalizeNumberString(value));

  return Number.isFinite(parsedValue) && parsedValue >= 0
    ? Math.round((parsedValue + Number.EPSILON) * 100) / 100
    : 0;
}

function formatCurrency(value: number, currency: string) {
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

function getReadableError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "The cardshow event could not be created. Try again.";
}

export default function CreateCardshowEventModal({
  isOpen,
  onClose,
  onCreated,
}: CreateCardshowEventModalProps) {
  const [form, setForm] = useState<EventForm>(() => createInitialForm());
  const [paymentMethods, setPaymentMethods] = useState<
    Set<CardshowPaymentMethod>
  >(() => new Set(["cash", "mobilepay", "card", "other"]));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setForm(createInitialForm());
    setPaymentMethods(new Set(["cash", "mobilepay", "card", "other"]));
    setIsSubmitting(false);
    setErrorMessage(null);
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    onClose();
  }, [isSubmitting, onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) {
        handleClose();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleClose, isOpen, isSubmitting]);

  const eventCostTotal = useMemo(
    () =>
      parseMoneyPreview(form.boothFee) +
      parseMoneyPreview(form.travelCost) +
      parseMoneyPreview(form.accommodationCost) +
      parseMoneyPreview(form.foodCost) +
      parseMoneyPreview(form.otherEventCosts),
    [
      form.accommodationCost,
      form.boothFee,
      form.foodCost,
      form.otherEventCosts,
      form.travelCost,
    ]
  );

  const canSubmit =
    Boolean(form.name.trim()) && paymentMethods.size > 0 && !isSubmitting;

  function updateField<Field extends keyof EventForm>(
    field: Field,
    value: EventForm[Field]
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
    setErrorMessage(null);
  }

  function togglePaymentMethod(method: CardshowPaymentMethod) {
    setPaymentMethods((currentMethods) => {
      const nextMethods = new Set(currentMethods);

      if (nextMethods.has(method)) {
        nextMethods.delete(method);
      } else {
        nextMethods.add(method);
      }

      return nextMethods;
    });
    setErrorMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.name.trim()) {
      setErrorMessage("Enter a name for the cardshow.");
      return;
    }

    if (paymentMethods.size === 0) {
      setErrorMessage("Select at least one payment method.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await createCardshowEvent({
        name: form.name,
        venue: form.venue,
        city: form.city,
        address: form.address,
        startsAt: form.startsAt,
        endsAt: form.endsAt,
        currency: form.currency,
        paymentMethods: Array.from(paymentMethods),
        boothFee: form.boothFee,
        travelCost: form.travelCost,
        accommodationCost: form.accommodationCost,
        foodCost: form.foodCost,
        otherEventCosts: form.otherEventCosts,
        notes: form.notes,
      });

      onCreated(result);
    } catch (error) {
      setErrorMessage(getReadableError(error));
      setIsSubmitting(false);
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="event-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <section
        className="event-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-cardshow-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="event-modal-header">
          <div>
            <span className="event-modal-badge">CARDSHOW SETUP</span>
            <h2 id="create-cardshow-title">Create cardshow</h2>
            <p>
              Set up the event, accepted payment methods and operating costs.
              Inventory and checkout are added after the event is created.
            </p>
          </div>

          <button
            className="event-modal-close"
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Close create cardshow"
          >
            ×
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <fieldset className="event-fieldset" disabled={isSubmitting}>
            <div className="event-modal-content">
              <section className="event-section">
                <SectionHeading
                  eyebrow="EVENT"
                  title="Cardshow details"
                  description="Create a reusable event record for inventory, sales and reporting."
                />

                <div className="form-grid">
                  <TextField
                    label="Event name"
                    value={form.name}
                    placeholder="Example: Odense Card Show – August 2026"
                    required
                    autoFocus
                    fullWidth
                    onChange={(value) => updateField("name", value)}
                  />

                  <TextField
                    label="Venue"
                    value={form.venue}
                    placeholder="Arena, hotel or event hall"
                    onChange={(value) => updateField("venue", value)}
                  />

                  <TextField
                    label="City"
                    value={form.city}
                    placeholder="Odense"
                    onChange={(value) => updateField("city", value)}
                  />

                  <TextField
                    label="Address"
                    value={form.address}
                    placeholder="Street and number"
                    fullWidth
                    onChange={(value) => updateField("address", value)}
                  />

                  <DateTimeField
                    label="Starts"
                    value={form.startsAt}
                    onChange={(value) => updateField("startsAt", value)}
                  />

                  <DateTimeField
                    label="Ends"
                    value={form.endsAt}
                    onChange={(value) => updateField("endsAt", value)}
                  />

                  <label className="select-field">
                    <span>CURRENCY</span>
                    <select
                      value={form.currency}
                      onChange={(event) =>
                        updateField("currency", event.target.value)
                      }
                    >
                      <option value="DKK">DKK</option>
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </label>
                </div>
              </section>

              <section className="event-section">
                <SectionHeading
                  eyebrow="CHECKOUT"
                  title="Payment methods"
                  description="Choose the payment methods that may be used during this event."
                />

                <div className="payment-method-grid">
                  {PAYMENT_METHOD_OPTIONS.map((option) => {
                    const selected = paymentMethods.has(option.value);

                    return (
                      <button
                        className={[
                          "payment-method",
                          selected ? "payment-method-selected" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        type="button"
                        key={option.value}
                        onClick={() => togglePaymentMethod(option.value)}
                        aria-pressed={selected}
                      >
                        <span className="payment-check">{selected ? "✓" : ""}</span>
                        <span>
                          <strong>{option.label}</strong>
                          <small>{option.description}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="event-section">
                <SectionHeading
                  eyebrow="COSTS"
                  title="Event expenses"
                  description="These costs remain separate from individual card profit and support true event profitability."
                />

                <div className="cost-grid">
                  <MoneyField
                    label="Booth fee"
                    value={form.boothFee}
                    currency={form.currency}
                    onChange={(value) => updateField("boothFee", value)}
                  />

                  <MoneyField
                    label="Travel"
                    value={form.travelCost}
                    currency={form.currency}
                    onChange={(value) => updateField("travelCost", value)}
                  />

                  <MoneyField
                    label="Accommodation"
                    value={form.accommodationCost}
                    currency={form.currency}
                    onChange={(value) => updateField("accommodationCost", value)}
                  />

                  <MoneyField
                    label="Food"
                    value={form.foodCost}
                    currency={form.currency}
                    onChange={(value) => updateField("foodCost", value)}
                  />

                  <MoneyField
                    label="Other costs"
                    value={form.otherEventCosts}
                    currency={form.currency}
                    onChange={(value) => updateField("otherEventCosts", value)}
                  />
                </div>

                <div className="event-cost-preview">
                  <span>TOTAL EVENT COST</span>
                  <strong>{formatCurrency(eventCostTotal, form.currency)}</strong>
                  <p>
                    Sales profitability will later be shown both before and after
                    these shared event costs.
                  </p>
                </div>
              </section>

              <label className="notes-field">
                <span>NOTES</span>
                <textarea
                  value={form.notes}
                  placeholder="Stand information, setup time, organizer contact or other notes..."
                  onChange={(event) => updateField("notes", event.target.value)}
                />
              </label>

              {errorMessage && (
                <div className="event-error" role="alert">
                  <span>!</span>
                  <div>
                    <strong>Cardshow could not be created</strong>
                    <p>{errorMessage}</p>
                  </div>
                </div>
              )}
            </div>
          </fieldset>

          <footer className="event-modal-footer">
            <p>
              New events begin in <strong>Planning</strong> status.
            </p>

            <div className="event-modal-actions">
              <button
                className="cancel-button"
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>

              <button
                className="create-button"
                type="submit"
                disabled={!canSubmit}
              >
                {isSubmitting ? (
                  <>
                    <span className="button-spinner" />
                    Creating...
                  </>
                ) : (
                  <>
                    <span>＋</span>
                    Create cardshow
                  </>
                )}
              </button>
            </div>
          </footer>
        </form>
      </section>

      <style jsx>{`
        .event-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 4000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(3, 5, 12, 0.9);
          backdrop-filter: blur(16px);
        }

        .event-modal {
          width: min(980px, 100%);
          max-height: calc(100vh - 48px);
          overflow-y: auto;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 26px;
          background:
            radial-gradient(
              circle at top right,
              rgba(124, 92, 255, 0.13),
              transparent 35%
            ),
            #11131c;
          box-shadow: 0 38px 120px rgba(0, 0, 0, 0.7);
          color: #f8fafc;
        }

        .event-modal-header,
        .event-modal-footer {
          position: sticky;
          z-index: 10;
          background: rgba(17, 19, 28, 0.97);
          backdrop-filter: blur(18px);
        }

        .event-modal-header {
          top: 0;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          padding: 28px 30px 24px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.12);
        }

        .event-modal-badge {
          display: inline-flex;
          padding: 6px 10px;
          border: 1px solid rgba(167, 139, 250, 0.25);
          border-radius: 999px;
          background: rgba(139, 92, 246, 0.1);
          color: #c4b5fd;
          font-size: 10px;
          font-weight: 850;
          letter-spacing: 0.15em;
        }

        .event-modal-header h2 {
          margin: 13px 0 0;
          color: #ffffff;
          font-size: 28px;
          letter-spacing: -0.035em;
        }

        .event-modal-header p {
          max-width: 680px;
          margin: 8px 0 0;
          color: #8c94a5;
          font-size: 13px;
          line-height: 1.55;
        }

        .event-modal-close {
          flex: 0 0 auto;
          width: 40px;
          height: 40px;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.03);
          color: #9299aa;
          font-size: 26px;
          line-height: 1;
          cursor: pointer;
        }

        .event-modal-close:hover:not(:disabled) {
          border-color: rgba(167, 139, 250, 0.5);
          color: #ffffff;
        }

        .event-fieldset {
          min-width: 0;
          margin: 0;
          padding: 0;
          border: 0;
        }

        .event-modal-content {
          display: grid;
          gap: 20px;
          padding: 28px 30px;
        }

        .event-section {
          padding: 22px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 19px;
          background: rgba(255, 255, 255, 0.021);
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-top: 17px;
        }

        .select-field,
        .notes-field {
          min-width: 0;
          display: grid;
          gap: 7px;
        }

        .select-field > span,
        .notes-field > span {
          color: #81899c;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.09em;
        }

        .select-field select,
        .notes-field textarea {
          width: 100%;
          border: 1px solid rgba(148, 163, 184, 0.13);
          border-radius: 13px;
          outline: none;
          background: rgba(0, 0, 0, 0.18);
          color: #ffffff;
          color-scheme: dark;
          font: inherit;
        }

        .select-field select {
          min-height: 43px;
          padding: 0 13px;
          font-size: 12px;
        }

        .notes-field textarea {
          min-height: 105px;
          resize: vertical;
          padding: 13px 14px;
          font-size: 12px;
          line-height: 1.55;
        }

        .select-field select:focus,
        .notes-field textarea:focus {
          border-color: rgba(167, 139, 250, 0.62);
          box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.07);
        }

        .payment-method-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 17px;
        }

        .payment-method {
          min-width: 0;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 13px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.14);
          color: #9299aa;
          text-align: left;
          cursor: pointer;
        }

        .payment-method-selected {
          border-color: rgba(139, 92, 246, 0.56);
          background: rgba(124, 92, 255, 0.09);
          color: #ddd6fe;
        }

        .payment-check {
          flex: 0 0 auto;
          width: 22px;
          height: 22px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(148, 163, 184, 0.24);
          border-radius: 7px;
          background: rgba(0, 0, 0, 0.18);
          color: #ffffff;
          font-size: 11px;
          font-weight: 850;
        }

        .payment-method-selected .payment-check {
          border-color: #8b5cf6;
          background: #7c5cff;
        }

        .payment-method strong,
        .payment-method small {
          display: block;
        }

        .payment-method strong {
          color: #ffffff;
          font-size: 11px;
        }

        .payment-method small {
          margin-top: 4px;
          color: #71798b;
          font-size: 9px;
          line-height: 1.4;
        }

        .cost-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
          margin-top: 17px;
        }

        .event-cost-preview {
          margin-top: 14px;
          padding: 16px;
          border: 1px solid rgba(139, 92, 246, 0.22);
          border-radius: 15px;
          background: rgba(124, 92, 255, 0.055);
        }

        .event-cost-preview span {
          color: #9f93ff;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 0.1em;
        }

        .event-cost-preview strong {
          display: block;
          margin-top: 7px;
          color: #ffffff;
          font-size: 22px;
        }

        .event-cost-preview p {
          margin: 6px 0 0;
          color: #777f91;
          font-size: 10px;
          line-height: 1.5;
        }

        .event-error {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 15px 16px;
          border: 1px solid rgba(248, 113, 113, 0.25);
          border-radius: 15px;
          background: rgba(239, 68, 68, 0.09);
          color: #fecaca;
        }

        .event-error > span {
          flex: 0 0 auto;
          width: 25px;
          height: 25px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.08);
          font-weight: 850;
        }

        .event-error strong {
          font-size: 12px;
        }

        .event-error p {
          margin: 5px 0 0;
          color: #dca9a9;
          font-size: 10px;
          line-height: 1.5;
        }

        .event-modal-footer {
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 20px 30px;
          border-top: 1px solid rgba(148, 163, 184, 0.12);
        }

        .event-modal-footer > p {
          margin: 0;
          color: #71798b;
          font-size: 11px;
        }

        .event-modal-footer > p strong {
          color: #d9dde6;
        }

        .event-modal-actions {
          flex: 0 0 auto;
          display: flex;
          gap: 10px;
        }

        .cancel-button,
        .create-button {
          min-height: 46px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 18px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 780;
          cursor: pointer;
        }

        .cancel-button {
          border: 1px solid rgba(148, 163, 184, 0.16);
          background: rgba(255, 255, 255, 0.03);
          color: #a5adbd;
        }

        .create-button {
          min-width: 165px;
          border: 0;
          background: linear-gradient(135deg, #8b5cf6, #6d5ce7);
          color: #ffffff;
          box-shadow: 0 10px 28px rgba(124, 92, 255, 0.24);
        }

        .cancel-button:disabled,
        .create-button:disabled,
        .event-modal-close:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .button-spinner {
          width: 15px;
          height: 15px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: spin 700ms linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 820px) {
          .payment-method-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .cost-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 620px) {
          .event-modal-backdrop {
            align-items: flex-end;
            padding: 0;
          }

          .event-modal {
            width: 100%;
            max-height: 100dvh;
            border-right: 0;
            border-bottom: 0;
            border-left: 0;
            border-radius: 22px 22px 0 0;
          }

          .event-modal-header,
          .event-modal-content,
          .event-modal-footer {
            padding-right: 18px;
            padding-left: 18px;
          }

          .event-modal-footer {
            align-items: stretch;
            flex-direction: column;
            padding-bottom: calc(18px + env(safe-area-inset-bottom));
          }

          .event-modal-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .cancel-button,
          .create-button {
            width: 100%;
            min-width: 0;
          }

          .form-grid,
          .payment-method-grid,
          .cost-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
};

function SectionHeading({
  eyebrow,
  title,
  description,
}: SectionHeadingProps) {
  return (
    <div className="section-heading">
      <span>{eyebrow}</span>
      <h3>{title}</h3>
      <p>{description}</p>

      <style jsx>{`
        .section-heading > span {
          color: #9f93ff;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 0.14em;
        }

        .section-heading h3 {
          margin: 7px 0 0;
          color: #ffffff;
          font-size: 18px;
          letter-spacing: -0.02em;
        }

        .section-heading p {
          margin: 6px 0 0;
          color: #71798b;
          font-size: 10px;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}

type TextFieldProps = {
  label: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
  fullWidth?: boolean;
  onChange: (value: string) => void;
};

function TextField({
  label,
  value,
  placeholder,
  required = false,
  autoFocus = false,
  fullWidth = false,
  onChange,
}: TextFieldProps) {
  return (
    <label className={fullWidth ? "text-field full-width" : "text-field"}>
      <span>
        {label.toUpperCase()}
        {required ? " *" : ""}
      </span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
      />

      <style jsx>{`
        .text-field {
          min-width: 0;
          display: grid;
          gap: 7px;
        }

        .full-width {
          grid-column: 1 / -1;
        }

        .text-field > span {
          color: #81899c;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.09em;
        }

        .text-field input {
          width: 100%;
          min-height: 43px;
          padding: 0 13px;
          border: 1px solid rgba(148, 163, 184, 0.13);
          border-radius: 13px;
          outline: none;
          background: rgba(0, 0, 0, 0.18);
          color: #ffffff;
          font: inherit;
          font-size: 12px;
        }

        .text-field input:focus {
          border-color: rgba(167, 139, 250, 0.62);
          box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.07);
        }

        @media (max-width: 620px) {
          .full-width {
            grid-column: auto;
          }
        }
      `}</style>
    </label>
  );
}

type DateTimeFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function DateTimeField({ label, value, onChange }: DateTimeFieldProps) {
  return (
    <label className="date-field">
      <span>{label.toUpperCase()}</span>
      <input
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />

      <style jsx>{`
        .date-field {
          min-width: 0;
          display: grid;
          gap: 7px;
        }

        .date-field span {
          color: #81899c;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.09em;
        }

        .date-field input {
          width: 100%;
          min-height: 43px;
          padding: 0 13px;
          border: 1px solid rgba(148, 163, 184, 0.13);
          border-radius: 13px;
          outline: none;
          background: rgba(0, 0, 0, 0.18);
          color: #ffffff;
          color-scheme: dark;
          font: inherit;
          font-size: 12px;
        }

        .date-field input:focus {
          border-color: rgba(167, 139, 250, 0.62);
          box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.07);
        }
      `}</style>
    </label>
  );
}

type MoneyFieldProps = {
  label: string;
  value: string;
  currency: string;
  onChange: (value: string) => void;
};

function MoneyField({ label, value, currency, onChange }: MoneyFieldProps) {
  return (
    <label className="money-field">
      <span>{label.toUpperCase()}</span>
      <div>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          placeholder="0"
          onChange={(event) => onChange(event.target.value)}
        />
        <strong>{currency}</strong>
      </div>

      <style jsx>{`
        .money-field {
          min-width: 0;
          display: grid;
          gap: 7px;
        }

        .money-field > span {
          color: #81899c;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.08em;
        }

        .money-field > div {
          display: flex;
          align-items: center;
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.13);
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.18);
        }

        .money-field > div:focus-within {
          border-color: rgba(167, 139, 250, 0.62);
          box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.07);
        }

        .money-field input {
          min-width: 0;
          flex: 1;
          min-height: 41px;
          padding: 0 11px;
          border: 0;
          outline: none;
          background: transparent;
          color: #ffffff;
          font: inherit;
          font-size: 11px;
        }

        .money-field strong {
          flex: 0 0 auto;
          padding: 0 10px;
          color: #71798b;
          font-size: 9px;
        }
      `}</style>
    </label>
  );
}