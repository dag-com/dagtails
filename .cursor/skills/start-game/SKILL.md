---
name: start-game
description: >-
  Start the DAG Tails local web server and open the game in the browser.
  Use when the user says "start game", "run the game", "open the game",
  "launch locally", or wants to play/test DAG Tails in the browser.
---

# Start game

Serve the repo root (vanilla HTML/JS game) and open it in the default browser.

## Steps

1. **Check for an existing server** (prefer reuse):
   - Probe `http://127.0.0.1:4173/`
   - If it returns 200, skip starting a new server

2. **Start the server** if needed (from the project root):
   ```bash
   npx --yes serve -l 4173 .
   ```
   - Run in the background (`block_until_ms: 0`)
   - Wait until output shows `Accepting` / `Local:`
   - Prefer **4173** (Playwright `baseURL`). Avoid 8000 if it fails on this machine.

3. **Open the browser**:
   ```powershell
   Start-Process "http://127.0.0.1:4173/"
   ```
   On non-Windows: `open` (macOS) or `xdg-open` (Linux).

4. **Confirm** to the user with the URL: `http://127.0.0.1:4173/`

## Notes

- Do not run `npm run build` just to play — root `index.html` is the source of truth; `www/` is Capacitor output and gitignored.
- Landscape-first: phones may show a rotate lock in portrait.
- If the port is busy, try `4174` and open that URL instead.
- Optional iPhone landscape preview (Playwright Chromium):
  ```js
  const { chromium, devices } = require("@playwright/test");
  const d = devices["iPhone 14 landscape"];
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ ...d });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173/");
  ```
  Only do this when the user asks for phone emulation.
