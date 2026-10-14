import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
const owner = "00000000-0000-4000-8000-000000000001",
  upload = "00000000-0000-4000-8000-000000000002",
  catalog = "00000000-0000-4000-8000-000000000003",
  job = "00000000-0000-4000-8000-000000000004";
async function workspace(page: Page) {
  const user = {
    id: owner,
    email: "restaurant@example.invalid",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  };
  const jwt = [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: owner,
        aud: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url"),
    "test-signature",
  ].join(".");
  const cookie =
    "base64-" +
    Buffer.from(
      JSON.stringify({
        access_token: jwt,
        refresh_token: "test-refresh-token",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        token_type: "bearer",
        user,
      }),
    ).toString("base64url");
  await page.addInitScript((value) => {
    document.cookie = `sb-gmsegfbejshohdgnolwb-auth-token=${value}; path=/; SameSite=Lax`;
  }, cookie);
  await page.route("**/auth/v1/user", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(user),
    }),
  );
  let size = 0;
  const state: { jobs: unknown[]; scenes: unknown[]; catalogs: unknown[] } = {
    jobs: [],
    scenes: [],
    catalogs: [],
  };
  const json = (
    r: Parameters<Parameters<Page["route"]>[1]>[0],
    data: unknown,
    status = 200,
  ) =>
    r.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  await page.route("**/api/uploads", (r) => {
    size = r.request().postDataJSON().size;
    return json(r, {
      id: upload,
      path: `${owner}/${upload}.txt`,
      bucket: "yanco-user-assets",
    });
  });
  await page.route(
    "**.storage.supabase.co/storage/v1/upload/resumable**",
    (r) =>
      r.fulfill({
        status: r.request().method() === "POST" ? 201 : 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST,PATCH,HEAD,OPTIONS",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Expose-Headers":
            "Location,Upload-Offset,Tus-Resumable,Upload-Length",
          "Tus-Resumable": "1.0.0",
          "Upload-Offset": String(size),
          Location: `https://gmsegfbejshohdgnolwb.storage.supabase.co/storage/v1/upload/resumable/test`,
        },
        body: "",
      }),
  );
  await page.route("**/api/sessions", (r) => json(r, { sessions: [] }));
  await page.route("**/api/catalogs", (r) =>
    json(r, { catalogs: state.catalogs }),
  );
  await page.route("**/api/scenes", (r) => {
    if (r.request().method() === "POST") {
      const v = r.request().postDataJSON();
      state.scenes.push({ id: upload, ...v });
      return json(r, { id: upload });
    }
    return json(r, { scenes: state.scenes });
  });
  await page.route("**/api/jobs", (r) => {
    if (r.request().method() === "POST") {
      const body = r.request().postDataJSON();
      state.jobs = [
        {
          id: job,
          kind: body.kind,
          status: "completed",
          progress: 100,
          result: { text: "Pasta, seafood and salads" },
          created_at: "2026-10-13T00:00:00Z",
        },
      ];
      return json(r, { id: job }, 202);
    }
    return json(r, { jobs: state.jobs });
  });
  return { state, json };
}
test("direct menu upload recovers its result across navigation", async ({
  page,
}) => {
  await workspace(page);
  await page.goto("/workspace");
  await expect(
    page.getByRole("heading", { name: "Start with what you serve." }),
  ).toBeVisible();
  await page.getByLabel("Upload menu", { exact: true }).setInputFiles({
    name: "menu.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Pasta, seafood and salads"),
  });
  await expect(page.getByRole("button", { name: "Review menu" })).toBeVisible();
  await page.goto("/catalog");
  await page.goto("/workspace");
  await page.getByRole("button", { name: "Review menu" }).click();
  await expect(page.getByPlaceholder("Or paste your menu here…")).toHaveValue(
    "Pasta, seafood and salads",
  );
  await page.getByRole("button", { name: "Use menu in expert mode" }).click();
  await expect(
    page.getByPlaceholder("Pasta, ramen, salads, small plates…"),
  ).toHaveValue("Pasta, seafood and salads");
});
test("saved studio scenes reopen with the same surface and placement", async ({
  page,
}) => {
  await workspace(page);
  await page.goto("/studio");
  await page.getByRole("button", { name: "Dark stone", exact: true }).click();
  await page.getByRole("button", { name: /Food layer/ }).press("ArrowRight");
  await page.getByRole("button", { name: "Save to workspace" }).click();
  await expect(page.getByRole("status")).toContainText("Scene saved");
  await page.goto("/workspace");
  await page.getByRole("link", { name: "Open setting" }).click();
  await expect(page.locator(".studio-scene")).toHaveClass(/surface-dark/);
  await page.getByLabel("Rotation", { exact: true }).fill("45");
  await page.reload();
  await expect(page.getByLabel("Rotation", { exact: true })).toHaveValue("45");
  await page
    .getByRole("button", { name: "Reset placement", exact: true })
    .click();
  await page.reload();
  await expect(page.getByLabel("Rotation", { exact: true })).toHaveValue("0");
});
test("import corrections and activation require a source review", async ({
  page,
}) => {
  const { json } = await workspace(page);
  const c = {
    id: "personal",
    name: "Personal collection",
    prefix: "MR",
    category: "chinaware",
    material: "porcelain",
    section: "imported",
    colors: ["blue"],
    budget: 2,
    sourcePages: [1],
    pdfPages: [1],
    image: "/catalog/MR-710.webp",
    heroImage: "/catalog/MR-710.webp",
    description: "",
    tags: [],
    itemCount: 1,
  };
  const i = {
    id: "personal:MR-710",
    collectionId: "personal",
    sku: "MR-710",
    name: "Round plate",
    type: "plate",
    shape: "round",
    color: "blue",
    dimensions: { length: 10.25, width: null, height: 1 },
    capacityOz: null,
    casePack: "1 DZ",
    specification: 'MR-710 10 1/4" x 1" 1 DZ',
    pdfPage: 1,
    sourcePage: 1,
    image: "/catalog/MR-710.webp",
    reviewNeeded: true,
  };
  let status = "draft";
  await page.route(`**/api/catalogs/${catalog}**`, (r) => {
    if (r.request().method() === "PATCH") {
      const body = r.request().postDataJSON();
      if (body.action === "activate") status = "active";
      if (body.item) Object.assign(i, body.item);
      return json(r, { saved: true, status });
    }
    return json(r, {
      catalog: { name: "Imported catalog", status },
      items: [{ id: i.id, data: i, preview: i.image, pagePreview: i.image }],
      collections: [{ id: c.id, data: c }],
      count: 1,
    });
  });
  await page.goto(`/workspace/catalogs/${catalog}`);
  await expect(
    page.getByRole("button", { name: "Activate for recommendations" }),
  ).toBeDisabled();
  await page.getByLabel("length MR-710").fill("10.5");
  await page.getByRole("button", { name: "Save MR-710", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Changes saved");
  await page
    .getByRole("checkbox", {
      name: "I have reviewed the imported records against the source.",
    })
    .check();
  await page
    .getByRole("button", { name: "Activate for recommendations" })
    .click();
  await expect(
    page.getByRole("button", { name: "Confirm active catalog" }),
  ).toBeVisible();
});
test("AI failures preserve the uploaded photo scene", async ({ page }) => {
  await workspace(page);
  await page.route("**/api/jobs", (r) =>
    r.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error:
          "AI food previews are temporarily unavailable. You can still crop and place your photo.",
      }),
    }),
  );
  await page.goto("/studio");
  await page.locator("input[type=file]").setInputFiles({
    name: "food.webp",
    mimeType: "image/webp",
    buffer: await readFile("public/food/salmon.webp"),
  });
  await expect(page.getByRole("status")).toContainText("Photo uploaded");
  await page.getByRole("button", { name: "Generate food preview" }).click();
  await expect(page.getByRole("status")).toContainText(
    "temporarily unavailable",
  );
  await expect(page.locator(".scene-food img")).toHaveAttribute(
    "src",
    /^blob:/,
  );
});
