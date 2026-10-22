import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import {
  foodPreviewConfig,
  generateFoodLayer,
} from "../../src/lib/food-preview";

const qwen = foodPreviewConfig({
  AI_PREVIEW_PROVIDER: "qwen",
  DASHSCOPE_API_KEY: "test-qwen-key",
})!;
const openai = foodPreviewConfig({ OPENAI_API_KEY: "test-openai-key" })!;
const imageUrl =
  "https://dashscope-result-sgp.oss-ap-southeast-1.aliyuncs.com/preview.png";

async function png(alpha: number[]) {
  return sharp(Buffer.from(alpha.flatMap((value) => [180, 90, 40, value])), {
    raw: { width: alpha.length, height: 1, channels: 4 },
  })
    .png()
    .toBuffer();
}

function qwenResult(url = imageUrl) {
  return Response.json({
    output: {
      choices: [{ message: { content: [{ image: url }] } }],
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Food preview provider selection", () => {
  it("does not enable generation without a configured key", () => {
    expect(foodPreviewConfig({})).toBeNull();
    expect(
      foodPreviewConfig({
        AI_PREVIEW_PROVIDER: "qwen",
        OPENAI_API_KEY: "another-provider",
      }),
    ).toBeNull();
  });

  it("selects Qwen when its key is present and keeps credentials regional", () => {
    const config = foodPreviewConfig({
      DASHSCOPE_API_KEY: "test-key",
      DASHSCOPE_REGION: "beijing",
    })!;
    expect(config.provider).toBe("qwen");
    expect(config.endpoint).toContain("https://dashscope.aliyuncs.com/");
  });

  it("supports the workspace API host copied from the current console", () => {
    const config = foodPreviewConfig({
      DASHSCOPE_API_KEY: "test-key",
      DASHSCOPE_API_HOST:
        "https://workspace-test.ap-southeast-1.maas.aliyuncs.com",
    })!;
    expect(config.endpoint).toBe(
      "https://workspace-test.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
    );
  });

  it.each([
    "https://example.com",
    "http://workspace-test.cn-beijing.maas.aliyuncs.com",
    "https://user:password@workspace-test.cn-beijing.maas.aliyuncs.com",
    "https://workspace-test.cn-beijing.maas.aliyuncs.com/api/v1",
  ])("refuses to send a credential to an invalid API host: %s", (host) => {
    expect(() =>
      foodPreviewConfig({
        DASHSCOPE_API_KEY: "test-key",
        DASHSCOPE_API_HOST: host,
      }),
    ).toThrow(/official HTTPS API origin/);
  });

  it("rejects unsupported models before a generation can be charged", () => {
    expect(() =>
      foodPreviewConfig({
        DASHSCOPE_API_KEY: "test",
        QWEN_IMAGE_MODEL: "qwen-image-2.0",
      }),
    ).toThrow(/transparency/);
    expect(() =>
      foodPreviewConfig({
        OPENAI_API_KEY: "test",
        OPENAI_IMAGE_MODEL: "dall-e-3",
      }),
    ).toThrow(/transparency/);
    expect(() =>
      foodPreviewConfig({
        DASHSCOPE_API_KEY: "test",
        DASHSCOPE_REGION: "unrecognized",
      }),
    ).toThrow(/DASHSCOPE_REGION/);
  });
});

describe("Food preview generation", () => {
  it("requests a single transparent Qwen edit and downloads it without credentials", async () => {
    const bytes = await png([0, 255, 255, 0]);
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(qwenResult())
      .mockResolvedValueOnce(new Response(new Uint8Array(bytes)));
    vi.stubGlobal("fetch", request);
    const result = await generateFoodLayer(Buffer.from("dish"), qwen);
    const [url, init] = request.mock.calls[0];
    expect(url).toBe(qwen.endpoint);
    const body = JSON.parse(init!.body as string);
    expect(body.parameters).toMatchObject({
      n: 1,
      prompt_extend: false,
    });
    expect(body.parameters).not.toHaveProperty("background");
    expect(body.input.messages[0].content[1].text).toContain(
      "real alpha channel",
    );
    expect(body.input.messages[0].content[0].image).toBe(
      `data:image/jpeg;base64,${Buffer.from("dish").toString("base64")}`,
    );
    const [downloadUrl, download] = request.mock.calls[1];
    expect(String(downloadUrl)).toBe(imageUrl);
    expect(download).not.toHaveProperty("headers");
    expect(download?.redirect).toBe("error");
    expect((await sharp(result).metadata()).hasAlpha).toBe(true);
  });

  it("uses a transparent-capable OpenAI model and multipart upload", async () => {
    const bytes = await png([0, 255, 0]);
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ data: [{ b64_json: bytes.toString("base64") }] }),
      );
    vi.stubGlobal("fetch", request);
    await generateFoodLayer(Buffer.from("dish"), openai);
    const [, init] = request.mock.calls[0];
    const form = init?.body as FormData;
    expect(form.get("model")).toBe("gpt-image-1.5");
    expect(form.get("background")).toBe("transparent");
    expect(form.get("n")).toBe("1");
    expect(form.get("image")).toBeInstanceOf(Blob);
    expect(init?.headers).not.toHaveProperty("Content-Type");
  });

  it.each([401, 403, 429, 500])(
    "does not retry or switch providers on HTTP %i",
    async (status) => {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status }));
      vi.stubGlobal("fetch", request);
      await expect(
        generateFoodLayer(Buffer.from("dish"), qwen),
      ).rejects.toThrow();
      expect(request).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    "http://dashscope-result-sgp.oss-ap-southeast-1.aliyuncs.com/preview.png",
    "https://example.com/preview.png",
    "https://dashscope.aliyuncs.com.evil.example/preview.png",
    "https://user:pass@dashscope.aliyuncs.com/preview.png",
    "https://dashscope.aliyuncs.com:8443/preview.png",
  ])("refuses an unexpected image download address: %s", async (url) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(qwenResult(url));
    vi.stubGlobal("fetch", request);
    await expect(generateFoodLayer(Buffer.from("dish"), qwen)).rejects.toThrow(
      /unexpected download address/,
    );
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("refuses oversized downloads before reading the image", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(qwenResult())
      .mockResolvedValueOnce(
        new Response("unused", {
          headers: { "content-length": String(21 * 1024 * 1024) },
        }),
      );
    vi.stubGlobal("fetch", request);
    await expect(generateFoodLayer(Buffer.from("dish"), qwen)).rejects.toThrow(
      /too large/,
    );
  });

  it("does not replace a usable photo with an opaque model result", async () => {
    const bytes = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer();
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json({ data: [{ b64_json: bytes.toString("base64") }] }),
        ),
    );
    await expect(
      generateFoodLayer(Buffer.from("dish"), openai),
    ).rejects.toThrow(/opaque image/);
  });

  it.each([
    [255, 255, 255],
    [0, 0, 0],
  ])("rejects a useless alpha channel %j", async (...alpha) => {
    const bytes = await png(alpha);
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json({ data: [{ b64_json: bytes.toString("base64") }] }),
        ),
    );
    await expect(
      generateFoodLayer(Buffer.from("dish"), openai),
    ).rejects.toThrow(/no usable transparent food layer/);
  });

  it("reports a missing result without downloading or spending on a fallback", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ output: { choices: [] } }));
    vi.stubGlobal("fetch", request);
    await expect(generateFoodLayer(Buffer.from("dish"), qwen)).rejects.toThrow(
      /No food image/,
    );
    expect(request).toHaveBeenCalledTimes(1);
  });
});
