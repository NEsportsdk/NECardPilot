"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import AIReviewPanel from "./scan/AIReviewPanel";

import ImageUploadBox, {
  type ImageSide,
} from "./scan/ImageUploadBox";

import {
  identifyCard,
  type IdentifiedCard,
} from "@/lib/scan/identifyCard";

import type {
  SaveIdentifiedCardResult,
} from "@/lib/scan/saveIdentifiedCard";

import {
  uploadCardImages,
  type UploadCardImagesResult,
} from "@/lib/scan/uploadCardImages";

type ScanCardModalProps = {
  isOpen: boolean;

  collectionId: string;

  onClose: () => void;

  onUploadComplete?: (
    result: UploadCardImagesResult
  ) => void;

  onCardSaved?: (
    result: SaveIdentifiedCardResult
  ) => void;
};

type ProcessingStage =
  | "idle"
  | "uploading"
  | "identifying";

const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

const MAX_IMAGE_SIZE =
  15 * 1024 * 1024;

function getReadableError(
  error: unknown
) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Kortet kunne ikke identificeres. Prøv igen.";
}

export default function ScanCardModal({
  isOpen,
  collectionId,
  onClose,
  onUploadComplete,
  onCardSaved,
}: ScanCardModalProps) {
  const [
    frontImage,
    setFrontImage,
  ] = useState<File | null>(null);

  const [
    backImage,
    setBackImage,
  ] = useState<File | null>(null);

  const [
    frontPreviewUrl,
    setFrontPreviewUrl,
  ] = useState<string | null>(
    null
  );

  const [
    backPreviewUrl,
    setBackPreviewUrl,
  ] = useState<string | null>(
    null
  );

  const [
    processingStage,
    setProcessingStage,
  ] = useState<ProcessingStage>(
    "idle"
  );

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null
  );

  const [
    uploadResult,
    setUploadResult,
  ] =
    useState<UploadCardImagesResult | null>(
      null
    );

  const [
    identifiedCard,
    setIdentifiedCard,
  ] =
    useState<IdentifiedCard | null>(
      null
    );

  const isProcessing =
    processingStage ===
      "uploading" ||
    processingStage ===
      "identifying";

  const isReviewing =
    Boolean(
      identifiedCard &&
        uploadResult
    );

  const resetModal =
    useCallback(() => {
      setFrontImage(null);
      setBackImage(null);

      setErrorMessage(null);

      setUploadResult(null);
      setIdentifiedCard(null);

      setProcessingStage("idle");
    }, []);

  const handleClose =
    useCallback(() => {
      if (isProcessing) {
        return;
      }

      resetModal();
      onClose();
    }, [
      isProcessing,
      onClose,
      resetModal,
    ]);

  const handleScanAgain =
    useCallback(() => {
      resetModal();
    }, [resetModal]);

  const handleCardSaved =
    useCallback(
      (
        result:
          SaveIdentifiedCardResult
      ) => {
        onCardSaved?.(result);

        resetModal();
        onClose();

        /*
         * Collection-siden henter i
         * øjeblikket kortene ved
         * indlæsning. En fuld reload
         * sikrer derfor, at det nye
         * kort vises med det samme.
         */
        window.setTimeout(() => {
          window.location.reload();
        }, 100);
      },
      [
        onCardSaved,
        onClose,
        resetModal,
      ]
    );

  useEffect(() => {
    if (!frontImage) {
      setFrontPreviewUrl(null);
      return;
    }

    const objectUrl =
      URL.createObjectURL(
        frontImage
      );

    setFrontPreviewUrl(
      objectUrl
    );

    return () => {
      URL.revokeObjectURL(
        objectUrl
      );
    };
  }, [frontImage]);

  useEffect(() => {
    if (!backImage) {
      setBackPreviewUrl(null);
      return;
    }

    const objectUrl =
      URL.createObjectURL(
        backImage
      );

    setBackPreviewUrl(
      objectUrl
    );

    return () => {
      URL.revokeObjectURL(
        objectUrl
      );
    };
  }, [backImage]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(
      event: KeyboardEvent
    ) {
      if (
        event.key === "Escape" &&
        !isProcessing
      ) {
        handleClose();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    document.body.style.overflow =
      "hidden";

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );

      document.body.style.overflow =
        "";
    };
  }, [
    handleClose,
    isOpen,
    isProcessing,
  ]);

  function clearPreviousResult() {
    setErrorMessage(null);

    setUploadResult(null);
    setIdentifiedCard(null);

    setProcessingStage("idle");
  }

  function validateSelectedImage(
    file: File
  ) {
    if (
      !ACCEPTED_IMAGE_TYPES.includes(
        file.type
      )
    ) {
      setErrorMessage(
        "Billedet skal være en JPG-, PNG-, WEBP- eller HEIC-fil."
      );

      return false;
    }

    if (
      file.size >
      MAX_IMAGE_SIZE
    ) {
      setErrorMessage(
        "Billedet må højst fylde 15 MB."
      );

      return false;
    }

    clearPreviousResult();

    return true;
  }

  function handleSelectImage(
    side: ImageSide,
    file: File
  ) {
    if (
      !validateSelectedImage(
        file
      )
    ) {
      return;
    }

    if (side === "front") {
      setFrontImage(file);
      return;
    }

    setBackImage(file);
  }

  function handleRemoveImage(
    side: ImageSide
  ) {
    clearPreviousResult();

    if (side === "front") {
      setFrontImage(null);
      return;
    }

    setBackImage(null);
  }

  async function handleIdentifyWithAi() {
    if (
      !frontImage ||
      !backImage
    ) {
      setErrorMessage(
        "Upload både forsiden og bagsiden af kortet, før du fortsætter."
      );

      return;
    }

    if (
      !collectionId?.trim()
    ) {
      setErrorMessage(
        "Der er ikke valgt en collection."
      );

      return;
    }

    setErrorMessage(null);
    setIdentifiedCard(null);

    try {
      /*
       * Hvis uploaden allerede
       * lykkedes, men AI-kaldet
       * fejlede, genbruger vi de
       * eksisterende billeder.
       */
      let uploadedImages =
        uploadResult;

      if (!uploadedImages) {
        setProcessingStage(
          "uploading"
        );

        uploadedImages =
          await uploadCardImages({
            collectionId,

            frontImage,

            backImage,
          });

        setUploadResult(
          uploadedImages
        );

        onUploadComplete?.(
          uploadedImages
        );
      }

      setProcessingStage(
        "identifying"
      );

      const identification =
        await identifyCard(
          uploadedImages.front.path,
          uploadedImages.back.path
        );

      if (
        !identification.success ||
        !identification.card
      ) {
        throw new Error(
          "AI kunne ikke identificere kortet ud fra billederne."
        );
      }

      setIdentifiedCard(
        identification.card
      );

      setProcessingStage(
        "idle"
      );
    } catch (error) {
      setErrorMessage(
        getReadableError(error)
      );

      setProcessingStage(
        "idle"
      );
    }
  }

  if (!isOpen) {
    return null;
  }

  const canSubmit =
    Boolean(frontImage) &&
    Boolean(backImage) &&
    Boolean(
      collectionId?.trim()
    ) &&
    !isProcessing &&
    !identifiedCard;

  return (
    <div
      className="scan-card-backdrop"
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
        className={[
          "scan-card-modal",

          isReviewing
            ? "scan-card-modal-review"
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="scan-card-title"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <header className="scan-card-header">
          <div>
            <span className="scan-card-badge">
              AI SCAN
            </span>

            <h2 id="scan-card-title">
              {isReviewing
                ? "Review and save"
                : "Scan a card"}
            </h2>

            <p>
              {isReviewing
                ? "Check the AI result, add your purchase details and save the card."
                : "Upload both sides. NECardPilot will identify the card automatically."}
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

        {identifiedCard &&
        uploadResult ? (
          <AIReviewPanel
            collectionId={
              collectionId
            }
            card={identifiedCard}
            uploadResult={
              uploadResult
            }
            frontPreviewUrl={
              frontPreviewUrl
            }
            backPreviewUrl={
              backPreviewUrl
            }
            onScanAgain={
              handleScanAgain
            }
            onSaved={
              handleCardSaved
            }
          />
        ) : (
          <>
            <div className="scan-card-content">
              <ImageUploadBox
                side="front"
                file={frontImage}
                previewUrl={
                  frontPreviewUrl
                }
                disabled={
                  isProcessing
                }
                onSelect={(file) =>
                  handleSelectImage(
                    "front",
                    file
                  )
                }
                onRemove={() =>
                  handleRemoveImage(
                    "front"
                  )
                }
              />

              <ImageUploadBox
                side="back"
                file={backImage}
                previewUrl={
                  backPreviewUrl
                }
                disabled={
                  isProcessing
                }
                onSelect={(file) =>
                  handleSelectImage(
                    "back",
                    file
                  )
                }
                onRemove={() =>
                  handleRemoveImage(
                    "back"
                  )
                }
              />
            </div>

            {(errorMessage ||
              isProcessing) && (
              <div className="scan-message-wrapper">
                {errorMessage && (
                  <div
                    className="scan-message scan-error-message"
                    role="alert"
                  >
                    <span className="scan-message-icon">
                      !
                    </span>

                    <div>
                      <strong>
                        Identification failed
                      </strong>

                      <p>
                        {errorMessage}
                      </p>
                    </div>
                  </div>
                )}

                {isProcessing && (
                  <div className="scan-message scan-progress-message">
                    <span className="scan-progress-spinner" />

                    <div>
                      <strong>
                        {processingStage ===
                        "uploading"
                          ? "Uploading images"
                          : "Identifying card"}
                      </strong>

                      <p>
                        {processingStage ===
                        "uploading"
                          ? "The front and back images are being stored securely."
                          : "AI and Card Brain are examining the card. This may take a moment."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <footer className="scan-card-footer">
              <p>
                Use clear, well-lit
                images and keep the
                entire card visible.
              </p>

              <div className="scan-card-actions">
                <button
                  className="scan-cancel-button"
                  type="button"
                  onClick={
                    handleClose
                  }
                  disabled={
                    isProcessing
                  }
                >
                  Cancel
                </button>

                <button
                  className="scan-identify-button"
                  type="button"
                  onClick={
                    handleIdentifyWithAi
                  }
                  disabled={
                    !canSubmit
                  }
                >
                  {processingStage ===
                  "uploading" ? (
                    <>
                      <span className="scan-button-spinner" />
                      Uploading...
                    </>
                  ) : processingStage ===
                    "identifying" ? (
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
              </div>
            </footer>
          </>
        )}
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
          background: rgba(
            3,
            5,
            12,
            0.86
          );
          backdrop-filter: blur(
            14px
          );
        }

        .scan-card-modal {
          width: min(
            1040px,
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
              transparent 34%
            ),
            #11131c;
          box-shadow:
            0 35px 110px
              rgba(
                0,
                0,
                0,
                0.65
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

        .scan-card-modal-review {
          width: min(
            1180px,
            100%
          );
        }

        .scan-card-header {
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
            0.96
          );
          backdrop-filter: blur(
            18px
          );
        }

        .scan-card-badge {
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

        .scan-card-header h2 {
          margin: 13px 0 0;
          color: #ffffff;
          font-size: 28px;
          letter-spacing: -0.035em;
        }

        .scan-card-header p {
          margin: 8px 0 0;
          max-width: 650px;
          color: #9299aa;
          font-size: 14px;
          line-height: 1.55;
        }

        .scan-card-close {
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

        .scan-card-close:hover:not(
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

        .scan-card-close:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .scan-card-content {
          display: grid;
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
          gap: 28px;
          padding: 28px 30px;
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

        .scan-progress-message {
          border: 1px solid
            rgba(
              167,
              139,
              250,
              0.24
            );
          background: rgba(
            139,
            92,
            246,
            0.08
          );
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
          background: rgba(
            255,
            255,
            255,
            0.08
          );
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
          animation: scan-spin
            700ms linear infinite;
        }

        .scan-progress-spinner {
          width: 24px;
          height: 24px;
          border: 2px solid
            rgba(
              196,
              181,
              253,
              0.2
            );
          border-top-color: #c4b5fd;
        }

        .scan-button-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid
            rgba(
              0,
              0,
              0,
              0.25
            );
          border-top-color: #0a0b10;
        }

        .scan-card-footer {
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
            0.96
          );
          backdrop-filter: blur(
            18px
          );
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

        .scan-cancel-button:hover:not(
            :disabled
          ) {
          color: #ffffff;
          background: rgba(
            255,
            255,
            255,
            0.06
          );
        }

        .scan-identify-button {
          min-width: 182px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border: 0;
          background: linear-gradient(
            135deg,
            #ffffff,
            #d9dce5
          );
          color: #0a0b10;
          box-shadow: 0 10px 28px
            rgba(
              0,
              0,
              0,
              0.24
            );
        }

        .scan-identify-button:hover:not(
            :disabled
          ) {
          filter: brightness(
            1.05
          );
        }

        .scan-cancel-button:disabled,
        .scan-identify-button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        @keyframes scan-spin {
          to {
            transform: rotate(
              360deg
            );
          }
        }

        @media (
          max-width: 760px
        ) {
          .scan-card-backdrop {
            align-items: flex-end;
            padding: 10px;
          }

          .scan-card-modal {
            max-height: calc(
              100vh - 20px
            );
            border-radius: 22px;
          }

          .scan-card-content {
            grid-template-columns:
              1fr;
          }

          .scan-card-header,
          .scan-card-content,
          .scan-card-footer {
            padding-left: 20px;
            padding-right: 20px;
          }

          .scan-card-header h2 {
            font-size: 24px;
          }

          .scan-card-footer {
            align-items: stretch;
            flex-direction: column;
            gap: 14px;
          }

          .scan-card-actions {
            display: grid;
            grid-template-columns:
              1fr 1fr;
          }

          .scan-cancel-button,
          .scan-identify-button {
            width: 100%;
            min-width: 0;
          }
        }
      `}</style>
    </div>
  );
}