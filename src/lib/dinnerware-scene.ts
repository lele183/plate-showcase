import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { CatalogItem, Collection, Scene } from "./types";
import {
  dinnerwareModel,
  type CameraView,
  type StudioLighting,
} from "./dinnerware-model";

export interface DinnerwareScene {
  update: (scene: Scene, foodSource: string) => void;
  setView: (view: CameraView) => void;
  setLighting: (lighting: StudioLighting) => void;
  setMeasurements: (visible: boolean) => void;
  setAutoRotate: (enabled: boolean) => void;
  zoom: (factor: number) => void;
  orbit: (horizontal: number, vertical: number) => void;
  capture: () => Promise<Blob>;
  dispose: () => void;
}

const surfaceColors: Record<string, string> = {
  oak: "#bda585",
  dark: "#353b35",
  white: "#eae9e1",
  black: "#272824",
  stone: "#b2b0a5",
};

function bodyColor(item: CatalogItem, collection: Collection) {
  if (/wood|bamboo/i.test(collection.material)) return "#ae8b59";
  if (/white|ivory|cream|bone/i.test(item.color)) return "#e4e4dc";
  const colors: [RegExp, string][] = [
    [/black/i, "#303331"],
    [/blue|turquoise/i, "#527b93"],
    [/green/i, "#7a8b63"],
    [/brown|tan|bronze/i, "#9b8065"],
    [/red|coral/i, "#a45242"],
    [/yellow|gold/i, "#cfb968"],
    [/gray|grey/i, "#92958d"],
  ];
  return colors.find(([pattern]) => pattern.test(item.color))?.[1] || "#e4e4dc";
}

function loadImage(source: string, signal: AbortSignal) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    const cleanup = () => {
      image.onload = image.onerror = null;
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("Scene disposed", "AbortError"));
    };
    image.onload = () => {
      cleanup();
      resolve(image);
    };
    image.onerror = () => {
      cleanup();
      reject(new Error("The source image could not be loaded."));
    };
    if (signal.aborted) abort();
    else {
      signal.addEventListener("abort", abort, { once: true });
      image.src = source;
    }
  });
}

function imageCanvas(width = 1024, height = width) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image preview is unavailable.");
  return { canvas, context };
}

