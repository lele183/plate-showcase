import { z } from "zod";
import {
  requireUser,
  apiError,
  ApiError,
  sameOrigin,
  readJson,
} from "@/lib/api";
const scene = z.object({
  collectionId: z.string().max(200),
  itemId: z.string().max(250),
  tabletop: z.enum(["oak", "dark", "white", "black", "stone"]),
  food: z.string().max(100),
  foodUrl: z.string().max(3000).optional(),
  cropPercent: z.number().min(100).max(250).optional(),
  scale: z.number().min(0.2).max(2),
  rotation: z.number().min(-360).max(360),
  x: z.number().min(-35).max(35),
  y: z.number().min(-35).max(35),
});
export async function GET() {
  try {
    const { client } = await requireUser();
    const { data, error } = await client
      .from("yanco_scenes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return Response.json({ scenes: data });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { client, user } = await requireUser();
    const body = z
      .object({ name: z.string().min(1).max(100), data: scene })
      .safeParse(await readJson(request));
    if (!body.success) throw new ApiError("This scene is incomplete.");
    if (
      body.data.data.foodUrl?.startsWith("blob:") ||
      body.data.data.foodUrl?.startsWith("data:")
    )
      throw new ApiError("Upload the food image before saving this scene.");
    if (body.data.data.foodUrl) {
      const reference = new URL(
        body.data.data.foodUrl,
        "https://scene.invalid",
      );
      if (
        reference.origin !== "https://scene.invalid" ||
        reference.pathname !== "/api/assets" ||
        !reference.searchParams.get("path")?.startsWith(`${user.id}/`)
      )
        throw new ApiError("Choose an image from your own uploads.");
    }
    const { data, error } = await client
      .from("yanco_scenes")
      .insert({ owner_id: user.id, ...body.data })
      .select("id")
      .single();
    if (error) throw error;
    return Response.json(data);
  } catch (e) {
    return apiError(e);
  }
}
