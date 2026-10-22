type Environment = Record<string, string | undefined>;
export type FoodPreviewConfig = {
  provider: "qwen" | "openai";
  apiKey: string;
  model: string;
  endpoint: string;
};

const endpoints: Record<string, string> = {
  singapore: "https://dashscope-intl.aliyuncs.com",
  beijing: "https://dashscope.aliyuncs.com",
  virginia: "https://dashscope-us.aliyuncs.com",
};
const qwenModels = ["qwen-image-2.1-turbo", "qwen-image-2.1-pro"];
const openaiModels = [
  "gpt-image-1.5",
  "gpt-image-1",
  "gpt-image-1-mini",
  "gpt-image-2",
  "gpt-image-2-2026-04-21",
];
const maxImageBytes = 20 * 1024 * 1024;
const foodPrompt =
  "Extract ONLY the edible food from this photograph. Remove every plate, bowl, tray, container, utensil and surrounding surface. Arrange the same recognizable food naturally for a directly overhead restaurant plating preview. Keep the whole portion visible, centered, with empty margins. Output only the food and garnishes on a fully transparent background with a real alpha channel, not a painted checkerboard. No plate, no cast shadow, no background. Preserve the dish identity, ingredients, portion, and food colors. This layer will be composited onto exact product photographs.";

export function foodPreviewConfig(
  environment: Environment = process.env,
): FoodPreviewConfig | null {
  const provider =
    environment.AI_PREVIEW_PROVIDER?.trim() ||
    (environment.DASHSCOPE_API_KEY?.trim() ? "qwen" : "openai");
  if (provider !== "qwen" && provider !== "openai")
    throw Error("AI_PREVIEW_PROVIDER must be qwen or openai.");
  const apiKey =
    environment[
      provider === "qwen" ? "DASHSCOPE_API_KEY" : "OPENAI_API_KEY"
    ]?.trim();
  if (!apiKey) return null;
  const model =
    (provider === "qwen"
      ? environment.QWEN_IMAGE_MODEL?.trim()
      : environment.OPENAI_IMAGE_MODEL?.trim()) ||
    (provider === "qwen" ? "qwen-image-2.1-turbo" : "gpt-image-1.5");
  if (!(provider === "qwen" ? qwenModels : openaiModels).includes(model))
    throw Error("The selected food preview model must support transparency.");
  const region = environment.DASHSCOPE_REGION?.trim() || "singapore";
  if (provider === "qwen" && !Object.hasOwn(endpoints, region))
    throw Error("DASHSCOPE_REGION must be singapore, beijing, or virginia.");
  let qwenOrigin = endpoints[region];
  if (provider === "qwen" && environment.DASHSCOPE_API_HOST?.trim()) {
    const host = new URL(environment.DASHSCOPE_API_HOST.trim());
    if (
      host.protocol !== "https:" ||
      (!Object.values(endpoints).includes(host.origin) &&
        !/^[a-z0-9-]+\.[a-z0-9-]+\.maas\.aliyuncs\.com$/.test(host.hostname)) ||
      host.username ||
      host.password ||
      host.port ||
      host.pathname !== "/" ||
      host.search ||
      host.hash
    )
      throw Error("DASHSCOPE_API_HOST must be an official HTTPS API origin.");
    qwenOrigin = host.origin;
  }
  return {
    provider,
    apiKey,
    model,
    endpoint:
      provider === "qwen"
        ? `${qwenOrigin}/api/v1/services/aigc/multimodal-generation/generation`
        : "https://api.openai.com/v1/images/edits",
  };
}

function checkResponse(response: Response) {
  if (response.ok) return;
  throw Error(
    response.status === 401 || response.status === 403
      ? "Food generation needs an updated API credential for the configured region."
      : response.status === 429
        ? "Preview capacity is busy. Please try again later."
        : "Unable to generate a food preview. Your tabletop scene has been preserved.",
  );
}

async function downloadQwenImage(value: unknown) {
  if (typeof value !== "string") throw Error("No food image was returned.");
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".aliyuncs.com") ||
    url.username ||
    url.password ||
    url.port
  )
    throw Error("The image service returned an unexpected download address.");
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
  checkResponse(response);
  if (
    !response.body ||
    Number(response.headers.get("content-length")) > maxImageBytes
  )
    throw Error("The generated image is too large or unavailable.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxImageBytes)
        throw Error("The generated image exceeds the preview size limit.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

export async function generateFoodLayer(
  image: Buffer,
  config: FoodPreviewConfig,
) {
  let body: FormData | string;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
  };
  if (config.provider === "qwen") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({
      model: config.model,
      input: {
        messages: [
          {
            role: "user",
            content: [
              { image: `data:image/jpeg;base64,${image.toString("base64")}` },
              { text: foodPrompt },
            ],
          },
        ],
      },
      parameters: {
        n: 1,
        size: "1024*1024",
        // Qwen 2.1 chooses RGBA from the instruction; it has no background parameter.
        prompt_extend: false,
        watermark: false,
      },
    });
  } else {
    const form = new FormData();
    form.set("model", config.model);
    form.set(
      "image",
      new Blob([new Uint8Array(image)], { type: "image/jpeg" }),
      "dish.jpg",
    );
    form.set("prompt", foodPrompt);
    form.set("background", "transparent");
    form.set("output_format", "png");
    form.set("size", "1024x1024");
    form.set("quality", "low");
    form.set("n", "1");
    body = form;
  }
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(230000),
  });
  checkResponse(response);
  const data = await response.json();
  let bytes: Buffer;
  if (config.provider === "qwen") {
    const content = data.output?.choices?.[0]?.message?.content;
    bytes = await downloadQwenImage(
      Array.isArray(content)
        ? content.find((entry) => typeof entry?.image === "string")?.image
        : undefined,
    );
  } else {
    const base64 = data.data?.[0]?.b64_json;
    if (typeof base64 !== "string" || !base64)
      throw Error("No food image was returned.");
    if (base64.length > Math.ceil(maxImageBytes / 3) * 4)
      throw Error("The generated image exceeds the preview size limit.");
    bytes = Buffer.from(base64, "base64");
  }
  const sharp = (await import("sharp")).default;
  const generated = sharp(bytes, { limitInputPixels: 40000000 });
  const metadata = await generated.metadata();
  if (!metadata.hasAlpha)
    throw Error(
      "The model returned an opaque image. Your original photo has been preserved.",
    );
  const { channels } = await generated.stats();
  const alpha = channels[channels.length - 1];
  if (alpha.min === 255 || alpha.max === 0)
    throw Error(
      "The model returned no usable transparent food layer. Your original photo has been preserved.",
    );
  return generated
    .resize({
      width: 1024,
      height: 1024,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();
}
