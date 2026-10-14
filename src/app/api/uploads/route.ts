import { z } from "zod";
import { requireUser, apiError, ApiError, sameOrigin } from "@/lib/api";
const schema = z.object({
  filename: z.string().min(1).max(180),
  size: z.number().int().positive().max(104857600),
  contentType: z.enum([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]),
  purpose: z.enum(["catalog", "menu", "food"]),
});
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { client, user } = await requireUser();
    const input = schema.safeParse(await request.json());
    if (!input.success)
      throw new ApiError("Use a supported file smaller than 100 MB.");
    const v = input.data;
    if (v.purpose === "catalog" && v.contentType !== "application/pdf")
      throw new ApiError("Catalogs must be PDF files.");
    if (v.purpose === "food" && !v.contentType.startsWith("image/"))
      throw new ApiError("Please choose a JPG, PNG, or WebP food photo.");
    const id = crypto.randomUUID();
    const ext =
      v.contentType === "application/pdf"
        ? "pdf"
        : v.contentType.includes("wordprocessingml")
          ? "docx"
          : v.contentType === "text/plain"
            ? "txt"
            : v.contentType.split("/")[1];
    const path = `${user.id}/${id}.${ext}`;
    const { error } = await client.from("yanco_uploads").insert({
      id,
      owner_id: user.id,
      path,
      filename: v.filename,
      size: v.size,
      content_type: v.contentType,
      purpose: v.purpose,
    });
    if (error) throw error;
    return Response.json({ id, path, bucket: "yanco-user-assets" });
  } catch (e) {
    return apiError(e);
  }
}
