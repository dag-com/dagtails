const { test, expect } = require("@playwright/test");
const { seedPlayer, isPortraitProject, clearRotateLock } = require("./helpers");

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

    const isLockedClass = await page.evaluate(() =>
      document.documentElement.classList.contains("is-portrait-locked")
    );
    expect(isLockedClass).toBe(true);

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

  test("clearRotateLock unlocks the app and hides rotate-lock", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await page.goto("/");
    if (await page.locator("#screen-splash.is-active").isVisible().catch(() => false)) {
      await page.locator("#btn-splash-continue").click({ force: true });
    }

    const lock = page.locator("#rotate-lock");
    await expect(lock).toBeVisible({ timeout: 15_000 });

    await clearRotateLock(page);

    await expect(lock).toBeHidden();
    const isLockedClass = await page.evaluate(() =>
      document.documentElement.classList.contains("is-portrait-locked")
    );
    expect(isLockedClass).toBe(false);

    const appInteractive = await page.evaluate(() => {
      const app = document.querySelector(".app");
      if (!app) return false;
      const cs = getComputedStyle(app);
      return cs.pointerEvents !== "none";
    });
    expect(appInteractive).toBe(true);
  });

  test("class and bypass attribute toggle rotate-lock display and interactivity", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await page.goto("/");

    const state = await page.evaluate(() => {
      const html = document.documentElement;
      const lock = document.getElementById("rotate-lock");
      const app = document.querySelector(".app");

      // Force portrait locked without bypass
      html.removeAttribute("data-qa-rotate-bypass");
      html.classList.add("is-portrait-locked");
      const lockedDisplay = lock ? getComputedStyle(lock).display : null;
      const lockedEvents = app ? getComputedStyle(app).pointerEvents : null;

      // Add QA rotate bypass
      html.setAttribute("data-qa-rotate-bypass", "1");
      const bypassDisplay = lock ? getComputedStyle(lock).display : null;
      const bypassEvents = app ? getComputedStyle(app).pointerEvents : null;

      // Add Expo shell bypass
      html.removeAttribute("data-qa-rotate-bypass");
      html.setAttribute("data-expo-shell", "1");
      const expoDisplay = lock ? getComputedStyle(lock).display : null;
      const expoEvents = app ? getComputedStyle(app).pointerEvents : null;

      return {
        lockedDisplay,
        lockedEvents,
        bypassDisplay,
        bypassEvents,
        expoDisplay,
        expoEvents,
      };
    });

    expect(state.lockedDisplay).toBe("flex");
    expect(state.lockedEvents).toBe("none");
    expect(state.bypassDisplay).toBe("none");
    expect(state.bypassEvents).not.toBe("none");
    expect(state.expoDisplay).toBe("none");
    expect(state.expoEvents).not.toBe("none");
  });
});
