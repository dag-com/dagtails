const { test, expect } = require("@playwright/test");
const {
  seedPlayer,
  gotoHub,
  openMap,
  enterStation,
  pickIngredients,
  serveDrink,
  skipIfPortrait,
} = require("./helpers");

/**
 * Visibility / overlap / in-bounds / proportions across primary screens.
 */
test.describe("layout integrity", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    skipIfPortrait(testInfo);
    await page.addInitScript(() => {
      window.measureLayout = function measureLayout(selectors, opts = {}) {
        const maxOverlapRatio = opts.maxOverlapRatio ?? 0.2;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const pad = 1;

        const rectOf = (el) => {
          const r = el.getBoundingClientRect();
          return {
            top: r.top,
            left: r.left,
            right: r.right,
            bottom: r.bottom,
            width: r.width,
            height: r.height,
          };
        };

        const area = (r) => Math.max(0, r.width) * Math.max(0, r.height);

        const overlapArea = (a, b) => {
          const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
          const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
          return w * h;
        };

        const inBounds = (r) =>
          r.width >= 2 &&
          r.height >= 2 &&
          r.left >= -2 &&
          r.top >= -2 &&
          r.right <= vw + 2 &&
          r.bottom <= vh + 2;

        const rects = {};
        const missing = [];
        const outOfBounds = [];

        for (const [sel, key] of selectors) {
          const el = document.querySelector(sel);
          if (!el) {
            missing.push(key);
            continue;
          }
          const r = rectOf(el);
          rects[key] = r;
          if (!inBounds(r)) outOfBounds.push(key);
        }

        const overlaps = [];
        for (const [A, B] of opts.pairs || []) {
          const a = rects[A];
          const b = rects[B];
          if (!a || !b) continue;
          const oa = overlapArea(a, b);
          if (oa <= pad) continue;
          const ratio = oa / Math.min(area(a), area(b));
          const sameSpot =
            Math.abs(a.left - b.left) < 4 &&
            Math.abs(a.top - b.top) < 4 &&
            Math.abs(a.width - b.width) < 8;
          if (opts.allowAdjacent) {
            if (sameSpot) overlaps.push(`${A}∩${B}:collapse`);
            continue;
          }
          if (ratio > maxOverlapRatio || sameSpot) {
            overlaps.push(`${A}∩${B}:${(ratio * 100).toFixed(0)}%`);
          }
        }

        return { missing, outOfBounds, overlaps, rects, vw, vh };
      };
    });
  });

  test("hub interactive controls stay in-bounds without critical overlap", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);

    const report = await page.evaluate(() => window.measureLayout([
      ["#btn-start", "start"],
      ["#btn-cta-caret", "caret"],
      ["#btn-training", "learn"],
      ["#btn-how", "help"],
      ["#btn-badges", "badges"],
    ], {
      pairs: [
        ["start", "learn"],
        ["start", "help"],
        ["start", "badges"],
        ["caret", "learn"],
        ["caret", "help"],
        ["caret", "badges"],
        ["learn", "badges"],
        ["help", "badges"],
      ],
      maxOverlapRatio: 0.2,
    }));

    expect(report.missing, JSON.stringify(report)).toEqual([]);
    expect(report.outOfBounds, JSON.stringify(report)).toEqual([]);
    expect(report.overlaps, JSON.stringify(report)).toEqual([]);
  });

  test("map CTA and current venue stay visible in viewport", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);
    await openMap(page);

    const report = await page.evaluate(() => window.measureLayout([
      ["#btn-map-play", "cta"],
      ["#map-hint", "hint"],
      ["#map-hero-title", "current"],
      ["#btn-map-back", "back"],
    ], { pairs: [["cta", "back"]], maxOverlapRatio: 0.25 }));

    expect(report.missing, JSON.stringify(report)).toEqual([]);
    expect(report.outOfBounds, JSON.stringify(report)).toEqual([]);
    expect(report.overlaps, JSON.stringify(report)).toEqual([]);
  });

  test("station chrome: glass proportion, serve in-bounds, catalog reachable", async ({ page }) => {
    // Handhelds included — glass SVG must paint (iOS/Expo 0×0 is a blocker).
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);
    await enterStation(page);

    await page.waitForFunction(() => {
      const g = document.querySelector("#glass-mount .glass-svg, #glass-mount svg");
      return g && g.getBoundingClientRect().height > 20;
    }, null, { timeout: 15_000 });

    const report = await page.evaluate(() => {
      const layout = window.measureLayout([
        ["#btn-next", "serve"],
        ["#btn-quit", "quit"],
        ["#btn-back", "back"],
        ["#order-ticket", "ticket"],
        ["#glass-mount", "glass"],
        ["#game-venue", "venue"],
        ["#stage-pill", "stage"],
      ], {
        pairs: [
          ["serve", "quit"],
          ["serve", "back"],
          ["quit", "back"],
        ],
        maxOverlapRatio: 0.2,
      });

      const svg = document.querySelector("#glass-mount .glass-svg, #glass-mount svg");
      const svgH = svg ? svg.getBoundingClientRect().height : 0;
      const vh = window.innerHeight;
      const svgRatio = svgH / Math.max(1, vh);
      // Vessel should read as a glass, not dominate the short landscape stage.
      const glassOk = svgH >= 36 && svgRatio <= 0.48;

      const body = document.querySelector("#panel-body");
      const items = [...document.querySelectorAll("#ingredient-catalog .cat-item")];
      let reachable = items.length > 0;
      for (const el of items) {
        el.scrollIntoView({ block: "nearest" });
        if (body) {
          const br = body.getBoundingClientRect();
          const er = el.getBoundingClientRect();
          if (er.bottom > br.bottom) body.scrollTop += er.bottom - br.bottom + 8;
          if (er.top < br.top) body.scrollTop -= br.top - er.top + 8;
        }
        const r = el.getBoundingClientRect();
        const br = body ? body.getBoundingClientRect() : { top: 0, bottom: vh, left: 0, right: window.innerWidth };
        const inPanel =
          r.bottom <= br.bottom + 2 &&
          r.top >= br.top - 2 &&
          r.left >= br.left - 2 &&
          r.right <= br.right + 2;
        if (!inPanel) {
          reachable = false;
          break;
        }
      }

      return {
        ...layout,
        glassOk,
        svgH,
        svgRatio,
        reachable,
        panelScroll: body ? body.scrollHeight - body.clientHeight : 0,
        vh,
      };
    });

    expect(report.missing, JSON.stringify(report)).toEqual([]);
    expect(report.outOfBounds, JSON.stringify(report)).toEqual([]);
    expect(report.overlaps, JSON.stringify(report)).toEqual([]);
    expect(report.glassOk, `svg h=${report.svgH} ratio=${report.svgRatio}`).toBe(true);
    expect(report.reachable, JSON.stringify(report)).toBe(true);
  });

  test("result actions stay tappable after serve", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);
    await enterStation(page);
    await pickIngredients(page, ["Gin", "Tonic Water"]);
    await serveDrink(page);

    const report = await page.evaluate(() => window.measureLayout([
      ["#btn-retry", "retry"],
      ["#btn-next-stage", "next"],
      ["#result-name", "name"],
      ["#result-stars", "stars"],
    ], {
      pairs: [["retry", "next"]],
      allowAdjacent: true,
    }));

    expect(report.missing, JSON.stringify(report)).toEqual([]);
    expect(report.outOfBounds, JSON.stringify(report)).toEqual([]);
    expect(report.overlaps, JSON.stringify(report)).toEqual([]);
  });

  test("finish screen keeps Menu and Play again in viewport", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);
    await page.evaluate(() => {
      document.querySelectorAll(".screen").forEach((s) => s.classList.remove("is-active"));
      const fin = document.getElementById("screen-finish");
      fin.classList.add("is-active");
      document.getElementById("finish-score").textContent = "229";
      document.getElementById("finish-rank").textContent = "Still in training · 5/36 stars";
      document.getElementById("finish-best").textContent = "Best score: 229 pts";
    });

    const report = await page.evaluate(() => window.measureLayout([
      ["#btn-replay", "replay"],
      ["#btn-finish-menu", "menu"],
      ["#finish-rank", "rank"],
    ], {
      pairs: [["replay", "menu"]],
      allowAdjacent: true,
    }));

    expect(report.missing, JSON.stringify(report)).toEqual([]);
    expect(report.outOfBounds, JSON.stringify(report)).toEqual([]);
  });

  test("intro comic caption and Next stay in the viewport", async ({ page }) => {
    await seedPlayer(page, { cleared: 0, introSeen: false });
    await gotoHub(page);
    await page.locator("#btn-start").click({ force: true });
    await page.locator("#screen-intro.is-active").waitFor({ state: "visible", timeout: 15_000 });
    await page.waitForFunction(() => {
      const cap = document.querySelector("#comic-caption");
      const next = document.querySelector("#comic-next");
      const skip = document.querySelector("#comic-skip");
      if (!cap || !next || !skip) return false;
      const text = (cap.textContent || "").trim();
      if (text.length < 8) return false;
      const r = cap.getBoundingClientRect();
      const n = next.getBoundingClientRect();
      const s = skip.getBoundingClientRect();
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const visibleH = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      return (
        r.height > 12 &&
        visibleH >= r.height * 0.9 &&
        r.left >= -8 &&
        r.right <= vw + 8 &&
        n.width >= 36 &&
        n.top >= -2 &&
        n.right <= vw + 2 &&
        s.left >= -2 &&
        s.top >= -2 &&
        /skip intro/i.test((skip.textContent || "").trim())
      );
    }, null, { timeout: 10_000 });

    const report = await page.evaluate(() => {
      const cap = document.querySelector("#comic-caption");
      const next = document.querySelector("#comic-next");
      const skip = document.querySelector("#comic-skip");
      const cr = cap.getBoundingClientRect();
      const nr = next.getBoundingClientRect();
      const sr = skip.getBoundingClientRect();
      return {
        text: (cap.textContent || "").trim(),
        skipLabel: (skip.textContent || "").trim(),
        captionH: cr.height,
        captionTop: cr.top,
        captionBottom: cr.bottom,
        nextTop: nr.top,
        nextRight: nr.right,
        skipLeft: sr.left,
        skipTop: sr.top,
        nextIsCircle: Math.abs(nr.width - nr.height) < 8,
        vw: window.innerWidth,
        vh: window.innerHeight,
      };
    });

    expect(report.text.length, JSON.stringify(report)).toBeGreaterThan(8);
    expect(report.captionH, JSON.stringify(report)).toBeGreaterThan(12);
    expect(report.captionTop, JSON.stringify(report)).toBeGreaterThanOrEqual(-8);
    expect(report.captionBottom, JSON.stringify(report)).toBeLessThanOrEqual(report.vh + 8);
    expect(report.skipLabel, JSON.stringify(report)).toMatch(/skip intro/i);
    expect(report.skipLeft, JSON.stringify(report)).toBeGreaterThanOrEqual(-2);
    expect(report.nextRight, JSON.stringify(report)).toBeLessThanOrEqual(report.vw + 2);
    expect(report.nextIsCircle, JSON.stringify(report)).toBe(true);
    expect(report.nextTop, JSON.stringify(report)).toBeLessThan(report.vh * 0.35);
  });

  test("mix result keeps last flavor bar and Make another in viewport", async ({ page }) => {
    await seedPlayer(page, { cleared: 5 });
    await gotoHub(page);
    await page.evaluate(() => {
      document.body.classList.add("is-phone-play");
      document.body.classList.remove("mix-result-legacy");
      const dbg = document.getElementById("debug-toolbar");
      if (dbg) dbg.style.display = "none";
      document.querySelectorAll(".screen").forEach((s) => s.classList.remove("is-active"));
      const mix = document.getElementById("screen-mix-result");
      mix.classList.add("is-active");
      document.getElementById("flavor-bars").innerHTML = ["Strong", "Sweet", "Sour", "Bitter", "Fizz"]
        .map((l) => `<div class="fbar-row"><span class="fbar-label">${l}</span><div class="fbar-track"><div class="fbar-fill" style="width:40%"></div></div></div>`)
        .join("");
      document.getElementById("judges-panel").innerHTML = `<div class="judge-scene is-mix-ux">${
        ["Otto", "Freya", "Tommy"].map((n) =>
          `<article class="judge-seat is-in"><div class="judge-avatar-wrap"><div class="judge-portrait"></div><span class="judge-avatar-name">${n}</span></div></article>`
        ).join("")
      }</div>`;
    });

    const report = await page.evaluate(() => window.measureLayout([
      [".fbar-row:last-child", "fizz"],
      ["#btn-mix-another", "another"],
      ["#judges-panel .judge-portrait", "portrait"],
      ["#btn-mix-tweak", "tweak"],
      ["#btn-mix-save", "save"],
      ["#btn-mix-shop", "shop"],
      ["#btn-mix-share", "share"],
      ["#btn-recipes", "recipes"],
      ["#btn-mybar", "mybar"],
      ["#mix-name", "title"],
      ["#mix-lounge", "lounge"],
    ], {
      pairs: [
        ["another", "save"],
        ["tweak", "save"],
        ["save", "shop"],
        ["shop", "share"],
        ["share", "another"],
        ["recipes", "mybar"],
        ["title", "lounge"],
      ],
      allowAdjacent: true,
    }));

    expect(report.missing, JSON.stringify(report)).toEqual([]);
    expect(report.outOfBounds, JSON.stringify(report)).toEqual([]);

    const scale = await page.evaluate(() => {
      const ports = [...document.querySelectorAll("#judges-panel .judge-portrait")];
      const seats = [...document.querySelectorAll("#judges-panel .judge-seat")];
      const w = ports[0] ? ports[0].getBoundingClientRect().width : 0;
      const gaps = [];
      for (let i = 0; i < seats.length - 1; i++) {
        const a = seats[i].getBoundingClientRect();
        const b = seats[i + 1].getBoundingClientRect();
        gaps.push(b.left - a.right);
      }
      return {
        w,
        maxGap: gaps.length ? Math.max(...gaps) : 0,
        vw: window.innerWidth,
        vh: window.innerHeight,
      };
    });
    if (scale.vw >= 860 && scale.vh >= 410) {
      expect(scale.w, JSON.stringify(scale)).toBeGreaterThanOrEqual(130);
      expect(scale.maxGap, JSON.stringify(scale)).toBeLessThanOrEqual(40);
    } else {
      expect(scale.w, JSON.stringify(scale)).toBeGreaterThanOrEqual(60);
      expect(scale.w, JSON.stringify(scale)).toBeLessThanOrEqual(96);
    }
  });
});
