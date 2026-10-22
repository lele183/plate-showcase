import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  admin: vi.fn(),
  createClient: vi.fn(),
  start: vi.fn(),
  config: vi.fn(),
  generate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/lib/api")>()),
  requireUser: vi.fn(async () => ({
    client: { from: mocks.from },
    user: { id: "00000000-0000-4000-8000-000000000001" },
  })),
}));
vi.mock("@/lib/supabase/server", () => ({ adminSupabase: mocks.admin }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
vi.mock("workflow/api", () => ({ start: mocks.start }));
vi.mock("workflow", () => ({ FatalError: class FatalError extends Error {} }));
vi.mock("@/workflows/import", () => ({
  importCatalogOrMenu: vi.fn(),
  createFoodPreview: vi.fn(),
}));
vi.mock("@/lib/food-preview", () => ({
  foodPreviewConfig: mocks.config,
  generateFoodLayer: mocks.generate,
}));

import { POST } from "../../src/app/api/jobs/route";
import { generateFood } from "../../src/workflows/steps";

describe("paused food generation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an authenticated generation request before quota reservation or job creation", async () => {
    const response = await POST(
      new Request("http://localhost/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "food-preview",
          uploadId: "00000000-0000-4000-8000-000000000002",
        }),
      }),
    );
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("paused");
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.config).not.toHaveBeenCalled();
  });

  it("stops a queued generation step before storage access or provider invocation", async () => {
    await expect(generateFood("queued-preview")).rejects.toThrow("paused");
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.config).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
