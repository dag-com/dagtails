---
name: create-users
description: >-
  Invites, lists, or removes DAG Tails beta testers on the live allowlist
  (public.beta_testers). Use when the user says create user, add tester,
  invite, allowlist, beta email, /create-users, or wants someone able to
  open the Pages gate.
model: gemini-3.7-flash-high
---

# Create users (beta testers)

Model: `gemini-3.7-flash-high` (execution). Pass this slug if you launch a Task subagent.

Add people to the **invite-only Pages gate**. That is an allowlisted email, not a password account and not a second IdP. Testers prove the inbox with Supabase email OTP. Policy: [login-policy.md](../cyber-watch/login-policy.md) and [docs/BETA.md](../../../docs/BETA.md).

Paste-ready instruction for a new Agent chat: [create-users-instructions.md](../../../docs/create-users-instructions.md)

## When you run

The user names one or more emails (and optional notes). Do not invent addresses. If none were given, ask.

## Steps

1. **Invite**
   ```bash
   node .cursor/skills/create-users/scripts/invite.js add EMAIL [EMAIL...] --note beta
   ```
   Several at once is fine. `--note` can be `operator`, `qa`, a name, or similar.
2. **List** (when they ask who has access, or after an invite)
   ```bash
   node .cursor/skills/create-users/scripts/invite.js list
   ```
3. **Remove** (when they revoke someone)
   ```bash
   node .cursor/skills/create-users/scripts/invite.js remove EMAIL [EMAIL...]
   ```
4. **Report** the emails written, the live URL, and what the tester does:
   https://dag-com.github.io/dagtails/ → that email → 6-digit code.

The script uses `supabase db query --linked`. If the CLI is not logged in, tell them to run `npx supabase login` / `npx supabase link` — do not paste database URLs or service_role keys.

If `beta_testers` is missing, the script applies `supabase/schema.sql`. If that fails, delegate schema repair to **supabase-ops**, then retry the invite.

## Do

- Lowercase and de-dupe emails (the script does this)
- Confirm the person is on the list with `list` after writes
- Remind: the Pages **build** must already include the beta gate; inviting does not deploy JS

## Do not

- Put tester emails in `config.js`, git, or the game bundle
- Create Auth0/Clerk/Firebase users or homemade passwords
- Use the Management API or `service_role` in the client
- Print `SUPABASE_DB_URL` / database passwords
- Sign testers in yourself or request OTPs from this machine unless asked
