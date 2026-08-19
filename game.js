import {
  GLASSES,
  METHODS,
  INGREDIENTS,
  GARNISHES,
  RECIPES,
  MOCKTAILS,
  SHOTS,
  VENUES,
  VENUES_UNDER,
  RECIPE_BY_ID,
  generateCustomer,
  TOOLS,
  JUDGES,
  INGREDIENT_BY_ID,
  GLASS_BY_ID,
  METHOD_BY_ID,
  GARNISH_BY_ID,
  TOOL_BY_ID,
} from "./data.js";
import { Sound } from "./sound.js";
import * as Glass from "./glass.js";
import { evaluate, detectClassic, classicBlocksCommunityShare } from "./mixology.js";
import { scoreWithJudges, pickJudges } from "./judges.js";
import * as Backend from "./backend.js";

// ============================ Game state ============================
const state = {
  difficulty: "basic", // 'basic' | 'advanced' | 'mixologist'
  mode: "campaign", // 'campaign' | 'mixologist' | 'challenge' | 'endless'
  challenge: null, // recipe object when recreating a saved invention
  stage: 0,
  totalScore: 0,
  starsEarned: 0,
  steps: [],
  stepIndex: 0,
  mixed: false, // true once a shake/stir/blend has blended the liquids
  build: emptyBuild(),
  // Endless shift
  lives: 3,
  streak: 0,
  bestStreak: 0,
  served: 0,
  endlessRecipe: null,
  lastEndlessIdx: -1,
  customer: null,
  recentCustomerIds: [],
  trainingRecipe: null,
  cotdRecipe: null, // Cocktail of the Day target
  mixJudges: null, // judging panel result for the current invention
  complexity: null, // active complexity profile (portions/glass/method/menu)
  menuIds: null, // curated ingredient menu (Set of ids) or null for full pantry
  editingIngredientId: null, // Mixologist/Pour: one catalog chip expanded at a time
};

const STRICTNESS = "balanced";

function emptyBuild() {
  return { glass: null, method: null, garnish: null, ingredients: [] };
}

// One-time migrate localStorage keys from the old "Last Call" brand.
(function migrateLastCallKeys() {
  try {
    if (localStorage.getItem("dagtails_migrated") === "1") return;
    Object.keys(localStorage).forEach((k) => {
      if (!k.startsWith("lastcall_")) return;
      const next = "dagtails_" + k.slice("lastcall_".length);
      if (localStorage.getItem(next) == null) {
        localStorage.setItem(next, localStorage.getItem(k));
      }
      localStorage.removeItem(k);
    });
    try {
      const sid = sessionStorage.getItem("lastcall_session_id");
      if (sid && !sessionStorage.getItem("dagtails_session_id")) {
        sessionStorage.setItem("dagtails_session_id", sid);
      }
      sessionStorage.removeItem("lastcall_session_id");
    } catch (e) { /* ignore */ }
    localStorage.setItem("dagtails_migrated", "1");
  } catch (e) { /* ignore */ }
})();

// ============================ Player profile / age gate ============================
const PROFILE_KEY = "dagtails_profile";
const LEGAL_AGE = 18; // drinking-age threshold; under this = mocktails only

function getProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || "null"); } catch (e) { return null; }
}
function setProfile(p) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch (e) { /* ignore */ }
}
function isUnderage() {
  const p = getProfile();
  return !!p && Number(p.age) < LEGAL_AGE;
}
function genId() {
  return "p_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

// ---- Measurement units (metric ml / imperial oz) ----
// Liquids are always stored internally in ml; this layer converts for display.
const ML_PER_OZ = 29.5735;
function useImperial() { const p = getProfile(); return !!(p && p.units === "imperial"); }
function dispAmount(unit, ml) {
  if (unit === "ml" && useImperial()) return { val: Math.round((ml / ML_PER_OZ) * 4) / 4, label: "oz" };
  return { val: ml, label: unit };
}
function dispStep(unit) { return unit === "ml" ? (useImperial() ? 0.25 : 5) : 1; }
function toMl(unit, dispVal) { return (unit === "ml" && useImperial()) ? dispVal * ML_PER_OZ : dispVal; }

// ---- App settings (sound preferences) ----
const SETTINGS_KEY = "dagtails_settings";
function getSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null") || { sound: true }; }
  catch (e) { return { sound: true }; }
}
function setSettings(s) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } }

// Mixologist verdict layout. Default is the two-column UX card. Set
// localStorage dagtails_mix_result_layout=legacy, or open with ?mixLegacy=1,
// to restore the previous stacked card.
const MIX_LAYOUT_KEY = "dagtails_mix_result_layout";
function mixResultLegacyPreferred() {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get("mixLegacy") === "1" || q.get("mix-result") === "legacy") return true;
    if (q.get("mix-result") === "ux" || q.get("mixLegacy") === "0") return false;
    return localStorage.getItem(MIX_LAYOUT_KEY) === "legacy";
  } catch (e) {
    return false;
  }
}
function mixChromeCompact() {
  try {
    return !mixResultLegacyPreferred() && window.matchMedia("(max-width: 740px)").matches;
  } catch (e) {
    return false;
  }
}
function applyMixResultLayout() {
  const legacy = mixResultLegacyPreferred();
  document.body.classList.toggle("mix-result-legacy", legacy);
  const compact = mixChromeCompact();
  const quit = $("#btn-mix-quit");
  if (quit) quit.textContent = legacy ? "Quit to menu" : "Quit";
  const shop = $("#btn-mix-shop");
  if (shop && !shop.disabled) {
    shop.textContent = legacy ? "🛍 Shop the gear" : compact ? "Shop" : "Shop gear · demo";
  }
  const save = $("#btn-mix-save");
  if (save && !save.disabled) save.textContent = compact ? "Save" : "Save to My Bar";
  const tweak = $("#btn-mix-tweak");
  if (tweak) tweak.textContent = compact ? "Tweak" : "Tweak it";
  const another = $("#btn-mix-another");
  if (another) another.textContent = compact ? "Another →" : "Make another →";
  const dbg = $("#dbg-mix-layout");
  if (dbg) dbg.textContent = legacy ? "Mix result: Legacy" : "Mix result: UX";
  try {
    if (lastMix) applyMixShareLock(lastMix.result && lastMix.result.classic);
  } catch (e) { /* lastMix not initialized yet */ }
}

function applyMixShareLock(classic) {
  const shareBtn = $("#btn-mix-share");
  if (!shareBtn) return;
  const blocked = classicBlocksCommunityShare(classic);
  const legacy = mixResultLegacyPreferred();
  shareBtn.disabled = blocked;
  shareBtn.setAttribute("aria-disabled", blocked ? "true" : "false");
  if (blocked) {
    shareBtn.textContent = "Can't share";
    shareBtn.title = classicShareBlockMessage(classic);
  } else {
    shareBtn.textContent = legacy ? "🌐 Share" : "Share";
    shareBtn.removeAttribute("title");
  }
}

// ============================ Diagnostics / analytics ============================
// Lightweight, privacy-friendly product analytics: every event is kept in a
// capped local log (so you can inspect it on-device via the debug panel) and
// also forwarded to Supabase when the backend is configured, so you can see
// usage across every player from the SQL editor. Never blocks or throws.
const ANALYTICS_KEY = "dagtails_analytics_log";
const ANALYTICS_MAX = 300;
const DEVICE_KEY = "dagtails_device_id";
const SESSION_KEY = "dagtails_session_id";
const SESSION_N_KEY = "dagtails_session_n";
const SESSION_GAP_MS = 30 * 60 * 1000;
const APP_VERSION = "1.14.1";

let sessionId = null;
let sessionN = 0;
let sessionStartedAt = 0;
let sessionLastActive = 0;
let sessionEnded = false;
let drinksServedSession = 0;
let lastScreenId = "screen-splash";
let drinkOpen = false;
let drinkStartedAt = 0;
let stepsBack = 0;
let lastMapViewKey = "";
let introSource = "first_run";

function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = "d_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch (e) {
    return "d_ephemeral";
  }
}

function analyticsPlatform() {
  try {
    const cap = window.Capacitor;
    if (cap && typeof cap.getPlatform === "function") {
      const p = cap.getPlatform();
      if (p === "ios" || p === "android") return p;
    }
  } catch (e) { /* ignore */ }
  const ua = navigator.userAgent || "";
  if (/Expo|Exponent/i.test(ua)) {
    if (/Android/i.test(ua)) return "android";
    if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  }
  return "web";
}

function getAnalyticsLog() {
  try { return JSON.parse(localStorage.getItem(ANALYTICS_KEY) || "[]"); } catch (e) { return []; }
}
function clearAnalyticsLog() { try { localStorage.removeItem(ANALYTICS_KEY); } catch (e) { /* ignore */ } }

function bumpSession() {
  sessionId = genId();
  sessionStartedAt = Date.now();
  sessionLastActive = sessionStartedAt;
  sessionEnded = false;
  drinksServedSession = 0;
  try {
    sessionStorage.setItem(SESSION_KEY, sessionId);
    sessionN = (parseInt(localStorage.getItem(SESSION_N_KEY) || "0", 10) || 0) + 1;
    localStorage.setItem(SESSION_N_KEY, String(sessionN));
  } catch (e) {
    sessionN += 1;
  }
}

function sessionStartProps() {
  let streak = 0;
  let cleared = 0;
  try { streak = getDaily().streak || 0; } catch (e) { /* ignore */ }
  try { cleared = getMap().cleared || 0; } catch (e) { /* ignore */ }
  return {
    session_n: sessionN,
    returning: !!getProfile(),
    streak,
    cleared,
  };
}

function emitSessionEnd(reason) {
  if (!sessionId || sessionEnded) return;
  sessionEnded = true;
  track("session_end", {
    duration_ms: Math.max(0, Date.now() - sessionStartedAt),
    drinks_served: drinksServedSession,
    last_screen: lastScreenId,
    reason,
  });
}

function ensureSession() {
  const now = Date.now();
  if (!sessionId || sessionEnded) {
    bumpSession();
    track("session_start", sessionStartProps());
  } else if (now - sessionLastActive > SESSION_GAP_MS) {
    emitSessionEnd("timeout");
    bumpSession();
    track("session_start", sessionStartProps());
  }
  sessionLastActive = now;
}

function superProps() {
  let pointer = "fine";
  try { pointer = window.matchMedia("(pointer: coarse)").matches ? "coarse" : "fine"; } catch (e) { /* ignore */ }
  const vp = typeof liveViewport === "function" ? liveViewport() : { winW: 0, winH: 0 };
  const p = getProfile();
  let cleared = 0;
  try { cleared = getMap().cleared || 0; } catch (e) { /* ignore */ }
  let automation = false;
  try { automation = !!navigator.webdriver; } catch (e) { /* ignore */ }
  let host = "";
  try { host = location.hostname || ""; } catch (e) { /* ignore */ }
  return {
    device_id: getDeviceId(),
    session: sessionId,
    session_id: sessionId,
    platform: analyticsPlatform(),
    build: APP_VERSION,
    underage: p ? isUnderage() : null,
    units: p ? (p.units || "metric") : null,
    returning: !!p,
    viewport_w: vp.winW,
    viewport_h: vp.winH,
    pointer,
    cleared,
    automation,
    host,
  };
}

function track(name, props = {}) {
  try {
    if (name !== "session_start" && name !== "session_end") ensureSession();
    const merged = { ...superProps(), ...props };
    const log = getAnalyticsLog();
    log.push({ name, props: merged, t: Date.now() });
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(log.slice(-ANALYTICS_MAX)));
    Backend.logEvent(name, merged);
  } catch (e) { /* ignore */ }
}

function drinkContext() {
  if (state.mode === "mixologist") {
    return { mode: "mixologist", stage: null, recipe_id: null, venue_id: null, complexity: "Sandbox" };
  }
  const recipe = typeof currentRecipe === "function" ? currentRecipe() : null;
  const venue = recipe && typeof venueOf === "function" ? venueOf(recipe) : null;
  const stop = typeof venueForStage === "function" ? venueForStage(state.stage) : null;
  return {
    mode: state.mode,
    stage: state.mode === "campaign" ? state.stage + 1 : null,
    recipe_id: recipe && recipe.id ? recipe.id : null,
    venue_id: (venue && venue.id) || (stop && stop.venue && stop.venue.id) || null,
    complexity: (state.complexity && state.complexity.label) || null,
  };
}

function beginDrink() {
  drinkOpen = true;
  drinkStartedAt = Date.now();
  stepsBack = 0;
}

function trackDrinkStarted(extra = {}) {
  beginDrink();
  track("stage_started", { ...drinkContext(), ...extra });
}

function skillFlag(item) {
  if (!item) return null;
  if (item.kind === "auto") return "auto";
  if (item.kind === "ok") return "ok";
  if (item.kind === "near") return "near";
  return "miss";
}

function scoreProps(result) {
  const fb = (result && result.feedback) || [];
  const glassFb = fb.find((x) => x.label === "Glass");
  const methodFb = fb.find((x) => x.label === "Method");
  const garnishFb = fb.find((x) => x.label === "Garnish");
  const pours = fb.filter((x) => x.label !== "Glass" && x.label !== "Method" && x.label !== "Garnish");
  return {
    duration_ms: drinkStartedAt ? Date.now() - drinkStartedAt : 0,
    stars: result ? result.stars : null,
    pct: result && result.blended != null ? result.blended : (result ? result.pct : null),
    glass_ok: skillFlag(glassFb),
    method_ok: skillFlag(methodFb),
    garnish_ok: skillFlag(garnishFb),
    pour_ok: pours.filter((x) => x.kind === "ok").length,
    pour_near: pours.filter((x) => x.kind === "near").length,
    pour_miss: pours.filter((x) => x.kind === "bad").length,
    steps_back: stepsBack,
  };
}

function trackDrinkServed(result) {
  drinkOpen = false;
  drinksServedSession += 1;
  const recipe = typeof currentRecipe === "function" ? currentRecipe() : null;
  track("stage_result", {
    ...drinkContext(),
    recipe: recipe ? recipe.name : null,
    ...scoreProps(result),
  });
}

function drinkAbandoned(reason) {
  if (!drinkOpen) return;
  drinkOpen = false;
  const step = (state.steps && state.steps[state.stepIndex]) || null;
  track("drink_abandoned", {
    ...drinkContext(),
    last_step: step,
    duration_ms: drinkStartedAt ? Date.now() - drinkStartedAt : 0,
    ingredients_n: (state.build && state.build.ingredients ? state.build.ingredients.length : 0),
    steps_back: stepsBack,
    reason,
  });
}

function trackMapView() {
  const venue = (typeof focusedVenue === "function" && focusedVenue())
    || (typeof currentHubVenue === "function" && currentHubVenue())
    || null;
  const key = `${(venue && venue.id) || ""}:${mapStep}`;
  if (key === lastMapViewKey) return;
  lastMapViewKey = key;
  let frontier = 1;
  try { frontier = (getMap().cleared || 0) + 1; } catch (e) { /* ignore */ }
  track("map_view", {
    venue_id: venue && venue.id ? venue.id : null,
    step: mapStep,
    frontier_stage: frontier,
  });
}

function bootAnalytics() {
  bumpSession();
  track("session_start", sessionStartProps());
  track("app_open", { returning: !!getProfile() });
}

function wireAnalyticsLifecycle() {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      try { Backend.flushEvents({ keepalive: true }); } catch (e) { /* ignore */ }
      return;
    }
    ensureSession();
  });
  window.addEventListener("pagehide", (e) => {
    try { Backend.flushEvents({ keepalive: true }); } catch (err) { /* ignore */ }
    if (!e.persisted) emitSessionEnd("pagehide");
  });
}

// Intro comic: shown once after sign-up, before the first level (replayable in Settings).
const INTRO_KEY = "dagtails_intro_seen";
function introSeen() { try { return localStorage.getItem(INTRO_KEY) === "1"; } catch (e) { return false; } }
function markIntroSeen() { try { localStorage.setItem(INTRO_KEY, "1"); } catch (e) { /* ignore */ } }

// Reflect the saved profile + hub chrome via the React hub bridge.
function welcomeCopy() {
  const p = getProfile();
  if (!p) {
    return { main: "Welcome.", sub: "Your next shift is ready." };
  }

  const m = getMap();
  const d = getDaily();
  const prog = getProgress();
  const total = drinkPool().length;
  const cleared = m.cleared || 0;
  const nextStage = Math.min(cleared + 1, total);
  const firstTime = cleared === 0 && (prog.served || 0) === 0;
  const playedToday = d.last === todayStr();

  const main = `Welcome back, ${p.name}.`;

  if (firstTime) {
    return {
      main,
      sub: isUnderage()
        ? "Your first mocktail shift is ready."
        : "Your first shift is ready. Old Tom is waiting at the bar.",
    };
  }
  if (cleared >= total) {
    return {
      main,
      sub: "You cleared the whole journey. Replay a favorite, try today's cocktail, or head into Mixologist.",
    };
  }
  if (playedToday && d.streak > 1) {
    return { main, sub: `Your ${d.streak}-day streak is alive. Stage ${nextStage} is ready.` };
  }
  if (playedToday) {
    return { main, sub: `Stage ${nextStage} is ready whenever you are.` };
  }
  if (d.streak > 1) {
    return { main, sub: `Stage ${nextStage} is ready. Keep your ${d.streak}-day streak alive tonight.` };
  }
  return {
    main,
    sub: isUnderage()
      ? `Stage ${nextStage} is ready in the mocktail bar.`
      : `Stage ${nextStage} is ready. Cocktail of the Day is waiting too.`,
  };
}

function playMetaCopy() {
  const pool = drinkPool();
  if (!pool.length) return "";
  const map = getMap();
  const cleared = map.cleared || 0;
  const isComplete = cleared >= pool.length;
  const at = venueForStage(Math.min(cleared, pool.length - 1));
  const v = at.venue;
  return isComplete
    ? `Crawl complete · ${v.flag} ${v.name} — tap to revisit any stop`
    : `Stop ${Math.min(cleared + 1, pool.length)} of ${pool.length} · ${v.flag} ${v.name} — tap to open the map`;
}

function rememberHubVenue(venue) {
  if (!venue?.id) return;
  selectedVenueId = venue.id;
  const m = getMap();
  if (m.hubVenueId !== venue.id) {
    m.hubVenueId = venue.id;
    setMap(m);
  }
}

/** Bar the hub should show: last unlocked stop you stood in, else the crawl frontier. */
function currentHubVenue() {
  const venues = venueList();
  if (!venues.length) return null;
  const cleared = getMap().cleared || 0;
  const remembered = selectedVenueId || getMap().hubVenueId;
  const fromMemory = remembered && venues.find((v) => v.id === remembered);
  if (fromMemory && !venueStatus(fromMemory, cleared).locked) return fromMemory;
  const pool = drinkPool();
  if (!pool.length) return venues[0];
  return venueForStage(frontierStageIndex()).venue;
}

function currentHubVenueBg() {
  const venue = currentHubVenue();
  const path = venue && (venue.interior || venue.bg);
  return path ? resolveAssetUrl(path) : "";
}

function currentHubVenueChrome() {
  const venue = currentHubVenue();
  return {
    currentVenueBg: currentHubVenueBg(),
    mascotFloor: venue?.mascotFloor || "8%",
    hubBgSize: venue?.hubBgSize || "175%",
    hubBgPos: venue?.hubBgPos || "20% 72%",
  };
}

function bestScoreCopy() {
  const best = getHighScore();
  const eb = getEndlessBest();
  const parts = [];
  if (best > 0) parts.push(`🏅 Best shift: ${best} pts`);
  if (eb > 0) parts.push(`🔥 Endless: ${eb} pts`);
  return parts.join("  ·  ");
}

function buildHubSnapshot() {
  const p = getProfile();
  const prog = getProgress();
  const daily = getDaily();
  const map = getMap();
  const lvl = levelForXp(prog.xp);
  const rk = rankInfo(rankForCleared(map.cleared || 0));
  const welcome = welcomeCopy();
  const { recipe, done } = todaysCotd();
  const ok = mapUnlocked();
  const left = Math.max(0, STAGES_TO_UNLOCK - (map.cleared || 0));
  const noun = isUnderage() ? "mocktails" : "drinks";

  let journeyLabel = "▶ Play the Journey";
  if ((map.cleared || 0) === 0 && (prog.served || 0) === 0) {
    journeyLabel = "▶ Start the Journey";
  } else if ((map.cleared || 0) >= drinkPool().length) {
    journeyLabel = "▶ Replay the Journey";
  } else {
    journeyLabel = `▶ Continue Journey · Stage ${Math.min((map.cleared || 0) + 1, drinkPool().length)}`;
  }

  return {
    profileVisible: !!p,
    profileChip: p
      ? `👤 ${p.name}${p.age ? " · " + p.age : ""}${isUnderage() ? " · 🧃" : " · 🔞"}`
      : "",
    mocktailMode: isUnderage(),
    streak: daily.streak || 0,
    levelLabel: `Lv ${lvl}`,
    rankName: rk.name,
    stars: totalStars(),
    welcomeMain: welcome.main,
    welcomeSub: welcome.sub,
    mascotTier: mascotTierClass(rankForCleared(map.cleared || 0)),
    cotdName: recipe ? recipe.name : "—",
    cotdDone: !!done,
    cotdBtnLabel: done ? "Done today ✓" : "Make it →",
    journeyLabel,
    modesUnlocked: ok,
    unlockLeft: left,
    endlessSub: ok ? "No recipe — survive the rush" : `Locked · ${left} to go`,
    mixSub: ok ? "Invent & share your own drinks" : `Locked · ${left} to go`,
    playMeta: playMetaCopy(),
    badgesLabel: `🏅 Badges (${getEarned().length}/${BADGES.length})`,
    bestLine: bestScoreCopy(),
    footerHtml: `🍸 ${drinkPool().length} ${noun} &nbsp;•&nbsp; ${MEASURE_ENABLED ? "precision pours" : "spot the ingredients"} &nbsp;•&nbsp; earn your stars`,
    ...currentHubVenueChrome(),
  };
}

function refreshHub() {
  try {
    window.DagTailsHub?.refresh(buildHubSnapshot());
  } catch (e) { /* hub not mounted yet */ }
}

/** @deprecated DOM hub removed — kept as alias for call sites. */
function applyProfile() { refreshHub(); }
function renderStartWelcome() { refreshHub(); }
function renderPlayMeta() { refreshHub(); }
function renderHubMascot() { refreshHub(); }

// Brand splash shown on every boot before hub / credentials.
function renderSplash() {
  const p = getProfile();
  const greet = $("#splash-greet");
  const sub = $("#splash-sub");
  const continueBtn = $("#btn-splash-continue");
  if (!greet || !sub) return;

  const chipLevel = $("#splash-chip-level");
  const chipStreak = $("#splash-chip-streak");
  const chipStars = $("#splash-chip-stars");

  if (!p) {
    greet.textContent = "Welcome to DAG Tails.";
    sub.textContent = "A bartending game from DAG.com — tap to set up your bartender and begin.";
    if (continueBtn) continueBtn.textContent = "Get started →";
    if (chipLevel) chipLevel.textContent = "";
    if (chipStreak) chipStreak.textContent = "";
    if (chipStars) chipStars.textContent = "";
    return;
  }

  if (continueBtn) continueBtn.textContent = "Enter the bar →";

  const map = getMap();
  const daily = getDaily();
  const prog = getProgress();
  const total = drinkPool().length;
  const cleared = map.cleared || 0;
  const nextStage = Math.min(cleared + 1, total);
  const lvl = levelForXp(prog.xp);
  const rk = rankInfo(rankForCleared(cleared));

  greet.textContent = `Welcome back, ${p.name}.`;
  if (cleared >= total) {
    sub.textContent = "You cleared the whole journey. Replay a favorite or try Mixologist.";
  } else if (daily.streak > 1) {
    sub.textContent = `Your ${daily.streak}-day streak is alive. Stage ${nextStage} is ready.`;
  } else {
    sub.textContent = isUnderage()
      ? `Stage ${nextStage} is ready in the mocktail bar.`
      : `Stage ${nextStage} is ready whenever you are.`;
  }

  if (chipLevel) chipLevel.textContent = `${rk.emoji} Lv ${lvl} · ${rk.name}`;
  if (chipStreak) chipStreak.textContent = daily.streak > 0 ? `🔥 ${daily.streak}-day streak` : "🔥 Start a streak today";
  if (chipStars) chipStars.textContent = `⭐ ${totalStars()} stars`;
}

function dismissSplash() {
  track("splash_continue", { returning: !!getProfile() });
  onShowStart();
  showScreen("screen-start");
  if (!getProfile()) openProfileForm(true);
}

function nextRewardCopy(map, prog) {
  const cleared = map.cleared || 0;
  const lvl = levelForXp(prog.xp);
  const inLvl = (prog.xp || 0) % XP_PER_LEVEL;
  if (!mapUnlocked()) {
    const left = Math.max(0, STAGES_TO_UNLOCK - cleared);
    return {
      main: "Unlock Endless & Mixologist",
      sub: `Clear ${left} more stage${left === 1 ? "" : "s"} to open the wider bar.`,
    };
  }
  const venues = venueList();
  const at = venueForStage(Math.min(cleared, Math.max(0, drinkPool().length - 1)));
  const nextVenue = venues[at.venueIndex + 1];
  if (nextVenue && cleared < drinkPool().length) {
    const left = Math.max(1, at.end + 1 - cleared);
    return {
      main: `${nextVenue.flag} Next stop: ${nextVenue.name}`,
      sub: `${left} more clear${left === 1 ? "" : "s"} in ${at.venue.name} to hop onward.`,
    };
  }
  return {
    main: `Reach Lv ${lvl + 1}`,
    sub: `${Math.max(1, XP_PER_LEVEL - inLvl)} XP until the next level.`,
  };
}

// The apprentice duck mascot visually levels up as the player climbs bartender
// titles (still paced by cleared stages, independent of crawl venues):
// hoodie -> flight jacket + shades -> full "ace" look.
function mascotTierClass(rankIdx) {
  if (rankIdx >= 5) return "tier-3";
  if (rankIdx >= 2) return "tier-2";
  return "";
}
function applyMascotTier(el, rankIdx) {
  if (!el) return;
  const tier = mascotTierClass(rankIdx);
  el.classList.toggle("tier-2", tier === "tier-2");
  el.classList.toggle("tier-3", tier === "tier-3");
}

// ============================ Drink pools & difficulty ============================
// Difficulty is derived from ingredient count + preparation complexity.
function methodWeight(m) {
  return { build: 0, stir: 0.5, shake: 0.5, blend: 0.5, muddle: 1 }[m] ?? 0.5;
}
function computeDifficulty(r) {
  const raw = r.ingredients.length + methodWeight(r.method);
  if (raw <= 2.5) return 1;
  if (raw <= 3.5) return 2;
  if (raw <= 4.5) return 3;
  if (raw <= 5.5) return 4;
  return 5;
}
const TIER_LABEL = { 1: "Easy", 2: "Easy", 3: "Medium", 4: "Hard", 5: "Expert" };

