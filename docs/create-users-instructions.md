# Create users — agent instruction

Use this file when you want Cursor (or another agent) to invite testers the same way Danny does.

1. Open the `dagtails` repo in Cursor.
2. Sign in to Supabase if needed: `npx supabase login` then `npx supabase link --project-ref suhrxksuwjsfeenztvdn`
3. Start a new **Agent** chat. Attach this file, or paste the block below as the first message.
4. Name the emails to invite (or say list / remove).

The live skill the agent must follow: `.cursor/skills/create-users/SKILL.md`  
Slash command: `/create-users`  
Partner (ATARG) setup wrapper: [atarg-create-users-prompt.md](./atarg-create-users-prompt.md)

---

## Paste into Cursor Agent

```
Follow the DAG Tails create-users skill. Read `.cursor/skills/create-users/SKILL.md` now and do what it says. Prefer the project create-users agent if one is available.

Repo: https://github.com/dag-com/dagtails
Default branch: master
Live game (invite-only): https://dag-com.github.io/dagtails/

Creating a user means adding their email to public.beta_testers. It is not a password account. Testers prove the inbox with Supabase email OTP.

==================================================
DO THIS
==================================================

1. Read `.cursor/skills/create-users/SKILL.md` and `docs/BETA.md`.
2. Confirm Supabase is linked (`npx supabase projects list` / `invite.js list`).
   If list fails: `npx supabase login` then `npx supabase link --project-ref suhrxksuwjsfeenztvdn`.
   Do not print database URLs, JWTs, or service_role keys.
3. If the user named emails, invite them:
   node .cursor/skills/create-users/scripts/invite.js add EMAIL [EMAIL...] --note beta
   Then run list and confirm they appear.
4. If they asked to list or remove, use the same script (list / remove).
5. If they named no emails, explain the process in one short block, list who is already invited, and ask for addresses. Do not invent emails.

After an invite, tell the tester:
https://dag-com.github.io/dagtails/ → that exact email → 6-digit code from their inbox.

Inviting does not ship a new game build. It only allowlists the inbox.

==================================================
DO NOT
==================================================

- Put tester emails in git, config.js, or the game bundle
- Add Auth0, Clerk, Firebase Auth, or homemade passwords / OTPs
- Edit game code, the beta gate, or schema unless the user clearly asks
- Commit, push, or --no-verify unless they clearly ask
- Request OTP codes or sign testers in from this machine unless they ask
```
