const { test, expect } = require("@playwright/test");
const {
  seedPlayer,
  gotoHub,
  enterStation,
  pickIngredients,
  serveDrink,
  skipIfPortrait,
} = require("./helpers");

/**
 * Full campaign play journey under guess-mode holds
 * (glass / method / garnish auto — ingredients only).
 * Stage 0 = Gin & Tonic at The Snug.
 */
test.describe("play journey", () => {
  test.beforeEach(({}, testInfo) => skipIfPortrait(testInfo));

  test("hub → map → station → guess → serve → result", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);

    await expect(page.locator("#screen-start.is-active")).toBeVisible();
    await expect(page.locator("#btn-start")).toBeVisible();

    await enterStation(page);

    await expect(page.locator("#order-name")).toContainText(/Gin\s*&\s*Tonic/i);
    await expect(page.locator("#game-venue")).toContainText(/Snug/i);
    await expect(page.locator("#glass-mount")).toBeVisible();

    // Serve disabled until at least one ingredient is picked
    await expect(page.locator("#btn-next")).toBeDisabled();

    await pickIngredients(page, ["Gin", "Tonic Water"]);
    await expect(page.locator("#ingredient-catalog .cat-item.is-selected")).toHaveCount(2);
    await expect(page.locator("#ingredient-catalog .cat-item-step")).toHaveCount(0);
    await expect(page.locator("#build-list")).toHaveCount(0);
    await expect(page.locator("#btn-next")).toBeEnabled();
    await expect(page.locator("#btn-next")).toContainText(/Serve Drink/i);

    await serveDrink(page);

    await expect(page.locator("#result-name")).toContainText(/Gin\s*&\s*Tonic/i);
    // Correct Gin & Tonic clears the stage; star .on classes animate in after reveal.
    await expect(page.locator("#result-eyebrow")).toContainText(/Stage cleared/i);
    await expect(page.locator("#result-stars span.on").first()).toBeVisible({ timeout: 5_000 });

    await expect(page.locator("#btn-retry")).toBeVisible();
    await expect(page.locator("#btn-next-stage")).toBeVisible();
  });

  test("advance to next stage after a clear", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);
    await enterStation(page);
    await pickIngredients(page, ["Gin", "Tonic Water"]);
    await serveDrink(page);

    await page.locator("#btn-next-stage").click({ force: true });
    await page.locator("#screen-game.is-active").waitFor({ state: "visible", timeout: 15_000 });

    // Stop 2 at Snug — Tom Collins (not Gin & Tonic)
    await expect(page.locator("#stage-pill")).toContainText(/Stop\s*2/i);
    await expect(page.locator("#order-name")).not.toContainText(/Gin\s*&\s*Tonic/i);
    await expect(page.locator("#ingredient-catalog .cat-item").first()).toBeVisible();
  });

  test("quit returns to map", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);
    await enterStation(page);
    await page.locator("#btn-quit").click({ force: true });
    await expect(page.locator("#screen-map.is-active")).toBeVisible();
    await expect(page.locator("#btn-map-play")).toBeVisible();
  });
});
