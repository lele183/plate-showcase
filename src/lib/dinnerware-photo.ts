import type { CatalogItem } from "./types";

export type SurfaceMode = "photo" | "glaze" | "glass";

/** A product silhouette is suitable for top projection only when its pose agrees with its footprint. */
export function analyzeDinnerwarePhoto(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  item: CatalogItem,
  allowProjection: boolean,
  fallbackColor: string,
) {
  let left = width,
    top = height,
    right = -1,
    bottom = -1;
  let transparent = false;
  let area = 0;
  const rows = new Array<number>(height).fill(0);
  const colors = new Map<
    number,
    { count: number; r: number; g: number; b: number }
  >();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (pixels[i + 3] < 128) {
        transparent = true;
        continue;
      }
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      area++;
      rows[y]++;
      const r = pixels[i],
        g = pixels[i + 1],
        b = pixels[i + 2];
      if (pixels[i + 3] < 224 || r + g + b < 75 || r + g + b > 744) continue;
      const key =
        Math.floor(r / 24) * 121 + Math.floor(g / 24) * 11 + Math.floor(b / 24);
      const bin = colors.get(key) || { count: 0, r: 0, g: 0, b: 0 };
      bin.count++;
      bin.r += r;
      bin.g += g;
      bin.b += b;
      colors.set(key, bin);
    }
  }
  const valid = right > left && bottom > top;
  const bounds = valid
    ? {
        x: left / width,
        y: top / height,
        width: (right - left + 1) / width,
        height: (bottom - top + 1) / height,
      }
    : { x: 0, y: 0, width: 1, height: 1 };
  let color = fallbackColor;
  if (transparent && valid) {
    let dominant:
      { count: number; r: number; g: number; b: number } | undefined;
    for (const bin of colors.values())
      if (!dominant || bin.count > dominant.count) dominant = bin;
    if (dominant)
      color =
        "#" +
        [dominant.r, dominant.g, dominant.b]
          .map((value) =>
            Math.round(value / dominant.count)
              .toString(16)
              .padStart(2, "0"),
          )
          .join("");
  }
  const length = item.dimensions?.length;
  const span = item.dimensions?.width;
  const expectedAspect =
    length && span
      ? span / length
      : ["oval", "rectangular"].includes(item.shape)
        ? 0.68
        : 1;
  const aspect = (bounds.height * height) / (bounds.width * width);
  let asymmetry = 0;
  if (valid) {
    for (let step = 2; step <= 4; step++) {
      const offset = Math.round(((bottom - top) * step) / 10);
      asymmetry +=
        Math.abs(rows[top + offset] - rows[bottom - offset]) /
        (right - left + 1);
    }
  }
  const coverage = valid ? area / ((right - left + 1) * (bottom - top + 1)) : 0;
  const projection: SurfaceMode =
    allowProjection &&
    transparent &&
    valid &&
    Math.abs(aspect / expectedAspect - 1) < 0.12 &&
    asymmetry / 3 < 0.1 &&
    (!["square", "rectangular"].includes(item.shape) || coverage > 0.84)
      ? "photo"
      : "glaze";
  return { bounds, color, projection };
}
