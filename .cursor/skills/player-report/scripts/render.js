#!/usr/bin/env node
/**
 * Turn last-snapshot.json into GitHub-readable markdown + dated history.
 * Run after fetch.js: node .cursor/skills/player-report/scripts/render.js
 */
const fs = require("fs");
const path = require("path");

const skillDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(skillDir, "..", "..", "..");
const snapshotPath = path.join(skillDir, "last-snapshot.json");
const outDir = path.join(repoRoot, "docs", "player-reports");
const dataDir = path.join(outDir, "data");
const siteDir = path.join(outDir, "site");
const PUBLIC_URL = "https://dag-com.github.io/dagtails/player-reports/";
const SITE_NAV = `<a href="./index.html">Latest</a><a href="./history.html">History</a><a href="./analytics.html">Spec</a>`;
const CATALOGS = require("../catalogs.js");

const VENUE_LABEL = {
  snug: "The Snug",
  zavod: "Zavod",
  cantina: "La Cantina",
  aperitivo: "Aperitivo",
  speakeasy: "Speakeasy",
  soda_fountain: "Soda fountain",
  juice_bar: "Juice bar",
  beach_shack: "Beach shack",
};

function fmt(n) {
  return Number(n || 0).toLocaleString("en-US");
}

function pct(part, whole) {
  if (!whole) return null;
  return Math.round((1000 * Number(part || 0)) / Number(whole)) / 10;
}

function pctLabel(part, whole) {
  const p = pct(part, whole);
  return p == null ? null : `${p}%`;
}

const STEP_LABEL = {
  glass: "Choosing a glass",
  method: "Picking a mix method",
  ingredients: "Pouring",
  garnish: "Adding a garnish",
  unknown: "Unknown step",
};

const REASON_LABEL = {
  quit: "Quit",
  back: "Back on the first step",
  unknown: "Unknown",
};

const FROM_LABEL = {
  map: "The map",
  station: "Mixing a drink",
  mixologist: "Mixologist",
  mix_result: "After inventing a drink",
  settings: "Settings",
  shop: "Shop",
  badges: "Badges",
  finish: "End of the crawl",
  endless: "Endless shift",
  mybar: "My bar",
  result: "After serving",
  community: "Community",
  leaderboard: "Leaderboard",
  recipes: "Recipe book",
  overlay: "Another screen",
  intro: "The intro comic",
};

function indexBy(rows, key) {
  const map = new Map();
  for (const row of rows || []) map.set(String(row[key]), row);
  return map;
}

function mergeCatalog(rows, catalog, idKey) {
  const map = indexBy(rows, idKey);
  const seen = new Set();
  const out = catalog.map((item) => {
    const id = typeof item === "string" ? item : item.id;
    const label = typeof item === "string" ? item : item.label;
    seen.add(id);
    const row = map.get(id) || {};
    return { ...row, [idKey]: id, label, n: Number(row.n || 0) };
  });
  for (const [id, row] of map) {
    if (!seen.has(id)) out.push({ ...row, [idKey]: id, label: id, n: Number(row.n || 0) });
  }
  return out;
}

function padReport(report) {
  const mix = report.mixologist || {};
  mix.verdicts = mergeCatalog(mix.verdicts, CATALOGS.JUDGE_VERDICTS, "verdict").map((v) => ({
    verdict: v.verdict,
    n: v.n || 0,
    avg_score: v.avg_score == null ? null : v.avg_score,
  }));
  mix.families = mergeCatalog(mix.families, CATALOGS.FAMILIES, "family");
  report.mixologist = mix;

  const modeMap = indexBy(report.play_modes, "mode");
  report.play_modes = CATALOGS.PLAY_MODES.map((m) => {
    const row = modeMap.get(m.id) || {};
    return {
      mode: m.id,
      label: m.label,
      started: Number(row.started || 0),
      served: Number(row.served || 0),
      abandoned: Number(row.abandoned || 0),
      people_started: Number(row.people_started || 0),
    };
  });

  const ctaMap = indexBy(report.hub_cta, "cta");
  report.hub_cta = CATALOGS.HUB_CTAS.map((c) => ({
    cta: c.id,
    label: c.label,
    n: Number(ctaMap.get(c.id)?.n || 0),
  }));

  const venueMap = indexBy(report.venues, "venue");
  report.venues = CATALOGS.VENUES.map((v) => ({
    venue: v.id,
    label: v.label,
    started: Number(venueMap.get(v.id)?.started || 0),
  }));

  const cxMap = indexBy(report.complexities, "complexity");
  report.complexities = CATALOGS.COMPLEXITIES.map((c) => ({
    complexity: c,
    started: Number(cxMap.get(c)?.started || 0),
  }));

  const starMap = indexBy(report.stars, "stars");
  report.stars = CATALOGS.STARS.map((s) => ({
    stars: s,
    n: Number(starMap.get(s)?.n || 0),
  }));

  const left = report.left_drink || {};
  const stepMap = indexBy(left.by_step, "last_step");
  left.by_step = CATALOGS.POUR_STEPS.map((s) => ({
    last_step: s,
    n: Number(stepMap.get(s)?.n || 0),
  }));
  const reasonMap = indexBy(left.by_reason, "reason");
  left.by_reason = CATALOGS.LEAVE_REASONS.map((r) => ({
    reason: r,
    n: Number(reasonMap.get(r)?.n || 0),
  }));
  report.left_drink = left;

  const menu = report.menu_return || {};
  const fromMap = indexBy(menu.by_from, "from");
  menu.by_from = CATALOGS.MENU_FROM.map((f) => {
    const row = fromMap.get(f) || {};
    return { from: f, n: Number(row.n || 0), people: Number(row.people || 0) };
  });
  report.menu_return = menu;
  return report;
}

function htmlBars(rows, labelFn, valueFn) {
  const vals = rows.map(valueFn);
  const peak = Math.max(1, ...vals);
  return `<div class="bars">${rows
    .map((row) => {
      const n = valueFn(row);
      const w = Math.round((n / peak) * 100);
      return `<div class="bar-row${n === 0 ? " is-zero" : ""}">
      <span class="bar-lab">${escapeHtml(labelFn(row))}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${n ? w : 0}%"></div></div>
      <span class="bar-n">${escapeHtml(fmt(n))}${n === 0 ? " · none" : ""}</span>
    </div>`;
    })
    .join("")}</div>`;
}

function htmlPairBars(rows, labelFn, aFn, bFn, aName, bName) {
  const peak = Math.max(1, ...rows.flatMap((row) => [aFn(row), bFn(row)]));
  const legend = `<p class="bar-legend"><span class="swatch a"></span>${escapeHtml(aName)} · <span class="swatch b"></span>${escapeHtml(bName)}</p>`;
  const body = rows
    .map((row) => {
      const a = aFn(row);
      const b = bFn(row);
      const zero = a === 0 && b === 0;
      return `<div class="bar-row bar-pair${zero ? " is-zero" : ""}">
      <span class="bar-lab">${escapeHtml(labelFn(row))}</span>
      <div class="bar-stack">
        <div class="bar-track"><div class="bar-fill" style="width:${a ? Math.round((a / peak) * 100) : 0}%"></div></div>
        <div class="bar-track"><div class="bar-fill alt" style="width:${b ? Math.round((b / peak) * 100) : 0}%"></div></div>
      </div>
      <span class="bar-n">${escapeHtml(fmt(a))} / ${escapeHtml(fmt(b))}${zero ? " · none" : ""}</span>
    </div>`;
    })
    .join("");
  return `${legend}<div class="bars">${body}</div>`;
}