let POOL_ADULT = [];
let POOL_UNDER = [];
function tagDrinks(list, kind) {
  list.forEach((r) => { r.kind = kind; r.diff = computeDifficulty(r); });
}
// Flatten venue drinkIds into a pool; any leftover recipes append by difficulty
// so a typo in the venue list never silently drops a drink.
function poolFromVenues(venues, catalogs) {
  const byId = Object.fromEntries(catalogs.flat().map((r) => [r.id, r]));
  const seen = new Set();
  const ordered = [];
  venues.forEach((v) => {
    (v.drinkIds || []).forEach((id) => {
      const r = byId[id];
      if (!r || seen.has(id)) return;
      seen.add(id);
      ordered.push(r);
    });
  });
  const leftovers = catalogs.flat().filter((r) => !seen.has(r.id)).sort((a, b) => a.diff - b.diff);
  return ordered.concat(leftovers);
}
function buildPools() {
  tagDrinks(RECIPES, "cocktail");
  tagDrinks(SHOTS, "shot");
  tagDrinks(MOCKTAILS, "mocktail");
  POOL_ADULT = poolFromVenues(VENUES, [RECIPES, SHOTS]);
  POOL_UNDER = poolFromVenues(VENUES_UNDER, [MOCKTAILS]);
}
buildPools();
function drinkPool() {
  return isUnderage() ? POOL_UNDER : POOL_ADULT;
}
function venueList() {
  return isUnderage() ? VENUES_UNDER : VENUES;
}
// Which venue owns this stage index (and the stage range it covers).
function venueForStage(index) {
  const venues = venueList();
  let cursor = 0;
  for (let i = 0; i < venues.length; i++) {
    const n = (venues[i].drinkIds || []).length;
    if (index < cursor + n) {
      return { venue: venues[i], venueIndex: i, start: cursor, end: cursor + n - 1, count: n };
    }
    cursor += n;
  }
  // Leftover drinks past the last venue definition.
  const last = venues[venues.length - 1];
  return { venue: last, venueIndex: Math.max(0, venues.length - 1), start: cursor, end: drinkPool().length - 1, count: Math.max(1, drinkPool().length - cursor) };
}
function venueOf(recipe) {
  if (!recipe) return null;
  return venueList().find((v) => (v.drinkIds || []).includes(recipe.id)) || null;
}
function venueIndexForCleared(cleared) {
  if (cleared <= 0) return 0;
  return venueForStage(Math.min(cleared, drinkPool().length) - 1).venueIndex;
}

// ============================ Stage map / bartender ranks / complexity ============================
const MAP_KEY = "dagtails_map";
const STAGES_TO_UNLOCK = 5; // clear this many to unlock Endless + Mixologist
// Player identity titles (topbar / hub) — independent of the bar-crawl venues.
const RANKS = [
  { emoji: "🧽", name: "Trainee" },
  { emoji: "🍋", name: "Barback" },
  { emoji: "🥃", name: "Bartender" },
  { emoji: "🍸", name: "Mixologist" },
  { emoji: "🎩", name: "Head Bartender" },
  { emoji: "🏆", name: "Master Mixologist" },
  { emoji: "👑", name: "Bar Legend" },
];
const STAGES_PER_RANK = 8; // only used for player title pacing from cleared count
function rankInfo(idx) { return RANKS[Math.min(Math.max(0, idx), RANKS.length - 1)]; }
function rankForCleared(count) { return Math.floor((count || 0) / STAGES_PER_RANK); }

// Journey progress: { cleared, records: { [recipeId]: { stars, pct } }, seenTiers }.
// Records are keyed by recipe id, not pool index: the pool is re-sorted by
// computed difficulty and swaps entirely for underage profiles, so an
// index-keyed record would quietly attach itself to a different drink.
function readMap() {
  let m = null;
  try { m = JSON.parse(localStorage.getItem(MAP_KEY) || "null"); } catch (e) { m = null; }
  if (!m || typeof m !== "object") m = {};
  m.cleared = Number(m.cleared) || 0;
  if (!m.records || typeof m.records !== "object") m.records = {};
  return m;
}
// Older saves kept stars in an index-keyed `stars` map. Fold those into the
// id-keyed records once, looking up indexes against the *pre-venue* difficulty
// sort so a bar-hop reorder can't attach stars to the wrong drink.
function legacyPoolForMigration() {
  const list = isUnderage() ? [...MOCKTAILS] : [...RECIPES, ...SHOTS];
  return list
    .map((r) => ({ r, diff: computeDifficulty(r) }))
    .sort((a, b) => a.diff - b.diff)
    .map((x) => x.r);
}
function migrateStageRecords(m) {
  if (m.recordsMigrated) return false;
  const pool = legacyPoolForMigration();
  // Without a pool there's nothing to map indexes onto — try again next read
  // rather than burning the migration flag and dropping the legacy stars.
  if (!pool.length) return false;
  const legacy = m.stars && typeof m.stars === "object" ? m.stars : {};
  Object.keys(legacy).forEach((key) => {
    const recipe = pool[Number(key)];
    const stars = Number(legacy[key]) || 0;
    if (!recipe || stars <= 0) return;
    const prev = m.records[recipe.id];
    if (!prev || stars > (prev.stars || 0)) {
      m.records[recipe.id] = { stars, pct: (prev && prev.pct) || 0 };
    }
  });
  m.recordsMigrated = 1;
  return true;
}
function getMap() {
  const m = readMap();
  if (migrateStageRecords(m)) setMap(m);
  return m;
}
function setMap(m) { try { localStorage.setItem(MAP_KEY, JSON.stringify(m)); } catch (e) { /* ignore */ } }
// Best result a player has ever posted on a stage, as { stars, pct }.
function stageRecordOf(m, recipe) {
  const rec = recipe && m && m.records ? m.records[recipe.id] : null;
  return { stars: (rec && rec.stars) || 0, pct: (rec && rec.pct) || 0 };
}
function totalStars() {
  return Object.values(getMap().records || {}).reduce((a, r) => a + ((r && r.stars) || 0), 0);
}
function mapUnlocked() { return getMap().cleared >= STAGES_TO_UNLOCK; }

// Flip to true to restore amount steppers + pour scoring. Held off for now —
// the base game is ingredient guessing only (recipe amounts auto-fill).
const MEASURE_ENABLED = false;
// Flip to true to restore the tools / method picker step. Held off — recipe
// method is auto-applied (shake/stir/build still run on Serve).
const TOOLS_ENABLED = false;
// Flip to true to restore the garnish picker step. Held off — recipe garnish auto-applies.
const GARNISH_ENABLED = false;
// Flip to true to restore the glass picker step. Held off — recipe glass auto-applies.
const GLASS_ENABLED = false;

// What's new at each complexity tier — shown once when first reached.
const TIER_INTRO = {
  "Guess": { emoji: "🔎", eyebrow: "Your first stage", title: "Spot the ingredients", body: "Tap the ingredients you think belong in the drink — no measuring. Get the right ones in the glass, then serve.", button: "Let's go →" },
  "Pour": { emoji: "🥤", eyebrow: "Level up — new rule", title: "Now measure your pours", body: "From here on you set how much of each ingredient goes in. Tap to add, then use − / + to dial each amount. Get close to the recipe for more stars.", button: "Got it →" },
  "Mix": { emoji: "🍸", eyebrow: "Level up — new rule", title: "Tools before the pour", body: "From here you choose the method first — shaker, stir, muddle, and more. Tools land on the counter, then you pour into them, then prepare.", button: "Got it →" },
  "Garnish": { emoji: "🍋", eyebrow: "Level up — new rule", title: "Now add the garnish", body: "Until now the garnish was added for you. From here you finish the drink yourself — pick the garnish that matches the cocktail for that last star.", button: "Got it →" },
  "Full bar": { emoji: "🍷", eyebrow: "Level up — full bar", title: "Now pick the glass too", body: "You're running the full bar: choose the glassware yourself. Every choice counts toward your stars.", button: "Got it →" },
};
function tierSeen(label) { const m = getMap(); return !!(m.seenTiers && m.seenTiers[label]); }
function markTierSeen(label) { const m = getMap(); m.seenTiers = m.seenTiers || {}; m.seenTiers[label] = 1; setMap(m); }

/** True when the player only picks ingredients (no −/+ amounts). Mixologist stays free-pour. */
function isGuessMode() {
  if (state.mode === "mixologist") return false;
  if (!MEASURE_ENABLED) return true;
  return !!(state.complexity && state.complexity.portions === false);
}

// Complexity ramp — start simple, scale up. stageNo is 1-based.
// Mechanics unlock: measure / tools / garnish when enabled → glass.
function complexityForStage(stageNo) {
  const portions = MEASURE_ENABLED;
  const chooseGlass = GLASS_ENABLED;
  const chooseMethod = TOOLS_ENABLED;
  const chooseGarnish = GARNISH_ENABLED;
  if (stageNo <= 5)  return { portions: false, chooseGlass: false, chooseMethod: false, chooseGarnish: false, decoys: 3,  label: "Guess" };
  // When held mechanics are off, keep the "Guess" label so their intros never fire.
  if (stageNo <= 12) return { portions, chooseGlass: false, chooseMethod: false, chooseGarnish: false, decoys: 6,  label: portions ? "Pour" : "Guess" };
  if (stageNo <= 19) return { portions, chooseGlass: false, chooseMethod, chooseGarnish: false, decoys: 10, label: chooseMethod ? "Mix" : "Guess" };
  if (stageNo <= 26) return { portions, chooseGlass: false, chooseMethod, chooseGarnish, decoys: 12, label: chooseGarnish ? "Garnish" : "Guess" };
  return { portions, chooseGlass, chooseMethod, chooseGarnish, decoys: Infinity, label: chooseGlass ? "Full bar" : "Guess" };
}

function shuffleArr(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Curated short ingredient menu: the required ones + a few decoys, shuffled.
function buildMenu(recipe, decoys) {
  if (decoys === Infinity) return null; // null = show the full pantry
  const pantry = isUnderage() ? INGREDIENTS.filter((i) => (i.mx?.abv || 0) === 0) : INGREDIENTS;
  const required = recipe.ingredients.map((i) => i.id);
  const reqSet = new Set(required);
  const decoyPool = shuffleArr(pantry.filter((i) => !reqSet.has(i.id)).map((i) => i.id)).slice(0, decoys);
  return new Set(shuffleArr([...required, ...decoyPool]));
}

function stepsFor(cx) {
  const s = [];
  if (cx.chooseGlass) s.push("glass");
  // Tools / method first so the shaker, mixing glass, or muddler is on the
  // counter before anything is poured.
  if (cx.chooseMethod) s.push("method");
  s.push("ingredients");
  if (cx.chooseGarnish) s.push("garnish");
  return s;
}

// Apply a complexity profile to the current build: auto-fill what isn't chosen.
function applyComplexity(cx, recipe) {
  state.complexity = cx;
  if (!cx.chooseGlass) state.build.glass = recipe.glass;
  if (!cx.chooseMethod) state.build.method = recipe.method;
  if (!cx.chooseGarnish) state.build.garnish = recipe.garnish[0];
  state.menuIds = buildMenu(recipe, cx.decoys);
  state.steps = stepsFor(cx);
  state.stepIndex = 0;
}

// ============================ Progression / XP / unlocks ============================
const PROGRESS_KEY = "dagtails_progress";
const XP_PER_LEVEL = 120;
const UNLOCKS = { endless: 2, advanced: 2, mixologist: 3 };

function getProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "null") || { xp: 0, served: 0, perfects: 0 }; }
  catch (e) { return { xp: 0, served: 0, perfects: 0 }; }
}
function setProgress(p) { try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch (e) { /* ignore */ } }
function levelForXp(xp) { return 1 + Math.floor((xp || 0) / XP_PER_LEVEL); }
function isUnlocked(key) { return levelForXp(getProgress().xp) >= (UNLOCKS[key] || 1); }

function recordResult(result) {
  const p = getProgress();
  p.xp = (p.xp || 0) + (result.stagePoints || 0) + (result.tip || 0);
  p.served = (p.served || 0) + 1;
  if (result.stars === 3) p.perfects = (p.perfects || 0) + 1;
  setProgress(p);
  checkBadges();
}

// ============================ Daily streak ============================
const DAILY_KEY = "dagtails_daily";
function todayStr() { return new Date().toISOString().slice(0, 10); }
function ydayStr() { return new Date(Date.now() - 86400000).toISOString().slice(0, 10); }
function getDaily() {
  try { return JSON.parse(localStorage.getItem(DAILY_KEY) || "null") || { last: null, streak: 0, best: 0, days: 0 }; }
  catch (e) { return { last: null, streak: 0, best: 0, days: 0 }; }
}
function setDaily(d) { try { localStorage.setItem(DAILY_KEY, JSON.stringify(d)); } catch (e) { /* ignore */ } }
function recordPlayDay() {
  const d = getDaily();
  const t = todayStr();
  if (d.last === t) return d;
  d.streak = d.last === ydayStr() ? (d.streak || 0) + 1 : 1;
  d.best = Math.max(d.best || 0, d.streak);
  d.days = (d.days || 0) + 1;
  d.last = t;
  setDaily(d);
  checkBadges();
  return d;
}

// ============================ Cocktail of the Day ============================
const COTD_KEY = "dagtails_cotd";
function getCotd() {
  try { return JSON.parse(localStorage.getItem(COTD_KEY) || "null") || { date: null, id: null, queue: [], doneDate: null, count: 0 }; }
  catch (e) { return { date: null, id: null, queue: [], doneDate: null, count: 0 }; }
}
function setCotd(c) { try { localStorage.setItem(COTD_KEY, JSON.stringify(c)); } catch (e) { /* ignore */ } }
function shuffle(a) { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }
// Returns { recipe, done } for today. Picks from a no-repeat shuffled queue.
function todaysCotd() {
  const pool = drinkPool();
  const c = getCotd();
  const t = todayStr();
  if (c.date === t && c.id) {
    const r = pool.find((x) => x.id === c.id);
    if (r) return { recipe: r, done: c.doneDate === t };
  }
  let queue = (c.queue || []).filter((id) => pool.some((r) => r.id === id));
  if (!queue.length) queue = shuffle(pool.map((r) => r.id));
  const id = queue.shift();
  setCotd({ date: t, id, queue, doneDate: c.doneDate, count: c.count || 0 });
  return { recipe: pool.find((r) => r.id === id), done: false };
}
function markCotdDone() {
  const c = getCotd();
  if (c.doneDate !== todayStr()) { c.count = (c.count || 0) + 1; }
  c.doneDate = todayStr();
  setCotd(c);
  checkBadges();
}

// ============================ Badges ============================
const BADGES = [
  { id: "first_serve", emoji: "🍸", name: "First Pour", desc: "Serve your first drink", test: (s) => s.served >= 1 },
  { id: "three_star", emoji: "⭐", name: "Three Stars", desc: "Earn a 3-star drink", test: (s) => s.perfects >= 1 },
  { id: "served_25", emoji: "🍹", name: "Getting Busy", desc: "Serve 25 drinks", test: (s) => s.served >= 25 },
  { id: "served_100", emoji: "🏆", name: "Centurion", desc: "Serve 100 drinks", test: (s) => s.served >= 100 },
  { id: "level_3", emoji: "📈", name: "Rising Star", desc: "Reach level 3", test: (s) => levelForXp(s.xp) >= 3 },
  { id: "level_5", emoji: "🌟", name: "Seasoned Pro", desc: "Reach level 5", test: (s) => levelForXp(s.xp) >= 5 },
  { id: "streak_3", emoji: "🔥", name: "On a Roll", desc: "3-day streak", test: (s, d) => (d.best || 0) >= 3 },
  { id: "streak_7", emoji: "🗓️", name: "Regular", desc: "7-day streak", test: (s, d) => (d.best || 0) >= 7 },
  { id: "inventor", emoji: "🧪", name: "Inventor", desc: "Save an invention to My Bar", test: () => getMyBar().length > 0 },
  { id: "cotd_5", emoji: "📅", name: "Daily Habit", desc: "Play 5 Cocktails of the Day", test: (s, d, c) => (c.count || 0) >= 5 },
];
const BADGE_KEY = "dagtails_badges";
function getEarned() { try { return JSON.parse(localStorage.getItem(BADGE_KEY) || "[]"); } catch (e) { return []; } }
function setEarned(a) { try { localStorage.setItem(BADGE_KEY, JSON.stringify(a)); } catch (e) { /* ignore */ } }
function checkBadges() {
  const s = getProgress(), d = getDaily(), c = getCotd();
  const earned = new Set(getEarned());
  const newly = [];
  BADGES.forEach((b) => { if (!earned.has(b.id) && b.test(s, d, c)) { earned.add(b.id); newly.push(b); } });
  if (newly.length) setEarned([...earned]);
  return newly;
}

// ============================ Start-screen meta UI ============================
function applyLock(sel, unlocked, lvl) {
  const el = $(sel);
  if (!el) return;
  el.classList.toggle("is-locked", !unlocked);
  let lock = el.querySelector(".diff-lock");
  if (!unlocked) {
    if (!lock) { lock = document.createElement("span"); lock.className = "diff-lock"; el.appendChild(lock); }
    lock.textContent = `🔒 Lv ${lvl}`;
  } else if (lock) {
    lock.remove();
  }
}

function renderStartMeta() {
  refreshHub();
  // Community lives outside the React hub (mix result / secondary nav).
  const commBtn = $("#btn-community");
  if (commBtn) commBtn.style.display = isUnderage() ? "none" : "";
}

// Combined refresh whenever we land on the start screen.
function onShowStart() {
  refreshHub();
  const commBtn = $("#btn-community");
  if (commBtn) commBtn.style.display = isUnderage() ? "none" : "";
  syncBackendStats();
}

// ============================ Backend (Community + Leaderboards) ============================
function syncBackendStats() {
  if (!Backend.isReady()) return;
  const p = getProfile();
  const prog = getProgress();
  const d = getDaily();
  Backend.syncStats({
    bestStreak: d.best || 0,
    level: levelForXp(prog.xp),
    xp: prog.xp || 0,
    name: p && p.name,
    location: p && p.location,
  });
}

const NOT_CONNECTED = "🌐 Online features aren't connected yet — a backend still needs to be set up.";
let communitySort = "top";
let communityLikes = new Set();

async function renderCommunity() {
  const notice = $("#community-notice");
  const list = $("#community-list");
  list.innerHTML = "";
  if (!Backend.isConfigured()) { notice.style.display = ""; notice.textContent = NOT_CONNECTED; return; }
  notice.style.display = "none";
  list.innerHTML = `<p class="backend-notice">Loading…</p>`;
  if (!Backend.isReady()) await Backend.initBackend(getProfile());
  if (!Backend.isReady()) { list.innerHTML = `<p class="backend-notice">Couldn't connect right now.</p>`; return; }
  try {
    const [items, liked] = await Promise.all([Backend.listCommunity(communitySort), Backend.myLikedIds()]);
    communityLikes = liked;
    if (!items.length) { list.innerHTML = `<p class="backend-notice">No creations yet — be the first to share one from Mixologist mode!</p>`; return; }
    list.innerHTML = "";
    items.forEach((it) => list.appendChild(communityCard(it)));
  } catch (e) {
    list.innerHTML = `<p class="backend-notice">Couldn't load the community right now.</p>`;
  }
}

function communityCard(it) {
  const liked = communityLikes.has(it.id);
  const ings = (it.recipe && it.recipe.ingredients ? it.recipe.ingredients : [])
    .map((i) => { const ing = INGREDIENT_BY_ID[i.id]; return ing ? ing.name : i.id; })
    .slice(0, 6).join(", ");
  const who = (it.players && it.players.name) || "Anonymous";
  const card = document.createElement("div");
  card.className = "comm-item";
  card.innerHTML = `
    <div class="comm-top">
      <span class="comm-name">${escapeHtml(it.name)}</span>
      <button class="like-btn ${liked ? "is-liked" : ""}" data-id="${it.id}">${liked ? "♥" : "♡"} <span>${it.like_count}</span></button>
    </div>
    <div class="comm-meta">by ${escapeHtml(who)} · ${it.score}/100${it.family ? " · " + escapeHtml(it.family) : ""}</div>
    <div class="comm-ings">${escapeHtml(ings)}</div>`;
  card.querySelector(".like-btn").addEventListener("click", onLikeClick);
  return card;
}

async function onLikeClick(e) {
  const btn = e.currentTarget;
  const id = btn.dataset.id;
  const wasLiked = btn.classList.contains("is-liked");
  btn.disabled = true;
  try {
    const now = await Backend.toggleLike(id, wasLiked);
    const span = btn.querySelector("span");
    const count = Math.max(0, parseInt(span.textContent, 10) + (now ? 1 : -1));
    btn.classList.toggle("is-liked", now);
    btn.innerHTML = `${now ? "♥" : "♡"} <span>${count}</span>`;
    if (now) communityLikes.add(id); else communityLikes.delete(id);
    Sound.click();
  } catch (err) {
    showToast("Couldn't register your vote.");
  }
  btn.disabled = false;
}

let lbBoard = "likes";
async function renderLeaderboard() {
  const notice = $("#leaderboard-notice");
  const list = $("#leaderboard-list");
  list.innerHTML = "";
  if (!Backend.isConfigured()) { notice.style.display = ""; notice.textContent = NOT_CONNECTED; return; }
  notice.style.display = "none";
  list.innerHTML = `<p class="backend-notice">Loading…</p>`;
  if (!Backend.isReady()) await Backend.initBackend(getProfile());
  if (!Backend.isReady()) { list.innerHTML = `<p class="backend-notice">Couldn't connect right now.</p>`; return; }
  try {
    if (lbBoard === "likes") {
      const rows = await Backend.leaderboardLikes();
      if (!rows.length) { list.innerHTML = `<p class="backend-notice">No shared creations yet.</p>`; return; }
      list.innerHTML = rows.map((r, i) => `
        <div class="lb-row">
          <span class="lb-rank">${rankMedal(i)}</span>
          <span class="lb-main"><strong>${escapeHtml(r.name)}</strong><small>by ${escapeHtml(r.player_name || "Anonymous")}</small></span>
          <span class="lb-val">❤ ${r.like_count}</span>
        </div>`).join("");
    } else {
      const rows = await Backend.leaderboardStreak();
      if (!rows.length) { list.innerHTML = `<p class="backend-notice">No streaks yet — play daily to climb!</p>`; return; }
      list.innerHTML = rows.map((r, i) => `
        <div class="lb-row">
          <span class="lb-rank">${rankMedal(i)}</span>
          <span class="lb-main"><strong>${escapeHtml(r.player_name || "Anonymous")}</strong><small>Lv ${r.level}${r.location ? " · " + escapeHtml(r.location) : ""}</small></span>
          <span class="lb-val">🔥 ${r.best_streak}</span>
        </div>`).join("");
    }
  } catch (e) {
    list.innerHTML = `<p class="backend-notice">Couldn't load the leaderboard right now.</p>`;
  }
}
function rankMedal(i) { return i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "#" + (i + 1); }

function classicShareBlockMessage(classic) {
  if (!classic || !classic.name) return "";
  return classic.exact
    ? `That's a ${classic.name} — Community is for originals.`
    : `Too close to a ${classic.name} — Community is for originals.`;
}

function classicFromSharePayload(payload) {
  if (payload && classicBlocksCommunityShare(payload.classic)) return payload.classic;
  if (payload && payload.recipe) return detectClassic(payload.recipe);
  return null;
}

async function shareCreationToCommunity(payload, btn) {
  const classic = classicFromSharePayload(payload);
  if (classicBlocksCommunityShare(classic)) {
    showToast(classicShareBlockMessage(classic));
    return;
  }
  if (!Backend.isConfigured()) { showToast("Online sharing isn't connected yet."); return; }
  const original = btn ? btn.textContent : "";
  if (btn) { btn.disabled = true; btn.textContent = "Sharing…"; }
  try {
    if (!Backend.isReady()) await Backend.initBackend(getProfile());
    await Backend.shareCreation(payload);
    if (btn) btn.textContent = "Shared ✓";
    Sound.coin();
    track("community_share", { score: payload && payload.score, family: payload && payload.family });
    showToast("Shared to the community!");
  } catch (e) {
    if (btn) { btn.textContent = original; btn.disabled = false; }
    showToast("Couldn't share right now.");
  }
}

// ============================ Cocktail of the Day (play) ============================
function loadCotd() {
  const { recipe, done } = todaysCotd();
  if (!recipe) return;
  state.mode = "cotd";
  state.cotdRecipe = recipe;
  state.challenge = null;
  state.build = emptyBuild();
  state.mixed = false;
  // Daily uses the player's current ramp difficulty.
  applyComplexity(complexityForStage(getMap().cleared + 1), recipe);
  $(".progress-wrap").style.display = "none";
  $("#endless-hud").style.display = "none";
  clearCustomer();
  setGameVenue("Cocktail of the Day");
  applyVenueChrome(venueForStage(getMap().cleared || 0)?.venue);
  $("#stage-pill").textContent = "🍹 Daily";
  $("#diff-pill").textContent = state.complexity.label;
  $("#order-name").textContent = recipe.name;
  $("#order-desc").textContent = recipe.order;
  setTicketOrigin(recipe);
  renderTicketRecipe(recipe);
  setTicketFlippable(true);
  setTicketFlipped(false);
  recordPlayDay();
  renderStation();
  enterStep();
  showScreen("screen-game");
  track("cotd_started", { recipe_id: recipe.id, already_done_today: !!done });
  trackDrinkStarted();
}

// ============================ Badges screen ============================
function renderBadges() {
  const earned = new Set(getEarned());
  const el = $("#badges-list");
  if (!el) return;
  const sub = $("#badges-sub");
  if (sub) sub.textContent = `${earned.size} of ${BADGES.length} earned`;
  el.innerHTML = "";
  BADGES.forEach((b) => {
    const has = earned.has(b.id);
    const card = document.createElement("div");
    card.className = "badge-item" + (has ? " is-earned" : "");
    card.innerHTML =
      `<span class="badge-emoji">${has ? b.emoji : "🔒"}</span>` +
      `<span class="badge-name">${b.name}</span>` +
      `<span class="badge-desc">${b.desc}</span>`;
    el.appendChild(card);
  });
}

// ============================ Stage map (venue hero → candy drink path) ============================
let selectedVenueId = null;
let mapStep = "hero"; // "hero" | "path"
let mapPathPage = 0;
let selectedStageIndex = null;
let mapHubEls = {}; // venueId -> dot button
let mapDrinkEls = {}; // stageIndex -> node button
let pendingTravel = null; // { fromVenue, toVenue } when finishing a bar
let pendingWalk = null; // unused (legacy flight)
const PATH_PAGE_SIZE = 6;

function venueRange(venue) {
  const venues = venueList();
  let cursor = 0;
  for (const v of venues) {
    const n = (v.drinkIds || []).length;
    if (v.id === venue.id) return { start: cursor, end: cursor + n - 1, count: n };
    cursor += n;
  }
  return { start: 0, end: -1, count: 0 };
}

function venueStars(map, venue) {
  let stars = 0;
  (venue.drinkIds || []).forEach((id) => {
    const r = RECIPE_BY_ID[id];
    if (r) stars += stageRecordOf(map, r).stars;
  });
  return stars;
}

