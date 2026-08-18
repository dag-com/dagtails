#!/usr/bin/env node
/**
 * Run the default gameplay / device-qa gate across all handheld projects
 * plus the portrait rotate-lock smoke project.
 * Usage: node scripts/run-qa.js
 * Extra args are forwarded to Playwright (e.g. --grep "venue interior").
 */
const { spawnSync } = require("child_process");
const { QA_PROJECT_NAMES } = require("../playwright.devices");

const SPECS = [
  "tests/health.spec.js",
  "tests/backend.spec.js",
  "tests/gameplay.spec.js",
  "tests/play-journey.spec.js",
  "tests/layout-integrity.spec.js",
  "tests/assets-integrity.spec.js",
  "tests/text-readability.spec.js",
  "tests/rotate-lock.spec.js",
];

const extra = process.argv.slice(2);
const args = [
  "playwright",
  "test",
  ...SPECS,
  ...QA_PROJECT_NAMES.flatMap((name) => ["--project", name]),
  "--project",
  "phone-portrait",
  ...extra,
];

const result = spawnSync("npx", args, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(result.status == null ? 1 : result.status);
