import { test, expect } from "@playwright/test";
import seed from "../../src/data/catalog.json";
import { resolve } from "node:path";
const legna = seed.items.filter((item) => item.collectionId === "legna");
const plate = legna.find((item) => item.sku === "LE-110")!;
test("collection families preserve size-specific specs and close after scrolling", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const trigger = page.getByRole("button", {
    name: "Explore Legna collection",
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Legna", exact: true });
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect
    .poll(() => page.evaluate(() => document.body.style.overflow))
    .toBe("hidden");
  const family = dialog.locator('[data-piece-family="Bread/Dinner Plate"]');
  await expect(family).toHaveCount(1);
  await expect(family).toContainText("5 sizes available");
  await expect(family.locator("option")).toHaveCount(5);
  await family.getByLabel("Choose size / SKU").selectOption(plate.id);
  await expect(family.locator(".sku")).toHaveText("LE-110");
  await expect(family).toContainText("10¼″");
  await expect(family).toContainText("Case pack: 1 DZ");
  await family.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `.cache/qa/round3-grouped-pieces-${testInfo.project.name}.png`,
  });
  await expect(
    family.getByRole("link", { name: "Preview this piece" }),
  ).toHaveAttribute("href", new RegExp(`item=${encodeURIComponent(plate.id)}`));
  await dialog.getByRole("searchbox").fill("LE-109");
  await expect(family.locator(".sku")).toHaveText("LE-109");
  await expect(family.locator("option")).toHaveCount(5);
  await dialog.getByRole("searchbox").clear();
  const close = dialog.getByRole("button", { name: "Close collection" });
  const top = (await close.boundingBox())!.y;
  await dialog
    .locator(".collection-dialog-scroll")
    .evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect.poll(async () => (await close.boundingBox())!.y).toBe(top);
  expect(
    await close.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return (
        document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) ===
          el ||
        el.contains(
          document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
        )
      );
    }),
  ).toBe(true);
  if (testInfo.project.name === "phone") await close.tap();
  else await close.click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => document.body.style.overflow))
    .toBe("");
  await trigger.press("Enter");
  await expect(dialog).toBeVisible();
  await expect(close).toBeFocused();
  await close.press("Shift+Tab");
  expect(
    await dialog.evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});