function catalogTexture(image: HTMLImageElement, cutout: boolean) {
  const { canvas, context } = imageCanvas();
  context.drawImage(image, 0, 0, 1024, 1024);
  const pixels = context.getImageData(0, 0, 1024, 1024).data;
  let left = 1024,
    top = 1024,
    right = 0,
    bottom = 0;
  if (cutout) {
    for (let y = 0; y < 1024; y++)
      for (let x = 0; x < 1024; x++)
        if (pixels[(y * 1024 + x) * 4 + 3] > 100) {
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
  }
  context.clearRect(0, 0, 1024, 1024);
  context.fillStyle = "#ecebe4";
  context.fillRect(0, 0, 1024, 1024);
  if (cutout && right > left && bottom > top)
    context.drawImage(
      image,
      (left / 1024) * image.width,
      (top / 1024) * image.height,
      ((right - left + 1) / 1024) * image.width,
      ((bottom - top + 1) / 1024) * image.height,
      0,
      0,
      1024,
      1024,
    );
  else context.drawImage(image, 0, 0, 1024, 1024);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function surfaceTexture(surface: string) {
  const { canvas, context } = imageCanvas(256);
  context.fillStyle = surfaceColors[surface] || surfaceColors.oak;
  context.fillRect(0, 0, 256, 256);
  const image = context.getImageData(0, 0, 256, 256);
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const index = (y * 256 + x) * 4;
      const noise = (((x * 73 + y * 137) ^ (x * y * 17)) % 19) / 19 - 0.5;
      const grain =
        surface === "oak"
          ? Math.sin(y * 1.6 + Math.sin(x * 0.028) * 1.3) * 5
          : surface === "white" || surface === "black"
            ? ((x % 3 === 0 ? 1 : 0) + (y % 3 === 0 ? 1 : 0)) * 3
            : Math.sin(x * 0.04 + y * 0.09) * 2;
      for (let channel = 0; channel < 3; channel++)
        image.data[index + channel] += noise * 7 + grain;
    }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(25, 25);
  return texture;
}

export function createDinnerwareScene(
  host: HTMLDivElement,
  item: CatalogItem,
  collection: Collection,
  callbacks: {
    onReady: () => void;
    onError: () => void;
    onFoodError: (failed: boolean) => void;
    onOrbit: () => void;
    onRotationStop: () => void;
  },
): DinnerwareScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(surfaceColors.oak);
  scene.fog = new THREE.Fog(surfaceColors.oak, 8, 24);
  const model = dinnerwareModel(item);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const aborter = new AbortController();
  let renderer: THREE.WebGLRenderer | undefined;
  let controls: OrbitControls | undefined;
  let observer: ResizeObserver | undefined;
  let intersection: IntersectionObserver | undefined;
  let environment: THREE.WebGLRenderTarget | undefined;
  let frame = 0;
  let dirty = true;
  let disposed = false;
  let inView = true;
  let lastFrame = 0;
  let currentView: CameraView = "perspective";
  let currentScene: Scene;
  let currentSurface = "";
  let currentFood = "";
  let foodVersion = 0;
  let foodMask: THREE.CanvasTexture | undefined;
  let foodPending: Promise<void> = Promise.resolve();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 60);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const floorMaterial = new THREE.MeshStandardMaterial({ roughness: 0.97 });
  materials.add(floorMaterial);
  const foodMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    alphaTest: 0.08,
    toneMapped: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  materials.add(foodMaterial);
  const food = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), foodMaterial);
  geometries.add(food.geometry);
  food.rotation.x = -Math.PI / 2;
  food.visible = false;
  food.renderOrder = 2;
  scene.add(food);
  const key = new THREE.DirectionalLight(0xfff4e7, 3);
  const fill = new THREE.DirectionalLight(0xe4eef7, 1.2);
  const hemisphere = new THREE.HemisphereLight(0xffffff, 0x777264, 1.4);
  scene.add(key, fill, hemisphere);
  const measurements = new THREE.Group();
  scene.add(measurements);

  const requestRender = () => {
    dirty = true;
    if (!disposed && !document.hidden && inView && !frame)
      frame = requestAnimationFrame(render);
  };
  function render(now: number) {
    frame = 0;
    if (disposed || document.hidden || !inView || !renderer || !controls)
      return;
    try {
      const delta = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 0;
      lastFrame = now;
      const changed = controls.update(delta);
      if (dirty || changed) {
        dirty = false;
        renderer.render(scene, camera);
      }
      if (changed || controls.autoRotate) requestRender();
    } catch {
      fail();
    }
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    aborter.abort();
    cancelAnimationFrame(frame);
    observer?.disconnect();
    intersection?.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    reducedMotion.removeEventListener("change", onMotionPreference);
    renderer?.domElement.removeEventListener("webglcontextlost", onContextLost);
    controls?.removeEventListener("change", requestRender);
    controls?.dispose();
    scene.traverse((object) => {
      if (
        object instanceof THREE.Mesh ||
        object instanceof THREE.LineSegments
      ) {
        geometries.add(object.geometry);
        const attached = Array.isArray(object.material)
          ? object.material
          : [object.material];
        attached.forEach((material) => materials.add(material));
      }
      if (object instanceof THREE.DirectionalLight) object.shadow.dispose();
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => {
      Object.values(material).forEach((value) => {
        if (value instanceof THREE.Texture) textures.add(value);
      });
      material.dispose();
    });
    textures.forEach((texture) => texture.dispose());
    environment?.dispose();
    scene.clear();
    renderer?.dispose();
    renderer?.forceContextLoss();
    renderer?.domElement.remove();
  }
  function fail() {
    if (disposed) return;
    dispose();
    callbacks.onError();
  }
  function onContextLost(event: Event) {
    event.preventDefault();
    fail();
  }
  function onVisibility() {
    lastFrame = 0;
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else requestRender();
  }
  function onMotionPreference() {
    if (controls) {
      controls.enableDamping = !reducedMotion.matches;
      if (reducedMotion.matches) controls.autoRotate = false;
      if (reducedMotion.matches) callbacks.onRotationStop();
      requestRender();
    }
  }
  function setView(view: CameraView) {
    if (!controls) return;
    currentView = view;
    const fit = measurements.visible ? 4.5 : 3.7;
    const distance = fit / Math.min(camera.aspect, 1);
    const direction = {
      perspective: new THREE.Vector3(2.6, 3.7, 3.5),
      overhead: new THREE.Vector3(0, 5, 0.005),
      profile: new THREE.Vector3(0, 0.8, 5),
    }[view].normalize();
    controls.enableDamping = false;
    controls.target.set(0, model.y * 0.32, 0);
    camera.position.copy(controls.target).addScaledVector(direction, distance);
    controls.update();
    controls.enableDamping = !reducedMotion.matches;
    requestRender();
  }
  function resize() {
    if (!renderer || disposed || !host.clientWidth || !host.clientHeight)
      return;
    const previousAspect = camera.aspect;
    camera.aspect = host.clientWidth / host.clientHeight;
    if (controls) {
      const offset = camera.position.clone().sub(controls.target);
      offset.multiplyScalar(
        Math.min(previousAspect, 1) / Math.min(camera.aspect, 1),
      );
      camera.position.copy(controls.target).add(offset);
    }
    camera.updateProjectionMatrix();
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    requestRender();
  }
  function setLighting(lighting: StudioLighting) {
    const daylight = lighting === "daylight";
    key.color.set(daylight ? 0xfff4e7 : 0xffffff);
    key.intensity = daylight ? 3 : 3.4;
    key.position.set(daylight ? -3 : 1, 5, daylight ? 2 : -3);
    fill.intensity = daylight ? 1.2 : 0.8;
    scene.environmentIntensity = daylight ? 0.35 : 0.6;
    requestRender();
  }
  function applyFoodPlacement() {
    if (!currentScene) return;
    const size = (2 / 0.68) * 0.32 * currentScene.scale;
    food.scale.set(size, size, 1);
    food.position.set(
      (currentScene.x / 100) * (2 / 0.68),
      model.wellHeight + 0.025,
      (currentScene.y / 100) * (2 / 0.68),
    );
    food.rotation.set(
      -Math.PI / 2,
      0,
      (-currentScene.rotation * Math.PI) / 180,
    );
    const texture = foodMaterial.map;
    if (texture) {
      const crop =
        currentScene.food === "custom"
          ? (currentScene.cropPercent || 100) / 100
          : 1;
      texture.repeat.set(1 / crop, 1 / crop);
      texture.offset.set((1 - 1 / crop) / 2, (1 - 1 / crop) / 2);
    }
    requestRender();
  }
  function update(settings: Scene, foodSource: string) {
    if (disposed) return;
    currentScene = settings;
    if (currentSurface !== settings.tabletop) {
      currentSurface = settings.tabletop;
      const background = surfaceColors[settings.tabletop] || surfaceColors.oak;
      (scene.background as THREE.Color).set(background);
      (scene.fog as THREE.Fog).color.set(background);
      if (floorMaterial.map) {
        textures.delete(floorMaterial.map);
        floorMaterial.map.dispose();
      }
      floorMaterial.map = surfaceTexture(settings.tabletop);
      textures.add(floorMaterial.map);
      floorMaterial.needsUpdate = true;
    }
    const nextFood = foodSource ? `${settings.food}:${foodSource}` : "";
    if (currentFood !== nextFood) {
      currentFood = nextFood;
      const version = ++foodVersion;
      food.visible = false;
      callbacks.onFoodError(false);
      if (settings.food === "custom" && !foodMask) {
        const { canvas, context } = imageCanvas(256);
        context.fillStyle = "#000";
        context.fillRect(0, 0, 256, 256);
        context.fillStyle = "#fff";
        context.beginPath();
        context.arc(128, 128, 128, 0, Math.PI * 2);
        context.fill();
        foodMask = new THREE.CanvasTexture(canvas);
        textures.add(foodMask);
      }
      foodMaterial.alphaMap = settings.food === "custom" ? foodMask! : null;
      foodMaterial.needsUpdate = true;
      if (foodMaterial.map) {
        textures.delete(foodMaterial.map);
        foodMaterial.map.dispose();
        foodMaterial.map = null;
      }
      if (foodSource) {
        foodPending = loadImage(foodSource, aborter.signal)
          .then((image) => {
            if (disposed || version !== foodVersion) return;
            const { canvas, context } = imageCanvas();
            const ratio = Math.min(1024 / image.width, 1024 / image.height);
            context.drawImage(
              image,
              (1024 - image.width * ratio) / 2,
              (1024 - image.height * ratio) / 2,
              image.width * ratio,
              image.height * ratio,
            );
            const texture = new THREE.CanvasTexture(canvas);
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = Math.min(
              renderer?.capabilities.getMaxAnisotropy() || 1,
              8,
            );
            textures.add(texture);
            foodMaterial.map = texture;
            foodMaterial.needsUpdate = true;
            food.visible = true;
            applyFoodPlacement();
          })
          .catch(() => {
            if (!disposed && version === foodVersion)
              callbacks.onFoodError(true);
          });
      } else foodPending = Promise.resolve();
    }
    applyFoodPlacement();
  }

  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute(
      "aria-label",
      `${collection.name} ${item.sku} interactive 3D preview`,
    );
    renderer.domElement.setAttribute(
      "aria-description",
      "Drag to orbit. Use the camera buttons or plus and minus keys to change your view. Press 0 to reset.",
    );
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);
    host.appendChild(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = !reducedMotion.matches;
    controls.dampingFactor = 0.09;
    controls.minDistance = 2;
    controls.maxDistance = 12;
    controls.minPolarAngle = 0.005;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.autoRotateSpeed = 0.7;
    controls.addEventListener("change", requestRender);
    controls.addEventListener("start", callbacks.onOrbit);
    const room = new RoomEnvironment();
    const generator = new THREE.PMREMGenerator(renderer);
    try {
      environment = generator.fromScene(room, 0.04);
      scene.environment = environment.texture;
    } finally {
      room.dispose();
      generator.dispose();
    }
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = key.shadow.camera.bottom = -3;
    key.shadow.camera.right = key.shadow.camera.top = 3;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 15;
    key.shadow.normalBias = 0.015;
    key.shadow.bias = -0.0001;
    key.shadow.radius = 3;
    fill.position.set(3, 3, 3);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      floorMaterial,
    );
    geometries.add(floor.geometry);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.005;
    floor.receiveShadow = true;
    scene.add(floor);
    const points: THREE.Vector3[] = [];
    const z = -model.z / 2 - 0.17;
    const x = -model.x / 2 - 0.17;
    const segment = (a: number[], b: number[]) => {
      points.push(
        new THREE.Vector3(a[0], 0.01, a[1]),
        new THREE.Vector3(b[0], 0.01, b[1]),
      );
    };
    segment([-model.x / 2, z], [model.x / 2, z]);
    segment([x, -model.z / 2], [x, model.z / 2]);
    for (const side of [-1, 1]) {
      segment(
        [(side * model.x) / 2, z - 0.06],
        [(side * model.x) / 2, z + 0.06],
      );
      segment(
        [x - 0.06, (side * model.z) / 2],
        [x + 0.06, (side * model.z) / 2],
      );
    }
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: "#638096",
      depthTest: false,
    });
    geometries.add(lineGeometry);
    materials.add(lineMaterial);
    const ruler = new THREE.LineSegments(lineGeometry, lineMaterial);
    ruler.renderOrder = 3;
    measurements.add(ruler);
    measurements.visible = false;
    observer = new ResizeObserver(resize);
    observer.observe(host);
    if (typeof IntersectionObserver !== "undefined") {
      intersection = new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        if (inView) {
          lastFrame = 0;
          requestRender();
        } else {
          cancelAnimationFrame(frame);
          frame = 0;
        }
      });
      intersection.observe(host);
    }
    document.addEventListener("visibilitychange", onVisibility);
    reducedMotion.addEventListener("change", onMotionPreference);
    resize();
    setView(currentView);
    setLighting("daylight");

    const loadModel = async () => {
      const response = await fetch(model.url, { signal: aborter.signal });
      if (!response.ok) throw new Error("The 3D model could not be loaded.");
      const gltf = await new GLTFLoader().parseAsync(
        await response.arrayBuffer(),
        "",
      );
      gltf.scene.updateMatrixWorld(true);
      const product = new THREE.Group();
      gltf.scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        geometries.add(object.geometry);
        (Array.isArray(object.material)
          ? object.material
          : [object.material]
        ).forEach((material) => {
          materials.add(material);
        });
        const geometry = object.geometry
          .clone()
          .applyMatrix4(object.matrixWorld);
        geometries.add(geometry);
        if (disposed) return;
        const position = geometry.getAttribute("position");
        const normal = geometry.getAttribute("normal");
        const uv = geometry.getAttribute("uv");
        for (let i = 0; i < position.count; i++)
          uv.setXY(i, (position.getX(i) + 1) / 2, (-position.getZ(i) + 1) / 2);
        const surface: number[] = [],
          body: number[] = [];
        const index = geometry.getIndex();
        const count = index?.count || position.count;
        for (let i = 0; i < count; i += 3) {
          const a = index ? index.getX(i) : i;
          const b = index ? index.getX(i + 1) : i + 1;
          const c = index ? index.getX(i + 2) : i + 2;
          const target =
            (normal.getY(a) + normal.getY(b) + normal.getY(c)) / 3 > 0.12
              ? surface
              : body;
          target.push(a, b, c);
        }
        geometry.setIndex([...surface, ...body]);
        geometry.clearGroups();
        geometry.addGroup(0, surface.length, 0);
        geometry.addGroup(surface.length, body.length, 1);
        const melamine = /melamine/i.test(collection.material);
        const top = new THREE.MeshPhysicalMaterial({
          roughness: melamine ? 0.5 : 0.38,
          clearcoat: melamine ? 0.1 : 0.24,
          clearcoatRoughness: 0.3,
        });
        const bottom = new THREE.MeshPhysicalMaterial({
          color: bodyColor(item, collection),
          roughness: 0.4,
          clearcoat: 0.18,
        });
        materials.add(top);
        materials.add(bottom);
        const mesh = new THREE.Mesh(geometry, [top, bottom]);
        mesh.castShadow = mesh.receiveShadow = true;
        product.add(mesh);
      });
      if (disposed) {
        geometries.forEach((geometry) => geometry.dispose());
        materials.forEach((material) => material.dispose());
        return;
      }
      const image = await loadImage(
        item.studioImage || item.image,
        aborter.signal,
      );
      if (disposed) return;
      const texture = catalogTexture(image, Boolean(item.studioImage));
      texture.anisotropy = Math.min(
        renderer!.capabilities.getMaxAnisotropy(),
        8,
      );
      textures.add(texture);
      product.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          const top = (object.material as THREE.MeshPhysicalMaterial[])[0];
          top.map = texture;
          top.needsUpdate = true;
        }
      });
      product.scale.set(model.x / 2, model.y, model.z / 2);
      scene.add(product);
      requestRender();
      callbacks.onReady();
    };
    void loadModel().catch(() => {
      if (!disposed) fail();
    });
  } catch (error) {
    dispose();
    throw error;
  }

  return {
    update,
    setView,
    setLighting,
    setMeasurements(visible) {
      measurements.visible = visible;
      if (visible && controls) {
        const offset = camera.position.clone().sub(controls.target);
        const fit = 4.5 / Math.min(camera.aspect, 1);
        if (offset.length() < fit) {
          camera.position.copy(controls.target).add(offset.setLength(fit));
          controls.update();
        }
      }
      requestRender();
    },
    setAutoRotate(enabled) {
      if (controls) controls.autoRotate = enabled;
      lastFrame = 0;
      requestRender();
    },
    zoom(factor) {
      if (!controls) return;
      camera.position
        .sub(controls.target)
        .multiplyScalar(factor)
        .add(controls.target);
      controls.update();
      requestRender();
    },
    orbit(horizontal, vertical) {
      if (!controls) return;
      controls.autoRotate = false;
      const offset = camera.position.clone().sub(controls.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta += horizontal;
      spherical.phi = THREE.MathUtils.clamp(
        spherical.phi + vertical,
        0.005,
        Math.PI / 2 - 0.04,
      );
      camera.position
        .copy(controls.target)
        .add(offset.setFromSpherical(spherical));
      controls.update();
      requestRender();
    },
    async capture() {
      await foodPending;
      if (disposed || !renderer)
        throw new Error("The 3D preview is unavailable.");
      renderer.render(scene, camera);
      const source = renderer.domElement;
      const { canvas, context } = imageCanvas(
        1600,
        Math.round((1600 * source.height) / source.width),
      );
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      context.fillStyle = "rgba(255,255,255,.9)";
      context.fillRect(0, canvas.height - 60, canvas.width, 60);
      context.fillStyle = "#283832";
      context.font = "17px sans-serif";
      context.fillText(
        `${collection.name} | ${item.sku} | Illustrative geometry and food placement`,
        24,
        canvas.height - 24,
      );
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("The 3D image could not be exported.");
      return blob;
    },
    dispose,
  };
}
