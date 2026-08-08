const { test, expect } = require("@playwright/test");
const { seedPlayer, isPortraitProject } = require("./helpers");

/**
 * Portrait phones show #rotate-lock and block play (by design).
 * Runs only on the `phone-portrait` Playwright project.
 */
test.describe("portrait rotate-lock", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!isPortraitProject(testInfo), "Portrait smoke only on phone-portrait project");
  });

  test("rotate-lock is visible and app is non-interactive", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    // Do NOT clear rotate-lock — portrait gate must stay active.
    await page.goto("/");
    if (await page.locator("#screen-splash.is-active").isVisible().catch(() => false)) {
      // Splash may be under the lock; force-click is ok to reach hub under blur.
      await page.locator("#btn-splash-continue").click({ force: true });
    }

    const lock = page.locator("#rotate-lock");
    await expect(lock).toBeVisible({ timeout: 15_000 });
    await expect(lock).toContainText(/rotate|landscape|turn/i);

    const display = await lock.evaluate((el) => getComputedStyle(el).display);
    expect(display).toBe("flex");

    const appBlocked = await page.evaluate(() => {
      const app = document.querySelector(".app");
      if (!app) return false;
      const cs = getComputedStyle(app);
      return cs.pointerEvents === "none";
    });
    expect(appBlocked).toBe(true);
  });
});
