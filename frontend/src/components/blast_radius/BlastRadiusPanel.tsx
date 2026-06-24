"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Users, Server, Globe, AlertTriangle, Loader2 } from "lucide-react";
import { usePS13Store, getRiskColor } from "@/store";
import { getBlastRadius } from "@/lib/api";

const FAILURE_TYPES = [
  "MPLS_FAILURE", "CONGESTION", "BGP_FLAP",
  "TUNNEL_DEGRADATION", "POLICY_DRIFT",
] as const;

export default function BlastRadiusPanel() {
  const { selectedNode, blastRadius, setBlastRadius } = usePS13Store();
  const [loading, setLoading] = useState(false);
  const [failureType, setFailureType] = useState("MPLS_FAILURE");

  async function analyze() {
    const target = selectedNode?.node_id ?? "HUB-RTR-01";
    setLoading(true);
    try {
      const result = await getBlastRadius(target, failureType);
      setBlastRadius(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const impactColor = blastRadius
    ? getRiskColor(
        blastRadius.impact_score >= 75 ? "CRITICAL" :
        blastRadius.impact_score >= 50 ? "HIGH" :
        blastRadius.impact_score >= 30 ? "MEDIUM" : "LOW"
      )
    : "#6b7280";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-ember/20 border border-ember/40 flex items-center justify-center">
            <Zap size={14} className="text-ember" />
          </div>
          <div>
            <div className="text-sm font-display font-bold text-white">Blast Radius</div>
            <div className="text-[10px] text-white/30 font-mono">
              {selectedNode ? `Analyzing: ${selectedNode.node_id}` : "Select a node"}
            </div>
          </div>
        </div>

        {/* Failure type select */}
        <div className="flex gap-1 flex-wrap mb-3">
          {FAILURE_TYPES.map((ft) => (
            <button
              key={ft}
              onClick={() => setFailureType(ft)}
              className={`text-[9px] font-mono px-2 py-1 rounded-sm transition-all ${
                failureType === ft
                  ? "bg-ember/20 border border-ember/40 text-ember"
                  : "border border-white/10 text-white/30 hover:border-white/20 hover:text-white/50"
              }`}
            >
              {ft.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        <motion.button
          onClick={analyze}
          disabled={loading}
          whileTap={{ scale: 0.97 }}
          className="w-full py-2 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-2"
          style={{
            background: "rgba(249,115,22,0.15)",
            border: "1px solid rgba(249,115,22,0.4)",
            color: "#fb923c",
          }}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
          {loading ? "Computing..." : `Analyze ${selectedNode?.node_id ?? "HUB-RTR-01"}`}
        </motion.button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          {!blastRadius ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-48 text-center"
            >
              <div className="text-white/10 text-xs font-mono">
                Select a node and click Analyze<br />to see blast radius
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {/* Impact Score Radial */}
              <div className="flex justify-center mb-4">
                <div className="relative w-28 h-28">
                  {/* Shockwave rings */}
                  {[1, 2, 3].map((i) => (
                    <motion.div
                      key={i}
                      className="absolute inset-0 rounded-full border"
                      style={{ borderColor: impactColor }}
                      animate={{ scale: [1, 1 + i * 0.4], opacity: [0.5, 0] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        delay: i * 0.5,
                        ease: "easeOut",
                      }}
                    />
                  ))}
                  <svg viewBox="0 0 112 112" className="w-full h-full -rotate-90">
                    <circle cx="56" cy="56" r="48" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="8" />
                    <motion.circle
                      cx="56" cy="56" r="48"
                      fill="none" stroke={impactColor} strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray="301.6"
                      initial={{ strokeDashoffset: 301.6 }}
                      animate={{ strokeDashoffset: 301.6 * (1 - blastRadius.impact_score / 100) }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                      style={{ filter: `drop-shadow(0 0 6px ${impactColor})` }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-xl font-display font-bold" style={{ color: impactColor }}>
                      {blastRadius.impact_score.toFixed(0)}
                    </div>
                    <div className="text-[9px] font-mono text-white/40">IMPACT</div>
                  </div>
                </div>
              </div>

              {/* Trigger info */}
              <div className="text-center mb-4">
                <div className="text-xs font-mono text-white/50">
                  If <span style={{ color: impactColor }} className="font-bold">{blastRadius.trigger_node}</span> fails
                </div>
                <div className="text-[10px] font-mono text-white/30 mt-0.5">
                  {blastRadius.failure_type.replace(/_/g, " ")}
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <StatCard
                  icon={<Server size={14} className="text-neon" />}
                  label="Nodes Affected"
                  value={blastRadius.affected_nodes.length}
                  color="#06b6d4"
                />
                <StatCard
                  icon={<Globe size={14} className="text-plasma" />}
                  label="Sites Affected"
                  value={blastRadius.affected_sites.length}
                  color="#a78bfa"
                />
                <StatCard
                  icon={<Users size={14} className="text-amber-400" />}
                  label="Users Impacted"
                  value={blastRadius.estimated_users_impacted.toLocaleString()}
                  color="#fbbf24"
                />
                <StatCard
                  icon={<AlertTriangle size={14} className="text-ember" />}
                  label="Depth"
                  value={`${blastRadius.propagation_depth} hops`}
                  color="#f97316"
                />
              </div>

              {/* Affected sites */}
              {blastRadius.affected_sites.length > 0 && (
                <div className="mb-3">
                  <div className="text-[10px] text-white/30 font-mono uppercase tracking-widest mb-2">
                    Affected Sites
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {blastRadius.affected_sites.map((site) => (
                      <motion.span
                        key={site}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-[10px] font-mono px-2 py-1 rounded-sm"
                        style={{
                          background: `${impactColor}15`,
                          border: `1px solid ${impactColor}30`,
                          color: impactColor,
                        }}
                      >
                        {site}
                      </motion.span>
                    ))}
                  </div>
                </div>
              )}

              {/* Affected services */}
              {blastRadius.affected_services.length > 0 && (
                <div className="mb-3">
                  <div className="text-[10px] text-white/30 font-mono uppercase tracking-widest mb-2">
                    Services Disrupted
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {blastRadius.affected_services.map((svc) => (
                      <span
                        key={svc}
                        className="text-[10px] font-mono px-2 py-1 rounded-sm bg-red-500/10 border border-red-500/25 text-red-400"
                      >
                        {svc.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Affected nodes */}
              {blastRadius.affected_nodes.length > 0 && (
                <div>
                  <div className="text-[10px] text-white/30 font-mono uppercase tracking-widest mb-2">
                    Cascade Nodes ({blastRadius.affected_nodes.length})
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {blastRadius.affected_nodes.map((nid, i) => (
                      <motion.div
                        key={nid}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-2 text-[10px] font-mono text-white/50"
                      >
                        <div className="w-1 h-1 rounded-full bg-ember flex-shrink-0" />
                        {nid}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StatCard({
  icon, label, value, color,
}: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-lg p-3 flex flex-col gap-1"
      style={{ borderColor: `${color}25` }}
    >
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">{label}</span>
      </div>
      <div className="text-lg font-display font-bold" style={{ color }}>
        {value}
      </div>
    </motion.div>
  );
}
