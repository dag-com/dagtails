// @ts-check
const { defineConfig, devices } = require("@playwright/test");
const { handheldProjects } = require("./playwright.devices");

module.exports = defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Allow phone/tablet matrix to run in parallel. Override with PW_WORKERS=1 for serial.
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : undefined,
  reporter: [["list"]],
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${process.env.PW_PORT || 4173}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run build && npx --yes serve -l ${process.env.PW_PORT || 4173} www`,
    url: `http://127.0.0.1:${process.env.PW_PORT || 4173}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    {
      name: "pc",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
    // Legacy aliases (quick smoke) — same class as Pixel 8 / iPhone 15.
    {
      name: "android",
      use: {
        ...devices["Pixel 8 landscape"],
        browserName: "chromium",
      },
    },
    {
      name: "ios",
      use: {
        ...devices["iPhone 15 landscape"],
        browserName: "chromium",
      },
    },
    // 10 phones + 4 tablets + folds (landscape). See playwright.devices.js.
    ...handheldProjects(devices),
    // Portrait-only: rotate-lock smoke (not part of playability matrix).
    {
      name: "phone-portrait",
      testMatch: /rotate-lock\.spec\.js/,
      use: {
        ...devices["Pixel 8"],
        browserName: "chromium",
      },
    },
  ],
});
