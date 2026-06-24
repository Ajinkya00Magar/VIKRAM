"use client";

import { memo } from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";

interface NetworkEdgeData {
  link: {
    link_id: string;
    link_type: string;
    utilization: number;
    latency_ms: number;
    packet_loss: number;
    status: string;
    is_mpls: boolean;
  };
  color: string;
}

const NetworkEdge = memo(({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, style,
}: EdgeProps) => {
  const { link, color } = data as unknown as NetworkEdgeData;
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const isDegraded  = link.status === "DEGRADED" || link.packet_loss > 2;
  const isDown      = link.status === "DOWN";
  const isHighUtil  = link.utilization > 70;
  const isMpls      = link.is_mpls;

  return (
    <>
      {/* ── Shadow / glow pass ── */}
      <path
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={isMpls ? 6 : 3}
        opacity={0.08}
      />

      {/* ── Main edge ── */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          strokeDasharray: isDown ? "6 4" : isMpls ? "none" : "none",
        }}
      />

      {/* ── Animated packet flow ── */}
      {!isDown && link.utilization > 5 && (
        <path
          d={edgePath}
          fill="none"
          stroke={color}
          strokeWidth={isMpls ? 2.5 : 1.5}
          strokeDasharray={isHighUtil ? "6 8" : "4 14"}
          strokeLinecap="round"
          opacity={0.7}
          className={isHighUtil ? "packet-flow-fast" : "packet-flow"}
        />
      )}

      {/* ── Degraded glitch effect ── */}
      {isDegraded && (
        <path
          d={edgePath}
          fill="none"
          stroke="#ef4444"
          strokeWidth={1}
          strokeDasharray="2 18"
          opacity={0.5}
          className="packet-flow"
        />
      )}

      {/* ── Edge label (utilization %) ── */}
      {link.utilization > 30 && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "none",
            }}
          >
            <span
              className="text-[9px] font-mono px-1 py-0.5 rounded-sm"
              style={{
                color,
                background: "rgba(2,4,10,0.85)",
                border: `1px solid ${color}30`,
              }}
            >
              {link.utilization.toFixed(0)}%
              {link.is_mpls && <span className="ml-1 text-plasma text-[8px]">MPLS</span>}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

NetworkEdge.displayName = "NetworkEdge";
export default NetworkEdge;
