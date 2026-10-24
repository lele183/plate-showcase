import type { Scene } from "./types";

export type WorkspaceJob = {
  id: string;
  kind: string;
  status: string;
  progress: number;
  error?: string;
  result?: { text?: string; catalogId?: string; itemCount?: number };
  input?: { catalogId?: string; filename?: string };
  created_at: string;
};

export function validateWorkspaceFile(
  file: Pick<File, "name" | "size">,
  kind: "menu" | "catalog",
  local = false,
) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (
    !(
      kind === "catalog"
        ? ["pdf"]
        : ["pdf", "docx", "txt", "png", "jpg", "jpeg", "webp"]
    ).includes(extension)
  )
    return kind === "catalog"
      ? "Choose a PDF for your dinnerware catalog."
      : "Choose a PDF, Word (.docx), text, JPG, PNG, or WebP menu.";
  if (!file.size)
    return kind === "catalog"
      ? "This PDF is empty. Choose a catalog with content and try again."
      : "This file is empty. Choose a menu with content or paste your dishes below.";
  const limit = local ? 20 : 100;
  if (file.size > limit * 1024 * 1024)
    return local
      ? "This file is over 20 MB. Choose a smaller file, paste the dishes below, or sign in for files up to 100 MB."
      : "This file is over 100 MB. Choose a smaller file and try again.";
  if (!local && file.name.length > 180)
    return "This filename is too long. Shorten it to 180 characters or fewer and try again.";
  return "";
}

export function jobDescription(job: WorkspaceJob) {
  const catalog = job.kind === "catalog";
  const food = job.kind === "food-preview";
  switch (job.status) {
    case "queued":
      return {
        title: "Waiting to process",
        detail:
          "Your file is uploaded. Processing will start in the background.",
      };
    case "running":
      return {
        title: catalog
          ? "Reading catalog"
          : food
            ? "Preparing food preview"
            : "Reading menu",
        detail: catalog
          ? "Extracting collections and pieces. You can leave this page and return to check progress."
          : food
            ? "Open the food preview to check its progress in the studio."
            : "Extracting the dishes from your file. Your menu will appear here when it is ready.",
      };
    case "completed":
      return catalog
        ? {
            title: "Catalog processed",
            detail: "Open the catalog to check its details before using it.",
          }
        : food
          ? {
              title: "Food preview ready",
              detail: "Open the food preview to continue in the studio.",
            }
          : job.result?.text?.trim()
            ? {
                title: "Menu ready to review",
                detail:
                  "Check the dishes below, correct anything needed, then use this menu to find dinnerware.",
              }
            : {
                title: "No menu text found",
                detail:
                  "Try a clearer PDF or image, or type or paste the dishes below. Your menu is not ready to use yet.",
              };
    case "review":
      return {
        title: "Catalog ready for review",
        detail: `${job.result?.itemCount ? `${job.result.itemCount} pieces found. ` : ""}Check the source and correct the details, then activate this catalog for recommendations.`,
      };
    case "failed":
      return {
        title: catalog
          ? "Catalog import failed"
          : food
            ? "Food preview failed"
            : "Menu extraction failed",
        detail:
          job.error ||
          "Processing did not finish. Retry this import or choose another file.",
      };
    case "cancelled":
      return {
        title: "Processing cancelled",
        detail: "Choose a file to start again, or paste menu text below.",
      };
    default:
      return {
        title: "Checking progress",
        detail: "Refresh to check the latest processing status.",
      };
  }
}

export function sceneDescription(scene: Scene) {
  const surfaces: Record<string, string> = {
    oak: "Warm oak",
    dark: "Dark stone",
    white: "White linen",
    black: "Black linen",
    stone: "Light stone",
  };
  const foods: Record<string, string> = {
    none: "No food layer",
    salmon: "Salmon",
    vegetables: "Vegetables",
    toast: "Small plates",
    custom: "Your food photo",
    ai: "Saved food preview",
  };
  return `${surfaces[scene.tabletop] || scene.tabletop} / ${foods[scene.food] || scene.food}`;
}
