#!/usr/bin/env python3
"""DAG Tails cyber-watch scanner. Flags secrets, auth-policy breaks, and dangerous sinks."""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

SEVERITY_RANK = {
    "ship-stopper": 0,
    "high": 1,
    "medium": 2,
    "watch": 3,
}

ROOT = Path(__file__).resolve().parents[4]
CACHE_PATH = Path(tempfile.gettempdir()) / "dagtails-cyber-watch-cache.json"
CACHE_TTL_SEC = 180
EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"

SKIP_PARTS = (
    "node_modules/",
    "www/",
    "playwright-report/",
    "test-results/",
    "ios/",
    "android/",
    "mobile/node_modules/",
    ".git/",
)

SKIP_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".map", ".lock"}

JWT_RX = re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b")
SB_SECRET_RX = re.compile(r"\bsb_secret_[A-Za-z0-9_-]+\b")
SB_PUB_RX = re.compile(r"\bsb_publishable_[A-Za-z0-9_-]+\b")
PEM_RX = re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")
GH_PAT_RX = re.compile(r"\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b")
AWS_RX = re.compile(r"\bAKIA[0-9A-Z]{16}\b")
PG_URI_RX = re.compile(r"\bpostgres(?:ql)?://[^\s\"']+:[^\s\"']+@[^\s\"']+", re.I)
SERVICE_ASSIGN_RX = re.compile(
    r"(?:SERVICE_ROLE|service_role\s*key|SUPABASE_SERVICE)[^\n]{0,80}['\"]eyJ",
    re.I,
)
DISABLE_RLS_RX = re.compile(r"\bdisable\s+row\s+level\s+security\b", re.I)
EVAL_RX = re.compile(r"\b(?:eval|new\s+Function)\s*\(")
DOC_WRITE_RX = re.compile(r"\bdocument\.write\s*\(")
PASSWORD_SIGNIN_RX = re.compile(r"\bsignInWithPassword\s*\(")
OTP_HINT_RX = re.compile(r"\b(?:signInWithOtp|verifyOtp|updateUser\s*\(\s*\{[^}]*email)\b", re.I)
IDP_RX = re.compile(
    r"""(?:from\s+['"]@(?:auth0|clerk|okta|firebase)/|require\(\s*['"](?:auth0|@clerk|firebase-admin|passport)['"])"""
)
IDP_PKG_RX = re.compile(
    r'''"(?:auth0|@auth0/|@clerk/|clerk-js|firebase-admin|passport|amazon-cognito-identity-js)"\s*:'''
)
INNER_HTML_INTERP_RX = re.compile(r"\.innerHTML\s*=\s*[`'\"].*\$\{", re.S)
DANGEROUS_HTML_RX = re.compile(r"\bdangerouslySetInnerHTML\b")
MATH_OTP_RX = re.compile(r"Math\.random\s*\([^)]*\)[^\n]{0,80}(?:otp|code|pin|token)", re.I)
CUSTOM_JWT_RX = re.compile(r"\b(?:jwt\.sign|SignJWT|jsonwebtoken)\b")
NODEMAILER_OTP_RX = re.compile(r"\bnodemailer\b", re.I)

PLACEHOLDER_HINTS = ("YOUR_", "example.com", "changeme", "redacted", "xxxxx")


