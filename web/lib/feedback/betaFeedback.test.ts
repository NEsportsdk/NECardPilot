import { describe, expect, it } from "vitest";

import {
  BetaFeedbackValidationError,
  getBetaFeedbackHref,
  getBetaFeedbackOriginPath,
  parseBetaFeedback,
} from "@/lib/feedback/betaFeedback";

const validFeedback = {
  allowFollowUp: true,
  category: "usability",
  deviceContext: {
    language: "en-GB",
    online: true,
    screen: "mobile",
    standalone: false,
  },
  experienceRating: 4,
  message: "The scanner flow is fast, but this action needs a clearer label.",
  pagePath: "/scanner?session=private#capture",
};

describe("beta feedback validation", () => {
  it("normalizes a valid feedback submission", () => {
    expect(parseBetaFeedback(validFeedback)).toEqual({
      ...validFeedback,
      pagePath: "/scanner",
    });
  });

  it("rejects unsupported categories and invalid ratings", () => {
    expect(() =>
      parseBetaFeedback({ ...validFeedback, category: "security" })
    ).toThrow(BetaFeedbackValidationError);
    expect(() =>
      parseBetaFeedback({ ...validFeedback, experienceRating: 6 })
    ).toThrow("Rate your current experience from 1 to 5.");
  });

  it("rejects feedback that is too short or too long", () => {
    expect(() =>
      parseBetaFeedback({ ...validFeedback, message: "Too short" })
    ).toThrow("at least 20 characters");
    expect(() =>
      parseBetaFeedback({ ...validFeedback, message: "a".repeat(2001) })
    ).toThrow("2,000 characters");
  });

  it("limits device context to the approved fields", () => {
    expect(
      parseBetaFeedback({
        ...validFeedback,
        deviceContext: {
          exactUserAgent: "should not be retained",
          language: "en-US-with-an-unreasonably-long-private-suffix",
          online: false,
          screen: "watch",
          standalone: true,
        },
      }).deviceContext
    ).toEqual({
      language: "en-US-with-an-unreas",
      online: false,
      screen: "desktop",
      standalone: true,
    });
  });

  it("preserves the originating route without query data", () => {
    expect(getBetaFeedbackHref("/scanner")).toBe(
      "/feedback?from=%2Fscanner"
    );
    expect(getBetaFeedbackHref("/feedback")).toBe("/feedback");
    expect(
      getBetaFeedbackOriginPath("?from=%2Fcards%3Fsecret%3D1", "/feedback")
    ).toBe("/cards");
    expect(getBetaFeedbackOriginPath("?from=https://example.com", "/feedback"))
      .toBe("/feedback");
  });
});
