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
 * @param {{ cleared?: number, seenTiers?: Record<string, number> }} [opts]
 */
async function seedPlayer(page, opts = {}) {
  const cleared = opts.cleared ?? 0;
  // Default: mark Guess tier seen so the rules announce does not block pours.
  const seenTiers = opts.seenTiers ?? { Guess: 1 };
  await page.addInitScript(
    ({ profile, cleared: c, seenTiers: tiers }) => {
      localStorage.setItem("dagtails_migrated", "1");
      localStorage.setItem("dagtails_intro_seen", "1");
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
    { profile: PROFILE, cleared, seenTiers }
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
  await page.locator("#map-hubs .map-venue").first().waitFor({ state: "attached" });
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
  await page.locator("#btn-map-play").click({ force: true });
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
  isPortraitProject,
  skipIfPortrait,
  PROFILE,
};
