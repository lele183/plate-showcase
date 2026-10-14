import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Upload } from "tus-js-client";
if (!process.env.SUPABASE_SECRET_KEY)
  throw Error(
    "Set SUPABASE_SECRET_KEY before running the hosted isolation test.",
  );
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const users = [];
const paths = [];
const check = ({ data, error }) => {
  if (error) throw Error(error.message);
  return data;
};
try {
  for (let index = 0; index < 2; index++) {
    const email = `yanco-e2e-${randomUUID()}@example.invalid`,
      password = randomUUID() + "!Aa";
    const { user } = check(
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      }),
    );
    users.push({
      user,
      client: createClient(url, key, { auth: { persistSession: false } }),
    });
    check(
      await users[index].client.auth.signInWithPassword({ email, password }),
    );
  }
  const [a, b] = users;
  const catalog = check(
    await a.client
      .from("yanco_catalogs")
      .insert({ owner_id: a.user.id, name: "Isolation test" })
      .select("id")
      .single(),
  );
  const session = check(
    await a.client
      .from("yanco_sessions")
      .insert({
        owner_id: a.user.id,
        name: "Isolation test",
        data: { concept: "Bistro" },
      })
      .select("id")
      .single(),
  );
  assert.equal(
    check(
      await b.client.from("yanco_sessions").select("id").eq("id", session.id),
    ).length,
    0,
  );
  const scene = check(
    await a.client
      .from("yanco_scenes")
      .insert({
        owner_id: a.user.id,
        name: "Isolation test",
        data: { tabletop: "oak" },
      })
      .select("id")
      .single(),
  );
  assert.equal(
    check(await b.client.from("yanco_scenes").select("id").eq("id", scene.id))
      .length,
    0,
  );
  const collectionId = `hosted-test:${randomUUID()}`;
  check(
    await a.client.from("yanco_collections").insert({
      id: collectionId,
      catalog_id: catalog.id,
      data: { name: "Private collection" },
    }),
  );
  const itemId = `hosted-test:${randomUUID()}`;
  check(
    await a.client.from("yanco_items").insert({
      id: itemId,
      catalog_id: catalog.id,
      collection_id: collectionId,
      data: { sku: "TEST-1" },
    }),
  );
  assert.equal(
    check(await b.client.from("yanco_items").select("id").eq("id", itemId))
      .length,
    0,
  );
  assert.equal(
    check(
      await b.client
        .from("yanco_collections")
        .select("id")
        .eq("id", collectionId),
    ).length,
    0,
  );
  const secondCatalog = check(
    await a.client
      .from("yanco_catalogs")
      .insert({ owner_id: a.user.id, name: "Association test" })
      .select("id")
      .single(),
  );
  assert(
    (
      await a.client.from("yanco_items").insert({
        id: `hosted-test:${randomUUID()}`,
        catalog_id: secondCatalog.id,
        collection_id: collectionId,
        data: {},
      })
    ).error,
    "Cross-catalog association must fail",
  );
  assert(
    (
      await a.client
        .from("yanco_catalogs")
        .update({ published: true })
        .eq("id", catalog.id)
    ).error,
    "Customers cannot publish the baseline",
  );
  assert(
    (
      await b.client
        .from("yanco_scenes")
        .insert({ owner_id: a.user.id, name: "Denied", data: {} })
    ).error,
  );
  const uploadPath = `${a.user.id}/quota-${randomUUID()}.jpg`;
  const upload = check(
    await a.client
      .from("yanco_uploads")
      .insert({
        owner_id: a.user.id,
        path: uploadPath,
        filename: "test.jpg",
        content_type: "image/jpeg",
        size: 10,
        purpose: "food",
      })
      .select("id")
      .single(),
  );
  assert.equal(
    check(await b.client.from("yanco_uploads").select("id").eq("id", upload.id))
      .length,
    0,
  );
  assert(
    (
      await b.client.from("yanco_uploads").insert({
        owner_id: b.user.id,
        path: `${a.user.id}/denied.jpg`,
        filename: "denied.jpg",
        content_type: "image/jpeg",
        size: 10,
        purpose: "food",
      })
    ).error,
  );
  const parameters = {
    p_owner: a.user.id,
    p_upload: upload.id,
    p_input: {},
    p_user_limit: 1,
    p_site_limit: 100000,
  };
  assert(
    (await a.client.rpc("yanco_reserve_preview", parameters)).error,
    "Reservation requires a server role",
  );
  const reserved = check(await admin.rpc("yanco_reserve_preview", parameters));
  assert.equal(
    check(await admin.rpc("yanco_reserve_preview", parameters)),
    reserved,
    "Identical request is cached",
  );
  assert.equal(
    check(await b.client.from("yanco_jobs").select("id").eq("id", reserved))
      .length,
    0,
  );
  assert(
    (
      await a.client
        .from("yanco_jobs")
        .insert({ owner_id: a.user.id, kind: "menu", input: {} })
    ).error,
    "Customers cannot bypass server job creation",
  );
  const another = check(
    await a.client
      .from("yanco_uploads")
      .insert({
        owner_id: a.user.id,
        path: `${a.user.id}/quota-${randomUUID()}.jpg`,
        filename: "test.jpg",
        content_type: "image/jpeg",
        size: 10,
        purpose: "food",
      })
      .select("id")
      .single(),
  );
  const limited = await admin.rpc("yanco_reserve_preview", {
    ...parameters,
    p_upload: another.id,
  });
  assert(
    limited.error?.message.includes("daily preview allowance"),
    "Quota must block a second reservation",
  );
  const resumablePath = `${a.user.id}/resumable-${randomUUID()}.txt`;
  paths.push(resumablePath);
  const { session: authSession } = check(await a.client.auth.getSession());
  await new Promise((resolve, reject) => {
    const transfer = new Upload(Buffer.alloc(7 * 1024 * 1024), {
      endpoint: `${url.replace(".supabase.co", ".storage.supabase.co")}/storage/v1/upload/resumable`,
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 1000, 3000],
      headers: {
        authorization: `Bearer ${authSession.access_token}`,
        apikey: key,
      },
      metadata: {
        bucketName: "yanco-user-assets",
        objectName: resumablePath,
        contentType: "text/plain",
      },
      onSuccess: resolve,
      onError: reject,
    });
    transfer.start();
  });
  assert(
    (await b.client.storage.from("yanco-user-assets").download(resumablePath))
      .error,
  );
  assert.equal(
    check(
      await a.client.storage.from("yanco-user-assets").download(resumablePath),
    ).size,
    7 * 1024 * 1024,
  );
  assert.equal(
    check(
      await b.client.from("yanco_catalogs").select("id").eq("id", catalog.id),
    ).length,
    0,
  );
  const path = `${a.user.id}/test-${randomUUID()}.txt`;
  paths.push(path);
  check(
    await a.client.storage
      .from("yanco-user-assets")
      .upload(path, new Blob(["private test"], { type: "text/plain" })),
  );
  assert(
    (await b.client.storage.from("yanco-user-assets").download(path)).error,
  );
  assert(
    (
      await b.client.storage
        .from("yanco-user-assets")
        .upload(
          `${a.user.id}/denied.txt`,
          new Blob(["denied"], { type: "text/plain" }),
        )
    ).error,
  );
  const anon = createClient(url, key, { auth: { persistSession: false } });
  const anonymousScenes = await anon.from("yanco_scenes").select("id");
  assert(anonymousScenes.error || anonymousScenes.data.length === 0);
  assert(
    check(await anon.from("yanco_catalogs").select("id").eq("published", true))
      .length > 0,
  );
  console.log(
    "Hosted tests passed: two-account catalog/item/scene/session/upload/job isolation, association constraints, server-only cached quotas, private storage, multi-chunk resumable upload, and anonymous published catalog access.",
  );
} finally {
  if (paths.length) await admin.storage.from("yanco-user-assets").remove(paths);
  for (const { user } of users) await admin.auth.admin.deleteUser(user.id);
}
