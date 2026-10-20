import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Box3, Raycaster, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  dinnerwareModel,
  formatInches,
  supportsDinnerware,
} from "../../src/lib/dinnerware-model";
import type { CatalogItem } from "../../src/lib/types";
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
        .filter((item) => supportsDinnerware(item as CatalogItem))
        .map((item) => dinnerwareModel(item as CatalogItem).url),
    );
    for (const url of urls)
      expect(existsSync(resolve("public", url.slice(1))), url).toBe(true);
  });

  it("chooses compartment layouts from the catalog rather than a flat plate", () => {
    const get = (id: string) =>
      dinnerwareModel(seed.items.find((item) => item.id === id) as CatalogItem);
    expect(get("compartment:NC-510I").dividers).toBe("three-curved");
    expect(get("compartment:NC-511I").dividers).toBe("three-holder");
    expect(get("compartment:NC-801S").dividers).toBe("six-left");
    expect(get("compartment:NC-802S").dividers).toBe("six-right");
    expect(get("compartment:NC-510I").photoProjection).toBe(false);
    expect(
      supportsDinnerware(
        seed.items.find((item) => item.sku === "NC-1014") as CatalogItem,
      ),
    ).toBe(false);
  });

  it("preserves tall cup proportions and distinguishes a mug from a handleless cup", () => {
    const mug = dinnerwareModel(
      seed.items.find((item) => item.id === "legna:LE-012") as CatalogItem,
    );
    const cup = dinnerwareModel(
      seed.items.find((item) => item.id === "fuji:FU-902") as CatalogItem,
    );
    expect(mug.family).toBe("mug");
    expect(mug.hasHandle).toBe(true);
    expect(mug.y / mug.x).toBeCloseTo(4 / 3.625);
    expect(mug.photoProjection).toBe(false);
    expect(cup.family).toBe("cup");
    expect(cup.hasHandle).toBe(false);
  });

  it("supports every glass record and preserves the AS-001 shot glass proportions", () => {
    const glasses = seed.items.filter((item) => item.type === "glass");
    expect(glasses.length).toBe(112);
    for (const item of glasses)
      expect(supportsDinnerware(item as CatalogItem), item.id).toBe(true);
    const shot = dinnerwareModel(
      glasses.find((item) => item.id === "aqua-spirits:AS-001") as CatalogItem,
    );
    expect(shot.family).toBe("glass");
    expect(shot.isUpright).toBe(true);
    expect(shot.photoProjection).toBe(false);
    expect(shot.url).toBe("/models/dinnerware/glass-as-001.glb");
    expect(shot.y / shot.x).toBeCloseTo(2.625 / 1.375);
    const flute = dinnerwareModel(
      glasses.find((item) => item.id === "aqua-spirits:AS-406") as CatalogItem,
    );
    expect(flute.y / flute.x).toBeCloseTo(9 / 2.625);
  });

  it("keeps bowl wells flat and level around their centers, including asymmetric outlines", async () => {
    for (const shape of ["round", "square", "triangular", "irregular"]) {
      const file = readFileSync(
        resolve("public/models/dinnerware", `bowl-${shape}.glb`),
      );
      const { scene } = await new GLTFLoader().parseAsync(
        file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
        "",
      );
      scene.updateMatrixWorld(true);
      const heights: number[] = [];
      for (let i = 0; i < 32; i++) {
        const angle = (i * Math.PI) / 16;
        const [hit] = new Raycaster(
          new Vector3(Math.cos(angle) * 0.14, 2, Math.sin(angle) * 0.14),
          new Vector3(0, -1, 0),
        ).intersectObject(scene, true);
        expect(hit, `${shape} well sample ${i}`).toBeDefined();
        heights.push(hit.point.y);
      }
      expect(Math.max(...heights) - Math.min(...heights), shape).toBeLessThan(
        0.000001,
      );
      expect(heights[0]).toBeGreaterThan(0.08);
      expect(heights[0]).toBeLessThan(0.2);
    }
  });

  it("exports distinct hollow shot, stemmed wine, martini and flute profiles", async () => {
    const wells: number[] = [];
    for (const [sku, minimum, maximum] of [
      ["as-001", 0.2, 0.35],
      ["as-111", 0.35, 0.55],
      ["as-508", 0.5, 0.7],
      ["as-406", 0.4, 0.55],
    ] as const) {
      const file = readFileSync(
        resolve("public/models/dinnerware", `glass-${sku}.glb`),
      );
      const { scene } = await new GLTFLoader().parseAsync(
        file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
        "",
      );
      scene.updateMatrixWorld(true);
      const [hit] = new Raycaster(
        new Vector3(0, 2, 0),
        new Vector3(0, -1, 0),
      ).intersectObject(scene, true);
      expect(hit.point.y, sku).toBeGreaterThan(minimum);
      expect(hit.point.y, sku).toBeLessThan(maximum);
      const bounds = new Box3().setFromObject(scene);
      expect(bounds.min.y, sku).toBeCloseTo(0, 4);
      expect(bounds.max.y, sku).toBeCloseTo(1, 4);
      wells.push(hit.point.y);
    }
    expect(new Set(wells).size).toBe(4);
  });

  it("exports real cavities, cup handles and raised divider walls", async () => {
    const load = async (name: string) => {
      const file = readFileSync(resolve("public/models/dinnerware", name));
      const gltf = await new GLTFLoader().parseAsync(
        file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
        "",
      );
      gltf.scene.updateMatrixWorld(true);
      return gltf.scene;
    };
    const mug = await load("mug-round.glb");
    const cavity = new Raycaster(
      new Vector3(0, 2, 0),
      new Vector3(0, -1, 0),
    ).intersectObject(mug, true);
    expect(cavity.length).toBeGreaterThan(0);
    expect(cavity[0].point.y).toBeLessThan(0.25);
    expect(new Box3().setFromObject(mug).max.x).toBeGreaterThan(1.5);
    const divided = await load("divided-three-radial-round.glb");
    const divider = new Raycaster(
      new Vector3(0, 2, 0),
      new Vector3(0, -1, 0),
    ).intersectObject(divided, true);
    const well = new Raycaster(
      new Vector3(0, 2, 0.45),
      new Vector3(0, -1, 0),
    ).intersectObject(divided, true);
    expect(divider[0].point.y).toBeGreaterThan(0.8);
    expect(well[0].point.y).toBeLessThan(0.4);
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
