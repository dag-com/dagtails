# DAG Tails — Expo Path A (landscape WebView shell)

Thin **Expo Go** wrapper around the **always-on** web game on GitHub Pages.
Capacitor remains the path for store-native builds.

## Always-on / remote play (no laptop)

Anyone, anywhere:

**https://dag-com.github.io/last-call-bartending-game/**

Open that URL in mobile Safari/Chrome (or Add to Home Screen). You do **not** need Expo Go, Metro, or a tunnel. Pages is redeployed on every `master` push.

From the repo root:

```bash
npm run play:url
```

## Expo Go (optional landscape chrome)

The shell only wraps Pages in a landscape WebView. It does **not** host the game.

1. Install **Expo Go** (SDK **54**).
2. Same Wi‑Fi as your PC:
   ```bash
   cd mobile
   npm start
   # or from repo root: npm run expo:start
   ```
3. Scan the QR code. The WebView loads Pages by default.

In-app **Pages** / **Reload** force a cache-busted load of the live site.

## Dev-only: tunnel the *shell* (not the game)

`expo start --tunnel` only publishes Metro (the React Native chrome). Ngrok tunnels are flaky — do **not** rely on them for remote testers.

```bash
cd mobile
npm run tunnel
# or: npm run expo:tunnel
```

Use this only when you must iterate on the Expo chrome itself off-LAN. Remote players should use the Pages URL above.

## Preview uncommitted game changes on a phone

Expo tunnel does **not** serve your local game files. To preview a local build:

1. `npm run serve:www` (or `npx serve -l 4173 www` after `npm run build`)
2. Expose with Cloudflare/ngrok
3. Point the shell at it:
   ```powershell
   $env:EXPO_PUBLIC_GAME_URL="https://YOUR-TUNNEL-HOST"
   npx expo start
   ```

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Expo Metro (LAN) — shell only |
| `npm run tunnel` | Expo Metro via ngrok — shell-dev only |
| `npm run android` / `ios` | Open on emulator / simulator |
| Root `npm run play:url` | Print the always-on Pages URL |
| Root `npm run healthcheck` | Probe Pages + Supabase |

## Notes

- Same web game as Capacitor / Pages — no React rewrite of gameplay.
- Cleartext HTTP is allowed only so optional LAN game tunnels work during development.
- If the bar looks outdated: tap **Reload** or **Pages**, or confirm the latest Pages deploy finished on GitHub Actions.
