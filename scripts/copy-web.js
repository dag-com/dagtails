// Copies the game's static web files into www/, which is what Capacitor
// packages into the native iOS/Android app shells. There's no bundler here
// on purpose (the game stays zero-build for the web) — this is just a
// plain file copy so the native `android/` and `ios/` project folders can
// stay separate from the source files at the repo root.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const out = path.join(root, "www");

const FILES = [
  "index.html",
  "styles.css",
  "config.js",
  "data.js",
  "sound.js",
  "glass.js",
  "mixology.js",
  "judges.js",
  "backend.js",
  "game.js",
];
const DIRS = ["assets"];

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const f of FILES) {
  fs.copyFileSync(path.join(root, f), path.join(out, f));
}
for (const d of DIRS) {
  copyDir(path.join(root, d), path.join(out, d));
}

console.log(`Copied ${FILES.length} files + ${DIRS.length} folder(s) to ${out}`);
