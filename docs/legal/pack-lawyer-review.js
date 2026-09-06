#!/usr/bin/env node
/**
 * Pack placeholder legal drafts for counsel. Run from repo root:
 *   node docs/legal/pack-lawyer-review.js
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const dest = path.join(__dirname, "lawyer-review.zip");
const files = [
  path.join(__dirname, "COVER-NOTE.md"),
  path.join(__dirname, "PRIVACY-NOTICE.md"),
  path.join(__dirname, "BETA-TESTER-EMAIL.md"),
  path.join(__dirname, "FONTS-NOTE.md"),
  path.join(root, "public", "legal", "privacy.html"),
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    process.stderr.write("Missing " + file + "\n");
    process.exit(1);
  }
}

if (fs.existsSync(dest)) fs.unlinkSync(dest);

if (process.platform === "win32") {
  const ps = files.map((file) => "'" + file.replace(/'/g, "''") + "'").join(", ");
  execFileSync(
    "powershell.exe",
    ["-NoProfile", "-Command", `Compress-Archive -LiteralPath @(${ps}) -DestinationPath '${dest.replace(/'/g, "''")}' -Force`],
    { stdio: "inherit" }
  );
} else {
  execFileSync("zip", ["-j", dest, ...files], { stdio: "inherit" });
}

process.stdout.write("Wrote " + dest + "\n");
