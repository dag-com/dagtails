// ============================================================================
// Backend client (Supabase). Powers the online features: Community sharing,
// likes, and global leaderboards. Local play uses anonymous auth. The public
// Pages beta is invite-only (email OTP + beta_testers allowlist).
//
// Everything here degrades gracefully: if config.js still has the placeholder
// values, isConfigured() returns false and the rest of the game keeps working
// offline. The SDK is bundled via Vite (no CDN fetch at runtime).
// ============================================================================
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, BETA_LOCK } from "./config.js";

let sb = null; // Supabase client
let myId = null; // current (anonymous) auth user id
let ready = false; // true once signed in + player row ensured

export function isConfigured() {
  return (
    typeof SUPABASE_URL === "string" &&
    typeof SUPABASE_ANON_KEY === "string" &&
    SUPABASE_URL.startsWith("http") &&
    !SUPABASE_URL.includes("YOUR_") &&
    SUPABASE_ANON_KEY.length > 20 &&
    !SUPABASE_ANON_KEY.includes("YOUR_")
  );
}

export function isReady() { return ready; }
export function currentUserId() { return myId; }

/** Invite-only lock for the public Pages beta. Local play uses `?betaLock=1` to preview. */
export function isBetaLocked() {
  try {
    const host = String(location.hostname || "");
    const q = new URLSearchParams(location.search);
    if (q.get("betaLock") === "1") return true;
    if (/\.github\.io$/i.test(host)) return true;
  } catch {
    /* non-browser */
  }
  return !!BETA_LOCK;
}

/** @type {{ ok: boolean, configured: boolean, ready: boolean, latencyMs: number, error: string | null } | null} */
let lastHealth = null;

/** Last result from checkHealth() (null until the first probe finishes). */
export function getLastHealth() { return lastHealth; }

