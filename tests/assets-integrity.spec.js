const { test, expect } = require("@playwright/test");
const { seedPlayer, gotoHub, skipIfPortrait } = require("./helpers");

const RUNTIME_PATHS = [
  "assets/venues/interiors/snug.png",
  "assets/venues/interiors/zavod.png",
  "assets/comic/comic1.png",
  "assets/customers/mallard_petite.png",
  "assets/judges/vera.png",
  "assets/judges/house-taste.png",
  "assets/station/bar-stage.png",
  "assets/duck-hub-mascot.png",
  "assets/brand/dag-tails-logo.png",
  "assets/shop/jigger.svg",
];

test.describe("asset integrity", () => {
  test.beforeEach(async ({}, testInfo) => {
    skipIfPortrait(testInfo);
  });

  test("copied game assets are reachable from the page origin", async ({ page, baseURL }) => {
    const origin = new URL(baseURL);
    if (!origin.pathname.endsWith("/")) origin.pathname += "/";
    const misses = [];
    for (const rel of RUNTIME_PATHS) {
      const url = new URL(rel, origin).href;
      const res = await page.request.get(url);
      if (!res.ok()) misses.push({ rel, url, status: res.status() });
    }
    expect(misses, JSON.stringify(misses)).toEqual([]);
  });

  test("hub venue photo uses an absolute URL that loads", async ({ page }) => {
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);

    const report = await page.evaluate(async () => {
      const screen = document.getElementById("screen-start");
      const bg = document.querySelector(".hub-shell .hero-bg");
      const css = bg ? getComputedStyle(bg).backgroundImage : "";
      const urls = [...css.matchAll(/url\((["']?)([^"')]+)\1\)/g)].map((m) => m[2]);
      const fetched = [];
      for (const u of urls) {
        if (!u || u.startsWith("data:")) continue;
        try {
          const r = await fetch(u);
          fetched.push({ u, ok: r.ok, status: r.status });
        } catch (e) {
          fetched.push({ u, ok: false, error: String(e) });
        }
      }
      return {
        hasVenue: !!screen?.classList.contains("has-venue-bg"),
        css,
        urls,
        fetched,
      };
    });

    expect(report.hasVenue, JSON.stringify(report)).toBe(true);
    const interior = report.fetched.find((x) => /interiors\//i.test(x.u));
    expect(interior, JSON.stringify(report)).toBeTruthy();
    expect(interior.ok, JSON.stringify(report)).toBe(true);
    expect(interior.u, JSON.stringify(report)).toMatch(/^https?:\/\//i);
  });

  test("splash logo is rewritten to an absolute URL that loads", async ({ page }) => {
    await page.goto("/");
    const report = await page.evaluate(async () => {
      const img = document.querySelector(".brand-logo--splash");
      const src = img && (img.currentSrc || img.src);
      let fetched = null;
      if (src && !src.startsWith("data:")) {
        try {
          const r = await fetch(src);
          fetched = { src, ok: r.ok, status: r.status };
        } catch (e) {
          fetched = { src, ok: false, error: String(e) };
        }
      }
      return { src, fetched };
    });
    expect(report.src, JSON.stringify(report)).toMatch(/^https?:\/\//i);
    expect(report.fetched?.ok, JSON.stringify(report)).toBe(true);
  });

  test("resolveAssetUrl keeps assets in the game directory when the slash is dropped", async ({ page }) => {
    await page.goto("/");
    const report = await page.evaluate(() => {
      const resolve = window.__dagtailsResolveAssetUrl;
      const rel = "assets/venues/interiors/snug.png";
      const live = typeof resolve === "function" ? resolve(rel) : "";
      function baseHrefFrom(href) {
        const u = new URL(href);
        const last = u.pathname.split("/").pop() || "";
        const looksLikeFile = /\.[a-z0-9]+$/i.test(last);
        if (!looksLikeFile && !u.pathname.endsWith("/")) u.pathname += "/";
        u.search = "";
        u.hash = "";
        return u.href;
      }
      const expoDoc = "https://dag-com.github.io/dagtails?v=expo";
      const naive = new URL(rel, expoDoc).href;
      const fixed = new URL(rel, baseHrefFrom(expoDoc)).href;
      return { live, naive, fixed };
    });
    expect(report.live, JSON.stringify(report)).toMatch(/^https?:\/\//i);
    expect(report.live).toMatch(/\/assets\/venues\/interiors\/snug\.png$/i);
    expect(report.naive).toBe("https://dag-com.github.io/assets/venues/interiors/snug.png");
    expect(report.fixed).toBe(
      "https://dag-com.github.io/dagtails/assets/venues/interiors/snug.png"
    );
    const res = await page.request.get(report.live);
    expect(res.ok(), report.live).toBe(true);
  });
});
