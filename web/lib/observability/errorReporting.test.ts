import { describe, expect, it } from "vitest";
import {
  createStructuredErrorEvent,
  normalizeRequestPath,
} from "./errorReporting";

describe("normalizeRequestPath", () => {
  it("removes query strings and fragments from logged paths", () => {
    expect(normalizeRequestPath("/cards/42?token=secret#details")).toBe(
      "/cards/42"
    );
  });

  it("falls back to the root path", () => {
    expect(normalizeRequestPath("?search=cards")).toBe("/");
  });
});

describe("createStructuredErrorEvent", () => {
  it("creates a stable event for Error instances", () => {
    const error = Object.assign(new TypeError("Kortet kunne ikke gemmes"), {
      digest: "abc123",
    });

    expect(
      createStructuredErrorEvent({
        error,
        event: "next_request_error",
        source: "server",
        timestamp: "2026-08-27T12:00:00.000Z",
        context: { method: "POST", path: "/api/cards/save-scanned" },
      })
    ).toEqual({
      level: "error",
      event: "next_request_error",
      source: "server",
      timestamp: "2026-08-27T12:00:00.000Z",
      errorName: "TypeError",
      errorMessage: "Kortet kunne ikke gemmes",
      errorDigest: "abc123",
      method: "POST",
      path: "/api/cards/save-scanned",
    });
  });

  it("normalizes non-Error values without exposing extra data", () => {
    const event = createStructuredErrorEvent({
      error: "network_failed",
      event: "react_error_boundary",
      source: "client",
      timestamp: "2026-08-27T12:00:00.000Z",
    });

    expect(event.errorName).toBe("Error");
    expect(event.errorMessage).toBe("network_failed");
    expect(event).not.toHaveProperty("stack");
  });
});
