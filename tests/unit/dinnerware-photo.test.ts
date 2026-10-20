import { describe, expect, it } from "vitest";
import sharp from "sharp";
import seed from "../../src/data/catalog.json";
import { analyzeDinnerwarePhoto } from "../../src/lib/dinnerware-photo";
import { dinnerwareModel } from "../../src/lib/dinnerware-model";
import type { CatalogItem } from "../../src/lib/types";

describe("catalog photo projection", () => {
  it("projects a top photograph but keeps a cup and tilted bowl off the top surface", async () => {
    for (const [id, expected] of [
      ["mars:MR-710", "photo"],
      ["mars:MR-508", "glaze"],
      ["legna:LE-012", "glaze"],
      ["compartment:NC-510I", "glaze"],
    ]) {
      const item = seed.items.find((item) => item.id === id) as CatalogItem;
      const { data, info } = await sharp("public" + item.studioImage)
        .resize({ width: 256 })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const analysis = analyzeDinnerwarePhoto(
        new Uint8ClampedArray(data),
        info.width,
        info.height,
        item,
        dinnerwareModel(item).photoProjection,
        "#eeeeee",
      );
      expect(analysis.projection, id).toBe(expected);
      expect(analysis.color).toMatch(/^#[a-f0-9]{6}$/);
    }
  });

  it("rejects an oblique round plate rather than stretching its ellipse over the mesh", () => {
    const item = seed.items.find(
      (item) => item.id === "mars:MR-710",
    ) as CatalogItem;
    const width = 100,
      height = 100;
    const ellipse = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (((x - 50) / 44) ** 2 + ((y - 50) / 23) ** 2 < 1)
          ellipse.set([88, 132, 144, 255], (y * width + x) * 4);
    const surface = analyzeDinnerwarePhoto(
      ellipse,
      width,
      height,
      item,
      true,
      "#eeeeee",
    );
    expect(surface.projection).toBe("glaze");
    expect(surface.color).toBe("#588490");
    expect(surface.bounds.width).toBeGreaterThan(surface.bounds.height * 1.5);
  });
});
