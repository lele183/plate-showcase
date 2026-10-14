import { availableCatalog } from "@/lib/catalog";
export async function GET(request: Request) {
  const { collections, items } = await availableCatalog();
  const url = new URL(request.url);
  const id = url.searchParams.get("collection");
  const query = (url.searchParams.get("q") || "").trim().toLowerCase();
  const matching = new Set(
    items
      .filter((i) =>
        `${i.sku} ${i.name} ${i.specification}`.toLowerCase().includes(query),
      )
      .map((i) => i.collectionId),
  );
  return Response.json(
    id
      ? {
          collection: collections.find((c) => c.id === id),
          items: items.filter((i) => i.collectionId === id),
        }
      : {
          collections: query
            ? collections.filter(
                (c) =>
                  matching.has(c.id) ||
                  `${c.name} ${c.description} ${c.material} ${c.colors.join(" ")}`
                    .toLowerCase()
                    .includes(query),
              )
            : collections,
          itemCount: items.length,
        },
  );
}
