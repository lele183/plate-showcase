import type { Metadata } from "next";
import Studio from "@/components/Studio";
import { availableCatalog } from "@/lib/catalog";
export const metadata: Metadata = { title: "Plating studio" };
export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{
    collection?: string;
    scene?: string;
    job?: string;
    item?: string;
  }>;
}) {
  const query = await searchParams;
  const data = await availableCatalog();
  const collection =
    data.collections.find((c) => c.id === query.collection) ||
    data.collections.find((c) => c.id === "mars")!;
  return (
    <Studio
      collections={data.collections}
      initialCollection={collection}
      initialItems={data.items.filter((i) => i.collectionId === collection.id)}
      sceneId={query.scene}
      previewJobId={query.job}
      initialItemId={query.item}
    />
  );
}