function hookAndPremium(report) {
  const modes = report.play_modes || [];
  const mix = modes.find((m) => m.mode === "mixologist") || report.mixologist || {};
  const started = Number(mix.started || 0);
  const served = Number(mix.served || mix.finished || 0);
  const people = Number(mix.people_started || 0);
  const rate = started ? Math.round((100 * served) / started) : 0;
  const qaHeavy = (report.daily || []).filter((d) => d.likely_qa).reduce((s, d) => s + (d.opens || 0), 0)
    > (report.totals?.opens || 0) * 0.5;
  const unused = modes.filter((m) => !m.started && !m.served).map((m) => m.label);
  const mixIsHook = started >= 8 && rate >= 50;
  return {
    hook: mixIsHook ? "Mixologist" : "the first bar-hop drink",
    hookLine: mixIsHook
      ? `The strongest hook in this log is Mixologist: ${people ? fmt(people) : "a handful of"} people started ${fmt(started)} inventions and finished ${fmt(served)} (${rate}%). That is the only mode that looks like “make another,” not a lesson.`
      : "The log does not yet show a mode people return to on purpose. Until Mixologist (or another sandbox) is used, there is no subscription signal.",
    keepFree: "The bar-hop journey reads as the lesson, not the product to sell: almost all recorded pours are still the first Guess drink.",
    sell: mixIsHook
      ? "Analytics only — do not change the game from this. If a pass were priced later, Mixologist is the only mode this log would support (invent, extra bottles, save, another round). Endless, Cocktail of the Day, and My Bar have no start signal yet."
      : "Analytics only — do not change the game from this. Unused modes are not a paywall signal.",
    skipCharge: unused.length
      ? unused.length === 1
        ? `No demand signal for: ${unused[0]} — nobody started it.`
        : `No demand signal for: ${unused.join(", ")} — nobody started those.`
      : null,
    priceMonth: "$4.99",
    priceYear: "$29.99",
    priceLine: mixIsHook
      ? `For the record only (not a ship item): a hobby-game pass in this range would be $4.99 a month, or $29.99 a year. Shop opens in this snapshot: ${fmt(report.side_modes?.shop_open || 0)} — merch is not the subscription signal.`
      : "No price to record until a real hook shows up in the log.",
    caveat: qaHeavy
      ? "This is a first analytics read from a log that is mostly automated tests. It is not a product change. Revisit after real testers play and we can see who comes back tomorrow."
      : "This is an analytics read, not a product change. Revisit once we can see who comes back the next day.",
  };
}

function headline(report) {
  const daily = report.daily || [];
  const opens = report.totals?.opens || 0;
  const qaOpens = daily.filter((d) => d.likely_qa).reduce((s, d) => s + (d.opens || 0), 0);
  const mixFin = report.mixologist?.finished || 0;
  if (qaOpens > opens * 0.5) {
    return "Most recorded play is automated testing, not testers";
  }
  if (!report.phase1_live) {
    return "New tracking is not live yet — treat these numbers as a mix of tests and people";
  }
  if (mixFin > 0 && (report.totals?.served || 0) > 0) {
    return "People who invent a drink usually finish it";
  }
  return "Snapshot of how people opened the game and whether they served a drink";
}

function mdTable(headers, rows) {
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
  return `${head}\n${sep}\n${body}`;
}

