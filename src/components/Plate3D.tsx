"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { CatalogItem, Collection } from "@/lib/types";
import { THREE_D_SUPPORTED_TYPES } from "@/types/catalog";
export default function Plate3D({
  item,
  collection,
  onUnavailable,
  detailOnly = false,
}: {
  item: CatalogItem;
  collection: Collection;
  onUnavailable: (itemId: string) => void;
  detailOnly?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const supported = THREE_D_SUPPORTED_TYPES.has(item.type);
  useEffect(() => {
    if (!supported || detailOnly) return;
    let dispose = () => {};
    let cancelled = false;
    async function mount() {
      const THREE = await import("three");
      const { OrbitControls } =
        await import("three/addons/controls/OrbitControls.js");
      if (!host.current || cancelled) return;
      const el = host.current;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch {
        setFailed(true);
        onUnavailable(item.id);
        return;
      }
      const scene = new THREE.Scene();
      const geometries = new Set<InstanceType<typeof THREE.BufferGeometry>>();
      const materials = new Set<InstanceType<typeof THREE.Material>>();
      const textures = new Set<InstanceType<typeof THREE.Texture>>();
      const lifecycle: {
        controls?: InstanceType<typeof OrbitControls>;
        observer?: ResizeObserver;
      } = {};
      let frame = 0;
      let disposed = false;
      let needsRender = true;
      const requestRender = () => {
        if (!disposed) needsRender = true;
      };
      // Install cleanup before setup so partial initialization failures also
      // release their renderer, resources, and native WebGL context.
      dispose = () => {
        if (disposed) return;
        disposed = true;
        cancelAnimationFrame(frame);
        lifecycle.observer?.disconnect();
        lifecycle.controls?.removeEventListener("change", requestRender);
        lifecycle.controls?.dispose();
        scene.traverse((object) => {
          if (object instanceof THREE.Mesh) {
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
        });
        textures.forEach((texture) => texture.dispose());
        materials.forEach((material) => material.dispose());
        scene.clear();
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      };
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setClearColor("#e6e5dc");
      renderer.shadowMap.enabled = true;
      el.appendChild(renderer.domElement);
      const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 100);
      camera.position.set(2.9, 3.3, 3.2);
      const controls = new OrbitControls(camera, renderer.domElement);
      lifecycle.controls = controls;
      controls.addEventListener("change", requestRender);
      controls.enableDamping = true;
      controls.minDistance = 2.2;
      controls.maxDistance = 7;
      controls.maxPolarAngle = Math.PI * 0.78;
      controls.target.set(0, 0, 0);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x64715b, 2.3));
      const light = new THREE.DirectionalLight(0xfff7e6, 3);
      light.position.set(3, 5, 2);
      light.castShadow = true;
      scene.add(light);
      const ratio =
        item.dimensions?.width && item.dimensions?.length
          ? Math.max(
              0.45,
              Math.min(1, item.dimensions.width / item.dimensions.length),
            )
          : 1;
      const shape = new THREE.Shape();
      if (["square", "rectangular"].includes(item.shape)) {
        shape.moveTo(-1, -ratio);
        shape.lineTo(1, -ratio);
        shape.lineTo(1, ratio);
        shape.lineTo(-1, ratio);
        shape.closePath();
      } else if (item.shape === "triangular") {
        shape.moveTo(0, 1);
        shape.lineTo(1, -0.7);
        shape.lineTo(-1, -0.7);
        shape.closePath();
      } else {
        shape.absellipse(
          0,
          0,
          1,
          item.shape === "oval" ? ratio * 0.75 : 1,
          0,
          Math.PI * 2,
          false,
          0,
        );
      }
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: 0.065,
        bevelEnabled: true,
        bevelSize: 0.028,
        bevelThickness: 0.025,
        bevelSegments: 3,
        steps: 1,
        curveSegments: 64,
      });
      geometries.add(geometry);
      geometry.rotateX(-Math.PI / 2);
      const positions = geometry.attributes.position;
      const uvs = geometry.attributes.uv;
      for (let i = 0; i < positions.count; i++)
        uvs.setXY(i, (positions.getX(i) + 1) / 2, (-positions.getZ(i) + 1) / 2);
      const texture = new THREE.TextureLoader().load(
        item.studioImage || item.image,
        requestRender,
      );
      textures.add(texture);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      const palette: Record<string, string> = {
        black: "#373932",
        blue: "#7798aa",
        green: "#899d72",
        brown: "#b8a48d",
        red: "#a14232",
        yellow: "#e4c96a",
      };
      const side = new THREE.MeshStandardMaterial({
        color: palette[item.color] || "#e8e5d9",
        roughness: collection.material === "melamine" ? 0.7 : 0.35,
      });
      materials.add(side);
      const top = new THREE.MeshStandardMaterial({
        map: texture,
        color: "#fff",
        transparent: true,
        alphaTest: 0.1,
        roughness: 0.55,
      });
      materials.add(top);
      const mesh = new THREE.Mesh(geometry, [top, side]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(20, 20),
        new THREE.ShadowMaterial({ opacity: 0.13 }),
      );
      geometries.add(floor.geometry);
      materials.add(floor.material);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.09;
      floor.receiveShadow = true;
      scene.add(floor);
      const observer = new ResizeObserver(() => {
        if (!el.clientWidth || disposed || cancelled) return;
        renderer.setSize(el.clientWidth, el.clientHeight, false);
        camera.aspect = el.clientWidth / el.clientHeight;
        camera.updateProjectionMatrix();
        requestRender();
      });
      lifecycle.observer = observer;
      observer.observe(el);
      function animate() {
        if (disposed || cancelled) return;
        frame = requestAnimationFrame(animate);
        controls.update();
        if (needsRender) {
          renderer.render(scene, camera);
          needsRender = false;
        }
      }
      animate();
    }
    mount().catch(() => {
      dispose();
      if (!cancelled) {
        setFailed(true);
        onUnavailable(item.id);
      }
    });
    return () => {
      cancelled = true;
      dispose();
    };
  }, [item, collection, supported, detailOnly, onUnavailable]);
  return (
    <div className="three-view" ref={host}>
      {failed || !supported || detailOnly ? (
        <>
          <Image
            src={item.image}
            alt={`${collection.name} ${item.sku} source photograph`}
            fill
            sizes="70vw"
            style={{ objectFit: "contain", padding: 40 }}
            unoptimized
          />
          <span className="three-note">
            {!supported
              ? "Source photograph · 3D geometry is available for plates and trays"
              : "Static source preview · 3D is unavailable in this browser"}
          </span>
        </>
      ) : (
        <span className="three-note">
          Drag to rotate · Pinch to zoom · Illustrative geometry
        </span>
      )}
    </div>
  );
}
