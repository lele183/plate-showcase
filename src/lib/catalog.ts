import "server-only";
import seed from "@/data/catalog.json";
import type { CatalogItem, Collection } from "./types";
import { serverSupabase } from "./supabase/server";
import { supabaseConfigured } from "./supabase/config";

export const collections = seed.collections as Collection[];
export const items = seed.items as CatalogItem[];
export const catalogId = "00000000-0000-4000-8000-000000002026";
export async function availableCatalog() {
  if (!supabaseConfigured()) return { collections, items };
  const supabase = await serverSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { collections, items };
  const { data: catalogs } = await supabase
    .from("yanco_catalogs")
    .select("id")
    .eq("owner_id", user.id)
    .eq("status", "active");
  if (!catalogs?.length) return { collections, items };
  const ids = catalogs.map((c) => c.id);
  const { data: cs, error: collectionError } = await supabase
    .from("yanco_collections")
    .select("data,catalog_id")
    .in("catalog_id", ids);
  if (collectionError) throw collectionError;
  const personalItems: CatalogItem[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase
      .from("yanco_items")
      .select("data")
      .in("catalog_id", ids)
      .order("id")
      .range(offset, offset + 499);
    if (error) throw error;
    personalItems.push(...(data || []).map((i) => i.data as CatalogItem));
    if (!data || data.length < 500) break;
  }
  const personalCollections = (cs || []).map(
    (c) =>
      ({
        ...c.data,
        sourceUrl: `/api/catalogs/${c.catalog_id}/source`,
      }) as Collection,
  );
  const paths = [
    ...new Set(
      [
        ...personalItems.map((i) => i.image),
        ...personalCollections.map((c) => c.image),
      ].filter((p) => !p.startsWith("/") && !p.startsWith("http")),
    ),
  ];
  const { data: signed } = paths.length
    ? await supabase.storage
        .from("yanco-user-assets")
        .createSignedUrls(paths, 3600)
    : { data: [] };
  const urls = new Map((signed || []).map((s) => [s.path, s.signedUrl]));
  for (const i of personalItems) i.image = urls.get(i.image) || i.image;
  for (const c of personalCollections) {
    c.image = urls.get(c.image) || c.image;
    c.heroImage = urls.get(c.heroImage) || c.image;
  }
  return {
    collections: [...collections, ...personalCollections],
    items: [...items, ...personalItems],
  };
}
