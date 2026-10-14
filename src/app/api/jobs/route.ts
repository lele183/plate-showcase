import { z } from "zod";
import { start } from "workflow/api";
import { requireUser, apiError, ApiError, sameOrigin } from "@/lib/api";
import { adminSupabase } from "@/lib/supabase/server";
import { importCatalogOrMenu, createFoodPreview } from "@/workflows/import";
export async function GET() {
  try {
    const { client } = await requireUser();
    const { data, error } = await client
      .from("yanco_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw error;
    return Response.json({ jobs: data });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { client, user } = await requireUser();
    const parsed = z
      .object({
        kind: z.enum(["catalog", "menu", "food-preview"]),
        uploadId: z.uuid(),
        itemId: z.string().max(250).optional(),
      })
      .safeParse(await request.json());
    if (!parsed.success)
      throw new ApiError("Please choose a supported upload.");
    const body = parsed.data;
    const { data: upload } = await client
      .from("yanco_uploads")
      .select("*")
      .eq("id", body.uploadId)
      .eq("owner_id", user.id)
      .single();
    if (
      !upload ||
      upload.purpose !== (body.kind === "food-preview" ? "food" : body.kind)
    )
      throw new ApiError("Upload not found.", 404);
    if (body.kind === "food-preview" && !process.env.OPENAI_API_KEY)
      throw new ApiError(
        "AI food previews are temporarily unavailable. You can still crop and place your photo.",
        503,
      );
    const admin = adminSupabase();
    let id: string;
    const input =
      body.kind === "catalog"
        ? { catalogId: crypto.randomUUID() }
        : { itemId: body.itemId || "" };
    if (body.kind === "food-preview") {
      const { data, error } = await admin.rpc("yanco_reserve_preview", {
        p_owner: user.id,
        p_upload: upload.id,
        p_input: input,
        p_user_limit: Number(process.env.AI_PREVIEW_DAILY_LIMIT || 5),
        p_site_limit: Number(process.env.AI_PREVIEW_SITE_DAILY_LIMIT || 50),
      });
      if (error) throw new ApiError(error.message, 429);
      id = data;
    } else {
      const { data, error } = await admin
        .from("yanco_jobs")
        .insert({
          owner_id: user.id,
          upload_id: upload.id,
          kind: body.kind,
          input,
        })
        .select("id")
        .single();
      if (error || !data) throw error;
      id = data.id;
    }
    const { data: existingJob } = await admin
      .from("yanco_jobs")
      .select("run_id,status")
      .eq("id", id)
      .single();
    if (existingJob?.run_id || existingJob?.status === "completed")
      return Response.json({ id, cached: true }, { status: 202 });
    const { data: claimed, error: claimError } = await admin
      .from("yanco_jobs")
      .update({ run_id: "starting" })
      .eq("id", id)
      .is("run_id", null)
      .select("id")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) return Response.json({ id, cached: true }, { status: 202 });
    try {
      const run = await start(
        body.kind === "food-preview" ? createFoodPreview : importCatalogOrMenu,
        [id],
      );
      await admin.from("yanco_jobs").update({ run_id: run.runId }).eq("id", id);
    } catch {
      await admin
        .from("yanco_jobs")
        .update({
          status: "failed",
          run_id: null,
          error: "Unable to start processing. Please retry.",
        })
        .eq("id", id);
      throw new ApiError("Unable to start processing. Please retry.", 503);
    }
    return Response.json({ id }, { status: 202 });
  } catch (e) {
    return apiError(e);
  }
}
