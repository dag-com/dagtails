const { test, expect } = require("@playwright/test");

function operatorUser(email) {
  return {
    id: "u_operator",
    aud: "authenticated",
    role: "authenticated",
    email,
    app_metadata: { provider: "email" },
    user_metadata: {},
  };
}

function sessionBody(email) {
  return {
    access_token: "eyJhbGciOiJub25lIn0.test",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "refresh_test",
    user: operatorUser(email),
  };
}

async function mockAuth(page, email) {
  await page.route(/\/auth\/v1\//, async (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();
    if (method === "POST" && /\/otp(\?|$)/.test(url)) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ messageId: "mock" }),
      });
    }
    if (method === "POST" && /\/verify(\?|$)/.test(url)) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(sessionBody(email)),
      });
    }
    if (method === "GET" && /\/user(\?|$)/.test(url)) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(operatorUser(email)),
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
}

test.describe("operator todo", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "pc", "desktop check");
  });

  test("shows the email door", async ({ page }) => {
    await page.goto("/admin/todo/");
    await expect(page.locator("h1")).toHaveText("Todo");
    await expect(page.locator("#todo-email")).toBeVisible();
    await expect(page.locator("#todo-board")).toBeHidden();
  });

  test("refuses a signed-in tester who is not an operator", async ({ page }) => {
    await mockAuth(page, "tester@example.com");
    await page.route(/\/rest\/v1\/rpc\/beta_access_ok/, async (route) => {
      return route.fulfill({ status: 200, contentType: "application/json", body: "true" });
    });
    await page.route(/\/rest\/v1\/rpc\/beta_preview_ok/, async (route) => {
      return route.fulfill({ status: 200, contentType: "application/json", body: "false" });
    });
    await page.route(/\/rest\/v1\/rpc\/admin_todo_ok/, async (route) => {
      return route.fulfill({ status: 200, contentType: "application/json", body: "false" });
    });

    await page.goto("/admin/todo/");
    await page.locator("#todo-email").fill("tester@example.com");
    await page.locator("#todo-send").click();
    await expect(page.locator("#todo-code")).toBeVisible();
    await page.locator("#todo-code").fill("123456");
    await page.locator("#todo-verify").click();
    await expect(page.locator("#todo-error")).toContainText("Only Danny and Atar");
    await expect(page.locator("#todo-board")).toBeHidden();
  });

  test("an operator can add and complete a task", async ({ page }) => {
    const items = [];
    await mockAuth(page, "operator@example.com");
    await page.route(/\/rest\/v1\/rpc\/beta_access_ok/, async (route) => {
      return route.fulfill({ status: 200, contentType: "application/json", body: "true" });
    });
    await page.route(/\/rest\/v1\/rpc\/beta_preview_ok/, async (route) => {
      return route.fulfill({ status: 200, contentType: "application/json", body: "true" });
    });
    await page.route(/\/rest\/v1\/rpc\/admin_todo_ok/, async (route) => {
      return route.fulfill({ status: 200, contentType: "application/json", body: "true" });
    });
    await page.route(/\/rest\/v1\/admin_todos/, async (route) => {
      const req = route.request();
      const method = req.method();
      if (method === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(items),
        });
      }
      if (method === "POST") {
        const body = req.postDataJSON();
        const row = {
          id: "11111111-1111-4111-8111-111111111111",
          title: body.title,
          done: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        items.push(row);
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(row),
        });
      }
      if (method === "PATCH") {
        const body = req.postDataJSON();
        items[0] = { ...items[0], ...body };
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(items[0]),
        });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });

    await page.goto("/admin/todo/");
    await page.locator("#todo-email").fill("operator@example.com");
    await page.locator("#todo-send").click();
    await page.locator("#todo-code").fill("123456");
    await page.locator("#todo-verify").click();
    await expect(page.locator("#todo-board")).toBeVisible();
    await expect(page.locator("#todo-who")).toContainText("operator@example.com");
    await page.locator("#todo-title").fill("Stock citrus");
    await page.locator("#todo-add").click();
    await expect(page.locator("#todo-list .title")).toHaveText("Stock citrus");
    await page.locator("#todo-list input[type=checkbox]").check();
    await expect(page.locator("#todo-list .item")).toHaveClass(/is-done/);
  });
});
