const { test, expect } = require("@playwright/test");
const { seedPlayer, gotoHub, skipIfPortrait } = require("./helpers");

test.describe("beta gate", () => {
  test("unlocked local boot still reaches the hub", async ({ page }, testInfo) => {
    skipIfPortrait(testInfo);
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);
    await expect(page.locator("#screen-start.is-active")).toBeVisible();
    await expect(page.locator("#screen-beta.is-active")).toHaveCount(0);
  });

  test("?betaLock=1 shows the invite door and not the hub", async ({ page }, testInfo) => {
    skipIfPortrait(testInfo);
    await page.goto("/?betaLock=1");
    await expect(page.locator("#screen-beta.is-active")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#beta-email")).toBeVisible();
    await expect(page.locator("#screen-start.is-active")).toHaveCount(0);
    await expect(page.locator("#btn-splash-continue")).toBeHidden();
  });
});
