import { requireUser, apiError, ApiError } from "@/lib/api";
export async function GET(request: Request) {
  try {
    const { user, client } = await requireUser();
    const path = new URL(request.url).searchParams.get("path");
    if (!path || !path.startsWith(`${user.id}/`) || path.includes(".."))
      throw new ApiError("Image not found.", 404);
    const { data, error } = await client.storage
      .from("yanco-user-assets")
      .download(path);
    if (error || !data) throw new ApiError("Image not found.", 404);
    if (data.size > 4 * 1024 * 1024)
      throw new ApiError("Use a smaller image for the studio.");
    return new Response(data, {
      headers: {
        "Content-Type": data.type,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
