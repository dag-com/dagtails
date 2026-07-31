---
name: sync-to-github
description: >-
  Commit pending work if needed and push the current branch to GitHub.
  Use when the user says "sync to GitHub", "/sync", "push to GitHub",
  "push updates", or wants local commits published to origin.
---

# Sync to GitHub

Publish the current branch to `origin`. Prefer committing unfinished work first when the user asked to sync “updates” or “changes”.

## Steps

1. **Inspect**
   ```bash
   git status -sb
   git log -3 --oneline
   ```
   Note branch name, ahead/behind vs `origin`, and uncommitted files.

2. **Commit if needed** (only when there are meaningful uncommitted changes and the user asked to sync those updates)
   - Follow the repo’s commit protocol: status, diff, log → stage → commit via HEREDOC/here-string
   - Do **not** commit secrets, `.env`, or throwaway screenshot dumps unless asked
   - Version-style messages match this repo (`v1.x.x - …`)

3. **Push**
   ```bash
   git push -u origin HEAD
   ```
   - Use `HEAD` so the current branch (e.g. `master` or a feature branch) is pushed
   - First push of a new branch needs `-u`
   - If Auto-review blocks a protected-branch push, retry with smart-mode approval

4. **Confirm**
   - Report branch, commit SHA/message, and remote URL
   - For this project’s Pages site after `master` push:
     https://dag-com.github.io/last-call-bartending-game/

## DAG Tails specifics

- Default deploy branch: **`master`** (not `main`)
- Remote: `https://github.com/dag-com/last-call-bartending-game.git`
- `www/` is gitignored — no need to build before push for Pages (Pages serves repo root)
- Leave `experiment/*` branches unmerged unless the user asks

## Do not

- Force-push to `master` / `main` unless explicitly requested
- `git push --force` or rewrite history without explicit ask
- Update git config
- Push unrelated local branches
