"use client";

import { useCallback, useEffect, useState } from "react";
import ImageUploadBox, {
  ImageSide,
} from "./scan/ImageUploadBox";
import {
  IdentifiedCard,
  identifyCard,
} from "@/lib/scan/identifyCard";
import {
  UploadCardImagesResult,
  uploadCardImages,
} from "@/lib/scan/uploadCardImages";

type ScanCardModalProps = {
  isOpen: boolean;
  collectionId: string;
  onClose: () => void;
  onUploadComplete?: (result: UploadCardImagesResult) => void;
};

type ProcessingStage =
  | "idle"
  | "uploading"
  | "identifying"
  | "complete";

const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

const MAX_IMAGE_SIZE = 15 * 1024 * 1024;

function getReadableError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Kortet kunne ikke identificeres. Prøv igen.";
}

function getConfidenceLabel(confidence: number) {
  if (confidence >= 0.9 || confidence >= 90) {
    return "High confidence";
  }

  if (confidence >= 0.7 || confidence >= 70) {
    return "Medium confidence";
  }

  return "Low confidence";
}

function getConfidencePercentage(confidence: number) {
  if (confidence <= 1) {
    return Math.round(confidence * 100);
  }

  return Math.round(confidence);
}

function getCardTitle(card: IdentifiedCard) {
  return (
    card.playerName ||
    card.setName ||
    card.product ||
    "Unidentified card"
  );
}

