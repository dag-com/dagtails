Follow the **sync-to-github** skill (`.cursor/skills/sync-to-github/SKILL.md`).

After inspect, and before push, run **/code-review** using `.cursor/commands/code-review.md` on the outgoing change set. Do not skip the review. Do not auto-fix unless asked. Include the review findings in the sync confirmation.

Before every commit or push, run legal-watch on the new additions (`python .cursor/skills/legal-watch/scripts/scan.py --diff --gate`, then let the git hooks run). If the gate fails, stop. Do not `--no-verify`.
