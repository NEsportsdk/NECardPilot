import { describe, expect, it } from "vitest";

import {
  getInstallEnvironment,
  isIosDevice,
} from "@/lib/pwa/installExperience";

describe("install experience", () => {
  it("detects an installed app from display mode", () => {
    expect(
      getInstallEnvironment({
        displayModeStandalone: true,
        userAgent: "Mozilla/5.0 Chrome/140",
      })
    ).toBe("installed");
  });

  it("detects an installed app from the iOS standalone flag", () => {
    expect(
      getInstallEnvironment({
        displayModeStandalone: false,
        navigatorStandalone: true,
        userAgent: "Mozilla/5.0 iPhone",
      })
    ).toBe("installed");
  });

  it("detects iPhone and iPadOS devices", () => {
    expect(isIosDevice({ userAgent: "Mozilla/5.0 iPhone" })).toBe(true);
    expect(
      isIosDevice({
        maxTouchPoints: 5,
        platform: "MacIntel",
        userAgent: "Mozilla/5.0 Macintosh",
      })
    ).toBe(true);
  });

  it("keeps regular browser sessions in browser mode", () => {
    expect(
      getInstallEnvironment({
        displayModeStandalone: false,
        platform: "Win32",
        userAgent: "Mozilla/5.0 Chrome/140",
      })
    ).toBe("browser");
  });
});
