"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, WifiOff, AlertTriangle, Activity, Radio, Wifi } from "lucide-react";
import { usePS13Store, getRiskColor, scoreToLevel } from "@/store";

interface MissionHeaderProps {
  connected: boolean;
}

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-xs font-mono text-white/40">
      {time.toUTCString().slice(17, 25)} UTC
    </div>
  );
}

export default function MissionHeader({ connected }: MissionHeaderProps) {
  const { systemRisk, highestRiskNode, criticalNodes, scenario } = usePS13Store();
  const riskLevel = scoreToLevel(systemRisk);
  const riskColor = getRiskColor(riskLevel);

  return (
    <header className="h-14 flex items-center px-4 border-b border-plasma/20 bg-surface-1/90 backdrop-blur-md flex-shrink-0 z-50 relative">

      {/* ── Left: Branding ── */}
      <div className="flex items-center gap-3 w-72 flex-shrink-0">
        <div className="relative">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: `rgba(201,165,90,0.12)`,
              border: `1px solid ${riskColor}40`,
            }}
          >
            <Shield size={16} className="text-plasma" />
          </div>
          {riskLevel === "CRITICAL" && (
            <motion.div
              className="absolute -inset-1 rounded-lg border border-red-500"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
          )}
        </div>
        <div>
          <div
            className="text-xs font-bold tracking-wider text-white"
            style={{ fontFamily: "var(--font-display, 'Cinzel', serif)" }}
          >
            PS13 Mission Control
          </div>
          <div className="text-[10px] text-white/40 font-mono tracking-widest uppercase">
            Air-Gapped MPLS Copilot
          </div>
        </div>
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

        {scenario.active && (
          <>
            <div className="w-px h-5 bg-white/10" />
            <motion.div
              className="flex items-center gap-2 px-3 py-1 rounded-sm"
              style={{ background: "rgba(200,64,32,0.1)", border: "1px solid rgba(200,64,32,0.3)" }}
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Radio size={10} className="text-ember" />
              <span className="text-xs font-mono text-ember">
                SCENARIO: {scenario.active?.replace("_", " ")} — {scenario.severity}
              </span>
            </motion.div>
          </>
        )}
      </div>

      {/* ── Right: Status ── */}
      <div className="flex items-center gap-4 w-72 justify-end flex-shrink-0">
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
            background: "rgba(201,165,90,0.08)",
            border: "1px solid rgba(201,165,90,0.3)",
          }}
        >
          <Shield size={9} className="text-plasma" />
          <span className="text-[10px] font-mono text-plasma tracking-widest">AIR-GAPPED</span>
        </div>
      </div>
    </header>
  );
}
