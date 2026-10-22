import { z } from "zod";
import { recommend } from "@/lib/recommendations";
import { availableCatalog } from "@/lib/catalog";
import { emptyBrief } from "@/lib/types";
import { apiError, sameOrigin, readJson } from "@/lib/api";
const schema = z.object(
  Object.fromEntries(
    Object.keys(emptyBrief).map((k) => [
      k,
      z
        .string()
        .max(k === "foods" ? 80000 : 3000)
        .default(""),
    ]),
  ),
);
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const input = schema.safeParse(await readJson(request));
    if (!input.success)
      return Response.json(
        {
          error:
            "Keep brief answers under 3,000 characters and menus under 80,000 characters.",
        },
        { status: 400 },
      );
    const { collections, items } = await availableCatalog();
    return Response.json(
      recommend({ ...emptyBrief, ...input.data }, collections, items),
    );
  } catch (e) {
    return apiError(e);
  }
}
