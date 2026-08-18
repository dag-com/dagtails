// ============================================================================
// Mixologist evaluator — judges an invented cocktail with no reference recipe.
// Scores flavour balance, technique, glass fit and strength, produces a
// verdict, a flavour profile, coaching tips, and detects classic cocktails.
// ============================================================================

import { INGREDIENT_BY_ID, GLASS_BY_ID, CLASSICS } from "./data.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function volPerUnit(unit) {
  switch (unit) {
    case "ml": return 1;
    case "dash": return 0.9;
    case "leaf": return 0.2;
    case "piece": return 30; // egg white ≈ one small pour of body
    default: return 1;
  }
}

// 100 inside [lo,hi], falling off over `soft` units outside the band.
function band(v, lo, hi, soft) {
  if (v >= lo && v <= hi) return 100;
  const d = v < lo ? lo - v : v - hi;
  return clamp(100 - (d / soft) * 100, 0, 100);
}

const DILUTION = { shake: 0.27, stir: 0.22, build: 0.1, muddle: 0.12, blend: 0.35 };

export function evaluate(build, opts = {}) {
  const strictness = opts.strictness || "balanced";
  const items = (build.ingredients || []).filter((i) => INGREDIENT_BY_ID[i.id] && i.amount > 0);

  if (items.length === 0) {
    return {
      score: 0, stars: 0, verdict: "Empty glass",
      note: "There's nothing in the glass yet.",
      profile: { strong: 0, sweet: 0, sour: 0, bitter: 0, fizz: 0 },
      parts: { balance: 0, technique: 0, glass: 0, strength: 0 },
      tips: ["Add a base spirit and a couple of supporting ingredients."],
      family: "—", abv: 0, volume: 0, classic: null,
    };
  }

  // ---- aggregate ----
  let baseVol = 0, alcoholMl = 0, sweetSum = 0, sourSum = 0, bitterSum = 0;
  let strongVol = 0, carbVol = 0, citrusVol = 0, juiceVol = 0, sweetVol = 0, dairyVol = 0;
  let hasEgg = false, hasMint = false, hasBitters = false, hasAromatized = false, hasSweetMod = false, hasSpirit = false;

  items.forEach((it) => {
    const ing = INGREDIENT_BY_ID[it.id];
    const mx = ing.mx;
    const vu = volPerUnit(ing.unit);
    const vol = it.amount * vu;
    baseVol += vol;
    alcoholMl += (vol * mx.abv) / 100;
    sweetSum += it.amount * vu * mx.pot * mx.sw;
    sourSum += it.amount * vu * mx.pot * mx.so;
    bitterSum += it.amount * vu * mx.pot * mx.bi;

    switch (mx.fam) {
      case "spirit": strongVol += vol; hasSpirit = true; break;
      case "soda": case "sparkling": carbVol += vol; break;
      case "citrus": citrusVol += vol; break;
      case "juice": juiceVol += vol; break;
      case "syrup": sweetVol += vol; hasSweetMod = true; break;
      case "dairy": dairyVol += vol; break;
      case "egg": hasEgg = true; break;
      case "herb": hasMint = true; break;
      case "bitters": hasBitters = true; break;
      case "aromatized": case "amaro": hasAromatized = true; break;
      case "liqueur": if (mx.sw >= 0.3) hasSweetMod = true; break;
    }
  });

  const dil = DILUTION[build.method] ?? 0;
  const finalVol = Math.max(1, baseVol * (1 + dil));
  const abv = (alcoholMl / finalVol) * 100;

  const sweetC = sweetSum / finalVol;
  const sourC = sourSum / finalVol;
  const bitterC = bitterSum / finalVol;

  const hasCitrus = citrusVol > 0;
  const hasCarb = carbVol > 0;
  const sweetenerPresent = hasSweetMod || sweetC > 0.05;
  const anyModifier = hasCitrus || hasCarb || hasBitters || hasAromatized || sweetenerPresent || juiceVol > 0 || dairyVol > 0 || hasEgg || hasMint;

  // ---- archetype ----
  let family;
  if (hasCarb && carbVol > baseVol * 0.22) family = "Long / Fizz";
  else if (build.method === "blend") family = "Frozen";
  else if (hasEgg || dairyVol > 0) family = "Creamy";
  else if (hasCitrus && sweetenerPresent) family = "Sour";
  else if (!hasCitrus && !hasCarb && (strongVol + (hasAromatized ? 1 : 0))) family = "Spirit-forward";
  else family = "Mixed";

  // ---- balance ----
  let balance = 100;
  const tips = [];
  if (hasSpirit && !anyModifier) {
    balance -= 55;
  }
  if (hasCitrus) {
    // sweet should roughly offset sour
    const ideal = sourC * 0.9;
    balance -= clamp((Math.abs(sweetC - ideal) / 0.16) * 60, 0, 60);
  } else if (sweetC > 0.13 && family !== "Creamy" && family !== "Spirit-forward") {
    balance -= clamp(((sweetC - 0.13) / 0.12) * 45, 0, 45); // cloying
  }
  // bitterness: a little is good, a lot is harsh (unless amaro-led)
  const bitterCeil = hasAromatized ? 0.2 : 0.12;
  if (bitterC > bitterCeil) balance -= clamp(((bitterC - bitterCeil) / 0.1) * 35, 0, 38);
  else if (bitterC >= 0.015 && bitterC <= 0.09) balance += 4;
  // too tart with no sweetness
  if (sourC > 0.12 && sweetC < sourC * 0.4) balance -= 18;
  balance = clamp(balance, 0, 100);

  // ---- strength ----
  let sLo, sHi, sSoft = 12;
  if (family === "Spirit-forward") { sLo = 22; sHi = 38; }
  else if (family === "Long / Fizz" || family === "Frozen") { sLo = 5; sHi = 15; }
  else if (family === "Creamy") { sLo = 8; sHi = 20; }
  else { sLo = 11; sHi = 23; }
  let strength = band(abv, sLo, sHi, sSoft);
  if (abv > 42) strength = Math.min(strength, 20);
  // total volume sanity
  const volOK = band(finalVol, 70, 360, 120);
  strength = strength * 0.7 + volOK * 0.3;

  // ---- technique ----
  let technique;
  const m = build.method;
  if (!m) technique = 0;
  else if (hasCarb) technique = ({ build: 100, muddle: 72, stir: 58, shake: 14, blend: 8 })[m] ?? 40;
  else if (hasEgg) technique = ({ shake: 100, blend: 52, muddle: 42, stir: 30, build: 20 })[m] ?? 30;
  else if (hasCitrus || juiceVol > 0 || dairyVol > 0) technique = ({ shake: 100, blend: 82, muddle: 70, stir: 46, build: 50 })[m] ?? 50;
  else technique = ({ stir: 100, build: 72, shake: 55, muddle: 52, blend: 32 })[m] ?? 50;
  if (hasMint && m === "muddle") technique = Math.max(technique, 88);

  // ---- glass ----
  let glass = 0;
  if (build.glass && GLASS_BY_ID[build.glass]) {
    const g = GLASS_BY_ID[build.glass];
    const fillRatio = finalVol / g.cap;
    let fit;
    if (fillRatio > 1.05) fit = clamp(100 - (fillRatio - 1.05) * 160, 0, 70);
    else fit = band(fillRatio, 0.42, 0.95, 0.5);
    const longGlass = ["highball", "collins", "hurricane", "wine"].includes(g.id);
    const upGlass = ["coupe", "martini", "margarita", "rocks", "wine"].includes(g.id);
    let styleFit = 60;
    if (family === "Long / Fizz") styleFit = longGlass ? 100 : 40;
    else if (family === "Frozen") styleFit = ["hurricane", "margarita", "wine"].includes(g.id) ? 100 : 55;
    else if (family === "Sour" || family === "Creamy") styleFit = ["coupe", "martini", "margarita", "rocks"].includes(g.id) ? 100 : 60;
    else if (family === "Spirit-forward") styleFit = ["rocks", "coupe", "martini"].includes(g.id) ? 100 : 60;
    else styleFit = upGlass || longGlass ? 85 : 60;
    glass = fit * 0.65 + styleFit * 0.35;
  }

  // ---- garnish bonus ----
  let garnishBonus = 0;
  const gid = build.garnish;
  if (gid && gid !== "none") {
    const citrusGarnish = ["lime_wheel", "lemon_twist", "orange_peel", "pineapple_wedge"].includes(gid);
    if (hasCitrus && citrusGarnish) garnishBonus = 4;
    else if (family === "Spirit-forward" && ["orange_peel", "lemon_twist", "cherry"].includes(gid)) garnishBonus = 4;
    else if (gid === "mint_sprig" && hasMint) garnishBonus = 4;
    else garnishBonus = 2;
  }

  // ---- total ----
  let total = balance * 0.4 + technique * 0.22 + strength * 0.2 + glass * 0.18 + garnishBonus;
  total = clamp(total, 0, 100);
  if (strictness === "forgiving") total = 100 - (100 - total) * 0.6;
  else if (strictness === "strict") total = clamp(100 - (100 - total) * 1.25, 0, 100);
  total = Math.round(total);

  // ---- verdict ----
  let verdict;
  if (total >= 85) verdict = "Signature cocktail";
  else if (total >= 70) verdict = "Solid drink";
  else if (total >= 55) verdict = "Drinkable";
  else if (total >= 38) verdict = "Rough — needs work";
  else verdict = "Undrinkable";

  // ---- coaching tips (prioritised) ----
  const cand = [];
  if (hasSpirit && !anyModifier) cand.push([60, "It's basically neat spirit — add a sweet, sour, or bitter element and some dilution."]);
  if (abv > 42) cand.push([55, "Seriously boozy — lengthen it with juice/soda or cut the base spirit."]);
  else if (abv > sHi + 6) cand.push([35, "Runs strong — reduce the spirit or add more length/dilution."]);
  if (!hasSpirit && abv < 4) cand.push([20, "There's no real alcohol — add a base spirit if you want a cocktail."]);
  if (hasCitrus && sweetC < sourC * 0.5) cand.push([45, "Quite tart — add a touch of syrup or a sweeter liqueur."]);
  if (hasCitrus && sweetC > sourC * 1.4) cand.push([40, "A little sweet for a sour — add more citrus or ease off the syrup."]);
  if (!hasCitrus && sweetC > 0.16 && family !== "Creamy" && family !== "Spirit-forward") cand.push([42, "Too sweet — add fresh citrus or cut the sugar/liqueur."]);
  if (bitterC > bitterCeil) cand.push([30, "Quite bitter — balance with something sweet or use less bitters/amaro."]);
  if (hasCarb && m === "shake") cand.push([50, "Don't shake fizzy mixers — build in the glass to keep the bubbles."]);
  if (!hasCarb && !hasCitrus && juiceVol === 0 && !hasEgg && dairyVol === 0 && m === "shake") cand.push([28, "Spirit-forward drinks are smoother stirred than shaken."]);
  if ((hasCitrus || juiceVol > 0 || dairyVol > 0) && m === "stir") cand.push([34, "Juicy/citrus drinks should be shaken, not stirred."]);
  if (hasEgg && m !== "shake") cand.push([36, "Egg white needs a hard shake to build foam."]);
  if (build.glass && GLASS_BY_ID[build.glass] && finalVol / GLASS_BY_ID[build.glass].cap > 1.05) cand.push([38, "It won't fit the glass — size up or scale the recipe down."]);
  if (build.glass && GLASS_BY_ID[build.glass] && finalVol / GLASS_BY_ID[build.glass].cap < 0.3) cand.push([22, "Looks lost in that glass — use a smaller one or add length."]);
  if (glass > 0 && glass < 55) cand.push([20, family === "Long / Fizz" ? "A long, fizzy drink belongs in a highball or collins." : "Served up? A coupe or martini suits this better."]);

  cand.sort((a, b) => b[0] - a[0]);
  cand.slice(0, 4).forEach((c) => tips.push(c[1]));
  if (tips.length === 0) tips.push(total >= 85 ? "Beautifully balanced — wouldn't change a thing." : "Nicely done — small tweaks could make it shine.");

  // ---- tasting note ----
  const note = tastingNote(family, { sweetC, sourC, bitterC, abv, hasCarb, hasEgg, dairyVol, hasMint });

  const profile = {
    strong: clamp(abv / 40, 0, 1),
    sweet: clamp(sweetC / 0.32, 0, 1),
    sour: clamp(sourC / 0.28, 0, 1),
    bitter: clamp(bitterC / 0.16, 0, 1),
    fizz: clamp(carbVol / finalVol / 0.5, 0, 1),
  };

  return {
    score: total,
    stars: Math.round(total / 20),
    verdict,
    note,
    profile,
    parts: { balance: Math.round(balance), technique: Math.round(technique), glass: Math.round(glass), strength: Math.round(strength) },
    tips,
    family,
    abv: Math.round(abv * 10) / 10,
    volume: Math.round(finalVol),
    classic: detectClassic(build),
  };
}

