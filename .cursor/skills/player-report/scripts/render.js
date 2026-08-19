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
const PUBLIC_URL = "https://dag-com.github.io/last-call-bartending-game/player-reports/";

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
  if (stars.length) {
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
  }

  const venues = report.venues || [];
  if (venues.length) {
    lines.push("## Where they played");
    lines.push("");
    lines.push(
      mdTable(
        ["Bar", "Drinks started"],
        venues.map((v) => [VENUE_LABEL[v.venue] || v.venue, fmt(v.started)])
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
  if (hub.length) {
    lines.push("## What they tapped on the home screen");
    lines.push("");
    lines.push(mdTable(["Button", "Taps"], hub.map((h) => [h.cta, fmt(h.n)])));
    lines.push("");
  }

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
    lines.push("We cannot yet see where someone quit mid-pour. That is in the new tracking, after testers play the current live build.");
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
    if (leftSteps.length) {
      lines.push("From where in the pour:");
      lines.push("");
      lines.push(
        mdTable(
          ["Where they were", "Times left", "Share"],
          leftSteps.map((s) => [
            STEP_LABEL[s.last_step] || s.last_step,
            fmt(s.n),
            pctLabel(s.n, leftN) || "—",
          ])
        )
      );
      lines.push("");
    }
    if (leftReasons.length) {
      lines.push(
        mdTable(
          ["How they left", "Times"],
          leftReasons.map((r) => [REASON_LABEL[r.reason] || r.reason, fmt(r.n)])
        )
      );
      lines.push("");
    }
  }

  const menu = report.menu_return || {};
  const menuFrom = menu.by_from || [];
  lines.push("## Who went back to the home screen");
  lines.push("");
  if (!(menu.n || 0) && !menuFrom.length) {
    lines.push("Returns to the home menu (from the map, settings, Mixologist, and so on) are not in this log yet. Campaign Quit still goes to the map, not home — that will show under “left without serving.”");
    lines.push("");
  } else {
    lines.push(`**${fmt(menu.people || 0)}** people went back to the home screen **${fmt(menu.n)}** times.`);
    lines.push("");
    if (menuFrom.length) {
      lines.push(
        mdTable(
          ["Came from", "Times", "People", "Share of returns"],
          menuFrom.map((row) => [
            FROM_LABEL[row.from] || row.from,
            fmt(row.n),
            fmt(row.people),
            pctLabel(row.n, menu.n) || "—",
          ])
        )
      );
      lines.push("");
    }
  }

  const mix = report.mixologist || {};
  if ((mix.started || 0) > 0 || (mix.finished || 0) > 0) {
    lines.push("## Invented drinks");
    lines.push("");
    lines.push(`Started an invention: **${fmt(mix.started)}**. Served it: **${fmt(mix.finished)}**.`);
    lines.push("");
    const verdicts = mix.verdicts || [];
    if (verdicts.length) {
      lines.push(
        mdTable(
          ["Judges said", "Drinks", "Average score"],
          verdicts.map((v) => [v.verdict, fmt(v.n), String(v.avg_score)])
        )
      );
      lines.push("");
    }
  }

  const side = report.side_modes || {};
  const sideRows = [
    ["Endless shift starts", side.endless_started],
    ["Training starts", side.training_started],
    ["Cocktail of the Day starts", side.cotd_started],
    ["Shop opens", side.shop_open],
    ["Shared to Community", side.community_share],
  ].filter(([, n]) => n);
  if (sideRows.length) {
    lines.push("## Other modes");
    lines.push("");
    lines.push(mdTable(["What", "Count"], sideRows.map(([k, n]) => [k, fmt(n)])));
    lines.push("");
  }

  lines.push("## What this means");
  lines.push("");
  if (qaDays.length) {
    lines.push("- Do not brief testers from the spike days. Those are machines running the game.");
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

function htmlPage({ title, heading, nav, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <link rel="canonical" href="${PUBLIC_URL}" />
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
  if (stars.length) {
    parts.push("<h2>Did they finish the drink?</h2>");
    parts.push(
      htmlTable(
        ["Stars", "Drinks served"],
        stars.map((s) => [`${escapeHtml(s.stars)} stars`, escapeHtml(fmt(s.n))])
      )
    );
    const three = stars.find((s) => String(s.stars) === "3");
    const threeN = three ? three.n : 0;
    const served = t.served || 0;
    if (served && threeN / served > 0.8) {
      parts.push(
        "<p>Almost every served drink is 3 stars on the first teaching level. That usually means automated tests, not expert players.</p>"
      );
    }
  }
  const venues = report.venues || [];
  if (venues.length) {
    parts.push("<h2>Where they played</h2>");
    parts.push(
      htmlTable(
        ["Bar", "Drinks started"],
        venues.map((v) => [escapeHtml(VENUE_LABEL[v.venue] || v.venue), escapeHtml(fmt(v.started))])
      )
    );
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
  if (hub.length) {
    parts.push("<h2>What they tapped on the home screen</h2>");
    parts.push(htmlTable(["Button", "Taps"], hub.map((h) => [escapeHtml(h.cta), escapeHtml(fmt(h.n))])));
  }

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
    parts.push("<p>We cannot yet see where someone quit mid-pour. That is in the new tracking, after testers play the current live build.</p>");
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
    if (leftSteps.length) {
      parts.push("<p>From where in the pour:</p>");
      parts.push(
        htmlTable(
          ["Where they were", "Times left", "Share"],
          leftSteps.map((s) => [
            escapeHtml(STEP_LABEL[s.last_step] || s.last_step),
            escapeHtml(fmt(s.n)),
            escapeHtml(pctLabel(s.n, leftN) || "—"),
          ])
        )
      );
    }
    if (leftReasons.length) {
      parts.push(
        htmlTable(
          ["How they left", "Times"],
          leftReasons.map((r) => [escapeHtml(REASON_LABEL[r.reason] || r.reason), escapeHtml(fmt(r.n))])
        )
      );
    }
  }

  const menu = report.menu_return || {};
  const menuFrom = menu.by_from || [];
  parts.push("<h2>Who went back to the home screen</h2>");
  if (!(menu.n || 0) && !menuFrom.length) {
    parts.push("<p>Returns to the home menu (from the map, settings, Mixologist, and so on) are not in this log yet. Campaign Quit still goes to the map, not home — that will show under “left without serving.”</p>");
  } else {
    parts.push(
      `<p><strong>${escapeHtml(fmt(menu.people || 0))}</strong> people went back to the home screen <strong>${escapeHtml(fmt(menu.n))}</strong> times.</p>`
    );
    if (menuFrom.length) {
      parts.push(
        htmlTable(
          ["Came from", "Times", "People", "Share of returns"],
          menuFrom.map((row) => [
            escapeHtml(FROM_LABEL[row.from] || row.from),
            escapeHtml(fmt(row.n)),
            escapeHtml(fmt(row.people)),
            escapeHtml(pctLabel(row.n, menu.n) || "—"),
          ])
        )
      );
    }
  }

  const mix = report.mixologist || {};
  if ((mix.started || 0) > 0 || (mix.finished || 0) > 0) {
    parts.push("<h2>Invented drinks</h2>");
    parts.push(
      `<p>Started an invention: <strong>${escapeHtml(fmt(mix.started))}</strong>. Served it: <strong>${escapeHtml(fmt(mix.finished))}</strong>.</p>`
    );
    const verdicts = mix.verdicts || [];
    if (verdicts.length) {
      parts.push(
        htmlTable(
          ["Judges said", "Drinks", "Average score"],
          verdicts.map((v) => [escapeHtml(v.verdict), escapeHtml(fmt(v.n)), escapeHtml(String(v.avg_score))])
        )
      );
    }
  }
  const side = report.side_modes || {};
  const sideRows = [
    ["Endless shift starts", side.endless_started],
    ["Training starts", side.training_started],
    ["Cocktail of the Day starts", side.cotd_started],
    ["Shop opens", side.shop_open],
    ["Shared to Community", side.community_share],
  ].filter(([, n]) => n);
  if (sideRows.length) {
    parts.push("<h2>Other modes</h2>");
    parts.push(htmlTable(["What", "Count"], sideRows.map(([k, n]) => [escapeHtml(k), escapeHtml(fmt(n))])));
  }
  parts.push("<h2>What this means</h2><ul>");
  if (qaDays.length) {
    parts.push("<li>Do not brief testers from the spike days. Those are machines running the game.</li>");
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
  const nav = `<a href="./index.html">Latest</a><a href="./history.html">History</a>`;
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
    nav: `<a href="./index.html">Latest</a><a href="./history.html">History</a>`,
    body,
  });
}

if (!fs.existsSync(snapshotPath)) {
  process.stderr.write("Missing last-snapshot.json. Run fetch.js first.\n");
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
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
process.stdout.write(`Wrote docs/player-reports/${day}.md and public site ${PUBLIC_URL}\n`);
