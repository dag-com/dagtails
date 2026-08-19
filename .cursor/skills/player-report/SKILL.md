---
name: player-report
description: >-
  Pull live DAG Tails analytics from Supabase, refresh the visual Canvas, and
  write dated GitHub markdown under docs/player-reports (with a history index)
  and publish the public reviewer URL on GitHub Pages. Use when the user says "player report", "analytics report", "how are testers
  doing", "end user behaviour", or wants the GitHub report updated.
---

# Player report

Build a **Canvas** for the person in chat, **GitHub markdown history**, and a
**public HTML page** reviewers can open without a GitHub account:

https://dag-com.github.io/last-call-bartending-game/player-reports/

The **player-report** agent publishes to GitHub after this skill. GitHub
Actions also refreshes `docs/player-reports/` daily when secret `SUPABASE_DB_URL`
is set, and publishes the reviewer URL on Pages. The tracking spec lives at
the same site: `/player-reports/analytics.html`.

## Steps

1. **Read** the Cursor canvas skill, then [canvas-spec.md](canvas-spec.md).
2. **Fetch** from the repo root (linked Supabase project `dag-tails`):
   ```bash
   node .cursor/skills/player-report/scripts/fetch.js
   ```
   Read `.cursor/skills/player-report/last-snapshot.json` (also printed on stdout).
   In CI, the same script uses `SUPABASE_DB_URL` instead of `--linked`.
3. **Render** the GitHub copy (dated file + `latest.md` + history index):
   ```bash
   node .cursor/skills/player-report/scripts/render.js
   ```
4. **Write** the Canvas to the managed canvases folder (exact location the
   canvas skill names). Filename: `player-report.canvas.tsx`. Overwrite it.
5. **Embed** snapshot numbers inline, plus a **History** table from
   `docs/player-reports/YYYY-MM-DD.md` (date + headline). No `fetch()` in the canvas.
6. **Chat** with 4–6 sentences: the headline finding, one caveat, the
   **reviewer URL** (send this to outsiders), a markdown link to the canvas,
   and the GitHub history URL. Do not paste tables in chat. The report
   ends with a hook + premium-price suggestion generated from the snapshot.

Prefer `npm run report:players` when you only need fetch + markdown.

If the fetch fails (CLI not logged in, project paused), stop. Do not invent
numbers. Tell the user to run `npx supabase projects list` and that the
dag-tails project must be `ACTIVE_HEALTHY` and linked.

If `totals.events` is 0, skip the canvas and say nothing has been logged yet.

## How to talk

| Instead of | Write |
|---|---|
| FTUE / D0 conversion | People who opened the game vs people who finished a drink |
| stage_started | Started mixing |
| stage_result | Finished and served |
| drink_abandoned | Left without serving |
| menu_return | Went back to the home screen |
| intro_skip | Skipped the intro comic |
| hub_cta | What they tapped on the home screen |
| device_id | Phones / browsers we can tell apart |
| QA / Playwright | Automated test runs (not real players) |

Never log or display player names, ages, or emails. `underage` boolean only.

## Reading rules (required)

- Flag any day with `opens >= 80` as **automated testing**, not testers.
- If `phase1_live` is false, say the new tracking (who came back, where they
  quit) is not in this data yet.
- 3-star Guess drinks at The Snug are the default test path. Do not call that
  “players are experts.”
- D1 only means something among people who **served a drink** on day 0.
- Pad known catalogs with zeros (judge verdicts, play modes, venues, hub
  buttons, star buckets, pour steps, teaching levels, drink families).
  Unused options stay visible.
- Omit a section only if the whole family has no tracking in the schema yet
  *and* showing zeros would imply “nobody did it” when we simply were not
  recording it (intro skip / menu return before Phase 1).

## Do not

- Query `events` with the anon key (RLS is write-only).
- Print JWT / database passwords.
- Add new tracking events from this skill (instrumentation lives in `game.js`).
- Ship Pages or change the game unless the user asked.
