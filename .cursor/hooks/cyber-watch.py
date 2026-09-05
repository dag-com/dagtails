#!/usr/bin/env python3
"""Cursor hook entry: alarm on secrets / auth-policy risk after file changes."""

from __future__ import annotations

import runpy
import sys
from pathlib import Path

HOOK = Path(__file__).resolve()
ROOT = HOOK.parents[2]
SCAN = ROOT / ".cursor" / "skills" / "cyber-watch" / "scripts" / "scan.py"

if "--session-start" in sys.argv:
    sys.argv = [str(SCAN), "--hook", "--session-start"]
else:
    sys.argv = [str(SCAN), "--hook"]

try:
    runpy.run_path(str(SCAN), run_name="__main__")
except Exception:
    sys.stdout.write("{}")