// Fan drink stops around a venue pin — unused on the world map (venues only).
// Kept for any future local venue plate.
function drinkPinOffset(localIdx, count, venuePin) {
  const n = Math.max(1, count);
  const upward = (venuePin.y || 50) > 68;
  const spread = Math.min(28, 6 + n * 3.2);
  const t = n === 1 ? 0.5 : localIdx / (n - 1);
  const angle = (-spread / 2 + t * spread) * (Math.PI / 180);
  const radius = 7.2 + Math.min(4, n * 0.25);
  const dx = Math.sin(angle) * radius;
  const dy = (upward ? -1 : 1) * (Math.cos(angle) * radius * 0.72 + 5.5);
  return {
    x: Math.max(4, Math.min(96, venuePin.x + dx)),
    y: Math.max(8, Math.min(92, venuePin.y + dy)),
  };
}

function frontierStageIndex() {
  const pool = drinkPool();
  const cleared = getMap().cleared || 0;
  return Math.min(cleared, Math.max(0, pool.length - 1));
}

function focusedVenue() {
  const venues = venueList();
  const remembered = selectedVenueId || getMap().hubVenueId;
  return venues.find((v) => v.id === remembered) || venueForStage(frontierStageIndex()).venue;
}

function venueDrinks(venue) {
  const range = venueRange(venue);
  const pool = drinkPool();
  return (venue.drinkIds || []).map((id, localIdx) => {
    const index = range.start + localIdx;
    return { index, localIdx, recipe: pool[index] || RECIPE_BY_ID[id] };
  }).filter((d) => d.recipe);
}

function venueStatus(venue, cleared) {
  const range = venueRange(venue);
  const locked = range.start > cleared;
  const current = !locked && cleared >= range.start && cleared <= range.end;
  const done = range.end < cleared;
  return { range, locked, current, done };
}

function drinkGlassSrc(recipe) {
  const id = recipe && recipe.glass;
  const path = (Glass.GLASS_PHOTO && Glass.GLASS_PHOTO[id]) || "assets/glasses/rocks.png";
  return resolveAssetUrl(path);
}

const MAP_STAR_PATH = "M12 2.1l2.85 6.05 6.65.72-5 4.55 1.4 6.48L12 16.62 6.1 19.9l1.4-6.48-5-4.55 6.65-.72z";

function mapStarMarkup(on) {
  return `<svg class="map-node-star${on ? " is-on" : ""}" viewBox="0 0 24 24" aria-hidden="true">`
    + `<path class="star-shadow" d="${MAP_STAR_PATH}"></path>`
    + `<path class="star-face" d="${MAP_STAR_PATH}"></path>`
    + `</svg>`;
}

const PATH_LAYOUTS = {
  1: [{ x: 50, y: 58 }],
  2: [{ x: 28, y: 60 }, { x: 70, y: 40 }],
  3: [{ x: 16, y: 64 }, { x: 50, y: 36 }, { x: 84, y: 60 }],
  4: [{ x: 14, y: 32 }, { x: 38, y: 64 }, { x: 64, y: 30 }, { x: 86, y: 60 }],
  5: [{ x: 12, y: 30 }, { x: 32, y: 62 }, { x: 52, y: 28 }, { x: 72, y: 64 }, { x: 90, y: 36 }],
  6: [{ x: 10, y: 34 }, { x: 28, y: 64 }, { x: 46, y: 28 }, { x: 62, y: 62 }, { x: 78, y: 30 }, { x: 92, y: 58 }],
};

function pathPageDrinks(venue) {
  const drinks = venueDrinks(venue);
  const pages = Math.max(1, Math.ceil(drinks.length / PATH_PAGE_SIZE));
  mapPathPage = Math.max(0, Math.min(mapPathPage, pages - 1));
  const start = mapPathPage * PATH_PAGE_SIZE;
  return {
    drinks: drinks.slice(start, start + PATH_PAGE_SIZE),
    page: mapPathPage,
    pages,
    total: drinks.length,
    start,
  };
}

function defaultStageForVenue(venue) {
  const { range, locked, done } = venueStatus(venue, getMap().cleared || 0);
  if (locked) return range.start;
  if (done) return range.start;
  return Math.min(Math.max(getMap().cleared || 0, range.start), range.end);
}

function setMapStep(step) {
  mapStep = step === "path" ? "path" : "hero";
  const stage = $("#map-stage");
  if (stage) stage.dataset.step = mapStep;
  const hero = $("#map-hero");
  const path = $("#map-path");
  if (hero) hero.hidden = mapStep !== "hero";
  if (path) path.hidden = mapStep !== "path";
  const back = $("#btn-map-back");
  if (back) back.textContent = mapStep === "path" ? "← Bar" : "← Menu";
}

function updateMapCta() {
  const btn = $("#btn-map-play");
  const hint = $("#map-hint");
  if (!btn) return;
  const venue = focusedVenue();
  const cleared = getMap().cleared || 0;
  const { locked, current } = venueStatus(venue, cleared);
  const hopping = $("#map-stage")?.classList.contains("is-hopping");

  if (hopping) {
    btn.disabled = true;
    btn.textContent = "Hopping…";
    if (hint) hint.textContent = "Next stop";
    return;
  }

  if (mapStep === "hero") {
    if (hint) hint.textContent = "Pick a bar";
    if (locked) {
      btn.disabled = true;
      btn.textContent = "Locked";
      return;
    }
    btn.disabled = false;
    btn.textContent = current ? "Enter bar" : `Revisit ${venue.name}`;
    return;
  }

  if (hint) {
    const drinks = venueDrinks(venue);
    const idx = drinks.findIndex((d) => d.index === selectedStageIndex);
    const n = idx >= 0 ? idx + 1 : 1;
    hint.textContent = `${venue.name} · ${n} of ${drinks.length}`;
  }
  const recipe = drinkPool()[selectedStageIndex] || venueDrinks(venue)[0]?.recipe;
  if (locked) {
    btn.disabled = true;
    btn.textContent = "Locked";
    return;
  }
  btn.disabled = false;
  btn.textContent = recipe ? `Pour ${recipe.name}` : "Pour";
}

function renderHero(venue, map, cleared) {
  const { locked, current, done } = venueStatus(venue, cleared);
  const hero = $("#map-hero");
  const bg = $("#map-hero-bg");
  if (!hero || !bg) return;
  hero.classList.toggle("is-locked", locked);
  hero.classList.toggle("is-current", current);
  hero.classList.toggle("is-done", done);
  hero.style.setProperty("--venue-accent", venue.accent || "#e9b949");
  const url = resolveAssetUrl(venue.bg || venue.interior);
  bg.style.backgroundImage = url
    ? `linear-gradient(180deg, rgba(8,5,2,0.18) 0%, rgba(8,5,2,0.08) 42%, rgba(8,5,2,0.62) 100%), url("${url}")`
    : "";

  const kind = $("#map-hero-kind");
  const title = $("#map-hero-title");
  const place = $("#map-hero-place");
  if (kind) kind.textContent = locked ? "Locked" : current ? "Now pouring" : done ? "Cleared" : (venue.kind || "Bar");
  if (title) title.textContent = venue.sign || venue.name;
  if (place) place.textContent = `${venue.flag || ""} ${venue.city}${venue.kind ? " · " + venue.kind : ""}`.trim();

  const duck = $("#map-hero-duck");
  if (duck) {
    duck.hidden = locked;
    applyMascotTier(duck, rankForCleared(cleared));
    duck.classList.remove("is-settle");
    void duck.offsetWidth;
    if (!locked) duck.classList.add("is-settle");
  }

  const dots = $("#map-dots");
  if (dots) {
    dots.innerHTML = "";
    mapHubEls = {};
    venueList().forEach((v) => {
      const st = venueStatus(v, cleared);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "map-dot"
        + (st.locked ? " is-locked" : "")
        + (st.current ? " is-current" : "")
        + (st.done ? " is-done" : "")
        + (v.id === venue.id ? " is-selected" : "");
      b.setAttribute("role", "tab");
      b.setAttribute("aria-label", v.name);
      b.setAttribute("aria-selected", v.id === venue.id ? "true" : "false");
      b.title = st.locked ? `${v.name} (locked)` : v.name;
      b.addEventListener("click", () => {
        Sound.click();
        selectedVenueId = v.id;
        mapStep = "hero";
        renderMap({ openVenueId: v.id, step: "hero" });
      });
      dots.appendChild(b);
      mapHubEls[v.id] = b;
    });
  }

  const venues = venueList();
  const idx = Math.max(0, venues.findIndex((v) => v.id === venue.id));
  const prev = $("#map-prev");
  const next = $("#map-next");
  if (prev) prev.disabled = idx <= 0;
  if (next) next.disabled = idx >= venues.length - 1;
}

function ribbonD(points) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const cpx = (a.x + b.x) / 2;
    const cpy = Math.max(12, Math.min(a.y, b.y) - 10);
    d += ` Q ${cpx} ${cpy} ${b.x} ${b.y}`;
  }
  return d;
}

function renderPath(venue, map, cleared) {
  const board = $("#map-path-board");
  const nodesEl = $("#map-path-nodes");
  const ribbon = $("#map-path-ribbon");
  const bg = $("#map-path-bg");
  const kicker = $("#map-path-kicker");
  if (!board || !nodesEl || !ribbon) return;

  const url = resolveAssetUrl(venue.interior || venue.bg);
  if (bg) {
    bg.style.backgroundImage = url
      ? `linear-gradient(180deg, rgba(10,6,4,0.35), rgba(10,6,4,0.55)), url("${url}")`
      : "";
  }

  const page = pathPageDrinks(venue);
  if (selectedStageIndex == null || !page.drinks.some((d) => d.index === selectedStageIndex)) {
    const focus = defaultStageForVenue(venue);
    const onPage = page.drinks.find((d) => d.index === focus);
    selectedStageIndex = onPage ? onPage.index : (page.drinks[0]?.index ?? focus);
  }

  if (kicker) {
    const total = page.total;
    const local = venueDrinks(venue).findIndex((d) => d.index === selectedStageIndex) + 1;
    kicker.textContent = `${venue.flag || ""} ${venue.name} · ${Math.max(1, local)} of ${total}`.trim();
  }

  const pts = PATH_LAYOUTS[page.drinks.length] || PATH_LAYOUTS[3];
  ribbon.innerHTML =
    `<path class="map-ribbon-glow" d="${ribbonD(pts)}" fill="none" />` +
    `<path class="map-ribbon-gold" d="${ribbonD(pts)}" fill="none" />`;

  nodesEl.innerHTML = "";
  mapDrinkEls = {};
  page.drinks.forEach((d, i) => {
    const pos = pts[i] || pts[pts.length - 1];
    const locked = d.index > cleared;
    const current = d.index === cleared;
    const done = d.index < cleared;
    const selected = d.index === selectedStageIndex;
    const best = stageRecordOf(map, d.recipe);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "map-node"
      + (locked ? " is-locked" : "")
      + (current ? " is-current" : "")
      + (done ? " is-done" : "")
      + (selected ? " is-selected" : "");
    btn.style.left = pos.x + "%";
    btn.style.top = pos.y + "%";
    btn.dataset.stage = String(d.index);
    btn.setAttribute(
      "aria-label",
      locked
        ? `${d.recipe.name} (locked)`
        : `${d.recipe.name}, ${best.stars} of 3 stars`
    );
    const stars = [0, 1, 2].map((s) => mapStarMarkup(!locked && s < best.stars)).join("");
    btn.innerHTML =
      `<span class="map-node-stars">${stars}</span>` +
      `<span class="map-node-num">${locked ? "🔒" : d.localIdx + 1}</span>` +
      `<span class="map-node-name">${d.recipe.name}</span>`;
    btn.addEventListener("click", () => onPathNodeTap(venue, d));
    nodesEl.appendChild(btn);
    mapDrinkEls[d.index] = btn;
  });

  const pagesEl = $("#map-path-pages");
  if (pagesEl) {
    pagesEl.hidden = page.pages <= 1;
    pagesEl.innerHTML = "";
    for (let p = 0; p < page.pages; p++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "map-page-dot" + (p === page.page ? " is-active" : "");
      b.setAttribute("aria-label", `Drinks ${p * PATH_PAGE_SIZE + 1}–${Math.min((p + 1) * PATH_PAGE_SIZE, page.total)}`);
      b.addEventListener("click", () => {
        Sound.click();
        mapPathPage = p;
        selectedStageIndex = null;
        renderMap({ step: "path", openVenueId: venue.id });
      });
      pagesEl.appendChild(b);
    }
  }

  requestAnimationFrame(() => placeDuckOnMap());
}

function onPathNodeTap(venue, drink) {
  const cleared = getMap().cleared || 0;
  const locked = drink.index > cleared;
  track("map_drink_tap", {
    recipe_id: drink.recipe && drink.recipe.id,
    venue_id: venue.id,
    locked,
  });
  if (locked) {
    Sound.fail();
    showToast("🔒 Clear earlier drinks first.");
    return;
  }
  Sound.click();
  selectedVenueId = venue.id;
  selectedStageIndex = drink.index;
  startStageFromMap(drink.index);
}

function renderMap(opts = {}) {
  if (!$("#map-hero") || !$("#map-path")) return;
  const prevStep = mapStep;
  const prevVenue = selectedVenueId;
  const pool = drinkPool();
  const map = getMap();
  const cleared = map.cleared || 0;
  const at = venueForStage(Math.min(cleared, Math.max(0, pool.length - 1)));
  const curV = at.venue;

  if (opts.step) mapStep = opts.step;
  else if (pendingTravel) mapStep = "hero";

  const focusId = opts.openVenueId || selectedVenueId || curV.id;
  selectedVenueId = focusId;
  const venue = focusedVenue();

  if (opts.stageIndex != null) selectedStageIndex = opts.stageIndex;
  else if (mapStep === "path" && selectedStageIndex == null) {
    selectedStageIndex = defaultStageForVenue(venue);
  }

  if (mapStep === "path") {
    const drinks = venueDrinks(venue);
    const pos = drinks.findIndex((d) => d.index === (selectedStageIndex ?? defaultStageForVenue(venue)));
    if (opts.pathPage != null) mapPathPage = opts.pathPage;
    else if (pos >= 0) mapPathPage = Math.floor(pos / PATH_PAGE_SIZE);
  }

  const starsEl = $("#map-stars-total");
  if (starsEl) starsEl.textContent = `★ ${totalStars()}`;

  setMapStep(mapStep);
  if (mapStep === "path") renderPath(venue, map, cleared);
  else renderHero(venue, map, cleared);
  updateMapCta();

  if (pendingTravel) {
    const trip = pendingTravel;
    pendingTravel = null;
    setTimeout(() => {
      playVenueHop(trip.fromVenue, trip.toVenue);
      updateMapCta();
    }, 180);
  }

  const onMap = $("#screen-map")?.classList.contains("is-active");
  if (onMap && (mapStep !== prevStep || selectedVenueId !== prevVenue)) {
    lastMapViewKey = "";
    trackMapView();
  }
}

function mapZoomPercent() { return 100; }
function applyMapZoom() { /* no plate zoom */ }
function enableMapFlightZoom() { /* no plate zoom */ }
function clearMapFlightZoom() { /* no plate zoom */ }
function pinPoint() { return null; }
function ensureMapAssets() { /* hero/path use venue.bg / interior */ }
function closeMapSheet() { /* sheet removed */ }
function openVenueSheet() { /* sheet removed */ }

function placeDuckOnMap() {
  const duck = $("#map-path-duck");
  if (duck) duck.hidden = true;
}

function centerOnVenue(venueId) {
  selectedVenueId = venueId || selectedVenueId;
}
function centerMapFocus(venueId) {
  centerOnVenue(venueId);
}
function stopMapCameraFollow() { /* no map camera */ }
function startMapCameraFollow() { /* no map camera */ }

function animateDuckTravel() {
  const duck = $("#map-hero-duck");
  if (!duck) return Promise.resolve();
  duck.classList.remove("is-travel");
  void duck.offsetWidth;
  duck.classList.add("is-travel");
  return new Promise((resolve) => setTimeout(resolve, 700));
}

function shiftFocusedVenue(dir) {
  const venues = venueList();
  const idx = Math.max(0, venues.findIndex((v) => v.id === selectedVenueId));
  const next = venues[idx + dir];
  if (!next) return;
  Sound.click();
  selectedVenueId = next.id;
  selectedStageIndex = null;
  renderMap({ step: "hero", openVenueId: next.id });
}

function enterFocusedBar() {
  const venue = focusedVenue();
  const { locked } = venueStatus(venue, getMap().cleared || 0);
  if (locked) {
    Sound.fail();
    showToast("🔒 Clear earlier bars first.");
    return;
  }
  Sound.click();
  selectedStageIndex = defaultStageForVenue(venue);
  mapPathPage = Math.floor(
    Math.max(0, venueDrinks(venue).findIndex((d) => d.index === selectedStageIndex)) / PATH_PAGE_SIZE
  );
  renderMap({ step: "path", openVenueId: venue.id });
}

function playMapCta() {
  if ($("#map-stage")?.classList.contains("is-hopping")) return;
  if (mapStep === "hero") {
    enterFocusedBar();
    return;
  }
  const venue = focusedVenue();
  const { locked } = venueStatus(venue, getMap().cleared || 0);
  const idx = selectedStageIndex ?? defaultStageForVenue(venue);
  if (locked || idx > (getMap().cleared || 0)) {
    Sound.fail();
    showToast("🔒 Clear earlier drinks first.");
    return;
  }
  Sound.click();
  startStageFromMap(idx);
}

function playVenueHop(fromVenue, toVenue) {
  if (!fromVenue) {
    finishVenueHop();
    return;
  }
  mapStep = "hero";
  selectedVenueId = toVenue ? toVenue.id : fromVenue.id;
  selectedStageIndex = null;
  renderMap({ step: "hero", openVenueId: selectedVenueId });
  const stage = $("#map-stage");
  if (stage) stage.classList.add("is-hopping");
  const hop = $("#map-hop");
  if (hop) {
    const farewell = fromVenue.master && fromVenue.master.farewell;
    $("#map-hop-eyebrow").textContent = toVenue
      ? (farewell ? "Off you hop" : "Next stop")
      : "Crawl complete";
    $("#map-hop-from").textContent = `${fromVenue.flag || ""} ${fromVenue.name}`.trim();
    $("#map-hop-to").textContent = toVenue
      ? `${toVenue.flag || ""} ${toVenue.name}`.trim()
      : "Home roost";
    hop.hidden = false;
    hop.classList.add("is-open");
  }
  Sound.coin();
  animateDuckTravel();
  setTimeout(finishVenueHop, 1200);
}

function hideMapHop() {
  const hop = $("#map-hop");
  if (!hop) return;
  hop.classList.remove("is-open");
  hop.hidden = true;
  $("#map-stage")?.classList.remove("is-hopping");
}

function finishVenueHop() {
  hideMapHop();
  clearMapFlightZoom();
  const cleared = getMap().cleared || 0;
  const pool = drinkPool();
  const at = venueForStage(Math.min(cleared, Math.max(0, pool.length - 1)));
  selectedVenueId = at.venue.id;
  selectedStageIndex = null;
  mapStep = "hero";
  renderMap({ step: "hero", openVenueId: at.venue.id });
}

function playVenueFarewell(fromVenue, toVenue) {
  playVenueHop(fromVenue, toVenue);
}
function dismissTravelOverlay() {
  finishVenueHop();
}

function startStageFromMap(index) {
  state.totalScore = 0;
  state.starsEarned = 0;
  displayedScore = 0;
  loadStage(index);
}

// ============================ Venue unlock / farewell ============================
let pendingRankUp = null; // unused for map; travel uses pendingTravel
function recordStageResult(stageIdx, stars, pct) {
  const m = getMap();
  const recipe = drinkPool()[stageIdx];
  if (recipe) {
    const prev = stageRecordOf(m, recipe);
    m.records[recipe.id] = {
      stars: Math.max(prev.stars, stars || 0),
      pct: Math.max(prev.pct, Math.round(pct || 0)),
    };
  }
  if (stars >= 1 && stageIdx === m.cleared) {
    const beforeVenue = venueIndexForCleared(m.cleared);
    const fromVenue = venueList()[beforeVenue];
    const range = venueRange(fromVenue);
    const finishingVenue = stageIdx === range.end;
    m.cleared = Math.min(drinkPool().length, m.cleared + 1);
    if (finishingVenue) {
      const next = venueList()[beforeVenue + 1] || null;
      pendingTravel = { fromVenue, toVenue: next };
    }
    // Mid-venue advances stay on the bar (guest swap) — no map walk.
  }
  setMap(m);
}
// Generic full-screen announcement (rules changes / tier intros).
function showAnnounce({ emoji, eyebrow, title, body, button }) {
  $("#rankup-emoji").textContent = emoji;
  $("#rankup-eyebrow").textContent = eyebrow;
  $("#rankup-name").textContent = title;
  const b = $("#rankup-body");
  b.textContent = body || "";
  b.style.display = body ? "" : "none";
  $("#btn-rankup-ok").textContent = button || "Got it →";
  $("#rankup").classList.add("is-open");
  Sound.coin();
}
function showRankUp(venueIdx) {
  // Legacy hook — venue hops use the on-map SF2 flight.
  const venues = venueList();
  const v = venues[Math.min(Math.max(0, venueIdx), venues.length - 1)];
  if (!v) return;
  const prev = venues[Math.max(0, venueIdx - 1)] || v;
  playVenueHop(prev, v);
}
// When a stage introduces new rules, explain them once.
function maybeShowTierIntro(label) {
  const intro = TIER_INTRO[label];
  if (!intro || tierSeen(label)) return;
  markTierSeen(label);
  setTimeout(() => showAnnounce(intro), 260);
}

// ============================ High score (localStorage) ============================
const HIGH_SCORE_KEY = "dagtails_highscore";
const ENDLESS_BEST_KEY = "dagtails_endless_best";
function getHighScore() {
  return Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);
}
function setHighScore(v) {
  try { localStorage.setItem(HIGH_SCORE_KEY, String(v)); } catch (e) { /* ignore */ }
}
function getEndlessBest() {
  return Number(localStorage.getItem(ENDLESS_BEST_KEY) || 0);
}
function setEndlessBest(v) {
  try { localStorage.setItem(ENDLESS_BEST_KEY, String(v)); } catch (e) { /* ignore */ }
}
function renderStartBest() {
  refreshHub();
}

const STEP_META = {
  glass: { label: "Glass", title: "Choose your glass", sub: "Pick the right vessel — it lands on the counter.", status: "Choose a glass" },
  method: { label: "Tools", title: "Set up your tools", sub: "Pick how you'll prepare. Shaker, spoon, or muddler — tools hit the counter before you pour.", status: "Choose your tools" },
  ingredients: {
    label: "Pour",
    title: MEASURE_ENABLED ? "Pour your ingredients" : "Pick your ingredients",
    sub: MEASURE_ENABLED
      ? "Tap to add, then dial each amount. Watch them pour into the right vessel."
      : "Tap the ingredients you think belong in this drink — no measuring.",
    status: MEASURE_ENABLED ? "Pour your ingredients" : "Pick your ingredients",
  },
  garnish: { label: "Garnish", title: "Add a garnish", sub: "Finish it with the right flourish.", status: "Add a garnish" },
};

// ============================ DOM helpers ============================
const $ = (sel) => document.querySelector(sel);

function showScreen(id) {
  lastScreenId = id;
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("is-active"));
  $("#" + id).classList.add("is-active");
  document.body.classList.toggle("is-phone-play", isPhonePlay());
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  if (id === "screen-start") {
    onShowStart();
    track("hub_view", {
      unlocked_modes: mapUnlocked(),
    });
  }
  if (id === "screen-map") {
    ensureMapAssets();
    lastMapViewKey = "";
    trackMapView();
  }
  if (id === "screen-mix-result") {
    applyMixResultLayout();
    const commBtn = $("#btn-community");
    if (commBtn) commBtn.style.display = isUnderage() ? "none" : "";
  }
}

/** Design canvas for the unified stage (phone-landscape proportions). */
const STAGE_W = 1100;
const STAGE_H = 508;

function liveViewport() {
  const vv = window.visualViewport;
  const winW = Math.max(1, Math.round((vv && vv.width) || window.innerWidth || 1));
  const winH = Math.max(1, Math.round((vv && vv.height) || window.innerHeight || 1));
  return { winW, winH };
}

function fitGameStage() {
  const stage = document.getElementById("game-stage");
  if (!stage) return;
  const shell = stage.parentElement;
  const { winW, winH } = liveViewport();
  // Prefer the smallest live box: visualViewport (Expo / iOS chrome) vs the
  // shell content box (safe-area padding). innerHeight can over-report in WKWebView.
  const shellW = shell && shell.clientWidth ? shell.clientWidth : winW;
  const shellH = shell && shell.clientHeight ? shell.clientHeight : winH;
  const vw = Math.max(1, Math.min(winW, shellW));
  const vh = Math.max(1, Math.min(winH, shellH));
  // Size the stage to the live platform viewport (iOS / Android / PC) so the
  // shell uses every pixel — no letterboxing and no cover-crop of chrome.
  stage.style.width = `${vw}px`;
  stage.style.height = `${vh}px`;
  stage.style.transform = "none";
  const scale = Math.min(vw / STAGE_W, vh / STAGE_H);
  document.documentElement.style.setProperty("--stage-scale", String(Math.max(0.2, scale)));
  document.documentElement.style.setProperty("--stage-w", `${vw}px`);
  document.documentElement.style.setProperty("--stage-h", `${vh}px`);
  if (document.querySelector(".station.has-muddle, .station.has-prep")) placeStationTools();
}

function isPhonePlay() {
  // Stage is locked to phone-landscape density so PC and mobile match.
  if (document.getElementById("game-stage")) return true;
  try {
    return window.matchMedia("(pointer: coarse) and (orientation: landscape) and (max-height: 560px)").matches
      || window.matchMedia("(pointer: coarse) and (max-width: 920px) and (max-height: 500px)").matches;
  } catch (e) {
    return false;
  }
}

let toastTimer = null;
function showToast(msg) {
  let t = $("#toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("is-show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("is-show"), 2400);
}

function unitMeta(unit) {
  switch (unit) {
    case "ml": return { step: 5, def: 15, min: 0 };
    case "dash": return { step: 1, def: 1, min: 0 };
    case "leaf": return { step: 1, def: 4, min: 0 };
    case "piece": return { step: 1, def: 1, min: 0 };
    default: return { step: 1, def: 1, min: 0 };
  }
}

