const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");
const { seedPlayer, gotoHub, skipIfPortrait } = require("./helpers");

const LEGAL_DIR = path.join(__dirname, "..", "docs", "legal");

async function openCreateProfile(page) {
  await page.goto("/");
  const splashBtn = page.locator("#btn-splash-continue");
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (await page.locator("#modal-profile.is-open").isVisible().catch(() => false)) return;
    if (await splashBtn.isVisible().catch(() => false)) {
      await splashBtn.click({ force: true }).catch(() => {});
    }
    await page.waitForTimeout(100);
  }
  await expect(page.locator("#modal-profile.is-open")).toBeVisible({ timeout: 5_000 });
}

test.describe("privacy notice and public alias", () => {
  test("lawyer review pack is on disk for counsel", async ({}, testInfo) => {
    skipIfPortrait(testInfo);
    const pack = [
      "PRIVACY-NOTICE.md",
      "BETA-TESTER-EMAIL.md",
      "FONTS-NOTE.md",
      "COVER-NOTE.md",
      "lawyer-review.zip",
    ];
    const missing = pack.filter((name) => !fs.existsSync(path.join(LEGAL_DIR, name)));
    expect(missing, missing.join(", ")).toEqual([]);
  });

  test("create-user form requires alias, consent, and links the notice", async ({ page }, testInfo) => {
    skipIfPortrait(testInfo);
    await openCreateProfile(page);
    await expect(page.locator("#pf-alias")).toBeVisible();
    await expect(page.locator("#pf-privacy")).toBeVisible();
    await expect(page.locator("#pf-privacy-link")).toHaveAttribute("href", /legal\/privacy\.html/);

    await page.locator("#pf-name").fill("Alex Private");
    await page.locator("#pf-age").fill("28");
    await page.locator("#btn-profile-save").click();
    await expect(page.locator("#pf-error")).toContainText(/alias/i);

    await page.locator("#pf-alias").fill("A");
    await page.locator("#btn-profile-save").click();
    await expect(page.locator("#pf-error")).toContainText(/2–24|2-24|alias/i);

    await page.locator("#pf-alias").fill("BarAce");
    await page.locator("#btn-profile-save").click();
    await expect(page.locator("#pf-error")).toContainText(/privacy notice/i);

    await page.locator("#pf-privacy").check();
    await page.locator("#btn-profile-save").click();
    await expect(page.locator("#modal-profile.is-open")).toHaveCount(0, { timeout: 10_000 });

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("dagtails_profile") || "null"));
    expect(stored.name).toBe("Alex Private");
    expect(stored.alias).toBe("BarAce");
    expect(stored.privacyConsentAt).toBeGreaterThan(0);
  });

  test("create-user privacy link is reachable and the modal fits the viewport", async ({ page }, testInfo) => {
    skipIfPortrait(testInfo);
    await openCreateProfile(page);

    const href = await page.locator("#pf-privacy-link").getAttribute("href");
    expect(href).toMatch(/legal\/privacy\.html/);
    const notice = await page.request.get(new URL(href, page.url()).href);
    expect(notice.ok(), `privacy notice ${notice.status()}`).toBeTruthy();
    const body = await notice.text();
    expect(body).toMatch(/PLACEHOLDER/i);
    expect(body).toMatch(/property of the operator/i);

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

  test("privacy notice is served and Google Fonts are not requested", async ({ page }, testInfo) => {
    skipIfPortrait(testInfo);
    const googleFonts = [];
    page.on("request", (req) => {
      if (/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(req.url())) googleFonts.push(req.url());
    });
    const home = await page.request.get("/");
    expect(home.ok()).toBeTruthy();
    const html = await home.text();
    expect(html).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/i);

    const res = await page.goto("/legal/privacy.html");
    expect(res && res.ok()).toBeTruthy();
    await expect(page.locator("h1")).toContainText(/Privacy notice/i);
    await expect(page.locator("body")).toContainText(/property of the operator/i);
    await expect(page.locator("body")).toContainText(/PLACEHOLDER/i);

    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);
    expect(googleFonts, googleFonts.join("\n")).toEqual([]);
  });

  test("Inter and Bebas Neue are self-hosted", async ({ page }, testInfo) => {
    skipIfPortrait(testInfo);
    const remoteFonts = [];
    page.on("request", (req) => {
      const url = req.url();
      if (/\.(woff2?|ttf|otf)(\?|$)/i.test(url) && /googleapis|gstatic|fonts\.google/i.test(url)) {
        remoteFonts.push(url);
      }
    });
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      const names = [...document.fonts].map((f) => String(f.family || "").replace(/['"]/g, "").toLowerCase());
      return {
        names: [...new Set(names)],
        inter: names.some((n) => n.includes("inter")),
        bebas: names.some((n) => n.includes("bebas")),
      };
    });
    expect(fonts.inter, JSON.stringify(fonts)).toBe(true);
    expect(fonts.bebas, JSON.stringify(fonts)).toBe(true);
    expect(remoteFonts, remoteFonts.join("\n")).toEqual([]);
  });

  test("hub shows the private name; Settings shows the public alias", async ({ page }, testInfo) => {
    skipIfPortrait(testInfo);
    await seedPlayer(page, {
      cleared: 0,
      profile: { name: "Alex Private", alias: "BarAce" },
    });
    await gotoHub(page);
    const chip = page.locator("#profile-chip");
    await expect(chip).toContainText("Alex Private");
    await expect(chip).not.toContainText("BarAce");

    await page.locator("#btn-settings").click({ force: true });
    await expect(page.locator("#screen-settings.is-active")).toBeVisible();
    await expect(page.locator("#set-account-who")).toContainText("Alex Private");
    await expect(page.locator("#set-account-who")).toContainText(/public\s+BarAce/i);
  });

  test("edit profile prefills alias and keeps the notice checkbox", async ({ page }, testInfo) => {
    skipIfPortrait(testInfo);
    await seedPlayer(page, {
      cleared: 0,
      profile: { name: "Alex Private", alias: "BarAce", privacyConsentAt: 1 },
    });
    await gotoHub(page);
    await page.locator("#btn-edit-profile").click({ force: true });
    await expect(page.locator("#modal-profile.is-open")).toBeVisible();
    await expect(page.locator("#pf-name")).toHaveValue("Alex Private");
    await expect(page.locator("#pf-alias")).toHaveValue("BarAce");
    await expect(page.locator("#pf-privacy")).toBeChecked();
  });

  test("legacy profiles without alias or consent must finish create-user", async ({ page }, testInfo) => {
    skipIfPortrait(testInfo);
    await seedPlayer(page, {
      cleared: 0,
      profile: { name: "Old Name", alias: "", privacyConsentAt: 0 },
    });
    await page.goto("/");
    const splashBtn = page.locator("#btn-splash-continue");
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      if (await page.locator("#modal-profile.is-open").isVisible().catch(() => false)) break;
      if (await splashBtn.isVisible().catch(() => false)) {
        await splashBtn.click({ force: true }).catch(() => {});
      }
      await page.waitForTimeout(100);
    }
    await expect(page.locator("#modal-profile.is-open")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("#pf-name")).toHaveValue("Old Name");
    await expect(page.locator("#pf-alias")).toHaveValue("");
    await expect(page.locator("#btn-profile-close")).toBeHidden();

    await page.locator("#pf-alias").fill("OldAlias");
    await page.locator("#pf-privacy").check();
    await page.locator("#btn-profile-save").click();
    await expect(page.locator("#modal-profile.is-open")).toHaveCount(0, { timeout: 10_000 });
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("dagtails_profile") || "null"));
    expect(stored.name).toBe("Old Name");
    expect(stored.alias).toBe("OldAlias");
    expect(stored.privacyConsentAt).toBeGreaterThan(0);
  });

  test("beta door requires privacy consent before sending a code", async ({ page }, testInfo) => {
    skipIfPortrait(testInfo);
    await page.goto("/?betaLock=1");
    await expect(page.locator("#screen-beta.is-active")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#beta-privacy")).toBeVisible();
    await expect(page.locator("#beta-privacy-link")).toHaveAttribute("href", /legal\/privacy\.html/);
    const href = await page.locator("#beta-privacy-link").getAttribute("href");
    const notice = await page.request.get(new URL(href, page.url()).href);
    expect(notice.ok()).toBeTruthy();

    await page.locator("#beta-email").fill("tester@example.com");
    await page.locator("#beta-send").click();
    await expect(page.locator("#beta-error")).toContainText(/privacy notice/i);
    await expect(page.locator("#beta-step-email")).toBeVisible();
    await expect(page.locator("#beta-step-code")).toBeHidden();
  });
});
