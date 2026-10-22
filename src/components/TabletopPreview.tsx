"use client";

import { useEffect, useRef, useState } from "react";
import type { Scene } from "@/lib/types";
import {
  drawTabletop,
  loadTabletopImage,
  prepareTabletop,
  TABLETOP_SIZE,
} from "@/lib/tabletop-renderer";

export default function TabletopPreview({
  plateSource,
  fallback,
  foodSource,
  scene,
  onExportReady,
}: {
  plateSource: string;
  fallback: boolean;
  foodSource: string;
  scene: Scene;
  onExportReady: (capture: (() => Promise<Blob>) | null) => void;
}) {
  const target = useRef<HTMLCanvasElement>(null);
  const assets = useRef<{
    key: string;
    base: HTMLCanvasElement;
    food: HTMLImageElement | null;
  } | null>(null);
  const latest = useRef(scene);
  const [readyKey, setReadyKey] = useState("");
  const [errorKey, setErrorKey] = useState("");
  const key = JSON.stringify([
    plateSource,
    fallback,
    foodSource,
    scene.tabletop,
  ]);

  useEffect(() => {
    latest.current = scene;
    const frame = requestAnimationFrame(() => {
      if (target.current && assets.current?.key === key)
        drawTabletop(
          target.current,
          assets.current.base,
          assets.current.food,
          scene,
        );
    });
    return () => cancelAnimationFrame(frame);
  }, [scene, key]);

  useEffect(() => {
    let cancelled = false;
    onExportReady(null);
    Promise.all([
      loadTabletopImage(plateSource),
      foodSource ? loadTabletopImage(foodSource) : Promise.resolve(null),
    ])
      .then(([plate, food]) => {
        if (cancelled || !target.current) return;
        const base = prepareTabletop(plate, scene.tabletop, fallback);
        assets.current = { key, base, food };
        drawTabletop(target.current, base, food, latest.current);
        setReadyKey(key);
        onExportReady(async () => {
          if (cancelled || !target.current)
            throw Error("Preview is still loading.");
          drawTabletop(target.current, base, food, latest.current);
          return new Promise<Blob>((resolve, reject) => {
            target.current!.toBlob(
              (blob) =>
                blob
                  ? resolve(blob)
                  : reject(Error("Unable to export this preview.")),
              "image/png",
            );
          });
        });
      })
      .catch(() => {
        if (!cancelled) setErrorKey(key);
      });
    return () => {
      cancelled = true;
      assets.current = null;
      onExportReady(null);
    };
  }, [plateSource, foodSource, fallback, scene.tabletop, key, onExportReady]);

  return (
    <>
      <canvas
        ref={target}
        width={TABLETOP_SIZE}
        height={TABLETOP_SIZE}
        className="tabletop-canvas"
        aria-hidden="true"
        data-ready={readyKey === key}
        style={{ visibility: readyKey === key ? "visible" : "hidden" }}
      />
      {errorKey === key && (
        <p className="tabletop-load-error" role="status">
          Preview image unavailable. Try another piece or food photo.
        </p>
      )}
    </>
  );
}
