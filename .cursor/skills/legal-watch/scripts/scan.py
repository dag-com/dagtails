#!/usr/bin/env python3
"""DAG Tails legal-watch scanner. Flags trademark / publicity risk in changes."""

from __future__ import annotations

import argparse
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
WATCHLIST_PATH = Path(__file__).resolve().parents[1] / "watchlist.json"
CACHE_PATH = Path(tempfile.gettempdir()) / "dagtails-legal-watch-cache.json"
CACHE_TTL_SEC = 180


def load_watchlist() -> dict[str, Any]:
    return json.loads(WATCHLIST_PATH.read_text(encoding="utf-8"))


def repo_rel(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return path.as_posix().replace("\\", "/")


def excluded(rel: str, watch: dict[str, Any]) -> bool:
    lowered = rel.lower().replace("\\", "/")
    return any(part.lower() in lowered for part in watch.get("exclude_path_parts", []))


def is_watched_surface(rel: str, watch: dict[str, Any]) -> bool:
    if excluded(rel, watch):
        return False
    lowered = rel.lower()
    ext = Path(lowered).suffix
    if ext in watch.get("image_extensions", []) or ext in watch.get("text_extensions", []):
        return True
    return any(
        lowered.endswith(name) or f"/{name}" in f"/{lowered}"
        for name in ("data.js", "index.html", "styles.css")
    )


def is_live_brand_image(rel: str, watch: dict[str, Any]) -> bool:
    lowered = rel.lower().replace("\\", "/")
    return any(part.lower() in lowered for part in watch.get("live_brand_path_parts", []))


def is_study_dump(rel: str) -> bool:
    lowered = rel.lower().replace("\\", "/")
    return lowered.startswith("mocks/") or lowered.startswith("exports/")


def compile_patterns(watch: dict[str, Any]) -> list[dict[str, Any]]:
    compiled = []
    for item in watch.get("patterns", []):
        terms = []
        for term in item.get("terms", []):
            escaped = re.escape(term)
            escaped = escaped.replace(r"\ ", r"[\s'_-]+")
            terms.append(escaped)
        if not terms:
            continue
        rx = re.compile(r"(?i)(?<![A-Za-z0-9])(?:" + "|".join(terms) + r")(?![A-Za-z0-9])")
        compiled.append({**item, "rx": rx})
    return compiled


def walk_strings(obj: Any) -> list[str]:
    out: list[str] = []
    if isinstance(obj, dict):
        for value in obj.values():
            out.extend(walk_strings(value))
    elif isinstance(obj, list):
        for value in obj:
            out.extend(walk_strings(value))
    elif isinstance(obj, str) and value_looks_useful(obj):
        out.append(obj)
    return out


def value_looks_useful(text: str) -> bool:
    if len(text) < 2 or len(text) > 200_000:
        return False
    if text.startswith("{") and '"version"' in text[:40]:
        return False
    return True


def extract_paths(payload: dict[str, Any]) -> list[Path]:
    keys = {
        "file_path",
        "filePath",
        "path",
        "target_notebook",
        "targetNotebook",
    }
    found: list[Path] = []

    def visit(obj: Any) -> None:
        if isinstance(obj, dict):
            for key, value in obj.items():
                if key in keys and isinstance(value, str) and value.strip():
                    found.append(Path(value))
                visit(value)
        elif isinstance(obj, list):
            for item in obj:
                visit(item)

    visit(payload)
    unique: list[Path] = []
    seen: set[str] = set()
    for path in found:
        key = str(path)
        if key not in seen:
            seen.add(key)
            unique.append(path)
    return unique


def added_text_from_payload(payload: dict[str, Any], _depth: int = 0) -> str:
    if _depth > 4 or not isinstance(payload, dict):
        return ""
    chunks: list[str] = []
    for key in ("new_string", "newString", "contents", "content"):
        value = payload.get(key)
        if isinstance(value, str):
            chunks.append(value)
    edits = payload.get("edits") or payload.get("diff")
    if isinstance(edits, list):
        for edit in edits:
            if isinstance(edit, dict):
                for key in ("new_string", "newString", "new_text", "added"):
                    value = edit.get(key)
                    if isinstance(value, str):
                        chunks.append(value)
    for nested_key in ("tool_input", "arguments", "input"):
        nested = payload.get(nested_key)
        if isinstance(nested, dict) and nested is not payload:
            chunks.append(added_text_from_payload(nested, _depth + 1))
    return "\n".join(chunk for chunk in chunks if chunk)


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


EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"


def outgoing_base() -> str:
    pinned = os.environ.get("LEGAL_WATCH_BASE")
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


def scan_git_diff(watch: dict[str, Any], extra_args: list[str]) -> list[dict[str, Any]]:
    compiled = compile_patterns(watch)
    known = set(watch.get("known_names", []))
    cleared = set(watch.get("cleared_keep", []))
    findings: list[dict[str, Any]] = []
    try:
        listed = git_run(["diff", "--name-status", *extra_args])
    except OSError:
        return findings
    pairs: list[tuple[str, str]] = []
    for row in listed.stdout.splitlines():
        parts = row.split("\t")
        if len(parts) >= 2:
            pairs.append((parts[0][0], parts[-1].replace("\\", "/")))
    for status, rel in pairs:
        if not is_watched_surface(rel, watch):
            continue
        # Deleting a risky file is the fix. Do not treat the old path as a ship.
        if status == "D":
            continue
        path = ROOT / rel
        ext = Path(rel).suffix.lower()
        new_file = status in {"A", "?"}
        if ext in watch.get("image_extensions", []):
            findings.extend(scan_image(rel, watch, new_file=new_file, changed=not new_file))
            continue
        added = git_added_lines(path, extra_args)
        if added:
            findings.extend(scan_text(added, rel, compiled, known, cleared=cleared))
    return dedupe(findings)


def is_untracked(path: Path) -> bool:
    rel = repo_rel(path)
    proc = subprocess.run(
        ["git", "status", "--porcelain", "--", rel],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    return proc.returncode == 0 and proc.stdout.strip().startswith("??")


NAME_RX = re.compile(
    r"""(?x)
    (?:name|sign)\s*:\s*["']([^"']{3,80})["']
    """
)


def allow_new_name_scan(rel: str) -> bool:
    name = Path(rel).name.lower()
    posix = rel.lower().replace("\\", "/")
    return name == "data.js" or posix.startswith("src/") or rel == "(edit)"


def extract_names(text: str) -> list[str]:
    return [match.group(1).strip() for match in NAME_RX.finditer(text)]


def _norm_keep_name(text: str) -> str:
    return re.sub(r"[\s'_-]+", " ", text).casefold().strip()


def scan_text(
    text: str,
    rel: str,
    compiled: list[dict[str, Any]],
    known: set[str],
    *,
    include_new_names: bool = True,
    cleared: set[str] | None = None,
) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    seen: set[str] = set()
    cleared_l = {_norm_keep_name(name) for name in (cleared or set())}
    for item in compiled:
        hit = item["rx"].search(text)
        if not hit:
            continue
        if _norm_keep_name(hit.group(0)) in cleared_l:
            continue
        key = item["id"]
        if key in seen:
            continue
        seen.add(key)
        findings.append(
            {
                "id": item["id"],
                "severity": item["severity"],
                "file": rel,
                "match": hit.group(0),
                "reason": item["reason"],
                "safer": item.get("safer", ""),
                "kind": "watchlist",
            }
        )
    if not include_new_names or not allow_new_name_scan(rel):
        return findings
    for name in extract_names(text):
        if name in known:
            continue
        key = f"new-name:{name.lower()}"
        if key in seen:
            continue
        seen.add(key)
        findings.append(
            {
                "id": "new-unreviewed-name",
                "severity": "watch",
                "file": rel,
                "match": name,
                "reason": "New venue, drink, character, or ingredient name is not in the cleared baseline.",
                "safer": "Confirm it is invented or generic. Do not use a real bar, celebrity, or house brand.",
                "kind": "new-name",
            }
        )
    return findings


def scan_image(rel: str, watch: dict[str, Any], *, new_file: bool, changed: bool) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    lowered = rel.lower()
    for term in watch.get("filename_terms", []):
        if term in lowered:
            findings.append(
                {
                    "id": f"filename:{term}",
                    "severity": "ship-stopper" if term in {"topgun", "top-gun", "maverick", "ducktales"} else "high",
                    "file": rel,
                    "match": term,
                    "reason": "Image filename matches a third-party or lookalike mark from the clearance review.",
                    "safer": "Do not ship. Replace with original art.",
                    "kind": "filename",
                }
            )
    if is_live_brand_image(rel, watch) and (new_file or changed):
        findings.append(
            {
                "id": "visual-live-brand",
                "severity": "watch",
                "file": rel,
                "match": Path(rel).name,
                "reason": "Live logo, mascot, icon, or splash changed. Visual trade-dress review is required.",
                "safer": "Inspect for DuckTales-like wordmark, Vans stripe, Ray-Ban logos, Top Gun patches, house logos.",
                "kind": "visual",
            }
        )
    elif new_file and not is_study_dump(rel) and is_live_brand_image(rel, watch):
        findings.append(
            {
                "id": "visual-new-image",
                "severity": "watch",
                "file": rel,
                "match": Path(rel).name,
                "reason": "New image added. Confirm it does not show third-party marks or lookalikes.",
                "safer": "Read the image and compare against the legal-watch visual checklist.",
                "kind": "visual",
            }
        )
    return findings


def scan_payload(payload: dict[str, Any], watch: dict[str, Any]) -> list[dict[str, Any]]:
    compiled = compile_patterns(watch)
    known = set(watch.get("known_names", []))
    cleared = set(watch.get("cleared_keep", []))
    findings: list[dict[str, Any]] = []
    added = added_text_from_payload(payload)
    paths = extract_paths(payload)
    if not paths and added:
        findings.extend(scan_text(added, "(edit)", compiled, known, cleared=cleared))
        return dedupe(findings)

    for path in paths:
        rel = repo_rel(path) if path.is_absolute() else path.as_posix()
        if not is_watched_surface(rel, watch):
            continue
        ext = Path(rel).suffix.lower()
        resolved = path if path.is_absolute() else ROOT / path
        new_file = (not resolved.exists()) or is_untracked(resolved)
        if ext in watch.get("image_extensions", []):
            findings.extend(scan_image(rel, watch, new_file=new_file, changed=True))
            continue
        text = added
        if not text:
            text = git_added_lines(resolved)
        if text is None and resolved.exists() and ext in watch.get("text_extensions", []):
            text = resolved.read_text(encoding="utf-8", errors="replace")
        if text:
            findings.extend(scan_text(text, rel, compiled, known, cleared=cleared))
    return dedupe(findings)


def scan_diff(watch: dict[str, Any]) -> list[dict[str, Any]]:
    compiled = compile_patterns(watch)
    known = set(watch.get("known_names", []))
    cleared = set(watch.get("cleared_keep", []))
    findings: list[dict[str, Any]] = []
    proc = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if proc.returncode != 0:
        return findings
    for raw in proc.stdout.splitlines():
        if len(raw) < 4:
            continue
        rel = raw[3:].strip().replace("\\", "/")
        if " -> " in rel:
            rel = rel.split(" -> ", 1)[1]
        if not is_watched_surface(rel, watch):
            continue
        path = ROOT / rel
        ext = Path(rel).suffix.lower()
        # Staged or unstaged delete (`D ` / ` D`). Removing art cannot ship the mark.
        if raw[0] == "D" or raw[1] == "D":
            continue
        new_file = raw.startswith("??") or raw[0] == "A"
        if ext in watch.get("image_extensions", []):
            findings.extend(scan_image(rel, watch, new_file=new_file, changed=not new_file))
            continue
        added = git_added_lines(path)
        if added is None:
            continue
        if added == "" and new_file and path.exists():
            added = path.read_text(encoding="utf-8", errors="replace")
        if added:
            findings.extend(scan_text(added, rel, compiled, known, cleared=cleared))
    return dedupe(findings)


def scan_paths(paths: list[Path], watch: dict[str, Any], *, whole_file: bool) -> list[dict[str, Any]]:
    compiled = compile_patterns(watch)
    known = set(watch.get("known_names", []))
    cleared = set(watch.get("cleared_keep", []))
    findings: list[dict[str, Any]] = []
    for path in paths:
        rel = repo_rel(path) if path.is_absolute() else path.as_posix()
        resolved = path if path.is_absolute() else ROOT / path
        if not resolved.exists() or not is_watched_surface(rel, watch):
            continue
        ext = Path(rel).suffix.lower()
        if ext in watch.get("image_extensions", []):
            findings.extend(scan_image(rel, watch, new_file=is_untracked(resolved), changed=True))
            continue
        if whole_file:
            text = resolved.read_text(encoding="utf-8", errors="replace")
        else:
            text = git_added_lines(resolved) or ""
        if text:
            findings.extend(
                scan_text(
                    text,
                    rel,
                    compiled,
                    known,
                    include_new_names=not whole_file,
                    cleared=cleared,
                )
            )
    return dedupe(findings)


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
        return "LEGAL WATCH: no new flags in this change."
    lines = ["LEGAL ALARM - potential trademark / publicity issue (not legal advice)."]
    for item in findings:
        lines.append(
            f"- [{item['severity'].upper()}] {item['file']}: \"{item['match']}\" - {item['reason']} Safer: {item['safer']}"
        )
    lines.append("Treat ship-stopper / high as blockers before ship. Skill: legal-watch. Agent: /legal-watch.")
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
                "Legal watch is armed for DAG Tails. After adding or changing venues, "
                "cocktails, ingredients, lore, logos, mascots, icons, or other images, "
                "treat LEGAL ALARM hook messages as blockers until reviewed. "
                "Run `python .cursor/skills/legal-watch/scripts/scan.py --diff` or invoke the legal-watch agent."
            )
        }
    if not findings:
        return {}
    alarm = format_alarm(findings)
    out: dict[str, Any] = {"additional_context": alarm, "agent_message": alarm}
    if cache_should_emit(findings) and any(item["severity"] in {"ship-stopper", "high"} for item in findings):
        out["user_message"] = (
            "Legal watch: "
            + ", ".join(f"{item['severity']} '{item['match']}' in {item['file']}" for item in findings[:4])
        )
    return out


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
                "LEGAL WATCH blocked this GitHub commit/push. "
                "Rename, quarantine, or drop the flagged additions. Do not skip the hook."
            )
        sys.exit(2)


def main() -> None:
    parser = argparse.ArgumentParser(description="Scan DAG Tails changes for legal / trademark risk.")
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
    watch = load_watchlist()

    if args.hook or args.session_start:
        try:
            payload = read_stdin_json() if not args.session_start else {}
            findings = [] if args.session_start else scan_payload(payload, watch)
            json.dump(hook_response(findings, session_start=args.session_start), sys.stdout)
        except Exception:
            json.dump({}, sys.stdout)
        return

    if args.staged:
        findings = scan_git_diff(watch, ["--cached"])
    elif args.outgoing:
        findings = scan_git_diff(watch, outgoing_diff_args())
    elif args.paths:
        findings = scan_paths([Path(item) for item in args.paths], watch, whole_file=args.full)
    else:
        findings = scan_diff(watch)
        if args.full and not findings:
            targets = [ROOT / "data.js", ROOT / "index.html"]
            findings = scan_paths(targets, watch, whole_file=True)

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
