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
process.stdout.write(`Wrote docs/player-reports/${day}.md and updated history index.\n`);
