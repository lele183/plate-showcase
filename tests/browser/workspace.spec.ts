import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import axe from "axe-core";
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
  const state: {
    jobs: unknown[];
    scenes: unknown[];
    catalogs: unknown[];
    sessions: unknown[];
  } = {
    jobs: [],
    scenes: [],
    catalogs: [],
    sessions: [],
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
  await page.route("**/api/sessions", (r) => {
    if (r.request().method() === "POST") {
      state.sessions.unshift({ id: job, ...r.request().postDataJSON() });
      return json(r, { id: job });
    }
    return json(r, { sessions: state.sessions });
  });
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
test("menu upload shows its result beside the uploader and guides the handoff", async ({
  page,
}, testInfo) => {
  await workspace(page);
  await page.goto("/workspace");
  await page
    .getByLabel("Upload menu", { exact: true })
    .scrollIntoViewIfNeeded();
  await page.getByLabel("Upload menu", { exact: true }).setInputFiles({
    name: "dinner-menu.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Pasta, seafood and salads"),
  });
  const panel = page.locator("#workspace-menu");
  await expect(panel.getByRole("status")).toContainText("Menu ready to review");
  await expect(
    panel.getByLabel("Paste menu text", { exact: true }),
  ).toHaveValue("Pasta, seafood and salads");
  await expect(panel.getByRole("status")).toContainText("dinner-menu.txt");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => {
    const client = window as unknown as { axe: typeof axe };
    return (
      await client.axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
        },
      })
    ).violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map((node) => node.target),
    }));
  });
  expect(violations).toEqual([]);
  await page.screenshot({
    path: `.cache/qa/workspace-account-menu-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Use menu in expert mode" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Your menu is ready to use." }),
  ).toBeVisible();
  await expect(
    page.getByPlaceholder("Pasta, ramen, salads, small plates…"),
  ).toHaveValue("Pasta, seafood and salads");
});
test("uploading and failed uploads show feedback and allow retrying the same file", async ({
  page,
}) => {
  const { json } = await workspace(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let failed = true;
  await page.route("**/api/uploads", async (route) => {
    if (failed) {
      await gate;
      return json(route, { error: "Connection interrupted. Try again." }, 503);
    }
    return route.fallback();
  });
  await page.goto("/workspace");
  const panel = page.locator("#workspace-menu");
  const file = {
    name: "menu.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Pasta and salad"),
  };
  await panel.getByLabel("Upload menu", { exact: true }).setInputFiles(file);
  await expect(panel.getByRole("status")).toContainText("Uploading menu... 0%");
  await expect(panel.getByRole("progressbar")).toHaveAttribute("value", "0");
  await expect(panel.getByRole("status")).toContainText("Keep this page open");
  release();
  await expect(panel.getByRole("alert")).toContainText(
    "Connection interrupted",
  );
  failed = false;
  await panel.getByLabel("Upload menu", { exact: true }).setInputFiles(file);
  await expect(panel.getByRole("status")).toContainText("Menu ready to review");
  await expect(panel.getByRole("alert")).not.toBeVisible();
});
test("catalog uploads explain the review and activation step", async ({
  page,
}) => {
  const { state, json } = await workspace(page);
  await page.route("**/api/jobs", (route) => {
    if (route.request().method() === "POST") {
      state.jobs = [
        {
          id: job,
          kind: "catalog",
          status: "review",
          progress: 100,
          input: { catalogId: catalog, filename: "dinnerware.pdf" },
          result: { catalogId: catalog, itemCount: 12 },
          created_at: "2026-10-13T00:00:00Z",
        },
      ];
      return json(route, { id: job }, 202);
    }
    return json(route, { jobs: state.jobs });
  });
  await page.goto("/workspace");
  const panel = page.locator("#workspace-catalogs");
  await panel
    .getByLabel("Upload catalog", { exact: true })
    .setInputFiles(resolve("tests/fixtures/guest-menu.pdf"));
  await expect(panel.getByRole("status")).toContainText(
    "Catalog ready for review",
  );
  await expect(panel.getByRole("status")).toContainText("12 pieces found");
  await expect(
    panel.getByRole("link", { name: "Review and activate catalog" }),
  ).toHaveAttribute("href", `/workspace/catalogs/${catalog}`);
  await expect(panel).toContainText("only after you review and activate");
});
test("an unfinished menu resumes after reload and fills the editor when processing completes", async ({
  page,
}) => {
  const { state } = await workspace(page);
  const menuJob = {
    id: job,
    kind: "menu",
    status: "running",
    progress: 30,
    result: {} as { text?: string },
    created_at: "2026-10-13T00:00:00Z",
  };
  state.jobs = [menuJob];
  await page.goto("/workspace");
  const panel = page.locator("#workspace-menu");
  await expect(panel.getByRole("status")).toContainText("Reading menu");
  await expect
    .poll(() =>
      page.evaluate(
        (id) => localStorage.getItem(`yanco-account-menu-v1:${id}`),
        owner,
      ),
    )
    .not.toBeNull();
  await page.reload();
  await expect(panel.getByRole("status")).toContainText("Reading menu");
  menuJob.status = "completed";
  menuJob.result = { text: "Seasonal pasta and grilled fish" };
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    panel.getByLabel("Paste menu text", { exact: true }),
  ).toHaveValue("Seasonal pasta and grilled fish");
});
test("a deliberately cleared menu remains cleared after processing and reload", async ({
  page,
}) => {
  const { state } = await workspace(page);
  const menuJob = {
    id: job,
    kind: "menu",
    status: "running",
    progress: 30,
    result: {} as { text?: string },
    created_at: "2026-10-13T00:00:00Z",
  };
  state.jobs = [menuJob];
  await page.goto("/workspace");
  const editor = page
    .locator("#workspace-menu")
    .getByLabel("Paste menu text", { exact: true });
  await editor.fill("Temporary text");
  await editor.clear();
  await page.reload();
  menuJob.status = "completed";
  menuJob.result = { text: "Unwanted original text" };
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.locator("#workspace-menu").getByRole("status"),
  ).toContainText("Menu ready to review");
  await expect(editor).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Review extracted menu" }),
  ).toBeVisible();
});
test("menu progress returns after navigation and completion does not overwrite edits", async ({
  page,
}) => {
  const { state } = await workspace(page);
  const menuJob = {
    id: job,
    kind: "menu",
    status: "running",
    progress: 35,
    input: { filename: "service-menu.pdf" },
    result: {} as { text?: string },
    created_at: "2026-10-13T00:00:00Z",
  };
  state.jobs = [menuJob];
  await page.goto("/workspace");
  const panel = page.locator("#workspace-menu");
  await expect(panel.getByRole("status")).toContainText("Reading menu");
  await expect(panel.getByRole("progressbar")).toHaveAttribute("value", "35");
  const editor = panel.getByLabel("Paste menu text", { exact: true });
  await editor.fill("My carefully corrected menu");
  menuJob.status = "completed";
  menuJob.progress = 100;
  menuJob.result = { text: "Original extracted text" };
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(panel.getByRole("status")).toContainText("Menu ready to review");
  await expect(editor).toHaveValue("My carefully corrected menu");
  await expect(
    panel.getByRole("button", { name: "Review extracted menu" }),
  ).toBeVisible();
  await page.reload();
  await expect(editor).toHaveValue("My carefully corrected menu");
  await panel.getByRole("button", { name: "Review extracted menu" }).click();
  await expect(editor).toHaveValue("Original extracted text");
  await expect(editor).toBeFocused();
});
test("a failed saved-settings request leaves the menu and other work usable", async ({
  page,
}) => {
  const { state, json } = await workspace(page);
  state.jobs = [
    {
      id: job,
      kind: "menu",
      status: "completed",
      progress: 100,
      result: { text: "Grilled fish and salads" },
      created_at: "2026-10-13T00:00:00Z",
    },
  ];
  let failed = true;
  await page.route("**/api/scenes", (route) =>
    json(
      route,
      failed ? { error: "Connection interrupted" } : { scenes: [] },
      failed ? 503 : 200,
    ),
  );
  await page.goto("/workspace");
  await expect(page.getByLabel("Paste menu text", { exact: true })).toHaveValue(
    "Grilled fish and salads",
  );
  const settings = page.locator("#workspace-settings");
  await expect(settings.getByRole("alert")).toContainText(
    "Could not update saved table settings",
  );
  await expect(
    settings.getByText("Build your first table setting."),
  ).not.toBeVisible();
  failed = false;
  await settings
    .getByRole("button", { name: "Retry loading saved table settings" })
    .click();
  await expect(settings.getByRole("alert")).not.toBeVisible();
  await expect(
    settings.getByText("Build your first table setting."),
  ).toBeVisible();
});
test("failed and empty menu results give a recovery path", async ({ page }) => {
  const { state, json } = await workspace(page);
  const menuJob = {
    id: job,
    kind: "menu",
    status: "failed",
    progress: 20,
    error: "The image could not be read",
    result: {} as { text?: string },
    created_at: "2026-10-13T00:00:00Z",
  };
  state.jobs = [menuJob];
  await page.route(`**/api/jobs/${job}`, (route) => {
    menuJob.status = "running";
    menuJob.progress = 0;
    return json(route, { status: "running" });
  });
  await page.goto("/workspace");
  const panel = page.locator("#workspace-menu");
  await expect(panel.getByRole("alert")).toContainText(
    "Menu extraction failed",
  );
  await panel.getByRole("button", { name: "Retry menu processing" }).click();
  await expect(panel.getByRole("status")).toContainText("Reading menu");
  menuJob.status = "completed";
  menuJob.result = { text: "   " };
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(panel.getByRole("status")).toContainText("No menu text found");
  await expect(
    panel.getByRole("button", { name: "Use menu in expert mode" }),
  ).toBeDisabled();
  await panel
    .getByLabel("Paste menu text", { exact: true })
    .fill("Soup and pasta");
  await expect(
    panel.getByRole("button", { name: "Use menu in expert mode" }),
  ).toBeEnabled();
});
test("a cancelled menu explains how to start again", async ({ page }) => {
  const { state, json } = await workspace(page);
  const menuJob = {
    id: job,
    kind: "menu",
    status: "running",
    progress: 15,
    created_at: "2026-10-13T00:00:00Z",
  };
  state.jobs = [menuJob];
  await page.route(`**/api/jobs/${job}`, (route) => {
    expect(route.request().postDataJSON()).toEqual({ action: "cancel" });
    menuJob.status = "cancelled";
    return json(route, { status: "cancelled" });
  });
  await page.goto("/workspace");
  const panel = page.locator("#workspace-menu");
  await panel.getByRole("button", { name: "Cancel menu processing" }).click();
  await expect(panel.getByRole("status")).toContainText("Processing cancelled");
  await expect(panel).toContainText("Choose a file to start again");
  await expect(panel.getByLabel("Upload menu", { exact: true })).toBeEnabled();
});
test("workspace works without newer AbortSignal convenience methods", async ({
  page,
}) => {
  await workspace(page);
  await page.addInitScript(() => {
    Object.defineProperty(AbortSignal, "any", { value: undefined });
    Object.defineProperty(AbortSignal, "timeout", { value: undefined });
  });
  await page.goto("/workspace");
  const panel = page.locator("#workspace-menu");
  await panel.getByLabel("Upload menu", { exact: true }).setInputFiles({
    name: "menu.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Pasta and fish"),
  });
  await expect(panel.getByRole("status")).toContainText("Menu ready to review");
  await expect(
    panel.getByLabel("Paste menu text", { exact: true }),
  ).toHaveValue("Pasta, seafood and salads");
});
test("a named selection saves and reopens the restaurant brief", async ({
  page,
}) => {
  await workspace(page);
  await page.goto("/workspace");
  const section = page.locator("#workspace-selections");
  await section.getByRole("button", { name: "Save current selection" }).click();
  await expect(section.getByRole("alert")).toContainText(
    "Start a selection first",
  );
  await page.goto("/");
  await page
    .getByPlaceholder("An Italian trattoria, a modern bistro…")
    .fill("My neighborhood bistro");
  await page.goto("/workspace");
  await section.getByLabel("Name this selection").fill("Summer service");
  await section.getByRole("button", { name: "Save current selection" }).click();
  await expect(section.getByRole("status")).toContainText("Selection saved");
  await expect(
    section.getByRole("heading", { name: "Summer service", exact: true }),
  ).toBeVisible();
  await page.reload();
  await section
    .getByRole("button", { name: "Open brief", exact: true })
    .click();
  await expect(
    page.getByPlaceholder("An Italian trattoria, a modern bistro…"),
  ).toHaveValue("My neighborhood bistro");
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
for (const delayed of ["saved scene", "collection"] as const) {
  test(`late ${delayed} restoration preserves a newer placement reset`, async ({
    page,
  }) => {
    const { state, json } = await workspace(page);
    state.scenes.push({
      id: upload,
      name: "Saved Mars",
      data: {
        collectionId: "mars",
        itemId: "mars:MR-710",
        tabletop: "dark",
        food: "salmon",
        scale: 1,
        rotation: 45,
        x: 0,
        y: 0,
      },
    });
    let release!: () => void;
    let requested!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      requested = resolve;
    });
    if (delayed === "saved scene") {
      await page.route("**/api/scenes", async (route) => {
        requested();
        await gate;
        await json(route, { scenes: state.scenes });
      });
    } else {
      await page.route("**/api/catalog?collection=mars", async (route) => {
        requested();
        await gate;
        await route.continue();
      });
    }
    await page.goto(
      `/studio?scene=${upload}&layout=1&collection=mars&item=mars%3AMR-710&rotation=45`,
    );
    await started;
    await page
      .getByRole("button", { name: "Reset placement", exact: true })
      .click();
    await expect(page.getByLabel("Rotation", { exact: true })).toHaveValue("0");
    release();
    await page.waitForLoadState("networkidle");
    await expect(page.getByLabel("Rotation", { exact: true })).toHaveValue("0");
    await expect(page).not.toHaveURL(/rotation=45/);
  });
}
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
    page.getByRole("heading", { name: "From import to recommendations" }),
  ).toBeVisible();
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
  await expect(page.getByRole("status")).toContainText("Catalog activated");
  await expect(
    page.getByRole("link", { name: "Find dinnerware with this catalog" }),
  ).toHaveAttribute("href", "/#selector");
});
test("paused generation still allows photo placement and export without starting jobs", async ({
  page,
}) => {
  await workspace(page);
  const jobs: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/jobs") && request.method() === "POST")
      jobs.push(request.url());
  });
  await page.goto("/studio");
  await page.locator("input[type=file]").setInputFiles({
    name: "food.webp",
    mimeType: "image/webp",
    buffer: await readFile("public/food/salmon.webp"),
  });
  await expect(page.getByRole("status")).toContainText("Photo uploaded");
  await expect(
    page.getByRole("button", { name: "Generate food preview" }),
  ).toBeDisabled();
  await page.getByLabel("Crop", { exact: true }).fill("150");
  await page.getByLabel("Rotation", { exact: true }).fill("30");
  await expect(page.locator(".scene-food img")).toHaveAttribute(
    "src",
    /^blob:/,
  );
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download tabletop image" }).click();
  expect((await pending).suggestedFilename()).toMatch(/yanco-.*\.png/);
  expect(jobs).toEqual([]);
});
