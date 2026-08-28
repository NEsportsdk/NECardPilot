import { defineConfig } from "@playwright/test";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const baseURL = process.env.E2E_BASE_URL ?? DEFAULT_BASE_URL;
const target = new URL(baseURL);
const isLocalTarget = new Set(["127.0.0.1", "localhost"]).has(
  target.hostname
);

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    baseURL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        browserName: "chromium",
        viewport: { width: 1440, height: 1100 },
      },
    },
    {
      name: "mobile-chromium",
      use: {
        browserName: "chromium",
        hasTouch: true,
        isMobile: true,
        userAgent:
          "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36",
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: isLocalTarget
    ? {
        command:
          "npm run start -- --hostname 127.0.0.1 --port 3000",
        url: target.origin,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
