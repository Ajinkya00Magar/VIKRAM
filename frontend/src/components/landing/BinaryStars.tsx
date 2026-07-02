"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface BinaryStarsProps {
  position?: [number, number, number];
  scale?: number;
}

/**
 * A distant binary star system — two glowing stars orbiting a shared centre
 * with a pulsing "fusion" energy bridge between them. Sits far back and off to
 * one side so it reads as background depth, never crossing the wordmark.
 */
export default function BinaryStars({
  position = [-9.5, 4.2, -24],
  scale = 1,
}: BinaryStarsProps) {
  const orbit = useRef<THREE.Group>(null);
  const bridge = useRef<THREE.Mesh>(null);
  const haloA = useRef<THREE.Mesh>(null);
  const haloB = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (orbit.current) orbit.current.rotation.z = t * 0.35;
    // Fusion bridge breathes — energy arcing between the pair.
    if (bridge.current) {
      const m = bridge.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.18 + 0.16 * (0.5 + 0.5 * Math.sin(t * 3));
      bridge.current.scale.y = 0.9 + 0.25 * Math.sin(t * 3);
    }
    const pulse = 0.85 + 0.15 * Math.sin(t * 2.2);
    if (haloA.current) haloA.current.scale.setScalar(pulse);
    if (haloB.current) haloB.current.scale.setScalar(pulse * 1.05);
  });

  const R = 0.85; // orbital radius

  return (
    <group position={position} scale={scale}>
      <group ref={orbit}>
        {/* Fusion energy bridge */}
        <mesh ref={bridge}>
          <planeGeometry args={[R * 2, 0.14]} />
          <meshBasicMaterial
            color="#b9d2ff"
            transparent
            opacity={0.22}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {/* Star A — cooler blue */}
        <group position={[R, 0, 0]}>
          <mesh>
            <circleGeometry args={[0.16, 24]} />
            <meshBasicMaterial color="#eaf2ff" transparent opacity={0.95} />
          </mesh>
          <mesh ref={haloA}>
            <circleGeometry args={[0.42, 24]} />
            <meshBasicMaterial
              color="#8fb4ff"
              transparent
              opacity={0.25}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>

        {/* Star B — warmer white */}
        <group position={[-R, 0, 0]}>
          <mesh>
            <circleGeometry args={[0.2, 24]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.95} />
          </mesh>
          <mesh ref={haloB}>
            <circleGeometry args={[0.5, 24]} />
            <meshBasicMaterial
              color="#a9c7ea"
              transparent
              opacity={0.22}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}
