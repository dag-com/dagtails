const { test, expect } = require("@playwright/test");
const { seedPlayer, gotoHub, openCotd, pickIngredients, serveDrink, skipIfPortrait } = require("./helpers");

test.describe("judge panel comments", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    skipIfPortrait(testInfo);
    await seedPlayer(page, { cleared: 5, cotdId: "espresso_martini" });
    await gotoHub(page);
  });

  test("Espresso Martini panel does not repeat the same line", async ({ page }) => {
    const report = await page.evaluate(() => {
      const mix = window.__dagtailsMixology;
      const rina = mix.JUDGES.find((j) => j.id === "sweet_rina");
      const amir = mix.JUDGES.find((j) => j.id === "silk_amir");
      const bianca = mix.JUDGES.find((j) => j.id === "balanced_bea");
      const evalResult = mix.evaluate({
        glass: "martini",
        method: "shake",
        garnish: "coffee_beans",
        ingredients: [
          { id: "vodka", amount: 50 },
          { id: "coffee_liqueur", amount: 20 },
          { id: "espresso", amount: 30 },
          { id: "sugar_syrup", amount: 10 },
        ],
      });
      const panel = mix.scoreWithJudges(evalResult, [rina, amir, bianca]);
      const comments = panel.judges.map((j) => j.comment);
      return {
        comments,
        unique: new Set(comments).size,
        scores: panel.judges.map((j) => j.score100),
        avg: panel.total,
      };
    });

    expect(report.comments.length).toBe(3);
    expect(report.unique, JSON.stringify(report.comments)).toBe(3);
    expect(report.comments.every((c) => c === "A bit too bitter for me.")).toBe(false);
  });

  test("correct Espresso Martini does not roast the pour", async ({ page }) => {
    const report = await page.evaluate(() => {
      const mix = window.__dagtailsMixology;
      const rina = mix.JUDGES.find((j) => j.id === "sweet_rina");
      const amir = mix.JUDGES.find((j) => j.id === "silk_amir");
      const maggie = mix.JUDGES.find((j) => j.id === "fizzy_mag");
      const evalResult = mix.evaluate({
        glass: "martini",
        method: "shake",
        garnish: "coffee_beans",
        ingredients: [
          { id: "vodka", amount: 50 },
          { id: "coffee_liqueur", amount: 20 },
          { id: "espresso", amount: 30 },
          { id: "sugar_syrup", amount: 10 },
        ],
      });
      const panel = mix.scoreWithJudges(evalResult, [rina, amir, maggie].filter(Boolean), { recipePct: 100 });
      const comments = panel.judges.map((j) => j.comment);
      return { comments, unique: new Set(comments).size, blob: comments.join(" ") };
    });

    expect(report.unique, JSON.stringify(report.comments)).toBe(3);
    expect(report.blob, JSON.stringify(report.comments)).not.toMatch(/bubbles|sloppy|too bitter|struggle to serve/i);
  });

  test("COTD Espresso Martini result tells one labeled score story", async ({ page }) => {
    test.setTimeout(60_000);
    await openCotd(page);
    await expect(page.locator("#order-name")).toContainText(/Espresso Martini/i);
    await pickIngredients(page, ["Vodka", "Coffee Liqueur", "Espresso", "Sugar Syrup"]);
    await serveDrink(page, { verdictTimeout: 25_000 });

    await expect(page.locator("#result-name")).toContainText(/Espresso Martini/i);
    await expect(page.locator("#btn-retry")).toBeVisible();
    await expect(page.locator("#btn-next-stage")).toBeVisible();

    const report = await page.evaluate(() => {
      const guest = document.getElementById("result-guest-img");
      const quote = (document.getElementById("result-customer")?.textContent || "").trim();
      const labelEl = document.getElementById("result-score-label");
      const subEl = document.getElementById("result-score-sub");
      const judgesWrap = document.getElementById("result-judges-wrap");
      const right = document.querySelector(".result-right").getBoundingClientRect();
      const items = [...document.querySelectorAll("#feedback-list li")];
      const clipped = items.filter((li) => {
        const r = li.getBoundingClientRect();
        return r.height > 2 && (r.bottom > right.bottom + 4 || r.top < right.top - 4);
      }).length;
      const retry = document.getElementById("btn-retry").getBoundingClientRect();
      const back = document.getElementById("btn-next-stage").getBoundingClientRect();
      const vh = window.innerHeight;
      const guestBox = guest ? guest.getBoundingClientRect() : { width: 0, height: 0 };
      return {
        eyebrow: (document.getElementById("result-eyebrow")?.textContent || "").trim(),
        label: (labelEl.textContent || "").trim(),
        labelHidden: !!labelEl.hidden,
        subHidden: !!subEl.hidden,
        quote,
        judgesHidden: !judgesWrap || judgesWrap.style.display === "none" || getComputedStyle(judgesWrap).display === "none",
        judgeSeats: document.querySelectorAll("#result-judges .judge-seat").length,
        starOn: document.querySelectorAll("#result-stars span.on").length,
        clipped,
        itemCount: items.length,
        guestSrc: guest ? guest.getAttribute("src") || "" : "",
        guestVisible: guestBox.height > 40 && guestBox.width > 40,
        exitsOff: retry.bottom > vh + 4 || back.bottom > vh + 4 || retry.height < 8 || back.height < 8,
        pct: (document.getElementById("result-pct").textContent || "").trim(),
        viewport: { w: window.innerWidth, h: vh },
      };
    });

    expect(report.eyebrow, JSON.stringify(report)).toMatch(/cocktail of the day/i);
    expect(report.judgesHidden, JSON.stringify(report)).toBe(true);
    expect(report.judgeSeats, JSON.stringify(report)).toBe(0);
    expect(report.guestSrc, JSON.stringify(report)).toMatch(/house-taste/i);
    expect(report.guestVisible, JSON.stringify(report)).toBe(true);
    expect(report.labelHidden, JSON.stringify(report)).toBe(false);
    expect(report.label, JSON.stringify(report)).toMatch(/recipe match/i);
    expect(report.subHidden, JSON.stringify(report)).toBe(true);
    expect(report.quote, JSON.stringify(report)).toMatch(/house/i);
    expect(report.quote, JSON.stringify(report)).toMatch(/that's the one/i);
    expect(Number(report.pct), JSON.stringify(report)).toBe(100);
    expect(report.starOn, JSON.stringify(report)).toBe(3);
    expect(report.itemCount, JSON.stringify(report)).toBe(4);
    expect(report.clipped, JSON.stringify(report)).toBe(0);
    expect(report.exitsOff, JSON.stringify(report)).toBe(false);
  });
});
