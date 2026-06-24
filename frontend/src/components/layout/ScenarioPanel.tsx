"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Play, RotateCcw, ChevronRight, Loader2, Activity } from "lucide-react";
import { usePS13Store, getRiskColor } from "@/store";
import { injectScenario, injectFullScenario, resetScenarios, getScenarioAnalysis } from "@/lib/api";

const SCENARIOS = [
  {
    id: "HUB_CONGESTION",
    title: "Hub Congestion",
    subtitle: "Progressive bandwidth saturation",
    icon: "📈",
    color: "#f97316",
    description: "Bulk backup jobs consume HUB-RTR-01 WAN bandwidth without QoS, triggering cascading latency across all spoke sites.",
  },
  {
    id: "BGP_ROUTE_FLAP",
    title: "BGP Route Flap",
    subtitle: "Transit peer session instability",
    icon: "🔄",
    color: "#ef4444",
    description: "ISP transit BGP session experiencing keepalive violations, causing route table churn and internet loss.",
  },
  {
    id: "TUNNEL_DEGRADATION",
    title: "Tunnel Degradation",
    subtitle: "IPSec tunnel quality degrading",
    icon: "🔗",
    color: "#eab308",
    description: "WAN packet corruption causing IPSec SA renegotiation loops on SPOKE-RTR-A, degrading VoIP and ERP.",
  },
  {
    id: "MPLS_FAILURE",
    title: "MPLS Failure",
    subtitle: "Label-switched path collapse",
    icon: "💀",
    color: "#dc2626",
    description: "MPLS-PE-01 FIB table exhaustion causing LDP session flap, collapsing label-switched paths network-wide.",
  },
  {
    id: "POLICY_DRIFT",
    title: "Policy Drift",
    subtitle: "SD-WAN QoS configuration drift",
    icon: "⚙️",
    color: "#a855f7",
    description: "SD-WAN controller firmware upgrade reset QoS templates, demoting VoIP to best-effort class across all tunnels.",
  },
];

