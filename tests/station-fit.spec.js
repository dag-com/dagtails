const { test, expect } = require("@playwright/test");
const { seedPlayer, gotoHub, skipIfPortrait } = require("./helpers");

/**
 * Every serving glass × prep method: the live tool must sit IN its vessel
 * (muddler in the bowl, spoon in the mixing glass), not through the stem.
 */
test.describe("station tool × glass fit", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    skipIfPortrait(testInfo);
    await seedPlayer(page, { cleared: 5 });
    await gotoHub(page);
  });

  test("muddler / spoon / prep vessel sit inside the right glass for every combo", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.locator("#screen-start.is-active").waitFor({ state: "visible", timeout: 15_000 });

    const catalog = await page.evaluate(() => {
      const api = window.__dagtailsStation;
      if (!api) return { error: "missing __dagtailsStation" };
      return { glasses: api.glasses(), methods: api.methods() };
    });
    expect(catalog.error, JSON.stringify(catalog)).toBeUndefined();
    expect(catalog.glasses.length, "9 serving glasses").toBe(9);
    expect(catalog.methods.length, "5 prep methods").toBe(5);

    const fail = [];
    let n = 0;
    for (const glass of catalog.glasses) {
      for (const method of catalog.methods) {
        const fit = await page.evaluate(
          ({ g, m }) => window.__dagtailsStation.preview(g, m),
          { g: glass, m: method }
        );
        n += 1;
        if (fit.issues && fit.issues.length) {
          fail.push({
            glass,
            method,
            issues: fit.issues,
            mudBottom: fit.muddler && +fit.muddler.bottom.toFixed(1),
            bowlTop: fit.bowl && +fit.bowl.top.toFixed(1),
            bowlBot: fit.bowl && +fit.bowl.bottom.toFixed(1),
            mudH: fit.muddler && +fit.muddler.height.toFixed(1),
            bowlH: fit.bowl && +fit.bowl.height.toFixed(1),
          });
          await page.screenshot({
            path: testInfo.outputPath(`${glass}-${method}.png`),
            fullPage: false,
          });
        }
      }
    }

    expect(n, "9 glasses × 5 methods").toBe(45);
    expect(fail, JSON.stringify(fail, null, 2)).toEqual([]);
  });
});
