import type { Metadata } from "next";
import CatalogBrowser from "@/components/CatalogBrowser";
import { availableCatalog } from "@/lib/catalog";
import { catalogFilters } from "@/lib/url-state";
export const metadata: Metadata = {
  title: "The 2026 collection",
  description:
    "Browse Yanco dinnerware collections, search product numbers, compare sizes and colors, and verify specifications against the source catalog.",
  alternates: { canonical: "/catalog" },
};
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (typeof value === "string") params.set(key, value);
  const data = await availableCatalog();
  return (
    <CatalogBrowser
      key={params.toString()}
      initial={data.collections}
      itemCount={data.items.length}
      initialFilters={catalogFilters(params)}
    />
  );
}
