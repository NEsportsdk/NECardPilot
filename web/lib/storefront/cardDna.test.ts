import { describe, expect, it } from "vitest";

import {
  buildCardDna,
  descriptionToHtml,
} from "@/lib/storefront/cardDna";

const baseCard = {
  card_number: "101",
  manufacturer: "Topps",
  parallel_name: "Chrome Refractor",
  player_name: "Shohei Ohtani",
  serial_number: "17",
  set_name: "Stadium Club",
  year: "2025",
};

describe("storefront Card DNA", () => {
  it("builds a complete title and searchable features", () => {
    const dna = buildCardDna(baseCard, [
      { attribute_key: "rookie_card", attribute_value: true },
      { attribute_key: "autograph", attribute_value: true },
      { attribute_key: "serial_numbered_to", attribute_value: 99 },
      { attribute_key: "sport", attribute_value: "Baseball" },
      { attribute_key: "team", attribute_value: "Los Angeles Dodgers" },
    ]);

    expect(dna.title).toContain("Shohei Ohtani");
    expect(dna.title).toContain("RC");
    expect(dna.title).toContain("Auto");
    expect(dna.title).toContain("/99");
    expect(dna.featureLabels).toContain("Numbered 17/99");
    expect(dna.tags).toContain("Rookie Card");
    expect(dna.tags).toContain("Los Angeles Dodgers");
  });

  it("does not invent premium features when they are unknown", () => {
    const dna = buildCardDna(baseCard, []);

    expect(dna.featureLabels).toEqual([]);
    expect(dna.tags).not.toContain("Autograph");
    expect(dna.tags).not.toContain("Rookie Card");
  });

  it("escapes user content before it becomes Shopify HTML", () => {
    expect(descriptionToHtml('<script>alert("x")</script>\nSafe')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;<br />Safe"
    );
  });
});

