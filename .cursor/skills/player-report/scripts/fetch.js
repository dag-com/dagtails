#!/usr/bin/env node
/**
 * Pull a player-report JSON snapshot from Supabase.
 * Run: node .cursor/skills/player-report/scripts/fetch.js
 *
 * Local: uses `supabase db query --linked`.
 * CI: set SUPABASE_DB_URL (or DATABASE_URL) to the project connection URI.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const skillDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(skillDir, "..", "..", "..");
const sqlPath = path.join(skillDir, "snapshot.sql");
const outPath = path.join(skillDir, "last-snapshot.json");
const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (process.env.CI && !dbUrl) {
  process.stderr.write(
    "CI needs SUPABASE_DB_URL (Postgres URI). The anon key cannot read events.\n"
  );
  process.exit(1);
}

function quote(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Supabase CLI did not return JSON.\n" + String(text).slice(0, 800));
  }
  return JSON.parse(text.slice(start, end + 1));
}

const cmd = dbUrl
  ? `npx --yes supabase db query --db-url ${quote(dbUrl)} -f ${quote(sqlPath)} -o json`
  : `npx --yes supabase db query --linked -f ${quote(sqlPath)} -o json`;

let stdout;
try {
  stdout = execSync(cmd, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  });
} catch (err) {
  process.stderr.write((err.stderr || err.stdout || err.message || "supabase db query failed") + "\n");
  process.exit(1);
}

const wrapped = extractJson(stdout);
const row = Array.isArray(wrapped.rows) ? wrapped.rows[0] : wrapped;
if (!row || !row.report) {
  process.stderr.write("Snapshot query returned no report column.\n");
  process.exit(1);
}

const report = typeof row.report === "string" ? JSON.parse(row.report) : row.report;
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
