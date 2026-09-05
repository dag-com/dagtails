---
name: ship-pages
description: >-
  Ship the current DAG Tails work to the always-on GitHub Pages site for
  testers. Use when the user says "ship", "deploy Pages", "publish for
  testers", "make it live", or "/ship".
model: gemini-3.7-flash-high
---

# Ship Pages

Model: `gemini-3.7-flash-high` (execution). Pass this slug if you launch a Task subagent.

Delegate shipping to the **pages-shipper** project subagent and follow its workflow end-to-end.

## Steps

1. Run **healthcheck** first (skill or `npm run healthcheck`). Stop if required checks fail.
2. Invoke / follow **pages-shipper**:
   - Legal-watch and cyber-watch must pass on new additions before commit or push
   - Commit meaningful changes (`v1.x.x - …`) if needed
   - Push `master`
   - Watch `Deploy GitHub Pages`
   - Re-healthcheck after deploy
3. Reply with SHA, Actions success, and:
   https://dag-com.github.io/dagtails/

## Do not

- Treat Expo tunnel as the remote ship path
- Force-push
- Commit mock screenshot dumps or `.supabase-db-password`
