"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import { Shield, Wifi, Server, Radio, Database, Globe } from "lucide-react";
import { getRiskColor, getRiskGlow, type TopologyNode } from "@/store";

const NODE_ICONS: Record<string, React.ElementType> = {
  ROUTER:     Server,
  PE:         Shield,
  CE:         Wifi,
  SITE:       Globe,
  SERVICE:    Database,
  TUNNEL:     Radio,
  SDWAN_CTRL: Radio,
};

const NODE_SIZE: Record<string, number> = {
  PE:         48, ROUTER: 44, SDWAN_CTRL: 40,
  SERVICE:    36, CE: 32,     TUNNEL: 28,    SITE: 38,
};

interface NetworkNodeData {
  node: TopologyNode;
  selected: boolean;
  highlighted?: boolean;
}

const NetworkNode = memo(({ data }: NodeProps) => {
  const { node, selected, highlighted } = data as unknown as NetworkNodeData;
  const color = getRiskColor(node.risk_level);
  const glow  = getRiskGlow(node.risk_level);
  const Icon  = NODE_ICONS[node.node_type] ?? Server;
  const size  = NODE_SIZE[node.node_type] ?? 40;
  const isCritical = node.risk_level === "CRITICAL";
  const isHigh     = node.risk_level === "HIGH";

  return (
    <div className="relative flex flex-col items-center" style={{ userSelect: "none" }}>

      {/* ── Risk pulse rings (critical / high) ── */}
      {(isCritical || isHigh) && (
        <>
          <motion.div
            className="absolute rounded-full border pointer-events-none"
            style={{
              width: size + 8, height: size + 8,
              top: -(size + 8) / 2 + size / 2,
              left: -(size + 8) / 2 + size / 2,
              borderColor: color,
            }}
            animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
          />
          {isCritical && (
            <motion.div
              className="absolute rounded-full border pointer-events-none"
              style={{
                width: size + 8, height: size + 8,
                top: -(size + 8) / 2 + size / 2,
                left: -(size + 8) / 2 + size / 2,
                borderColor: color,
              }}
              animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay: 0.6 }}
            />
          )}
        </>
      )}

      {/* ── Main node body ── */}
      <motion.div
        className="rounded-xl flex items-center justify-center relative cursor-pointer"
        style={{
          width: size, height: size,
          background: `radial-gradient(circle at 35% 35%, ${color}28, ${color}08)`,
          border: `${selected ? 2 : 1.5}px solid ${selected ? color : color + "60"}`,
          boxShadow: selected
            ? `${glow}, 0 0 0 3px ${color}30`
            : isCritical
            ? `${glow}`
            : `0 0 8px ${color}20`,
        }}
        animate={isCritical ? {
          boxShadow: [
            `0 0 15px ${color}50`,
            `0 0 35px ${color}90, 0 0 60px ${color}30`,
            `0 0 15px ${color}50`,
          ],
        } : {}}
        transition={{ duration: 0.9, repeat: Infinity }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
      >
        {/* Critical node indicator */}
        {node.is_critical && (
          <div
            className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
            style={{ background: color, boxShadow: `0 0 4px ${color}` }}
          />
        )}
        <Icon size={size * 0.4} style={{ color }} />
      </motion.div>

      {/* ── Label ── */}
      <div className="mt-1.5 flex flex-col items-center pointer-events-none">
        <span
          className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-sm"
          style={{
            color: "rgba(255,255,255,0.85)",
            background: "rgba(2,4,10,0.75)",
            border: `1px solid ${color}20`,
            maxWidth: 90,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {node.node_id}
        </span>
        {/* Risk score badge */}
        {node.risk_score > 15 && (
          <motion.span
            className="text-[9px] font-mono mt-0.5"
            style={{ color }}
            animate={isCritical ? { opacity: [0.7, 1, 0.7] } : {}}
            transition={{ duration: 0.8, repeat: Infinity }}
          >
            {node.risk_score.toFixed(0)}
          </motion.span>
        )}
      </div>

      {/* ── Metrics tooltip on hover (CSS-driven via parent hover) ── */}
      {selected && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -top-28 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
        >
          <div
            className="glass-panel-bright rounded-lg p-2 text-[10px] font-mono whitespace-nowrap"
            style={{ border: `1px solid ${color}40`, boxShadow: `0 4px 20px rgba(0,0,0,0.5)` }}
          >
            <div className="text-white/70 mb-1">{node.label}</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              <span className="text-white/40">CPU</span>
              <span style={{ color }}>
                {(node.metrics?.cpu_utilization ?? 0).toFixed(1)}%
              </span>
              <span className="text-white/40">BW</span>
              <span style={{ color }}>
                {(node.metrics?.bandwidth_utilization ?? 0).toFixed(1)}%
              </span>
              <span className="text-white/40">Loss</span>
              <span style={{ color }}>
                {(node.metrics?.packet_loss ?? 0).toFixed(2)}%
              </span>
              <span className="text-white/40">Latency</span>
              <span style={{ color }}>
                {(node.metrics?.latency_ms ?? 0).toFixed(1)}ms
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* React Flow handles */}
      <Handle type="target" position={Position.Top}    style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left}   style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right}  style={{ opacity: 0 }} />
    </div>
  );
});

NetworkNode.displayName = "NetworkNode";
export default NetworkNode;
