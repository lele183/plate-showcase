import { test, expect, type Locator } from "@playwright/test";

test("featured Legna label opens collection details by pointer and keyboard", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const label = page.getByRole("button", {
    name: "Explore Legna collection",
    exact: true,
  });
  if (testInfo.project.name === "phone") await label.tap();
  else await label.click();
  const collection = page.getByRole("dialog", { name: "Legna", exact: true });
  await expect(collection).toBeVisible();
  await expect(
    collection.getByRole("heading", { name: "Legna", exact: true }),
  ).toBeVisible();
  await expect(collection.locator(".item-grid article").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(label).toBeFocused();
  await label.press("Enter");
  await expect(collection).toBeVisible();
});

async function expectCentered(dialog: Locator) {
  const bounds = await dialog.evaluate((element) => {
    const rectangle = element.getBoundingClientRect();
    return {
      horizontalOffset: Math.abs(
        rectangle.left + rectangle.width / 2 - window.innerWidth / 2,
      ),
      verticalOffset: Math.abs(
        rectangle.top + rectangle.height / 2 - window.innerHeight / 2,
      ),
      top: rectangle.top,
      bottom: rectangle.bottom,
      viewportHeight: window.innerHeight,
    };
  });
  expect(bounds.horizontalOffset).toBeLessThan(2);
  expect(bounds.verticalOffset).toBeLessThan(2);
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight);
}

test("auth and collection popups stay centered on wide and small screens", async ({
  page,
}, testInfo) => {
  const sizes = [
    page.viewportSize()!,
    testInfo.project.name === "desktop"
      ? { width: 2320, height: 1220 }
      : { width: 390, height: 480 },
  ];
  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.goto("/");
    await page.locator("footer").scrollIntoViewIfNeeded();
    await page
      .locator("header")
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    const auth = page.getByRole("dialog", { name: "Welcome to the table." });
    await expect(auth).toBeVisible();
    await expectCentered(auth);
    await page.keyboard.press("Escape");
    await expect(auth).not.toBeVisible();
    await page
      .getByRole("button", { name: "Explore ABCO", exact: true })
      .click();
    const collection = page.getByRole("dialog", { name: "ABCO", exact: true });
    await expect(
      collection.locator(".item-grid article").first(),
    ).toBeVisible();
    await expectCentered(collection);
    await page.keyboard.press("Escape");
  }
});

test("idea presets fill all quick answers and preserve expert settings and edits", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Expert mode", exact: true }).click();
  await page
    .getByLabel("Material preference", { exact: true })
    .fill("melamine");
  await page.getByLabel("Dinnerware color", { exact: true }).fill("black");
  await page.getByRole("button", { name: "Quick select", exact: true }).click();
  const concept = page.getByPlaceholder(
    "An Italian trattoria, a modern bistro…",
  );
  const tabletop = page.getByPlaceholder(
    "Warm oak tables, white linen, dark stone…",
  );
  const theme = page.getByPlaceholder(
    "Earthy greens, soft neutrals, bold blue…",
  );
  for (const [label, cuisine] of [
    ["An Italian trattoria", /Italian/],
    ["A modern bistro", /bistro/],
    ["Coastal & Mediterranean", /Greek/],
  ] as const) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(concept).toHaveValue(cuisine);
    await expect(tabletop).toHaveValue(/\S+/);
    await expect(theme).toHaveValue(/\S+/);
  }
  const chosenTheme = await theme.inputValue();
  await tabletop.fill("Custom walnut tables");
  await page.reload();
  await expect(concept).toHaveValue(/Greek/);
  await expect(tabletop).toHaveValue("Custom walnut tables");
  await expect(theme).toHaveValue(chosenTheme);
  await page.getByRole("button", { name: "Expert mode", exact: true }).click();
  await expect(
    page.getByLabel("Material preference", { exact: true }),
  ).toHaveValue("melamine");
  await expect(
    page.getByLabel("Dinnerware color", { exact: true }),
  ).toHaveValue("black");
  const submitted = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/recommendations") &&
      request.method() === "POST",
  );
  await page
    .getByRole("button", { name: "Find my collections", exact: true })
    .click();
  expect((await submitted).postDataJSON()).toMatchObject({
    concept: expect.stringMatching(/Greek/),
    tabletop: "Custom walnut tables",
    theme: chosenTheme,
    material: "melamine",
    color: "black",
  });
});
