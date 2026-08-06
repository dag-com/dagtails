const { test, expect } = require("@playwright/test");
const { seedPlayer, gotoHub, openMap } = require("./helpers");

/**
 * End-to-end “game is up” gate: boot → hub → backend health → enter map.
 * Pair with `npm run healthcheck` for remote Pages + Supabase service probes.
 */
test.describe("game health", () => {
  test("game boots, hub is playable, and Supabase is healthy", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);

    await expect(page.locator("#screen-start.is-active")).toBeVisible();
    await expect(page.locator("#btn-start")).toBeVisible();

    const health = await page
      .waitForFunction(
        () => {
          const h = window.__dagtailsHealth;
          return h && typeof h.ok === "boolean" ? h : null;
        },
        null,
        { timeout: 30_000 }
      )
      .then((h) => h.jsonValue());

    expect(health.configured, JSON.stringify(health)).toBe(true);
    expect(health.ok, `backend down: ${health.error}`).toBe(true);

    await openMap(page);
    await expect(page.locator("#screen-map.is-active")).toBeVisible();
    await expect(page.locator("#btn-map-play")).toBeVisible();
  });
});
