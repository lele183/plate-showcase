"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowDownToLine,
  Box,
  Focus,
  LoaderCircle,
  Maximize,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Ruler,
  Sun,
} from "lucide-react";
import type { CatalogItem, Collection, Scene } from "@/lib/types";
import type { DinnerwareScene } from "@/lib/dinnerware-scene";
import {
  dinnerwareModel,
  type CameraView,
  type StudioLighting,
} from "@/lib/dinnerware-model";
import { THREE_D_SUPPORTED_TYPES } from "@/types/catalog";
import styles from "./Plate3D.module.css";

export default function Plate3D({
  item,
  collection,
  scene,
  foodSource,
  onUnavailable,
  onExportReady,
  detailOnly = false,
}: {
  item: CatalogItem;
  collection: Collection;
  scene: Scene;
  foodSource: string;
  onUnavailable: (itemId: string) => void;
  onExportReady: (capture: (() => Promise<Blob>) | null) => void;
  detailOnly?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<HTMLDivElement>(null);
  const runtime = useRef<DinnerwareScene | null>(null);
  const latest = useRef({ scene, foodSource });
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [foodFailed, setFoodFailed] = useState(false);
  const [cameraView, setCameraView] = useState<CameraView | "custom">(
    "perspective",
  );
  const [lighting, setLighting] = useState<StudioLighting>("daylight");
  const [rotating, setRotating] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [fullscreenMessage, setFullscreenMessage] = useState("");
  const instructionsId = useId();
  const supported = THREE_D_SUPPORTED_TYPES.has(item.type);
  const model = dinnerwareModel(item);
  const fallback = failed || !supported || detailOnly;

  useEffect(() => {
    latest.current = { scene, foodSource };
    runtime.current?.update(scene, foodSource);
  }, [scene, foodSource]);

  useEffect(() => {
    if (!supported || detailOnly) return;
    let cancelled = false;
    let controller: DinnerwareScene | undefined;
    const unavailable = () => {
      if (cancelled) return;
      onExportReady(null);
      setFailed(true);
      onUnavailable(item.id);
    };
    void import("@/lib/dinnerware-scene")
      .then(({ createDinnerwareScene }) => {
        if (cancelled || !host.current) return;
        controller = createDinnerwareScene(host.current, item, collection, {
          onReady() {
            if (cancelled || !controller) return;
            setReady(true);
            onExportReady(controller.capture);
          },
          onError: unavailable,
          onFoodError: setFoodFailed,
          onRotationStop: () => setRotating(false),
          onOrbit() {
            setCameraView("custom");
            setRotating(false);
            controller?.setAutoRotate(false);
          },
        });
        runtime.current = controller;
        controller.update(latest.current.scene, latest.current.foodSource);
      })
      .catch(unavailable);
    return () => {
      cancelled = true;
      onExportReady(null);
      controller?.dispose();
      runtime.current = null;
    };
  }, [item, collection, supported, detailOnly, onUnavailable, onExportReady]);

  function changeCamera(view: CameraView) {
    setCameraView(view);
    setRotating(false);
    runtime.current?.setAutoRotate(false);
    runtime.current?.setView(view);
  }
  async function expand() {
    try {
      if (document.fullscreenElement === viewer.current)
        await document.exitFullscreen();
      else await viewer.current?.requestFullscreen();
      setFullscreenMessage("");
    } catch {
      setFullscreenMessage("Full screen is unavailable in this browser.");
    }
  }
  return (
    <div
      className={`three-view ${styles.viewer}`}
      ref={viewer}
      data-ready={ready && !fallback}
      data-camera={cameraView}
      data-lighting={lighting}
      data-food={foodSource ? scene.food : "none"}
      onKeyDown={(event) => {
        if (!(event.target instanceof HTMLCanvasElement)) return;
        const moves: Record<string, [number, number]> = {
          ArrowLeft: [-0.15, 0],
          ArrowRight: [0.15, 0],
          ArrowUp: [0, -0.12],
          ArrowDown: [0, 0.12],
        };
        if (moves[event.key]) {
          event.preventDefault();
          runtime.current?.orbit(...moves[event.key]);
          setCameraView("custom");
          setRotating(false);
        } else if (["+", "=", "-", "0"].includes(event.key)) {
          event.preventDefault();
          if (event.key === "0") changeCamera("perspective");
          else runtime.current?.zoom(event.key === "-" ? 1.18 : 0.85);
        }
      }}
    >
      <div
        className={styles.viewport}
        ref={host}
        aria-describedby={fallback ? undefined : instructionsId}
      />
      {fallback ? (
        <>
          <Image
            src={item.image}
            alt={`${collection.name} ${item.sku} source photograph`}
            fill
            sizes="(max-width: 900px) 100vw, 70vw"
            style={{ objectFit: "contain", padding: 40 }}
            unoptimized
          />
          <span
            className={`${styles.note} ${styles.fallbackNote}`}
            role="status"
          >
            {!supported
              ? "Source photograph · 3D geometry is available for plates, trays and bowls"
              : "Static source preview · 3D is unavailable in this browser"}
          </span>
        </>
      ) : (
        <>
          <div className={styles.toolbar} aria-label="3D scene controls">
            <div
              className={styles.cameraGroup}
              role="group"
              aria-label="Camera angle"
            >
              {(
                [
                  ["perspective", "Perspective view", "Perspective", Box],
                  ["overhead", "Overhead view", "Top", Focus],
                  ["profile", "Side view", "Side", ArrowDownToLine],
                ] as const
              ).map(([value, label, title, Icon]) => (
                <button
                  key={value}
                  type="button"
                  aria-label={label}
                  title={label}
                  aria-pressed={cameraView === value}
                  disabled={!ready}
                  onClick={() => changeCamera(value)}
                >
                  <Icon size={15} aria-hidden="true" /> {title}
                </button>
              ))}
            </div>
            <button
              className={styles.rotate}
              type="button"
              aria-label="Auto rotate"
              aria-pressed={rotating}
              disabled={!ready}
              onClick={() => {
                const next = !rotating;
                setRotating(next);
                if (next) setCameraView("custom");
                runtime.current?.setAutoRotate(next);
              }}
            >
              {rotating ? <Pause size={14} /> : <Play size={14} />}
              <span>{rotating ? "Pause" : "Rotate"}</span>
            </button>
          </div>
          {!ready && (
            <div className={styles.loading} role="status">
              <LoaderCircle size={21} className="spin" />
              Preparing your 3D scene
            </div>
          )}
          <div className={styles.settings}>
            <button
              type="button"
              aria-label="Studio lighting"
              aria-pressed={lighting === "studio"}
              disabled={!ready}
              onClick={() => {
                const next = lighting === "daylight" ? "studio" : "daylight";
                setLighting(next);
                runtime.current?.setLighting(next);
              }}
            >
              <Sun size={15} aria-hidden="true" />
              {lighting === "daylight" ? "Daylight" : "Studio light"}
            </button>
            {model.dimensions.length > 0 && (
              <button
                type="button"
                aria-label="Show catalog dimensions"
                aria-pressed={measuring}
                disabled={!ready}
                onClick={() => {
                  setMeasuring((value) => !value);
                  runtime.current?.setMeasurements(!measuring);
                }}
              >
                <Ruler size={15} aria-hidden="true" /> Size
              </button>
            )}
          </div>
          {measuring && (
            <div className={styles.measurements} role="status">
              <strong>{model.dimensions.join(" × ")}</strong>
              <span>
                Catalog dimensions
                {!model.hasMeasuredHeight ? " · Height estimated" : ""}
              </span>
            </div>
          )}
          <div
            className={styles.navigation}
            role="group"
            aria-label="Zoom and display"
          >
            <button
              type="button"
              aria-label="Zoom out"
              title="Zoom out"
              disabled={!ready}
              onClick={() => runtime.current?.zoom(1.18)}
            >
              <Minus size={17} />
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              title="Zoom in"
              disabled={!ready}
              onClick={() => runtime.current?.zoom(0.85)}
            >
              <Plus size={17} />
            </button>
            <button
              type="button"
              aria-label="Reset 3D view"
              title="Reset 3D view"
              disabled={!ready}
              onClick={() => changeCamera("perspective")}
            >
              <RotateCcw size={16} />
            </button>
            <button
              type="button"
              aria-label="Full screen"
              title="Toggle full screen"
              disabled={!ready}
              onClick={expand}
            >
              <Maximize size={16} />
            </button>
          </div>
          <p className={styles.note} id={instructionsId}>
            Drag to rotate · Pinch to zoom · Illustrative geometry
          </p>
          {(foodFailed || fullscreenMessage) && (
            <p className={styles.feedback} role="status">
              {foodFailed
                ? "The food image could not load. Choose another food layer to try again."
                : fullscreenMessage}
            </p>
          )}
        </>
      )}
    </div>
  );
}
