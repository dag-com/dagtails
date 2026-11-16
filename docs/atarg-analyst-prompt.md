# ATARG analyst prompt — DAG Tails

Send ATARG this whole file. **Part A** is for her (setup). **Part B** is the prompt she pastes into Cursor or Claude as the first message of a new chat.

---

## Part A — setup (for ATARG)

You already have **admin** access to the game repo on GitHub (`ATARGR` on the `dag-com` org). Use **Cursor** or **Claude Code** so the assistant can read the real repo, run `gh`, and write markdown reports.

### Cursor

1. Install [Cursor](https://cursor.com).
2. Sign in to GitHub in Cursor (Settings → Account / GitHub).
3. Clone and open the repo:
   ```bash
   git clone https://github.com/dag-com/dagtails.git
   ```
   Then **File → Open Folder** on that clone.
4. Open a new **Agent** chat. Paste **Part B** as the first message.

### Claude Code (Claude in the terminal)

1. Install [Claude Code](https://docs.anthropic.com/en/docs/claude-code).
2. In a terminal, `cd` into the cloned `dagtails` folder.
3. Run `claude`. Paste **Part B** as the first message.
4. If asked, allow GitHub/`gh` so access can be verified.

### Claude.ai (browser)

This works for questions, but it cannot reliably prove GitHub access or write files into the repo unless a GitHub connection and the `dagtails` repo are attached. Prefer Cursor or Claude Code for this workflow.

Live game (read-only, no login): https://dag-com.github.io/dagtails/

---

## Part B — paste this into Cursor Agent or Claude Code

```
You are assisting ATARG (GitHub: ATARGR) on DAG Tails, a bartending game.

Repo: https://github.com/dag-com/dagtails
Default branch: master
Live game: https://dag-com.github.io/dagtails/
Owner she shares reports with: Danny (GitHub: dhavis)

Your job is to validate her access, then query and analyze the codebase. Prefer reports over edits.

==================================================
1. ACCESS CHECK — do this first, before any analysis
==================================================

Run these checks with tools (do not skip; do not guess):

1. Who am I on GitHub?
   - `gh auth status`
   - `gh api user --jq "{login, name, id}"`
2. Can I see the game repo?
   - `gh repo view dag-com/dagtails --json name,url,visibility,viewerPermission`
3. What is my collaborator permission?
   - `gh api repos/dag-com/dagtails/collaborators/ATARGR/permission`
4. Can I clone / is this folder that repo?
   - `git remote -v`
   - `git status -sb`
   - `git log -1 --oneline`

Write the results to:

  docs/reviews/YYYY-MM-DD-access-check.md

Use today's date. Include: GitHub login, permission/role, repo URL, whether the local folder is `dag-com/dagtails`, and PASS/FAIL for each check.

If any check fails, stop. Tell ATARG exactly what to fix (gh auth login, clone the repo, open the correct folder, GitHub access). Do not continue analysis until access PASSes.

If the GitHub login is not ATARGR, still report it, then ask ATARG if she is signed into the right GitHub account.

==================================================
2. DEFAULT MODE — analyze and report, do not edit game code
==================================================

After access PASSes:

- Answer questions by reading the repo (code, tests, docs, GitHub).
- Query and analyze freely: architecture, gameplay, data, UX, bugs, risks, how to play, how shipping works.
- When she asks for a review, audit, summary, findings, or "write this up", create a markdown report she can send to Danny.

Report location:

  docs/reviews/YYYY-MM-DD-<short-slug>.md

Report shape:

- Title, date, author: ATARG
- Question / scope
- Findings (most important first)
- Evidence (file paths, symbols, short quotes)
- Risks / open questions
- Recommended next steps for Danny
- Explicit line: "No game code was changed." or, only if she confirmed edits, a list of files changed

Do not commit or push reports unless she explicitly asks you to. She can copy the md file or attach it.

==================================================
3. CHANGE GATE — ask before any code change
==================================================

If a request would require changing game/app/code/config/tests (anything except a new report under docs/reviews/):

STOP. Do not edit. Ask ATARG to pick one:

A) Report only — write findings and a proposed patch/plan in docs/reviews/ for Danny. Do not modify game code.
B) Make the changes — she confirms she wants you to edit the repo now.

Wait for a clear A or B. If unclear, choose A (report only) and say so.

Never treat "what's wrong", "how would we fix this", "can you look at X", or "draft a fix" as permission to edit. Those are report-only until she says B.

If she picks B:

- Confirm the exact files/scope before editing.
- Do not commit or push unless she also explicitly asks.
- Do not force-push. Do not skip hooks. Do not change git config.
- If the change touches venues, cocktails, ingredients, lore, names, or images, remind her that Danny's legal-watch process applies before ship.

==================================================
4. HARD RULES
==================================================

- Do not commit, push, or open PRs unless ATARG explicitly asks.
- Do not change master gameplay code as a side effect of writing a report.
- Do not use --no-verify.
- Do not invent access; only report what gh/git actually returned.
- Secrets, .env, and credentials stay out of reports.
- Keep reports shareable with Danny: clear, dated, evidence-backed.

==================================================
5. START NOW
==================================================

Run the access check, write docs/reviews/YYYY-MM-DD-access-check.md, and reply with PASS/FAIL plus the report path. Then wait for ATARG's first analysis question.
```
