const { test, expect } = require("@playwright/test");
const { seedPlayer, gotoHub, skipIfPortrait, openMixologistPour, mixChip } = require("./helpers");

test.describe("mixology classic detection", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    skipIfPortrait(testInfo);
    await seedPlayer(page, { cleared: 5 });
    await gotoHub(page);
  });

  test("blocks community share for exact and close classics, not cousins", async ({ page }) => {
    const report = await page.evaluate(async () => {
      const { detectClassic, classicBlocksCommunityShare } = window.__dagtailsMixology;
      const screwdriver = detectClassic({
        method: "build",
        ingredients: [
          { id: "vodka", amount: 50 },
          { id: "orange_juice", amount: 120 },
        ],
      });
      const screwdriverLime = detectClassic({
        method: "build",
        ingredients: [
          { id: "vodka", amount: 50 },
          { id: "orange_juice", amount: 120 },
          { id: "lime_juice", amount: 10 },
        ],
      });
      const original = detectClassic({
        method: "shake",
        ingredients: [
          { id: "gin", amount: 40 },
          { id: "vodka", amount: 20 },
          { id: "campari", amount: 15 },
          { id: "orange_juice", amount: 40 },
        ],
      });
      const boulevardier = detectClassic({
        method: "stir",
        ingredients: [
          { id: "bourbon", amount: 30 },
          { id: "campari", amount: 30 },
          { id: "sweet_vermouth", amount: 30 },
        ],
      });
      return {
        screwdriver,
        screwdriverLime,
        original,
        boulevardier,
        blockExact: classicBlocksCommunityShare(screwdriver),
        blockClose: classicBlocksCommunityShare(screwdriverLime),
        blockOriginal: classicBlocksCommunityShare(original),
      };
    });

    expect(report.screwdriver?.name).toMatch(/Screwdriver/i);
    expect(report.screwdriver?.exact).toBe(true);
    expect(report.blockExact).toBe(true);

    expect(report.screwdriverLime?.name).toMatch(/Screwdriver/i);
    expect(report.screwdriverLime?.exact).toBe(false);
    expect(report.blockClose).toBe(true);

    expect(report.original).toBeNull();
    expect(report.blockOriginal).toBe(false);

    expect(report.boulevardier?.name).toMatch(/Boulevardier/i);
    expect(report.boulevardier?.exact).toBe(true);
  });
});

test.describe("mixologist pour chips", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    skipIfPortrait(testInfo);
    await seedPlayer(page, { cleared: 5 });
    await gotoHub(page);
    await openMixologistPour(page);
  });

  test("tap expands one chip; amounts live on the chip; Guess-style list is gone", async ({ page }) => {
    await expect(page.locator("#build-list")).toHaveCount(0);
    await expect(page.locator(".step-panel-title")).toContainText(/Pour your ingredients/i);

    const gin = mixChip(page, "Gin");
    const vodka = mixChip(page, "Vodka");
    await gin.click();

    await expect(gin).toHaveClass(/is-editing/);
    await expect(gin.locator(".cat-item-amt")).toHaveText("15");
    await expect(gin.locator(".cat-item-step")).toHaveCount(2);
    await expect(vodka).not.toHaveClass(/is-editing/);
    await expect(vodka).not.toHaveClass(/is-in-glass/);

    await gin.locator(".cat-item-step.is-plus").click();
    await expect(gin.locator(".cat-item-amt")).toHaveText("20");
    await expect(gin).toHaveClass(/is-editing/);

    await vodka.click();
    await expect(vodka).toHaveClass(/is-editing/);
    await expect(gin).toHaveClass(/is-in-glass/);
    await expect(gin).not.toHaveClass(/is-editing/);
    await expect(gin.locator(".cat-item-badge")).toHaveText("20");
    await expect(page.locator("#ingredient-catalog .cat-item.is-editing")).toHaveCount(1);

    await vodka.locator(".cat-item-remove").click();
    await expect(vodka).not.toHaveClass(/is-in-glass/);
    await expect(vodka).not.toHaveClass(/is-editing/);
    await expect(gin).toHaveClass(/is-in-glass/);
  });
});
