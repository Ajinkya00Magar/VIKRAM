"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Shield, Wifi, Lock } from "lucide-react";

// Dynamic-import the 3D canvas — avoids SSR completely for Three.js
const Scene3D = dynamic(() => import("./Scene3D"), { ssr: false });

interface LandingIntroProps {
  onEnter: () => void;
}

export default function LandingIntro({ onEnter }: LandingIntroProps) {
  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden select-none"
      style={{ background: "#080502" }}
    >
      {/* ── 3D WebGL Canvas (fills everything) ── */}
      <Scene3D />

      {/* ── Vignette edges ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(4,2,1,0.85) 100%)",
        }}
      />

      {/* ── Grain / noise overlay ── */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
          backgroundSize: "200px 200px",
        }}
      />

      {/* ── UI Overlay ─────────────────────────────────────────────── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">

        {/* Top badge row */}
        <motion.div
          className="flex items-center gap-3 mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
        >
          <span className="parchment-badge">AIR-GAPPED</span>
          <span style={{ color: "rgba(201,165,90,0.3)", fontSize: 12 }}>◆</span>
          <span className="parchment-badge">SECURE MPLS</span>
          <span style={{ color: "rgba(201,165,90,0.3)", fontSize: 12 }}>◆</span>
          <span className="parchment-badge">PS-13 SANCTUM</span>
        </motion.div>

        {/* Main title */}
        <motion.div
          className="text-center mb-6"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.65, duration: 1.0, ease: "easeOut" }}
        >
          {/* Ornamental top line */}
          <div
            className="flex items-center justify-center gap-4 mb-6"
            style={{ color: "rgba(201,165,90,0.45)", fontSize: 11, letterSpacing: "0.4em", fontFamily: "var(--font-display, 'Cinzel', serif)" }}
          >
            <span style={{ flex: 1, height: 1, background: "linear-gradient(to right, transparent, rgba(201,165,90,0.4))", maxWidth: 120 }} />
            ✦  ARCANE NETWORK INTELLIGENCE  ✦
            <span style={{ flex: 1, height: 1, background: "linear-gradient(to left, transparent, rgba(201,165,90,0.4))", maxWidth: 120 }} />
          </div>

          {/* Hero wordmark */}
          <h1
            style={{
              fontFamily: "var(--font-rune, 'Cinzel Decorative', Georgia, serif)",
              fontSize: "clamp(2.8rem, 8vw, 6rem)",
              fontWeight: 900,
              color: "#e8d5a3",
              lineHeight: 1.05,
              textShadow:
                "0 0 40px rgba(201,165,90,0.5), 0 0 80px rgba(180,100,40,0.3)",
              margin: 0,
              letterSpacing: "0.02em",
            }}
          >
            Mission Control
          </h1>

          {/* Sub-wordmark */}
          <p
            style={{
              fontFamily: "var(--font-display, 'Cinzel', Georgia, serif)",
              fontSize: "clamp(0.8rem, 2.5vw, 1.25rem)",
              color: "#c9a55a",
              letterSpacing: "0.55em",
              textTransform: "uppercase",
              marginTop: "0.6rem",
              textShadow: "0 0 20px rgba(201,165,90,0.4)",
            }}
          >
            Predictive MPLS Copilot
          </p>
        </motion.div>

        {/* Latin scroll banner */}
        <motion.div
          className="relative mb-10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.8 }}
        >
          {/* Scroll ribbon */}
          <div
            style={{
              border: "1px solid rgba(201,165,90,0.3)",
              background: "rgba(201,165,90,0.04)",
              padding: "10px 48px",
              position: "relative",
            }}
          >
            {/* Ribbon end tabs */}
            <div style={{ position: "absolute", left: -12, top: "50%", transform: "translateY(-50%) rotate(180deg)", width: 0, height: 0, borderTop: "18px solid transparent", borderBottom: "18px solid transparent", borderLeft: "12px solid rgba(201,165,90,0.2)" }} />
            <div style={{ position: "absolute", right: -12, top: "50%", transform: "translateY(-50%)", width: 0, height: 0, borderTop: "18px solid transparent", borderBottom: "18px solid transparent", borderLeft: "12px solid rgba(201,165,90,0.2)" }} />

            <p
              style={{
                fontFamily: "var(--font-serif, 'Lora', Georgia, serif)",
                fontSize: "0.82rem",
                fontStyle: "italic",
                color: "rgba(232,213,163,0.65)",
                letterSpacing: "0.06em",
                margin: 0,
                textAlign: "center",
              }}
            >
              Magica retis · ordo ex chao · vigilantia aeterna
            </p>
          </div>
        </motion.div>

        {/* Feature pills */}
        <motion.div
          className="flex items-center gap-6 mb-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
        >
          {[
            { icon: Shield,  label: "Anomaly Detection" },
            { icon: Wifi,    label: "Live Telemetry"    },
            { icon: Lock,    label: "Air-Gapped RAG"    },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2"
              style={{ color: "rgba(201,165,90,0.55)", fontSize: 11, fontFamily: "var(--font-display, Cinzel, serif)", letterSpacing: "0.18em", textTransform: "uppercase" }}
            >
              <Icon size={11} />
              {label}
            </div>
          ))}
        </motion.div>

        {/* CTA — pointer-events re-enabled just for this button */}
        <motion.div
          style={{ pointerEvents: "auto" }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 0.8, ease: "easeOut" }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          <button
            className="arcane-btn"
            onClick={onEnter}
            style={{ pointerEvents: "auto" }}
          >
            {/* Corner ornaments */}
            <span className="corner-ornament tl" />
            <span className="corner-ornament tr" />
            <span className="corner-ornament bl" />
            <span className="corner-ornament br" />
            ✦ &nbsp; Enter the Sanctum &nbsp; ✦
          </button>
        </motion.div>

        {/* Version footer */}
        <motion.div
          className="absolute bottom-8 flex items-center gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 0.8 }}
          style={{ pointerEvents: "none" }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              fontSize: 10,
              color: "rgba(201,165,90,0.3)",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
            }}
          >
            PS-13 · v1.0.0 · CLASSIFICATION: RESTRICTED
          </span>
        </motion.div>
      </div>
    </div>
  );
}
