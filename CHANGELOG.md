# Changelog

All notable changes to **Last Call** are listed here, newest first.

This project uses simple version numbers: `MAJOR.MINOR.PATCH`
- **PATCH** (e.g. 1.0.1) — small fixes and tweaks
- **MINOR** (e.g. 1.1.0) — new features, fully backward-compatible
- **MAJOR** (e.g. 2.0.0) — big overhauls or changes that rework how the game works

Each version below corresponds to a tagged release on GitHub. To open or download
any past version, go to the repository's **Releases** page and pick that version.

---

## v1.10.1 — Fixed empty space on real phone screens (2026-07-04)

- The main menu's mascot area was designed and tested mostly on wide/tall
  browser windows. On an actual phone held sideways (very wide, very
  short), that same layout left a big empty gap above the duck. Short
  screens now switch to a side-by-side layout — duck on the left, menu on
  the right — that fills the width the phone actually has instead of
  wasting it as empty space. Regular desktop/laptop/tablet views are
  unchanged.

---

## v1.10.0 — Mobile app wrapper for iOS/Android testing (2026-07-04)

- Wrapped the game with **Capacitor** so it can be installed and tested as a
  real app on iPhone and Android, in addition to playing it in a browser —
  the web version is unaffected and works exactly as before.
- Added native `android/` and `ios/` project folders, both locked to
  landscape orientation to match the game's design.
- Generated a proper app icon and splash screen from the duck mascot
  artwork for every required size on both platforms.
- Added a `codemagic.yaml` cloud CI config: an Android workflow that
  produces an installable debug APK with zero setup, and an iOS workflow
  that builds and uploads to TestFlight (after a one-time Apple Developer
  Program + Codemagic signing setup).
- See `MOBILE-BUILD.md` for the full step-by-step guide, including account
  setup and costs.

---

## v1.9.0 — Main menu rebuilt as a hub, and the duck grows up (2026-07-04)

- **Welcome-back splash**: returning players now see a short personalized
  greeting screen (name, streak, level, rank, stars) right when the app
  opens, with a "Continue to the bar →" button — tap anywhere or wait a
  couple seconds and it moves on to the main page. First-time visitors skip
  it and go straight to the main page + identification popup, same as before.
- **Main menu redesigned as a hub**: replaced the crowded sidebar / empty
  stage-view layout with a single hub screen, styled after the main-screen
  patterns used by popular casual games (Homescapes, Coin Master, Duolingo):
  a compact single-row status bar (streak, level, stars, settings), the
  mascot front and center, Cocktail of the Day tucked to one side, one
  dominant **▶ Play the Journey** button, game modes grouped into a small
  strip, and an icon-only bottom nav for Shop / Recipes / Badges / My Bar /
  Community / Leaderboard. The old progress-map preview strip is gone from
  the home screen — the full stage map is still one tap away from Play,
  which shows a short line underneath it so you always know where you stand.
- **The apprentice duck grows up with you**: the mascot on the main menu and
  welcome-back splash now visually levels up as you climb ranks — hoodie
  early on, a Top Gun flight jacket and shades once you make Bartender, and
  a full "ace" look (scarf, wings pin, gold star) once you hit Master
  Mixologist or Bar Legend.

---

## v1.8.0 — Shop, a friendlier sign-in, and a fixed bottom menu (2026-07-04)

- **Shop the gear**: a new store for glasses and bartending tools (no
  liquids) with a "Shop the gear" link on every Recipe Book card and on both
  result screens. It's a demo store for now — checkout is a mock confirmation,
  no real purchase happens.
- **Sign-in is now a popup, not a wall**: the main page shows immediately when
  you open the game; first-time visitors get a small identification popup on
  top of it instead of a separate full screen. Editing your profile later
  (Settings → Edit profile) opens the same popup with a close button.
