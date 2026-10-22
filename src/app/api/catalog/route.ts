import { availableCatalog } from "@/lib/catalog";
import { apiError, ApiError } from "@/lib/api";
export async function GET(request: Request) {
  try {
    const { collections, items } = await availableCatalog();
    const url = new URL(request.url);
    const id = url.searchParams.get("collection");
    if (id) {
      const collection = collections.find((c) => c.id === id);
      if (!collection) throw new ApiError("Collection not found.", 404);
      return Response.json({
        collection,
        items: items.filter((i) => i.collectionId === id),
      });
    }
    const query = (url.searchParams.get("q") || "")
      .slice(0, 200)
      .trim()
      .toLowerCase();
    const matching = new Set(
      query
        ? items
            .filter((i) =>
              `${i.sku} ${i.name} ${i.specification}`
                .toLowerCase()
                .includes(query),
            )
            .map((i) => i.collectionId)
        : [],
    );
    return Response.json({
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
    });
  } catch (error) {
    return apiError(error);
  }
}