function renderDay(report) {
  const t = report.totals || {};
  const title = headline(report);
  const qaDays = (report.daily || []).filter((d) => d.likely_qa).map((d) => d.day);
  const lines = [];
  lines.push(`<!-- headline: ${title} -->`);
  lines.push(`# How people are playing DAG Tails`);
  lines.push("");
  lines.push(`**${title}**`);
  lines.push("");
  lines.push(
    `Source: live game events · ${report.range_start} to ${report.range_end} (UTC) · pulled ${report.pulled_at}`
  );
  lines.push("");
  lines.push("## At a glance");
  lines.push("");
  lines.push(`- **Opened the game:** ${fmt(t.opens)}`);
  lines.push(`- **Finished a drink:** ${fmt(t.served)}`);
  if (report.phase1_live || (t.abandoned || 0) > 0) {
    lines.push(`- **Left without serving:** ${fmt(t.abandoned)}`);
  }
  lines.push(`- **Signed-in players:** ${fmt(t.signed_in_players)}`);
  if ((t.devices || 0) > 0) {
    lines.push(`- **Phones / browsers we can tell apart:** ${fmt(t.devices)}`);
  }
  lines.push("");
  if (qaDays.length) {
    lines.push(
      `> **Automated test days** (not real testers): ${qaDays.join(", ")}. Ignore spikes on those dates.`
    );
    lines.push("");
  }
  if (!report.phase1_live) {
    lines.push(
      "> We cannot yet see *who came back tomorrow* or *where someone quit mid-pour*. That starts after the new tracking is on the live site."
    );
    lines.push("");
  }

  const daily = report.daily || [];
  if (daily.length) {
    lines.push("## Opens over time");
    lines.push("");
    lines.push(
      mdTable(
        ["Day (UTC)", "Opened", "Started a drink", "Finished", "Note"],
        daily.map((d) => [
          d.day,
          fmt(d.opens),
          fmt(d.started),
          fmt(d.served),
          d.likely_qa ? "Automated tests" : "Quiet / possible people",
        ])
      )
    );
    lines.push("");
  }

  const stars = report.stars || [];
  lines.push("## Did they finish the drink?");
  lines.push("");
  lines.push(
    mdTable(
      ["Stars", "Drinks served"],
      stars.map((s) => [`${s.stars} stars`, fmt(s.n)])
    )
  );
  lines.push("");
  const three = stars.find((s) => String(s.stars) === "3");
  const threeN = three ? three.n : 0;
  const served = t.served || 0;
  if (served && threeN / served > 0.8) {
    lines.push(
      "Almost every served drink is 3 stars on the first teaching level. That usually means automated tests, not expert players."
    );
    lines.push("");
  }

  const playModes = report.play_modes || [];
  lines.push("## Play modes");
  lines.push("");
  lines.push("What people start, finish, and skip. Zeros mean that mode was available and nobody used it.");
  lines.push("");
  lines.push(
    mdTable(
      ["Mode", "Started", "Finished", "Left unfinished", "People"],
      playModes.map((m) => [
        m.label || m.mode,
        fmt(m.started),
        fmt(m.served),
        fmt(m.abandoned),
        fmt(m.people_started),
      ])
    )
  );
  lines.push("");
  const unusedModes = playModes.filter((m) => !m.started && !m.served);
  if (unusedModes.length) {
    lines.push(`Nobody started: ${unusedModes.map((m) => m.label).join(", ")}.`);
    lines.push("");
  }

  const venues = report.venues || [];
  lines.push("## Where they played");
  lines.push("");
  lines.push(
    mdTable(
      ["Bar", "Drinks started"],
      venues.map((v) => [v.label || VENUE_LABEL[v.venue] || v.venue, fmt(v.started)])
    )
  );
  lines.push("");

  const complexities = report.complexities || [];
  if (complexities.length) {
    lines.push("## Teaching levels");
    lines.push("");
    lines.push("Every lesson type, including unused. Zeros mean that level was available and nobody started it.");
    lines.push("");
    lines.push(
      mdTable(
        ["Teaching level", "Drinks started"],
        complexities.map((c) => [c.complexity, fmt(c.started)])
      )
    );
    lines.push("");
  }

  const recipes = (report.recipes || []).slice(0, 8);
  if (recipes.length) {
    lines.push("## Which drinks");
    lines.push("");
    lines.push(
      mdTable(
        ["Drink", "Teaching level", "Times started"],
        recipes.map((r) => [r.recipe, r.complexity, fmt(r.started)])
      )
    );
    lines.push("");
  }

  const hub = report.hub_cta || [];
  lines.push("## What they tapped on the home screen");
  lines.push("");
  if (!report.phase1_live && hub.every((h) => !h.n)) {
    lines.push("Home-button taps are not in this log yet. Every button is listed at zero so later reports can show skips. Play-mode starts above are the better signal for what they chose.");
    lines.push("");
  }
  lines.push(
    mdTable(
      ["Button", "Taps"],
      hub.map((h) => [h.label || h.cta, fmt(h.n)])
    )
  );
  lines.push("");

  const intro = report.intro || {};
  const introShown = (intro.people_started || 0) + (intro.started || 0) + (intro.skipped || 0) + (intro.finished || 0);
  lines.push("## Did they skip the intro?");
  lines.push("");
  if (!introShown) {
    lines.push("The live log does not yet include intro skip vs finish. That starts after testers play a build with the new tracking.");
    lines.push("");
  } else {
    const peoplePct = pctLabel(intro.people_skipped, intro.people_started);
    const eventDenom = (intro.skipped || 0) + (intro.finished || 0);
    const eventPct = pctLabel(intro.skipped, eventDenom);
    const firstDenom = (intro.first_run_skipped || 0) + (intro.first_run_finished || 0);
    const firstPct = pctLabel(intro.first_run_skipped, intro.first_run_started || firstDenom);
    if (peoplePct) {
      lines.push(
        `**${peoplePct}** of people who were shown the comic skipped it (${fmt(intro.people_skipped)} of ${fmt(intro.people_started)}).`
      );
    } else if (eventPct) {
      lines.push(`**${eventPct}** of intro plays were skipped (${fmt(intro.skipped)} of ${fmt(eventDenom)}).`);
    }
    lines.push("");
    lines.push(
      mdTable(
        ["What", "Count"],
        [
          ["Shown the comic", fmt(intro.started || intro.people_started)],
          ["Skipped it", fmt(intro.skipped)],
          ["Watched to the end", fmt(intro.finished)],
        ]
      )
    );
    lines.push("");
    if (firstPct && (intro.first_run_started || firstDenom)) {
      lines.push(`On a first visit (not replay from Settings): **${firstPct}** skipped.`);
      lines.push("");
    }
  }

  const left = report.left_drink || {};
  const leftN = left.n || t.abandoned || 0;
  const leftSteps = left.by_step || report.abandon_steps || [];
  const leftReasons = left.by_reason || [];
  lines.push("## Who left without serving");
  lines.push("");
  if (!leftN && !report.phase1_live) {
    lines.push("We cannot yet see where someone quit mid-pour. The table still lists every station step — all zeros until testers play the current live build.");
    lines.push("");
  } else if (!leftN) {
    lines.push("Nobody in this log left a drink without serving.");
    lines.push("");
  } else {
    const ofStarts = pctLabel(leftN, left.started || t.started);
    const ofPeople = pctLabel(left.people, left.people_started);
    if (ofStarts) {
      lines.push(`**${ofStarts}** of drinks that were started were left without serving (${fmt(leftN)} of ${fmt(left.started || t.started)}).`);
    }
    if (ofPeople) {
      lines.push(`**${ofPeople}** of people who started a drink left at least one unfinished.`);
    }
    lines.push("");
  }
  lines.push("From where in the pour:");
  lines.push("");
  lines.push(
    mdTable(
      ["Where they were", "Times left", "Share"],
      leftSteps.map((s) => [
        STEP_LABEL[s.last_step] || s.last_step,
        fmt(s.n),
        leftN ? pctLabel(s.n, leftN) || "0%" : "0%",
      ])
    )
  );
  lines.push("");
  lines.push(
    mdTable(
      ["How they left", "Times"],
      leftReasons.map((r) => [REASON_LABEL[r.reason] || r.reason, fmt(r.n)])
    )
  );
  lines.push("");

  const menu = report.menu_return || {};
  const menuFrom = menu.by_from || [];
  lines.push("## Who went back to the home screen");
  lines.push("");
  if (!(menu.n || 0)) {
    lines.push("No home-menu returns are in this log yet. Campaign Quit still goes to the map, not home. Every origin is listed at zero until that tracking is used.");
    lines.push("");
  } else {
    lines.push(`**${fmt(menu.people || 0)}** people went back to the home screen **${fmt(menu.n)}** times.`);
    lines.push("");
  }
  lines.push(
    mdTable(
      ["Came from", "Times", "People", "Share of returns"],
      menuFrom.map((row) => [
        FROM_LABEL[row.from] || row.from,
        fmt(row.n),
        fmt(row.people),
        menu.n ? pctLabel(row.n, menu.n) || "0%" : "0%",
      ])
    )
  );
  lines.push("");

  const mix = report.mixologist || {};
  lines.push("## Invented drinks");
  lines.push("");
  lines.push(`Started an invention: **${fmt(mix.started || 0)}**. Served it: **${fmt(mix.finished || 0)}**.`);
  lines.push("");
  lines.push("What the judges said (every possible panel verdict, including unused):");
  lines.push("");
  lines.push(
    mdTable(
      ["Judges said", "Drinks", "Average score"],
      (mix.verdicts || []).map((v) => [
        v.verdict,
        fmt(v.n),
        v.n && v.avg_score != null ? String(v.avg_score) : "—",
      ])
    )
  );
  lines.push("");
  if ((mix.families || []).length) {
    lines.push("Drink families they invented:");
    lines.push("");
    lines.push(
      mdTable(
        ["Family", "Drinks"],
        mix.families.map((f) => [f.family || f.label, fmt(f.n)])
      )
    );
    lines.push("");
  }

  const side = report.side_modes || {};
  lines.push("## Shop and Community");
  lines.push("");
  lines.push(
    mdTable(
      ["What", "Count"],
      [
        ["Shop opens", fmt(side.shop_open || 0)],
        ["Shared to Community", fmt(side.community_share || 0)],
      ]
    )
  );
  lines.push("");

  lines.push("## What this means");
  lines.push("");
  if (qaDays.length) {
    lines.push("- Do not brief testers from the spike days. Those are machines running the game.");
  }
  if (unusedModes.length) {
    lines.push(
      `- Nobody started: ${unusedModes.map((m) => m.label).join(", ")}. That is a skip signal, not a missing chart.`
    );
  }
  if (venues[0] && venues[0].venue === "snug" && venues[0].started > (t.started || 1) * 0.7) {
    lines.push("- Almost all recorded pours are at the first bar. We are not yet seeing the rest of the crawl.");
  }
  if ((mix.finished || 0) > 0) {
    lines.push("- When someone reaches Mixologist, they usually finish the drink. That is the strongest “they wanted another round” signal here.");
  }
  if (!report.phase1_live) {
    lines.push("- After the live site has the new tracking, this report will show who came back the next day and where people quit.");
  }
  lines.push("");

  const reco = hookAndPremium(report);
  lines.push("## What hooked them (analytics only)");
  lines.push("");
  lines.push("This section is a read of the log. It is not a change to ship.");
  lines.push("");
  lines.push(reco.hookLine);
  lines.push("");
  lines.push(reco.keepFree);
  lines.push("");
  lines.push(reco.sell);
  lines.push("");
  if (reco.skipCharge) {
    lines.push(reco.skipCharge);
    lines.push("");
  }
  lines.push(reco.priceLine);
  lines.push("");
  lines.push(reco.caveat);
  lines.push("");
  lines.push("See the [full history](./README.md).");
  lines.push("");
  return { title, markdown: lines.join("\n") };
}

