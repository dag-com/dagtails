# DAG Tails UI/UX checklist

Use during audits. Mark Pass / Fail / N/A. Do not paste this whole list into the audit report.

## Global
- [ ] Shared color tokens (warm night + gold) — not random purple panels per screen
- [ ] Shared display + body fonts
- [ ] Primary CTA style consistent
- [ ] Back / close affordance consistent
- [ ] Duck guide used for orientation screens
- [ ] Landscape phone usable without critical clip
- [ ] Primary exit CTAs (Menu / Next / Play again / map CTA / intro Next) stay in the short-landscape viewport — never a dead-end behind overflow or a tall logo
- [ ] Intro comic caption + Next readable on-screen (including Expo chrome)
- [ ] Station glass SVG paints on handhelds (iPhone / Expo Go), not only desktop
- [ ] Locked / done / current states distinct without relying on color alone
- [ ] Mixologist pour: selected chip expands sideways for − / amount / + / × (same height)
- [ ] Mix result: judges + Make another on-screen; no page scroll
- [ ] Hub venue photo is the current stop; Learn / Help / Badges stay at the bottom
- [ ] Map candy discs show earned stars; current stop pulses

## Splash / hub / profile
- [ ] Brand readable as hero
- [ ] One primary action obvious
- [ ] Profile gate clear for age / mocktail split
- [ ] Hub does not dump dashboard clutter in first glance

## Map
- [ ] Not a crowded multi-building city crawl
- [ ] Venue step = one bar hero
- [ ] Drink step = short candy path for that venue
- [ ] Enter bar / Pour CTAs unambiguous
- [ ] Hop / enter transition exists and matches system motion

## Game / result
- [ ] Ticket + station hierarchy clear mid-pour
- [ ] Errors recoverable
- [ ] Result → next drink / next venue / hub paths clear
- [ ] Finish / result / intro never trap the player (clipped or missing exit CTA)

## Secondary (badges, recipes, community, shop, settings…)
- [ ] Same header/back chrome family
- [ ] Empty states written
- [ ] Demo/stub features labeled (e.g. shop)
