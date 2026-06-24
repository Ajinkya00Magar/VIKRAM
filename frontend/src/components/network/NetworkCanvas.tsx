"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState, BackgroundVariant,
  type Node, type Edge, MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion } from "framer-motion";
import { usePS13Store, getRiskColor, getRiskGlow } from "@/store";
import NetworkNode from "./NetworkNode";
import NetworkEdge from "./NetworkEdge";

const nodeTypes = { networkNode: NetworkNode };
const edgeTypes = { networkEdge: NetworkEdge };

export default function NetworkCanvas() {
  const { nodes: storeNodes, links: storeLinks, selectedNode, setSelectedNode } = usePS13Store();
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Convert store nodes → React Flow nodes
  useEffect(() => {
    if (!storeNodes.length) return;
    const flowNodes: Node[] = storeNodes.map((n) => ({
      id: n.node_id,
      type: "networkNode",
      position: { x: n.position_x, y: n.position_y },
      data: {
        node: n,
        selected: selectedNode?.node_id === n.node_id,
      },
      draggable: true,
    }));
    setRfNodes(flowNodes);
  }, [storeNodes, selectedNode, setRfNodes]);

  // Convert store links → React Flow edges
  useEffect(() => {
    if (!storeLinks.length) return;
    const flowEdges: Edge[] = storeLinks.map((l) => {
      const utilColor =
        l.utilization > 80 ? "#f97316" :
        l.utilization > 60 ? "#eab308" :
        l.packet_loss > 2  ? "#ef4444" :
        l.status === "DOWN" ? "#ef4444" :
        "#06b6d4";

      return {
        id: l.link_id,
        source: l.source,
        target: l.target,
        type: "networkEdge",
        animated: l.utilization > 50 || l.status === "DEGRADED",
        data: { link: l, color: utilColor },
        style: { stroke: utilColor, strokeWidth: l.is_mpls ? 2.5 : 1.5, opacity: l.status === "DOWN" ? 0.3 : 1 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: utilColor,
          width: 8, height: 8,
        },
      };
    });
    setRfEdges(flowEdges);
  }, [storeLinks, setRfEdges]);

  // Sync risk score changes to React Flow node data
  useEffect(() => {
    setRfNodes((nds) =>
      nds.map((n) => {
        const storeNode = storeNodes.find((s) => s.node_id === n.id);
        if (!storeNode) return n;
        return {
          ...n,
          data: {
            ...n.data,
            node: storeNode,
            selected: selectedNode?.node_id === n.id,
          },
        };
      })
    );
  }, [storeNodes, selectedNode, setRfNodes]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const storeNode = storeNodes.find((n) => n.node_id === node.id);
      setSelectedNode(storeNode ?? null);
    },
    [storeNodes, setSelectedNode]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.3}
        maxZoom={3}
        className="w-full h-full"
        colorMode="dark"
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="rgba(99,102,241,0.12)"
          gap={30}
          size={1}
        />
        <Controls className="!bottom-4 !left-4" />
        <MiniMap
          nodeColor={(n) => {
            const sn = storeNodes.find((s) => s.node_id === n.id);
            return sn ? getRiskColor(sn.risk_level) : "#374151";
          }}
          maskColor="rgba(2,4,10,0.7)"
          className="!bottom-4 !right-4 !w-36 !h-24"
        />
      </ReactFlow>

      {/* Empty state */}
      {storeNodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div
            className="text-center"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="text-white/20 text-sm font-mono mb-2">Loading network topology...</div>
            <div className="text-white/10 text-xs font-mono">Connecting to digital twin</div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
