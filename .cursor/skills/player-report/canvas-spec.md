# Canvas spec for player-report

Write one `.canvas.tsx`. Import only from `cursor/canvas`. Default-export the
page. No emojis, gradients, or box-shadows. Mix headings with charts — not a
wall of identical cards.

## File

Overwrite `player-report.canvas.tsx` in the workspace canvases directory from
the canvas skill (not inside this repo’s source tree).

## Layout

1. **H1** `How people are playing DAG Tails`
2. **Caption** — source `Supabase events · dag-tails`, `range_start`–`range_end`,
   `pulled_at`.
3. **Four Stats** (plain labels):
   - Opened the game (`totals.opens`)
   - Finished a drink (`totals.served`)
   - Left without serving (`totals.abandoned`) — omit the stat if 0 and Phase 1
     is not live (do not imply nobody quit)
   - Distinct people (`totals.devices` if > 0, else `totals.identities`)
4. **Callout** — the one sentence a non-dev should remember. Tone:
   - `danger` if most opens sit on `likely_qa` days
   - `warning` if `phase1_live` is false
   - `info` otherwise
5. **H2** `Opens over time` + `LineChart`
   - categories: daily `day` (short dates)
   - series name `Game opens`
   - caption with units and source
6. **H2** `Did they finish the drink?` + `BarChart` of stars if `stars` is
   non-empty. Caption: count of served drinks by star rating.
7. **H2** `Where they played` — `UsageBar` or table of venues if non-empty.
   Map ids for readers: `snug` → The Snug, `zavod` → Zavod, `cantina` →
   La Cantina, `aperitivo` → Aperitivo, `speakeasy` → Speakeasy,
   `soda_fountain` / `juice_bar` / `beach_shack` → mocktail bars.
8. **H2** `What they tapped` — hub_cta table only if the array has rows.
9. **H2** `Invented drinks` — Mixologist started vs finished + verdicts, omit
   if both counts are 0.
10. **H2** `What this means` — 3–5 bullets in `Text`: hook clues, turnoffs,
    what not to decide yet. No jargon.
11. **H2** `History` — `Table` of GitHub snapshots from
    `docs/player-reports/*.md` (columns: Date UTC, Headline). Newest first,
    including today. Caption: same pages as `docs/player-reports/` on GitHub.

Include a `serve rate` only as a sentence with the QA caveat, not as a KPI
stat, unless `phase1_live` is true and QA days are a minority of opens.

## Chat

One markdown link to the canvas file using its full absolute path.