function wait(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// ============================ Progress & points ============================
function updateProgress() {
  const stepsCount = state.steps.length || 1;
  const frac = (state.stage + state.stepIndex / stepsCount) / (drinkPool().length || 1);
  $("#progress-fill").style.width = Math.min(100, Math.round(frac * 100)) + "%";
}

let displayedScore = 0;
function animatePoints(to) {
  const el = $("#points-counter");
  const from = displayedScore;
  if (from === to) {
    el.textContent = `★ ${to} pts`;
    return;
  }
  const dur = 600;
  const start = performance.now();
  function tick(now) {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    const val = Math.round(from + (to - from) * eased);
    el.textContent = `★ ${val} pts`;
    if (p < 1) requestAnimationFrame(tick);
    else displayedScore = to;
  }
  requestAnimationFrame(tick);
}

// ============================ Colour helpers ============================
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
function rgbToHex(r, g, b) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
function mixColor(ingredients) {
  let r = 0, g = 0, b = 0, w = 0;
  ingredients.forEach((i) => {
    const ing = INGREDIENT_BY_ID[i.id];
    const wt = ing.unit === "ml" ? i.amount : 5;
    const c = hexToRgb(ing.color);
    r += c.r * wt; g += c.g * wt; b += c.b * wt; w += wt;
  });
  if (!w) return "#9a8";
  return rgbToHex(r / w, g / w, b / w);
}

// ============================ Bar station rendering ============================
function currentGlass() {
  return state.build.glass ? GLASS_BY_ID[state.build.glass] : null;
}

function activeMethod() {
  return state.build.method || currentRecipe()?.method || null;
}

function usesPrepVessel(method = activeMethod()) {
  return ["shake", "stir", "blend"].includes(method);
}

function prepKindFor(method = activeMethod()) {
  if (method === "stir") return "mixing";
  if (method === "blend") return "blender";
  return "shaker";
}

/** Liquid lives in the prep vessel until shake/stir/blend finishes (then transfers). */
function liquidInPrep() {
  return usesPrepVessel() && !state.mixed;
}

/** True when the counter already has the vessels this method needs — no remount. */
function stationReadyForMethod(methodId) {
  if (!$("#glass-mount svg.glass-svg")) return false;
  if (usesPrepVessel(methodId)) {
    const prepMount = $("#prep-mount");
    if (!prepMount || prepMount.hidden) return false;
    if (!prepMount.querySelector("svg.glass-svg")) return false;
  }
  return true;
}

/** Method chrome only — keeps the poured glass SVG intact. */
function syncStationMethodChrome(methodId) {
  const station = $(".station");
  if (!station || !methodId) return;
  station.setAttribute("data-method", methodId);
  station.classList.toggle("has-build", methodId === "build");
  station.classList.toggle("has-muddle", methodId === "muddle");
  station.classList.toggle("has-prep", usesPrepVessel(methodId));
}

function ensureVesselShadow(el) {
  if (!el) return;
  let sh = el.querySelector(":scope > .vessel-shadow");
  if (!sh) {
    sh = document.createElement("span");
    sh.className = "vessel-shadow";
    sh.setAttribute("aria-hidden", "true");
    el.insertBefore(sh, el.firstChild);
  }
  return sh;
}

function renderStation() {
  const mount = $("#glass-mount");
  const prepMount = $("#prep-mount");
  const bench = $("#station-bench");
  const station = $(".station");
  const spoon = $("#tool-spoon");
  const muddler = $("#tool-muddler");

  // Clear vessel contents but keep tools + contact shadows in the mount.
  [...mount.querySelectorAll(".glass-svg, .glass-photo-stack, .glass-ghost, .prep-svg")].forEach((n) => n.remove());
  if (prepMount) {
    [...prepMount.querySelectorAll(".glass-svg, .prep-svg")].forEach((n) => n.remove());
    prepMount.hidden = true;
  }
  station?.classList.remove(
    "has-prep", "has-muddle", "has-build", "is-working",
    "anim-shake", "anim-stir", "anim-muddle", "anim-blend", "anim-build", "anim-strain"
  );
  bench?.classList.remove("is-dual");

  ensureVesselShadow(mount);
  ensureVesselShadow(prepMount);
  if (muddler) muddler.classList.remove("is-placed");
  if (spoon) spoon.classList.remove("is-placed");
  if (muddler && muddler.parentElement !== mount) mount.appendChild(muddler);
  if (spoon && prepMount && spoon.parentElement !== prepMount) prepMount.appendChild(spoon);

  const g = currentGlass();
  if (!g) {
    const ghost = document.createElement("div");
    ghost.className = "glass-ghost";
    ghost.innerHTML = `<span>🍸</span>Select a glass<br />to begin`;
    mount.appendChild(ghost);
    setStatus("Choose a glass");
    return;
  }

  const vessel = Glass.buildGlass(g);
  mount.appendChild(vessel);
  if (muddler) mount.appendChild(muddler);

  // Auto-selected methods (early stages) still park the right tools.
  const method = activeMethod();
  if (station) {
    if (method) station.setAttribute("data-method", method);
    else station.removeAttribute("data-method");
  }
  if (usesPrepVessel(method) && prepMount) {
    const prep = Glass.buildPrepVessel(prepKindFor(method));
    prepMount.appendChild(prep);
    if (spoon) prepMount.appendChild(spoon);
    prepMount.hidden = false;
    station?.classList.add("has-prep");
    bench?.classList.add("is-dual");
  }
  if (method === "muddle") station?.classList.add("has-muddle");
  if (method === "build") station?.classList.add("has-build");

  mount.classList.add("is-on-counter");
  if (prepMount) prepMount.classList.add("is-on-counter");

  updateLiquid(false);
  if (state.build.garnish || state.steps.includes("garnish") || state.mixed) applyGarnishVisual();
  refreshStationStatus();
  requestAnimationFrame(() => placeStationTools());
  const svg = mount.querySelector("svg.glass-svg");
  if (svg) {
    svg.addEventListener("animationend", () => placeStationTools(), { once: true });
  }
}

/** Map a viewBox point into CSS px inside the mount (immune to rotateX on the bench). */
function svgMeetScale(svg, g) {
  const w = svg.clientWidth;
  const h = svg.clientHeight;
  if (!g || !g.vbW || !g.vbH || w < 8 || h < 8) return null;
  return Math.min(w / g.vbW, h / g.vbH);
}

function cssBottomForVb(svg, mount, vbY) {
  const g = Glass.readGeom(svg);
  const scale = svgMeetScale(svg, g);
  if (!scale) return null;
  // Mounts are flex-end; glass SVGs use xMidYMax — viewBox bottom = SVG bottom.
  // CSS `bottom` is the padding edge, so add padding-bottom (not screen Y).
  const padB = parseFloat(getComputedStyle(mount).paddingBottom) || 0;
  return padB + (g.vbH - vbY) * scale;
}

function svgToScreen(svg, x, y) {
  const g = Glass.readGeom(svg);
  if (!svg || !g) return null;
  const r = svg.getBoundingClientRect();
  if (r.width < 8 || r.height < 8) return null;
  const scale = Math.min(r.width / g.vbW, r.height / g.vbH);
  const contentW = g.vbW * scale;
  const contentH = g.vbH * scale;
  // Same as preserveAspectRatio="xMidYMax meet"
  const x0 = r.left + (r.width - contentW) / 2;
  const y0 = r.bottom - contentH;
  return { x: x0 + x * scale, y: y0 + y * scale };
}

function cavityGeom(svg) {
  const g = Glass.readGeom(svg);
  if (!g) return null;
  const cav = g.cavBox || { x: g.cx - (g.iTop || 24), y: g.rimY, w: (g.iTop || 24) * 2, h: g.botY - g.rimY };
  return {
    g,
    rimY: cav.y,
    botY: cav.y + cav.h,
    cx: g.cx,
    rxTop: Math.max(6, cav.w / 2),
    rxBot: Math.max(3, g.iBot || 4),
    stemH: g.stemH || 0,
  };
}

function bowlBox(svg) {
  const cav = cavityGeom(svg);
  if (!cav) return null;
  const rim = svgToScreen(svg, cav.cx, cav.rimY);
  const bot = svgToScreen(svg, cav.cx, cav.botY);
  const left = svgToScreen(svg, cav.cx - cav.rxTop, cav.rimY);
  const right = svgToScreen(svg, cav.cx + cav.rxTop, cav.rimY);
  if (!rim || !bot || bot.y - rim.y < 8) return null;
  return {
    top: rim.y,
    bottom: bot.y,
    cx: rim.x,
    rxTop: left && right ? Math.abs(right.x - left.x) / 2 : cav.rxTop,
    height: bot.y - rim.y,
  };
}

/** Seat muddler / spoon from the live vessel cavity so tools sit IN the glass. */
function placeStationTools(tries = 0) {
  placeMuddler(tries);
  placeSpoon(tries);
}

function placeMuddler(tries = 0) {
  const muddler = $("#tool-muddler");
  const mount = $("#glass-mount");
  const svg = mount && mount.querySelector("svg.glass-svg");
  if (!muddler || !mount) return;
  if (!document.querySelector(".station.has-muddle")) {
    muddler.classList.remove("is-placed");
    return;
  }
  const cav = cavityGeom(svg);
  const scale = svg && cav ? svgMeetScale(svg, cav.g) : null;
  const floorBottom = svg && scale ? cssBottomForVb(svg, mount, cav.botY) : null;
  if (!cav || !scale || floorBottom == null) {
    if (tries < 12) requestAnimationFrame(() => placeMuddler(tries + 1));
    return;
  }
  const bowlH = Math.max(12, (cav.botY - cav.rimY) * scale);
  const stemmed = cav.stemH > 20;
  const shallow = stemmed && bowlH < 80;
  const cone = (cav.g.iBot || 0) < 8 && stemmed;
  const rxPx = cav.rxTop * scale;
  const inset = Math.min(shallow ? 4 : 8, bowlH * 0.08);
  // Pestle on the floor; handle must clear the rim or the tool reads as a toothpick.
  const overRim = shallow || cone
    ? Math.max(bowlH * 0.52, 28)
    : Math.max(bowlH * 0.18, 20);
  const mudH = Math.min(
    Math.max(bowlH - inset + overRim, 56),
    Math.max(72, mount.clientHeight * 0.9)
  );
  const rimW = rxPx * 2;
  const width = cone
    ? Math.max(20, Math.min(26, rimW * 0.3))
    : shallow
      ? Math.max(26, Math.min(36, rimW * 0.2))
      : Math.max(24, Math.min(34, rimW * 0.28));
  const tilt = cone ? 5 : shallow ? 7 : stemmed ? 8 : 11;
  const shift = cone ? Math.min(6, rxPx * 0.08) : Math.min(rxPx * 0.12, 12);
  muddler.style.setProperty("--muddle-bottom", `${Math.max(2, floorBottom + inset)}px`);
  muddler.style.setProperty("--muddle-height", `${mudH}px`);
  muddler.style.setProperty("--muddle-shift", `${shift}px`);
  muddler.style.setProperty("--muddle-width", `${width}px`);
  muddler.style.setProperty("--muddle-tilt", `${tilt}deg`);
  muddler.classList.add("is-placed");
}

function placeSpoon(tries = 0) {
  const spoon = $("#tool-spoon");
  const prepMount = $("#prep-mount");
  const station = $(".station");
  if (!spoon || !prepMount) return;
  if (station?.getAttribute("data-method") !== "stir" || prepMount.hidden) {
    spoon.classList.remove("is-placed");
    return;
  }
  const svg = prepMount.querySelector("svg.glass-svg, svg.prep-svg");
  const cav = cavityGeom(svg);
  const scale = svg && cav ? svgMeetScale(svg, cav.g) : null;
  const floorBottom = svg && scale ? cssBottomForVb(svg, prepMount, cav.botY) : null;
  if (!cav || !scale || floorBottom == null) {
    if (tries < 12) requestAnimationFrame(() => placeSpoon(tries + 1));
    return;
  }
  const bowlH = Math.max(12, (cav.botY - cav.rimY) * scale);
  const spoonH = Math.min(Math.max(bowlH * 1.32, 72), prepMount.clientHeight * 0.92);
  const inset = Math.min(6, bowlH * 0.06);
  const spoonW = Math.max(8, Math.min(11, cav.rxTop * scale * 0.14));
  spoon.style.setProperty("--spoon-bottom", `${Math.max(2, floorBottom + inset)}px`);
  spoon.style.setProperty("--spoon-height", `${spoonH}px`);
  spoon.style.setProperty("--spoon-width", `${spoonW}px`);
  spoon.style.setProperty("--spoon-shift", `${Math.min(10, cav.rxTop * scale * 0.14)}px`);
  spoon.classList.add("is-placed");
}

function measureStationFit() {
  const station = $(".station");
  const method = station?.getAttribute("data-method") || state.build.method || "";
  const glassId = state.build.glass || "";
  const glassSvg = $("#glass-mount svg.glass-svg");
  const prepMount = $("#prep-mount");
  const prepSvg = prepMount && !prepMount.hidden
    ? prepMount.querySelector("svg.glass-svg, svg.prep-svg")
    : null;
  const muddler = $("#tool-muddler");
  const spoon = $("#tool-spoon");
  const bowl = bowlBox(glassSvg);
  const prepBowl = bowlBox(prepSvg);
  const mudVisible = !!(muddler && muddler.classList.contains("is-placed") && getComputedStyle(muddler).opacity !== "0");
  const spoonVisible = !!(spoon && spoon.classList.contains("is-placed") && getComputedStyle(spoon).opacity !== "0");
  const mudR = mudVisible ? muddler.getBoundingClientRect() : null;
  const spoonR = spoonVisible ? spoon.getBoundingClientRect() : null;
  const issues = [];
  const prepOn = !!(prepMount && !prepMount.hidden && prepSvg && prepSvg.clientHeight >= 24);
  if (method === "muddle") {
    if (!mudR || mudR.height < 8) issues.push("muddler-missing");
    else if (bowl) {
      const pestleTop = mudR.top + mudR.height * 0.7;
      if (mudR.bottom > bowl.bottom + 14) issues.push("muddler-below-bowl");
      if (pestleTop > bowl.bottom - 2) issues.push("muddler-in-stem");
      if (mudR.bottom < bowl.top - 2) issues.push("muddler-above-rim");
      if (mudR.top > bowl.top + 10) issues.push("muddler-too-short");
      if (mudR.height < bowl.height * 0.9) issues.push("muddler-too-short");
      if (mudR.width < 18) issues.push("muddler-too-thin");
      const pestleX = (mudR.left + mudR.right) / 2;
      if (pestleX < bowl.cx - bowl.rxTop - 12 || pestleX > bowl.cx + bowl.rxTop + 12) {
        issues.push("muddler-outside-bowl-x");
      }
    } else {
      issues.push("serving-bowl-unreadable");
    }
    if (prepOn) issues.push("prep-should-be-hidden");
  } else if (mudVisible) {
    issues.push("muddler-should-be-hidden");
  }
  if (method === "stir") {
    if (!prepOn) issues.push("mixing-glass-missing");
    if (!spoonR || spoonR.height < 8) issues.push("spoon-missing");
    else if (prepBowl) {
      if (spoonR.bottom > prepBowl.bottom + 16) issues.push("spoon-below-mixing-glass");
      if (spoonR.top > prepBowl.top + 12) issues.push("spoon-too-short");
      if (spoonR.height < prepBowl.height * 0.95) issues.push("spoon-too-short");
      const sx = (spoonR.left + spoonR.right) / 2;
      if (sx < prepBowl.cx - prepBowl.rxTop - 14 || sx > prepBowl.cx + prepBowl.rxTop + 14) {
        issues.push("spoon-outside-mixing-glass");
      }
    } else {
      issues.push("mixing-bowl-unreadable");
    }
  }
  if (method === "shake" || method === "blend") {
    if (!prepOn) issues.push("prep-vessel-missing");
    if (spoonVisible) issues.push("spoon-should-be-hidden");
    const lid = prepSvg && prepSvg.querySelector(".prep-lid");
    const lidR = lid ? lid.getBoundingClientRect() : null;
    if (!lidR || lidR.width < 28) issues.push("prep-lid-missing");
    else if (prepBowl && lidR.width < prepBowl.rxTop * 1.15) issues.push("prep-lid-too-small");
  }
  if (method === "build" && prepOn) issues.push("prep-should-be-hidden");
  if (!glassSvg || glassSvg.clientHeight < 24) issues.push("serving-glass-missing");
  return {
    glass: glassId,
    method,
    issues,
    bowl,
    muddler: mudR ? { top: mudR.top, bottom: mudR.bottom, left: mudR.left, right: mudR.right, height: mudR.height, width: mudR.width } : null,
    spoon: spoonR ? { top: spoonR.top, bottom: spoonR.bottom, height: spoonR.height } : null,
    prepOn,
  };
}

function previewStationCombo(glassId, methodId) {
  if (state.mode !== "mixologist") startMixologist();
  state.build.glass = glassId;
  state.build.method = methodId;
  state.mixed = false;
  const pour = state.steps.indexOf("ingredients");
  state.stepIndex = pour >= 0 ? pour : state.stepIndex;
  renderStation();
  renderTracker();
  updateNav();
  refreshStationStatus();
  return new Promise((resolve) => {
    document.querySelectorAll("#glass-mount .glass-svg, #prep-mount .glass-svg, #prep-mount .prep-svg").forEach((el) => {
      el.style.animation = "none";
    });
    let n = 0;
    const tick = () => {
      placeStationTools();
      const method = $(".station")?.getAttribute("data-method");
      const mudOk = method !== "muddle" || $("#tool-muddler")?.classList.contains("is-placed");
      const spoonOk = method !== "stir" || $("#tool-spoon")?.classList.contains("is-placed");
      if ((mudOk && spoonOk) || n++ > 16) resolve(measureStationFit());
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

try {
  window.__dagtailsStation = {
    preview: previewStationCombo,
    measure: measureStationFit,
    glasses: () => GLASSES.map((g) => g.id),
    methods: () => METHODS.map((m) => m.id),
  };
} catch (e) { /* ignore */ }

function refreshStationStatus() {
  const step = state.steps[state.stepIndex];
  if (!currentGlass()) return;
  const method = activeMethod();
  if (step === "method") {
    setStatus(method ? "Tools on the counter — Next to pour" : "Choose your tools");
    return;
  }
  if (liquidInPrep()) {
    const kind = prepKindFor();
    const label = kind === "mixing" ? "mixing glass" : kind === "blender" ? "blender" : "shaker";
    if (step === "ingredients") setStatus(`Pour into the ${label}`);
    else setStatus(`In the ${label}`);
  } else if (state.mixed && usesPrepVessel()) {
    setStatus("Strained into the glass");
  } else if (step === "ingredients") {
    if (method === "muddle") setStatus("Pour into the glass — muddler ready");
    else if (usesPrepVessel(method)) {
      const kind = prepKindFor(method);
      const label = kind === "mixing" ? "mixing glass" : kind === "blender" ? "blender" : "shaker";
      setStatus(`${label[0].toUpperCase()}${label.slice(1)} is on the counter — pour`);
    } else {
      setStatus("Pour into the glass");
    }
  } else if (method && step === "glass") {
    setStatus("Glass set — tools waiting on the bar");
  }
}

// Compute the liquid bands + fill fraction for the current build.
function computeLiquid(g) {
  const ML_EQUIV = 6; // visual volume a non-ml item (mint/bitters) contributes
  const mlIngs = state.build.ingredients.filter((i) => INGREDIENT_BY_ID[i.id].unit === "ml");
  const nonMl = state.build.ingredients.filter((i) => INGREDIENT_BY_ID[i.id].unit !== "ml");
  const ordered = [...mlIngs, ...nonMl];
  const weight = (i) => (INGREDIENT_BY_ID[i.id].unit === "ml" ? i.amount : ML_EQUIV);
  const totalWeight = ordered.reduce((s, i) => s + weight(i), 0);
  const effectiveMl = mlIngs.reduce((s, i) => s + i.amount, 0) + nonMl.length * ML_EQUIV;
  const fillFrac = effectiveMl > 0 ? Math.max(0.05, Math.min(0.95, effectiveMl / g.cap)) : 0;

  if (totalWeight === 0) return { bands: [], fillFrac: 0 };

  if (state.mixed) {
    return { bands: [{ color: mixColor(state.build.ingredients), frac: 1 }], fillFrac };
  }
  const bands = ordered.map((i) => ({
    color: INGREDIENT_BY_ID[i.id].color,
    frac: weight(i) / totalWeight,
  }));
  return { bands, fillFrac };
}

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    return false;
  }
}

/** Duration for liquid tween from previous → next fill fraction. */
function pourFillDuration(fromFrac, toFrac) {
  if (prefersReducedMotion()) return 0;
  const d = Math.abs((toFrac || 0) - (fromFrac || 0));
  if (d < 0.12) return 480;
  if (d < 0.28) return 650;
  if (d < 0.45) return 900;
  return 1100;
}

function updateLiquid(animate = true, opts = {}) {
  const glassSvg = $("#glass-mount svg.glass-svg");
  const prepSvg = $("#prep-mount svg.glass-svg");
  const g = currentGlass();
  if (!g) return;
  const { bands, fillFrac } = computeLiquid(g);
  const foam = state.mixed && activeMethod() === "shake";
  const motion = animate && !prefersReducedMotion();
  const liquidOpts = { foam, duration: opts.duration };

  if (liquidInPrep() && prepSvg) {
    Glass.setLiquid(prepSvg, bands, Math.min(0.9, fillFrac * 1.05), motion, liquidOpts);
    if (glassSvg) Glass.setLiquid(glassSvg, [], 0, false);
  } else {
    if (prepSvg) Glass.setLiquid(prepSvg, [], 0, motion, liquidOpts);
    if (glassSvg) Glass.setLiquid(glassSvg, bands, fillFrac, motion, liquidOpts);
  }
}

/**
 * Position #pour-stream so it ends at the vessel rim (top = start, bottom = mouth).
 * Coordinates are relative to the stream's offset parent (.counter-stage).
 */
function aimPourStream(target, { reverse = false } = {}) {
  const stream = $("#pour-stream");
  if (!stream || !target) return stream;
  const parent = stream.offsetParent || stream.parentElement;
  if (!parent) return stream;
  const pRect = parent.getBoundingClientRect();
  const tRect = target.getBoundingClientRect();
  const cx = tRect.left + tRect.width * 0.5 - pRect.left;
  // Mouth sits near the top of the mount; stream length scales with vessel size.
  const rimY = tRect.top - pRect.top + Math.max(8, tRect.height * 0.14);
  const streamH = Math.max(44, Math.min(128, tRect.height * 0.52 + 20));
  const top = Math.max(2, rimY - streamH);
  stream.style.left = `${cx}px`;
  stream.style.top = `${top}px`;
  stream.style.height = `${streamH}px`;
  stream.style.transformOrigin = reverse ? "bottom center" : "top center";
  stream.style.transform = "translateX(-50%) scaleY(0)";
  return stream;
}

/**
 * @param {string} id ingredient id
 * @param {{ reverse?: boolean, duration?: number }} [opts]
 */
function animatePour(id, opts = {}) {
  const reverse = !!opts.reverse;
  const ing = INGREDIENT_BY_ID[id];
  const color = (ing && ing.color) || "#cde";
  const target = liquidInPrep() ? $("#prep-mount") : $("#glass-mount");
  const stream = $("#pour-stream");
  const reduced = prefersReducedMotion();

  if (stream) {
    stream.style.color = color;
    stream.classList.remove("is-pouring", "is-pouring-out");
    if (!reduced && target) {
      aimPourStream(target, { reverse });
      void stream.offsetWidth;
      stream.classList.add(reverse ? "is-pouring-out" : "is-pouring");
      const ms = reverse ? 480 : 720;
      setTimeout(() => stream.classList.remove("is-pouring", "is-pouring-out"), ms);
    }
  }

  if (!reduced && !reverse) spawnSplash(color, target);
  if (!reduced) {
    if (reverse) Sound.click();
    else Sound.pour();
  }

  updateLiquid(true, { duration: opts.duration });
  refreshStationStatus();
}

function spawnSplash(color, mouthEl) {
  if (prefersReducedMotion()) return;
  const station = $(".station");
  const mouth = mouthEl || $("#glass-mount");
  if (!station || !mouth) return;
  const sRect = station.getBoundingClientRect();
  const mRect = mouth.getBoundingClientRect();
  const cxPct = ((mRect.left + mRect.width / 2 - sRect.left) / sRect.width) * 100;
  const topPx = mRect.top - sRect.top + Math.max(10, mRect.height * 0.14);
  for (let i = 0; i < 7; i++) {
    const d = document.createElement("span");
    d.className = "droplet";
    d.style.background = color;
    d.style.left = cxPct + "%";
    d.style.top = topPx + "px";
    d.style.setProperty("--dx", (Math.random() * 60 - 30).toFixed(0) + "px");
    d.style.setProperty("--dy", (20 + Math.random() * 40).toFixed(0) + "px");
    d.style.animationDelay = (Math.random() * 0.12).toFixed(2) + "s";
    station.appendChild(d);
    setTimeout(() => d.remove(), 700);
  }
}

function applyGarnishVisual() {
  const svg = $("#glass-mount svg.glass-svg");
  if (!svg) return;
  const gid = state.build.garnish;
  Glass.setGarnish(svg, gid, gid ? GARNISH_BY_ID[gid].emoji : "");
}

// ============================ Method animation ============================
function setStatus(text) {
  const el = $("#station-status");
  if (el) el.textContent = text;
}

async function animateStrainTransfer(methodId) {
  const station = $(".station");
  const prepMount = $("#prep-mount");
  const glassMount = $("#glass-mount");
  const stream = $("#pour-stream");
  if (!station || !prepMount || prepMount.hidden) {
    state.mixed = true;
    updateLiquid(true);
    return;
  }

  setStatus(methodId === "blend" ? "Pouring into the glass…" : "Straining into the glass…");
  station.classList.add("anim-strain");

  const color = mixColor(state.build.ingredients);
  const reduced = prefersReducedMotion();
  if (stream) {
    stream.style.color = color;
    stream.classList.remove("is-pouring", "is-pouring-out");
    if (!reduced && glassMount) {
      aimPourStream(glassMount);
      void stream.offsetWidth;
      stream.classList.add("is-pouring");
    }
  }
  if (!reduced) {
    Sound.pour();
    spawnSplash(color, glassMount);
  }

  // Empty prep while filling glass
  const prepSvg = prepMount.querySelector("svg.glass-svg");
  const glassSvg = glassMount.querySelector("svg.glass-svg");
  const g = currentGlass();
  const { fillFrac } = computeLiquid(g);
  if (prepSvg) Glass.setLiquid(prepSvg, [], 0, !reduced);
  state.mixed = true;
  if (glassSvg && g) {
    Glass.setLiquid(glassSvg, [{ color, frac: 1 }], fillFrac, !reduced, {
      foam: methodId === "shake",
      duration: reduced ? 0 : 780,
    });
  }

  await wait(reduced ? 120 : 780);
  if (stream) stream.classList.remove("is-pouring", "is-pouring-out");
  station.classList.remove("anim-strain");
}

async function runMethod(methodId) {
  const station = $(".station");
  if (!station) return;
  state.mixed = false;
  if (state.build.method !== methodId) state.build.method = methodId;

  // Remount only when vessels are missing. Always rebuilding the glass SVG
  // flashes a redraw on Serve for build drinks (e.g. Paloma) that already sit
  // in the serving glass.
  const remounted = !stationReadyForMethod(methodId);
  if (remounted) {
    renderStation();
    updateLiquid(false);
  } else {
    syncStationMethodChrome(methodId);
  }

  const labels = {
    shake: "Shaking…",
    stir: "Stirring…",
    build: "Building in the glass…",
    muddle: "Muddling…",
    blend: "Blending…",
  };
  setStatus(labels[methodId] || "Mixing…");

  setNavDisabled(true);
  if (Sound[methodId]) Sound[methodId]();
  station.classList.add("is-working", "anim-" + methodId);
  const durations = { shake: 1100, stir: 1100, muddle: 1100, blend: 1200, build: 600 };
  await wait(durations[methodId] || 1000);
  station.classList.remove("anim-" + methodId);

  if (["shake", "stir", "blend"].includes(methodId)) {
    await animateStrainTransfer(methodId);
  } else if (remounted) {
    // Build/muddle: only repaint if we just created a fresh empty glass.
    updateLiquid(false);
  }

  station.classList.remove("is-working");
  applyGarnishVisual();
  setNavDisabled(false);
  refreshStationStatus();
  if (!liquidInPrep() && state.mixed) setStatus("Ready for the next step");
  else if (!usesPrepVessel(methodId)) setStatus("Ready for the next step");
}

// ============================ Step tracker ============================
function renderTracker() {
  const el = $("#step-tracker");
  if (!el) return;
  // Short flows (ingredients → serve) don't need a tracker — frees chrome.
  const show = (state.steps || []).length > 2;
  el.hidden = !show;
  el.innerHTML = "";
  if (!show) return;
  const nodes = [...state.steps, "serve"];
  nodes.forEach((step, i) => {
    if (i > 0) {
      const sep = document.createElement("span");
      sep.className = "step-sep";
      el.appendChild(sep);
    }
    const node = document.createElement("span");
    const isServe = step === "serve";
    const label = isServe ? "Serve" : STEP_META[step].label;
    let cls = "step-node";
    if (i === state.stepIndex) cls += " is-active";
    else if (i < state.stepIndex) cls += " is-done";
    node.className = cls;
    const mark = i < state.stepIndex ? "✓" : i + 1;
    node.innerHTML = `<span class="dot">${mark}</span>${label}`;
    el.appendChild(node);
  });
}

// ============================ Step panels ============================
function renderStepPanel() {
  const step = state.steps[state.stepIndex];
  const panel = $("#step-panel");
  const meta = STEP_META[step];
  let sub = meta.sub;
  const guessCompact = step === "ingredients" && isGuessMode();
  if (guessCompact) {
    sub = "Tap the ingredients you think belong in this drink — no measuring.";
  }
  let title = meta.title;
  if (step === "ingredients" && !isGuessMode()) {
    title = "Pour your ingredients";
    sub = "Tap to add. Tap again to dial the amount. One chip open at a time.";
  }
  panel.classList.toggle("is-guess-compact", guessCompact);
  panel.innerHTML = `
    <h3 class="step-panel-title">${title}</h3>
    <p class="step-panel-sub">${sub}</p>
    <div id="panel-body"></div>
  `;
  const body = $("#panel-body");
  if (step === "glass") renderGlassPanel(body);
  else if (step === "ingredients") renderIngredientsPanel(body);
  else if (step === "method") renderMethodPanel(body);
  else if (step === "garnish") renderGarnishPanel(body);
}

function chip(item, selected, withHint) {
  const btn = document.createElement("button");
  btn.className = "chip" + (selected ? " is-selected" : "");
  btn.innerHTML =
    `<span class="emoji">${item.emoji ?? "•"}</span>` +
    `<span>${item.name}` +
    (withHint && item.hint ? `<span class="chip-hint">${item.hint}</span>` : "") +
    `</span>`;
  return btn;
}

function renderGlassPanel(body) {
  const grid = document.createElement("div");
  grid.className = "chip-grid";
  GLASSES.forEach((g) => {
    const c = chip(g, state.build.glass === g.id, false);
    c.addEventListener("click", () => {
      Sound.select();
      state.build.glass = g.id;
      renderStation();
      renderGlassPanel(body);
      updateNav();
    });
    grid.appendChild(c);
  });
  body.innerHTML = "";
  body.appendChild(grid);
  applyTrainingHints();
}

function renderMethodPanel(body) {
  const grid = document.createElement("div");
  grid.className = "chip-grid";
  METHODS.forEach((m) => {
    const c = chip(m, state.build.method === m.id, true);
    c.addEventListener("click", () => {
      Sound.select();
      state.build.method = m.id;
      state.mixed = false;
      // Park the tool on the counter — don't shake/stir until after the pour.
      renderStation();
      renderMethodPanel(body);
      updateNav();
      const kind = usesPrepVessel(m.id)
        ? (m.id === "stir" ? "mixing glass" : m.id === "blend" ? "blender" : "shaker")
        : m.id === "muddle" ? "muddler" : "glass";
      setStatus(m.id === "build" ? "Build in the glass — ready to pour" : `${METHOD_BY_ID[m.id].name} set — ${kind} on the counter`);
    });
    grid.appendChild(c);
  });
  body.innerHTML = "";
  body.appendChild(grid);
  applyTrainingHints();
}

function renderGarnishPanel(body) {
  const grid = document.createElement("div");
  grid.className = "chip-grid";
  GARNISHES.forEach((g) => {
    const c = chip(g, state.build.garnish === g.id, false);
    c.addEventListener("click", () => {
      state.build.garnish = g.id;
      applyGarnishVisual();
      if (g.id !== "none") Sound.garnish();
      else Sound.click();
      renderGarnishPanel(body);
      updateNav();
    });
    grid.appendChild(c);
  });
  body.innerHTML = "";
  body.appendChild(grid);
  applyTrainingHints();
}

// ---- Ingredients panel ----
function renderIngredientsPanel(body) {
  // Catalog only. Guess: tap-toggle. Mixologist / Pour: expand the chip to dial.
  body.innerHTML = `
    <div class="ingredient-layout is-catalog-only">
      <div class="ingredient-catalog" id="ingredient-catalog"></div>
    </div>
  `;
  fillCatalog();
}

function ingredientCatOrder() {
  return [...new Set(INGREDIENTS.map((i) => i.cat))];
}

function makeCatalogChip(ing, added) {
  const guess = isGuessMode();
  const inGlass = added.has(ing.id);
  const editing = !guess && inGlass && state.editingIngredientId === ing.id;
  const node = document.createElement(editing ? "div" : "button");
  if (!editing) node.type = "button";
  node.className = "cat-item";
  node.dataset.ingId = ing.id;
  node.dataset.ingName = ing.name;

  if (guess) {
    if (inGlass) node.classList.add("is-selected");
    node.setAttribute("aria-pressed", inGlass ? "true" : "false");
    node.textContent = ing.name;
    node.addEventListener("click", () => toggleIngredient(ing.id));
    return node;
  }

  if (editing) {
    const entry = state.build.ingredients.find((i) => i.id === ing.id);
    const disp = dispAmount(ing.unit, entry.amount);
    node.classList.add("is-in-glass", "is-editing");
    node.setAttribute("role", "group");
    node.setAttribute("aria-label", `${ing.name} amount`);
    node.setAttribute("aria-expanded", "true");

    const name = document.createElement("span");
    name.className = "cat-item-name";
    name.textContent = ing.name;

    const stepper = document.createElement("div");
    stepper.className = "cat-item-stepper";

    const dec = document.createElement("button");
    dec.type = "button";
    dec.className = "cat-item-step";
    dec.setAttribute("aria-label", `Less ${ing.name}`);
    dec.textContent = "−";
    dec.addEventListener("click", (e) => {
      e.stopPropagation();
      const cur = state.build.ingredients.find((i) => i.id === ing.id);
      if (!cur) return;
      const shown = dispAmount(ing.unit, cur.amount);
      changeAmount(ing.id, toMl(ing.unit, shown.val - dispStep(ing.unit)), false);
    });

    const amt = document.createElement("span");
    amt.className = "cat-item-amt";
    amt.textContent = String(disp.val);
    amt.setAttribute("aria-live", "polite");

    const unit = document.createElement("span");
    unit.className = "cat-item-unit";
    unit.textContent = disp.label;

    const inc = document.createElement("button");
    inc.type = "button";
    inc.className = "cat-item-step is-plus";
    inc.setAttribute("aria-label", `More ${ing.name}`);
    inc.textContent = "+";
    inc.addEventListener("click", (e) => {
      e.stopPropagation();
      const cur = state.build.ingredients.find((i) => i.id === ing.id);
      if (!cur) return;
      const shown = dispAmount(ing.unit, cur.amount);
      changeAmount(ing.id, toMl(ing.unit, shown.val + dispStep(ing.unit)), true);
    });

    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "cat-item-remove";
    rm.setAttribute("aria-label", `Remove ${ing.name}`);
    rm.textContent = "×";
    rm.addEventListener("click", (e) => {
      e.stopPropagation();
      removeIngredient(ing.id);
    });

    stepper.append(dec, amt, unit, inc);
    node.append(name, stepper, rm);
    return node;
  }

  if (inGlass) {
    const entry = state.build.ingredients.find((i) => i.id === ing.id);
    const disp = dispAmount(ing.unit, entry.amount);
    node.classList.add("is-in-glass");
    node.setAttribute("aria-pressed", "true");
    node.setAttribute("aria-expanded", "false");
    const name = document.createElement("span");
    name.className = "cat-item-name";
    name.textContent = ing.name;
    const badge = document.createElement("span");
    badge.className = "cat-item-badge";
    badge.textContent = String(disp.val);
    node.append(name, badge);
    node.addEventListener("click", () => {
      Sound.select();
      selectIngredientForEdit(ing.id);
    });
    return node;
  }

  node.setAttribute("aria-pressed", "false");
  node.textContent = ing.name;
  node.addEventListener("click", () => {
    Sound.select();
    addIngredient(ing.id);
  });
  return node;
}

function appendCatalogGroups(el, list, added) {
  const order = ingredientCatOrder();
  const cats = order.filter((cat) => list.some((i) => i.cat === cat));
  cats.forEach((cat) => {
    const group = document.createElement("div");
    group.className = "cat-group";
    group.innerHTML = `<p class="cat-group-title">${cat}</p>`;
    const items = document.createElement("div");
    items.className = "cat-items";
    list.filter((i) => i.cat === cat).forEach((ing) => {
      items.appendChild(makeCatalogChip(ing, added));
    });
    group.appendChild(items);
    el.appendChild(group);
  });
}

function fillCatalog() {
  const el = $("#ingredient-catalog");
  if (!el) return;
  el.innerHTML = "";
  const added = new Set(state.build.ingredients.map((i) => i.id));
  // Underage players never see anything alcoholic.
  const pantry = isUnderage() ? INGREDIENTS.filter((i) => (i.mx?.abv || 0) === 0) : INGREDIENTS;

  // Early stages use a short curated menu — still grouped by type.
  if (state.menuIds) {
    const list = [...state.menuIds].map((id) => INGREDIENT_BY_ID[id]).filter(Boolean);
    appendCatalogGroups(el, list, added);
  } else {
    appendCatalogGroups(el, pantry, added);
  }
  applyTrainingHints();
  const open = el.querySelector(".cat-item.is-editing");
  if (open) {
    requestAnimationFrame(() => open.scrollIntoView({ block: "nearest", inline: "nearest" }));
  }
}

function fillBuildList() {
  const el = $("#build-list");
  if (!el) return;
  el.innerHTML = "";
  if (state.build.ingredients.length === 0) {
    el.innerHTML = `<p class="build-empty">No ingredients yet. Tap one to add it.</p>`;
    return;
  }
  const guessMode = isGuessMode();
  state.build.ingredients.forEach((entry) => {
    const ing = INGREDIENT_BY_ID[entry.id];
    const meta = unitMeta(ing.unit);
    const row = document.createElement("div");
    row.className = "build-row";
    if (guessMode) {
      // No portions yet — just show what's been added.
      row.innerHTML = `
        <span class="ing-name">${ing.name}</span>
        <span class="unit guess-added">✓ added</span>
        <button class="remove-btn" title="Remove">×</button>
      `;
      row.querySelector(".remove-btn").addEventListener("click", () => removeIngredient(entry.id));
      el.appendChild(row);
      return;
    }
    // Show amounts in the player's chosen units (ml stored internally).
    const disp = dispAmount(ing.unit, entry.amount);
    const step = dispStep(ing.unit);
    row.innerHTML = `
      <span class="ing-name">${ing.name}</span>
      <div class="stepper">
        <button data-act="dec">−</button>
        <input type="number" value="${disp.val}" min="${meta.min}" step="${step}" />
        <button data-act="inc">+</button>
      </div>
      <span class="unit">${disp.label}</span>
      <button class="remove-btn" title="Remove">×</button>
    `;
    const input = row.querySelector("input");
    row.querySelector('[data-act="dec"]').addEventListener("click", () => changeAmount(entry.id, toMl(ing.unit, disp.val - step), false));
    row.querySelector('[data-act="inc"]').addEventListener("click", () => changeAmount(entry.id, toMl(ing.unit, disp.val + step), true));
    input.addEventListener("change", () => changeAmount(entry.id, toMl(ing.unit, Number(input.value) || 0), false));
    row.querySelector(".remove-btn").addEventListener("click", () => removeIngredient(entry.id));
    el.appendChild(row);
  });
}

function addIngredient(id) {
  if (state.build.ingredients.some((i) => i.id === id)) {
    if (!isGuessMode()) selectIngredientForEdit(id);
    return;
  }
  state.mixed = false; // adding changes the build; un-blend
  const g = currentGlass();
  const beforeFrac = g ? computeLiquid(g).fillFrac : 0;
  let amount = unitMeta(INGREDIENT_BY_ID[id].unit).def;
  // In guess mode the player doesn't set volumes — pour the *correct* recipe
  // portion for ingredients that belong to the drink so it looks realistic.
  if (isGuessMode()) {
    const recipe = currentRecipe();
    const target = recipe && recipe.ingredients.find((i) => i.id === id);
    if (target) amount = target.amount;
  }
  state.build.ingredients.push({ id, amount });
  if (!isGuessMode()) state.editingIngredientId = id;
  fillCatalog();
  fillBuildList();
  const afterFrac = g ? computeLiquid(g).fillFrac : beforeFrac;
  animatePour(id, { duration: pourFillDuration(beforeFrac, afterFrac) });
  updateNav();
}

/** Guess-mode tap: add to glass + highlight, or remove if already picked. */
function toggleIngredient(id) {
  if (state.build.ingredients.some((i) => i.id === id)) {
    removeIngredient(id);
    return;
  }
  Sound.select();
  addIngredient(id);
}

function selectIngredientForEdit(id) {
  if (isGuessMode()) return;
  if (!state.build.ingredients.some((i) => i.id === id)) return;
  state.editingIngredientId = id;
  fillCatalog();
}

function removeIngredient(id) {
  const g = currentGlass();
  const beforeFrac = g ? computeLiquid(g).fillFrac : 0;
  state.build.ingredients = state.build.ingredients.filter((i) => i.id !== id);
  if (state.editingIngredientId === id) state.editingIngredientId = null;
  state.mixed = false;
  fillCatalog();
  fillBuildList();
  const afterFrac = g ? computeLiquid(g).fillFrac : 0;
  animatePour(id, {
    reverse: true,
    duration: pourFillDuration(beforeFrac, afterFrac),
  });
  updateNav();
}

function syncChipAmount(id) {
  const chip = document.querySelector(`.cat-item[data-ing-id="${id}"]`);
  if (!chip) return;
  const entry = state.build.ingredients.find((i) => i.id === id);
  if (!entry) return;
  const ing = INGREDIENT_BY_ID[id];
  const disp = dispAmount(ing.unit, entry.amount);
  const amt = chip.querySelector(".cat-item-amt");
  const badge = chip.querySelector(".cat-item-badge");
  if (amt) amt.textContent = String(disp.val);
  if (badge) badge.textContent = String(disp.val);
}

function changeAmount(id, value, pour) {
  const ing = state.build.ingredients.find((i) => i.id === id);
  if (!ing) return;
  const meta = unitMeta(INGREDIENT_BY_ID[id].unit);
  if (value <= 0 || value < meta.min) {
    removeIngredient(id);
    return;
  }
  ing.amount = Math.max(meta.min, value);
  syncChipAmount(id);
  fillBuildList();
  if (pour) animatePour(id);
  else updateLiquid();
}

// ============================ Step navigation ============================
function getSteps(difficulty) {
  let steps = difficulty === "basic"
    ? ["method", "ingredients", "garnish"]
    : ["glass", "method", "ingredients", "garnish"];
  // Mixologist keeps the full flow; campaign/training honor hold flags.
  if (state.mode === "mixologist") return steps;
  if (!GLASS_ENABLED) steps = steps.filter((s) => s !== "glass");
  if (!TOOLS_ENABLED) steps = steps.filter((s) => s !== "method");
  if (!GARNISH_ENABLED) steps = steps.filter((s) => s !== "garnish");
  return steps;
}

function stepSatisfied(step) {
  switch (step) {
    case "glass": return !!state.build.glass;
    case "ingredients": return state.build.ingredients.length > 0;
    case "method": return !!state.build.method;
    case "garnish": return !!state.build.garnish;
    default: return true;
  }
}

function setNavDisabled(disabled) {
  $("#btn-next").disabled = disabled;
  // Back stays available — at step 0 it leaves the pour (map / menu).
  $("#btn-back").disabled = !!disabled;
}

function updateNav() {
  const step = state.steps[state.stepIndex];
  const isLast = state.stepIndex === state.steps.length - 1;
  $("#btn-next").textContent = isLast ? "Serve Drink" : "Next →";
  $("#btn-next").disabled = !stepSatisfied(step);
  $("#btn-back").disabled = false;
}

function enterStep() {
  const step = state.steps[state.stepIndex];
  if (step === "ingredients") {
    state.mixed = false;
    updateLiquid();
  }
  if (step === "ingredients" && !isGuessMode()) setStatus("Pour your ingredients");
  else setStatus(STEP_META[step].status);
  renderTracker();
  renderStepPanel();
  renderCoach();
  applyTrainingHints();
  updateNav();
  updateProgress();
}

/** Shake / stir / muddle / blend once before advancing or scoring. */
async function prepareDrinkIfNeeded() {
  const methodId = state.build.method || activeMethod();
  if (!methodId || state.mixed) return false;
  state.build.method = methodId;
  const panel = $("#step-panel");
  const name = METHOD_BY_ID[methodId]?.name || "method";
  if (panel) {
    panel.innerHTML = `<div class="auto-note">Working the drink — <strong>${name}</strong>…</div>`;
  }
  await runMethod(methodId);
  return true;
}

async function goNext() {
  const cur = state.steps[state.stepIndex];
  const isLast = state.stepIndex >= state.steps.length - 1;
  // After pouring, and again on Serve if somehow still unmixed (e.g. last
  // step is garnish), run the method whether the player chose tools or the
  // recipe auto-set them.
  if ((cur === "ingredients" || isLast) && !state.mixed) {
    await prepareDrinkIfNeeded();
  }
  if (!isLast) {
    state.stepIndex++;
    enterStep();
  } else {
    if (!state.mixed) await prepareDrinkIfNeeded();
    serve();
  }
}

function goBack() {
  if (state.stepIndex > 0) {
    state.stepIndex--;
    stepsBack += 1;
    enterStep();
    return;
  }
  // First step: leave the station (same destinations as Quit).
  Sound.click();
  drinkAbandoned("back");
  if (state.mode === "campaign") {
    const stop = venueForStage(state.stage);
    renderMap({ step: "path", openVenueId: stop.venue.id, stageIndex: state.stage });
    showScreen("screen-map");
  } else {
    renderStartBest();
    showScreen("screen-start");
  }
}

// ============================ Stage loading ============================
function setGameVenue(label) {
  const el = $("#game-venue");
  if (!el) return;
  el.textContent = label || "";
  el.hidden = !label;
}

const DEFAULT_BAR_BG = "assets/station/bar-stage.png";

function assetBaseHref() {
  const declared = document.querySelector("base")?.href;
  if (declared) return declared;
  try {
    const u = new URL(document.baseURI || document.URL);
    const last = (u.pathname.split("/").pop() || "");
    const looksLikeFile = /\.[a-z0-9]+$/i.test(last);
    if (!looksLikeFile && !u.pathname.endsWith("/")) u.pathname += "/";
    u.search = "";
    u.hash = "";
    return u.href;
  } catch (e) {
    return document.baseURI || "./";
  }
}

/** Resolve game asset paths against the page (not the hashed CSS bundle). */
function resolveAssetUrl(path) {
  if (!path) return "";
  if (/^(?:https?:|data:|blob:)/i.test(path)) return path;
  try {
    return new URL(path.replace(/^\.\//, ""), assetBaseHref()).href;
  } catch (e) {
    return path;
  }
}

/** HTML `<img src="assets/…">` is resolved at parse time — rewrite after JS loads. */
function rewriteRelativeAssetImgs() {
  document.querySelectorAll("img[src]").forEach((img) => {
    const raw = img.getAttribute("src");
    if (!raw || /^(?:https?:|data:|blob:|\/\/)/i.test(raw)) return;
    img.src = resolveAssetUrl(raw);
  });
}
rewriteRelativeAssetImgs();
try {
  window.__dagtailsResolveAssetUrl = resolveAssetUrl;
} catch (e) { /* ignore */ }

/** Swap the station (and result card) backdrop to the venue's interior art. */
function applyVenueChrome(venue) {
  const path = (venue && (venue.interior || venue.bg)) || DEFAULT_BAR_BG;
  // Absolute URLs: relative url() inside --venue-bar-bg was resolving against
  // www/assets/index-*.css and 404ing (black bar void on Pages / production).
  const cssUrl = `url("${resolveAssetUrl(path)}")`;
  const bar = $(".bar-bg");
  if (bar) bar.style.setProperty("--venue-bar-bg", cssUrl);

  const card = $("#screen-result .result-card");
  if (card) {
    if (venue && (venue.interior || venue.bg)) {
      card.style.setProperty("--venue-bar-bg", cssUrl);
      card.classList.add("has-venue-bg");
    } else {
      card.style.removeProperty("--venue-bar-bg");
      card.classList.remove("has-venue-bg");
    }
  }
}

/** Mixologist / free pour has no recipe face — block flip and hide hints. */
function setTicketFlippable(on) {
  const ticket = $("#order-ticket");
  if (!ticket) return;
  const flippable = !!on;
  ticket.classList.toggle("is-no-flip", !flippable);
  if (!flippable) {
    setTicketFlipped(false);
    ticket.removeAttribute("tabindex");
    ticket.setAttribute("role", "group");
    ticket.removeAttribute("aria-pressed");
    ticket.setAttribute("aria-label", "Order ticket");
  } else {
    ticket.setAttribute("tabindex", "0");
    ticket.setAttribute("role", "button");
    ticket.setAttribute("aria-pressed", ticket.classList.contains("is-flipped") ? "true" : "false");
    ticket.setAttribute("aria-label", "Order ticket — flip for recipe");
  }
}

function setTicketFlipped(on) {
  const ticket = $("#order-ticket");
  if (!ticket) return;
  if (ticket.classList.contains("is-no-flip")) on = false;
  ticket.classList.toggle("is-flipped", !!on);
  if (!ticket.classList.contains("is-no-flip")) {
    ticket.setAttribute("aria-pressed", on ? "true" : "false");
  }
  const back = ticket.querySelector(".ticket-face--back");
  const front = ticket.querySelector(".ticket-face--front");
  if (back) back.setAttribute("aria-hidden", on ? "false" : "true");
  if (front) front.setAttribute("aria-hidden", on ? "true" : "false");
}

function renderTicketRecipe(recipe) {
  const list = $("#ticket-recipe");
  if (!list) return;
  if (!recipe || !Array.isArray(recipe.ingredients)) {
    list.innerHTML = `<li class="ticket-recipe-empty">Free pour — invent the recipe yourself.</li>`;
    return;
  }
  const glass = GLASS_BY_ID[recipe.glass]?.name || recipe.glass || "—";
  const method = METHOD_BY_ID[recipe.method]?.name || recipe.method || "—";
  const garnishId = Array.isArray(recipe.garnish)
    ? recipe.garnish.find((g) => g && g !== "none")
    : (recipe.garnish && recipe.garnish !== "none" ? recipe.garnish : null);
  const garnish = garnishId ? (GARNISH_BY_ID[garnishId]?.name || garnishId) : null;
  const rows = [
    `<li><span class="tr-k">Glass</span><span class="tr-v">${glass}</span></li>`,
    `<li><span class="tr-k">Method</span><span class="tr-v">${method}</span></li>`,
  ];
  recipe.ingredients.forEach((line) => {
    const ing = INGREDIENT_BY_ID[line.id];
    if (!ing) return;
    let amount = "";
    try {
      const disp = dispAmount(ing.unit, line.amount);
      amount = `${disp.val} ${disp.label}`;
    } catch (e) {
      amount = `${line.amount} ${ing.unit || ""}`.trim();
    }
    rows.push(`<li><span class="tr-k">${ing.name}</span><span class="tr-v">${amount}</span></li>`);
  });
  if (garnish) rows.push(`<li><span class="tr-k">Garnish</span><span class="tr-v">${garnish}</span></li>`);
  list.innerHTML = rows.join("");
}

function setTicketOrigin(recipe) {
  const el = $("#ticket-origin");
  if (!el) return;
  const o = recipe && recipe.origin;
  if (!o) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  const place = [o.city, o.country].filter(Boolean).join(", ");
  el.innerHTML =
    `<span class="ticket-origin-flag">${o.flag || ""}</span>` +
    `<span class="ticket-origin-place">${place}</span>` +
    (o.lore ? `<span class="ticket-origin-lore">${o.lore}</span>` : "");
  el.hidden = false;
}

function loadStage(index) {
  state.mode = "campaign";
  state.challenge = null;
  state.stage = index;
  state.build = emptyBuild();
  state.mixed = false;
  $(".progress-wrap").style.display = "";
  $(".progress-track").style.display = "";
  $("#endless-hud").style.display = "none";
  const pool = drinkPool();
  const recipe = pool[index];

  // Complexity scales with how far you've climbed.
  applyComplexity(complexityForStage(index + 1), recipe);

  const stop = venueForStage(index);
  rememberHubVenue(stop.venue);
  setGameVenue(
    stop.venue
      ? `${stop.venue.flag || ""} ${stop.venue.name}`.trim()
      : ""
  );
  applyVenueChrome(stop.venue);
  $("#stage-pill").textContent = `Stop ${index + 1} / ${pool.length}`;
  $("#diff-pill").textContent = state.complexity.label;
  pickCustomer();
  renderCustomer(recipe.name);
  $("#order-name").textContent = recipe.name;
  $("#order-desc").textContent = recipe.order;
  setTicketOrigin(recipe);
  renderTicketRecipe(recipe);
  setTicketFlippable(true);
  setTicketFlipped(false);
  animatePoints(state.totalScore);
  updateProgress();

  renderStation();
  enterStep();
  showScreen("screen-game");
  maybeShowTierIntro(state.complexity.label);
  trackDrinkStarted({ recipe: recipe.name, venue: stop.venue?.id });
}

// ============================ Endless shift ============================
function renderEndlessHud() {
  const hearts = "❤".repeat(state.lives) + "🖤".repeat(Math.max(0, 3 - state.lives));
  $("#endless-hud").innerHTML =
    `<span class="hud-lives">${hearts}</span>` +
    `<span class="hud-streak">🔥 ${state.streak}</span>` +
    `<span class="hud-served">🍸 ${state.served}</span>`;
}

function loadEndless(next = false) {
  state.mode = "endless";
  state.challenge = null;
  state.build = emptyBuild();
  state.mixed = false;

  // Pick a random recipe that isn't an immediate repeat.
  const pool = drinkPool();
  let idx = Math.floor(Math.random() * pool.length);
  if (pool.length > 1) {
    while (idx === state.lastEndlessIdx) idx = Math.floor(Math.random() * pool.length);
  }
  state.lastEndlessIdx = idx;
  const recipe = pool[idx];
  state.endlessRecipe = recipe;

  // Endless mirrors the player's current ramp difficulty.
  applyComplexity(complexityForStage(getMap().cleared + 1), recipe);

  // HUD: hide the linear progress bar, show lives/streak.
  $(".progress-wrap").style.display = "";
  $(".progress-track").style.display = "none";
  $("#endless-hud").style.display = "";
  renderEndlessHud();

  setGameVenue("Now serving");
  applyVenueChrome(venueOf(recipe) || venueForStage(getMap().cleared || 0)?.venue);
  $("#stage-pill").textContent = `Endless · 🍸 ${state.served}`;
  $("#diff-pill").textContent = state.complexity.label;
  pickCustomer();
  renderCustomer(recipe.name);
  $("#order-name").textContent = recipe.name;
  $("#order-desc").textContent = recipe.order;
  setTicketOrigin(recipe);
  renderTicketRecipe(recipe);
  setTicketFlippable(true);
  setTicketFlipped(false);
  animatePoints(state.totalScore);

  renderStation();
  enterStep();
  showScreen("screen-game");
  trackDrinkStarted({ recipe: recipe.name });
}

function serveEndless() {
  lastResult = scoreBuild();
  state.served += 1;
  let tip = 0;
  if (lastResult.stars >= 1) {
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    if (lastResult.stars === 3) tip = 10 + state.streak * 2; // streak-boosted tip
  } else {
    state.lives -= 1;
    state.streak = 0;
    Sound.fail();
  }
  lastResult.tip = tip;
  state.totalScore += lastResult.stagePoints + tip;
  recordResult(lastResult);
  showResult(lastResult);
}

function showEndlessFinish() {
  const best = getEndlessBest();
  const isNew = state.totalScore > best;
  if (isNew) setEndlessBest(state.totalScore);

  $("#endless-stats").innerHTML =
    `<div class="estat"><span class="estat-num">${state.totalScore}</span><span class="estat-lbl">points</span></div>` +
    `<div class="estat"><span class="estat-num">${state.served}</span><span class="estat-lbl">served</span></div>` +
    `<div class="estat"><span class="estat-num">${state.bestStreak}</span><span class="estat-lbl">best streak</span></div>`;

  let rank;
  if (state.served >= 20) rank = "🏆 Legend of the Bar";
  else if (state.served >= 14) rank = "🍸 Head Bartender";
  else if (state.served >= 8) rank = "🥃 Solid Shift";
  else if (state.served >= 4) rank = "🍋 Getting There";
  else rank = "🧽 Cut Short";
  $("#endless-rank").textContent = rank;

  const bestEl = $("#endless-best");
  if (isNew) {
    bestEl.textContent = `🎉 New endless record! (was ${best} pts)`;
    bestEl.classList.add("is-new");
    Sound.coin();
  } else {
    bestEl.textContent = `🔥 Endless best: ${best} pts`;
    bestEl.classList.remove("is-new");
  }
  renderStartBest();
  track("endless_over", {
    served: state.served,
    best_streak: state.bestStreak,
    score: state.totalScore,
    lives: state.lives,
  });
  showScreen("screen-endless");
}

// ============================ Scoring ============================
function tolerance(unit, target) {
  if (unit === "ml") return Math.max(7.5, target * 0.2);
  return 0;
}

// A rough 1-based measure of how far the player has progressed, used to
// scale both pour leniency and stage rewards below. Campaign uses the
// stage being played; every other mode (endless, training, cotd,
// challenge) reflects overall map progress since those don't have their
// own difficulty ramp.
function progressLevel() {
  return state.mode === "campaign" ? state.stage + 1 : (getMap().cleared + 1);
}

// Be more forgiving about pour accuracy the deeper a player gets — harder drinks
// with more ingredients shouldn't punish small measurement slips as harshly.
function measureLeniency() {
  const n = progressLevel();
  return 1 + Math.min(0.8, Math.max(0, n - 6) * 0.045);
}

// Reward scaling — the same quality of drink pays out more the further the
// player has progressed, so later (harder) stages feel proportionally more
// valuable. Starts at 1x on stage 1, ramps up to 4x by the time the full
// bar (every mechanic) is unlocked, then holds steady.
function levelMultiplier() {
  const n = progressLevel();
  return 1 + Math.min(3, (n - 1) * 0.06);
}

function currentRecipe() {
  if (state.mode === "training" && state.trainingRecipe) return state.trainingRecipe;
  if (state.mode === "cotd" && state.cotdRecipe) return state.cotdRecipe;
  if (state.mode === "challenge" && state.challenge) return state.challenge;
  if (state.mode === "endless" && state.endlessRecipe) return state.endlessRecipe;
  return drinkPool()[state.stage];
}

// ============================ Customers ============================
function pickCustomer() {
  const exclude = state.recentCustomerIds || [];
  const c = generateCustomer({ excludeIds: exclude });
  state.customer = c;
  const next = [...exclude, c.id];
  state.recentCustomerIds = next.slice(-2);
  return c;
}

function renderCustomer(_drinkName) {
  // Guest lives on the bar only — ticket shows the order text, not a second chip.
  renderBarGuest();
}

function renderBarGuest(opts = {}) {
  const el = $("#bar-guest");
  const img = $("#bar-guest-img");
  if (!el || !img) return;
  const c = state.customer;
  el.classList.remove("is-leaving", "is-entering");
  if (!c || !c.portrait) {
    el.hidden = true;
    img.removeAttribute("src");
    img.alt = "";
    return;
  }
  img.src = resolveAssetUrl(c.portrait);
  img.alt = c.name || "";
  el.hidden = false;
  if (opts.entering) {
    void el.offsetWidth;
    el.classList.add("is-entering");
    setTimeout(() => el.classList.remove("is-entering"), 480);
  }
}

function clearCustomer() {
  state.customer = null;
  renderBarGuest();
}

/** Mid-venue: keep the bar, guest leaves with drink, next guest steps in. */
function advanceGuestInVenue(nextIndex) {
  const guest = $("#bar-guest");
  showScreen("screen-game");
  if (guest && !guest.hidden) {
    guest.classList.remove("is-entering");
    void guest.offsetWidth;
    guest.classList.add("is-leaving");
  }
  setTimeout(() => {
    loadStage(nextIndex);
    renderBarGuest({ entering: true });
  }, 420);
}

// ============================ Training (guided tutorial) ============================
function loadTraining() {
  state.mode = "training";
  state.difficulty = "advanced"; // full flow, so they learn every step
  state.challenge = null;
  state.trainingRecipe = isUnderage()
    ? (MOCKTAILS.find((r) => r.id === "virgin_mojito") || MOCKTAILS[0])
    : (RECIPES.find((r) => r.id === "daiquiri") || RECIPES[0]);
  state.build = emptyBuild();
  state.mixed = false;
  state.complexity = null;
  state.menuIds = null;
  if (!GLASS_ENABLED) state.build.glass = state.trainingRecipe.glass;
  if (!TOOLS_ENABLED) state.build.method = state.trainingRecipe.method;
  if (!GARNISH_ENABLED) state.build.garnish = state.trainingRecipe.garnish[0];
  state.steps = getSteps("advanced");
  state.stepIndex = 0;
  state.totalScore = 0;
  state.starsEarned = 0;
  displayedScore = 0;

  $(".progress-wrap").style.display = "none";
  $("#endless-hud").style.display = "none";
  clearCustomer();

  const r = state.trainingRecipe;
  setGameVenue("Training drink");
  applyVenueChrome(venueOf(r));
  $("#stage-pill").textContent = "📚 Training";
  $("#diff-pill").textContent = "Tutorial";
  $("#order-name").textContent = r.name;
  $("#order-desc").textContent = r.order;
  setTicketOrigin(r);
  renderTicketRecipe(r);
  setTicketFlippable(true);
  setTicketFlipped(false);

  renderStation();
  enterStep();
  showScreen("screen-game");
  trackDrinkStarted({ recipe: r.name });
}

function renderCoach() {
  const el = $("#coach");
  if (!el) return;
  if (state.mode !== "training") { el.style.display = "none"; el.innerHTML = ""; return; }
  el.style.display = "";
  el.innerHTML = coachHTML();
}

function coachHTML() {
  const r = currentRecipe();
  const step = state.steps[state.stepIndex];
  const n = state.stepIndex + 1;
  const total = state.steps.length;
  let title = "";
  let body = "";
  if (step === "glass") {
    const gname = GLASS_BY_ID[r.glass].name;
    title = "👋 Welcome to bartending school!";
    body = `We'll make a <strong>${r.name}</strong> together. Every cocktail has its own glass — a ${r.name} is served in a <strong>${gname}</strong>. Tap the glowing ${gname}, then hit <strong>Next →</strong>.`;
  } else if (step === "method") {
    const mname = METHOD_BY_ID[r.method].name;
    title = "🧰 Set up your tools";
    body = `Before pouring, pick how you'll prepare. A ${r.name} is <strong>${mname.toLowerCase()}ed</strong> — tap glowing <strong>${mname}</strong> so the tools land on the counter, then hit <strong>Next →</strong>.`;
  } else if (step === "ingredients") {
    const names = r.ingredients.map((i) => `<strong>${INGREDIENT_BY_ID[i.id].name}</strong>`).join(", ");
    const list = r.ingredients
      .map((i) => `<strong>${i.amount} ${INGREDIENT_BY_ID[i.id].unit} ${INGREDIENT_BY_ID[i.id].name}</strong>`)
      .join(", ");
    const into = ["shake", "stir", "blend"].includes(r.method) ? "into the prep tool" : "into the glass";
    title = "🫗 Now build the drink";
    body = isGuessMode()
      ? `Tap each glowing ingredient that belongs in a ${r.name}: ${names}. No measuring — just pick the right ones. When you hit Next, we'll ${METHOD_BY_ID[r.method].name.toLowerCase()} it.`
      : `Pour ${into}. Tap each glowing ingredient, then use <strong>− / +</strong> to set amounts: ${list}. When you hit Next, we'll ${METHOD_BY_ID[r.method].name.toLowerCase()} it.`;
  } else if (step === "garnish") {
    const gid = r.garnish[0];
    const gname = GARNISH_BY_ID[gid].name;
    title = "🍋 The finishing touch";
    body = gid === "none"
      ? `This drink needs <strong>no garnish</strong> — tap <strong>None</strong>, then press <strong>Serve Drink</strong>.`
      : `Finish with a <strong>${gname}</strong>. Tap it, then press <strong>Serve Drink</strong> to see your stars!`;
  }
  return (
    `<div class="coach-head"><span class="coach-avatar">🧑‍🏫</span><span class="coach-step">Lesson ${n} of ${total}</span></div>` +
    `<p class="coach-title">${title}</p>` +
    `<p class="coach-body">${body}</p>`
  );
}

// Glow the correct choice(s) for the current training step.
function applyTrainingHints() {
  if (state.mode !== "training") return;
  const r = currentRecipe();
  const step = state.steps[state.stepIndex];
  if (step === "glass") highlightChips(GLASS_BY_ID[r.glass].name);
  else if (step === "method") highlightChips(METHOD_BY_ID[r.method].name);
  else if (step === "garnish") highlightChips(GARNISH_BY_ID[r.garnish[0]].name);
  else if (step === "ingredients") {
    const need = new Set(r.ingredients.map((i) => INGREDIENT_BY_ID[i.id].name));
    document.querySelectorAll("#ingredient-catalog .cat-item").forEach((b) => {
      const name = b.dataset.ingName || "";
      const used = b.classList.contains("is-selected") || b.classList.contains("is-in-glass");
      b.classList.toggle("train-hint", need.has(name) && !used);
    });
  }
}

function highlightChips(name) {
  document.querySelectorAll("#panel-body .chip").forEach((c) => {
    const span = c.querySelector("span:not(.emoji)");
    const txt = (span ? span.textContent : c.textContent).trim();
    c.classList.toggle("train-hint", txt.startsWith(name));
  });
}

// Journey stages (and the tutorial) score on recipe accuracy only; every other
// recipe lane still gets the judges' palate verdict.
function usesJudgePanel() {
  return state.mode !== "training" && state.mode !== "campaign";
}

function scoreBuild() {
  const recipe = currentRecipe();
  const feedback = [];
  let points = 0;
  let maxPoints = 0;

  // At early stages (and in "Guess"/"Pour" tiers) the app pre-selects the
  // glass/method/garnish so the player can focus on the mechanic being
  // taught. There's no point grading — or crediting — a choice the player
  // never actually made, so those only count toward the score once the
  // player is the one choosing them (cx === null means every step is
  // manual, e.g. training/challenge/full-bar tier).
  const cx = state.complexity;
  // Held-off steps are auto-set — don't grade choices the player never made.
  const glassChosen = GLASS_ENABLED && (!cx || cx.chooseGlass);
  const methodChosen = TOOLS_ENABLED && (!cx || cx.chooseMethod);
  const garnishChosen = GARNISH_ENABLED && (!cx || cx.chooseGarnish);

  // Glass
  if (glassChosen) {
    maxPoints += 1;
    if (state.build.glass === recipe.glass) {
      points += 1;
      feedback.push(fb("ok", "Glass", `${GLASS_BY_ID[recipe.glass].name} — correct.`));
    } else {
      const chosen = state.build.glass ? GLASS_BY_ID[state.build.glass].name : "none";
      feedback.push(fb("bad", "Glass", `You used ${chosen}; should be ${GLASS_BY_ID[recipe.glass].name}.`));
    }
  } else {
    feedback.push(fb("auto", "Glass", GLASS_BY_ID[recipe.glass].name));
  }

  // Method
  if (methodChosen) {
    maxPoints += 1;
    if (state.build.method === recipe.method) {
      points += 1;
      feedback.push(fb("ok", "Method", `${METHOD_BY_ID[recipe.method].name} — correct.`));
    } else {
      const chosen = state.build.method ? METHOD_BY_ID[state.build.method].name : "none";
      feedback.push(fb("bad", "Method", `You chose ${chosen}; should be ${METHOD_BY_ID[recipe.method].name}.`));
    }
  } else {
    feedback.push(fb("auto", "Method", METHOD_BY_ID[recipe.method].name));
  }

  // Ingredients
  const builtMap = new Map(state.build.ingredients.map((i) => [i.id, i.amount]));
  const targetIds = new Set(recipe.ingredients.map((i) => i.id));

  const guessMode = isGuessMode();

  recipe.ingredients.forEach((target) => {
    const ing = INGREDIENT_BY_ID[target.id];
    maxPoints += 2;
    if (!builtMap.has(target.id)) {
      const tMiss = dispAmount(ing.unit, target.amount);
      feedback.push(fb("bad", ing.name, guessMode ? "Missing from the recipe." : `Missing — needs ${tMiss.val} ${tMiss.label}.`));
      return;
    }
    // Guess mode: score on getting the ingredient right, not the amount.
    if (guessMode) {
      points += 2;
      feedback.push(fb("ok", ing.name, "Correct ingredient."));
      return;
    }
    const have = builtMap.get(target.id);
    const diff = Math.abs(have - target.amount);
    const leni = measureLeniency();
    const allow = ing.unit === "ml" ? tolerance(ing.unit, target.amount) * leni : 1;
    const perfect = ing.unit === "ml" ? Math.max(2.5, target.amount * 0.07) * leni : 0;
    const h = dispAmount(ing.unit, have);
    const t = dispAmount(ing.unit, target.amount);
    if (diff <= perfect) {
      points += 2;
      feedback.push(fb("ok", ing.name, `${h.val} ${h.label} — spot on (target ${t.val}).`));
    } else if (diff <= allow) {
      points += 1;
      feedback.push(fb("near", ing.name, `${h.val} ${h.label} — close (target ${t.val}).`));
    } else {
      // Right ingredient, amount off — point it out gently (not a hard miss).
      const over = have > target.amount;
      feedback.push(fb("near", ing.name, `${h.val} ${h.label} — a bit ${over ? "much" : "light"} (aim for ${t.val}).`));
    }
  });

  // Extra ingredients
  state.build.ingredients.forEach((entry) => {
    if (!targetIds.has(entry.id)) {
      points -= 1;
      feedback.push(fb("bad", INGREDIENT_BY_ID[entry.id].name, "Not in this recipe — extra ingredient."));
    }
  });

  // Garnish
  if (garnishChosen) {
    maxPoints += 1;
    if (recipe.garnish.includes(state.build.garnish)) {
      points += 1;
      feedback.push(fb("ok", "Garnish", `${GARNISH_BY_ID[state.build.garnish].name} — nice touch.`));
    } else {
      const ideal = GARNISH_BY_ID[recipe.garnish[0]].name;
      const chosen = state.build.garnish ? GARNISH_BY_ID[state.build.garnish].name : "none";
      feedback.push(fb("near", "Garnish", `You chose ${chosen}; ${ideal} suits it better.`));
    }
  } else {
    const gid = recipe.garnish[0];
    const gname = gid === "none" ? "None" : GARNISH_BY_ID[gid].name;
    feedback.push(fb("auto", "Garnish", gname));
  }

  points = Math.max(0, points);
  const pct = Math.round((points / maxPoints) * 100);
  let stars = pct >= 90 ? 3 : pct >= 70 ? 2 : pct >= 45 ? 1 : 0;
  // Grading itself (stars/pct) doesn't change — only the payout scales, so
  // the same quality drink is worth more the further you've progressed.
  const levelMult = levelMultiplier();
  const stagePoints = Math.round(points * 10 * levelMult);
  const result = { pct, stars, stagePoints, levelMultiplier: levelMult, feedback };

  // The journey grades on recipe accuracy alone, so a stage verdict lands the
  // moment the drink is served. The judging panel stays with the free-pour
  // lanes, where there's no target recipe to measure against.
  if (usesJudgePanel()) {
    const evalResult = evaluate(state.build, { strictness: STRICTNESS });
    const panel = scoreWithJudges(evalResult, pickJudges(3));
    result.judgePanel = panel;
    result.judgeEval = evalResult;
    const blendable = !isGuessMode();
    if (blendable) {
      const blended = Math.round(pct * 0.75 + panel.total * 0.25);
      result.blended = blended;
      result.stars = blended >= 90 ? 3 : blended >= 70 ? 2 : blended >= 45 ? 1 : 0;
      result.judgeScoring = { mode: "blended", accuracy: pct, judges: panel.total, final: blended };
    } else {
      result.judgeScoring = { mode: "flavor-only", accuracy: pct, judges: panel.total };
    }
  }
  return result;
}

function fb(kind, label, text) {
  return { kind, label, text };
}

// ============================ Result / finish ============================
let lastResult = null;

function serve() {
  if (state.mode === "mixologist") { serveMix(); return; }
  if (state.mode === "endless") { serveEndless(); return; }
  if (state.mode === "training") {
    lastResult = scoreBuild();
    if (lastResult.stars === 0) Sound.fail();
    else Sound.coin();
    showResult(lastResult);
    return;
  }
  if (state.mode === "cotd") {
    lastResult = scoreBuild();
    lastResult.tip = lastResult.stars > 0 ? 20 : 0; // daily bonus
    recordResult(lastResult);
    markCotdDone();
    if (lastResult.stars === 0) Sound.fail();
    else Sound.coin();
    showResult(lastResult);
    return;
  }
  lastResult = scoreBuild();
  state.totalScore += lastResult.stagePoints;
  state.starsEarned += lastResult.stars;
  recordResult(lastResult);
  // Only the journey writes map progress — challenge runs share this path but
  // aren't stages, so they must not touch a stage's record.
  if (state.mode === "campaign") recordStageResult(state.stage, lastResult.stars, lastResult.pct);
  if (lastResult.stars === 0) Sound.fail();
  showResult(lastResult);
}

// Customer reaction line based on how good the drink was.
const REACTIONS = {
  good: ["Perfect — you're an artist!", "Wow, exactly right.", "Best {drink} I've had in ages!", "Flawless. Keep the change!"],
  ok: ["Not bad at all.", "That'll do nicely, thanks.", "Pretty good, cheers!", "Yeah, I'd order that again."],
  bad: ["Hmm… this isn't quite right.", "That's not what I ordered…", "I'll, uh, drink it I guess.", "Did you read the order?"],
};
function reactionFor(stars, drinkName) {
  const pool = stars === 3 ? REACTIONS.good : stars >= 1 ? REACTIONS.ok : REACTIONS.bad;
  return pool[Math.floor(Math.random() * pool.length)].replace("{drink}", drinkName);
}

// ============================ Mixologist mode ============================
function cloneBuild(b) {
  return { glass: b.glass, method: b.method, garnish: b.garnish, ingredients: b.ingredients.map((i) => ({ id: i.id, amount: i.amount })) };
}

function startMixologist() {
  state.mode = "mixologist";
  state.difficulty = "mixologist";
  state.challenge = null;
  state.build = emptyBuild();
  state.mixed = false;
  state.complexity = null;
  state.menuIds = null;
  state.steps = getSteps("mixologist");
  state.stepIndex = 0;
  state.editingIngredientId = null;
  $(".progress-wrap").style.display = "none";
  clearCustomer();
  setGameVenue("Mixologist");
  applyVenueChrome(null);
  $("#stage-pill").textContent = "Mixologist";
  $("#diff-pill").textContent = "Sandbox";
  $("#order-name").textContent = "Invent a Cocktail";
  $("#order-desc").textContent = "Free pour — choose a glass, add anything you like, pick a method & garnish, then Serve to get it judged.";
  setTicketOrigin(null);
  renderTicketRecipe(null);
  setTicketFlippable(false);
  setTicketFlipped(false);
  renderStation();
  enterStep();
  showScreen("screen-game");
  trackDrinkStarted();
}

let lastMix = null;
function serveMix() {
  const result = evaluate(state.build, { strictness: STRICTNESS });
  const panel = scoreWithJudges(result, pickJudges(3));
  result.judges = panel;
  lastMix = { result, build: cloneBuild(state.build), panel };
  if (panel.total >= 70) Sound.coin();
  else if (panel.total >= 45) Sound.click();
  else Sound.fail();
  showMixResult(result);
}

function judgeSceneNote(scoring) {
  const of = `3 of ${JUDGES.length} house judges`;
  if (!scoring) return `Random panel: ${of}.`;
  if (scoring.mode === "mixologist") {
    return `Random panel: ${of}. Final panel average: ${scoring.final}.`;
  }
  if (scoring.mode === "flavor-only") {
    return `Random panel: ${of}. Flavor reactions only here; stars still come from build accuracy. Judges avg ${scoring.judges}.`;
  }
  return `Random panel: ${of}. Final score blends 75% accuracy with 25% judges' taste. Accuracy ${scoring.accuracy}, judges avg ${scoring.judges}, final ${scoring.final}.`;
}

// Timers from the result screen's reveal choreography (judges talking →
// scores → final verdict), kept here so a fast retry can cancel a reveal
// still in flight instead of letting it fire on top of a fresh one.
let resultRevealTimers = [];
function clearResultRevealTimers() {
  resultRevealTimers.forEach(clearTimeout);
  resultRevealTimers = [];
}

const JUDGE_SEAT_STAGGER = 1400;
const JUDGE_SCORE_PAUSE = 2400;
const JUDGE_VERDICT_PAUSE = 2400;

// `opts.animated`: seats fade in one at a time ("talking"), each judge's
// score stays hidden behind a "···" until every seat has spoken, then all
// three scores pop in together. `opts.onDone` fires once scores are
// revealed, so callers (showResult) can bring in the final verdict last.
function renderJudgesInteractive(judges, panelSel = "#judges-panel", opts = {}) {
  const el = $(panelSel);
  if (!el) return;
  const animated = !!opts.animated;
  const mixUx = panelSel === "#judges-panel" && !mixResultLegacyPreferred();
  const compact = mixUx ? false : (opts.compact != null ? !!opts.compact : isPhonePlay());
  const note = mixUx || compact ? "" : judgeSceneNote(opts.scoring);
  el.innerHTML = `
    ${note ? `<div class="judge-scene-note">${escapeHtml(note)}</div>` : ""}
    <div class="judge-scene${compact ? " is-compact" : ""}${mixUx ? " is-mix-ux" : ""}">
      <div class="judge-table" aria-hidden="true"></div>
      ${judges.map((j) => `
      <article class="judge-seat judge-seat-${escapeHtml(j.id)}${animated ? "" : " is-in"}" data-judge-id="${escapeHtml(j.id)}">
        <div class="judge-bubble">
          <div class="judge-bubble-top">
            <span class="judge-bubble-name">${escapeHtml(j.name)}</span>
            <span class="judge-score"><span class="judge-score-num">${animated ? "···" : j.score100}</span><small>/100</small></span>
          </div>
          <div class="judge-bubble-quote">“${escapeHtml(j.comment)}”</div>
          ${mixUx || compact ? "" : `<div class="judge-bubble-reason">${escapeHtml(j.reason)}</div>`}
          ${compact && !mixUx ? "" : `<div class="judge-bubble-tip"><strong>Tip:</strong> ${escapeHtml(j.tip)}</div>`}
          ${!mixUx && !compact && j.likes ? `<div class="judge-bubble-prefs"><span class="pref-like">Loves:</span> ${escapeHtml(j.likes)}</div>` : ""}
          ${!mixUx && !compact && j.dislikes ? `<div class="judge-bubble-prefs pref-avoid"><span class="pref-hate">Avoids:</span> ${escapeHtml(j.dislikes)}</div>` : ""}
        </div>
        <div class="judge-avatar-wrap">
          <div class="judge-portrait">
            <img src="${resolveAssetUrl(`assets/judges/${j.id}.png`)}" alt="${escapeHtml(j.name)}" loading="lazy">
          </div>
          ${mixUx ? `<span class="judge-score-coin">${animated ? "···" : j.score100}</span>` : ""}
          <span class="judge-avatar-name">${escapeHtml(j.name)}</span>
          ${compact || mixUx ? "" : `<span class="judge-avatar-title">${escapeHtml(j.title || j.blurb)}</span>`}
          ${!compact && !mixUx && j.breed ? `<span class="judge-avatar-breed">${escapeHtml(j.breed)}</span>` : ""}
          ${!compact && !mixUx && j.character ? `<span class="judge-avatar-character">${escapeHtml(j.character)}</span>` : ""}
        </div>
      </article>`).join("")}
    </div>`;

  if (mixUx) {
    el.querySelectorAll(".judge-seat").forEach((seat) => {
      seat.tabIndex = 0;
      seat.setAttribute("role", "button");
      seat.setAttribute("aria-expanded", "false");
      const toggle = () => {
        const open = seat.classList.contains("is-open");
        el.querySelectorAll(".judge-seat").forEach((s) => {
          s.classList.remove("is-open");
          s.setAttribute("aria-expanded", "false");
        });
        if (!open) {
          seat.classList.add("is-open");
          seat.setAttribute("aria-expanded", "true");
        }
      };
      seat.addEventListener("click", toggle);
      seat.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          toggle();
        }
      });
    });
  }

  if (!animated) return;

  const seats = [...el.querySelectorAll(".judge-seat")];
  seats.forEach((seat, i) => {
    resultRevealTimers.push(setTimeout(() => {
      seat.classList.add("is-in");
      Sound.select();
    }, 500 + i * JUDGE_SEAT_STAGGER));
  });

  const scoresAt = 500 + Math.max(0, seats.length - 1) * JUDGE_SEAT_STAGGER + JUDGE_SCORE_PAUSE;
  resultRevealTimers.push(setTimeout(() => {
    seats.forEach((seat, i) => {
      const numEl = seat.querySelector(".judge-score-num");
      if (!numEl) return;
      numEl.textContent = judges[i].score100;
      numEl.classList.add("pop");
    });
    Sound.click();
    if (typeof opts.onDone === "function") {
      resultRevealTimers.push(setTimeout(opts.onDone, JUDGE_VERDICT_PAUSE));
    }
  }, scoresAt));
}

function renderFlavorBars(p) {
  const defs = [
    ["Strong", p.strong, "#e9b949"],
    ["Sweet", p.sweet, "#ff9ec4"],
    ["Sour", p.sour, "#b9d96a"],
    ["Bitter", p.bitter, "#a98be0"],
    ["Fizz", p.fizz, "#7fd4e8"],
  ];
  $("#flavor-bars").innerHTML = defs
    .map(([label, v, c]) => `
      <div class="fbar-row">
        <span class="fbar-label">${label}</span>
        <div class="fbar-track"><div class="fbar-fill" style="width:${Math.round(v * 100)}%;background:${c}"></div></div>
      </div>`)
    .join("");
}

function showMixResult(result) {
  const panel = result.judges || scoreWithJudges(result, pickJudges(3));
  drinkOpen = false;
  drinksServedSession += 1;
  track("mixologist_result", {
    score: panel.total,
    verdict: panel.verdict,
    classic: result.classic ? result.classic.name : null,
    duration_ms: drinkStartedAt ? Date.now() - drinkStartedAt : 0,
  });
  $("#mix-name").textContent = "Your Creation";
  $("#mix-score").textContent = panel.total;
  $("#mix-verdict").textContent = panel.verdict;
  $("#mix-stars").innerHTML = [0, 1, 2, 3, 4].map((i) => `<span class="${i < panel.stars ? "on" : ""}">★</span>`).join("");
  const legacy = mixResultLegacyPreferred();
  $("#mix-judges-title").textContent = legacy
    ? `⚖️ Tonight's panel: ${panel.verdict} (3 of ${JUDGES.length} judges, avg ${panel.total})`
    : `Panel  3 of ${JUDGES.length}  ·  avg ${panel.total}`;
  renderJudgesInteractive(panel.judges, "#judges-panel", {
    scoring: { mode: "mixologist", judges: panel.total, final: panel.total },
  });

  const cl = $("#mix-classic");
  if (result.classic) {
    cl.textContent = result.classic.exact
      ? `Spot on — you made a ${result.classic.name}. Too close to share to Community.`
      : `Close to a ${result.classic.name}. Community is for originals — sharing is locked.`;
  } else {
    cl.textContent = "An original creation.";
  }

  $("#mix-note").textContent = result.note;
  const vol = useImperial() ? `${(result.volume / ML_PER_OZ).toFixed(1)} oz` : `${result.volume} ml`;
  $("#mix-meta").innerHTML = `<span>${result.abv}% ABV</span><span>${vol}</span><span>${result.family}</span>`;
  renderFlavorBars(result.profile);

  const tipsEl = $("#mix-tips");
  tipsEl.innerHTML = "";
  result.tips.forEach((t) => {
    const li = document.createElement("li");
    li.textContent = t;
    tipsEl.appendChild(li);
  });

  $("#btn-mix-save").textContent = "Save to My Bar";
  $("#btn-mix-save").disabled = false;
  applyMixShareLock(result.classic);
  showScreen("screen-mix-result");
}

// ============================ My Bar (saved inventions) ============================
const MYBAR_KEY = "dagtails_mybar";
function getMyBar() {
  try { return JSON.parse(localStorage.getItem(MYBAR_KEY) || "[]"); } catch (e) { return []; }
}
function setMyBar(list) {
  try { localStorage.setItem(MYBAR_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
}
function saveInvention(name) {
  if (!lastMix) return;
  const list = getMyBar();
  const score = lastMix.panel ? lastMix.panel.total : lastMix.result.score;
  const verdict = lastMix.panel ? lastMix.panel.verdict : lastMix.result.verdict;
  list.unshift({
    name,
    build: lastMix.build,
    score,
    verdict,
    family: lastMix.result.family,
    classic: lastMix.result.classic || null,
    ts: Date.now(),
  });
  setMyBar(list);
  checkBadges();
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
function renderMyBar() {
  const list = getMyBar();
  const el = $("#mybar-list");
  $("#mybar-sub").textContent = list.length
    ? `${list.length} saved invention${list.length > 1 ? "s" : ""} — recreate one to test your memory.`
    : "";
  if (!list.length) {
    el.innerHTML = `<p class="mybar-empty">No inventions yet. Open <strong>Mixologist</strong> mode, build a drink, and save it here.</p>`;
    return;
  }
  el.innerHTML = "";
  list.forEach((inv, idx) => {
    const ings = inv.build.ingredients.map((i) => INGREDIENT_BY_ID[i.id]?.name).filter(Boolean).join(", ");
    const card = document.createElement("div");
    card.className = "mybar-item";
    const classic = inv.classic || detectClassic(inv.build);
    const shareBlocked = classicBlocksCommunityShare(classic);
    card.innerHTML = `
      <div class="mybar-item-main">
        <div class="mybar-item-top"><span class="mybar-name">${escapeHtml(inv.name)}</span><span class="mybar-badge">${inv.score}/100</span></div>
        <div class="mybar-meta">${escapeHtml(inv.family)} · ${escapeHtml(inv.verdict)}</div>
        <div class="mybar-ings">${escapeHtml(ings)}</div>
      </div>
      <div class="mybar-item-actions">
        <button class="btn btn-primary btn-sm" data-act="play">Recreate</button>
        ${Backend.isConfigured() && !shareBlocked ? '<button class="btn btn-ghost btn-sm" data-act="share">🌐 Share</button>' : ""}
        ${shareBlocked ? `<span class="mybar-share-lock" title="${escapeHtml(classicShareBlockMessage(classic))}">Too close to share</span>` : ""}
        <button class="btn btn-ghost btn-sm" data-act="del">Delete</button>
      </div>`;
    card.querySelector('[data-act="play"]').addEventListener("click", () => playInvention(inv));
    const shareEl = card.querySelector('[data-act="share"]');
    if (shareEl) shareEl.addEventListener("click", () => {
      shareCreationToCommunity({
        name: inv.name,
        recipe: inv.build,
        score: inv.score,
        verdict: inv.verdict,
        family: inv.family,
        classic,
      }, shareEl);
    });
    card.querySelector('[data-act="del"]').addEventListener("click", () => {
      const l = getMyBar();
      l.splice(idx, 1);
      setMyBar(l);
      renderMyBar();
      Sound.click();
    });
    el.appendChild(card);
  });
}

function loadChallenge(recipe) {
  state.mode = "challenge";
  state.challenge = recipe;
  state.difficulty = "advanced";
  state.build = emptyBuild();
  state.mixed = false;
  state.complexity = null;
  state.menuIds = null;
  if (!GLASS_ENABLED) state.build.glass = recipe.glass;
  if (!TOOLS_ENABLED) state.build.method = recipe.method;
  if (!GARNISH_ENABLED) state.build.garnish = Array.isArray(recipe.garnish) ? recipe.garnish[0] : recipe.garnish;
  state.steps = getSteps("advanced");
  state.stepIndex = 0;
  $(".progress-wrap").style.display = "none";
  clearCustomer();
  setGameVenue("Challenge");
  applyVenueChrome(null);
  $("#stage-pill").textContent = "Challenge";
  $("#diff-pill").textContent = "Recreate";
  $("#order-name").textContent = recipe.name;
  $("#order-desc").textContent = "Recreate this invention from memory — match the glass & ingredients.";
  setTicketOrigin(null);
  renderTicketRecipe(recipe);
  setTicketFlippable(true);
  setTicketFlipped(false);
  renderStation();
  enterStep();
  showScreen("screen-game");
  trackDrinkStarted({ recipe: recipe.name });
}

function playInvention(inv) {
  const recipe = {
    name: inv.name,
    glass: inv.build.glass,
    method: inv.build.method,
    ingredients: inv.build.ingredients.map((i) => ({ id: i.id, amount: i.amount })),
    garnish: inv.build.garnish && inv.build.garnish !== "none" ? [inv.build.garnish] : ["none"],
  };
  state.totalScore = 0;
  state.starsEarned = 0;
  displayedScore = 0;
  loadChallenge(recipe);
}

function showResult(result) {
  const recipe = currentRecipe();
  trackDrinkServed(result);
  if (state.mode === "training") {
    track("training_complete", {
      recipe_id: recipe && recipe.id,
      stars: result.stars,
      duration_ms: drinkStartedAt ? Date.now() - drinkStartedAt : 0,
    });
  }

  clearResultRevealTimers();

  // Nothing that gives away the outcome shows yet — just the drink name and
  // a neutral "still tasting" header. The verdict (stars, score, checklist)
  // stays hidden until the judges have talked and scored.
  $("#result-eyebrow").textContent = result.judgePanel ? "The judges are tasting…" : "Tasting…";
  $("#result-name").textContent = recipe.name;

  const starsEl = $("#result-stars");
  starsEl.innerHTML = [0, 1, 2].map(() => `<span>★</span>`).join("");

  const verdict = $("#result-verdict");
  verdict.classList.add("is-pending");
  const actions = $("#result-actions");
  actions.classList.add("is-pending");

  // Judges' reaction panel (every served cocktail except the tutorial).
  const jWrap = $("#result-judges-wrap");
  const phone = isPhonePlay();
  document.body.classList.toggle("is-phone-play", phone);
  if (result.judgePanel) {
    const p = result.judgePanel;
    const label = phone
      ? `⚖️ Judges · ${p.verdict} · avg ${p.total}`
      : result.blended != null
        ? `⚖️ Tonight's panel: ${p.verdict} (3 of ${JUDGES.length} judges, avg ${p.total})`
        : `⚖️ Tonight's panel: flavour check (3 of ${JUDGES.length} judges, avg ${p.total})`;
    $("#result-judges-title").textContent = label;
    jWrap.style.display = "";
    renderJudgesInteractive(p.judges, "#result-judges", {
      scoring: result.judgeScoring,
      animated: true,
      compact: phone,
      onDone: () => revealResultVerdict(result, recipe),
    });
  } else {
    jWrap.style.display = "none";
    // Journey and tutorial results have no panel to wait on — land the verdict
    // right away, just off this frame so the reveal transition still plays.
    resultRevealTimers.push(setTimeout(() => revealResultVerdict(result, recipe), 120));
  }

  showScreen("screen-result");
}

// The "at last" beat: stars, score, bartender checklist, customer reaction,
// and the retry/next controls all land together once the judges are done.
function revealResultVerdict(result, recipe) {
  $("#result-eyebrow").textContent = result.stars >= 1 ? "Stage cleared" : "Needs work";

  const starsEl = $("#result-stars");
  const spans = [...starsEl.children];
  for (let i = 0; i < result.stars; i++) {
    resultRevealTimers.push(setTimeout(() => {
      spans[i].classList.add("on", "pop");
      Sound.starDing(i);
    }, 350 + i * 450));
  }

  $("#result-pct").textContent = result.blended != null ? result.blended : result.pct;
  const pts = result.stagePoints + (result.tip || 0);
  $("#result-points").textContent = pts;
  const bonusEl = $("#result-bonus");
  if (bonusEl) {
    if (result.levelMultiplier && result.levelMultiplier > 1.04) {
      bonusEl.textContent = ` (×${result.levelMultiplier.toFixed(1)} level bonus)`;
      bonusEl.style.display = "";
    } else {
      bonusEl.style.display = "none";
    }
  }

  // Guest portrait as score backdrop; quote sits in the foreground
  const guestBg = $("#result-guest-bg");
  const guestImg = $("#result-guest-img");
  const custEl = $("#result-customer");
  if (state.customer && state.mode !== "challenge") {
    const c = state.customer;
    if (guestBg && guestImg && c.portrait) {
      guestImg.src = resolveAssetUrl(c.portrait);
      guestBg.hidden = false;
      guestBg.setAttribute("aria-hidden", "false");
    } else if (guestBg) {
      guestBg.hidden = true;
      guestBg.setAttribute("aria-hidden", "true");
      if (guestImg) guestImg.removeAttribute("src");
    }
    const tip = result.tip ? ` <span class="result-tip">💵 +${result.tip} tip</span>` : "";
    custEl.innerHTML = `<span class="result-cust-text"><strong>${c.name}</strong>: "${reactionFor(result.stars, recipe.name)}"${tip}</span>`;
    custEl.style.display = "";
  } else {
    if (guestBg) {
      guestBg.hidden = true;
      guestBg.setAttribute("aria-hidden", "true");
    }
    if (guestImg) guestImg.removeAttribute("src");
    custEl.style.display = "none";
  }

  const list = $("#feedback-list");
  list.innerHTML = "";
  result.feedback.forEach((f) => {
    const icon = f.kind === "ok" ? "✓" : f.kind === "near" ? "≈" : f.kind === "auto" ? "•" : "✗";
    const li = document.createElement("li");
    li.innerHTML = `<span class="fb-icon fb-${f.kind}">${icon}</span><span class="fb-text"><strong>${f.label}:</strong> <span>${f.text}</span></span>`;
    list.appendChild(li);
  });

  const retryBtn = $("#btn-retry");
  const nextBtn = $("#btn-next-stage");
  const mapBtn = $("#btn-result-map");
  mapBtn.style.display = "none";
  nextBtn.style.display = "";
  if (state.mode === "training") {
    retryBtn.style.display = "";
    retryBtn.textContent = "Try again";
    $("#result-eyebrow").textContent = result.stars >= 2 ? "🎓 You've got it!" : "Lesson complete";
    nextBtn.textContent = "Start the journey →";
  } else if (state.mode === "endless") {
    retryBtn.style.display = "none";
    retryBtn.textContent = "Retry stage";
    $("#result-eyebrow").textContent = state.lives > 0 ? "Order up" : "Out of lives";
    nextBtn.textContent = state.lives > 0 ? "Next customer →" : "End shift →";
  } else if (state.mode === "challenge") {
    retryBtn.style.display = "";
    retryBtn.textContent = "Retry stage";
    nextBtn.textContent = "Back to My Bar";
  } else if (state.mode === "cotd") {
    retryBtn.style.display = "";
    retryBtn.textContent = "Try again";
    $("#result-eyebrow").textContent = result.stars >= 1 ? "🍹 Cocktail of the Day" : "Needs work";
    nextBtn.textContent = "Back to menu";
  } else {
    // Campaign — must earn at least 1 star to advance to the next node.
    retryBtn.style.display = "";
    retryBtn.textContent = "Retry stage";
    mapBtn.style.display = "";
    const isLast = state.stage === drinkPool().length - 1;
    const at = venueForStage(state.stage);
    const lastInVenue = state.stage === at.end;
    if (result.stars < 1) {
      $("#result-eyebrow").textContent = "So close — try again";
      nextBtn.style.display = "none";
    } else if (isLast) {
      nextBtn.textContent = "See results →";
    } else if (lastInVenue) {
      nextBtn.textContent = "Fly to the next bar →";
    } else {
      nextBtn.textContent = "Next guest →";
    }
  }

  $("#result-verdict").classList.remove("is-pending");
  $("#result-actions").classList.remove("is-pending");
}

function showFinish() {
  $("#finish-score").textContent = state.totalScore;
  const prevBest = getHighScore();
  const bestEl = $("#finish-best");
  if (state.totalScore > prevBest) {
    setHighScore(state.totalScore);
    bestEl.textContent = `🎉 New high score! (was ${prevBest} pts)`;
    bestEl.classList.add("is-new");
    Sound.coin();
  } else {
    bestEl.textContent = `🏅 Best score: ${prevBest} pts`;
    bestEl.classList.remove("is-new");
  }
  renderStartBest();

  const maxStars = drinkPool().length * 3;
  const avg = state.starsEarned / maxStars;
  $("#finish-stars").innerHTML = [0, 1, 2].map((i) => `<span class="${i < Math.round(avg * 3) ? "on" : ""}">★</span>`).join("");
  let rank;
  if (avg >= 0.9) rank = "🏆 Master Mixologist";
  else if (avg >= 0.7) rank = "🍸 Head Bartender";
  else if (avg >= 0.5) rank = "🥃 Bartender";
  else if (avg >= 0.3) rank = "🍋 Barback";
  else rank = "🧽 Still in training";
  $("#finish-rank").textContent = `${rank} · ${state.starsEarned}/${maxStars} stars`;
  showScreen("screen-finish");
}

// ============================ Event wiring ============================
function hubPlayJourney() {
  Sound.init();
  Sound.click();
  track("hub_cta", { cta: "journey" });
  maybePlayIntro(() => {
    recordPlayDay();
    renderMap({ step: "hero" });
    showScreen("screen-map");
  });
}

function hubOpenMixologist() {
  Sound.init();
  track("hub_cta", { cta: "mix", unlocked: mapUnlocked() });
  if (!mapUnlocked()) { Sound.fail(); showToast(`🔒 Clear ${STAGES_TO_UNLOCK} stages to unlock Mixologist`); return; }
  Sound.coin();
  track("mixologist_started", { cleared: getMap().cleared || 0 });
  startMixologist();
}

function hubOpenEndless() {
  Sound.init();
  track("hub_cta", { cta: "endless", unlocked: mapUnlocked() });
  if (!mapUnlocked()) { Sound.fail(); showToast(`🔒 Clear ${STAGES_TO_UNLOCK} stages to unlock Endless Shift`); return; }
  Sound.coin();
  track("endless_started", { cleared: getMap().cleared || 0 });
  recordPlayDay();
  state.totalScore = 0;
  state.starsEarned = 0;
  state.lives = 3;
  state.streak = 0;
  state.bestStreak = 0;
  state.served = 0;
  state.lastEndlessIdx = -1;
  displayedScore = 0;
  loadEndless();
}

function hubOpenTraining() {
  Sound.init();
  Sound.click();
  track("hub_cta", { cta: "training" });
  track("training_started");
  loadTraining();
}

function hubOpenCotd() {
  Sound.init();
  Sound.coin();
  track("hub_cta", { cta: "cotd" });
  loadCotd();
}

function hubOpenBadges() {
  Sound.init();
  Sound.click();
  track("hub_cta", { cta: "badges" });
  renderBadges();
  showScreen("screen-badges");
}

function registerHubActions() {
  window.DagTailsHub?.setActions({
    playJourney: hubPlayJourney,
    openEndless: hubOpenEndless,
    openMixologist: hubOpenMixologist,
    openCotd: hubOpenCotd,
    openTraining: hubOpenTraining,
    openHelp: () => { track("hub_cta", { cta: "help" }); $("#modal-how").classList.add("is-open"); },
    openBadges: hubOpenBadges,
    openSettings: () => { Sound.init(); Sound.click(); track("hub_cta", { cta: "settings" }); openSettings(); },
    editProfile: () => { Sound.click(); track("hub_cta", { cta: "profile" }); openProfileForm(); },
  });
  refreshHub();
}

registerHubActions();

$("#btn-map-back").addEventListener("click", () => {
  Sound.click();
  if (mapStep === "path") {
    renderMap({ step: "hero", openVenueId: selectedVenueId });
    return;
  }
  showScreen("screen-start");
});
$("#btn-map-play")?.addEventListener("click", () => {
  playMapCta();
});
$("#map-prev")?.addEventListener("click", () => shiftFocusedVenue(-1));
$("#map-next")?.addEventListener("click", () => shiftFocusedVenue(1));
(function wireMapSwipe() {
  const hero = $("#map-hero");
  if (!hero) return;
  let x0 = null;
  hero.addEventListener("pointerdown", (e) => { x0 = e.clientX; });
  hero.addEventListener("pointerup", (e) => {
    if (x0 == null || mapStep !== "hero") return;
    const dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) < 48) return;
    shiftFocusedVenue(dx < 0 ? 1 : -1);
  });
})();
document.addEventListener("keydown", (e) => {
  if (!$("#screen-map")?.classList.contains("is-active")) return;
  if (mapStep !== "hero") return;
  if (e.key === "ArrowLeft") { e.preventDefault(); shiftFocusedVenue(-1); }
  if (e.key === "ArrowRight") { e.preventDefault(); shiftFocusedVenue(1); }
});
$("#btn-result-map").addEventListener("click", () => {
  Sound.click();
  const stop = venueForStage(state.stage);
  renderMap({ step: "path", openVenueId: stop.venue.id, stageIndex: state.stage });
  showScreen("screen-map");
});
$("#btn-result-shop").addEventListener("click", () => {
  Sound.click();
  const recipe = currentRecipe();
  if (recipe) openShop(recipe);
});
$("#btn-rankup-ok").addEventListener("click", () => { Sound.click(); $("#rankup").classList.remove("is-open"); });

$("#btn-sound").addEventListener("click", () => {
  Sound.init();
  const on = Sound.toggle();
  const s = getSettings(); s.sound = on; setSettings(s);
  $("#btn-sound").textContent = on ? "🔊" : "🔇";
  if (on) Sound.click();
});

$("#btn-ambient").addEventListener("click", () => {
  Sound.init();
  const on = Sound.toggleAmbient();
  $("#btn-ambient").classList.toggle("is-active", on);
  if (on) Sound.click();
});

$("#btn-next").addEventListener("click", goNext);
$("#btn-back").addEventListener("click", goBack);

$("#btn-retry").addEventListener("click", () => {
  if (state.mode === "training") {
    lastResult = null;
    loadTraining();
    return;
  }
  if (state.mode === "cotd") {
    lastResult = null;
    loadCotd();
    return;
  }
  if (lastResult) {
    state.totalScore -= lastResult.stagePoints;
    state.starsEarned -= lastResult.stars;
    lastResult = null;
  }
  if (state.mode === "challenge" && state.challenge) {
    loadChallenge(state.challenge);
    return;
  }
  loadStage(state.stage);
});

$("#btn-next-stage").addEventListener("click", () => {
  lastResult = null;
  if (state.mode === "training") {
    // Graduate into the journey map.
    Sound.click();
    renderMap({ step: "hero" });
    showScreen("screen-map");
    return;
  }
  if (state.mode === "cotd") {
    showScreen("screen-start");
    return;
  }
  if (state.mode === "challenge") {
    renderMyBar();
    showScreen("screen-mybar");
    return;
  }
  if (state.mode === "endless") {
    if (state.lives > 0) loadEndless(true);
    else showEndlessFinish();
    return;
  }
  // Campaign: mid-venue swaps the guest on the bar; finishing a venue
  // zooms the world map and flies the duck to the next city.
  if (state.stage >= drinkPool().length - 1) {
    showFinish();
    return;
  }
  const at = venueForStage(state.stage);
  if (state.stage < at.end) {
    Sound.click();
    advanceGuestInVenue(state.stage + 1);
    return;
  }
  Sound.click();
  renderMap({ step: "hero" });
  showScreen("screen-map");
});

// Mixologist result actions
$("#btn-mix-tweak").addEventListener("click", () => {
  const idx = state.steps.indexOf("ingredients");
  state.stepIndex = idx >= 0 ? idx : 0;
  enterStep();
  showScreen("screen-game");
});
$("#btn-mix-another").addEventListener("click", () => {
  Sound.click();
  startMixologist();
});
$("#btn-mix-shop").addEventListener("click", () => {
  Sound.click();
  const build = lastMix?.build;
  if (build?.glass && build?.method) {
    openShop({ name: "Your Creation", glass: build.glass, method: build.method });
  } else {
    showToast("Pick a glass and method first, then serve your drink.");
  }
});
$("#btn-mix-quit").addEventListener("click", () => {
  renderStartBest();
  showScreen("screen-start");
});
$("#btn-mix-save").addEventListener("click", () => {
  $("#invent-name").value = "";
  $("#modal-name").classList.add("is-open");
  setTimeout(() => $("#invent-name").focus(), 50);
});

// Training / COTD / Badges — wired through DagTailsHub (React hub).

$("#btn-badges-back").addEventListener("click", () => showScreen("screen-start"));

// My Bar
$("#btn-mybar").addEventListener("click", () => {
  Sound.init();
  Sound.click();
  rememberSecondaryReturn();
  renderMyBar();
  showScreen("screen-mybar");
});
$("#btn-mybar-back").addEventListener("click", () => backFromSecondary());

// Name modal
$("#btn-name-cancel").addEventListener("click", () => $("#modal-name").classList.remove("is-open"));
$("#btn-name-save").addEventListener("click", () => {
  const name = ($("#invent-name").value || "").trim() || "Untitled";
  saveInvention(name);
  $("#modal-name").classList.remove("is-open");
  $("#mix-name").textContent = name;
  $("#btn-mix-save").textContent = "Saved ✓";
  $("#btn-mix-save").disabled = true;
  Sound.coin();
});
$("#modal-name").addEventListener("click", (e) => {
  if (e.target.id === "modal-name") $("#modal-name").classList.remove("is-open");
});
$("#invent-name").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("#btn-name-save").click();
});

$("#btn-replay").addEventListener("click", () => {
  Sound.click();
  renderMap({ step: "hero" });
  showScreen("screen-map");
});
$("#btn-finish-menu")?.addEventListener("click", () => {
  Sound.click();
  renderStartBest();
  showScreen("screen-start");
});

$("#order-ticket")?.addEventListener("click", () => {
  const ticket = $("#order-ticket");
  if (!ticket || ticket.classList.contains("is-no-flip")) return;
  Sound.click();
  setTicketFlipped(!ticket.classList.contains("is-flipped"));
});
$("#order-ticket")?.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const ticket = $("#order-ticket");
  if (!ticket || ticket.classList.contains("is-no-flip")) return;
  e.preventDefault();
  ticket.click();
});

