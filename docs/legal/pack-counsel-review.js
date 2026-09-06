#!/usr/bin/env node
/**
 * Combined counsel pack: trademark, privacy, IP, fonts, live brand stills.
 * Writes:
 *   exports/DAG-Tails-Legal/DAG-Tails-counsel-review/   (unpacked, gitignored)
 *   docs/legal/counsel-review.zip
 *
 *   node docs/legal/pack-counsel-review.js
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const stagingParent = path.join(root, "exports", "DAG-Tails-Legal");
const packDir = path.join(stagingParent, "DAG-Tails-counsel-review");
const zipDest = path.join(__dirname, "counsel-review.zip");
const zipCopy = path.join(stagingParent, "DAG-Tails-counsel-review.zip");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function write(rel, text) {
  const dest = path.join(packDir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, text, "utf8");
}

function copyFile(fromRel, toRel) {
  const dest = path.join(packDir, toRel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(root, fromRel), dest);
}

function extractArrayBlock(src, exportName) {
  const markers = [`export const ${exportName} = [`, `const ${exportName} = [`];
  let start = -1;
  let marker = "";
  for (const item of markers) {
    start = src.indexOf(item);
    if (start >= 0) {
      marker = item;
      break;
    }
  }
  if (start < 0) return "";
  let depth = 0;
  for (let i = start + marker.length - 1; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "[") depth += 1;
    else if (ch === "]") {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

function topLevelObjects(block) {
  const open = block.indexOf("[");
  const close = block.lastIndexOf("]");
  if (open < 0 || close <= open) return [];
  const inner = block.slice(open + 1, close);
  const objs = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if (ch === "{") {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        objs.push(inner.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return objs;
}

function firstField(chunk, key) {
  const re = new RegExp(`(?:^|[,\\s])${key}:\\s*"((?:\\\\.|[^"\\\\])*)"`);
  const hit = chunk.match(re);
  return hit ? hit[1] : "";
}

function namedFields(block) {
  return topLevelObjects(block).map((chunk) => {
    const master = chunk.match(/master:\s*\{[\s\S]*?\}/) || [];
    return {
      id: firstField(chunk, "id"),
      name: firstField(chunk, "name"),
      city: firstField(chunk, "city"),
      country: firstField(chunk, "country"),
      title: firstField(chunk, "title"),
      kind: firstField(chunk, "kind"),
      cat: firstField(chunk, "cat"),
      breed: firstField(chunk, "breed"),
      master: master[0] ? firstField(master[0], "name") : "",
    };
  }).filter((row) => row.name);
}

function mdTable(headers, rows) {
  const lines = [
    "| " + headers.join(" | ") + " |",
    "| " + headers.map(() => "---").join(" | ") + " |",
  ];
  for (const row of rows) {
    lines.push("| " + row.map((cell) => String(cell || "").replace(/\|/g, "/")).join(" | ") + " |");
  }
  return lines.join("\n");
}

function uniqueNames(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    if (seen.has(row.name)) continue;
    seen.add(row.name);
    out.push(row);
  }
  return out;
}

if (fs.existsSync(packDir)) fs.rmSync(packDir, { recursive: true, force: true });
fs.mkdirSync(packDir, { recursive: true });

const dataSrc = read("data.js");
const watch = JSON.parse(read(path.join(".cursor", "skills", "legal-watch", "watchlist.json")));
const recipes = uniqueNames(namedFields(extractArrayBlock(dataSrc, "RECIPES")));
const extraClassics = uniqueNames(namedFields(extractArrayBlock(dataSrc, "EXTRA_CLASSICS") || ""));
const ingredients = uniqueNames(namedFields(extractArrayBlock(dataSrc, "INGREDIENTS")));
const venues = uniqueNames(namedFields(extractArrayBlock(dataSrc, "VENUES")));
const venuesUnder = uniqueNames(namedFields(extractArrayBlock(dataSrc, "VENUES_UNDER")));
const judges = uniqueNames(namedFields(extractArrayBlock(dataSrc, "JUDGES")));
const glasses = uniqueNames(namedFields(extractArrayBlock(dataSrc, "GLASSES")));

write(
  "00-README.md",
  `# DAG Tails — combined counsel review pack

**Status:** Working file for counsel. **Not legal advice.** Not an executed opinion, clearance, privacy policy, or assignment.

**Product:** DAG Tails (bartending game)  
**Operator (placeholder):** DAG.com, operating DAG Tails  
**Live beta:** https://dag-com.github.io/dagtails/  
**Repo:** https://github.com/dag-com/dagtails  
**Packed:** ${new Date().toISOString().slice(0, 10)}

Open **01-COVER-AND-ASKS.md** first. That file is the approval checklist.

This pack is assembled by \`node docs/legal/pack-counsel-review.js\`.
`
);

write(
  "01-COVER-AND-ASKS.md",
  `# What we need counsel to approve

This is a clearance and documents pack for a **private beta** of a web bartending game. Please treat every “cleared_keep” note from the in-house scanner as **engineering hygiene**, not a lawyer opinion.

## A. Please return

1. Which items below are **ok for a closed beta**, which must **change before beta**, and which can wait for a **store / public launch**.
2. Marked-up or replacement text for:
   - Privacy notice
   - Beta-tester email
   - In-game cocktail / recipe **IP assignment**
3. Whether the **DAG Tails** wordmark and duck mascot are clear enough to keep, and what to file (if anything) for trademark.
4. Governing law, company legal name, address, and contact for the notice.

## B. Approval checklist

### 1. House brand

| Item | In the live game? | Ask |
|---|---|---|
| Wordmark **DAG Tails** / **DAG TAILS** | Yes — logo, splash, hub | Clearance to use; search/file classes (games, entertainment, maybe later merch). Watch **Bacardi** Madrid IR 1572190 (feathers + the word TAILS, cl. 32/33) if we ever put TAILS on drinks goods. |
| Duck mascot (hoodie / service jacket / Ace bomber) | Yes — \`brand-images/\` | Original character? Any Disney DuckTales-like trade dress left? (Old painted gold-brush wordmarks were deleted.) |
| Ace gold teardrop **aviators** | Yes — Ace rank still | HIGH: Ray-Ban Aviator trade dress. Change frame shape / drop temple logos before a commercial launch? |
| Wavy white **sneaker sidestripe** on Ace | Yes — live Ace shoes | Ship-stopper watch: Vans sidestripe trade dress. Recolor or drop the wave? |
| Invented DAG patches on the bomber | Yes | Keep if original. |

### 2. Do not ship / not in the live pack (confirm they stay out)

| Item | Status | Ask |
|---|---|---|
| Top Gun / Maverick jacket study (name tapes, patches) | Quarantined under \`mocks/\` — **not** copied into \`assets/\` | Confirm: never ship, never composite onto Ace. |
| Old DuckTales-like painted title explorations | Deleted from the live splash | Confirm live logo in \`brand-images/dag-tails-logo.png\` is far enough from Disney gold-brush + teal 3D + feather underline. |
| Horse / K9 / ape mascot studies | \`mocks/mascot-alts/\` only | Confirm: mocks-only is enough; do not put them on hub/map. |

### 3. Cocktail, venue, and ingredient names (live catalog)

See \`catalog/NAMES.md\`. In-house notes (not a clearance):

| Topic | In-house note | Ask |
|---|---|---|
| IBA-style classics (Negroni, Daiquiri, Mai Tai, …) | Kept as **recipe titles**, generic bottles | Ok as game content? Any we must rename? |
| Shirley Temple / Roy Rogers | On the **under-18 mocktail** path | HIGH: celebrity names in a kids-facing menu. Rename (Cherry Fizz / Cola Cherry) for beta or only for public launch? |
| Casa Caña | Invented Havana rum bar (replaced a real landmark) | Confirm invented name is ok. |
| Red Bitter / Bitter Orange Aperitivo | Genericized; not Campari/Aperol house marks | Confirm. |
| Angostura Bitters | House bitters mark, common bar term | Keep or say “aromatic bitters”? |
| Drambuie | In the ingredient rail | Keep generic “honeyed Scotch liqueur”? |
| Godfather / Aviation / Sazerac | Recipe titles; film / gin brand / company overlap | Ok as titles if no logos? |
| Sex and the City / The Dude lore in origin blurbs | Flavor text on some classics | Strip celebrity/film catchphrases? |

Names we already **refuse** (scanner ship-stoppers): Dark ’n’ Stormy / Gosling, Painkiller / Pusser’s, El Floridita / Hemingway. Please confirm that list.

### 4. Privacy, children, international transfers

Files: \`privacy/\`

| Topic | Current draft | Ask |
|---|---|---|
| Privacy notice | Placeholder HTML + markdown, linked from create-user and the beta door | Replace with an in-force notice. |
| Consent checkbox | Required before email OTP send and before profile save | Is a checkbox enough for beta? |
| Public alias vs private name | Only alias is written to public \`players.name\` | Confirm. |
| Optional location | Still public on streak leaderboard if typed | Hide for beta? |
| Age field | Allows 1–120; alcohol menu is 18+; mocktails under 18 | COPPA / kid GDPR: should beta **refuse under 18** entirely? |
| Hosts | GitHub Pages + Supabase (may be outside the player’s country) | Lawful basis / SCC / UK GDPR / CCPA language. |
| Analytics | Play events, device id, underage flag — no private name/email in the public report | Confirm. |

### 5. Player-created cocktails (IP)

Placeholder in the privacy notice: every in-game cocktail, recipe, name, garnish, and Community share is **property of the operator**; the player gets a limited play licence.

Ask: is an in-game checkbox assignment **enforceable** for a beta? Do we need a separate clickwrap / ToS? Any carve-out for classic recipes we did not invent?

### 6. Beta-tester email

File: \`privacy/BETA-TESTER-EMAIL.md\`

Ask: safe to send to invitees? Missing clauses?

### 7. Fonts (worldwide)

Files: \`fonts/\`

Inter and Bebas Neue are **self-hosted SIL OFL** files in the game bundle. The live page **does not** call Google Fonts (no visitor IP to Google).

Ask: OFL embedding ok? Any extra notice in the app?

## C. What is *not* in this pack

- Source code, database, or secrets
- Full UX audit (except the legal rows summarized above)
- Horse/K9/ape mock PNGs (not live; say if you want those stills)

## D. Product facts

- Static web game on GitHub Pages; backend is Supabase (email OTP, Postgres, RLS).
- Closed beta: allowlisted emails in \`public.beta_testers\`.
- Local / Playwright play stays anonymous Auth.
- Operator placeholder: DAG.com operating DAG Tails.
`
);

write(
  "trademark/WATCHLIST.json",
  JSON.stringify(watch, null, 2) + "\n"
);

write(
  "trademark/IN-HOUSE-FLAGS.md",
  `# In-house trademark / publicity flags

**Not legal advice.** Copied from the engineering watchlist so counsel can see what the team is already treating as risk.

## Ship-stoppers (do not add; keep out of live art)

${watch.patterns
    .filter((p) => p.severity === "ship-stopper")
    .map((p) => `- **${p.id}** — ${p.reason} Safer: ${p.safer}`)
    .join("\n")}

## High (rename / redraw before a commercial launch unless counsel says otherwise)

${watch.patterns
    .filter((p) => p.severity === "high")
    .map((p) => `- **${p.id}** — ${p.reason} Safer: ${p.safer}`)
    .join("\n")}

## Medium (usually ok as a recipe name; watch merch and logos)

${watch.patterns
    .filter((p) => p.severity === "medium")
    .map((p) => `- **${p.id}** — ${p.reason} Safer: ${p.safer}`)
    .join("\n")}

## Names the team is currently keeping as in-game recipe / venue titles

${(watch.cleared_keep || []).map((n) => `- ${n}`).join("\n")}
`
);

write(
  "catalog/NAMES.md",
  `# Live catalog names

Extracted from \`data.js\` for clearance. Invented venue/master names are listed with city.

## Venues (18+ journey)

${mdTable(
    ["Name", "City", "Country", "Kind", "Master (invented)"],
    venues.map((v) => [v.name, v.city, v.country, v.kind, v.master])
  )}

## Venues (under-18 mocktail path)

${mdTable(
    ["Name", "City", "Country", "Kind", "Master (invented)"],
    venuesUnder.map((v) => [v.name, v.city, v.country, v.kind, v.master])
  )}

## Recipes (journey + mixology catalogue)

${mdTable(
    ["Name"],
    recipes.map((r) => [r.name])
  )}

## Extra classic titles (detection list)

${extraClassics.length ? mdTable(["Name"], extraClassics.map((r) => [r.name])) : "_None beyond the recipe list._"}

## Ingredients

${mdTable(
    ["Name", "Category"],
    ingredients.map((r) => [r.name, r.cat])
  )}

## Glasses

${glasses.map((g) => `- ${g.name}`).join("\n")}

## Mixologist judges (live duck roster)

${mdTable(
    ["Name", "Title", "Breed"],
    judges.map((j) => [j.name, j.title, j.breed])
  )}
`
);

write("privacy/PRIVACY-NOTICE.md", read(path.join("docs", "legal", "PRIVACY-NOTICE.md")));
write("privacy/BETA-TESTER-EMAIL.md", read(path.join("docs", "legal", "BETA-TESTER-EMAIL.md")));
write("privacy/FONTS-NOTE.md", read(path.join("docs", "legal", "FONTS-NOTE.md")));
copyFile(path.join("public", "legal", "privacy.html"), path.join("privacy", "privacy.html"));
copyFile(path.join("docs", "BETA.md"), path.join("privacy", "BETA.md"));
copyFile(path.join("docs", "LOGIN-POLICY.md"), path.join("privacy", "LOGIN-POLICY.md"));

copyFile(path.join("node_modules", "@fontsource", "inter", "LICENSE"), path.join("fonts", "Inter-OFL.txt"));
copyFile(path.join("node_modules", "@fontsource", "bebas-neue", "LICENSE"), path.join("fonts", "BebasNeue-OFL.txt"));

copyFile(path.join("assets", "brand", "dag-tails-logo.png"), path.join("brand-images", "dag-tails-logo.png"));
copyFile(path.join("assets", "duck-hub-mascot.png"), path.join("brand-images", "duck-hub-mascot.png"));
copyFile(path.join("assets", "duck-hub-mascot-jacket.png"), path.join("brand-images", "duck-hub-mascot-jacket.png"));
copyFile(path.join("assets", "duck-hub-mascot-ace.png"), path.join("brand-images", "duck-hub-mascot-ace.png"));

write(
  "brand-images/README.md",
  `# Live brand stills

These are the files actually used on hub / splash / rank-up. Mocks (horses, K9s, apes, unused jacket studies) are **not** included.

- \`dag-tails-logo.png\` — current wordmark
- \`duck-hub-mascot.png\` — hoodie guide
- \`duck-hub-mascot-jacket.png\` — service-jacket rank
- \`duck-hub-mascot-ace.png\` — Ace bomber (aviators + shoe stripe to review)
`
);

let scanOut = "";
try {
  scanOut = execFileSync(
    "python",
    [path.join(root, ".cursor", "skills", "legal-watch", "scripts", "scan.py"), "--full", "data.js", "index.html"],
    { cwd: root, encoding: "utf8" }
  );
} catch (err) {
  scanOut = (err.stdout || "") + (err.stderr || err.message || "");
}
write(
  "trademark/LEGAL-WATCH-SCAN.txt",
  "In-house scanner on data.js + index.html (not a lawyer opinion).\n\n" + scanOut
);

write(
  "NOT-LEGAL-ADVICE.txt",
  "This folder is a working pack for counsel. It is not legal advice, not a trademark opinion, and not an in-force contract.\n"
);

if (fs.existsSync(zipDest)) fs.unlinkSync(zipDest);
if (fs.existsSync(zipCopy)) fs.unlinkSync(zipCopy);

if (process.platform === "win32") {
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path '${packDir.replace(/'/g, "''")}' -DestinationPath '${zipDest.replace(/'/g, "''")}' -Force`,
    ],
    { stdio: "inherit" }
  );
} else {
  execFileSync("zip", ["-r", zipDest, path.basename(packDir)], {
    cwd: stagingParent,
    stdio: "inherit",
  });
}

fs.copyFileSync(zipDest, zipCopy);
process.stdout.write("Wrote " + zipDest + "\n");
process.stdout.write("Unpacked " + packDir + "\n");
