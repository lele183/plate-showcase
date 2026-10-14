import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
const site = new URL(
  process.env.LIVE_SITE_URL || "https://plate-showcase.vercel.app",
).origin;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const users = [];
let bypass;
if (
  site !== "https://plate-showcase.vercel.app" &&
  site.endsWith(".vercel.app")
) {
  const project = JSON.parse(await readFile(".vercel/project.json", "utf8"));
  const response = spawnSync(
    process.execPath,
    [
      "C:/nvm4w/nodejs/node_modules/vercel/dist/index.js",
      "api",
      `/v9/projects/${project.projectId}?teamId=${project.orgId}`,
    ],
    { encoding: "utf8" },
  );
  if (response.status !== 0)
    throw Error("Unable to access the linked Vercel preview configuration.");
  let config;
  try {
    config = JSON.parse(response.stdout);
  } catch {
    throw Error("Unable to read the linked Vercel preview configuration.");
  }
  bypass = Object.keys(config.protectionBypass || {}).find(
    (k) => config.protectionBypass[k].scope === "automation-bypass",
  );
  if (!bypass) throw Error("Preview automation access is unavailable.");
}
const check = ({ data, error }) => {
  if (error) throw Error(error.message);
  return data;
};
async function api(path, owner, method = "GET", body) {
  assert(path.startsWith("/api/"));
  const headers = { origin: site };
  if (owner)
    headers.cookie = [...owner.cookies].map(([n, v]) => `${n}=${v}`).join("; ");
  if (bypass) headers["x-vercel-protection-bypass"] = bypass;
  if (body) headers["content-type"] = "application/json";
  const response = await fetch(site + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const value = response.headers
    .get("content-type")
    ?.includes("application/json")
    ? await response.json()
    : null;
  return { status: response.status, value };
}
function successful(response, operation) {
  if (response.status < 200 || response.status >= 300)
    throw Error(
      `${operation}: HTTP ${response.status} ${response.value?.error || ""}`,
    );
  return response.value;
}
async function upload(owner, bytes, purpose, filename, contentType) {
  const entry = successful(
    await api("/api/uploads", owner, "POST", {
      purpose,
      filename,
      size: bytes.length,
      contentType,
    }),
    "Upload registration",
  );
  check(
    await owner.client.storage
      .from(entry.bucket)
      .upload(entry.path, bytes, { contentType }),
  );
  return entry;
}
async function waitJob(id, owner, expected) {
  const end = Date.now() + 150000;
  while (Date.now() < end) {
    const { job } = successful(
      await api(`/api/jobs/${id}`, owner),
      "Job recovery",
    );
    if (expected.includes(job.status)) return job;
    if (["failed", "cancelled"].includes(job.status))
      throw Error(`Workflow ${job.kind}: ${job.error || job.status}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw Error("Workflow did not finish within the live verification window.");
}
async function removeFolder(prefix) {
  const entries = check(
    await admin.storage.from("yanco-user-assets").list(prefix, { limit: 1000 }),
  );
  const files = [];
  for (const entry of entries) {
    const path = prefix + "/" + entry.name;
    if (entry.id) files.push(path);
    else await removeFolder(path);
  }
  if (files.length)
    check(await admin.storage.from("yanco-user-assets").remove(files));
}
try {
  for (let index = 0; index < 2; index++) {
    const email = `yanco-live-${randomUUID()}@example.invalid`,
      password = randomUUID() + "!Aa";
    const { user } = check(
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      }),
    );
    const cookies = new Map();
    const client = createServerClient(url, key, {
      cookies: {
        getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
        setAll: (values) => values.forEach((v) => cookies.set(v.name, v.value)),
      },
    });
    users.push({ user, cookies, client });
    check(await client.auth.signInWithPassword({ email, password }));
  }
  const [a, b] = users;
  assert.equal((await api("/api/scenes")).status, 401);
  const scene = successful(
    await api("/api/scenes", a, "POST", {
      name: "Live test",
      data: {
        collectionId: "mars",
        itemId: "mars:MR-710",
        tabletop: "oak",
        food: "salmon",
        scale: 1,
        rotation: 0,
        x: 2,
        y: 0,
      },
    }),
    "Scene save",
  );
  assert(
    successful(await api("/api/scenes", a), "Scene recovery").scenes.some(
      (s) => s.id === scene.id,
    ),
  );
  assert(
    !successful(await api("/api/scenes", b), "Scene isolation").scenes.some(
      (s) => s.id === scene.id,
    ),
  );
  console.log("Deployed authentication and saved-scene isolation passed.");
  const menu = await upload(
    a,
    Buffer.from("Seasonal seafood, handmade pasta and salads"),
    "menu",
    "menu.txt",
    "text/plain",
  );
  const menuJob = successful(
    await api("/api/jobs", a, "POST", { kind: "menu", uploadId: menu.id }),
    "Menu start",
  );
  assert.equal((await api(`/api/jobs/${menuJob.id}`, b)).status, 404);
  const completed = await waitJob(menuJob.id, a, ["completed"]);
  assert(completed.result.text.includes("handmade pasta"));
  console.log("Durable deployed menu extraction and job recovery passed.");
  const missing = successful(
    await api("/api/uploads", a, "POST", {
      purpose: "menu",
      filename: "retry.txt",
      size: 12,
      contentType: "text/plain",
    }),
    "Retry upload registration",
  );
  const retryJob = successful(
    await api("/api/jobs", a, "POST", { kind: "menu", uploadId: missing.id }),
    "Failure test start",
  );
  await waitJob(retryJob.id, a, ["failed"]);
  check(
    await a.client.storage
      .from(missing.bucket)
      .upload(missing.path, Buffer.from("Retry worked"), {
        contentType: "text/plain",
      }),
  );
  successful(
    await api(`/api/jobs/${retryJob.id}`, a, "PATCH", { action: "retry" }),
    "Job retry",
  );
  assert(
    (await waitJob(retryJob.id, a, ["completed"])).result.text.includes(
      "Retry worked",
    ),
  );
  console.log("Deployed failure persistence and retry passed.");
  const pdf = await upload(
    a,
    await readFile(".cache/live-catalog.pdf"),
    "catalog",
    "source-test.pdf",
    "application/pdf",
  );
  const importJob = successful(
    await api("/api/jobs", a, "POST", { kind: "catalog", uploadId: pdf.id }),
    "Catalog start",
  );
  const review = await waitJob(importJob.id, a, ["review"]);
  const catalogId = review.result.catalogId;
  const catalog = successful(
    await api(`/api/catalogs/${catalogId}`, a),
    "Catalog review",
  );
  assert(catalog.items.length > 0);
  assert.equal((await api(`/api/catalogs/${catalogId}`, b)).status, 404);
  const item = catalog.items[0];
  successful(
    await api(`/api/catalogs/${catalogId}`, a, "PATCH", {
      item: {
        ...item.data,
        id: item.id,
        specification: item.data.specification + " reviewed",
        crop: { x: 55, y: 60, w: 20, h: 10 },
      },
    }),
    "Field correction",
  );
  const corrected = successful(
    await api(`/api/catalogs/${catalogId}`, a),
    "Corrected catalog",
  ).items.find((i) => i.id === item.id);
  assert.equal(corrected.data.originalSpecification, item.data.specification);
  assert(corrected.data.image.includes("/crop-"));
  successful(
    await api(`/api/catalogs/${catalogId}`, a, "PATCH", {
      action: "activate",
      reviewConfirmed: true,
    }),
    "Catalog activation",
  );
  assert.equal(
    successful(await api(`/api/catalogs/${catalogId}`, a), "Active catalog")
      .catalog.status,
    "active",
  );
  console.log(
    "Deployed PDF.js/Tesseract OCR, private review, corrections and activation passed.",
  );
  const cancellation = successful(
    await api("/api/jobs", a, "POST", { kind: "catalog", uploadId: pdf.id }),
    "Cancellation start",
  );
  successful(
    await api(`/api/jobs/${cancellation.id}`, a, "PATCH", { action: "cancel" }),
    "Cancellation",
  );
  assert.equal(
    successful(
      await api(`/api/jobs/${cancellation.id}`, a),
      "Cancelled job recovery",
    ).job.status,
    "cancelled",
  );
  const photo = await upload(
    a,
    await readFile("public/catalog/MR-710.webp"),
    "food",
    "test.webp",
    "image/webp",
  );
  const unavailable = await api("/api/jobs", a, "POST", {
    kind: "food-preview",
    uploadId: photo.id,
  });
  assert.equal(unavailable.status, 503);
  assert(unavailable.value.error.includes("crop and place"));
  console.log(
    "Deployed cancellation and missing-AI-key behavior passed. No paid image generation was invoked.",
  );
} finally {
  for (const owner of users) {
    const jobs = await admin
      .from("yanco_jobs")
      .select("id,status")
      .eq("owner_id", owner.user.id);
    for (const job of jobs.data || [])
      if (["queued", "running"].includes(job.status))
        await api(`/api/jobs/${job.id}`, owner, "PATCH", { action: "cancel" });
  }
  await new Promise((resolve) => setTimeout(resolve, 2000));
  for (const owner of users) {
    await removeFolder(owner.user.id);
    check(await admin.auth.admin.deleteUser(owner.user.id));
  }
}
