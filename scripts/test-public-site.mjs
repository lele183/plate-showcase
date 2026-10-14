import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const site = new URL(
  process.env.LIVE_SITE_URL || "https://plate-showcase.vercel.app",
).origin;
const seed = JSON.parse(await readFile("src/data/catalog.json", "utf8"));
for (const path of ["/", "/catalog", "/studio", "/workspace"]) {
  const response = await fetch(site + path);
  assert.equal(response.status, 200, path);
  assert.match(response.headers.get("content-type"), /text\/html/);
}
const catalog = await (await fetch(site + "/api/catalog")).json();
assert.equal(catalog.collections.length, seed.collections.length);
assert.equal(catalog.itemCount, seed.items.length);
const milestone = await (
  await fetch(site + "/api/catalog?collection=milestone")
).json();
const plate = milestone.items.find((i) => i.sku === "MS-710BU");
assert(plate.sourceVerified && plate.reviewNeeded && plate.studioImage);
assert.equal(plate.dimensions, null);
assert(plate.sourceReferences.some((r) => r.sourcePage === 155));
for (const path of [
  plate.image,
  plate.studioImage,
  "/food/salmon-v2.webp",
  "/food/vegetables-v2.webp",
  "/food/toast-v2.webp",
  "/catalog/yanco-2026.pdf",
]) {
  const response = await fetch(site + path, { method: "HEAD" });
  assert.equal(response.status, 200, path);
}
const timings = [];
for (let run = 0; run < 3; run++) {
  const started = performance.now();
  const response = await fetch(site + "/api/recommendations", {
    method: "POST",
    headers: { "content-type": "application/json", origin: site },
    body: JSON.stringify({
      material: "melamine",
      color: "black",
      types: "plates",
      dimensions: "10 inches",
      feedback: run ? "more affordable" : "",
    }),
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  timings.push(Math.round(performance.now() - started));
  assert(
    result.recommendations.length > 0 && result.recommendations.length <= 6,
  );
  for (const recommendation of result.recommendations)
    for (const item of recommendation.items) {
      assert.match(
        item.material || recommendation.collection.material,
        /melamine/i,
      );
      assert.match(item.color, /black/i);
      assert.equal(item.type, "plate");
      assert.equal(item.dimensions.length, 10);
    }
}
for (const path of ["/api/scenes", "/api/catalogs", "/api/jobs"])
  assert.equal((await fetch(site + path)).status, 401, path);
assert.equal(
  (
    await fetch(site + "/api/uploads", {
      method: "POST",
      headers: { origin: site, "content-type": "application/json" },
      body: "{}",
    })
  ).status,
  401,
);
console.log(
  `Public production checks passed: ${catalog.collections.length} collections, ${catalog.itemCount} verified records, source notes, product/food assets, strict recommendations and private-route protection.`,
);
console.log(
  `Observed recommendation response times: ${timings.join(", ")} ms.`,
);
