import { describe, expect, it } from "vitest";
import seed from "../../src/data/catalog.json";
import profiles from "../../scripts/catalog-style-profiles.json";
import {
  recommend,
  parseBrief,
  itemMatches,
} from "../../src/lib/recommendations";
import { scoreCollection } from "../../src/lib/recommendation-ranking";
import {
  selectRepresentativeItem,
  supportsDish,
} from "../../src/lib/recommendation-items";
import {
  emptyBrief,
  type CatalogItem,
  type Collection,
} from "../../src/lib/types";
const collections = seed.collections as Collection[],
  items = seed.items as CatalogItem[];
const italian = {
  ...emptyBrief,
  concept: "Italian trattoria with seasonal pasta",
  tabletop: "Warm oak tables with white linen and rustic accents",
  theme: "Earthy greens, terracotta, and soft ivory",
};
const collection = (id: string) =>
  collections.find((value) => value.id === id)!;
const pieces = (id: string) =>
  items.filter((value) => value.collectionId === id);
describe("editorial style provenance", () => {
  it("only assigns cuisine tags from the explicit reviewed lookup", () => {
    for (const c of collections) {
      const profile = profiles[c.id as keyof typeof profiles];
      expect(c.conceptTags).toEqual(profile?.conceptTags || []);
      expect(c.visualTags).not.toContain("italian");
      expect(c.visualTags).not.toContain("asian");
      expect(c.styleNotes).toBe(profile?.note || "");
    }
    expect(collection("honda").tags).not.toContain("italian");
    expect(collection("honda").tags).not.toContain("rustic");
    expect(collection("honda").conceptTags).toContain("japanese");
    expect(collection("legna").conceptTags).toContain("italian");
  });
  it("never infers a cuisine from old tags or a green palette at runtime", () => {
    const c = {
      ...collection("honda"),
      id: "unreviewed",
      conceptTags: undefined,
      visualTags: [],
      tags: ["italian", "rustic"],
    };
    const p = parseBrief(italian);
    const scored = scoreCollection(c, pieces("honda"), p, italian);
    expect(scored.reasons.join(" ")).not.toMatch(/Editorial|rustic/);
  });
});
describe("concept and dish relevance", () => {
  it("puts Legna first, at least 20 points above Honda, with useful round featured pieces", () => {
    const result = recommend(italian, collections, items);
    expect(result.recommendations[0].collection.id).toBe("legna");
    const honda = scoreCollection(
      collection("honda"),
      pieces("honda"),
      result.parsed,
      italian,
    );
    expect(
      result.recommendations[0].score - honda.score,
    ).toBeGreaterThanOrEqual(20);
    expect(
      result.recommendations.some((value) => value.collection.id === "honda"),
    ).toBe(false);
    expect(result.recommendations[0].featuredItem?.sku).toBe("LE-410");
    for (const value of result.recommendations) {
      expect(value.featuredItem?.shape).toBe("round");
      expect(["plate", "bowl"]).toContain(value.featuredItem?.type);
      expect(value.featuredItem?.name).not.toMatch(/compartment|mug|saucer/i);
    }
    expect(result.meaningfulMatchCount).toBeLessThan(result.totalFilteredCount);
    expect(result.totalFilteredCount).toBe(76);
  });
  it.each(Object.keys(emptyBrief))("detects pasta in the %s field", (field) => {
    expect(
      parseBrief({ ...emptyBrief, [field]: "seasonal pasta" }).dishes,
    ).toContain("pasta");
  });
  it("awards a ten-point dish bonus for pasta in Quick Select", () => {
    const base = { ...emptyBrief, concept: "Italian trattoria" },
      withPasta = { ...base, concept: "Italian trattoria with pasta" };
    const a = scoreCollection(
      collection("legna"),
      pieces("legna"),
      parseBrief(base),
      base,
    );
    const b = scoreCollection(
      collection("legna"),
      pieces("legna"),
      parseBrief(withPasta),
      withPasta,
    );
    expect(b.score - a.score).toBe(10);
    expect(b.reasons.join(" ")).toMatch(/pasta/);
  });
  it("keeps negation and word boundaries when detecting dishes", () => {
    expect(
      parseBrief({
        ...emptyBrief,
        concept: "Soup, no pasta. An impasta special.",
      }).dishes,
    ).toEqual(["soup"]);
  });
  it("applies the documented cuisine penalty without turning colors into cuisine", () => {
    const p = parseBrief(italian);
    const conflict = scoreCollection(
      collection("honda"),
      pieces("honda"),
      p,
      italian,
    );
    const neutral = scoreCollection(
      { ...collection("honda"), conceptTags: [] },
      pieces("honda"),
      p,
      italian,
    );
    expect(neutral.score - conflict.score).toBe(25);
    expect(conflict.conceptConflict).toBe(true);
  });
  it.each(["melamine", "outdoor", "patio", "high-volume", "unbreakable"])(
    "respects %s service intent",
    (service) => {
      const brief = {
        ...italian,
        concept: `${italian.concept}. ${service} service`,
      };
      const parsed = parseBrief(brief);
      expect(parsed.durabilityRequested).toBe(true);
      const ordinary = scoreCollection(
        collection("legna"),
        pieces("legna"),
        { ...parsed, durabilityRequested: false },
        brief,
      );
      const durable = scoreCollection(
        collection("legna"),
        pieces("legna"),
        parsed,
        brief,
      );
      expect(ordinary.score - durable.score).toBe(8);
    },
  );
  it("allows Honda for a Japanese sushi concept with a rectangular featured piece", () => {
    const r = recommend(
      { ...emptyBrief, concept: "Japanese izakaya serving sushi and sashimi" },
      collections,
      items,
    );
    const honda = r.recommendations.find(
      (value) => value.collection.id === "honda",
    );
    expect(honda).toBeDefined();
    expect(honda!.featuredItem?.shape).toBe("rectangular");
    expect(
      r.recommendations.some((value) => value.collection.id === "legna"),
    ).toBe(false);
  });
  it("retains strict expert constraints for outdoor Italian service and refinement", () => {
    const brief = {
      ...italian,
      material: "melamine",
      color: "green",
      shapes: "round",
      types: "plates, bowls",
      feedback: "less expensive",
    };
    const r = recommend(brief, collections, items);
    expect(r.recommendations.length).toBeGreaterThan(0);
    for (const value of r.recommendations) {
      for (const item of [...value.items, value.featuredItem!])
        expect(itemMatches(item, value.collection, r.parsed)).toBe(true);
      expect(value.items.some((item) => item.type === "bowl")).toBe(true);
      expect(value.items.some((item) => item.type === "plate")).toBe(true);
      expect(value.collection.id).not.toBe("honda");
    }
    expect(
      recommend(
        { ...brief, color: "purple", dimensions: "100 inches" },
        collections,
        items,
      ).recommendations,
    ).toEqual([]);
  });
  it("distinguishes positive alignment from simply passing the filters", () => {
    const c = {
      ...collection("legna"),
      id: "neutral",
      category: "melamine" as const,
      material: "melamine",
      conceptTags: [],
      visualTags: [],
    };
    const i = {
      ...pieces("legna")[1],
      collectionId: c.id,
      name: "Plate",
      dimensions: { length: 6, width: null, height: null },
    };
    const r = recommend({ ...emptyBrief, concept: "Italian pasta" }, [c], [i]);
    expect(r.totalFilteredCount).toBe(1);
    expect(r.meaningfulMatchCount).toBe(0);
    expect(r.recommendations).toEqual([]);
    expect(r.warnings.join(" ")).toMatch(/pass your product filters/);
  });
  it("keeps all three groups distinct and tied to actual catalog attributes", () => {
    const r = recommend(italian, collections, items);
    expect(r.recommendations).toHaveLength(6);
    expect(
      new Set(r.recommendations.map((value) => value.collection.id)).size,
    ).toBe(6);
    for (const value of r.recommendations) {
      if (value.group === "Signature")
        expect(value.collection.section).toBe("signature");
      if (value.group === "Value") expect(value.collection.budget).toBe(1);
    }
  });
});
describe("representative piece selection", () => {
  it("selects a real named pasta plate beyond the first eight source records", () => {
    const source = pieces("legna");
    const before = source.map((item) => item.id);
    const selected = selectRepresentativeItem(source, parseBrief(italian));
    expect(selected?.sku).toBe("LE-410");
    expect(source.map((item) => item.id)).toEqual(before);
    expect(
      selectRepresentativeItem([...source].reverse(), parseBrief(italian))?.id,
    ).toBe(selected?.id);
  });
  it("does not mistake compartment feet or tiny side plates for pasta vessels", () => {
    const item = pieces("legna").find((item) => item.sku === "LE-410")!;
    expect(
      supportsDish(
        { ...item, name: "3-Compartment Plate with Deep Beveled Foot" },
        "pasta",
      ),
    ).toBe(false);
    expect(
      supportsDish(
        { ...item, dimensions: { length: 4, width: null, height: 1 } },
        "pasta",
      ),
    ).toBe(false);
    expect(
      selectRepresentativeItem([{ ...item, image: "" }], parseBrief(italian)),
    ).toBeUndefined();
  });
  it("matches steak dimensions and prefers the requested color variant", () => {
    const r = recommend(
      { ...emptyBrief, concept: "Steakhouse serving grilled entrees" },
      collections,
      items,
    );
    expect(
      r.recommendations[0].featuredItem?.dimensions?.length,
    ).toBeGreaterThanOrEqual(10.5);
    const p = parseBrief({
      ...emptyBrief,
      theme: "sage green",
      concept: "Outdoor dining",
    });
    expect(selectRepresentativeItem(pieces("milestone"), p)?.color).toMatch(
      /green/,
    );
  });
});
