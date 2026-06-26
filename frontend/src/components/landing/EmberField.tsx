"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface EmberFieldProps {
  count?: number;
  zDepth?: number;
  color?: string;
  opacity?: number;
  sizeRange?: [number, number];
  speedRange?: [number, number];
  spread?: [number, number];
}

export default function EmberField({
  count = 120,
  zDepth = 0,
  color = "#c9a55a",
  opacity = 0.5,
  sizeRange = [0.03, 0.1],
  speedRange = [0.005, 0.02],
  spread = [20, 15],
}: EmberFieldProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * spread[0],
      y: (Math.random() - 0.5) * spread[1],
      z: zDepth + (Math.random() - 0.5) * 4,
      speed: speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]),
      phase: Math.random() * Math.PI * 2,
      phaseY: Math.random() * Math.PI * 2,
      size: sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]),
      sway: Math.random() * 0.3 + 0.1,
    }));
  }, [count, zDepth, spread, speedRange, sizeRange]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime;

    particles.forEach((p, i) => {
      // Drift upward, wrap around
      p.y += p.speed;
      if (p.y > spread[1] * 0.6) p.y = -spread[1] * 0.6;

      const x = p.x + Math.sin(t * 0.4 + p.phase) * p.sway;
      const y = p.y;
      const scale = p.size * (0.75 + 0.25 * Math.sin(t * 2.5 + p.phaseY));

      dummy.position.set(x, y, p.z);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 5, 5]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} />
    </instancedMesh>
  );
}
