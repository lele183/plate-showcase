import { readFile, access, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
const seed = JSON.parse(await readFile("src/data/catalog.json", "utf8")),
  audit = JSON.parse(await readFile("src/data/catalog-audit.json", "utf8"));
assert.equal(seed.collections.length, 83);
assert.equal(seed.items.length, audit.itemCount);
const ids = new Set();
for (const i of seed.items) {
  assert(!ids.has(i.id), `Duplicate ${i.id}`);
  ids.add(i.id);
  assert(seed.collections.some((c) => c.id === i.collectionId));
  assert.equal(i.pdfPage, i.sourcePage + 2);
  assert(i.specification);
  await access(`public${i.image}`);
  if (i.studioImage) await access(`public${i.studioImage}`);
  for (const v of Object.values(i.dimensions || {}))
    assert(v === null || (v > 0 && v <= 60), `Invalid ${i.sku} measurement`);
}
for (const c of seed.collections) {
  assert.equal(
    c.itemCount,
    seed.items.filter((i) => i.collectionId === c.id).length,
  );
  assert(c.itemCount > 0);
  await access(`public${c.heroImage}`);
}
for (const [sku, length] of [
  ["MR-710", 10.25],
  ["NS-110T", 10.25],
  ["RO-2210", 10],
  ["BM-110", 10.25],
  ["AC-5", 5.5],
])
  assert.equal(
    seed.items.find((i) => i.sku === sku)?.dimensions?.length,
    length,
    sku,
  );
for (const [sku, expected] of [
  ["MR-107", { length: 7.25, height: 0.75, capacity: null, pack: "3 DZ" }],
  ["MR-213", { length: 12.875, width: 10.125, height: 1.125, pack: "1 DZ" }],
  ["CH-001", { length: 3.5, height: 2.75, capacity: 7, pack: "3 DZ" }],
  ["SW-110", { length: 10, capacity: null, pack: "2 DZ" }],
]) {
  const item = seed.items.find((i) => i.sku === sku);
  assert(item?.sourceVerified && item.originalSpecification, sku);
  for (const [field, value] of Object.entries(expected))
    assert.equal(
      field === "capacity"
        ? item.capacityOz
        : field === "pack"
          ? item.casePack
          : item.dimensions?.[field],
      value,
      `${sku} ${field}`,
    );
}
const covered = new Set(audit.pages.map((p) => p.printedPage));
for (const [a, b] of [
  [4, 83],
  [86, 177],
  [179, 183],
  [186, 191],
  [193, 193],
])
  for (let p = a; p <= b; p++) assert(covered.has(p), `Missing page ${p}`);
console.log(
  `${seed.collections.length} collections; ${seed.items.length} verified catalog records; ${covered.size} product pages covered; ${audit.reviewCount} printed ambiguities flagged.`,
);
console.log(
  `Catalog assets: ${(await readdir("public/catalog")).length}. Original photographs and tabletop cutouts are retained separately.`,
);
const verified = seed.items.filter((i) => i.sourceVerified).length;
assert.equal(verified, audit.sourceVerifiedCount);
assert.equal(
  verified,
  seed.items.length,
  "Every baseline record must be source verified",
);
for (const i of seed.items.filter((i) => i.sourceVerified))
  assert(i.originalSpecification, `Missing original transcription: ${i.sku}`);
console.log(
  `${verified} records individually checked against the scan; ${seed.items.length - verified} still require full source reconciliation.`,
);
