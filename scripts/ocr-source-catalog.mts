import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import { createWorker, PSM } from "tesseract.js";
import { openPdf } from "../src/lib/catalog-processing";
import { createCanvas } from "@napi-rs/canvas";
const output = ".cache/catalog-tesseract";
await mkdir(output, { recursive: true });
const pdf = await openPdf(
  new Uint8Array(
    await readFile(process.argv[2] || "public/catalog/yanco-2026.pdf"),
  ),
);
let next = 1;
await Promise.all(
  [0, 1].map(async () => {
    const worker = await createWorker("eng", 1, {
      langPath: join(process.cwd(), "resources/ocr"),
      cacheMethod: "none",
      gzip: true,
    });
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
    try {
      while (next <= pdf.numPages) {
        const number = next++,
          path = `${output}/page-${String(number).padStart(3, "0")}.json`;
        try {
          await access(path);
          continue;
        } catch {}
        const page = await pdf.getPage(number),
          viewport = page.getViewport({ scale: 2 });
        const canvas = createCanvas(
          Math.ceil(viewport.width),
          Math.ceil(viewport.height),
        );
        await page.render({
          canvas: canvas as never,
          canvasContext: canvas.getContext("2d") as never,
          viewport,
        }).promise;
        const { data } = await worker.recognize(
          canvas.toBuffer("image/png"),
          {},
          { text: true, blocks: true },
        );
        await writeFile(
          path,
          JSON.stringify({
            page: number,
            width: canvas.width,
            height: canvas.height,
            confidence: data.confidence,
            text: data.text,
            lines:
              data.blocks?.flatMap((b) =>
                b.paragraphs.flatMap((p) => p.lines),
              ) || [],
          }),
        );
        page.cleanup();
        if (number % 10 === 0)
          console.log(`Tesseract verification: ${number}/${pdf.numPages}`);
      }
    } finally {
      await worker.terminate();
    }
  }),
);
await pdf.cleanup();
await pdf.loadingTask.destroy();
console.log("Independent PDF.js / Tesseract extraction complete.");
