# Login policy (DAG Tails)

Canonical copy for Cursor: [`.cursor/skills/cyber-watch/login-policy.md`](../.cursor/skills/cyber-watch/login-policy.md).

- **Play (local)** stays anonymous (no email, no password).
- **Public Pages beta** is invite-only: email OTP, then a server allowlist (`docs/BETA.md`).
- **Claimed accounts** (when built) use **email OTP / magic link through the existing Supabase Auth project**. Email is the possession / MFA factor. No Auth0, Clerk, Firebase Auth, or homemade codes.
- **Claimed accounts** (when built) use **email OTP / magic link through the existing Supabase Auth project**. Email is the possession / MFA factor. No Auth0, Clerk, Firebase Auth, or homemade codes.
- **Operator consoles** (GitHub, Supabase, DNS): MFA required. Email OTP is the minimum; passkeys or TOTP preferred.
- The `anon` key in `config.js` is public. Never put `service_role`, `sb_secret_`, or the database URL in the repo.

Security review: `/cyber-watch` or `npm run cyber-watch`.
