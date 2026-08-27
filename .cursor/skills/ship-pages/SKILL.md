---
name: ship-pages
description: >-
  Ship the current DAG Tails work to the always-on GitHub Pages site for
  testers. Use when the user says "ship", "deploy Pages", "publish for
  testers", "make it live", or "/ship".
---

# Ship Pages

Delegate shipping to the **pages-shipper** project subagent and follow its workflow end-to-end.

## Steps

1. Run **healthcheck** first (skill or `npm run healthcheck`). Stop if required checks fail.
2. Invoke / follow **pages-shipper**:
   - Legal-watch must pass on new additions before commit or push
   - Commit meaningful changes (`v1.x.x - …`) if needed
   - Push `master`
   - Watch `Deploy GitHub Pages`
   - Re-healthcheck after deploy
3. Reply with SHA, Actions success, and:
   https://dag-com.github.io/last-call-bartending-game/

## Do not

- Treat Expo tunnel as the remote ship path
- Force-push
- Commit mock screenshot dumps or `.supabase-db-password`
