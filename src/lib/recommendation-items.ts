import type { CatalogItem, ParsedBrief } from "./types";
import type { DishIntent } from "@/types/catalog";
const colorAliases: Record<string, string[]> = {
  blue: ["blue", "navy", "cobalt"],
  green: ["green", "sage", "olive"],
  brown: ["brown", "bronze"],
  white: ["white"],
  ivory: ["ivory", "cream"],
  gray: ["gray", "grey"],
};
export function itemHasColor(item: CatalogItem, color: string) {
  return (colorAliases[color] || [color]).some((value) =>
    new RegExp(`\\b${value}\\b`, "i").test(item.color),
  );
}

/** Capability suggestions use verified dimensions/names; strict filters run first. */
export function supportsDish(item: CatalogItem, dish: DishIntent) {
  const size = item.dimensions?.length;
  const round = item.shape === "round";
  const servingPiece = ["plate", "platter", "tray"].includes(item.type);
  switch (dish) {
    case "pasta":
      return (
        !/compartment|divided|bento/i.test(item.name) &&
        round &&
        size != null &&
        size >= 8.5 &&
        size <= 11.5 &&
        (item.type === "bowl" ||
          (item.type === "plate" &&
            /pasta|soup|(?:deep|coupe)(?:\s+(?:round|rimmed))?\s+(?:plate|bowl|dish)/i.test(
              item.name,
            )))
      );
    case "soup":
      return (
        round &&
        ((item.type === "bowl" &&
          ((size != null && size >= 5 && size <= 11.5) ||
            (item.capacityOz != null &&
              item.capacityOz >= 12 &&
              item.capacityOz <= 64))) ||
          (item.type === "plate" && /soup|pasta|deep/i.test(item.name)))
      );
    case "steak":
      return servingPiece && size != null && size >= 10.5;
    case "sushi":
      return (
        servingPiece &&
        ["rectangular", "oval"].includes(item.shape) &&
        (size == null || size >= 8)
      );
    case "sharing":
      return (
        servingPiece &&
        ["rectangular", "oval"].includes(item.shape) &&
        (size == null || size >= 9)
      );
  }
}

export function selectRepresentativeItem(
  items: CatalogItem[],
  parsed: ParsedBrief,
): CatalogItem | undefined {
  const hasServingDish = parsed.dishes.length > 0;
  function score(item: CatalogItem) {
    const size = item.dimensions?.length;
    let points = parsed.dishes.some((dish) => supportsDish(item, dish))
      ? 20
      : 0;
    if (
      parsed.dishes.includes("pasta") &&
      supportsDish(item, "pasta") &&
      /pasta/i.test(item.name)
    )
      points += 6;
    if (
      parsed.dishes.includes("sushi") &&
      supportsDish(item, "sushi") &&
      /sushi|sashimi/i.test(item.name)
    )
      points += 6;
    if (
      item.shape === "round" &&
      item.type === "plate" &&
      size != null &&
      size >= 9.5 &&
      size <= 11.5 &&
      !parsed.dishes.some((dish) => dish === "sushi" || dish === "sharing")
    )
      points += 12;
    if (item.studioImage && item.sourceVerified) points += 5;
    if (parsed.themeColors.some((color) => itemHasColor(item, color)))
      points += 8;
    if (
      hasServingDish &&
      ["cup", "saucer", "sauce dish", "accessory"].includes(item.type)
    )
      points -= 12;
    return points;
  }
  return items
    .filter((item) => Boolean(item.image?.trim()))
    .sort(
      (a, b) =>
        score(b) - score(a) ||
        a.sku.localeCompare(b.sku) ||
        a.id.localeCompare(b.id),
    )[0];
}
