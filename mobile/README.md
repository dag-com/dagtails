# DAG Tails — Expo Path A (remote preview shell)

Thin **Expo Go** wrapper: a full-screen `WebView` that loads the existing vanilla web game. Capacitor remains the path for store-native builds; this shell is for **phone testing off your LAN**.

## Quick start (any network)

```bash
cd mobile
npm start
# or from repo root:
npm run expo:tunnel
```

1. Install **Expo Go** on your phone (App Store / Play Store — currently **SDK 54**).
   This shell targets SDK 54 on purpose: store Expo Go has not shipped 55+ yet.
2. Run with tunnel so the Metro URL is public:
   ```bash
   npx expo start --tunnel
   ```
3. Scan the QR code in Expo Go.
4. The WebView opens the **GitHub Pages** build by default:
   https://dag-com.github.io/last-call-bartending-game/

Landscape is locked in `app.json` to match the game.

## Preview local game changes on a remote phone

Expo tunnel only publishes the **shell**. To also serve **uncommitted** game files off-LAN:

1. In the repo root, serve the game:
   ```bash
   npx --yes serve -l 4173 .
   ```
2. Expose it with a public tunnel (pick one):
   ```bash
   # Cloudflare (example)
   cloudflared tunnel --url http://127.0.0.1:4173
   # or ngrok
   ngrok http 4173
   ```
3. Start Expo with that URL:
   ```bash
   # Windows PowerShell
   $env:EXPO_PUBLIC_GAME_URL="https://YOUR-TUNNEL-HOST"
   npx expo start --tunnel
   ```

In-app **Pages** chip resets the WebView to the live GitHub Pages URL.

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Expo dev server (LAN) |
| `npm run tunnel` | Expo dev server with `--tunnel` |
| `npm run android` / `ios` | Open on emulator / simulator |

Root package.json also has `expo:start` and `expo:tunnel`.

## Notes

- Same web game as Capacitor/`www` — no React rewrite of gameplay.
- Cleartext HTTP is allowed so LAN/`http://` tunnels work during development.
- If the bar looks outdated, hard-reload in the chrome bar or confirm Pages has deployed your branch/commit.
