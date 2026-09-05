# DAG Tails login policy

Email is the **MFA / possession factor**. Supabase Auth (already in the repo) is the implementation. Do not add another identity vendor. Do not roll your own crypto.

## Who logs in

| Surface | Today | Policy |
|---|---|---|
| Player, casual play | Anonymous Supabase user per device | Keep **locally**. Offline play must still work if Auth is down. |
| Player, **public Pages beta** | Invite-only email OTP | Lock is on for `*.github.io` / `VITE_BETA_LOCK=1`. Testers prove the inbox, then `beta_access_ok()` must be true. No anonymous boot on Pages while the lock is on. See `docs/BETA.md`. |
| Player, claimed identity (cross-device / named Community) | Not shipped | Bind the anonymous user to an **email OTP or magic link** before the session is treated as that person. Email is the possession factor. |
| Operators (GitHub org, Supabase dashboard, domain, CI) | Human accounts | MFA required. Email OTP is the **minimum** second factor. Passkeys or TOTP preferred. |

## How email-as-MFA is done (use Supabase, not a new vendor)

You do **not** need Auth0, Clerk, Firebase, Duo, or a custom mailer for a high-standard *game* login. You already pay for the hard parts inside **Supabase Auth**: OTP generation, one-time use, expiry, rate limits, session JWTs, refresh-token rotation, redirect allowlists.

### Claimed player account (when you build it)

1. Keep `signInAnonymously()` as the boot path in `backend.js`.
2. To bind a person, call Supabase — not a homemade code:
   - `sb.auth.updateUser({ email })` (sends a confirmation / magic link to the current anonymous user), or
   - `sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })` then, if you must merge, use Supabase identity linking — never copy user ids by hand.
3. Session is privileged (named Community, cross-device) only after `verifyOtp` / magic-link callback succeeds.
4. Redirect URLs stay on the allowlist in `supabase/config.toml` (`site_url` + Pages + local preview). Never add `*` or an attacker-controlled origin.
5. Turn on `enable_confirmations`, a sane `otp_expiry` (minutes, not hours), and SMTP in production before shipping claimed accounts. The current `otp_expiry = 3600` and `enable_confirmations = false` are anonymous-play defaults — tighten them when email login ships.
6. If a **password** is ever added, it is factor 1 only. Factor 2 is still **email OTP** (`verifyOtp` type `email`) before `ready = true`. Password-only sign-in is a policy break.
7. Do not enable TOTP/phone MFA instead of email unless the user explicitly changes this policy. Email OTP remains the required possession factor for players. Operator dashboards may add passkeys on top.

### Operators

Use the MFA the host already provides:

- GitHub: passkey or authenticator app. Email codes are recovery / sudo, not the only factor.
- Supabase dashboard: same GitHub SSO + MFA on that GitHub user.
- No extra 3rd party (Okta, Duo) unless the org later requires SSO.

## DIY vs 3rd party — the honest bar

**Implementing “email MFA” yourself to a high standard means building an identity platform.** That is not a weekend feature. A high-standard design needs CSPRNG OTPs, constant-time compare, single-use + short TTL, per-IP and per-inbox rate limits, lockout, SPF/DKIM/DMARC, bounce handling, session fixation protection, CSRF on callbacks, refresh rotation, audit logs, and recovery that does not bypass MFA. Getting any of those wrong is an account-takeover bug.

**Use Supabase Auth.** That *is* the 3rd party, and it is already wired. Adding a second IdP (Auth0, Clerk) buys enterprise SSO and hosted UI you do not need for DAG Tails, and it splits identity away from the RLS `auth.uid()` the schema already uses.

**What you should implement yourself:** the game UI (enter email, enter 6-digit code, “use this device” copy) and the bind/merge flow calling `sb.auth.*`. **What you must not implement yourself:** OTP generation, JWT signing, session cookies, SMTP from the client, or a custom `users` password table.

Email OTP is **not** phishing-resistant (passkeys are). For a bartending game account that is the accepted bar. For GitHub/Supabase operator access, prefer passkeys.

## Hard no

- `service_role` or `sb_secret_` in client bundles, `config.js`, Pages, or chat
- Disabling RLS to make Community work
- Homegrown `Math.random()` codes, `jsonwebtoken.sign`, or `nodemailer` OTP
- Password-only login
- A second auth vendor “just in case”
- Logging raw OTPs, magic-link URLs, or session JWTs
