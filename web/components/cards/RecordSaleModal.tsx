"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  recordSale,
  type RecordSaleResult,
} from "@/lib/cards/recordSale";

type RecordSaleModalProps = {
  isOpen: boolean;

  cardId: string;

  playerName: string;

  currency?: string;

  costBasis: number | null;

  estimatedValue: number | null;

  onClose: () => void;

  onSold: (
    result: RecordSaleResult
  ) => void;
};

type SaleForm = {
  salePrice: string;

  shippingIncome: string;

  platformFee: string;

  paymentFee: string;

  shippingCost: string;

  otherCosts: string;

  platform: string;

  buyer: string;

  reference: string;

  notes: string;

  soldAt: string;
};

function getLocalDateTimeValue(
  date = new Date()
) {
  const localDate = new Date(
    date.getTime() -
      date.getTimezoneOffset() *
        60_000
  );

  return localDate
    .toISOString()
    .slice(0, 16);
}

function createInitialForm(): SaleForm {
  return {
    salePrice: "",

    shippingIncome: "",

    platformFee: "",

    paymentFee: "",

    shippingCost: "",

    otherCosts: "",

    platform: "",

    buyer: "",

    reference: "",

    notes: "",

    soldAt:
      getLocalDateTimeValue(),
  };
}

function normalizeNumberString(
  value: string
) {
  let normalizedValue = value
    .trim()
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");

  const lastComma =
    normalizedValue.lastIndexOf(
      ","
    );

  const lastDot =
    normalizedValue.lastIndexOf(
      "."
    );

  if (
    lastComma >= 0 &&
    lastDot >= 0
  ) {
    if (lastComma > lastDot) {
      normalizedValue =
        normalizedValue
          .replace(/\./g, "")
          .replace(/,/g, ".");
    } else {
      normalizedValue =
        normalizedValue.replace(
          /,/g,
          ""
        );
    }
  } else if (lastComma >= 0) {
    normalizedValue =
      normalizedValue.replace(
        /,/g,
        "."
      );
  } else if (lastDot >= 0) {
    const parts =
      normalizedValue.split(".");

    if (
      parts.length === 2 &&
      parts[1]?.length === 3
    ) {
      normalizedValue =
        parts.join("");
    }
  }

  return normalizedValue;
}

function parseMoneyForPreview(
  value: string
) {
  if (!value.trim()) {
    return 0;
  }

  const parsedValue = Number(
    normalizeNumberString(value)
  );

  if (
    !Number.isFinite(
      parsedValue
    )
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(
      (
        parsedValue +
        Number.EPSILON
      ) *
        100
    ) / 100
  );
}

function formatCurrency(
  value: number,
  currency: string
) {
  if (currency === "DKK") {
    return `${value.toLocaleString(
      "da-DK",
      {
        minimumFractionDigits:
          value % 1 === 0 ? 0 : 2,

        maximumFractionDigits: 2,
      }
    )} kr.`;
  }

  return new Intl.NumberFormat(
    "da-DK",
    {
      style: "currency",
      currency,

      maximumFractionDigits: 2,
    }
  ).format(value);
}

function formatPercentage(
  value: number | null
) {
  if (value === null) {
    return "—";
  }

  return `${value.toLocaleString(
    "da-DK",
    {
      maximumFractionDigits: 1,
    }
  )}%`;
}

function getReadableError(
  error: unknown
) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Salget kunne ikke registreres. Prøv igen.";
}

