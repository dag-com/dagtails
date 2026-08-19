const { test, expect } = require("@playwright/test");
const { seedPlayer, gotoHub, openMap, enterStation } = require("./helpers");

test.describe("gameplay smoke", () => {
  test("map shows venue hero, CTA, and current bar", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);
    await openMap(page);

    await expect(page.locator("#map-hint")).toBeVisible();
    await expect(page.locator("#btn-map-play")).toBeVisible();
    await expect(page.locator("#btn-map-play")).toContainText(/Enter bar/i);
    await expect(page.locator("#map-hero-title")).toContainText(/SNUG|The Snug/i);
    await expect(page.locator("#map-hero-duck")).toBeVisible();
    await expect(page.locator("#map-dots .map-dot.is-current")).toHaveCount(1);
  });

  test("Enter bar opens candy path; Pour starts the station", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);
    await openMap(page);
    await page.locator("#btn-map-play").click({ force: true });
    await expect(page.locator("#map-path:not([hidden])")).toBeVisible();
    await expect(page.locator("#screen-game.is-active")).toHaveCount(0);
    await expect(page.locator(".map-node").first()).toBeVisible();
    await expect(page.locator(".map-node-glass")).toHaveCount(0);
    await expect(page.locator(".map-node-star")).toHaveCount(9);
    await expect(page.locator("#map-path-duck")).toBeHidden();
    await expect(page.locator(".map-node.is-current .map-node-star.is-on")).toHaveCount(0);
    await expect(page.locator("#btn-map-play")).toContainText(/Pour/i);
    await page.locator("#btn-map-play").click({ force: true });
    await expect(page.locator("#screen-game.is-active")).toBeVisible({ timeout: 15_000 });
  });

  test("map has no background plate image", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);
    await openMap(page);
    await expect(page.locator("#map-plate")).toHaveCount(0);
    expect(await page.locator("#map-dots .map-dot").count()).toBeGreaterThan(0);
  });

  test("glass mount sits near bar-top at 800px width", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "pc", "Desktop ≤860px vessel-lift regression only");
    // Catch the ≤860px vessel-lift regression.
    await page.setViewportSize({ width: 800, height: 900 });
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);
    await enterStation(page);

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
    await enterStation(page);
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

  test("boot funnel writes session, splash, and hub events", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);

    const names = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem("dagtails_analytics_log") || "[]").map((e) => e.name);
      } catch (e) {
        return [];
      }
    });

    expect(names).toContain("session_start");
    expect(names).toContain("app_open");
    expect(names).toContain("splash_continue");
    expect(names).toContain("hub_view");

    await openMap(page);
    const afterMap = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem("dagtails_analytics_log") || "[]").map((e) => e.name);
      } catch (e) {
        return [];
      }
    });
    expect(afterMap).toContain("hub_cta");
    expect(afterMap).toContain("map_view");

    const cta = page.locator("#btn-map-play");
    await cta.click({ force: true });
    await page.locator("#map-path:not([hidden])").waitFor({ state: "visible", timeout: 10_000 });
    await cta.click({ force: true });
    await page.locator("#screen-game.is-active").waitFor({ state: "visible", timeout: 15_000 });
    await page.locator("#btn-quit").click({ force: true });
    const afterQuit = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem("dagtails_analytics_log") || "[]").map((e) => e.name);
      } catch (e) {
        return [];
      }
    });
    expect(afterQuit).toContain("stage_started");
    expect(afterQuit).toContain("drink_abandoned");

    for (let i = 0; i < 3; i += 1) {
      const onHub = await page.locator("#screen-start.is-active").isVisible().catch(() => false);
      if (onHub) break;
      const back = page.locator("#btn-map-back");
      if (await back.isVisible().catch(() => false)) {
        await back.click({ force: true });
      }
    }
    const afterMenu = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem("dagtails_analytics_log") || "[]").map((e) => e.name);
      } catch (e) {
        return [];
      }
    });
    expect(afterMenu).toContain("menu_return");
  });
});
