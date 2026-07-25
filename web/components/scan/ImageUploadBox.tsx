"use client";

import {
  ChangeEvent,
  DragEvent,
  useRef,
  useState,
} from "react";

export type ImageSide = "front" | "back";

type ImageUploadBoxProps = {
  side: ImageSide;
  file: File | null;
  previewUrl: string | null;
  disabled: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
};

const ACCEPTED_IMAGE_TYPES = [
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

export default function ImageUploadBox({
  side,
  file,
  previewUrl,
  disabled,
  onSelect,
  onRemove,
}: ImageUploadBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const isFront = side === "front";
  const title = isFront ? "Front of card" : "Back of card";

  function openFilePicker() {
    if (!disabled) {
      inputRef.current?.click();
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];

    if (selectedFile) {
      onSelect(selectedFile);
    }

    event.target.value = "";
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    if (!disabled) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    if (disabled) {
      return;
    }

    const droppedFile = event.dataTransfer.files?.[0];

    if (droppedFile) {
      onSelect(droppedFile);
    }
  }

  return (
    <div className="scan-upload-column">
      <div className="scan-upload-heading">
        <div>
          <h3>{title}</h3>

          <p>
            {isFront
              ? "Upload a clear image of the front."
              : "The back often contains important checklist data."}
          </p>
        </div>

        {file && (
          <button
            className="scan-remove-button"
            type="button"
            onClick={onRemove}
            disabled={disabled}
          >
            Remove
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        onChange={handleFileChange}
        disabled={disabled}
        className="scan-hidden-input"
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
          </div>

          <div className="scan-preview-footer">
            <div className="scan-preview-file">
              <strong>{file?.name}</strong>
              <span>{file ? formatFileSize(file.size) : ""}</span>
            </div>

            <button
              className="scan-replace-button"
              type="button"
              onClick={openFilePicker}
              disabled={disabled}
            >
              Replace
            </button>
          </div>
        </div>
      ) : (
        <div
          className={[
            "scan-dropzone",
            isDragging ? "scan-dropzone-dragging" : "",
            disabled ? "scan-dropzone-disabled" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={openFilePicker}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openFilePicker();
            }
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="scan-upload-icon">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 16V4m0 0 4 4m-4-4L8 8M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <strong>
            Upload {isFront ? "front" : "back"} image
          </strong>

          <p>
            Click to choose a file or drag an image here.
            <br />
            JPG, PNG, WEBP or HEIC · max. 15 MB
          </p>
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
          min-height: 56px;
          margin-bottom: 14px;
        }

        .scan-upload-heading h3 {
          margin: 0;
          color: #ffffff;
          font-size: 15px;
        }

        .scan-upload-heading p {
          margin: 6px 0 0;
          color: #71798b;
          font-size: 12px;
          line-height: 1.45;
        }

        .scan-remove-button {
          border: 0;
          border-radius: 9px;
          padding: 7px 10px;
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
          display: none;
        }

        .scan-dropzone {
          min-height: 300px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 28px;
          border: 1px dashed rgba(148, 163, 184, 0.24);
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.02);
          text-align: center;
          cursor: pointer;
          transition:
            border-color 160ms ease,
            background 160ms ease,
            transform 160ms ease;
        }

        .scan-dropzone:hover {
          transform: translateY(-1px);
          border-color: rgba(167, 139, 250, 0.55);
          background: rgba(124, 92, 255, 0.055);
        }

        .scan-dropzone-dragging {
          border-color: #a78bfa;
          background: rgba(124, 92, 255, 0.1);
        }

        .scan-dropzone-disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .scan-upload-icon {
          width: 58px;
          height: 58px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(148, 163, 184, 0.15);
          border-radius: 17px;
          background: rgba(255, 255, 255, 0.04);
          color: #c2c7d3;
        }

        .scan-upload-icon svg {
          width: 25px;
          height: 25px;
        }

        .scan-dropzone strong {
          margin-top: 17px;
          color: #ffffff;
          font-size: 15px;
        }

        .scan-dropzone p {
          margin: 9px 0 0;
          color: #71798b;
          font-size: 12px;
          line-height: 1.65;
        }

        .scan-preview {
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.15);
          border-radius: 20px;
          background: rgba(0, 0, 0, 0.25);
        }

        .scan-preview-image-wrapper {
          min-height: 300px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
        }

        .scan-preview-image {
          display: block;
          max-width: 100%;
          max-height: 370px;
          border-radius: 13px;
          object-fit: contain;
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

        .scan-preview-file span {
          color: #71798b;
          font-size: 11px;
        }

        .scan-replace-button {
          flex: 0 0 auto;
          padding: 9px 13px;
          border: 1px solid rgba(148, 163, 184, 0.17);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.045);
          color: #ffffff;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .scan-replace-button:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08);
        }

        .scan-replace-button:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        @media (max-width: 760px) {
          .scan-dropzone,
          .scan-preview-image-wrapper {
            min-height: 250px;
          }
        }
      `}</style>
    </div>
  );
}