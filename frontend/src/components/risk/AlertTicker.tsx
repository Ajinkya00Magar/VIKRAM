"use client";

import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { usePS13Store, getRiskColor } from "@/store";

export default function AlertTicker() {
  const { alerts, acknowledgeAlert } = usePS13Store();
  const unacked = alerts.filter((a) => !a.acknowledged);

  if (unacked.length === 0) return null;

  return (
    <div className="h-8 bg-red-950/40 border-b border-red-500/30 flex items-center px-3 gap-3 overflow-hidden flex-shrink-0">
      {/* Static label */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <motion.div
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 0.7, repeat: Infinity }}
        >
          <AlertTriangle size={11} className="text-red-400" />
        </motion.div>
        <span className="text-[10px] font-mono text-red-400 font-bold tracking-widest uppercase">
          ALERTS
        </span>
        <span className="text-[10px] font-mono text-white/30 border border-white/10 rounded px-1">
          {unacked.length}
        </span>
      </div>

      <div className="w-px h-4 bg-red-500/30 flex-shrink-0" />

      {/* Scrolling ticker */}
      <div className="flex-1 overflow-hidden">
        <motion.div
          className="flex items-center gap-8"
          animate={{ x: ["0%", "-50%"] }}
          transition={{
            duration: Math.max(unacked.length * 6, 12),
            repeat: Infinity,
            ease: "linear",
          }}
          style={{ width: "200%" }}
        >
          {[...unacked, ...unacked].map((alert, i) => {
            const color = getRiskColor(alert.urgency);
            return (
              <span
                key={`${alert.id}-${i}`}
                className="text-[10px] font-mono whitespace-nowrap flex items-center gap-2"
              >
                <span
                  className="px-1.5 py-0.5 rounded-sm text-[9px]"
                  style={{ color, background: `${color}18`, border: `1px solid ${color}30` }}
                >
                  {alert.urgency}
                </span>
                <span className="text-white/60">{alert.node_id}</span>
                <span className="text-white/40">—</span>
                <span style={{ color }}>{alert.message}</span>
              </span>
            );
          })}
        </motion.div>
      </div>

      {/* Dismiss all */}
      <button
        onClick={() => unacked.forEach((a) => acknowledgeAlert(a.id))}
        className="flex-shrink-0 text-white/30 hover:text-white transition-colors"
      >
        <X size={12} />
      </button>
    </div>
  );
}
