import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import postgres from "postgres";

if (
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL.includes("[YOUR-PASSWORD]")
)
  throw Error("Set DATABASE_URL in the ignored .env.local file.");
const seed = JSON.parse(
  await readFile(new URL("../src/data/catalog.json", import.meta.url), "utf8"),
);
const catalogId = "00000000-0000-4000-8000-000000002026";
const patches = seed.collections.map((collection) => ({
  id: `${catalogId}:${collection.id}`,
  patch: {
    tags: collection.tags,
    visualTags: collection.visualTags,
    conceptTags: collection.conceptTags,
    styleNotes: collection.styleNotes,
  },
}));
assert.equal(patches.length, 83);
const sql = postgres(process.env.DATABASE_URL, {
  max: 1,
  ssl: "require",
  connect_timeout: 15,
});
try {
  await sql.begin(async (tx) => {
    const baseline =
      await tx`select id from public.yanco_catalogs where id=${catalogId} and published=true and owner_id is null and status='active'`;
    assert.equal(
      baseline.length,
      1,
      "Published Yanco baseline must be active.",
    );
    if (!process.argv.includes("--check")) {
      const updated = await tx`
        update public.yanco_collections as collection
        set data = collection.data || patch.data
        from jsonb_to_recordset(${sql.json(patches.map((value) => ({ id: value.id, data: value.patch })))}::jsonb) as patch(id text, data jsonb)
        where collection.catalog_id=${catalogId} and collection.id=patch.id
        returning collection.id`;
      assert.equal(
        updated.length,
        83,
        "Style sync must update exactly the published baseline.",
      );
    }
    const rows =
      await tx`select id,data from public.yanco_collections where catalog_id=${catalogId}`;
    assert.equal(rows.length, 83);
    for (const row of rows) {
      const expected = patches.find((value) => value.id === row.id);
      assert(expected);
      for (const key of Object.keys(expected.patch))
        assert.deepEqual(
          row.data[key],
          expected.patch[key],
          `${row.id} ${key}`,
        );
    }
  });
  console.log(
    "Verified style metadata for 83 published Yanco collections. Product records, assets, and customer catalogs were not modified.",
  );
} catch (error) {
  console.error(
    `Catalog style sync failed${typeof error.code === "string" ? ` (${error.code})` : ""}. The transaction was rolled back.`,
  );
  process.exitCode = 1;
} finally {
  await sql.end();
}
