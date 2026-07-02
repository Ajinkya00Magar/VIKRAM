"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, TrendingDown, Clock, DollarSign, CheckCircle, Loader2, BarChart3 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Legend } from "recharts";
import { usePS13Store, getRiskColor } from "@/store";
import { runSimulation } from "@/lib/api";

export default function SimulationPanel() {
  const { selectedNode } = usePS13Store();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [failureType, setFailureType] = useState("MPLS_FAILURE");
  const [currentRisk, setCurrentRisk] = useState(75);

  async function simulate() {
    const target = selectedNode?.node_id ?? "HUB-RTR-01";
    setLoading(true);
    try {
      const res = await runSimulation(target, failureType, currentRisk);
      setResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Build chart data from simulation result
  const chartData = result
    ? result.future_state_projection.timestamps_minutes.map((t: number, i: number) => ({
        t,
        doNothing: result.future_state_projection.do_nothing_risk_curve[i],
        bestAction: result.future_state_projection.action_risk_curve[i],
      }))
    : [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-acid/10 border border-acid/30 flex items-center justify-center">
            <Play size={14} className="text-acid" />
          </div>
          <div>
            <div className="text-sm font-display font-bold text-white">Counterfactual Sim</div>
            <div className="text-[10px] text-white/30 font-mono">What-If Analysis Engine</div>
          </div>
        </div>

        {/* Config */}
        <div className="space-y-2 mb-3">
          <div>
            <label className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Failure Type</label>
            <select
              value={failureType}
              onChange={(e) => setFailureType(e.target.value)}
              className="w-full mt-1 bg-surface-2 border border-white/10 rounded-md px-2 py-1.5 text-xs font-mono text-white/80 focus:outline-none focus:border-plasma/40"
            >
              {["MPLS_FAILURE","CONGESTION","BGP_FLAP","TUNNEL_DEGRADATION","POLICY_DRIFT","LATENCY_DRIFT"].map((f) => (
                <option key={f} value={f}>{f.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
              Current Risk: <span className="text-white/70">{currentRisk}</span>
            </label>
            <input
              type="range" min={20} max={95} value={currentRisk}
              onChange={(e) => setCurrentRisk(Number(e.target.value))}
              className="w-full mt-1 accent-plasma"
            />
          </div>
        </div>

        <motion.button
          onClick={simulate}
          disabled={loading}
          whileTap={{ scale: 0.97 }}
          className="w-full py-2 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-2"
          style={{
            background: "rgba(87,182,166,0.1)",
            border: "1px solid rgba(87,182,166,0.35)",
            color: "#a3e635",
          }}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          {loading ? "Simulating..." : `Simulate on ${selectedNode?.node_id ?? "HUB-RTR-01"}`}
        </motion.button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div key="empty" className="flex flex-col items-center justify-center h-48 text-center">
              <BarChart3 size={32} className="text-white/10 mb-3" />
              <div className="text-white/20 text-xs font-mono">Run simulation to see<br/>counterfactual outcomes</div>
            </motion.div>
          ) : (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

              {/* Recommended Action */}
              <div
                className="rounded-xl p-3 mb-4"
                style={{ background: "rgba(87,182,166,0.08)", border: "1px solid rgba(87,182,166,0.25)" }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle size={12} className="text-acid" />
                  <span className="text-[10px] font-mono text-acid uppercase tracking-widest">
                    Recommended Action
                  </span>
                </div>
                <div className="text-sm font-display font-bold text-white">
                  {result.recommended_action.action_type.replace(/_/g, " ")}
                </div>
                <div className="text-[10px] text-white/40 font-mono mt-0.5">
                  Target: {result.recommended_action.target_node}
                </div>
              </div>

              {/* Risk Projection Chart */}
              <div className="mb-4">
                <div className="text-[10px] text-white/30 font-mono uppercase tracking-widest mb-2">
                  60-Min Risk Projection
                </div>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={chartData}>
                    <XAxis
                      dataKey="t" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}
                      tickFormatter={(v) => `${v}m`}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(7,13,26,0.95)", border: "1px solid rgba(99,102,241,0.2)",
                        borderRadius: 6, fontSize: 10, fontFamily: "monospace",
                      }}
                    />
                    <ReferenceLine y={80} stroke="rgba(226,99,112,0.4)" strokeDasharray="4 4"
                      label={{ value: "SLA BREACH", fill: "rgba(226,99,112,0.5)", fontSize: 8 }} />
                    <Line
                      type="monotone" dataKey="doNothing" name="Do Nothing"
                      stroke="#e26370" strokeWidth={2} dot={false} strokeDasharray="5 3"
                    />
                    <Line
                      type="monotone" dataKey="bestAction" name="Best Action"
                      stroke="#57b6a6" strokeWidth={2} dot={false}
                    />
                    <Legend wrapperStyle={{ fontSize: 9, fontFamily: "monospace" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Action Outcomes */}
              <div className="text-[10px] text-white/30 font-mono uppercase tracking-widest mb-2">
                Action Comparison
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {result.action_outcomes
                  .sort((a: any, b: any) => b.risk_reduction_pct - a.risk_reduction_pct)
                  .map((outcome: any, i: number) => {
                    const isRecommended =
                      outcome.action.action_type === result.recommended_action.action_type;
                    const reductionColor =
                      outcome.risk_reduction_pct > 70 ? "#57b6a6" :
                      outcome.risk_reduction_pct > 40 ? "#d8b062" : "#dd8a4a";

                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className={`rounded-lg p-2.5 ${isRecommended ? "border border-acid/30" : "border border-white/5"}`}
                        style={isRecommended ? { background: "rgba(87,182,166,0.06)" } : { background: "rgba(255,255,255,0.02)" }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono text-white/70">
                            {outcome.action.action_type.replace(/_/g, " ")}
                            {isRecommended && (
                              <span className="ml-1.5 text-acid text-[8px]">★ BEST</span>
                            )}
                          </span>
                          <span className="text-[10px] font-mono font-bold" style={{ color: reductionColor }}>
                            -{outcome.risk_reduction_pct.toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[9px] font-mono text-white/30">
                          <span><Clock size={7} className="inline mr-0.5" />{outcome.estimated_recovery_minutes}min</span>
                          <span style={{ color: outcome.confidence > 0.8 ? "#57b6a6" : "#d8b062" }}>
                            {(outcome.confidence * 100).toFixed(0)}% conf
                          </span>
                          {outcome.side_effects?.length > 0 && (
                            <span className="text-amber-400/50 truncate max-w-[120px]">
                              ⚠ {outcome.side_effects[0]}
                            </span>
                          )}
                        </div>
                        <div className="metric-bar mt-1.5">
                          <div
                            className="h-full rounded-full transition-all duration-1000"
                            style={{
                              width: `${outcome.risk_reduction_pct}%`,
                              background: reductionColor,
                            }}
                          />
                        </div>
                      </motion.div>
                    );
                  })}

                {/* Do-nothing outcome */}
                {result.do_nothing_outcome && (
                  <div className="rounded-lg p-2.5 border border-red-500/20 bg-red-500/5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono text-red-400/70">DO NOTHING</span>
                      <span className="text-[10px] font-mono text-red-400 font-bold">
                        +{Math.abs(result.do_nothing_outcome.risk_reduction_pct).toFixed(0)}% risk
                      </span>
                    </div>
                    <div className="text-[9px] font-mono text-red-400/40">
                      SLA breach in {result.future_state_projection.time_to_sla_breach_without_action}min
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