export default function RecordSaleModal({
  isOpen,
  cardId,
  playerName,
  currency = "DKK",
  costBasis,
  estimatedValue,
  onClose,
  onSold,
}: RecordSaleModalProps) {
  const [
    form,
    setForm,
  ] = useState<SaleForm>(
    () => createInitialForm()
  );

  const [
    confirmed,
    setConfirmed,
  ] = useState(false);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setForm(
      createInitialForm()
    );

    setConfirmed(false);

    setIsSubmitting(false);

    setErrorMessage(null);
  }, [
    isOpen,
    cardId,
  ]);

  const handleClose =
    useCallback(() => {
      if (isSubmitting) {
        return;
      }

      onClose();
    }, [
      isSubmitting,
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
        !isSubmitting
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
    isSubmitting,
  ]);

  function updateField<
    Field extends keyof SaleForm,
  >(
    field: Field,
    value: SaleForm[Field]
  ) {
    setForm(
      (currentForm) => ({
        ...currentForm,

        [field]: value,
      })
    );

    setErrorMessage(null);
  }

  const calculations =
    useMemo(() => {
      const salePrice =
        parseMoneyForPreview(
          form.salePrice
        );

      const shippingIncome =
        parseMoneyForPreview(
          form.shippingIncome
        );

      const platformFee =
        parseMoneyForPreview(
          form.platformFee
        );

      const paymentFee =
        parseMoneyForPreview(
          form.paymentFee
        );

      const shippingCost =
        parseMoneyForPreview(
          form.shippingCost
        );

      const otherCosts =
        parseMoneyForPreview(
          form.otherCosts
        );

      const normalizedCostBasis =
        costBasis ?? 0;

      const grossAmount =
        salePrice +
        shippingIncome;

      const totalSaleCosts =
        platformFee +
        paymentFee +
        shippingCost +
        otherCosts;

      const netProceeds =
        grossAmount -
        totalSaleCosts;

      const realizedProfit =
        netProceeds -
        normalizedCostBasis;

      const realizedRoi =
        normalizedCostBasis > 0
          ? (
              realizedProfit /
              normalizedCostBasis
            ) *
            100
          : null;

      return {
        salePrice,

        shippingIncome,

        platformFee,

        paymentFee,

        shippingCost,

        otherCosts,

        grossAmount,

        totalSaleCosts,

        netProceeds,

        normalizedCostBasis,

        realizedProfit,

        realizedRoi,
      };
    }, [
      form.salePrice,
      form.shippingIncome,
      form.platformFee,
      form.paymentFee,
      form.shippingCost,
      form.otherCosts,
      costBasis,
    ]);

  const canSubmit =
    calculations.salePrice > 0 &&
    confirmed &&
    !isSubmitting;

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      calculations.salePrice <= 0
    ) {
      setErrorMessage(
        "Indtast en salgspris større end 0."
      );

      return;
    }

    if (!confirmed) {
      setErrorMessage(
        "Bekræft, at kortet skal registreres som solgt."
      );

      return;
    }

    setIsSubmitting(true);

    setErrorMessage(null);

    try {
      const result =
        await recordSale({
          cardId,

          salePrice:
            form.salePrice,

          shippingIncome:
            form.shippingIncome,

          platformFee:
            form.platformFee,

          paymentFee:
            form.paymentFee,

          shippingCost:
            form.shippingCost,

          otherCosts:
            form.otherCosts,

          platform:
            form.platform,

          buyer:
            form.buyer,

          reference:
            form.reference,

          notes:
            form.notes,

          soldAt:
            form.soldAt,
        });

      setIsSubmitting(false);

      onSold(result);
    } catch (error) {
      setErrorMessage(
        getReadableError(error)
      );

      setIsSubmitting(false);
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="record-sale-backdrop"
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
        className="record-sale-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-sale-title"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <header className="record-sale-header">
          <div>
            <span className="record-sale-badge">
              TRANSACTION
            </span>

            <h2 id="record-sale-title">
              Record sale
            </h2>

            <p>
              Register the sale of{" "}
              <strong>
                {playerName}
              </strong>
              . NECardPilot calculates
              your net proceeds and
              realized profit before
              confirming the transaction.
            </p>
          </div>

          <button
            className="record-sale-close"
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Close record sale"
          >
            ×
          </button>
        </header>

        <form
          className="record-sale-form"
          onSubmit={handleSubmit}
        >
          <fieldset
            className="record-sale-fieldset"
            disabled={isSubmitting}
          >
            <div className="record-sale-content">
              <section className="sale-context">
                <div>
                  <span>
                    COST BASIS
                  </span>

                  <strong>
                    {formatCurrency(
                      calculations
                        .normalizedCostBasis,
                      currency
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    ESTIMATED VALUE
                  </span>

                  <strong>
                    {estimatedValue ===
                    null
                      ? "—"
                      : formatCurrency(
                          estimatedValue,
                          currency
                        )}
                  </strong>
                </div>

                <div>
                  <span>
                    STATUS AFTER SALE
                  </span>

                  <strong>
                    Sold
                  </strong>
                </div>
              </section>

              {costBasis === null && (
                <div className="cost-basis-warning">
                  <span>!</span>

                  <div>
                    <strong>
                      Purchase price is
                      missing
                    </strong>

                    <p>
                      Realized profit will
                      be calculated with a
                      cost basis of 0{" "}
                      {currency}. Cancel
                      the sale and edit
                      the card first if
                      this is incorrect.
                    </p>
                  </div>
                </div>
              )}

              <section className="sale-section">
                <div className="sale-section-heading">
                  <div>
                    <span>
                      SALE DETAILS
                    </span>

                    <h3>
                      Revenue
                    </h3>

                    <p>
                      Enter the price and
                      any shipping amount
                      paid by the buyer.
                    </p>
                  </div>
                </div>

                <div className="sale-grid">
                  <MoneyField
                    label="Sale price"
                    value={
                      form.salePrice
                    }
                    currency={
                      currency
                    }
                    required
                    autoFocus
                    onChange={(value) =>
                      updateField(
                        "salePrice",
                        value
                      )
                    }
                  />

                  <MoneyField
                    label="Shipping paid by buyer"
                    value={
                      form.shippingIncome
                    }
                    currency={
                      currency
                    }
                    onChange={(value) =>
                      updateField(
                        "shippingIncome",
                        value
                      )
                    }
                  />

                  <DateTimeField
                    label="Sale date"
                    value={
                      form.soldAt
                    }
                    onChange={(value) =>
                      updateField(
                        "soldAt",
                        value
                      )
                    }
                  />

                  <TextField
                    label="Platform"
                    value={
                      form.platform
                    }
                    placeholder="eBay, Whatnot, Facebook..."
                    list="sale-platform-options"
                    onChange={(value) =>
                      updateField(
                        "platform",
                        value
                      )
                    }
                  />

                  <TextField
                    label="Buyer"
                    value={
                      form.buyer
                    }
                    placeholder="Name or username"
                    onChange={(value) =>
                      updateField(
                        "buyer",
                        value
                      )
                    }
                  />

                  <TextField
                    label="Reference"
                    value={
                      form.reference
                    }
                    placeholder="Order ID, invoice number..."
                    onChange={(value) =>
                      updateField(
                        "reference",
                        value
                      )
                    }
                  />
                </div>

                <datalist id="sale-platform-options">
                  <option value="eBay" />

                  <option value="Whatnot" />

                  <option value="Facebook" />

                  <option value="Card Show" />

                  <option value="Private sale" />

                  <option value="DBA" />

                  <option value="Shopify" />
                </datalist>
              </section>

              <section className="sale-section">
                <div className="sale-section-heading">
                  <div>
                    <span>
                      COSTS
                    </span>

                    <h3>
                      Fees and expenses
                    </h3>

                    <p>
                      Add every cost
                      related to the sale
                      to calculate the
                      actual result.
                    </p>
                  </div>
                </div>

                <div className="sale-cost-grid">
                  <MoneyField
                    label="Platform fee"
                    value={
                      form.platformFee
                    }
                    currency={
                      currency
                    }
                    onChange={(value) =>
                      updateField(
                        "platformFee",
                        value
                      )
                    }
                  />

                  <MoneyField
                    label="Payment fee"
                    value={
                      form.paymentFee
                    }
                    currency={
                      currency
                    }
                    onChange={(value) =>
                      updateField(
                        "paymentFee",
                        value
                      )
                    }
                  />

                  <MoneyField
                    label="Your shipping cost"
                    value={
                      form.shippingCost
                    }
                    currency={
                      currency
                    }
                    onChange={(value) =>
                      updateField(
                        "shippingCost",
                        value
                      )
                    }
                  />

                  <MoneyField
                    label="Other costs"
                    value={
                      form.otherCosts
                    }
                    currency={
                      currency
                    }
                    onChange={(value) =>
                      updateField(
                        "otherCosts",
                        value
                      )
                    }
                  />
                </div>
              </section>

              <section className="sale-calculation">
                <div className="sale-calculation-heading">
                  <div>
                    <span>
                      LIVE CALCULATION
                    </span>

                    <h3>
                      Sale result
                    </h3>
                  </div>

                  <span className="calculation-currency">
                    {currency}
                  </span>
                </div>

                <div className="calculation-rows">
                  <CalculationRow
                    label="Card sale price"
                    value={
                      calculations.salePrice
                    }
                    currency={
                      currency
                    }
                  />

                  <CalculationRow
                    label="Shipping income"
                    value={
                      calculations.shippingIncome
                    }
                    currency={
                      currency
                    }
                  />

                  <CalculationRow
                    label="Gross amount"
                    value={
                      calculations.grossAmount
                    }
                    currency={
                      currency
                    }
                    emphasized
                  />

                  <CalculationRow
                    label="Fees and sale costs"
                    value={
                      -calculations.totalSaleCosts
                    }
                    currency={
                      currency
                    }
                    negative={
                      calculations.totalSaleCosts >
                      0
                    }
                  />

                  <CalculationRow
                    label="Net proceeds"
                    value={
                      calculations.netProceeds
                    }
                    currency={
                      currency
                    }
                    emphasized
                  />

                  <CalculationRow
                    label="Cost basis"
                    value={
                      -calculations.normalizedCostBasis
                    }
                    currency={
                      currency
                    }
                    negative={
                      calculations.normalizedCostBasis >
                      0
                    }
                  />
                </div>

                <div
                  className={[
                    "profit-result",

                    calculations.realizedProfit >=
                    0
                      ? "profit-positive"
                      : "profit-negative",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div>
                    <span>
                      REALIZED PROFIT
                    </span>

                    <strong>
                      {formatCurrency(
                        calculations.realizedProfit,
                        currency
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      REALIZED ROI
                    </span>

                    <strong>
                      {formatPercentage(
                        calculations.realizedRoi
                      )}
                    </strong>
                  </div>
                </div>
              </section>

              <label className="sale-notes-field">
                <span>
                  SALE NOTES
                </span>

                <textarea
                  value={
                    form.notes
                  }
                  onChange={(event) =>
                    updateField(
                      "notes",
                      event.target.value
                    )
                  }
                  placeholder="Condition at sale, agreement with buyer, shipping information or other notes..."
                />
              </label>

              <label className="sale-confirmation">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => {
                    setConfirmed(
                      event.target.checked
                    );

                    setErrorMessage(
                      null
                    );
                  }}
                />

                <span className="confirmation-box">
                  <span>✓</span>
                </span>

                <span className="confirmation-copy">
                  <strong>
                    Confirm completed
                    sale
                  </strong>

                  <small>
                    The card will be
                    marked as Sold, and a
                    completed transaction
                    will be added to its
                    permanent history.
                  </small>
                </span>
              </label>

              {errorMessage && (
                <div
                  className="sale-error"
                  role="alert"
                >
                  <span>!</span>

                  <div>
                    <strong>
                      Sale could not be
                      recorded
                    </strong>

                    <p>
                      {errorMessage}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </fieldset>

          <footer className="record-sale-footer">
            <p>
              Net proceeds:{" "}
              <strong>
                {formatCurrency(
                  calculations.netProceeds,
                  currency
                )}
              </strong>
            </p>

            <div className="record-sale-actions">
              <button
                className="sale-cancel-button"
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>

              <button
                className="sale-confirm-button"
                type="submit"
                disabled={!canSubmit}
              >
                {isSubmitting ? (
                  <>
                    <span className="sale-spinner" />
                    Recording sale...
                  </>
                ) : (
                  <>
                    <span>✓</span>
                    Record sale
                  </>
                )}
              </button>
            </div>
          </footer>
        </form>
      </section>

      <style jsx>{`
        .record-sale-backdrop {
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
            0.9
          );
          backdrop-filter: blur(
            16px
          );
        }

        .record-sale-modal {
          width: min(
            940px,
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
                0.13
              ),
              transparent 34%
            ),
            #11131c;
          box-shadow:
            0 38px 120px
              rgba(
                0,
                0,
                0,
                0.7
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

        .record-sale-header {
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

        .record-sale-badge {
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

        .record-sale-header h2 {
          margin: 13px 0 0;
          color: #ffffff;
          font-size: 28px;
          letter-spacing: -0.035em;
        }

        .record-sale-header p {
          max-width: 650px;
          margin: 8px 0 0;
          color: #9299aa;
          font-size: 14px;
          line-height: 1.55;
        }

        .record-sale-header p strong {
          color: #d8dce5;
        }

        .record-sale-close {
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

        .record-sale-close:hover:not(
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

        .record-sale-close:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .record-sale-form {
          min-width: 0;
        }

        .record-sale-fieldset {
          min-width: 0;
          margin: 0;
          padding: 0;
          border: 0;
        }

        .record-sale-content {
          display: grid;
          gap: 20px;
          padding: 28px 30px;
        }

        .sale-context {
          display: grid;
          grid-template-columns:
            repeat(
              3,
              minmax(0, 1fr)
            );
          gap: 10px;
        }

        .sale-context > div {
          min-width: 0;
          padding: 15px 16px;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.12
            );
          border-radius: 15px;
          background: rgba(
            255,
            255,
            255,
            0.022
          );
        }

        .sale-context span {
          display: block;
          color: #71798b;
          font-size: 9px;
          font-weight: 750;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }

        .sale-context strong {
          display: block;
          margin-top: 7px;
          color: #ffffff;
          font-size: 16px;
        }

        .cost-basis-warning,
        .sale-error {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 15px 16px;
          border-radius: 15px;
        }

        .cost-basis-warning {
          border: 1px solid
            rgba(
              251,
              191,
              36,
              0.23
            );
          background: rgba(
            245,
            158,
            11,
            0.075
          );
          color: #fde68a;
        }

        .sale-error {
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

        .cost-basis-warning > span,
        .sale-error > span {
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

        .cost-basis-warning strong,
        .sale-error strong {
          display: block;
          font-size: 13px;
        }

        .cost-basis-warning p,
        .sale-error p {
          margin: 5px 0 0;
          color: currentColor;
          font-size: 12px;
          line-height: 1.55;
          opacity: 0.8;
        }

        .sale-section {
          padding: 22px;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.12
            );
          border-radius: 19px;
          background: rgba(
            255,
            255,
            255,
            0.022
          );
        }

        .sale-section-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 17px;
        }

        .sale-section-heading span,
        .sale-calculation-heading
          > div
          > span {
          color: #9f93ff;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.15em;
        }

        .sale-section-heading h3,
        .sale-calculation-heading h3 {
          margin: 7px 0 0;
          color: #ffffff;
          font-size: 18px;
          letter-spacing: -0.02em;
        }

        .sale-section-heading p {
          margin: 6px 0 0;
          color: #71798b;
          font-size: 12px;
          line-height: 1.5;
        }

        .sale-grid {
          display: grid;
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
          gap: 12px;
        }

        .sale-cost-grid {
          display: grid;
          grid-template-columns:
            repeat(
              4,
              minmax(0, 1fr)
            );
          gap: 12px;
        }

        .sale-calculation {
          padding: 22px;
          border: 1px solid
            rgba(
              139,
              92,
              246,
              0.21
            );
          border-radius: 19px;
          background:
            radial-gradient(
              circle at top right,
              rgba(
                124,
                92,
                255,
                0.1
              ),
              transparent 42%
            ),
            rgba(
              124,
              92,
              255,
              0.035
            );
        }

        .sale-calculation-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          padding-bottom: 17px;
          border-bottom: 1px solid
            rgba(
              148,
              163,
              184,
              0.1
            );
        }

        .calculation-currency {
          padding: 6px 9px;
          border-radius: 999px;
          background: rgba(
            139,
            92,
            246,
            0.1
          );
          color: #c4b5fd;
          font-size: 9px;
          font-weight: 800;
        }

        .calculation-rows {
          display: grid;
          gap: 2px;
          padding: 14px 0;
        }

        .profit-result {
          display: grid;
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
          gap: 12px;
          padding-top: 17px;
          border-top: 1px solid
            rgba(
              148,
              163,
              184,
              0.1
            );
        }

        .profit-result > div {
          padding: 16px;
          border-radius: 15px;
          background: rgba(
            0,
            0,
            0,
            0.17
          );
        }

        .profit-result span {
          display: block;
          color: #71798b;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.09em;
        }

        .profit-result strong {
          display: block;
          margin-top: 7px;
          font-size: 23px;
          letter-spacing: -0.025em;
        }

        .profit-positive strong {
          color: #86efac;
        }

        .profit-negative strong {
          color: #fca5a5;
        }

        .sale-notes-field {
          display: grid;
          gap: 8px;
        }

        .sale-notes-field > span {
          color: #81899c;
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.08em;
        }

        .sale-notes-field textarea {
          width: 100%;
          min-height: 100px;
          resize: vertical;
          padding: 13px 14px;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.13
            );
          border-radius: 13px;
          outline: none;
          background: rgba(
            0,
            0,
            0,
            0.18
          );
          color: #ffffff;
          font: inherit;
          font-size: 13px;
          line-height: 1.55;
        }

        .sale-notes-field textarea:focus {
          border-color: rgba(
            167,
            139,
            250,
            0.62
          );
          box-shadow: 0 0 0 3px
            rgba(
              124,
              92,
              255,
              0.07
            );
        }

        .sale-confirmation {
          display: flex;
          align-items: flex-start;
          gap: 13px;
          padding: 16px;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.13
            );
          border-radius: 15px;
          background: rgba(
            255,
            255,
            255,
            0.022
          );
          cursor: pointer;
        }

        .sale-confirmation input {
          position: absolute;
          width: 1px;
          height: 1px;
          opacity: 0;
          pointer-events: none;
        }

        .confirmation-box {
          flex: 0 0 auto;
          width: 23px;
          height: 23px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.3
            );
          border-radius: 7px;
          background: rgba(
            0,
            0,
            0,
            0.18
          );
          color: transparent;
          font-size: 12px;
          font-weight: 800;
        }

        .sale-confirmation
          input:checked
          + .confirmation-box {
          border-color: #8b5cf6;
          background: #7c5cff;
          color: #ffffff;
          box-shadow: 0 0 14px
            rgba(
              124,
              92,
              255,
              0.35
            );
        }

        .sale-confirmation:focus-within {
          border-color: rgba(
            167,
            139,
            250,
            0.55
          );
          box-shadow: 0 0 0 3px
            rgba(
              124,
              92,
              255,
              0.06
            );
        }

        .confirmation-copy {
          min-width: 0;
        }

        .confirmation-copy strong {
          display: block;
          color: #ffffff;
          font-size: 13px;
        }

        .confirmation-copy small {
          display: block;
          margin-top: 5px;
          color: #71798b;
          font-size: 11px;
          line-height: 1.5;
        }

        .record-sale-footer {
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

        .record-sale-footer > p {
          margin: 0;
          color: #71798b;
          font-size: 12px;
        }

        .record-sale-footer > p strong {
          color: #d9dde6;
        }

        .record-sale-actions {
          flex: 0 0 auto;
          display: flex;
          gap: 11px;
        }

        .sale-cancel-button,
        .sale-confirm-button {
          min-height: 46px;
          padding: 0 19px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 750;
          cursor: pointer;
        }

        .sale-cancel-button {
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

        .sale-cancel-button:hover:not(
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

        .sale-confirm-button {
          min-width: 160px;
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

        .sale-confirm-button:hover:not(
            :disabled
          ) {
          filter: brightness(
            1.08
          );
        }

        .sale-cancel-button:disabled,
        .sale-confirm-button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .sale-spinner {
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
          border-radius: 50%;
          animation: sale-spin
            700ms linear infinite;
        }

        @keyframes sale-spin {
          to {
            transform: rotate(
              360deg
            );
          }
        }

        @media (
          max-width: 760px
        ) {
          .record-sale-backdrop {
            align-items: flex-end;
            padding: 10px;
          }

          .record-sale-modal {
            max-height: calc(
              100vh - 20px
            );
            border-radius: 22px;
          }

          .record-sale-header,
          .record-sale-content,
          .record-sale-footer {
            padding-left: 20px;
            padding-right: 20px;
          }

          .record-sale-header h2 {
            font-size: 24px;
          }

          .sale-context,
          .sale-grid,
          .sale-cost-grid {
            grid-template-columns:
              repeat(
                2,
                minmax(0, 1fr)
              );
          }

          .record-sale-footer {
            align-items: stretch;
            flex-direction: column;
            gap: 14px;
          }

          .record-sale-actions {
            display: grid;
            grid-template-columns:
              1fr 1fr;
          }

          .sale-cancel-button,
          .sale-confirm-button {
            width: 100%;
            min-width: 0;
          }
        }

        @media (
          max-width: 520px
        ) {
          .sale-context,
          .sale-grid,
          .sale-cost-grid,
          .profit-result {
            grid-template-columns:
              1fr;
          }
        }
      `}</style>
    </div>
  );
}

type MoneyFieldProps = {
  label: string;

  value: string;

  currency: string;

  required?: boolean;

  autoFocus?: boolean;

  onChange: (
    value: string
  ) => void;
};

function MoneyField({
  label,
  value,
  currency,
  required = false,
  autoFocus = false,
  onChange,
}: MoneyFieldProps) {
  return (
    <label className="sale-money-field">
      <span>
        {label}

        {required && (
          <strong> *</strong>
        )}
      </span>

      <div>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          required={required}
          autoFocus={autoFocus}
          placeholder="0"
          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
        />

        <strong>
          {currency}
        </strong>
      </div>

      <style jsx>{`
        .sale-money-field {
          min-width: 0;
          display: grid;
          gap: 7px;
        }

        .sale-money-field > span {
          color: #81899c;
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .sale-money-field
          > span
          strong {
          color: #fca5a5;
        }

        .sale-money-field > div {
          display: flex;
          align-items: center;
          overflow: hidden;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.13
            );
          border-radius: 13px;
          background: rgba(
            0,
            0,
            0,
            0.18
          );
        }

        .sale-money-field input {
          min-width: 0;
          flex: 1;
          padding: 12px 13px;
          border: 0;
          outline: none;
          background: transparent;
          color: #ffffff;
          font: inherit;
          font-size: 13px;
        }

        .sale-money-field
          > div
          > strong {
          flex: 0 0 auto;
          padding: 0 13px;
          color: #71798b;
          font-size: 11px;
        }

        .sale-money-field
          > div:focus-within {
          border-color: rgba(
            167,
            139,
            250,
            0.62
          );
          box-shadow: 0 0 0 3px
            rgba(
              124,
              92,
              255,
              0.07
            );
        }
      `}</style>
    </label>
  );
}

type TextFieldProps = {
  label: string;

  value: string;

  placeholder?: string;

  list?: string;

  onChange: (
    value: string
  ) => void;
};

function TextField({
  label,
  value,
  placeholder,
  list,
  onChange,
}: TextFieldProps) {
  return (
    <label className="sale-text-field">
      <span>{label}</span>

      <input
        type="text"
        value={value}
        placeholder={placeholder}
        list={list}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
      />

      <style jsx>{`
        .sale-text-field {
          min-width: 0;
          display: grid;
          gap: 7px;
        }

        .sale-text-field span {
          color: #81899c;
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .sale-text-field input {
          width: 100%;
          min-width: 0;
          padding: 12px 13px;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.13
            );
          border-radius: 13px;
          outline: none;
          background: rgba(
            0,
            0,
            0,
            0.18
          );
          color: #ffffff;
          font: inherit;
          font-size: 13px;
        }

        .sale-text-field input:focus {
          border-color: rgba(
            167,
            139,
            250,
            0.62
          );
          box-shadow: 0 0 0 3px
            rgba(
              124,
              92,
              255,
              0.07
            );
        }
      `}</style>
    </label>
  );
}

type DateTimeFieldProps = {
  label: string;

  value: string;

  onChange: (
    value: string
  ) => void;
};

function DateTimeField({
  label,
  value,
  onChange,
}: DateTimeFieldProps) {
  return (
    <label className="sale-date-field">
      <span>{label}</span>

      <input
        type="datetime-local"
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
      />

      <style jsx>{`
        .sale-date-field {
          min-width: 0;
          display: grid;
          gap: 7px;
        }

        .sale-date-field span {
          color: #81899c;
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .sale-date-field input {
          width: 100%;
          min-width: 0;
          padding: 11px 13px;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.13
            );
          border-radius: 13px;
          outline: none;
          background: rgba(
            0,
            0,
            0,
            0.18
          );
          color: #ffffff;
          color-scheme: dark;
          font: inherit;
          font-size: 13px;
        }

        .sale-date-field input:focus {
          border-color: rgba(
            167,
            139,
            250,
            0.62
          );
          box-shadow: 0 0 0 3px
            rgba(
              124,
              92,
              255,
              0.07
            );
        }
      `}</style>
    </label>
  );
}

type CalculationRowProps = {
  label: string;

  value: number;

  currency: string;

  emphasized?: boolean;

  negative?: boolean;
};

function CalculationRow({
  label,
  value,
  currency,
  emphasized = false,
  negative = false,
}: CalculationRowProps) {
  return (
    <div
      className={[
        "calculation-row",

        emphasized
          ? "calculation-row-emphasized"
          : "",

        negative
          ? "calculation-row-negative"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span>{label}</span>

      <strong>
        {formatCurrency(
          value,
          currency
        )}
      </strong>

      <style jsx>{`
        .calculation-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          min-height: 37px;
          padding: 0 4px;
          color: #81899c;
          font-size: 12px;
        }

        .calculation-row strong {
          color: #d7dbe4;
          font-size: 12px;
        }

        .calculation-row-emphasized {
          margin: 3px 0;
          padding: 10px 12px;
          border-radius: 11px;
          background: rgba(
            255,
            255,
            255,
            0.032
          );
          color: #c3c8d2;
          font-weight: 700;
        }

        .calculation-row-emphasized
          strong {
          color: #ffffff;
          font-size: 14px;
        }

        .calculation-row-negative
          strong {
          color: #fca5a5;
        }
      `}</style>
    </div>
  );
}