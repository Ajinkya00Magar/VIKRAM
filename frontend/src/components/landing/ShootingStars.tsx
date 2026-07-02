"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface ShootingStarsProps {
  count?: number;
}

/**
 * Occasional meteors streaking across the deep-space backdrop. Each streak is
 * a thin additive plane oriented along its travel direction; when it leaves
 * the field it respawns off-edge after a random delay. Kept to the outer
 * bands of the screen so it never crosses the centred wordmark.
 */
export default function ShootingStars({ count = 5 }: ShootingStarsProps) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);

  const meteors = useMemo(
    () =>
      Array.from({ length: count }, () => spawn(true)),
    [count]
  );

  function spawn(initial = false): {
    x: number; y: number; z: number;
    vx: number; vy: number; life: number; maxLife: number;
    delay: number; len: number;
  } {
    // Start in an upper band, travel down-right; bias away from dead centre.
    const fromLeft = Math.random() > 0.5;
    const x = (fromLeft ? -1 : 1) * (7 + Math.random() * 6);
    const y = 5 + Math.random() * 7;
    const speed = 0.18 + Math.random() * 0.22;
    const dir = fromLeft ? 1 : -1;
    return {
      x,
      y,
      z: -6 - Math.random() * 10,
      vx: dir * speed,
      vy: -speed * (0.55 + Math.random() * 0.4),
      life: 0,
      maxLife: 60 + Math.random() * 60,
      delay: initial ? Math.random() * 300 : Math.random() * 260,
      len: 1.4 + Math.random() * 1.8,
    };
  }

  useFrame(() => {
    meteors.forEach((m, i) => {
      const mesh = refs.current[i];
      if (!mesh) return;

      if (m.delay > 0) {
        m.delay -= 1;
        (mesh.material as THREE.MeshBasicMaterial).opacity = 0;
        return;
      }

      m.life += 1;
      m.x += m.vx;
      m.y += m.vy;

      // Fade in then out across its lifetime.
      const p = m.life / m.maxLife;
      const fade = Math.sin(Math.min(1, p) * Math.PI);
      (mesh.material as THREE.MeshBasicMaterial).opacity = fade * 0.9;

      mesh.position.set(m.x, m.y, m.z);
      mesh.rotation.z = Math.atan2(m.vy, m.vx);
      mesh.scale.set(m.len, 1, 1);

      if (m.life >= m.maxLife || m.y < -12 || Math.abs(m.x) > 20) {
        Object.assign(m, spawn(false));
      }
    });
  });

  return (
    <>
      {meteors.map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          <planeGeometry args={[1, 0.025]} />
          <meshBasicMaterial
            color="#cfe0ff"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
  );
}
