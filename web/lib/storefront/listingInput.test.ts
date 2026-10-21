import { describe, expect, it } from "vitest";

import { parseStorefrontListingInput } from "@/lib/storefront/listingInput";

function validFormData() {
  const formData = new FormData();
  formData.set("workspaceId", "6ed4a531-6e31-4c18-9098-cf7c0181c410");
  formData.set("cardId", "f14ce6fb-6064-40c4-b706-fdcb42fc7923");
  formData.set("title", "1998 Finest Dirk Nowitzki Rookie");
  formData.set("priceAmount", "1.250,50");
  formData.set("currency", "DKK");
  return formData;
}

describe("storefront listing input", () => {
  it("normalizes a Danish price", () => {
    const result = parseStorefrontListingInput(validFormData());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.priceAmount).toBe(1250.5);
      expect(result.data.currency).toBe("DKK");
    }
  });

  it("rejects zero and malformed prices", () => {
    const zero = validFormData();
    zero.set("priceAmount", "0");
    expect(parseStorefrontListingInput(zero).ok).toBe(false);

    const malformed = validFormData();
    malformed.set("priceAmount", "12abc");
    expect(parseStorefrontListingInput(malformed).ok).toBe(false);
  });

  it("rejects unsupported currencies", () => {
    const formData = validFormData();
    formData.set("currency", "USD");
    expect(parseStorefrontListingInput(formData).ok).toBe(false);
  });
});
