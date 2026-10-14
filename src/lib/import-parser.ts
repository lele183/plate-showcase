import type { CatalogItem } from "./types";
export function parseMeasurement(text: string) {
  const normalized = text
    .replaceAll("½", " 1/2")
    .replaceAll("¼", " 1/4")
    .replaceAll("¾", " 3/4")
    .replace(/([0-9])([1-7])\/([248])/g, "$1 $2/$3")
    .trim();
  let result = 0;
  for (const part of normalized.split(/\s+/)) {
    if (part.includes("/")) {
      const [a, b] = part.split("/").map(Number);
      if (!b) return null;
      result += a / b;
    } else result += Number(part);
  }
  return Number.isFinite(result) && result > 0
    ? Math.round(result * 10000) / 10000
    : null;
}
export function parseDimensions(text: string) {
  const matches = [
    ...text.matchAll(/(\d+(?:\s+\d+\/\d+|\/\d+|\.\d+)?)\s*["”]/g),
  ].map((m) => parseMeasurement(m[1]));
  if (!matches.length || matches.some((n) => n !== null && n > 60)) return null;
  return {
    length: matches[0],
    width: matches[1] ?? null,
    height: matches[2] ?? null,
  };
}
export function inferType(name: string) {
  const value = name.toLowerCase();
  for (const type of [
    "saucer",
    "cup",
    "mug",
    "bowl",
    "platter",
    "plate",
    "tray",
    "glass",
    "spoon",
    "pitcher",
  ])
    if (value.includes(type)) return type === "mug" ? "cup" : type;
  return "accessory";
}
export function inferShape(name: string) {
  for (const shape of [
    "rectangular",
    "square",
    "triangular",
    "triangle",
    "oval",
    "irregular",
    "round",
  ])
    if (name.toLowerCase().includes(shape))
      return shape === "triangle" ? "triangular" : shape;
  return ["plate", "bowl", "cup", "saucer"].includes(inferType(name))
    ? "round"
    : "other";
}
export function parseImportRows(
  text: string,
  collectionId: string,
  page: number,
): CatalogItem[] {
  const lines = text
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const result: CatalogItem[] = [];
  let heading = "Catalog item";
  const sku = /\b([A-Z]{1,4})-([0-9OIl]{1,5}[A-Z0-9]*(?:-[A-Z0-9]+)*)\b/gi;
  for (const line of lines) {
    const matches = [...line.matchAll(sku)];
    if (!matches.length) {
      if (
        /plate|bowl|cup|mug|saucer|tray|platter|glass|pitcher|spoon/i.test(
          line,
        ) &&
        line.length < 100
      )
        heading = line;
      continue;
    }
    if (/\bfor\b/i.test(line) && !/["”]|\b(?:oz|qt|dz)\b/i.test(line)) continue;
    for (let index = 0; index < matches.length; index++) {
      const match = matches[index];
      const code = match[2].replace(/^[0-9OIl]+/, (s) =>
        s
          .toUpperCase()
          .replaceAll("O", "0")
          .replaceAll("I", "1")
          .replaceAll("L", "1"),
      );
      const id = match[1].toUpperCase() + "-" + code;
      const specification = line
        .slice(match.index, matches[index + 1]?.index)
        .trim()
        .replace(match[0], id);
      const body = specification
        .replace(id, "")
        .replaceAll("½", " 1/2")
        .replaceAll("¼", " 1/4")
        .replaceAll("¾", " 3/4");
      const cap = body.match(/(\d+(?:\.\d+)?)\s*(oz|0z|qt|ml)\b/i);
      const pack = body.match(/(\d+)\s*(?:DZ|PC|SET)\b/i);
      const color =
        [
          "black",
          "blue",
          "green",
          "yellow",
          "red",
          "brown",
          "white",
          "ivory",
          "gray",
          "clear",
        ].find((c) => heading.toLowerCase().includes(c)) || "unspecified";
      result.push({
        id: `${collectionId}:${id}`,
        collectionId,
        sku: id,
        name: heading,
        type: inferType(heading),
        shape: inferShape(heading),
        color,
        dimensions: parseDimensions(body),
        capacityOz: cap
          ? Math.round(
              Number(cap[1]) *
                (/qt/i.test(cap[2])
                  ? 32
                  : /ml/i.test(cap[2])
                    ? 1 / 29.5735296
                    : 1) *
                1000,
            ) / 1000
          : null,
        casePack: pack ? pack[0] : null,
        specification,
        image: "",
        sourcePage: page,
        pdfPage: page,
        reviewNeeded: true,
      });
    }
  }
  return [...new Map(result.map((i) => [i.id, i])).values()];
}
