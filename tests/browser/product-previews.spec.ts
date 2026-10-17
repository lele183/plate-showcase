import { expect, test } from "@playwright/test";
import previews from "../../src/data/product-previews.json";
import seed from "../../src/data/catalog.json";

test.use({ reducedMotion: "reduce" });

test("recommendation photos fit and completed previews retain access to originals", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "An Italian trattoria", exact: true })
    .click();
  const response = page.waitForResponse(
    (value) =>
      value.url().includes("/api/recommendations") &&
      value.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Find my collections" }).click();
  expect((await response).ok()).toBe(true);
  await expect(page.locator(".interpreted")).toContainText("Menu: pasta");
  const cards = page.locator(".recommendation-groups .collection-card");
  await expect(cards).toHaveCount(6);

  for (const card of await cards.all()) {
    await card.scrollIntoViewIfNeeded();
    const image = card.locator(".collection-photo img");
    await expect
      .poll(() =>
        image.evaluate(
          (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
        ),
      )
      .toBe(true);
    // The complete asset fits inside its panel, including on a narrow phone.
    expect(await image.evaluate((el) => getComputedStyle(el).objectFit)).toBe(
      "contain",
    );
    expect(
      await card.evaluate((el) => {
        const box = el.getBoundingClientRect();
        return box.left >= 0 && box.right <= innerWidth;
      }),
    ).toBe(true);
  }

  for (const [id, preview] of Object.entries(previews)) {
    const item = seed.items.find((value) => value.id === id)!;
    const collection = seed.collections.find(
      (value) => value.id === item.collectionId,
    )!;
    const card = cards.filter({
      has: page.getByRole("heading", { name: collection.name, exact: true }),
    });
    await expect
      .poll(async () => {
        const src = await card
          .locator(".collection-photo img")
          .getAttribute("src");
        const url = new URL(src!, page.url());
        return url.searchParams.get("url") || url.pathname;
      })
      .toBe(preview.image);
    await expect(card.locator(".collection-photo img")).toHaveAttribute(
      "alt",
      /AI-completed preview/,
    );
    await expect(card.locator(".image-completion-note")).toContainText(
      "AI-completed preview",
    );
    await expect(
      card.getByRole("link", { name: "Original photo", exact: true }),
    ).toHaveAttribute("href", item.image);
    await expect(card.locator(".featured-piece")).toContainText(item.sku);
    await expect(
      card.getByRole("link", {
        name: `Preview ${collection.name} on your table`,
      }),
    ).toHaveAttribute("href", new RegExp(`item=${encodeURIComponent(id)}`));

    // Product details keep the authentic catalog photo and source-page link.
    await card
      .getByRole("button", { name: "Explore collection", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: collection.name,
      exact: true,
    });
    await dialog.getByRole("searchbox").fill(item.sku);
    await expect(dialog.locator(".item-image img")).toHaveAttribute(
      "src",
      item.image,
    );
    await expect(
      dialog.getByRole("link", {
        name: `Verify specifications · p. ${item.sourcePage}`,
        exact: true,
      }),
    ).toHaveAttribute("href", new RegExp(`#page=${item.pdfPage}$`));
    await dialog.getByRole("button", { name: "Close collection" }).click();
  }

  const legna = cards.filter({
    has: page.getByRole("heading", { name: "Legna", exact: true }),
  });
  await expect(legna.locator(".image-completion-note")).toHaveCount(0);
  await page.locator(".recommendation-groups").screenshot({
    path: `.cache/qa/product-previews-${testInfo.project.name}.png`,
  });
});
