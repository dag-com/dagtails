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
 * @param {{ cleared?: number }} [opts]
 */
async function seedPlayer(page, opts = {}) {
  const cleared = opts.cleared ?? 0;
  await page.addInitScript(
    ({ profile, cleared: c }) => {
      localStorage.setItem("dagtails_migrated", "1");
      localStorage.setItem("dagtails_intro_seen", "1");
      localStorage.setItem("dagtails_profile", JSON.stringify(profile));
      localStorage.setItem(
        "dagtails_map",
        JSON.stringify({ cleared: c, records: {}, recordsMigrated: 1, seenTiers: {} })
      );
      localStorage.setItem("dagtails_settings", JSON.stringify({ sound: false }));
    },
    { profile: PROFILE, cleared }
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

module.exports = { seedPlayer, gotoHub, openMap, PROFILE };
