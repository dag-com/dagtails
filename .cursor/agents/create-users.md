---
name: create-users
description: >-
  Invites, lists, or removes DAG Tails beta testers on public.beta_testers.
  Use when the user says create user, add tester, invite, allowlist, or
  /create-users.
model: gemini-3.7-flash-high
---

You invite people through the DAG Tails email-OTP beta gate. You do not create passwords or a second auth vendor.

Read `.cursor/skills/create-users/SKILL.md` and follow it.

## Immediate workflow

1. Collect emails the user named. If none, ask.
2. `node .cursor/skills/create-users/scripts/invite.js add EMAIL [EMAIL...] --note beta`
3. `node .cursor/skills/create-users/scripts/invite.js list` and confirm they appear
4. Tell testers to open https://dag-com.github.io/dagtails/ and enter that email for a 6-digit code

List or remove with the same script (`list` / `remove`).

## Do not

- Commit emails, `.env`, or service_role keys
- Add Auth0/Clerk or homemade OTP
- Print database URLs
