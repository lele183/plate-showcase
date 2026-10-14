import type { CatalogItem } from "./types";
export type PieceGroup = { id: string; name: string; items: CatalogItem[] };

/** Display families preserve every SKU for matching, specifications and previews. */
export function groupPieces(items: CatalogItem[]): PieceGroup[] {
  const groups = new Map<string, PieceGroup>();
  for (const item of items) {
    const key = JSON.stringify([
      item.collectionId,
      item.name.trim().toLowerCase().replace(/\s+/g, " "),
      item.type,
      item.shape,
      item.color,
      item.material || "",
      item.sourcePage,
    ]);
    const group = groups.get(key);
    if (group) group.items.push(item);
    else groups.set(key, { id: item.id, name: item.name, items: [item] });
  }
  return [...groups.values()];
}
export function measurement(value: number): string {
  const sixteenths = Math.round(value * 16);
  if (Math.abs(sixteenths / 16 - value) > 0.00001)
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(
      value,
    );
  const whole = Math.floor(sixteenths / 16),
    remainder = sixteenths % 16;
  const fractions: Record<number, string> = {
    2: "⅛",
    4: "¼",
    6: "⅜",
    8: "½",
    10: "⅝",
    12: "¾",
    14: "⅞",
  };
  if (!remainder) return String(whole);
  return `${whole || ""}${fractions[remainder] || `${whole ? " " : ""}${remainder}/16`}`;
}
export function primarySize(item: CatalogItem): string {
  const d = item.dimensions;
  if (d?.length)
    return `${measurement(d.length)}″${d.width ? ` × ${measurement(d.width)}″` : ""}`;
  return item.capacityOz
    ? `${measurement(item.capacityOz)} oz`
    : "See specifications";
}
export function pieceMatches(item: CatalogItem, query: string): boolean {
  return `${item.sku} ${item.name} ${item.shape} ${item.color} ${item.specification} ${primarySize(item)} ${Object.values(item.dimensions || {}).join(" ")} ${item.capacityOz || ""}`
    .toLowerCase()
    .includes(query.trim().toLowerCase());
}
