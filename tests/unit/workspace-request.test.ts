import { afterEach, describe, expect, it, vi } from "vitest";
import { workspaceRequest } from "../../src/lib/workspace-request";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function stalledFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_path: string, options: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          options.signal?.addEventListener("abort", () =>
            reject(new DOMException("Request aborted", "AbortError")),
          );
        }),
    ),
  );
}

describe("workspace network recovery", () => {
  it("keeps a successful account payload available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          jobs: [{ id: "menu-import", status: "running", progress: 30 }],
        }),
      ),
    );
    await expect(workspaceRequest("/api/jobs")).resolves.toMatchObject({
      jobs: [{ id: "menu-import", status: "running", progress: 30 }],
    });
  });

  it("preserves the server's actionable error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: "Sign in to use uploads and saved projects." },
            { status: 401 },
          ),
        ),
    );
    await expect(workspaceRequest("/api/jobs")).rejects.toThrow(
      "Sign in to use uploads and saved projects.",
    );
  });

  it("turns a stalled request into an error the workspace can recover from", async () => {
    vi.useFakeTimers();
    stalledFetch();
    const result = expect(
      workspaceRequest("/api/jobs", {}, 1000),
    ).rejects.toThrow("Check your connection and try again.");
    await vi.advanceTimersByTimeAsync(1000);
    await result;
  });

  it("allows leaving the workspace to cancel in-flight reads", async () => {
    stalledFetch();
    const controller = new AbortController();
    const result = expect(
      workspaceRequest("/api/jobs", { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await result;
  });
});
