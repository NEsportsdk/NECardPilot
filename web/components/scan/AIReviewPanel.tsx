"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { checkDuplicateCards } from "@/lib/cards/checkDuplicateCards";
import {
  hasDuplicateCheckIdentity,
  type DuplicateCardCheckResult,
  type DuplicateCardIdentity,
} from "@/lib/cards/duplicateCards";
import type {
  IdentifiedCard,
} from "@/lib/scan/identifyCard";

import {
  normalizeOptionalNumber,
  saveIdentifiedCard,
  type ReviewedCardSaveResult,
} from "@/lib/scan/saveIdentifiedCard";

import type {
  UploadCardImagesResult,
} from "@/lib/scan/uploadCardImages";

type AIReviewPanelProps = {
  collectionId: string;

  card: IdentifiedCard;

  uploadResult: UploadCardImagesResult;

  frontPreviewUrl: string | null;

  backPreviewUrl: string | null;

  onScanAgain: () => void;

  onSaved: (
    result: ReviewedCardSaveResult
  ) => void | Promise<void>;
};

type EditableTextField =
  | "sport"
  | "playerName"
  | "team"
  | "manufacturer"
  | "brand"
  | "product"
  | "setName"
  | "year"
  | "cardNumber"
  | "parallel"
  | "serialNumber"
  | "memorabiliaType"
  | "gradingCompany"
  | "grade"
  | "certificationNumber"
  | "language"
  | "variation";

type EditableBooleanField =
  | "rookieCard"
  | "autograph"
  | "memorabilia";

const CORE_FIELDS = [
  "playerName",
  "year",
  "product",
  "setName",
  "cardNumber",
] as const;

function getConfidencePercentage(
  confidence: number
) {
  if (confidence <= 1) {
    return Math.round(
      confidence * 100
    );
  }

  return Math.round(confidence);
}

function getConfidenceLabel(
  confidence: number
) {
  const percentage =
    getConfidencePercentage(
      confidence
    );

  if (percentage >= 90) {
    return "High confidence";
  }

  if (percentage >= 70) {
    return "Medium confidence";
  }

  return "Low confidence";
}

function getCardSubtitle(
  card: IdentifiedCard
) {
  return [
    card.year,
    card.product,
    card.setName,
  ]
    .filter(Boolean)
    .join(" · ");
}

function canonicalFieldName(
  field: string
) {
  const normalized = field
    .toLowerCase()
    .replace(/[\s_-]/g, "");

  const aliases: Record<
    string,
    string
  > = {
    player: "playerName",
    playername: "playerName",
    team: "team",
    sport: "sport",
    manufacturer: "manufacturer",
    brand: "brand",
    product: "product",
    set: "setName",
    setname: "setName",
    subset: "setName",
    insert: "setName",
    year: "year",
    season: "year",
    cardnumber: "cardNumber",
    parallel: "parallel",
    serial: "serialNumber",
    serialnumber: "serialNumber",
    serialnumberedto:
      "serialNumberedTo",
    rookie: "rookieCard",
    rookiecard: "rookieCard",
    autograph: "autograph",
    memorabilia: "memorabilia",
    memorabiliatype:
      "memorabiliaType",
    gradingcompany:
      "gradingCompany",
    grade: "grade",
    certificationnumber:
      "certificationNumber",
    language: "language",
    variation: "variation",
  };

  return (
    aliases[normalized] ?? field
  );
}

function uniqueStrings(
  values: string[]
) {
  return Array.from(
    new Set(
      values
        .map((value) =>
          value.trim()
        )
        .filter(Boolean)
    )
  );
}

function normalizeDraft(
  card: IdentifiedCard
): IdentifiedCard {
  return {
    ...card,

    notes: [
      ...card.notes,
    ],

    uncertainFields:
      uniqueStrings(
        card.uncertainFields.map(
          canonicalFieldName
        )
      ),
  };
}

function booleanValueToSelect(
  value: boolean | null
) {
  if (value === true) {
    return "yes";
  }

  if (value === false) {
    return "no";
  }

  return "unknown";
}

function selectToBoolean(
  value: string
): boolean | null {
  if (value === "yes") {
    return true;
  }

  if (value === "no") {
    return false;
  }

  return null;
}

function getSerialNumberedTo(
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

  const parsed = Number(match[1]);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function isFieldUncertain(
  uncertainFields: string[],
  fieldName: string
) {
  const canonicalName =
    canonicalFieldName(fieldName);

  return uncertainFields.some(
    (field) =>
      canonicalFieldName(field) ===
      canonicalName
  );
}

function fieldHasValue(
  card: IdentifiedCard,
  fieldName: string
) {
  const value =
    card[
      fieldName as keyof IdentifiedCard
    ];

  if (
    value === null ||
    value === undefined
  ) {
    return false;
  }

  if (
    typeof value === "string"
  ) {
    return Boolean(value.trim());
  }

  return true;
}

function calculateReviewStatus(
  card: IdentifiedCard
) {
  const uncertainFields =
    uniqueStrings(
      card.uncertainFields.map(
        canonicalFieldName
      )
    );

  const requiredMissing =
    CORE_FIELDS.filter(
      (field) =>
        !fieldHasValue(card, field)
    );

  if (
    card.serialNumberedTo &&
    !card.parallel
  ) {
    requiredMissing.push(
      "parallel" as
        (typeof CORE_FIELDS)[number]
    );
  }

  const unresolvedCoreFields =
    uncertainFields.filter(
      (field) =>
        [
          "playerName",
          "year",
          "product",
          "setName",
          "cardNumber",
          "parallel",
        ].includes(field)
    );

  return {
    uncertainFields:
      uniqueStrings([
        ...uncertainFields,
        ...requiredMissing,
      ]),

    needsManualReview:
      requiredMissing.length > 0 ||
      unresolvedCoreFields.length > 0,
  };
}

function getReadableError(
  error: unknown
) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Kortet kunne ikke gemmes. Prøv igen.";
}

