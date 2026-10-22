import { emptyBrief, type RestaurantBrief } from "./types";
import { readStorage, writeStorage } from "./browser-storage";

export function parseStoredBrief(raw: string | null): RestaurantBrief {
  const brief = { ...emptyBrief };
  try {
    const value: unknown = JSON.parse(raw || "null");
    if (!value || typeof value !== "object" || Array.isArray(value))
      return brief;
    for (const key of Object.keys(brief) as (keyof RestaurantBrief)[]) {
      const field = (value as Record<string, unknown>)[key];
      if (typeof field === "string")
        brief[key] = field.slice(0, key === "foods" ? 80000 : 3000);
    }
  } catch {}
  return brief;
}

export function readStoredBrief(): RestaurantBrief {
  return parseStoredBrief(readStorage("yanco-brief"));
}

export function writeStoredBrief(brief: RestaurantBrief): boolean {
  return writeStorage("yanco-brief", JSON.stringify(brief));
}
