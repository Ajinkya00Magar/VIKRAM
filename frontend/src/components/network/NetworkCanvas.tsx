"use client";

import { useCallback, useEffect } from "react";
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState, BackgroundVariant,
  type Node, type Edge, MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion } from "framer-motion";
import { usePS13Store, getRiskColor } from "@/store";
import NetworkNode from "./NetworkNode";
import NetworkEdge from "./NetworkEdge";

const nodeTypes = { networkNode: NetworkNode };
const edgeTypes = { networkEdge: NetworkEdge };

export default function NetworkCanvas() {
  const { nodes: storeNodes, links: storeLinks, selectedNode, setSelectedNode } = usePS13Store();
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // 1. Init & update Nodes (Preserve dragged positions)
  useEffect(() => {
    if (!storeNodes.length) return;

    setRfNodes((currentNodes) => {
      const existingMap = new Map(currentNodes.map((n) => [n.id, n]));

      return storeNodes.map((sn) => {
        const existing = existingMap.get(sn.node_id);
        const isSelected = selectedNode?.node_id === sn.node_id;
        
        if (existing) {
          // Keep existing position, only update data
          return {
            ...existing,
            data: { ...existing.data, node: sn, selected: isSelected },
          };
        }

        // New node, use initial structured positions
        return {
          id: sn.node_id,
          type: "networkNode",
          position: { x: sn.position_x, y: sn.position_y },
          data: { node: sn, selected: isSelected },
          draggable: true,
        };
      });
    });
  }, [storeNodes, selectedNode, setRfNodes]);

  // 2. Build Edges
  useEffect(() => {
    if (!storeLinks.length) return;
    const flowEdges: Edge[] = storeLinks.map((l) => {
      const utilColor =
        l.status === "DOWN" ? "#e26370" :
        l.packet_loss > 2  ? "#e26370" :
        l.utilization > 80 ? "#dd8a4a" :
        l.utilization > 60 ? "#d8b062" :
        "#8fb4ff";

      return {
        id: l.link_id,
        source: l.source,
        target: l.target,
        type: "networkEdge",
        animated: l.utilization > 50 || l.status === "DEGRADED",
        data: { link: l, color: utilColor },
        style: { stroke: utilColor, strokeWidth: l.is_mpls ? 2.5 : 1.5, opacity: l.status === "DOWN" ? 0.3 : 1 },
        markerEnd: { type: MarkerType.ArrowClosed, color: utilColor, width: 8, height: 8 },
      };
    });
    setRfEdges(flowEdges);
  }, [storeLinks, setRfEdges]);

  // 3. Selection handling
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const storeNode = storeNodes.find((n) => n.node_id === node.id);
      setSelectedNode(storeNode ?? null);
    },
    [storeNodes, setSelectedNode]
  );

  const onPaneClick = useCallback(() => setSelectedNode(null), [setSelectedNode]);

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
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.3}
        maxZoom={3}
        className="w-full h-full"
        colorMode="dark"
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="rgba(143,180,255,0.10)"
          gap={30}
          size={1}
        />
        <Controls className="!bottom-4 !left-4" />
        <MiniMap
          nodeColor={(n) => {
            const sn = storeNodes.find((s) => s.node_id === n.id);
            return sn ? getRiskColor(sn.risk_level) : "#8b93a3";
          }}
          maskColor="rgba(10,11,14,0.7)"
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
            <div className="text-white/20 text-sm font-mono mb-2">Initialising network topology…</div>
            <div className="text-white/10 text-xs font-mono">Spinning up digital twin</div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
