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
6. **H2** `Did they finish the drink?` + `BarChart` of stars **0–3 always**
   (include zero counts).
7. **H2** `Play modes` + grouped `BarChart` (started vs finished) for all six
   modes: Bar-hop journey, Mixologist, Endless shift, Training, Cocktail of
   the Day, My Bar challenge. Include zeros. Caption: what they start vs skip.
8. **H2** `Where they played` — horizontal `BarChart` of **all** venues
   (snug, zavod, cantina, aperitivo, casa_cana, speakeasy, boudoir, still,
   soda_fountain, juice_bar, beach_shack) including zeros.
8b. **H2** `Teaching levels` — `BarChart` of Guess, Pour, Mix, Garnish,
   Full bar, Sandbox including zeros.
9. **H2** `What they tapped` — `BarChart` of **all** hub buttons (journey,
   mix, endless, training, cotd, badges, help, settings, profile) including
   zeros. If Phase 1 is not live, caption that zeros mean not recorded yet.
10. **H2** `Did they skip the intro?` — people-skip % if recorded; else one
    sentence that it is not in the log yet.
11. **H2** `Who left without serving` — all pour steps (glass, pour, method,
    garnish) including zeros.
12. **H2** `Who went back to the home screen` — all origins including zeros.
13. **H2** `Invented drinks` — Mixologist started vs finished. **BarChart of
    every judge verdict** even at 0: Outstanding, Crowd-pleaser, Solid pour,
    Needs work, Back to the drawing board. Optional families chart with zeros.
14. **H2** `What this means` — what they do, what they skip, what that
    suggests they want. No jargon.
15. **H2** `What hooked them (analytics only)` — the strongest
    “make another” signal (usually Mixologist if they finish inventions),
    what looks free vs paid **if** a pass were ever priced, and a recorded
    range (`$4.99 / month` or `$29.99 / year` when Mixologist is the hook).
    State clearly this is not a product change. Caveat QA / missing
    retention. Do not treat unused modes as a paywall.
16. **H2** `History`

Include a `serve rate` only as a sentence with the QA caveat, not as a KPI
stat, unless `phase1_live` is true and QA days are a minority of opens.

## Chat

One markdown link to the canvas file using its full absolute path.
