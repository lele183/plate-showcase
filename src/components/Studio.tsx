/* eslint-disable @next/next/no-img-element -- Canvas export uses the exact source images and user blob URLs. */
"use client";
import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import type { CatalogItem, Collection, Scene } from "@/lib/types";
import { useAuth } from "./AuthProvider";
import { uploadFile, studioPhoto } from "@/lib/upload";
const Plate3D = dynamic(() => import("./Plate3D"), {
  ssr: false,
  loading: () => (
    <div className="three-view">
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
  initialItemId,
}: {
  collections: Collection[];
  initialCollection: Collection;
  initialItems: CatalogItem[];
  sceneId?: string;
  previewJobId?: string;
  initialItemId?: string;
}) {
  const { user, openAuth } = useAuth();
  const [collection, setCollection] = useState(initialCollection),
    [items, setItems] = useState(initialItems),
    [item, setItem] = useState(
      initialItems.find((i) => i.id === initialItemId) ||
        initialItems.find((i) => i.sku === "MR-710") ||
        initialItems.find((i) => i.type === "plate") ||
        initialItems[0],
    );
  const [scene, setScene] = useState<Scene>({
      collectionId: initialCollection.id,
      itemId:
        initialItems.find((i) => i.id === initialItemId)?.id ||
        initialItems.find((i) => i.sku === "MR-710")?.id ||
        initialItems.find((i) => i.type === "plate")?.id ||
        initialItems[0]?.id,
      tabletop: "oak",
      food: "salmon",
      scale: 1,
      rotation: 0,
      x: 0,
      y: 0,
    }),
    [view, setView] = useState("top"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [uploadId, setUploadId] = useState<string | null>(null),
    [localPhoto, setLocalPhoto] = useState<string | null>(null),
    [jobId, setJobId] = useState<string | null>(previewJobId || null),
    [jobProgress, setJobProgress] = useState(0);
  const crop = scene.cropPercent || 100;
  const setCrop = (value: number) =>
    setScene((s) => ({ ...s, cropPercent: value }));
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
  useEffect(() => {
    try {
      const pending = JSON.parse(
        localStorage.getItem("yanco-studio-auth-draft") || "null",
      );
      if (
        pending &&
        pending.returnTo === location.pathname + location.search &&
        Date.now() - pending.created < 600000
      ) {
        localStorage.removeItem("yanco-studio-auth-draft");
        queueMicrotask(() => {
          setScene(pending.scene);
          void selectCollection(
            pending.scene.collectionId,
            pending.scene.itemId,
          );
        });
      }
    } catch {}
  }, []);
  function authenticate() {
    localStorage.setItem(
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
    fetch("/api/scenes")
      .then((r) => r.json())
      .then((data) => {
        const saved = data.scenes?.find(
          (s: { id: string; data: Scene }) => s.id === sceneId,
        );
        if (saved) {
          setScene(saved.data);
          selectCollection(saved.data.collectionId, saved.data.itemId);
        }
      })
      .catch(() => setMessage("Unable to load this saved scene."));
  }, [sceneId, user]);
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
          setScene((s) => ({
            ...s,
            foodUrl: d.job.result.url,
            food: "ai",
            cropPercent: 100,
          }));
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
  }, [jobId, user]);
  useEffect(
    () => () => {
      if (localPhoto?.startsWith("blob:")) URL.revokeObjectURL(localPhoto);
    },
    [localPhoto],
  );
  function change(patch: Partial<Scene>) {
    setScene((s) => ({ ...s, ...patch }));
  }
  async function selectCollection(id: string, itemId?: string) {
    setMessage("");
    try {
      const r = await fetch(
        `/api/catalog?collection=${encodeURIComponent(id)}`,
      );
      const data = await r.json();
      if (!data.collection || !data.items?.length)
        throw Error("This collection has no pieces to preview.");
      setCollection(data.collection);
      setItems(data.items);
      const next =
        data.items.find((i: CatalogItem) => i.id === itemId) ||
        data.items.find((i: CatalogItem) => i.type === "plate") ||
        data.items[0];
      setItem(next);
      setScene((s) => ({ ...s, collectionId: id, itemId: next.id }));
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Unable to load this collection.",
      );
    }
  }
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
      setUploadId(entry.id);
      setLocalPhoto(URL.createObjectURL(optimized));
      change({
        food: "custom",
        cropPercent: 100,
        foodUrl: `/api/assets?path=${encodeURIComponent(entry.path)}`,
      });
      setMessage(
        "Photo uploaded. Crop and place it, or create an AI food layer.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }
  async function generate() {
    if (!user) {
      authenticate();
      return;
    }
    if (!uploadId) {
      setMessage("Upload a food photo first.");
      return;
    }
    setBusy(true);
    setMessage("Preparing your food preview…");
    try {
      const r = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "food-preview",
          uploadId,
          itemId: item.id,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setJobId(d.id);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Generation is unavailable.");
      setBusy(false);
    }
  }
  async function save() {
    if (!user) {
      authenticate();
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
      const canvas = document.createElement("canvas");
      canvas.width = 1400;
      canvas.height = 1400;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = (
        {
          oak: "#bda585",
          dark: "#353b35",
          white: "#eae9e1",
          black: "#272824",
          stone: "#b2b0a5",
        } as Record<string, string>
      )[scene.tabletop];
      ctx.fillRect(0, 0, 1400, 1400);
      if (scene.tabletop === "oak") {
        ctx.strokeStyle = "#70553822";
        for (let y = 0; y < 1400; y += 9) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(1400, y + 3);
          ctx.stroke();
        }
      }
      const load = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const im = new window.Image();
          im.crossOrigin = "anonymous";
          im.onload = () => resolve(im);
          im.onerror = reject;
          im.src = src;
        });
      const plate = await load(item.studioImage || item.image);
      const ratio = Math.min(952 / plate.width, 952 / plate.height);
      ctx.shadowColor = "#0004";
      ctx.shadowBlur = 22;
      ctx.shadowOffsetY = 20;
      ctx.drawImage(
        plate,
        (1400 - plate.width * ratio) / 2,
        (1400 - plate.height * ratio) / 2,
        plate.width * ratio,
        plate.height * ratio,
      );
      ctx.shadowColor = "transparent";
      if (foodSource) {
        const food = await load(foodSource);
        const size = 448 * scene.scale;
        ctx.save();
        ctx.translate(700 + scene.x * 14, 700 + scene.y * 14);
        ctx.rotate((scene.rotation * Math.PI) / 180);
        if (scene.food === "custom") {
          ctx.beginPath();
          ctx.ellipse(0, 0, size / 2, size / 2, 0, 0, Math.PI * 2);
          ctx.clip();
        }
        const foodRatio =
          Math.min(size / food.width, size / food.height) * (crop / 100);
        ctx.drawImage(
          food,
          (-food.width * foodRatio) / 2,
          (-food.height * foodRatio) / 2,
          food.width * foodRatio,
          food.height * foodRatio,
        );
        ctx.restore();
      }
      ctx.fillStyle = "#fff";
      ctx.font = "16px Arial";
      ctx.fillText(
        `${collection.name} · ${item.sku} · Illustrative plating scene`,
        35,
        1360,
      );
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
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
            onClick={() => setView("top")}
          >
            <Move size={13} /> Tabletop
          </button>
          <button
            className={view === "3d" ? "active" : ""}
            onClick={() => setView("3d")}
          >
            <Box size={13} /> Illustrative 3D
          </button>
        </div>
      </div>
      <div className="studio-layout">
        <div>
          <div className="studio-scene-shell">
            {view === "3d" ? (
              <Plate3D item={item} collection={collection} />
            ) : (
              <div
                className={`studio-scene surface-${scene.tabletop}`}
                ref={sceneRef}
              >
                <div className="scene-glass" />
                <div className="cutlery fork" />
                <div className="cutlery knife" />
                <div className="scene-plate">
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
                      style={{ transform: `scale(${crop / 100})` }}
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
                  ? "Illustrative tabletop scene"
                  : "Illustrative geometry; source imagery"}{" "}
                · Original product colors
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
                onChange={(e) => change({ rotation: Number(e.target.value) })}
              />
              <span>{scene.rotation}°</span>
            </div>
            <button
              className="text-link"
              onClick={() => {
                change({ x: 0, y: 0, scale: 1, rotation: 0 });
                setCrop(100);
              }}
            >
              <RotateCcw size={12} />
              Reset placement
            </button>
          </div>
          <div className="control-group">
            <input
              ref={fileRef}
              type="file"
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
                  onChange={(e) => setCrop(Number(e.target.value))}
                />
              </div>
            )}
            <button
              className="button secondary"
              disabled={busy}
              onClick={generate}
            >
              <Sparkles size={14} />
              Generate food preview
            </button>
            <p className="small-note">
              Optional AI preview from your own photo. Generation runs only when
              requested.
            </p>
          </div>
          <hr />
          <div>
            <button className="button primary" disabled={busy} onClick={save}>
              <Save size={14} />
              Save to workspace
              <ArrowRight size={15} />
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={download}
            >
              <Download size={14} />
              Download tabletop image
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
