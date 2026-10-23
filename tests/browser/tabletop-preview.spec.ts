import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

async function snapshot(page: Page) {
  await expect(page.locator(".tabletop-canvas")).toHaveAttribute(
    "data-ready",
    "true",
  );
  return page
    .locator(".tabletop-canvas")
    .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL("image/png"));
}

test("tabletop and download match after placement changes on every material", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/studio");
  const canvas = page.locator(".tabletop-canvas");
  await snapshot(page);
  await expect(page.locator(".scene-plate")).toHaveCSS("opacity", "0");
  const sceneBox = await page.locator(".studio-scene").boundingBox();
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).toEqual(sceneBox);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);

  const materials = new Set<string>();
  for (const surface of [
    "Warm oak",
    "Dark stone",
    "White linen",
    "Black linen",
    "Light stone",
  ]) {
    await page.getByRole("button", { name: surface, exact: true }).click();
    await page.getByLabel("Portion", { exact: true }).fill("1.25");
    await page.getByLabel("Rotation", { exact: true }).fill("38");
    await page.getByRole("button", { name: /Food layer/ }).press("ArrowRight");
    await snapshot(page);
    // Export deliberately redraws the latest placement before capturing.
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download tabletop image" }).click();
    const downloaded = await readFile((await (await pending).path())!);
    const visible = Buffer.from((await snapshot(page)).split(",")[1], "base64");
    const { data, info } = await sharp(downloaded)
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([1400, 1400]);
    expect(data.equals(await sharp(visible).raw().toBuffer())).toBe(true);
    materials.add(data.subarray(0, 3).toString("hex"));
  }
  expect(materials.size).toBe(5);
});

test("a late food image cannot replace the latest selection", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/food/vegetables-v2.webp", async (route) => {
    await gate;
    await route.fulfill({
      path: "public/food/vegetables-v2.webp",
      contentType: "image/webp",
    });
  });
  await page.goto("/studio");
  await snapshot(page);
  const requested = page.waitForRequest("**/food/vegetables-v2.webp");
  await page.getByRole("button", { name: "Vegetables", exact: true }).click();
  await requested;
  await expect(
    page.getByRole("button", { name: "Download tabletop image" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Small plates", exact: true }).click();
  const latest = await snapshot(page);
  const response = page.waitForResponse("**/food/vegetables-v2.webp");
  release();
  await (await response).finished();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(await snapshot(page)).toBe(latest);
  await expect(page.locator(".scene-food img")).toHaveAttribute(
    "src",
    "/food/toast-v2.webp",
  );
});

test("failed images disable export and another food selection recovers", async ({
  page,
}) => {
  await page.route("**/food/vegetables-v2.webp", (route) => route.abort());
  await page.goto("/studio");
  await snapshot(page);
  await page.getByRole("button", { name: "Vegetables", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Preview image unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download tabletop image" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Small plates", exact: true }).click();
  await snapshot(page);
  await expect(
    page.getByRole("button", { name: "Download tabletop image" }),
  ).toBeEnabled();
  await expect(page.locator(".tabletop-load-error")).toHaveCount(0);
});

test("LE-711 loads its detailed SKU photograph and exports the same scene", async ({
  page,
}) => {
  const externalImages: string[] = [];
  page.on("request", (request) => {
    if (
      request.resourceType() === "image" &&
      request.url().includes("yancochina")
    )
      externalImages.push(request.url());
  });
  await page.goto(
    "/studio?collection=legna&item=legna%3ALE-711&layout=1&surface=dark&food=vegetables",
  );
  await snapshot(page);
  const photo = page.locator(".scene-plate img");
  await expect(photo).toHaveAttribute(
    "src",
    "/catalog/studio-photo-legna-le-711.webp",
  );
  expect(
    await photo.evaluate((image: HTMLImageElement) => image.naturalWidth),
  ).toBeGreaterThanOrEqual(1200);
  await expect(page.getByLabel("The piece", { exact: true })).toHaveValue(
    "legna:LE-711",
  );
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download tabletop image" }).click();
  const downloaded = await readFile((await (await pending).path())!);
  const visible = Buffer.from((await snapshot(page)).split(",")[1], "base64");
  expect(
    (await sharp(downloaded).raw().toBuffer()).equals(
      await sharp(visible).raw().toBuffer(),
    ),
  ).toBe(true);
  expect(externalImages).toEqual([]);
});
