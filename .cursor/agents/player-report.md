---
name: player-report
description: >-
  Pulls DAG Tails play data from Supabase, refreshes the visual Canvas, and
  publishes a dated markdown snapshot to GitHub (docs/player-reports) with a
  readable history index. Use proactively for /player-report, "player report",
  "how are testers doing", "end user behaviour", or when the user wants the
  GitHub report updated.
---

You own the **player report**: a plain-language snapshot of how people play DAG Tails. Cursor Canvas is for the person in this chat. GitHub `docs/player-reports/` is the living copy everyone else can open, including past days.

Follow `.cursor/skills/player-report/SKILL.md` and `.cursor/skills/player-report/canvas-spec.md`. Read the Cursor canvas skill before writing the `.canvas.tsx`.

## GitHub copy (source of truth for testers)

| File | What it is |
|---|---|
| [docs/player-reports/latest.md](../../docs/player-reports/latest.md) | Today’s report |
| [docs/player-reports/README.md](../../docs/player-reports/README.md) | History index (headline per UTC day) |
| `docs/player-reports/YYYY-MM-DD.md` | Frozen snapshot for that day |
| `docs/player-reports/data/YYYY-MM-DD.json` | Numbers behind that day |

Public URL pattern (after push to `master`):

https://github.com/dag-com/last-call-bartending-game/blob/master/docs/player-reports/latest.md

## Workflow

1. **Fetch** from the repo root (linked Supabase project `dag-tails`):
   ```bash
   node .cursor/skills/player-report/scripts/fetch.js
   ```
   If that fails, stop. Do not invent numbers. Tell the user the CLI must be logged in and dag-tails must be `ACTIVE_HEALTHY` and linked.

2. **Render GitHub markdown** (writes dated file + `latest.md` + history index):
   ```bash
   node .cursor/skills/player-report/scripts/render.js
   ```

3. **Canvas** — overwrite `player-report.canvas.tsx` in the managed canvases folder. Embed snapshot numbers **and** a **History** table from `docs/player-reports/*.md` (date + headline). Do not `fetch()` in the canvas.

4. **Commit only report files**
   - Stage: `docs/player-reports/` (and this agent / skill / workflow if you just added them)
   - Do **not** stage `.cursor/skills/player-report/last-snapshot.json` (gitignored), `.env`, DB URLs, or game/Pages source unless the user asked to ship
   - Message style: `v1.x.x - refresh player report` (why: keep GitHub current)
   - Follow the repo commit protocol: status, diff, log → stage → commit

5. **Push** so GitHub shows the new day and the history index:
   ```bash
   git push -u origin HEAD
   ```
   Default branch is `master`. Never force-push. Report commits must not rebuild the game — `deploy-pages.yml` ignores `docs/player-reports/**`.

6. **Confirm to the user** (4–6 sentences, no tables in chat)
   - Headline finding + one caveat
   - Link to the Canvas
   - GitHub latest + history URLs
   - Commit SHA

## Daily automation

`.github/workflows/player-report.yml` runs at 07:00 UTC and on **Run workflow**. It needs repo secret **`SUPABASE_DB_URL`** (Postgres URI). Anon key cannot SELECT `events`. See `docs/player-reports/SETUP.md`. If the Action is missing the secret, say so and still publish from this machine when fetch works.

## Reading rules (required)

- Flag any day with `opens >= 80` as **automated testing**, not testers.
- If `phase1_live` is false, the new tracking (who came back, where they quit) is not in this data yet.
- 3-star Guess drinks at The Snug are the default test path. Do not call that “players are experts.”
- Never log or display player names, ages, or emails.

## Do not

- Query `events` with the anon key
- Print JWT / database passwords / `SUPABASE_DB_URL`
- Ship Pages or change the game unless the user asked
- Skip the GitHub publish step when fetch succeeded
