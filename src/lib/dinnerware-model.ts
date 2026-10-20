import type { CatalogItem } from "./types";

export type CameraView = "perspective" | "overhead" | "profile";
export type StudioLighting = "daylight" | "studio";
export type DinnerwareFamily = "rimmed" | "coupe" | "bowl" | "tray";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const positive = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;

export function dinnerwareModel(item: CatalogItem) {
  const isBowl = ["bowl", "sauce dish", "ramekin"].includes(item.type);
  const length = positive(item.dimensions?.length);
  const width = positive(item.dimensions?.width);
  const height = positive(item.dimensions?.height);
  const family: DinnerwareFamily = isBowl
    ? "bowl"
    : item.type === "tray"
      ? "tray"
      : /coupe/i.test(item.name)
        ? "coupe"
        : height && length && height / length > 0.15
          ? "bowl"
          : "rimmed";
  const shape = ["square", "rectangular"].includes(item.shape)
    ? "square"
    : ["triangular", "irregular"].includes(item.shape)
      ? item.shape
      : "round";
  const longSide = Math.max(length || 0, width || 0);
  const aspect =
    length && width
      ? clamp(width / length, 0.15, 3)
      : item.shape === "oval" || item.shape === "rectangular"
        ? 0.68
        : 1;
  const x = aspect > 1 ? 2 / aspect : 2;
  const z = aspect > 1 ? 2 : 2 * aspect;
  const y =
    height && longSide
      ? clamp((height / longSide) * 2, 0.05, 1.5)
      : isBowl
        ? 0.65
        : 0.14;
  return {
    url: `/models/dinnerware/${family}-${shape}.glb`,
    family,
    x,
    y,
    z,
    wellHeight: y * (family === "bowl" ? 0.12 : 0.23),
    hasMeasuredHeight: Boolean(height && longSide),
    dimensions: [
      length ? `${formatInches(length)} in` : "",
      width ? `${formatInches(width)} in` : "",
      height ? `${formatInches(height)} in high` : "",
    ].filter(Boolean),
  };
}

export function formatInches(value: number) {
  const whole = Math.floor(value);
  const sixteenths = Math.round((value - whole) * 16);
  if (Math.abs(value - whole - sixteenths / 16) > 0.0001) return String(value);
  const fractions = [
    "",
    "1/16",
    "1/8",
    "3/16",
    "1/4",
    "5/16",
    "3/8",
    "7/16",
    "1/2",
    "9/16",
    "5/8",
    "11/16",
    "3/4",
    "13/16",
    "7/8",
    "15/16",
  ];
  if (sixteenths === 16) return String(whole + 1);
  return [whole || "", fractions[sixteenths]].filter(Boolean).join(" ") || "0";
}
