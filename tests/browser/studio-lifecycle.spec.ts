import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import seed from "../../src/data/catalog.json";
import { THREE_D_SUPPORTED_TYPES } from "../../src/types/catalog";

test.use({
  launchOptions: {
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  },
});

async function trackContexts(page: Page) {
  await page.addInitScript(() => {
    // Keep test references to every context so garbage collection cannot
    // accidentally hide a missing explicit context release.
    const contexts = new Set<WebGLRenderingContext | WebGL2RenderingContext>();
    const stats = {
      get created() {
        return contexts.size;
      },
      get lost() {
        return [...contexts].filter((context) => context.isContextLost())
          .length;
      },
      get active() {
        return [...contexts].filter((context) => !context.isContextLost())
          .length;
      },
    };
    Object.assign(window, { __webglStats: stats });
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      value: function (kind: string, ...args: unknown[]) {
        const context = Reflect.apply(original, this, [kind, ...args]);
        if (context && kind.includes("webgl")) contexts.add(context);
        return context;
      },
    });
  });
}

test("3D failures for multiple pieces remain remembered without another initialization attempt", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let attempts = 0;
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(window, "__webglAttempts", { get: () => attempts });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      value: function (kind: string, ...args: unknown[]) {
        if (kind.includes("webgl")) {
          attempts++;
          return null;
        }
        return Reflect.apply(original, this, [kind, ...args]);
      },
    });
  });
  await page.goto("/studio?collection=legna");
  await page
    .getByRole("button", { name: "Illustrative 3D", exact: true })
    .click();
  const detail = page.getByRole("button", { name: "Detail view", exact: true });
  await expect(detail).toHaveAttribute("aria-pressed", "true");
  await page
    .getByLabel("The piece", { exact: true })
    .selectOption("legna:LE-107");
  await expect(detail).toHaveAttribute("aria-pressed", "true");
  const attempts = await page.evaluate(
    () => (window as unknown as { __webglAttempts: number }).__webglAttempts,
  );
  for (const id of ["legna:LE-106", "legna:LE-107", "legna:LE-106"]) {
    await page.getByLabel("The piece", { exact: true }).selectOption(id);
    await expect(detail).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("img", { name: /source photograph/ }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { __webglAttempts: number }).__webglAttempts,
      ),
    ).toBe(attempts);
  }
});

test("missing cutouts are cropped on dark tables and in downloads while native silhouettes stay intact", async ({
  page,
}) => {
  const legna = seed.collections.find(
    (collection) => collection.id === "legna",
  )!;
  const items = seed.items
    .filter((item) => item.collectionId === "legna")
    .map((item) => ({ ...item, studioImage: undefined }));
  await page.route("**/api/catalog?collection=legna", (route) =>
    route.fulfill({ json: { collection: legna, items } }),
  );
  await page.goto("/studio");
  await expect(page.locator(".scene-plate")).not.toHaveClass(
    /scene-plate--fallback/,
  );
  await expect(page.locator(".scene-plate")).toHaveCSS("clip-path", "none");
  await page.getByLabel("Collection", { exact: true }).selectOption("legna");
  await page.getByRole("button", { name: "Black linen", exact: true }).click();
  await page.getByRole("button", { name: "No food", exact: true }).click();
  await expect(page.locator(".scene-plate")).toHaveClass(
    /scene-plate--fallback/,
  );
  await expect(page.locator(".scene-plate")).toHaveCSS(
    "clip-path",
    /circle\(48\.5%/,
  );
  await expect(
    page.getByText("Source photo crop · Cutout unavailable"),
  ).toBeVisible();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download tabletop image" }).click();
  const path = (await (await pending).path())!;
  const { data, info } = await sharp(await readFile(path))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixel = (x: number, y: number) => [
    ...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3),
  ];
  expect(pixel(240, 240)).toEqual([39, 40, 36]); // Outside the circle: tabletop, not a white photo corner.
  expect(pixel(700, 700).some((channel) => channel > 120)).toBe(true);
});

test("switching 22 pieces releases WebGL contexts and stays interactive", async ({
  page,
}) => {
  test.setTimeout(60000);
  await trackContexts(page);
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (/too many active WebGL contexts/i.test(message.text()))
      warnings.push(message.text());
  });
  await page.goto("/studio?collection=mars");
  await page
    .getByRole("button", { name: "Illustrative 3D", exact: true })
    .click();
  const pieces = seed.items
    .filter(
      (item) =>
        item.collectionId === "mars" && THREE_D_SUPPORTED_TYPES.has(item.type),
    )
    .slice(0, 22);
  expect(pieces).toHaveLength(22);
  for (const piece of pieces) {
    await page.getByLabel("The piece", { exact: true }).selectOption(piece.id);
    await expect(page.locator(".scene-caption")).toContainText(piece.sku);
    await expect(page.locator(".three-view canvas")).toHaveCount(1);
    await expect
      .poll(async () =>
        page.evaluate(
          () =>
            (window as unknown as { __webglStats: { active: number } })
              .__webglStats.active,
        ),
      )
      .toBe(1);
  }
  await page.getByRole("button", { name: "Tabletop", exact: true }).click();
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          (window as unknown as { __webglStats: { active: number } })
            .__webglStats.active,
      ),
    )
    .toBe(0);
  const stats = await page.evaluate(
    () =>
      (window as unknown as { __webglStats: { created: number; lost: number } })
        .__webglStats,
  );
  expect(stats.created).toBeGreaterThanOrEqual(22);
  expect(stats.lost).toBe(stats.created);
  expect(warnings).toEqual([]);
  await expect(page.getByRole("button", { name: /Food layer/ })).toBeVisible();
});

test("a partial 3D setup failure releases the context before showing the source photo", async ({
  page,
}) => {
  await trackContexts(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, "ResizeObserver", {
      value: class {
        constructor() {
          throw Error("Simulated observer initialization failure");
        }
      },
    });
  });
  await page.goto("/studio?collection=legna");
  await page
    .getByRole("button", { name: "Illustrative 3D", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Detail view", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".three-view canvas")).toHaveCount(0);
  const stats = await page.evaluate(
    () =>
      (
        window as unknown as {
          __webglStats: { created: number; lost: number; active: number };
        }
      ).__webglStats,
  );
  expect(stats.created).toBe(1);
  expect(stats.lost).toBe(1);
  expect(stats.active).toBe(0);
  await expect(
    page.getByRole("img", { name: "Legna LE-106 source photograph" }),
  ).toBeVisible();
});
