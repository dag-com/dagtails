---
name: start-game
description: >-
  Start the DAG Tails local web build and open the game in the browser.
  Use when the user says "start game", "run the game", "open the game",
  "launch locally", or wants to play/test DAG Tails in the browser.
---

# Start game

Serve the **Vite-built** game (`www/`) and open it in the default browser.
Repo-root `index.html` alone is not enough (it loads `/src/main.tsx` without a bundler).

## Steps

1. **Check for an existing server** (prefer reuse):
   - Probe `http://127.0.0.1:4173/`
   - If it returns 200 **and** the HTML references hashed `assets/index-*.js` (not only `/src/main.tsx`), skip starting a new server

2. **Build + serve** if needed (from the project root):
   ```bash
   npm run serve:www
   ```
   - Equivalent: `npm run build && npx --yes serve -l 4173 www`
   - Run in the background (`block_until_ms: 0`)
   - Wait until output shows `Accepting` / `Local:`
   - Prefer **4173** (Playwright `baseURL`). If busy, use `4174` and open that URL

3. **Dev alternative** (hot reload, when user is actively editing):
   ```bash
   npm run dev
   ```
   - Open the URL Vite prints (often `http://127.0.0.1:5173/`)

4. **Open the browser**:
   ```powershell
   Start-Process "http://127.0.0.1:4173/"
   ```
   On non-Windows: `open` (macOS) or `xdg-open` (Linux).

5. **Confirm** with the URL used

## Notes

- Always-on remote play is Pages, not localhost:
  https://dag-com.github.io/dagtails/
- `www/` is gitignored; local serve builds it on demand
- Landscape-first: phones may show a rotate lock in portrait
- Optional iPhone landscape preview (Playwright Chromium) only when the user asks for phone emulation
