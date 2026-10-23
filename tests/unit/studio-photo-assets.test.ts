import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import seed from "../../src/data/catalog.json";
import sources from "../../resources/studio-photo-sources.json";

describe("official tabletop photographs", () => {
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
      expect(
        Math.max(right - left, bottom - top),
        source.itemId,
      ).toBeGreaterThan(1000);
      expect(left, source.itemId).toBeGreaterThan(0);
      expect(top, source.itemId).toBeGreaterThan(0);
      expect(right, source.itemId).toBeLessThan(info.width - 1);
      expect(bottom, source.itemId).toBeLessThan(info.height - 1);
    }
  }, 30000);
});
