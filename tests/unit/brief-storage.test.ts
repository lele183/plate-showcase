import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseStoredBrief,
  readStoredBrief,
  writeStoredBrief,
} from "../../src/lib/brief-storage";
import { emptyBrief } from "../../src/lib/types";
import { removeStorage } from "../../src/lib/browser-storage";

afterEach(() => vi.unstubAllGlobals());

describe("saved restaurant briefs", () => {
  it.each([null, "{broken", "[]", "false", '"old data"'])(
    "recovers safely from invalid saved data: %s",
    (raw) => expect(parseStoredBrief(raw)).toEqual(emptyBrief),
  );
  it("keeps only known string fields and respects menu and answer limits", () => {
    expect(
      parseStoredBrief(
        JSON.stringify({
          concept: 123,
          tabletop: { text: "invalid" },
          theme: "green",
          foods: "a".repeat(80001),
          material: "b".repeat(3001),
          extra: "unknown",
        }),
      ),
    ).toEqual({
      ...emptyBrief,
      theme: "green",
      foods: "a".repeat(80000),
      material: "b".repeat(3000),
    });
  });
  it("keeps the current visit usable when storage access or writes fail", () => {
    vi.stubGlobal("localStorage", {
      getItem() {
        throw new Error("Storage disabled");
      },
      setItem() {
        throw new Error("Storage full");
      },
      removeItem() {
        throw new Error("Storage disabled");
      },
    });
    expect(readStoredBrief()).toEqual(emptyBrief);
    expect(writeStoredBrief({ ...emptyBrief, concept: "Bistro" })).toBe(false);
    expect(() => removeStorage("yanco-brief")).not.toThrow();
  });
});
