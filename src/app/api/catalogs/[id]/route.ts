import { z } from "zod";
import sharp from "sharp";
import { requireUser, apiError, ApiError, sameOrigin } from "@/lib/api";
import { adminSupabase } from "@/lib/supabase/server";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { client, user } = await requireUser();
    const { data: catalog } = await client
      .from("yanco_catalogs")
      .select("*")
      .eq("id", id)
      .eq("owner_id", user.id)
      .single();
    if (!catalog) throw new ApiError("Catalog not found.", 404);
    const page = Math.max(
      1,
      Number(new URL(request.url).searchParams.get("page") || 1),
    );
    const [{ data: collections }, { data: items, count }] = await Promise.all([
      client.from("yanco_collections").select("id,data").eq("catalog_id", id),
      client
        .from("yanco_items")
        .select("id,data", { count: "exact" })
        .eq("catalog_id", id)
        .order("id")
        .range((page - 1) * 40, page * 40 - 1),
    ]);
    const paths = [
      ...new Set(
        (items || [])
          .flatMap((i) => [
            i.data.image,
            `${user.id}/catalogs/${id}/page-${i.data.pdfPage}.webp`,
          ])
          .filter(Boolean),
      ),
    ];
    const { data: signed } = paths.length
      ? await client.storage
          .from("yanco-user-assets")
          .createSignedUrls(paths, 3600)
      : { data: [] };
    const urls = new Map((signed || []).map((s) => [s.path, s.signedUrl]));
    return Response.json({
      catalog,
      collections,
      items: (items || []).map((i) => ({
        ...i,
        preview: urls.get(i.data.image),
        pagePreview: urls.get(
          `${user.id}/catalogs/${id}/page-${i.data.pdfPage}.webp`,
        ),
      })),
      count: count || 0,
      page,
    });
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
    const { data: catalog } = await client
      .from("yanco_catalogs")
      .select("id")
      .eq("id", id)
      .eq("owner_id", user.id)
      .single();
    if (!catalog) throw new ApiError("Catalog not found.", 404);
    const body = await request.json();
    if (body.action === "activate") {
      if (body.reviewConfirmed !== true)
        throw new ApiError("Confirm you have reviewed the imported records.");
      const { count } = await client
        .from("yanco_items")
        .select("id", { head: true, count: "exact" })
        .eq("catalog_id", id);
      if (!count)
        throw new ApiError("Add at least one piece before activation.");
      const { error } = await client
        .from("yanco_catalogs")
        .update({ status: "active" })
        .eq("id", id);
      if (error) throw error;
      await adminSupabase()
        .from("yanco_jobs")
        .update({ status: "completed" })
        .eq("owner_id", user.id)
        .contains("input", { catalogId: id });
      return Response.json({ status: "active" });
    }
    if (body.action === "archive") {
      const { error } = await client
        .from("yanco_catalogs")
        .update({ status: "archived" })
        .eq("id", id);
      if (error) throw error;
      return Response.json({ status: "archived" });
    }
    if (body.collection) {
      const data = z
        .object({
          id: z.string(),
          name: z.string().min(1).max(120),
          material: z.string().min(1).max(40),
          category: z.enum([
            "chinaware",
            "melamine",
            "glassware",
            "plasticware",
            "wood",
          ]),
          colors: z.array(z.string().max(30)).max(12),
          budget: z.number().int().min(1).max(3),
        })
        .parse(body.collection);
      const { data: existing } = await client
        .from("yanco_collections")
        .select("data")
        .eq("id", data.id)
        .eq("catalog_id", id)
        .single();
      if (!existing) throw new ApiError("Collection not found.", 404);
      const { error } = await client
        .from("yanco_collections")
        .update({ data: { ...existing.data, ...data } })
        .eq("id", data.id)
        .eq("catalog_id", id);
      if (error) throw error;
      return Response.json({ saved: true });
    }
    const changes = z
      .object({
        id: z.string(),
        sku: z.string().min(1).max(60),
        name: z.string().min(1).max(150),
        type: z.string().max(30),
        shape: z.string().max(30),
        color: z.string().max(50),
        capacityOz: z.number().positive().max(10000).nullable(),
        casePack: z.string().max(50).nullable().optional(),
        dimensions: z
          .object({
            length: z.number().positive().max(1000).nullable(),
            width: z.number().positive().max(1000).nullable(),
            height: z.number().positive().max(1000).nullable(),
          })
          .nullable(),
        specification: z.string().max(2000),
        crop: z
          .object({
            x: z.number().min(0).max(99),
            y: z.number().min(0).max(99),
            w: z.number().positive().max(100),
            h: z.number().positive().max(100),
          })
          .optional(),
      })
      .safeParse(body.item);
    if (!changes.success)
      throw new ApiError("Please check the edited specifications.");
    const item = changes.data;
    const { data: existing } = await client
      .from("yanco_items")
      .select("data")
      .eq("id", item.id)
      .eq("catalog_id", id)
      .single();
    if (!existing) throw new ApiError("Item not found.", 404);
    const updated = {
      ...existing.data,
      ...item,
      originalSpecification:
        existing.data.originalSpecification || existing.data.specification,
      reviewNeeded: false,
    };
    if (item.crop) {
      const path = `${user.id}/catalogs/${id}/page-${existing.data.pdfPage}.webp`;
      const { data: file, error } = await client.storage
        .from("yanco-user-assets")
        .download(path);
      if (error || !file)
        throw new ApiError("Source page image is unavailable.");
      const bytes = Buffer.from(await file.arrayBuffer());
      const meta = await sharp(bytes).metadata();
      const left = Math.floor((item.crop.x / 100) * meta.width!),
        top = Math.floor((item.crop.y / 100) * meta.height!);
      const width = Math.min(
          meta.width! - left,
          Math.round((item.crop.w / 100) * meta.width!),
        ),
        height = Math.min(
          meta.height! - top,
          Math.round((item.crop.h / 100) * meta.height!),
        );
      const cropped = await sharp(bytes)
        .extract({ left, top, width, height })
        .resize({ width: 600, height: 600, fit: "inside" })
        .webp({ quality: 90 })
        .toBuffer();
      const output = `${user.id}/catalogs/${id}/crop-${encodeURIComponent(item.id)}-${Date.now()}.webp`;
      const { error: e } = await client.storage
        .from("yanco-user-assets")
        .upload(output, cropped, { contentType: "image/webp" });
      if (e) throw e;
      updated.image = output;
    }
    delete updated.crop;
    const { error } = await client
      .from("yanco_items")
      .update({ data: updated })
      .eq("id", item.id)
      .eq("catalog_id", id);
    if (error) throw error;
    return Response.json({ saved: true });
  } catch (e) {
    if (e instanceof z.ZodError)
      return Response.json(
        { error: "Please check the edited fields." },
        { status: 400 },
      );
    return apiError(e);
  }
}
