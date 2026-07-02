"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, Wifi, AlertTriangle, Shield, Loader2, ChevronRight } from "lucide-react";
import { usePS13Store, getRiskColor } from "@/store";

export default function GraphPanel() {
  const [centrality, setCentrality] = useState<any[]>([]);
  const [redundancy, setRedundancy] = useState<any>(null);
  const [mplsData, setMplsData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"centrality" | "redundancy" | "mpls">("centrality");

  async function load() {
    setLoading(true);
    try {
      const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const [cRes, rRes, mRes] = await Promise.all([
        fetch(`${BASE}/api/graph/centrality`).then((r) => r.json()),
        fetch(`${BASE}/api/graph/redundancy`).then((r) => r.json()),
        fetch(`${BASE}/api/graph/mpls`).then((r) => r.json()),
      ]);
      setCentrality(cRes.centrality ?? []);
      setRedundancy(rRes);
      setMplsData(mRes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-neon/10 border border-neon/30 flex items-center justify-center">
              <Share2 size={14} className="text-neon" />
            </div>
            <div>
              <div className="text-sm font-display font-bold text-white">Graph Intelligence</div>
              <div className="text-[10px] text-white/30 font-mono">NetworkX Analytics</div>
            </div>
          </div>
          <button
            onClick={load}
            className="text-white/30 hover:text-white/60 transition-colors"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <span className="text-[10px] font-mono">↻ refresh</span>}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          {(["centrality", "redundancy", "mpls"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`flex-1 text-[9px] font-mono py-1.5 rounded-md uppercase tracking-widest transition-all ${
                activeTab === t
                  ? "bg-neon/15 border border-neon/30 text-neon"
                  : "text-white/30 hover:text-white/50 border border-transparent"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 size={20} className="text-neon animate-spin" />
          </div>
        ) : (
          <>
            {/* Centrality Tab */}
            {activeTab === "centrality" && (
              <div className="space-y-2">
                <div className="text-[10px] text-white/30 font-mono uppercase tracking-widest mb-2">
                  Betweenness Centrality — Critical Transit Nodes
                </div>
                {centrality.slice(0, 10).map((node, i) => {
                  const color = node.risk_score > 60 ? "#e26370" : node.is_critical ? "#8fb4ff" : "#8b93a3";
                  const barWidth = Math.round(node.betweenness_centrality * 100 * 3);
                  return (
                    <motion.div
                      key={node.node_id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="rounded-lg p-2.5 border border-white/5 bg-white/2"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {node.is_critical && (
                            <Shield size={9} className="text-neon flex-shrink-0" />
                          )}
                          <span className="text-[10px] font-mono text-white/80">{node.node_id}</span>
                        </div>
                        <span className="text-[10px] font-mono font-bold" style={{ color }}>
                          {node.betweenness_centrality.toFixed(3)}
                        </span>
                      </div>
                      <div className="metric-bar mb-1.5">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: color }}
                          animate={{ width: `${Math.min(barWidth, 100)}%` }}
                          transition={{ duration: 0.8, delay: i * 0.05 }}
                        />
                      </div>
                      <div className="text-[9px] font-mono text-white/30 leading-tight">
                        {node.interpretation}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Redundancy Tab */}
            {activeTab === "redundancy" && redundancy && (
              <div className="space-y-3">
                {/* Score */}
                <div
                  className="rounded-xl p-3 text-center"
                  style={{
                    background: redundancy.redundancy_score > 60 ? "rgba(87,182,166,0.08)" : "rgba(226,99,112,0.08)",
                    border: `1px solid ${redundancy.redundancy_score > 60 ? "rgba(87,182,166,0.25)" : "rgba(226,99,112,0.25)"}`,
                  }}
                >
                  <div className="text-2xl font-display font-bold mb-1"
                    style={{ color: redundancy.redundancy_score > 60 ? "#57b6a6" : "#e26370" }}>
                    {redundancy.redundancy_score}
                  </div>
                  <div className="text-[10px] font-mono text-white/40">Redundancy Score / 100</div>
                </div>

                {/* Connectivity */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg p-2.5 border border-white/5 text-center">
                    <div className="text-lg font-display font-bold text-neon">{redundancy.edge_connectivity}</div>
                    <div className="text-[9px] font-mono text-white/30">Edge Connectivity</div>
                  </div>
                  <div className="rounded-lg p-2.5 border border-white/5 text-center">
                    <div className="text-lg font-display font-bold text-plasma">{redundancy.node_connectivity}</div>
                    <div className="text-[9px] font-mono text-white/30">Node Connectivity</div>
                  </div>
                </div>

                {/* SPOFs */}
                {redundancy.single_points_of_failure?.length > 0 && (
                  <div>
                    <div className="text-[10px] text-white/30 font-mono uppercase tracking-widest mb-1.5">
                      ⚠️ Single Points of Failure ({redundancy.single_points_of_failure.length})
                    </div>
                    {redundancy.single_points_of_failure.map((spof: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-md border border-amber-500/20 bg-amber-500/5 mb-1">
                        <AlertTriangle size={9} className="text-amber-400 flex-shrink-0" />
                        <span className="text-[10px] font-mono text-white/70">{spof.source}</span>
                        <ChevronRight size={8} className="text-white/20" />
                        <span className="text-[10px] font-mono text-white/50">{spof.target}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* MPLS Tab */}
            {activeTab === "mpls" && mplsData && (
              <div className="space-y-3">
                {/* MPLS Health */}
                <div
                  className="rounded-xl p-3 flex items-center gap-3"
                  style={{
                    background: mplsData.overall_mpls_health === "HEALTHY" ? "rgba(87,182,166,0.08)" : "rgba(226,99,112,0.08)",
                    border: `1px solid ${mplsData.overall_mpls_health === "HEALTHY" ? "rgba(87,182,166,0.3)" : "rgba(226,99,112,0.3)"}`,
                  }}
                >
                  <Wifi size={20} className={mplsData.overall_mpls_health === "HEALTHY" ? "text-green-400" : "text-red-400"} />
                  <div>
                    <div className="text-sm font-display font-bold"
                      style={{ color: mplsData.overall_mpls_health === "HEALTHY" ? "#57b6a6" : "#e26370" }}>
                      MPLS {mplsData.overall_mpls_health}
                    </div>
                    <div className="text-[10px] font-mono text-white/30">
                      {mplsData.total_lsps} LSPs · {mplsData.congested_lsps} congested
                    </div>
                  </div>
                </div>

                {/* LSPs */}
                <div className="text-[10px] text-white/30 font-mono uppercase tracking-widest mb-1">
                  Label-Switched Paths
                </div>
                {(mplsData.lsps ?? []).map((lsp: any, i: number) => {
                  const util = lsp.utilization ?? 0;
                  const color = util > 75 ? "#e26370" : util > 50 ? "#dd8a4a" : "#8fb4ff";
                  return (
                    <motion.div
                      key={lsp.link_id ?? i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.04 }}
                      className="rounded-lg p-2 border border-white/5 bg-white/2"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-mono text-white/50">
                          {lsp.source} → {lsp.target}
                        </span>
                        <span className="text-[9px] font-mono font-bold" style={{ color }}>
                          {util.toFixed(0)}%
                        </span>
                      </div>
                      <div className="metric-bar">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: color }}
                          animate={{ width: `${Math.min(util, 100)}%` }}
                          transition={{ duration: 0.8 }}
                        />
                      </div>
                      <div className="text-[9px] font-mono text-white/20 mt-0.5">
                        {lsp.bandwidth_mbps}Mbps · {lsp.latency_ms?.toFixed(1)}ms · {lsp.status}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
