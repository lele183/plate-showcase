import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

// This calls the public demo only. It never loads keys or falls back to a paid API.
const origin = "https://akhaliq-qwen-image-2-1-workflow.hf.space";
const imageOption = process.argv.indexOf("--image");
const inputPath = imageOption >= 0 ? process.argv[imageOption + 1] : null;
if (imageOption >= 0 && !inputPath)
  throw Error("Pass a local dish photo after --image.");
const api = inputPath ? "rewritten_instruction" : "rewritten_prompt";
const name = inputPath ? "salmon-extracted" : "salmon-online";
const prompt = inputPath
  ? "Extract ONLY the edible food from this photograph. Remove every plate, bowl, tray, container, utensil and surrounding surface. Arrange the same recognizable food naturally for a directly overhead restaurant plating preview. Keep the whole portion visible, centered, with empty margins. Output only the food and garnishes on a fully transparent background with a real alpha channel, not a painted checkerboard. No plate, no cast shadow, no background. Preserve the dish identity, ingredients, portion, and food colors."
  : process.argv[2] ||
    "A photorealistic restaurant food cutout, directly overhead: a grilled salmon fillet with crisp golden skin, three asparagus spears, a small lemon wedge and fresh dill. A modest, elegant portion, entirely visible, centered with generous empty margins. Only edible food, no plate, no bowl, no table, no cutlery, no lettering. A genuinely transparent background with an alpha channel, not a checkerboard painted into the image. Soft natural restaurant photography, realistic food texture.";
const directory = resolve(".cache/qwen-evaluation");
await mkdir(directory, { recursive: true });
const started = Date.now();
const report = {
  checkedAt: new Date().toISOString(),
  space: "https://huggingface.co/spaces/akhaliq/Qwen-Image-2.1-workflow",
  api,
  task: inputPath ? "food extraction from uploaded photo" : "text-to-image",
  input: inputPath,
  prompt,
  status: "pending",
};

try {
  let inputs = [prompt];
  if (inputPath) {
    const image = await sharp(await readFile(inputPath))
      .rotate()
      .resize({
        width: 1400,
        height: 1400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 88 })
      .toBuffer();
    const form = new FormData();
    form.set("files", new Blob([image], { type: "image/jpeg" }), "dish.jpg");
    const uploaded = await fetch(`${origin}/gradio_api/upload`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30000),
    });
    if (!uploaded.ok)
      throw Error(`Demo upload returned HTTP ${uploaded.status}.`);
    const paths = await uploaded.json();
    if (typeof paths[0] !== "string")
      throw Error("Demo upload returned no path.");
    inputs = [{ path: paths[0], meta: { _type: "gradio.FileData" } }, prompt];
  }
  const request = await fetch(`${origin}/gradio_api/call/${api}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: inputs }),
    signal: AbortSignal.timeout(30000),
  });
  if (!request.ok) throw Error(`Demo request returned HTTP ${request.status}.`);
  const { event_id: eventId } = await request.json();
  if (typeof eventId !== "string") throw Error("Demo returned no event ID.");
  console.log("Free Qwen demo accepted the request; waiting for its result.");
  const result = await fetch(
    `${origin}/gradio_api/call/${api}/${encodeURIComponent(eventId)}`,
    { signal: AbortSignal.timeout(240000) },
  );
  if (!result.ok) throw Error(`Demo result returned HTTP ${result.status}.`);
  let pending = "";
  let outputs;
  const decoder = new TextDecoder();
  for await (const chunk of result.body) {
    pending += decoder.decode(chunk, { stream: true }).replace(/\r\n/g, "\n");
    let boundary;
    while ((boundary = pending.indexOf("\n\n")) !== -1) {
      const event = pending.slice(0, boundary);
      pending = pending.slice(boundary + 2);
      const kind = event.match(/^event: (.+)$/m)?.[1];
      const data = event.match(/^data: (.+)$/m)?.[1];
      if (kind === "error")
        throw Error(
          `Free demo could not generate: ${(data || "unknown error").slice(0, 500)}`,
        );
      if (kind === "complete") {
        outputs = JSON.parse(data || "null");
        break;
      }
    }
    if (outputs) break;
  }
  const generated = outputs?.[1];
  if (!generated?.url) throw Error("Demo returned no generated image.");
  const imageUrl = new URL(generated.url, origin);
  if (imageUrl.origin !== origin) throw Error("Unexpected demo image origin.");
  const download = await fetch(imageUrl, {
    signal: AbortSignal.timeout(30000),
  });
  if (!download.ok)
    throw Error(`Image download returned HTTP ${download.status}.`);
  const bytes = Buffer.from(await download.arrayBuffer());
  const image = sharp(bytes, { limitInputPixels: 40000000 });
  const metadata = await image.metadata();
  const stats = await image.stats();
  const alpha = metadata.hasAlpha ? stats.channels.at(-1) : null;
  const output = resolve(directory, `${name}.${metadata.format}`);
  await writeFile(output, bytes);
  Object.assign(report, {
    status: "completed",
    output,
    width: metadata.width,
    height: metadata.height,
    hasTransparency: Boolean(alpha && alpha.min < 255 && alpha.max > 0),
    elapsedSeconds: Math.round((Date.now() - started) / 1000),
  });
} catch (error) {
  Object.assign(report, {
    status: "unavailable",
    error: error instanceof Error ? error.message : String(error),
    elapsedSeconds: Math.round((Date.now() - started) / 1000),
  });
  process.exitCode = 1;
}
await writeFile(
  resolve(directory, `${name}.json`),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
