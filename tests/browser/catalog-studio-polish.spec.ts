import { test, expect } from "@playwright/test";
import { open } from "node:fs/promises";
import sharp from "sharp";
import seed from "../../src/data/catalog.json";

test.use({
  launchOptions: {
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  },
});

test("catalog header and footer download a valid PDF", async ({
  page,
  request,
}) => {
  const response = await request.head("/catalog/yanco-2026.pdf");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  await page.goto("/catalog");
  for (const label of ["Download the catalog", "View the full catalog"]) {
    const link = page.getByRole("link", { name: label });
    const pending = page.waitForEvent("download");
    await link.click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe("Yanco-2026-Catalog.pdf");
    const file = await open((await download.path())!);
    try {
      const signature = Buffer.alloc(5);
      await file.read(signature, 0, 5, 0);
      expect(signature.toString()).toBe("%PDF-");
    } finally {
      await file.close();
    }
  }
  await expect(page).toHaveURL(/\/catalog$/);
});

test("announcement navigates from every page by pointer and keyboard", async ({
  page,
}, testInfo) => {
  for (const route of ["/", "/catalog", "/studio", "/workspace"]) {
    await page.goto(route);
    const banner = page.getByRole("link", {
      name: /Thoughtfully selected\. Beautifully served\./,
    });
    if (route === "/workspace") {
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("link", { name: "Skip to content" }),
      ).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(banner).toBeFocused();
      await banner.press("Enter");
    } else if (testInfo.project.name === "phone") {
      await banner.tap();
    } else {
      await banner.click();
    }
    await expect(page).toHaveURL(/\/catalog$/);
    await expect(
      page.getByRole("heading", { name: "A world of possibilities." }),
    ).toBeVisible();
  }
});

test("unsupported pieces use an accurate detail label and preserve the tabletop scene", async ({
  page,
}) => {
  const cup = seed.items.find(
    (item) => item.collectionId === "legna" && item.type === "cup",
  )!;
  await page.goto(
    `/studio?collection=legna&item=${encodeURIComponent(cup.id)}`,
  );
  await page.getByRole("button", { name: "Black linen", exact: true }).click();
  const food = page.getByRole("button", { name: /Food layer/ });
  await food.press("ArrowRight");
  const position = await food.evaluate(
    (element) => (element as HTMLElement).style.left,
  );
  await page.getByRole("button", { name: "Detail view", exact: true }).click();
  await expect(
    page.getByText(
      "Source photograph · 3D geometry is available for plates, trays and bowls",
    ),
  ).toBeVisible();
  await expect(page.locator(".three-view canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "Tabletop", exact: true }).click();
  await expect(page.locator(".studio-scene")).toHaveClass(/surface-black/);
  expect(
    await food.evaluate((element) => (element as HTMLElement).style.left),
  ).toBe(position);
  await page
    .getByLabel("The piece", { exact: true })
    .selectOption("legna:LE-106");
  await expect(
    page.getByRole("button", { name: "Illustrative 3D", exact: true }),
  ).toBeVisible();
});

test("supported plate renders an angled model that responds to rotation", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/studio?collection=legna");
  await page
    .getByRole("button", { name: "Illustrative 3D", exact: true })
    .click();
  const canvas = page.locator(".three-view canvas");
  await expect(canvas).toBeVisible();
  await expect(page.locator(".three-view")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await canvas.scrollIntoViewIfNeeded();
  await expect(
    page.getByText("Drag to rotate · Pinch to zoom · Illustrative geometry"),
  ).toBeVisible();
  const bounds = (await canvas.boundingBox())!;
  const viewport = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
  }));
  const firstScreenshot = await page.screenshot();
  const metadata = await sharp(firstScreenshot).metadata();
  const pixelRatio = metadata.width! / viewport.width;
  const visibleHeight = Math.min(
    viewport.height,
    metadata.height! / pixelRatio,
  );
  const visibleTop = Math.max(bounds.y + 120, 140) + 10;
  const visibleBottom = Math.min(bounds.y + bounds.height, visibleHeight) - 10;
  const pointerY = (visibleTop + visibleBottom) / 2;
  const crop = {
    left: Math.round(bounds.x * pixelRatio),
    top: Math.round(visibleTop * pixelRatio),
    width: Math.floor(bounds.width * pixelRatio),
    height: Math.floor((visibleBottom - visibleTop) * pixelRatio),
  };
  const before = await sharp(firstScreenshot).extract(crop).png().toBuffer();
  expect(
    await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.tagName,
      { x: bounds.x + bounds.width * 0.4, y: pointerY },
    ),
  ).toBe("CANVAS");
  await page.mouse.move(bounds.x + bounds.width * 0.4, pointerY);
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width * 0.7,
    Math.min(visibleBottom, pointerY + 30),
    { steps: 12 },
  );
  await page.mouse.up();
  await expect
    .poll(
      async () =>
        (
          await sharp(await page.screenshot())
            .extract(crop)
            .png()
            .toBuffer()
        ).equals(before),
      { timeout: 20000 },
    )
    .toBe(false);
  await expect(
    page.getByRole("button", { name: "Illustrative 3D", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
