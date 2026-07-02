"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { usePS13Store, getRiskColor, scoreToLevel } from "@/store";

export default function RiskOverlay() {
  const { systemRisk, criticalNodes, nodeRiskScores, selectedNode, predictions } = usePS13Store();
  const riskLevel = scoreToLevel(systemRisk);
  const riskColor = getRiskColor(riskLevel);

  const topRisks = Object.values(nodeRiskScores)
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 5);

  return (
    <>
      {/* ── Top-left: System Risk Radial ── */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <motion.div
          className="glass-panel rounded-xl p-3 flex items-center gap-3"
          style={{ borderColor: `${riskColor}40` }}
          animate={riskLevel === "CRITICAL" ? { borderColor: ["rgba(226,99,112,0.3)", "rgba(226,99,112,0.8)", "rgba(226,99,112,0.3)"] } : {}}
          transition={{ duration: 1, repeat: Infinity }}
        >
          {/* Radial gauge */}
          <div className="relative w-14 h-14">
            <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
              <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
              <motion.circle
                cx="28" cy="28" r="22"
                fill="none"
                stroke={riskColor}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${138.2}`}
                animate={{ strokeDashoffset: 138.2 * (1 - systemRisk / 100) }}
                transition={{ duration: 1, ease: "easeInOut" }}
                style={{ filter: `drop-shadow(0 0 4px ${riskColor})` }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-display font-bold" style={{ color: riskColor }}>
                {systemRisk.toFixed(0)}
              </span>
            </div>
          </div>
          <div>
            <div className="text-[10px] text-white/40 font-mono uppercase tracking-widest">
              System Risk
            </div>
            <div className="text-xs font-bold font-display mt-0.5" style={{ color: riskColor }}>
              {riskLevel}
            </div>
            {criticalNodes.length > 0 && (
              <div className="text-[10px] text-red-400 mt-0.5 font-mono">
                {criticalNodes.length} CRITICAL
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Bottom-left: Top Risk Nodes ── */}
      {topRisks.length > 0 && (
        <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
          <div className="glass-panel rounded-xl p-3 w-52">
            <div className="text-[10px] text-white/30 font-mono uppercase tracking-widest mb-2">
              Node Risk Ranking
            </div>
            {topRisks.map((rs, i) => {
              const color = getRiskColor(rs.urgency_level);
              return (
                <div key={rs.node_id} className="flex items-center gap-2 mb-1.5">
                  <span className="text-[9px] font-mono text-white/20 w-3">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-white/70 truncate">{rs.node_id}</span>
                      <span className="text-[10px] font-mono font-bold ml-1" style={{ color }}>
                        {rs.risk_score.toFixed(0)}
                      </span>
                    </div>
                    <div className="metric-bar mt-0.5">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: color }}
                        animate={{ width: `${rs.risk_score}%` }}
                        transition={{ duration: 0.8 }}
                      />
                    </div>
                  </div>
                  <div className="w-3 flex-shrink-0">
                    {rs.trend === "INCREASING" && <TrendingUp size={9} className="text-red-400" />}
                    {rs.trend === "DECREASING" && <TrendingDown size={9} className="text-green-400" />}
                    {rs.trend === "STABLE"     && <Minus size={9} className="text-white/30" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Top-right: Active Prediction Count ── */}
      <AnimatePresence>
        {predictions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute top-4 right-4 z-10 pointer-events-none"
          >
            <div
              className="glass-panel rounded-xl p-3 flex items-center gap-2"
              style={{ borderColor: "rgba(221,138,74,0.3)" }}
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <AlertTriangle size={16} className="text-ember" />
              </motion.div>
              <div>
                <div className="text-xs font-bold text-ember font-display">
                  {predictions.length} Predictions
                </div>
                <div className="text-[10px] text-white/40 font-mono">
                  {predictions.filter((p) => p.risk_score >= 70).length} high risk
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Selected node detail strip ── */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none"
          >
            <div
              className="glass-panel rounded-xl px-4 py-2 flex items-center gap-6"
              style={{ borderColor: `${getRiskColor(selectedNode.risk_level)}40` }}
            >
              <div>
                <div className="text-[10px] text-white/40 font-mono">Selected</div>
                <div className="text-xs font-mono font-bold text-white">{selectedNode.node_id}</div>
              </div>
              <MetricChip label="CPU"     value={`${selectedNode.metrics?.cpu_utilization?.toFixed(1) ?? 0}%`} />
              <MetricChip label="BW"      value={`${selectedNode.metrics?.bandwidth_utilization?.toFixed(1) ?? 0}%`} />
              <MetricChip label="Loss"    value={`${selectedNode.metrics?.packet_loss?.toFixed(2) ?? 0}%`} />
              <MetricChip label="Latency" value={`${selectedNode.metrics?.latency_ms?.toFixed(1) ?? 0}ms`} />
              <MetricChip label="Risk"    value={`${selectedNode.risk_score.toFixed(0)}`}
                          color={getRiskColor(selectedNode.risk_level)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function MetricChip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center">
      <div className="text-[9px] text-white/30 font-mono uppercase">{label}</div>
      <div className="text-xs font-mono font-bold" style={{ color: color ?? "rgba(255,255,255,0.8)" }}>
        {value}
      </div>
    </div>
  );
}
