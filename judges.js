// ============================================================================
// Judges panel for the Mixologist "invent a new mix" mode.
// Given an evaluation result (from mixology.evaluate) we pick 3 of the full
// judges roster and each scores the drink against their own palate. The
// panel's average becomes the headline score.
// ============================================================================
import { JUDGES } from "./data.js";

const AXES = ["strong", "sweet", "sour", "bitter", "fizz"];
const AXIS_LABEL = { strong: "strength", sweet: "sweetness", sour: "acidity", bitter: "bitterness", fizz: "fizz" };

const TOO_MUCH = { strong: "too boozy", sweet: "too sweet", sour: "too sharp", bitter: "too bitter", fizz: "too fizzy" };
const WANT_MORE = { strong: "more backbone", sweet: "more sweetness", sour: "more acidity", bitter: "more bitterness", fizz: "more sparkle" };

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function firstName(judge) {
  return String(judge.name || "Judge").split(" ")[0];
}

function voiceOf(judge) {
  const t = `${judge.blurb || ""} ${judge.title || ""} ${judge.character || ""}`.toLowerCase();
  if (/\bsweet\b|dessert/.test(t)) return "sweet";
  if (/balance|precision|fashion-editor/.test(t)) return "balance";
  if (/generous|host|crowd-pleaser|easy-going/.test(t)) return "host";
  if (/critic|hard-to-impress|exacting/.test(t)) return "critic";
  if (/amaro|bitters fan|bitter/.test(t)) return "bitterfan";
  if (/sour/.test(t)) return "sour";
  if (/spritz|fizz|bubbl|playful/.test(t)) return "fizz";
  if (/tropical|fruity/.test(t)) return "tropical";
  if (/spirit-forward|strong|aviator/.test(t)) return "strong";
  if (/martini|classic|grande dame/.test(t)) return "classic";
  return "plain";
}

function intensityOf(abs) {
  if (abs >= 0.5) return "far";
  if (abs >= 0.28) return "bit";
  return "touch";
}

function praisePool(judge) {
  return judge.praise || [
    "Exactly my kind of drink!",
    "Beautifully made — I'm impressed.",
    "I'd order this again. Bravo.",
    "Now that's a proper pour.",
  ];
}

function overLines(judge, axis, intensity) {
  const too = TOO_MUCH[axis];
  const label = AXIS_LABEL[axis];
  const voice = voiceOf(judge);
  const who = firstName(judge);
  const lines = [];
  if (voice === "sweet" && axis === "bitter") {
    lines.push(
      intensity === "far" ? "I wanted dessert, not this much bite." : "Too austere — I missed the sweetness.",
      "Punishing bitterness. Not my kind of treat.",
    );
  }
  if (voice === "host") {
    lines.push(`I'd still serve it, but I'd soften the ${label}.`);
    if (intensity === "far") lines.push(`I'd struggle to serve this — it's ${too}.`);
    lines.push(`Fine for a table — just a little ${too}.`);
  }
  if (voice === "balance") {
    lines.push(
      `One-note ${label} — the rest got crowded out.`,
      `Out of balance: too much ${label}.`,
    );
  }
  if (voice === "critic") {
    lines.push(`Unfocused — the ${label} is sloppy.`);
  }
  if (voice === "bitterfan" && axis === "bitter") {
    lines.push("Even I found this bitter.");
  }
  if (voice === "classic" && axis === "sweet") {
    lines.push("Too much sugar for a serious pour.");
  }
  if (voice === "fizz" && axis !== "fizz") {
    lines.push(`Heavy on ${label} — I wanted more sparkle.`);
  }
  if (intensity === "far") lines.push(`Way ${too} for me.`);
  else if (intensity === "touch") lines.push(`A touch ${too} on the finish.`);
  else lines.push(`A bit ${too} for me.`);
  lines.push(`The ${label} takes over this pour.`);
  lines.push(`${who} here — I'd dial back the ${label}.`);
  return lines;
}

function underLines(judge, axis, intensity) {
  const want = WANT_MORE[axis];
  const label = AXIS_LABEL[axis];
  const voice = voiceOf(judge);
  const who = firstName(judge);
  const lines = [];
  if (voice === "sweet" && axis === "sweet") {
    lines.push("Where's the dessert note? Too dry for me.");
  }
  if (voice === "host") {
    lines.push(`I'd add ${want} so more of the table enjoys it.`);
  }
  if (voice === "balance") {
    lines.push(`It's missing ${label} — the template feels incomplete.`);
  }
  if (voice === "fizz" && axis === "fizz") {
    lines.push("Still as a pond. I wanted bubbles.");
  }
  if (voice === "strong" && axis === "strong") {
    lines.push("Too polite. Give it some backbone.");
  }
  if (intensity === "far") lines.push(`I'd want ${want} — a lot more.`);
  else lines.push(`I'd want ${want}.`);
  lines.push(`Needs more ${label} for my palate.`);
  lines.push(`${who}'s take: push the ${label} a notch.`);
  return lines;
}

function balancedLines(judge) {
  const voice = voiceOf(judge);
  const who = firstName(judge);
  const lines = ["Nicely balanced — to my taste."];
  if (voice === "host") lines.unshift("I'd happily put this on a table.");
  if (voice === "critic") lines.unshift("Competent. Not quite a rave.");
  if (voice === "balance") lines.unshift("Close — a millilitre off my ideal.");
  if (voice === "sweet") lines.unshift("Pleasant, if a little shy on sweetness.");
  lines.push(`${who}: close, but not my sweet spot.`);
  return lines;
}

