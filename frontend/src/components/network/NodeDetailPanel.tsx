"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Play, Brain, ChevronDown, ChevronUp, Activity } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { usePS13Store, getRiskColor, scoreToLevel } from "@/store";
import { getRiskHistory, getBlastRadius, getRankedActions } from "@/lib/api";

export default function NodeDetailPanel() {
  const { selectedNode, setSelectedNode, setActivePanel, setBlastRadius } = usePS13Store();
  const [tab, setTab] = useState<"metrics" | "actions" | "history">("metrics");
  const [riskHistory, setRiskHistory] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingActions, setLoadingActions] = useState(false);

  if (!selectedNode) return null;

  const color = getRiskColor(selectedNode.risk_level);
  const m = selectedNode.metrics ?? {};

  async function loadHistory() {
    if (riskHistory.length > 0) return;
    setLoadingHistory(true);
    try {
      const res = await getRiskHistory(selectedNode!.node_id, 1);
      setRiskHistory(res.history ?? []);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function loadActions() {
    if (actions.length > 0) return;
    setLoadingActions(true);
    try {
      const plan = await getRankedActions(selectedNode!.node_id, "CONGESTION", selectedNode!.risk_score);
      setActions(plan.ranked_actions ?? []);
    } finally {
      setLoadingActions(false);
    }
  }

  async function analyzeBlast() {
    const result = await getBlastRadius(selectedNode!.node_id);
    setBlastRadius(result);
    setActivePanel("blast");
  }

  const METRICS = [
    { label: "CPU",           key: "cpu_utilization",       unit: "%", warn: 80, crit: 90 },
    { label: "Memory",        key: "memory_utilization",    unit: "%", warn: 80, crit: 92 },
    { label: "Bandwidth",     key: "bandwidth_utilization", unit: "%", warn: 75, crit: 85 },
    { label: "Packet Loss",   key: "packet_loss",           unit: "%", warn: 1,  crit: 3  },
    { label: "Latency",       key: "latency_ms",            unit: "ms",warn: 40, crit: 80 },
    { label: "Jitter",        key: "jitter_ms",             unit: "ms",warn: 10, crit: 25 },
    { label: "Error Rate",    key: "error_rate",            unit: "%", warn: 1,  crit: 3  },
    { label: "QoS Drop Rate", key: "qos_drop_rate",         unit: "%", warn: 5,  crit: 10 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute top-4 right-4 z-20 w-72 glass-panel-bright rounded-xl overflow-hidden"
      style={{ borderColor: `${color}35`, maxHeight: "calc(100vh - 200px)" }}
    >
      {/* Header */}
      <div className="p-3 border-b border-white/5" style={{ background: `${color}08` }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
            <span className="text-xs font-display font-bold text-white">{selectedNode!.node_id}</span>
          </div>
          <button onClick={() => setSelectedNode(null)} className="text-white/30 hover:text-white/70 transition-colors">
            <X size={12} />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-white/40">
            {selectedNode.node_type} · {selectedNode.site ?? "—"}
          </span>
          <span className="text-sm font-display font-bold" style={{ color }}>
            {selectedNode.risk_score.toFixed(0)}
            <span className="text-[10px] text-white/30 ml-0.5">/100</span>
          </span>
        </div>
      </div>

      {/* Services */}
      {selectedNode.services.length > 0 && (
        <div className="px-3 py-2 border-b border-white/5 flex flex-wrap gap-1">
          {selectedNode.services.map((s) => (
            <span key={s} className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm bg-white/5 text-white/40 border border-white/10">
              {s.toUpperCase()}
            </span>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-white/5">
        {(["metrics", "actions", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              if (t === "history") loadHistory();
              if (t === "actions") loadActions();
            }}
            className={`flex-1 text-[10px] font-mono py-2 uppercase tracking-widest transition-colors ${
              tab === t ? "text-white border-b border-plasma" : "text-white/30 hover:text-white/60"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="overflow-y-auto" style={{ maxHeight: 300 }}>
        {tab === "metrics" && (
          <div className="p-3 space-y-2">
            {METRICS.map(({ label, key, unit, warn, crit }) => {
              const val = m[key as keyof typeof m] as number ?? 0;
              const metricColor = val >= crit ? "#e26370" : val >= warn ? "#dd8a4a" : "#57b6a6";
              const pct = Math.min(val / crit * 100, 100);
              return (
                <div key={key}>
                  <div className="flex justify-between text-[10px] font-mono mb-0.5">
                    <span className="text-white/50">{label}</span>
                    <span style={{ color: metricColor }}>{val.toFixed(2)}{unit}</span>
                  </div>
                  <div className="metric-bar">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: metricColor }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "history" && (
          <div className="p-3">
            {loadingHistory ? (
              <div className="text-center text-[10px] text-white/30 py-4 font-mono">Loading...</div>
            ) : riskHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={riskHistory}>
                  <defs>
                    <linearGradient id="riskNodeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="timestamp" hide />
                  <YAxis domain={[0, 100]} hide />
                  <Tooltip
                    contentStyle={{ background: "rgba(7,13,26,0.95)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 4, fontSize: 9, fontFamily: "monospace" }}
                    formatter={(v: number) => [`${v.toFixed(1)}`, "Risk"]}
                  />
                  <Area type="monotone" dataKey="risk_score" stroke={color} strokeWidth={2} fill="url(#riskNodeGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-[10px] text-white/30 py-4 font-mono">No history</div>
            )}
          </div>
        )}

        {tab === "actions" && (
          <div className="p-3 space-y-1.5">
            {loadingActions ? (
              <div className="text-center text-[10px] text-white/30 py-4 font-mono">Loading...</div>
            ) : actions.length > 0 ? (
              actions.slice(0, 5).map((action: any) => {
                const ac = action.operational_cost === "LOW" ? "#57b6a6" : action.operational_cost === "MEDIUM" ? "#d8b062" : "#e26370";
                return (
                  <div key={action.rank} className="rounded-md p-2 border border-white/5 bg-white/2">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] font-mono text-white/70">{action.action_type.replace(/_/g, " ")}</span>
                      <span className="text-[9px] font-mono text-green-400">-{action.risk_reduction_pct.toFixed(0)}%</span>
                    </div>
                    <div className="flex gap-3 text-[9px] font-mono text-white/30">
                      <span>{action.estimated_recovery_minutes}min</span>
                      <span style={{ color: ac }}>{action.operational_cost}</span>
                      <span>{(action.confidence * 100).toFixed(0)}% conf</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-[10px] text-white/30 py-4 font-mono">No actions</div>
            )}
          </div>
        )}
      </div>

      {/* Quick action buttons */}
      <div className="p-3 border-t border-white/5 flex gap-1.5">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={analyzeBlast}
          className="flex-1 py-1.5 rounded-md text-[10px] font-mono flex items-center justify-center gap-1"
          style={{ background: "rgba(221,138,74,0.1)", border: "1px solid rgba(221,138,74,0.25)", color: "#dd8a4a" }}
        >
          <Zap size={9} /> Blast Radius
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => { usePS13Store.getState().setActivePanel("copilot"); }}
          className="flex-1 py-1.5 rounded-md text-[10px] font-mono flex items-center justify-center gap-1"
          style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)", color: "#a78bfa" }}
        >
          <Brain size={9} /> Ask ARIA
        </motion.button>
      </div>
    </motion.div>
  );
}
