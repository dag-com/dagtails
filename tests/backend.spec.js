const { test, expect } = require("@playwright/test");
const { seedPlayer, gotoHub } = require("./helpers");

test.describe("supabase backend", () => {
  test("Supabase is up when the game boots", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);

    const health = await page.waitForFunction(
      () => {
        const h = window.__dagtailsHealth;
        return h && typeof h.ok === "boolean" ? h : null;
      },
      null,
      { timeout: 30_000 }
    ).then((h) => h.jsonValue());

    expect(health.configured, `health=${JSON.stringify(health)}`).toBe(true);
    expect(
      health.ok,
      [
        "Supabase health check failed while the game was up.",
        `error=${health.error}`,
        "Fix SUPABASE_URL / SUPABASE_ANON_KEY in config.js (project may be paused or deleted),",
        "then re-run: npx playwright test tests/backend.spec.js --project=pc",
      ].join(" ")
    ).toBe(true);
    expect(health.error).toBeNull();
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    expect(health.latencyMs).toBeLessThan(15_000);
  });
});
