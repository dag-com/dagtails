#!/usr/bin/env node
/**
 * Invite, list, or remove DAG Tails beta testers on the linked Supabase project.
 *
 *   node .cursor/skills/create-users/scripts/invite.js add a@x.com b@y.com --note beta
 *   node .cursor/skills/create-users/scripts/invite.js list
 *   node .cursor/skills/create-users/scripts/invite.js remove a@x.com
 */
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(message, code = 1) {
  process.stderr.write(message + "\n");
  process.exit(code);
}

function sqlString(value) {
  return "'" + String(value).replace(/'/g, "''") + "'";
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let note = "beta";
  const rest = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--note") {
      note = args[i + 1] || "";
      i += 1;
      continue;
    }
    rest.push(args[i]);
  }
  let command = rest[0];
  let emails = rest.slice(1);
  if (command && EMAIL_RX.test(command.toLowerCase())) {
    emails = rest.map((item) => item.toLowerCase());
    command = "add";
  }
  if (!command) command = "list";
  return { command: command.toLowerCase(), emails: emails.map((item) => item.trim().toLowerCase()), note };
}

function validateEmails(emails) {
  if (!emails.length) fail("Pass at least one email.");
  const bad = emails.filter((item) => !EMAIL_RX.test(item));
  if (bad.length) fail("Not an email: " + bad.join(", "));
  return [...new Set(emails)];
}

function quote(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function runSql(sql) {
  const tmp = path.join(os.tmpdir(), `dagtails-users-${Date.now()}.sql`);
  fs.writeFileSync(tmp, sql, "utf8");
  const cmd = `npx --yes supabase db query --linked -f ${quote(tmp)} -o json`;
  try {
    const stdout = execSync(cmd, {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    });
    return extractRows(stdout);
  } catch (err) {
    const detail = (err.stderr || err.stdout || err.message || "supabase db query failed").trim();
    fail(detail);
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

function extractRows(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed.rows) ? parsed.rows : [];
  } catch {
    return [];
  }
}

function ensureTable() {
  const rows = runSql("select to_regclass('public.beta_testers') as id;");
  const id = rows[0] && (rows[0].id || rows[0].to_regclass);
  if (id) return;
  process.stderr.write("beta_testers missing — applying supabase/schema.sql\n");
  try {
    execSync("npx --yes supabase db query --linked -f supabase/schema.sql", {
      cwd: repoRoot,
      encoding: "utf8",
      windowsHide: true,
      stdio: "inherit",
    });
  } catch {
    fail("Could not apply schema.sql. Link the project or run it in the SQL editor.");
  }
}

function listTesters() {
  return runSql(
    "select email, coalesce(note, '') as note, created_at from public.beta_testers order by created_at;"
  );
}

function printList(rows) {
  if (!rows.length) {
    console.log("No testers yet. Add one: npm run users:add -- you@email.com");
    return;
  }
  console.log(`${rows.length} tester${rows.length === 1 ? "" : "s"}:`);
  for (const row of rows) {
    const note = row.note ? ` (${row.note})` : "";
    console.log(`- ${row.email}${note}`);
  }
}

function addTesters(emails, note) {
  const values = emails.map((email) => `(${sqlString(email)}, ${sqlString(note)})`).join(",\n  ");
  runSql(
    `insert into public.beta_testers (email, note) values\n  ${values}\n` +
      "on conflict (email) do update set note = excluded.note;"
  );
}

function removeTesters(emails) {
  const list = emails.map(sqlString).join(", ");
  return runSql(
    `delete from public.beta_testers where lower(email) in (${list}) returning email;`
  );
}

const parsed = parseArgs(process.argv);
ensureTable();

if (parsed.command === "list") {
  printList(listTesters());
} else if (parsed.command === "add") {
  const emails = validateEmails(parsed.emails);
  addTesters(emails, parsed.note || "beta");
  console.log("Invited:");
  for (const email of emails) console.log(`- ${email}`);
  console.log("They open https://dag-com.github.io/dagtails/ and enter that email for a 6-digit code.");
  printList(listTesters());
} else if (parsed.command === "remove") {
  const emails = validateEmails(parsed.emails);
  const removed = removeTesters(emails);
  const gone = new Set(removed.map((row) => String(row.email || "").toLowerCase()));
  for (const email of emails) {
    console.log(gone.has(email) ? `Removed ${email}` : `Not on the list: ${email}`);
  }
  printList(listTesters());
} else {
  fail("Usage: invite.js add|list|remove [emails...] [--note text]");
}
