import { describe, it, expect } from "vitest";
import {
  parseBrief,
  recommend,
  itemMatches,
} from "../../src/lib/recommendations";
import {
  emptyBrief,
  type Collection,
  type CatalogItem,
} from "../../src/lib/types";
import seed from "../../src/data/catalog.json";
const collections = seed.collections as Collection[],
  items = seed.items as CatalogItem[];
describe("Brief interpretation", () => {
  it("keeps ivory distinct from plain white", () => {
    const parsed = parseBrief({ ...emptyBrief, color: "ivory" });
    expect(parsed.colors).toEqual(["ivory"]);
    const ivory = items.find((i) => i.sku === "MS-5510IV")!;
    const white = items.find((i) => i.sku === "MS-5510WT")!;
    const collection = collections.find((c) => c.id === "milestone")!;
    expect(itemMatches(ivory, collection, parsed)).toBe(true);
    expect(itemMatches(white, collection, parsed)).toBe(false);
  });
  it("checks exclusions against the actual Birmingham variant", () => {
    const parsed = parseBrief({
      ...emptyBrief,
      material: "melamine",
      color: "black, no green",
    });
    const collection = collections.find((c) => c.id === "birmingham")!;
    expect(
      itemMatches(
        items.find((i) => i.sku === "BM-110GR")!,
        collection,
        parsed,
      ),
    ).toBe(false);
    expect(
      itemMatches(
        items.find((i) => i.sku === "BM-110")!,
        collection,
        parsed,
      ),
    ).toBe(true);
  });
  it("parses mixed fractions and centimeters", () => {
    expect(
      parseBrief({ ...emptyBrief, dimensions: "10 1/2 inches" }).diameter,
    ).toBe(10.5);
    expect(parseBrief({ ...emptyBrief, dimensions: "25.4 cm" }).diameter).toBe(
      10,
    );
  });
  it("normalizes metric capacities and minimums", () => {
    const p = parseBrief({ ...emptyBrief, dimensions: "at least 500 ml" });
    expect(p.capacity).toBeCloseTo(16.91, 2);
    expect(p.minCapacity).toBe(true);
  });
  it("keeps special white finishes distinct", () => {
    expect(parseBrief({ ...emptyBrief, color: "Super White" }).colors).toEqual([
      "super white",
    ]);
  });
  it("recognizes synonyms and plural item names", () => {
    const p = parseBrief({
      ...emptyBrief,
      color: "navy",
      shapes: "triangle",
      types: "plates, bowls, cups, saucers, platters",
    });
    expect(p.colors).toEqual(["blue"]);
    expect(p.shapes).toEqual(["triangular"]);
    expect(p.types).toHaveLength(5);
  });
  it("extracts material and shape exclusions", () => {
    const p = parseBrief({
      ...emptyBrief,
      material: "not melamine",
      shapes: "avoid square or triangular",
    });
    expect(p.materials).toEqual([]);
    expect(p.excludedMaterials).toEqual(["melamine"]);
    expect(p.excludedShapes).toEqual(["square", "triangular"]);
  });
  it("scopes measurements to individual item types", () => {
    const p = parseBrief({
      ...emptyBrief,
      dimensions: "10 inch plates and at least 42 oz bowls",
    });
    expect(p.measurements.map((m) => m.type)).toEqual(["plate", "bowl"]);
  });
  it("explains missing units", () => {
    expect(
      parseBrief({ ...emptyBrief, dimensions: "10.5" }).warnings,
    ).toHaveLength(1);
  });
});
describe("Catalog ranking and constraints", () => {
  it("supports corrected attributes from an activated personal catalog", () => {
    const c = {
      ...collections[0],
      id: "personal",
      material: "melamine",
      colors: ["orange"],
    };
    const i = {
      ...items[0],
      id: "personal:1",
      collectionId: "personal",
      color: "orange",
      shape: "hexagonal",
      type: "plate",
    };
    const r = recommend(
      {
        ...emptyBrief,
        material: "melamine",
        color: "orange",
        shapes: "hexagonal",
        types: "plates",
      },
      [c],
      [i],
    );
    expect(r.recommendations).toHaveLength(1);
  });
  it("does not ignore unsupported expert constraints", () => {
    expect(
      recommend({ ...emptyBrief, material: "steel" }, collections, items)
        .recommendations,
    ).toEqual([]);
  });
  it("honors minimum and maximum dimensions", () => {
    const c = collections[0],
      i = {
        ...items[0],
        collectionId: c.id,
        dimensions: { length: 11, width: null, height: 1 },
      };
    expect(
      itemMatches(
        i,
        c,
        parseBrief({ ...emptyBrief, dimensions: "at least 10 inches" }),
      ),
    ).toBe(true);
    expect(
      itemMatches(
        i,
        c,
        parseBrief({ ...emptyBrief, dimensions: "at most 10 inches" }),
      ),
    ).toBe(false);
  });
  it("does not expand an expert material through refinement", () => {
    const r = recommend(
      { ...emptyBrief, material: "melamine", feedback: "try porcelain" },
      collections,
      items,
    );
    expect(r.recommendations).toEqual([]);
    expect(r.warnings.join(" ")).toMatch(/Conflicting material/);
  });
  it("narrows a palette without adding unrelated expert colors", () => {
    expect(
      parseBrief({ ...emptyBrief, color: "white or blue", feedback: "navy" })
        .colors,
    ).toEqual(["blue"]);
  });
  it("adds feedback checklist items and dimensions", () => {
    const p = parseBrief({
      ...emptyBrief,
      types: "plates",
      feedback: "add bowls, at least 42 oz bowls",
    });
    expect(p.types).toEqual(["plate", "bowl"]);
    expect(p.capacity).toBe(42);
  });
  it("returns six distinct collections across all three groups", () => {
    const r = recommend(emptyBrief, collections, items);
    expect(r.recommendations).toHaveLength(6);
    expect(new Set(r.recommendations.map((v) => v.collection.id)).size).toBe(6);
    expect(new Set(r.recommendations.map((v) => v.group)).size).toBe(3);
  });
  it("never relaxes explicit constraints for a cheaper refinement", () => {
    const r = recommend(
      {
        ...emptyBrief,
        material: "melamine",
        color: "black",
        shapes: "triangular",
        feedback: "less expensive",
      },
      collections,
      items,
    );
    expect(r.recommendations.length).toBeGreaterThan(0);
    for (const v of r.recommendations) {
      expect(v.collection.material).toBe("melamine");
      for (const i of v.items) {
        expect(i.shape).toBe("triangular");
        expect(i.color).toMatch(/black/);
      }
    }
  });
  it("excludes negated materials", () => {
    const r = recommend(
      { ...emptyBrief, material: "avoid melamine" },
      collections,
      items,
    );
    expect(
      r.recommendations.every((v) => v.collection.category === "chinaware"),
    ).toBe(true);
  });
  it("honors a required tabletop checklist in every collection", () => {
    const r = recommend(
      { ...emptyBrief, types: "plates, bowls, cups, saucers" },
      collections,
      items,
    );
    expect(r.recommendations.length).toBeGreaterThan(0);
    for (const v of r.recommendations)
      for (const type of ["plate", "bowl", "cup", "saucer"])
        expect(v.items.some((i) => i.type === type)).toBe(true);
  });
  it("reports impossible requests instead of returning approximate products", () => {
    const r = recommend(
      {
        ...emptyBrief,
        material: "melamine",
        color: "purple",
        dimensions: "100 inches",
      },
      collections,
      items,
    );
    expect(r.recommendations).toEqual([]);
    expect(r.warnings.join(" ")).toMatch(/No catalog pieces/);
  });
  it("rejects products with unknown capacity", () => {
    const p = parseBrief({ ...emptyBrief, dimensions: "42 oz" });
    const i = items.find((i) => i.capacityOz === null)!;
    expect(
      itemMatches(
        i,
        collections.find((c) => c.id === i.collectionId)!,
        p,
      ),
    ).toBe(false);
  });
  it("uses the material of an accessory within a mixed collection", () => {
    const stand = items.find((i) => i.sku === "ST-102WT")!;
    const collection = collections.find((c) => c.id === stand.collectionId)!;
    expect(
      itemMatches(
        stand,
        collection,
        parseBrief({ ...emptyBrief, material: "melamine" }),
      ),
    ).toBe(false);
    expect(
      itemMatches(
        stand,
        collection,
        parseBrief({ ...emptyBrief, material: "metal" }),
      ),
    ).toBe(true);
    expect(
      itemMatches(
        stand,
        collection,
        parseBrief({ ...emptyBrief, material: "no metal" }),
      ),
    ).toBe(false);
  });
  it("keeps a missing printed diameter unknown", () => {
    const plate = items.find((i) => i.sku === "MM-6")!;
    expect(plate.sourceVerified).toBe(true);
    expect(plate.reviewNeeded).toBe(true);
    expect(plate.dimensions).toBeNull();
    expect(
      itemMatches(
        plate,
        collections.find((c) => c.id === "miami")!,
        parseBrief({ ...emptyBrief, dimensions: "6 inches" }),
      ),
    ).toBe(false);
  });
  it("matches porcelain within a documented material description", () => {
    const collection = collections.find((c) => c.id === "versailles")!;
    const plate = items.find((i) => i.sku === "VS-110")!;
    expect(collection.material).toBe("magnesia porcelain");
    expect(
      itemMatches(
        plate,
        collection,
        parseBrief({ ...emptyBrief, material: "porcelain" }),
      ),
    ).toBe(true);
    expect(
      itemMatches(
        plate,
        collection,
        parseBrief({ ...emptyBrief, material: "no porcelain" }),
      ),
    ).toBe(false);
    const unknown = { ...collection, material: "magnesia chinaware" };
    expect(
      itemMatches(
        plate,
        unknown,
        parseBrief({ ...emptyBrief, material: "no porcelain" }),
      ),
    ).toBe(false);
  });
  it("retains sauce dish coverage after source reconciliation", () => {
    const dish = items.find((i) => i.sku === "DB-4030")!;
    expect(dish.type).toBe("sauce dish");
    expect(
      itemMatches(
        dish,
        collections.find((c) => c.id === "diamond-black")!,
        parseBrief({ ...emptyBrief, types: "sauce dish", dimensions: "2 oz" }),
      ),
    ).toBe(true);
  });
  it("excludes contradictory printed measurements from exact matches", () => {
    const plate = items.find(
      (i) => i.collectionId === "milestone" && i.sku === "MS-710BU",
    )!;
    const collection = collections.find((c) => c.id === plate.collectionId)!;
    expect(plate.sourceReferences?.map((r) => r.sourcePage)).toEqual(
      expect.arrayContaining([141, 155]),
    );
    for (const dimensions of ["10 inches", "10 1/4 inches"])
      expect(
        itemMatches(
          plate,
          collection,
          parseBrief({ ...emptyBrief, dimensions }),
        ),
      ).toBe(false);
    const bowl = items.find((i) => i.sku === "OL-4107")!;
    expect(bowl.capacityOz).toBeNull();
    expect(
      itemMatches(
        bowl,
        collections.find((c) => c.id === bowl.collectionId)!,
        parseBrief({ ...emptyBrief, dimensions: "50 oz" }),
      ),
    ).toBe(false);
  });
  it("distinguishes wood-look melamine from actual wood and SAN from glass", () => {
    for (const [id, requested, allowed] of [
      ["wooden-tray", "wood", false],
      ["wooden-tray", "melamine", true],
      ["wood-and-bamboo", "wood", true],
      ["stemware", "glass", false],
      ["stemware", "plastic", true],
    ] as const) {
      const collection = collections.find((c) => c.id === id)!;
      const piece = items.find((i) => i.collectionId === id)!;
      expect(
        itemMatches(
          piece,
          collection,
          parseBrief({ ...emptyBrief, material: requested }),
        ),
      ).toBe(allowed);
    }
  });
  it("uses restaurant colors as preferences", () => {
    const p = parseBrief({ ...emptyBrief, theme: "navy and sage" });
    expect(p.colors).toEqual([]);
    const r = recommend(
      { ...emptyBrief, theme: "navy and sage" },
      collections,
      items,
    );
    expect(r.recommendations[0].reasons.join(" ")).toMatch(/palette/);
  });
  it("responds consistently and within one second for the full seed", () => {
    const start = performance.now();
    const a = recommend(
      { ...emptyBrief, concept: "Modern bistro", tabletop: "Warm oak" },
      collections,
      items,
    );
    const b = recommend(
      { ...emptyBrief, concept: "Modern bistro", tabletop: "Warm oak" },
      collections,
      items,
    );
    expect(a).toEqual(b);
    expect(performance.now() - start).toBeLessThan(1000);
  });
});
