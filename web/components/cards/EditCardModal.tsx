"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  type EditableCardData,
  type UpdateCardResult,
  updateCard,
} from "@/lib/cards/updateCard";

type BooleanChoice =
  | "unknown"
  | "yes"
  | "no";

type EditCardForm = {
  playerName: string;
  sport: string;
  team: string;
  manufacturer: string;
  brand: string;
  product: string;
  setName: string;
  year: string;
  cardNumber: string;
  parallel: string;
  serialNumber: string;
  serialNumberedTo: string;
  rookieCard: BooleanChoice;
  autograph: BooleanChoice;
  memorabilia: BooleanChoice;
  memorabiliaType: string;
  gradingCompany: string;
  grade: string;
  certificationNumber: string;
  language: string;
  variation: string;
  purchasePrice: string;
  estimatedValue: string;
  purchaseSource: string;
  userNotes: string;
};

type EditCardModalProps = {
  isOpen: boolean;

  cardId: string;

  initialCard: EditableCardData;

  initialPurchasePrice:
    | number
    | null;

  initialEstimatedValue:
    | number
    | null;

  initialPurchaseSource:
    | string
    | null;

  initialUserNotes:
    | string
    | null;

  currency?: string;

  onClose: () => void;

  onUpdated: (
    result: UpdateCardResult
  ) => void;
};

function textValue(
  value: string | null
) {
  return value ?? "";
}

function numberValue(
  value: number | null
) {
  return value === null
    ? ""
    : String(value);
}

function booleanToChoice(
  value: boolean | null
): BooleanChoice {
  if (value === true) {
    return "yes";
  }

  if (value === false) {
    return "no";
  }

  return "unknown";
}

function choiceToBoolean(
  value: BooleanChoice
) {
  if (value === "yes") {
    return true;
  }

  if (value === "no") {
    return false;
  }

  return null;
}

function optionalText(
  value: string
) {
  const normalizedValue =
    value.trim();

  return normalizedValue || null;
}

function getPrintRunFromSerial(
  serialNumber: string | null
) {
  if (!serialNumber) {
    return null;
  }

  const match =
    serialNumber.match(
      /\/\s*(\d+)\s*$/
    );

  if (!match) {
    return null;
  }

  const parsedValue =
    Number(match[1]);

  return Number.isInteger(
    parsedValue
  ) && parsedValue > 0
    ? parsedValue
    : null;
}

function parsePositiveInteger(
  value: string
) {
  const normalizedValue =
    value.trim();

  if (!normalizedValue) {
    return null;
  }

  const parsedValue =
    Number(normalizedValue);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue < 1
  ) {
    throw new Error(
      "Print run skal være et positivt heltal."
    );
  }

  return parsedValue;
}

function createInitialForm({
  card,
  purchasePrice,
  estimatedValue,
  purchaseSource,
  userNotes,
}: {
  card: EditableCardData;

  purchasePrice:
    | number
    | null;

  estimatedValue:
    | number
    | null;

  purchaseSource:
    | string
    | null;

  userNotes:
    | string
    | null;
}): EditCardForm {
  const printRun =
    card.serialNumberedTo ??
    getPrintRunFromSerial(
      card.serialNumber
    );

  return {
    playerName:
      card.playerName,

    sport:
      textValue(card.sport),

    team:
      textValue(card.team),

    manufacturer:
      textValue(
        card.manufacturer
      ),

    brand:
      textValue(card.brand),

    product:
      textValue(card.product),

    setName:
      textValue(card.setName),

    year:
      textValue(card.year),

    cardNumber:
      textValue(
        card.cardNumber
      ),

    parallel:
      textValue(card.parallel),

    serialNumber:
      textValue(
        card.serialNumber
      ),

    serialNumberedTo:
      numberValue(printRun),

    rookieCard:
      booleanToChoice(
        card.rookieCard
      ),

    autograph:
      booleanToChoice(
        card.autograph
      ),

    memorabilia:
      booleanToChoice(
        card.memorabilia
      ),

    memorabiliaType:
      textValue(
        card.memorabiliaType
      ),

    gradingCompany:
      textValue(
        card.gradingCompany
      ),

    grade:
      textValue(card.grade),

    certificationNumber:
      textValue(
        card.certificationNumber
      ),

    language:
      textValue(card.language),

    variation:
      textValue(card.variation),

    purchasePrice:
      numberValue(purchasePrice),

    estimatedValue:
      numberValue(
        estimatedValue
      ),

    purchaseSource:
      textValue(purchaseSource),

    userNotes:
      textValue(userNotes),
  };
}

