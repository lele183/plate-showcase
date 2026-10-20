import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Box3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { dinnerwareModel, formatInches } from "../../src/lib/dinnerware-model";
import type { CatalogItem } from "../../src/lib/types";
import { THREE_D_SUPPORTED_TYPES } from "../../src/types/catalog";
import seed from "../../src/data/catalog.json";

const plate = seed.items.find((item) => item.sku === "MR-710") as CatalogItem;

describe("catalog-driven dinnerware profiles", () => {
  it("uses measured oval proportions without the old oval distortion", () => {
    const model = dinnerwareModel({
      ...plate,
      shape: "oval",
      dimensions: { length: 16, width: 7, height: 1.25 },
    });
    expect(model.z / model.x).toBeCloseTo(7 / 16);
    expect(model.y / model.x).toBeCloseTo(1.25 / 16);
    expect(model.hasMeasuredHeight).toBe(true);
  });

  it("preserves wide pieces rather than clamping them to a square", () => {
    const model = dinnerwareModel({
      ...plate,
      shape: "rectangular",
      dimensions: { length: 7, width: 14, height: 1 },
    });
    expect(model.z / model.x).toBe(2);
    expect(model.z).toBe(2);
    expect(model.url).toContain("square.glb");
  });

  it("uses hollow profiles for bowls and deep plates", () => {
    expect(dinnerwareModel({ ...plate, type: "bowl" }).family).toBe("bowl");
    expect(
      dinnerwareModel({
        ...plate,
        name: "Soup plate",
        dimensions: { length: 10, width: null, height: 2 },
      }).family,
    ).toBe("bowl");
    expect(dinnerwareModel(plate).family).toBe("coupe");
  });

  it("keeps missing measurements explicit and rejects invalid dimensions", () => {
    const model = dinnerwareModel({
      ...plate,
      dimensions: { length: NaN, width: -1, height: 0 },
    });
    expect(model.dimensions).toEqual([]);
    expect(model.hasMeasuredHeight).toBe(false);
    expect([model.x, model.y, model.z].every(Number.isFinite)).toBe(true);
    expect(formatInches(9.0625)).toBe("9 1/16");
    expect(formatInches(10.25)).toBe("10 1/4");
    expect(formatInches(1.3)).toBe("1.3");
  });

  it("has an exported Blender asset for every supported catalog record", () => {
    const urls = new Set(
      seed.items
        .filter((item) => THREE_D_SUPPORTED_TYPES.has(item.type))
        .map((item) => dinnerwareModel(item as CatalogItem).url),
    );
    for (const url of urls)
      expect(existsSync(resolve("public", url.slice(1))), url).toBe(true);
  });

  it("exports valid, normalized meshes in browser coordinates", async () => {
    for (const family of ["coupe", "rimmed", "bowl", "tray"]) {
      const file = readFileSync(
        resolve("public/models/dinnerware", `${family}-round.glb`),
      );
      const buffer = file.buffer.slice(
        file.byteOffset,
        file.byteOffset + file.byteLength,
      );
      const gltf = await new GLTFLoader().parseAsync(buffer, "");
      const bounds = new Box3().setFromObject(gltf.scene);
      expect(bounds.min.y).toBeCloseTo(0, 2);
      expect(bounds.max.y).toBeCloseTo(1, 2);
      expect(bounds.max.x - bounds.min.x).toBeCloseTo(2, 2);
      expect(bounds.max.z - bounds.min.z).toBeCloseTo(2, 2);
      gltf.scene.traverse((object) => {
        if ("geometry" in object) {
          const geometry = object.geometry as import("three").BufferGeometry;
          const positions = geometry.getAttribute("position");
          expect([...positions.array].every(Number.isFinite)).toBe(true);
          geometry.dispose();
        }
      });
    }
  });
});
