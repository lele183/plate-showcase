import type { Scene } from "./types";

export const catalogCategories = [
  "all",
  "chinaware",
  "melamine",
  "glassware",
  "plasticware",
  "wood",
];
export function catalogFilters(params: URLSearchParams) {
  const category = params.get("category") || "all";
  return {
    query: (params.get("q") || "").slice(0, 200),
    category: catalogCategories.includes(category) ? category : "all",
    color: (params.get("color") || "all").slice(0, 80),
    budget: ["1", "2", "3"].includes(params.get("budget") || "")
      ? params.get("budget")!
      : "all",
  };
}

function bounded(
  params: URLSearchParams,
  name: string,
  fallback: number,
  min: number,
  max: number,
) {
  const raw = params.get(name);
  const value = raw?.trim() ? Number(raw) : NaN;
  return Number.isFinite(value)
    ? Math.round(Math.max(min, Math.min(max, value)) * 100) / 100
    : fallback;
}
function choice(
  params: URLSearchParams,
  name: string,
  options: string[],
  fallback: string,
) {
  const value = params.get(name) || "";
  return options.includes(value) ? value : fallback;
}
export function studioSettings(params: URLSearchParams) {
  return {
    tabletop: choice(
      params,
      "surface",
      ["oak", "dark", "white", "black", "stone"],
      "oak",
    ),
    food: choice(
      params,
      "food",
      ["salmon", "vegetables", "toast", "none", "custom", "ai"],
      studioView(params) === "3d" ? "none" : "salmon",
    ),
    scale: Math.round(bounded(params, "portion", 1, 0.3, 1.8) * 20) / 20,
    rotation: Math.round(bounded(params, "rotation", 0, -180, 180)),
    x: bounded(params, "x", 0, -35, 35),
    y: bounded(params, "y", 0, -35, 35),
    cropPercent: Math.round(bounded(params, "crop", 100, 100, 250)),
  };
}
export function studioView(params: URLSearchParams): "top" | "3d" {
  return params.get("view") === "3d" ? "3d" : "top";
}
// layout=1 makes omitted placement fields defaults, even when opening a saved scene.
export function studioParams(
  scene: Scene,
  view: string,
  current = new URLSearchParams(),
) {
  const params = new URLSearchParams(current);
  params.set("layout", "1");
  params.set("collection", scene.collectionId);
  params.set("item", scene.itemId);
  const fields = {
    surface: [scene.tabletop, "oak"],
    food: [scene.food, view === "3d" ? "none" : "salmon"],
    portion: [scene.scale, 1],
    rotation: [scene.rotation, 0],
    x: [scene.x, 0],
    y: [scene.y, 0],
    crop: [scene.cropPercent || 100, 100],
    view: [view, "top"],
  };
  for (const [key, [value, fallback]] of Object.entries(fields)) {
    if (value === fallback && !(key === "food" && view === "3d"))
      params.delete(key);
    else params.set(key, String(value));
  }
  return params;
}
export function replaceQuery(params: URLSearchParams) {
  const query = params.toString();
  const url = location.pathname + (query ? `?${query}` : "") + location.hash;
  if (url !== location.pathname + location.search + location.hash)
    window.history.replaceState(null, "", url);
}
