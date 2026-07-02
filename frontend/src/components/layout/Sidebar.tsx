"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Network, Brain, Zap, Play, AlertTriangle,
  Activity, ChevronRight, Clock, TrendingUp,
} from "lucide-react";
import { usePS13Store, getRiskColor, scoreToLevel } from "@/store";

const NAV_ITEMS = [
  { id: "network",    label: "Network View",  icon: Network,       hotkey: "N" },
  { id: "copilot",   label: "AI Copilot",    icon: Brain,         hotkey: "C" },
  { id: "blast",     label: "Blast Radius",  icon: Zap,           hotkey: "B" },
  { id: "simulation",label: "Simulation",    icon: Play,          hotkey: "S" },
  { id: "scenarios", label: "Scenarios",     icon: AlertTriangle, hotkey: "X" },
] as const;

// ── "Pulled into place by a force" spring ───────────────────────────────────
const PULL_SPRING = { type: "spring", stiffness: 140, damping: 15, mass: 0.9 } as const;

const navContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.12 } },
};
const navItem = {
  hidden: { opacity: 0, x: -24 },
  show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 260, damping: 20 } },
};

export default function Sidebar() {
  const {
    activePanel, setActivePanel,
    nodes, predictions, alerts,
    criticalNodes, sidebarOpen,
  } = usePS13Store();

  const unacknowledged = alerts.filter((a) => !a.acknowledged).length;
  const topPredictions = predictions.slice(0, 5);
  const highRiskNodes = nodes
    .filter((n) => n.risk_score >= 50)
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 8);

  return (
    <motion.aside
      initial={{ x: -90, opacity: 0, width: 256 }}
      animate={{ x: 0, opacity: 1, width: sidebarOpen ? 256 : 0 }}
      transition={PULL_SPRING}
      className="h-full glass-panel border-r border-plasma/20 flex-shrink-0 overflow-hidden"
    >
     <div className="w-64 h-full flex flex-col">

      {/* ── Navigation ── */}
      <motion.nav
        className="p-2 border-b border-white/5"
        variants={navContainer}
        initial="hidden"
        animate="show"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePanel === item.id;
          return (
            <motion.button
              key={item.id}
              variants={navItem}
              onClick={() => setActivePanel(item.id)}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.97 }}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-md mb-0.5
                text-sm font-medium transition-all duration-150
                ${isActive
                  ? "bg-plasma/20 text-white border border-plasma/40"
                  : "text-white/50 hover:text-white hover:bg-white/5"
                }
              `}
            >
              <Icon size={15} className={isActive ? "text-plasma" : ""} />
              <span className="flex-1 text-left">{item.label}</span>
              <span className="text-[10px] font-mono text-white/20 border border-white/10 rounded px-1">
                {item.hotkey}
              </span>
              {item.id === "scenarios" && unacknowledged > 0 && (
                <span className="w-4 h-4 rounded-full bg-red-500 text-[10px] flex items-center justify-center">
                  {unacknowledged}
                </span>
              )}
            </motion.button>
          );
        })}
      </motion.nav>

      {/* ── High Risk Nodes ── */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="text-[10px] text-white/30 font-mono uppercase tracking-widest mb-2">
          High Risk Nodes
        </div>
        <AnimatePresence>
          {highRiskNodes.length === 0 ? (
            <div className="text-xs text-white/20 text-center py-4">All nodes nominal</div>
          ) : (
            highRiskNodes.map((node) => {
              const color = getRiskColor(node.risk_level);
              return (
                <motion.button
                  key={node.node_id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onClick={() => usePS13Store.getState().setSelectedNode(node)}
                  className="w-full flex items-center gap-2 p-2 rounded-md mb-1 hover:bg-white/5 transition-colors"
                >
                  <motion.div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: color }}
                    animate={{ opacity: node.risk_score > 75 ? [0.5, 1, 0.5] : 1 }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  />
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-xs font-mono text-white/80 truncate">{node.node_id}</div>
                    <div className="text-[10px] text-white/30">{node.site}</div>
                  </div>
                  <div className="text-xs font-mono font-bold" style={{ color }}>
                    {node.risk_score.toFixed(0)}
                  </div>
                </motion.button>
              );
            })
          )}
        </AnimatePresence>

        {/* ── Active Predictions ── */}
        {topPredictions.length > 0 && (
          <>
            <div className="text-[10px] text-white/30 font-mono uppercase tracking-widest mt-4 mb-2">
              Active Predictions
            </div>
            {topPredictions.map((pred) => (
              <motion.div
                key={pred.prediction_id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-2 rounded-md mb-1 border border-ember/20 bg-ember/5"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-ember">{pred.issue_type.replace("_", " ")}</span>
                  <span className="text-[10px] font-mono text-white/40">
                    <Clock size={8} className="inline mr-1" />
                    {Math.round(pred.time_to_impact_minutes)}m
                  </span>
                </div>
                <div className="text-[10px] text-white/50 font-mono truncate">{pred.node_id}</div>
                <div className="flex items-center gap-1 mt-1">
                  <div className="flex-1 metric-bar">
                    <div
                      className="h-full bg-ember transition-all duration-1000"
                      style={{ width: `${pred.confidence_score * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-white/30">
                    {(pred.confidence_score * 100).toFixed(0)}%
                  </span>
                </div>
              </motion.div>
            ))}
          </>
        )}
      </div>

      {/* ── Bottom Status ── */}
      <div className="p-3 border-t border-white/5">
        <div className="flex items-center justify-between text-[10px] font-mono text-white/30">
          <span className="flex items-center gap-1">
            <Activity size={9} />
            Telemetry LIVE
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp size={9} />
            ML ACTIVE
          </span>
        </div>
      </div>
     </div>
    </motion.aside>
  );
}
