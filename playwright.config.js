// @ts-check
const path = require("path");
const fs = require("fs");
const os = require("os");

const defaultBrowserDir = path.join(os.homedir(), "AppData", "Local", "ms-playwright");
const cur = process.env.PLAYWRIGHT_BROWSERS_PATH;
try {
  if (!cur || !fs.existsSync(cur) || fs.readdirSync(cur).length === 0) {
    if (fs.existsSync(defaultBrowserDir)) {
      process.env.PLAYWRIGHT_BROWSERS_PATH = defaultBrowserDir;
    }
  }
} catch (e) { /* ignore */ }

const { defineConfig, devices } = require("@playwright/test");
const { handheldProjects } = require("./playwright.devices");

module.exports = defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Allow phone/tablet matrix to run in parallel. Override with PW_WORKERS=1 for serial.
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : undefined,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${process.env.PW_PORT || 4173}`,
    screenshot: "only-on-failure",
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