$("#btn-quit").addEventListener("click", () => {
  Sound.click();
  drinkAbandoned("quit");
  if (state.mode === "campaign") {
    const stop = venueForStage(state.stage);
    renderMap({ step: "path", openVenueId: stop.venue.id, stageIndex: state.stage });
    showScreen("screen-map");
  } else {
    renderStartBest();
    showScreen("screen-start");
  }
});

// ============================ Recipe Book ============================
function diffPips(tier) {
  return `<span class="rb-diff rb-diff-${tier}">${"●".repeat(tier)}${"○".repeat(5 - tier)} ${TIER_LABEL[tier]}</span>`;
}
function rbCard(r) {
  const g = GLASS_BY_ID[r.glass];
  const m = METHOD_BY_ID[r.method];
  const garnish = GARNISH_BY_ID[r.garnish[0]];
  const ings = r.ingredients
    .map((i) => {
      const ing = INGREDIENT_BY_ID[i.id];
      return `<li><span class="rb-amt">${i.amount} ${ing.unit}</span> ${ing.name}</li>`;
    })
    .join("");
  const card = document.createElement("div");
  card.className = "rb-item";
  card.innerHTML = `
    <div class="rb-top">
      <span class="rb-name">${r.name}</span>
      <span class="rb-tags">${g.emoji} ${g.name} · ${m.emoji} ${m.name}</span>
    </div>
    ${diffPips(r.diff)}
    <p class="rb-order">${r.order}</p>
    <ul class="rb-ings">${ings}</ul>
    <div class="rb-garnish">Garnish: ${garnish.emoji ? garnish.emoji + " " : ""}${garnish.name}</div>
    <button class="btn btn-ghost btn-sm rb-shop-btn">🛍 Shop the gear</button>`;
  card.querySelector(".rb-shop-btn").addEventListener("click", () => {
    Sound.click();
    openShop(r);
  });
  return card;
}
function renderRecipeBook() {
  const el = $("#recipes-list");
  el.innerHTML = "";
  const sub = $("#recipes-sub");
  const pool = drinkPool();
  if (sub) sub.textContent = isUnderage()
    ? `${pool.length} mocktails — easy to hard. Glass, method, build & garnish.`
    : `${pool.length} drinks across cocktails & shots — easy to hard.`;

  const sections = isUnderage()
    ? [["Mocktails", pool]]
    : [["Cocktails", pool.filter((r) => r.kind === "cocktail")], ["Shots", pool.filter((r) => r.kind === "shot")]];

  sections.forEach(([title, list]) => {
    if (!list.length) return;
    const head = document.createElement("p");
    head.className = "rb-section";
    head.textContent = `${title} (${list.length})`;
    el.appendChild(head);
    list.forEach((r) => el.appendChild(rbCard(r)));
  });
}