- **Fixed: bottom menu could get cut off**: on shorter/un-maximized browser
  windows, the Modes/Collection/Social menu at the bottom of the main page
  could end up pushed off-screen with no obvious way to reach it. The main
  page now shrinks itself to fit common window sizes, and any screen that
  still doesn't fit scrolls with a clearly visible gold scrollbar.
- **Diagnostics**: lightweight, privacy-friendly usage tracking (screens
  visited, stages played, Mixologist results, shop activity, etc.), viewable
  on-device from the debug toolbar (📊 Diagnostics) and, once you re-run the
  updated `supabase/schema.sql`, queryable across every player from the
  Supabase SQL editor. See `SETUP-BACKEND.md` for details.

---

## v1.7.0 — Judges get faces, and the scoring screen breathes (2026-07-04)

- **Illustrated judges table**: the judging panel is now a real scene — 3 of the
  10 house judges (each with a full name and their own painted portrait in the
  game's signature art style) sit around a speakeasy judging table, with a
  speech bubble above each one showing their score, their ruling, and a tip on
  how to improve the drink.
- **Random panel of 10**: every result now clearly calls out that the 3 judges
  shown are randomly drawn from the full roster of 10 house judges.
- **Redesigned scoring screen**: the stage result screen now puts the score and
  stars in a compact column on the left, with the ingredient/glass/method
  checklist boxed on the right — freeing up space so the judges' table can be
  bigger and more front-and-center.

---

## v1.6.0 — Cinematic landing page redesign (2026-07-04)

- **Full landing page redesign** inspired by the new concept art:
  - a left-side hero column with player identity, welcome-back message, quick
    stats and a stronger **Continue Journey** call-to-action
  - floating premium info cards for **Cocktail of the Day**, current level,
    streak and next reward
  - a **live journey preview** on the right built from the player's real
    progress, showing the duck on the current stage and the next part of the
    path ahead
  - a slimmer bottom dock for `Modes`, `Collection` and `Social`
- **Better use of landscape space**: the start screen now feels like part of the
  game world instead of a centered utility menu with unused space around it.
- **Journey preview shortcut**: tapping the preview map now opens the full
  journey map directly.
- **Responsive tuning for the new layout** so the redesigned landing page fits
  cleanly in shorter landscape viewports too.

---

## v1.5.0 — Landscape mode, smarter judges & a calmer landing page (2026-07-04)

- **Landscape-first experience from start to finish**: the whole game now lays
  out horizontally, not just the bar station. On phones/tablets held upright, a
  rotate screen appears and asks the player to turn the device sideways.
- **New welcome-back greeting** on the landing page: returning players are now
  greeted by name, with dynamic messaging based on their streak, stage progress,
  and whether they are starting fresh or continuing an existing journey.
- **Decluttered landing page**: the home screen is now built around one clear
  next action (**Continue Journey**), with Cocktail of the Day still visible and
  the rest of the modes/features grouped under calmer tabs (`Modes`,
  `Collection`, `Social`) instead of one large wall of buttons.
- **Interactive judges table**: whenever judges appear, you can now tap a judge
  to see:
  - their score
  - why they scored the drink that way
  - which part of the drink they focused on
  - tips on how to improve the drink
  - an explanation of how the score was calculated
- **Clearer judge scoring rules** on the result screens:
  - early guess stages now clearly say the judges are **flavour only**
  - later stages explain the **75% accuracy / 25% judges** blend
  - Mixologist now explains the underlying parts behind the headline score
    (balance, technique, glass fit, strength)
- **Short-height landscape tuning** so the start screen and gameplay layout still
  fit cleanly on smaller phones in landscape orientation.

---

## v1.4.0 — Meet Old Tom: the opening comic (2026-06-26)

- **Story intro comic reel**: a short, hand-illustrated cinematic now plays right
  after you sign up and before your first level. **Old Tom**, a veteran duck
  bartender, welcomes a young protégé (in the DAG hoodie) into *The Last Call* on
  a rainy night and teaches the craft — glassware, the pour, shaking vs. stirring,
  a first wobbly pour, and finally handing over the apron: *"The bar's yours
  tonight. Make every pour count."* (Keep an eye out for the rubber-duck cameo.)
- Six full-art panels in a gold comic frame, with a mix of narration captions and
  Old Tom's dialogue, progress dots, **tap-to-continue**, and a **Skip intro**
  option.
- Plays **once** automatically; you can **replay it any time** from
  ⚙ Settings → "🎬 Replay intro story".

---

## v1.3.0 — Journey map, new look & a gentle on-ramp (2026-06-24)

- **New start screen** featuring the DAG.com duck as a cut-out mascot above the
  menu (isolated from the original artwork, transparent background), replacing
  the old plain panel.
- **Candy Crush–style journey map**: a **horizontal** path of numbered stages you
  scroll through. Everyone starts at stage 1; clearing a stage (1★ or better)
  unlocks the next. Cleared stages show the stars you earned, the current stage
  pulses, and later stages stay locked.
- **Walking duck avatar**: the DAG.com duck stands on your current stage and, every
  time you clear one, **waddles along the map to the next stage** (with a little
  step sound) before you tap in to play it.
- **Metric or imperial measurements**: pick **ml** or **oz** when you register, and
  the whole game (pour steppers, scoring feedback, drink volumes) shows your chosen
  units. Drinks are stored in ml under the hood, so switching is lossless.
- **New Settings screen** (⚙ from the menu): change measurement units, turn sound
  effects and bar ambience on/off (your sound choice is remembered between visits),
  edit your profile, switch user, or log out.
- **Ranks**: the path is grouped into ranks of **8 stages** (Trainee → Barback →
  Bartender → Mixologist → Head Bartender → Master → Legend), with a celebration
  when you rank up.
- **Start-simple ramp**: early stages are pure ingredient-guessing from a short
  menu with **no measuring**. As you climb, mechanics unlock one at a time —
  ml portions → prep method → **garnish** → glass selection — so complexity
  scales naturally. In guess stages the drink still pours the **correct recipe
  portions** so the glass looks realistic even though you aren't dialling amounts.
- **Garnishing is automatic at first** and only becomes a manual step from the
  Garnish tier (stage 20+); auto garnishes no longer float on an empty glass.
- **Gentler measurement scoring**: being slightly off on a pour is forgiven more
  the deeper you get into the journey, and a small miss is now flagged kindly
  ("a bit much / a bit light") instead of a hard "off".
- **Judges now taste every cocktail** (not just Mixologist inventions): each
  result screen shows a 3-of-10 judges' reaction panel with their scores and
  comments. From the moment you control the pour, their verdict **blends into
  your stars** (75% recipe accuracy / 25% the panel's taste); in the early
  guess-only stages they react for flavour and personality without affecting
  your stars.
- Manual Basic/Advanced selection is retired (difficulty now follows the map).
  **Mixologist** and **Endless Shift** unlock after clearing 5 stages.
- **Level-up & rules-change messages**: a full-screen card now announces rank-ups
  and, the first time a new rule unlocks (measuring, choosing the method, the
  garnish, then the glass), explains exactly what's new and what to do next.

---

## v1.2.1 — Backend connected (2026-06-24)

- Connected the live Supabase backend, so **Community** and **Leaderboards** are
  now online for everyone.
- Fixed the Community feed query: it was ambiguous about how creations link to
  players (the leaderboard views relate the same two tables), so it's now pinned
  to the right relationship. Sharing, liking and both leaderboards verified
  end-to-end.

---

## v1.2.0 — Online backend: Community & Leaderboards (2026-06-24)

Adds the foundation for the game's online features. This ships the code and the
in-game screens; the online features switch on once a (free) Supabase backend is
connected — see **SETUP-BACKEND.md** for the one-time setup.

### New
- **Community** — share your invented cocktails and browse, like (♥) and discover
  drinks made by other players. Sort by **Top** (most liked) or **Newest**.
- **Leaderboards** — two tabs: **Most Liked** creations and **Daily Streak**.
- **Online accounts** — anonymous, frictionless sign-in (each device gets its own
  secure account); player name, location, level and best streak sync to the
  leaderboard.
- **Share** buttons on the Mixologist result and on each saved drink in **My Bar**.

### Notes
- Until a backend is connected, the game runs exactly as before and the Community
  / Leaderboard screens show a friendly "not connected yet" message.
- The Community button is hidden for under-18 players; the Leaderboard stays
  available to everyone.
- Built with Supabase (hosted Postgres + auth), loaded from a CDN so the project
  stays zero-build.

---

## v1.1.0 — Profiles, mocktails, progression & judges (2026-06-24)

A big content and progression update. Everything still runs as a static site
(no servers or accounts yet — that's planned for a later release).

### Players & access
- **Profile / age gate** — first-time players set up a profile (name, age,
  location, email or unique ID). Saved on the device for now.
- **Age filtering** — under-18 players get a **mocktail-only** experience with
  all alcohol hidden across every mode; adults get the full bar.

### New content
- **12 mocktails** (Virgin Sunrise, Shirley Temple, Virgin Piña Colada, Virgin
  Mojito, Virgin Mary, and more).
- **Shots section** — B-52, Baby Guinness, Kamikaze, Lemon Drop, Green Tea Shot.
- Every drink now has a **difficulty rating** (easy → expert) based on its number
  of ingredients and preparation method; the **Recipe Book** is grouped into
  sections (Cocktails / Shots / Mocktails) and ordered easy-first.

### Progression & the core loop
- **Levels & XP** — earn XP for every drink you serve; a level bar shows progress.
- **Unlocks** — Advanced & Endless unlock at level 2, Mixologist at level 3.
- **Cocktail of the Day** — a fresh daily drink with no repeats, plus a bonus.
- **Daily streak** — keep your streak alive by playing each day.
- **Badges** — 10 achievements (first pour, three stars, streaks, level
  milestones, inventor, daily habit, and more) on a dedicated Badges screen.

### Invent-a-mix judging
- **Judges panel** — the Mixologist mode is now scored by a rotating panel of
  judges (3 of 10, each with their own palate and comments) instead of a single
  evaluator score.

### Still to come (needs a backend)
- Community sharing of your inventions, likes/feedback, and global leaderboards
  (most-likes and daily-streak tabs), plus real accounts that sync across devices.

---

## v1.0.0 — First release (2026-06-20)

The first official, versioned release of the game.

### Game modes
- **Basic** — pick ingredients and garnish; the glass and method are chosen for you.
- **Advanced** — you choose everything: glass, pour, method and garnish.
- **Mixologist** — a free-pour sandbox where you invent your own cocktail and an
  evaluator scores it on balance, strength, technique, glass fit and garnish,
  with coaching tips and "you just invented a…" classic recognition.
- **Training** — a guided lesson with a step-by-step coach that highlights the
  correct choice at each step, so new players learn how to build a cocktail.
- **Endless Shift** — serve random customer orders for points with lives and streaks.

### Content
- **50 cocktails** spanning the canonical classics, ordered easy → hard.
- **58 ingredients** including spirits, liqueurs, juices, mixers, syrups, bitters,
  dairy/egg and herbs/spice, each with mixology metadata for the evaluator.
- **Recipe Book** to browse every cocktail.
- **My Bar** to save your own inventions and recreate them later.

### Presentation & extras
- Animated bar station with SVG glassware, pouring, mixing and garnish animations.
- Programmatic sound effects plus a toggleable ambient bar loop.
- Progress bar, animated points counter and persistent high scores.
- Metric (ml) measurements throughout.
- Mobile-friendly layout that fits the screen without scrolling.
