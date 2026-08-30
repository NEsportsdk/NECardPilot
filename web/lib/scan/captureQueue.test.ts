import { describe, expect, it } from "vitest";

import type { IdentifiedCard } from "./identifyCard";
import {
  canIdentifyCaptureItem,
  captureQueueItemToUploadResult,
  type CaptureQueueItem,
} from "./captureQueue";

const IDENTIFIED_CARD: IdentifiedCard = {
  sport: "Basketball",
  playerName: "Michael Jordan",
  team: "Chicago Bulls",
  manufacturer: "Fleer",
  brand: "Fleer",
  product: "Fleer",
  setName: null,
  year: "1986",
  cardNumber: "57",
  parallel: null,
  serialNumber: null,
  serialNumberedTo: null,
  rookieCard: true,
  autograph: false,
  memorabilia: false,
  memorabiliaType: null,
  gradingCompany: null,
  grade: null,
  certificationNumber: null,
  language: "English",
  variation: null,
  notes: [],
  confidence: 0.95,
  needsManualReview: false,
  uncertainFields: [],
};

function createQueueItem(
  overrides: Partial<CaptureQueueItem> = {}
): CaptureQueueItem {
  return {
    id: "04c00419-ab04-4dc2-b46b-d3c5a9d7558c",
    userId: "8ac08737-eed9-42e4-bc31-fe465d11a31b",
    collectionId: "04ff56be-940b-4fc5-9392-f36c33b7a73c",
    captureSessionId: "5124966d-aebd-40e4-8897-aed09b0806b9",
    status: "uploaded",
    frontImagePath:
      "8ac08737-eed9-42e4-bc31-fe465d11a31b/collection/scan/front.jpg",
    backImagePath:
      "8ac08737-eed9-42e4-bc31-fe465d11a31b/collection/scan/back.jpg",
    frontOriginalName: "front.jpg",
    backOriginalName: "back.jpg",
    frontMimeType: "image/jpeg",
    backMimeType: "image/jpeg",
    frontSizeBytes: 1234,
    backSizeBytes: 2345,
    identificationResult: null,
    identificationUsage: null,
    attemptCount: 0,
    failureStage: null,
    errorMessage: null,
    cardId: null,
    capturedAt: "2026-08-30T18:30:00.000Z",
    identificationStartedAt: null,
    identifiedAt: null,
    savedAt: null,
    createdAt: "2026-08-30T18:30:00.000Z",
    updatedAt: "2026-08-30T18:30:00.000Z",
    ...overrides,
  };
}

describe("captureQueueItemToUploadResult", () => {
  it("recreates the existing review upload contract from a queued item", () => {
    const result = captureQueueItemToUploadResult(
      createQueueItem({ identificationResult: IDENTIFIED_CARD })
    );

    expect(result).toEqual({
      scanId: "04c00419-ab04-4dc2-b46b-d3c5a9d7558c",
      front: {
        side: "front",
        bucket: "card-images",
        path: expect.stringMatching(/front\.jpg$/),
        originalFileName: "front.jpg",
        mimeType: "image/jpeg",
        size: 1234,
      },
      back: {
        side: "back",
        bucket: "card-images",
        path: expect.stringMatching(/back\.jpg$/),
        originalFileName: "back.jpg",
        mimeType: "image/jpeg",
        size: 2345,
      },
    });
  });
});

describe("canIdentifyCaptureItem", () => {
  it("accepts fresh uploads and identification retries only", () => {
    expect(canIdentifyCaptureItem(createQueueItem())).toBe(true);
    expect(
      canIdentifyCaptureItem(
        createQueueItem({
          status: "failed",
          failureStage: "identification",
        })
      )
    ).toBe(true);
    expect(
      canIdentifyCaptureItem(
        createQueueItem({ status: "failed", failureStage: "upload" })
      )
    ).toBe(false);
    expect(canIdentifyCaptureItem(createQueueItem({ status: "identified" })))
      .toBe(false);
  });
});
