import { describe, it, expect } from "vitest";
import seed from "../../src/data/catalog.json";
import type { CatalogItem } from "../../src/lib/types";
import {
  groupPieces,
  measurement,
  pieceMatches,
} from "../../src/lib/piece-groups";
describe("catalog display families", () => {
  const items = seed.items.filter(
    (item) => item.collectionId === "legna",
  ) as CatalogItem[];
  it("groups the five bread/dinner sizes and retains every SKU", () => {
    const groups = groupPieces(items);
    const bread = groups.find((group) => group.name === "Bread/Dinner Plate")!;
    expect(bread.items.map((item) => item.sku)).toEqual([
      "LE-106",
      "LE-107",
      "LE-109",
      "LE-110",
      "LE-111",
    ]);
    expect(
      groups.flatMap((group) => group.items.map((item) => item.id)).sort(),
    ).toEqual(items.map((item) => item.id).sort());
    expect(
      groups.find((group) => group.name === "Coupe Round Plate")!.id,
    ).not.toBe(bread.id);
  });
  it("keeps shapes, colors, materials, profiles and source groups separate", () => {
    const item = items.find((item) => item.sku === "LE-106")!;
    const variants = [
      { ...item, id: "shape", shape: "square" },
      { ...item, id: "color", color: "blue" },
      { ...item, id: "material", material: "melamine" },
      { ...item, id: "profile", name: "Coupe plate" },
      { ...item, id: "page", sourcePage: 5 },
    ];
    expect(groupPieces([item, ...variants])).toHaveLength(6);
  });
  it("finds specific SKUs and fractional sizes", () => {
    const item = items.find((item) => item.sku === "LE-110")!;
    expect(pieceMatches(item, "LE-110")).toBe(true);
    expect(pieceMatches(item, "10¼")).toBe(true);
    expect(measurement(6.125)).toBe("6⅛");
    expect(measurement(0.75)).toBe("¾");
    expect(measurement(2.375)).toBe("2⅜");
  });
});