$("#btn-recipes").addEventListener("click", () => {
  Sound.init();
  Sound.click();
  rememberSecondaryReturn();
  renderRecipeBook();
  showScreen("screen-recipes");
});
$("#btn-recipes-back").addEventListener("click", () => backFromSecondary());

// ============================ Shop (demo store) ============================
// Fake storefront: links each drink to the glassware and tools that make it —
// never the liquid ingredients. No real payment happens; it's here to try the
// shopping flow before wiring up a real retailer.
let shopScopeRecipe = null;
let shopKindFilter = "all";
const shopCart = {};

function allShopItems() {
  return [
    ...GLASSES.map((g) => ({ ...g, kind: "glass" })),
    ...TOOLS.map((t) => ({ ...t, kind: "tool" })),
  ];
}
function shopItemsForRecipe(recipe) {
  const glass = { ...GLASS_BY_ID[recipe.glass], kind: "glass" };
  const tools = TOOLS.filter((t) => t.methods.includes(recipe.method)).map((t) => ({ ...t, kind: "tool" }));
  return [glass, ...tools];
}
function shopKey(item) {
  return `${item.kind}:${item.id}`;
}
function shopCardHtml(item) {
  const key = shopKey(item);
  const inCart = !!shopCart[key];
  const icon = item.icon
    ? `<img class="shop-item-icon-img" src="${resolveAssetUrl(item.icon)}" alt="" draggable="false">`
    : `<div class="shop-item-icon">${item.emoji}</div>`;
  return `
    <div class="shop-item">
      ${icon}
      <div class="shop-item-body">
        <div class="shop-item-top">
          <span class="shop-item-name">${escapeHtml(item.name)}</span>
          <span class="shop-item-price">$${item.price.toFixed(2)}</span>
        </div>
        <p class="shop-item-blurb">${escapeHtml(item.blurb)}</p>
        <span class="shop-item-kind">${item.kind === "glass" ? "Glassware" : "Tool"}</span>
      </div>
      <button class="btn btn-sm ${inCart ? "btn-ghost is-added" : "btn-primary"} shop-add-btn" data-shop-key="${key}">${inCart ? "✓ In cart" : "Add to cart"}</button>
    </div>`;
}
function renderShopCart() {
  const items = Object.values(shopCart);
  const count = items.length;
  const total = items.reduce((sum, it) => sum + it.price, 0);
  $("#shop-cart-count").textContent = `🛒 ${count} item${count === 1 ? "" : "s"}`;
  $("#shop-cart-total").textContent = `$${total.toFixed(2)}`;
  $("#btn-shop-checkout").disabled = count === 0;
}
function renderShopScreen() {
  const ctxWrap = $("#shop-context");
  if (shopScopeRecipe) {
    $("#shop-context-label").textContent = `Shopping for: ${shopScopeRecipe.name}`;
    ctxWrap.style.display = "";
  } else {
    ctxWrap.style.display = "none";
  }
  document.querySelectorAll("#shop-tabs .seg-tab").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.shopKind === shopKindFilter);
  });

  let items = shopScopeRecipe ? shopItemsForRecipe(shopScopeRecipe) : allShopItems();
  if (shopKindFilter !== "all") items = items.filter((i) => i.kind === shopKindFilter);

  const grid = $("#shop-grid");
  grid.innerHTML = items.length
    ? items.map(shopCardHtml).join("")
    : `<p class="shop-empty">No gear matches this filter.</p>`;
  grid.querySelectorAll(".shop-add-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.shopKey;
      if (shopCart[key]) {
        delete shopCart[key];
        Sound.click();
      } else {
        const item = items.find((i) => shopKey(i) === key);
        shopCart[key] = item;
        Sound.click();
      }
      renderShopScreen();
    });
  });
  renderShopCart();
}
function openShop(recipe) {
  rememberSecondaryReturn();
  shopScopeRecipe = recipe || null;
  shopKindFilter = "all";
  renderShopScreen();
  const from = lastScreenId;
  showScreen("screen-shop");
  track("shop_open", { recipe: recipe ? recipe.name : null, recipe_id: recipe ? recipe.id : null, source_screen: from });
}

