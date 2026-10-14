import { copyFile, mkdir, readFile } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const { version } = JSON.parse(
  await readFile(new URL("node_modules/pdfjs-dist/package.json", root), "utf8"),
);
await mkdir(new URL("public/vendor/", root), { recursive: true });
await copyFile(
  new URL("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", root),
  new URL(`public/vendor/pdf.worker-${version}.min.mjs`, root),
);
