"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Satellite, AlertTriangle, Activity, Radio, Lock, PanelLeft, PanelRight, Home } from "lucide-react";
import { usePS13Store, getRiskColor, scoreToLevel } from "@/store";

interface MissionHeaderProps {
  connected: boolean;
}

function LiveClock() {
  // Start null so the server-rendered HTML and the client's first render match
  // (both show the placeholder). The real time is only set after mount, which
  // avoids a hydration mismatch on the ever-changing clock value.
  const [time, setTime] = useState<Date | null>(null);
  useEffect(() => {
    setTime(new Date());
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-xs font-mono text-white/40" suppressHydrationWarning>
      {time ? time.toUTCString().slice(17, 25) : "--:--:--"} UTC
    </div>
  );
}

export default function MissionHeader({ connected }: MissionHeaderProps) {
  const {
    systemRisk, highestRiskNode, criticalNodes, activeScenarios,
    sidebarOpen, setSidebarOpen, panelOpen, setPanelOpen, setShowLanding,
  } = usePS13Store();
  const riskLevel = scoreToLevel(systemRisk);
  const riskColor = getRiskColor(riskLevel);

  return (
    <motion.header
      initial={{ y: -56, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 160, damping: 18, mass: 0.8 }}
      className="h-14 flex items-center px-4 border-b border-plasma/20 bg-surface-1/90 backdrop-blur-md flex-shrink-0 z-50 relative"
    >

      {/* ── Left: sidebar toggle + Branding ── */}
      <div className="flex items-center gap-3 w-72 flex-shrink-0">
        <motion.button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          title={sidebarOpen ? "Collapse navigation (⌘[)" : "Expand navigation (⌘[)"}
          aria-label="Toggle navigation sidebar"
          className={`w-7 h-7 rounded-md flex items-center justify-center border transition-colors ${
            sidebarOpen
              ? "border-plasma/40 text-plasma bg-plasma/10"
              : "border-white/10 text-white/40 hover:text-white hover:bg-white/5"
          }`}
        >
          <PanelLeft size={14} />
        </motion.button>
        <div className="relative">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: `rgba(143,180,255,0.12)`,
              border: `1px solid ${riskColor}40`,
            }}
          >
            <Satellite size={16} className="text-plasma" />
          </div>
          {riskLevel === "CRITICAL" && (
            <motion.div
              className="absolute -inset-1 rounded-lg border border-red-500"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
          )}
        </div>
        <button
          onClick={() => setShowLanding(true)}
          title="Back to landing"
          className="text-left group"
        >
          <div
            className="text-sm font-bold tracking-[0.35em] text-white group-hover:text-plasma transition-colors"
            style={{ fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)" }}
          >
            VIKRAM
          </div>
          <div className="text-[10px] text-white/40 font-mono tracking-widest uppercase">
            Air-Gapped MPLS Copilot
          </div>
        </button>
      </div>

      {/* ── Centre: Risk Indicators ── */}
      <div className="flex-1 flex items-center justify-center gap-6">
        <div className="flex items-center gap-2">
          <div className="text-xs text-white/40 font-mono uppercase tracking-widest">System Risk</div>
          <motion.div
            className="font-mono font-bold text-lg tabular-nums"
            style={{ color: riskColor }}
            animate={{ scale: riskLevel === "CRITICAL" ? [1, 1.05, 1] : 1 }}
            transition={{ duration: 0.5, repeat: riskLevel === "CRITICAL" ? Infinity : 0 }}
          >
            {systemRisk.toFixed(1)}
          </motion.div>
          <div
            className="text-xs font-mono px-2 py-0.5 rounded-sm"
            style={{
              color: riskColor,
              background: `${riskColor}18`,
              border: `1px solid ${riskColor}40`,
            }}
          >
            {riskLevel}
          </div>
        </div>

        <div className="w-px h-5 bg-white/10" />

        {highestRiskNode && (
          <div className="flex items-center gap-2">
            <div className="text-xs text-white/40 font-mono uppercase">Highest Risk</div>
            <div className="text-xs font-mono text-ember">{highestRiskNode}</div>
          </div>
        )}

        <div className="w-px h-5 bg-white/10" />

        <div className="flex items-center gap-2">
          <AlertTriangle size={12} className={criticalNodes.length > 0 ? "text-red-400" : "text-white/30"} />
          <div className="text-xs font-mono">
            <span className={criticalNodes.length > 0 ? "text-red-400" : "text-white/30"}>
              {criticalNodes.length}
            </span>
            <span className="text-white/30"> critical</span>
          </div>
        </div>

        {activeScenarios.length > 0 && (
          <>
            <div className="w-px h-5 bg-white/10" />
            <motion.div
              className="flex items-center gap-2 px-3 py-1 rounded-sm"
              style={{ background: "rgba(221,138,74,0.1)", border: "1px solid rgba(221,138,74,0.3)" }}
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Radio size={10} className="text-ember" />
              <span className="text-xs font-mono text-ember">
                {activeScenarios.length} INTRUSION{activeScenarios.length > 1 ? "S" : ""}:{" "}
                {activeScenarios.map((s) => s.type.replace(/_/g, " ")).join(" · ")}
              </span>
            </motion.div>
          </>
        )}
      </div>

      {/* ── Right: Status ── */}
      <div className="flex items-center gap-4 w-72 justify-end flex-shrink-0">
        <motion.button
          onClick={() => setShowLanding(true)}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          title="Back to landing page"
          aria-label="Back to landing page"
          className="w-7 h-7 rounded-md flex items-center justify-center border border-white/10 text-white/40 hover:text-plasma hover:border-plasma/40 hover:bg-plasma/5 transition-colors"
        >
          <Home size={14} />
        </motion.button>

        <div className="text-xs font-mono text-white/30">
          <Activity size={10} className="inline mr-1" />
          {usePS13Store.getState().nodes.length} nodes
        </div>

        <LiveClock />

        <div className="flex items-center gap-1.5">
          {connected ? (
            <>
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-green-400"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="text-xs font-mono text-green-400">LIVE</span>
            </>
          ) : (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="text-xs font-mono text-red-400">OFFLINE</span>
            </>
          )}
        </div>

        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded-sm"
          style={{
            background: "rgba(143,180,255,0.08)",
            border: "1px solid rgba(143,180,255,0.3)",
          }}
        >
          <Lock size={9} className="text-plasma" />
          <span className="text-[10px] font-mono text-plasma tracking-widest">AIR-GAPPED</span>
        </div>

        <motion.button
          onClick={() => setPanelOpen(!panelOpen)}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          title={panelOpen ? "Collapse side panel (⌘])" : "Expand side panel (⌘])"}
          aria-label="Toggle side panel"
          className={`w-7 h-7 rounded-md flex items-center justify-center border transition-colors ${
            panelOpen
              ? "border-plasma/40 text-plasma bg-plasma/10"
              : "border-white/10 text-white/40 hover:text-white hover:bg-white/5"
          }`}
        >
          <PanelRight size={14} />
        </motion.button>
      </div>
    </motion.header>
  );
}
