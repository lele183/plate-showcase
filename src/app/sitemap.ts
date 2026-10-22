import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/catalog", "/studio"].map((route) => ({
    url: `${siteUrl}${route}`,
    changeFrequency: "monthly",
    priority: route ? 0.8 : 1,
  }));
}
