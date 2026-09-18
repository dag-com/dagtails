const { test, expect } = require("@playwright/test");
const { seedPlayer, gotoHub, skipIfPortrait } = require("./helpers");

test.describe("operator tools (local)", () => {
  test.beforeEach(({}, testInfo) => skipIfPortrait(testInfo));

  test("local play still shows prototype, reset, and debug toolbar", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);

    await expect(page.locator("#debug-toolbar")).toBeVisible();

    await page.locator("#btn-settings").click({ force: true });
    await expect(page.locator("#screen-settings.is-active")).toBeVisible();
    await expect(page.locator("#set-proto-row")).toBeVisible();
    await expect(page.locator("#set-prototype")).toBeVisible();
    await expect(page.locator("#set-reset")).toBeVisible();
  });
});
