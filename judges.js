// ============================================================================
// Judges panel for the Mixologist "invent a new mix" mode.
// Given an evaluation result (from mixology.evaluate) we pick 3 of the 10
// judges and each scores the drink against their own palate. The panel's
// average becomes the headline score.
// ============================================================================
import { JUDGES } from "./data.js";

const AXES = ["strong", "sweet", "sour", "bitter", "fizz"];
const AXIS_LABEL = { strong: "strength", sweet: "sweetness", sour: "acidity", bitter: "bitterness", fizz: "fizz" };

const TOO_MUCH = { strong: "too boozy", sweet: "too sweet", sour: "too sharp", bitter: "too bitter", fizz: "too fizzy" };
const WANT_MORE = { strong: "more backbone", sweet: "more sweetness", sour: "more acidity", bitter: "more bitterness", fizz: "more sparkle" };

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Pick `n` distinct random judges.
export function pickJudges(n = 3) {
  const pool = [...JUDGES];
  const out = [];
  while (out.length < n && pool.length) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

function judgeScore(judge, evalResult) {
  const p = evalResult.profile || {};
  // How close the drink is to this judge's ideal palate (0..1).
  let totalDiff = 0;
  let worst = null;
  let worstAbs = -1;
  let worstSign = 0;
  AXES.forEach((a) => {
    const d = (p[a] || 0) - (judge.ideal[a] || 0);
    totalDiff += Math.abs(d);
    if (Math.abs(d) > worstAbs) { worstAbs = Math.abs(d); worst = a; worstSign = Math.sign(d); }
  });
  const match = clamp(1 - totalDiff / AXES.length, 0, 1);
  const quality = clamp((evalResult.score || 0) / 100, 0, 1);
  const raw = (quality * (1 - judge.weight) + match * judge.weight) * 100 + judge.bias;
  const score100 = Math.round(clamp(raw, 0, 100));
  const score10 = Math.round(score100 / 10);

  let comment;
  let reason;
  let tip;
  if (score100 >= 82) comment = praise(judge);
  else if (worstAbs < 0.2) comment = "Nicely balanced — to my taste.";
  else if (worstSign > 0) comment = `A bit ${TOO_MUCH[worst]} for me.`;
  else comment = `I'd want ${WANT_MORE[worst]}.`;

  if (score100 >= 82) {
    reason = `This lands close to my ideal palate across sweetness, acidity, bitterness, strength and fizz.`;
    tip = "Don't overhaul it — tiny polish is all this needs.";
  } else if (worstAbs < 0.2) {
    reason = `Nothing is badly out of line for me. The balance is close, but it doesn't quite hit my sweet spot.`;
    tip = "Nudge one element at a time instead of making a big change.";
  } else if (worstSign > 0) {
    reason = `For my palate, it overshoots on ${AXIS_LABEL[worst]}. That's what pulled the score down most.`;
    tip = `Dial back what reads as ${TOO_MUCH[worst]} and keep the rest steady.`;
  } else {
    reason = `For my palate, it's missing a bit of ${AXIS_LABEL[worst]}. That's the main gap in the drink.`;
    tip = `Push it toward ${WANT_MORE[worst]} without overpowering the other notes.`;
  }

  return {
    id: judge.id,
    name: judge.name,
    emoji: judge.emoji,
    blurb: judge.blurb,
    score: score10,
    score100,
    comment,
    reason,
    tip,
    focus: worst ? AXIS_LABEL[worst] : "balance",
    palateMatch: Math.round(match * 100),
  };
}

function praise(judge) {
  const lines = [
    "Exactly my kind of drink!",
    "Beautifully made — I'm impressed.",
    "I'd order this again. Bravo.",
    "Now that's a proper pour.",
  ];
  return lines[Math.floor(Math.random() * lines.length)];
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
export function scoreWithJudges(evalResult, judges) {
  const panel = (judges && judges.length ? judges : pickJudges(3)).map((j) => judgeScore(j, evalResult));
  const total = Math.round(panel.reduce((s, j) => s + j.score100, 0) / panel.length);
  return { judges: panel, total, stars: starsFor(total), verdict: verdictFor(total) };
}
