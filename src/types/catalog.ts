/** Shared browser-safe catalog presentation constants. */
export const CATALOG_PDF_URL = "/catalog/yanco-2026.pdf";
export const CATALOG_PDF_FILENAME = "Yanco-2026-Catalog.pdf";
/** Stable API identifiers; visible titles describe concept, signature and value groups. */
export type RecommendationGroup = "Popular" | "Unique" | "Budget";
export type DishIntent = "pasta" | "soup" | "steak" | "sushi" | "sharing";

export const THREE_D_SUPPORTED_TYPES: ReadonlySet<string> = new Set([
  "plate",
  "platter",
  "tray",
  "saucer",
]);

/** Only applies to cropped source-photo fallbacks, never authentic cutouts. */
export const STUDIO_FALLBACK_CROP_RADIUS = 0.485;