function restHeaders(extra = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

// Lazily create (or reuse) the Supabase client without requiring a signed-in
// session — used by logEvent() so basic usage stats still flow in even
// before a player has set up a profile.
function getClient() {
  if (!isConfigured()) return null;
  if (!sb) sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return sb;
}

/**
 * Probe that Supabase is reachable and the analytics write path works.
 * Uses PostgREST directly (browser CORS-safe). Never throws.
 */
export async function checkHealth() {
  const started = Date.now();
  if (!isConfigured()) {
    lastHealth = { ok: false, configured: false, ready, latencyMs: 0, error: "not_configured" };
    return lastHealth;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    let readRes;
    try {
      readRes = await fetch(`${SUPABASE_URL}/rest/v1/players?select=id&limit=1`, {
        headers: restHeaders({ Prefer: "count=exact" }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!readRes.ok) {
      lastHealth = {
        ok: false,
        configured: true,
        ready,
        latencyMs: Date.now() - started,
        error: `rest_read_${readRes.status}`,
      };
      return lastHealth;
    }

    const latencyMs = Date.now() - started;
    const writeRes = await fetch(`${SUPABASE_URL}/rest/v1/events`, {
      method: "POST",
      headers: restHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify({
        player_id: myId || null,
        name: "backend_health",
        props: { probe: true, latencyMs, ready },
      }),
    });
    if (!writeRes.ok) {
      const detail = await writeRes.text().catch(() => "");
      lastHealth = {
        ok: false,
        configured: true,
        ready,
        latencyMs,
        error: `events_write_${writeRes.status}${detail ? `:${detail.slice(0, 120)}` : ""}`,
      };
      return lastHealth;
    }

    lastHealth = { ok: true, configured: true, ready, latencyMs, error: null };
    return lastHealth;
  } catch (e) {
    const cause = e && e.cause;
    const detail = cause && (cause.code || cause.message)
      ? ` (${cause.code || cause.message})`
      : "";
    lastHealth = {
      ok: false,
      configured: true,
      ready,
      latencyMs: Date.now() - started,
      error: ((e && e.message) ? e.message : String(e)) + detail,
    };
    return lastHealth;
  }
}

// Sign in anonymously (or reuse the existing session) and make sure this
// player's row exists. Returns true on success.
export async function initBackend(profile) {
  if (!isConfigured()) return false;
  try {
    if (!sb) sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    let { data: { session } } = await sb.auth.getSession();
    if (!session) {
      if (isBetaLocked()) return false;
      const { data, error } = await sb.auth.signInAnonymously();
      if (error) throw error;
      session = data.session;
    }
    if (isBetaLocked()) {
      const email = session.user && session.user.email;
      if (!email) return false;
      const { data: allowed, error: gateErr } = await sb.rpc("beta_access_ok");
      if (gateErr) throw gateErr;
      if (!allowed) {
        await sb.auth.signOut();
        myId = null;
        ready = false;
        return false;
      }
    }
    myId = session.user.id;
    const publicName = profile && String(profile.alias || "").trim()
      ? String(profile.alias).trim()
      : "Anonymous";
    await sb.from("players").upsert(
      { id: myId, name: publicName, location: (profile && profile.location) || null },
      { onConflict: "id" }
    );
    ready = true;
    return true;
  } catch (e) {
    console.warn("[backend] init failed:", e && e.message ? e.message : e);
    ready = false;
    return false;
  }
}

// Push the player's latest stats so the streak leaderboard stays current.
export async function syncStats(stats) {
  if (!ready || !sb || !myId) return;
  try {
    await sb.from("players").update({
      best_streak: stats.bestStreak || 0,
      level: stats.level || 1,
      xp: stats.xp || 0,
      name: stats.name || undefined,
      location: stats.location || undefined,
      updated_at: new Date().toISOString(),
    }).eq("id", myId);
  } catch (e) { /* non-fatal */ }
}

// Share an invention to the community. `c` = { name, recipe, score, verdict, family }.
export async function shareCreation(c) {
  if (!ready || !sb || !myId) throw new Error("not connected");
  const { data, error } = await sb.from("creations").insert({
    player_id: myId,
    name: c.name || "Untitled",
    recipe: c.recipe || {},
    score: c.score || 0,
    verdict: c.verdict || null,
    family: c.family || null,
  }).select("id").single();
  if (error) throw error;
  return data;
}

// List community creations. sort = "top" (most likes) | "new" (newest).
export async function listCommunity(sort = "top") {
  if (!ready || !sb) return [];
  // Disambiguate the embed via the FK name (views also relate creations<->players).
  let q = sb.from("creations").select("id,name,score,verdict,family,recipe,like_count,created_at,players!creations_player_id_fkey(name,location)");
  q = sort === "new" ? q.order("created_at", { ascending: false }) : q.order("like_count", { ascending: false }).order("created_at", { ascending: false });
  const { data, error } = await q.limit(60);
  if (error) throw error;
  return data || [];
}

// The set of creation ids the current player has liked (to render filled hearts).
export async function myLikedIds() {
  if (!ready || !sb || !myId) return new Set();
  const { data, error } = await sb.from("likes").select("creation_id").eq("player_id", myId);
  if (error) return new Set();
  return new Set((data || []).map((r) => r.creation_id));
}

// Toggle a like on a creation. Returns the new liked state (true/false).
export async function toggleLike(creationId, currentlyLiked) {
  if (!ready || !sb || !myId) throw new Error("not connected");
  if (currentlyLiked) {
    const { error } = await sb.from("likes").delete().eq("creation_id", creationId).eq("player_id", myId);
    if (error) throw error;
    return false;
  }
  const { error } = await sb.from("likes").insert({ creation_id: creationId, player_id: myId });
  if (error) throw error;
  return true;
}

export async function leaderboardLikes() {
  if (!ready || !sb) return [];
  const { data, error } = await sb.from("leaderboard_likes").select("*").limit(50);
  if (error) throw error;
  return data || [];
}

export async function leaderboardStreak() {
  if (!ready || !sb) return [];
  const { data, error } = await sb.from("leaderboard_streak").select("*").limit(50);
  if (error) throw error;
  return data || [];
}

// ============================ Diagnostics / analytics ============================
// Fire-and-forget product analytics. Events are queued and flushed in small
// batches so a phone radio is not woken once per tap. Never throws and never
// blocks gameplay — if the backend isn't configured (or the insert fails),
// this is a silent no-op.
const EVENT_FLUSH_MS = 10_000;
const EVENT_FLUSH_N = 10;
const EVENT_QUEUE_MAX = 80;
const eventQueue = [];
let eventFlushTimer = null;
let eventFlushInFlight = false;

export function logEvent(name, props = {}) {
  try {
    if (!isConfigured()) return;
    eventQueue.push({ player_id: myId || null, name, props });
    if (eventQueue.length > EVENT_QUEUE_MAX) eventQueue.splice(0, eventQueue.length - EVENT_QUEUE_MAX);
    if (eventQueue.length >= EVENT_FLUSH_N) flushEvents();
    else if (!eventFlushTimer) eventFlushTimer = setTimeout(() => flushEvents(), EVENT_FLUSH_MS);
  } catch (e) { /* analytics must never break the game */ }
}

/** Flush queued events. Pass `{ keepalive: true }` on hide / pagehide. */
export function flushEvents(opts = {}) {
  try {
    if (eventFlushTimer) {
      clearTimeout(eventFlushTimer);
      eventFlushTimer = null;
    }
    if (!eventQueue.length) return;
    if (eventFlushInFlight && !opts.keepalive) return;
    if (!isConfigured()) {
      eventQueue.length = 0;
      return;
    }
    const batch = eventQueue.splice(0, eventQueue.length).map((row) => ({
      player_id: row.player_id || myId || null,
      name: row.name,
      props: row.props || {},
    }));
    const keepalive = !!opts.keepalive;
    if (keepalive) {
      fetch(`${SUPABASE_URL}/rest/v1/events`, {
        method: "POST",
        headers: restHeaders({ Prefer: "return=minimal" }),
        body: JSON.stringify(batch),
        keepalive: true,
      }).catch(() => { /* ignore */ });
      return;
    }
    const client = getClient();
    if (!client) return;
    eventFlushInFlight = true;
    client.from("events").insert(batch).then(
      () => { eventFlushInFlight = false; if (eventQueue.length) flushEvents(); },
      () => { eventFlushInFlight = false; }
    );
  } catch (e) { /* analytics must never break the game */ }
}

function authRedirectTo() {
  try {
    return `${location.origin}${location.pathname}`;
  } catch {
    return undefined;
  }
}

async function sessionIsInvited(client) {
  const { data: allowed, error } = await client.rpc("beta_access_ok");
  if (error) throw error;
  return !!allowed;
}

/** Restore a persisted email session if it is still on the tester list. */
export async function restoreBetaSession() {
  if (!isConfigured()) return { ok: false, reason: "not_configured" };
  try {
    const client = getClient();
    if (!client) return { ok: false, reason: "not_configured" };
    const { data: { session } } = await client.auth.getSession();
    const email = session && session.user && session.user.email;
    if (!email) return { ok: false, reason: "no_session" };
    if (!(await sessionIsInvited(client))) {
      await client.auth.signOut();
      myId = null;
      ready = false;
      return { ok: false, reason: "not_invited" };
    }
    myId = session.user.id;
    return { ok: true, email };
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    const reason = /beta_access_ok|schema cache|does not exist/i.test(msg)
      ? "gate_missing"
      : "error";
    return { ok: false, reason };
  }
}

/** Send a 6-digit email OTP via Supabase Auth. Does not reveal whether the address is invited. */
export async function requestBetaOtp(email) {
  const client = getClient();
  if (!client) throw new Error("not_configured");
  const trimmed = String(email || "").trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) throw new Error("invalid_email");
  const { error } = await client.auth.signInWithOtp({
    email: trimmed,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: authRedirectTo(),
    },
  });
  if (error) throw error;
  return trimmed;
}

/** Verify the email OTP, then admit only allowlisted testers. */
export async function verifyBetaOtp(email, token) {
  const client = getClient();
  if (!client) throw new Error("not_configured");
  const trimmed = String(email || "").trim().toLowerCase();
  const code = String(token || "").replace(/\s+/g, "");
  if (!trimmed || !code) throw new Error("invalid_code");
  const { data, error } = await client.auth.verifyOtp({
    email: trimmed,
    token: code,
    type: "email",
  });
  if (error) throw error;
  let allowed = false;
  try {
    allowed = await sessionIsInvited(client);
  } catch (e) {
    await client.auth.signOut();
    throw new Error("gate_missing");
  }
  if (!allowed) {
    await client.auth.signOut();
    myId = null;
    ready = false;
    throw new Error("not_invited");
  }
  const user = data && data.user;
  myId = (user && user.id) || (data && data.session && data.session.user && data.session.user.id) || null;
  return (user && user.email) || trimmed;
}

