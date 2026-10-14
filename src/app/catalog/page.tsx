import type { Metadata } from "next";
import CatalogBrowser from "@/components/CatalogBrowser";
import { availableCatalog } from "@/lib/catalog";
export const metadata: Metadata = { title: "The 2026 collection" };
export default async function CatalogPage() {
  const data = await availableCatalog();
  return (
    <CatalogBrowser initial={data.collections} itemCount={data.items.length} />
  );
}
