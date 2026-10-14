import { z } from "zod";
import type { Scene } from "./types";
import { studioParams } from "./url-state";

export const GUEST_WORKSPACE_KEY = "yanco_guest_workspace_v1";
const menuSchema = z.object({
  text: z.string().max(80000),
  filename: z.string().max(250).optional(),
  preview: z
    .string()
    .max(1500000)
    .regex(/^data:image\/(jpeg|png|webp);base64,/)
    .optional(),
});
const sceneSchema = z.object({
  collectionId: z.string().min(1).max(150),
  itemId: z.string().min(1).max(200),
  tabletop: z.enum(["oak", "dark", "white", "black", "stone"]),
  food: z.enum(["salmon", "vegetables", "toast", "none"]),
  scale: z.number().min(0.3).max(1.8),
  rotation: z.number().min(-180).max(180),
  x: z.number().min(-35).max(35),
  y: z.number().min(-35).max(35),
  cropPercent: z.number().min(100).max(250).optional(),
});
const draftSchema = z.object({
  id: z.string().max(100),
  name: z.string().max(150),
  created: z.number(),
  view: z.enum(["top", "3d"]).default("top"),
  data: sceneSchema,
});
const workspaceSchema = z.object({
  version: z.literal(1),
  menu: menuSchema,
  scenes: z.array(draftSchema).max(20),
});
export type GuestWorkspaceData = z.infer<typeof workspaceSchema>;
export type GuestMenu = GuestWorkspaceData["menu"];
export function emptyGuestWorkspace(): GuestWorkspaceData {
  return { version: 1, menu: { text: "" }, scenes: [] };
}
export function parseGuestWorkspace(raw: string | null): GuestWorkspaceData {
  try {
    return workspaceSchema.parse(JSON.parse(raw || "null"));
  } catch {
    return emptyGuestWorkspace();
  }
}
export function readGuestWorkspace() {
  return parseGuestWorkspace(localStorage.getItem(GUEST_WORKSPACE_KEY));
}
export function writeGuestMenu(menu: GuestMenu) {
  const data = readGuestWorkspace();
  data.menu = menuSchema.parse(menu);
  localStorage.setItem(GUEST_WORKSPACE_KEY, JSON.stringify(data));
}
export function saveGuestScene(name: string, scene: Scene, view: string) {
  const data = readGuestWorkspace();
  const publicScene = sceneSchema.parse({
    ...scene,
    food: ["custom", "ai"].includes(scene.food) ? "none" : scene.food,
  });
  const draft = draftSchema.parse({
    id: crypto.randomUUID(),
    name: name.slice(0, 150),
    created: Date.now(),
    view,
    data: publicScene,
  });
  data.scenes = [draft, ...data.scenes].slice(0, 20);
  localStorage.setItem(GUEST_WORKSPACE_KEY, JSON.stringify(data));
  return draft;
}
export function guestSceneLink(draft: GuestWorkspaceData["scenes"][number]) {
  return `/studio?${studioParams(draft.data, draft.view)}`;
}
