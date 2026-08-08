const { test, expect } = require("@playwright/test");
const {
  seedPlayer,
  gotoHub,
  openMap,
  enterStation,
  pickIngredients,
  serveDrink,
  skipIfPortrait,
} = require("./helpers");

const MIN_BODY_PX = 11;
const MIN_TERTIARY_PX = 10;

/**
 * Text readability across form factors: min size, non-empty critical copy,
 * no document horizontal scroll.
 */
test.describe("text readability", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    skipIfPortrait(testInfo);
    await page.addInitScript(() => {
      window.readText = function readText(targets) {
        const failures = [];
        const empty = [];
        const sizes = {};
        for (const t of targets) {
          const el = document.querySelector(t.sel);
          if (!el) {
            empty.push(`${t.key}:missing`);
            continue;
          }
          const text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
          if (!text) empty.push(`${t.key}:empty`);
          const fs = parseFloat(getComputedStyle(el).fontSize) || 0;
          sizes[t.key] = fs;
          if (fs < t.min) failures.push(`${t.key}:${fs}px<${t.min}`);
        }
        const doc = document.documentElement;
        const hScroll = doc.scrollWidth > doc.clientWidth + 2;
        return { failures, empty, sizes, hScroll };
      };
    });
  });

  test("hub CTAs meet min type size and page does not scroll sideways", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);

    const report = await page.evaluate((mins) => window.readText([
      { sel: "#btn-start", key: "start", min: mins.body },
      { sel: "#btn-training", key: "learn", min: mins.body },
      { sel: "#btn-how", key: "help", min: mins.body },
      { sel: "#btn-badges", key: "badges", min: mins.tertiary },
    ]), { body: MIN_BODY_PX, tertiary: MIN_TERTIARY_PX });

    expect(report.failures, JSON.stringify(report)).toEqual([]);
    expect(report.hScroll).toBe(false);
  });

  test("map CTA and hint stay readable", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);
    await openMap(page);

    const report = await page.evaluate((mins) => window.readText([
      { sel: "#btn-map-play", key: "cta", min: mins.body },
      { sel: "#map-hint", key: "hint", min: mins.tertiary },
      { sel: ".map-venue.is-current .map-venue-titles", key: "venue", min: mins.tertiary },
    ]), { body: MIN_BODY_PX, tertiary: MIN_TERTIARY_PX });

    expect(report.failures, JSON.stringify(report)).toEqual([]);
    expect(report.empty, JSON.stringify(report)).toEqual([]);
    expect(report.hScroll).toBe(false);
  });

  test("station ticket, venue, serve, and catalog labels stay readable", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);
    await enterStation(page);

    const report = await page.evaluate((mins) => {
      const items = [
        { sel: "#order-name", key: "drink", min: mins.body },
        { sel: "#btn-next", key: "serve", min: mins.body },
        { sel: "#game-venue", key: "venue", min: mins.tertiary },
        { sel: "#stage-pill", key: "stage", min: mins.tertiary },
      ];
      const firstCat = document.querySelector("#ingredient-catalog .cat-item");
      if (firstCat) {
        firstCat.setAttribute("data-qa-text", "1");
        items.push({ sel: '[data-qa-text="1"]', key: "catalog", min: mins.tertiary });
      }
      return window.readText(items);
    }, { body: MIN_BODY_PX, tertiary: MIN_TERTIARY_PX });

    expect(report.failures, JSON.stringify(report)).toEqual([]);
    expect(report.empty, JSON.stringify(report)).toEqual([]);
    expect(report.hScroll).toBe(false);
  });

  test("result name and actions stay readable", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);
    await enterStation(page);
    await pickIngredients(page, ["Gin", "Tonic Water"]);
    await serveDrink(page);

    const report = await page.evaluate((mins) => window.readText([
      { sel: "#result-name", key: "name", min: mins.body },
      { sel: "#result-eyebrow", key: "eyebrow", min: mins.tertiary },
      { sel: "#btn-retry", key: "retry", min: mins.body },
      { sel: "#btn-next-stage", key: "next", min: mins.body },
      { sel: "#result-pct", key: "pct", min: mins.tertiary },
    ]), { body: MIN_BODY_PX, tertiary: MIN_TERTIARY_PX });

    expect(report.failures, JSON.stringify(report)).toEqual([]);
    expect(report.empty, JSON.stringify(report)).toEqual([]);
    expect(report.hScroll).toBe(false);
  });
});
