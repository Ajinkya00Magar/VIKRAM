"use client";

import { useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import Starfield from "./Starfield";
import ShootingStars from "./ShootingStars";
import BinaryStars from "./BinaryStars";

// ── Mouse-driven parallax camera ─────────────────────────────────────────────
function ParallaxCamera() {
  const { camera } = useThree();
  const mouse = useRef({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.current.y = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useFrame(() => {
    // Lag behind the pointer for a silky parallax drift.
    target.current.x += (mouse.current.x * 0.05 - target.current.x) * 0.04;
    target.current.y += (mouse.current.y * 0.035 - target.current.y) * 0.04;
    camera.rotation.y = target.current.x;
    camera.rotation.x = target.current.y;
  });

  return null;
}

// ── Slow-breathing nebula clouds (far background gradient planes) ─────────────
function Nebula() {
  const a = useRef<THREE.Mesh>(null);
  const b = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (a.current) {
      (a.current.material as THREE.MeshBasicMaterial).opacity =
        0.06 + 0.025 * Math.sin(t * 0.18);
      a.current.rotation.z = t * 0.008;
    }
    if (b.current) {
      (b.current.material as THREE.MeshBasicMaterial).opacity =
        0.05 + 0.02 * Math.sin(t * 0.13 + 1.5);
      b.current.rotation.z = -t * 0.006;
    }
  });

  return (
    <>
      <mesh ref={a} position={[-8, 5, -30]}>
        <planeGeometry args={[46, 46]} />
        <meshBasicMaterial color="#3a5aa0" transparent opacity={0.06} depthWrite={false} />
      </mesh>
      <mesh ref={b} position={[10, -6, -34]}>
        <planeGeometry args={[52, 52]} />
        <meshBasicMaterial color="#5f4a8a" transparent opacity={0.05} depthWrite={false} />
      </mesh>
    </>
  );
}

// ── Main exported canvas ──────────────────────────────────────────────────────
export default function Scene3D() {
  return (
    <Canvas
      camera={{ position: [0, 0, 8], fov: 62, near: 0.1, far: 200 }}
      style={{ position: "absolute", inset: 0 }}
      gl={{ antialias: true, alpha: true }}
    >
      {/* Deep-space atmosphere fog — cool charcoal */}
      <fog attach="fog" args={["#0a0b0e", 26, 90]} />

      <ParallaxCamera />
      <Nebula />

      {/* Layered starfields for a sense of depth */}
      <Starfield count={520} radius={58} size={0.11} drift={0.006} opacity={0.55} />
      <Starfield count={340} radius={42} size={0.17} drift={0.011} opacity={0.8} />
      <Starfield count={140} radius={26} size={0.26} drift={0.018} opacity={0.95} />

      {/* Living background elements — meteors + a distant binary system */}
      <ShootingStars count={5} />
      <BinaryStars position={[-9.5, 4.2, -24]} scale={1} />
      <BinaryStars position={[11, -5.5, -30]} scale={0.7} />
    </Canvas>
  );
}
