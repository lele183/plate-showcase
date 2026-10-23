import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import seed from "../../src/data/catalog.json";
import sources from "../../resources/studio-photo-sources.json";
import associations from "../../resources/studio-photo-aliases.json";
import coverage from "../../resources/studio-photo-unavailable.json";

describe("official tabletop photographs", () => {
  it("accounts for every baseline item and retains scans for unresolved photographs", () => {
    expect(coverage.preparedCatalogRecords).toBe(sources.images.length);
    const prepared = new Set(sources.images.map((source) => source.itemId));
    const unresolved = new Set(
      coverage.unavailable.map((source) => source.itemId),
    );
    expect(unresolved.size).toBe(coverage.unavailable.length);
    expect(prepared.size + unresolved.size).toBe(seed.items.length);
    for (const item of seed.items) {
      expect(
        Number(prepared.has(item.id)) + Number(unresolved.has(item.id)),
        item.id,
      ).toBe(1);
      if (unresolved.has(item.id))
        expect(item.studioImage, item.id).not.toContain("/studio-photo-");
    }
  });

  it("maps each photograph to the exact catalog SKU and keeps the scan available", () => {
    expect(sources.images.length).toBeGreaterThanOrEqual(30);
    const ids = new Set<string>();
    for (const source of sources.images) {
      expect(ids.has(source.itemId), source.itemId).toBe(false);
      ids.add(source.itemId);
      const item = seed.items.find((item) => item.id === source.itemId)!;
      expect(item, source.itemId).toBeDefined();
      expect(item.sku).toBe(source.sku);
      expect(item.collectionId).toBe(source.collectionId);
      expect(item.studioImage).toBe(source.output);
      expect(item.image).toBe(source.catalogImage);
      expect(item.image).not.toBe(source.output);
      if ("officialSku" in source) {
        const association = (
          associations.aliases as Record<
            string,
            { officialSku: string; note: string }
          >
        )[source.itemId];
        expect(association, source.itemId).toBeDefined();
        expect(source.officialSku).toBe(association.officialSku);
      }
      expect(new URL(source.sourceUrl).hostname).toBe("yancochina.com");
      expect(new URL(source.productUrl).hostname).toBe("yancochina.com");
    }
    expect(
      sources.images.find((source) => source.itemId === "legna:LE-711"),
    ).toBeDefined();
  });

  it("publishes genuine detail, intact alpha, and reproducible output hashes", async () => {
    for (const source of sources.images) {
      const image = await readFile("public" + source.output);
      expect(createHash("sha256").update(image).digest("hex")).toBe(
        source.outputSha256,
      );
      const { data, info } = await sharp(image)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect([info.width, info.height], source.itemId).toEqual(
        source.outputSize,
      );
      expect(Math.max(info.width, info.height)).toBeLessThanOrEqual(1400);
      for (const dimension of [0, 1])
        expect(source.sourceSize[dimension]).toBeGreaterThanOrEqual(
          source.outputSize[dimension],
        );
      let left = info.width,
        right = 0,
        top = info.height,
        bottom = 0;
      for (let y = 0; y < info.height; y++)
        for (let x = 0; x < info.width; x++) {
          if (data[(y * info.width + x) * 4 + 3] < 128) continue;
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      const minimum =
        "minimumNativeSubjectPixels" in source
          ? Number(source.minimumNativeSubjectPixels)
          : 1000;
      expect([640, 1000]).toContain(minimum);
      const subjectPixels = Math.max(right - left + 1, bottom - top + 1);
      expect(subjectPixels, source.itemId).toBeGreaterThanOrEqual(minimum);
      if ("nativeSubjectPixels" in source)
        expect(
          Math.abs(Number(source.nativeSubjectPixels) - subjectPixels),
          source.itemId,
        ).toBeLessThanOrEqual(2);
      expect(left, source.itemId).toBeGreaterThan(0);
      expect(top, source.itemId).toBeGreaterThan(0);
      expect(right, source.itemId).toBeLessThan(info.width - 1);
      expect(bottom, source.itemId).toBeLessThan(info.height - 1);
    }
  }, 180000);
});
