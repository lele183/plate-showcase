import type { Metadata } from "next";
import Studio from "@/components/Studio";
import { availableCatalog } from "@/lib/catalog";
import { studioSettings, studioView } from "@/lib/url-state";
export const metadata: Metadata = { title: "Plating studio" };
export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (typeof value === "string") params.set(key, value);
  const data = await availableCatalog();
  const collection =
    data.collections.find((c) => c.id === params.get("collection")) ||
    data.collections.find((c) => c.id === "mars")!;
  const items = data.items.filter((i) => i.collectionId === collection.id);
  const piece =
    items.find(
      (i) =>
        i.id === params.get("item") ||
        i.sku.toLowerCase() === params.get("item")?.toLowerCase(),
    ) ||
    items.find((i) => i.sku === "MR-710") ||
    items.find((i) => i.type === "plate") ||
    items[0];
  return (
    <Studio
      key={params.toString()}
      collections={data.collections}
      initialCollection={collection}
      initialItems={items}
      sceneId={params.get("scene") || undefined}
      previewJobId={params.get("job") || undefined}
      initialScene={{
        ...studioSettings(params),
        collectionId: collection.id,
        itemId: piece?.id,
      }}
      initialView={studioView(params)}
    />
  );
}