/** True when Community must not accept this pour (exact classic or close copy). */
export function classicBlocksCommunityShare(classic) {
  return !!(classic && classic.name);
}

function tastingNote(family, f) {
  const bits = [];
  if (f.abv >= 30) bits.push("spirit-forward and strong");
  else if (f.abv <= 8) bits.push("light and easy-drinking");
  if (f.sourC > 0.12 && f.sweetC > 0.1) bits.push("bright and balanced");
  else if (f.sourC > 0.14) bits.push("tart and zippy");
  else if (f.sweetC > 0.16) bits.push("rich and sweet");
  if (f.bitterC > 0.1) bits.push("pleasantly bitter");
  if (f.hasCarb) bits.push("refreshing and effervescent");
  if (f.hasEgg || f.dairyVol > 0) bits.push("silky and smooth");
  if (f.hasMint) bits.push("with a cool herbal lift");
  const lead = { "Sour": "A sour-style drink", "Spirit-forward": "A spirit-forward sipper", "Long / Fizz": "A long, refreshing highball", "Creamy": "A creamy, indulgent drink", "Frozen": "A frozen, slushy drink", "Mixed": "A mixed drink" }[family] || "A drink";
  return `${lead} — ${bits.length ? bits.join(", ") : "simple and straightforward"}.`;
}