function commentOptions(judge, score100, gaps, opts = {}) {
  const primary = gaps[0] || { axis: "sweet", abs: 0, sign: 0 };
  // A correct recipe (COTD / guess) must not read as a roast.
  if ((opts.recipePct || 0) >= 85) {
    return [
      ...praisePool(judge),
      `That's the one — well made.`,
      `${firstName(judge)} would drink this.`,
    ];
  }
  if (score100 >= 82) return praisePool(judge);
  if (score100 >= 78 && primary.abs < 0.35) {
    return [
      `Almost there — a touch ${TOO_MUCH[primary.axis] || "off"} for me.`,
      ...praisePool(judge).map((p) => p.replace(/!$/, " — nearly.")),
      ...balancedLines(judge),
    ];
  }
  if (primary.abs < 0.2) return balancedLines(judge);
  const intensity = intensityOf(primary.abs);
  const fromPrimary = primary.sign > 0
    ? overLines(judge, primary.axis, intensity)
    : underLines(judge, primary.axis, intensity);
  const secondary = gaps[1];
  const fromSecond = secondary && secondary.abs >= 0.18
    ? (secondary.sign > 0
      ? overLines(judge, secondary.axis, intensityOf(secondary.abs))
      : underLines(judge, secondary.axis, intensityOf(secondary.abs)))
    : [];
  const merged = [...fromPrimary, ...fromSecond];
  if (score100 >= 70) {
    return merged.filter((l) => !/struggle to serve|Way too/.test(l));
  }
  return merged;
}

function pickUnused(options, used) {
  for (const line of options) {
    if (line && !used.has(line)) return line;
  }
  return null;
}

// Pick `n` distinct random judges.
export function pickJudges(n = 3) {
  const pool = [...JUDGES];
  const out = [];
  while (out.length < n && pool.length) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

function judgeScore(judge, evalResult, opts = {}) {
  const p = evalResult.profile || {};
  // Still drinks (espresso martini, Manhattan) are not missing "bubbles".
  const stillDrink = (p.fizz || 0) < 0.18;
  const gaps = AXES.map((a) => {
    const d = (p[a] || 0) - (judge.ideal[a] || 0);
    return { axis: a, d, abs: Math.abs(d), sign: Math.sign(d) };
  }).filter((g) => !(stillDrink && g.axis === "fizz"))
    .sort((x, y) => y.abs - x.abs || AXES.indexOf(x.axis) - AXES.indexOf(y.axis));
  const totalDiff = gaps.reduce((s, g) => s + g.abs, 0);
  const worst = gaps[0];
  const match = clamp(1 - totalDiff / AXES.length, 0, 1);
  const quality = clamp((evalResult.score || 0) / 100, 0, 1);
  const raw = (quality * (1 - judge.weight) + match * judge.weight) * 100 + judge.bias;
  const score100 = Math.round(clamp(raw, 0, 100));
  const score10 = Math.round(score100 / 10);

  const options = commentOptions(judge, score100, gaps, opts);
  let reason;
  let tip;
  if (score100 >= 82) {
    reason = `This lands close to my ideal palate across sweetness, acidity, bitterness, strength and fizz.`;
    tip = "Don't overhaul it — tiny polish is all this needs.";
  } else if (!worst || worst.abs < 0.2) {
    reason = `Nothing is badly out of line for me. The balance is close, but it doesn't quite hit my sweet spot.`;
    tip = "Nudge one element at a time instead of making a big change.";
  } else if (worst.sign > 0) {
    reason = `For my palate, it overshoots on ${AXIS_LABEL[worst.axis]}. That's what pulled the score down most.`;
    tip = `Dial back what reads as ${TOO_MUCH[worst.axis]} and keep the rest steady.`;
  } else {
    reason = `For my palate, it's missing a bit of ${AXIS_LABEL[worst.axis]}. That's the main gap in the drink.`;
    tip = `Push it toward ${WANT_MORE[worst.axis]} without overpowering the other notes.`;
  }

  return {
    id: judge.id,
    name: judge.name,
    initials: judge.initials,
    title: judge.title,
    blurb: judge.blurb,
    breed: judge.breed || "",
    character: judge.character || "",
    story: judge.story || "",
    likes: judge.likes || "",
    dislikes: judge.dislikes || "",
    score: score10,
    score100,
    comment: options[0] || "Interesting pour.",
    commentOptions: options,
    reason,
    tip,
    focus: worst ? AXIS_LABEL[worst.axis] : "balance",
    palateMatch: Math.round(match * 100),
  };
}

function assignUniqueComments(panel) {
  const used = new Set();
  panel.forEach((seat) => {
    const picked = pickUnused(seat.commentOptions || [seat.comment], used);
    const comment = picked || `${firstName(seat)}: ${seat.comment}`;
    seat.comment = comment;
    used.add(comment);
    delete seat.commentOptions;
  });
}

function verdictFor(total) {
  if (total >= 85) return "Outstanding";
  if (total >= 70) return "Crowd-pleaser";
  if (total >= 55) return "Solid pour";
  if (total >= 40) return "Needs work";
  return "Back to the drawing board";
}

function starsFor(total) {
  if (total >= 90) return 5;
  if (total >= 75) return 4;
  if (total >= 60) return 3;
  if (total >= 45) return 2;
  if (total >= 30) return 1;
  return 0;
}

// Score a drink with a given (or random) trio of judges.
export function scoreWithJudges(evalResult, judges, opts = {}) {
  const panel = (judges && judges.length ? judges : pickJudges(3)).map((j) => judgeScore(j, evalResult, opts));
  assignUniqueComments(panel);
  const total = Math.round(panel.reduce((s, j) => s + j.score100, 0) / panel.length);
  return { judges: panel, total, stars: starsFor(total), verdict: verdictFor(total) };
}
