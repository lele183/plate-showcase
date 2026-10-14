import { getRun, start } from "workflow/api";
import { requireUser, apiError, ApiError, sameOrigin } from "@/lib/api";
import { adminSupabase } from "@/lib/supabase/server";
import { importCatalogOrMenu } from "@/workflows/import";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { client, user } = await requireUser();
    const { data: job, error } = await client
      .from("yanco_jobs")
      .select("*")
      .eq("id", id)
      .eq("owner_id", user.id)
      .single();
    if (error || !job) throw new ApiError("Job not found.", 404);
    if (job.kind === "food-preview" && job.result?.path)
      job.result = {
        ...job.result,
        url: `/api/assets?path=${encodeURIComponent(job.result.path)}`,
      };
    return Response.json({ job });
  } catch (e) {
    return apiError(e);
  }
}
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    const { id } = await params;
    const { client, user } = await requireUser();
    const { data: job } = await client
      .from("yanco_jobs")
      .select("*")
      .eq("id", id)
      .eq("owner_id", user.id)
      .single();
    if (!job) throw new ApiError("Job not found.", 404);
    const body = await request.json();
    const admin = adminSupabase();
    if (body.action === "cancel") {
      if (!["queued", "running"].includes(job.status))
        throw new ApiError("This job has already finished.");
      const { error } = await admin
        .from("yanco_jobs")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
      if (job.run_id && job.run_id !== "starting") {
        try {
          await getRun(job.run_id).cancel();
        } catch {
          console.error(
            "Workflow cancellation could not be delivered; persisted cancellation prevents further processing steps.",
          );
        }
      }
      return Response.json({ status: "cancelled" });
    }
    if (
      body.action === "retry" &&
      job.status === "failed" &&
      job.kind !== "food-preview"
    ) {
      await admin
        .from("yanco_jobs")
        .update({ status: "queued", error: null })
        .eq("id", id);
      const run = await start(importCatalogOrMenu, [id]);
      await admin.from("yanco_jobs").update({ run_id: run.runId }).eq("id", id);
      return Response.json({ status: "queued" });
    }
    throw new ApiError(
      "This job cannot be retried. Start a new photo preview if needed.",
    );
  } catch (e) {
    return apiError(e);
  }
}