test("catalog query and category survive reload and clear without scrolling", async ({
  page,
}) => {
  await page.goto("/catalog?category=chinaware&q=mug");
  const search = page.getByRole("searchbox");
  await expect(search).toHaveValue("mug");
  await expect(
    page.getByRole("button", { name: "Chinaware", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".all-collections article").first()).toBeVisible();
  await search.fill("LE-110");
  await expect(page).toHaveURL(/q=LE-110/);
  await expect(search).toBeFocused();
  await expect(page.locator(".all-collections article")).toHaveCount(1);
  await page.reload();
  await expect(search).toHaveValue("LE-110");
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await page
    .getByRole("button", { name: "All collections", exact: true })
    .click();
  await expect(page).toHaveURL(/\/catalog$/);
});
test("studio deep links round trip, reset and copy with accessible controls", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text: string) => {
          (window as unknown as { copied: string }).copied = text;
        },
      },
    });
  });
  await page.goto(
    `/studio?collection=legna&item=LE-110&surface=dark&food=vegetables&portion=1.25&rotation=35&x=4`,
  );
  await expect(page.getByLabel("The piece", { exact: true })).toHaveValue(
    plate.id,
  );
  await expect(
    page.getByRole("button", { name: "Dark stone", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Vegetables", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Portion", { exact: true })).toHaveAttribute(
    "aria-valuetext",
    "125 percent",
  );
  await expect(page.getByLabel("Rotation", { exact: true })).toHaveValue("35");
  await page.getByRole("button", { name: "Small plates", exact: true }).click();
  await expect(page).toHaveURL(/food=toast/);
  await page.getByLabel("Rotation", { exact: true }).fill("-25");
  await page.getByLabel("Portion", { exact: true }).fill("1.4");
  await page.reload();
  await expect(page.getByLabel("Portion", { exact: true })).toHaveValue("1.4");
  await expect(page.getByLabel("Rotation", { exact: true })).toHaveValue("-25");
  await page
    .getByRole("button", { name: "Copy studio link", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Link copied", exact: true }),
  ).toBeVisible();
  const copied = await page.evaluate(
    () => (window as unknown as { copied: string }).copied,
  );
  expect(new URL(copied).searchParams.get("item")).toBe(plate.id);
  await page
    .getByRole("button", { name: "Reset placement", exact: true })
    .click();
  const reset = new URL(page.url());
  for (const key of ["portion", "rotation", "x", "y", "crop"])
    expect(reset.searchParams.has(key)).toBe(false);
  await page.reload();
  await expect(page.getByLabel("Portion", { exact: true })).toHaveValue("1");
  await expect(page.getByLabel("Rotation", { exact: true })).toHaveValue("0");
});
test("guest menu and compositions persist locally without hosted writes", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() !== "GET" &&
      /\/api\/(uploads|jobs|scenes)/.test(request.url())
    )
      writes.push(request.url());
  });
  await page.goto("/workspace?upload=menu");
  await expect(page.getByText(/Working in guest mode/)).toBeVisible();
  await page.getByLabel("Upload guest menu", { exact: true }).setInputFiles({
    name: "test-menu.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Seasonal pasta, grilled fish and salads"),
  });
  await expect(page.getByLabel("Paste menu text", { exact: true })).toHaveValue(
    "Seasonal pasta, grilled fish and salads",
  );
  await page.reload();
  await expect(page.getByLabel("Paste menu text", { exact: true })).toHaveValue(
    "Seasonal pasta, grilled fish and salads",
  );
  await page.getByRole("button", { name: "Use menu in expert mode" }).click();
  await expect(
    page.getByPlaceholder("Pasta, ramen, salads, small plates…"),
  ).toHaveValue("Seasonal pasta, grilled fish and salads");
  await expect(
    page.getByRole("button", { name: "Expert mode", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto(
    `/studio?collection=legna&item=${plate.id}&surface=stone&food=none&portion=1.2&rotation=30`,
  );
  await page.getByRole("button", { name: "Save to workspace" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Scene saved on this device",
  );
  await page.goto("/workspace");
  await page.reload();
  await page.getByRole("link", { name: "Open setting", exact: true }).click();
  await expect(page.getByLabel("The piece", { exact: true })).toHaveValue(
    plate.id,
  );
  await expect(page.getByLabel("Rotation", { exact: true })).toHaveValue("30");
  await expect(
    page.getByRole("button", { name: "Light stone", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(writes).toEqual([]);
});
test("guest PDF, DOCX and image previews work without account uploads", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() !== "GET" &&
      /\/api\/(uploads|jobs)/.test(request.url())
    )
      writes.push(request.url());
  });
  await page.goto("/workspace?upload=menu");
  const upload = page.getByLabel("Upload guest menu", { exact: true });
  const text = page.getByLabel("Paste menu text", { exact: true });
  await upload.setInputFiles(resolve("tests/fixtures/guest-menu.pdf"));
  await expect(text).toHaveValue(/Grilled fish and fresh salad/, {
    timeout: 15000,
  });
  await upload.setInputFiles(resolve("tests/fixtures/guest-menu.docx"));
  await expect(text).toHaveValue(/Seasonal pasta and seafood/);
  await upload.setInputFiles(resolve("public/food/salmon-v2.webp"));
  await expect(
    page.getByRole("img", { name: "Your menu, saved on this device" }),
  ).toBeVisible();
  await text.fill("Roast vegetables and soup");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("yanco_guest_workspace_v1") || "{}")
            .menu?.text,
      ),
    )
    .toBe("Roast vegetables and soup");
  await page.reload();
  await expect(
    page.getByRole("img", { name: "Your menu, saved on this device" }),
  ).toBeVisible();
  await expect(text).toHaveValue("Roast vegetables and soup");
  expect(writes).toEqual([]);
});
test("quick-select chips expose accurate pressed states and keyboard focus", async ({
  page,
}) => {
  await page.goto("/");
  const idea = page.getByRole("button", {
    name: "An Italian trattoria",
    exact: true,
  });
  await idea.focus();
  await idea.press("Enter");
  await expect(idea).toHaveAttribute("aria-pressed", "true");
  await expect(idea).toHaveCSS("outline-style", "solid");
  await page
    .getByPlaceholder("An Italian trattoria, a modern bistro…")
    .fill("My edited concept");
  await expect(idea).toHaveAttribute("aria-pressed", "false");
});
test("3D view URLs restore the view and fallback after refresh", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      value: function (kind: string, ...args: unknown[]) {
        return kind.includes("webgl")
          ? null
          : Reflect.apply(getContext, this, [kind, ...args]);
      },
    });
  });
  await page.goto("/studio?collection=legna&item=LE-110&surface=dark&view=3d");
  await expect(
    page.getByRole("button", { name: "Detail view", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Detail view", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Tabletop", exact: true }).click();
  expect(new URL(page.url()).searchParams.has("view")).toBe(false);
  await expect(page.locator(".studio-scene")).toHaveClass(/surface-dark/);
});
