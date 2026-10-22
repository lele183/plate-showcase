import { test, expect } from "@playwright/test";

test("the selector works when browser storage writes are blocked", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "yanco-brief" || key === "yanco-studio-auth-draft")
        throw new DOMException("Storage is full", "QuotaExceededError");
      setItem.call(this, key, value);
    };
  });
  await page.goto("/");
  await page
    .getByPlaceholder("An Italian trattoria, a modern bistro…")
    .fill("Neighborhood bistro");
  await page.getByRole("button", { name: "Find my collections" }).click();
  await expect(
    page.getByRole("heading", { name: "Your table, thoughtfully matched." }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "could not save" }),
  ).toBeVisible();
  await page.goto("/studio");
  await page.getByRole("button", { name: "Generate food preview" }).click();
  await expect(
    page.getByRole("dialog", { name: "Welcome to the table." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("malformed stored fields do not crash the selector", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "yanco-brief",
      JSON.stringify({
        concept: { text: "bad" },
        foods: 42,
        theme: "Sage green",
      }),
    );
  });
  await page.goto("/");
  await expect(
    page.getByPlaceholder("An Italian trattoria, a modern bistro…"),
  ).toHaveValue("");
  await expect(
    page.getByPlaceholder("Earthy greens, soft neutrals, bold blue…"),
  ).toHaveValue("Sage green");
  await page.getByRole("button", { name: "Find my collections" }).click();
  await expect(
    page.getByRole("heading", { name: "Your table, thoughtfully matched." }),
  ).toBeVisible();
});

test("catalog search reports server errors and retries the same query", async ({
  page,
}) => {
  let failing = true;
  await page.route("**/api/catalog?q=Legna", (route) =>
    failing
      ? route.fulfill({ status: 503, json: { error: "Service unavailable" } })
      : route.continue(),
  );
  await page.goto("/catalog");
  await page
    .getByRole("searchbox", { name: "Search collections and SKUs" })
    .fill("Legna");
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Unable to search",
  );
  await expect(
    page.getByText("No collections match these filters."),
  ).not.toBeVisible();
  failing = false;
  await page.getByRole("button", { name: "Retry search" }).click();
  await expect(page.locator(".all-collections article")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: /^Explore Legna:/ }),
  ).toBeVisible();
  await expect(page.locator("main").getByRole("alert")).not.toBeVisible();
});

test("a failed collection request can recover inside the open dialog", async ({
  page,
}) => {
  let failing = true;
  await page.route("**/api/catalog?collection=legna", (route) =>
    failing
      ? route.fulfill({ status: 503, json: { error: "Service unavailable" } })
      : route.continue(),
  );
  await page.goto("/");
  const trigger = page.getByRole("button", {
    name: "Explore Legna collection",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Legna", exact: true });
  await expect(dialog.getByRole("alert")).toContainText(
    "Unable to load pieces",
  );
  failing = false;
  await dialog.getByRole("button", { name: "Retry loading pieces" }).click();
  await expect(dialog.locator(".item-grid article").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("bad requests and missing collections return actionable HTTP statuses", async ({
  request,
  baseURL,
}) => {
  for (const body of ["{broken", "null", "[]"]) {
    const response = await request.post("/api/recommendations", {
      headers: { "Content-Type": "application/json" },
      data: body,
    });
    expect(response.status()).toBe(400);
  }
  for (const origin of [
    "null",
    "invalid-origin",
    baseURL!.replace("http:", "https:"),
  ]) {
    const response = await request.post("/api/recommendations", {
      headers: { Origin: origin },
      data: {},
    });
    expect(response.status()).toBe(403);
  }
  const missing = await request.get("/api/catalog?collection=does-not-exist");
  expect(missing.status()).toBe(404);
  await expect(missing.json()).resolves.toMatchObject({
    error: "Collection not found.",
  });
});

test("search metadata, private response headers, and missing pages are usable", async ({
  request,
  page,
}) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Disallow: /workspace");
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain("/catalog</loc>");
  const privateResponse = await request.get("/api/scenes");
  expect(privateResponse.headers()["cache-control"]).toContain("no-store");
  expect(privateResponse.headers()["x-content-type-options"]).toBe("nosniff");
  await page.goto("/catalog?q=Legna");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/catalog$/,
  );
  await page.goto("/workspace");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  const missing = await page.goto("/this-page-does-not-exist");
  expect(missing?.status()).toBe(404);
  await expect(
    page.getByRole("heading", {
      name: "Let us find you a place at the table.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Explore the collection", exact: true }),
  ).toBeVisible();
});

test("sign-in dialogs lock background scrolling and restore focus", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page
    .locator("header")
    .getByRole("button", { name: "Sign in", exact: true });
  await trigger.click();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
});
