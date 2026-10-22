import { STUDIO_FALLBACK_CROP_RADIUS } from "@/types/catalog";
import type { Scene } from "./types";

export const TABLETOP_SIZE = 1400;
export const PLATE_SPAN = 0.76;
export const FOOD_SPAN = 0.36;

function canvas(size = TABLETOP_SIZE) {
  const result = document.createElement("canvas");
  result.width = result.height = size;
  return result;
}

export function loadTabletopImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(Error("Unable to load this preview image."));
    image.src = source;
  });
}

// Ignore transparent file padding so photographed silhouettes have a consistent size.
export function imageBounds(image: HTMLImageElement) {
  const sample = canvas(256);
  const ctx = sample.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0, 256, 256);
  const pixels = ctx.getImageData(0, 0, 256, 256).data;
  let left = 256,
    top = 256,
    right = 0,
    bottom = 0;
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      if (pixels[(y * 256 + x) * 4 + 3] < 32) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);
    }
  }
  if (left >= right || top >= bottom)
    return { x: 0, y: 0, width: image.width, height: image.height };
  left = Math.max(0, left - 2);
  top = Math.max(0, top - 2);
  right = Math.min(256, right + 2);
  bottom = Math.min(256, bottom + 2);
  return {
    x: (left / 256) * image.width,
    y: (top / 256) * image.height,
    width: ((right - left) / 256) * image.width,
    height: ((bottom - top) / 256) * image.height,
  };
}

function drawSurface(ctx: CanvasRenderingContext2D, surface: string) {
  const size = TABLETOP_SIZE;
  const palettes: Record<string, [string, string]> = {
    oak: ["#c9b294", "#ad9274"],
    dark: ["#4a504b", "#303631"],
    white: ["#f1eee5", "#dcd8cc"],
    black: ["#343630", "#22251f"],
    stone: ["#d1cec3", "#b3b1a6"],
  };
  const [light, shade] = palettes[surface] || palettes.oak;
  const wash = ctx.createLinearGradient(0, 0, size, size);
  wash.addColorStop(0, light);
  wash.addColorStop(1, shade);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, size, size);
  let seed = 73;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  if (surface === "oak") {
    for (let y = -30; y < size + 30; y += 2 + random() * 5) {
      const bend = 8 + random() * 16;
      ctx.strokeStyle = `rgba(81,55,29,${0.018 + random() * 0.04})`;
      ctx.lineWidth = 0.4 + random() * 1.1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(
        size * 0.25,
        y - bend,
        size * 0.6,
        y + bend,
        size,
        y + 4,
      );
      ctx.stroke();
    }
  } else if (surface === "white" || surface === "black") {
    for (let at = 0; at < size; at += 4) {
      ctx.strokeStyle = at % 8 === 0 ? "#ffffff0b" : "#171b1510";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, at);
      ctx.lineTo(size, at);
      ctx.moveTo(at, 0);
      ctx.lineTo(at, size);
      ctx.stroke();
    }
  }
  // Seeded fine grain is painted once per material, never regenerated while dragging.
  const grain = canvas(350);
  const grainContext = grain.getContext("2d")!;
  const pixels = grainContext.createImageData(350, 350);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const tone = random() > 0.5 ? 255 : 0;
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = tone;
    pixels.data[i + 3] = Math.floor(
      random() * (surface === "stone" || surface === "dark" ? 12 : 6),
    );
  }
  grainContext.putImageData(pixels, 0, 0);
  ctx.drawImage(grain, 0, 0, size, size);
  const daylight = ctx.createRadialGradient(
    size * 0.24,
    size * 0.18,
    0,
    size * 0.45,
    size * 0.4,
    size * 0.86,
  );
  daylight.addColorStop(0, "#ffffff16");
  daylight.addColorStop(0.6, "#ffffff00");
  daylight.addColorStop(1, "#0e170c15");
  ctx.fillStyle = daylight;
  ctx.fillRect(0, 0, size, size);
}

function shadow(
  ctx: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  blur: number,
  x: number,
  y: number,
  color: string,
) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = TABLETOP_SIZE * 2 + x;
  ctx.shadowOffsetY = y;
  // Move the source off-canvas so layered shadows do not repaint translucent edges.
  ctx.drawImage(image, -TABLETOP_SIZE * 2, 0);
  ctx.restore();
}

export function prepareTabletop(
  plate: HTMLImageElement,
  surface: string,
  fallback: boolean,
) {
  const base = canvas();
  const ctx = base.getContext("2d")!;
  drawSurface(ctx, surface);
  const layer = canvas();
  const plateContext = layer.getContext("2d")!;
  const bounds = fallback
    ? { x: 0, y: 0, width: plate.width, height: plate.height }
    : imageBounds(plate);
  const span = TABLETOP_SIZE * PLATE_SPAN;
  const ratio = Math.min(span / bounds.width, span / bounds.height);
  if (fallback) {
    plateContext.beginPath();
    plateContext.arc(
      TABLETOP_SIZE / 2,
      TABLETOP_SIZE / 2,
      span * STUDIO_FALLBACK_CROP_RADIUS,
      0,
      Math.PI * 2,
    );
    plateContext.clip();
  }
  plateContext.drawImage(
    plate,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    (TABLETOP_SIZE - bounds.width * ratio) / 2,
    (TABLETOP_SIZE - bounds.height * ratio) / 2,
    bounds.width * ratio,
    bounds.height * ratio,
  );
  shadow(ctx, layer, 25, 9, 18, "#16201435");
  shadow(ctx, layer, 5, 1, 4, "#14201138");
  ctx.drawImage(layer, 0, 0);
  return base;
}

const foodLayers = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();

export function drawTabletop(
  target: HTMLCanvasElement,
  base: HTMLCanvasElement,
  food: HTMLImageElement | null,
  scene: Scene,
) {
  const ctx = target.getContext("2d")!;
  ctx.clearRect(0, 0, TABLETOP_SIZE, TABLETOP_SIZE);
  ctx.drawImage(base, 0, 0);
  if (!food) return;
  let layer = foodLayers.get(target);
  if (!layer) {
    layer = canvas();
    foodLayers.set(target, layer);
  }
  const foodContext = layer.getContext("2d")!;
  foodContext.clearRect(0, 0, TABLETOP_SIZE, TABLETOP_SIZE);
  foodContext.save();
  const size = TABLETOP_SIZE * FOOD_SPAN * scene.scale;
  const custom = scene.food === "custom";
  foodContext.translate(
    TABLETOP_SIZE * (0.5 + scene.x / 100),
    TABLETOP_SIZE * (0.5 + scene.y / 100),
  );
  foodContext.rotate((scene.rotation * Math.PI) / 180);
  if (custom) {
    foodContext.beginPath();
    foodContext.arc(0, 0, size / 2, 0, Math.PI * 2);
    foodContext.clip();
  }
  const ratio =
    (custom ? Math.max : Math.min)(size / food.width, size / food.height) *
    ((scene.cropPercent || 100) / 100);
  foodContext.drawImage(
    food,
    (-food.width * ratio) / 2,
    (-food.height * ratio) / 2,
    food.width * ratio,
    food.height * ratio,
  );
  foodContext.restore();
  shadow(ctx, layer, 10, 2, 6, "#30251227");
  shadow(ctx, layer, 3, 0, 2, "#30251224");
  ctx.drawImage(layer, 0, 0);
}