function getReadableError(
  error: unknown
) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Kortet kunne ikke opdateres. Prøv igen.";
}

export default function EditCardModal({
  isOpen,
  cardId,
  initialCard,
  initialPurchasePrice,
  initialEstimatedValue,
  initialPurchaseSource,
  initialUserNotes,
  currency = "DKK",
  onClose,
  onUpdated,
}: EditCardModalProps) {
  const [
    form,
    setForm,
  ] = useState<EditCardForm>(
    () =>
      createInitialForm({
        card: initialCard,

        purchasePrice:
          initialPurchasePrice,

        estimatedValue:
          initialEstimatedValue,

        purchaseSource:
          initialPurchaseSource,

        userNotes:
          initialUserNotes,
      })
  );

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setForm(
      createInitialForm({
        card: initialCard,

        purchasePrice:
          initialPurchasePrice,

        estimatedValue:
          initialEstimatedValue,

        purchaseSource:
          initialPurchaseSource,

        userNotes:
          initialUserNotes,
      })
    );

    setIsSaving(false);
    setErrorMessage(null);
  }, [
    isOpen,
    cardId,
    initialCard,
    initialPurchasePrice,
    initialEstimatedValue,
    initialPurchaseSource,
    initialUserNotes,
  ]);

  const handleClose =
    useCallback(() => {
      if (isSaving) {
        return;
      }

      onClose();
    }, [
      isSaving,
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
        event.key === "Escape" &&
        !isSaving
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
    isSaving,
  ]);

  function updateField<
    Field extends keyof EditCardForm,
  >(
    field: Field,
    value: EditCardForm[Field]
  ) {
    setForm(
      (currentForm) => ({
        ...currentForm,
        [field]: value,
      })
    );

    setErrorMessage(null);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      !form.playerName.trim()
    ) {
      setErrorMessage(
        "Spillernavn er obligatorisk."
      );

      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const explicitPrintRun =
        parsePositiveInteger(
          form.serialNumberedTo
        );

      const serialNumber =
        optionalText(
          form.serialNumber
        );

      const inferredPrintRun =
        getPrintRunFromSerial(
          serialNumber
        );

      if (
        explicitPrintRun !== null &&
        inferredPrintRun !== null &&
        explicitPrintRun !==
          inferredPrintRun
      ) {
        throw new Error(
          "Print run matcher ikke tallet efter skråstregen i serienummeret."
        );
      }

      const memorabilia =
        choiceToBoolean(
          form.memorabilia
        );

      const result =
        await updateCard({
          cardId,

          card: {
            playerName:
              form.playerName.trim(),

            sport:
              optionalText(
                form.sport
              ),

            team:
              optionalText(
                form.team
              ),

            manufacturer:
              optionalText(
                form.manufacturer
              ),

            brand:
              optionalText(
                form.brand
              ),

            product:
              optionalText(
                form.product
              ),

            setName:
              optionalText(
                form.setName
              ),

            year:
              optionalText(
                form.year
              ),

            cardNumber:
              optionalText(
                form.cardNumber
              ),

            parallel:
              optionalText(
                form.parallel
              ),

            serialNumber,

            serialNumberedTo:
              explicitPrintRun ??
              inferredPrintRun,

            rookieCard:
              choiceToBoolean(
                form.rookieCard
              ),

            autograph:
              choiceToBoolean(
                form.autograph
              ),

            memorabilia,

            memorabiliaType:
              memorabilia === true
                ? optionalText(
                    form.memorabiliaType
                  )
                : null,

            gradingCompany:
              optionalText(
                form.gradingCompany
              ),

            grade:
              optionalText(
                form.grade
              ),

            certificationNumber:
              optionalText(
                form.certificationNumber
              ),

            language:
              optionalText(
                form.language
              ),

            variation:
              optionalText(
                form.variation
              ),
          },

          purchasePrice:
            form.purchasePrice,

          estimatedValue:
            form.estimatedValue,

          purchaseSource:
            form.purchaseSource,

          userNotes:
            form.userNotes,
        });

      setIsSaving(false);

      onUpdated(result);
    } catch (error) {
      setErrorMessage(
        getReadableError(error)
      );

      setIsSaving(false);
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="edit-card-backdrop"
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
        className="edit-card-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-card-title"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <header className="edit-card-header">
          <div>
            <span className="edit-card-badge">
              CARD DNA
            </span>

            <h2 id="edit-card-title">
              Edit card
            </h2>

            <p>
              Update the identity,
              financial details, grading
              information and personal
              notes.
            </p>
          </div>

          <button
            className="edit-card-close"
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            aria-label="Close edit card"
          >
            ×
          </button>
        </header>

        <form
          className="edit-card-form"
          onSubmit={handleSubmit}
        >
          <fieldset
            className="edit-card-fieldset"
            disabled={isSaving}
          >
            <div className="edit-card-content">
              <section className="edit-section">
                <div className="edit-section-heading">
                  <div>
                    <span>
                      IDENTITY
                    </span>

                    <h3>
                      Card information
                    </h3>

                    <p>
                      These fields control
                      how the card appears
                      throughout
                      NECardPilot.
                    </p>
                  </div>
                </div>

                <div className="edit-grid">
                  <TextField
                    label="Player"
                    value={
                      form.playerName
                    }
                    required
                    autoFocus
                    onChange={(value) =>
                      updateField(
                        "playerName",
                        value
                      )
                    }
                  />

                  <TextField
                    label="Team"
                    value={form.team}
                    placeholder="Los Angeles Lakers"
                    onChange={(value) =>
                      updateField(
                        "team",
                        value
                      )
                    }
                  />

                  <TextField
                    label="Sport"
                    value={form.sport}
                    placeholder="Basketball"
                    onChange={(value) =>
                      updateField(
                        "sport",
                        value
                      )
                    }
                  />

                  <TextField
                    label="Year / season"
                    value={form.year}
                    placeholder="2025-26"
                    onChange={(value) =>
                      updateField(
                        "year",
                        value
                      )
                    }
                  />

                  <TextField
                    label="Manufacturer"
                    value={
                      form.manufacturer
                    }
                    placeholder="Topps"
                    onChange={(value) =>
                      updateField(
                        "manufacturer",
                        value
                      )
                    }
                  />

                  <TextField
                    label="Brand"
                    value={form.brand}
                    placeholder="Cosmic Chrome"
                    onChange={(value) =>
                      updateField(
                        "brand",
                        value
                      )
                    }
                  />

                  <TextField
                    label="Product"
                    value={form.product}
                    placeholder="Topps Cosmic Chrome Basketball"
                    wide
                    onChange={(value) =>
                      updateField(
                        "product",
                        value
                      )
                    }
                  />

                  <TextField
                    label="Set / insert"
                    value={form.setName}
                    placeholder="Extraterrestrial Talent"
                    onChange={(value) =>
                      updateField(
                        "setName",
                        value
                      )
                    }
                  />

                  <TextField
                    label="Card number"
                    value={
                      form.cardNumber
                    }
                    placeholder="ET-8"
                    onChange={(value) =>
                      updateField(
                        "cardNumber",
                        value
                      )
                    }
                  />

                  <TextField
                    label="Parallel"
                    value={form.parallel}
                    placeholder="Purple Nebula Refractor"
                    wide
                    onChange={(value) =>
                      updateField(
                        "parallel",
                        value
                      )
                    }
                  />

                  <TextField
                    label="Serial number"
                    value={
                      form.serialNumber
                    }
                    placeholder="044/150"
                    onChange={(value) =>
                      updateField(
                        "serialNumber",
                        value
                      )
                    }
                  />

                  <TextField
                    label="Print run"
                    value={
                      form.serialNumberedTo
                    }
                    inputMode="numeric"
                    placeholder="150"
                    onChange={(value) =>
                      updateField(
                        "serialNumberedTo",
                        value
                      )
                    }
                  />

                  <TextField
                    label="Variation"
                    value={
                      form.variation
                    }
                    placeholder="Optional"
                    onChange={(value) =>
                      updateField(
                        "variation",
                        value
                      )
                    }
                  />

                  <TextField
                    label="Language"
                    value={
                      form.language
                    }
                    placeholder="en"
                    onChange={(value) =>
                      updateField(
                        "language",
                        value
                      )
                    }
                  />
                </div>
              </section>

              <section className="edit-section">
                <div className="edit-section-heading">
                  <div>
                    <span>
                      FEATURES
                    </span>

                    <h3>
                      Special attributes
                    </h3>

                    <p>
                      Confirm whether the
                      card is a rookie,
                      autograph or
                      memorabilia card.
                    </p>
                  </div>
                </div>

                <div className="edit-choice-grid">
                  <ChoiceField
                    label="Rookie card"
                    value={
                      form.rookieCard
                    }
                    onChange={(value) =>
                      updateField(
                        "rookieCard",
                        value
                      )
                    }
                  />

                  <ChoiceField
                    label="Autograph"
                    value={
                      form.autograph
                    }
                    onChange={(value) =>
                      updateField(
                        "autograph",
                        value
                      )
                    }
                  />

                  <ChoiceField
                    label="Memorabilia"
                    value={
                      form.memorabilia
                    }
                    onChange={(value) =>
                      updateField(
                        "memorabilia",
                        value
                      )
                    }
                  />
                </div>

                {form.memorabilia ===
                  "yes" && (
                  <div className="edit-extra-field">
                    <TextField
                      label="Memorabilia type"
                      value={
                        form.memorabiliaType
                      }
                      placeholder="Game-worn jersey, patch..."
                      wide
                      onChange={(
                        value
                      ) =>
                        updateField(
                          "memorabiliaType",
                          value
                        )
                      }
                    />
                  </div>
                )}
              </section>

              <section className="edit-section">
                <div className="edit-section-heading">
                  <div>
                    <span>
                      GRADING
                    </span>

                    <h3>
                      Grading details
                    </h3>

                    <p>
                      Leave these fields
                      empty when the card
                      is raw.
                    </p>
                  </div>
                </div>

                <div className="edit-grid">
                  <TextField
                    label="Grading company"
                    value={
                      form.gradingCompany
                    }
                    placeholder="PSA, BGS, SGC..."
                    onChange={(value) =>
                      updateField(
                        "gradingCompany",
                        value
                      )
                    }
                  />

                  <TextField
                    label="Grade"
                    value={form.grade}
                    placeholder="10"
                    onChange={(value) =>
                      updateField(
                        "grade",
                        value
                      )
                    }
                  />

                  <TextField
                    label="Certification number"
                    value={
                      form.certificationNumber
                    }
                    placeholder="Certification number"
                    wide
                    onChange={(value) =>
                      updateField(
                        "certificationNumber",
                        value
                      )
                    }
                  />
                </div>
              </section>

              <section className="edit-section edit-finance-section">
                <div className="edit-section-heading">
                  <div>
                    <span>
                      OWNERSHIP
                    </span>

                    <h3>
                      Financial details
                    </h3>

                    <p>
                      Purchase and value
                      information is shown
                      in your portfolio.
                    </p>
                  </div>
                </div>

                <div className="edit-grid">
                  <MoneyField
                    label="Purchase price"
                    value={
                      form.purchasePrice
                    }
                    currency={currency}
                    onChange={(value) =>
                      updateField(
                        "purchasePrice",
                        value
                      )
                    }
                  />

                  <MoneyField
                    label="Estimated value"
                    value={
                      form.estimatedValue
                    }
                    currency={currency}
                    onChange={(value) =>
                      updateField(
                        "estimatedValue",
                        value
                      )
                    }
                  />

                  <TextField
                    label="Purchase source"
                    value={
                      form.purchaseSource
                    }
                    placeholder="Card show, eBay, Facebook..."
                    wide
                    onChange={(value) =>
                      updateField(
                        "purchaseSource",
                        value
                      )
                    }
                  />
                </div>

                <label className="edit-notes-field">
                  <span>
                    Personal notes
                  </span>

                  <textarea
                    value={
                      form.userNotes
                    }
                    onChange={(event) =>
                      updateField(
                        "userNotes",
                        event.target.value
                      )
                    }
                    placeholder="Condition, seller, reason for buying or other notes..."
                  />
                </label>
              </section>

              <div className="edit-information">
                <span>✦</span>

                <p>
                  Your manual changes are
                  saved as verified Card
                  DNA. Existing AI
                  confidence and AI notes
                  are preserved.
                </p>
              </div>

              {errorMessage && (
                <div
                  className="edit-error"
                  role="alert"
                >
                  <span>!</span>

                  <div>
                    <strong>
                      Card could not be
                      updated
                    </strong>

                    <p>
                      {errorMessage}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </fieldset>

          <footer className="edit-card-footer">
            <p>
              Changes are applied to the
              card and its Card DNA.
            </p>

            <div className="edit-card-actions">
              <button
                className="edit-cancel-button"
                type="button"
                onClick={handleClose}
                disabled={isSaving}
              >
                Cancel
              </button>

              <button
                className="edit-save-button"
                type="submit"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <span className="edit-spinner" />
                    Saving changes...
                  </>
                ) : (
                  <>
                    <span>✓</span>
                    Save changes
                  </>
                )}
              </button>
            </div>
          </footer>
        </form>
      </section>

      <style jsx>{`
        .edit-card-backdrop {
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

        .edit-card-modal {
          width: min(
            1000px,
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

        .edit-card-header {
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

        .edit-card-badge {
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

        .edit-card-header h2 {
          margin: 13px 0 0;
          color: #ffffff;
          font-size: 28px;
          letter-spacing: -0.035em;
        }

        .edit-card-header p {
          max-width: 610px;
          margin: 8px 0 0;
          color: #9299aa;
          font-size: 14px;
          line-height: 1.55;
        }

        .edit-card-close {
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

        .edit-card-close:hover:not(
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

        .edit-card-close:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .edit-card-form {
          min-width: 0;
        }

        .edit-card-fieldset {
          min-width: 0;
          margin: 0;
          padding: 0;
          border: 0;
        }

        .edit-card-content {
          display: grid;
          gap: 20px;
          padding: 28px 30px;
        }

        .edit-section {
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

        .edit-finance-section {
          background:
            radial-gradient(
              circle at top right,
              rgba(
                124,
                92,
                255,
                0.08
              ),
              transparent 43%
            ),
            rgba(
              255,
              255,
              255,
              0.022
            );
        }

        .edit-section-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 17px;
        }

        .edit-section-heading span {
          color: #9f93ff;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.15em;
        }

        .edit-section-heading h3 {
          margin: 7px 0 0;
          color: #ffffff;
          font-size: 18px;
          letter-spacing: -0.02em;
        }

        .edit-section-heading p {
          margin: 6px 0 0;
          color: #71798b;
          font-size: 12px;
          line-height: 1.5;
        }

        .edit-grid {
          display: grid;
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
          gap: 12px;
        }

        .edit-choice-grid {
          display: grid;
          grid-template-columns:
            repeat(
              3,
              minmax(0, 1fr)
            );
          gap: 12px;
        }

        .edit-extra-field {
          margin-top: 12px;
        }

        .edit-notes-field {
          display: grid;
          gap: 8px;
          margin-top: 12px;
        }

        .edit-notes-field > span {
          color: #81899c;
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .edit-notes-field textarea {
          width: 100%;
          min-height: 105px;
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

        .edit-notes-field textarea:focus {
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

        .edit-information,
        .edit-error {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 15px 16px;
          border-radius: 15px;
        }

        .edit-information {
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

        .edit-error {
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

        .edit-information > span,
        .edit-error > span {
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

        .edit-information p,
        .edit-error p {
          margin: 0;
          color: currentColor;
          font-size: 12px;
          line-height: 1.55;
          opacity: 0.8;
        }

        .edit-error strong {
          display: block;
          margin-bottom: 4px;
          font-size: 13px;
        }

        .edit-card-footer {
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

        .edit-card-footer > p {
          margin: 0;
          color: #71798b;
          font-size: 12px;
          line-height: 1.5;
        }

        .edit-card-actions {
          flex: 0 0 auto;
          display: flex;
          gap: 11px;
        }

        .edit-cancel-button,
        .edit-save-button {
          min-height: 46px;
          padding: 0 19px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 750;
          cursor: pointer;
        }

        .edit-cancel-button {
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

        .edit-cancel-button:hover:not(
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

        .edit-save-button {
          min-width: 165px;
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

        .edit-save-button:hover:not(
            :disabled
          ) {
          filter: brightness(
            1.08
          );
        }

        .edit-cancel-button:disabled,
        .edit-save-button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .edit-spinner {
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
          animation: edit-spin
            700ms linear infinite;
        }

        @keyframes edit-spin {
          to {
            transform: rotate(
              360deg
            );
          }
        }

        @media (
          max-width: 700px
        ) {
          .edit-card-backdrop {
            align-items: flex-end;
            padding: 10px;
          }

          .edit-card-modal {
            max-height: calc(
              100vh - 20px
            );
            border-radius: 22px;
          }

          .edit-card-header,
          .edit-card-content,
          .edit-card-footer {
            padding-left: 20px;
            padding-right: 20px;
          }

          .edit-card-header h2 {
            font-size: 24px;
          }

          .edit-grid,
          .edit-choice-grid {
            grid-template-columns:
              1fr;
          }

          .edit-card-footer {
            align-items: stretch;
            flex-direction: column;
            gap: 14px;
          }

          .edit-card-actions {
            display: grid;
            grid-template-columns:
              1fr 1fr;
          }

          .edit-cancel-button,
          .edit-save-button {
            width: 100%;
            min-width: 0;
          }
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

  wide?: boolean;

  autoFocus?: boolean;

  inputMode?:
    | "text"
    | "decimal"
    | "numeric";

  onChange: (
    value: string
  ) => void;
};

function TextField({
  label,
  value,
  placeholder,
  required = false,
  wide = false,
  autoFocus = false,
  inputMode = "text",
  onChange,
}: TextFieldProps) {
  return (
    <label
      className={[
        "edit-text-field",

        wide
          ? "edit-text-field-wide"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span>
        {label}

        {required && (
          <strong> *</strong>
        )}
      </span>

      <input
        type="text"
        inputMode={inputMode}
        value={value}
        required={required}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
      />

      <style jsx>{`
        .edit-text-field {
          min-width: 0;
          display: grid;
          gap: 7px;
          padding: 12px 13px;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.11
            );
          border-radius: 13px;
          background: rgba(
            0,
            0,
            0,
            0.14
          );
        }

        .edit-text-field-wide {
          grid-column: 1 / -1;
        }

        .edit-text-field > span {
          color: #71798b;
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .edit-text-field > span strong {
          color: #fca5a5;
        }

        .edit-text-field input {
          width: 100%;
          min-width: 0;
          padding: 0;
          border: 0;
          outline: none;
          background: transparent;
          color: #f8fafc;
          font: inherit;
          font-size: 13px;
          font-weight: 650;
          line-height: 1.45;
        }

        .edit-text-field input::placeholder {
          color: #4f5666;
          font-weight: 500;
        }

        .edit-text-field:focus-within {
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

        @media (
          max-width: 700px
        ) {
          .edit-text-field-wide {
            grid-column: auto;
          }
        }
      `}</style>
    </label>
  );
}

type ChoiceFieldProps = {
  label: string;

  value: BooleanChoice;

  onChange: (
    value: BooleanChoice
  ) => void;
};

function ChoiceField({
  label,
  value,
  onChange,
}: ChoiceFieldProps) {
  return (
    <label className="edit-choice-field">
      <span>{label}</span>

      <select
        value={value}
        onChange={(event) =>
          onChange(
            event.target
              .value as BooleanChoice
          )
        }
      >
        <option value="unknown">
          Unknown
        </option>

        <option value="no">
          No
        </option>

        <option value="yes">
          Yes
        </option>
      </select>

      <style jsx>{`
        .edit-choice-field {
          display: grid;
          gap: 8px;
          padding: 12px 13px;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.11
            );
          border-radius: 13px;
          background: rgba(
            0,
            0,
            0,
            0.14
          );
        }

        .edit-choice-field span {
          color: #71798b;
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .edit-choice-field select {
          width: 100%;
          padding: 0;
          border: 0;
          outline: none;
          background: transparent;
          color: #f8fafc;
          font: inherit;
          font-size: 13px;
          font-weight: 650;
          cursor: pointer;
        }

        .edit-choice-field select option {
          background: #11131c;
          color: #ffffff;
        }

        .edit-choice-field:focus-within {
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

type MoneyFieldProps = {
  label: string;

  value: string;

  currency: string;

  onChange: (
    value: string
  ) => void;
};

function MoneyField({
  label,
  value,
  currency,
  onChange,
}: MoneyFieldProps) {
  return (
    <label className="edit-money-field">
      <span>{label}</span>

      <div>
        <input
          type="text"
          inputMode="decimal"
          value={value}
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
        .edit-money-field {
          min-width: 0;
          display: grid;
          gap: 7px;
        }

        .edit-money-field > span {
          color: #81899c;
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .edit-money-field > div {
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

        .edit-money-field input {
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

        .edit-money-field strong {
          flex: 0 0 auto;
          padding: 0 13px;
          color: #71798b;
          font-size: 11px;
        }

        .edit-money-field > div:focus-within {
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