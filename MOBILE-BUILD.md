# Building DAG Tails for iOS & Android

The game itself is still the same zero-build vanilla HTML/CSS/JS you've always
had — nothing about how you develop the web version changes. What's new is a
thin native wrapper (via [Capacitor](https://capacitorjs.com/)) that packages
that same code into a real Android app and a real iOS app, so you can install
it on a phone and test it like a native app (and eventually publish it).

```
index.html, *.js, styles.css, assets/   <- your existing game, unchanged
        │
        │  npm run build   (copies the files above into www/)
        ▼
      www/                              <- what Capacitor ships inside the app
        │
        │  npx cap sync
        ▼
  android/   ios/                       <- native project folders (committed to git)
```

You never hand-edit anything inside `www/` — it's regenerated every time from
the real source files. `android/` and `ios/` are real native project folders;
you'll only touch a couple of settings in them (already done for you: app
name, icon, splash screen, landscape lock).

---

## 1. Everyday workflow

Whenever you've made changes to the game and want to test them natively:

```bash
npm run cap:sync
```

This copies the latest web files into `www/` and syncs both native projects.
Run this before every native build/test.

---

## 2. Android — two ways to test

### Option A: Cloud build, zero installs (fastest way to get an APK on your phone)

This repo already has a [Codemagic](https://codemagic.io/) config
(`codemagic.yaml`) with an `android-debug` workflow that needs **no signing
and no Google account** — it just produces an installable `.apk`.

1. Sign up at [codemagic.io](https://codemagic.io/) (free tier is plenty for this).
2. "Add application" → connect your GitHub account → pick
   `dag-com/last-call-bartending-game`.
3. Codemagic will detect `codemagic.yaml` automatically. Select the
   **android-debug** workflow and click **Start new build**.
4. When it finishes, download the `.apk` from the build's **Artifacts** tab.
5. Get it onto your phone (AirDrop-style: email it to yourself, upload to
   Google Drive, or use `adb install` if the phone's plugged in) and open it.
   Android will ask you to allow "install from unknown sources" the first
   time — that's expected for a non-Play-Store APK.

### Option B: Local builds with Android Studio (better for iterating quickly)

1. Install [Android Studio](https://developer.android.com/studio) (free).
   It bundles the Android SDK you need.
2. Run `npm run android:open` — this syncs and opens the `android/` folder
   in Android Studio automatically (or open it manually: **File → Open** →
   select the `android` folder).
3. Plug your Android phone in via USB with
   [developer mode + USB debugging](https://developer.android.com/studio/debug/dev-options)
   turned on, or use an emulator. Press the green ▶ Run button in Android
   Studio.

### Getting to Google Play internal testing later

Once you're ready to distribute beyond direct sideloading:

1. Create a [Google Play Console](https://play.google.com/console/) account
   ($25 one-time fee).
2. Create a release keystore (`keytool -genkey ...` — Android Studio can also
   generate one for you under **Build → Generate Signed Bundle**). **Back
   this file up somewhere safe** — if you lose it you can never update the
   app again.
3. Create your app listing in Play Console, upload a signed `.aab` (Android
   Studio: **Build → Generate Signed Bundle / APK**) to the **Internal
   testing** track, and add testers by email — they get a private opt-in
   link, no public listing required.

---

## 3. iOS — cloud build (you don't have a Mac, and that's fine)

Building and signing an iOS app requires Xcode, which only runs on macOS.
Since you're on Windows, we use **Codemagic's cloud Mac build machines** to do
that step — you never need to touch a physical Mac.

### One-time setup

1. **Apple Developer Program** — enroll at
   [developer.apple.com/programs](https://developer.apple.com/programs/)
   ($99/year). This is required for TestFlight, no way around it.
2. **Create an app record** in
   [App Store Connect](https://appstoreconnect.apple.com/) → **My Apps → +**
   → New App. Use bundle ID `com.dagcom.dagtails` (already set in
   `capacitor.config.json` — change it there first if you'd rather use
   something else, before you register it with Apple).
3. **Create an App Store Connect API key** (lets Codemagic talk to Apple on
   your behalf):
   - App Store Connect → **Users and Access → Integrations → App Store
     Connect API** → **+** to generate a key with **App Manager** access.
   - Download the `.p8` file (you only get one chance) and note the
     **Issuer ID** and **Key ID**.
4. **Connect Codemagic to Apple**:
   - Codemagic → Team settings → **Integrations → Developer Portal → Manage
     keys → Add key**. Paste in the Issuer ID / Key ID and upload the `.p8`.
   - Give it a name (e.g. `codemagic`) — update the `app_store_connect: codemagic`
     line in `codemagic.yaml` if you name it something else.
5. **Generate a signing certificate** — Codemagic → Team settings → **Code
   signing identities → iOS certificates → Generate certificate**, choosing
   `Apple Distribution` and the API key from step 4. Codemagic can manage
   provisioning profiles automatically once this exists.
6. **Create a TestFlight internal test group** — App Store Connect → your
   app → **TestFlight** tab → **Internal Testing → +** → name it
   `Internal Testers` (matching `codemagic.yaml`, or edit that file to match
   whatever you name it) and add yourself + your partner by Apple ID email.

### Running the build

1. Codemagic → your app → select the **ios-testflight** workflow → **Start
   new build**.
2. On success, Codemagic automatically uploads the build to TestFlight and
   notifies your internal testers.
3. You and your partner install the **TestFlight** app from the App Store,
   accept the email invite, and install **DAG Tails** through it — updates
   after that are just a tap in TestFlight, no cables needed.

---

## 4. What's already done for you in this repo

- `package.json` + `scripts/copy-web.js` — copies the game's static files
  into `www/` (the only "build step", and it's just a file copy, no bundler).
- `capacitor.config.json` — app id (`com.dagcom.dagtails`), app name, and
  Capacitor plugin settings.
- `android/`, `ios/` — native project folders (`npx cap add android/ios`),
  with orientation locked to landscape in both
  (`AndroidManifest.xml` / `Info.plist`) to match the game's landscape-first
  design.
- App icon + splash screen generated from the game's duck mascot artwork for
  every required size on both platforms (source files kept in `resources/`
  so you can regenerate them later with `npx capacitor-assets generate
  --assetPath resources` if the artwork changes).
- `codemagic.yaml` — cloud CI config with an Android debug-APK workflow
  (works immediately, no accounts needed) and an iOS TestFlight workflow
  (needs the one-time Apple/Codemagic setup above).

## 5. Cost summary

| Item | Cost | Needed for |
|---|---|---|
| Codemagic | Free tier (500 build min/month) | Cloud Mac builds for iOS, optional for Android |
| Android sideload / debug APK | Free | Testing on your own device |
| Google Play Console | $25 one-time | Publishing / Play Store internal testing |
| Apple Developer Program | $99/year | Any iOS testing beyond your own device via cable, and all of TestFlight |
