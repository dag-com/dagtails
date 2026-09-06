# PRIVACY NOTICE — PLACEHOLDER (not legal advice)

**Status:** Draft for lawyer review. This is **not** an in-force privacy policy, terms of service, or copyright assignment. Replace this file with counsel-approved text before a public or store launch.

**Product:** DAG Tails (a bartending game)  
**Operator (placeholder legal name):** DAG.com, operating DAG Tails  
**Last updated:** 6 September 2026  

---

## 1. Who this is for

This draft describes how the **private beta** of DAG Tails handles information. Testers are invited by email. The live game is at https://dag-com.github.io/dagtails/

## 2. What we collect

| Information | Why | Where it is stored |
|---|---|---|
| Invite email | Send a one-time login code; keep the tester list | Supabase Auth and `beta_testers` |
| Private name, age | Personalise the device; choose cocktail vs mocktail menu (18+) | This device only (`localStorage`) |
| Public alias / username | Show on Community and Leaderboards | Supabase `players.name` (publicly readable) |
| Optional location | Optional leaderboard line | Supabase `players.location` if you type one |
| Optional profile email / id field | Optional local note — not used as the beta login | This device only unless you also use it at the beta door |
| Play events (screens opened, drinks started/served/left, device id, session, screen size, underage flag) | Understand how the beta is used | Supabase `events` (not shown as a public feed of named people) |
| Shared recipes | Community | Supabase `creations` (publicly readable) |

We do **not** intend to collect payment card data. In-game “shop checkout” is a demo of intent, not a real purchase.

Analytics events are **not** supposed to include your private name, age, or email — only an underage true/false flag and a random device id created on this browser.

## 3. Public vs private names

- **Private name** stays on this device. It is not written to the public player row.
- **Public alias** is the only name other players should see (Community “by …”, leaderboards).

## 4. Intellectual property — cocktails you build

**Placeholder — lawyer must confirm.** Every cocktail, recipe, drink name, garnish combination, and Community share you create in DAG Tails is the **property of the operator** (placeholder: DAG.com / DAG Tails). You get a limited licence to play the game and to display your public alias with those creations. You do not keep ownership of in-game recipes or shares. Classic real-world drink names that appear as catalogue titles remain third-party recipe names used as game content, not a claim that the operator invented those classics.

## 5. Who can see data

- Other players can see **public alias**, optional **location**, shared **recipe cards**, and like counts.
- The operator can read play events and the invite list in order to run the beta and the player-report (aggregated). The public player-report pages are not supposed to list names, ages, or emails.
- Hosts: GitHub Pages (static game files), Supabase (database and email codes). Fonts are stored with the game files so the page does not call Google Fonts.

## 6. Children

DAG Tails is a cocktail game. The alcohol menu is for players **18 or over**. Mocktails are shown under 18. This beta is **not** directed at children. Do not invite testers who are under 18. The profile age field is a menu split, not parental consent.

## 7. How long we keep it

Invite emails and play events stay until the operator deletes the beta project or you ask to be removed from the tester list. Device data stays until you clear site data for this game.

## 8. Your requests (placeholder)

To access, correct, or delete beta data, email the operator (placeholder contact: the person who invited you). Removal from `beta_testers` stops new logins; ask if you also want Auth/events rows deleted.

## 9. International

Servers may be outside your country (Supabase / GitHub). This draft does not choose a lead data-protection law. Counsel should add GDPR/UK GDPR/CCPA (or other) clauses, a lawful basis, and a real company address.

## 10. Consent

Checking the box on the beta door and/or the create-profile screen means you confirm you have **read this placeholder notice** and agree to use the beta on these terms until a lawyer-approved document replaces it.

---

*End of placeholder. Counsel: see `docs/legal/lawyer-review.zip`.*
