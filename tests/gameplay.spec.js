const { test, expect } = require("@playwright/test");
const { seedPlayer, gotoHub, openMap } = require("./helpers");

test.describe("gameplay smoke", () => {
  test("map shows CTA, hint, and current hub", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);
    await openMap(page);

    await expect(page.locator("#map-hint")).toBeVisible();
    await expect(page.locator("#btn-map-play")).toBeVisible();
    await expect(page.locator("#btn-map-play")).toContainText(/Pour at|Enter|Snug/i);

    const current = page.locator(".map-venue.is-current");
    await expect(current).toHaveCount(1);
    await expect(current).toContainText(/Snug/i);

    // Venue list shows stages for the current bar
    await expect(current.locator(".map-stage-btn").first()).toBeVisible();
  });

  test("map has no background plate image", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);
    await openMap(page);
    await expect(page.locator("#map-plate")).toHaveCount(0);
    expect(await page.locator("#map-hubs .map-venue").count()).toBeGreaterThan(0);
  });

  test("glass mount sits near bar-top at 800px width", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "pc", "Desktop ≤860px vessel-lift regression only");
    // Catch the ≤860px vessel-lift regression.
    await page.setViewportSize({ width: 800, height: 900 });
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);
    await openMap(page);
    await page.locator("#btn-map-play").click({ force: true });
    await page.locator("#screen-game.is-active").waitFor({ state: "visible", timeout: 15_000 });

    // Wait for a vessel to mount on the counter
    await page.waitForFunction(() => {
      const g = document.querySelector("#glass-mount");
      return g && !g.hidden && g.getBoundingClientRect().height > 40;
    }, null, { timeout: 15_000 });

    const gap = await page.evaluate(() => {
      const glass = document.querySelector("#glass-mount");
      const top = document.querySelector(".bar-top");
      if (!glass || !top) return 9999;
      const g = glass.getBoundingClientRect();
      const t = top.getBoundingClientRect();
      // Distance from glass bottom to bar-top top (negative = overlapping)
      return g.bottom - t.top;
    });

    // Feet should meet the slab: allow modest overlap or small gap, not a 52px float.
    expect(gap).toBeGreaterThan(-80);
    expect(gap).toBeLessThan(90);
  });

  test("venue interior loads on bar-bg (not a black void)", async ({ page }) => {
    // Mimosa is stop 17 at Aperitivo Piazza (cleared 16).
    await seedPlayer(page, { cleared: 16 });
    await gotoHub(page);
    await openMap(page);
    await page.locator("#btn-map-play").click({ force: true });
    await page.locator("#screen-game.is-active").waitFor({ state: "visible", timeout: 15_000 });
    await expect(page.locator("#game-venue")).toContainText(/Aperitivo/i);

    const info = await page.evaluate(async () => {
      const bar = document.querySelector(".bar-bg");
      if (!bar) return { error: "missing .bar-bg" };
      const raw = getComputedStyle(bar).getPropertyValue("--venue-bar-bg").trim()
        || bar.style.getPropertyValue("--venue-bar-bg").trim();
      const match = raw.match(/url\(\s*["']?([^"')]+)["']?\s*\)/i);
      const url = match ? match[1] : "";
      let status = 0;
      let contentType = "";
      if (url) {
        const res = await fetch(url);
        status = res.status;
        contentType = res.headers.get("content-type") || "";
      }
      const bg = getComputedStyle(bar).backgroundImage || "";
      return {
        raw,
        url,
        status,
        contentType,
        bg,
        isAbsolute: /^https?:\/\//i.test(url),
        mentionsInterior: /venues\/interiors\//i.test(url) || /venues\/interiors\//i.test(bg),
      };
    });

    expect(info.error).toBeUndefined();
    expect(info.url, `css var was: ${info.raw}`).toBeTruthy();
    expect(info.isAbsolute).toBe(true);
    expect(info.mentionsInterior).toBe(true);
    expect(info.status).toBe(200);
    expect(info.contentType).toMatch(/image\//i);
    expect(info.bg).toMatch(/url\(/i);
  });
});
