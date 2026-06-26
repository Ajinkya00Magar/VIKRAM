"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export default function ArcaneSigil() {
  const outerRingRef  = useRef<THREE.Mesh>(null);
  const innerRingRef  = useRef<THREE.Mesh>(null);
  const middleRingRef = useRef<THREE.Mesh>(null);
  const glowRef       = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (outerRingRef.current)  outerRingRef.current.rotation.z  =  t * 0.08;
    if (innerRingRef.current)  innerRingRef.current.rotation.z  = -t * 0.14;
    if (middleRingRef.current) middleRingRef.current.rotation.z =  t * 0.05;
    if (glowRef.current) {
      const s = 0.9 + 0.1 * Math.sin(t * 1.5);
      glowRef.current.scale.setScalar(s);
    }
  });

  return (
    <group>
      {/* Outer ring */}
      <mesh ref={outerRingRef}>
        <torusGeometry args={[2.8, 0.018, 8, 80]} />
        <meshBasicMaterial color="#c9a55a" transparent opacity={0.55} />
      </mesh>

      {/* Middle ring (counter-spin) */}
      <mesh ref={middleRingRef}>
        <torusGeometry args={[2.2, 0.014, 8, 64]} />
        <meshBasicMaterial color="#a07838" transparent opacity={0.38} />
      </mesh>

      {/* Inner ring */}
      <mesh ref={innerRingRef}>
        <torusGeometry args={[1.6, 0.018, 8, 48]} />
        <meshBasicMaterial color="#c9a55a" transparent opacity={0.45} />
      </mesh>

      {/* Radial lines — 6 spokes */}
      {[0, 30, 60, 90, 120, 150].map((deg, i) => (
        <mesh
          key={i}
          rotation={[0, 0, (deg * Math.PI) / 180]}
          ref={outerRingRef}
        >
          <planeGeometry args={[5.8, 0.012]} />
          <meshBasicMaterial color="#c9a55a" transparent opacity={0.18} />
        </mesh>
      ))}

      {/* Compass point diamonds */}
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, i) => (
        <mesh
          key={i}
          position={[
            Math.cos(angle) * 2.8,
            Math.sin(angle) * 2.8,
            0,
          ]}
          rotation={[0, 0, Math.PI / 4]}
        >
          <planeGeometry args={[0.14, 0.14]} />
          <meshBasicMaterial color="#e8c87a" transparent opacity={0.8} />
        </mesh>
      ))}

      {/* Inner decorative hexagon ring (static) */}
      <mesh>
        <torusGeometry args={[1.0, 0.012, 6, 6]} />
        <meshBasicMaterial color="#a07838" transparent opacity={0.3} />
      </mesh>

      {/* Centre glow disc */}
      <mesh ref={glowRef}>
        <circleGeometry args={[0.22, 20]} />
        <meshBasicMaterial color="#f0d888" transparent opacity={0.9} />
      </mesh>

      {/* Centre halo (larger, very faint) */}
      <mesh>
        <circleGeometry args={[0.6, 32]} />
        <meshBasicMaterial color="#c9a55a" transparent opacity={0.12} />
      </mesh>
    </group>
  );
}
