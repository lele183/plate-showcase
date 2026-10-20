import { describe, expect, it } from "vitest";
import {
  catalogFilters,
  studioSettings,
  studioView,
  studioParams,
} from "../../src/lib/url-state";
import {
  parseGuestWorkspace,
  GUEST_WORKSPACE_KEY,
} from "../../src/lib/guest-workspace";
describe("shareable settings", () => {
  it("keeps catalog searches and rejects invalid filters", () => {
    expect(
      catalogFilters(new URLSearchParams("category=chinaware&q=mug&budget=2")),
    ).toEqual({
      query: "mug",
      category: "chinaware",
      budget: "2",
      color: "all",
    });
    expect(
      catalogFilters(new URLSearchParams("category=invalid&budget=99")),
    ).toMatchObject({ category: "all", budget: "all" });
  });
  it("round trips public scenes without exposing photo references", () => {
    const scene = {
      collectionId: "legna",
      itemId: "legna-le-110",
      tabletop: "dark",
      food: "vegetables",
      scale: 1.25,
      rotation: 35,
      x: -4,
      y: 6,
      cropPercent: 120,
      foodUrl: "/api/assets?path=owner/private.png",
    };
    const params = studioParams(scene, "3d");
    expect(studioSettings(params)).toMatchObject({
      tabletop: scene.tabletop,
      food: scene.food,
      scale: scene.scale,
      rotation: scene.rotation,
      x: scene.x,
      y: scene.y,
      cropPercent: scene.cropPercent,
    });
    expect(studioView(params)).toBe("3d");
    expect(params.toString()).not.toContain("private");
    expect(params.get("item")).toBe(scene.itemId);
  });
  it("starts 3D without food and preserves explicit food when sharing either view", () => {
    expect(studioSettings(new URLSearchParams("view=3d")).food).toBe("none");
    expect(
      studioSettings(new URLSearchParams("view=3d&food=salmon")).food,
    ).toBe("salmon");
    for (const view of ["top", "3d"]) {
      for (const food of ["none", "salmon", "vegetables"]) {
        const params = studioParams(
          {
            collectionId: "mars",
            itemId: "mars:MR-710",
            tabletop: "oak",
            food,
            scale: 1,
            rotation: 0,
            x: 0,
            y: 0,
          },
          view,
        );
        expect(studioSettings(params).food).toBe(food);
      }
    }
  });
  it("cleans default placement and clamps malformed inputs", () => {
    const params = new URLSearchParams(
      "portion=Infinity&rotation=900&x=-999&y=NaN&surface=bad&food=bad&view=bad&crop=-1",
    );
    expect(studioSettings(params)).toMatchObject({
      scale: 1,
      rotation: 180,
      x: -35,
      y: 0,
      tabletop: "oak",
      food: "salmon",
      cropPercent: 100,
    });
    expect(studioView(params)).toBe("top");
    const reset = studioParams(
      {
        collectionId: "legna",
        itemId: "piece",
        tabletop: "oak",
        food: "salmon",
        scale: 1,
        rotation: 0,
        x: 0,
        y: 0,
      },
      "top",
      params,
    );
    for (const field of [
      "portion",
      "rotation",
      "x",
      "y",
      "crop",
      "surface",
      "view",
      "food",
    ])
      expect(reset.has(field)).toBe(false);
    expect(reset.get("layout")).toBe("1");
  });
});
describe("guest draft validation", () => {
  it("recovers from malformed, outdated and oversized drafts", () => {
    for (const raw of [
      null,
      "{bad",
      '{"version":0}',
      JSON.stringify({
        version: 1,
        menu: { text: "x".repeat(80001) },
        scenes: [],
      }),
    ])
      expect(parseGuestWorkspace(raw)).toEqual({
        version: 1,
        menu: { text: "" },
        scenes: [],
      });
    expect(GUEST_WORKSPACE_KEY).toBe("yanco_guest_workspace_v1");
  });
  it("strips private references from on-device starter scenes", () => {
    const data = parseGuestWorkspace(
      JSON.stringify({
        version: 1,
        menu: { text: "Soup and salad" },
        scenes: [
          {
            id: "local",
            name: "Legna",
            created: 1,
            view: "3d",
            data: {
              collectionId: "legna",
              itemId: "piece",
              tabletop: "oak",
              food: "none",
              scale: 1,
              rotation: 0,
              x: 0,
              y: 0,
              foodUrl: "/api/assets?path=private",
            },
          },
        ],
      }),
    );
    expect(data.scenes).toHaveLength(1);
    expect(data.scenes[0].data).not.toHaveProperty("foodUrl");
    expect(data.menu.text).toBe("Soup and salad");
  });
});