def repo_rel(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return path.as_posix().replace("\\", "/")


def skipped(rel: str) -> bool:
    lowered = rel.lower().replace("\\", "/")
    if any(part in lowered for part in SKIP_PARTS):
        return True
    return Path(lowered).suffix in SKIP_SUFFIXES


def git_run(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )


def added_lines_from_diff(output: str) -> str:
    added = [
        line[1:]
        for line in output.splitlines()
        if line.startswith("+") and not line.startswith("+++")
    ]
    return "\n".join(added)


def git_added_lines(path: Path, extra_args: list[str] | None = None) -> str | None:
    rel = repo_rel(path)
    try:
        proc = git_run(["diff", "-U0", *(extra_args or []), "--", rel])
    except OSError:
        return None
    if proc.returncode != 0:
        return None
    added = added_lines_from_diff(proc.stdout)
    if added:
        return added
    porcelain = git_run(["status", "--porcelain", "--", rel])
    if porcelain.returncode == 0 and porcelain.stdout.strip().startswith("??"):
        try:
            return path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            return ""
    return ""


def outgoing_base() -> str:
    pinned = os.environ.get("CYBER_WATCH_BASE") or os.environ.get("LEGAL_WATCH_BASE")
    if pinned and set(pinned) != {"0"}:
        return pinned
    base_ref = os.environ.get("GITHUB_BASE_REF")
    if base_ref:
        return f"origin/{base_ref}"
    before = os.environ.get("GITHUB_EVENT_BEFORE") or ""
    if before and set(before) != {"0"}:
        return before
    for candidate in ("@{u}", "origin/master"):
        if git_run(["rev-parse", "--verify", candidate]).returncode == 0:
            return candidate
    return EMPTY_TREE


def outgoing_diff_args() -> list[str]:
    base = outgoing_base()
    if base == EMPTY_TREE:
        return [EMPTY_TREE, "HEAD"]
    return [f"{base}...HEAD"]


def looks_placeholder(text: str) -> bool:
    lowered = text.lower()
    return any(hint.lower() in lowered for hint in PLACEHOLDER_HINTS)


def jwt_payload(token: str) -> dict[str, Any] | None:
    parts = token.split(".")
    if len(parts) != 3:
        return None
    payload = parts[1]
    pad = "=" * (-len(payload) % 4)
    try:
        raw = base64.urlsafe_b64decode(payload + pad)
        data = json.loads(raw.decode("utf-8"))
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
        return None
    return data if isinstance(data, dict) else None


def finding(
    *,
    fid: str,
    severity: str,
    rel: str,
    match: str,
    reason: str,
    safer: str,
) -> dict[str, Any]:
    clipped = match.replace("\n", " ")
    if len(clipped) > 80:
        clipped = clipped[:77] + "..."
    return {
        "id": fid,
        "severity": severity,
        "file": rel,
        "match": clipped,
        "reason": reason,
        "safer": safer,
    }


def scan_text(text: str, rel: str) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    posix = rel.replace("\\", "/")
    is_policy_doc = (
        posix.endswith("login-policy.md")
        or posix.endswith("cyber-watch.md")
        or posix.endswith("cyber-watch.mdc")
        or posix.endswith("hooks/cyber-watch.py")
        or "/cyber-watch/" in posix
    )
    is_setup_doc = posix.endswith("SETUP-BACKEND.md") or posix.endswith("config.js")

    for token in JWT_RX.findall(text):
        if looks_placeholder(token):
            continue
        payload = jwt_payload(token)
        role = (payload or {}).get("role")
        if role == "anon":
            continue
        if role in {"service_role", "supabase_admin"} or (payload and not role):
            findings.append(
                finding(
                    fid="jwt-privileged",
                    severity="ship-stopper",
                    rel=rel,
                    match=token,
                    reason=f"Privileged JWT committed (role={role or 'unknown'}).",
                    safer="Keep only the anon/publishable key in config.js. Store service_role in a dashboard/CI secret.",
                )
            )
        elif payload is None:
            findings.append(
                finding(
                    fid="jwt-unparsed",
                    severity="high",
                    rel=rel,
                    match=token,
                    reason="JWT-like secret committed and could not be verified as the public anon key.",
                    safer="Remove it. If it is the anon key, use the project's config.js pattern.",
                )
            )

    for token in SB_SECRET_RX.findall(text):
        findings.append(
            finding(
                fid="sb-secret",
                severity="ship-stopper",
                rel=rel,
                match=token,
                reason="Supabase secret key in the tree. That bypasses RLS.",
                safer="Use the publishable/anon key in the client. Put sb_secret in a server/CI secret only.",
            )
        )

    if not is_policy_doc and PEM_RX.search(text):
        findings.append(
            finding(
                fid="private-key",
                severity="ship-stopper",
                rel=rel,
                match="-----BEGIN PRIVATE KEY-----",
                reason="Private key material in source.",
                safer="Revoke/rotate the key. Load it from a secret manager or env, never git.",
            )
        )

    for token in GH_PAT_RX.findall(text):
        findings.append(
            finding(
                fid="github-pat",
                severity="ship-stopper",
                rel=rel,
                match=token,
                reason="GitHub personal access token in source.",
                safer="Revoke it on GitHub. Use Actions secrets or gh auth.",
            )
        )

    for token in AWS_RX.findall(text):
        findings.append(
            finding(
                fid="aws-key",
                severity="ship-stopper",
                rel=rel,
                match=token,
                reason="AWS access key id in source.",
                safer="Rotate in IAM. Use env / OIDC, not git.",
            )
        )

    for token in PG_URI_RX.findall(text):
        if looks_placeholder(token) or "${{" in token:
            continue
        findings.append(
            finding(
                fid="db-uri",
                severity="ship-stopper",
                rel=rel,
                match=token,
                reason="Postgres URI with credentials in source.",
                safer="GitHub Actions secret SUPABASE_DB_URL (or local env). Never commit it.",
            )
        )

    if SERVICE_ASSIGN_RX.search(text):
        findings.append(
            finding(
                fid="service-role-assign",
                severity="ship-stopper",
                rel=rel,
                match="SERVICE_ROLE ... eyJ",
                reason="service_role key assigned in source.",
                safer="Delete it, rotate in Supabase, keep only the anon key in the client.",
            )
        )

    if not is_policy_doc and DISABLE_RLS_RX.search(text):
        findings.append(
            finding(
                fid="rls-off",
                severity="ship-stopper",
                rel=rel,
                match="disable row level security",
                reason="RLS disabled. The anon key then reads/writes everything.",
                safer="Keep RLS on. Fix the policy instead.",
            )
        )

    if not is_policy_doc and EVAL_RX.search(text):
        findings.append(
            finding(
                fid="eval",
                severity="high",
                rel=rel,
                match="eval/new Function",
                reason="Dynamic code execution is an XSS/RCE sink.",
                safer="Use explicit functions or JSON.parse. Never eval player or network strings.",
            )
        )

    if DOC_WRITE_RX.search(text):
        findings.append(
            finding(
                fid="document-write",
                severity="high",
                rel=rel,
                match="document.write",
                reason="document.write is an HTML injection sink.",
                safer="Create elements or use textContent.",
            )
        )

    if not is_policy_doc and DANGEROUS_HTML_RX.search(text):
        findings.append(
            finding(
                fid="dangerous-html",
                severity="medium",
                rel=rel,
                match="dangerouslySetInnerHTML",
                reason="React HTML injection sink. First-party static HTML is OK; player/network strings are not.",
                safer="Prefer textContent. If HTML is required, keep it a first-party constant — never names, recipes, or query params.",
            )
        )

    if INNER_HTML_INTERP_RX.search(text) and posix.split("/")[-1] in {
        "game.js",
        "backend.js",
        "HubScreen.tsx",
        "bridge.ts",
    }:
        findings.append(
            finding(
                fid="innerhtml-interp",
                severity="medium",
                rel=rel,
                match="innerHTML = `...${",
                reason="Template innerHTML can XSS if player names/recipes are interpolated.",
                safer="textContent, or escape. Never drop Community/Leaderboard fields into HTML raw.",
            )
        )

    if not is_policy_doc and PASSWORD_SIGNIN_RX.search(text) and not OTP_HINT_RX.search(text):
        findings.append(
            finding(
                fid="password-only",
                severity="high",
                rel=rel,
                match="signInWithPassword",
                reason="Password sign-in without email OTP / verifyOtp in the same file. Login policy requires email as the MFA factor.",
                safer="After password (if any), require sb.auth.signInWithOtp / verifyOtp on email before treating the session as claimed.",
            )
        )

    if not is_policy_doc and not is_setup_doc and IDP_RX.search(text):
        findings.append(
            finding(
                fid="extra-idp",
                severity="high",
                rel=rel,
                match="third-party IdP import",
                reason="New identity vendor. Policy is existing Supabase Auth only.",
                safer="Use sb.auth.signInWithOtp / updateUser({ email }). Do not add Auth0/Clerk/Firebase Auth.",
            )
        )

    if posix.endswith("package.json") and IDP_PKG_RX.search(text):
        findings.append(
            finding(
                fid="extra-idp-pkg",
                severity="high",
                rel=rel,
                match="auth IdP dependency",
                reason="New identity package. Policy is existing Supabase Auth only.",
                safer="Drop it. Email OTP is already in @supabase/supabase-js.",
            )
        )

    if not is_policy_doc and MATH_OTP_RX.search(text):
        findings.append(
            finding(
                fid="diy-otp",
                severity="ship-stopper",
                rel=rel,
                match="Math.random OTP",
                reason="Homemade one-time code. Not a CSPRNG and not the login policy.",
                safer="Call sb.auth.signInWithOtp and verifyOtp. Do not generate codes in the game.",
            )
        )

    if not is_policy_doc and CUSTOM_JWT_RX.search(text):
        findings.append(
            finding(
                fid="diy-jwt",
                severity="ship-stopper",
                rel=rel,
                match="jwt.sign / SignJWT",
                reason="Homemade JWT signing. Sessions must come from Supabase Auth.",
                safer="Use the Supabase session from signInAnonymously / signInWithOtp.",
            )
        )

    if not is_policy_doc and NODEMAILER_OTP_RX.search(text) and re.search(r"\b(otp|magic.?link|mfa)\b", text, re.I):
        findings.append(
            finding(
                fid="diy-mailer",
                severity="high",
                rel=rel,
                match="nodemailer",
                reason="Custom mailer for login codes. Email OTP must go through Supabase Auth (and its SMTP).",
                safer="Configure Auth SMTP in the Supabase dashboard / config.toml. Do not send OTPs from the app.",
            )
        )

    return findings


def scan_git_diff(extra_args: list[str]) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    try:
        listed = git_run(["diff", "--name-status", *extra_args])
    except OSError:
        return findings
    for row in listed.stdout.splitlines():
        parts = row.split("\t")
        if len(parts) < 2:
            continue
        status, rel = parts[0][0], parts[-1].replace("\\", "/")
        if status == "D" or skipped(rel):
            continue
        path = ROOT / rel
        added = git_added_lines(path, extra_args)
        if added:
            findings.extend(scan_text(added, rel))
    return dedupe(findings)


def scan_paths(paths: list[Path], *, whole_file: bool) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    for path in paths:
        if not path.exists() or path.is_dir():
            if path.is_dir():
                for child in path.rglob("*"):
                    if child.is_file():
                        findings.extend(scan_paths([child], whole_file=whole_file))
            continue
        rel = repo_rel(path)
        if skipped(rel):
            continue
        if whole_file:
            try:
                text = path.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
        else:
            text = git_added_lines(path) or ""
        if text:
            findings.extend(scan_text(text, rel))
    return dedupe(findings)


def scan_diff() -> list[dict[str, Any]]:
    findings = scan_git_diff([])
    untracked = git_run(["ls-files", "--others", "--exclude-standard"])
    if untracked.returncode == 0:
        extra: list[Path] = []
        for rel in untracked.stdout.splitlines():
            if skipped(rel):
                continue
            extra.append(ROOT / rel)
        if extra:
            findings = dedupe(findings + scan_paths(extra, whole_file=True))
    return findings


def tracked_auth_paths() -> list[Path]:
    proc = git_run(["ls-files", "backend.js", "config.js", "supabase", "src", ".github/workflows", "SETUP-BACKEND.md"])
    paths = []
    for rel in proc.stdout.splitlines():
        if skipped(rel):
            continue
        paths.append(ROOT / rel)
    return paths


def dedupe(findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[str, str, str]] = set()
    out: list[dict[str, Any]] = []
    for item in findings:
        key = (item.get("id", ""), item.get("file", ""), item.get("match", ""))
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    out.sort(key=lambda item: (SEVERITY_RANK.get(item["severity"], 9), item["file"], item["id"]))
    return out


def format_alarm(findings: list[dict[str, Any]]) -> str:
    if not findings:
        return "CYBER WATCH: no new flags in this change."
    lines = ["CYBER ALARM - security issue (not a pentest)."]
    for item in findings:
        lines.append(
            f"- [{item['severity'].upper()}] {item['file']}: \"{item['match']}\" - {item['reason']} Safer: {item['safer']}"
        )
    lines.append(
        "Treat ship-stopper / high as blockers before ship. Skill: cyber-watch. Agent: /cyber-watch."
    )
    return "\n".join(lines)


def cache_should_emit(findings: list[dict[str, Any]]) -> bool:
    if not findings:
        return False
    signature = sorted(f"{item['id']}|{item['file']}|{item['match']}" for item in findings)
    now = time.time()
    try:
        cached = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
        if cached.get("signature") == signature and now - float(cached.get("ts", 0)) < CACHE_TTL_SEC:
            return False
    except (OSError, ValueError, TypeError):
        pass
    try:
        CACHE_PATH.write_text(json.dumps({"ts": now, "signature": signature}), encoding="utf-8")
    except OSError:
        pass
    return True


def hook_response(findings: list[dict[str, Any]], *, session_start: bool = False) -> dict[str, Any]:
    if session_start:
        return {
            "additional_context": (
                "Cyber watch is armed for DAG Tails. After auth, secrets, RLS, CI, or login "
                "changes, treat CYBER ALARM hook messages as blockers until reviewed. "
                "Email OTP via existing Supabase Auth is the MFA factor. "
                "Run `python .cursor/skills/cyber-watch/scripts/scan.py --diff` or invoke the cyber-watch agent."
            )
        }
    if not findings:
        return {}
    alarm = format_alarm(findings)
    out: dict[str, Any] = {"additional_context": alarm, "agent_message": alarm}
    if cache_should_emit(findings) and any(item["severity"] in {"ship-stopper", "high"} for item in findings):
        out["user_message"] = (
            "Cyber watch: "
            + ", ".join(f"{item['severity']} '{item['match']}' in {item['file']}" for item in findings[:4])
        )
    return out


def extract_paths(payload: dict[str, Any]) -> list[Path]:
    keys = {"file_path", "filePath", "path", "target_notebook", "targetNotebook"}
    found: list[Path] = []

    def visit(obj: Any) -> None:
        if isinstance(obj, dict):
            for key, value in obj.items():
                if key in keys and isinstance(value, str) and value.strip():
                    found.append(Path(value))
                visit(value)
        elif isinstance(obj, list):
            for value in obj:
                visit(value)

    visit(payload)
    return found


def added_text_from_payload(payload: dict[str, Any], _depth: int = 0) -> str:
    if _depth > 6:
        return ""
    chunks: list[str] = []
    for key in ("new_string", "newString", "contents", "content"):
        value = payload.get(key)
        if isinstance(value, str):
            chunks.append(value)
    for nested_key in ("tool_input", "arguments", "input"):
        nested = payload.get(nested_key)
        if isinstance(nested, dict) and nested is not payload:
            chunks.append(added_text_from_payload(nested, _depth + 1))
    return "\n".join(chunk for chunk in chunks if chunk)


def scan_payload(payload: dict[str, Any]) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    paths = extract_paths(payload)
    added = added_text_from_payload(payload)
    if added and not paths:
        findings.extend(scan_text(added, "(edit)"))
    for path in paths:
        rel = repo_rel(path) if path.is_absolute() else path.as_posix().replace("\\", "/")
        if skipped(rel):
            continue
        text = added or ""
        if not text and path.exists() and path.is_file():
            try:
                text = path.read_text(encoding="utf-8", errors="replace")
            except OSError:
                text = ""
        if text:
            findings.extend(scan_text(text, rel))
    return dedupe(findings)


def read_stdin_json() -> dict[str, Any]:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def is_blocking(findings: list[dict[str, Any]], *, gate: bool) -> bool:
    if gate:
        return any(item["severity"] in {"ship-stopper", "high"} for item in findings)
    return any(item["severity"] == "ship-stopper" for item in findings)


def print_human(findings: list[dict[str, Any]], *, gate: bool = False) -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    print(format_alarm(findings))
    if is_blocking(findings, gate=gate):
        if gate:
            print(
                "CYBER WATCH blocked this GitHub commit/push. "
                "Redact, rotate, or drop the flagged additions. Do not skip the hook."
            )
        sys.exit(2)


def main() -> None:
    parser = argparse.ArgumentParser(description="Scan DAG Tails changes for secrets and auth risk.")
    parser.add_argument("--hook", action="store_true", help="Read Cursor hook JSON on stdin and write hook JSON.")
    parser.add_argument("--session-start", action="store_true")
    parser.add_argument("--diff", action="store_true", help="Scan current git working tree changes.")
    parser.add_argument("--staged", action="store_true", help="Scan staged additions only (pre-commit).")
    parser.add_argument("--outgoing", action="store_true", help="Scan additions vs upstream (pre-push / CI).")
    parser.add_argument("--gate", action="store_true", help="Exit 2 on ship-stopper or high findings.")
    parser.add_argument("--full", action="store_true", help="Scan whole files instead of added lines.")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("paths", nargs="*", help="Optional files to scan.")
    args = parser.parse_args()

    if args.hook or args.session_start:
        try:
            payload = read_stdin_json() if not args.session_start else {}
            findings = [] if args.session_start else scan_payload(payload)
            json.dump(hook_response(findings, session_start=args.session_start), sys.stdout)
        except Exception:
            json.dump({}, sys.stdout)
        return

    if args.staged:
        findings = scan_git_diff(["--cached"])
    elif args.outgoing:
        findings = scan_git_diff(outgoing_diff_args())
    elif args.paths:
        findings = scan_paths([Path(item) for item in args.paths], whole_file=True)
    elif args.full:
        findings = scan_paths(tracked_auth_paths(), whole_file=True)
    else:
        findings = scan_diff()

    if args.json:
        json.dump({"findings": findings, "count": len(findings)}, sys.stdout, indent=2)
        print()
        if is_blocking(findings, gate=args.gate):
            sys.exit(2)
        return
    print_human(findings, gate=args.gate)


if __name__ == "__main__":
    os.chdir(ROOT)
    main()
