# DAG Tails regression test plan

Player-reported fixes from the Aug 16–19 session. If a 10-year-old, Expo Go, or a short landscape phone can still hit the original bug, the gate fails.

**Gate:** `npm run test:qa`  
**Specs:** listed in `scripts/run-qa.js` (includes `tests/judges.spec.js`)  
**Matrix:** `playwright.devices.js` (phones, tablets, Flip/Fold, iPhone Air) + `phone-portrait` rotate-lock

A green Playwright run is not a UX pass. `/gameplay-qa` still fails the run if the landscape screenshot would make a tester argue with the screen.

## QA checklist (what is tested)

**Automated (Playwright, every `test:qa` run)**

1. Boot / health / Supabase
2. Hub → map → serve → result journey
3. Dead-end exits stay tappable (finish, result, intro, mix, map)
4. Glass SVG draws on handhelds; station tools sit in the bowl
5. Hub venue photo, Learn/Help/Badges, gold CTA
6. Map candy stars + current pulse
7. Mixologist chips + classic-share block
8. Assets load as absolute URLs
9. Type stays readable; portrait shows rotate-lock
10. **P23 live COTD serve:** House Taste robot is the only reviewer; Recipe match + stars match the pour; no three-judge strip; Try again + Back to menu tappable

**Agent must still look (fails the QA run even if specs are green)**

- One score story — numbers, stars, copy agree
- Copy agrees with the pour that just happened
- Portraits not on furniture; no fake scrollbar over empty space
- Short landscape (844×390 / Flip cover), not desktop

Full player-fix table: P1–P23 below. Visual audit aid: `.cursor/skills/dag-tails-ui-ux/checklist.md`.

## How to run

```bash
npm run test:qa
```

Busy port (PowerShell):

```powershell
$env:PW_PORT='4183'; $env:CI='1'; npm run test:qa
```

Quick two-phone smoke: `npm run test:qa:quick`

## Player fixes

| ID | Player request | Screen | Spec | Pass when |
|----|----------------|--------|------|-----------|
| P1 | Shift complete has no way out | Finish | `layout-integrity` finish Menu + Play again | `#btn-finish-menu` and `#btn-replay` in viewport, not overlapping |
| P2 | iPhone / Expo Go glass not drawn | Station | `layout-integrity` station chrome | `#glass-mount .glass-svg` height ≥ 36px on handhelds |
| P3 | Intro caption off-screen | Intro | `layout-integrity` intro + `player-fixes` intro chrome | `#comic-caption` and `#comic-next` on-screen |
| P4 | Welcome-to-the-bar page too tall / scroller | Profile | `player-fixes` profile modal | `#modal-profile .profile-modal-box` fits the viewport |
| P5 | Duplicate Next + Tap to continue; Skip/Next mismatch | Intro | `player-fixes` intro chrome | No “tap to continue”; Skip intro + circular gold Next; same control height |
| P6 | Ticket still says TAP | Station | `player-fixes` ticket Flip | `.ticket-flip-hint` matches `/flip/i`, not TAP |
| P7 | Garnish not proportional | Station | visual / `glass.js` lime wheel | Lime wheel is SVG in-glass, not an emoji dump (manual + code review) |
| P8 | Mixologist judges cut / missing / page scrolls | Mix result | `layout-integrity` mix result + `player-fixes` mix no-scroll | `#judges-panel` visible; `#btn-mix-another` in viewport; no document scroll |
| P9 | iPhone SE mix buttons overlap | Mix result | `layout-integrity` mix dock pairs | Tweak / Save / Shop / Share / Another do not overlap |
| P10 | Large-phone judges too small | Mix result | `layout-integrity` judge scale | ≥860×410: portrait width ≥ 130px and clustered |
| P11 | Hub always The Snug / black void | Hub | `player-fixes` venue photo + `assets-integrity` | Hub interior URL loads; cleared 16 uses Aperitivo, not Snug |
| P12 | Expo / Pages image links broken | Hub / comic | `assets-integrity` | Runtime assets + hub/splash URLs are `https?:` and 200 |
| P13 | Map glass on white disc | Map | `gameplay` candy path | `.map-node-glass` count 0; `.map-node-star` present |
| P14 | Discs show earned stars; current stop highlighted | Map | `gameplay` + `player-fixes` map pulse | Unearned current has 0 `.is-on` stars; `.map-node.is-current` pulses |
| P15 | Close classics must not share to Community | Mixology | `mixology` classic detection | Exact + close block; cousins (Boulevardier) do not |
| P16 | Measure: highlight + expand chip with amount | Mixologist pour | `mixology` pour chips + `player-fixes` chip size | One `.is-editing`; no `#build-list`; Guess has no stepper |
| P17 | Editing chip must not change height/colors; grow width for − / amount / + / × | Mixologist pour | `player-fixes` chip size | Editing height ≈ idle; width > idle; not full catalog width |
| P18 | Hub Learn / Help / Badges stay at the bottom | Hub | `hub-layout` | Learn/Help sit above `#btn-badges`; no critical overlap |
| P19 | Hub CTA gold split-button; caret must not cover badges | Hub | `hub-layout` | `#btn-start` gold; `#cta-menu` does not swallow badges |
| P21 | Muddler graphic sits through coupe/stem | Station (muddle) | visual / `placeMuddler` | Pestle sits in the bowl; handle tilts out of the rim; not a full-mount brown bar |
| P22 | Tool must sit IN the glass, in proportion | Station | `station-fit` all glass × method | Pestle in bowl with handle at/above rim; not a toothpick; spoon clears mixing-glass rim; prep hidden for muddle/build |
| P23 | Result/COTD visuals disagree with the pour | Result | `judges` live COTD serve | House Taste robot only; Recipe match 100% + 3 stars; no three-judge panel; quote agrees with the pour |

## Out of scope for this gate

- Hub clustered-duck mock (still mock-only)
- Campaign Pour tier (`MEASURE_ENABLED = false`)
- Shop payments / backend writes
- Manual garnish beauty beyond SVG presence

## Hunt list (QA agents)

Keep hunting these classes on every `device-qa` / `gameplay-qa` run — they are the same bugs as P1–P23, not new product ideas:

- Dead-end screens (clipped Menu / Play again / Serve / Make another / intro Next)
- Intro copy below the fold (Expo chrome)
- Glass SVG 0×0 on iPhone WKWebView
- Mix result document scroll or overlapping dock on SE / Flip cover
- Hub always-Snug or broken `url(...)` on Pages/Expo
- Map white-glass discs or missing star fills
- Mixologist pour still showing `#build-list` or a full-row tall editing chip
- Muddler / spoon sitting through the stem or outside the bowl on any glass
- **Player-visual disagreement:** two unlabeled grades on one result (recipe % vs panel verdict vs /100), duplicate judge copy, clipped portraits, checklist scrollbar over empty space. If a tester would argue with the screenshot, fail — even when Retry / Back to menu are tappable
