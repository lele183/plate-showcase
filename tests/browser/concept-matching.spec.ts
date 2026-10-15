import { expect, test } from "@playwright/test";
import seed from "../../src/data/catalog.json";
import type { RecommendationResult } from "../../src/lib/types";
test.use({ reducedMotion: "reduce" });
const italian = {
  concept: "Italian trattoria with seasonal pasta",
  tabletop: "Warm oak tables with white linen and rustic accents",
  theme: "Earthy greens, terracotta, and soft ivory",
};
test("Italian preset features the actual pasta plate with honest groups and counts", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "An Italian trattoria", exact: true })
    .click();
  const response = page.waitForResponse(
    (response) =>
      response.url().includes("/api/recommendations") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Find my collections" }).click();
  const data = (await (await response).json()) as RecommendationResult;
  expect(data.parsed.dishes).toContain("pasta");
  expect(data.recommendations[0].collection.id).toBe("legna");
  expect(
    data.recommendations.some((value) => value.collection.id === "honda"),
  ).toBe(false);
  await expect(
    page.getByText(
      `${data.meaningfulMatchCount} collections align with your brief (from ${data.totalFilteredCount} passing your filters). Here are our starting picks.`,
    ),
  ).toBeVisible();
  const group = page
    .locator(".recommendation-group")
    .filter({
      has: page.getByRole("heading", {
        name: "Top concept matches",
        exact: true,
      }),
    });
  const card = group.locator(".collection-card").first();
  await expect(
    card.getByRole("heading", { name: "Legna", exact: true }),
  ).toBeVisible();
  await expect(card.locator(".featured-piece")).toContainText("LE-410");
  await expect(card.locator(".featured-piece")).toContainText(
    "Soup/Pasta Plate",
  );
  const piece = seed.items.find((item) => item.sku === "LE-410")!;
  await expect(card.locator(".collection-photo img")).toHaveAttribute(
    "alt",
    /LE-410/,
  );
  await expect(
    page.getByRole("heading", { name: "Signature options", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Value & high-durability options",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Curated for your concept", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Popular options", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".interpreted")).toContainText("Menu: pasta");
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `.cache/qa/concept-matching-${testInfo.project.name}.png`,
  });
  await card.getByRole("link", { name: "Preview Legna on your table" }).click();
  await expect(page.getByLabel("The piece", { exact: true })).toHaveValue(
    piece.id,
  );
});
test("editing a submitted brief clearly marks previous results until resubmission", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "An Italian trattoria", exact: true })
    .click();
  await page.getByRole("button", { name: "Find my collections" }).click();
  await expect(
    page.getByRole("heading", { name: "Top concept matches", exact: true }),
  ).toBeVisible();
  await page
    .getByPlaceholder("An Italian trattoria, a modern bistro…")
    .fill("Modern bistro with soup");
  await expect(page.getByRole("status")).toContainText(
    "Your brief has changed",
  );
  await page.getByRole("button", { name: "Find my collections" }).click();
  await expect(page.getByText(/Your brief has changed/)).toHaveCount(0);
  await expect(page.locator(".interpreted")).toContainText("Style: bistro");
  await expect(page.locator(".interpreted")).toContainText("Menu: soup");
});
test("sushi concepts feature serving forms and expert constraints remain strict", async ({
  request,
  baseURL,
}) => {
  const headers = { Origin: new URL(baseURL!).origin };
  const sushiResponse = await request.post("/api/recommendations", {
    headers,
    data: { concept: "Japanese izakaya serving sushi" },
  });
  expect(sushiResponse.ok()).toBe(true);
  const sushi = (await sushiResponse.json()) as RecommendationResult;
  const honda = sushi.recommendations.find(
    (value) => value.collection.id === "honda",
  );
  expect(honda?.featuredItem?.shape).toBe("rectangular");
  const strictResponse = await request.post("/api/recommendations", {
    headers,
    data: {
      ...italian,
      material: "melamine",
      color: "green",
      shapes: "round",
      types: "plates, bowls",
      feedback: "less expensive",
    },
  });
  const strict = (await strictResponse.json()) as RecommendationResult;
  expect(strict.recommendations.length).toBeGreaterThan(0);
  for (const recommendation of strict.recommendations) {
    for (const item of [
      ...recommendation.items,
      recommendation.featuredItem!,
    ]) {
      expect(item.material || recommendation.collection.material).toMatch(
        /melamine/,
      );
      expect(item.color).toMatch(/green/);
      expect(item.shape).toBe("round");
    }
    expect(recommendation.items.some((item) => item.type === "plate")).toBe(
      true,
    );
    expect(recommendation.items.some((item) => item.type === "bowl")).toBe(
      true,
    );
  }
  expect(strict.meaningfulMatchCount).toBeLessThanOrEqual(
    strict.totalFilteredCount,
  );
  const impossible = await request.post("/api/recommendations", {
    headers,
    data: {
      ...italian,
      material: "melamine",
      color: "purple",
      dimensions: "100 inches",
    },
  });
  const none = (await impossible.json()) as RecommendationResult;
  expect(none.recommendations).toEqual([]);
  expect(none.totalFilteredCount).toBe(0);
});