export default function ScenarioPanel() {
  const { scenario, setScenario, resetScenario } = usePS13Store();
  const [loading, setLoading] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null);

  async function handleInject(id: string, full = false) {
    setLoading(id);
    try {
      if (full) {
        await injectFullScenario(id);
      } else {
        const step = scenario.active === id ? (scenario.step ?? 0) + 1 : 0;
        await injectScenario(id, Math.min(step, 4));
      }
      // Fetch full analysis
      const result = await getScenarioAnalysis(id);
      setAnalysis(result);
      setExpandedScenario(id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(null);
    }
  }

  async function handleReset() {
    setLoading("reset");
    try {
      await resetScenarios();
      resetScenario();
      setAnalysis(null);
      setExpandedScenario(null);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center">
              <AlertTriangle size={14} className="text-red-400" />
            </div>
            <div>
              <div className="text-sm font-display font-bold text-white">Demo Scenarios</div>
              <div className="text-[10px] text-white/30 font-mono">5 fault injection scenarios</div>
            </div>
          </div>
          <motion.button
            onClick={handleReset}
            disabled={loading === "reset"}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1 text-[10px] font-mono text-white/30 hover:text-white/60 transition-colors px-2 py-1 rounded border border-white/10 hover:border-white/20"
          >
            {loading === "reset"
              ? <Loader2 size={10} className="animate-spin" />
              : <RotateCcw size={10} />
            }
            Reset
          </motion.button>
        </div>

        {/* Active scenario indicator */}
        {scenario.active && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-3 rounded-lg p-2.5"
            style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.25)" }}
          >
            <div className="flex items-center gap-2">
              <Activity size={10} className="text-ember animate-pulse" />
              <span className="text-[10px] font-mono text-ember">
                ACTIVE: {scenario.active?.replace(/_/g, " ")} — {scenario.severity}
              </span>
            </div>
            <div className="mt-1.5 flex gap-1">
              {[0, 1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className="flex-1 h-1 rounded-full transition-all"
                  style={{
                    background: s <= (scenario.step ?? 0)
                      ? "#f97316"
                      : "rgba(255,255,255,0.1)",
                  }}
                />
              ))}
            </div>
            <div className="text-[9px] font-mono text-white/30 mt-1">
              Severity step {(scenario.step ?? 0) + 1}/5
            </div>
          </motion.div>
        )}
      </div>

      {/* Scenario list */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-2">
          {SCENARIOS.map((sc) => {
            const isActive = scenario.active === sc.id;
            const isExpanded = expandedScenario === sc.id;
            const isLoading = loading === sc.id;

            return (
              <motion.div
                key={sc.id}
                className="rounded-xl overflow-hidden border transition-all"
                style={{
                  borderColor: isActive ? `${sc.color}40` : "rgba(255,255,255,0.06)",
                  background: isActive ? `${sc.color}06` : "rgba(255,255,255,0.02)",
                }}
              >
                {/* Scenario header */}
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{sc.icon}</span>
                      <div>
                        <div className="text-xs font-display font-bold text-white">{sc.title}</div>
                        <div className="text-[10px] text-white/40 font-mono">{sc.subtitle}</div>
                      </div>
                    </div>
                    {isActive && (
                      <div
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm flex-shrink-0"
                        style={{ color: sc.color, background: `${sc.color}15`, border: `1px solid ${sc.color}30` }}
                      >
                        ACTIVE
                      </div>
                    )}
                  </div>

                  <p className="text-[10px] text-white/40 font-mono mb-3 leading-relaxed">
                    {sc.description}
                  </p>

                  {/* Action buttons */}
                  <div className="flex gap-1.5">
                    <motion.button
                      onClick={() => handleInject(sc.id)}
                      disabled={!!loading}
                      whileTap={{ scale: 0.95 }}
                      className="flex-1 py-1.5 rounded-md text-[10px] font-mono transition-all flex items-center justify-center gap-1"
                      style={{
                        background: `${sc.color}12`,
                        border: `1px solid ${sc.color}30`,
                        color: sc.color,
                      }}
                    >
                      {isLoading
                        ? <Loader2 size={9} className="animate-spin" />
                        : <ChevronRight size={9} />
                      }
                      {isActive ? "Next Step" : "Inject"}
                    </motion.button>
                    <motion.button
                      onClick={() => handleInject(sc.id, true)}
                      disabled={!!loading}
                      whileTap={{ scale: 0.95 }}
                      className="py-1.5 px-2.5 rounded-md text-[10px] font-mono transition-all"
                      style={{
                        background: "rgba(239,68,68,0.1)",
                        border: "1px solid rgba(239,68,68,0.25)",
                        color: "#f87171",
                      }}
                    >
                      Full
                    </motion.button>
                  </div>
                </div>

                {/* Expanded analysis */}
                <AnimatePresence>
                  {isExpanded && analysis && analysis.scenario_type === sc.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-t"
                      style={{ borderColor: `${sc.color}20` }}
                    >
                      <div className="p-3 space-y-2">
                        {/* Prediction */}
                        {analysis.prediction && (
                          <AnalysisRow
                            label="Prediction"
                            value={`${analysis.prediction.issue_type.replace(/_/g," ")} — ${(analysis.prediction.confidence_score * 100).toFixed(0)}% confidence`}
                            sub={`Impact in ${analysis.prediction.time_to_impact_minutes.toFixed(0)} min`}
                            color={sc.color}
                          />
                        )}
                        {/* Root cause */}
                        <AnalysisRow
                          label="Root Cause"
                          value={analysis.root_cause}
                          color={sc.color}
                        />
                        {/* Blast radius */}
                        {analysis.blast_radius && (
                          <AnalysisRow
                            label="Blast Radius"
                            value={`${analysis.blast_radius.affected_nodes.length} nodes · ${analysis.blast_radius.affected_sites.length} sites · ${analysis.blast_radius.estimated_users_impacted} users`}
                            sub={`Impact score: ${analysis.blast_radius.impact_score.toFixed(0)}/100`}
                            color={sc.color}
                          />
                        )}
                        {/* Top action */}
                        {analysis.action_plan?.ranked_actions?.[0] && (
                          <AnalysisRow
                            label="Top Action"
                            value={analysis.action_plan.ranked_actions[0].action_type.replace(/_/g," ")}
                            sub={`${analysis.action_plan.ranked_actions[0].risk_reduction_pct.toFixed(0)}% risk reduction · ${analysis.action_plan.ranked_actions[0].estimated_recovery_minutes}min`}
                            color="#84cc16"
                          />
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AnalysisRow({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-md p-2" style={{ background: `${color}08`, border: `1px solid ${color}15` }}>
      <div className="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-0.5">{label}</div>
      <div className="text-[10px] font-mono text-white/80">{value}</div>
      {sub && <div className="text-[9px] font-mono text-white/30 mt-0.5">{sub}</div>}
    </div>
  );
}
