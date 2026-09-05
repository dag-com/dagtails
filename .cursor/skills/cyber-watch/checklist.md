# Cyber-watch review checklist

Use with the scanner. Scanner misses logic; this does not.

## Secrets

- [ ] No `service_role` / `sb_secret_` / DB URI / private key in the diff
- [ ] Anon / publishable key only in `config.js`; JWT `role` is `anon`
- [ ] GitHub Actions use `${{ secrets.* }}`, not inlined tokens
- [ ] `.env`, `.supabase-db-password` stay untracked

## Auth / login policy

- [ ] Anonymous boot path still works when Auth is down
- [ ] Claimed login uses `signInWithOtp` / `updateUser({ email })` / `verifyOtp`, not a DIY code
- [ ] No `signInWithPassword` without a following email OTP challenge
- [ ] No new IdP package (Auth0, Clerk, Firebase Auth, Passport, Cognito)
- [ ] Redirect allowlist includes Pages + local preview only
- [ ] RLS policies still key off `auth.uid()`; no `using (true)` on writes except `events` insert

## Client

- [ ] Player-supplied strings (name, location, creation title, recipe) are not assigned raw to `innerHTML`
- [ ] No `eval`, `new Function`, `document.write`
- [ ] Community / Leaderboard remain readable without leaking other players’ emails or ids beyond what the view already exposes

## Ship gate

- [ ] `python .cursor/skills/cyber-watch/scripts/scan.py --diff --gate` is clean (or only `watch`, reviewed)
- [ ] Do not `--no-verify`
