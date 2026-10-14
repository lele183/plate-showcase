import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
if (!process.env.SUPABASE_SECRET_KEY)
  throw Error("Set SUPABASE_SECRET_KEY in .env.local before seeding.");
if (process.env.SUPABASE_SECRET_KEY.startsWith("sb_publishable_"))
  throw Error(
    "SUPABASE_SECRET_KEY contains a publishable key. Use the server Secret key from Supabase API Keys.",
  );
const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
);
const seed = JSON.parse(await readFile("src/data/catalog.json", "utf8"));
const id = "00000000-0000-4000-8000-000000002026";
async function check(p) {
  const result = await p;
  if (result.error) throw Error(result.error.message);
  return result.data;
}
async function retry(run) {
  for (let attempt = 0; ; attempt++) {
    const result = await run();
    if (!result.error) return result.data;
    if (
      attempt >= 11 ||
      !/connection|timeout|temporar|rate|too many|fetch failed|internal server/i.test(
        result.error.message,
      )
    )
      throw Error(result.error.message);
    console.log("Retrying a temporary Supabase connection failure.");
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(1000 * 2 ** attempt, 10000)),
    );
  }
}
await check(
  client.from("yanco_catalogs").upsert({
    id,
    name: "Yanco 2026",
    status: "draft",
    published: true,
    owner_id: null,
    source_path: "yanco-2026.pdf",
  }),
);
const files = [
  ...new Set(
    [
      "yanco-2026.pdf",
      ...seed.collections.flatMap((c) => [c.image, c.heroImage]),
      ...seed.items.map((i) => i.image),
      ...seed.items.map((i) => i.studioImage),
    ]
      .filter(Boolean)
      .map((p) => p.replace("/catalog/", "")),
  ),
];
const uploaded = new Map();
for (let offset = 0; ; offset += 1000) {
  const entries = await retry(() =>
    client.storage.from("yanco-catalog").list("", {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" },
    }),
  );
  for (const entry of entries)
    uploaded.set(entry.name, entry.metadata?.eTag?.replaceAll('"', ""));
  if (entries.length < 1000) break;
}
const uploadConcurrency = 2;
for (let offset = 0; offset < files.length; offset += uploadConcurrency) {
  await Promise.all(
    files.slice(offset, offset + uploadConcurrency).map(async (file) => {
      if (file.includes("/") || file.includes("\\"))
        throw Error("Invalid catalog asset path");
      const bytes = await readFile(`public/catalog/${file}`);
      if (uploaded.get(file) === createHash("md5").update(bytes).digest("hex"))
        return;
      await retry(() =>
        client.storage.from("yanco-catalog").upload(file, bytes, {
          upsert: true,
          contentType: file.endsWith(".pdf") ? "application/pdf" : "image/webp",
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 150));
    }),
  );
  if (offset % 120 === 0)
    console.log(
      `Catalog assets verified: ${Math.min(offset + uploadConcurrency, files.length)}/${files.length}`,
    );
}
for (let offset = 0; offset < seed.collections.length; offset += 40)
  await check(
    client
      .from("yanco_collections")
      .upsert(
        seed.collections
          .slice(offset, offset + 40)
          .map((data) => ({ id: `${id}:${data.id}`, catalog_id: id, data })),
      ),
  );
for (let offset = 0; offset < seed.items.length; offset += 100)
  await check(
    client.from("yanco_items").upsert(
      seed.items.slice(offset, offset + 100).map((data) => ({
        id: `${id}:${data.id}`,
        catalog_id: id,
        collection_id: `${id}:${data.collectionId}`,
        data,
      })),
    ),
  );
// Only reconcile the published baseline; customer catalogs are never touched.
for (const [table, records] of [
  ["yanco_items", seed.items],
  ["yanco_collections", seed.collections],
]) {
  const expected = new Set(records.map((r) => `${id}:${r.id}`));
  const existing = [];
  for (let offset = 0; ; offset += 500) {
    const rows = await check(
      client
        .from(table)
        .select("id")
        .eq("catalog_id", id)
        .order("id")
        .range(offset, offset + 499),
    );
    existing.push(...rows);
    if (rows.length < 500) break;
  }
  const stale = existing
    .map((r) => r.id)
    .filter((value) => !expected.has(value));
  for (let offset = 0; offset < stale.length; offset += 100)
    await check(
      client
        .from(table)
        .delete()
        .eq("catalog_id", id)
        .in("id", stale.slice(offset, offset + 100)),
    );
  const { count, error } = await client
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("catalog_id", id);
  if (error) throw Error(error.message);
  if (count !== records.length)
    throw Error(`Seed verification failed for ${table}`);
}
await check(
  client.from("yanco_catalogs").update({ status: "active" }).eq("id", id),
);
console.log(
  `Seeded ${seed.collections.length} collections and ${seed.items.length} catalog entries.`,
);
