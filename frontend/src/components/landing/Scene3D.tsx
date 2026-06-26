"use client";

import { useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import EmberField from "./EmberField";
import ArcaneSigil from "./ArcaneSigil";

// ── Mouse-driven parallax camera ─────────────────────────────────────────────
function ParallaxCamera() {
  const { camera } = useThree();
  const mouse  = useRef({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.x =  (e.clientX / window.innerWidth  - 0.5) * 2;
      mouse.current.y = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useFrame(() => {
    // Lag behind mouse for a silky parallax feel
    target.current.x += (mouse.current.x * 0.06 - target.current.x) * 0.04;
    target.current.y += (mouse.current.y * 0.04 - target.current.y) * 0.04;
    camera.rotation.y = target.current.x;
    camera.rotation.x = target.current.y;
  });

  return null;
}

// ── Ambient foggy golden mist ─────────────────────────────────────────────────
function AmbientMist() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime;
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.025 + 0.01 * Math.sin(t * 0.3);
  });

  return (
    <mesh ref={meshRef} position={[0, 0, -15]}>
      <planeGeometry args={[60, 40]} />
      <meshBasicMaterial color="#c9a55a" transparent opacity={0.03} />
    </mesh>
  );
}

// ── Main exported canvas ──────────────────────────────────────────────────────
export default function Scene3D() {
  return (
    <Canvas
      camera={{ position: [0, 0, 8], fov: 60, near: 0.1, far: 200 }}
      style={{ position: "absolute", inset: 0 }}
      gl={{ antialias: true, alpha: true }}
    >
      {/* Atmosphere fog — warm amber */}
      <fog attach="fog" args={["#0a0600", 18, 60]} />

      <ParallaxCamera />
      <AmbientMist />

      {/* ── Deep background stars (very slow, tiny) ── */}
      <EmberField
        count={200}
        zDepth={-40}
        color="#6b4c1a"
        opacity={0.4}
        sizeRange={[0.02, 0.06]}
        speedRange={[0.002, 0.007]}
        spread={[50, 35]}
      />

      {/* ── Mid-ground embers ── */}
      <EmberField
        count={120}
        zDepth={-18}
        color="#a07838"
        opacity={0.5}
        sizeRange={[0.04, 0.1]}
        speedRange={[0.006, 0.018]}
        spread={[30, 22]}
      />

      {/* ── Foreground bright ember sparks ── */}
      <EmberField
        count={60}
        zDepth={-5}
        color="#e8c87a"
        opacity={0.65}
        sizeRange={[0.05, 0.14]}
        speedRange={[0.012, 0.028]}
        spread={[18, 12]}
      />

      {/* ── Very close micro-sparks ── */}
      <EmberField
        count={30}
        zDepth={2}
        color="#f0d888"
        opacity={0.45}
        sizeRange={[0.03, 0.08]}
        speedRange={[0.018, 0.04]}
        spread={[12, 8]}
      />

      {/* ── Central arcane sigil ── */}
      <ArcaneSigil />
    </Canvas>
  );
}
