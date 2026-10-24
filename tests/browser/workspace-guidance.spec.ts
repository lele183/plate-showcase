import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import axe from "axe-core";

test("guest text-menu feedback is visible beside upload and survives reload", async ({
  page,
}) => {
  await page.goto("/workspace?upload=menu");
  const panel = page.locator("#workspace-menu");
  await panel
    .getByLabel("Upload guest menu", { exact: true })
    .scrollIntoViewIfNeeded();
  await panel.getByLabel("Upload guest menu", { exact: true }).setInputFiles({
    name: "dinner-menu.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Seasonal pasta, grilled fish and salads"),
  });
  await expect(panel.getByRole("status")).toContainText("Menu ready to review");
  await expect(panel.getByRole("status")).toBeInViewport({ ratio: 1 });
  await expect(panel.locator('li[aria-current="step"]')).toHaveText(
    "2Review dishes",
  );
  await expect(
    panel.getByRole("button", { name: "Use menu in expert mode" }),
  ).toHaveClass(/primary/);
  await page.reload();
  await expect(panel.getByRole("status")).toContainText("Menu ready to review");
  await expect(
    panel.getByText("dinner-menu.txt", { exact: true }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Use menu in expert mode" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Your menu is ready to use." }),
  ).toBeVisible();
});

test("guest image upload explains the missing text and offers a useful next step", async ({
  page,
}, testInfo) => {
  await page.goto("/workspace");
  const panel = page.locator("#workspace-menu");
  await panel
    .getByLabel("Upload guest menu", { exact: true })
    .setInputFiles(resolve("public/food/salmon-v2.webp"));
  await expect(panel.getByRole("status")).toContainText(
    "Image added. Next, enter the dishes.",
  );
  await expect(panel.getByRole("status")).toContainText(
    "its text has not been extracted",
  );
  await expect(
    panel.getByRole("button", { name: "Sign in for text extraction" }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Use menu in expert mode" }),
  ).toBeDisabled();
  await page.screenshot({
    path: `.cache/qa/workspace-image-guidance-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.reload();
  await expect(panel.getByRole("status")).toContainText(
    "Add the dishes from your menu",
  );
  await panel
    .getByLabel("Paste menu text", { exact: true })
    .fill("Grilled fish and lemon potatoes");
  await expect(
    panel.getByRole("button", { name: "Use menu in expert mode" }),
  ).toBeEnabled();
  await panel.getByRole("button", { name: "Use menu in expert mode" }).click();
  await expect(
    page.getByPlaceholder("Pasta, ramen, salads, small plates…"),
  ).toHaveValue("Grilled fish and lemon potatoes");
});

test("blank and unsupported menus explain recovery while preserving earlier edits", async ({
  page,
}) => {
  await page.goto("/workspace");
  const panel = page.locator("#workspace-menu");
  const upload = panel.getByLabel("Upload guest menu", { exact: true });
  await upload.setInputFiles({
    name: "blank-menu.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("  \n  "),
  });
  await expect(panel.getByRole("status")).toContainText("No menu text found");
  await expect(
    panel.getByRole("button", { name: "Use menu in expert mode" }),
  ).toBeDisabled();
  await panel
    .getByLabel("Paste menu text", { exact: true })
    .fill("Pasta and salad");
  await upload.setInputFiles({
    name: "unsupported.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("food,price"),
  });
  await expect(panel.getByRole("alert")).toContainText("Choose a PDF");
  await expect(
    panel.getByLabel("Paste menu text", { exact: true }),
  ).toHaveValue("Pasta and salad");
});

test("guest storage failure is visible and a usable menu can still reach the selector", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "yanco_guest_workspace_v1")
        throw new DOMException("Storage is full", "QuotaExceededError");
      setItem.call(this, key, value);
    };
  });
  await page.goto("/workspace");
  const panel = page.locator("#workspace-menu");
  await panel.getByLabel("Upload guest menu", { exact: true }).setInputFiles({
    name: "menu.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Roast chicken and vegetables"),
  });
  await expect(panel.getByRole("alert")).toContainText("could not be saved");
  await expect(
    panel.getByLabel("Paste menu text", { exact: true }),
  ).toHaveValue("Roast chicken and vegetables");
  await panel.getByRole("button", { name: "Use menu in expert mode" }).click();
  await expect(
    page.getByPlaceholder("Pasta, ramen, salads, small plates…"),
  ).toHaveValue("Roast chicken and vegetables");
});

test("workspace shortcuts and empty table settings explain how to get started", async ({
  page,
}, testInfo) => {
  await page.goto("/workspace");
  await expect(
    page.getByRole("navigation", { name: "Workspace shortcuts" }),
  ).toBeVisible();
  await expect(page.locator("#workspace-settings")).toContainText(
    "Save to workspace",
  );
  await page.getByRole("link", { name: "Bring your menu" }).click();
  await expect(page).toHaveURL(/#workspace-menu$/);
  await page.screenshot({
    path: `.cache/qa/workspace-guidance-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("uploaded-menu guidance meets accessibility checks on both screen sizes", async ({
  page,
}) => {
  await page.goto("/workspace");
  await page.getByLabel("Upload guest menu", { exact: true }).setInputFiles({
    name: "menu.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Roast chicken, grilled fish and pasta"),
  });
  await expect(
    page.locator("#workspace-menu").getByRole("status"),
  ).toContainText("Menu ready to review");
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => {
    const client = window as unknown as { axe: typeof axe };
    return (
      await client.axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
        },
      })
    ).violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map((node) => node.target),
    }));
  });
  expect(violations).toEqual([]);
});
