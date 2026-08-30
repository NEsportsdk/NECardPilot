import { describe, expect, it } from "vitest";

import {
  createLocalCaptureItem,
  localCaptureImageToFile,
} from "./localCaptureQueue";

describe("local capture queue", () => {
  it("stores both prepared card images without changing their metadata", () => {
    const front = new File(["front"], "front.webp", {
      type: "image/webp",
      lastModified: 100,
    });
    const back = new File(["back"], "back.jpg", {
      type: "image/jpeg",
      lastModified: 200,
    });

    const item = createLocalCaptureItem({
      captureSessionId: "752c60e8-e584-435d-b860-a963c80714e4",
      collectionId: "d3c1c30d-c878-4536-be2e-23877be29458",
      collectionName: "Personal Collection",
      frontImage: front,
      backImage: back,
    });

    expect(item.id).toMatch(/^[a-zA-Z0-9-_]{8,128}$/);
    expect(item.status).toBe("queued");
    expect(item.attemptCount).toBe(0);
    expect(item.front).toMatchObject({
      name: "front.webp",
      type: "image/webp",
      lastModified: 100,
    });
    expect(item.back).toMatchObject({
      name: "back.jpg",
      type: "image/jpeg",
      lastModified: 200,
    });
  });

  it("restores an IndexedDB image as a File for background upload", async () => {
    const restored = localCaptureImageToFile({
      blob: new Blob(["card-image"], { type: "image/jpeg" }),
      name: "capture.jpg",
      type: "image/jpeg",
      lastModified: 300,
    });

    expect(restored).toBeInstanceOf(File);
    expect(restored.name).toBe("capture.jpg");
    expect(restored.type).toBe("image/jpeg");
    expect(restored.lastModified).toBe(300);
    expect(await restored.text()).toBe("card-image");
  });
});
