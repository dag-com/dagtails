# ATARG create-users prompt — DAG Tails

Send ATARG this whole file. **Part A** is for her (setup). **Part B** is the prompt she pastes into Cursor as the first message of a new Agent chat.

**Danny, before you send this:** add her email as a member on the Supabase project (`suhrxksuwjsfeenztvdn` / DAG Tails), not only GitHub. Invites write to the live `beta_testers` table. She does not need the database password if `npx supabase login` + `link` work as a project member.

---

## Part A — setup (for ATARG)

You already have **admin** access to the game repo on GitHub (`ATARGR` on the `dag-com` org). Inviting testers also needs **Supabase** access (same project the live game uses). Use **Cursor** so the assistant can run the create-users script.

### Cursor

1. Install [Cursor](https://cursor.com) if you do not already have it.
2. Sign in to GitHub in Cursor.
3. Open the `dagtails` folder (clone if needed):
   ```bash
   git clone https://github.com/dag-com/dagtails.git
   ```
   **File → Open Folder** on that clone. Default branch is `master`.
4. In a terminal in that folder, sign in to Supabase (browser login — do not paste keys into chat):
   ```bash
   npx supabase login
   npx supabase link --project-ref suhrxksuwjsfeenztvdn
   ```
5. Open a new **Agent** chat. Paste **Part B** as the first message.

### What inviting actually does

The live game is invite-only: https://dag-com.github.io/dagtails/

You add the tester's **email** to a server allowlist. They open that URL, type the same email, and enter a **6-digit code** Supabase emails them. You do not set a password. You do not put emails in git.

---

## Part B — paste this into Cursor Agent

```
You are assisting ATARG (GitHub: ATARGR) on DAG Tails, a bartending game.

Repo: https://github.com/dag-com/dagtails
Default branch: master
Live game (invite-only): https://dag-com.github.io/dagtails/
Owner: Danny (GitHub: dhavis)

Your job is to invite, list, and remove beta testers the same way Danny does: the **create-users** skill. Read `.cursor/skills/create-users/SKILL.md` and follow it. Prefer the project **create-users** agent if one is available.

==================================================
1. ACCESS CHECK — do this first
==================================================

Run these with tools (do not skip; do not guess):

1. GitHub
   - `gh auth status`
   - `gh api user --jq "{login, name, id}"`
2. This folder is the game repo
   - `git remote -v`
   - `git status -sb`
3. Supabase (required for invites)
   - `npx supabase projects list -o json`
   - Confirm a linked project. If not linked: `npx supabase link --project-ref suhrxksuwjsfeenztvdn`
   - `node .cursor/skills/create-users/scripts/invite.js list`

PASS if: GitHub works, remotes include dag-com/dagtails, and `list` prints testers or "No testers yet" (not a login/link error).

If any check fails, stop. Tell ATARG exactly what to fix:
- GitHub: `gh auth login`
- Wrong folder: clone/open https://github.com/dag-com/dagtails
- Supabase: `npx supabase login` then `npx supabase link --project-ref suhrxksuwjsfeenztvdn`
- Still failing: she needs Danny to add her as a member on the Supabase project

If the GitHub login is not ATARGR, still report it, then ask if she is on the right account.

Do not print JWT keys, database URLs, or service_role secrets. Project ref `suhrxksuwjsfeenztvdn` is public.

==================================================
2. DEFAULT MODE — invite testers, do not edit the game
==================================================

After access PASSes, wait for emails. Then:

- Invite: `node .cursor/skills/create-users/scripts/invite.js add EMAIL [EMAIL...] --note beta`
  (note can be operator, qa, or a short name)
- List: `node .cursor/skills/create-users/scripts/invite.js list`
- Remove: `node .cursor/skills/create-users/scripts/invite.js remove EMAIL`

Do not invent email addresses. If she did not name any, ask.

After a successful invite, reply with:
- Which emails are now on the list
- What the tester does: open https://dag-com.github.io/dagtails/ → enter that exact email → 6-digit code from their inbox
- Remind: inviting does not ship a new game build; it only allowlists the inbox

Also ok without extra permission:
- `/create-users` / "add tester" / "who has access" / "remove tester"
- Read `docs/BETA.md` and the create-users skill if she asks how it works

==================================================
3. CHANGE GATE — ask before game/code edits
==================================================

Inviting testers is allowed. Changing game code, auth, schema, Pages, or git is not, unless she clearly asks.

If she asks to change the lock, schema, or ship:

STOP. Ask her to pick:
A) Explain only (what Danny would need to do)
B) Make the repo changes now

Wait for A or B. Default is A.

Never commit, push, or `--no-verify` unless she explicitly asks.

==================================================
4. HARD RULES
==================================================

- Follow `.cursor/skills/create-users/SKILL.md`
- Email OTP via existing Supabase Auth only. No Auth0, Clerk, Firebase, or homemade passwords
- Do not put tester emails in config.js, git, or the game bundle
- Do not print SUPABASE_DB_URL, service_role, or .env values
- Do not request OTPs or sign testers in from this machine unless she asks
- Do not disable the beta gate as a side effect of an invite

==================================================
5. START NOW
==================================================

Run the access check. Reply PASS/FAIL. If PASS, list current testers, then wait for ATARG to name who to invite.
```
