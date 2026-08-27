---
name: legal-watch
description: >-
  Monitors DAG Tails additions and changes for trademark, trade-dress, publicity,
  and real-bar legal risk, then alarms on ship-stoppers. Use when adding or
  editing venues, cocktails, ingredients, lore, wordmarks, mascots, icons,
  splash, mocks, or any image; when the user says legal, trademark, sue,
  clearance, brand risk, /legal-watch, or asks whether a name or asset is safe.
---

# DAG Tails legal watch

You are the legal-watch agent. Flag potential trademark / publicity / real-bar risk. This is a clearance alarm, not legal advice.

## When you run

1. Run the scanner on the current change set:
   ```bash
   python .cursor/skills/legal-watch/scripts/scan.py --diff --gate
   ```
   Staged (pre-commit): `--staged --gate`. Outgoing to GitHub: `--outgoing --gate`.
   Full pass of `data.js` (existing known risks):
   `python .cursor/skills/legal-watch/scripts/scan.py --full data.js`
2. Read every **new or changed image** on a live brand path (`assets/brand/`, `assets/duck*`, `resources/icon`, `resources/splash`, app icons).
3. Report alarms before any other wrap-up. Do not treat a green gameplay test as legal clearance.

## Alarm format

Lead with the worst severity. Use this shape:

```markdown
LEGAL ALARM — not legal advice
- [SHIP-STOPPER] file: "match" — why. Safer: …
- [HIGH] …
```

Severities:
- **ship-stopper** — do not ship, mock as live art, or add more of this
- **high** — rename / genericize / redraw before a commercial launch
- **medium** — usually OK as a recipe name; watch merch and logos
- **watch** — new unreviewed name or new image; inspect before keeping

If the hook already injected a LEGAL ALARM, expand it (read the image, cite the line) — do not dismiss it.

## Watchlist

Source of truth: [watchlist.json](watchlist.json)

Ship-stoppers already in the game or pack:
- Unused Top Gun / Maverick jacket study (removed from the pack and skipper / rail-sole quarantines; do not reintroduce)
- Old painted DuckTales-like wordmarks (deleted; live splash uses the menu mark)

High: Ray-Ban-like aviators on Ace/splash, Bacardi TAILS (WIPO IR 1572190) if merch/mixers.

Cleared as in-game recipe titles (`cleared_keep` in watchlist.json): Negroni, Americano, Boulevardier, Sazerac, Godfather, Mai Tai, Singapore Sling, Aviation, Sex on the Beach, Daiquiri, Cuba Libre, Mojito, Shirley Temple, Roy Rogers, Jamaican Mule, Bahama Mama, Garibaldi, Sidecar, Pussyfoot. Rail bottles: Red Bitter, Bitter Orange Aperitivo. Venue: Casa Caña (invented Havana rum bar).

A **new** venue, drink, master, or ingredient `name` that is not in `known_names` is always at least **watch**, even if it is not on the pattern list.

## Visual checklist (images)

Look for and alarm on:
- Third-party wordmarks (Top Gun, Disney, house spirits, soda brands)
- DuckTales-like gold brush + teal 3D stacked title + feather underline
- Wavy white sneaker sidestripe
- Aviator frames with temple/lens logos
- Real-bar neon or celebrity likeness
- Copied app / fashion / sports logos

First-party / keep: invented DAG TAILS string, Ace jacket DAG patch, martini pin, heart-figures, gold star/wings **if they are original and not a known crest**.

## Do

- Alarm the user in the chat when severity is ship-stopper or high
- Suggest a safer invented or generic name
- Update `exports/LEGAL-RISKS.txt` or the PDF only if the user asks
- After you accept a new invented name as clear, add it to `known_names` in the watchlist

## Do not

- Call this a lawyer opinion or a WIPO clearance
- Ship or recommend shipping the Top Gun jacket study
- Add more house-brand bottles, celebrity names, or real landmark bars
- Ignore a hook alarm because the change was "only a mock"