// Compare the build to known classics by ingredient overlap + rough proportions.
// Same set → always a hit (exact if ratios + method are close). One extra or
// missing ingredient with similar ratios → "close". Distinct cousins (Negroni
// vs Boulevardier) stay unmatched so Community can still take originals.
export function detectClassic(build) {
  const items = (build.ingredients || []).filter((i) => i.amount > 0);
  const ids = items.map((i) => i.id);
  if (ids.length < 2) return null;
  const set = new Set(ids);

  const share = (list) => {
    const tot = list.reduce((s, i) => s + i.amount, 0) || 1;
    return Object.fromEntries(list.map((i) => [i.id, i.amount / tot]));
  };

  let best = null;
  for (const c of CLASSICS) {
    const cset = new Set(c.ingredients.map((i) => i.id));
    let inter = 0;
    for (const id of set) if (cset.has(id)) inter++;
    const extra = set.size - inter;
    const missing = cset.size - inter;
    const union = set.size + cset.size - inter;
    const jaccard = union ? inter / union : 0;

    const a = share(items);
    const b = share(c.ingredients);
    let diff = 0;
    for (const id of set) {
      if (!cset.has(id)) continue;
      diff += Math.abs((a[id] || 0) - (b[id] || 0));
    }

    const sameSet = extra === 0 && missing === 0;
    const nearSet = extra + missing === 1 && inter >= 2;
    const closeProportions = diff < 0.45;
    const exact = sameSet && diff < 0.28 && (!c.method || build.method === c.method);

    let kind = null;
    if (sameSet) kind = exact ? "exact" : "close";
    else if (nearSet && closeProportions && jaccard >= 0.6) kind = "close";
    else if (jaccard >= 0.8 && inter >= 3 && closeProportions) kind = "close";
    if (!kind) continue;

    const score = jaccard * 0.55 + (1 - Math.min(1, diff)) * 0.45 + (exact ? 0.1 : 0);
    if (!best || score > best.score) {
      best = { name: c.name, exact: kind === "exact", score };
    }
  }
  return best ? { name: best.name, exact: best.exact, close: !best.exact } : null;
}
