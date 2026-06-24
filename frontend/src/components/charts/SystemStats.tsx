"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Activity, Cpu, Wifi, AlertTriangle } from "lucide-react";
import { usePS13Store, getRiskColor, scoreToLevel } from "@/store";

export default function SystemStats() {
  const { nodes, systemRisk, predictions, alerts } = usePS13Store();
  const [riskHistory, setRiskHistory] = useState<{ t: string; risk: number }[]>([]);

  // Rolling risk history
  useEffect(() => {
    setRiskHistory((prev) => {
      const now = new Date().toLocaleTimeString("en", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
      return [...prev.slice(-29), { t: now, risk: systemRisk }];
    });
  }, [systemRisk]);

  // Node metrics for bar chart
  const nodeMetrics = nodes
    .filter((n) => n.risk_score > 0)
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 10)
    .map((n) => ({
      name: n.node_id.replace(/-\d+$/, "").slice(0, 10),
      risk: n.risk_score,
      bw: n.metrics?.bandwidth_utilization ?? 0,
      cpu: n.metrics?.cpu_utilization ?? 0,
      color: getRiskColor(n.risk_level),
    }));

  const riskColor = getRiskColor(scoreToLevel(systemRisk));
  const criticalCount = nodes.filter((n) => n.risk_level === "CRITICAL").length;
  const activeAlerts = alerts.filter((a) => !a.acknowledged).length;

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 gap-4">
      <div className="text-sm font-display font-bold text-white flex items-center gap-2">
        <Activity size={14} className="text-neon" />
        System Overview
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-2">
        <KpiCard label="System Risk" value={systemRisk.toFixed(1)} unit="/100" color={riskColor} />
        <KpiCard label="Active Alerts" value={activeAlerts} color={activeAlerts > 0 ? "#ef4444" : "#22c55e"} />
        <KpiCard label="Predictions" value={predictions.length} color="#f97316" />
        <KpiCard label="Critical Nodes" value={criticalCount} color={criticalCount > 0 ? "#ef4444" : "#22c55e"} />
      </div>

      {/* Rolling risk line chart */}
      <div>
        <div className="text-[10px] text-white/30 font-mono uppercase tracking-widest mb-2">
          System Risk — Live
        </div>
        <ResponsiveContainer width="100%" height={90}>
          <AreaChart data={riskHistory}>
            <defs>
              <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={riskColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={riskColor} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" hide />
            <YAxis domain={[0, 100]} hide />
            <Tooltip
              contentStyle={{
                background: "rgba(7,13,26,0.95)", border: "1px solid rgba(99,102,241,0.2)",
                borderRadius: 6, fontSize: 10, fontFamily: "monospace",
              }}
              formatter={(v: number) => [`${v.toFixed(1)}`, "Risk"]}
            />
            <Area
              type="monotone" dataKey="risk"
              stroke={riskColor} strokeWidth={2}
              fill="url(#riskGrad)" dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Per-node risk bar chart */}
      {nodeMetrics.length > 0 && (
        <div>
          <div className="text-[10px] text-white/30 font-mono uppercase tracking-widest mb-2">
            Node Risk Scores
          </div>
          <ResponsiveContainer width="100%" height={nodeMetrics.length * 22 + 10}>
            <BarChart data={nodeMetrics} layout="vertical" barSize={10}>
              <XAxis type="number" domain={[0, 100]} hide />
              <YAxis
                type="category" dataKey="name" width={80}
                tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(7,13,26,0.95)", border: "1px solid rgba(99,102,241,0.2)",
                  borderRadius: 6, fontSize: 10, fontFamily: "monospace",
                }}
              />
              <Bar dataKey="risk" radius={[0, 4, 4, 0]}>
                {nodeMetrics.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-node bandwidth utilization */}
      {nodeMetrics.length > 0 && (
        <div>
          <div className="text-[10px] text-white/30 font-mono uppercase tracking-widest mb-2">
            Bandwidth Utilization %
          </div>
          {nodeMetrics.slice(0, 6).map((n) => (
            <div key={n.name} className="flex items-center gap-2 mb-1.5">
              <span className="text-[9px] font-mono text-white/40 w-20 truncate">{n.name}</span>
              <div className="flex-1 metric-bar">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: n.bw > 70 ? "#f97316" : "#06b6d4" }}
                  animate={{ width: `${Math.min(n.bw, 100)}%` }}
                  transition={{ duration: 0.8 }}
                />
              </div>
              <span className="text-[9px] font-mono text-white/30 w-8 text-right">
                {n.bw.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Latest predictions */}
      {predictions.length > 0 && (
        <div>
          <div className="text-[10px] text-white/30 font-mono uppercase tracking-widest mb-2">
            Latest Predictions
          </div>
          <div className="space-y-1.5">
            {predictions.slice(0, 4).map((p) => {
              const color = getRiskColor(scoreToLevel(p.risk_score));
              return (
                <div
                  key={p.prediction_id}
                  className="rounded-md p-2 flex items-start gap-2"
                  style={{ background: `${color}08`, border: `1px solid ${color}20` }}
                >
                  <AlertTriangle size={10} style={{ color, flexShrink: 0, marginTop: 1 }} />
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono" style={{ color }}>
                      {p.issue_type.replace(/_/g," ")}
                    </div>
                    <div className="text-[9px] font-mono text-white/30 truncate">
                      {p.node_id} · {p.time_to_impact_minutes.toFixed(0)}min · {(p.confidence_score * 100).toFixed(0)}% conf
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, unit = "", color }: { label: string; value: number | string; unit?: string; color: string }) {
  return (
    <motion.div
      className="glass-panel rounded-xl p-3"
      style={{ borderColor: `${color}25` }}
      whileHover={{ scale: 1.02 }}
    >
      <div className="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-1">{label}</div>
      <div className="text-xl font-display font-bold" style={{ color }}>
        {value}
        {unit && <span className="text-xs text-white/30 ml-0.5">{unit}</span>}
      </div>
    </motion.div>
  );
}
