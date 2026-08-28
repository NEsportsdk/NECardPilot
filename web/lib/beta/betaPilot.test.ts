import { describe, expect, it } from "vitest";

import {
  BetaPilotValidationError,
  getBetaPilotMetrics,
  getBetaPilotProgress,
  parseBetaPilotUpdate,
  type BetaPilotProfile,
} from "@/lib/beta/betaPilot";

const participant: BetaPilotProfile = {
  browser: "safari",
  completed_steps: [1, 2, 3],
  install_mode: "standalone",
  joined_at: "2026-08-28T19:00:00.000Z",
  primary_device: "iphone",
  updated_at: "2026-08-28T19:30:00.000Z",
  user_id: "79223638-ffba-44a7-8f87-d9364fa18446",
};

describe("beta pilot", () => {
  it("normalizes a valid pilot update and removes duplicate steps", () => {
    expect(
      parseBetaPilotUpdate({
        browser: "chrome",
        completedSteps: [4, 1, 4, 2],
        installMode: "browser",
        primaryDevice: "android",
      })
    ).toEqual({
      browser: "chrome",
      completedSteps: [1, 2, 4],
      installMode: "browser",
      primaryDevice: "android",
    });
  });

  it("rejects unknown device context and journey steps", () => {
    expect(() =>
      parseBetaPilotUpdate({
        browser: "netscape",
        completedSteps: [1],
        installMode: "browser",
        primaryDevice: "tablet",
      })
    ).toThrow(BetaPilotValidationError);

    expect(() =>
      parseBetaPilotUpdate({
        browser: "safari",
        completedSteps: [0, 11],
        installMode: "standalone",
        primaryDevice: "iphone",
      })
    ).toThrow("unknown step");
  });

  it("calculates unique journey progress", () => {
    expect(getBetaPilotProgress([1, 1, 2, 10, 99])).toEqual({
      completed: 3,
      finished: false,
      percent: 30,
      total: 10,
    });
  });

  it("summarizes pilot coverage for operations", () => {
    expect(
      getBetaPilotMetrics([
        participant,
        {
          ...participant,
          browser: "edge",
          completed_steps: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          install_mode: "browser",
          primary_device: "desktop",
          user_id: "d0c7c4ff-77a5-4bea-908f-688b8273dc21",
        },
      ])
    ).toEqual({ completed: 1, installed: 1, mobile: 1, total: 2 });
  });
});
