import { z } from "zod";
import { emptyBrief } from "@/lib/types";
import {
  requireUser,
  apiError,
  ApiError,
  sameOrigin,
  readJson,
} from "@/lib/api";
export async function GET() {
  try {
    const { client } = await requireUser();
    const { data, error } = await client
      .from("yanco_sessions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return Response.json({ sessions: data });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { client, user } = await requireUser();
    const body = z
      .object({
        name: z.string().min(1).max(100),
        data: z.object(
          Object.fromEntries(
            Object.keys(emptyBrief).map((k) => [
              k,
              z
                .string()
                .max(k === "foods" ? 80000 : 3000)
                .default(""),
            ]),
          ),
        ),
      })
      .safeParse(await readJson(request));
    if (!body.success)
      throw new ApiError("Please check your selection details.");
    const { data, error } = await client
      .from("yanco_sessions")
      .insert({ owner_id: user.id, ...body.data })
      .select("id")
      .single();
    if (error) throw error;
    return Response.json(data);
  } catch (e) {
    return apiError(e);
  }
}
