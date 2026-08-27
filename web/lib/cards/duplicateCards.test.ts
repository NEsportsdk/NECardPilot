import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildDuplicateCheckResult,
  getDuplicateIdentityKey,
  hasDuplicateCheckIdentity,
  scoreDuplicateCandidate,
  type DuplicateCardCandidate,
  type DuplicateCardIdentity,
} from "@/lib/cards/duplicateCards";

const identity: DuplicateCardIdentity = {
  playerName: "Victor Wembanyama",
  year: "2023-24",
  manufacturer: "Panini",
  brand: "Prizm",
  product: "Panini Prizm",
  setName: "Base",
  cardNumber: "136",
  parallel: "Silver Prizm",
  serialNumber: null,
};

function candidate(
  overrides: Partial<DuplicateCardCandidate> = {}
): DuplicateCardCandidate {
  return {
    id: "card-1",
    current_collection_id: "collection-1",
    player_name: "Victor Wembanyama",
    year: "2023/24",
    manufacturer: "Panini",
    set_name: "Panini Prizm",
    card_number: "#136",
    parallel_name: "Silver-Prizm",
    serial_number: null,
    state: "verified",
    created_at: "2026-08-27T10:00:00.000Z",
    ...overrides,
  };
}

describe("duplicate card matching", () => {
  it("requires a player and two identity signals", () => {
    expect(
      hasDuplicateCheckIdentity({
        ...identity,
        year: null,
        product: null,
        setName: null,
        cardNumber: null,
        parallel: null,
      })
    ).toBe(false);

    expect(
      hasDuplicateCheckIdentity(identity)
    ).toBe(true);
  });

  it("normalizes punctuation, casing and accents", () => {
    expect(
      getDuplicateIdentityKey({
        ...identity,
        playerName: "  Víctor Wembanyama ",
        cardNumber: "#136",
      })
    ).toContain("victorwembanyama");

    expect(
      scoreDuplicateCandidate(
        identity,
        candidate()
      )?.level
    ).toBe("probable");
  });

  it("treats an identical serial number as exact", () => {
    const match = scoreDuplicateCandidate(
      {
        ...identity,
        serialNumber: "044/150",
      },
      candidate({
        serial_number: "044 / 150",
      })
    );

    expect(match?.level).toBe("exact");
    expect(match?.score).toBe(100);
  });

  it("does not flag different serial-numbered copies", () => {
    expect(
      scoreDuplicateCandidate(
        {
          ...identity,
          serialNumber: "044/150",
        },
        candidate({
          serial_number: "045/150",
        })
      )
    ).toBeNull();
  });

  it("sorts matches and requires acknowledgement for probable copies", () => {
    const result = buildDuplicateCheckResult(
      identity,
      [
        candidate({
          id: "weaker",
          parallel_name: null,
        }),
        candidate({
          id: "stronger",
        }),
      ],
      new Map([
        ["collection-1", "PC"],
      ])
    );

    expect(result.matches).toHaveLength(2);
    expect(result.matches[0].cardId).toBe(
      "stronger"
    );
    expect(
      result.matches[0].collectionName
    ).toBe("PC");
    expect(
      result.requiresAcknowledgement
    ).toBe(true);
  });
});
