const { test, expect } = require("@playwright/test");
const { seedPlayer, gotoHub, openMap } = require("./helpers");

test.describe("performance", () => {
  test("cold hub load stays under soft transfer budget", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await page.goto("/");
    if (await page.locator("#screen-splash.is-active").isVisible().catch(() => false)) {
      await page.locator("#btn-splash-continue").click({ force: true });
    }
    await page.locator("#screen-start.is-active").waitFor({ state: "visible", timeout: 15_000 });

    const stats = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const resources = performance.getEntriesByType("resource");
      let transfer = 0;
      let decoded = 0;
      const comics = [];
      resources.forEach((r) => {
        const t = r.transferSize || 0;
        const d = r.decodedBodySize || 0;
        transfer += t;
        decoded += d;
        if (/comic\d+\.png/i.test(r.name)) comics.push(r.name);
      });
      return {
        transfer,
        decoded,
        comics: comics.length,
        mapFetched: resources.some((r) => /dag-tails-bar-hop-map/i.test(r.name)),
        domContentLoaded: nav ? nav.domContentLoadedEventEnd : 0,
      };
    });

    // Soft budgets: cold hub should not pull the full comic reel or map plate.
    expect(stats.comics).toBeLessThanOrEqual(1);
    expect(stats.mapFetched).toBe(false);
    // ~8 MB decoded soft cap for splash+hub (uncompressed PNGs still dominate splash).
    expect(stats.decoded).toBeLessThan(9_000_000);
  });

  test("opening map does not fetch all comic panels", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);
    await openMap(page);
    await page.waitForTimeout(800);

    const comicCount = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .filter((r) => /comic\d+\.png/i.test(r.name)).length
    );
    expect(comicCount).toBe(0);
  });
});
