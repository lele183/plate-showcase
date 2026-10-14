import { requireUser, apiError } from "@/lib/api";
export async function GET() {
  try {
    const { client, user } = await requireUser();
    const { data, error } = await client
      .from("yanco_catalogs")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return Response.json({ catalogs: data });
  } catch (e) {
    return apiError(e);
  }
}
