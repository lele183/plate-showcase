/* eslint-disable @next/next/no-img-element -- Canvas export uses the exact source images and user blob URLs. */
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  Download,
  Upload,
  RotateCcw,
  Save,
  Sparkles,
  LoaderCircle,
  Move,
  Box,
  Link as LinkIcon,
} from "lucide-react";
import type { CatalogItem, Collection, Scene } from "@/lib/types";
import { STUDIO_FALLBACK_CROP_RADIUS } from "@/types/catalog";
import TabletopPreview from "./TabletopPreview";
import { supportsDinnerware } from "@/lib/dinnerware-model";
import { useAuth } from "./AuthProvider";
import { uploadFile, studioPhoto } from "@/lib/upload";
import {
  studioSettings,
  studioView,
  studioParams,
  replaceQuery,
} from "@/lib/url-state";
import { saveGuestScene } from "@/lib/guest-workspace";
import {
  readStorage,
  removeStorage,
  writeStorage,
} from "@/lib/browser-storage";
const Plate3D = dynamic(() => import("./Plate3D"), {
  ssr: false,
  loading: () => (
    <div
      className="three-view"
      role="status"
      aria-label="Loading 3D viewer"
      style={{
        display: "grid",
        placeItems: "center",
        aspectRatio: "auto",
        height: "clamp(360px, 47vw, 650px)",
      }}
    >
      <LoaderCircle className="spin" />
    </div>
  ),
});
const surfaces = [
  ["oak", "Warm oak"],
  ["dark", "Dark stone"],
  ["white", "White linen"],
  ["black", "Black linen"],
  ["stone", "Light stone"],
];
const foods = [
  ["salmon", "Seafood"],
  ["vegetables", "Vegetables"],
  ["toast", "Small plates"],
  ["none", "No food"],
];
const starterFoodImages: Record<string, string> = {
  salmon: "/food/salmon-v2.webp",
  vegetables: "/food/vegetables-v2.webp",
  toast: "/food/toast-v2.webp",
};
export default function Studio({
  collections,
  initialCollection,
  initialItems,
  sceneId,
  previewJobId,
  initialScene,
  initialView,
  initialFoodExplicit = false,
}: {
  collections: Collection[];
  initialCollection: Collection;
  initialItems: CatalogItem[];
  sceneId?: string;
  previewJobId?: string;
  initialScene: Scene;
  initialView: "top" | "3d";
  initialFoodExplicit?: boolean;
}) {
  const { user, openAuth } = useAuth();
  const [collection, setCollection] = useState(initialCollection),
    [items, setItems] = useState(initialItems),
    [item, setItem] = useState(
      initialItems.find((i) => i.id === initialScene.itemId) ||
        initialItems.find((i) => i.sku === "MR-710") ||
        initialItems.find((i) => i.type === "plate") ||
        initialItems[0],
    );
  const [scene, setScene] = useState<Scene>(initialScene),
    [view, setView] = useState(initialView),
    [copied, setCopied] = useState(false),
    [copyFallback, setCopyFallback] = useState(""),
    [unavailable3DItems, setUnavailable3DItems] = useState<
      Record<string, boolean>
    >({}),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [localPhoto, setLocalPhoto] = useState<string | null>(null),
    [jobId, setJobId] = useState<string | null>(previewJobId || null),
    [jobProgress, setJobProgress] = useState(0);
  const [threeReady, setThreeReady] = useState(false);
  const threeExport = useRef<(() => Promise<Blob>) | null>(null);
  const handle3DExport = useCallback(
    (capture: (() => Promise<Blob>) | null) => {
      threeExport.current = capture;
      setThreeReady(Boolean(capture));
    },
    [],
  );
  const [tabletopReady, setTabletopReady] = useState(false);
  const tabletopExport = useRef<(() => Promise<Blob>) | null>(null);
  const handleTabletopExport = useCallback(
    (capture: (() => Promise<Blob>) | null) => {
      tabletopExport.current = capture;
      setTabletopReady(Boolean(capture));
    },
    [],
  );
  const crop = scene.cropPercent || 100;
  const currentScene = useRef(initialScene);
  const currentView = useRef(initialView);
  const foodExplicit = useRef(initialFoodExplicit);
  const selectionRequest = useRef(0);
  const sceneRevision = useRef(0);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const change = useCallback((patch: Partial<Scene>) => {
    sceneRevision.current++;
    if (patch.food !== undefined) foodExplicit.current = true;
    const next = { ...currentScene.current, ...patch };
    if (!["custom", "ai"].includes(next.food)) next.foodUrl = undefined;
    currentScene.current = next;
    setScene(next);
    replaceQuery(
      studioParams(
        next,
        currentView.current,
        new URLSearchParams(location.search),
      ),
    );
  }, []);
  function changeView(next: "top" | "3d") {
    currentView.current = next;
    setView(next);
    if (!foodExplicit.current) {
      change({ food: next === "3d" ? "none" : "salmon", foodUrl: undefined });
      foodExplicit.current = false;
      return;
    }
    replaceQuery(
      studioParams(
        currentScene.current,
        next,
        new URLSearchParams(location.search),
      ),
    );
  }
  async function copyLink() {
    const publicScene = { ...scene };
    if (["custom", "ai"].includes(publicScene.food)) publicScene.food = "none";
    const url = `${location.origin}/studio?${studioParams(publicScene, view)}`;
    setCopyFallback("");
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
      if (["custom", "ai"].includes(scene.food))
        setMessage(
          "Studio link copied with your dinnerware and placement. Your private food photo stays in your account.",
        );
    } catch {
      setCopyFallback(url);
    }
  }
  const selectCollection = useCallback(
    async (id: string, itemId?: string, restored?: Scene) => {
      const request = ++selectionRequest.current;
      const revision = sceneRevision.current;
      setMessage("");
      try {
        const r = await fetch(
          `/api/catalog?collection=${encodeURIComponent(id)}`,
        );
        const data = await r.json();
        if (request !== selectionRequest.current) return;
        if (!r.ok) throw Error(data.error || "Unable to load this collection.");
        if (!data.collection || !data.items?.length)
          throw Error("This collection has no pieces to preview.");
        setCollection(data.collection);
        setItems(data.items);
        const next =
          data.items.find(
            (i: CatalogItem) =>
              i.id === itemId || i.sku.toLowerCase() === itemId?.toLowerCase(),
          ) ||
          data.items.find((i: CatalogItem) => i.sku === "MR-710") ||
          data.items.find((i: CatalogItem) => i.type === "plate") ||
          data.items[0];
        setItem(next);
        change({
          ...(revision === sceneRevision.current ? restored : {}),
          collectionId: id,
          itemId: next.id,
        });
      } catch (e) {
        if (request !== selectionRequest.current) return;
        setMessage(
          e instanceof Error ? e.message : "Unable to load this collection.",
        );
      }
    },
    [change],
  );
  const cancelSelection = useCallback(() => {
    selectionRequest.current++;
  }, []);
  const setCrop = (value: number) => change({ cropPercent: value });
  const sceneRef = useRef<HTMLDivElement>(null),
    fileRef = useRef<HTMLInputElement>(null),
    drag = useRef<{
      x: number;
      y: number;
      startX: number;
      startY: number;
    } | null>(null);
  const foodSource =
    localPhoto || scene.foodUrl || starterFoodImages[scene.food] || "";
  const handleUnavailable3D = useCallback((failedId: string) => {
    setUnavailable3DItems((previous) =>
      previous[failedId] ? previous : { ...previous, [failedId]: true },
    );
  }, []);
  useEffect(() => {
    try {
      const pending = JSON.parse(
        readStorage("yanco-studio-auth-draft") || "null",
      );
      if (
        pending &&
        pending.returnTo === location.pathname + location.search &&
        Date.now() - pending.created < 600000
      ) {
        removeStorage("yanco-studio-auth-draft");
        queueMicrotask(() => {
          void selectCollection(
            pending.scene.collectionId,
            pending.scene.itemId,
            pending.scene,
          );
        });
      }
    } catch {}
  }, [selectCollection]);
  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(location.search);
      const id =
        collections.find((c) => c.id === params.get("collection"))?.id ||
        "mars";
      currentView.current = studioView(params);
      setView(currentView.current);
      setLocalPhoto(null);
      void selectCollection(id, params.get("item") || undefined, {
        ...studioSettings(params),
        collectionId: id,
        itemId: "",
      });
    };
    window.addEventListener("popstate", restore);
    return () => {
      window.removeEventListener("popstate", restore);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      cancelSelection();
    };
  }, [collections, selectCollection, cancelSelection]);
  function authenticate() {
    writeStorage(
      "yanco-studio-auth-draft",
      JSON.stringify({
        created: Date.now(),
        returnTo: location.pathname + location.search,
        scene: { ...scene, collectionId: collection.id, itemId: item.id },
      }),
    );
    openAuth();
  }
  useEffect(() => {
    if (!sceneId || !user) return;
    const controller = new AbortController();
    const revision = sceneRevision.current;
    const selection = selectionRequest.current;
    fetch("/api/scenes", { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw Error(data.error || "Unable to load this saved scene.");
        return data;
      })
      .then((data) => {
        const saved = data.scenes?.find(
          (s: { id: string; data: Scene }) => s.id === sceneId,
        );
        if (
          saved &&
          !controller.signal.aborted &&
          revision === sceneRevision.current &&
          selection === selectionRequest.current
        ) {
          const params = new URLSearchParams(location.search);
          const restored =
            params.get("layout") === "1"
              ? { ...saved.data, ...studioSettings(params) }
              : saved.data;
          const id =
            params.get("layout") === "1"
              ? params.get("collection") || restored.collectionId
              : restored.collectionId;
          void selectCollection(
            id,
            params.get("layout") === "1"
              ? params.get("item") || restored.itemId
              : restored.itemId,
            restored,
          );
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMessage("Unable to load this saved scene.");
      });
    return () => controller.abort();
  }, [sceneId, user, selectCollection]);
  useEffect(() => {
    if (!jobId || !user) return;
    let cancelled = false;
    async function poll() {
      try {
        const r = await fetch(`/api/jobs/${jobId}`);
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (cancelled) return;
        setJobProgress(d.job.progress);
        if (d.job.status === "completed") {
          change({
            foodUrl: d.job.result.url,
            food: "ai",
            cropPercent: 100,
          });
          setLocalPhoto(null);
          setJobId(null);
          setBusy(false);
          setMessage(
            "Your food preview is ready. Adjust its placement to finish the scene.",
          );
        } else if (["failed", "cancelled"].includes(d.job.status)) {
          setBusy(false);
          setJobId(null);
          setMessage(
            d.job.error || "Generation stopped. Your local scene is preserved.",
          );
        }
      } catch (e) {
        if (!cancelled) {
          setMessage(
            e instanceof Error
              ? e.message
              : "Unable to check preview progress.",
          );
          setBusy(false);
          setJobId(null);
        }
      }
    }
    poll();
    const timer = setInterval(poll, 3500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [jobId, user, change]);
  useEffect(
    () => () => {
      if (localPhoto?.startsWith("blob:")) URL.revokeObjectURL(localPhoto);
    },
    [localPhoto],
  );
  async function photo(file?: File) {
    if (!file) return;
    if (!user) {
      authenticate();
      return;
    }
    setBusy(true);
    setMessage("Uploading your photo…");
    try {
      const optimized = await studioPhoto(file);
      const entry = await uploadFile(optimized, "food", (p) =>
        setMessage(`Uploading photo · ${p}%`),
      );
      setLocalPhoto(URL.createObjectURL(optimized));
      change({
        food: "custom",
        cropPercent: 100,
        foodUrl: `/api/assets?path=${encodeURIComponent(entry.path)}`,
      });
      setMessage(
        "Photo uploaded. Crop and place it to finish your tabletop preview.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!user) {
      try {
        saveGuestScene(
          `${collection.name} on ${surfaces.find(([v]) => v === scene.tabletop)?.[1]}`,
          { ...scene, collectionId: collection.id, itemId: item.id },
          view,
        );
        setMessage(
          "Scene saved on this device. Find it in My workspace; sign in to save across devices.",
        );
      } catch {
        setMessage(
          "This device could not save your scene. Try copying its studio link instead.",
        );
      }
      return;
    }
    setMessage("");
    setBusy(true);
    try {
      const r = await fetch("/api/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${collection.name} on ${surfaces.find(([v]) => v === scene.tabletop)?.[1]}`,
          data: { ...scene, collectionId: collection.id, itemId: item.id },
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setMessage("Scene saved to your workspace.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save scene.");
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    setBusy(true);
    setMessage("");
    try {
      if (view === "3d" && !detailOnly) {
        if (!threeExport.current)
          throw new Error("Wait for the 3D scene to finish loading.");
        const blob = await threeExport.current();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `yanco-${collection.id}-3d.png`;
        link.click();
        URL.revokeObjectURL(url);
        return;
      }
      let blob: Blob | null;
      if (view === "3d" && detailOnly) {
        const {
          loadTabletopImage,
          prepareTabletop,
          drawTabletop,
          TABLETOP_SIZE,
        } = await import("@/lib/tabletop-renderer");
        const [plate, food] = await Promise.all([
          loadTabletopImage(item.studioImage || item.image),
          foodSource ? loadTabletopImage(foodSource) : Promise.resolve(null),
        ]);
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = TABLETOP_SIZE;
        drawTabletop(
          canvas,
          prepareTabletop(plate, scene.tabletop, !item.studioImage),
          food,
          scene,
        );
        blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/png"),
        );
      } else {
        if (!tabletopExport.current)
          throw Error("Wait for the tabletop preview to finish loading.");
        blob = await tabletopExport.current();
      }
      if (!blob) throw Error();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `yanco-${collection.id}-tabletop.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage(
        "Unable to export this image. Try a catalog image or starter food layer.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!item)
    return (
      <div className="page-container empty-state">
        <h1>Choose a collection to begin.</h1>
      </div>
    );
  const detailOnly =
    !supportsDinnerware(item) || Boolean(unavailable3DItems[item.id]);
  const isFallbackStudioImage = !item.studioImage;
  return (
    <div className="page-container">
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE PLATING STUDIO</span>
          <h1>See your table come together.</h1>
          <p>
            Explore the pieces. Change the setting. Make room for your food.
          </p>
        </div>
        <div className="studio-view-switch">
          <button
            className={view === "top" ? "active" : ""}
            aria-pressed={view === "top"}
            onClick={() => changeView("top")}
          >
            <Move size={13} /> Tabletop
          </button>
          <button
            className={view === "3d" ? "active" : ""}
            aria-pressed={view === "3d"}
            onClick={() => changeView("3d")}
          >
            <Box size={13} /> {detailOnly ? "Detail view" : "Illustrative 3D"}
          </button>
        </div>
      </div>
      <div className="studio-layout">
        <div>
          <div className="studio-scene-shell">
            {view === "3d" ? (
              <Plate3D
                key={item.id}
                item={item}
                collection={collection}
                scene={scene}
                foodSource={foodSource}
                onUnavailable={handleUnavailable3D}
                onExportReady={handle3DExport}
                detailOnly={detailOnly}
              />
            ) : (
              <div
                className={`studio-scene surface-${scene.tabletop}`}
                ref={sceneRef}
              >
                <TabletopPreview
                  key={JSON.stringify([
                    item.studioImage || item.image,
                    isFallbackStudioImage,
                    foodSource,
                    scene.tabletop,
                  ])}
                  plateSource={item.studioImage || item.image}
                  fallback={isFallbackStudioImage}
                  foodSource={foodSource}
                  scene={scene}
                  onExportReady={handleTabletopExport}
                />
                <div
                  className={`scene-plate${isFallbackStudioImage ? " scene-plate--fallback" : ""}`}
                  style={
                    isFallbackStudioImage
                      ? {
                          clipPath: `circle(${STUDIO_FALLBACK_CROP_RADIUS * 100}% at 50% 50%)`,
                        }
                      : undefined
                  }
                >
                  <img
                    src={item.studioImage || item.image}
                    alt={`${collection.name} ${item.sku}`}
                    draggable={false}
                  />
                </div>
                {foodSource && (
                  <div
                    className="scene-food"
                    role="button"
                    tabIndex={0}
                    aria-label="Food layer — drag or use arrow keys to position"
                    onKeyDown={(e) => {
                      const moves: Record<string, [number, number]> = {
                        ArrowLeft: [-1, 0],
                        ArrowRight: [1, 0],
                        ArrowUp: [0, -1],
                        ArrowDown: [0, 1],
                      };
                      if (moves[e.key]) {
                        e.preventDefault();
                        change({
                          x: Math.max(
                            -35,
                            Math.min(35, scene.x + moves[e.key][0]),
                          ),
                          y: Math.max(
                            -35,
                            Math.min(35, scene.y + moves[e.key][1]),
                          ),
                        });
                      }
                    }}
                    style={{
                      left: `${50 + scene.x}%`,
                      top: `${50 + scene.y}%`,
                      transform: `translate(-50%, -50%) rotate(${scene.rotation}deg) scale(${scene.scale})`,
                      borderRadius: scene.food === "custom" ? "50%" : undefined,
                      overflow: scene.food === "custom" ? "hidden" : undefined,
                    }}
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      drag.current = {
                        x: e.clientX,
                        y: e.clientY,
                        startX: scene.x,
                        startY: scene.y,
                      };
                    }}
                    onPointerMove={(e) => {
                      if (drag.current)
                        change({
                          x: Math.max(
                            -35,
                            Math.min(
                              35,
                              drag.current.startX +
                                ((e.clientX - drag.current.x) /
                                  (sceneRef.current?.clientWidth || 300)) *
                                  100,
                            ),
                          ),
                          y: Math.max(
                            -35,
                            Math.min(
                              35,
                              drag.current.startY +
                                ((e.clientY - drag.current.y) /
                                  (sceneRef.current?.clientHeight || 300)) *
                                  100,
                            ),
                          ),
                        });
                    }}
                    onPointerUp={() => (drag.current = null)}
                    onPointerCancel={() => (drag.current = null)}
                  >
                    <img
                      src={foodSource}
                      alt="Plated food"
                      draggable={false}
                      style={{
                        transform: `scale(${crop / 100})`,
                        objectFit:
                          scene.food === "custom" ? "cover" : "contain",
                      }}
                    />
                  </div>
                )}
              </div>
            )}
            <div className="scene-caption">
              <span>
                <strong>{collection.name}</strong> · {item.sku}
              </span>
              <span>
                {view === "top"
                  ? isFallbackStudioImage
                    ? "Source photo crop · Cutout unavailable"
                    : "Illustrative tabletop scene"
                  : detailOnly
                    ? "Source photograph"
                    : item.type === "glass"
                      ? "Illustrative glassware"
                      : "Illustrative shape and glaze"}{" "}
                {view === "top" || detailOnly
                  ? "· Original product colors"
                  : "· See Photo for product detail"}
              </span>
            </div>
          </div>
          {message && (
            <p className="notice" role="status">
              {busy && <LoaderCircle className="spin" size={17} />} {message}
              {jobId && ` · ${jobProgress}%`}
            </p>
          )}
          <p className="small-note">
            Product photography comes from the Yanco catalog. Food placement and
            3D geometry are illustrative; consult source specifications for
            purchasing.
          </p>
        </div>
        <aside className="studio-controls">
          <h3>The finishing touches</h3>
          <div className="control-group">
            <label htmlFor="studio-collection">Collection</label>
            <select
              id="studio-collection"
              value={collection.id}
              onChange={(e) => selectCollection(e.target.value)}
            >
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.material}
                </option>
              ))}
            </select>
          </div>
          <div className="control-group">
            <label htmlFor="studio-piece">The piece</label>
            <select
              id="studio-piece"
              value={item.id}
              onChange={(e) => {
                const next = items.find((i) => i.id === e.target.value)!;
                setItem(next);
                change({ itemId: next.id });
              }}
            >
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.sku} · {i.name}
                </option>
              ))}
            </select>
          </div>
          <div className="control-group">
            <span>
              Tabletop · {surfaces.find(([v]) => v === scene.tabletop)?.[1]}
            </span>
            <div className="surface-swatches">
              {surfaces.map(([v, l]) => (
                <button
                  key={v}
                  title={l}
                  aria-label={l}
                  aria-pressed={scene.tabletop === v}
                  className={`surface-${v} ${scene.tabletop === v ? "selected" : ""}`}
                  onClick={() => change({ tabletop: v })}
                />
              ))}
            </div>
          </div>
          <div className="control-group">
            <span>What’s on the menu?</span>
            <div className="food-choices">
              {foods.map(([v, l]) => (
                <button
                  key={v}
                  aria-label={l}
                  aria-pressed={scene.food === v}
                  className={scene.food === v ? "selected" : ""}
                  onClick={() => {
                    setLocalPhoto(null);
                    change({ food: v, foodUrl: undefined });
                    setCrop(100);
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="slider-control">
              <label htmlFor="portion">Portion</label>
              <input
                id="portion"
                type="range"
                min=".3"
                max="1.8"
                step=".05"
                value={scene.scale}
                aria-valuetext={`${Math.round(scene.scale * 100)} percent`}
                onChange={(e) => change({ scale: Number(e.target.value) })}
              />
              <span>{Math.round(scene.scale * 100)}%</span>
            </div>
            <div className="slider-control">
              <label htmlFor="rotation">Rotation</label>
              <input
                id="rotation"
                type="range"
                min="-180"
                max="180"
                value={scene.rotation}
                aria-valuetext={`${scene.rotation} degrees`}
                onChange={(e) => change({ rotation: Number(e.target.value) })}
              />
              <span>{scene.rotation}°</span>
            </div>
            {view === "3d" && !detailOnly && foodSource && (
              <>
                <div className="slider-control">
                  <label htmlFor="food-horizontal">Left / right</label>
                  <input
                    id="food-horizontal"
                    type="range"
                    min="-35"
                    max="35"
                    value={scene.x}
                    aria-valuetext={
                      scene.x === 0
                        ? "Centered"
                        : `${Math.abs(scene.x)} percent ${scene.x < 0 ? "left" : "right"}`
                    }
                    onChange={(event) =>
                      change({ x: Number(event.target.value) })
                    }
                  />
                  <span>{scene.x}%</span>
                </div>
                <div className="slider-control">
                  <label htmlFor="food-vertical">Near / far</label>
                  <input
                    id="food-vertical"
                    type="range"
                    min="-35"
                    max="35"
                    value={scene.y}
                    aria-valuetext={
                      scene.y === 0
                        ? "Centered"
                        : `${Math.abs(scene.y)} percent ${scene.y < 0 ? "farther" : "nearer"}`
                    }
                    onChange={(event) =>
                      change({ y: Number(event.target.value) })
                    }
                  />
                  <span>{scene.y}%</span>
                </div>
              </>
            )}
            <div className="studio-placement-actions">
              <button
                className="text-link"
                onClick={() => {
                  change({
                    x: 0,
                    y: 0,
                    scale: 1,
                    rotation: 0,
                    cropPercent: 100,
                  });
                }}
              >
                <RotateCcw size={12} />
                Reset placement
              </button>
              <button className="text-link" onClick={copyLink}>
                <LinkIcon size={12} />
                {copied ? "Link copied" : "Copy studio link"}
              </button>
            </div>
            {copied && (
              <span className="sr-only" role="status">
                Studio link copied
              </span>
            )}
            {copyFallback && (
              <label className="small-note">
                Copy this studio link
                <input
                  aria-label="Studio link"
                  readOnly
                  value={copyFallback}
                  onFocus={(event) => event.target.select()}
                />
              </label>
            )}
          </div>
          <div className="control-group">
            <input
              ref={fileRef}
              type="file"
              aria-label="Upload food photo"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => photo(e.target.files?.[0])}
            />
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => (user ? fileRef.current?.click() : authenticate())}
            >
              <Upload size={14} />
              Upload your dish
            </button>
            {scene.food === "custom" && (
              <div className="crop-controls">
                <label htmlFor="crop">Crop</label>
                <input
                  id="crop"
                  type="range"
                  min="100"
                  max="250"
                  value={crop}
                  aria-valuetext={`${crop} percent`}
                  onChange={(e) => setCrop(Number(e.target.value))}
                />
              </div>
            )}
            <button
              className="button secondary"
              disabled
              title="AI food generation is paused"
            >
              <Sparkles size={14} />
              Generate food preview
            </button>
            <p className="small-note">
              AI generation is paused. Arrange your food photo or a starter
              dish, then download the preview.
            </p>
          </div>
          <hr />
          <div>
            <button className="button primary" disabled={busy} onClick={save}>
              <Save size={14} />
              Save to workspace
              <ArrowRight size={15} />
            </button>
            {!user && (
              <p className="small-note">
                Saved on this device.{" "}
                <button className="text-link" onClick={authenticate}>
                  Sign in to save across devices
                </button>
              </p>
            )}
            <button
              className="button secondary"
              disabled={
                busy ||
                (view === "3d" ? !detailOnly && !threeReady : !tabletopReady)
              }
              onClick={download}
            >
              <Download size={14} />
              {view === "3d" && !detailOnly
                ? "Download 3D image"
                : "Download tabletop image"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
