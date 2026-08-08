---
name: healthcheck
description: >-
  Validate that DAG Tails services and the in-game boot path are healthy.
  Use when the user says "healthcheck", "is the game up", "check Pages",
  "check Supabase", or before shipping to testers.
---

# Healthcheck

Gate remote play on live Pages + Supabase, then optionally confirm in-game boot.

## Steps

1. **Services probe** (required):
   ```bash
   npm run healthcheck
   ```
   - Required PASS: config, Pages HTML/JS/CSS, Supabase REST read, events write
   - Optional WARN: anonymous auth, latest Actions run — report clearly

2. **In-game boot** (when user wants full gate, or backend/Pages just changed):
   - Quick desktop: `npm run test:health` (`pc` only)
   - **Default phone/tablet/fold gate** (full matrix, landscape, parallel): `npm run test:qa`
   - Quick 2-phone smoke: `npm run test:qa:quick`
   - Device-matrix specialist: **device-qa** agent (`/device-qa`)
   - If port 4173 is busy on Windows:
     ```powershell
     $env:PW_PORT='4183'; $env:CI='1'; npm run test:qa
     ```

3. **Report**
   - Overall: up / down
   - Failed checks with the script’s `fix:` hints
   - Always-on URL: https://dag-com.github.io/last-call-bartending-game/

## Notes

- Prefer this skill before invoking **pages-shipper**
- For deeper Supabase repair, delegate to **supabase-ops**
- For gameplay regressions, delegate to **gameplay-qa** (defaults to full handheld matrix via `npm run test:qa`)