function getCardSubtitle(card: IdentifiedCard) {
  return [
    card.year,
    card.manufacturer || card.brand,
    card.product || card.setName,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function ScanCardModal({
  isOpen,
  collectionId,
  onClose,
  onUploadComplete,
}: ScanCardModalProps) {
  const [frontImage, setFrontImage] = useState<File | null>(null);
  const [backImage, setBackImage] = useState<File | null>(null);

  const [frontPreviewUrl, setFrontPreviewUrl] =
    useState<string | null>(null);
  const [backPreviewUrl, setBackPreviewUrl] =
    useState<string | null>(null);

  const [processingStage, setProcessingStage] =
    useState<ProcessingStage>("idle");

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [uploadResult, setUploadResult] =
    useState<UploadCardImagesResult | null>(null);

  const [identifiedCard, setIdentifiedCard] =
    useState<IdentifiedCard | null>(null);

  const isProcessing =
    processingStage === "uploading" ||
    processingStage === "identifying";

  const resetModal = useCallback(() => {
    setFrontImage(null);
    setBackImage(null);
    setErrorMessage(null);
    setUploadResult(null);
    setIdentifiedCard(null);
    setProcessingStage("idle");
  }, []);

  const handleClose = useCallback(() => {
    if (isProcessing) {
      return;
    }

    resetModal();
    onClose();
  }, [isProcessing, onClose, resetModal]);

  useEffect(() => {
    if (!frontImage) {
      setFrontPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(frontImage);
    setFrontPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [frontImage]);

  useEffect(() => {
    if (!backImage) {
      setBackPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(backImage);
    setBackPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [backImage]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isProcessing) {
        handleClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleClose, isOpen, isProcessing]);

  function clearPreviousResult() {
    setErrorMessage(null);
    setUploadResult(null);
    setIdentifiedCard(null);
    setProcessingStage("idle");
  }

  function validateSelectedImage(file: File) {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setErrorMessage(
        "Billedet skal være en JPG-, PNG-, WEBP- eller HEIC-fil."
      );

      return false;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setErrorMessage("Billedet må højst fylde 15 MB.");

      return false;
    }

    clearPreviousResult();

    return true;
  }

  function handleSelectImage(side: ImageSide, file: File) {
    if (!validateSelectedImage(file)) {
      return;
    }

    if (side === "front") {
      setFrontImage(file);
      return;
    }

    setBackImage(file);
  }

  function handleRemoveImage(side: ImageSide) {
    clearPreviousResult();

    if (side === "front") {
      setFrontImage(null);
      return;
    }

    setBackImage(null);
  }

  async function handleIdentifyWithAi() {
    if (!frontImage || !backImage) {
      setErrorMessage(
        "Upload både forsiden og bagsiden af kortet, før du fortsætter."
      );

      return;
    }

    if (!collectionId?.trim()) {
      setErrorMessage("Der er ikke valgt en collection.");

      return;
    }

    setErrorMessage(null);
    setUploadResult(null);
    setIdentifiedCard(null);
    setProcessingStage("uploading");

    try {
      const uploadedImages = await uploadCardImages({
        collectionId,
        frontImage,
        backImage,
      });

      setUploadResult(uploadedImages);
      onUploadComplete?.(uploadedImages);

      setProcessingStage("identifying");

      const identification = await identifyCard(
        uploadedImages.front.path,
        uploadedImages.back.path
      );

      if (!identification.success || !identification.card) {
        throw new Error(
          "AI kunne ikke identificere kortet ud fra billederne."
        );
      }

      setIdentifiedCard(identification.card);
      setProcessingStage("complete");
    } catch (error) {
      setErrorMessage(getReadableError(error));
      setProcessingStage("idle");
    }
  }

  if (!isOpen) {
    return null;
  }

  const canSubmit =
    Boolean(frontImage) &&
    Boolean(backImage) &&
    Boolean(collectionId?.trim()) &&
    !isProcessing &&
    !identifiedCard;

  const confidencePercentage = identifiedCard
    ? getConfidencePercentage(identifiedCard.confidence)
    : null;

  return (
    <div
      className="scan-card-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <section
        className="scan-card-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scan-card-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="scan-card-header">
          <div>
            <span className="scan-card-badge">AI SCAN</span>

            <h2 id="scan-card-title">
              {identifiedCard ? "Card identified" : "Scan a card"}
            </h2>

            <p>
              {identifiedCard
                ? "Review the result before the card is saved."
                : "Upload both sides. NECardPilot will use the images to identify the card."}
            </p>
          </div>

          <button
            className="scan-card-close"
            type="button"
            onClick={handleClose}
            disabled={isProcessing}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        {!identifiedCard ? (
          <div className="scan-card-content">
            <ImageUploadBox
              side="front"
              file={frontImage}
              previewUrl={frontPreviewUrl}
              disabled={isProcessing}
              onSelect={(file) =>
                handleSelectImage("front", file)
              }
              onRemove={() => handleRemoveImage("front")}
            />

            <ImageUploadBox
              side="back"
              file={backImage}
              previewUrl={backPreviewUrl}
              disabled={isProcessing}
              onSelect={(file) =>
                handleSelectImage("back", file)
              }
              onRemove={() => handleRemoveImage("back")}
            />
          </div>
        ) : (
          <div className="scan-review-content">
            <div className="scan-review-images">
              <div className="scan-review-image-card">
                <span>Front</span>

                {frontPreviewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={frontPreviewUrl}
                    alt="Front of identified card"
                  />
                )}
              </div>

              <div className="scan-review-image-card">
                <span>Back</span>

                {backPreviewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={backPreviewUrl}
                    alt="Back of identified card"
                  />
                )}
              </div>
            </div>

            <div className="scan-review-result">
              <div className="scan-review-result-header">
                <div>
                  <span className="scan-result-eyebrow">
                    AI IDENTIFICATION
                  </span>

                  <h3>{getCardTitle(identifiedCard)}</h3>

                  <p>{getCardSubtitle(identifiedCard)}</p>
                </div>

                <div
                  className={[
                    "scan-confidence",
                    identifiedCard.needsManualReview
                      ? "scan-confidence-warning"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <strong>{confidencePercentage}%</strong>

                  <span>
                    {getConfidenceLabel(
                      identifiedCard.confidence
                    )}
                  </span>
                </div>
              </div>

              <div className="scan-result-grid">
                <ResultField
                  label="Player"
                  value={identifiedCard.playerName}
                  uncertainFields={
                    identifiedCard.uncertainFields
                  }
                  fieldName="playerName"
                />

                <ResultField
                  label="Team"
                  value={identifiedCard.team}
                  uncertainFields={
                    identifiedCard.uncertainFields
                  }
                  fieldName="team"
                />

                <ResultField
                  label="Year"
                  value={identifiedCard.year}
                  uncertainFields={
                    identifiedCard.uncertainFields
                  }
                  fieldName="year"
                />

                <ResultField
                  label="Manufacturer"
                  value={
                    identifiedCard.manufacturer ||
                    identifiedCard.brand
                  }
                  uncertainFields={
                    identifiedCard.uncertainFields
                  }
                  fieldName="manufacturer"
                />

                <ResultField
                  label="Product / set"
                  value={
                    identifiedCard.product ||
                    identifiedCard.setName
                  }
                  uncertainFields={
                    identifiedCard.uncertainFields
                  }
                  fieldName="product"
                />

                <ResultField
                  label="Card number"
                  value={identifiedCard.cardNumber}
                  uncertainFields={
                    identifiedCard.uncertainFields
                  }
                  fieldName="cardNumber"
                />

                <ResultField
                  label="Parallel"
                  value={identifiedCard.parallel}
                  uncertainFields={
                    identifiedCard.uncertainFields
                  }
                  fieldName="parallel"
                />

                <ResultField
                  label="Serial number"
                  value={
                    identifiedCard.serialNumber ||
                    (identifiedCard.serialNumberedTo
                      ? `Numbered to ${identifiedCard.serialNumberedTo}`
                      : null)
                  }
                  uncertainFields={
                    identifiedCard.uncertainFields
                  }
                  fieldName="serialNumber"
                />
              </div>

              <div className="scan-result-tags">
                {identifiedCard.rookieCard && (
                  <span>Rookie card</span>
                )}

                {identifiedCard.autograph && (
                  <span>Autograph</span>
                )}

                {identifiedCard.memorabilia && (
                  <span>
                    {identifiedCard.memorabiliaType ||
                      "Memorabilia"}
                  </span>
                )}

                {identifiedCard.variation && (
                  <span>{identifiedCard.variation}</span>
                )}
              </div>

              {identifiedCard.needsManualReview && (
                <div className="scan-review-warning">
                  <span>!</span>

                  <div>
                    <strong>Manual review recommended</strong>

                    <p>
                      AI is uncertain about one or more fields.
                      Check the highlighted information before
                      saving.
                    </p>
                  </div>
                </div>
              )}

              {identifiedCard.notes.length > 0 && (
                <div className="scan-result-notes">
                  <strong>AI notes</strong>

                  <ul>
                    {identifiedCard.notes.map((note, index) => (
                      <li key={`${note}-${index}`}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {(errorMessage || isProcessing) && (
          <div className="scan-message-wrapper">
            {errorMessage && (
              <div
                className="scan-message scan-error-message"
                role="alert"
              >
                <span className="scan-message-icon">!</span>

                <div>
                  <strong>Identification failed</strong>
                  <p>{errorMessage}</p>
                </div>
              </div>
            )}

            {isProcessing && (
              <div className="scan-message scan-progress-message">
                <span className="scan-progress-spinner" />

                <div>
                  <strong>
                    {processingStage === "uploading"
                      ? "Uploading images"
                      : "Identifying card"}
                  </strong>

                  <p>
                    {processingStage === "uploading"
                      ? "The front and back images are being stored securely."
                      : "AI is examining the card details. This may take a moment."}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <footer className="scan-card-footer">
          <p>
            {identifiedCard
              ? "The result has not been saved to your collection yet."
              : "Use clear, well-lit images and keep the entire card visible."}
          </p>

          <div className="scan-card-actions">
            {identifiedCard ? (
              <>
                <button
                  className="scan-cancel-button"
                  type="button"
                  onClick={() => {
                    setIdentifiedCard(null);
                    setUploadResult(null);
                    setProcessingStage("idle");
                    setErrorMessage(null);
                  }}
                >
                  Scan again
                </button>

                <button
                  className="scan-identify-button"
                  type="button"
                  disabled
                  title="Saving will be added in the next step"
                >
                  <span>✓</span>
                  Ready for review
                </button>
              </>
            ) : (
              <>
                <button
                  className="scan-cancel-button"
                  type="button"
                  onClick={handleClose}
                  disabled={isProcessing}
                >
                  Cancel
                </button>

                <button
                  className="scan-identify-button"
                  type="button"
                  onClick={handleIdentifyWithAi}
                  disabled={!canSubmit}
                >
                  {processingStage === "uploading" ? (
                    <>
                      <span className="scan-button-spinner" />
                      Uploading...
                    </>
                  ) : processingStage === "identifying" ? (
                    <>
                      <span className="scan-button-spinner" />
                      Identifying...
                    </>
                  ) : (
                    <>
                      <span>✦</span>
                      Identify with AI
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </footer>
      </section>

      <style jsx>{`
        .scan-card-backdrop {
          position: fixed;
          inset: 0;
          z-index: 2000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(3, 5, 12, 0.86);
          backdrop-filter: blur(14px);
        }

        .scan-card-modal {
          width: min(1040px, 100%);
          max-height: calc(100vh - 48px);
          overflow-y: auto;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 26px;
          background:
            radial-gradient(
              circle at top right,
              rgba(124, 92, 255, 0.14),
              transparent 34%
            ),
            #11131c;
          box-shadow:
            0 35px 110px rgba(0, 0, 0, 0.65),
            0 0 0 1px rgba(255, 255, 255, 0.02);
          color: #f8fafc;
        }

        .scan-card-header {
          position: sticky;
          top: 0;
          z-index: 4;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          padding: 28px 30px 24px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.12);
          background: rgba(17, 19, 28, 0.94);
          backdrop-filter: blur(18px);
        }

        .scan-card-badge,
        .scan-result-eyebrow {
          display: inline-flex;
          color: #c4b5fd;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.16em;
        }

        .scan-card-badge {
          padding: 6px 10px;
          border: 1px solid rgba(167, 139, 250, 0.25);
          border-radius: 999px;
          background: rgba(139, 92, 246, 0.1);
        }

        .scan-card-header h2 {
          margin: 13px 0 0;
          color: #ffffff;
          font-size: 28px;
          letter-spacing: -0.035em;
        }

        .scan-card-header p {
          margin: 8px 0 0;
          color: #9299aa;
          font-size: 14px;
          line-height: 1.55;
        }

        .scan-card-close {
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

        .scan-card-close:hover:not(:disabled) {
          border-color: rgba(167, 139, 250, 0.5);
          background: rgba(167, 139, 250, 0.09);
          color: #ffffff;
        }

        .scan-card-close:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .scan-card-content {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 28px;
          padding: 28px 30px;
        }

        .scan-review-content {
          display: grid;
          grid-template-columns: 280px minmax(0, 1fr);
          gap: 30px;
          padding: 30px;
        }

        .scan-review-images {
          display: grid;
          gap: 16px;
          align-content: start;
        }

        .scan-review-image-card {
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

        .scan-review-image-card > span {
          position: absolute;
          top: 10px;
          left: 10px;
          z-index: 2;
          padding: 5px 8px;
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.65);
          color: #ffffff;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .scan-review-image-card img {
          display: block;
          max-width: 100%;
          max-height: 280px;
          border-radius: 10px;
          object-fit: contain;
        }

        .scan-review-result {
          min-width: 0;
          padding: 24px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.025);
        }

        .scan-review-result-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          padding-bottom: 22px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.11);
        }

        .scan-review-result-header h3 {
          margin: 10px 0 0;
          color: #ffffff;
          font-size: 25px;
          letter-spacing: -0.03em;
        }

        .scan-review-result-header p {
          margin: 7px 0 0;
          color: #9299aa;
          font-size: 13px;
        }

        .scan-confidence {
          flex: 0 0 auto;
          min-width: 112px;
          padding: 12px;
          border: 1px solid rgba(52, 211, 153, 0.22);
          border-radius: 14px;
          background: rgba(16, 185, 129, 0.08);
          text-align: center;
        }

        .scan-confidence strong {
          display: block;
          color: #a7f3d0;
          font-size: 22px;
        }

        .scan-confidence span {
          display: block;
          margin-top: 3px;
          color: #6ee7b7;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .scan-confidence-warning {
          border-color: rgba(251, 191, 36, 0.24);
          background: rgba(245, 158, 11, 0.08);
        }

        .scan-confidence-warning strong,
        .scan-confidence-warning span {
          color: #fde68a;
        }

        .scan-result-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          padding-top: 22px;
        }

        .scan-result-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 18px;
        }

        .scan-result-tags span {
          padding: 7px 10px;
          border: 1px solid rgba(167, 139, 250, 0.22);
          border-radius: 999px;
          background: rgba(139, 92, 246, 0.08);
          color: #c4b5fd;
          font-size: 11px;
          font-weight: 700;
        }

        .scan-review-warning {
          display: flex;
          gap: 11px;
          margin-top: 20px;
          padding: 14px;
          border: 1px solid rgba(251, 191, 36, 0.22);
          border-radius: 14px;
          background: rgba(245, 158, 11, 0.08);
          color: #fde68a;
        }

        .scan-review-warning > span {
          flex: 0 0 auto;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.08);
          font-weight: 800;
        }

        .scan-review-warning strong {
          font-size: 13px;
        }

        .scan-review-warning p {
          margin: 4px 0 0;
          color: #d6b967;
          font-size: 12px;
          line-height: 1.5;
        }

        .scan-result-notes {
          margin-top: 18px;
          padding: 15px;
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.18);
        }

        .scan-result-notes strong {
          color: #ffffff;
          font-size: 12px;
        }

        .scan-result-notes ul {
          margin: 8px 0 0;
          padding-left: 18px;
          color: #9299aa;
          font-size: 12px;
          line-height: 1.6;
        }

        .scan-message-wrapper {
          padding: 0 30px 18px;
        }

        .scan-message {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 15px 16px;
          border-radius: 15px;
        }

        .scan-error-message {
          border: 1px solid rgba(248, 113, 113, 0.25);
          background: rgba(239, 68, 68, 0.09);
          color: #fecaca;
        }

        .scan-progress-message {
          border: 1px solid rgba(167, 139, 250, 0.24);
          background: rgba(139, 92, 246, 0.08);
          color: #ddd6fe;
        }

        .scan-message-icon {
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

        .scan-message strong {
          font-size: 14px;
        }

        .scan-message p {
          margin: 5px 0 0;
          color: currentColor;
          font-size: 13px;
          line-height: 1.5;
          opacity: 0.75;
        }

        .scan-progress-spinner,
        .scan-button-spinner {
          flex: 0 0 auto;
          border-radius: 50%;
          animation: scan-spin 700ms linear infinite;
        }

        .scan-progress-spinner {
          width: 24px;
          height: 24px;
          border: 2px solid rgba(196, 181, 253, 0.2);
          border-top-color: #c4b5fd;
        }

        .scan-button-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(0, 0, 0, 0.25);
          border-top-color: #0a0b10;
        }

        .scan-card-footer {
          position: sticky;
          bottom: 0;
          z-index: 4;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 20px 30px;
          border-top: 1px solid rgba(148, 163, 184, 0.12);
          background: rgba(17, 19, 28, 0.94);
          backdrop-filter: blur(18px);
        }

        .scan-card-footer > p {
          margin: 0;
          color: #71798b;
          font-size: 12px;
          line-height: 1.5;
        }

        .scan-card-actions {
          flex: 0 0 auto;
          display: flex;
          gap: 11px;
        }

        .scan-cancel-button,
        .scan-identify-button {
          min-height: 45px;
          border-radius: 12px;
          padding: 0 18px;
          font-size: 14px;
          font-weight: 750;
          cursor: pointer;
        }

        .scan-cancel-button {
          border: 1px solid rgba(148, 163, 184, 0.16);
          background: rgba(255, 255, 255, 0.03);
          color: #a5adbd;
        }

        .scan-cancel-button:hover:not(:disabled) {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.06);
        }

        .scan-identify-button {
          min-width: 182px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border: 0;
          background: linear-gradient(135deg, #ffffff, #d9dce5);
          color: #0a0b10;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.24);
        }

        .scan-identify-button:hover:not(:disabled) {
          filter: brightness(1.05);
        }

        .scan-cancel-button:disabled,
        .scan-identify-button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        @keyframes scan-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 820px) {
          .scan-review-content {
            grid-template-columns: 1fr;
          }

          .scan-review-images {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .scan-card-backdrop {
            align-items: flex-end;
            padding: 10px;
          }

          .scan-card-modal {
            max-height: calc(100vh - 20px);
            border-radius: 22px;
          }

          .scan-card-content,
          .scan-result-grid {
            grid-template-columns: 1fr;
          }

          .scan-card-header,
          .scan-card-content,
          .scan-review-content,
          .scan-card-footer {
            padding-left: 20px;
            padding-right: 20px;
          }

          .scan-card-header h2 {
            font-size: 24px;
          }

          .scan-review-result-header {
            flex-direction: column;
          }

          .scan-confidence {
            width: 100%;
          }

          .scan-card-footer {
            align-items: stretch;
            flex-direction: column;
            gap: 14px;
          }

          .scan-card-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .scan-cancel-button,
          .scan-identify-button {
            width: 100%;
            min-width: 0;
          }
        }

        @media (max-width: 520px) {
          .scan-review-images {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

type ResultFieldProps = {
  label: string;
  value: string | number | null;
  uncertainFields: string[];
  fieldName: string;
};

function ResultField({
  label,
  value,
  uncertainFields,
  fieldName,
}: ResultFieldProps) {
  const isUncertain = uncertainFields.some(
    (field) => field.toLowerCase() === fieldName.toLowerCase()
  );

  return (
    <div
      className={[
        "scan-result-field",
        isUncertain ? "scan-result-field-uncertain" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span>{label}</span>
      <strong>{value || "Not identified"}</strong>

      <style jsx>{`
        .scan-result-field {
          min-width: 0;
          padding: 13px 14px;
          border: 1px solid rgba(148, 163, 184, 0.11);
          border-radius: 13px;
          background: rgba(0, 0, 0, 0.14);
        }

        .scan-result-field-uncertain {
          border-color: rgba(251, 191, 36, 0.28);
          background: rgba(245, 158, 11, 0.07);
        }

        .scan-result-field span {
          display: block;
          color: #71798b;
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .scan-result-field strong {
          display: block;
          overflow: hidden;
          margin-top: 6px;
          color: #f8fafc;
          font-size: 13px;
          line-height: 1.4;
          text-overflow: ellipsis;
        }

        .scan-result-field-uncertain span,
        .scan-result-field-uncertain strong {
          color: #fde68a;
        }
      `}</style>
    </div>
  );
}