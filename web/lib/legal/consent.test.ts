import { describe, expect, it } from "vitest";

import {
  CURRENT_TERMS_VERSION,
  hasAcceptedCurrentTerms,
} from "./consent";

describe("billing terms consent", () => {
  it("accepts an explicit agreement to the current terms", () => {
    expect(
      hasAcceptedCurrentTerms({
        acceptedTerms: true,
        termsVersion: CURRENT_TERMS_VERSION,
      })
    ).toBe(true);
  });

  it("rejects missing, false or outdated consent", () => {
    expect(hasAcceptedCurrentTerms(null)).toBe(false);
    expect(hasAcceptedCurrentTerms({ acceptedTerms: false })).toBe(false);
    expect(
      hasAcceptedCurrentTerms({
        acceptedTerms: true,
        termsVersion: "outdated",
      })
    ).toBe(false);
  });
});
