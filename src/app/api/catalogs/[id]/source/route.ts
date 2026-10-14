import { requireUser, apiError, ApiError } from "@/lib/api";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { client, user } = await requireUser();
    const { data: catalog } = await client
      .from("yanco_catalogs")
      .select("source_path")
      .eq("id", id)
      .eq("owner_id", user.id)
      .single();
    if (!catalog?.source_path)
      throw new ApiError("Source file not found.", 404);
    const { data, error } = await client.storage
      .from("yanco-user-assets")
      .createSignedUrl(catalog.source_path, 120);
    if (error || !data) throw error;
    return Response.redirect(data.signedUrl);
  } catch (e) {
    return apiError(e);
  }
}
