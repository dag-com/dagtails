/**
 * Shared helpers for DAG Tails Playwright smoke tests.
 * Seeds localStorage so boots skip profile + intro and land on the hub.
 */

const PROFILE = {
  id: "p_test",
  name: "Test Duck",
  age: 28,
  location: "London",
  email: "",
  units: "metric",
};

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ cleared?: number, seenTiers?: Record<string, number>, introSeen?: boolean }} [opts]
 */
async function seedPlayer(page, opts = {}) {
  const cleared = opts.cleared ?? 0;
  // Default: mark Guess tier seen so the rules announce does not block pours.
  const seenTiers = opts.seenTiers ?? { Guess: 1 };
  const introSeen = opts.introSeen !== false;
  await page.addInitScript(
    ({ profile, cleared: c, seenTiers: tiers, introSeen: seen }) => {
      localStorage.setItem("dagtails_migrated", "1");
      if (seen) localStorage.setItem("dagtails_intro_seen", "1");
      else localStorage.removeItem("dagtails_intro_seen");
      localStorage.setItem("dagtails_profile", JSON.stringify(profile));
      localStorage.setItem(
        "dagtails_map",
        JSON.stringify({
          cleared: c,
          records: {},
          recordsMigrated: 1,
          seenTiers: tiers,
        })
      );
      localStorage.setItem("dagtails_settings", JSON.stringify({ sound: false }));
    },
    { profile: PROFILE, cleared, seenTiers, introSeen }
  );
}

/**
 * Boot past splash to the start hub.
 * Splash waits for Enter the bar — no auto-advance.
 * @param {import('@playwright/test').Page} page
 */
async function gotoHub(page) {
  await page.goto("/");
  if (await page.locator("#screen-splash.is-active").isVisible().catch(() => false)) {
    await page.locator("#btn-splash-continue").click({ force: true });
  }
  await page.locator("#screen-start.is-active").waitFor({ state: "visible", timeout: 15_000 });
  // Portrait rotate-lock blocks taps on phone emulation — clear for automated play.
  await clearRotateLock(page);
}

/** Hide #rotate-lock so landscape automation can tap (portrait tests must not call this). */
async function clearRotateLock(page) {
  await page.evaluate(() => {
    const el = document.getElementById("rotate-lock");
    if (el) {
      el.style.display = "none";
      el.style.pointerEvents = "none";
      el.setAttribute("aria-hidden", "true");
    }
  });
}

/**
 * Open the journey map from the hub.
 * @param {import('@playwright/test').Page} page
 */
async function openMap(page) {
  await page.locator("#btn-start").click({ force: true });
  await page.locator("#screen-map.is-active").waitFor({ state: "visible", timeout: 15_000 });
  await page.locator("#map-hero-title").waitFor({ state: "visible", timeout: 10_000 });
}

/** Dismiss tier / rankup announce if it is open. */
async function dismissAnnounce(page) {
  const open = page.locator("#rankup.is-open");
  if (await open.isVisible().catch(() => false)) {
    await page.locator("#btn-rankup-ok").click({ force: true });
    await open.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
  }
}

/**
 * Hub → map → station (stage 0 / current frontier).
 * @param {import('@playwright/test').Page} page
 */
async function enterStation(page) {
  await openMap(page);
  const cta = page.locator("#btn-map-play");
  await cta.click({ force: true });
  await page.locator("#map-path:not([hidden])").waitFor({ state: "visible", timeout: 10_000 });
  await cta.click({ force: true });
  await page.locator("#screen-game.is-active").waitFor({ state: "visible", timeout: 15_000 });
  await dismissAnnounce(page);
  await page.locator("#ingredient-catalog .cat-item").first().waitFor({
    state: "visible",
    timeout: 15_000,
  });
}

/**
 * Tap catalog buttons by exact ingredient display name (guess mode).
 * @param {import('@playwright/test').Page} page
 * @param {string[]} names
 */
async function pickIngredients(page, names) {
  for (const name of names) {
    const btn = page.locator("#ingredient-catalog .cat-item", {
      hasText: new RegExp(`^${escapeRegExp(name)}$`),
    });
    // Scroll the panel scrollport first so short landscapes don't hide chips
    // behind Serve — Playwright's click scrolls the element, but we also assert
    // reachability in layout-integrity without relying on force clicks.
    await btn.first().evaluate((el) => {
      const body = document.querySelector("#panel-body");
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
      if (body) {
        const br = body.getBoundingClientRect();
        const er = el.getBoundingClientRect();
        if (er.bottom > br.bottom) body.scrollTop += er.bottom - br.bottom + 8;
        if (er.top < br.top) body.scrollTop -= br.top - er.top + 8;
      }
    });
    await btn.first().click({ force: false });
  }
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Serve from ingredients step (campaign guess mode → result).
 * @param {import('@playwright/test').Page} page
 */
async function serveDrink(page) {
  const next = page.locator("#btn-next");
  await next.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForFunction(() => {
    const el = document.querySelector("#btn-next");
    return el && !el.disabled;
  }, null, { timeout: 10_000 });
    await next.click({ force: true });
    await page.locator("#screen-result.is-active").waitFor({ state: "visible", timeout: 30_000 });
    // Verdict reveal is deferred ~120ms on campaign (no judge panel).
    await page.locator("#result-actions:not(.is-pending)").waitFor({
      state: "visible",
      timeout: 15_000,
    });
}

/**
 * Hub caret → Mixologist → skip glass + tools → pour catalog.
 * @param {import('@playwright/test').Page} page
 */
async function openMixologistPour(page) {
  const started = await page.evaluate(() => {
    const fn = window.DagTailsHub?.getActions()?.openMixologist;
    if (typeof fn !== "function") return false;
    fn();
    return true;
  });
  if (!started) throw new Error("DagTailsHub.openMixologist is not registered");
  await page.locator("#screen-game.is-active").waitFor({ state: "visible", timeout: 15_000 });
  await dismissAnnounce(page);
  await page.locator("#panel-body .chip").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.locator("#panel-body .chip").first().click({ force: true });
  await page.locator("#btn-next").click({ force: true });
  await page.locator(".step-panel-title").waitFor({ state: "visible", timeout: 10_000 });
  await page.locator("#panel-body .chip").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.locator("#panel-body .chip").first().click({ force: true });
  await page.locator("#btn-next").click({ force: true });
  await page.locator("#ingredient-catalog .cat-item").first().waitFor({
    state: "visible",
    timeout: 15_000,
  });
}

/**
 * Mixologist catalog chip by ingredient display name.
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
function mixChip(page, name) {
  return page.locator(`#ingredient-catalog .cat-item[data-ing-name="${name}"]`);
}

/**
 * True when this Playwright project is the portrait rotate-lock smoke.
 * @param {import('@playwright/test').TestInfo} testInfo
 */
function isPortraitProject(testInfo) {
  return testInfo.project.name === "phone-portrait";
}

/** Skip landscape playability specs on the portrait-only project. */
function skipIfPortrait(testInfo) {
  if (isPortraitProject(testInfo)) {
    testInfo.skip(true, "Landscape playability — use phone-portrait for rotate-lock only");
  }
}

module.exports = {
  seedPlayer,
  gotoHub,
  clearRotateLock,
  openMap,
  dismissAnnounce,
  enterStation,
  pickIngredients,
  serveDrink,
  openMixologistPour,
  mixChip,
  isPortraitProject,
  skipIfPortrait,
  PROFILE,
};
