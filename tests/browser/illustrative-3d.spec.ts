import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

test.setTimeout(60000);

test.use({
  launchOptions: {
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  },
});

async function open3D(page: Page, query = "") {
  await page.goto(`/studio?view=3d${query}`);
  await expect(page.locator(".three-view")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 20000 },
  );
  await expect(
    page.getByRole("button", { name: "Download 3D image" }),
  ).toBeEnabled();
}

test("camera presets, keyboard orbit, dimensions and zoom work on the rendered model", async ({
  page,
}, testInfo) => {
  await open3D(page);
  const canvas = page.locator(".three-view canvas");
  const before = await canvas.screenshot();
  await page
    .getByRole("button", { name: "Overhead view", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Overhead view" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(async () => (await canvas.screenshot()).equals(before))
    .toBe(false);
  await page.getByRole("button", { name: "Side view", exact: true }).click();
  await page.getByRole("button", { name: "Show catalog dimensions" }).click();
  await expect(
    page.getByText("10 1/4 in × 1 in high", { exact: true }),
  ).toBeVisible();
  await canvas.focus();
  await canvas.press("ArrowLeft");
  await expect(page.getByRole("button", { name: "Side view" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await canvas.press("+");
  await canvas.press("0");
  await expect(
    page.getByRole("button", { name: "Perspective view" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.getByRole("button", { name: "Auto rotate" }).click();
  await expect(
    page.getByRole("button", { name: "Auto rotate" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Reset 3D view" }).click();
  await expect(
    page.getByRole("button", { name: "Auto rotate" }),
  ).toHaveAttribute("aria-pressed", "false");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator(".studio-scene-shell").screenshot({
    path: testInfo.outputPath("illustrative-3d.png"),
  });
});

test("food and tabletop changes update the existing scene and export the current 3D view", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let created = 0;
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(window, "__createdContexts", { get: () => created });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      value: function (kind: string, ...args: unknown[]) {
        const result = Reflect.apply(original, this, [kind, ...args]);
        if (result && kind.includes("webgl")) created++;
        return result;
      },
    });
  });
  await open3D(page);
  const count = () =>
    page.evaluate(
      () =>
        (window as unknown as { __createdContexts: number }).__createdContexts,
    );
  const initialContexts = await count();
  await page
    .getByRole("button", { name: "Overhead view", exact: true })
    .click();
  const before = await page.locator(".three-view canvas").screenshot();
  await page.getByRole("button", { name: "Black linen", exact: true }).click();
  await page.getByRole("button", { name: "Vegetables", exact: true }).click();
  await page
    .getByRole("slider", { name: "Left / right", exact: true })
    .fill("12");
  await page
    .getByRole("slider", { name: "Near / far", exact: true })
    .fill("-8");
  await page.getByRole("slider", { name: "Portion", exact: true }).fill("1.25");
  await page
    .getByRole("button", { name: "Studio lighting", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Overhead view" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(async () =>
      (await page.locator(".three-view canvas").screenshot()).equals(before),
    )
    .toBe(false);
  expect(await count()).toBe(initialContexts);
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download 3D image", exact: true })
    .click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("yanco-mars-3d.png");
  const buffer = await readFile((await download.path())!);
  const image = sharp(buffer);
  expect((await image.metadata()).width).toBe(1600);
  const stats = await image.stats();
  expect(stats.channels.some((channel) => channel.stdev > 20)).toBe(true);
  await page.getByRole("button", { name: "Tabletop", exact: true }).click();
  await expect(page.locator(".studio-scene")).toHaveClass(/surface-black/);
  const placement = await page
    .getByRole("button", { name: /Food layer/ })
    .evaluate((element) => ({
      left: (element as HTMLElement).style.left,
      top: (element as HTMLElement).style.top,
    }));
  expect(placement).toEqual({ left: "62%", top: "42%" });
});

test("bowls and cups load hollow Blender profiles with source photographs available", async ({
  page,
}, testInfo) => {
  const modelRequest = page.waitForResponse(
    "**/models/dinnerware/bowl-round.glb",
  );
  await open3D(page, "&collection=legna&item=legna%3ALE-308&food=none");
  expect((await modelRequest).ok()).toBe(true);
  await page.getByRole("button", { name: "Side view", exact: true }).click();
  await expect(page.locator(".scene-caption")).toContainText("LE-308");
  await expect(page.locator(".three-view")).toHaveAttribute(
    "data-surface",
    "glaze",
  );
  await page
    .getByRole("button", { name: "Overhead view", exact: true })
    .click();
  await page.locator(".three-view").screenshot({
    path: testInfo.outputPath("bowl-well.png"),
  });
  await page
    .getByLabel("The piece", { exact: true })
    .selectOption("legna:LE-012");
  await expect(page.locator(".three-view")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(page.locator(".three-view")).toHaveAttribute(
    "data-model-family",
    "mug",
  );
  await expect(page.locator(".three-view")).toHaveAttribute(
    "data-surface",
    "glaze",
  );
  await page.getByRole("button", { name: "Show source photograph" }).click();
  await expect(
    page.getByRole("img", { name: "Legna LE-012 source photograph" }),
  ).toBeVisible();
  await page
    .locator(".studio-scene-shell")
    .screenshot({ path: testInfo.outputPath("cup-preview.png") });
});

test("a lost WebGL context releases the renderer and offers the source photograph", async ({
  page,
}) => {
  await open3D(page);
  await page.locator(".three-view canvas").evaluate((element) => {
    const context = (element as HTMLCanvasElement).getContext("webgl2");
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  });
  await expect(
    page.getByRole("button", { name: "Detail view", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".three-view canvas")).toHaveCount(0);
  await expect(
    page.getByRole("img", { name: "Mars MR-710 source photograph" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tabletop", exact: true }).click();
  await expect(page.getByRole("button", { name: /Food layer/ })).toBeVisible();
});

test("AS-001 opens as hollow transparent glassware and exports its 3D camera", async ({
  page,
}, testInfo) => {
  const requested = page.waitForResponse(
    "**/models/dinnerware/glass-as-001.glb",
  );
  await open3D(
    page,
    "&collection=aqua-spirits&item=aqua-spirits%3AAS-001&layout=1&food=none",
  );
  expect((await requested).ok()).toBe(true);
  const viewer = page.locator(".three-view");
  await expect(viewer).toHaveAttribute("data-model-family", "glass");
  await expect(viewer).toHaveAttribute("data-surface", "glass");
  await expect(viewer).toHaveAttribute("data-food", "none");
  await expect(page.locator(".scene-caption")).toContainText(
    "Illustrative glassware",
  );
  await page.getByRole("button", { name: "Side view", exact: true }).click();
  await page.getByRole("button", { name: "Show catalog dimensions" }).click();
  await expect(
    page.getByText("1 3/8 in × 2 5/8 in high", { exact: true }),
  ).toBeVisible();
  await viewer.screenshot({ path: testInfo.outputPath("shot-glass-side.png") });
  await page
    .getByRole("button", { name: "Overhead view", exact: true })
    .click();
  await viewer.screenshot({ path: testInfo.outputPath("shot-glass-well.png") });
  await page
    .getByRole("button", { name: "Perspective view", exact: true })
    .click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download 3D image" }).click();
  const download = await pending;
  const image = sharp(await readFile((await download.path())!));
  expect((await image.metadata()).width).toBe(1600);
  expect(
    (await image.stats()).channels.some((channel) => channel.stdev > 10),
  ).toBe(true);
});

test("stemmed wine, martini and flute glasses load their own silhouettes and remain framed", async ({
  page,
}, testInfo) => {
  await open3D(page, "&collection=aqua-spirits&item=aqua-spirits%3AAS-111");
  for (const sku of ["AS-111", "AS-508", "AS-406"]) {
    await page
      .getByLabel("The piece", { exact: true })
      .selectOption(`aqua-spirits:${sku}`);
    await expect(page.locator(".three-view")).toHaveAttribute(
      "data-ready",
      "true",
      { timeout: 20000 },
    );
    await expect(page.locator(".three-view")).toHaveAttribute(
      "data-surface",
      "glass",
    );
    await page.getByRole("button", { name: "Side view", exact: true }).click();
    await page.locator(".three-view").screenshot({
      path: testInfo.outputPath(`${sku.toLowerCase()}-profile.png`),
    });
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("model download failures fall back and failed food layers can be replaced", async ({
  page,
}) => {
  await page.route("**/food/salmon-v2.webp", (route) => route.abort());
  await open3D(page, "&food=salmon");
  await expect(
    page.getByText(
      "The food image could not load. Choose another food layer to try again.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Vegetables", exact: true }).click();
  await expect(
    page.getByText(
      "The food image could not load. Choose another food layer to try again.",
    ),
  ).not.toBeVisible();
  await expect(page.locator(".three-view")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.route("**/models/dinnerware/*.glb", (route) =>
    route.fulfill({ status: 503, body: "" }),
  );
  await page
    .getByLabel("The piece", { exact: true })
    .selectOption("mars:MR-508");
  await expect(
    page.getByRole("button", { name: "Detail view", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("img", { name: "Mars MR-508 source photograph" }),
  ).toBeVisible();
});

test("3D starts without food, while explicitly chosen food survives view switches and reloads", async ({
  page,
}) => {
  const foodRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/food/")) foodRequests.push(request.url());
  });
  await open3D(page);
  await expect(
    page.getByRole("button", { name: "No food", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".three-view")).toHaveAttribute(
    "data-food",
    "none",
  );
  expect(foodRequests).toEqual([]);
  await page.getByRole("button", { name: "Tabletop", exact: true }).click();
  await expect(page.getByRole("button", { name: /Food layer/ })).toBeVisible();
  await page
    .getByRole("button", { name: "Illustrative 3D", exact: true })
    .click();
  await expect(page.locator(".three-view")).toHaveAttribute(
    "data-food",
    "none",
  );
  await page.getByRole("button", { name: "Vegetables", exact: true }).click();
  await page.getByRole("button", { name: "Tabletop", exact: true }).click();
  await page
    .getByRole("button", { name: "Illustrative 3D", exact: true })
    .click();
  await expect(page.locator(".three-view")).toHaveAttribute(
    "data-food",
    "vegetables",
  );
  await page.reload();
  await expect(page.locator(".three-view")).toHaveAttribute(
    "data-food",
    "vegetables",
  );
  await page.getByRole("button", { name: "No food", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Tabletop", exact: true }).click();
  await expect(page.getByRole("button", { name: /Food layer/ })).toHaveCount(0);
});

test("compartment pieces have raised dividers and cup recesses rather than projected photographs", async ({
  page,
}, testInfo) => {
  await open3D(page, "&collection=compartment&item=compartment%3ANC-510I");
  const viewer = page.locator(".three-view");
  await expect(viewer).toHaveAttribute("data-divider-layout", "three-curved");
  await expect(viewer).toHaveAttribute("data-surface", "glaze");
  await page.getByRole("button", { name: "Show source photograph" }).click();
  await expect(
    page.getByRole("img", { name: "Compartment NC-510I source photograph" }),
  ).toBeVisible();
  await page
    .locator(".studio-scene-shell")
    .screenshot({ path: testInfo.outputPath("compartment-preview.png") });
  for (const [sku, layout] of [
    ["NC-511I", "three-holder"],
    ["NC-801S", "six-left"],
    ["NC-802S", "six-right"],
  ]) {
    const model = page.waitForResponse(
      `**/models/dinnerware/divided-${layout}-${layout.startsWith("six") ? "square" : "round"}.glb`,
    );
    await page
      .getByLabel("The piece", { exact: true })
      .selectOption(`compartment:${sku}`);
    expect((await model).ok()).toBe(true);
    await expect(viewer).toHaveAttribute("data-ready", "true");
    await expect(viewer).toHaveAttribute("data-divider-layout", layout);
  }
  await page
    .getByLabel("The piece", { exact: true })
    .selectOption("compartment:NC-1014");
  await expect(
    page.getByRole("button", { name: "Detail view", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(viewer.locator("canvas")).toHaveCount(0);
  await expect(
    page.getByRole("img", { name: "Compartment NC-1014 source photograph" }),
  ).toBeVisible();
});

test("all 3D controls remain reachable on a 320 pixel screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await open3D(page);
  const viewer = page.locator(".three-view");
  await viewer.scrollIntoViewIfNeeded();
  const bounds = (await viewer.boundingBox())!;
  for (const button of await viewer.getByRole("button").all()) {
    const box = (await button.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(bounds.x);
    expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width);
    expect(box.y + box.height).toBeLessThanOrEqual(bounds.y + bounds.height);
  }
  await page.getByRole("button", { name: "Side view", exact: true }).click();
  await expect(page.getByRole("button", { name: "Side view" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("the viewer stops drawing at rest and respects changes to reduced motion", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let draws = 0;
    Object.defineProperty(window, "__drawCalls", { get: () => draws });
    const original = WebGL2RenderingContext.prototype.drawElements;
    WebGL2RenderingContext.prototype.drawElements = function (...args) {
      draws++;
      return Reflect.apply(original, this, args);
    };
  });
  await open3D(page);
  const count = () =>
    page.evaluate(
      () => (window as unknown as { __drawCalls: number }).__drawCalls,
    );
  await expect
    .poll(async () => {
      const before = await count();
      await page.waitForTimeout(180);
      return (await count()) === before;
    })
    .toBe(true);
  await page.getByRole("button", { name: "Auto rotate" }).click();
  const before = await count();
  await expect.poll(count).toBeGreaterThan(before);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(
    page.getByRole("button", { name: "Auto rotate" }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect
    .poll(async () => {
      const paused = await count();
      await page.waitForTimeout(180);
      return (await count()) === paused;
    })
    .toBe(true);
});