function listHistory() {
  if (!fs.existsSync(outDir)) return [];
  return fs
    .readdirSync(outDir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort()
    .reverse()
    .map((f) => {
      const date = f.replace(/\.md$/, "");
      const body = fs.readFileSync(path.join(outDir, f), "utf8");
      const m = body.match(/<!-- headline: (.*) -->/);
      return { date, file: f, headline: (m && m[1]) || "Snapshot" };
    });
}

function renderIndex(history, latestDate) {
  const rows = history.map((h) => [`[${h.date}](./${h.file})`, h.headline]);
  const latestLine = latestDate
    ? `**Latest:** [${latestDate}](./${latestDate}.md) · also [latest.md](./latest.md)`
    : "";
  return [
    "# Player reports",
    "",
    "Plain-language snapshots of how people play DAG Tails. Updated daily by GitHub Actions, and whenever the player-report agent runs.",
    "",
    `**Reviewer URL** (no GitHub login): [${PUBLIC_URL}](${PUBLIC_URL})`,
    "",
    `**Tracking spec** (what we log, not today’s numbers): [analytics.md](./analytics.md) · public page [analytics.html](${PUBLIC_URL}analytics.html)`,
    "",
    latestLine,
    "",
    "## History",
    "",
    rows.length ? mdTable(["Date (UTC)", "Headline"], rows) : "_No snapshots yet._",
    "",
    "These pages do not include player names, ages, or emails.",
    "",
    "Maintainers: [how the daily Action is wired](./SETUP.md).",
    "",
  ].join("\n");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlTable(headers, rows) {
  const head = `<tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>`;
  const body = rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("");
  return `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

function htmlPage({ title, heading, nav, body, canonical }) {
  const canon = canonical || PUBLIC_URL;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <link rel="canonical" href="${escapeHtml(canon)}" />
  <style>
    :root { color-scheme: light dark; }
    body {
      font-family: Georgia, "Times New Roman", serif;
      line-height: 1.45;
      max-width: 44rem;
      margin: 0 auto;
      padding: 1.5rem 1.25rem 3rem;
      color: #1c1410;
      background: #f6f1ea;
    }
    @media (prefers-color-scheme: dark) {
      body { color: #f3ece4; background: #16110e; }
      a { color: #e8c38a; }
      th, td { border-color: #3a3028; }
      aside { background: #2a211c; }
    }
    a { color: #6b3a12; }
    header nav { font-family: system-ui, sans-serif; font-size: 0.9rem; margin-bottom: 1.25rem; }
    header nav a { margin-right: 1rem; }
    h1 { font-size: 1.7rem; margin: 0 0 0.4rem; }
    h2 { font-size: 1.15rem; margin: 1.6rem 0 0.5rem; }
    h3 { font-size: 1rem; margin: 1.2rem 0 0.4rem; }
    .lede { font-size: 1.05rem; }
    .meta, .foot { font-family: system-ui, sans-serif; font-size: 0.85rem; opacity: 0.8; }
    ul { padding-left: 1.2rem; }
    table { border-collapse: collapse; width: 100%; font-family: system-ui, sans-serif; font-size: 0.92rem; }
    th, td { text-align: left; padding: 0.4rem 0.5rem; border-bottom: 1px solid #d9cfc4; }
    th { font-weight: 600; }
    aside {
      background: #efe2d2;
      padding: 0.75rem 1rem;
      margin: 1rem 0;
    }
    .bars { margin: 0.6rem 0 1.1rem; }
    .bar-row { display: flex; align-items: center; gap: 0.55rem; margin: 0.28rem 0; font-family: system-ui, sans-serif; font-size: 0.85rem; }
    .bar-lab { flex: 0 0 10rem; }
    .bar-track { flex: 1; height: 0.65rem; background: #e4d9cc; }
    .bar-fill { height: 100%; background: #6b3a12; }
    .bar-fill.alt { background: #a67c52; }
    .bar-n { flex: 0 0 6.4rem; text-align: right; opacity: 0.85; }
    .bar-row.is-zero .bar-lab, .bar-row.is-zero .bar-n { opacity: 0.55; }
    .bar-row.is-zero .bar-track { background: #eee8e1; outline: 1px dashed #cbbfb2; }
    .bar-stack { flex: 1; display: flex; flex-direction: column; gap: 0.18rem; }
    .bar-pair .bar-track { flex: none; }
    .bar-legend { font-family: system-ui, sans-serif; font-size: 0.8rem; opacity: 0.85; margin: 0.2rem 0 0.4rem; }
    .swatch { display: inline-block; width: 0.7rem; height: 0.55rem; margin: 0 0.25rem 0 0.1rem; vertical-align: middle; background: #6b3a12; }
    .swatch.b { background: #a67c52; }
    .foot { margin-top: 2rem; }
  </style>
</head>
<body>
  <header>
    <nav>${nav}</nav>
    <p class="meta">DAG Tails · player report</p>
    <h1>${escapeHtml(heading)}</h1>
  </header>
  ${body}
  <p class="foot">No player names, ages, or emails. Share this link with reviewers: ${escapeHtml(PUBLIC_URL)}</p>
</body>
</html>
`;
}

function renderDayHtml(report, history, day) {
  const t = report.totals || {};
  const title = headline(report);
  const qaDays = (report.daily || []).filter((d) => d.likely_qa).map((d) => d.day);
  const parts = [];
  parts.push(`<p class="lede"><strong>${escapeHtml(title)}</strong></p>`);
  parts.push(
    `<p class="meta">Live game events · ${escapeHtml(report.range_start)} to ${escapeHtml(report.range_end)} (UTC) · pulled ${escapeHtml(report.pulled_at)}</p>`
  );
  parts.push("<h2>At a glance</h2><ul>");
  parts.push(`<li><strong>Opened the game:</strong> ${escapeHtml(fmt(t.opens))}</li>`);
  parts.push(`<li><strong>Finished a drink:</strong> ${escapeHtml(fmt(t.served))}</li>`);
  if (report.phase1_live || (t.abandoned || 0) > 0) {
    parts.push(`<li><strong>Left without serving:</strong> ${escapeHtml(fmt(t.abandoned))}</li>`);
  }
  parts.push(`<li><strong>Signed-in players:</strong> ${escapeHtml(fmt(t.signed_in_players))}</li>`);
  if ((t.devices || 0) > 0) {
    parts.push(`<li><strong>Phones / browsers we can tell apart:</strong> ${escapeHtml(fmt(t.devices))}</li>`);
  }
  parts.push("</ul>");
  if (qaDays.length) {
    parts.push(
      `<aside><strong>Automated test days</strong> (not real testers): ${escapeHtml(qaDays.join(", "))}. Ignore spikes on those dates.</aside>`
    );
  }
  if (!report.phase1_live) {
    parts.push(
      "<aside>We cannot yet see who came back tomorrow or where someone quit mid-pour. That starts after the new tracking is on the live site.</aside>"
    );
  }
  const daily = report.daily || [];
  if (daily.length) {
    parts.push("<h2>Opens over time</h2>");
    parts.push(
      htmlTable(
        ["Day (UTC)", "Opened", "Started a drink", "Finished", "Note"],
        daily.map((d) => [
          escapeHtml(d.day),
          escapeHtml(fmt(d.opens)),
          escapeHtml(fmt(d.started)),
          escapeHtml(fmt(d.served)),
          d.likely_qa ? "Automated tests" : "Quiet / possible people",
        ])
      )
    );
  }
  const stars = report.stars || [];
  parts.push("<h2>Did they finish the drink?</h2>");
  parts.push(htmlBars(stars, (s) => `${s.stars} stars`, (s) => s.n || 0));
  parts.push(
    htmlTable(
      ["Stars", "Drinks served"],
      stars.map((s) => [`${escapeHtml(s.stars)} stars`, escapeHtml(fmt(s.n))])
    )
  );
  {
    const three = stars.find((s) => String(s.stars) === "3");
    const threeN = three ? three.n : 0;
    const served = t.served || 0;
    if (served && threeN / served > 0.8) {
      parts.push(
        "<p>Almost every served drink is 3 stars on the first teaching level. That usually means automated tests, not expert players.</p>"
      );
    }
  }

  const playModes = report.play_modes || [];
  parts.push("<h2>Play modes</h2>");
  parts.push("<p>What people start versus finish. A dashed empty bar means the mode was available and nobody used it.</p>");
  parts.push(
    htmlPairBars(
      playModes,
      (m) => m.label || m.mode,
      (m) => m.started || 0,
      (m) => m.served || 0,
      "Started",
      "Finished"
    )
  );
  parts.push(
    htmlTable(
      ["Mode", "Started", "Finished", "Left unfinished", "People"],
      playModes.map((m) => [
        escapeHtml(m.label || m.mode),
        escapeHtml(fmt(m.started)),
        escapeHtml(fmt(m.served)),
        escapeHtml(fmt(m.abandoned)),
        escapeHtml(fmt(m.people_started)),
      ])
    )
  );
  const unusedModes = playModes.filter((m) => !m.started && !m.served);
  if (unusedModes.length) {
    parts.push(`<p>Nobody started: ${escapeHtml(unusedModes.map((m) => m.label).join(", "))}.</p>`);
  }

  const venues = report.venues || [];
  parts.push("<h2>Where they played</h2>");
  parts.push(htmlBars(venues, (v) => v.label || VENUE_LABEL[v.venue] || v.venue, (v) => v.started || 0));
  parts.push(
    htmlTable(
      ["Bar", "Drinks started"],
      venues.map((v) => [escapeHtml(v.label || VENUE_LABEL[v.venue] || v.venue), escapeHtml(fmt(v.started))])
    )
  );
  const complexities = report.complexities || [];
  if (complexities.length) {
    parts.push("<h2>Teaching levels</h2>");
    parts.push("<p>Every lesson type, including unused. A dashed empty bar means that level was available and nobody started it.</p>");
    parts.push(htmlBars(complexities, (c) => c.complexity, (c) => c.started || 0));
  }
  const recipes = (report.recipes || []).slice(0, 8);
  if (recipes.length) {
    parts.push("<h2>Which drinks</h2>");
    parts.push(
      htmlTable(
        ["Drink", "Teaching level", "Times started"],
        recipes.map((r) => [escapeHtml(r.recipe), escapeHtml(r.complexity), escapeHtml(fmt(r.started))])
      )
    );
  }
  const hub = report.hub_cta || [];
  parts.push("<h2>What they tapped on the home screen</h2>");
  if (!report.phase1_live && hub.every((h) => !h.n)) {
    parts.push("<p>Home-button taps are not in this log yet. Every button is listed at zero so later reports can show skips. Play-mode starts above are the better signal for what they chose.</p>");
  }
  parts.push(htmlBars(hub, (h) => h.label || h.cta, (h) => h.n || 0));
  parts.push(htmlTable(["Button", "Taps"], hub.map((h) => [escapeHtml(h.label || h.cta), escapeHtml(fmt(h.n))])));

  const intro = report.intro || {};
  const introShown = (intro.people_started || 0) + (intro.started || 0) + (intro.skipped || 0) + (intro.finished || 0);
  parts.push("<h2>Did they skip the intro?</h2>");
  if (!introShown) {
    parts.push("<p>The live log does not yet include intro skip vs finish. That starts after testers play a build with the new tracking.</p>");
  } else {
    const peoplePct = pctLabel(intro.people_skipped, intro.people_started);
    const eventDenom = (intro.skipped || 0) + (intro.finished || 0);
    const eventPct = pctLabel(intro.skipped, eventDenom);
    const firstDenom = (intro.first_run_skipped || 0) + (intro.first_run_finished || 0);
    const firstPct = pctLabel(intro.first_run_skipped, intro.first_run_started || firstDenom);
    if (peoplePct) {
      parts.push(
        `<p><strong>${escapeHtml(peoplePct)}</strong> of people who were shown the comic skipped it (${escapeHtml(fmt(intro.people_skipped))} of ${escapeHtml(fmt(intro.people_started))}).</p>`
      );
    } else if (eventPct) {
      parts.push(
        `<p><strong>${escapeHtml(eventPct)}</strong> of intro plays were skipped (${escapeHtml(fmt(intro.skipped))} of ${escapeHtml(fmt(eventDenom))}).</p>`
      );
    }
    parts.push(
      htmlTable(
        ["What", "Count"],
        [
          ["Shown the comic", escapeHtml(fmt(intro.started || intro.people_started))],
          ["Skipped it", escapeHtml(fmt(intro.skipped))],
          ["Watched to the end", escapeHtml(fmt(intro.finished))],
        ]
      )
    );
    if (firstPct && (intro.first_run_started || firstDenom)) {
      parts.push(`<p>On a first visit (not replay from Settings): <strong>${escapeHtml(firstPct)}</strong> skipped.</p>`);
    }
  }

  const left = report.left_drink || {};
  const leftN = left.n || t.abandoned || 0;
  const leftSteps = left.by_step || report.abandon_steps || [];
  const leftReasons = left.by_reason || [];
  parts.push("<h2>Who left without serving</h2>");
  if (!leftN && !report.phase1_live) {
    parts.push("<p>We cannot yet see where someone quit mid-pour. Every station step is listed at zero until testers play the current live build.</p>");
  } else if (!leftN) {
    parts.push("<p>Nobody in this log left a drink without serving.</p>");
  } else {
    const ofStarts = pctLabel(leftN, left.started || t.started);
    const ofPeople = pctLabel(left.people, left.people_started);
    if (ofStarts) {
      parts.push(
        `<p><strong>${escapeHtml(ofStarts)}</strong> of drinks that were started were left without serving (${escapeHtml(fmt(leftN))} of ${escapeHtml(fmt(left.started || t.started))}).</p>`
      );
    }
    if (ofPeople) {
      parts.push(
        `<p><strong>${escapeHtml(ofPeople)}</strong> of people who started a drink left at least one unfinished.</p>`
      );
    }
  }
  parts.push("<p>From where in the pour:</p>");
  parts.push(htmlBars(leftSteps, (s) => STEP_LABEL[s.last_step] || s.last_step, (s) => s.n || 0));
  parts.push(
    htmlTable(
      ["How they left", "Times"],
      leftReasons.map((r) => [escapeHtml(REASON_LABEL[r.reason] || r.reason), escapeHtml(fmt(r.n))])
    )
  );

  const menu = report.menu_return || {};
  const menuFrom = menu.by_from || [];
  parts.push("<h2>Who went back to the home screen</h2>");
  if (!(menu.n || 0)) {
    parts.push("<p>No home-menu returns are in this log yet. Every origin is listed at zero. Campaign Quit still goes to the map, not home.</p>");
  } else {
    parts.push(
      `<p><strong>${escapeHtml(fmt(menu.people || 0))}</strong> people went back to the home screen <strong>${escapeHtml(fmt(menu.n))}</strong> times.</p>`
    );
  }
  parts.push(htmlBars(menuFrom, (row) => FROM_LABEL[row.from] || row.from, (row) => row.n || 0));

  const mix = report.mixologist || {};
  parts.push("<h2>Invented drinks</h2>");
  parts.push(
    `<p>Started an invention: <strong>${escapeHtml(fmt(mix.started || 0))}</strong>. Served it: <strong>${escapeHtml(fmt(mix.finished || 0))}</strong>.</p>`
  );
  parts.push("<p>What the judges said (every possible panel verdict, including unused):</p>");
  parts.push(htmlBars(mix.verdicts || [], (v) => v.verdict, (v) => v.n || 0));
  parts.push(
    htmlTable(
      ["Judges said", "Drinks", "Average score"],
      (mix.verdicts || []).map((v) => [
        escapeHtml(v.verdict),
        escapeHtml(fmt(v.n)),
        v.n && v.avg_score != null ? escapeHtml(String(v.avg_score)) : "—",
      ])
    )
  );
  if ((mix.families || []).length) {
    parts.push("<p>Drink families they invented:</p>");
    parts.push(htmlBars(mix.families, (f) => f.family || f.label, (f) => f.n || 0));
  }
  const side = report.side_modes || {};
  parts.push("<h2>Shop and Community</h2>");
  parts.push(
    htmlTable(
      ["What", "Count"],
      [
        ["Shop opens", escapeHtml(fmt(side.shop_open || 0))],
        ["Shared to Community", escapeHtml(fmt(side.community_share || 0))],
      ]
    )
  );
  parts.push("<h2>What this means</h2><ul>");
  if (qaDays.length) {
    parts.push("<li>Do not brief testers from the spike days. Those are machines running the game.</li>");
  }
  if (unusedModes.length) {
    parts.push(
      `<li>Nobody started: ${escapeHtml(unusedModes.map((m) => m.label).join(", "))}. That is a skip signal, not a missing chart.</li>`
    );
  }
  if (venues[0] && venues[0].venue === "snug" && venues[0].started > (t.started || 1) * 0.7) {
    parts.push("<li>Almost all recorded pours are at the first bar. We are not yet seeing the rest of the crawl.</li>");
  }
  if ((mix.finished || 0) > 0) {
    parts.push("<li>When someone reaches Mixologist, they usually finish the drink. That is the strongest “they wanted another round” signal here.</li>");
  }
  if (!report.phase1_live) {
    parts.push("<li>After the live site has the new tracking, this report will show who came back the next day and where people quit.</li>");
  }
  parts.push("</ul>");
  const reco = hookAndPremium(report);
  parts.push("<h2>What hooked them (analytics only)</h2>");
  parts.push("<p>This section is a read of the log. It is not a change to ship.</p>");
  parts.push(`<p>${escapeHtml(reco.hookLine)}</p>`);
  parts.push(`<p>${escapeHtml(reco.keepFree)}</p>`);
  parts.push(`<p>${escapeHtml(reco.sell)}</p>`);
  if (reco.skipCharge) parts.push(`<p>${escapeHtml(reco.skipCharge)}</p>`);
  parts.push(`<aside><strong>Recorded range only (not a ship item):</strong> ${escapeHtml(reco.priceMonth)} / month or ${escapeHtml(reco.priceYear)} / year. ${escapeHtml(reco.caveat)}</aside>`);
  if (history.length) {
    parts.push("<h2>History</h2>");
    parts.push(
      htmlTable(
        ["Date (UTC)", "Headline"],
        history.map((h) => [
          `<a href="./${escapeHtml(h.date)}.html">${escapeHtml(h.date)}</a>`,
          escapeHtml(h.headline),
        ])
      )
    );
  }
  const nav = SITE_NAV;
  return htmlPage({
    title: `How people are playing DAG Tails · ${day}`,
    heading: "How people are playing DAG Tails",
    nav,
    body: parts.join("\n"),
  });
}

function renderHistoryHtml(history, latestDate) {
  const rows = history.map((h) => [
    `<a href="./${escapeHtml(h.date)}.html">${escapeHtml(h.date)}</a>`,
    escapeHtml(h.headline),
  ]);
  const body = [
    latestDate
      ? `<p class="lede">Latest snapshot: <a href="./index.html">${escapeHtml(latestDate)}</a></p>`
      : "",
    "<h2>History</h2>",
    rows.length ? htmlTable(["Date (UTC)", "Headline"], rows) : "<p>No snapshots yet.</p>",
  ].join("\n");
  return htmlPage({
    title: "DAG Tails player reports · history",
    heading: "Player reports",
    nav: SITE_NAV,
    body,
  });
}

function renderAnalyticsMarkdown() {
  return [
    "# DAG Tails analytics spec",
    "",
    "What we log, why, and what we do not log. This is the tracking spec — not today’s player numbers. Live snapshots: [latest.md](./latest.md).",
    "",
    "Public page (no GitHub login): [analytics.html](./site/analytics.html) on Pages as [player-reports/analytics.html](https://dag-com.github.io/dagtails/player-reports/analytics.html).",
    "",
    "Stage: pre-monetization bartender sim for testers (web, Expo, Capacitor). North star: **first drink served** and **came back the next day**. Shop checkout is a demo — demand, not revenue.",
    "",
    "## Keep the current pipe",
    "",
    "Events go through `track()` in the game, a local debug log, and write-only `public.events` in Supabase. Do not buy Amplitude or Mixpanel yet. Identity, session, and the first-session funnel come first. Graduate to PostHog when you want UI funnels without SQL, or when daily players pass a couple of hundred.",
    "",
    "## North-star pair",
    "",
    "- **D0 first-serve** — share of new sessions that finish and serve a drink (the aha moment).",
    "- **D1 return** — share of those people who open the game the next calendar day.",
    "",
    "Supporting: time to first serve, started vs served vs left unfinished, 3-star rate by teaching level, mode mix after unlock, which bar loses people.",
    "",
    "## Casual-mobile sanity checks",
    "",
    "Planning bands, not live DAG Tails traffic. Use them to decide if a number is broken vs normal for this stage.",
    "",
    "| Check | Floor (investigate) | Healthy target |",
    "| --- | --- | --- |",
    "| Came back next day | 25% | 40% |",
    "| Came back in a week | 8% | 15% |",
    "| Came back in a month | 3% | 6% |",
    "| Typical session | — | 4–8 minutes |",
    "| First-session complete | — | 70%+ reach a served drink |",
    "",
    "Endless and Mixologist unlock after 5 cleared journey drinks. If people leave at 3–4, they never see the long-term loop.",
    "",
    "## Predicted leak points",
    "",
    "| Leak | Why it matters | Event that proves it |",
    "| --- | --- | --- |",
    "| Profile gate | Name + age before any pour | app_open → profile_created |",
    "| Intro comic | Story before the loop | intro_start / skip / complete |",
    "| Map after first home tap | Highest-friction surface | hub_cta=journey → map_view → stage_started |",
    "| Mid-pour quit | Skill wall on a phone | drink_abandoned vs stage_result |",
    "| Teaching ramp | Guess → Pour → Mix → Garnish → Full bar | stage_result.complexity + stars |",
    "| Unlock at 5 clears | Sandbox modes hide until then | stage_result.stage + mixologist_started |",
    "",
    "## First-session funnel",
    "",
    "One chain. Conversion is count(step n+1) / count(step n) among the same phone/browser on day 0.",
    "",
    "| Step | In the game? | Question it answers |",
    "| --- | --- | --- |",
    "| app_open | Yes | Did the build boot? |",
    "| splash_continue | Yes | Did they leave on the title card? |",
    "| profile_created | Yes | Did the age gate kill the session? |",
    "| intro_complete | Yes | Did the comic stall them? |",
    "| hub_view | Yes | Did they reach the home screen? |",
    "| map_view | Yes | Did Journey actually open the map? |",
    "| stage_started | Yes | Did they enter the station? |",
    "| stage_result | Yes | Did they finish a drink? |",
    "",
    "Phase 1 events are in the game. The live report still shows zeros until testers play the current build (that tracking is not in older logs).",
    "",
    "## Event catalog — already shipping",
    "",
    "Keep these names. Enrich properties; do not rename unless you also dual-write for a week.",
    "",
    "| Event | When | Add to props | Used for |",
    "| --- | --- | --- | --- |",
    "| app_open | Boot | platform, build, device_id, viewport | Who opened, who came back |",
    "| profile_modal_open | Create / edit | mode | Gate drop |",
    "| profile_created | Save new profile | underage, units — never name/age | Age-gate split |",
    "| profile_updated | Save edit | underage, units | Settings churn |",
    "| stage_started | Enter station | mode, recipe_id, venue_id, complexity, stage | Loop start |",
    "| stage_result | Serve | duration_ms, stars, pct, pour ok/near/miss, which skill failed | Quality, aha |",
    "| training_started | Hub Learn | — | Mode discovery |",
    "| endless_started | Hub Endless | cleared_at_unlock | After unlock |",
    "| mixologist_started | Hub Mix | cleared_at_unlock | After unlock |",
    "| mixologist_result | Invent + serve | score, verdict, family, classic — not player drink name | Sandbox quality |",
    "| shop_open | Open shop | source_screen, recipe_id | Demand |",
    "| shop_checkout | Demo pay | item_ids, total (intent only) | Would-buy |",
    "| community_share | Share invention | score, family — not display name | Sharing |",
    "",
    "## Event catalog — Phase 1 (in the game now)",
    "",
    "One event per player intent. Mechanics detail sits on serve / left-unfinished, not on every tap.",
    "",
    "| Event | Fire when | Key props | Decision it unlocks |",
    "| --- | --- | --- | --- |",
    "| session_start | New session (or 30 min background) | session_n, returning, streak, cleared | Sessions |",
    "| session_end | Hide / 30 min idle | duration_ms, drinks_served, last_screen | Session length |",
    "| splash_continue | Enter tap on splash | returning | Title drop-off |",
    "| intro_start | Comic opens | source: first_run or settings | Story cost |",
    "| intro_skip | Skip / close early | panel_index | Is the comic a leak? |",
    "| intro_complete | Last panel done | panels | Story finish |",
    "| hub_view | Home becomes active | cleared, unlocked_modes | Home reach |",
    "| hub_cta | Any home button | cta: journey, mix, endless, training, cotd, badges, help, settings, profile | What they tap |",
    "| map_view | Map shown | venue_id, frontier | Map friction |",
    "| map_drink_tap | Path node | recipe_id, venue_id, locked | Replay vs frontier |",
    "| drink_abandoned | Leave station without serve | last_step, reason, duration_ms, mode, recipe_id | Station leak |",
    "| menu_return | Back to the home screen | from, mode | Where they left |",
    "| cotd_started | Cocktail of the Day load | recipe_id, already_done_today | Daily hook |",
    "| training_complete | Training result | stars, duration_ms | Did Learn work? |",
    "| endless_over | 0 lives or quit | served, best_streak, score | Shift length |",
    "",
    "## Event catalog — Phase 2 (later)",
    "",
    "Add only once Phase 1 answers the north-star questions.",
    "",
    "| Event | Why later |",
    "| --- | --- |",
    "| complexity_tier_enter | You can derive this from stage number |",
    "| venue_complete | Confirms which bar is the wall |",
    "| modes_unlocked | Fired once at 5 clears |",
    "| badge_unlock | Too rare to be a north star |",
    "| ticket_flip | Are people reading the recipe? |",
    "| result_cta | Retry vs Next vs Shop vs Quit after judges |",
    "| community_view | Feed opened. Always split by underage |",
    "| community_like | Sharing health |",
    "| leaderboard_view | Vanity vs return |",
    "| shop_add_item | Which catalog rows get tapped |",
    "| boot_ready | First-session length is lying if boot is 8s |",
    "| rotate_lock_shown | Portrait gate |",
    "| client_error | name + message_hash only. Never stack traces with player input |",
    "",
    "## Do not log",
    "",
    "| Tempting event | Why skip |",
    "| --- | --- |",
    "| Every millilitre of a pour | Radio killer. Fold accuracy into served (ok / near / miss) |",
    "| Every Back / Next step | Left-without-serving.last_step is enough until the station is the proven leak |",
    "| Player name, location, exact age | Analytics only needs underage true/false |",
    "| Mixologist display names | User-typed. Use classic / score / verdict / family |",
    "",
    "## How to log",
    "",
    "Three IDs on every event: **device_id** (once in local storage — how D1 works for anonymous testers), **session_id** (reset after 30 minutes in background), **player_id** (signed-in uid, optional).",
    "",
    "Super-properties attached in `track()`, not by hand: device_id, session_id, platform (web / ios / android), build, underage, units, returning, viewport, pointer (coarse / fine). Split every dashboard by platform and underage.",
    "",
    "Age gate is a legal line: log `underage` only. Do not log exact age, date of birth, or the typed name. Community events stay off for under-18 in analytics the same way the button is hidden.",
    "",
    "Rules: verb + object, snake_case; one event per intent, details in props; stable ids (`gin_tonic`, `snug`), not display names; server `created_at` is source of truth for retention; never block Serve Drink if analytics is down.",
    "",
    "Batch inserts (every 10 events or 10 seconds, and on hide) so a phone radio is not woken per tap. Keep the 300-row local debug log. Do not create a parallel events table.",
    "",
    "## Serve payload",
    "",
    "One fat `stage_result` row when they tap Serve Drink.",
    "",
    "| Prop | Example | Reads as |",
    "| --- | --- | --- |",
    "| mode | campaign, training, cotd, endless, mixologist | Which loop |",
    "| recipe_id / venue_id | tom_collins / snug | Content difficulty |",
    "| complexity | Guess, Pour, Mix, Garnish, Full bar | Ramp health |",
    "| stage | 1–N | Progression |",
    "| duration_ms | 42000 | Friction |",
    "| stars / pct | 2 / 74 | Success |",
    "| glass_ok / method_ok / garnish_ok | true / false / auto | Which skill failed |",
    "| pour_ok / pour_near / pour_miss | 2 / 1 / 0 | Jigger skill, not every ml |",
    "| steps_back | 3 | Indecision at the station |",
    "",
    "## What to read",
    "",
    "**This week:** open → profile → home → start → serve; median time to first serve by platform; left unfinished by last step; stars by teaching level.",
    "",
    "**Once you have 7 days of testers:** D1 by underage, platform, and “served a drink on day 0”; home-button mix; venue drop-off; share of sessions that touch Mixologist / Endless after unlock.",
    "",
    "`analytics_daily` only counts event names. It cannot compute who came back. Stop using it as the only dashboard.",
    "",
    "## BA recommendation",
    "",
    "Instrument the first-session funnel and the serve / leave-unfinished pair, with a durable device_id and a 30-minute session. Read first-serve and next-day return by platform. Use those two numbers to decide whether to fix the profile gate, the map, or the pour station — not all three at once. Leave shop, community, and a third-party SDK until those two numbers are visible every morning.",
    "",
  ].join("\n");
}

function renderAnalyticsHtml() {
  const mdTableToHtml = (headers, rows) =>
    htmlTable(
      headers,
      rows.map((r) => r.map((c) => escapeHtml(c)))
    );
  const parts = [];
  parts.push(
    "<p class=\"lede\">What we log, why, and what we do not log. This is the tracking spec — not today’s player numbers.</p>"
  );
  parts.push(
    `<p class="meta">Live snapshots: <a href="./index.html">latest report</a>. Stage: testers on web / Expo / Capacitor. North star: first drink served, and came back the next day.</p>`
  );
  parts.push(
    "<aside>Keep the current pipe: <code>track()</code> in the game, a local debug log, write-only events in Supabase. Do not buy Amplitude or Mixpanel yet.</aside>"
  );
  parts.push("<h2>North-star pair</h2><ul>");
  parts.push("<li><strong>D0 first-serve</strong> — share of new sessions that finish and serve a drink (the aha moment).</li>");
  parts.push("<li><strong>D1 return</strong> — share of those people who open the game the next calendar day.</li>");
  parts.push("</ul>");
  parts.push(
    "<p>Supporting: time to first serve, started vs served vs left unfinished, 3-star rate by teaching level, mode mix after unlock, which bar loses people.</p>"
  );
  parts.push("<h2>Casual-mobile sanity checks</h2>");
  parts.push("<p>Planning bands, not live DAG Tails traffic.</p>");
  parts.push(
    mdTableToHtml(
      ["Check", "Floor (investigate)", "Healthy target"],
      [
        ["Came back next day", "25%", "40%"],
        ["Came back in a week", "8%", "15%"],
        ["Came back in a month", "3%", "6%"],
        ["Typical session", "—", "4–8 minutes"],
        ["First-session complete", "—", "70%+ reach a served drink"],
      ]
    )
  );
  parts.push("<h2>Predicted leak points</h2>");
  parts.push(
    mdTableToHtml(
      ["Leak", "Why it matters", "Event that proves it"],
      [
        ["Profile gate", "Name + age before any pour", "app_open → profile_created"],
        ["Intro comic", "Story before the loop", "intro_start / skip / complete"],
        ["Map after first home tap", "Highest-friction surface", "hub_cta=journey → map_view → stage_started"],
        ["Mid-pour quit", "Skill wall on a phone", "drink_abandoned vs stage_result"],
        ["Teaching ramp", "Guess → Pour → Mix → Garnish → Full bar", "stage_result.complexity + stars"],
        ["Unlock at 5 clears", "Sandbox modes hide until then", "stage_result.stage + mixologist_started"],
      ]
    )
  );
  parts.push("<h2>First-session funnel</h2>");
  parts.push(
    "<p>One chain. Conversion is count(step n+1) / count(step n) among the same phone/browser on day 0. Phase 1 is in the game; older logs still show zeros until testers play the current build.</p>"
  );
  parts.push(
    mdTableToHtml(
      ["Step", "In the game?", "Question it answers"],
      [
        ["app_open", "Yes", "Did the build boot?"],
        ["splash_continue", "Yes", "Did they leave on the title card?"],
        ["profile_created", "Yes", "Did the age gate kill the session?"],
        ["intro_complete", "Yes", "Did the comic stall them?"],
        ["hub_view", "Yes", "Did they reach the home screen?"],
        ["map_view", "Yes", "Did Journey actually open the map?"],
        ["stage_started", "Yes", "Did they enter the station?"],
        ["stage_result", "Yes", "Did they finish a drink?"],
      ]
    )
  );
  parts.push("<h2>Already shipping</h2>");
  parts.push(
    mdTableToHtml(
      ["Event", "When", "Used for"],
      [
        ["app_open", "Boot", "Who opened, who came back"],
        ["profile_modal_open", "Create / edit", "Gate drop"],
        ["profile_created", "Save new profile (underage only, never name/age)", "Age-gate split"],
        ["stage_started", "Enter station", "Loop start"],
        ["stage_result", "Serve", "Quality, aha"],
        ["training_started / endless_started / mixologist_started", "Hub modes", "After unlock"],
        ["mixologist_result", "Invent + serve (score, verdict, family)", "Sandbox quality"],
        ["shop_open / shop_checkout", "Demo shop", "Demand, not revenue"],
        ["community_share", "Share invention", "Sharing"],
      ]
    )
  );
  parts.push("<h2>Phase 1 — in the game now</h2>");
  parts.push(
    mdTableToHtml(
      ["Event", "Fire when", "Decision it unlocks"],
      [
        ["session_start / session_end", "30-minute session envelope", "Sessions and length"],
        ["splash_continue", "Enter tap on splash", "Title drop-off"],
        ["intro_start / skip / complete", "Comic", "Is the comic a leak?"],
        ["hub_view / hub_cta", "Home screen", "What they tap"],
        ["map_view / map_drink_tap", "Map", "Map friction"],
        ["drink_abandoned", "Leave without serving", "Station leak"],
        ["menu_return", "Back to home", "Where they left"],
        ["cotd_started / training_complete / endless_over", "Side modes", "Did those loops work?"],
      ]
    )
  );
  parts.push("<h2>Phase 2 — later</h2>");
  parts.push(
    "<p>venue_complete, modes_unlocked, badge_unlock, ticket_flip, result_cta, community_view/like, leaderboard_view, shop_add_item, boot_ready, rotate_lock_shown, client_error. Add only once first-serve and next-day return are visible every morning.</p>"
  );
  parts.push("<h2>Do not log</h2>");
  parts.push(
    mdTableToHtml(
      ["Tempting event", "Why skip"],
      [
        ["Every millilitre of a pour", "Fold accuracy into served (ok / near / miss)"],
        ["Every Back / Next step", "last_step on drink_abandoned is enough"],
        ["Player name, location, exact age", "Analytics only needs underage true/false"],
        ["Mixologist display names", "Use classic / score / verdict / family"],
      ]
    )
  );
  parts.push("<h2>How to log</h2>");
  parts.push(
    "<p>Three IDs: device_id (once, in local storage), session_id (reset after 30 minutes), player_id (optional signed-in uid). Super-properties on every event: platform, build, underage, units, returning, viewport. Split dashboards by platform and underage. Never block Serve Drink if analytics is down. Batch inserts so a phone radio is not woken per tap.</p>"
  );
  parts.push(
    "<aside><strong>Age gate is a legal line.</strong> Log underage true/false only. Do not log exact age, date of birth, or the typed name.</aside>"
  );
  parts.push("<h2>BA recommendation</h2>");
  parts.push(
    "<p>Read first-serve and next-day return by platform. Use those two numbers to decide whether to fix the profile gate, the map, or the pour station — not all three at once. Leave shop, community, and a third-party SDK until those two numbers are visible every morning.</p>"
  );
  return htmlPage({
    title: "DAG Tails analytics spec",
    heading: "DAG Tails analytics spec",
    nav: SITE_NAV,
    body: parts.join("\n"),
    canonical: `${PUBLIC_URL}analytics.html`,
  });
}

if (!fs.existsSync(snapshotPath)) {
  process.stderr.write("Missing last-snapshot.json. Run fetch.js first.\n");
  process.exit(1);
}

const report = padReport(JSON.parse(fs.readFileSync(snapshotPath, "utf8")));
const day = (report.pulled_at || "").slice(0, 10) || report.range_end;
if (!day) {
  process.stderr.write("Snapshot has no date.\n");
  process.exit(1);
}

const { markdown } = renderDay(report);
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(path.join(outDir, `${day}.md`), markdown);
fs.writeFileSync(path.join(outDir, "latest.md"), markdown);
fs.writeFileSync(path.join(dataDir, `${day}.json`), JSON.stringify(report, null, 2));

const history = listHistory();
fs.writeFileSync(path.join(outDir, "README.md"), renderIndex(history, day));

const dayHtml = renderDayHtml(report, history, day);
fs.mkdirSync(siteDir, { recursive: true });
fs.writeFileSync(path.join(siteDir, "index.html"), dayHtml);
fs.writeFileSync(path.join(siteDir, `${day}.html`), dayHtml);
fs.writeFileSync(path.join(siteDir, "history.html"), renderHistoryHtml(history, day));
fs.writeFileSync(path.join(outDir, "analytics.md"), renderAnalyticsMarkdown());
fs.writeFileSync(path.join(siteDir, "analytics.html"), renderAnalyticsHtml());
process.stdout.write(`Wrote docs/player-reports/${day}.md and public site ${PUBLIC_URL}\n`);
