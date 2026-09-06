# Private beta (invite-only)

The live game on GitHub Pages is **invite-only**. Casual visitors see an email-code door. Local play and Playwright stay open.

This is a **social + allowlist** lock, not a vault. The game is still a static download. A determined person can copy the files and play offline. For a tester beta that is the accepted bar. Unbypassable hosting would be Cloudflare Access on a custom domain (see the bottom).

## Before you ship to testers

1. Re-run `supabase/schema.sql` in the Supabase SQL editor (safe to re-run). That creates `public.beta_testers` and `beta_access_ok()`.
2. Add every tester (and yourself) **before** they open the URL. Prefer `/create-users` or attach [create-users-instructions.md](./create-users-instructions.md).
   ```bash
   npm run users:add -- you@your-domain.com tester@example.com --note beta
   npm run users:list
   ```
   Or SQL:
   ```sql
   insert into public.beta_testers (email, note)
   values
     ('you@your-domain.com', 'operator'),
     ('tester@example.com', 'beta')
   on conflict (email) do nothing;
   ```

3. Confirm Authentication → Providers → **Email** is on. OTP / magic link is enough; do not add a password-only path.
4. Optional: Authentication → Rate Limits, raise email sends above 2/hour so a handful of testers are not locked out.
5. Ship Pages as usual (`/ship`). The deploy workflow sets `VITE_BETA_LOCK=1`. Any `*.github.io` host also fails closed.

## What testers do

1. Open https://dag-com.github.io/dagtails/
2. Enter the **email you invited**
3. Type the **6-digit code** (or tap the magic link)
4. Create a **private name** (device only) and a **public alias** (Community / Leaderboards)
5. Tick the **privacy notice** box, then play. The session sticks on that browser until it expires or you remove them from the list.

Lawyer placeholders: `docs/legal/PRIVACY-NOTICE.md`, invite copy in `docs/legal/BETA-TESTER-EMAIL.md`, pack `docs/legal/lawyer-review.zip`.

Unlisted emails can request a code but are turned away after verify. Do not put the allowlist in the game bundle.

## Local preview of the door

http://127.0.0.1:4173/?betaLock=1

## Going public later

1. Remove testers you no longer want, or drop the lock:
   - Delete the `github.io` fail-closed branch in `backend.js` `isBetaLocked()` and the inline script in `index.html`
   - Remove `VITE_BETA_LOCK` from `.github/workflows/deploy-pages.yml`
   - Remove `noindex` from `index.html` and open `public/robots.txt`
2. Keep anonymous play as the default again (already the path when the lock is off)

## Stronger lock (optional, extra vendor)

GitHub Pages cannot do HTTP auth. To stop the JS from being fetched at all, put a **custom domain** on Pages and Cloudflare Access (email one-time PIN) in front of it. That is a hosting gate, not a second game IdP. You do not need Auth0/Clerk.
