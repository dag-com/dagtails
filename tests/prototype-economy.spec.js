const { test, expect } = require("@playwright/test");
const {
  seedPlayer,
  gotoHub,
  enterStation,
  skipIfPortrait,
} = require("./helpers");

test.describe("economy prototype", () => {
  test.beforeEach(({}, testInfo) => skipIfPortrait(testInfo));

  test("live hub has no proto banner or tips chip", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);
    await expect(page.locator("#proto-banner")).toBeHidden();
    await expect(page.locator("#hub-chip-tips")).toHaveCount(0);
  });

  test("proto hub shows banner, tips, and settings toggle", async ({ page }) => {
    await seedPlayer(page, { cleared: 0, prototype: true });
    await gotoHub(page);
    await expect(page.locator("#proto-banner")).toBeVisible();
    await expect(page.locator("#hub-chip-proto")).toBeVisible();
    await expect(page.locator("#hero-tips-total")).toContainText("40");

    await page.locator("#btn-settings").click({ force: true });
    await expect(page.locator("#screen-settings.is-active")).toBeVisible();
    await expect(page.locator("#set-prototype")).toHaveAttribute("aria-pressed", "true");
  });

  test("proto ticket is flavor-only until a warned peek", async ({ page }) => {
    await seedPlayer(page, { cleared: 0, prototype: true });
    await gotoHub(page);
    await enterStation(page);

    await expect(page.locator("#order-name")).toContainText(/Gin\s*&\s*Tonic/i);
    await expect(page.locator("#order-desc")).toContainText(/patio classic/i);
    await expect(page.locator("#order-desc")).not.toContainText(/measure of gin/i);
    await expect(page.locator("#ticket-recipe")).toBeHidden();
    await expect(page.locator("#btn-cull")).toBeVisible();

    const ticket = page.locator("#order-ticket");
    await expect(ticket).not.toHaveClass(/is-flipped/);
    await ticket.click({ force: true });

    const modal = page.locator("#modal-hint.is-open");
    await expect(modal).toBeVisible();
    await page.locator("#hint-dont-ask").check();
    await page.locator("#btn-hint-confirm").click();

    await expect(modal).toHaveCount(0);
    await expect(ticket).toHaveClass(/is-flipped/);
    await expect(page.locator("#ticket-recipe")).toContainText(/Tonic/i);

    await page.locator("#ingredient-catalog .cat-item").first().click({ force: true });
    await expect(ticket).not.toHaveClass(/is-flipped/);
  });

  test("live ticket face is flavor-only; free flip still shows the spec", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);
    await enterStation(page);
    await expect(page.locator("#order-desc")).toContainText(/patio classic/i);
    await expect(page.locator("#order-desc")).not.toContainText(/measure of gin/i);
    await expect(page.locator("#ticket-recipe")).toBeHidden();
    await expect(page.locator("#btn-cull")).toBeHidden();
    await page.locator("#order-ticket").click({ force: true });
    await expect(page.locator("#modal-hint.is-open")).toHaveCount(0);
    await expect(page.locator("#order-ticket")).toHaveClass(/is-flipped/);
    await expect(page.locator("#ticket-recipe")).toContainText(/Tonic/i);
  });
});
