import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex" },
        ],
      },
      {
        source: "/auth/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex" },
        ],
      },
    ];
  },
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
