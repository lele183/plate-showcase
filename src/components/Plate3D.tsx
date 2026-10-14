"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { CatalogItem, Collection } from "@/lib/types";
export default function Plate3D({
  item,
  collection,
  onUnavailable,
}: {
  item: CatalogItem;
  collection: Collection;
  onUnavailable: (itemId: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const supported = ["plate", "platter", "tray", "saucer"].includes(item.type);
  useEffect(() => {
    if (!supported) return;
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
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setClearColor("#e6e5dc");
      renderer.shadowMap.enabled = true;
      el.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 100);
      camera.position.set(2.9, 3.3, 3.2);
      const controls = new OrbitControls(camera, renderer.domElement);
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
      geometry.rotateX(-Math.PI / 2);
      const positions = geometry.attributes.position;
      const uvs = geometry.attributes.uv;
      for (let i = 0; i < positions.count; i++)
        uvs.setXY(i, (positions.getX(i) + 1) / 2, (-positions.getZ(i) + 1) / 2);
      const texture = new THREE.TextureLoader().load(
        item.studioImage || item.image,
      );
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
      const top = new THREE.MeshStandardMaterial({
        map: texture,
        color: "#fff",
        transparent: true,
        alphaTest: 0.1,
        roughness: 0.55,
      });
      const mesh = new THREE.Mesh(geometry, [top, side]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(20, 20),
        new THREE.ShadowMaterial({ opacity: 0.13 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.09;
      floor.receiveShadow = true;
      scene.add(floor);
      const observer = new ResizeObserver(() => {
        if (!el.clientWidth) return;
        renderer.setSize(el.clientWidth, el.clientHeight);
        camera.aspect = el.clientWidth / el.clientHeight;
        camera.updateProjectionMatrix();
      });
      observer.observe(el);
      let frame = 0;
      function animate() {
        frame = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      }
      animate();
      dispose = () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        controls.dispose();
        geometry.dispose();
        texture.dispose();
        top.dispose();
        side.dispose();
        floor.geometry.dispose();
        (floor.material as InstanceType<typeof THREE.ShadowMaterial>).dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    }
    mount().catch(() => {
      if (!cancelled) {
        setFailed(true);
        onUnavailable(item.id);
      }
    });
    return () => {
      cancelled = true;
      dispose();
    };
  }, [item, collection, supported, onUnavailable]);
  return (
    <div className="three-view" ref={host}>
      {failed || !supported ? (
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