/** Where secondary screens (shop / recipes / lounge) should return. */
let secondaryReturn = "screen-start";
function rememberSecondaryReturn() {
  const cur = document.querySelector(".screen.is-active");
  if (cur && cur.id && cur.id !== "screen-shop" && cur.id !== "screen-recipes"
    && cur.id !== "screen-mybar" && cur.id !== "screen-community" && cur.id !== "screen-leaderboard") {
    secondaryReturn = cur.id;
  }
}
function backFromSecondary() {
  const dest = secondaryReturn || "screen-start";
  showScreen(dest);
  if (dest === "screen-start") onShowStart();
}

$("#btn-shop").addEventListener("click", () => {
  Sound.init();
  Sound.click();
  openShop(null);
});
$("#btn-shop-back").addEventListener("click", () => backFromSecondary());
$("#shop-context-clear").addEventListener("click", () => {
  shopScopeRecipe = null;
  renderShopScreen();
});
document.querySelectorAll("#shop-tabs .seg-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    shopKindFilter = tab.dataset.shopKind;
    Sound.click();
    renderShopScreen();
  });
});
$("#btn-shop-checkout").addEventListener("click", () => {
  const items = Object.values(shopCart);
  if (!items.length) return;
  const total = items.reduce((sum, it) => sum + it.price, 0);
  Sound.coin();
  track("shop_checkout", { items: items.length, total: Math.round(total * 100) / 100, item_ids: items.map((it) => it.id).filter(Boolean) });
  showToast(`🎉 Demo order placed — ${items.length} item${items.length === 1 ? "" : "s"} for $${total.toFixed(2)}. No real purchase was made.`);
  Object.keys(shopCart).forEach((k) => delete shopCart[k]);
  renderShopScreen();
});