export default function AIReviewPanel({
  collectionId,
  card,
  uploadResult,
  frontPreviewUrl,
  backPreviewUrl,
  onScanAgain,
  onSaved,
}: AIReviewPanelProps) {
  const [
    draftCard,
    setDraftCard,
  ] = useState<IdentifiedCard>(
    () => normalizeDraft(card)
  );

  const [
    editedFields,
    setEditedFields,
  ] = useState<Set<string>>(
    () => new Set()
  );

  const [
    purchasePrice,
    setPurchasePrice,
  ] = useState("");

  const [
    estimatedValue,
    setEstimatedValue,
  ] = useState("");

  const [
    purchaseSource,
    setPurchaseSource,
  ] = useState("");

  const [
    userNotes,
    setUserNotes,
  ] = useState("");

  const [
    showAdvanced,
    setShowAdvanced,
  ] = useState(false);

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

  const [
    duplicateCheck,
    setDuplicateCheck,
  ] = useState<DuplicateCardCheckResult | null>(
    null
  );

  const [
    isCheckingDuplicates,
    setIsCheckingDuplicates,
  ] = useState(false);

  const [
    duplicateCheckError,
    setDuplicateCheckError,
  ] = useState<string | null>(null);

  const [
    duplicateAcknowledged,
    setDuplicateAcknowledged,
  ] = useState(false);

  const duplicateIdentity =
    useMemo<DuplicateCardIdentity>(
      () => ({
        playerName:
          draftCard.playerName,
        year: draftCard.year,
        manufacturer:
          draftCard.manufacturer,
        brand: draftCard.brand,
        product: draftCard.product,
        setName: draftCard.setName,
        cardNumber:
          draftCard.cardNumber,
        parallel: draftCard.parallel,
        serialNumber:
          draftCard.serialNumber,
      }),
      [
        draftCard.brand,
        draftCard.cardNumber,
        draftCard.manufacturer,
        draftCard.parallel,
        draftCard.playerName,
        draftCard.product,
        draftCard.serialNumber,
        draftCard.setName,
        draftCard.year,
      ]
    );

  const shouldCheckDuplicates =
    hasDuplicateCheckIdentity(
      duplicateIdentity
    );

  useEffect(() => {
    setDraftCard(
      normalizeDraft(card)
    );

    setEditedFields(
      new Set()
    );

    setPurchasePrice("");
    setEstimatedValue("");
    setPurchaseSource("");
    setUserNotes("");
    setShowAdvanced(false);
    setIsSaving(false);
    setErrorMessage(null);
    setDuplicateCheck(null);
    setIsCheckingDuplicates(false);
    setDuplicateCheckError(null);
    setDuplicateAcknowledged(false);
  }, [
    card,
    uploadResult.scanId,
  ]);

  useEffect(() => {
    setDuplicateAcknowledged(false);
    setDuplicateCheckError(null);

    if (!shouldCheckDuplicates) {
      setDuplicateCheck(null);
      setIsCheckingDuplicates(false);
      return;
    }

    const controller =
      new AbortController();

    setDuplicateCheck(null);
    setIsCheckingDuplicates(true);

    const timeout = window.setTimeout(
      () => {
        void checkDuplicateCards(
          duplicateIdentity,
          controller.signal
        )
          .then((result) => {
            if (!controller.signal.aborted) {
              setDuplicateCheck(result);
            }
          })
          .catch((error: unknown) => {
            if (controller.signal.aborted) {
              return;
            }

            setDuplicateCheckError(
              getReadableError(error)
            );
          })
          .finally(() => {
            if (!controller.signal.aborted) {
              setIsCheckingDuplicates(false);
            }
          });
      },
      450
    );

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [
    duplicateIdentity,
    shouldCheckDuplicates,
  ]);

  const confidencePercentage =
    getConfidencePercentage(
      draftCard.confidence
    );

  const reviewStatus =
    useMemo(
      () =>
        calculateReviewStatus(
          draftCard
        ),
      [draftCard]
    );

  const canSave =
    Boolean(
      draftCard.playerName?.trim()
    ) &&
    !isSaving &&
    !isCheckingDuplicates &&
    !(
      duplicateCheck
        ?.requiresAcknowledgement &&
      !duplicateAcknowledged
    );

  function markFieldEdited(
    fieldName: string
  ) {
    setEditedFields(
      (currentFields) => {
        const nextFields =
          new Set(currentFields);

        nextFields.add(fieldName);

        return nextFields;
      }
    );
  }

  function removeFieldUncertainty(
    uncertainFields: string[],
    fieldName: string
  ) {
    const canonicalName =
      canonicalFieldName(
        fieldName
      );

    return uncertainFields.filter(
      (field) =>
        canonicalFieldName(field) !==
        canonicalName
    );
  }

  function updateTextField(
    fieldName: EditableTextField,
    value: string
  ) {
    markFieldEdited(fieldName);

    setDraftCard(
      (currentCard) => {
        const nextCard = {
          ...currentCard,

          [fieldName]:
            value === ""
              ? null
              : value,

          uncertainFields:
            removeFieldUncertainty(
              currentCard.uncertainFields,
              fieldName
            ),
        } as IdentifiedCard;

        if (
          fieldName ===
          "serialNumber"
        ) {
          nextCard.serialNumberedTo =
            getSerialNumberedTo(
              value || null
            );

          nextCard.uncertainFields =
            removeFieldUncertainty(
              nextCard.uncertainFields,
              "serialNumberedTo"
            );
        }

        const status =
          calculateReviewStatus(
            nextCard
          );

        return {
          ...nextCard,

          uncertainFields:
            status.uncertainFields,

          needsManualReview:
            status.needsManualReview,
        };
      }
    );
  }

  function updateBooleanField(
    fieldName:
      EditableBooleanField,
    value: string
  ) {
    markFieldEdited(fieldName);

    setDraftCard(
      (currentCard) => {
        const nextCard = {
          ...currentCard,

          [fieldName]:
            selectToBoolean(value),

          uncertainFields:
            removeFieldUncertainty(
              currentCard.uncertainFields,
              fieldName
            ),
        } as IdentifiedCard;

        const status =
          calculateReviewStatus(
            nextCard
          );

        return {
          ...nextCard,

          uncertainFields:
            status.uncertainFields,

          needsManualReview:
            status.needsManualReview,
        };
      }
    );
  }

  async function handleSave(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!canSave) {
      return;
    }

    const playerName = draftCard.playerName?.trim();

    const submitter = (
      event.nativeEvent as SubmitEvent
    ).submitter;

    const nextAction =
      submitter instanceof
        HTMLButtonElement &&
      submitter.dataset.action ===
        "value"
        ? "value"
        : "continue";

    if (!playerName) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const finalStatus =
      calculateReviewStatus(
        draftCard
      );

    const cardToSave: IdentifiedCard =
      {
        ...draftCard,

        uncertainFields:
          finalStatus.uncertainFields,

        needsManualReview:
          finalStatus.needsManualReview,
      };

    try {
      const result =
        await saveIdentifiedCard({
          collectionId,

          uploadResult,

          card: cardToSave,

          purchasePrice,

          estimatedValue,

          purchaseSource,

          userNotes,

          editedFields:
            Array.from(
              editedFields
            ),

          allowDuplicate:
            duplicateAcknowledged,
        });

      await onSaved({
        ...result,
        playerName,
        estimatedValue: normalizeOptionalNumber(
          estimatedValue,
          "Den estimerede værdi"
        ),
        nextAction,
      });
    } catch (error) {
      setErrorMessage(
        getReadableError(error)
      );

      setIsSaving(false);
    }
  }

  return (
    <form
      className="review-form"
      onSubmit={handleSave}
    >
      <div className="review-layout">
        <aside className="review-images">
          <div className="review-image-card">
            <span>Front</span>

            {frontPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={frontPreviewUrl}
                alt="Front of identified card"
              />
            ) : (
              <p>Front image unavailable</p>
            )}
          </div>

          <div className="review-image-card">
            <span>Back</span>

            {backPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={backPreviewUrl}
                alt="Back of identified card"
              />
            ) : (
              <p>Back image unavailable</p>
            )}
          </div>
        </aside>

        <div className="review-main">
          <section className="review-card">
            <header className="review-heading">
              <div>
                <span className="review-eyebrow">
                  AI IDENTIFICATION
                </span>

                <h3>
                  {draftCard.playerName ||
                    "Unidentified card"}
                </h3>

                <p>
                  {getCardSubtitle(
                    draftCard
                  ) ||
                    "Complete the missing information below."}
                </p>
              </div>

              <div
                className={[
                  "review-confidence",

                  reviewStatus
                    .needsManualReview
                    ? "review-confidence-warning"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <strong>
                  {confidencePercentage}%
                </strong>

                <span>
                  {getConfidenceLabel(
                    draftCard.confidence
                  )}
                </span>
              </div>
            </header>

            <div className="review-section">
              <div className="review-section-heading">
                <div>
                  <h4>
                    Card identity
                  </h4>

                  <p>
                    Correct any field that
                    does not match the card.
                  </p>
                </div>

                {editedFields.size >
                  0 && (
                  <span className="edited-badge">
                    {editedFields.size} edited
                  </span>
                )}
              </div>

              <div className="review-grid">
                <EditableField
                  label="Player"
                  fieldName="playerName"
                  value={
                    draftCard.playerName ??
                    ""
                  }
                  required
                  uncertain={isFieldUncertain(
                    draftCard.uncertainFields,
                    "playerName"
                  )}
                  onChange={(value) =>
                    updateTextField(
                      "playerName",
                      value
                    )
                  }
                />

                <EditableField
                  label="Team"
                  fieldName="team"
                  value={
                    draftCard.team ?? ""
                  }
                  uncertain={isFieldUncertain(
                    draftCard.uncertainFields,
                    "team"
                  )}
                  onChange={(value) =>
                    updateTextField(
                      "team",
                      value
                    )
                  }
                />

                <EditableField
                  label="Sport"
                  fieldName="sport"
                  value={
                    draftCard.sport ?? ""
                  }
                  uncertain={isFieldUncertain(
                    draftCard.uncertainFields,
                    "sport"
                  )}
                  onChange={(value) =>
                    updateTextField(
                      "sport",
                      value
                    )
                  }
                />

                <EditableField
                  label="Year / season"
                  fieldName="year"
                  value={
                    draftCard.year ?? ""
                  }
                  uncertain={isFieldUncertain(
                    draftCard.uncertainFields,
                    "year"
                  )}
                  placeholder="Example: 2025-26"
                  onChange={(value) =>
                    updateTextField(
                      "year",
                      value
                    )
                  }
                />

                <EditableField
                  label="Manufacturer"
                  fieldName="manufacturer"
                  value={
                    draftCard.manufacturer ??
                    ""
                  }
                  uncertain={isFieldUncertain(
                    draftCard.uncertainFields,
                    "manufacturer"
                  )}
                  placeholder="Example: Topps"
                  onChange={(value) =>
                    updateTextField(
                      "manufacturer",
                      value
                    )
                  }
                />

                <EditableField
                  label="Brand"
                  fieldName="brand"
                  value={
                    draftCard.brand ?? ""
                  }
                  uncertain={isFieldUncertain(
                    draftCard.uncertainFields,
                    "brand"
                  )}
                  placeholder="Example: Chrome"
                  onChange={(value) =>
                    updateTextField(
                      "brand",
                      value
                    )
                  }
                />

                <EditableField
                  label="Product"
                  fieldName="product"
                  value={
                    draftCard.product ?? ""
                  }
                  uncertain={isFieldUncertain(
                    draftCard.uncertainFields,
                    "product"
                  )}
                  placeholder="Example: Topps Cosmic Chrome Basketball"
                  onChange={(value) =>
                    updateTextField(
                      "product",
                      value
                    )
                  }
                />

                <EditableField
                  label="Set / insert"
                  fieldName="setName"
                  value={
                    draftCard.setName ??
                    ""
                  }
                  uncertain={isFieldUncertain(
                    draftCard.uncertainFields,
                    "setName"
                  )}
                  placeholder="Example: Extraterrestrial Talent"
                  onChange={(value) =>
                    updateTextField(
                      "setName",
                      value
                    )
                  }
                />

                <EditableField
                  label="Card number"
                  fieldName="cardNumber"
                  value={
                    draftCard.cardNumber ??
                    ""
                  }
                  uncertain={isFieldUncertain(
                    draftCard.uncertainFields,
                    "cardNumber"
                  )}
                  placeholder="Example: ET-8"
                  onChange={(value) =>
                    updateTextField(
                      "cardNumber",
                      value
                    )
                  }
                />

                <EditableField
                  label="Parallel"
                  fieldName="parallel"
                  value={
                    draftCard.parallel ??
                    ""
                  }
                  uncertain={isFieldUncertain(
                    draftCard.uncertainFields,
                    "parallel"
                  )}
                  placeholder="Example: Purple Nebula Refractor"
                  onChange={(value) =>
                    updateTextField(
                      "parallel",
                      value
                    )
                  }
                />

                <EditableField
                  label="Serial number"
                  fieldName="serialNumber"
                  value={
                    draftCard.serialNumber ??
                    ""
                  }
                  uncertain={isFieldUncertain(
                    draftCard.uncertainFields,
                    "serialNumber"
                  )}
                  placeholder="Example: 044/150"
                  onChange={(value) =>
                    updateTextField(
                      "serialNumber",
                      value
                    )
                  }
                />

                <EditableField
                  label="Variation"
                  fieldName="variation"
                  value={
                    draftCard.variation ??
                    ""
                  }
                  uncertain={isFieldUncertain(
                    draftCard.uncertainFields,
                    "variation"
                  )}
                  placeholder="Optional"
                  onChange={(value) =>
                    updateTextField(
                      "variation",
                      value
                    )
                  }
                />
              </div>
            </div>

            <div className="review-section">
              <div className="review-section-heading">
                <div>
                  <h4>
                    Card features
                  </h4>

                  <p>
                    Confirm special card
                    attributes.
                  </p>
                </div>
              </div>

              <div className="review-feature-grid">
                <BooleanField
                  label="Rookie card"
                  value={booleanValueToSelect(
                    draftCard.rookieCard
                  )}
                  onChange={(value) =>
                    updateBooleanField(
                      "rookieCard",
                      value
                    )
                  }
                />

                <BooleanField
                  label="Autograph"
                  value={booleanValueToSelect(
                    draftCard.autograph
                  )}
                  onChange={(value) =>
                    updateBooleanField(
                      "autograph",
                      value
                    )
                  }
                />

                <BooleanField
                  label="Memorabilia"
                  value={booleanValueToSelect(
                    draftCard.memorabilia
                  )}
                  onChange={(value) =>
                    updateBooleanField(
                      "memorabilia",
                      value
                    )
                  }
                />
              </div>

              {draftCard.memorabilia && (
                <div className="review-single-field">
                  <EditableField
                    label="Memorabilia type"
                    fieldName="memorabiliaType"
                    value={
                      draftCard.memorabiliaType ??
                      ""
                    }
                    placeholder="Example: Game-worn jersey"
                    onChange={(value) =>
                      updateTextField(
                        "memorabiliaType",
                        value
                      )
                    }
                  />
                </div>
              )}
            </div>

            <button
              className="advanced-toggle"
              type="button"
              onClick={() =>
                setShowAdvanced(
                  (currentValue) =>
                    !currentValue
                )
              }
            >
              <span>
                {showAdvanced
                  ? "Hide"
                  : "Show"}{" "}
                grading and additional
                details
              </span>

              <span>
                {showAdvanced
                  ? "−"
                  : "+"}
              </span>
            </button>

            {showAdvanced && (
              <div className="review-section review-advanced">
                <div className="review-grid">
                  <EditableField
                    label="Grading company"
                    fieldName="gradingCompany"
                    value={
                      draftCard.gradingCompany ??
                      ""
                    }
                    placeholder="PSA, BGS, SGC..."
                    onChange={(value) =>
                      updateTextField(
                        "gradingCompany",
                        value
                      )
                    }
                  />

                  <EditableField
                    label="Grade"
                    fieldName="grade"
                    value={
                      draftCard.grade ?? ""
                    }
                    placeholder="Example: 10"
                    onChange={(value) =>
                      updateTextField(
                        "grade",
                        value
                      )
                    }
                  />

                  <EditableField
                    label="Certification number"
                    fieldName="certificationNumber"
                    value={
                      draftCard.certificationNumber ??
                      ""
                    }
                    onChange={(value) =>
                      updateTextField(
                        "certificationNumber",
                        value
                      )
                    }
                  />

                  <EditableField
                    label="Language"
                    fieldName="language"
                    value={
                      draftCard.language ??
                      ""
                    }
                    onChange={(value) =>
                      updateTextField(
                        "language",
                        value
                      )
                    }
                  />
                </div>
              </div>
            )}
          </section>

          <section
            className={[
              "duplicate-check-card",
              duplicateCheck?.matches
                .length
                ? "duplicate-check-warning"
                : "duplicate-check-clear",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-live="polite"
          >
            <div className="duplicate-check-heading">
              <div>
                <span className="review-eyebrow">
                  COLLECTION CHECK
                </span>

                <h4>
                  Duplicate protection
                </h4>
              </div>

              {isCheckingDuplicates ? (
                <span className="duplicate-status duplicate-status-loading">
                  Checking…
                </span>
              ) : duplicateCheck?.matches
                  .length ? (
                <span className="duplicate-status duplicate-status-warning">
                  {
                    duplicateCheck.matches
                      .length
                  }{" "}
                  match
                  {duplicateCheck.matches
                    .length === 1
                    ? ""
                    : "es"}
                </span>
              ) : (
                <span className="duplicate-status duplicate-status-clear">
                  Clear
                </span>
              )}
            </div>

            {isCheckingDuplicates ? (
              <p className="duplicate-check-copy">
                Vallective is comparing the
                exact card identity with your
                own library.
              </p>
            ) : duplicateCheckError ? (
              <p className="duplicate-check-error">
                {duplicateCheckError} The
                server will run the protection
                check again when you save.
              </p>
            ) : duplicateCheck &&
              duplicateCheck.matches.length >
                0 ? (
              <>
                <p className="duplicate-check-copy">
                  This can be another physical
                  copy. Review the matches so
                  an accidental double entry
                  does not slip into your
                  collection.
                </p>

                <div className="duplicate-match-list">
                  {duplicateCheck.matches.map(
                    (match) => (
                      <article
                        className="duplicate-match"
                        key={match.cardId}
                      >
                        <div>
                          <strong>
                            {[
                              match.year,
                              match.setName,
                              match.playerName,
                              match.cardNumber
                                ? `#${match.cardNumber}`
                                : null,
                              match.parallel,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </strong>

                          <p>
                            {match.collectionName ??
                              "Collection"}
                            {match.serialNumber
                              ? ` · ${match.serialNumber}`
                              : ""}
                          </p>

                          <small>
                            {match.reasons.join(
                              " · "
                            )}
                          </small>
                        </div>

                        <div className="duplicate-match-action">
                          <span>
                            {match.score}%
                          </span>

                          <Link
                            href={`/cards/${match.cardId}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open
                          </Link>
                        </div>
                      </article>
                    )
                  )}
                </div>

                {duplicateCheck.requiresAcknowledgement && (
                  <label className="duplicate-confirmation">
                    <input
                      type="checkbox"
                      checked={
                        duplicateAcknowledged
                      }
                      onChange={(event) =>
                        setDuplicateAcknowledged(
                          event.target.checked
                        )
                      }
                    />

                    <span>
                      I checked the matches.
                      This is another physical
                      copy and should be saved.
                    </span>
                  </label>
                )}
              </>
            ) : (
              <p className="duplicate-check-copy">
                No matching copy was found in
                your Vallective library.
              </p>
            )}
          </section>

          <section className="review-card finance-card">
            <div className="review-section-heading">
              <div>
                <span className="review-eyebrow">
                  YOUR PURCHASE
                </span>

                <h4>
                  Financial details
                </h4>

                <p>
                  These values are optional
                  and can be changed later.
                </p>
              </div>
            </div>

            <div className="finance-grid">
              <label className="review-input-field">
                <span>
                  Purchase price
                </span>

                <div className="currency-input">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={
                      purchasePrice
                    }
                    onChange={(event) =>
                      setPurchasePrice(
                        event.target.value
                      )
                    }
                    placeholder="0"
                  />

                  <strong>DKK</strong>
                </div>
              </label>

              <label className="review-input-field">
                <span>
                  Estimated value
                </span>

                <div className="currency-input">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={
                      estimatedValue
                    }
                    onChange={(event) =>
                      setEstimatedValue(
                        event.target.value
                      )
                    }
                    placeholder="0"
                  />

                  <strong>DKK</strong>
                </div>
              </label>

              <label className="review-input-field finance-full">
                <span>
                  Purchase source
                </span>

                <input
                  type="text"
                  value={purchaseSource}
                  onChange={(event) =>
                    setPurchaseSource(
                      event.target.value
                    )
                  }
                  placeholder="Card show, eBay, Facebook, private purchase..."
                />
              </label>

              <label className="review-input-field finance-full">
                <span>
                  Your notes
                </span>

                <textarea
                  value={userNotes}
                  onChange={(event) =>
                    setUserNotes(
                      event.target.value
                    )
                  }
                  placeholder="Condition, seller, reason for buying or other notes..."
                />
              </label>
            </div>
          </section>

          {reviewStatus
            .needsManualReview && (
            <div className="review-warning">
              <span>!</span>

              <div>
                <strong>
                  Manual review still
                  recommended
                </strong>

                <p>
                  One or more central
                  fields are missing or
                  uncertain. The card can
                  still be saved with the
                  status “Needs review”.
                </p>
              </div>
            </div>
          )}

          {draftCard.notes.length >
            0 && (
            <details className="ai-notes">
              <summary>
                AI notes (
                {
                  draftCard.notes.length
                }
                )
              </summary>

              <ul>
                {draftCard.notes.map(
                  (note, index) => (
                    <li
                      key={`${note}-${index}`}
                    >
                      {note}
                    </li>
                  )
                )}
              </ul>
            </details>
          )}

          {errorMessage && (
            <div
              className="save-error"
              role="alert"
            >
              <span>!</span>

              <div>
                <strong>
                  Card could not be saved
                </strong>

                <p>
                  {errorMessage}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="review-footer">
        <p>
          {reviewStatus
            .needsManualReview
            ? "The card will be saved as Needs review."
            : "The card is ready to be saved as Verified."}
        </p>

        <div className="review-actions">
          <button
            className="scan-again-button"
            type="button"
            onClick={onScanAgain}
            disabled={isSaving}
          >
            Scan again
          </button>

          <button
            className="save-only-button"
            type="submit"
            disabled={!canSave}
          >
            {isSaving ? (
              <>
                <span className="save-spinner" />
                Saving card...
              </>
            ) : (
              <>
                <span>✓</span>
                Save card
              </>
            )}
          </button>

          <button
            className="save-card-button"
            type="submit"
            data-action="value"
            disabled={!canSave}
          >
            {isSaving ? (
              <>
                <span className="save-spinner" />
                Saving card...
              </>
            ) : (
              <>
                <span>✦</span>
                Save &amp; value
              </>
            )}
          </button>
        </div>
      </footer>

      <style jsx>{`
        .review-form {
          min-width: 0;
        }

        .review-layout {
          display: grid;
          grid-template-columns: 280px minmax(0, 1fr);
          gap: 30px;
          padding: 30px;
        }

        .review-images {
          display: grid;
          align-content: start;
          gap: 16px;
        }

        .review-image-card {
          position: relative;
          min-height: 200px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          padding: 15px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 18px;
          background: rgba(0, 0, 0, 0.24);
        }

        .review-image-card > span {
          position: absolute;
          top: 10px;
          left: 10px;
          z-index: 2;
          padding: 5px 8px;
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.7);
          color: #ffffff;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .review-image-card img {
          display: block;
          max-width: 100%;
          max-height: 310px;
          border-radius: 10px;
          object-fit: contain;
        }

        .review-image-card p {
          color: #71798b;
          font-size: 12px;
        }

        .review-main {
          min-width: 0;
          display: grid;
          gap: 18px;
        }

        .review-card {
          min-width: 0;
          padding: 24px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.025);
        }

        .review-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          padding-bottom: 22px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.11);
        }

        .review-eyebrow {
          color: #c4b5fd;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.16em;
        }

        .review-heading h3 {
          margin: 10px 0 0;
          color: #ffffff;
          font-size: 26px;
          letter-spacing: -0.03em;
        }

        .review-heading p {
          margin: 7px 0 0;
          color: #9299aa;
          font-size: 13px;
          line-height: 1.5;
        }

        .review-confidence {
          flex: 0 0 auto;
          min-width: 116px;
          padding: 13px;
          border: 1px solid rgba(52, 211, 153, 0.22);
          border-radius: 14px;
          background: rgba(16, 185, 129, 0.08);
          text-align: center;
        }

        .review-confidence strong {
          display: block;
          color: #a7f3d0;
          font-size: 23px;
        }

        .review-confidence span {
          display: block;
          margin-top: 4px;
          color: #6ee7b7;
          font-size: 10px;
          font-weight: 750;
          text-transform: uppercase;
        }

        .review-confidence-warning {
          border-color: rgba(251, 191, 36, 0.24);
          background: rgba(245, 158, 11, 0.08);
        }

        .review-confidence-warning strong,
        .review-confidence-warning span {
          color: #fde68a;
        }

        .review-section {
          padding-top: 22px;
        }

        .review-section +
          .review-section {
          margin-top: 22px;
          border-top: 1px solid rgba(148, 163, 184, 0.1);
        }

        .review-section-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 15px;
        }

        .review-section-heading h4 {
          margin: 0;
          color: #ffffff;
          font-size: 16px;
        }

        .review-section-heading p {
          margin: 5px 0 0;
          color: #71798b;
          font-size: 12px;
          line-height: 1.45;
        }

        .edited-badge {
          padding: 6px 9px;
          border: 1px solid rgba(167, 139, 250, 0.22);
          border-radius: 999px;
          background: rgba(139, 92, 246, 0.08);
          color: #c4b5fd;
          font-size: 10px;
          font-weight: 750;
          text-transform: uppercase;
        }

        .review-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .review-feature-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .review-single-field {
          margin-top: 12px;
        }

        .advanced-toggle {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 22px;
          padding: 13px 14px;
          border: 1px solid rgba(148, 163, 184, 0.11);
          border-radius: 13px;
          background: rgba(0, 0, 0, 0.14);
          color: #a5adbd;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .advanced-toggle:hover {
          border-color: rgba(167, 139, 250, 0.3);
          color: #ffffff;
        }

        .review-advanced {
          margin-top: 0;
          padding-top: 16px;
        }

        .finance-card {
          background:
            radial-gradient(
              circle at top right,
              rgba(124, 92, 255, 0.08),
              transparent 42%
            ),
            rgba(255, 255, 255, 0.025);
        }

        .finance-card h4 {
          margin: 8px 0 0;
        }

        .duplicate-check-card {
          padding: 18px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.025);
        }

        .duplicate-check-warning {
          border-color: rgba(251, 191, 36, 0.26);
          background:
            radial-gradient(
              circle at top right,
              rgba(245, 158, 11, 0.11),
              transparent 48%
            ),
            rgba(245, 158, 11, 0.045);
        }

        .duplicate-check-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .duplicate-check-heading h4 {
          margin: 8px 0 0;
          color: #ffffff;
          font-size: 16px;
        }

        .duplicate-status {
          flex: 0 0 auto;
          padding: 6px 9px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .duplicate-status-clear {
          background: rgba(52, 211, 153, 0.1);
          color: #6ee7b7;
        }

        .duplicate-status-warning {
          background: rgba(245, 158, 11, 0.14);
          color: #fde68a;
        }

        .duplicate-status-loading {
          background: rgba(124, 92, 255, 0.13);
          color: #c4b5fd;
        }

        .duplicate-check-copy,
        .duplicate-check-error {
          margin: 12px 0 0;
          color: #8f97a8;
          font-size: 12px;
          line-height: 1.55;
        }

        .duplicate-check-error {
          color: #fca5a5;
        }

        .duplicate-match-list {
          display: grid;
          gap: 9px;
          margin-top: 14px;
        }

        .duplicate-match {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 12px 13px;
          border: 1px solid rgba(251, 191, 36, 0.14);
          border-radius: 13px;
          background: rgba(0, 0, 0, 0.2);
        }

        .duplicate-match > div:first-child {
          min-width: 0;
        }

        .duplicate-match strong {
          display: block;
          overflow: hidden;
          color: #f8fafc;
          font-size: 12px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .duplicate-match p,
        .duplicate-match small {
          display: block;
          margin: 5px 0 0;
          color: #81899c;
          font-size: 10px;
          line-height: 1.45;
        }

        .duplicate-match small {
          color: #a78bfa;
        }

        .duplicate-match-action {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .duplicate-match-action span {
          color: #fde68a;
          font-size: 11px;
          font-weight: 800;
        }

        .duplicate-match-action a {
          padding: 6px 8px;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 8px;
          color: #c4b5fd;
          font-size: 10px;
          font-weight: 750;
          text-decoration: none;
        }

        .duplicate-confirmation {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-top: 14px;
          padding: 12px 13px;
          border-radius: 12px;
          background: rgba(245, 158, 11, 0.09);
          color: #fde68a;
          font-size: 12px;
          font-weight: 650;
          line-height: 1.5;
          cursor: pointer;
        }

        .duplicate-confirmation input {
          width: 17px;
          height: 17px;
          margin: 1px 0 0;
          accent-color: #8b5cf6;
        }

        .finance-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .finance-full {
          grid-column: 1 / -1;
        }

        .review-input-field {
          min-width: 0;
          display: grid;
          gap: 7px;
        }

        .review-input-field > span {
          color: #81899c;
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .review-input-field input,
        .review-input-field textarea,
        .currency-input {
          width: 100%;
          border: 1px solid rgba(148, 163, 184, 0.13);
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.2);
          color: #ffffff;
        }

        .review-input-field input,
        .review-input-field textarea {
          padding: 12px 13px;
          outline: none;
          font: inherit;
          font-size: 13px;
        }

        .review-input-field input:focus,
        .review-input-field textarea:focus,
        .currency-input:focus-within {
          border-color: rgba(167, 139, 250, 0.65);
          box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.08);
        }

        .review-input-field textarea {
          min-height: 92px;
          resize: vertical;
        }

        .currency-input {
          display: flex;
          align-items: center;
          overflow: hidden;
        }

        .currency-input input {
          min-width: 0;
          flex: 1;
          border: 0;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
        }

        .currency-input strong {
          flex: 0 0 auto;
          padding: 0 13px;
          color: #71798b;
          font-size: 11px;
        }

        .review-warning,
        .save-error {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 15px 16px;
          border-radius: 15px;
        }

        .review-warning {
          border: 1px solid rgba(251, 191, 36, 0.22);
          background: rgba(245, 158, 11, 0.08);
          color: #fde68a;
        }

        .save-error {
          border: 1px solid rgba(248, 113, 113, 0.25);
          background: rgba(239, 68, 68, 0.09);
          color: #fecaca;
        }

        .review-warning > span,
        .save-error > span {
          flex: 0 0 auto;
          width: 25px;
          height: 25px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.08);
          font-size: 13px;
          font-weight: 800;
        }

        .review-warning strong,
        .save-error strong {
          font-size: 13px;
        }

        .review-warning p,
        .save-error p {
          margin: 5px 0 0;
          color: currentColor;
          font-size: 12px;
          line-height: 1.5;
          opacity: 0.76;
        }

        .ai-notes {
          padding: 15px 16px;
          border: 1px solid rgba(148, 163, 184, 0.11);
          border-radius: 15px;
          background: rgba(0, 0, 0, 0.15);
        }

        .ai-notes summary {
          color: #a5adbd;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .ai-notes ul {
          margin: 12px 0 0;
          padding-left: 18px;
          color: #81899c;
          font-size: 12px;
          line-height: 1.65;
        }

        .review-footer {
          position: sticky;
          bottom: 0;
          z-index: 5;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 20px 30px;
          border-top: 1px solid rgba(148, 163, 184, 0.12);
          background: rgba(17, 19, 28, 0.96);
          backdrop-filter: blur(18px);
        }

        .review-footer > p {
          margin: 0;
          color: #71798b;
          font-size: 12px;
          line-height: 1.5;
        }

        .review-actions {
          flex: 0 0 auto;
          display: flex;
          gap: 11px;
        }

        .scan-again-button,
        .save-only-button,
        .save-card-button {
          min-height: 46px;
          border-radius: 12px;
          padding: 0 18px;
          font-size: 14px;
          font-weight: 750;
          cursor: pointer;
        }

        .scan-again-button {
          border: 1px solid rgba(148, 163, 184, 0.16);
          background: rgba(255, 255, 255, 0.03);
          color: #a5adbd;
        }

        .save-only-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid rgba(167, 139, 250, 0.25);
          background: rgba(124, 92, 255, 0.08);
          color: #c4b5fd;
        }

        .save-only-button:hover:not(:disabled) {
          border-color: rgba(167, 139, 250, 0.48);
          background: rgba(124, 92, 255, 0.14);
          color: #ffffff;
        }

        .scan-again-button:hover:not(:disabled) {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.06);
        }

        .save-card-button {
          min-width: 160px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border: 0;
          background: linear-gradient(135deg, #8b5cf6, #6d5ce7);
          color: #ffffff;
          box-shadow: 0 10px 28px rgba(124, 92, 255, 0.24);
        }

        .save-card-button:hover:not(:disabled) {
          filter: brightness(1.08);
        }

        .scan-again-button:disabled,
        .save-only-button:disabled,
        .save-card-button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .save-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: review-spin 700ms linear infinite;
        }

        @keyframes review-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 860px) {
          .review-layout {
            grid-template-columns: 1fr;
          }

          .review-images {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 680px) {
          .review-layout {
            gap: 17px;
            padding: 17px 16px 24px;
          }

          .review-images {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          .review-image-card {
            min-height: 150px;
            padding: 8px;
            border-radius: 14px;
          }

          .review-image-card img {
            max-height: 235px;
          }

          .review-image-card > span {
            top: 7px;
            left: 7px;
            padding: 4px 6px;
            font-size: 8px;
          }

          .review-main {
            gap: 14px;
          }

          .review-card {
            padding: 18px;
            border-radius: 17px;
          }

          .review-heading {
            flex-direction: column;
            gap: 13px;
            padding-bottom: 18px;
          }

          .review-heading h3 {
            font-size: 23px;
          }

          .review-confidence {
            width: 100%;
            padding: 11px;
          }

          .review-grid,
          .finance-grid,
          .review-feature-grid {
            grid-template-columns: 1fr;
          }

          .finance-full {
            grid-column: auto;
          }

          .review-footer {
            align-items: stretch;
            flex-direction: column;
            gap: 10px;
            padding:
              14px
              16px
              calc(14px + env(safe-area-inset-bottom));
          }

          .review-footer > p {
            display: none;
          }

          .review-actions {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .scan-again-button,
          .save-only-button,
          .save-card-button {
            width: 100%;
            min-width: 0;
            min-height: 52px;
          }

          .scan-again-button {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 360px) {
          .review-images,
          .review-actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </form>
  );
}

type EditableFieldProps = {
  label: string;

  fieldName: string;

  value: string;

  required?: boolean;

  uncertain?: boolean;

  placeholder?: string;

  onChange: (
    value: string
  ) => void;
};

function EditableField({
  label,
  fieldName,
  value,
  required = false,
  uncertain = false,
  placeholder,
  onChange,
}: EditableFieldProps) {
  return (
    <label
      className={[
        "editable-field",
        uncertain
          ? "editable-field-uncertain"
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

        {uncertain && (
          <em>Check</em>
        )}
      </span>

      <input
        name={fieldName}
        type="text"
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
      />

      <style jsx>{`
        .editable-field {
          min-width: 0;
          display: grid;
          gap: 7px;
          padding: 12px 13px;
          border: 1px solid rgba(148, 163, 184, 0.11);
          border-radius: 13px;
          background: rgba(0, 0, 0, 0.14);
        }

        .editable-field-uncertain {
          border-color: rgba(251, 191, 36, 0.3);
          background: rgba(245, 158, 11, 0.07);
        }

        .editable-field > span {
          display: flex;
          align-items: center;
          gap: 3px;
          color: #71798b;
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .editable-field > span strong {
          color: #fca5a5;
        }

        .editable-field > span em {
          margin-left: auto;
          padding: 3px 6px;
          border-radius: 999px;
          background: rgba(245, 158, 11, 0.12);
          color: #fde68a;
          font-size: 8px;
          font-style: normal;
          letter-spacing: 0.08em;
        }

        .editable-field input {
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

        .editable-field input::placeholder {
          color: #4f5666;
          font-weight: 500;
        }

        .editable-field:focus-within {
          border-color: rgba(167, 139, 250, 0.62);
          box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.07);
        }
      `}</style>
    </label>
  );
}

type BooleanFieldProps = {
  label: string;

  value: string;

  onChange: (
    value: string
  ) => void;
};

function BooleanField({
  label,
  value,
  onChange,
}: BooleanFieldProps) {
  return (
    <label className="boolean-field">
      <span>{label}</span>

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
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
        .boolean-field {
          display: grid;
          gap: 8px;
          padding: 12px 13px;
          border: 1px solid rgba(148, 163, 184, 0.11);
          border-radius: 13px;
          background: rgba(0, 0, 0, 0.14);
        }

        .boolean-field span {
          color: #71798b;
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .boolean-field select {
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

        .boolean-field select option {
          background: #11131c;
          color: #ffffff;
        }

        .boolean-field:focus-within {
          border-color: rgba(167, 139, 250, 0.62);
          box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.07);
        }
      `}</style>
    </label>
  );
}
