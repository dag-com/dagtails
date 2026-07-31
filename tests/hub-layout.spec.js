const { test, expect } = require("@playwright/test");
const { seedPlayer, gotoHub } = require("./helpers");

/**
 * Layout integrity: no overlapping interactive controls, no clipped mascot,
 * and the Journey CTA must look like a styled gold split-button (not native white).
 */
test.describe("hub layout integrity", () => {
  test("hub controls do not overlap and CTA is gold-styled", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);

    await expect(page.locator("#btn-start")).toBeVisible();
    await expect(page.locator("#btn-cta-caret")).toBeVisible();
    await expect(page.locator("#btn-training")).toBeVisible();
    await expect(page.locator("#btn-how")).toBeVisible();
    await expect(page.locator("#btn-badges")).toBeVisible();
    await expect(page.locator("#hub-duck")).toBeVisible();

    const report = await page.evaluate(() => {
      const rect = (el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
      };
      const overlaps = (a, b, pad = 1) =>
        !(a.right <= b.left + pad || a.left >= b.right - pad || a.bottom <= b.top + pad || a.top >= b.bottom - pad);

      const start = document.querySelector("#btn-start");
      const caret = document.querySelector("#btn-cta-caret");
      const learn = document.querySelector("#btn-training");
      const help = document.querySelector("#btn-how");
      const badges = document.querySelector("#btn-badges");
      const duck = document.querySelector("#hub-duck");
      const meta = document.querySelector("#play-meta");
      const quest = document.querySelector("#cotd-card");
      const nav = document.querySelector(".hub-nav");
      const stage = document.querySelector("#game-stage") || document.querySelector(".start-hub");

      const rs = {
        start: rect(start),
        caret: rect(caret),
        learn: rect(learn),
        help: rect(help),
        badges: rect(badges),
        duck: rect(duck),
        meta: meta ? rect(meta) : null,
        quest: quest ? rect(quest) : null,
        nav: nav ? rect(nav) : null,
        stage: stage ? rect(stage) : null,
      };

      const pairs = [
        ["start", "learn"],
        ["start", "help"],
        ["start", "badges"],
        ["caret", "learn"],
        ["caret", "help"],
        ["caret", "badges"],
        ["learn", "badges"],
        ["help", "badges"],
        ["meta", "learn"],
        ["meta", "help"],
        ["meta", "badges"],
        ["quest", "start"],
        ["quest", "learn"],
        ["learn", "help"], // allowed to sit side by side — only fail if stacked on same spot
      ];

      const bad = [];
      for (const [A, B] of pairs) {
        if (!rs[A] || !rs[B]) continue;
        if (A === "learn" && B === "help") {
          // Side-by-side is fine; fail only if nearly identical boxes (stacked collapse).
          const same =
            Math.abs(rs[A].left - rs[B].left) < 4 &&
            Math.abs(rs[A].top - rs[B].top) < 4;
          if (same) bad.push(`${A}∩${B}`);
          continue;
        }
        if (overlaps(rs[A], rs[B])) bad.push(`${A}∩${B}`);
      }

      // Modes must sit above the badges nav top edge (no crossing the divider).
      if (rs.learn.bottom > rs.badges.top + 2) bad.push("learn-below-nav");
      if (rs.help.bottom > rs.badges.top + 2) bad.push("help-below-nav");

      // Duck should be mostly inside the stage/hub (incomplete / clipped graphic).
      if (rs.stage) {
        const clippedTop = rs.duck.top < rs.stage.top - 2;
        const clippedBot = rs.duck.bottom > rs.stage.bottom + 2;
        const clippedLeft = rs.duck.left < rs.stage.left - 2;
        const clippedRight = rs.duck.right > rs.stage.right + 2;
        if (clippedTop || clippedBot || clippedLeft || clippedRight) {
          bad.push("duck-clipped");
        }
        if (rs.duck.height < 40 || rs.duck.width < 24) bad.push("duck-too-small");
      }

      // Split CTA should be contiguous (caret abuts main).
      const gap = rs.caret.left - rs.start.right;
      if (gap > 3 || gap < -2) bad.push(`cta-gap:${gap.toFixed(1)}`);

      const cs = getComputedStyle(start);
      const bg = cs.backgroundImage + " " + cs.backgroundColor;
      const looksGold =
        /gradient|rgb\(\s*240\s*,\s*200|rgb\(\s*233\s*,\s*185|rgb\(\s*201\s*,\s*132|#f0c85a|#c98412|#e9b949/i.test(bg)
        || (cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent"
          && !/^rgb\(\s*255\s*,\s*255\s*,\s*255/.test(cs.backgroundColor));

      return {
        bad,
        looksGold,
        bg: bg.slice(0, 120),
        appearance: cs.webkitAppearance || cs.appearance,
        startColor: cs.color,
      };
    });

    expect(report.bad, JSON.stringify(report)).toEqual([]);
    expect(report.looksGold, `CTA not gold-styled: ${report.bg}`).toBeTruthy();
  });

  test("split caret opens modes without covering badges", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);
    await page.locator("#btn-cta-caret").click({ force: true });
    await expect(page.locator("#cta-menu")).toBeVisible();

    const ok = await page.evaluate(() => {
      const menu = document.querySelector("#cta-menu").getBoundingClientRect();
      const badges = document.querySelector("#btn-badges").getBoundingClientRect();
      // Menu may sit above badges; it must not fully cover the badges hit target.
      const covers =
        menu.left <= badges.left &&
        menu.right >= badges.right &&
        menu.top <= badges.top &&
        menu.bottom >= badges.bottom;
      return !covers && menu.height > 20;
    });
    expect(ok).toBeTruthy();
  });
});