// ============================ Endless finish actions ============================
$("#btn-endless-again").addEventListener("click", () => {
  state.totalScore = 0;
  state.starsEarned = 0;
  state.lives = 3;
  state.streak = 0;
  state.bestStreak = 0;
  state.served = 0;
  state.lastEndlessIdx = -1;
  displayedScore = 0;
  Sound.coin();
  loadEndless();
});
$("#btn-endless-menu").addEventListener("click", () => {
  renderStartBest();
  showScreen("screen-start");
});

// ============================ Profile / identification modal ============================
function openProfileForm(blank = false) {
  const p = blank ? null : getProfile();
  $("#pf-name").value = p?.name || "";
  $("#pf-age").value = p?.age || "";
  $("#pf-location").value = p?.location || "";
  $("#pf-email").value = p?.email || "";
  setSegActive("pf-units", p?.units || "metric");
  $("#pf-error").textContent = "";
  // First-time setup can't be dismissed; editing an existing profile can be.
  const closeBtn = $("#btn-profile-close");
  if (closeBtn) closeBtn.style.display = getProfile() ? "" : "none";
  $("#modal-profile").classList.add("is-open");
  setTimeout(() => $("#pf-name").focus(), 50);
  track("profile_modal_open", { mode: getProfile() ? "edit" : "create" });
}
function closeProfileModal() {
  if (!getProfile()) return; // required for first-time visitors
  $("#modal-profile").classList.remove("is-open");
}

// Segmented control helpers (used by the units pickers).
function setSegActive(id, value) {
  const grp = document.getElementById(id);
  if (!grp) return;
  grp.querySelectorAll(".seg-tab").forEach((t) => t.classList.toggle("is-active", t.dataset.units === value));
}
function segValue(id) {
  const el = document.querySelector(`#${id} .seg-tab.is-active`);
  return el ? el.dataset.units : "metric";
}
function wireSeg(id, onPick) {
  const grp = document.getElementById(id);
  if (!grp) return;
  grp.querySelectorAll(".seg-tab").forEach((t) => {
    t.addEventListener("click", () => {
      grp.querySelectorAll(".seg-tab").forEach((x) => x.classList.remove("is-active"));
      t.classList.add("is-active");
      if (onPick) onPick(t.dataset.units);
    });
  });
}
wireSeg("pf-units");

$("#profile-form").addEventListener("submit", (e) => {
  e.preventDefault();
  Sound.init();
  const name = ($("#pf-name").value || "").trim();
  const age = parseInt($("#pf-age").value, 10);
  const location = ($("#pf-location").value || "").trim();
  const email = ($("#pf-email").value || "").trim();
  const err = $("#pf-error");
  if (!name) { err.textContent = "Please enter your name."; $("#pf-name").focus(); return; }
  if (!Number.isFinite(age) || age < 1 || age > 120) { err.textContent = "Please enter a valid age (1–120)."; $("#pf-age").focus(); return; }
  const existing = getProfile();
  const profile = {
    id: existing?.id || (email || genId()),
    name, age, location, email,
    units: segValue("pf-units"),
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
  const isNewProfile = !existing;
  setProfile(profile);
  onShowStart();
  $("#modal-profile").classList.remove("is-open");
  Sound.coin();
  track(isNewProfile ? "profile_created" : "profile_updated", { units: profile.units, underage: isUnderage() });
  // First-timers meet Old Tom before they reach the bar; returning editors skip it.
  maybePlayIntro(() => { onShowStart(); showScreen("screen-start"); });
});

$("#btn-profile-close").addEventListener("click", () => { Sound.click(); closeProfileModal(); });
$("#modal-profile").addEventListener("click", (e) => {
  if (e.target.id === "modal-profile") closeProfileModal();
});

// Edit profile — wired through DagTailsHub (React hub).

// ============================ Intro comic reel ============================
// A short cinematic where Old Tom, a veteran duck bartender, takes a young
// protégé under his wing. Plays once after sign-up (before the first level)
// and can be replayed from Settings.
const INTRO_COMIC = [
  { img: "assets/comic/comic1.png", kind: "narration", text: "Every great bartender starts behind someone else's bar." },
  { img: "assets/comic/comic2.png", kind: "say", who: "Old Tom", text: "Come in out of the rain, kid. DAG Tails doesn't bite\u2026 much." },
  { img: "assets/comic/comic3.png", kind: "say", who: "Old Tom", text: "First lesson: respect the glass, the pour, the guest. Every drop has its place." },
  { img: "assets/comic/comic4.png", kind: "say", who: "Old Tom", text: "Shake it when it's bright. Stir it when it's strong. Feel the drink." },
  { img: "assets/comic/comic5.png", kind: "narration", text: "The first pour is always shaky. That's how the hands learn." },
  { img: "assets/comic/comic6.png", kind: "say", who: "Old Tom", text: "The bar's yours tonight. Make every pour count." },
];

let comicIndex = 0;
let comicOnDone = null;
const comicWarmed = new Set();

function preloadComicAround(i) {
  const idxs = [i, i + 1].filter((n) => n >= 0 && n < INTRO_COMIC.length);
  idxs.forEach((n) => {
    const src = resolveAssetUrl(INTRO_COMIC[n].img);
    if (comicWarmed.has(src)) return;
    comicWarmed.add(src);
    const im = new Image();
    im.src = src;
  });
}

function renderComicPanel(i) {
  const p = INTRO_COMIC[i];
  if (!p) return;
  preloadComicAround(i);
  const img = $("#comic-img");
  const cap = $("#comic-caption");
  img.src = resolveAssetUrl(p.img);
  img.alt = p.kind === "say" ? `${p.who}: ${p.text}` : p.text;
  cap.innerHTML = p.kind === "say"
    ? `<p class="comic-say"><span class="comic-who">${p.who}</span>\u201c${p.text}\u201d</p>`
    : `<p class="comic-narration">${p.text}</p>`;

  // Replay the entry animation.
  const panel = $("#comic-panel");
  panel.classList.remove("comic-anim");
  void panel.offsetWidth;
  panel.classList.add("comic-anim");

  // Dots.
  const dots = $("#comic-dots");
  dots.innerHTML = "";
  INTRO_COMIC.forEach((_, k) => {
    const d = document.createElement("span");
    d.className = "comic-dot" + (k === i ? " is-active" : k < i ? " is-done" : "");
    dots.appendChild(d);
  });

  const last = i === INTRO_COMIC.length - 1;
  const next = $("#comic-next");
  next.setAttribute("aria-label", last ? "Start my shift" : "Next");
}

function playIntro(onDone, source = "first_run") {
  comicOnDone = onDone || null;
  comicIndex = 0;
  introSource = source;
  preloadComicAround(0);
  renderComicPanel(0);
  showScreen("screen-intro");
  track("intro_start", { source });
}

// Plays the intro only the first time; otherwise runs the callback immediately.
function maybePlayIntro(onDone) {
  if (introSeen()) { if (onDone) onDone(); return; }
  playIntro(onDone);
}

function comicNext() {
  Sound.click();
  if (comicIndex >= INTRO_COMIC.length - 1) { finishIntro(); return; }
  comicIndex += 1;
  renderComicPanel(comicIndex);
}

function finishIntro(skipped = false) {
  if (skipped) track("intro_skip", { panel_index: comicIndex, source: introSource });
  else track("intro_complete", { panels: INTRO_COMIC.length, source: introSource });
  markIntroSeen();
  const done = comicOnDone;
  comicOnDone = null;
  if (done) done();
  else { onShowStart(); showScreen("screen-start"); }
}

$("#comic-next").addEventListener("click", (e) => { e.stopPropagation(); comicNext(); });
$("#comic-panel").addEventListener("click", (e) => {
  if (e.target.closest("button")) return;
  comicNext();
});
$("#comic-skip").addEventListener("click", (e) => { e.stopPropagation(); Sound.click(); finishIntro(true); });

// ============================ Settings ============================
function syncSoundButtons() {
  const sb = $("#btn-sound");
  if (sb) sb.textContent = Sound.enabled ? "🔊" : "🔇";
}

function openSettings() {
  const p = getProfile();
  setSegActive("set-units", useImperial() ? "imperial" : "metric");
  const snd = $("#set-sound");
  snd.textContent = Sound.enabled ? "On" : "Off";
  snd.setAttribute("aria-pressed", Sound.enabled ? "true" : "false");
  const amb = $("#set-ambient");
  amb.textContent = Sound.ambientEnabled ? "On" : "Off";
  amb.setAttribute("aria-pressed", Sound.ambientEnabled ? "true" : "false");
  $("#set-account-who").textContent = p ? `Signed in as ${p.name}${p.age ? " · " + p.age : ""}` : "";
  showScreen("screen-settings");
}

// Clear the current identity (and any backend session) and return to the gate.
function logoutToGate() {
  try {
    localStorage.removeItem(PROFILE_KEY);
    Object.keys(localStorage).filter((k) => k.startsWith("sb-")).forEach((k) => localStorage.removeItem(k));
  } catch (e) { /* ignore */ }
  onShowStart();
  showScreen("screen-start");
  openProfileForm(true);
}

$("#btn-settings-back").addEventListener("click", () => { Sound.click(); onShowStart(); showScreen("screen-start"); });

wireSeg("set-units", (units) => {
  const p = getProfile();
  if (p) { p.units = units; p.updatedAt = Date.now(); setProfile(p); }
  Sound.click();
});

$("#set-sound").addEventListener("click", () => {
  Sound.init();
  const on = Sound.toggle();
  const s = getSettings(); s.sound = on; setSettings(s);
  $("#set-sound").textContent = on ? "On" : "Off";
  $("#set-sound").setAttribute("aria-pressed", on ? "true" : "false");
  syncSoundButtons();
  if (on) Sound.click();
});

$("#set-ambient").addEventListener("click", () => {
  Sound.init();
  const on = Sound.toggleAmbient();
  $("#set-ambient").textContent = on ? "On" : "Off";
  $("#set-ambient").setAttribute("aria-pressed", on ? "true" : "false");
  $("#btn-ambient").classList.toggle("is-active", on);
  if (on) Sound.click();
});

$("#set-replay-intro").addEventListener("click", () => { Sound.click(); playIntro(() => openSettings(), "settings"); });
$("#set-edit").addEventListener("click", () => { Sound.click(); openProfileForm(); });
$("#set-switch").addEventListener("click", () => { Sound.click(); logoutToGate(); });
$("#set-logout").addEventListener("click", () => {
  if (window.confirm("Log out? You'll return to the sign-in screen. Your progress stays on this device.")) {
    logoutToGate();
  }
});

// ============================ Debug / testing toolbar ============================
// Wipe all saved identity + progress (and any backend session) and reload so the
// game boots completely fresh at the profile gate.
function resetEverything() {
  try {
    // Remove this game's keys plus any Supabase auth session tokens.
    Object.keys(localStorage)
      .filter((k) => k.startsWith("dagtails_") || k.startsWith("lastcall_") || k.startsWith("sb-"))
      .forEach((k) => localStorage.removeItem(k));
  } catch (e) { /* ignore */ }
  try { sessionStorage.clear(); } catch (e) { /* ignore */ }
  location.reload();
}

// Only expose debug tools on localhost or when ?debug is in the URL — never to
// real players on the live site.
function debugEnabled() {
  const h = location.hostname;
  const isLocal = h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "";
  const hasFlag = /[?&]debug\b/.test(location.search) || location.hash.includes("debug");
  return isLocal || hasFlag;
}

// Render the on-device diagnostics panel: connection status, per-event
// counts, and the most recent raw events (newest first).
function renderDiagnostics() {
  const log = getAnalyticsLog();
  const status = $("#diag-status");
  if (status) {
    const p = getProfile();
    status.innerHTML = [
      `<span class="diag-chip">Device ${escapeHtml(getDeviceId().slice(0, 10))}</span>`,
      `<span class="diag-chip">Session ${escapeHtml((sessionId || "").slice(0, 10))}</span>`,
      `<span class="diag-chip ${p ? "is-on" : "is-off"}">${p ? "Profile set" : "No profile"}</span>`,
      (() => {
        const h = Backend.getLastHealth();
        if (!Backend.isConfigured()) {
          return `<span class="diag-chip is-off">Backend offline</span>`;
        }
        if (!h) {
          return `<span class="diag-chip">Backend checking…</span>`;
        }
        if (h.ok) {
          const label = Backend.isReady() ? "connected" : "up";
          return `<span class="diag-chip is-on">Backend ${label} (${h.latencyMs}ms)</span>`;
        }
        return `<span class="diag-chip is-off">Backend down (${escapeHtml(h.error || "error")})</span>`;
      })(),
      `<span class="diag-chip">${log.length} event${log.length === 1 ? "" : "s"} logged</span>`,
    ].join("");
  }
  const summaryEl = $("#diag-summary");
  if (summaryEl) {
    const counts = {};
    log.forEach((e) => { counts[e.name] = (counts[e.name] || 0) + 1; });
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    summaryEl.innerHTML = entries.length
      ? entries.map(([name, n]) => `<span class="diag-summary-item"><b>${n}</b> ${escapeHtml(name)}</span>`).join("")
      : "";
  }
  const logEl = $("#diag-log");
  if (logEl) {
    if (!log.length) {
      logEl.innerHTML = `<div class="diag-empty">No events logged yet on this device.</div>`;
    } else {
      logEl.innerHTML = log.slice().reverse().slice(0, 100).map((e) => {
        const time = new Date(e.t).toLocaleTimeString();
        const props = Object.keys(e.props || {}).length ? JSON.stringify(e.props) : "";
        return `<div class="diag-row"><span class="diag-row-time">${time}</span><span class="diag-row-name">${escapeHtml(e.name)}</span><span class="diag-row-props">${escapeHtml(props)}</span></div>`;
      }).join("");
    }
  }
}

(function initDebugToolbar() {
  const bar = $("#debug-toolbar");
  const toggle = $("#dbg-toggle");
  const reset = $("#dbg-reset");
  const diagBtn = $("#dbg-diagnostics");
  const mixLayoutBtn = $("#dbg-mix-layout");
  if (!bar || !toggle || !reset) return;
  if (!debugEnabled()) { bar.remove(); return; }
  bar.style.display = "";
  applyMixResultLayout();
  toggle.addEventListener("click", () => bar.classList.toggle("is-open"));
  if (mixLayoutBtn) {
    mixLayoutBtn.addEventListener("click", () => {
      const next = mixResultLegacyPreferred() ? "ux" : "legacy";
      try { localStorage.setItem(MIX_LAYOUT_KEY, next); } catch (e) { /* ignore */ }
      applyMixResultLayout();
      if ($("#screen-mix-result")?.classList.contains("is-active") && lastMix) {
        showMixResult(lastMix.result);
      }
      showToast(next === "legacy" ? "Mix result: previous stacked card" : "Mix result: two-column UX");
    });
  }
  reset.addEventListener("click", () => {
    const ok = window.confirm(
      "Reset everything?\n\nThis wipes your profile/identity and all progress (map, stars, streaks, badges, My Bar, high scores) and restarts the game fresh."
    );
    if (ok) resetEverything();
  });
  if (diagBtn) {
    diagBtn.addEventListener("click", () => {
      renderDiagnostics();
      $("#modal-diagnostics").classList.add("is-open");
    });
  }
})();
applyMixResultLayout();
window.addEventListener("resize", () => applyMixResultLayout());
if (debugEnabled()) {
  window.__dagtailsMixology = { detectClassic, classicBlocksCommunityShare, evaluate };
}

$("#btn-diag-close").addEventListener("click", () => $("#modal-diagnostics").classList.remove("is-open"));
$("#modal-diagnostics").addEventListener("click", (e) => {
  if (e.target.id === "modal-diagnostics") $("#modal-diagnostics").classList.remove("is-open");
});
$("#btn-diag-copy").addEventListener("click", async () => {
  const text = JSON.stringify(getAnalyticsLog(), null, 2);
  try {
    await navigator.clipboard.writeText(text);
    showToast("Diagnostics JSON copied to clipboard.");
  } catch (e) {
    showToast("Couldn't copy — clipboard access blocked.");
  }
});
$("#btn-diag-clear").addEventListener("click", () => {
  if (window.confirm("Clear the local diagnostics log? This only clears this device's log, not anything already sent to the backend.")) {
    clearAnalyticsLog();
    renderDiagnostics();
  }
});

// Splash stays until the player taps Enter — no auto-advance / tap-anywhere.
$("#btn-splash-continue")?.addEventListener("click", () => {
  Sound.init();
  Sound.click();
  dismissSplash();
});

// Boot: everyone sees the brand splash first. New players then get the
// credentials modal; returning players continue to the hub.
fitGameStage();
window.addEventListener("resize", fitGameStage);
window.addEventListener("orientationchange", () => setTimeout(fitGameStage, 120));
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", fitGameStage);
}
document.body.classList.add("has-game-stage");
document.body.classList.toggle("is-phone-play", isPhonePlay());
Sound.enabled = getSettings().sound !== false; // restore the saved sound preference
syncSoundButtons();
checkBadges();
renderSplash();
showScreen("screen-splash");
wireAnalyticsLifecycle();
bootAnalytics();

// Debug-only deep link to preview the intro reel directly (localhost or ?debug).
if (debugEnabled() && location.hash.includes("introtest")) {
  playIntro(() => { onShowStart(); showScreen("screen-start"); }, "debug");
  const m = location.hash.match(/introtest(\d+)/);
  if (m) { comicIndex = Math.min(parseInt(m[1], 10), INTRO_COMIC.length - 1); renderComicPanel(comicIndex); }
}

// Validate Supabase on every boot, then connect (when a profile exists).
// Exposes window.__dagtailsHealth for Playwright / remote diagnostics.
(async function bootBackend() {
  const health = await Backend.checkHealth();
  try { window.__dagtailsHealth = health; } catch (e) { /* ignore */ }
  try {
    const log = getAnalyticsLog();
    log.push({ name: "backend_health", props: { ...health }, t: Date.now() });
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(log.slice(-ANALYTICS_MAX)));
  } catch (e) { /* ignore */ }
  if (!health.ok) {
    console.warn("[backend] health check failed:", health.error || health);
  }
  if (getProfile()) {
    const ok = await Backend.initBackend(getProfile());
    if (ok) syncBackendStats();
    // Refresh health.ready after auth so diagnostics stay accurate.
    try {
      const again = Backend.getLastHealth();
      if (again) {
        again.ready = Backend.isReady();
        window.__dagtailsHealth = { ...again };
      }
    } catch (e) { /* ignore */ }
  }
})();

// Community
$("#btn-community").addEventListener("click", () => {
  Sound.init();
  Sound.click();
  rememberSecondaryReturn();
  renderCommunity();
  showScreen("screen-community");
});
$("#btn-community-back").addEventListener("click", () => backFromSecondary());
document.querySelectorAll("#community-tabs .seg-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("#community-tabs .seg-tab").forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    communitySort = tab.dataset.sort;
    Sound.click();
    renderCommunity();
  });
});

// Leaderboard
$("#btn-leaderboard").addEventListener("click", () => {
  Sound.init();
  Sound.click();
  rememberSecondaryReturn();
  renderLeaderboard();
  showScreen("screen-leaderboard");
});
$("#btn-leaderboard-back").addEventListener("click", () => backFromSecondary());
document.querySelectorAll("#leaderboard-tabs .seg-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("#leaderboard-tabs .seg-tab").forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    lbBoard = tab.dataset.board;
    Sound.click();
    renderLeaderboard();
  });
});

// Share an invention from the Mixologist result screen.
$("#btn-mix-share").addEventListener("click", () => {
  if (!lastMix) return;
  const nameEl = $("#mix-name");
  const name = nameEl && nameEl.textContent && nameEl.textContent !== "Your Creation" ? nameEl.textContent : "Untitled Creation";
  shareCreationToCommunity({
    name,
    recipe: lastMix.build,
    score: lastMix.panel ? lastMix.panel.total : lastMix.result.score,
    verdict: lastMix.panel ? lastMix.panel.verdict : lastMix.result.verdict,
    family: lastMix.result.family,
    classic: lastMix.result.classic || null,
  }, $("#btn-mix-share"));
});

$("#btn-close-how").addEventListener("click", () => $("#modal-how").classList.remove("is-open"));
$("#modal-how").addEventListener("click", (e) => {
  if (e.target.id === "modal-how") $("#modal-how").classList.remove("is-open");
});
