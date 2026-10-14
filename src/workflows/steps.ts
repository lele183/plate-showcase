import { createClient } from "@supabase/supabase-js";
import { FatalError } from "workflow";
import type { Collection } from "@/lib/types";
function service() {
  if (!process.env.SUPABASE_SECRET_KEY)
    throw new FatalError("Hosted storage is not configured.");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false } },
  );
}
async function jobData(id: string) {
  const client = service();
  const { data: job, error } = await client
    .from("yanco_jobs")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !job) throw new FatalError("Job is unavailable.");
  if (job.status === "cancelled") throw new FatalError("Job cancelled.");
  const { data: upload } = await client
    .from("yanco_uploads")
    .select("*")
    .eq("id", job.upload_id)
    .eq("owner_id", job.owner_id)
    .single();
  if (!upload || !upload.path.startsWith(`${job.owner_id}/`))
    throw new FatalError("Upload is unavailable.");
  return { client, job, upload };
}
export async function initializeImport(id: string) {
  "use step";
  const { client, job, upload } = await jobData(id);
  let pages = 1;
  if (upload.content_type === "application/pdf") {
    const { openPdf } = await import("@/lib/catalog-processing");
    const { data, error } = await client.storage
      .from("yanco-user-assets")
      .createSignedUrl(upload.path, 300);
    if (error || !data)
      throw new FatalError("The upload did not complete. Try uploading again.");
    const doc = await openPdf(data.signedUrl);
    pages = doc.numPages;
    await doc.cleanup();
    await doc.loadingTask.destroy();
    if (pages > 300)
      throw new FatalError(
        "Catalogs are limited to 300 pages. Split this PDF into smaller catalogs.",
      );
  }
  const catalog = job.input.catalogId as string;
  if (job.kind === "catalog") {
    const { error: catalogError } = await client.from("yanco_catalogs").upsert({
      id: catalog,
      owner_id: job.owner_id,
      name: upload.filename.replace(/\.pdf$/i, ""),
      status: "draft",
      source_path: upload.path,
    });
    if (catalogError) throw catalogError;
  }
  await client
    .from("yanco_jobs")
    .update({
      status: "running",
      progress: 2,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .neq("status", "cancelled");
  return { pages, kind: job.kind as "catalog" | "menu" };
}
export async function processImportPage(
  id: string,
  page: number,
  total: number,
) {
  "use step";
  const { client, job, upload } = await jobData(id);
  let bytes = Buffer.alloc(0);
  if (upload.content_type !== "application/pdf") {
    const { data: file, error } = await client.storage
      .from("yanco-user-assets")
      .download(upload.path);
    if (error || !file) throw new FatalError("Source file is unavailable.");
    bytes = Buffer.from(await file.arrayBuffer());
  }
  const { renderPdfPage, recognizeImage, cropPiece } =
    await import("@/lib/catalog-processing");
  let text = "",
    image: Buffer | null = null;
  let lines: Awaited<ReturnType<typeof recognizeImage>>["lines"] = [];
  if (upload.content_type === "application/pdf") {
    const { data, error } = await client.storage
      .from("yanco-user-assets")
      .createSignedUrl(upload.path, 300);
    if (error || !data) throw new FatalError("Source file is unavailable.");
    const rendered = await renderPdfPage(data.signedUrl, page);
    image = rendered.image;
    if (rendered.nativeText.trim().length > 50) text = rendered.nativeText;
    else {
      const recognized = await recognizeImage(image);
      text = recognized.text;
      lines = recognized.lines;
    }
  } else if (upload.content_type.includes("wordprocessingml")) {
    const mammoth = await import("mammoth");
    text = (await mammoth.extractRawText({ buffer: bytes })).value;
  } else if (upload.content_type.startsWith("image/")) {
    const recognized = await recognizeImage(bytes);
    text = recognized.text;
    image = bytes;
    lines = recognized.lines;
  } else text = bytes.toString("utf8");
  const textPath = `${job.owner_id}/jobs/${id}/page-${page}.txt`;
  const stored = await client.storage
    .from("yanco-user-assets")
    .upload(textPath, Buffer.from(text), {
      contentType: "text/plain",
      upsert: true,
    });
  if (stored.error) throw stored.error;
  if (job.kind === "catalog") {
    const { parseImportRows } = await import("@/lib/import-parser");
    const catalogId = job.input.catalogId as string;
    const prefix = text.match(/\b([A-Z]{1,4})-\d{1,5}/)?.[1] || `P${page}`;
    const collectionId = `${catalogId}:${prefix}`;
    const rows = parseImportRows(text, collectionId, page);
    if (rows.length) {
      const name =
        text
          .split("\n")
          .find(
            (l) =>
              l.trim().length > 3 && l.trim().length < 50 && !/[0-9]/.test(l),
          )
          ?.trim() || `${prefix} collection`;
      const material = /melamine/i.test(text)
        ? "melamine"
        : /porcelain/i.test(text)
          ? "porcelain"
          : /stoneware/i.test(text)
            ? "stoneware"
            : "chinaware";
      const imagePath = `${job.owner_id}/catalogs/${catalogId}/page-${page}.webp`;
      if (image) {
        const sharp = (await import("sharp")).default;
        const buf = await sharp(image)
          .resize({ width: 1100 })
          .webp({ quality: 85 })
          .toBuffer();
        const { error: e } = await client.storage
          .from("yanco-user-assets")
          .upload(imagePath, buf, { contentType: "image/webp", upsert: true });
        if (e) throw e;
      }
      const collection: Collection = {
        id: collectionId,
        name,
        prefix,
        category: material === "melamine" ? "melamine" : "chinaware",
        material,
        section: "imported",
        colors: [...new Set(rows.map((i) => i.color))],
        description:
          "Imported catalog collection. Review its specifications before activation.",
        image: imagePath,
        heroImage: imagePath,
        budget: 2,
        sourcePages: [page],
        pdfPages: [page],
        tags: ["versatile"],
        itemCount: rows.length,
      };
      const { data: existing } = await client
        .from("yanco_collections")
        .select("data")
        .eq("id", collectionId)
        .maybeSingle();
      if (existing) {
        collection.name = existing.data.name;
        collection.itemCount += existing.data.itemCount;
        collection.sourcePages = [
          ...new Set([...existing.data.sourcePages, page]),
        ];
        collection.pdfPages = collection.sourcePages;
      }
      const { error: ce } = await client
        .from("yanco_collections")
        .upsert({ id: collectionId, catalog_id: catalogId, data: collection });
      if (ce) throw ce;
      for (const item of rows) {
        item.image = imagePath;
        if (image && lines.length) {
          const rowLine = lines.find((l) => l.text.includes(item.sku));
          if (rowLine) {
            const heading = lines
              .filter(
                (l) =>
                  l.bbox.y0 < rowLine.bbox.y0 &&
                  rowLine.bbox.y0 - l.bbox.y0 < 300 &&
                  Math.abs(l.bbox.x0 - rowLine.bbox.x0) < 150 &&
                  !/\b[A-Z]{1,4}-\d/.test(l.text),
              )
              .sort((a, b) => b.bbox.y0 - a.bbox.y0)[0];
            if (heading) {
              const path = `${job.owner_id}/catalogs/${catalogId}/${encodeURIComponent(item.sku)}.webp`;
              const piece = await cropPiece(
                image,
                rowLine.bbox.x0 - 30,
                heading.bbox.y0 - 310,
                450,
                290,
              );
              const { error: e } = await client.storage
                .from("yanco-user-assets")
                .upload(path, piece, {
                  contentType: "image/webp",
                  upsert: true,
                });
              if (e) throw e;
              item.image = path;
            }
          }
        }
      }
      const { error: ie } = await client.from("yanco_items").upsert(
        rows.map((data) => ({
          id: data.id,
          catalog_id: catalogId,
          collection_id: collectionId,
          data,
        })),
      );
      if (ie) throw ie;
      const { count } = await client
        .from("yanco_items")
        .select("id", { head: true, count: "exact" })
        .eq("collection_id", collectionId);
      collection.itemCount = count || rows.length;
      await client
        .from("yanco_collections")
        .update({ data: collection })
        .eq("id", collectionId);
    }
  }
  await client
    .from("yanco_jobs")
    .update({
      progress: Math.round((page / total) * 95),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .neq("status", "cancelled");
  return textPath;
}
export async function finishImport(id: string, paths: string[]) {
  "use step";
  const { client, job } = await jobData(id);
  if (job.kind === "menu") {
    const chunks: string[] = [];
    for (const path of paths) {
      const { data } = await client.storage
        .from("yanco-user-assets")
        .download(path);
      if (data) chunks.push(await data.text());
    }
    const text = chunks.join("\n\n").slice(0, 80000);
    await client
      .from("yanco_jobs")
      .update({
        status: "completed",
        progress: 100,
        result: { text },
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .neq("status", "cancelled");
  } else {
    const catalogId = job.input.catalogId;
    const { count } = await client
      .from("yanco_items")
      .select("id", { head: true, count: "exact" })
      .eq("catalog_id", catalogId);
    if (!count)
      throw new FatalError(
        "No item numbers were recognized. Try a clearer catalog PDF.",
      );
    await client
      .from("yanco_jobs")
      .update({
        status: "review",
        progress: 100,
        result: { catalogId, itemCount: count },
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .neq("status", "cancelled");
  }
}
export async function failJob(id: string, message: string) {
  "use step";
  const client = service();
  await client
    .from("yanco_jobs")
    .update({
      status: "failed",
      error: message.slice(0, 300),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .neq("status", "cancelled");
}
export async function generateFood(id: string) {
  "use step";
  const { client, job, upload } = await jobData(id);
  if (job.result?.path) return;
  if (!process.env.OPENAI_API_KEY)
    throw new FatalError(
      "Food generation is temporarily unavailable. Your tabletop preview is still ready to use.",
    );
  await client
    .from("yanco_jobs")
    .update({ status: "running", progress: 15 })
    .eq("id", id)
    .neq("status", "cancelled");
  const { data: file, error } = await client.storage
    .from("yanco-user-assets")
    .download(upload.path);
  if (error || !file) throw new FatalError("Food photo is unavailable.");
  const sharp = (await import("sharp")).default;
  const image = await sharp(Buffer.from(await file.arrayBuffer()), {
    limitInputPixels: 40000000,
  })
    .rotate()
    .resize({
      width: 1400,
      height: 1400,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 88 })
    .toBuffer();
  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-2",
      images: [
        { image_url: `data:image/jpeg;base64,${image.toString("base64")}` },
      ],
      prompt:
        "Extract ONLY the edible food from this photograph. Remove every plate, bowl, tray, container, utensil and surrounding surface. Arrange the same recognizable food naturally for a top-down restaurant plating preview. Output only the food and garnishes on a fully transparent background, no plate, no shadow, no background. Preserve the dish identity, ingredients, and food colors. This layer will be composited onto exact product photographs.",
      background: "transparent",
      output_format: "png",
      size: "1024x1024",
      quality: "low",
      n: 1,
    }),
    signal: AbortSignal.timeout(230000),
  });
  const data = await response.json();
  if (!response.ok)
    throw new FatalError(
      response.status === 401
        ? "Food generation needs an updated API credential. Please try again later."
        : response.status === 429
          ? "Preview capacity is busy. Please try again later."
          : "Unable to generate a food preview. Your tabletop scene has been preserved.",
    );
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new FatalError("No food image was returned.");
  const path = `${job.owner_id}/previews/${id}.png`;
  const { error: e } = await client.storage
    .from("yanco-user-assets")
    .upload(path, Buffer.from(b64, "base64"), {
      contentType: "image/png",
      upsert: true,
    });
  if (e) throw new FatalError("Unable to save the generated preview.");
  await client
    .from("yanco_jobs")
    .update({
      status: "completed",
      progress: 100,
      result: { path },
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .neq("status", "cancelled");
}
generateFood.maxRetries = 0;
