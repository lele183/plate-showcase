import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  experimental: { cpus: 2, webpackMemoryOptimizations: true },
  serverExternalPackages: [
    "@napi-rs/canvas",
    "tesseract.js",
    "pdfjs-dist",
    "mammoth",
    "sharp",
  ],
  outputFileTracingIncludes: {
    "/.well-known/workflow/*": [
      "resources/ocr/**",
      "node_modules/tesseract.js/src/worker-script/**",
      "node_modules/tesseract.js-core/**",
      "node_modules/pdfjs-dist/legacy/build/**",
      "node_modules/pdfjs-dist/wasm/**",
    ],
  },
  images: {
    unoptimized: true,
  },
};

export default withWorkflow(nextConfig);
