#!/usr/bin/env node
/** Copy versioned .githooks into .git/hooks so legal-watch gates commits and pushes. */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const srcDir = path.join(root, ".githooks");
let gitDir = path.join(root, ".git");

if (!fs.existsSync(gitDir)) {
  process.exit(0);
}
if (fs.statSync(gitDir).isFile()) {
  const text = fs.readFileSync(gitDir, "utf8");
  const match = text.match(/^gitdir:\s*(.+)\s*$/m);
  if (!match) process.exit(0);
  gitDir = path.resolve(root, match[1]);
}

const destDir = path.join(gitDir, "hooks");
fs.mkdirSync(destDir, { recursive: true });

for (const name of ["pre-commit", "pre-push"]) {
  const src = path.join(srcDir, name);
  const dest = path.join(destDir, name);
  if (!fs.existsSync(src)) continue;
  fs.copyFileSync(src, dest);
  try {
    fs.chmodSync(dest, 0o755);
  } catch {
    /* Windows may ignore chmod */
  }
}
