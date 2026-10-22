import { describe, expect, it, vi } from "vitest";
import {
  requestHasAllowedOrigin,
  safeReturnPath,
} from "../../src/lib/request-security";

vi.mock("server-only", () => ({}));
import { apiError, readJson } from "../../src/lib/api";

describe("request origin validation", () => {
  it.each([
    "null",
    "not-a-url",
    "",
    "http://unrelated.example",
    "https://site.example",
    "http://site.example:8080",
    "http://site.example/path",
    "http://user@site.example",
  ])("rejects a foreign or malformed origin: %s", (origin) => {
    expect(
      requestHasAllowedOrigin(
        new Request("http://site.example/api/jobs", {
          headers: { origin },
        }),
      ),
    ).toBe(false);
  });
  it("allows the exact origin and non-browser requests without Origin", () => {
    expect(
      requestHasAllowedOrigin(
        new Request("https://site.example/api/jobs", {
          headers: { origin: "https://site.example" },
        }),
      ),
    ).toBe(true);
    expect(
      requestHasAllowedOrigin(new Request("https://site.example/api/jobs")),
    ).toBe(true);
  });
  it("uses the public Host when Next.js uses an internal hostname", () => {
    expect(
      requestHasAllowedOrigin(
        new Request("http://localhost:4173/api/jobs", {
          headers: { host: "127.0.0.1:4173", origin: "http://127.0.0.1:4173" },
        }),
      ),
    ).toBe(true);
    expect(
      requestHasAllowedOrigin(
        new Request("https://internal.example/api/jobs", {
          headers: {
            host: "site.example",
            origin: "https://unrelated.example",
          },
        }),
      ),
    ).toBe(false);
  });
});

describe("login return paths", () => {
  it.each([
    null,
    "",
    "//external.example",
    "/\\external.example",
    "/\\\\external.example",
    "/\t/external.example",
    "https://external.example",
  ])("keeps unsafe return paths on the website: %s", (value) => {
    expect(safeReturnPath(value)).toBe("/");
  });
  it("preserves local recovery and studio parameters", () => {
    expect(safeReturnPath("/?recovery=1")).toBe("/?recovery=1");
    expect(safeReturnPath("/studio?collection=legna#placement")).toBe(
      "/studio?collection=legna#placement",
    );
  });
});

describe("JSON request errors", () => {
  it.each(["{broken", "null", "[]", '"text"', "42"])(
    "returns a client error for invalid request details: %s",
    async (body) => {
      const error = await readJson(
        new Request("https://site.example/api/jobs", {
          method: "POST",
          body,
        }),
      ).catch((reason: unknown) => reason);
      expect(apiError(error).status).toBe(400);
    },
  );
  it("accepts a JSON object", async () => {
    await expect(
      readJson(
        new Request("https://site.example/api/jobs", {
          method: "POST",
          body: '{"name":"My table"}',
        }),
      ),
    ).resolves.toEqual({ name: "My table" });
  });
});
