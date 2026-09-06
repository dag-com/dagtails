#!/usr/bin/env node
/**
 * Push Magic Link + Confirm signup HTML (with {{ .Token }}) to the hosted
 * Supabase project. Does not generate OTPs or print secrets.
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/push-auth-email-templates.js
 *
 * Token: https://supabase.com/dashboard/account/tokens
 */
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const PROJECT_REF = "suhrxksuwjsfeenztvdn";
const SUBJECT = "DAG Tails code: {{ .Token }}";

function fail(message, code = 1) {
  process.stderr.write(message + "\n");
  process.exit(code);
}

function readTemplate(name) {
  const file = path.join(repoRoot, "supabase", "templates", name);
  const html = fs.readFileSync(file, "utf8");
  if (!html.includes("{{ .Token }}")) fail(name + " is missing {{ .Token }}");
  return html;
}

async function main() {
  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!token) {
    fail(
      [
        "Set SUPABASE_ACCESS_TOKEN (account token, not the anon key).",
        "Or paste supabase/templates/magic_link.html into Dashboard → Authentication → Email Templates → Magic Link,",
        "and confirmation.html into Confirm signup. Both must include {{ .Token }}.",
      ].join("\n")
    );
  }

  const body = {
    mailer_subjects_magic_link: SUBJECT,
    mailer_templates_magic_link_content: readTemplate("magic_link.html"),
    mailer_subjects_confirmation: SUBJECT,
    mailer_templates_confirmation_content: readTemplate("confirmation.html"),
  };

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`,
    {
      method: "PATCH",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    const clipped = text.replace(/sbp_[A-Za-z0-9]+/g, "sbp_[redacted]").slice(0, 400);
    fail("Auth template push failed: HTTP " + res.status + " " + clipped);
  }

  const json = await res.json();
  const magic = String(json.mailer_templates_magic_link_content || "");
  const confirm = String(json.mailer_templates_confirmation_content || "");
  const magicHasToken = magic.includes("{{ .Token }}");
  const confirmHasToken = confirm.includes("{{ .Token }}");
  process.stdout.write(
    "Hosted email templates updated for " +
      PROJECT_REF +
      ". magic_link Token=" +
      magicHasToken +
      " confirmation Token=" +
      confirmHasToken +
      "\n"
  );
  if (!magicHasToken || !confirmHasToken) {
    fail("Push returned templates still missing {{ .Token }}.");
  }
}

main().catch((err) => fail(err && err.message ? err.message : String(err)));
