#!/usr/bin/env node
/**
 * DAG Tails — services healthcheck
 *
 * Validates every remote dependency the shipped game needs, then exits
 * non-zero if anything required is down.
 *
 *   npm run healthcheck
 *   npm run healthcheck -- --json
 *   npm run healthcheck -- --pages-only
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PAGES_URL =
  process.env.DAGTAILS_PAGES_URL ||
  "https://dag-com.github.io/last-call-bartending-game/";
const TIMEOUT_MS = Number(process.env.HEALTH_TIMEOUT_MS || 12_000);

const args = new Set(process.argv.slice(2));
const asJson = args.has("--json");
const pagesOnly = args.has("--pages-only");

function readConfig() {
  const raw = fs.readFileSync(path.join(ROOT, "config.js"), "utf8");
  const url = (raw.match(/SUPABASE_URL\s*=\s*"([^"]+)"/) || [])[1] || "";
  const key = (raw.match(/SUPABASE_ANON_KEY\s*=\s*"([^"]+)"/) || [])[1] || "";
  return { url, key };
}

async function timed(fn) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    return { ok: true, latencyMs: Date.now() - t0, ...detail };
  } catch (e) {
    return {
      ok: false,
      latencyMs: Date.now() - t0,
      error: e && e.message ? e.message : String(e),
    };
  }
}

async function fetchText(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    return { res, text };
  } finally {
    clearTimeout(timer);
  }
}

function restHeaders(key, extra = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

/** @returns {Promise<Array<{id:string,service:string,required:boolean,ok:boolean,latencyMs?:number,detail?:string,error?:string,fix?:string}>>} */
async function runChecks() {
  const cfg = readConfig();
  const checks = [];

  // --- Config (local) ---
  const configured =
    cfg.url.startsWith("http") &&
    !cfg.url.includes("YOUR_") &&
    cfg.key.length > 20 &&
    !cfg.key.includes("YOUR_");
  checks.push({
    id: "config",
    service: "config.js (Supabase keys)",
    required: true,
    ok: configured,
    detail: configured ? `url=${cfg.url}` : "placeholder or missing keys",
    fix: "Paste Project URL + anon key into config.js (see SETUP-BACKEND.md)",
  });

  // --- GitHub Pages: HTML shell ---
  const pagesHtml = await timed(async () => {
    const { res, text } = await fetchText(PAGES_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const hasRawTsx = /\/src\/main\.tsx/.test(text);
    const hasHashedAsset =
      /assets\/index-[A-Za-z0-9_-]+\.(js|css)/.test(text) ||
      /type="module"[^>]+src="\.?\/?assets\//.test(text);
    if (hasRawTsx && !hasHashedAsset) {
      throw new Error("Pages is serving source HTML (needs Vite www deploy)");
    }
    if (!/DAG Tails|dag-tails|screen-splash|hub-root/i.test(text)) {
      throw new Error("HTML does not look like the DAG Tails shell");
    }
    const jsMatch = text.match(/src="(\.?\/?assets\/[^"]+\.js)"/i);
    const cssMatch = text.match(/href="(\.?\/?assets\/[^"]+\.css)"/i);
    return {
      detail: `status=${res.status}; hashed=${hasHashedAsset}`,
      jsHref: jsMatch ? jsMatch[1] : null,
      cssHref: cssMatch ? cssMatch[1] : null,
      htmlBytes: text.length,
    };
  });
  checks.push({
    id: "pages_html",
    service: "GitHub Pages (game HTML)",
    required: true,
    ok: pagesHtml.ok,
    latencyMs: pagesHtml.latencyMs,
    detail: pagesHtml.detail || undefined,
    error: pagesHtml.error,
    fix: `Open ${PAGES_URL} and confirm Actions → Deploy GitHub Pages succeeded`,
  });

  if (pagesOnly) return checks;

  // --- GitHub Pages: hashed JS/CSS ---
  if (pagesHtml.ok && (pagesHtml.jsHref || pagesHtml.cssHref)) {
    const base = PAGES_URL.endsWith("/") ? PAGES_URL : `${PAGES_URL}/`;
    for (const [kind, href] of [
      ["js", pagesHtml.jsHref],
      ["css", pagesHtml.cssHref],
    ]) {
      if (!href) continue;
      const abs = new URL(href, base).href;
      const asset = await timed(async () => {
        const { res, text } = await fetchText(abs);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (text.length < 200) throw new Error("asset body too small");
        return { detail: `${kind} ${text.length} bytes` };
      });
      checks.push({
        id: `pages_${kind}`,
        service: `GitHub Pages (bundled ${kind.toUpperCase()})`,
        required: true,
        ok: asset.ok,
        latencyMs: asset.latencyMs,
        detail: asset.detail,
        error: asset.error,
        fix: "Re-run the Pages deploy workflow so www/ assets are published",
      });
    }
  } else if (pagesHtml.ok) {
    checks.push({
      id: "pages_assets",
      service: "GitHub Pages (bundled assets)",
      required: true,
      ok: false,
      error: "Could not find hashed JS/CSS links in Pages HTML",
      fix: "Deploy the Vite www/ build via .github/workflows/deploy-pages.yml",
    });
  }

  if (!configured) {
    checks.push({
      id: "supabase_rest",
      service: "Supabase REST (players)",
      required: true,
      ok: false,
      error: "skipped — config not set",
      fix: "Fix config.js first",
    });
    return checks;
  }

  // --- Supabase REST read ---
  const restRead = await timed(async () => {
    const { res, text } = await fetchText(
      `${cfg.url}/rest/v1/players?select=id&limit=1`,
      { headers: restHeaders(cfg.key, { Prefer: "count=exact" }) }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
    return { detail: `HTTP ${res.status}` };
  });
  checks.push({
    id: "supabase_rest",
    service: "Supabase REST (players read)",
    required: true,
    ok: restRead.ok,
    latencyMs: restRead.latencyMs,
    detail: restRead.detail,
    error: restRead.error,
    fix: "Resume/create project, run supabase/schema.sql, check project is ACTIVE",
  });

  // --- Supabase analytics write ---
  const restWrite = await timed(async () => {
    const { res, text } = await fetchText(`${cfg.url}/rest/v1/events`, {
      method: "POST",
      headers: restHeaders(cfg.key, { Prefer: "return=minimal" }),
      body: JSON.stringify({
        name: "ops_healthcheck",
        props: { source: "scripts/healthcheck.js", t: Date.now() },
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
    return { detail: `HTTP ${res.status}` };
  });
  checks.push({
    id: "supabase_events",
    service: "Supabase analytics (events write)",
    required: true,
    ok: restWrite.ok,
    latencyMs: restWrite.latencyMs,
    detail: restWrite.detail,
    error: restWrite.error,
    fix: "Ensure public.events exists and events_insert RLS policy allows anon insert",
  });

  // --- Supabase anonymous auth (needed for Community / player rows) ---
  const anonAuth = await timed(async () => {
    const { res, text } = await fetchText(`${cfg.url}/auth/v1/signup`, {
      method: "POST",
      headers: restHeaders(cfg.key),
      body: JSON.stringify({ data: {} }),
    });
    // 200 = created; 422 often means provider disabled or captcha
    if (res.status === 200 || res.status === 201) {
      return { detail: `anonymous signup HTTP ${res.status}` };
    }
    let msg = text.slice(0, 160);
    try {
      const j = JSON.parse(text);
      msg = j.error_description || j.msg || j.error || msg;
    } catch (_) { /* keep */ }
    if (/anonymous/i.test(msg) || res.status === 422) {
      throw new Error(`anonymous sign-ins disabled or blocked (${res.status}: ${msg})`);
    }
    throw new Error(`HTTP ${res.status}: ${msg}`);
  });
  checks.push({
    id: "supabase_anon_auth",
    service: "Supabase Auth (anonymous sign-in)",
    required: false,
    ok: anonAuth.ok,
    latencyMs: anonAuth.latencyMs,
    detail: anonAuth.detail,
    error: anonAuth.error,
    fix: "Dashboard → Authentication → Providers → enable Anonymous sign-ins",
  });

  // --- Optional: GitHub Actions latest Pages deploy ---
  const actions = await timed(async () => {
    const { res, text } = await fetchText(
      "https://api.github.com/repos/dag-com/last-call-bartending-game/actions/workflows/deploy-pages.yml/runs?per_page=1",
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "dag-tails-healthcheck",
        },
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = JSON.parse(text);
    const run = (j.workflow_runs && j.workflow_runs[0]) || null;
    if (!run) throw new Error("no workflow runs found");
    if (run.conclusion !== "success") {
      throw new Error(`latest run ${run.status}/${run.conclusion || "n/a"}`);
    }
    return {
      detail: `run #${run.run_number} success @ ${run.updated_at}`,
    };
  });
  checks.push({
    id: "github_actions_pages",
    service: "GitHub Actions (Deploy GitHub Pages)",
    required: false,
    ok: actions.ok,
    latencyMs: actions.latencyMs,
    detail: actions.detail,
    error: actions.error,
    fix: "Check Actions tab; re-run Deploy GitHub Pages on master",
  });

  return checks;
}

function printHuman(checks) {
  const required = checks.filter((c) => c.required);
  const optional = checks.filter((c) => !c.required);
  const reqFail = required.filter((c) => !c.ok);
  const optFail = optional.filter((c) => !c.ok);

  console.log("\nDAG Tails — services healthcheck");
  console.log(`Pages: ${PAGES_URL}`);
  console.log("─".repeat(64));

  for (const c of checks) {
    const mark = c.ok ? "PASS" : c.required ? "FAIL" : "WARN";
    const ms = c.latencyMs != null ? ` ${c.latencyMs}ms` : "";
    console.log(`[${mark}] ${c.service}${ms}`);
    if (c.detail) console.log(`       ${c.detail}`);
    if (!c.ok && c.error) console.log(`       error: ${c.error}`);
    if (!c.ok && c.fix) console.log(`       fix: ${c.fix}`);
  }

  console.log("─".repeat(64));
  console.log(
    `Required: ${required.length - reqFail.length}/${required.length} ok` +
      (optFail.length ? ` · Optional warnings: ${optFail.length}` : "")
  );

  if (reqFail.length) {
    console.log("\nGame is NOT fully up. Fix required failures above.");
    return 1;
  }
  console.log("\nGame services look up.");
  return 0;
}

(async () => {
  const checks = await runChecks();
  if (asJson) {
    const requiredOk = checks.filter((c) => c.required).every((c) => c.ok);
    console.log(
      JSON.stringify(
        {
          ok: requiredOk,
          checkedAt: new Date().toISOString(),
          pagesUrl: PAGES_URL,
          checks,
        },
        null,
        2
      )
    );
    process.exit(requiredOk ? 0 : 1);
  }
  process.exit(printHuman(checks));
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
