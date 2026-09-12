const { test, expect } = require("@playwright/test");
const { seedPlayer, gotoHub, skipIfPortrait } = require("./helpers");

test.describe("beta gate", () => {
  test("unlocked local boot still reaches the hub", async ({ page }, testInfo) => {
    skipIfPortrait(testInfo);
    await seedPlayer(page, { cleared: 0 });
    await gotoHub(page);
    await expect(page.locator("#screen-start.is-active")).toBeVisible();
    await expect(page.locator("#screen-beta.is-active")).toHaveCount(0);
  });

  test("?betaLock=1 shows the invite door and not the hub", async ({ page }, testInfo) => {
    skipIfPortrait(testInfo);
    await page.goto("/?betaLock=1");
    await expect(page.locator("#screen-beta.is-active")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("html")).toHaveClass(/is-beta-lock/);
    await expect(page.locator("#beta-email")).toBeVisible();
    await expect(page.locator("#screen-start.is-active")).toHaveCount(0);
    await expect(page.locator("#btn-splash-continue")).toBeHidden();
  });

  test("after OTP verify, is-beta-lock is cleared so splash is visible", async ({ page }, testInfo) => {
    skipIfPortrait(testInfo);

    await page.route(/\/auth\/v1\//, async (route) => {
      const req = route.request();
      const url = req.url();
      const method = req.method();
      if (method === "GET" && /\/user(\?|$)/.test(url)) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ id: "u_test", email: "tester@example.com" }),
        });
      }
      if (method === "GET" && /session|user/i.test(url)) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ access_token: null, user: null }),
        });
      }
      // OTP send (signInWithOtp)
      if (method === "POST" && /\/otp(\?|$)/.test(url)) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ messageId: "mock" }),
        });
      }
      // OTP verify
      if (method === "POST" && /\/verify(\?|$)/.test(url)) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            access_token: "eyJhbGciOiJub25lIn0.test",
            token_type: "bearer",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            refresh_token: "refresh_test",
            user: {
              id: "u_test",
              aud: "authenticated",
              role: "authenticated",
              email: "tester@example.com",
              app_metadata: { provider: "email" },
              user_metadata: {},
            },
          }),
        });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    await page.route(/\/rest\/v1\/rpc\/beta_access_ok/, async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "true",
      });
    });

    await page.goto("/?betaLock=1");
    await expect(page.locator("#screen-beta.is-active")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("html")).toHaveClass(/is-beta-lock/);

    await page.locator("#beta-privacy").check();
    await page.locator("#beta-email").fill("tester@example.com");
    await page.locator("#beta-send").click();
    await expect(page.locator("#beta-step-code")).toBeVisible({ timeout: 15_000 });

    await page.locator("#beta-code").fill("123456");
    await page.locator("#beta-verify").click();

    await expect(page.locator("html")).not.toHaveClass(/is-beta-lock/, { timeout: 15_000 });
    await expect(page.locator("#screen-splash.is-active")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#btn-splash-continue")).toBeVisible();
  });

  test("magic-link callback params admit an invited session and clear the lock", async ({ page }, testInfo) => {
    skipIfPortrait(testInfo);

    await page.route(/\/auth\/v1\//, async (route) => {
      const req = route.request();
      const url = req.url();
      const method = req.method();
      const post = String(req.postData() || "");
      if (method === "POST" && (/\/token/.test(url) || /grant_type=pkce/.test(post) || post.includes("code"))) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            access_token: "eyJhbGciOiJub25lIn0.test",
            token_type: "bearer",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            refresh_token: "refresh_test",
            user: {
              id: "u_link",
              aud: "authenticated",
              role: "authenticated",
              email: "tester@example.com",
              app_metadata: { provider: "email" },
              user_metadata: {},
            },
          }),
        });
      }
      if (method === "GET" && /\/user(\?|$)/.test(url)) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ id: "u_link", email: "tester@example.com" }),
        });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    await page.route(/\/rest\/v1\/rpc\/beta_access_ok/, async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "true",
      });
    });

    await page.goto("/?betaLock=1&code=mock-auth-code");
    await expect(page.locator("html")).not.toHaveClass(/is-beta-lock/, { timeout: 20_000 });
    await expect(page.locator("#screen-splash.is-active")).toBeVisible({ timeout: 20_000 });
    await expect(page).not.toHaveURL(/[?&]code=/);
  });
});
