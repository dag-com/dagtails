---
name: sync-to-github
description: >-
  Commit pending work if needed, code-review the outgoing diff, and push the
  current branch to GitHub. Use when the user says "sync to GitHub", "/sync",
  "push to GitHub", "push updates", or wants local commits published to origin.
---

# Sync to GitHub

Publish the current branch to `origin`. Prefer committing unfinished work first when the user asked to sync “updates” or “changes”.

Every `/sync-to-github` (and this skill) **must** run a **/code-review** of the outgoing change set. Follow `.cursor/commands/code-review.md`. Do not skip it. Do not auto-fix unless asked.

Every commit or push **must** pass **legal-watch** on the new additions. Do not skip it. Do not use `--no-verify`.

## Steps

1. **Inspect**
   ```bash
   git status -sb
   git log -3 --oneline
   ```
   Note branch name, ahead/behind vs `origin`, and uncommitted files.
   Collect the outgoing set: uncommitted files you will publish, plus
   `git log @{u}..HEAD` / `git diff @{u}...HEAD` (or `origin/<branch>` if no upstream).

2. **Code-review** (required)
   - Follow `.cursor/commands/code-review.md` on that outgoing set
   - Findings first, ordered by severity (bugs, regressions, security, missing tests)
   - If there is no outgoing diff, say so in one sentence instead of reviewing unrelated files
   - Do not make code changes unless the user explicitly asks

3. **Legal watch** (required before commit and before push)
   ```bash
   python .cursor/skills/legal-watch/scripts/scan.py --diff --gate
   ```
   After staging, the git `pre-commit` hook runs `--staged --gate`. Before push, `pre-push` runs `--outgoing --gate`. If either exits 2, **stop** — report the LEGAL ALARM and do not commit or push. Do not `--no-verify`.

4. **Commit if needed** (only when there are meaningful uncommitted changes and the user asked to sync those updates)
   - Follow the repo’s commit protocol: status, diff, log → stage → commit via HEREDOC/here-string
   - Do **not** commit secrets, `.env`, or throwaway screenshot dumps unless asked
   - Version-style messages match this repo (`v1.x.x - …`)
   - The pre-commit hook must be allowed to run

5. **Push**
   ```bash
   git push -u origin HEAD
   ```
   - Use `HEAD` so the current branch (e.g. `master` or a feature branch) is pushed
   - First push of a new branch needs `-u`
   - If Auto-review blocks a protected-branch push, retry with smart-mode approval

6. **Confirm**
   - Report branch, commit SHA/message, and remote URL
   - Lead with the code-review findings (or “no outgoing diff”)
   - For this project’s Pages site after `master` push:
     https://dag-com.github.io/last-call-bartending-game/

## DAG Tails specifics

- Default deploy branch: **`master`** (not `main`)
- Remote: `https://github.com/dag-com/last-call-bartending-game.git`
- `www/` is gitignored — GitHub Actions builds and deploys `www/` via `.github/workflows/deploy-pages.yml`
- After a successful `master` push (or workflow dispatch), live site:
  https://dag-com.github.io/last-call-bartending-game/
- For a full ship gate (healthcheck + watch deploy), prefer the **ship-pages** skill / **pages-shipper** agent
- Leave `experiment/*` branches unmerged unless the user asks

## Do not

- Force-push to `master` / `main` unless explicitly requested
- `git push --force` or rewrite history without explicit ask
- Update git config
- Push unrelated local branches
- Skip the code-review step
- Skip legal-watch or commit/push with `--no-verify`
