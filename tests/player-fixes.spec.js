const { test, expect } = require("@playwright/test");
const {
  seedPlayer,
  gotoHub,
  enterStation,
  openMap,
  openMixologistPour,
  mixChip,
  skipIfPortrait,
} = require("./helpers");

test.describe("player-reported regressions", () => {
  test.beforeEach(({}, testInfo) => skipIfPortrait(testInfo));

  test("intro Skip/Next match, caption stays on-screen, no tap-to-continue, no page scroll", async ({ page }) => {
    await seedPlayer(page, { cleared: 0, introSeen: false });
    await gotoHub(page);
    await page.locator("#btn-start").click({ force: true });
    await page.locator("#screen-intro.is-active").waitFor({ state: "visible", timeout: 15_000 });

    const report = await page.evaluate(() => {
      const skip = document.querySelector("#comic-skip");
      const next = document.querySelector("#comic-next");
      const cap = document.querySelector("#comic-caption");
      const body = document.body.innerText || "";
      const sr = skip.getBoundingClientRect();
      const nr = next.getBoundingClientRect();
      const cr = cap.getBoundingClientRect();
      const doc = document.documentElement;
      return {
        skipLabel: (skip.textContent || "").trim(),
        skipH: sr.height,
        nextH: nr.height,
        nextRound: Math.abs(nr.width - nr.height) < 8,
        tapContinue: /tap to continue/i.test(body),
        captionOnScreen:
          cr.height > 12 &&
          cr.top >= -8 &&
          cr.bottom <= window.innerHeight + 8,
        vScroll: doc.scrollHeight > doc.clientHeight + 2,
      };
    });

    expect(report.skipLabel).toMatch(/skip intro/i);
    expect(Math.abs(report.skipH - report.nextH), JSON.stringify(report)).toBeLessThanOrEqual(4);
    expect(report.nextRound).toBe(true);
    expect(report.tapContinue).toBe(false);
    expect(report.captionOnScreen).toBe(true);
    expect(report.vScroll).toBe(false);
  });

  test("profile Welcome-to-the-bar dialog fits the viewport", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);
    await page.locator("#btn-edit-profile").click({ force: true });
    await page.locator("#modal-profile.is-open").waitFor({ state: "visible", timeout: 10_000 });

    const report = await page.evaluate(() => {
      const box = document.querySelector("#modal-profile .profile-modal-box");
      const r = box.getBoundingClientRect();
      return {
        top: r.top,
        bottom: r.bottom,
        left: r.left,
        right: r.right,
        height: r.height,
        vw: window.innerWidth,
        vh: window.innerHeight,
      };
    });

    expect(report.height, JSON.stringify(report)).toBeGreaterThan(40);
    expect(report.top, JSON.stringify(report)).toBeGreaterThanOrEqual(-4);
    expect(report.bottom, JSON.stringify(report)).toBeLessThanOrEqual(report.vh + 4);
    expect(report.left, JSON.stringify(report)).toBeGreaterThanOrEqual(-4);
    expect(report.right, JSON.stringify(report)).toBeLessThanOrEqual(report.vw + 4);
  });

  test("station ticket says Flip, not TAP", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);
    await enterStation(page);
    const hint = page.locator(".ticket-flip-hint").first();
    await expect(hint).toBeVisible();
    await expect(hint).toContainText(/flip/i);
    await expect(hint).not.toContainText(/tap/i);
  });

  test("hub does not page-scroll; Learn/Help stay above Badges", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);
    const report = await page.evaluate(() => {
      const doc = document.documentElement;
      const learn = document.querySelector("#btn-training").getBoundingClientRect();
      const help = document.querySelector("#btn-how").getBoundingClientRect();
      const badges = document.querySelector("#btn-badges").getBoundingClientRect();
      return {
        vScroll: doc.scrollHeight > doc.clientHeight + 2,
        hScroll: doc.scrollWidth > doc.clientWidth + 2,
        learnAbove: learn.bottom <= badges.top + 2,
        helpAbove: help.bottom <= badges.top + 2,
      };
    });
    expect(report.vScroll, JSON.stringify(report)).toBe(false);
    expect(report.hScroll, JSON.stringify(report)).toBe(false);
    expect(report.learnAbove).toBe(true);
    expect(report.helpAbove).toBe(true);
  });

  test("hub venue photo follows the current stop, not always The Snug", async ({ page }) => {
    await seedPlayer(page, { cleared: 16 });
    await gotoHub(page);
    const css = await page.evaluate(() => {
      const bg = document.querySelector(".hub-shell .hero-bg");
      return bg ? getComputedStyle(bg).backgroundImage : "";
    });
    expect(css).toMatch(/aperitivo/i);
    expect(css).not.toMatch(/snug/i);
  });

  test("mix result keeps judges on screen without document scroll", async ({ page }) => {
    await seedPlayer(page, { cleared: 5 });
    await gotoHub(page);
    await page.evaluate(() => {
      document.body.classList.add("is-phone-play");
      document.body.classList.remove("mix-result-legacy");
      document.querySelectorAll(".screen").forEach((s) => s.classList.remove("is-active"));
      document.getElementById("screen-mix-result").classList.add("is-active");
      document.getElementById("judges-panel").innerHTML = `<div class="judge-scene is-mix-ux">${
        ["Otto", "Freya", "Tommy"].map((n) =>
          `<article class="judge-seat is-in"><div class="judge-avatar-wrap"><div class="judge-portrait"></div><span class="judge-avatar-name">${n}</span></div></article>`
        ).join("")
      }</div>`;
    });

    const report = await page.evaluate(() => {
      const panel = document.querySelector("#judges-panel");
      const another = document.querySelector("#btn-mix-another");
      const pr = panel.getBoundingClientRect();
      const ar = another.getBoundingClientRect();
      const doc = document.documentElement;
      return {
        panelH: pr.height,
        anotherBottom: ar.bottom,
        vScroll: doc.scrollHeight > doc.clientHeight + 2,
        vh: window.innerHeight,
      };
    });

    expect(report.panelH, JSON.stringify(report)).toBeGreaterThan(40);
    expect(report.anotherBottom, JSON.stringify(report)).toBeLessThanOrEqual(report.vh + 4);
    expect(report.vScroll, JSON.stringify(report)).toBe(false);
  });

  test("map current stop pulses; discs are stars not white glasses", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);
    await openMap(page);
    await page.locator("#btn-map-play").click({ force: true });
    await page.locator("#map-path:not([hidden])").waitFor({ state: "visible", timeout: 10_000 });

    await expect(page.locator(".map-node-glass")).toHaveCount(0);
    await expect(page.locator(".map-node-star")).toHaveCount(9);
    const pulse = await page.evaluate(() => {
      const cur = document.querySelector(".map-node.is-current");
      if (!cur) return { name: "", reduced: false };
      return {
        name: getComputedStyle(cur).animationName || "",
        reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      };
    });
    if (!pulse.reduced) expect(pulse.name).toMatch(/mapNodePulse/i);
  });

  test("editing pour chip grows sideways only, same height as idle", async ({ page }) => {
    await seedPlayer(page, { cleared: 5 });
    await gotoHub(page);
    await openMixologistPour(page);

    const vodka = mixChip(page, "Vodka");
    const gin = mixChip(page, "Gin");
    const before = await vodka.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { h: r.height, w: r.width };
    });
    await gin.click();
    await expect(gin).toHaveClass(/is-editing/);

    const after = await gin.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const cat = document.querySelector("#ingredient-catalog");
      const cr = cat.getBoundingClientRect();
      return {
        h: r.height,
        w: r.width,
        catW: cr.width,
        hasMinus: !!el.querySelector(".cat-item-step:not(.is-plus)"),
        hasPlus: !!el.querySelector(".cat-item-step.is-plus"),
        hasRemove: !!el.querySelector(".cat-item-remove"),
        bg: getComputedStyle(el).backgroundColor,
      };
    });

    expect(after.hasMinus).toBe(true);
    expect(after.hasPlus).toBe(true);
    expect(after.hasRemove).toBe(true);
    expect(after.w, JSON.stringify({ before, after })).toBeGreaterThan(before.w + 24);
    expect(after.w, JSON.stringify({ before, after })).toBeLessThan(after.catW * 0.98);
    expect(Math.abs(after.h - before.h), JSON.stringify({ before, after })).toBeLessThanOrEqual(8);

    await vodka.click();
    const collapsed = await gin.evaluate((el) => ({
      bg: getComputedStyle(el).backgroundColor,
      editing: el.classList.contains("is-editing"),
    }));
    expect(collapsed.editing).toBe(false);
    expect(collapsed.bg).toBe(after.bg);
  });
});
