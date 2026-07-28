// @ts-check
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"]],
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npx --yes serve -l 4173 .",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "pc",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: "android",
      use: {
        ...devices["Pixel 7 landscape"],
        browserName: "chromium",
      },
    },
    {
      // iPhone landscape viewport/touch on Chromium (matches in-game phone-play orientation).
      name: "ios",
      use: {
        ...devices["iPhone 14 landscape"],
        browserName: "chromium",
      },
    },
  ],
});
