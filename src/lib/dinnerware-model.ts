import type { CatalogItem } from "./types";
import { THREE_D_SUPPORTED_TYPES } from "@/types/catalog";

export type CameraView = "perspective" | "overhead" | "profile";
export type StudioLighting = "daylight" | "studio";
export type DinnerwareFamily =
  "rimmed" | "coupe" | "bowl" | "tray" | "cup" | "mug" | "glass";
export type DividerLayout =
  | "three-radial"
  | "three-curved"
  | "three-holder"
  | "two"
  | "three"
  | "four"
  | "four-server"
  | "four-server-reverse"
  | "six"
  | "six-left"
  | "six-right"
  | "six-center"
  | "holder"
  | "three-holders";

export function dividerLayout(item: CatalogItem): DividerLayout | null {
  const sku = item.sku;
  if (/^(NC-51[02]|NS-703|RE-309)/i.test(sku)) return "three-curved";
  if (/^NC-511/i.test(sku)) return "three-holder";
  if (/^(NS-70[12]|MS-710)/i.test(sku) && /compart/i.test(item.name))
    return "three-radial";
  if (sku === "NC-801S") return "six-left";
  if (sku === "NC-802S") return "six-right";
  if (/^NS-803/i.test(sku)) return "six-center";
  if (sku === "NC-2162") return "six";
  if (sku === "NC-2520") return "four-server";
  if (sku === "NC-7510") return "four-server-reverse";
  if (sku === "NC-4420") return "four";
  if (sku === "NC-4600") return "three-holders";
  if (sku === "NC-7521") return "holder";
  if (sku === "NC-4520") return "two";
  if (sku === "JP-0001") return "two";
  if (!/compart|divid/i.test(item.name)) return null;
  if (/six|6[- ]/i.test(item.name)) return "six";
  if (/four|4[- ]/i.test(item.name)) return "four";
  if (/three|3[- ]|triple/i.test(item.name))
    return item.shape === "round" ? "three-radial" : "three";
  if (/two|2[- ]|double/i.test(item.name)) return "two";
  return null;
}

export function supportsDinnerware(item: CatalogItem) {
  return (
    THREE_D_SUPPORTED_TYPES.has(item.type) &&
    !/egg holder|taco|with lid|with three round dish/i.test(item.name) &&
    !(
      /compart|divid/i.test(item.name) &&
      (!dividerLayout(item) || item.shape === "irregular")
    )
  );
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const positive = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;

export function dinnerwareModel(item: CatalogItem) {
  const isCup = item.type === "cup";
  const isGlass = item.type === "glass";
  const isUpright = isCup || isGlass;
  const hasHandle =
    (isGlass && /beer mug/i.test(item.name)) ||
    (isCup &&
      (/mug|coffee|espresso|cappuccino|with handle/i.test(item.name) ||
        !/tea|wine|chinese|bouillon|soup|sake/i.test(item.name)));
  const dividers = dividerLayout(item);
  const isBowl = ["bowl", "sauce dish", "ramekin"].includes(item.type);
  const length = positive(item.dimensions?.length);
  const width = positive(item.dimensions?.width);
  const height = positive(item.dimensions?.height);
  const family: DinnerwareFamily = isGlass
    ? "glass"
    : isCup
      ? hasHandle
        ? "mug"
        : "cup"
      : dividers
        ? item.type === "tray" || ["square", "rectangular"].includes(item.shape)
          ? "tray"
          : "rimmed"
        : isBowl
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
      ? clamp((height / longSide) * 2, 0.05, isUpright ? 9 : 1.5)
      : isUpright
        ? /mug|tall/i.test(item.name)
          ? 2.1
          : 1.5
        : dividers
          ? /deep/i.test(item.name)
            ? 0.4
            : 0.22
          : isBowl
            ? 0.65
            : 0.14;
  return {
    url: isGlass
      ? `/models/dinnerware/glass-${item.sku.toLowerCase()}.glb`
      : `/models/dinnerware/${dividers ? `divided-${dividers}` : family}-${shape}.glb`,
    family,
    dividers,
    isCup,
    isGlass,
    isUpright,
    hasHandle,
    photoProjection: !isUpright && !dividers && family !== "bowl",
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
