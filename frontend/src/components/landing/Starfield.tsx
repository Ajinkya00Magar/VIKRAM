"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface StarfieldProps {
  count?: number;
  /** Radius of the spherical shell the stars are scattered through. */
  radius?: number;
  /** Base point size. */
  size?: number;
  /** How fast the whole field slowly rotates. */
  drift?: number;
  /** Mix of cool tones — stars are tinted between white and starlight blue. */
  opacity?: number;
}

/**
 * A calm deep-space starfield. Stars are scattered through a spherical shell,
 * gently rotate as one field (parallax comes from the camera), and softly
 * twinkle. Pure ambient background — nothing sits in the centre so the
 * VIKRAM wordmark never competes with an object.
 */
export default function Starfield({
  count = 900,
  radius = 42,
  size = 0.18,
  drift = 0.012,
  opacity = 0.9,
}: StarfieldProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);

  const { positions, colors, phases } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const phases = new Float32Array(count);

    const white = new THREE.Color("#f2f5ff");
    const blue = new THREE.Color("#8fb4ff");
    const faint = new THREE.Color("#5f78b4");

    for (let i = 0; i < count; i++) {
      // Scatter through a shell so the centre stays comparatively sparse.
      const r = radius * (0.35 + Math.random() * 0.65);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = -Math.abs(r * Math.cos(phi)) - 4; // push behind camera focal plane

      // Tint: mostly cool white with occasional bluer stars.
      const t = Math.random();
      const c = t > 0.82 ? blue : t < 0.15 ? faint : white;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      phases[i] = Math.random() * Math.PI * 2;
    }
    return { positions, colors, phases };
  }, [count, radius]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (pointsRef.current) {
      pointsRef.current.rotation.y = t * drift;
      pointsRef.current.rotation.x = Math.sin(t * drift * 0.5) * 0.05;
    }
    // Global soft twinkle by breathing overall opacity.
    if (matRef.current) {
      matRef.current.opacity = opacity * (0.82 + 0.18 * Math.sin(t * 0.8 + phases[0]));
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        size={size}
        vertexColors
        transparent
        opacity={opacity}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
