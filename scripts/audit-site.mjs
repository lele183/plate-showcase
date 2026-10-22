import { chromium, devices } from "@playwright/test";
import axe from "axe-core";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const origin = process.env.AUDIT_SITE_URL || "http://127.0.0.1:4173";
const label = process.argv[2] || "latest";
const interactive = process.argv.includes("--interactive");
const screenshots = !process.argv.includes("--no-screenshots");
const output = path.resolve(".cache/site-audit", label);
await mkdir(output, { recursive: true });
const browser = await chromium.launch(
  interactive
    ? { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] }
    : {},
);
const results = [];
try {
  for (const [device, options] of [
    ["desktop", { viewport: { width: 1440, height: 1000 } }],
    ["phone", { ...devices["iPhone 13"] }],
  ]) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    const scenarios = ["/", "/catalog", "/studio", "/workspace"].map(
      (route) => ({
        route,
        name: route.slice(1) || "home",
      }),
    );
    if (interactive)
      scenarios.push(
        {
          route: "/",
          name: "expert",
          prepare: async () => {
            await page
              .getByRole("button", { name: "Expert mode", exact: true })
              .click();
          },
        },
        {
          route: "/",
          name: "recommendations",
          prepare: async () => {
            await page
              .getByRole("button", {
                name: "An Italian trattoria",
                exact: true,
              })
              .click();
            await page
              .getByRole("button", { name: "Find my collections" })
              .click();
            await page
              .getByRole("heading", {
                name: "Your table, thoughtfully matched.",
              })
              .waitFor();
          },
        },
        {
          route: "/",
          name: "signin",
          prepare: async () => {
            await page
              .locator("header")
              .getByRole("button", { name: "Sign in", exact: true })
              .click();
            await page
              .getByRole("dialog", { name: "Welcome to the table." })
              .waitFor();
          },
        },
        {
          route: "/",
          name: "collection",
          prepare: async () => {
            await page
              .getByRole("button", {
                name: "Explore Legna collection",
                exact: true,
              })
              .click();
            await page
              .getByRole("dialog", { name: "Legna", exact: true })
              .locator(".item-grid article")
              .first()
              .waitFor();
          },
        },
        {
          route: "/studio?view=3d",
          name: "3d",
          prepare: async () => {
            await page.locator('.three-view[data-ready="true"]').waitFor();
          },
        },
        {
          route: "/studio?view=3d",
          name: "3d-controls",
          prepare: async () => {
            await page.locator('.three-view[data-ready="true"]').waitFor();
            await page.getByRole("button", { name: /Studio lighting/ }).click();
            await page
              .getByRole("button", { name: /Show catalog dimensions/ })
              .click();
            await page
              .getByRole("button", { name: /Show source photograph/ })
              .click();
            await page.getByRole("button", { name: /Auto rotate/ }).click();
          },
        },
      );
    if (interactive && device === "phone")
      scenarios.push({
        route: "/",
        name: "navigation",
        prepare: async () => {
          await page.getByRole("button", { name: "Open menu" }).click();
        },
      });
    for (const { route, name, prepare } of scenarios) {
      const errors = [];
      const onError = (error) => errors.push(error.message);
      page.on("pageerror", onError);
      const response = await page.goto(new URL(route, origin).href);
      if (prepare) await prepare();
      await page.waitForLoadState("networkidle");
      await page.addScriptTag({ content: axe.source });
      const accessibility = await page.evaluate(async () =>
        window.axe.run(document, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
          },
        }),
      );
      const metrics = await page.evaluate(() => {
        const resources = performance.getEntriesByType("resource");
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          brokenImages: [...document.images]
            .filter((image) => image.complete && image.naturalWidth === 0)
            .map((image) => image.currentSrc),
          resourceBytes: resources.reduce(
            (sum, entry) => sum + entry.transferSize,
            0,
          ),
          scripts: resources.filter((entry) => entry.initiatorType === "script")
            .length,
          largestResources: resources
            .map((entry) => ({
              url: new URL(entry.name).pathname,
              bytes: entry.transferSize,
            }))
            .sort((a, b) => b.bytes - a.bytes)
            .slice(0, 8),
        };
      });
      if (screenshots) {
        const screenshot = path.join(output, `${device}-${name}.png`);
        await page.screenshot({ path: screenshot, fullPage: true });
        await page.screenshot({
          path: path.join(output, `${device}-${name}-viewport.png`),
        });
      }
      const result = {
        device,
        route,
        state: name,
        status: response.status(),
        errors,
        ...metrics,
        violations: accessibility.violations.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          description: violation.description,
          nodes: violation.nodes.map((node) => ({
            target: node.target,
            summary: node.failureSummary,
          })),
        })),
      };
      results.push(result);
      await writeFile(
        path.join(output, "report.json"),
        JSON.stringify(results, null, 2),
      );
      console.log(
        JSON.stringify({
          ...result,
          largestResources: undefined,
          violations: result.violations.map(({ id, impact, nodes }) => ({
            id,
            impact,
            affectedElements: nodes.length,
          })),
        }),
      );
      page.off("pageerror", onError);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
await writeFile(
  path.join(output, "report.json"),
  JSON.stringify(results, null, 2),
);
if (
  results.some(
    (result) =>
      result.status !== 200 ||
      result.errors.length ||
      result.overflow ||
      result.brokenImages.length ||
      result.violations.length,
  )
)
  process.exitCode = 1;
