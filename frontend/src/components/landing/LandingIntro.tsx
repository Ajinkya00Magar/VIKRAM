"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Radar, Wifi, Lock } from "lucide-react";
import LiquidWordmark from "./LiquidWordmark";

// Dynamic-import the 3D canvas — avoids SSR completely for Three.js
const Scene3D = dynamic(() => import("./Scene3D"), { ssr: false });

interface LandingIntroProps {
  onEnter: () => void;
}

export default function LandingIntro({ onEnter }: LandingIntroProps) {
  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden select-none"
      style={{ background: "#0a0b0e" }}
    >
      {/* ── 3D starfield background (pure ambient, nothing in the centre) ── */}
      <Scene3D />

      {/* ── Vignette edges ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 42%, rgba(6,7,10,0.9) 100%)",
        }}
      />

      {/* ── Grain / noise overlay ── */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
          backgroundSize: "200px 200px",
        }}
      />

      {/* ── Top badge row (kept high, away from the centre wordmark) ── */}
      <motion.div
        className="absolute top-10 left-1/2 -translate-x-1/2 flex items-center gap-3 pointer-events-none"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
      >
        <span className="parchment-badge">AIR-GAPPED</span>
        <span style={{ color: "rgba(143,180,255,0.3)", fontSize: 10 }}>◆</span>
        <span className="parchment-badge">SECURE MPLS</span>
        <span style={{ color: "rgba(143,180,255,0.3)", fontSize: 10 }}>◆</span>
        <span className="parchment-badge">PREDICTIVE NOC</span>
      </motion.div>

      {/* ── Centre column: the wordmark IS the hero ── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-6">
        {/* Eyebrow line */}
        <motion.div
          className="flex items-center justify-center gap-4 mb-7"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.9 }}
          style={{
            color: "rgba(169,199,234,0.6)",
            fontSize: 11,
            letterSpacing: "0.42em",
            fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
            textTransform: "uppercase",
          }}
        >
          <span
            style={{
              flex: 1,
              height: 1,
              maxWidth: 90,
              background:
                "linear-gradient(to right, transparent, rgba(143,180,255,0.5))",
            }}
          />
          Deep-Space Network Intelligence
          <span
            style={{
              flex: 1,
              height: 1,
              maxWidth: 90,
              background:
                "linear-gradient(to left, transparent, rgba(143,180,255,0.5))",
            }}
          />
        </motion.div>

        {/* Liquid wordmark — reacts to the cursor like water */}
        <motion.div
          className="relative"
          style={{
            width: "min(92vw, 1100px)",
            height: "clamp(120px, 22vh, 240px)",
          }}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.65, duration: 1.1, ease: "easeOut" }}
        >
          <LiquidWordmark text="VIKRAM" className="w-full h-full block" />
        </motion.div>

        {/* Sub-wordmark */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.9 }}
          style={{
            fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
            fontSize: "clamp(0.75rem, 2vw, 1.05rem)",
            color: "#a9c7ea",
            letterSpacing: "0.5em",
            textTransform: "uppercase",
            marginTop: "0.4rem",
            textShadow: "0 0 18px rgba(143,180,255,0.35)",
          }}
        >
          Predictive&nbsp;MPLS&nbsp;Copilot
        </motion.p>

        {/* Feature pills */}
        <motion.div
          className="flex items-center gap-7 mt-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
        >
          {[
            { icon: Radar, label: "Anomaly Detection" },
            { icon: Wifi, label: "Live Telemetry" },
            { icon: Lock, label: "Air-Gapped RAG" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2"
              style={{
                color: "rgba(169,199,234,0.6)",
                fontSize: 11,
                fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              <Icon size={12} />
              {label}
            </div>
          ))}
        </motion.div>

        {/* CTA — pointer-events re-enabled just for this button */}
        <motion.div
          className="mt-11"
          style={{ pointerEvents: "auto" }}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 0.8, ease: "easeOut" }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          <button className="arcane-btn" onClick={onEnter}>
            <span className="corner-ornament tl" />
            <span className="corner-ornament tr" />
            <span className="corner-ornament bl" />
            <span className="corner-ornament br" />
            Enter&nbsp;&nbsp;·&nbsp;&nbsp;Launch Console
          </button>
        </motion.div>
      </div>

      {/* ── Version footer ── */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8, duration: 0.8 }}
        style={{ pointerEvents: "none" }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: 10,
            color: "rgba(169,199,234,0.32)",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
          }}
        >
          VIKRAM · v1.0.0 · CLASSIFICATION: RESTRICTED
        </span>
      </motion.div>
    </div>
  );
}
