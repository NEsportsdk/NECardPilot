"use client";

import {
  type ChangeEvent,
  type DragEvent,
  useRef,
  useState,
} from "react";

import type {
  PreparedCardImage,
} from "@/lib/scan/prepareCardImage";

export type ImageSide = "front" | "back";

type ImageUploadBoxProps = {
  side: ImageSide;
  file: File | null;
  previewUrl: string | null;
  disabled: boolean;
  isPreparing?: boolean;
  preparation?: PreparedCardImage | null;
  onSelect: (file: File) => void | Promise<void>;
  onRemove: () => void;
};

const LIBRARY_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getStatusLabel(side: ImageSide) {
  return side === "front" ? "Front ready" : "Back ready";
}

export default function ImageUploadBox({
  side,
  file,
  previewUrl,
  disabled,
  isPreparing = false,
  preparation = null,
  onSelect,
  onRemove,
}: ImageUploadBoxProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const isFront = side === "front";
  const title = isFront ? "Front of card" : "Back of card";
  const isInteractionDisabled = disabled || isPreparing;

  function openCamera() {
    if (!isInteractionDisabled) {
      cameraInputRef.current?.click();
    }
  }

  function openLibrary() {
    if (!isInteractionDisabled) {
      libraryInputRef.current?.click();
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";

    if (selectedFile) {
      await onSelect(selectedFile);
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    if (!isInteractionDisabled) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    if (isInteractionDisabled) {
      return;
    }

    const droppedFile = event.dataTransfer.files?.[0];

    if (droppedFile) {
      await onSelect(droppedFile);
    }
  }

  return (
    <div className="scan-upload-column">
      <div className="scan-upload-heading">
        <div>
          <div className="scan-upload-title-row">
            <span className="scan-step-number">
              {isFront ? "1" : "2"}
            </span>

            <h3>{title}</h3>
          </div>

          <p>
            {isFront
              ? "Keep the entire card visible and avoid glare."
              : "The back is important for card number, set and certification details."}
          </p>
        </div>

        {file && (
          <button
            className="scan-remove-button"
            type="button"
            onClick={onRemove}
            disabled={isInteractionDisabled}
          >
            Remove
          </button>
        )}
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        disabled={isInteractionDisabled}
        className="scan-hidden-input"
        aria-label={`Take photo of ${side} of card`}
      />

      <input
        ref={libraryInputRef}
        type="file"
        accept={LIBRARY_IMAGE_TYPES.join(",")}
        onChange={handleFileChange}
        disabled={isInteractionDisabled}
        className="scan-hidden-input"
        aria-label={`Choose ${side} image from library`}
      />

      {previewUrl ? (
        <div className="scan-preview">
          <div className="scan-preview-image-wrapper">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={`${title} preview`}
              className="scan-preview-image"
            />

            <span className="scan-ready-badge">
              <span>✓</span>
              {getStatusLabel(side)}
            </span>

            {isPreparing && (
              <div className="scan-preparing-overlay">
                <span className="scan-preparing-spinner" />
                <strong>Optimizing image...</strong>
              </div>
            )}
          </div>

          <div className="scan-preview-footer">
            <div className="scan-preview-file">
              <strong>{file?.name}</strong>

              <span>
                {file ? formatFileSize(file.size) : ""}
                {preparation
                  ? ` · ${preparation.width} × ${preparation.height}px`
                  : ""}
              </span>

              {preparation?.wasOptimized && (
                <small>
                  Optimized from {formatFileSize(preparation.originalSize)} for faster upload
                </small>
              )}
            </div>

            <div className="scan-preview-actions">
              <button
                className="scan-secondary-action"
                type="button"
                onClick={openCamera}
                disabled={isInteractionDisabled}
              >
                Retake
              </button>

              <button
                className="scan-secondary-action"
                type="button"
                onClick={openLibrary}
                disabled={isInteractionDisabled}
              >
                Choose another
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={[
            "scan-dropzone",
            isDragging ? "scan-dropzone-dragging" : "",
            isInteractionDisabled ? "scan-dropzone-disabled" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isPreparing ? (
            <div className="scan-preparing-state">
              <span className="scan-preparing-spinner" />
              <strong>Preparing image</strong>
              <p>Optimizing size and orientation for a fast, reliable scan.</p>
            </div>
          ) : (
            <>
              <div className="scan-upload-icon">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.1-1.7A2 2 0 0 1 10.8 3.5h2.4a2 2 0 0 1 1.7.8L16 6h1.5A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="12"
                    cy="12.5"
                    r="3.2"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                </svg>
              </div>

              <strong>
                {isFront ? "Capture the front" : "Capture the back"}
              </strong>

              <p className="scan-mobile-guidance">
                Use the rear camera and keep all four card edges visible.
              </p>

              <div className="scan-capture-actions">
                <button
                  className="scan-camera-button"
                  type="button"
                  onClick={openCamera}
                  disabled={isInteractionDisabled}
                >
                  <span>◎</span>
                  Take photo
                </button>

                <button
                  className="scan-library-button"
                  type="button"
                  onClick={openLibrary}
                  disabled={isInteractionDisabled}
                >
                  <span>▧</span>
                  Choose from library
                </button>
              </div>

              <p className="scan-desktop-guidance">
                On desktop, you can also drag an image here.
                <br />
                JPG, PNG, WEBP, HEIC or HEIF · up to 40 MB before optimization
              </p>
            </>
          )}
        </div>
      )}

      <style jsx>{`
        .scan-upload-column {
          min-width: 0;
        }

        .scan-upload-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          min-height: 60px;
          gap: 14px;
          margin-bottom: 14px;
        }

        .scan-upload-title-row {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .scan-step-number {
          width: 24px;
          height: 24px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border: 1px solid rgba(167, 139, 250, 0.25);
          border-radius: 8px;
          background: rgba(139, 92, 246, 0.08);
          color: #c4b5fd;
          font-size: 10px;
          font-weight: 800;
        }

        .scan-upload-heading h3 {
          margin: 0;
          color: #ffffff;
          font-size: 15px;
        }

        .scan-upload-heading p {
          max-width: 430px;
          margin: 7px 0 0;
          color: #71798b;
          font-size: 12px;
          line-height: 1.45;
        }

        .scan-remove-button {
          min-height: 36px;
          border: 0;
          border-radius: 9px;
          padding: 0 10px;
          background: transparent;
          color: #9299aa;
          font-size: 12px;
          cursor: pointer;
        }

        .scan-remove-button:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.05);
          color: #ffffff;
        }

        .scan-remove-button:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .scan-hidden-input {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          clip-path: inset(50%);
        }

        .scan-dropzone {
          min-height: 320px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 28px;
          border: 1px dashed rgba(148, 163, 184, 0.24);
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.02);
          text-align: center;
          transition:
            border-color 160ms ease,
            background 160ms ease,
            transform 160ms ease;
        }

        .scan-dropzone-dragging {
          transform: translateY(-1px);
          border-color: #a78bfa;
          background: rgba(124, 92, 255, 0.1);
        }

        .scan-dropzone-disabled {
          opacity: 0.55;
        }

        .scan-upload-icon {
          width: 60px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(148, 163, 184, 0.15);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.04);
          color: #c2c7d3;
        }

        .scan-upload-icon svg {
          width: 27px;
          height: 27px;
        }

        .scan-dropzone > strong,
        .scan-preparing-state strong {
          margin-top: 17px;
          color: #ffffff;
          font-size: 15px;
        }

        .scan-mobile-guidance,
        .scan-desktop-guidance,
        .scan-preparing-state p {
          margin: 8px 0 0;
          color: #71798b;
          font-size: 12px;
          line-height: 1.55;
        }

        .scan-capture-actions {
          width: min(100%, 430px);
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 20px;
        }

        .scan-camera-button,
        .scan-library-button,
        .scan-secondary-action {
          min-height: 48px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 750;
          cursor: pointer;
        }

        .scan-camera-button {
          border: 0;
          background: linear-gradient(135deg, #8b5cf6, #6d5ce7);
          color: #ffffff;
          box-shadow: 0 10px 25px rgba(124, 92, 255, 0.2);
        }

        .scan-library-button,
        .scan-secondary-action {
          border: 1px solid rgba(148, 163, 184, 0.16);
          background: rgba(255, 255, 255, 0.035);
          color: #c5cad5;
        }

        .scan-camera-button:hover:not(:disabled),
        .scan-library-button:hover:not(:disabled),
        .scan-secondary-action:hover:not(:disabled) {
          filter: brightness(1.08);
        }

        .scan-camera-button:disabled,
        .scan-library-button:disabled,
        .scan-secondary-action:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .scan-preview {
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.15);
          border-radius: 20px;
          background: rgba(0, 0, 0, 0.25);
        }

        .scan-preview-image-wrapper {
          position: relative;
          min-height: 320px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background:
            radial-gradient(circle at center, rgba(124, 92, 255, 0.08), transparent 50%),
            rgba(0, 0, 0, 0.12);
        }

        .scan-preview-image {
          display: block;
          max-width: 100%;
          max-height: 400px;
          border-radius: 13px;
          object-fit: contain;
        }

        .scan-ready-badge {
          position: absolute;
          top: 12px;
          left: 12px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 9px;
          border: 1px solid rgba(52, 211, 153, 0.25);
          border-radius: 999px;
          background: rgba(6, 54, 42, 0.88);
          color: #a7f3d0;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          backdrop-filter: blur(10px);
        }

        .scan-preview-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 14px 16px;
          border-top: 1px solid rgba(148, 163, 184, 0.12);
          background: rgba(0, 0, 0, 0.24);
        }

        .scan-preview-file {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .scan-preview-file strong {
          overflow: hidden;
          color: #ffffff;
          font-size: 13px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .scan-preview-file span,
        .scan-preview-file small {
          color: #71798b;
          font-size: 10px;
          line-height: 1.4;
        }

        .scan-preview-file small {
          color: #86a59b;
        }

        .scan-preview-actions {
          flex: 0 0 auto;
          display: flex;
          gap: 8px;
        }

        .scan-secondary-action {
          min-height: 40px;
          padding: 0 11px;
          font-size: 10px;
        }

        .scan-preparing-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: rgba(7, 9, 14, 0.78);
          color: #ddd6fe;
          backdrop-filter: blur(8px);
        }

        .scan-preparing-state {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .scan-preparing-spinner {
          width: 28px;
          height: 28px;
          border: 2px solid rgba(196, 181, 253, 0.2);
          border-top-color: #c4b5fd;
          border-radius: 50%;
          animation: prepare-spin 700ms linear infinite;
        }

        @keyframes prepare-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 760px) {
          .scan-upload-heading {
            min-height: 0;
          }

          .scan-dropzone,
          .scan-preview-image-wrapper {
            min-height: 280px;
          }

          .scan-dropzone {
            padding: 22px 18px;
          }

          .scan-desktop-guidance {
            display: none;
          }

          .scan-capture-actions {
            grid-template-columns: 1fr;
            width: 100%;
          }

          .scan-camera-button,
          .scan-library-button {
            width: 100%;
            min-height: 52px;
            font-size: 13px;
          }

          .scan-preview-footer {
            align-items: stretch;
            flex-direction: column;
          }

          .scan-preview-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .scan-secondary-action {
            width: 100%;
            min-height: 44px;
          }
        }

        @media (max-width: 420px) {
          .scan-preview-actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}