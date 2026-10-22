import { test, expect } from "@playwright/test";
test("anonymous selector preserves mode answers and enforces constraints", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByPlaceholder("An Italian trattoria, a modern bistro…")
    .fill("Modern bistro");
  await page.getByRole("button", { name: "Expert mode", exact: true }).click();
  await page.getByPlaceholder("Porcelain, china, melamine…").fill("melamine");
  await page
    .getByPlaceholder("American White, Super White, blue…")
    .fill("black");
  await page.getByRole("button", { name: "Quick select", exact: true }).click();
  await expect(
    page.getByPlaceholder("An Italian trattoria, a modern bistro…"),
  ).toHaveValue("Modern bistro");
  await page.getByRole("button", { name: "Find my collections" }).click();
  await expect(
    page.getByRole("heading", { name: "Your table, thoughtfully matched." }),
  ).toBeVisible();
  await expect(page.locator(".interpreted")).toContainText("melamine");
  for (const grid of await page.locator(".collection-grid").all())
    await expect(grid).toContainText("melamine");
  for (const card of await page.locator(".collection-card").all()) {
    await expect(card.locator(".matched-pieces")).toContainText(
      "Matching pieces:",
    );
    await expect(card.locator(".collection-photo img")).toHaveAttribute(
      "alt",
      /black/,
    );
    await expect(
      card.getByRole("link", { name: /^Try on your table:/ }),
    ).toHaveAttribute("href", /&item=/);
  }
});
test("full catalog search opens correct source details", async ({ page }) => {
  await page.goto("/catalog");
  await page
    .getByPlaceholder("Search a collection, piece, or item number…")
    .fill("MR-710");
  await expect(page.locator(".all-collections")).toContainText("Mars");
  await expect(page.locator(".all-collections article")).toHaveCount(1);
  await page
    .locator(".all-collections")
    .getByRole("button", { name: /^Explore Mars:/ })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByPlaceholder("SKU, bowl, plate, capacity…").fill("MR-710");
  await expect(page.getByRole("dialog")).toContainText("10 1/4");
  await expect(
    page
      .getByRole("dialog")
      .getByRole("link", { name: /Verify specifications/ }),
  ).toHaveAttribute("href", /page=10/);
});
test("printed discrepancies link both sources and studio uses a cutout", async ({
  page,
}) => {
  await page.goto("/catalog");
  await page
    .getByPlaceholder("Search a collection, piece, or item number…")
    .fill("Milestone");
  await page.getByRole("button", { name: /^Explore Milestone:/ }).click();
  const dialog = page.getByRole("dialog");
  await page.getByPlaceholder("SKU, bowl, plate, capacity…").fill("MS-710BU");
  await expect(dialog).toContainText(/confirm diameter/i);
  await expect(
    dialog.getByRole("link", { name: /Compare printed specification/ }),
  ).toHaveAttribute("href", /page=157/);
  await dialog.getByRole("link", { name: "Preview this piece" }).click();
  await expect(page.locator(".scene-plate img")).toHaveAttribute(
    "src",
    /\/catalog\/studio-/,
  );
});
test("studio supports keyboard placement, export, and authenticated feature gates", async ({
  page,
}) => {
  await page.goto("/studio");
  await page.getByRole("button", { name: "Dark stone", exact: true }).click();
  const food = page.getByRole("button", { name: /Food layer/ });
  await food.focus();
  await food.press("ArrowRight");
  await expect(food).toHaveCSS("left", /px/);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download tabletop image" }).click();
  expect((await download).suggestedFilename()).toMatch(/yanco-.*\.png/);
  await expect(
    page.getByRole("button", { name: "Generate food preview" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Upload your dish" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
test("3D falls back to the verified photograph when WebGL is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      value: function (kind: string, ...args: unknown[]) {
        return kind.includes("webgl")
          ? null
          : Reflect.apply(original, this, [kind, ...args]);
      },
    });
  });
  await page.goto("/studio");
  await page
    .getByRole("button", { name: "Illustrative 3D", exact: true })
    .click();
  await expect(
    page.getByText("Static source preview · 3D is unavailable in this browser"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Detail view", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("img", { name: "Mars MR-710 source photograph" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tabletop", exact: true }).click();
  await expect(page.getByRole("button", { name: /Food layer/ })).toBeVisible();
});
test("private routes reject anonymous requests", async ({ request }) => {
  for (const path of [
    "/api/uploads",
    "/api/scenes",
    "/api/jobs",
    "/api/catalogs",
  ]) {
    const r =
      path === "/api/uploads"
        ? await request.post(path, { data: {} })
        : await request.get(path);
    expect(r.status(), path).toBe(401);
  }
});
test("phone and desktop avoid horizontal overflow", async ({ page }) => {
  for (const path of ["/", "/catalog", "/studio", "/workspace"]) {
    await page.goto(path);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      path,
    ).toBe(true);
  }
});
