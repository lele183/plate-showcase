import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import { createWorker, PSM } from "tesseract.js";
import { join } from "node:path";
import sharp from "sharp";
export async function openPdf(bytes: Uint8Array | string) {
  Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfjs.getDocument(
    typeof bytes === "string"
      ? {
          url: bytes,
          useSystemFonts: true,
          disableAutoFetch: true,
          disableStream: true,
          rangeChunkSize: 1048576,
        }
      : { data: bytes, useSystemFonts: true },
  ).promise;
}
export async function renderPdfPage(
  bytes: Uint8Array | string,
  pageNumber: number,
) {
  const doc = await openPdf(bytes);
  try {
    const page = await doc.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({
      scale: Math.min(2.7, 2500 / base.width, 3400 / base.height),
    });
    const canvas = createCanvas(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height),
    );
    await page.render({
      canvas: canvas as never,
      canvasContext: canvas.getContext("2d") as never,
      viewport,
    }).promise;
    const contents = await page.getTextContent();
    const nativeText = contents.items
      .map((i) => ("str" in i ? i.str : ""))
      .join("\n");
    return {
      image: canvas.toBuffer("image/png"),
      nativeText,
      pages: doc.numPages,
    };
  } finally {
    await doc.cleanup();
    await doc.loadingTask.destroy();
  }
}
export async function recognizeImage(bytes: Buffer) {
  const worker = await createWorker("eng", 1, {
    langPath: join(process.cwd(), "resources/ocr"),
    cacheMethod: "none",
    gzip: true,
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
    const { data } = await worker.recognize(
      bytes,
      {},
      { text: true, blocks: true },
    );
    return {
      text: data.text,
      confidence: data.confidence,
      lines:
        data.blocks?.flatMap((b) => b.paragraphs.flatMap((p) => p.lines)) || [],
    };
  } finally {
    await worker.terminate();
  }
}
export async function cropPiece(
  image: Buffer,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const meta = await sharp(image).metadata();
  const left = Math.max(0, Math.round(x)),
    top = Math.max(0, Math.round(y));
  return sharp(image)
    .extract({
      left,
      top,
      width: Math.max(1, Math.min(Math.round(width), (meta.width || 1) - left)),
      height: Math.max(
        1,
        Math.min(Math.round(height), (meta.height || 1) - top),
      ),
    })
    .resize({ width: 500, height: 500, fit: "inside" })
    .webp({ quality: 90 })
    .toBuffer();
}
