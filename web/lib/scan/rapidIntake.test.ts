import { describe, expect, it } from "vitest";
import {
  DEFAULT_RAPID_INTAKE_SETTINGS,
  getRapidIntakeReadinessError,
  prepareRapidIntakeItem,
  readRapidIntakeSettings,
  type RapidIntakeEvent,
  type RapidIntakeSettings,
} from "./rapidIntake";

const EVENT: RapidIntakeEvent = {
  id: "event-1",
  name: "Copenhagen Cardshow",
  status: "active",
  currency: "DKK",
  startsAt: "2026-09-01T08:00:00.000Z",
};

function readinessError(
  settings: RapidIntakeSettings,
  overrides: Partial<Parameters<typeof getRapidIntakeReadinessError>[0]> = {}
) {
  return getRapidIntakeReadinessError({
    enabled: true,
    collectionType: "inventory",
    collectionCurrency: "DKK",
    event: EVENT,
    settings,
    ...overrides,
  });
}

describe("readRapidIntakeSettings", () => {
  it("returns independent defaults for invalid stored values", () => {
    const first = readRapidIntakeSettings(null);
    const second = readRapidIntakeSettings([]);

    expect(first).toEqual(DEFAULT_RAPID_INTAKE_SETTINGS);
    expect(second).toEqual(DEFAULT_RAPID_INTAKE_SETTINGS);
    expect(first).not.toBe(DEFAULT_RAPID_INTAKE_SETTINGS);
  });

  it("keeps valid strings and falls back for an unknown pricing mode", () => {
    expect(
      readRapidIntakeSettings({
        pricingMode: "legacy",
        askingPercentage: "110",
        locationLabel: "Stand A12",
        fixedFloorPrice: 200,
      })
    ).toEqual({
      ...DEFAULT_RAPID_INTAKE_SETTINGS,
      askingPercentage: "110",
      locationLabel: "Stand A12",
    });
  });
});

describe("getRapidIntakeReadinessError", () => {
  it("allows disabled Rapid Intake regardless of the remaining setup", () => {
    expect(
      readinessError(DEFAULT_RAPID_INTAKE_SETTINGS, {
        enabled: false,
        collectionType: null,
        event: null,
      })
    ).toBeNull();
  });

  it("requires dealer inventory and an event", () => {
    expect(
      readinessError(DEFAULT_RAPID_INTAKE_SETTINGS, {
        collectionType: "pc",
      })
    ).toContain("Dealer Inventory");
    expect(
      readinessError(DEFAULT_RAPID_INTAKE_SETTINGS, { event: null })
    ).toContain("Vælg det Cardshow");
  });

  it("rejects currency mismatches", () => {
    expect(
      readinessError(DEFAULT_RAPID_INTAKE_SETTINGS, {
        collectionCurrency: "EUR",
      })
    ).toBe("Collectionen bruger EUR, mens Cardshowet bruger DKK.");
  });

  it("validates estimate and fixed price boundaries", () => {
    expect(
      readinessError({
        ...DEFAULT_RAPID_INTAKE_SETTINGS,
        askingPercentage: "301",
      })
    ).toContain("højst 300");

    expect(
      readinessError({
        ...DEFAULT_RAPID_INTAKE_SETTINGS,
        pricingMode: "fixed",
        fixedAskingPrice: "100",
        fixedFloorPrice: "101",
      })
    ).toContain("ikke være højere");
  });
});

describe("prepareRapidIntakeItem", () => {
  it("calculates estimate pricing, rounds money and normalizes inventory codes", () => {
    expect(
      prepareRapidIntakeItem(
        { cardId: "12345678-abcd-4321-9999-00aabbccddee", estimatedValue: 99.99 },
        {
          ...DEFAULT_RAPID_INTAKE_SETTINGS,
          askingPercentage: "110,5",
          floorPercentage: "85",
          locationLabel: " Stand A12 ",
          inventoryCodePrefix: " cph show / premium ",
        }
      )
    ).toEqual({
      askingPrice: 110.49,
      floorPrice: 93.92,
      needsPricing: false,
      item: {
        cardId: "12345678-abcd-4321-9999-00aabbccddee",
        status: "available",
        askingPrice: 110.49,
        floorPrice: 93.92,
        priceSource: "suggested",
        locationLabel: "Stand A12",
        inventoryCode: "CPH-SHOW-PREMIUM-CCDDEE",
        notes: "Rapid intake",
      },
    });
  });

  it("marks cards without an estimate for later pricing", () => {
    const result = prepareRapidIntakeItem(
      { cardId: "card-without-estimate", estimatedValue: null },
      DEFAULT_RAPID_INTAKE_SETTINGS
    );

    expect(result.askingPrice).toBeNull();
    expect(result.floorPrice).toBeNull();
    expect(result.needsPricing).toBe(true);
    expect(result.item.priceSource).toBe("suggested");
    expect(result.item.notes).toBe("Rapid intake · Pricing required");
  });

  it("supports fixed and deliberately unpriced inventory", () => {
    const fixed = prepareRapidIntakeItem(
      { cardId: "fixed-card", estimatedValue: 900 },
      {
        ...DEFAULT_RAPID_INTAKE_SETTINGS,
        pricingMode: "fixed",
        fixedAskingPrice: "250,555",
        fixedFloorPrice: "200",
      }
    );
    const unpriced = prepareRapidIntakeItem(
      { cardId: "unpriced-card", estimatedValue: 900 },
      {
        ...DEFAULT_RAPID_INTAKE_SETTINGS,
        pricingMode: "unpriced",
      }
    );

    expect(fixed.askingPrice).toBe(250.56);
    expect(fixed.floorPrice).toBe(200);
    expect(fixed.item.priceSource).toBe("manual");
    expect(unpriced.needsPricing).toBe(true);
    expect(unpriced.askingPrice).toBeNull();
  });
});
